// One bot's mind. It thinks at 10 Hz (perception, then a mode: engage, hunt, investigate or
// follow orders) and steers every step through the same controls the player has: a wished move
// direction, a stance, yaw and pitch, the trigger and Use. Its aim is human: a reaction delay
// on first sight, an aim error that settles while it tracks, a turn-rate limit, short bursts at
// range, and it stops (counter-strafes) before it fires a rifle, then strafes between bursts.
import { AI } from '../core/config.js';
import { SLOT } from '../data/weapons.js';
import { findPath } from '../world/nav.js';
import { siteAt, cellX, cellZ } from '../world/grid.js';
import { eyeHeight, maxSpeed } from '../sim/mover.js';
import { activeWeapon, equip, bestSlot } from '../sim/combatant.js';
import { startReload, throwGrenade, inaccuracy } from '../sim/arms.js';
import { createMemory, look } from './perception.js';

const TAU = Math.PI * 2;
const wrap = (a) => a - TAU * Math.round(a / TAU);
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

export function createBrain(bot, skill, seedOffset) {
  bot.brain = {
    skill, memory: createMemory(), role: '',
    goals: [], goalIndex: 0, path: [], pathIndex: 0, repath: true, pathGoalX: NaN, pathGoalZ: NaN,
    mode: 'orders', waiting: false, thinkIn: (seedOffset % 10) * 0.01,
    wishX: 0, wishZ: 0, wantYaw: 0, wantPitch: 0, scan: 0,
    strafe: 1, strafeTime: 0, burstLen: 3, burstPause: 0,
    stuckTime: 0, smoked: false, flashed: false, fragged: false, planting: false,
  };
}

/** One fixed step of a bot. ctx = { state, events, grenades, kill }. */
export function stepBrain(bot, dt, ctx) {
  const b = bot.brain;
  b.thinkIn -= dt;
  if (b.thinkIn <= 0) {
    b.thinkIn += AI.thinkInterval;
    think(bot, ctx);
  }
  control(bot, dt, ctx);
}

// ---- Decisions (10 Hz) -----------------------------------------------------------------------
function think(bot, ctx) {
  const { state, grenades, events } = ctx;
  const b = bot.brain, mem = b.memory;
  bot.flash = Math.max(0, bot.flash - AI.thinkInterval);
  if (state.phase === 'freeze' || state.phase === 'menu') { b.mode = 'frozen'; return; }
  look(bot, state, grenades, events);

  const w = activeWeapon(bot);
  if (mem.visible) {
    b.mode = 'engage';
    if (bot.active === SLOT.GRENADE || bot.active === SLOT.CHARGE || (w && w.def.melee)) equip(bot, bestSlot(bot));
    const gun = activeWeapon(bot);
    if (gun && !gun.def.melee && gun.mag === 0 && gun.reserve === 0) equip(bot, SLOT.SIDEARM);
    return;
  }
  // Nothing in sight: reload in cover, consider a grenade, then hunt, listen or follow orders.
  if (w && !w.def.melee && w.mag < w.def.mag * 0.4 && w.reserve > 0) startReload(bot, events);
  if (bot.active !== bestSlot(bot) && bot.reloadTimer <= 0 && bot.active !== SLOT.CHARGE) equip(bot, bestSlot(bot));
  utilityGrenades(bot, ctx);

  const remembered = mem.target && mem.target.alive && state.time - mem.lastSeen < AI.memory;
  const holding = currentGoal(b)?.act === 'hold' && state.sideOf(bot) === 'def' && state.charge.phase !== 'planted';
  if (remembered && !holding && !(b.role === 'carrier' && state.charge.phase === 'carried')) {
    b.mode = 'hunt';
    setPathTarget(b, mem.lastX, mem.lastZ);
  } else if (remembered) {
    b.mode = 'watch';
  } else if (state.time - mem.heardTime < 2.5) {
    b.mode = 'listen';
  } else {
    if (b.mode === 'hunt' || b.mode === 'engage') b.repath = true;
    b.mode = 'orders';
  }
  const g = currentGoal(b);
  if (b.mode === 'orders' || b.mode === 'listen') {
    if (g) setPathTarget(b, g.x, g.z);
  }
  if (b.repath) {
    b.repath = false;
    findPath(bot.pos.x, bot.pos.z, b.pathGoalX, b.pathGoalZ, b.path);
    b.pathIndex = 0;
  }
}

function currentGoal(b) {
  return b.goals[Math.min(b.goalIndex, b.goals.length - 1)] ?? null;
}

function setPathTarget(b, x, z) {
  if (Math.abs(x - b.pathGoalX) > 0.8 || Math.abs(z - b.pathGoalZ) > 0.8 || Number.isNaN(b.pathGoalX)) {
    b.pathGoalX = x;
    b.pathGoalZ = z;
    b.repath = true;
  }
}

function utilityGrenades(bot, ctx) {
  const { state } = ctx;
  const b = bot.brain, mem = bot.brain.memory;
  const plan = state.plan.attack;
  const g = currentGoal(b);
  if (plan && state.plan.executing && b.waiting === false && g && state.sideOf(bot) === 'atk') {
    const throwerGoal = b.goals.find((q) => q.smoke || q.flash);
    if (throwerGoal?.smoke && !b.smoked && bot.grenades.smoke > 0) {
      b.smoked = true; lob(bot, 'smoke', plan.smoke, ctx);
      return;
    }
    if (throwerGoal?.flash && !b.flashed && bot.grenades.flash > 0) {
      b.flashed = true; lob(bot, 'flash', plan.flash, ctx);
      return;
    }
  }
  // A frag at an enemy that just ducked out of sight, once a round.
  if (!b.fragged && bot.grenades.frag > 0 && mem.target && state.time - mem.lastSeen > 0.6 && state.time - mem.lastSeen < 2.5) {
    const d = Math.hypot(mem.lastX - bot.pos.x, mem.lastZ - bot.pos.z);
    if (d > 7 && d < 24 && state.rng.chance(0.35)) {
      b.fragged = true;
      lobAt(bot, 'frag', mem.lastX, 0.3, mem.lastZ, ctx);
    }
  }
}

function lob(bot, kind, cell, ctx) {
  lobAt(bot, kind, cellX(cell[0]), 1, cellZ(cell[1]), ctx);
}

/** Solves the low ballistic arc to land a grenade at (tx, ty, tz) and throws it. */
function lobAt(bot, kind, tx, ty, tz, ctx) {
  const ey = bot.pos.y + eyeHeight(bot);
  const dx = tx - bot.pos.x, dz = tz - bot.pos.z;
  const d = Math.max(1, Math.hypot(dx, dz) * 0.82);
  const h = ty - ey, v = 16.3, g = 17;
  const disc = v ** 4 - g * (g * d * d + 2 * h * v * v);
  const theta = disc >= 0 ? Math.atan((v * v - Math.sqrt(disc)) / (g * d)) : Math.PI / 4;
  const yaw = yawTo(dx, dz);
  bot.yaw = yaw;
  throwGrenade(bot, kind, yaw, theta - 0.12, ctx);
}

// ---- Control (every step) --------------------------------------------------------------------
const aim = { yaw: 0, pitch: 0 };

function control(bot, dt, ctx) {
  const { state } = ctx;
  const b = bot.brain, mem = b.memory;
  bot.triggerHeld = false;
  bot.wantUse = false;
  bot.walking = false;
  b.wishX = 0; b.wishZ = 0;
  if (b.mode === 'frozen') { b.waiting = false; return; }
  const g = currentGoal(b);

  if (b.mode === 'engage' && mem.target) {
    engage(bot, dt, ctx);
  } else {
    if (bot.crouching && !(g && g.act === 'defuse')) bot.crouching = false;
    b.waiting = false;
    if (b.mode === 'hunt') {
      followPath(bot, true);
      faceToward(bot, mem.lastX, mem.target ? mem.target.pos.y + 1.4 : 1.4, mem.lastZ, aim);
    } else if (b.mode === 'watch') {
      faceToward(bot, mem.lastX, 1.4, mem.lastZ, aim);
    } else {
      const arrived = g && b.pathIndex >= b.path.length / 2 && Math.hypot(g.x - bot.pos.x, g.z - bot.pos.z) < 1.4;
      if (arrived) onGoal(bot, g, ctx);
      else followPath(bot, g?.quiet || b.mode === 'listen');
      if (b.mode === 'listen') faceToward(bot, mem.heardX, 1.5, mem.heardZ, aim);
      else lookAlong(bot, g, arrived, aim);
    }
    turn(bot, aim.yaw, aim.pitch, AI.turnRate * dt);
  }
  separate(bot, state);
  // Stuck on a corner or a teammate: nudge sideways and re-plan.
  const moving = Math.hypot(b.wishX, b.wishZ) > 0.1;
  if (moving && Math.hypot(bot.vel.x, bot.vel.z) < 0.5) {
    b.stuckTime += dt;
    if (b.stuckTime > 0.7) { b.stuckTime = -0.4; b.repath = true; b.strafe = -b.strafe; }
  } else if (b.stuckTime > 0) b.stuckTime = 0;
  if (b.stuckTime < 0) {
    const wx = b.wishX;
    b.wishX -= b.wishZ * b.strafe;
    b.wishZ += wx * b.strafe;
    b.stuckTime = Math.min(0, b.stuckTime + dt);
  }
}

function onGoal(bot, g, ctx) {
  const { state } = ctx;
  const b = bot.brain;
  if (g.wait && !state.plan.executing) { b.waiting = true; return; }
  switch (g.act) {
    case 'plant':
      if (bot.hasCharge && siteAt(bot.pos.x, bot.pos.z)) {
        if (bot.active !== SLOT.CHARGE) equip(bot, SLOT.CHARGE);
        bot.wantUse = true;
      } else if (b.goalIndex < b.goals.length - 1) b.goalIndex++;
      return;
    case 'defuse':
      if (state.charge.phase === 'planted') { bot.crouching = true; bot.wantUse = true; }
      return;
    case 'hold':
    case 'pickup':
      return;
    default:
      if (b.goalIndex < b.goals.length - 1) { b.goalIndex++; b.repath = true; }
  }
}

function followPath(bot, quiet) {
  const b = bot.brain;
  const n = b.path.length / 2;
  while (b.pathIndex < n) {
    const px = b.path[b.pathIndex * 2], pz = b.path[b.pathIndex * 2 + 1];
    const dx = px - bot.pos.x, dz = pz - bot.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < (b.pathIndex === n - 1 ? 0.35 : 0.8)) { b.pathIndex++; continue; }
    b.wishX = dx / d; b.wishZ = dz / d;
    bot.walking = quiet;
    return;
  }
}

function lookAlong(bot, g, arrived, out) {
  const b = bot.brain;
  if (arrived && g && !Number.isNaN(g.lookX)) {
    // Hold an angle, with a small idle sweep so a post does not look frozen.
    b.scan += 0.016;
    faceToward(bot, g.lookX, 1.5, g.lookZ, out);
    out.yaw += Math.sin(b.scan * 0.9 + bot.id) * 0.18;
    return;
  }
  const n = b.path.length / 2;
  if (b.pathIndex < n) {
    const i = Math.min(n - 1, b.pathIndex + (n - b.pathIndex > 1 ? 1 : 0));
    faceToward(bot, b.path[i * 2], 1.55, b.path[i * 2 + 1], out);
  } else {
    out.yaw = bot.yaw; out.pitch = 0;
  }
}

function faceToward(bot, x, y, z, out) {
  const dx = x - bot.pos.x, dz = z - bot.pos.z;
  out.yaw = yawTo(dx, dz);
  out.pitch = Math.atan2(y - (bot.pos.y + eyeHeight(bot)), Math.max(0.1, Math.hypot(dx, dz)));
  return out;
}

function turn(bot, yaw, pitch, maxStep) {
  const dy = wrap(yaw - bot.yaw);
  const dp = pitch - bot.pitch;
  // Ease in: a big correction sweeps at the turn rate, the last few degrees settle smoothly.
  bot.yaw = wrap(bot.yaw + Math.sign(dy) * Math.min(Math.abs(dy), Math.max(maxStep * 0.25, Math.abs(dy) * 0.35), maxStep));
  bot.pitch += Math.sign(dp) * Math.min(Math.abs(dp), Math.max(maxStep * 0.2, Math.abs(dp) * 0.35), maxStep);
}

// Keep teammates from stacking into one body.
function separate(bot, state) {
  const b = bot.brain;
  for (const o of state.actors) {
    if (o === bot || !o.alive || o.team !== bot.team) continue;
    const dx = bot.pos.x - o.pos.x, dz = bot.pos.z - o.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 0.81 && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      b.wishX += (dx / d) * (0.9 - d) * 1.5;
      b.wishZ += (dz / d) * (0.9 - d) * 1.5;
    }
  }
}

// ---- Fighting --------------------------------------------------------------------------------
function engage(bot, dt, ctx) {
  const { state } = ctx;
  const b = bot.brain, mem = b.memory, t = mem.target;
  const w = activeWeapon(bot);
  const dx = t.pos.x - bot.pos.x, dz = t.pos.z - bot.pos.z;
  const dist = Math.hypot(dx, dz);
  // Aim point: the chest, or the head for a sharp bot up close; plus the settling error.
  const headY = t.pos.y + eyeHeight(t) + 0.03;
  const chestY = t.pos.y + 1.2 * (eyeHeight(t) / 1.62);
  const aimY = b.skill > 0.95 && dist < 22 ? headY : chestY + (headY - chestY) * 0.35;
  const targetSpeed = Math.hypot(t.vel.x, t.vel.z);
  mem.aimError = AI.aimErrorSettle / b.skill + (mem.aimError - AI.aimErrorSettle / b.skill) * Math.exp(-AI.aimSettleRate * b.skill * dt);
  const err = mem.aimError + targetSpeed * 0.0035;
  faceToward(bot, t.pos.x, aimY, t.pos.z, aim);
  aim.yaw += mem.errX * err;
  aim.pitch += mem.errY * err * 0.6 - bot.punchPitch * 1.6; // bots pull down against recoil
  turn(bot, aim.yaw, aim.pitch, AI.turnRate * 1.7 * dt);
  mem.reaction -= dt;

  const def = w?.def;
  const precise = def && !def.auto && def.slot === SLOT.PRIMARY; // marksman: stop dead
  const runAndGun = def && (def.id === 'hornet' || def.id === 'bracken') && dist < 12;
  const aligned = Math.abs(wrap(aim.yaw - bot.yaw)) < 0.035 + 0.3 / Math.max(dist, 1) && Math.abs(aim.pitch - bot.pitch) < 0.05;

  // Movement: strafe while the next burst is not ready; stop dead to fire.
  b.burstPause -= dt;
  b.strafeTime -= dt;
  if (b.strafeTime <= 0) { b.strafe = state.rng.chance(0.5) ? 1 : -1; b.strafeTime = state.rng.range(0.35, 0.8); }
  const sideX = Math.cos(bot.yaw) * b.strafe, sideZ = -Math.sin(bot.yaw) * b.strafe;
  const wantsShot = mem.reaction <= 0 && w && !def.melee && w.mag > 0 && bot.reloadTimer <= 0 && bot.drawTimer <= 0;
  if (def?.melee) {
    b.wishX = dx / dist; b.wishZ = dz / dist;
    if (dist < 1.6) bot.triggerHeld = true;
    return;
  }
  if (wantsShot && b.burstPause <= 0) {
    if (runAndGun) { b.wishX = sideX; b.wishZ = sideZ; }
    const speed = Math.hypot(bot.vel.x, bot.vel.z);
    const steady = runAndGun || speed < maxSpeed(bot, def.speed) * (precise ? 0.12 : 0.3);
    // Crouch for a long-range burst now and then, as a human would.
    bot.crouching = dist > 20 && def.auto && b.skill > 0.85;
    if (aligned && steady && inaccuracy(bot) < Math.max(0.02, 1.2 / dist)) {
      if (def.auto) {
        bot.triggerHeld = true;
        if (bot.sprayCount >= b.burstLen) {
          bot.triggerHeld = false;
          b.burstPause = state.rng.range(0.18, 0.42) + (dist > 25 ? 0.2 : 0);
          b.burstLen = dist > 30 ? 2 : dist > 15 ? state.rng.int(3, 5) : state.rng.int(6, 12);
        }
      } else {
        bot.triggerHeld = !bot.triggerWasHeld && bot.fireCooldown <= 0;
      }
    }
  } else {
    bot.crouching = false;
    if (w && w.mag === 0) startReload(bot, ctx.events);
    // Between bursts: strafe across their line of fire, or close in with a short-range gun.
    b.wishX = sideX; b.wishZ = sideZ;
    if (runAndGun || dist > 30) { b.wishX += (dx / dist) * 0.6; b.wishZ += (dz / dist) * 0.6; }
  }
}
