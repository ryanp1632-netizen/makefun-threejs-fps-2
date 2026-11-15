// The map as numbers: cell heights, world/cell conversion, the 3D grid raycast every bullet and
// every bot's line of sight uses, and the place names of each floor cell. Nothing here allocates
// after load: results land in the exported `rayHit` record.
import { CELL, LAYOUT, SOLIDS, FLOORS, ROOF_HEIGHT, CALLOUTS } from '../data/map.js';

export const COLS = LAYOUT[0].length;
export const ROWS = LAYOUT.length;
export const HALF_W = (COLS * CELL) / 2;
export const HALF_D = (ROWS * CELL) / 2;
const OUTSIDE = 99;
const ROOF_THICK = 0.3;

const heights = new Float32Array(COLS * ROWS);
const roofed = new Uint8Array(COLS * ROWS);
const floorKind = new Array(COLS * ROWS);
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const ch = LAYOUT[r][c];
    const i = r * COLS + c;
    heights[i] = SOLIDS[ch] ? SOLIDS[ch].height : 0;
    roofed[i] = ch === 'r' ? 1 : 0;
    floorKind[i] = FLOORS[ch] ?? null;
  }
}

export const cellX = (c) => (c + 0.5) * CELL - HALF_W;
export const cellZ = (r) => (r + 0.5) * CELL - HALF_D;
export const toCol = (x) => Math.floor((x + HALF_W) / CELL);
export const toRow = (z) => Math.floor((z + HALF_D) / CELL);
export const inBounds = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
export const charAt = (c, r) => (inBounds(c, r) ? LAYOUT[r][c] : '#');
export const heightAt = (c, r) => (inBounds(c, r) ? heights[r * COLS + c] : OUTSIDE);
export const isRoofed = (c, r) => inBounds(c, r) && roofed[r * COLS + c] === 1;
export const floorAt = (c, r) => (inBounds(c, r) ? floorKind[r * COLS + c] : null);
export const isWalkable = (c, r) => heightAt(c, r) === 0;

/** Which charge site, if any, a world position stands on: 'A', 'B' or null. */
export function siteAt(x, z) {
  const ch = charAt(toCol(x), toRow(z));
  return ch === 'A' || ch === 'B' ? ch : null;
}

/** True when the position is inside the given side's spawn (where buying is allowed). */
export function inSpawn(x, z, side) {
  return charAt(toCol(x), toRow(z)) === (side === 'atk' ? 'a' : 'd');
}

// ---- Raycast ---------------------------------------------------------------------------------
// Amanatides-Woo traversal over the cell grid in x/z, with each solid cell treated as a box from
// the floor to its height, the floor as a plane, and the culvert's roof as a slab. Exact for
// boxes, so a bullet clears a crate it passes over and stops on one it meets.
export const rayHit = { dist: 0, nx: 0, ny: 0, nz: 0, solid: false };

export function raycast(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = maxDist;
  let nx = 0, ny = 0, nz = 0, solid = false;
  if (dy < 0) {
    const tFloor = -oy / dy;
    if (tFloor < best) { best = tFloor; ny = 1; solid = true; }
  }
  const gx = (ox + HALF_W) / CELL;
  const gz = (oz + HALF_D) / CELL;
  let c = Math.floor(gx);
  let r = Math.floor(gz);
  const stepC = dx > 0 ? 1 : -1;
  const stepR = dz > 0 ? 1 : -1;
  const tDeltaC = dx !== 0 ? CELL / Math.abs(dx) : Infinity;
  const tDeltaR = dz !== 0 ? CELL / Math.abs(dz) : Infinity;
  let tMaxC = dx !== 0 ? (dx > 0 ? c + 1 - gx : gx - c) * tDeltaC : Infinity;
  let tMaxR = dz !== 0 ? (dz > 0 ? r + 1 - gz : gz - r) * tDeltaR : Infinity;
  let tEnter = 0;
  let axis = -1; // which grid line we crossed to enter this cell: 0 = column, 1 = row

  for (let guard = 0; guard < 256 && tEnter < best; guard++) {
    const tExit = Math.min(tMaxC, tMaxR, best);
    const h = heightAt(c, r);
    const yEnter = oy + dy * tEnter;
    if (h > 0) {
      if (yEnter <= h) {
        best = tEnter;
        nx = axis === 0 ? -stepC : 0; nz = axis === 1 ? -stepR : 0; ny = axis === -1 ? 1 : 0;
        solid = true;
        break;
      }
      if (dy < 0) {
        const tTop = (h - oy) / dy;
        if (tTop < tExit) { best = tTop; nx = 0; ny = 1; nz = 0; solid = true; break; }
      }
    } else if (roofed[r * COLS + c] === 1) {
      const top = ROOF_HEIGHT + ROOF_THICK;
      if (yEnter >= ROOF_HEIGHT && yEnter <= top) {
        best = tEnter; nx = axis === 0 ? -stepC : 0; nz = axis === 1 ? -stepR : 0; ny = 0; solid = true; break;
      }
      if (yEnter < ROOF_HEIGHT && dy > 0) {
        const tRoof = (ROOF_HEIGHT - oy) / dy;
        if (tRoof < tExit) { best = tRoof; nx = 0; ny = -1; nz = 0; solid = true; break; }
      } else if (yEnter > top && dy < 0) {
        const tTop = (top - oy) / dy;
        if (tTop < tExit) { best = tTop; nx = 0; ny = 1; nz = 0; solid = true; break; }
      }
    }
    if (tMaxC < tMaxR) { c += stepC; tEnter = tMaxC; tMaxC += tDeltaC; axis = 0; }
    else { r += stepR; tEnter = tMaxR; tMaxR += tDeltaR; axis = 1; }
  }
  rayHit.dist = best; rayHit.nx = nx; rayHit.ny = ny; rayHit.nz = nz; rayHit.solid = solid && best < maxDist;
  return best;
}

/** Clear sight from point a to point b (smoke is checked separately by the caller). */
export function clearLine(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return true;
  return raycast(ax, ay, az, dx / len, dy / len, dz / len, len) >= len - 0.02;
}

/** A body can walk straight from a to b: three parallel rays at knee height, offset by its width. */
export function clearWalk(ax, az, bx, bz, halfWidth) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return true;
  const ux = dx / len, uz = dz / len;
  const px = -uz * halfWidth, pz = ux * halfWidth;
  return raycast(ax, 0.3, az, ux, 0, uz, len) >= len &&
    raycast(ax + px, 0.3, az + pz, ux, 0, uz, len) >= len &&
    raycast(ax - px, 0.3, az - pz, ux, 0, uz, len) >= len;
}

// ---- Place names -----------------------------------------------------------------------------
// A multi-source breadth-first fill from every callout: each floor cell takes the name of the
// callout it is fewest steps from. Built once; the HUD and the radio chatter look it up.
const calloutKeys = Object.keys(CALLOUTS);
const region = new Int16Array(COLS * ROWS).fill(-1);
{
  const queue = new Int32Array(COLS * ROWS);
  let head = 0, tail = 0;
  calloutKeys.forEach((key, k) => {
    const [c, r] = CALLOUTS[key].cell;
    region[r * COLS + c] = k;
    queue[tail++] = r * COLS + c;
  });
  while (head < tail) {
    const i = queue[head++];
    const c = i % COLS, r = (i / COLS) | 0;
    for (let d = 0; d < 4; d++) {
      const nc = c + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const nr = r + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (!inBounds(nc, nr) || heightAt(nc, nr) >= 1.5) continue;
      const j = nr * COLS + nc;
      if (region[j] !== -1) continue;
      region[j] = region[i];
      queue[tail++] = j;
    }
  }
}

export function placeName(x, z) {
  const c = toCol(x), r = toRow(z);
  if (!inBounds(c, r)) return '';
  const k = region[r * COLS + c];
  return k >= 0 ? CALLOUTS[calloutKeys[k]].name : '';
}
