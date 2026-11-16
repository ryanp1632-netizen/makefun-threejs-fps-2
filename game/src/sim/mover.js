// Kinematic movement shared by the player and the bots: ground friction and acceleration toward a
// wished velocity, air control, gravity, jumping, crouching, and a circle-against-boxes collision
import { BODY, MOVE } from '../core/config.js';
import { CELL } from '../data/map.js';
import { heightAt, toCol, toRow, HALF_W, HALF_D } from '../world/grid.js';

/** Eye height of a body right now (crouch blends smoothly). */
export function eyeHeight(body) {
	return BODY.standEye + (BODY.crouchEye - BODY.standEye) * body.crouch;
}

/** The top speed the body may reach this step given its weapon, stance and any fresh hit. */
export function maxSpeed(body, weaponSpeed) {
	let speed = MOVE.runSpeed * weaponSpeed * (body.tagged > 0 ? MOVE.taggedScale : 1);
	if (body.crouch > 0.5) speed *= MOVE.crouchScale;
	else if (body.walking) speed *= MOVE.walkScale;
	return speed;
}

export function stepBody(body, wishX, wishZ, wishSpeed, jump, dt) {
	body.tagged = Math.max(0, body.tagged - dt);
	const crouchTarget = body.crouching ? 1 : 0;
	body.crouch += Math.sign(crouchTarget - body.crouch) * Math.min(Math.abs(crouchTarget - body.crouch), dt * 8);

	const vel = body.vel;
	if (body.onGround) {
		const speed = Math.hypot(vel.x, vel.z);
		if (speed > 0) {
			const control = Math.max(speed, MOVE.stopSpeed);
			const next = Math.max(0, speed - control * MOVE.friction * dt);
			vel.x *= next / speed;
			vel.z *= next / speed;
		}
		accelerate(vel, wishX, wishZ, wishSpeed, MOVE.groundAccel, dt);
		if (jump && body.crouch < 0.5) {
			vel.y = BODY.jumpSpeed;
			body.onGround = false;
			body.jumped = true;
		}
	} else {
		accelerate(vel, wishX, wishZ, Math.min(wishSpeed, 1.2), MOVE.airAccel * 6, dt);
		vel.y -= BODY.gravity * dt;
	}

	body.pos.x += vel.x * dt;
	body.pos.z += vel.z * dt;
	body.pos.y += vel.y * dt;
	collide(body);
}

function accelerate(vel, wishX, wishZ, wishSpeed, accel, dt) {
	const len = Math.hypot(wishX, wishZ);
	if (len < 1e-5 || wishSpeed <= 0) return;
	const dx = wishX / len, dz = wishZ / len;
	const target = wishSpeed * Math.min(1, len);
	const current = vel.x * dx + vel.z * dz;
	const add = target - current;
	if (add <= 0) return;
	const step = Math.min(accel * dt, add);
	vel.x += dx * step;
	vel.z += dz * step;
}

function collide(body) {
	const pos = body.pos;
	const radius = BODY.radius;
	const feet = pos.y;
	for (let pass = 0; pass < 2; pass++) {
		const c0 = toCol(pos.x - radius), c1 = toCol(pos.x + radius);
		const r0 = toRow(pos.z - radius), r1 = toRow(pos.z + radius);
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) {
				const h = heightAt(c, r);
				if (h <= feet + BODY.stepHeight) continue;
				const minX = c * CELL - HALF_W, minZ = r * CELL - HALF_D;
				const nearX = Math.max(minX, Math.min(pos.x, minX + CELL));
				const nearZ = Math.max(minZ, Math.min(pos.z, minZ + CELL));
				let dx = pos.x - nearX, dz = pos.z - nearZ;
				const d2 = dx * dx + dz * dz;
				if (d2 >= radius * radius) continue;
				if (d2 < 1e-8) { // centre inside the box: push out the nearest face
					const left = pos.x - minX, right = minX + CELL - pos.x, top = pos.z - minZ, bottom = minZ + CELL - pos.z;
					const m = Math.min(left, right, top, bottom);
					if (m === left) { dx = -1; dz = 0; } else if (m === right) { dx = 1; dz = 0; } else if (m === top) { dx = 0; dz = -1; } else { dx = 0; dz = 1; }
					pos.x = m === left ? minX - radius : m === right ? minX + CELL + radius : pos.x;
					pos.z = m === top ? minZ - radius : m === bottom ? minZ + CELL + radius : pos.z;
				} else {
					const d = Math.sqrt(d2);
					const push = radius - d;
					dx /= d; dz /= d;
					pos.x += dx * push;
					pos.z += dz * push;
				}
				const into = body.vel.x * dx + body.vel.z * dz;
				if (into < 0) { body.vel.x -= into * dx; body.vel.z -= into * dz; }
			}
		}
	}
	let ground = 0;
	const c0 = toCol(pos.x - radius * 0.7), c1 = toCol(pos.x + radius * 0.7);
	const r0 = toRow(pos.z - radius * 0.7), r1 = toRow(pos.z + radius * 0.7);
	for (let r = r0; r <= r1; r++) {
		for (let c = c0; c <= c1; c++) {
			const h = heightAt(c, r);
			if (h > ground && h <= feet + BODY.stepHeight) ground = h;
		}
	}
	if (pos.y <= ground + 1e-3 && body.vel.y <= 0) {
		if (!body.onGround && body.vel.y < -7) body.landed = -body.vel.y; // hard landing: footstep thud
		pos.y = ground;
		body.vel.y = 0;
		body.onGround = true;
	} else if (body.onGround && pos.y - ground > BODY.stepHeight) {
		body.onGround = false; // walked off a crate
	} else if (body.onGround) {
		pos.y = ground;
	}
}
