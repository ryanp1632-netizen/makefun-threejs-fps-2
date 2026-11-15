// The match rules: a buy-freeze, a 1:45 round won by wiping the other side, by the charge
// detonating or being defused, or by the clock running out on the attackers; money for kills,
// wins and losses (with a growing loss bonus); first to 7 of 12, sides swap at the half.
import { ROUND, ECONOMY } from '../core/config.js';
import { WEAPONS, GRENADES, GEAR } from '../data/weapons.js';
import { cellX, cellZ, inSpawn } from '../world/grid.js';
import { spawnAt, giveWeapon } from './combatant.js';

const SPAWNS = {
  atk: [[19, 28], [16, 27], [22, 27], [14, 29], [25, 29]],
  def: [[19, 2], [17, 3], [21, 3], [16, 1], [24, 2]],
};

export function createRound(state, events, charge, grenades) {
  state.kill = kill;

  function startMatch() {
    for (const t of Object.values(state.teams)) { t.score = 0; t.lossStreak = 0; }
    state.teams.cell.side = 'atk';
    state.teams.watch.side = 'def';
    state.round = 0;
    state.matchWinner = null;
    state.killfeed.length = 0;
    for (const a of state.actors) {
      a.money = ECONOMY.start;
      a.alive = false;
      a.stats.kills = a.stats.deaths = a.stats.assists = a.stats.damage = a.stats.mvps = 0;
    }
    startRound(true);
  }

  function startRound(fresh) {
    state.round++;
    state.phase = 'freeze';
    state.phaseTime = ROUND.freezeTime;
    state.clock = ROUND.roundTime;
    state.liveTime = 0;
    state.roundStartTime = state.time;
    state.result = null;
    grenades.clear();
    const used = { atk: 0, def: 0 };
    for (const a of state.actors) {
      const side = state.sideOf(a);
      const cell = SPAWNS[side][used[side]++ % SPAWNS[side].length]; // the player is actors[0]: first pick
      const survivor = !fresh && a.alive;
      spawnAt(a, cellX(cell[0]), cellZ(cell[1]), side === 'atk' ? 0 : Math.PI, survivor);
      a.wantUse = false; a.triggerHeld = false;
    }
    // The player carries the charge on attack; otherwise a random attacker bot does.
    const attackers = state.actors.filter((a) => state.sideOf(a) === 'atk');
    const carrier = attackers.find((a) => a.isPlayer) ?? state.rng.pick(attackers);
    charge.give(carrier);
    events.emit('roundStart', state);
  }

  function update(dt) {
    if (state.phase === 'menu' || state.phase === 'end') return;
    state.phaseTime -= dt;
    if (state.phase === 'freeze') {
      if (state.phaseTime <= 0) { state.phase = 'live'; events.emit('live', state); }
      return;
    }
    if (state.phase === 'live') {
      state.liveTime += dt;
      if (state.charge.phase !== 'planted') state.clock = Math.max(0, state.clock - dt);
      charge.update(dt);
      checkOutcome();
      return;
    }
    if (state.phase === 'over' && state.phaseTime <= 0) {
      if (state.matchWinner) { state.phase = 'end'; events.emit('matchEnd', state); return; }
      if (state.round === ROUND.halftimeAfter) { halftime(); return; }
      startRound(false);
    } else if (state.phase === 'halftime' && state.phaseTime <= 0) {
      startRound(true);
    }
  }

  function aliveOn(side) {
    let n = 0;
    for (const a of state.actors) if (a.alive && state.sideOf(a) === side) n++;
    return n;
  }

  function checkOutcome() {
    const atk = state.teamOnSide('atk'), def = state.teamOnSide('def');
    const c = state.charge;
    if (c.phase === 'detonated') return endRound(atk, 'The charge went off', 'objective');
    if (c.phase === 'defused') return endRound(def, 'Charge defused', 'objective');
    if (aliveOn('def') === 0) return endRound(atk, 'Defenders eliminated', 'elimination');
    if (aliveOn('atk') === 0 && c.phase !== 'planted') return endRound(def, 'Attackers eliminated', 'elimination');
    if (state.clock <= 0 && c.phase !== 'planted') return endRound(def, 'Time ran out', 'time');
  }

  function endRound(winner, reason, kind) {
    const loser = winner === 'cell' ? 'watch' : 'cell';
    state.phase = 'over';
    state.phaseTime = ROUND.endDelay;
    state.teams[winner].score++;
    state.teams[winner].lossStreak = 0;
    const streak = state.teams[loser].lossStreak;
    state.teams[loser].lossStreak = Math.min(streak + 1, 4);
    const winPay = kind === 'objective' ? ECONOMY.winObjective : ECONOMY.winElimination;
    const lossPay = Math.min(ECONOMY.lossMax, ECONOMY.lossBase + ECONOMY.lossStep * streak);
    const plantedLoss = state.charge.phase === 'defused' || (state.charge.phase === 'planted' && state.teams[loser].side === 'atk');
    for (const a of state.actors) {
      const pay = a.team === winner ? winPay : lossPay + (plantedLoss && a.team === loser ? ECONOMY.plantedLossBonus : 0);
      earn(a, pay);
    }
    // Round MVP: the winner's top fragger (ties to whoever did the most damage).
    let mvp = null;
    for (const a of state.actors) {
      if (a.team !== winner) continue;
      if (!mvp || a.stats.roundKills > mvp.stats.roundKills) mvp = a;
    }
    if (mvp) mvp.stats.mvps++;
    state.result = { winner, reason, mvp };
    const t = state.teams;
    if (t.cell.score >= ROUND.winsNeeded || t.watch.score >= ROUND.winsNeeded || state.round >= ROUND.maxRounds) {
      state.matchWinner = t.cell.score === t.watch.score ? 'draw' : t.cell.score > t.watch.score ? 'cell' : 'watch';
    }
    events.emit('roundEnd', state.result);
  }

  function halftime() {
    state.phase = 'halftime';
    state.phaseTime = 5;
    for (const t of Object.values(state.teams)) { t.side = t.side === 'atk' ? 'def' : 'atk'; t.lossStreak = 0; }
    for (const a of state.actors) { a.money = ECONOMY.start; a.alive = false; }
    events.emit('halftime', state);
  }

  function earn(actor, amount) {
    actor.money = Math.max(0, Math.min(ECONOMY.max, actor.money + amount));
  }

  function kill(victim, killer, def, headshot) {
    if (!victim.alive) return;
    victim.alive = false;
    victim.hp = 0;
    victim.deathTime = state.time;
    victim.killerId = killer ? killer.id : -1;
    victim.stats.deaths++;
    victim.triggerHeld = false;
    victim.wantUse = false;
    if (victim.hasCharge) charge.drop(victim);
    if (killer && killer.team !== victim.team) {
      killer.stats.kills++;
      killer.stats.roundKills++;
      earn(killer, def.killReward ?? 300);
    }
    for (const [id, dealt] of victim.damageBy) {
      const helper = state.actors[id];
      if (helper !== killer && dealt >= 40 && helper.team !== victim.team) helper.stats.assists++;
    }
    const entry = { time: state.time, killer, victim, weapon: def.name, headshot };
    state.killfeed.push(entry);
    if (state.killfeed.length > 6) state.killfeed.shift();
    events.emit('kill', entry);
  }

  // ---- Buying -------------------------------------------------------------------------------
  function canBuy(actor) {
    if (!actor.alive) return false;
    if (state.phase === 'freeze') return true;
    return state.phase === 'live' && state.liveTime < ROUND.buyWindow && inSpawn(actor.pos.x, actor.pos.z, state.sideOf(actor));
  }

  /** Price the actor would pay for an item now, or -1 when it cannot be bought. */
  function quote(actor, id) {
    const side = state.sideOf(actor);
    if (WEAPONS[id]) {
      const def = WEAPONS[id];
      const held = actor.slots[def.slot];
      return held && held.def.id === id ? -1 : def.price;
    }
    if (GRENADES[id]) {
      const g = GRENADES[id];
      const total = actor.grenades.frag + actor.grenades.smoke + actor.grenades.flash;
      return actor.grenades[id] >= g.max || total >= 3 ? -1 : g.price;
    }
    if (id === 'vest') return actor.armor >= 100 ? -1 : GEAR.vest.price;
    if (id === 'helm') return actor.helmet && actor.armor >= 100 ? -1 : actor.armor >= 100 ? 350 : GEAR.helm.price;
    if (id === 'kit') return side !== 'def' || actor.kit ? -1 : GEAR.kit.price;
    return -1;
  }

  function buy(actor, id) {
    if (!canBuy(actor)) return false;
    const price = quote(actor, id);
    if (price < 0 || price > actor.money) return false;
    actor.money -= price;
    if (WEAPONS[id]) {
      giveWeapon(actor, id);
      actor.active = WEAPONS[id].slot;
      actor.drawTimer = 0.5;
      actor.reloadTimer = 0;
    } else if (GRENADES[id]) {
      actor.grenades[id]++;
      if (actor.grenades[actor.grenadeChoice] === 0) actor.grenadeChoice = id;
    } else if (id === 'vest') {
      actor.armor = 100;
    } else if (id === 'helm') {
      actor.armor = 100; actor.helmet = true;
    } else if (id === 'kit') {
      actor.kit = true;
    }
    events.emit('buy', { actor, id });
    return true;
  }

  return { startMatch, update, buy, quote, canBuy };
}
