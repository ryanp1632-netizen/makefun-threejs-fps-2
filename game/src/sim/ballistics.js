// Hitscan: a round travels until the map stops it (grid raycast) or it meets a body. Bodies are
// a head sphere over a chest, a stomach and legs, each a vertical cylinder; the zone decides the
import { raycast, rayHit } from '../world/grid.js';
import { hitZones } from './combatant.js';

export const shotHit = { dist: 0, target: null, zone: '', nx: 0, ny: 0, nz: 0, solid: false };
const zones = { headY: 0, headR: 0, chestTop: 0, stomachTop: 0, hip: 0, bodyR: 0, legR: 0 };

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
	const px = ox - cx, py = oy - cy, pz = oz - cz;
	const b = px * dx + py * dy + pz * dz;
	const c = px * px + py * py + pz * pz - r * r;
	const disc = b * b - c;
	if (disc < 0) return Infinity;
	const t = -b - Math.sqrt(disc);
	return t > 0 ? t : Infinity;
}

function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1) {
	const px = ox - cx, pz = oz - cz;
	const a = dx * dx + dz * dz;
	if (a < 1e-9) return Infinity;
	const b = px * dx + pz * dz;
	const c = px * px + pz * pz - r * r;
	const disc = b * b - a * c;
	if (disc < 0) return Infinity;
	const t = (-b - Math.sqrt(disc)) / a;
	if (t <= 0) return Infinity;
	const y = oy + dy * t;
	return y >= y0 && y <= y1 ? t : Infinity;
}

export function traceShot(actors, shooter, ox, oy, oz, dx, dy, dz, range) {
	const wall = raycast(ox, oy, oz, dx, dy, dz, range);
	shotHit.dist = wall; shotHit.target = null; shotHit.zone = '';
	shotHit.nx = rayHit.nx; shotHit.ny = rayHit.ny; shotHit.nz = rayHit.nz; shotHit.solid = rayHit.solid;
	for (let i = 0; i < actors.length; i++) {
		const a = actors[i];
		if (a === shooter || !a.alive) continue;
		const tx = a.pos.x - ox, tz = a.pos.z - oz;
		const along = tx * dx + tz * dz;
		if (along < 0 || along > shotHit.dist + 1) continue;
		const offX = tx - dx * along, offZ = tz - dz * along;
		if (offX * offX + offZ * offZ > 1.2) continue;
		hitZones(a, zones);
		const tHead = raySphere(ox, oy, oz, dx, dy, dz, a.pos.x, zones.headY, a.pos.z, zones.headR);
		if (tHead < shotHit.dist) { shotHit.dist = tHead; shotHit.target = a; shotHit.zone = 'head'; }
		const tChest = rayCylinder(ox, oy, oz, dx, dy, dz, a.pos.x, a.pos.z, zones.bodyR, zones.stomachTop, zones.chestTop);
		if (tChest < shotHit.dist) { shotHit.dist = tChest; shotHit.target = a; shotHit.zone = 'body'; }
		const tStomach = rayCylinder(ox, oy, oz, dx, dy, dz, a.pos.x, a.pos.z, zones.bodyR * 0.92, zones.hip, zones.stomachTop);
		if (tStomach < shotHit.dist) { shotHit.dist = tStomach; shotHit.target = a; shotHit.zone = 'stomach'; }
		const tLegs = rayCylinder(ox, oy, oz, dx, dy, dz, a.pos.x, a.pos.z, zones.legR, a.pos.y, zones.hip);
		if (tLegs < shotHit.dist) { shotHit.dist = tLegs; shotHit.target = a; shotHit.zone = 'legs'; }
	}
	if (shotHit.target) shotHit.solid = false;
	return shotHit;
}

/** Damage multiplier for a zone; the head multiplier comes from the weapon. */
export function zoneMultiplier(zone, headMult) {
	switch (zone) {
		case 'head': return headMult;
		case 'stomach': return 1.25;
		case 'legs': return 0.75;
		default: return 1;
	}
}
