// How the match is felt: the simulation's events turned into sound, effects, the viewmodel's
// kick and the HUD's markers, feed and banners. Presentation only: nothing here changes the state.
import { PALETTE } from './core/palette.js';

export function wireFeedback(state, events, { sound, effects, hud, viewmodel, viewTarget, onMatchEnd }) {
  const me = () => state.player;
  events.on('shot', (s) => {
    if (s.pellet === 0) sound.gunshot(s.def.sound, s.ox, s.oz, s.shooter === me());
    if (s.pellet % 3 === 0) effects.tracer(s.ox, s.oy, s.oz, s.ex, s.ey, s.ez);
    if (s.target) { if (s.target !== viewTarget()) effects.burst(s.ex, s.ey, s.ez, 0, 0, 0, 'blood'); }
    else if (s.solid) { effects.burst(s.ex, s.ey, s.ez, s.nx, s.ny, s.nz, 'spark'); effects.hole(s.ex, s.ey, s.ez, s.nx, s.ny, s.nz); }
  });
  events.on('fired', (a) => { if (a === me()) viewmodel.onFired(a); });
  events.on('swing', (a) => { if (a === me()) { viewmodel.onSwing(); sound.click('swing'); } });
  events.on('throw', (a) => { if (a === me()) { viewmodel.onThrow(); sound.click('throw'); } });
  for (const kind of ['reload', 'reloaded', 'dry']) events.on(kind, (a) => { if (a === me()) sound.click(kind); });
  events.on('draw', () => sound.click('draw'));
  events.on('scope', () => sound.click('scope'));
  events.on('damage', ({ attacker, target, zone }) => {
    if (attacker === me() && target !== me()) {
      hud.hitMarker(target.hp <= 0 ? 'kill' : zone === 'head' ? 'head' : '');
      sound.click(zone === 'head' ? 'headshot' : 'hit');
    }
    if (target === me()) sound.click('hurt');
  });
  events.on('kill', (k) => {
    hud.renderFeed();
    if (k.killer === me()) sound.click('kill');
  });
  events.on('step', ({ actor, loud }) => sound.step(actor.pos.x, actor.pos.z, actor === me(), loud));
  events.on('bounce', (p) => sound.boom('bounce', p.x, p.z));
  events.on('detonate', (d) => {
    sound.boom(d.kind, d.x, d.z);
    effects.detonation(d.kind, d.x, d.y, d.z);
    if (d.kind === 'flash' && me().flash > 0.6) sound.ring(Math.min(1, me().flash / 3));
  });
  events.on('radio', ({ from, text }) => { if (from && from.team === me().team) hud.radio(from, text); });
  events.on('planted', ({ charge, planter }) => {
    sound.sting('plant');
    hud.banner('Charge planted', `Site ${charge.site} · ${planter.name} · 38 seconds`, 2.5, '#e5484d');
  });
  events.on('beep', (c) => { sound.beep(c.x, c.z); effects.onBeep(); });
  events.on('detonated', (c) => { sound.boom('charge', c.x, c.z); effects.detonation('frag', c.x, c.y + 1, c.z); });
  events.on('chargeDropped', () => { if (state.sideOf(me()) === 'atk') hud.radio(null, 'the charge is down'); });
  events.on('roundStart', () => {
    effects.clear();
    hud.renderFeed();
    const attack = state.sideOf(me()) === 'atk';
    hud.banner(`Round ${state.round}`, attack ? 'Attack · plant the charge on A or B' : 'Defend · hold A and B, retake and defuse', 3, PALETTE[me().team]);
    viewmodel.setTeam(me().team);
  });
  events.on('live', () => sound.sting('start'));
  events.on('roundEnd', (r) => {
    sound.sting(r.winner === me().team ? 'win' : 'loss');
    hud.banner(`${state.teams[r.winner].name} win`, `${r.reason}${r.mvp ? ` · MVP ${r.mvp.name}` : ''}`, 4.5, PALETTE[r.winner]);
  });
  events.on('halftime', () => { sound.sting('half'); hud.banner('Halftime', 'Sides swap · funds reset', 4.5); });
  events.on('matchEnd', () => {
    const w = state.matchWinner;
    hud.banner(w === 'draw' ? 'Draw' : `${state.teams[w].name} take the match`, `${state.teams.cell.score} : ${state.teams.watch.score}`, 600, w === 'draw' ? '' : PALETTE[w]);
    onMatchEnd();
  });
}
