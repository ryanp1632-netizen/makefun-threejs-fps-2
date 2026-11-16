// The first-person hands and weapons, drawn in their own scene after the world (depth cleared)
// so a barrel never clips into a wall. Every gun is modelled here from boxes and cylinders in
import * as THREE from 'three';
import { SLOT } from '../data/weapons.js';
import { activeWeapon } from '../sim/combatant.js';
import { PALETTE } from '../core/palette.js';

const M = {
	metal: new THREE.MeshStandardMaterial({ color: 0x474d55, roughness: 0.38, metalness: 0.7 }),
	polymer: new THREE.MeshStandardMaterial({ color: 0x5a5d52, roughness: 0.75 }),
	tan: new THREE.MeshStandardMaterial({ color: 0xa88f68, roughness: 0.8 }),
	glove: new THREE.MeshStandardMaterial({ color: 0x3d3731, roughness: 0.95 }),
	sleeve: new THREE.MeshStandardMaterial({ color: 0x6a6157, roughness: 0.95 }),
	blade: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.25, metalness: 0.9 }),
	lens: new THREE.MeshStandardMaterial({ color: 0x0d1a22, roughness: 0.1, metalness: 0.4, emissive: 0x0a2830 }),
	frag: new THREE.MeshStandardMaterial({ color: 0x4b5a3c, roughness: 0.7 }),
	smoke: new THREE.MeshStandardMaterial({ color: 0x8b9094, roughness: 0.7 }),
	flash: new THREE.MeshStandardMaterial({ color: 0x3f5d78, roughness: 0.6 }),
	charge: new THREE.MeshStandardMaterial({ color: 0x4a3f30, roughness: 0.7 }),
	red: new THREE.MeshBasicMaterial({ color: 0xff3b2f }),
};

function box(w, h, d, mat, x, y, z) {
	const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
	m.position.set(x, y, z);
	return m;
}
function tube(r, len, mat, x, y, z) {
	const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
	m.rotation.x = Math.PI / 2;
	m.position.set(x, y, z);
	return m;
}

const BUILD = {
	wren(accent) {
		const g = new THREE.Group();
		g.add(box(0.05, 0.06, 0.2, M.metal, 0, 0.03, -0.06));         // slide
		g.add(box(0.045, 0.1, 0.06, M.polymer, 0, -0.04, 0.0));       // grip
		g.add(box(0.012, 0.016, 0.012, M.metal, 0, 0.066, -0.15));    // front sight
		g.add(box(0.03, 0.016, 0.012, M.metal, 0, 0.066, 0.03));      // rear sight
		g.add(box(0.052, 0.008, 0.03, accent, 0, 0.03, -0.12));       // team band
		const mag = box(0.036, 0.07, 0.045, M.metal, 0, -0.1, 0.0); g.add(mag);
		return { group: g, muzzle: -0.17, mag };
	},
	pike(accent) {
		const g = new THREE.Group();
		g.add(box(0.06, 0.075, 0.26, M.metal, 0, 0.035, -0.08));
		g.add(box(0.055, 0.12, 0.07, M.tan, 0, -0.05, 0.0));
		g.add(box(0.062, 0.014, 0.2, accent, 0, 0.078, -0.08));
		g.add(tube(0.016, 0.06, M.metal, 0, 0.035, -0.24));
		const mag = box(0.04, 0.08, 0.05, M.metal, 0, -0.12, 0.0); g.add(mag);
		return { group: g, muzzle: -0.27, mag };
	},
	hornet(accent) {
		const g = new THREE.Group();
		g.add(box(0.06, 0.09, 0.36, M.polymer, 0, 0.0, -0.1));
		g.add(box(0.05, 0.03, 0.22, M.metal, 0, 0.06, -0.1));
		g.add(tube(0.017, 0.16, M.metal, 0, 0.01, -0.34));
		g.add(box(0.045, 0.1, 0.05, M.polymer, 0, -0.08, 0.02));
		g.add(box(0.03, 0.06, 0.16, M.polymer, 0, -0.01, 0.17));
		g.add(box(0.062, 0.02, 0.1, accent, 0, 0.0, -0.22));
		const mag = box(0.035, 0.17, 0.045, M.metal, 0, -0.12, -0.12); mag.rotation.x = 0.12; g.add(mag);
		return { group: g, muzzle: -0.42, mag };
	},
	bracken(accent) {
		const g = new THREE.Group();
		g.add(box(0.06, 0.08, 0.42, M.metal, 0, 0.02, -0.12));
		g.add(tube(0.022, 0.5, M.metal, 0, 0.04, -0.4));
		g.add(tube(0.02, 0.36, M.metal, 0, -0.01, -0.36));
		const pump = box(0.07, 0.06, 0.16, M.tan, 0, -0.01, -0.36); g.add(pump);
		g.add(box(0.05, 0.11, 0.2, M.tan, 0, -0.04, 0.16));
		g.add(box(0.064, 0.015, 0.12, accent, 0, 0.065, -0.05));
		return { group: g, muzzle: -0.66, mag: pump };
	},
	lancer(accent, furniture = M.polymer, magLength = 0.17) {
		const g = new THREE.Group();
		g.add(box(0.062, 0.1, 0.42, M.metal, 0, 0.0, -0.1));
		g.add(box(0.07, 0.085, 0.3, furniture, 0, 0.0, -0.42));       // handguard
		g.add(tube(0.016, 0.22, M.metal, 0, 0.012, -0.66));            // barrel
		g.add(box(0.03, 0.04, 0.05, M.metal, 0, 0.012, -0.79));        // flash hider
		g.add(box(0.05, 0.03, 0.16, M.metal, 0, 0.07, -0.12));         // rail
		g.add(box(0.044, 0.05, 0.07, M.polymer, 0, 0.11, -0.12));      // optic body
		g.add(box(0.03, 0.03, 0.01, M.lens, 0, 0.115, -0.158));
		g.add(box(0.045, 0.11, 0.05, M.polymer, 0, -0.09, 0.03));      // grip
		g.add(box(0.05, 0.08, 0.14, furniture, 0, -0.01, 0.2));        // stock
		g.add(box(0.012, 0.03, 0.012, M.metal, 0, 0.062, -0.74));      // front sight post
		g.add(box(0.03, 0.012, 0.05, M.metal, 0.034, 0.03, -0.04));    // charging handle
		g.add(box(0.074, 0.02, 0.18, accent, 0, 0.0, -0.44));
		const mag = box(0.04, magLength, 0.07, M.metal, 0, -0.05 - magLength / 2, -0.18); mag.rotation.x = 0.22; g.add(mag);
		return { group: g, muzzle: -0.82, mag };
	},
	halyard(accent) { return BUILD.lancer(accent, M.tan, 0.13); },
	vigil(accent) {
		const g = new THREE.Group();
		g.add(box(0.06, 0.09, 0.5, M.tan, 0, 0.0, -0.08));
		g.add(tube(0.017, 0.5, M.metal, 0, 0.02, -0.56));
		g.add(box(0.034, 0.034, 0.08, M.metal, 0, 0.02, -0.82));
		g.add(tube(0.034, 0.3, M.metal, 0, 0.1, -0.12));               // scope tube
		g.add(tube(0.042, 0.05, M.metal, 0, 0.1, -0.28));
		g.add(tube(0.04, 0.05, M.metal, 0, 0.1, 0.03));
		g.add(box(0.05, 0.12, 0.18, M.tan, 0, -0.04, 0.22));
		g.add(box(0.064, 0.02, 0.2, accent, 0, -0.02, -0.18));
		const mag = box(0.04, 0.08, 0.08, M.metal, 0, -0.09, -0.06); g.add(mag);
		return { group: g, muzzle: -0.87, mag };
	},
	shiv(accent) {
		const g = new THREE.Group();
		g.add(box(0.03, 0.035, 0.11, M.polymer, 0, 0, 0.02));
		g.add(box(0.034, 0.012, 0.04, accent, 0, 0, -0.045));
		const blade = box(0.008, 0.04, 0.2, M.blade, 0, 0.004, -0.16); g.add(blade);
		return { group: g, muzzle: -0.2, mag: blade };
	},
	grenade(_accent, kind) {
		const g = new THREE.Group();
		const body = new THREE.Mesh(kind === 'frag' ? new THREE.SphereGeometry(0.045, 12, 10) : new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12), M[kind]);
		g.add(body);
		g.add(box(0.02, 0.03, 0.02, M.metal, 0, 0.06, 0));
		g.add(box(0.012, 0.012, 0.05, M.metal, 0.015, 0.06, 0.025));
		return { group: g, muzzle: 0, mag: body };
	},
	charge() {
		const g = new THREE.Group();
		g.add(box(0.2, 0.12, 0.14, M.charge, 0, 0, 0));
		g.add(box(0.12, 0.01, 0.08, M.polymer, 0, 0.065, 0));
		const led = box(0.02, 0.012, 0.02, M.red, 0.07, 0.068, -0.04); g.add(led);
		return { group: g, muzzle: 0, mag: led };
	},
};

export function createViewmodel(width, height, tex) {
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(58, width / height, 0.01, 10);
	scene.add(new THREE.HemisphereLight(0xd6cfee, 0x5a4636, 2.1));
	const key = new THREE.DirectionalLight(0xffc89a, 3.2);
	key.position.set(-1, 1.5, 1);
	scene.add(key);
	const rim = new THREE.DirectionalLight(0x9fb8ff, 1.4);
	rim.position.set(1.5, 0.6, -1);
	scene.add(rim);
	const flashLight = new THREE.PointLight(0xffb060, 0, 3, 2);
	scene.add(flashLight);

	const accent = new THREE.MeshStandardMaterial({ color: PALETTE.cell, emissive: PALETTE.cell, emissiveIntensity: 0.2 });
	const rig = new THREE.Group();
	scene.add(rig);
	const handR = new THREE.Group();
	handR.add(box(0.07, 0.08, 0.1, M.glove, 0, 0, 0));
	handR.add(box(0.08, 0.08, 0.3, M.sleeve, 0.01, -0.02, 0.19));
	const handL = new THREE.Group();
	handL.add(box(0.07, 0.07, 0.1, M.glove, 0, 0, 0));
	handL.add(box(0.08, 0.08, 0.32, M.sleeve, -0.04, -0.03, 0.2));
	handL.rotation.y = 0.5;
	rig.add(handR, handL);

	const models = {};
	for (const id of ['wren', 'pike', 'hornet', 'bracken', 'lancer', 'halyard', 'vigil', 'shiv']) models[id] = BUILD[id](accent);
	for (const kind of ['frag', 'smoke', 'flash']) models[kind] = BUILD.grenade(accent, kind);
	models.charge = BUILD.charge();
	const SUPPORT = { wren: -0.02, pike: -0.02, hornet: -0.22, bracken: -0.36, lancer: -0.42, halyard: -0.42, vigil: -0.3, charge: 0.06 };
	for (const m of Object.values(models)) { m.group.visible = false; rig.add(m.group); }

	const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flare, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
	flash.visible = false;
	rig.add(flash);

	const anim = { bob: 0, swayX: 0, swayY: 0, kick: 0, flash: 0, swing: 0, current: '', throwT: 0 };

	function keyFor(actor) {
		if (actor.active === SLOT.GRENADE) return actor.grenadeChoice;
		if (actor.active === SLOT.CHARGE) return 'charge';
		return activeWeapon(actor)?.def.id ?? 'shiv';
	}

	function onFired(actor) {
		const w = activeWeapon(actor);
		anim.kick = Math.min(1.4, anim.kick + (w?.def.kick ?? 1) * 0.55);
		anim.flash = 0.05;
	}
	function onSwing() { anim.swing = 1; }
	function onThrow() { anim.throwT = 1; }

	/** Poses the rig for this frame. look = {dx, dy} mouse motion this frame for sway. */
	function update(actor, dt, look, time) {
		const k = keyFor(actor);
		if (k !== anim.current) {
			if (models[anim.current]) models[anim.current].group.visible = false;
			anim.current = k;
			models[k].group.visible = true;
		}
		const model = models[k];
		const w = activeWeapon(actor);
		const scoped = actor.scope > 0;
		rig.visible = actor.alive && !scoped;

		const speed = Math.hypot(actor.vel.x, actor.vel.z);
		if (actor.onGround) anim.bob += speed * dt * 1.9;
		const bobAmp = Math.min(1, speed / 5) * (actor.crouch > 0.5 ? 0.5 : 1);
		anim.swayX += (-look.dx * 0.0009 - anim.swayX) * Math.min(1, dt * 10);
		anim.swayY += (look.dy * 0.0009 - anim.swayY) * Math.min(1, dt * 10);
		anim.kick *= Math.exp(-dt * 14);
		anim.swing = Math.max(0, anim.swing - dt * 3.5);
		anim.throwT = Math.max(0, anim.throwT - dt * 2.4);

		let x = 0.17 + Math.cos(anim.bob) * 0.012 * bobAmp + anim.swayX;
		let y = -0.18 + Math.abs(Math.sin(anim.bob)) * -0.016 * bobAmp + anim.swayY - (actor.onGround ? 0 : 0.02);
		let z = -0.5 + anim.kick * 0.05;
		let rx = anim.kick * 0.09, ry = 0.05, rz = 0;
		if (actor.drawTimer > 0) { y -= actor.drawTimer * 0.5; rx -= actor.drawTimer * 0.9; }
		model.mag.position.y = model.mag.userData.baseY ?? (model.mag.userData.baseY = model.mag.position.y);
		if (actor.reloadTimer > 0 && w) {
			const p = 1 - actor.reloadTimer / w.def.reload;
			const dip = Math.sin(Math.PI * Math.min(1, p * 1.1));
			y -= dip * 0.06; rz += dip * 0.5; rx += dip * 0.15;
			const out = p < 0.2 ? p / 0.2 : p < 0.6 ? 1 : Math.max(0, 1 - (p - 0.6) / 0.25);
			model.mag.position.y = model.mag.userData.baseY - out * 0.22;
		}
		if (k === 'shiv') { rx += anim.swing * -0.9; ry += anim.swing * 0.9; z -= anim.swing * 0.15; x -= anim.swing * 0.08; }
		if (anim.throwT > 0) { y += Math.sin(anim.throwT * Math.PI) * 0.1; rx -= anim.throwT * 1.2; z -= anim.throwT * 0.1; }
		if (k === 'charge' && actor.wantUse) { y -= 0.05 + Math.abs(Math.sin(time * 18)) * 0.01; rx += 0.5; }

		rig.position.set(x, y, z);
		rig.rotation.set(rx, ry, rz);
		handR.position.set(0, -0.06, 0.02);
		const support = SUPPORT[k];
		handL.visible = support !== undefined;
		if (handL.visible) handL.position.set(-0.03, -0.05, support);
		anim.flash -= dt;
		const flashing = anim.flash > 0 && model.muzzle < 0;
		flash.visible = flashing;
		flashLight.intensity = flashing ? 6 : 0;
		if (flashing) {
			flash.position.set(0, 0.01, model.muzzle - 0.05);
			const s = 0.18 + Math.random() * 0.12;
			flash.scale.set(s, s, s);
			flash.material.rotation = Math.random() * Math.PI;
			flashLight.position.set(x, y + 0.05, z + model.muzzle);
		}
	}

	function resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }

	/** The accent stripe follows the team the viewed player is on. */
	function setTeam(team) {
		const color = team === 'cell' ? PALETTE.cell : PALETTE.watch;
		accent.color.set(color);
		accent.emissive.set(color);
	}

	return { scene, camera, update, onFired, onSwing, onThrow, resize, setTeam };
}
