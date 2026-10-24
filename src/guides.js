// v1.5 wayfinding: glowing exit chevrons on the main path, a cool violet wash + treasure sign on side rooms,
// and dotted guide lines that join hook points into readable lines/arcs. Pure decoration (no gameplay effect).
import { TILE } from './util.js';
import { CW, CH } from './level.js';
import { drawGlow, drawIcon } from './art.js';
// x (px) above the open part of a room's floor hole (cols 15-18), so the down arrow sits right over the way down
const holeX = (W, c) => { const ox = c.x * CW, oy = c.y * CH; const xs = [15, 16, 17, 18].filter((x) => !W.map.solid(ox + x, oy + CH - 3) && !W.map.solid(ox + x, oy + CH - 1)); const x = xs.length ? xs[xs.length >> 1] : 17; return (ox + x) * TILE + TILE / 2; };
const AC = '#5ff2e8', MAIN = '#ffe27a';
export function buildGuides(W) {
  const G = { arrows: [], side: [], signs: [], links: [] }; if (W.mode !== 'run' || !W.cells.length) return G;
  const main = W.cells.filter((c) => !c.branch), PX = CW * TILE, PY = CH * TILE;
  for (let i = 0; i < main.length - 1; i++) { const a = main[i], b = main[i + 1]; if (a.pair === b || !a.exitDir) continue;
    const ox = a.x * PX, oy = a.y * PY;
    if (a.exitDir === 'R') G.arrows.push({ x: ox + 30.5 * TILE, y: oy + 13 * TILE, dir: 'R' });
    else if (a.exitDir === 'L') G.arrows.push({ x: ox + 3.5 * TILE, y: oy + 13 * TILE, dir: 'L' });
    else G.arrows.push({ x: holeX(W, a) , y: oy + 15.5 * TILE, dir: 'D' }); }
  for (const c of W.cells) if (c.branch) { G.side.push({ x: c.x * PX, y: c.y * PY });
    const m = main.find((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) === 1 && new Set(c.need || []).has(o.x > c.x ? 'R' : o.x < c.x ? 'L' : o.y > c.y ? 'D' : 'U'));
    if (m) { const dx = c.x - m.x, dy = c.y - m.y, ox = m.x * PX, oy = m.y * PY; G.signs.push(dx ? { x: ox + (dx > 0 ? 30.5 : 3.5) * TILE, y: oy + 13 * TILE, dir: dx > 0 ? 'R' : 'L' } : { x: dy > 0 ? holeX(W, m) : ox + 17 * TILE, y: oy + (dy > 0 ? 15.5 : 3) * TILE, dir: dy > 0 ? 'D' : 'U' }); } }
  // hook guide lines: link each anchor to its nearest neighbour in the same room when it is within one comfy swing (<= 7 tiles)
  const A = W.anchors, seen = new Set();
  for (const a of A) { let best = null, bd = 7.2 * TILE; for (const b of A) { if (b === a) continue; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd && W.cellAt(a.x, a.y) === W.cellAt(b.x, b.y)) { bd = d; best = b; } }
    if (best) { const k = [A.indexOf(a), A.indexOf(best)].sort().join(); if (!seen.has(k)) { seen.add(k); G.links.push([a, best]); } } }
  return G;
}
const inView = (W, x, y, m = 80) => !W.offV || !W.offV(x - m, y - m, 2 * m, 2 * m);
export function drawGuidesBack(g, W) {
  const G = W.guides; if (!G) return; const t = W.t;
  g.save(); g.fillStyle = 'rgba(70,50,140,0.13)'; for (const s of G.side) if (inView(W, s.x + CW * 12, s.y + CH * 12, 500)) g.fillRect(s.x, s.y, CW * TILE, CH * TILE); g.restore();
  g.save(); g.setLineDash([2, 7]); g.lineCap = 'round'; g.lineWidth = 2.5; g.strokeStyle = 'rgba(95,242,232,' + (0.28 + Math.sin(t * 2) * 0.08) + ')'; g.lineDashOffset = -t * 10;
  for (const [a, b] of G.links) { if (!inView(W, a.x, a.y, 200)) continue; const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - Math.abs(a.x - b.x) * 0.12; g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(mx, my, b.x, b.y); g.stroke(); }
  g.restore();
  // dark frame disc behind every anchor so it pops from busy backgrounds
  for (const a of W.anchors) { if (!inView(W, a.x, a.y)) continue; g.fillStyle = 'rgba(12,10,22,0.35)'; g.beginPath(); g.arc(a.x, a.y, 20, 0, 7); g.fill(); g.strokeStyle = 'rgba(95,242,232,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(a.x, a.y, 20, 0, 7); g.stroke(); }
}
function chevron(g, x, y, dir, col, t, a) {
  const ang = { R: 0, L: Math.PI, D: Math.PI / 2, U: -Math.PI / 2 }[dir];
  g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = a; g.lineJoin = 'round'; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const p = (t * 1.6 + i / 3) % 1, ox = -12 + i * 10 + Math.sin(t * 4) * 2; g.globalAlpha = a * (0.35 + 0.65 * (1 - Math.abs(p - 0.5) * 2));
    g.strokeStyle = '#15131f'; g.lineWidth = 7; g.beginPath(); g.moveTo(ox - 4, -8); g.lineTo(ox + 4, 0); g.lineTo(ox - 4, 8); g.stroke(); g.strokeStyle = col; g.lineWidth = 3.5; g.stroke(); }
  g.restore();
}
export function drawGuidesFront(g, W) {
  const G = W.guides; if (!G) return; const t = W.t;
  for (const a of G.arrows) { if (!inView(W, a.x, a.y)) continue; drawGlow(g, a.x, a.y, 34, MAIN, 0.35); chevron(g, a.x, a.y, a.dir, MAIN, t, 0.9); }
  for (const s of G.signs) { if (!inView(W, s.x, s.y)) continue; const bob = Math.sin(t * 2) * 2; g.fillStyle = 'rgba(40,28,80,0.8)'; g.strokeStyle = '#b9a6ff'; g.lineWidth = 2; g.beginPath(); g.roundRect(s.x - 13, s.y - 13 + bob, 26, 26, 6); g.fill(); g.stroke();
    drawIcon(g, s.dir === 'D' ? 'down' : s.dir === 'U' ? 'up' : s.dir === 'L' ? 'left' : 'right', s.x, s.y + bob, 14, '#d8ccff'); drawGlow(g, s.x + 12, s.y - 12 + bob, 10, '#ffe27a', 0.8); drawIcon(g, 'glimmer', s.x + 12, s.y - 12 + bob, 11, '#ffe27a'); }
}
