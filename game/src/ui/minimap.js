// The radar: the layout painted once to an offscreen canvas (walls, cover, sites, spawns and
// callout names), then each frame the live layer on top: teammates, enemies your team can see
import { LAYOUT, CALLOUTS, PLANT_SPOTS, CELL } from '../data/map.js';
import { COLS, ROWS, HALF_W, HALF_D } from '../world/grid.js';
import { PALETTE } from '../core/palette.js';

const FILL = {
	'#': '#2b2a2f', P: '#6a7378', C: '#6d6a52', c: '#8b7550', w: '#7c7a74',
	'.': '#5b574f', A: '#62767a', B: '#7a5f4a', d: '#4f5c63', a: '#5e5249', r: '#46504f',
};

export function createMinimap(canvas, state) {
	const g = canvas.getContext('2d');
	const W = canvas.width, H = canvas.height;
	const sx = W / COLS, sz = H / ROWS;
	const base = document.createElement('canvas');
	base.width = W; base.height = H;
	const b = base.getContext('2d');
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			b.fillStyle = FILL[LAYOUT[r][c]] ?? '#000';
			b.fillRect(c * sx, r * sz, Math.ceil(sx), Math.ceil(sz));
		}
	}
	b.font = `bold ${Math.round(sz * 2.4)}px system-ui, sans-serif`;
	b.textAlign = 'center'; b.textBaseline = 'middle';
	for (const [site, [c, r]] of Object.entries(PLANT_SPOTS)) {
		b.fillStyle = site === 'A' ? PALETTE.watch : PALETTE.cell;
		b.globalAlpha = 0.85;
		b.fillText(site, (c + 0.5) * sx, (r + 0.5) * sz);
	}
	b.globalAlpha = 0.55;
	b.fillStyle = '#ece6da';
	b.font = `${Math.round(sz * 0.8)}px system-ui, sans-serif`;
	for (const key of ['catwalk', 'midHigh', 'midLow', 'pumpHall', 'aLongLow', 'culvertLow']) {
		const [c, r] = CALLOUTS[key].cell;
		b.fillText(CALLOUTS[key].name.toUpperCase(), (c + 0.5) * sx, (r + 1.3) * sz);
	}
	b.globalAlpha = 1;

	const toX = (x) => ((x + HALF_W) / CELL) * sx;
	const toY = (z) => ((z + HALF_D) / CELL) * sz;

	/** spotted(actor) tells whether the player's team can currently see an enemy. */
	function draw(spotted) {
		g.drawImage(base, 0, 0);
		const me = state.player;
		for (const s of state.smokes) {
			if (!s.active) continue;
			g.fillStyle = 'rgba(220,220,215,0.55)';
			g.beginPath(); g.arc(toX(s.x), toY(s.z), (s.radius / CELL) * sx, 0, Math.PI * 2); g.fill();
		}
		const c = state.charge;
		if (c.phase === 'dropped' || c.phase === 'planted') {
			const blink = c.phase === 'planted' && Math.floor(state.time * 4) % 2 === 0;
			g.fillStyle = blink ? '#ff5a4a' : PALETTE.hazard;
			g.fillRect(toX(c.x) - 5, toY(c.z) - 5, 10, 10);
		}
		for (const a of state.actors) {
			if (!a.alive) continue;
			const ally = a.team === me.team;
			if (!ally && !spotted(a)) continue;
			const color = a.team === 'cell' ? PALETTE.cell : PALETTE.watch;
			const x = toX(a.pos.x), y = toY(a.pos.z);
			if (a === me) {
				g.fillStyle = 'rgba(255,255,255,0.12)';
				g.beginPath(); g.moveTo(x, y);
				g.arc(x, y, 46, -Math.PI / 2 - a.yaw - 0.55, -Math.PI / 2 - a.yaw + 0.55); g.fill();
				g.save(); g.translate(x, y); g.rotate(-a.yaw);
				g.fillStyle = '#fff';
				g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill();
				g.restore();
				continue;
			}
			g.fillStyle = color;
			g.strokeStyle = ally ? 'rgba(0,0,0,0.6)' : '#fff';
			g.lineWidth = 2;
			g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.fill(); g.stroke();
			if (a.hasCharge) { g.fillStyle = PALETTE.hazard; g.fillRect(x - 3, y - 13, 6, 5); }
		}
	}
	return { draw };
}
