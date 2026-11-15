// Turns the cell layout into the lit, textured refinery. Each material's faces are merged into
// one geometry (a dozen draw calls for the whole map), only faces that can be seen are emitted,
// and UVs are in world metres so every texture keeps its scale. Walls take their zone's skin:
// plaster on the pans (A), brick in the kilns (Mid), rusted steel at the dock (B), teal sheet on
// the culvert, concrete in the yard. Then signage, wall lamps, the culvert roof and a skyline.
import * as THREE from 'three';
import { CELL, SIGNS, LAMPS, PLANT_SPOTS, ROOF_HEIGHT } from '../data/map.js';
import { COLS, ROWS, HALF_W, HALF_D, heightAt, charAt, floorAt, isRoofed, cellX, cellZ } from './grid.js';
import { PALETTE } from '../core/palette.js';
import { signTexture } from './textures.js';

class Batch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  quad(a, b, c, d, n, ua, ub, va, vb) {
    const i = this.pos.length / 3;
    this.pos.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) this.nor.push(...n);
    this.uv.push(ua, va, ub, va, ub, vb, ua, vb);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** Which skin a wall cell wears, by the part of the refinery it stands in. */
function wallZone(c, r) {
  if (c >= 33 && r >= 10) return 'wallCulvert';
  if (r <= 12 && c <= 13) return 'wallPans';
  if (r <= 13 && c >= 26) return 'wallDock';
  if (r >= 22) return 'wallYard';
  return 'wallKiln';
}

const SOLID_SKIN = { P: 'pillar', C: 'crateTall', c: 'crate', w: 'barrier' };
// Texture metres per repeat, per material: [horizontal, vertical].
const SCALE = {
  wallPans: [5.2, 5.2], wallKiln: [4, 4], wallDock: [5.2, 5.2], wallCulvert: [5.2, 5.2], wallYard: [4, 4],
  wallTop: [4, 4], pillar: [2, 2.6], crate: [1, 0.85], crateTall: [2, 1.9], barrier: [2, 1.05],
};

export function buildWorld(scene, tex) {
  const std = (map, extra) => new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, ...extra });
  const materials = {
    wallPans: std(tex.plaster), wallKiln: std(tex.brick), wallDock: std(tex.rust, { roughness: 0.75, metalness: 0.25 }),
    wallCulvert: std(tex.teal, { roughness: 0.7, metalness: 0.3 }), wallYard: std(tex.concrete),
    wallTop: std(tex.concrete, { color: 0x8c877c }), pillar: std(tex.steel, { roughness: 0.55, metalness: 0.5 }),
    crate: std(tex.plywood), crateTall: std(tex.olive), barrier: std(tex.barrier),
    yard: std(tex.floor), siteA: std(tex.siteA), siteB: std(tex.siteB), spawnDef: std(tex.spawn), spawnAtk: std(tex.spawn),
    culvert: std(tex.floor, { color: 0x77756e }), roof: std(tex.teal, { roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
  };
  const batches = {};
  const batch = (key) => (batches[key] ??= new Batch());

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x0 = c * CELL - HALF_W, x1 = x0 + CELL, z0 = r * CELL - HALF_D, z1 = z0 + CELL;
      const h = heightAt(c, r);
      if (h === 0) {
        batch(floorAt(c, r)).quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], x0 / 4, x1 / 4, -z1 / 4, -z0 / 4);
        if (isRoofed(c, r)) addRoof(batch('roof'), c, r, x0, x1, z0, z1);
        continue;
      }
      const ch = charAt(c, r);
      const skin = SOLID_SKIN[ch] ?? wallZone(c, r);
      const [su, sv] = SCALE[skin];
      const top = ch === '#' ? 'wallTop' : skin;
      const [tu] = SCALE[top];
      batch(top).quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], x0 / tu, x1 / tu, -z1 / tu, -z0 / tu);
      // Sides: only where the neighbour is lower, and only the part above it.
      const side = (nh, a, b, cc, d, n, ua, ub) => {
        if (nh >= h) return;
        a[1] = b[1] = nh; cc[1] = d[1] = h;
        batch(skin).quad(a, b, cc, d, n, ua / su, ub / su, nh / sv, h / sv);
      };
      side(heightAt(c + 1, r), [x1, 0, z1], [x1, 0, z0], [x1, 0, z0], [x1, 0, z1], [1, 0, 0], -z1, -z0);
      side(heightAt(c - 1, r), [x0, 0, z0], [x0, 0, z1], [x0, 0, z1], [x0, 0, z0], [-1, 0, 0], z0, z1);
      side(heightAt(c, r + 1), [x0, 0, z1], [x1, 0, z1], [x1, 0, z1], [x0, 0, z1], [0, 0, 1], x0, x1);
      side(heightAt(c, r - 1), [x1, 0, z0], [x0, 0, z0], [x0, 0, z0], [x1, 0, z0], [0, 0, -1], -x1, -x0);
    }
  }
  const group = new THREE.Group();
  for (const [key, b] of Object.entries(batches)) {
    const mesh = new THREE.Mesh(b.geometry(), materials[key]);
    mesh.receiveShadow = true;
    mesh.castShadow = key !== 'roof' && !(key in { yard: 1, siteA: 1, siteB: 1, spawnDef: 1, spawnAtk: 1, culvert: 1 });
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  scene.add(group);
  addSigns(scene);
  addSiteMarks(scene);
  const lamps = addLamps(scene);
  addSkyline(scene, tex);
  return { group, lamps };
}

function addRoof(b, c, r, x0, x1, z0, z1) {
  const y0 = ROOF_HEIGHT, y1 = ROOF_HEIGHT + 0.3;
  b.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], x0 / 4, x1 / 4, z0 / 4, z1 / 4);
  b.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], x0 / 4, x1 / 4, -z1 / 4, -z0 / 4);
  if (!isRoofed(c, r + 1) && heightAt(c, r + 1) < y1) b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], x0 / 4, x1 / 4, 0, 0.1);
  if (!isRoofed(c, r - 1) && heightAt(c, r - 1) < y1) b.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], x0 / 4, x1 / 4, 0, 0.1);
}

const FACE = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };

function addSigns(scene) {
  for (const s of SIGNS) {
    const [fx, fz] = FACE[s.face];
    const mat = new THREE.MeshStandardMaterial({ map: signTexture(s.text, s.sub, s.color), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), mat);
    sign.position.set(cellX(s.cell[0]) + fx * (CELL / 2 + 0.02), 2.7, cellZ(s.cell[1]) + fz * (CELL / 2 + 0.02));
    sign.rotation.y = Math.atan2(fx, fz);
    scene.add(sign);
  }
}

function addSiteMarks(scene) {
  for (const [site, cell] of Object.entries(PLANT_SPOTS)) {
    const color = site === 'A' ? PALETTE.watch : PALETTE.cell;
    const mat = new THREE.MeshStandardMaterial({ map: signTexture(site, 'CHARGE ZONE', color), transparent: true, opacity: 0.55, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), mat);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(cellX(cell[0]), 0.015, cellZ(cell[1]));
    scene.add(mark);
  }
}

// Sodium lamps on brackets, mounted on the nearest wall to each lamp cell.
function addLamps(scene) {
  const fixture = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.6 });
  const bulb = new THREE.MeshBasicMaterial({ color: PALETTE.sodium });
  const arm = new THREE.BoxGeometry(0.12, 0.12, 0.9);
  const head = new THREE.BoxGeometry(0.5, 0.18, 0.5);
  const glow = new THREE.BoxGeometry(0.38, 0.04, 0.38);
  const lights = [];
  for (const [c, r] of LAMPS) {
    let dir = null;
    for (let step = 1; step <= 4 && !dir; step++) {
      for (const [dx, dz] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        if (heightAt(c + dx * step, r + dz * step) >= 5) { dir = [dx, dz, step]; break; }
      }
    }
    if (!dir) continue;
    const [dx, dz, step] = dir;
    const wallX = cellX(c) + dx * (step * CELL - CELL / 2), wallZ = cellZ(r) + dz * (step * CELL - CELL / 2);
    const g = new THREE.Group();
    g.position.set(wallX, 4.5, wallZ);
    g.rotation.y = Math.atan2(-dx, -dz);
    const a = new THREE.Mesh(arm, fixture); a.position.z = 0.45; g.add(a);
    const h = new THREE.Mesh(head, fixture); h.position.set(0, -0.05, 0.95); g.add(h);
    const b = new THREE.Mesh(glow, bulb); b.position.set(0, -0.15, 0.95); g.add(b);
    const light = new THREE.PointLight(PALETTE.sodium, 26, 15, 1.8);
    light.position.set(0, -0.4, 1.0);
    g.add(light);
    lights.push(light);
    scene.add(g);
  }
  return lights;
}

// Beyond the walls: kiln chimneys, salt silos, gantry cranes and evaporation towers, in haze.
function addSkyline(scene, tex) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b3640, roughness: 1 });
  const brickMat = new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 1 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.6, metalness: 0.5 });
  const saltMat = new THREE.MeshStandardMaterial({ color: 0xe6e0d2, roughness: 1 });
  const ember = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  // Chimneys on the kiln block, each with a glowing throat.
  for (const [x, z, h] of [[-21, -2, 16], [-13, 6, 20], [12, 6, 14]]) {
    add(new THREE.CylinderGeometry(0.9, 1.3, h, 10), brickMat, x, 5.2 + h / 2, z);
    add(new THREE.CylinderGeometry(0.75, 0.75, 0.3, 10), ember, x, 5.2 + h + 0.1, z);
  }
  // Salt mounds and a silo row on the roofs of the solid blocks.
  for (const [x, z, r] of [[-16, 2, 4], [-9, 8, 3], [14, 8, 3.5]]) add(new THREE.ConeGeometry(r, r * 0.9, 12), saltMat, x, 5.2 + r * 0.45, z);
  for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(2.2, 2.2, 11, 16), steelMat, 54 + i * 6, 5.5, -20 + i * 3);
  // Ring of distant silhouettes so the horizon reads as an industrial yard.
  for (let i = 0; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2;
    const rad = 95 + (i % 3) * 18;
    const h = 10 + ((i * 7) % 5) * 6;
    const tower = add(new THREE.BoxGeometry(6 + (i % 4) * 3, h, 6), dark, Math.cos(ang) * rad, h / 2 - 1, Math.sin(ang) * rad, ang);
    if (i % 4 === 0) add(new THREE.CylinderGeometry(0.6, 0.9, h + 14, 8), dark, tower.position.x + 4, (h + 14) / 2, tower.position.z);
  }
  // Two gantry cranes over the dock side.
  for (const x of [58, -60]) {
    add(new THREE.BoxGeometry(1.2, 24, 1.2), steelMat, x, 12, -38);
    add(new THREE.BoxGeometry(1.2, 24, 1.2), steelMat, x, 12, -26);
    add(new THREE.BoxGeometry(1.4, 1.4, 30), steelMat, x, 24, -32);
  }
  // The sky dome.
  const domeMat = new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), domeMat);
  dome.renderOrder = -1;
  scene.add(dome);
}

/** Dusk light: warm low sun with soft shadows, a cool sky fill, and haze matched to the horizon. */
export function buildLighting(scene) {
  scene.fog = new THREE.Fog(0x8a6a6a, 38, 150);
  const hemi = new THREE.HemisphereLight(0xb7b4d6, 0x4a3a30, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc28a, 2.6);
  sun.position.set(-42, 34, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -58; cam.right = 58; cam.top = 46; cam.bottom = -46; cam.near = 1; cam.far = 160;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  return { hemi, sun };
}
