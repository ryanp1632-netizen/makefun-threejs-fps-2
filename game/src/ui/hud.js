// The heads-up display: score bar with alive pips and the round clock, health, armour and
// funds, the weapon and ammunition, slot strip, a crosshair that opens with the real shot cone,
// hit markers, damage direction, kill feed, radio, prompts, plant/defuse progress and round
// banners. It only reads the state; each write is skipped when the text has not changed.
import { ROUND } from '../core/config.js';
import { SLOT } from '../data/weapons.js';
import { activeWeapon } from '../sim/combatant.js';
import { inaccuracy } from '../sim/arms.js';
import { placeName, siteAt } from '../world/grid.js';

const $ = (id) => document.getElementById(id);

export function createHud(state, round) {
  const el = {
    scoreCell: $('score-cell'), scoreWatch: $('score-watch'), pipsCell: $('pips-cell'), pipsWatch: $('pips-watch'),
    roundLabel: $('roundlabel'), clock: $('clock'), side: $('sidebadge'), chargeFlag: $('chargeflag'),
    place: $('place-name'), radio: $('radio'), feed: $('killfeed'),
    hp: $('hp'), hpBar: $('hp-bar'), ar: $('ar'), arBar: $('ar-bar'), arLabel: $('ar-label'), money: $('money'),
    wname: $('wname'), ammo: $('ammo'), mag: $('mag'), reserve: $('reserve'), slots: [...document.querySelectorAll('#slots span')],
    cross: [...document.querySelectorAll('#crosshair i')], crosshair: $('crosshair'), hit: $('hitmarker'), hurt: $('hurt').firstElementChild,
    vignette: $('vignette'), flash: $('flash'), scope: $('scope'), prompt: $('prompt'), progress: $('progress'),
    progressLabel: $('progress-label'), progressFill: $('progress').querySelector('i'),
    banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
  };
  const last = new Map();
  const set = (node, key, value, prop = 'textContent') => {
    if (last.get(key) === value) return;
    last.set(key, value);
    node[prop] = value;
  };
  for (const pips of [el.pipsCell, el.pipsWatch]) for (let i = 0; i < ROUND.teamSize; i++) pips.appendChild(document.createElement('i'));

  let hitTime = -9, hitClass = '';
  let bannerUntil = 0;
  const radioLines = [];

  function hitMarker(kind) { hitTime = state.time; hitClass = kind; }

  function banner(title, sub, seconds, color) {
    el.bannerTitle.textContent = title;
    el.bannerTitle.style.color = color ?? '';
    el.bannerSub.textContent = sub;
    el.banner.classList.remove('hidden');
    bannerUntil = state.time + seconds;
  }

  function radio(from, text) {
    radioLines.push({ time: state.time, html: `<b class="${from?.team ?? ''}">${from?.name ?? 'Radio'}:</b> ${text}` });
    if (radioLines.length > 5) radioLines.shift();
    el.radio.innerHTML = radioLines.map((l) => `<div>${l.html}</div>`).join('');
  }

  function renderFeed() {
    el.feed.innerHTML = state.killfeed.map((k) => {
      const mine = k.killer === state.player || k.victim === state.player;
      const killer = k.killer ? `<span class="${k.killer.team}">${k.killer.name}</span>` : '';
      return `<div class="panel${mine ? ' mine' : ''}">${killer}<em>${k.weapon}</em>${k.headshot ? '<span class="hs">HS</span>' : ''}<span class="${k.victim.team}">${k.victim.name}</span></div>`;
    }).join('');
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /** Called once per rendered frame. fovY is the camera's vertical field of view in degrees. */
  function update(fovY) {
    const p = state.player;
    const t = state.teams;
    set(el.scoreCell, 'sc', String(t.cell.score));
    set(el.scoreWatch, 'sw', String(t.watch.score));
    let aliveCell = 0, aliveWatch = 0;
    for (const a of state.actors) if (a.alive) { if (a.team === 'cell') aliveCell++; else aliveWatch++; }
    pips(el.pipsCell, aliveCell, 'pc');
    pips(el.pipsWatch, aliveWatch, 'pw');
    set(el.roundLabel, 'rl', state.phase === 'halftime' ? 'Halftime' : `Round ${state.round} / ${ROUND.maxRounds}`);
    const planted = state.charge?.phase === 'planted';
    const clock = state.phase === 'freeze' ? Math.ceil(state.phaseTime) : state.clock;
    set(el.clock, 'ck', state.phase === 'freeze' ? `0:${String(clock).padStart(2, '0')}` : planted ? '— —' : fmt(Math.ceil(clock)));
    set(el.clock, 'ckc', planted ? 'planted' : '', 'className');
    const side = state.sideOf(p);
    set(el.side, 'sd', side === 'atk' ? 'Attack' : 'Defend');
    set(el.side, 'sdc', p.team, 'className');
    el.chargeFlag.classList.toggle('hidden', !planted);
    if (planted) set(el.chargeFlag, 'cf', `Charge armed · Site ${state.charge.site}`);
    set(el.place, 'pl', placeName(p.pos.x, p.pos.z));

    set(el.hp, 'hp', String(Math.max(0, p.hp)));
    el.hpBar.firstElementChild.style.width = `${Math.max(0, p.hp)}%`;
    el.hpBar.classList.toggle('low', p.hp <= 30);
    set(el.ar, 'ar', String(Math.round(p.armor)));
    set(el.arLabel, 'arl', p.helmet ? 'Armour + Helm' : 'Armour');
    el.arBar.firstElementChild.style.width = `${p.armor}%`;
    set(el.money, 'mo', `$${p.money}`);

    const w = activeWeapon(p);
    let name = w?.def.name ?? '';
    let mag = '', reserve = '';
    if (p.active === SLOT.GRENADE) { name = `${p.grenadeChoice} grenade · G to cycle`; mag = String(p.grenades[p.grenadeChoice]); }
    else if (p.active === SLOT.CHARGE) { name = 'Lantern charge · hold E on a site'; mag = '1'; }
    else if (w && !w.def.melee) { mag = String(w.mag); reserve = String(w.reserve); }
    set(el.wname, 'wn', p.reloadTimer > 0 ? `${name} · reloading` : name);
    set(el.mag, 'mg', mag);
    set(el.reserve, 'rs', reserve);
    el.ammo.classList.toggle('low', !!w && !w.def.melee && w.mag <= Math.ceil((w.def.mag ?? 0) * 0.25) && p.active < SLOT.GRENADE);
    const nades = p.grenades.frag + p.grenades.smoke + p.grenades.flash;
    slot(0, p.slots[SLOT.PRIMARY] ? `1 ${p.slots[SLOT.PRIMARY].def.name.split(' ')[0]}` : '1 —', !!p.slots[SLOT.PRIMARY]);
    slot(1, p.slots[SLOT.SIDEARM] ? `2 ${p.slots[SLOT.SIDEARM].def.name.split(' ')[0]}` : '2 —', !!p.slots[SLOT.SIDEARM]);
    slot(2, '3 Shiv', true);
    slot(3, `4 Nades ${nades}`, nades > 0);
    slot(4, p.hasCharge ? '5 Charge' : '5 —', p.hasCharge);

    // Crosshair gap: the real cone projected to pixels, plus a floor so it never closes.
    const cone = inaccuracy(p);
    const pxPerRad = window.innerHeight / 2 / Math.tan((fovY * Math.PI) / 360);
    const gap = Math.round(4 + Math.min(80, cone * pxPerRad));
    el.cross[0].style.top = `${-gap - 8}px`; el.cross[1].style.top = `${gap}px`;
    el.cross[2].style.left = `${-gap - 8}px`; el.cross[3].style.left = `${gap}px`;
    el.crosshair.style.display = p.alive && p.scope === 0 && p.active !== SLOT.CHARGE ? '' : 'none';
    el.scope.classList.toggle('hidden', !(p.alive && p.scope > 0));

    const sinceHit = state.time - hitTime;
    el.hit.style.opacity = sinceHit < 0.22 ? String(1 - sinceHit / 0.22) : '0';
    set(el.hit, 'hc', hitClass, 'className');
    const sinceHurt = state.time - p.hurtTime;
    el.vignette.style.opacity = p.alive ? String(Math.max(sinceHurt < 0.5 ? 0.9 * (1 - sinceHurt / 0.5) : 0, p.hp < 30 ? 0.35 : 0)) : '0.6';
    el.hurt.style.opacity = sinceHurt < 0.9 ? String(1 - sinceHurt / 0.9) : '0';
    el.hurt.style.transform = `rotate(${(-(p.hurtYaw - p.yaw) * 180) / Math.PI + 180}deg)`;
    el.flash.style.opacity = String(Math.min(1, p.flash * 0.9));

    updatePrompt(p);
    if (bannerUntil && state.time > bannerUntil) { el.banner.classList.add('hidden'); bannerUntil = 0; }
  }

  function slot(i, label, owned) {
    set(el.slots[i], slotKeys[i], label);
    set(el.slots[i], slotClassKeys[i], state.player.active === i + 1 ? 'on' : owned ? '' : 'empty', 'className');
  }
  const slotKeys = ['sl0', 'sl1', 'sl2', 'sl3', 'sl4'];
  const slotClassKeys = ['sc0', 'sc1', 'sc2', 'sc3', 'sc4'];

  function pips(node, alive, key) {
    if (last.get(key) === alive) return;
    last.set(key, alive);
    for (let i = 0; i < node.children.length; i++) node.children[i].classList.toggle('dead', i >= alive);
  }

  function updatePrompt(p) {
    const c = state.charge;
    let prompt = '', progress = -1, label = '';
    if (!p.alive) prompt = state.phase === 'live' ? 'You are down. Watching the round…' : '';
    else if (c.planter === p && c.plantProgress > 0) { progress = c.plantProgress / ROUND.plantTime; label = 'Planting charge'; }
    else if (c.defuser === p) { progress = c.defuseProgress / (p.kit ? ROUND.defuseTimeKit : ROUND.defuseTime); label = p.kit ? 'Defusing (kit)' : 'Defusing'; }
    else if (state.phase === 'freeze') prompt = 'Freeze time · <kbd>B</kbd> buy';
    else if (p.hasCharge && siteAt(p.pos.x, p.pos.z) && state.phase === 'live') prompt = 'Hold <kbd>E</kbd> to plant the charge';
    else if (c.phase === 'planted' && state.sideOf(p) === 'def' && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 1.8) prompt = 'Hold <kbd>E</kbd> to defuse';
    else if (state.phase === 'live' && round.canBuy(p) && state.liveTime < 6) prompt = '<kbd>B</kbd> buy · buy window open in spawn';
    set(el.prompt, 'pr', prompt, 'innerHTML');
    el.prompt.classList.toggle('hidden', !prompt);
    el.progress.classList.toggle('hidden', progress < 0);
    if (progress >= 0) { set(el.progressLabel, 'pgl', label); el.progressFill.style.width = `${Math.min(100, progress * 100)}%`; }
  }

  return { update, banner, radio, hitMarker, renderFeed };
}
