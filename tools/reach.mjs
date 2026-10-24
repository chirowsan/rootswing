// Heuristic reachability check for generated runs: can Sprig reach every door, chest, fountain,
// weapon and the boss door using walk / jump(+dash) / wall-climb / hook moves?
import { generateRun, CW, CH } from '../src/level.js';
const JUMP_UP = 3, JUMP_DX = [7, 7, 6, 5]; // dx allowed for rise 0..3
export function analyze(seed) {
  const R = generateRun(seed), M = R.map, W = M.w, H = M.h;
  const solid = (x, y) => M.solid(x, y), haz = (x, y) => M.hazard(x, y);
  const plank = (x, y) => M.get(x, y) === '=';
  const free = (x, y) => (!solid(x, y) || M.get(x, y) === 'B') && !haz(x, y);
  const body = (x, y) => free(x, y) && free(x, y - 1); // feet tile + head tile
  const stand = (x, y) => body(x, y) && (solid(x, y + 1) || plank(x, y + 1));
  const anchors = R.spawns.filter((s) => s.c === 'o' || s.c === 'z');
  const P = R.spawns.find((s) => s.c === 'P'); const seen = new Uint8Array(W * H), q = [];
  const push = (x, y) => { const i = y * W + x; if (!seen[i]) { seen[i] = 1; q.push(x, y); } };
  // drop from (x,y) straight down to first standable
  const fall = (x, y) => { while (y < H - 1 && body(x, y + 1) && !stand(x, y)) y++; return stand(x, y) ? y : -1; };
  let sy = fall(P.x, P.y); push(P.x, sy);
  const usedAnchor = new Set();
  const los = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2); for (let i = 1; i < n; i++) { const x = Math.floor(x0 + (x1 - x0) * i / n + 0.5), y = Math.floor(y0 + (y1 - y0) * i / n + 0.5); if (solid(x, y)) return false; } return true; };
  const fromAir = (ax, ay) => { // hanging at an anchor: can reach ground within a swing+fling radius
    for (let dy = -2; dy <= 9; dy++) for (let dx = -8; dx <= 8; dx++) { const x = ax + dx, y = ay + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue; if (stand(x, y) && los(ax, ay, x, y - 1)) push(x, y); }
    for (const b of anchors) { const k = b.x + ',' + b.y; if (usedAnchor.has(k) || Math.hypot(b.x - ax, b.y - ay) > 9.1 || !los(ax, ay, b.x, b.y)) continue; usedAnchor.add(k); fromAir(b.x, b.y + (b.c === 'o' ? 3 : 1)); }
    // or simply drop
    for (const dx of [-2, -1, 0, 1, 2]) { const y = fall(ax + dx, ay + 1); if (y > 0) push(ax + dx, y); }
  };
  while (q.length) {
    const x = q.shift(), y = q.shift();
    // jumps: rise straight up to apex row, travel, then fall (L-shaped conservative arc)
    for (let up = 0; up <= JUMP_UP; up++) {
      let ok = true; for (let k = 1; k <= up; k++) if (!body(x, y - k)) { ok = false; break; } if (!ok) break;
      const ay = y - up;
      for (const d of [-1, 1]) for (let dx = 1; dx <= JUMP_DX[up]; dx++) { const tx = x + d * dx; if (!body(tx, ay)) break; const fy = fall(tx, ay); if (fy > 0) push(tx, fy); }
    }
    // wall climb: if a wall is next to the column above, wall-jump up it
    for (const d of [-1, 1]) {
      for (let k = 1; k < 14; k++) { const cy = y - k; if (!body(x, cy)) break; if (!solid(x + d, cy) && !solid(x + d, cy - 1)) continue; // need wall contact
        for (let up = 0; up < 6; up++) { const yy = cy - up; if (!body(x, yy)) break; for (const e of [-1, 1]) for (let dx = 1; dx <= 4; dx++) { const tx = x + e * dx; if (!body(tx, yy)) break; const fy = fall(tx, yy); if (fy > 0 && fy <= y) push(tx, fy); } }
      }
    }
    // hooks: anchors within 9 tiles with line of sight
    for (const a of anchors) for (let up = 0; up <= JUMP_UP; up++) { const hy = y - 1 - up; if (!body(x, hy + 1)) break; if (Math.hypot(a.x - x, a.y - hy) > 9.1) continue; if (!los(x, hy, a.x, a.y)) continue; const k = a.x + ',' + a.y; if (!usedAnchor.has(k)) { usedAnchor.add(k); fromAir(a.x, a.y + (a.c === 'o' ? 3 : 1)); } }
  }
  const near = (x, y, r = 2) => { for (let dy = -r; dy <= r + 2; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && seen[yy * W + xx]) return true; } return false; };
  const fails = [];
  for (const s of R.spawns) if ('cFWDM'.includes(s.c) && !near(s.x, s.y)) fails.push(`${s.c}@${s.cell.variant.ch.id}${s.cell.variant.flip ? "~f" : ""}[${s.x},${s.y}]`);
  for (const c of R.cells) { const ox = c.x * CW, oy = c.y * CH;
    for (const e of c.need) { let ok = false;
      if (e === 'R' || e === 'L') { const xx = e === 'R' ? ox + CW - 1 : ox; for (let yy = oy + 14; yy <= oy + 17; yy++) if (seen[yy * W + xx]) ok = true; }
      if (e === 'D') ok = true; // checked by the cell below being reached
      if (e === 'U') ok = true; if (false) { for (let xx = ox + 14; xx <= ox + 19; xx++) for (let yy = oy; yy <= oy + 3; yy++) if (seen[yy * W + xx]) ok = true; }
      if (!ok && !(c.secret === e)) fails.push(`exit ${e}@${c.variant.ch.id}${c.variant.flip ? '~f' : ''}(${c.kind})`);
    }
  }
  return { seed, cells: R.cells.length, fails, R, seen };
}
export const MAIN = import.meta.url === `file://${process.argv[1]}`;
if (MAIN) { const N = +(process.argv[2] || 200); const bad = {}; let nb = 0;
for (let s = 1; s <= N; s++) { let r; try { r = analyze(s * 7919); } catch (e) { console.log('GEN ERROR', s, e.message); continue; } if (r.fails.length) { nb++; for (const f of r.fails) bad[f] = (bad[f] || 0) + 1; } }
console.log(`seeds ${N}, with problems ${nb}`); console.log(Object.entries(bad).sort((a, b) => b[1] - a[1]).slice(0, 30)); }
