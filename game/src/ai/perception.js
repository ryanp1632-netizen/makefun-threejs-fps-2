// What a bot knows: sight (a view cone, range, a clear line to the head or chest, no smoke in
// between, not blinded) and hearing (gunfire, running footsteps, grenades, the charge being
// planted or defused). Sightings are shared with the team as intel and spoken on the radio.
import { AI } from '../core/config.js';
import { clearLine, placeName } from '../world/grid.js';
import { eyeHeight } from '../sim/mover.js';

export function createMemory() {
  return {
    target: null, firstSeen: 0, lastSeen: -99, lastX: 0, lastZ: 0, visible: false,
    reaction: 0, aimError: 0, errX: 0, errY: 0,
    heardTime: -99, heardX: 0, heardZ: 0, heardKind: '',
  };
}

/** Sight pass for one bot; updates its memory and the team's intel. */
export function look(bot, state, grenades, events) {
  const mem = bot.brain.memory;
  const ex = bot.pos.x, ey = bot.pos.y + eyeHeight(bot), ez = bot.pos.z;
  const fx = -Math.sin(bot.yaw), fz = -Math.cos(bot.yaw);
  const blind = bot.flash > 0.5;
  let best = null;
  let bestScore = Infinity;
  for (const enemy of state.actors) {
    if (!enemy.alive || enemy.team === bot.team) continue;
    const dx = enemy.pos.x - ex, dz = enemy.pos.z - ez;
    const dist = Math.hypot(dx, dz);
    if (dist > AI.viewRange || blind) continue;
    const inCone = (dx * fx + dz * fz) / Math.max(dist, 1e-3) > AI.fovCos;
    if (!inCone && dist > AI.closeSense) continue;
    const headY = enemy.pos.y + eyeHeight(enemy) + 0.02;
    const chestY = enemy.pos.y + 1.15 * (eyeHeight(enemy) / 1.62);
    const seesHead = clearLine(ex, ey, ez, enemy.pos.x, headY, enemy.pos.z);
    if (!seesHead && !clearLine(ex, ey, ez, enemy.pos.x, chestY, enemy.pos.z)) continue;
    if (grenades.smokeBlocks(ex, ey, ez, enemy.pos.x, headY, enemy.pos.z)) continue;
    // Prefer the current target, then the nearest; a moving enemy in the open draws the eye.
    const score = dist * (enemy === mem.target ? 0.6 : 1);
    if (score < bestScore) { bestScore = score; best = enemy; }
  }
  mem.visible = !!best;
  if (best) {
    if (best !== mem.target || state.time - mem.lastSeen > 1.2) {
      mem.target = best;
      mem.firstSeen = state.time;
      const skill = bot.brain.skill;
      mem.reaction = (AI.reactionMin + state.rng.next() * (AI.reactionMax - AI.reactionMin)) / skill;
      mem.aimError = AI.aimErrorStart / skill;
      mem.errX = state.rng.range(-1, 1);
      mem.errY = state.rng.range(-0.6, 1);
      shareSighting(bot, best, state, events);
    }
    mem.lastSeen = state.time;
    mem.lastX = best.pos.x;
    mem.lastZ = best.pos.z;
  } else if (mem.target && (state.time - mem.lastSeen > AI.memory || !mem.target.alive)) {
    mem.target = null;
  }
}

function shareSighting(bot, enemy, state, events) {
  const team = state.intel[bot.team];
  const fresh = state.time - team.time > 4;
  team.time = state.time;
  team.x = enemy.pos.x;
  team.z = enemy.pos.z;
  team.spotted++;
  const place = placeName(enemy.pos.x, enemy.pos.z);
  team.site = /\bA\b|Pan|Long|Catwalk/.test(place) ? 'A' : /\bB\b|Dock|Pump|Culvert/.test(place) ? 'B' : null;
  if (fresh) events.emit('radio', { from: bot, text: `contact, ${place}` });
}

/** The bots' ears: every noisy event of the simulation is heard by enemies within its range. */
export function listen(state, events) {
  events.on('shot', (s) => { if (s.pellet === 0) hear(state, s.ox, s.oz, AI.hearGunshot, s.shooter.team, 'shot'); });
  events.on('step', ({ actor }) => hear(state, actor.pos.x, actor.pos.z, AI.hearStep, actor.team, 'step'));
  events.on('detonate', (d) => hear(state, d.x, d.z, AI.hearGrenade, d.owner.team, 'grenade'));
  events.on('plantStart', (a) => hear(state, a.pos.x, a.pos.z, AI.hearObjective, a.team, 'plant'));
  events.on('defuseStart', (a) => hear(state, a.pos.x, a.pos.z, AI.hearObjective, a.team, 'defuse'));
  // Being shot is the loudest call of all: the victim turns toward the shooter.
  events.on('damage', ({ attacker, target }) => {
    if (!target.brain || !attacker || attacker.team === target.team) return;
    const m = target.brain.memory;
    m.heardTime = state.time; m.heardX = attacker.pos.x; m.heardZ = attacker.pos.z; m.heardKind = 'hit';
  });
}

/** A sound at (x, z) of the given kind reaches every enemy bot within its radius. */
export function hear(state, x, z, radius, sourceTeam, kind) {
  for (const bot of state.actors) {
    if (!bot.brain || !bot.alive || bot.team === sourceTeam) continue;
    const d = Math.hypot(bot.pos.x - x, bot.pos.z - z);
    if (d > radius) continue;
    const mem = bot.brain.memory;
    mem.heardTime = state.time;
    mem.heardX = x;
    mem.heardZ = z;
    mem.heardKind = kind;
  }
}
