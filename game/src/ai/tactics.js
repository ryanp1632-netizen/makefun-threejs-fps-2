// The team brains. Each round the attackers pick a plan from the playbook (a route, a stage
// point, a smoke and a flash, an entry), send one lurker down the other lane, gather, execute
// together and plant; after the plant they take post-plant angles on the charge. The defenders
// spread over both sites and Mid, hold their angles, rotate toward the site where enemies are
// called, and retake and defuse once the charge is down. Bots also shop here, by team economy.
import { ATTACK_PLANS, CALLOUTS, DEFENSE_POSTS, PLANT_SPOTS, POSTPLANT } from '../data/map.js';
import { cellX, cellZ } from '../world/grid.js';

/** A goal for a bot's order list. `wait` holds it until the team executes. */
function goal(cell, extra) {
  return { x: cellX(cell[0]), z: cellZ(cell[1]), lookX: NaN, lookZ: NaN, wait: false, act: 'move', ...extra };
}
const at = (key) => CALLOUTS[key].cell;

export function createTactics(state, events, round) {
  const plans = { attack: null, executing: false, execAt: 0, rotated: false, lastPlan: '' };

  const bots = (side) => state.actors.filter((a) => a.brain && a.alive && state.sideOf(a) === side);

  function order(bot, goals) {
    bot.brain.goals = goals;
    bot.brain.goalIndex = 0;
    bot.brain.repath = true;
  }

  // ---- Round start: shop, then hand out the plan -------------------------------------------
  events.on('roundStart', () => {
    for (const bot of state.actors) if (bot.brain) shop(bot);
    plans.executing = false;
    plans.rotated = false;
    let plan = state.rng.pick(ATTACK_PLANS);
    if (plan.id === plans.lastPlan) plan = state.rng.pick(ATTACK_PLANS);
    plans.attack = plan;
    plans.lastPlan = plan.id;
    plans.execAt = 34 + state.rng.range(-4, 6);

    const attackers = bots('atk');
    const lurker = attackers.length >= 3 ? attackers.find((b) => !b.hasCharge) : null;
    attackers.forEach((bot, i) => {
      if (bot === lurker) {
        order(bot, [...plan.alt.map((k) => goal(at(k), { quiet: true })), goal(at(plan.alt[plan.alt.length - 1]), { wait: true })]);
        bot.brain.role = 'lurk';
      } else {
        order(bot, attackGoals(plan, bot.hasCharge, i));
        bot.brain.role = bot.hasCharge ? 'carrier' : 'entry';
      }
    });
    const defenders = bots('def');
    const areas = ['A', 'B', 'mid', 'A', 'B'];
    const used = { A: 0, B: 0, mid: 0 };
    defenders.forEach((bot, i) => {
      const area = areas[i % areas.length];
      const posts = DEFENSE_POSTS[area];
      const post = posts[(used[area]++ + state.round) % posts.length];
      order(bot, [goal(post.at, { lookX: cellX(post.look[0]), lookZ: cellZ(post.look[1]), act: 'hold' })]);
      bot.brain.role = area;
    });
  });

  function attackGoals(plan, carrier, i) {
    const goals = plan.route.map((k) => goal(at(k)));
    goals.push(goal(plan.stage, { wait: true, smoke: i === 1, flash: i === 2 }));
    for (const k of plan.entry) goals.push(goal(at(k)));
    if (carrier) goals.push(goal(PLANT_SPOTS[plan.site], { act: 'plant' }));
    else {
      const spot = POSTPLANT[plan.site][i % POSTPLANT[plan.site].length];
      const gate = plan.site === 'A' ? at('aConnector') : at('bConnector');
      goals.push(goal(spot, { act: 'hold', lookX: cellX(gate[0]), lookZ: cellZ(gate[1]) }));
    }
    return goals;
  }

  // ---- Mid-round reactions -----------------------------------------------------------------
  events.on('planted', ({ charge }) => {
    for (const bot of bots('atk')) {
      const spots = POSTPLANT[charge.site];
      const spot = spots[bot.id % spots.length];
      order(bot, [goal(spot, { act: 'hold', lookX: charge.x, lookZ: charge.z })]);
    }
    for (const bot of bots('def')) {
      order(bot, [{ x: charge.x, z: charge.z, lookX: charge.x, lookZ: charge.z, wait: false, act: 'defuse' }]);
    }
  });

  events.on('chargeDropped', (charge) => {
    let nearest = null, best = Infinity;
    for (const bot of bots('atk')) {
      const d = Math.hypot(bot.pos.x - charge.x, bot.pos.z - charge.z);
      if (d < best) { best = d; nearest = bot; }
    }
    if (nearest) order(nearest, [{ x: charge.x, z: charge.z, lookX: NaN, lookZ: NaN, wait: false, act: 'pickup' }]);
  });

  events.on('chargePicked', (bot) => {
    if (!bot.brain || !plans.attack) return;
    const plan = plans.attack;
    order(bot, [...plan.entry.map((k) => goal(at(k))), goal(PLANT_SPOTS[plan.site], { act: 'plant' })]);
    bot.brain.role = 'carrier';
  });

  /** Called every step: the attackers' execute call and the defenders' rotations. */
  function update(intel) {
    if (state.phase !== 'live') return;
    if (!plans.executing && plans.attack) {
      // Execute once every living non-lurker is waiting at the stage point, or on the clock.
      let caller = null, gathered = true;
      for (const b of state.actors) {
        if (!b.brain || !b.alive || state.sideOf(b) !== 'atk' || b.brain.role === 'lurk') continue;
        caller ??= b;
        if (!b.brain.waiting) { gathered = false; break; }
      }
      if ((caller && gathered) || state.liveTime > plans.execAt) {
        plans.executing = true;
        events.emit('radio', { from: caller, text: `go go, executing ${plans.attack.site}` });
      }
    }
    // Defenders rotate once toward a site where the team has called two or more contacts.
    const defTeam = state.teamOnSide('def');
    const info = intel[defTeam];
    if (!plans.rotated && info.site && info.spotted >= 2 && state.time - info.time < 3 && state.charge.phase !== 'planted') {
      plans.rotated = true;
      const posts = DEFENSE_POSTS[info.site];
      let k = 0;
      for (const bot of bots('def')) {
        if (bot.brain.role === info.site) continue;
        if (bot.brain.role === 'mid' || k < 1) {
          const post = posts[k++ % posts.length];
          order(bot, [goal(post.at, { lookX: cellX(post.look[0]), lookZ: cellZ(post.look[1]), act: 'hold' })]);
          bot.brain.role = info.site;
        }
      }
      events.emit('radio', { from: bots('def')[0] ?? null, text: `rotating ${info.site}` });
    }
  }

  // ---- Shopping ----------------------------------------------------------------------------
  function shop(bot) {
    const def = state.sideOf(bot) === 'def';
    const has = !!bot.slots[1];
    const m = () => bot.money;
    if (!has) {
      if (m() >= 3900) {
        if (m() >= 6000 && state.rng.chance(0.18)) round.buy(bot, 'vigil'); else round.buy(bot, 'lancer');
      } else if (m() >= 2300) {
        round.buy(bot, state.rng.chance(0.55) ? 'hornet' : 'bracken');
      } else if (m() >= 1800 && state.round > 1) {
        round.buy(bot, 'pike');
      }
    }
    if (m() >= 1000) round.buy(bot, 'helm'); else if (m() >= 650 && state.round > 1) round.buy(bot, 'vest');
    if (def && m() >= 900) round.buy(bot, 'kit');
    if (m() >= 600) round.buy(bot, 'smoke');
    if (m() >= 500) round.buy(bot, 'flash');
    if (m() >= 900) round.buy(bot, 'frag');
  }

  return { plans, update };
}
