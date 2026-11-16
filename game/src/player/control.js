// Maps input onto the player's combatant through the same fields a bot's brain writes:
// yaw and pitch from the mouse (slower while scoped), a wished move direction from WASD rotated
import { SLOT } from '../data/weapons.js';
import { equip, cycleGrenade, activeWeapon } from '../sim/combatant.js';
import { startReload, toggleScope } from '../sim/arms.js';
import { maxSpeed } from '../sim/mover.js';

const PITCH_LIMIT = 1.5;

export function createControl(state, input, events) {
	const settings = { sensitivity: 1.2 };
	const wish = { x: 0, z: 0, speed: 0, jump: false };

	/** Mouse look, applied every rendered frame for the lowest latency. */
	function look(delta) {
		const p = state.player;
		if (!p.alive) return;
		const w = activeWeapon(p);
		const zoom = p.scope > 0 && w?.def.scope ? w.def.scope[p.scope - 1] / 74 : 1;
		const k = 0.0022 * settings.sensitivity * zoom;
		p.yaw -= delta.dx * k;
		p.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p.pitch - delta.dy * k));
	}

	/** One fixed step of intent: movement wish, stance, trigger, Use and edge-triggered keys. */
	function step(menuOpen) {
		const p = state.player;
		const keys = input.held;
		wish.x = 0; wish.z = 0; wish.jump = false; wish.speed = 0;
		p.triggerHeld = false;
		p.wantUse = false;
		if (!p.alive || !input.locked || menuOpen) return wish;
		const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
		const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
		const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
		wish.x = -sin * fwd + cos * strafe;
		wish.z = -cos * fwd - sin * strafe;
		p.walking = keys.has('ShiftLeft') || keys.has('ShiftRight');
		p.crouching = keys.has('ControlLeft') || keys.has('KeyC');
		wish.jump = input.pressed.has('Space');
		const w = activeWeapon(p);
		wish.speed = maxSpeed(p, w?.def.speed ?? 1);
		if (state.phase === 'freeze') { wish.x = wish.z = 0; wish.jump = false; }

		p.triggerHeld = input.mouse.left || input.mouse.leftPressed;
		p.wantUse = keys.has('KeyE');
		if (p.wantUse && p.hasCharge && p.active !== SLOT.CHARGE) equip(p, SLOT.CHARGE);
		if (input.mouse.rightPressed) toggleScope(p, events);
		const press = input.pressed;
		if (press.has('Digit1')) equip(p, SLOT.PRIMARY);
		if (press.has('Digit2')) equip(p, SLOT.SIDEARM);
		if (press.has('Digit3')) equip(p, SLOT.MELEE);
		if (press.has('Digit4')) { if (p.active === SLOT.GRENADE) cycleGrenade(p); else equip(p, SLOT.GRENADE); }
		if (press.has('Digit5')) equip(p, SLOT.CHARGE);
		if (press.has('KeyG')) { if (p.active !== SLOT.GRENADE) equip(p, SLOT.GRENADE); else cycleGrenade(p); }
		if (press.has('KeyQ')) equip(p, p.lastSlot);
		if (press.has('KeyR')) startReload(p, events);
		if (equipChanged(p)) events.emit('draw', p);
		return wish;
	}

	let lastActive = -1;
	function equipChanged(p) {
		const changed = p.active !== lastActive;
		lastActive = p.active;
		return changed;
	}

	return { settings, look, step };
}
