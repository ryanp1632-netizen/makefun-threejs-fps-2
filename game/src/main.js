// SALTGLASS boot and loop. A fixed 60 Hz simulation (sim/, ai/) is kept apart from rendering
// (render/, ui/, audio/), which runs at the display's rate and only reads the state.
//
// Where things live, for a reader:
//   core/config.js      every tuning number          core/state.js     the one match state record
//   data/map.js         Saltglass Yard layout, callouts, the attackers' playbook, defence posts
//   data/weapons.js     guns, recoil patterns, grenades, gear, buy menu
//   world/grid.js       cell heights, 3D grid raycast (bullets, sight), place names
//   world/nav.js        A* + string pulling for bots      world/builder.js  merged-geometry map
//   sim/mover.js        acceleration, friction, crouch, jump, collision
//   sim/arms.js         fire, spread, recoil, reload, melee, throws
//   sim/ballistics.js   hitscan vs head / chest / stomach / legs   sim/grenades.js  frag, smoke, flash
//   sim/charge.js       plant and defuse        sim/round.js   rounds, economy, buying, halftime
//   ai/perception.js    sight, hearing, intel   ai/tactics.js  team plans, rotations, bot buys
//   ai/brain.js         one bot: modes, routes, aim, bursts, counter-strafing, grenades
//   render/*            soldiers, viewmodel, effects    ui/*  HUD, radar, buy menu, scoreboard
//   feedback.js         sim events -> sound, effects, hit markers, kill feed, banners
//   shots.js            the staged scenes the screenshots were rendered from (?shot=...)
import * as THREE from 'three';
import { SIM, AI, MOVE } from './core/config.js';
import { createEvents } from './core/events.js';
import { createState } from './core/state.js';
import { stepBody, eyeHeight, maxSpeed } from './sim/mover.js';
import { updateArms, forward } from './sim/arms.js';
import { activeWeapon } from './sim/combatant.js';
import { createGrenades } from './sim/grenades.js';
import { createCharge } from './sim/charge.js';
import { createRound } from './sim/round.js';
import { listen } from './ai/perception.js';
import { createTactics } from './ai/tactics.js';
import { createBrain, stepBrain } from './ai/brain.js';
import { createInput } from './player/input.js';
import { createControl } from './player/control.js';
import { createHud } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';
import { createBuyMenu, createScoreboard } from './ui/menus.js';
import { wireFeedback } from './feedback.js';
import { buildWorld, buildLighting } from './world/builder.js';
import { createTextures } from './world/textures.js';
import { createSoldiers } from './render/soldiers.js';
import { createViewmodel } from './render/viewmodel.js';
import { createEffects } from './render/effects.js';
import { createSound } from './audio/sound.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '', 10) || (shot ? 1 : (Date.now() % 100000) + 1);

// ---- Renderer, scene, cameras ------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!shot });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.05, 600);
camera.rotation.order = 'YXZ';
const textures = createTextures();
buildWorld(scene, textures);
buildLighting(scene);

// ---- Simulation --------------------------------------------------------------------------------
const events = createEvents();
const state = createState(seed);
const grenades = createGrenades(state, events);
const charge = createCharge(state, events);
const round = createRound(state, events, charge, grenades);
const tactics = createTactics(state, events, round);
state.actors.forEach((a, i) => { if (!a.isPlayer) createBrain(a, 0.82 + state.rng.next() * 0.3, i); });
const ctx = { state, events, grenades, kill: state.kill };

// ---- Views -------------------------------------------------------------------------------------
const soldiers = createSoldiers(scene, state);
const effects = createEffects(scene, state, textures);
const viewmodel = createViewmodel(innerWidth, innerHeight, textures);
const sound = createSound();
const hud = createHud(state, round);
const minimap = createMinimap(document.getElementById('minimap'), state);
const buyMenu = createBuyMenu(state, round, sound);
const board = createScoreboard(state);
const input = createInput(renderer.domElement, onLockChange);
const control = createControl(state, input, events);

listen(state, events);
wireFeedback(state, events, { sound, effects, hud, viewmodel, viewTarget, onMatchEnd });

// ---- The fixed-step simulation -----------------------------------------------------------------
const wishScratch = { x: 0, z: 0 };
const still = { x: 0, z: 0, speed: 0, jump: false };

/** One fixed step of the whole match. A scripted step (shots.js) leaves the player's intent as set. */
function simulate(dt, scripted = false) {
  const wish = scripted ? still : control.step(buyMenu.open);
  for (const a of state.actors) {
    if (!a.alive) continue;
    let wx, wz, speed, jump = false;
    if (a.isPlayer) {
      wx = wish.x; wz = wish.z; speed = wish.speed; jump = wish.jump;
    } else {
      stepBrain(a, dt, ctx);
      const b = a.brain;
      const len = Math.hypot(b.wishX, b.wishZ);
      wishScratch.x = len > 1 ? b.wishX / len : b.wishX;
      wishScratch.z = len > 1 ? b.wishZ / len : b.wishZ;
      wx = wishScratch.x; wz = wishScratch.z;
      speed = maxSpeed(a, activeWeapon(a)?.def.speed ?? 1);
      if (state.phase === 'freeze') wx = wz = 0;
    }
    stepBody(a, wx, wz, speed, jump, dt);
    footsteps(a, dt);
    updateArms(a, dt, ctx);
  }
  state.player.flash = Math.max(0, state.player.flash - dt);
  grenades.update(dt);
  round.update(dt);
  tactics.update();
  state.time += dt;
  input.endStep();
}

function footsteps(a, dt) {
  const speed = Math.hypot(a.vel.x, a.vel.z);
  if (!a.onGround) return;
  if (a.landed) { events.emit('step', { actor: a, loud: true }); a.landed = 0; }
  a.stepDistance += speed * dt;
  if (a.stepDistance > 2.1) {
    a.stepDistance = 0;
    if (speed > MOVE.footstepRunSpeed && !a.walking && a.crouch < 0.5) events.emit('step', { actor: a, loud: false });
  }
}

// ---- Screens and keys --------------------------------------------------------------------------
function onMatchEnd() {
  board.show();
  input.releaseLock();
  showScreen('title', 'Play again');
}

const screens = { title: document.getElementById('title'), pause: document.getElementById('pause') };
function showScreen(name, label) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
  if (label) document.getElementById('deploy').textContent = label;
}
document.getElementById('deploy').addEventListener('click', () => {
  sound.unlock();
  board.hide();
  showScreen(null);
  document.body.classList.remove('menu');
  round.startMatch();
  input.requestLock();
});
document.getElementById('resume').addEventListener('click', () => { sound.unlock(); showScreen(null); input.requestLock(); });
document.getElementById('sens').addEventListener('input', (e) => { control.settings.sensitivity = Number(e.target.value); });
renderer.domElement.addEventListener('click', () => { if (state.phase !== 'menu' && !input.locked && !buyMenu.open) input.requestLock(); });

function onLockChange(locked) {
  if (locked) { showScreen(null); state.paused = false; return; }
  if (buyMenu.open || state.phase === 'menu' || state.phase === 'end') return;
  state.paused = true;
  showScreen('pause');
}

window.addEventListener('keydown', (e) => {
  if (state.phase === 'menu' || shot) return;
  if (e.code === 'KeyB' || (e.code === 'Escape' && buyMenu.open)) {
    if (buyMenu.open) { buyMenu.hide(); input.requestLock(); }
    else if (round.canBuy(state.player)) { buyMenu.show(); input.releaseLock(); }
  } else if (buyMenu.open && e.code.startsWith('Digit')) {
    buyMenu.key(Number(e.code.slice(5)));
  } else if (e.code === 'Tab') board.show();
});
window.addEventListener('keyup', (e) => { if (e.code === 'Tab' && state.phase !== 'end') board.hide(); });

// ---- Rendering ---------------------------------------------------------------------------------
const look = { dx: 0, dy: 0 };
const eye = { x: 0, y: 0, z: 0 };
const fwd = { x: 0, y: 0, z: 0 };
let minimapIn = 0;

/** Who the camera watches: the player, or after death the first living teammate. */
function viewTarget() {
  const p = state.player;
  if (p.alive || state.phase === 'freeze') return p;
  for (const a of state.actors) if (a.alive && a.team === p.team) return a;
  return p;
}

// Behind the title screen: a slow pan across the pans and the kiln at dusk.
function menuCamera() {
  const t = performance.now() / 1000;
  camera.position.set(-22 + Math.sin(t * 0.05) * 6, 9, 8);
  camera.rotation.set(-0.28, -0.55 + Math.sin(t * 0.07) * 0.35, 0);
}

function render(frameDt) {
  const p = state.player;
  if (state.phase === 'menu') {
    menuCamera();
    effects.update(frameDt);
    renderer.clear();
    renderer.render(scene, camera);
    return;
  }
  input.takeLook(look);
  if (!state.paused) control.look(look);
  if (buyMenu.open && !round.canBuy(p)) { buyMenu.hide(); input.requestLock(); }

  const v = viewTarget();
  eye.x = v.pos.x; eye.y = v.pos.y + eyeHeight(v); eye.z = v.pos.z;
  if (!v.alive) eye.y = v.pos.y + 0.5; // the fallen player's view, low to the ground
  camera.position.set(eye.x, eye.y, eye.z);
  camera.rotation.set(v.pitch + v.punchPitch, v.yaw + v.punchYaw, 0);
  const w = activeWeapon(v);
  const fov = v.scope > 0 && w?.def.scope ? w.def.scope[v.scope - 1] : 74;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  forward(v.yaw, v.pitch, fwd);
  sound.setListener(eye.x, eye.z, v.yaw);

  soldiers.update(frameDt, v);
  effects.update(frameDt);
  viewmodel.update(v, frameDt, look, state.time);
  hud.update(camera.fov);
  minimapIn -= frameDt;
  if (minimapIn <= 0) { minimapIn = 1 / 20; minimap.draw(spottedByMyTeam); }

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  if (v === p || v.alive) renderer.render(viewmodel.scene, viewmodel.camera);
}

/** The radar shows an enemy only while someone on the player's team has eyes on it. */
function spottedByMyTeam(enemy) {
  for (const a of state.actors) {
    if (!a.alive || a.team !== state.player.team) continue;
    if (a.brain ? a.brain.memory.visible && a.brain.memory.target === enemy : seenByPlayer(enemy)) return true;
  }
  return false;
}
function seenByPlayer(enemy) {
  const dx = enemy.pos.x - eye.x, dz = enemy.pos.z - eye.z;
  const d = Math.hypot(dx, dz);
  return d < AI.viewRange && (dx * fwd.x + dz * fwd.z) / d > 0.6 && !grenades.smokeBlocks(eye.x, eye.y, eye.z, enemy.pos.x, enemy.pos.y + 1.4, enemy.pos.z);
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  viewmodel.resize(innerWidth, innerHeight);
});

// ---- The loop ----------------------------------------------------------------------------------
let last = performance.now();
let accumulator = 0;
function frame(now) {
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!state.paused && state.phase !== 'menu') {
    accumulator += frameDt;
    let steps = 0;
    while (accumulator >= SIM.step && steps < SIM.maxStepsPerFrame) { simulate(SIM.step); accumulator -= SIM.step; steps++; }
    if (steps === SIM.maxStepsPerFrame) accumulator = 0;
  }
  render(frameDt);
  requestAnimationFrame(frame);
}

if (shot) {
  // Screenshot scenes: staged deterministically from the seed, simulated, rendered, then frozen.
  const { stageShot } = await import('./shots.js');
  stageShot(shot, { state, round, charge, grenades, tactics, events, hud, buyMenu, board, simulate, showScreen });
  // The frozen moment is re-presented every frame (time does not advance) until captured.
  const hold = () => { render(0); requestAnimationFrame(hold); };
  hold();
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
