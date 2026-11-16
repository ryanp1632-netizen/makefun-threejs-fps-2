// Weapon handling for any combatant: trigger discipline (semi or automatic), cyclic rate, the
// magazine and reserve, reloads, draw time, scoping, the shot cone and the learnable recoil
import { MOVE } from '../core/config.js';
import { SLOT } from '../data/weapons.js';
import { activeWeapon, applyDamage, bestSlot, cycleGrenade, grenadeCount } from './combatant.js';
import { traceShot, zoneMultiplier } from './ballistics.js';
import { eyeHeight } from './mover.js';

const RECOIL_RECOVER = 9;    // how fast the view punch settles once the trigger is released
const SPRAY_RESET = 0.32;    // seconds without firing before the pattern starts over
const THROW_SPEED = 16;

/** Forward unit vector for yaw/pitch (three.js camera convention: yaw 0 looks toward -z). */
export function forward(yaw, pitch, out) {
	const cp = Math.cos(pitch);
	out.x = -Math.sin(yaw) * cp;
	out.y = Math.sin(pitch);
	out.z = -Math.cos(yaw) * cp;
	return out;
}

/** Current cone half-angle (radians) of the held gun: the number the crosshair draws. */
export function inaccuracy(actor) {
	const w = activeWeapon(actor);
	if (!w || w.def.melee || actor.active >= SLOT.GRENADE) return 0;
	const d = w.def;
	let cone = d.scope && actor.scope === 0 ? d.unscopedSpread : d.spread;
	const speed = Math.hypot(actor.vel.x, actor.vel.z);
	const ratio = Math.min(1, speed / (MOVE.runSpeed * d.speed));
	cone += Math.pow(ratio, 1.6) * d.moveSpread + actor.spray;
	if (!actor.onGround) cone += d.airSpread;
	else if (actor.crouch > 0.5) cone *= 0.72;
	return cone;
}

export function startReload(actor, events) {
	const w = activeWeapon(actor);
	if (!w || w.def.melee || actor.active >= SLOT.GRENADE) return false;
	if (actor.reloadTimer > 0 || w.mag >= w.def.mag || w.reserve <= 0) return false;
	actor.reloadTimer = w.def.reload;
	actor.scope = 0;
	events.emit('reload', actor);
	return true;
}

export function toggleScope(actor, events) {
	const w = activeWeapon(actor);
	if (!w || !w.def.scope || actor.reloadTimer > 0) return;
	actor.scope = (actor.scope + 1) % (w.def.scope.length + 1);
	events.emit('scope', actor);
}

export function updateArms(actor, dt, ctx) {
	const { state, events } = ctx;
	actor.fireCooldown = Math.max(0, actor.fireCooldown - dt);
	actor.drawTimer = Math.max(0, actor.drawTimer - dt);
	actor.throwCooldown = Math.max(0, actor.throwCooldown - dt);
	if (actor.reloadTimer > 0) {
		actor.reloadTimer -= dt;
		if (actor.reloadTimer <= 0) finishReload(actor, events);
	}
	if (state.time - actor.lastShotTime > SPRAY_RESET) actor.sprayCount = 0;
	if (!actor.triggerHeld || state.time - actor.lastShotTime > 0.12) {
		const w = activeWeapon(actor);
		const k = Math.exp(-dt * (w?.def.recover ?? 6));
		actor.spray *= k;
		const p = Math.exp(-dt * RECOIL_RECOVER);
		actor.punchPitch *= p;
		actor.punchYaw *= p;
	}
	const pressed = actor.triggerHeld && !actor.triggerWasHeld;
	if (actor.triggerHeld) pullTrigger(actor, pressed, ctx);
	actor.triggerWasHeld = actor.triggerHeld;
}

function finishReload(actor, events) {
	const w = activeWeapon(actor);
	actor.reloadTimer = 0;
	if (!w) return;
	const take = Math.min(w.def.mag - w.mag, w.reserve);
	w.mag += take;
	w.reserve -= take;
	events.emit('reloaded', actor);
}

function pullTrigger(actor, pressed, ctx) {
	if (ctx.state.phase === 'freeze') return; // weapons are safe while the teams buy
	if (actor.active === SLOT.CHARGE) return; // the charge is planted with Use, see charge.js
	if (actor.active === SLOT.GRENADE) {
		if (pressed && actor.throwCooldown <= 0 && actor.drawTimer <= 0) {
			throwGrenade(actor, actor.grenadeChoice, actor.yaw, actor.pitch, ctx);
		}
		return;
	}
	const w = activeWeapon(actor);
	if (!w || actor.fireCooldown > 0 || actor.drawTimer > 0) return;
	if (w.def.melee) { swing(actor, w.def, ctx); return; }
	if (actor.reloadTimer > 0) return;
	if (!w.def.auto && !pressed) return;
	if (w.mag <= 0) {
		if (pressed) ctx.events.emit('dry', actor);
		startReload(actor, ctx.events);
		return;
	}
	fire(actor, w, ctx);
}

const dir = { x: 0, y: 0, z: 0 };
const shotRecord = { shooter: null, def: null, ox: 0, oy: 0, oz: 0, ex: 0, ey: 0, ez: 0, target: null, zone: '', nx: 0, ny: 0, nz: 0, solid: false, pellet: 0 };

function fire(actor, w, ctx) {
	const { state, events } = ctx;
	const d = w.def;
	const cone = inaccuracy(actor);
	const ox = actor.pos.x, oy = actor.pos.y + eyeHeight(actor), oz = actor.pos.z;
	const aimYaw = actor.yaw + actor.punchYaw * 2;
	const aimPitch = actor.pitch + actor.punchPitch * 2;
	for (let p = 0; p < d.pellets; p++) {
		const spread = Math.min(cone * 1.6, Math.abs(state.rng.gauss()) * cone * 0.62);
		const angle = state.rng.next() * Math.PI * 2;
		forward(aimYaw + Math.cos(angle) * spread, aimPitch + Math.sin(angle) * spread, dir);
		const hit = traceShot(state.actors, actor, ox, oy, oz, dir.x, dir.y, dir.z, 160);
		shotRecord.shooter = actor; shotRecord.def = d; shotRecord.pellet = p;
		shotRecord.ox = ox; shotRecord.oy = oy; shotRecord.oz = oz;
		shotRecord.ex = ox + dir.x * hit.dist; shotRecord.ey = oy + dir.y * hit.dist; shotRecord.ez = oz + dir.z * hit.dist;
		shotRecord.target = hit.target; shotRecord.zone = hit.zone; shotRecord.solid = hit.solid;
		shotRecord.nx = hit.nx; shotRecord.ny = hit.ny; shotRecord.nz = hit.nz;
		events.emit('shot', shotRecord);
		if (hit.target) hitTarget(actor, hit.target, d, hit.zone, hit.dist, ctx);
	}
	w.mag--;
	actor.fireCooldown = 60 / d.rpm;
	actor.lastShotTime = state.time;
	const kick = d.pattern[Math.min(actor.sprayCount, d.pattern.length - 1)];
	actor.punchPitch += kick[0] * d.kick;
	actor.punchYaw += kick[1] * d.kick;
	actor.spray = Math.min(d.maxSpray, actor.spray + d.sprayGrow);
	actor.sprayCount++;
	if (d.scope && actor.scope > 0) actor.scope = 0; // the bolt cycles out of the scope
	events.emit('fired', actor);
	if (w.mag === 0 && w.reserve > 0 && !actor.isPlayer) startReload(actor, events);
}

function hitTarget(attacker, target, def, zone, dist, ctx) {
	if (target.team === attacker.team) return; // no team damage
	const falloff = Math.pow(def.rangeFalloff, dist / 10);
	const amount = def.damage * falloff * zoneMultiplier(zone, def.headMult);
	const dealt = applyDamage(target, amount, zone, def.armorPen, attacker);
	target.hurtTime = ctx.state.time;
	target.tagged = MOVE.taggedTime;
	ctx.events.emit('damage', { attacker, target, zone, dealt });
	if (target.hp <= 0) ctx.kill(target, attacker, def, zone === 'head');
}

function swing(actor, def, ctx) {
	actor.fireCooldown = 60 / def.rpm;
	actor.lastShotTime = ctx.state.time;
	forward(actor.yaw, actor.pitch, dir);
	const hit = traceShot(ctx.state.actors, actor, actor.pos.x, actor.pos.y + eyeHeight(actor), actor.pos.z, dir.x, dir.y, dir.z, def.reach);
	ctx.events.emit('swing', actor);
	if (!hit.target || hit.target.team === actor.team) return;
	const t = hit.target;
	const facing = -Math.sin(t.yaw) * dir.x + -Math.cos(t.yaw) * dir.z;
	const amount = facing > 0.5 ? def.backstab : def.damage;
	const dealt = applyDamage(t, amount, 'body', 0.85, actor);
	t.hurtTime = ctx.state.time;
	ctx.events.emit('damage', { attacker: actor, target: t, zone: 'body', dealt });
	if (t.hp <= 0) ctx.kill(t, actor, def, false);
}

/** Throws a grenade along yaw/pitch; returns false when the actor holds none of that kind. */
export function throwGrenade(actor, kind, yaw, pitch, ctx) {
	if (actor.grenades[kind] <= 0) return false;
	actor.grenades[kind]--;
	forward(yaw, pitch + 0.12, dir);
	const speed = actor.isPlayer ? THROW_SPEED : THROW_SPEED * 1.02;
	ctx.grenades.spawn(kind, actor,
		actor.pos.x + dir.x * 0.4, actor.pos.y + eyeHeight(actor) - 0.1, actor.pos.z + dir.z * 0.4,
		dir.x * speed + actor.vel.x * 0.5, dir.y * speed + actor.vel.y * 0.5, dir.z * speed + actor.vel.z * 0.5);
	actor.throwCooldown = 0.9;
	ctx.events.emit('throw', actor);
	if (actor.active === SLOT.GRENADE) {
		if (grenadeCount(actor) > 0) { if (actor.grenades[actor.grenadeChoice] <= 0) cycleGrenade(actor); actor.drawTimer = 0.5; }
		else { actor.active = bestSlot(actor); actor.drawTimer = 0.4; }
	}
	return true;
}
