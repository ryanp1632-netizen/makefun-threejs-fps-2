// The staged scenes the screenshots in screenshots/ were rendered from. Each one sets a moment
// of a match up through the game's own systems (round state, buying, kills, grenades, the
// charge), then runs the real simulation for a few frames so shots, tracers and the bots' reactions
// are genuine. Open index.html?shot=<name>&seed=1 to render one: firefight, buy, retake, board.
import { cellX, cellZ } from './world/grid.js';
import { eyeHeight } from './sim/mover.js';
import { giveWeapon, equip } from './sim/combatant.js';
import { WEAPONS, SLOT } from './data/weapons.js';

function find(state, name) {
  return state.actors.find((a) => a.name === name);
}

/** Puts an actor at fractional cell coordinates, standing still. */
function put(a, col, row, yaw = 0) {
  a.alive = true;
  a.pos.x = cellX(col); a.pos.z = cellZ(row); a.pos.y = 0;
  a.vel.x = a.vel.y = a.vel.z = 0;
  a.yaw = yaw;
}

function aimAt(a, b, height = 1.3) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  a.yaw = Math.atan2(-dx, -dz);
  a.pitch = Math.atan2(b.pos.y + height - (a.pos.y + eyeHeight(a)), Math.hypot(dx, dz));
}

function arm(a, id, mag) {
  giveWeapon(a, id);
  equip(a, WEAPONS[id].slot);
  a.drawTimer = 0;
  if (mag !== undefined) a.slots[WEAPONS[id].slot].mag = mag;
}

/** A death that happened earlier in the round, through the round's own kill rule. */
function earlierKill(game, victim, killer, weapon, headshot, col, row) {
  put(victim, col, row);
  game.state.kill(victim, killer, WEAPONS[weapon], headshot);
}

function runUntilFired(game, shooter, maxSteps) {
  let fired = 0;
  game.events.on('fired', (a) => { if (a === shooter) fired++; });
  for (let i = 0; i < maxSteps; i++) {
    const before = fired;
    game.simulate(1 / 60, true);
    if (fired > before && i > maxSteps * 0.6) return;
  }
}

const SCENES = {
  // Cover: holding Mid with a rifle, a teammate on the barrier, two Watch players at the crates.
  firefight(game) {
    const { state } = game;
    const me = state.player;
    state.round = 5; state.teams.cell.score = 3; state.teams.watch.score = 1;
    state.phase = 'live'; state.liveTime = 41; state.clock = 63;
    const wick = find(state, 'Wick'), holloway = find(state, 'Holloway'), craddock = find(state, 'Craddock');
    earlierKill(game, find(state, 'Pell'), me, 'lancer', true, 20.6, 11.2);
    earlierKill(game, find(state, 'Sorrel'), craddock, 'lancer', false, 21.5, 17.4);
    earlierKill(game, find(state, 'Marrow'), wick, 'hornet', false, 18.2, 7.6);
    earlierKill(game, find(state, 'Tamsin'), holloway, 'lancer', true, 29.5, 13.2);
    // The fighters stand aside while the smoke blooms, so nothing fires before the moment.
    const cast = [me, wick, holloway, craddock];
    for (const a of cast) a.alive = false;
    game.grenades.spawn('smoke', craddock, cellX(19.6), 0.3, cellZ(5.4), 0, 0, 0);
    for (let i = 0; i < 200; i++) game.simulate(1 / 60, true);
    me.armor = 100; me.helmet = true; me.hp = 76; me.money = 2350;
    put(me, 20.9, 19.45); arm(me, 'lancer', 23);
    put(wick, 18.4, 16.2); wick.crouching = true; wick.crouch = 1; arm(wick, 'hornet');
    put(holloway, 20.6, 14.6, Math.PI); arm(holloway, 'lancer');
    put(craddock, 17.6, 12.4, Math.PI); arm(craddock, 'lancer');
    aimAt(me, holloway, 1.25);
    me.triggerHeld = true;
    me.walking = true;
    game.hud.radio(wick, 'two at the kiln crates, smoke on the gate');
    runUntilFired(game, me, 22);
  },

  // Freeze time with the buy menu open, the squad in the breakroom.
  buy(game) {
    const { state, round } = game;
    state.round = 3; state.teams.cell.score = 1; state.teams.watch.score = 1;
    state.phaseTime = 5.2;
    const me = state.player;
    me.money = 4150;
    round.buy(me, 'helm');
    round.buy(me, 'smoke');
    me.yaw = 0.35;
    for (const a of state.actors) if (a.brain && a.team === 'cell') a.yaw = 0.2;
    for (let i = 0; i < 20; i++) game.simulate(1 / 60, true);
    game.buyMenu.show();
  },

  // Second half: Lumen Cell now defends. The charge is down on B; a smoke covers the defuse.
  retake(game) {
    const { state, charge } = game;
    state.teams.cell.side = 'def'; state.teams.watch.side = 'atk';
    state.round = 9; state.teams.cell.score = 4; state.teams.watch.score = 4;
    state.phase = 'live'; state.liveTime = 70;
    const me = state.player, tamsin = find(state, 'Tamsin'), isolde = find(state, 'Isolde'), holloway = find(state, 'Holloway');
    for (const a of state.actors) a.hasCharge = false;
    put(isolde, 33.2, 5.2);
    charge.give(isolde);
    isolde.wantUse = true;
    for (let i = 0; i < 200 && state.charge.phase !== 'planted'; i++) { isolde.wantUse = true; charge.update(1 / 60); }
    earlierKill(game, isolde, tamsin, 'lancer', true, 34.6, 3.4);
    earlierKill(game, holloway, me, 'vigil', false, 30.4, 9.6);
    put(me, 32.8, 5.9);
    me.kit = true; me.armor = 64; me.helmet = true; me.hp = 58; me.money = 1100;
    arm(me, 'lancer', 11);
    put(tamsin, 30.8, 3.6, -0.9); arm(tamsin, 'lancer');
    game.grenades.spawn('smoke', tamsin, cellX(36.2), 0.3, cellZ(3.2), 0, 0, 0);
    me.crouching = true; me.crouch = 1;
    me.yaw = -0.62; me.pitch = -0.3;
    for (let i = 0; i < 170; i++) {
      me.wantUse = true; me.crouching = true;
      game.simulate(1 / 60, true);
    }
    me.wantUse = true;
  },

  // Round won: the scoreboard over the last seconds of round 8.
  board(game) {
    const { state } = game;
    state.round = 8; state.teams.cell.score = 4; state.teams.watch.score = 3;
    const me = state.player;
    const tally = [[me, 14, 3, 6, 1510, 3], [find(state, 'Wick'), 9, 4, 7, 1140, 2], [find(state, 'Brannock'), 8, 2, 6, 990, 1],
      [find(state, 'Sorrel'), 5, 6, 7, 760, 0], [find(state, 'Tamsin'), 4, 3, 8, 640, 0], [find(state, 'Craddock'), 12, 2, 7, 1360, 2],
      [find(state, 'Holloway'), 9, 3, 7, 1080, 1], [find(state, 'Pell'), 6, 4, 8, 820, 0], [find(state, 'Isolde'), 5, 2, 8, 700, 0], [find(state, 'Marrow'), 3, 4, 9, 520, 0]];
    for (const [a, k, as, d, dmg, mvp] of tally) Object.assign(a.stats, { kills: k, assists: as, deaths: d, damage: dmg, mvps: mvp });
    state.phase = 'live'; state.liveTime = 50; state.clock = 38;
    put(me, 6.2, 6.4, -2.3); arm(me, 'lancer', 17);
    for (const name of ['Pell', 'Isolde', 'Marrow']) earlierKill(game, find(state, name), me, 'lancer', name !== 'Marrow', 7 + name.length * 0.4, 8 - name.length * 0.3);
    earlierKill(game, find(state, 'Craddock'), find(state, 'Wick'), 'hornet', false, 9.5, 3.5);
    earlierKill(game, find(state, 'Holloway'), find(state, 'Brannock'), 'lancer', true, 3.2, 9.1);
    for (let i = 0; i < 60; i++) game.simulate(1 / 60, true);
    game.board.show();
  },
};

export function stageShot(name, game) {
  game.round.startMatch();
  document.body.classList.remove('menu');
  game.showScreen(null);
  (SCENES[name] ?? SCENES.firefight)(game);
}
