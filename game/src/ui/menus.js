// The two overlay menus: the buy menu (four columns, number keys pick a column then an item,
// prices greyed when you cannot afford them, owned items marked) and the Tab scoreboard (both
import { BUY_MENU, itemById, WEAPONS, GRENADES } from '../data/weapons.js';
import { ROUND } from '../core/config.js';

const $ = (id) => document.getElementById(id);

const BLURB = {
	pike: 'Heavy sidearm · 54 dmg · one-tap to the head',
	hornet: 'SMG · fast, forgiving on the move · $600 per kill',
	bracken: 'Pump shotgun · 8 pellets · close quarters',
	lancer: 'Attack rifle · 35 dmg · climbing spray, hits hard',
	halyard: 'Defence rifle · 32 dmg · 666 rpm · steadier spray',
	vigil: 'Marksman · 112 dmg · scope with right mouse',
	frag: 'High explosive · 98 dmg at the centre',
	smoke: 'Blocks sight for 17 s',
	flash: 'Blinds whoever looks at it',
	vest: 'Armour 100 · soaks body hits',
	helm: 'Armour 100 + helmet · saves you from one-taps',
	kit: 'Defuse in 3.6 s instead of 7 s',
};

function ownsItem(p, id) {
	if (WEAPONS[id]) return p.slots[WEAPONS[id].slot]?.def.id === id;
	if (GRENADES[id]) return p.grenades[id] >= GRENADES[id].max;
	if (id === 'vest') return p.armor >= 100;
	if (id === 'helm') return p.helmet && p.armor >= 100;
	return id === 'kit' && p.kit;
}

export function createBuyMenu(state, round, sound) {
	const root = $('buy'), grid = $('buy-grid'), money = $('buy-money'), timer = $('buy-time');
	let column = -1;
	grid.innerHTML = BUY_MENU.map((col, ci) => `<div><h3>${ci + 1} · ${col.title}</h3>${col.items.map((id, ii) => {
		const item = itemById(id);
		return `<button class="item" data-id="${id}"><b><span style="color:inherit"><kbd>${ii + 1}</kbd>${item.name}</span><span data-price>$${item.price}</span></b><small>${BLURB[id] ?? ''}</small></button>`;
	}).join('')}</div>`).join('');
	grid.addEventListener('click', (e) => {
		const button = e.target.closest('.item');
		if (button) purchase(button.dataset.id);
	});

	function purchase(id) {
		const ok = round.buy(state.player, id);
		sound.click(ok ? 'buy' : 'deny');
		refresh();
	}

	function refresh() {
		const p = state.player;
		money.textContent = `$${p.money}`;
		for (const button of grid.querySelectorAll('.item')) {
			const id = button.dataset.id;
			const price = round.quote(p, id);
			const owned = ownsItem(p, id);
			const side = itemById(id).side ?? (id === 'kit' ? 'def' : null);
			const wrongSide = side && side !== state.sideOf(p);
			button.classList.toggle('owned', owned);
			button.classList.toggle('poor', !owned && (price < 0 || price > p.money));
			button.querySelector('[data-price]').textContent = owned ? 'owned' : wrongSide ? (side === 'atk' ? 'attack only' : 'defence only') : price < 0 ? 'max' : price > p.money ? `$${price} · short` : `$${price}`;
		}
	}

	return {
		get open() { return !root.classList.contains('hidden'); },
		show() { column = -1; refresh(); root.classList.remove('hidden'); },
		/** The buy window's countdown, shown in the menu's header while it is open. */
		tick() {
			const left = state.phase === 'freeze' ? state.phaseTime + ROUND.buyWindow : ROUND.buyWindow - state.liveTime;
			const text = `${Math.max(0, Math.ceil(left))} s left`;
			if (timer.textContent !== text) timer.textContent = text;
		},
		hide() { root.classList.add('hidden'); },
		/** Number keys: the first picks a column, the second an item in it. */
		key(n) {
			if (column < 0) { if (n >= 1 && n <= BUY_MENU.length) column = n - 1; return; }
			const id = BUY_MENU[column].items[n - 1];
			column = -1;
			if (id) purchase(id);
		},
		refresh,
	};
}

export function createScoreboard(state) {
	const root = $('board'), body = $('board-body');
	function table(teamId) {
		const team = state.teams[teamId];
		const rows = state.actors.filter((a) => a.team === teamId)
			.sort((a, b) => b.stats.kills - a.stats.kills || b.stats.damage - a.stats.damage)
			.map((a) => {
				const funds = a.team === state.player.team ? `$${a.money}` : '';
				const hs = a.stats.kills ? `${Math.round((100 * a.stats.headshots) / a.stats.kills)}%` : '—';
				return `<tr class="${a.alive ? '' : 'dead'}${a.isPlayer ? ' me' : ''}"><td>${a.name}${a.hasCharge ? ' ◆' : ''}</td><td>${a.stats.kills}</td><td>${a.stats.assists}</td><td>${a.stats.deaths}</td><td>${hs}</td><td>${a.stats.damage}</td><td>${a.stats.mvps}</td><td>${funds}</td></tr>`;
			}).join('');
		const side = team.side === 'atk' ? 'attack' : 'defence';
		return `<table><caption class="${teamId}">${team.name} · ${team.score} · ${side}</caption><tr><th>Name</th><th>K</th><th>A</th><th>D</th><th>HS</th><th>DMG</th><th>MVP</th><th>Funds</th></tr>${rows}</table>`;
	}
	return {
		/** Tab during a match; at the end it carries the verdict over the final tables. */
		show() {
			const w = state.matchWinner;
			const verdict = state.phase !== 'end' ? '' : `<h2 class="verdict">${w === 'draw' ? 'Draw' : w === state.player.team ? 'Victory' : 'Defeat'}</h2><p class="lede">Saltglass Yard · ${state.teams.cell.score} : ${state.teams.watch.score}</p>`;
			body.innerHTML = verdict + table(state.player.team) + table(state.player.team === 'cell' ? 'watch' : 'cell');
			root.classList.remove('hidden');
		},
		hide() { root.classList.add('hidden'); },
	};
}
