// A combatant is the one record for anyone on the field, player or bot: body, health, armour,
// money, inventory and weapon-handling state. Damage, death and loadouts are applied here so the
// player and the bots obey exactly the same rules.
import { BODY } from '../core/config.js';
import { WEAPONS, SLOT } from '../data/weapons.js';

export function createCombatant(id, name, team, isPlayer) {
  return {
    id, name, team, isPlayer,
    alive: false,
    hp: 100, armor: 0, helmet: false, kit: false, money: 0,
    pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
    yaw: 0, pitch: 0,
    onGround: true, crouch: 0, crouching: false, walking: false, jumped: false, landed: 0,
    // inventory: one weapon per slot, each { def, mag, reserve }
    slots: { [SLOT.PRIMARY]: null, [SLOT.SIDEARM]: null, [SLOT.MELEE]: null },
    grenades: { frag: 0, smoke: 0, flash: 0 },
    grenadeChoice: 'frag',
    hasCharge: false,
    active: SLOT.SIDEARM, lastSlot: SLOT.MELEE,
    // handling
    fireCooldown: 0, reloadTimer: 0, drawTimer: 0, triggerHeld: false, triggerWasHeld: false,
    sprayCount: 0, spray: 0, punchPitch: 0, punchYaw: 0, scope: 0, throwCooldown: 0,
    // feedback
    flash: 0, hurtTime: -10, hurtYaw: 0, tagged: 0, stepDistance: 0, lastShotTime: -10,
    // stats for the scoreboard
    stats: { kills: 0, deaths: 0, assists: 0, damage: 0, roundKills: 0, mvps: 0 },
    damageBy: new Map(), // attacker id -> damage this life (assists)
    deathTime: 0, killerId: -1,
    brain: null,
  };
}

/** The held weapon record { def, mag, reserve }, or a grenade/charge stand-in. */
export function activeWeapon(actor) {
  return actor.slots[actor.active] ?? null;
}

export function giveWeapon(actor, id) {
  const def = WEAPONS[id];
  actor.slots[def.slot] = { def, mag: def.mag ?? 0, reserve: def.reserve ?? 0 };
}

export function equip(actor, slot) {
  if (slot === actor.active) return false;
  if (slot === SLOT.GRENADE) {
    if (!grenadeCount(actor)) return false;
  } else if (slot === SLOT.CHARGE) {
    if (!actor.hasCharge) return false;
  } else if (!actor.slots[slot]) return false;
  actor.lastSlot = actor.active;
  actor.active = slot;
  actor.reloadTimer = 0;
  actor.drawTimer = 0.45;
  actor.scope = 0;
  actor.sprayCount = 0;
  return true;
}

export function grenadeCount(actor) {
  return actor.grenades.frag + actor.grenades.smoke + actor.grenades.flash;
}

/** Picks the next grenade type the actor owns, cycling from its current choice. */
export function cycleGrenade(actor) {
  const order = ['frag', 'smoke', 'flash'];
  const start = order.indexOf(actor.grenadeChoice);
  for (let i = 1; i <= 3; i++) {
    const kind = order[(start + i) % 3];
    if (actor.grenades[kind] > 0) { actor.grenadeChoice = kind; return kind; }
  }
  return actor.grenadeChoice;
}

/** Best primary, else sidearm, else melee: what an actor draws at round start or after a throw. */
export function bestSlot(actor) {
  if (actor.slots[SLOT.PRIMARY]) return SLOT.PRIMARY;
  if (actor.slots[SLOT.SIDEARM]) return SLOT.SIDEARM;
  return SLOT.MELEE;
}

/** Puts a body at a spawn point, alive, keeping what it bought last round if it survived. */
export function spawnAt(actor, x, z, yaw, keepGear) {
  if (!keepGear) {
    actor.slots[SLOT.PRIMARY] = null;
    actor.slots[SLOT.SIDEARM] = null;
    actor.grenades.frag = actor.grenades.smoke = actor.grenades.flash = 0;
    actor.armor = 0; actor.helmet = false; actor.kit = false;
  }
  if (!actor.slots[SLOT.SIDEARM]) giveWeapon(actor, 'wren');
  giveWeapon(actor, 'shiv');
  for (const slot of [SLOT.PRIMARY, SLOT.SIDEARM]) { // a fresh round tops ammunition up
    const w = actor.slots[slot];
    if (w) { w.mag = w.def.mag; w.reserve = w.def.reserve; }
  }
  actor.alive = true;
  actor.hp = 100;
  actor.pos.x = x; actor.pos.y = 0; actor.pos.z = z;
  actor.vel.x = actor.vel.y = actor.vel.z = 0;
  actor.yaw = yaw; actor.pitch = 0;
  actor.crouch = 0; actor.crouching = false; actor.walking = false; actor.onGround = true;
  actor.hasCharge = false;
  actor.active = bestSlot(actor); actor.lastSlot = SLOT.MELEE;
  actor.fireCooldown = 0; actor.reloadTimer = 0; actor.drawTimer = 0; actor.sprayCount = 0; actor.spray = 0;
  actor.punchPitch = 0; actor.punchYaw = 0; actor.scope = 0; actor.flash = 0; actor.throwCooldown = 0;
  actor.damageBy.clear();
  actor.stats.roundKills = 0;
  actor.killerId = -1;
}

/**
 * Applies a hit. Armour soaks part of body and (with a helmet) head damage, and is worn down by
 * what it soaks; legs are never armoured. Returns the health actually removed.
 */
export function applyDamage(target, amount, zone, armorPen, attacker) {
  if (!target.alive) return 0;
  let dealt = amount;
  const armoured = target.armor > 0 && (zone === 'body' || zone === 'stomach' || (zone === 'head' && target.helmet));
  if (armoured) {
    dealt = amount * armorPen;
    target.armor = Math.max(0, target.armor - (amount - dealt) * 0.5);
  }
  dealt = Math.min(target.hp, Math.round(dealt));
  target.hp -= dealt;
  if (attacker) {
    target.damageBy.set(attacker.id, (target.damageBy.get(attacker.id) ?? 0) + dealt);
    if (attacker.team !== target.team) attacker.stats.damage += dealt;
    target.hurtYaw = Math.atan2(attacker.pos.x - target.pos.x, attacker.pos.z - target.pos.z);
  }
  return dealt;
}

/** Heights of the hit zones for the body's current crouch, used by ballistics and the views. */
export function hitZones(actor, out) {
  const s = 1 - actor.crouch * (1 - BODY.crouchHeight / BODY.standHeight);
  out.headY = actor.pos.y + 1.66 * s;
  out.headR = 0.16;
  out.chestTop = actor.pos.y + 1.5 * s;
  out.stomachTop = actor.pos.y + 1.15 * s;
  out.hip = actor.pos.y + 0.92 * s;
  out.bodyR = 0.27;
  out.legR = 0.2;
  return out;
}
