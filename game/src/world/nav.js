// Path finding for the bots: A* over walkable cells with eight-way moves (no corner cutting), a
// binary heap over preallocated typed arrays, then string-pulling so a route hugs real corners
// instead of zig-zagging cell to cell. Paths are written into the caller's own array.
import { COLS, ROWS, isWalkable, cellX, cellZ, toCol, toRow, clearWalk } from './grid.js';

const N = COLS * ROWS;
const gScore = new Float32Array(N);
const fScore = new Float32Array(N);
const cameFrom = new Int32Array(N);
const visit = new Uint32Array(N);   // generation stamps, so nothing is cleared between searches
const closed = new Uint32Array(N);
const heap = new Int32Array(N * 4);
let generation = 0;
let heapSize = 0;

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

function heapPush(i) {
  let k = heapSize++;
  heap[k] = i;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (fScore[heap[p]] <= fScore[heap[k]]) break;
    const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p;
  }
}
function heapPop() {
  const top = heap[0];
  heap[0] = heap[--heapSize];
  let k = 0;
  for (;;) {
    const l = 2 * k + 1, r = l + 1;
    let m = k;
    if (l < heapSize && fScore[heap[l]] < fScore[heap[m]]) m = l;
    if (r < heapSize && fScore[heap[r]] < fScore[heap[m]]) m = r;
    if (m === k) break;
    const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m;
  }
  return top;
}

/** Nearest walkable cell to a world point (bots standing on a crate still need a start cell). */
function nearestWalkable(x, z) {
  const c0 = toCol(x), r0 = toRow(z);
  if (isWalkable(c0, r0)) return r0 * COLS + c0;
  for (let ring = 1; ring < 4; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (isWalkable(c0 + dc, r0 + dr)) return (r0 + dr) * COLS + (c0 + dc);
      }
    }
  }
  return -1;
}

/**
 * Finds a path from world point (sx, sz) to (tx, tz). Fills `out` with flat [x, z, x, z, ...]
 * waypoints (the last is the exact target) and returns the number of points, 0 when unreachable.
 */
export function findPath(sx, sz, tx, tz, out) {
  const start = nearestWalkable(sx, sz);
  const goal = nearestWalkable(tx, tz);
  out.length = 0;
  if (start < 0 || goal < 0) return 0;
  generation++;
  heapSize = 0;
  const gc = goal % COLS, gr = (goal / COLS) | 0;
  gScore[start] = 0;
  fScore[start] = Math.hypot(start % COLS - gc, ((start / COLS) | 0) - gr);
  cameFrom[start] = -1;
  visit[start] = generation;
  heapPush(start);
  let found = false;
  while (heapSize > 0) {
    const cur = heapPop();
    if (cur === goal) { found = true; break; }
    if (closed[cur] === generation) continue;
    closed[cur] = generation;
    const c = cur % COLS, r = (cur / COLS) | 0;
    for (let d = 0; d < 8; d++) {
      const nc = c + DIRS[d][0], nr = r + DIRS[d][1];
      if (!isWalkable(nc, nr)) continue;
      if (d >= 4 && (!isWalkable(nc, r) || !isWalkable(c, nr))) continue; // no corner cutting
      const ni = nr * COLS + nc;
      const tentative = gScore[cur] + DIRS[d][2];
      if (visit[ni] === generation && tentative >= gScore[ni]) continue;
      visit[ni] = generation;
      gScore[ni] = tentative;
      fScore[ni] = tentative + Math.hypot(nc - gc, nr - gr);
      cameFrom[ni] = cur;
      heapPush(ni);
    }
  }
  if (!found) return 0;
  // Walk back from the goal, then reverse into world coordinates.
  const cells = scratchCells;
  cells.length = 0;
  for (let i = goal; i !== -1; i = cameFrom[i]) cells.push(i);
  cells.reverse();
  // String-pull: from each kept point, skip ahead to the farthest cell still in straight reach.
  let ax = sx, az = sz;
  let k = 1;
  while (k < cells.length) {
    let far = k;
    for (let j = cells.length - 1; j > k; j--) {
      const cj = cells[j];
      if (clearWalk(ax, az, cellX(cj % COLS), cellZ((cj / COLS) | 0), 0.42)) { far = j; break; }
    }
    const cf = cells[far];
    ax = cellX(cf % COLS); az = cellZ((cf / COLS) | 0);
    out.push(ax, az);
    k = far + 1;
  }
  if (out.length >= 2) { out[out.length - 2] = tx; out[out.length - 1] = tz; } else out.push(tx, tz);
  return out.length / 2;
}
const scratchCells = [];
