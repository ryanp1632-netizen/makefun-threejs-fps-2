// The one place match state lives. Every system reads and writes this record (actors, teams,
// the clock, the charge, grenades, the kill feed); views only read it. Nothing else holds game
import { createRng } from './rng.js';
import { TEAM_NAMES } from './config.js';
import { createCombatant } from '../sim/combatant.js';

const ROSTER = {
	cell: ['Wick', 'Sorrel', 'Tamsin', 'Brannock', 'Juno'],
	watch: ['Holloway', 'Pell', 'Marrow', 'Isolde', 'Craddock'],
};

export function createState(seed, playerName = 'You') {
	const state = {
		seed,
		rng: createRng(seed),
		time: 0,
		phase: 'menu',          // menu | freeze | live | over | halftime | end
		phaseTime: 0,           // seconds left in the current phase
		clock: 0,               // round clock (stops once the charge is planted)
		liveTime: 0,            // seconds since the round went live (the buy window)
		roundStartTime: 0,
		round: 0,
		teams: {
			cell: { id: 'cell', name: TEAM_NAMES.cell, side: 'atk', score: 0, lossStreak: 0 },
			watch: { id: 'watch', name: TEAM_NAMES.watch, side: 'def', score: 0, lossStreak: 0 },
		},
		actors: [],
		player: null,
		charge: null,           // set by sim/charge.js
		projectiles: null,      // set by sim/grenades.js
		smokes: null,
		killfeed: [],           // { time, killer, victim, weapon, headshot }
		result: null,           // { winner, reason } of the last round
		matchWinner: null,
		paused: false,
		sideOf: (actor) => state.teams[actor.team].side,
		teamOnSide: (side) => (state.teams.cell.side === side ? 'cell' : 'watch'),
		plan: { attack: null, executing: false, execAt: 0, rotated: false, lastPlan: '' }, // the attackers' call (ai/tactics.js)
		intel: {                // the last enemy each team saw: where, when, and which site it points to
			cell: { time: -99, x: 0, z: 0, site: null, spotted: 0 },
			watch: { time: -99, x: 0, z: 0, site: null, spotted: 0 },
		},
		kill: null,             // set by sim/round.js
	};
	let id = 0;
	state.player = createCombatant(id++, playerName, 'cell', true);
	state.actors.push(state.player);
	for (const name of ROSTER.cell.slice(0, 4)) state.actors.push(createCombatant(id++, name, 'cell', false));
	for (const name of ROSTER.watch) state.actors.push(createCombatant(id++, name, 'watch', false));
	return state;
}
