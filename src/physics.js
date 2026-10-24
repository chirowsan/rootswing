// Axis-separated AABB vs tile collision with one-way planks.
import { TILE } from './util.js';
const EPS = 0.001;
export function moveBody(map, b, dt, opts = {}) {
  const res = { ground: false, wallL: false, wallR: false, ceil: false, oneway: false };
  // X
  let nx = b.x + b.vx * dt;
  if (b.vx !== 0) {
    const dir = b.vx > 0 ? 1 : -1, edge = dir > 0 ? nx + b.w : nx;
    const tx = Math.floor((dir > 0 ? edge - EPS : edge) / TILE), ty0 = Math.floor(b.y / TILE), ty1 = Math.floor((b.y + b.h - EPS) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) if (map.solid(tx, ty)) {
      nx = dir > 0 ? tx * TILE - b.w : (tx + 1) * TILE; if (dir > 0) res.wallR = true; else res.wallL = true; b.vx = 0; break;
    }
  }
  b.x = nx;
  // Y
  let ny = b.y + b.vy * dt;
  const tx0 = Math.floor(b.x / TILE), tx1 = Math.floor((b.x + b.w - EPS) / TILE);
  if (b.vy > 0) {
    const prevBottom = b.y + b.h, bottom = ny + b.h; const ty = Math.floor((bottom - EPS) / TILE);
    for (let x = tx0; x <= tx1; x++) {
      const c = map.get(x, ty);
      const solid = c === '#' || c === 'B' || c === 'G';
      const plank = c === '=' && !opts.drop && prevBottom <= ty * TILE + 2;
      if (solid || plank) { ny = ty * TILE - b.h; b.vy = 0; res.ground = true; res.oneway = plank && !solid; break; }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(ny / TILE);
    for (let x = tx0; x <= tx1; x++) if (map.solid(x, ty)) { ny = (ty + 1) * TILE; b.vy = 0; res.ceil = true; break; }
  }
  b.y = ny;
  return res;
}
// Is there ground directly under the body (for coyote / grounded checks while vy==0)?
export function groundBelow(map, b) {
  const ty = Math.floor((b.y + b.h + 1) / TILE), tx0 = Math.floor(b.x / TILE), tx1 = Math.floor((b.x + b.w - EPS) / TILE);
  for (let x = tx0; x <= tx1; x++) { const c = map.get(x, ty); if (c === '#' || c === 'B' || c === 'G' || (c === '=' && Math.abs(b.y + b.h - ty * TILE) < 2)) return c; }
  return null;
}
export function touchingWall(map, b, dir) {
  const tx = Math.floor((dir > 0 ? b.x + b.w + 1 : b.x - 1) / TILE);
  const ty0 = Math.floor((b.y + 6) / TILE), ty1 = Math.floor((b.y + b.h - 6) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) if (map.solid(tx, ty)) return true; return false;
}
// Ray march through tiles for hook line-of-sight.
export function lineClear(map, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
  for (let i = 1; i < n; i++) { const t = i / n; if (map.solidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
  return true;
}
// Hazard overlap: thorns hurt in the lower part of the tile; smog pits the whole tile.
export function hazardAt(map, b) {
  const tx0 = Math.floor((b.x + 3) / TILE), tx1 = Math.floor((b.x + b.w - 3) / TILE), ty0 = Math.floor((b.y + 4) / TILE), ty1 = Math.floor((b.y + b.h - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const c = map.get(tx, ty);
    if (c === '^' && b.y + b.h > ty * TILE + 9) return c;
    if (c === 'v' && b.y < (ty + 1) * TILE - 9) return c;
    if (c === '~' && b.y + b.h > ty * TILE + 6) return c;
  }
  return null;
}
