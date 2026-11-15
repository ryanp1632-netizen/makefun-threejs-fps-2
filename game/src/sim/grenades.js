// Thrown grenades and what they leave behind. Projectiles fly under gravity and bounce off the
// map (the same grid raycast bullets use), then detonate: a frag hurts everyone it can see, a
// smoke grows into a sight-blocking cloud, a flash blinds whoever is looking at it. Projectiles
// and clouds live in fixed pools.
import { GRENADES } from '../data/weapons.js';
import { raycast, rayHit, clearLine } from '../world/grid.js';
import { applyDamage } from './combatant.js';
import { eyeHeight } from './mover.js';

const GRAVITY = 17;
const POOL = 16;

export function createGrenades(state, events) {
  const projectiles = [];
  const smokes = [];
  for (let i = 0; i < POOL; i++) {
    projectiles.push({ active: false, kind: '', owner: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0, rest: false });
    smokes.push({ active: false, x: 0, y: 0, z: 0, radius: 0, age: 0, life: 0 });
  }
  state.projectiles = projectiles;
  state.smokes = smokes;

  function spawn(kind, owner, x, y, z, vx, vy, vz) {
    const p = projectiles.find((q) => !q.active);
    if (!p) return;
    p.active = true; p.kind = kind; p.owner = owner; p.rest = false;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.fuse = GRENADES[kind].fuse;
  }

  function update(dt) {
    for (let i = 0; i < POOL; i++) {
      const p = projectiles[i];
      if (!p.active) continue;
      p.fuse -= dt;
      if (!p.rest) fly(p, dt);
      if (p.fuse <= 0) { p.active = false; detonate(p); }
    }
    for (let i = 0; i < POOL; i++) {
      const s = smokes[i];
      if (!s.active) continue;
      s.age += dt;
      const grow = Math.min(1, s.age / 1.3);
      const fade = Math.min(1, (s.life - s.age) / 2.5);
      s.radius = GRENADES.smoke.radius * grow * (0.35 + 0.65 * Math.max(0, fade));
      if (s.age >= s.life) s.active = false;
    }
  }

  function fly(p, dt) {
    p.vy -= GRAVITY * dt;
    const speed = Math.hypot(p.vx, p.vy, p.vz);
    const step = speed * dt;
    if (step < 1e-5) return;
    const dx = p.vx / speed, dy = p.vy / speed, dz = p.vz / speed;
    const hit = raycast(p.x, p.y, p.z, dx, dy, dz, step + 0.06);
    if (hit < step + 0.06 && rayHit.solid) {
      // Reflect about the surface normal, losing energy; roll to rest on the floor.
      p.x += dx * Math.max(0, hit - 0.06); p.y += dy * Math.max(0, hit - 0.06); p.z += dz * Math.max(0, hit - 0.06);
      const dot = p.vx * rayHit.nx + p.vy * rayHit.ny + p.vz * rayHit.nz;
      p.vx = (p.vx - 2 * dot * rayHit.nx) * 0.5;
      p.vy = (p.vy - 2 * dot * rayHit.ny) * 0.38;
      p.vz = (p.vz - 2 * dot * rayHit.nz) * 0.5;
      events.emit('bounce', p);
      if (rayHit.ny > 0.7 && Math.abs(p.vy) < 1.2 && Math.hypot(p.vx, p.vz) < 0.8) p.rest = true;
    } else {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
  }

  function detonate(p) {
    const def = GRENADES[p.kind];
    const cy = p.y + 0.25;
    if (p.kind === 'smoke') {
      const s = smokes.find((q) => !q.active) ?? smokes[0];
      s.active = true; s.x = p.x; s.y = Math.max(p.y, 0) + 1.1; s.z = p.z; s.age = 0; s.life = def.life; s.radius = 0;
    } else if (p.kind === 'frag') {
      for (const a of state.actors) {
        if (!a.alive) continue;
        if (a.team === p.owner.team && a !== p.owner) continue;
        const d = Math.hypot(a.pos.x - p.x, a.pos.y + 1 - cy, a.pos.z - p.z);
        if (d > def.radius || !clearLine(p.x, cy, p.z, a.pos.x, a.pos.y + 1.1, a.pos.z)) continue;
        const amount = def.damage * Math.pow(1 - d / def.radius, 1.3) * (a === p.owner ? 0.5 : 1);
        const dealt = applyDamage(a, amount, 'body', 0.55, p.owner);
        a.hurtTime = state.time;
        events.emit('damage', { attacker: p.owner, target: a, zone: 'body', dealt });
        if (a.hp <= 0) state.kill(a, p.owner, def, false);
      }
    } else if (p.kind === 'flash') {
      for (const a of state.actors) {
        if (!a.alive) continue;
        const ey = a.pos.y + eyeHeight(a);
        const dx = p.x - a.pos.x, dy = cy - ey, dz = p.z - a.pos.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > def.radius || !clearLine(a.pos.x, ey, a.pos.z, p.x, cy, p.z) || smokeBlocks(a.pos.x, ey, a.pos.z, p.x, cy, p.z)) continue;
        const cp = Math.cos(a.pitch);
        const facing = (-Math.sin(a.yaw) * cp * dx + Math.sin(a.pitch) * dy + -Math.cos(a.yaw) * cp * dz) / d;
        const strength = (1 - d / def.radius) * (facing > 0.5 ? 1 : facing > 0 ? 0.55 : 0.2);
        a.flash = Math.max(a.flash, 0.4 + strength * 3.6);
      }
    }
    events.emit('detonate', { kind: p.kind, x: p.x, y: cy, z: p.z, owner: p.owner });
  }

  /** True when the segment a-b passes through any smoke cloud. */
  function smokeBlocks(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz;
    for (let i = 0; i < POOL; i++) {
      const s = smokes[i];
      if (!s.active || s.radius < 0.8) continue;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.y - ay) * dy + (s.z - az) * dz) / len2)) : 0;
      const px = ax + dx * t - s.x, py = ay + dy * t - s.y, pz = az + dz * t - s.z;
      const r = s.radius * 0.92;
      if (px * px + py * py * 0.6 + pz * pz < r * r) return true;
    }
    return false;
  }

  function clear() {
    for (const p of projectiles) p.active = false;
    for (const s of smokes) s.active = false;
  }

  return { spawn, update, smokeBlocks, clear };
}
