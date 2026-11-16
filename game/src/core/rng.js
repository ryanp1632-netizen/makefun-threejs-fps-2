// Seeded random numbers. The whole simulation draws from one stream so a seed replays a match
// exactly (the screenshot scenes in shots.js rely on it).

export function createRng(seed) {
	let a = seed >>> 0 || 1;
	function next() {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	return {
		next,
		range: (lo, hi) => lo + (hi - lo) * next(),
		int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
		pick: (list) => list[Math.floor(next() * list.length)],
		chance: (p) => next() < p,
		gauss() {
			const u = Math.max(1e-9, next());
			return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
		},
	};
}
