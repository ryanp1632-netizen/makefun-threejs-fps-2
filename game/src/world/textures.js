// Every surface is painted here in code on 2D canvases: no image files. One dusk palette runs
// through all of them: salt-white plaster for the pans, kiln brick for Mid, rusted corrugated
// steel for the dock, poured concrete for the yard, plywood and olive crates, hazard-striped
// barriers. A seeded generator keeps every texture identical from run to run.
import * as THREE from 'three';
import { createRng } from '../core/rng.js';
import { PALETTE } from '../core/palette.js';


const rng = createRng(7);

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function finish(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Speckle and grime: n dots of random alpha in a colour, the base of every weathered surface. */
function speckle(g, size, n, color, maxR, alpha) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    g.globalAlpha = rng.next() * alpha;
    g.beginPath();
    g.arc(rng.next() * size, rng.next() * size, rng.next() * maxR + 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Vertical streaks of runoff from the top edge: rain and salt stains on walls. */
function streaks(g, size, n, color, alpha) {
  for (let i = 0; i < n; i++) {
    const x = rng.next() * size, w = 2 + rng.next() * 10, h = size * (0.2 + rng.next() * 0.7);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = rng.next() * alpha;
    g.fillStyle = grad;
    g.fillRect(x, 0, w, h);
  }
  g.globalAlpha = 1;
}

function plaster() {
  const [c, g] = canvas(512);
  g.fillStyle = PALETTE.plaster; g.fillRect(0, 0, 512, 512);
  speckle(g, 512, 2600, '#8f8676', 2, 0.25);
  speckle(g, 512, 900, '#ffffff', 1.5, 0.35);
  streaks(g, 512, 26, 'rgba(90,80,64,0.9)', 0.35);
  // Board-formed panel seams and a base band of grime.
  g.strokeStyle = 'rgba(70,62,50,0.35)'; g.lineWidth = 3;
  for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  g.beginPath(); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
  const base = g.createLinearGradient(0, 400, 0, 512);
  base.addColorStop(0, 'rgba(60,52,40,0)'); base.addColorStop(1, 'rgba(60,52,40,0.45)');
  g.fillStyle = base; g.fillRect(0, 400, 512, 112);
  return finish(c);
}

function brick() {
  const [c, g] = canvas(512);
  g.fillStyle = '#5e3a2c'; g.fillRect(0, 0, 512, 512);
  const bh = 32, bw = 64;
  for (let row = 0; row < 512 / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 512 / bw + 1; col++) {
      const shade = 0.82 + rng.next() * 0.3;
      const r = Math.round(154 * shade), gg = Math.round(90 * shade), b = Math.round(67 * shade);
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  speckle(g, 512, 1800, '#2a1a14', 1.6, 0.3);
  streaks(g, 512, 18, 'rgba(30,20,16,0.9)', 0.4);
  // Soot from the kilns, heavier toward the top.
  const soot = g.createLinearGradient(0, 0, 0, 220);
  soot.addColorStop(0, 'rgba(20,14,12,0.55)'); soot.addColorStop(1, 'rgba(20,14,12,0)');
  g.fillStyle = soot; g.fillRect(0, 0, 512, 220);
  return finish(c);
}

function corrugated(base, accent) {
  const [c, g] = canvas(512);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 16) {
    const grad = g.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.28)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = grad; g.fillRect(x, 0, 16, 512);
  }
  speckle(g, 512, 1400, accent, 3, 0.4);
  streaks(g, 512, 30, 'rgba(60,28,14,0.9)', 0.5);
  g.fillStyle = 'rgba(20,20,22,0.6)'; g.fillRect(0, 500, 512, 12);
  return finish(c);
}

function concrete(tone, size = 512) {
  const [c, g] = canvas(size);
  g.fillStyle = tone; g.fillRect(0, 0, size, size);
  speckle(g, size, 3000, '#4a453d', 1.8, 0.28);
  speckle(g, size, 1200, '#efe9dc', 1.2, 0.18);
  // Hairline cracks.
  g.strokeStyle = 'rgba(40,36,30,0.45)'; g.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    let x = rng.next() * size, y = rng.next() * size;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += rng.range(-22, 22); y += rng.range(-22, 22); g.lineTo(x, y); }
    g.stroke();
  }
  // Expansion joints every slab.
  g.strokeStyle = 'rgba(30,28,24,0.5)'; g.lineWidth = 2;
  g.strokeRect(1, 1, size - 2, size - 2);
  return finish(c);
}

/** Painted site floor: a light tile with the site's colour band around the edge. */
function siteFloor(tone, band) {
  const [c, g] = canvas(256);
  g.fillStyle = tone; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 900, '#3d3a34', 1.4, 0.25);
  g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  g.fillStyle = band; g.globalAlpha = 0.25; g.fillRect(0, 0, 256, 8); g.globalAlpha = 1;
  return finish(c);
}

function plywood() {
  const [c, g] = canvas(256);
  g.fillStyle = PALETTE.plywood; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = `rgba(90,56,24,${0.08 + rng.next() * 0.12})`;
    g.fillRect(0, y + Math.sin(y * 0.2) * 2, 256, 1.5);
  }
  // Frame boards and a diagonal brace, stencilled lot number.
  g.fillStyle = '#7a5530';
  g.fillRect(0, 0, 256, 22); g.fillRect(0, 234, 256, 22); g.fillRect(0, 0, 22, 256); g.fillRect(234, 0, 22, 256);
  g.save(); g.translate(128, 128); g.rotate(-Math.PI / 4); g.fillRect(-170, -11, 340, 22); g.restore();
  g.fillStyle = 'rgba(30,24,18,0.7)'; g.font = 'bold 26px monospace'; g.textAlign = 'center';
  g.fillText('SG-4', 128, 72); g.font = '16px monospace'; g.fillText('SALT · KEEP DRY', 128, 200);
  speckle(g, 256, 400, '#3a2614', 1.5, 0.3);
  return finish(c);
}

function oliveCrate() {
  const [c, g] = canvas(256);
  g.fillStyle = PALETTE.olive; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, 0, 3, 256); }
  g.strokeStyle = '#323d2e'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246);
  g.fillStyle = '#d8d0bf'; g.font = 'bold 30px monospace'; g.textAlign = 'center';
  g.fillText('YARD 4', 128, 120); g.font = '18px monospace'; g.fillText('NO HOOKS', 128, 150);
  speckle(g, 256, 700, '#1c2219', 2, 0.35);
  speckle(g, 256, 200, '#a88a5a', 1.5, 0.3);
  return finish(c);
}

function hazardBarrier() {
  const [c, g] = canvas(256);
  g.fillStyle = PALETTE.concrete; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 1400, '#4a453d', 1.5, 0.3);
  g.save(); g.beginPath(); g.rect(0, 150, 256, 56); g.clip();
  for (let x = -256; x < 512; x += 48) {
    g.fillStyle = PALETTE.hazard; g.beginPath();
    g.moveTo(x, 206); g.lineTo(x + 24, 206); g.lineTo(x + 80, 150); g.lineTo(x + 56, 150); g.fill();
  }
  g.restore();
  g.fillStyle = 'rgba(20,20,20,0.5)'; g.fillRect(0, 206, 256, 4); g.fillRect(0, 146, 256, 4);
  return finish(c);
}

function steel() {
  const [c, g] = canvas(256);
  g.fillStyle = PALETTE.steel; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(255,255,255,${rng.next() * 0.05})`; g.fillRect(0, y, 256, 1); }
  g.fillStyle = '#c9a23a'; g.fillRect(0, 210, 256, 46);
  g.fillStyle = '#20232a';
  for (let x = -40; x < 300; x += 40) { g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 20, 256); g.lineTo(x + 40, 210); g.lineTo(x + 20, 210); g.fill(); }
  speckle(g, 256, 500, '#3a2a20', 2, 0.4);
  return finish(c);
}

/** A soft round puff for smoke and dust sprites. */
function puff() {
  const [c, g] = canvas(128);
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 120, 'rgba(0,0,0,1)', 3, 0.06);
  return finish(c, false);
}

/** A four-point star for muzzle flashes and sparks. */
function flare() {
  const [c, g] = canvas(128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,250,220,1)');
  grad.addColorStop(0.25, 'rgba(255,190,90,0.85)');
  grad.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,230,170,0.8)';
  g.beginPath(); g.moveTo(64, 2); g.lineTo(70, 64); g.lineTo(64, 126); g.lineTo(58, 64); g.fill();
  g.beginPath(); g.moveTo(2, 64); g.lineTo(64, 58); g.lineTo(126, 64); g.lineTo(64, 70); g.fill();
  return finish(c, false);
}

/** A bullet hole: dark core, scorched ring. */
function hole() {
  const [c, g] = canvas(64);
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(10,8,6,1)');
  grad.addColorStop(0.22, 'rgba(20,16,12,0.95)');
  grad.addColorStop(0.5, 'rgba(40,34,28,0.4)');
  grad.addColorStop(1, 'rgba(40,34,28,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return finish(c, false);
}

/** The dusk sky: indigo overhead to a burning horizon, with a low sun glow. */
function sky() {
  const [c, g] = canvas(512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.38, PALETTE.skyMid);
  grad.addColorStop(0.5, PALETTE.horizon);
  grad.addColorStop(0.56, PALETTE.haze);
  grad.addColorStop(1, '#2b2530');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  // Thin cloud bands lit from below.
  for (let i = 0; i < 14; i++) {
    const y = 120 + rng.next() * 130;
    g.fillStyle = `rgba(255,${150 + rng.int(0, 60)},${110 + rng.int(0, 40)},${0.08 + rng.next() * 0.12})`;
    g.fillRect(rng.next() * 512 - 100, y, 120 + rng.next() * 260, 2 + rng.next() * 5);
  }
  const t = finish(c, false);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Big painted lettering for walls and floors: a letter over a small caption. */
export function signTexture(text, sub, color) {
  const [c, g] = canvas(256);
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = color;
  g.textAlign = 'center';
  g.font = `900 ${text.length > 2 ? 64 : 150}px Impact, 'Arial Black', sans-serif`;
  g.fillText(text, 128, text.length > 2 ? 140 : 170);
  g.font = 'bold 22px monospace';
  g.fillText(sub, 128, 220);
  // Weather the paint so it reads as sprayed on, not printed.
  g.globalCompositeOperation = 'destination-out';
  speckle(g, 256, 700, '#000', 2.2, 0.6);
  return finish(c, false);
}

/** Builds the whole set once; the builder, effects and views share these textures. */
export function createTextures() {
  return {
    plaster: plaster(), brick: brick(), rust: corrugated(PALETTE.rust, '#c06a3a'), teal: corrugated('#3c6466', '#7a5a3a'),
    concrete: concrete(PALETTE.concrete), floor: concrete(PALETTE.floor), spawn: concrete('#6f6d66'),
    siteA: siteFloor(PALETTE.siteA, '#2fb3a6'), siteB: siteFloor(PALETTE.siteB, '#ef7d32'),
    plywood: plywood(), olive: oliveCrate(), barrier: hazardBarrier(), steel: steel(),
    puff: puff(), flare: flare(), hole: hole(), sky: sky(),
  };
}
