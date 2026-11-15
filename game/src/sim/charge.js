// The objective: the attackers' "lantern charge". One attacker carries it; it drops where its
// carrier dies and any attacker can pick it up. Holding Use on a site plants it (3.2 s, standing
// still); once armed it ticks for 38 s. A defender holding Use beside it defuses it (7 s, or
// 3.6 s with a kit), and moving or letting go starts the defuse over.
import { ROUND } from '../core/config.js';
import { siteAt } from '../world/grid.js';
import { SLOT } from '../data/weapons.js';
import { bestSlot } from './combatant.js';

export function createCharge(state, events) {
  const charge = {
    phase: 'carried', // carried | dropped | planted | defused | detonated
    carrier: null, x: 0, y: 0, z: 0, site: null,
    timer: 0, plantProgress: 0, planter: null, defuseProgress: 0, defuser: null, beepIn: 0,
  };
  state.charge = charge;

  function give(actor) {
    charge.phase = 'carried';
    charge.carrier = actor;
    charge.site = null;
    charge.plantProgress = 0; charge.planter = null;
    charge.defuseProgress = 0; charge.defuser = null;
    actor.hasCharge = true;
  }

  function drop(actor) {
    if (charge.carrier !== actor) return;
    actor.hasCharge = false;
    if (actor.active === SLOT.CHARGE) actor.active = bestSlot(actor);
    charge.carrier = null;
    charge.phase = 'dropped';
    charge.x = actor.pos.x; charge.y = actor.pos.y; charge.z = actor.pos.z;
    events.emit('chargeDropped', charge);
  }

  function update(dt) {
    if (charge.phase === 'dropped') {
      for (const a of state.actors) {
        if (!a.alive || state.sideOf(a) !== 'atk') continue;
        if (Math.hypot(a.pos.x - charge.x, a.pos.z - charge.z) < 1.1) { give(a); events.emit('chargePicked', a); break; }
      }
    } else if (charge.phase === 'carried') {
      updatePlanting(dt);
    } else if (charge.phase === 'planted') {
      charge.timer -= dt;
      charge.beepIn -= dt;
      if (charge.beepIn <= 0) {
        charge.beepIn = Math.max(0.12, Math.min(1, charge.timer / 12));
        events.emit('beep', charge);
      }
      updateDefusing(dt);
      if (charge.timer <= 0 && charge.phase === 'planted') {
        charge.phase = 'detonated';
        events.emit('detonated', charge);
      }
    }
  }

  function updatePlanting(dt) {
    const a = charge.carrier;
    if (!a || !a.alive) return;
    const site = siteAt(a.pos.x, a.pos.z);
    const steady = a.onGround && Math.hypot(a.vel.x, a.vel.z) < 0.6;
    if (a.wantUse && site && steady && state.phase === 'live') {
      if (charge.plantProgress === 0) events.emit('plantStart', a);
      charge.plantProgress += dt;
      charge.planter = a;
      if (charge.plantProgress >= ROUND.plantTime) {
        a.hasCharge = false;
        if (a.active === SLOT.CHARGE) a.active = bestSlot(a);
        charge.carrier = null;
        charge.phase = 'planted';
        charge.site = site;
        charge.x = a.pos.x; charge.y = a.pos.y; charge.z = a.pos.z;
        charge.timer = ROUND.bombTimer;
        charge.beepIn = 0;
        charge.plantProgress = 0;
        events.emit('planted', { charge, planter: a });
      }
    } else {
      charge.plantProgress = 0;
      charge.planter = null;
    }
  }

  function updateDefusing(dt) {
    let d = charge.defuser;
    if (d && (!d.alive || !d.wantUse || Math.hypot(d.vel.x, d.vel.z) > 0.6 || distTo(d) > 1.8)) {
      d = charge.defuser = null;
      charge.defuseProgress = 0;
      events.emit('defuseStop', charge);
    }
    if (!d) {
      for (const a of state.actors) {
        if (a.alive && a.wantUse && state.sideOf(a) === 'def' && distTo(a) <= 1.8 && a.onGround) {
          charge.defuser = d = a;
          charge.defuseProgress = 0;
          events.emit('defuseStart', a);
          break;
        }
      }
    }
    if (!d) return;
    charge.defuseProgress += dt;
    if (charge.defuseProgress >= (d.kit ? ROUND.defuseTimeKit : ROUND.defuseTime)) {
      charge.phase = 'defused';
      events.emit('defused', { charge, defuser: d });
    }
  }

  function distTo(a) {
    return Math.hypot(a.pos.x - charge.x, a.pos.z - charge.z);
  }

  /** Seconds the current defuse needs in all, for the progress bar. */
  function defuseNeeded() {
    return charge.defuser?.kit ? ROUND.defuseTimeKit : ROUND.defuseTime;
  }

  return { give, drop, update, defuseNeeded };
}
