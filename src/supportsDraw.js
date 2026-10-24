// v1.6 painter for support chains (trunks, root struts, vines, wall collars, crusher ropes). Drawn into the cached
// tile chunks *behind* the solid tiles, so trunks sink into the earth and vines vanish into the canopy.
import { TILE } from './util.js';
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export const BARK = {
  overpass: { bark: '#6e4a2a', dk: '#3c2515', lt: '#a8794a', leaf: '#6cbf4e', leaf2: '#3f8a3a', vine: '#2f6a32', ink: 'rgba(21,19,31,0.85)' },
  hub: { bark: '#6e4a2a', dk: '#3c2515', lt: '#b08452', leaf: '#7ccf58', leaf2: '#4a9a40', vine: '#336e36', ink: 'rgba(21,19,31,0.85)' },
  caverns: { bark: '#4c3c2c', dk: '#211812', lt: '#76604a', leaf: '#46d0b0', leaf2: '#2a8a78', vine: '#24584e', ink: 'rgba(10,14,20,0.9)' },
  boss: { bark: '#45302c', dk: '#1e1216', lt: '#7a5446', leaf: '#8a9a48', leaf2: '#5a6a30', vine: '#3c4a2a', ink: 'rgba(16,10,20,0.9)' },
};
const endY = (e, map) => (e.on === 'edge' ? map.h * TILE + TILE : e.ty * TILE + (e.on === 'plank' ? 2 : 4));
const ceilY = (e) => (e.on === 'edge' ? -TILE : e.on === 'plank' ? e.ty * TILE + 8 : (e.ty + 1) * TILE - 4);
// bbox in px of everything a piece's support paints (for chunk culling)
export function supportBox(p, map) {
  const s = p.sup, xs = [p.x0 * TILE - 30, (p.x1 + 1) * TILE + 30], ys = [p.y * TILE - 30, (p.y + 1) * TILE + 30];
  for (const e of s.ends) { xs.push(e.tx * TILE - 20, (e.tx + 1) * TILE + 20); ys.push(Math.min(endY(e, map), ceilY(e)) - 20, Math.max(endY(e, map), ceilY(e)) + 30); }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function trunk(g, C, x, y0, y1, w, seed, fork, flare = true) {
  // tapered trunk from ground (y1) up to y0, root flare at the base, Y-fork that cradles the branch/plank on top
  const h = y1 - y0; if (h < 2) return; const wb = w + Math.min(6, h * 0.08), lean = (seed - 0.5) * Math.min(6, h * 0.05);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const body = () => { g.beginPath(); g.moveTo(x - wb / 2, y1); g.bezierCurveTo(x - wb / 2, y1 - h * 0.4, x - w / 2 + lean, y0 + h * 0.3, x - w / 2 + lean, y0); g.lineTo(x + w / 2 + lean, y0); g.bezierCurveTo(x + w / 2 + lean, y0 + h * 0.3, x + wb / 2, y1 - h * 0.4, x + wb / 2, y1); g.closePath(); };
  body(); g.fillStyle = C.ink; g.save(); g.translate(0, 0); g.lineWidth = 3.2; g.strokeStyle = C.ink; g.stroke(); g.restore();
  const gr = g.createLinearGradient(x - wb / 2, 0, x + wb / 2, 0); gr.addColorStop(0, C.dk); gr.addColorStop(0.35, C.bark); gr.addColorStop(0.7, C.lt); gr.addColorStop(1, C.dk); g.fillStyle = gr; body(); g.fill();
  g.strokeStyle = C.dk; g.lineWidth = 1; g.globalAlpha = 0.7; // bark grooves
  for (let i = 0; i < 3; i++) { const u = (i - 1) * w * 0.22; g.beginPath(); g.moveTo(x + u + lean * 0.8, y0 + 4); g.bezierCurveTo(x + u + 1.5, y0 + h * 0.4, x + u - 1.5, y0 + h * 0.6, x + u * 1.2, y1 - 2); g.stroke(); }
  g.globalAlpha = 1;
  if (h > 40) for (let i = 0; i < Math.floor(h / 70); i++) { const ky = y0 + 24 + hash2(seed * 9, i) * (h - 40); g.fillStyle = C.dk; g.beginPath(); g.ellipse(x + (hash2(i, seed) - 0.5) * w * 0.4, ky, 2.2, 3.4, 0, 0, 7); g.fill(); } // knots
  if (flare && h > 10) for (const d of [-1, 1]) { g.strokeStyle = C.ink; g.lineWidth = 5; g.beginPath(); g.moveTo(x + d * wb * 0.3, y1 - 8); g.quadraticCurveTo(x + d * (wb * 0.5 + 6), y1 - 4, x + d * (wb * 0.5 + 11), y1 + 1); g.stroke(); g.strokeStyle = C.bark; g.lineWidth = 3; g.stroke(); }
  if (fork) for (const d of [-1, 1]) { g.strokeStyle = C.ink; g.lineWidth = 5.5; g.beginPath(); g.moveTo(x + lean, y0 + 10); g.quadraticCurveTo(x + d * 5 + lean, y0 + 3, x + d * fork + lean, y0); g.stroke(); g.strokeStyle = C.bark; g.lineWidth = 3.4; g.stroke(); }
  // moss cap on top of the fork
  g.fillStyle = C.leaf2; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(x + lean, y0 + 3, w * 0.6, 2.4, 0, 0, 7); g.fill(); g.globalAlpha = 1;
}
function vine(g, C, x0, y0, x1, y1, seed, thick = 2.6, leaves = true) {
  // hanging vine from (x0,y0) (canopy/ceiling) down to (x1,y1), gentle S-curve, leaf pairs
  const mx = (x0 + x1) / 2 + (seed - 0.5) * 10, my = (y0 + y1) / 2;
  g.lineCap = 'round'; g.strokeStyle = C.ink; g.lineWidth = thick + 2.2; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
  g.strokeStyle = C.vine; g.lineWidth = thick; g.stroke(); g.strokeStyle = C.leaf2; g.lineWidth = 1; g.stroke();
  // root knot where it grows out of the ceiling
  g.fillStyle = C.vine; g.beginPath(); g.ellipse(x0, y0 + 1, 5, 3, 0, 0, 7); g.fill();
  if (!leaves) return; const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(len / 22));
  for (let i = 1; i <= n; i++) { const u = i / (n + 1), a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u, px = a * x0 + b * mx + c * x1, py = a * y0 + b * my + c * y1, s = (i + Math.floor(seed * 7)) % 2 ? 1 : -1;
    g.fillStyle = (i % 3) ? C.leaf : C.leaf2; g.strokeStyle = C.ink; g.lineWidth = 1; g.beginPath(); g.ellipse(px + s * 4, py, 4.2, 2, s * 0.6, 0, 7); g.fill(); g.stroke(); }
}
function collar(g, C, X, Y, side) {
  // knotted bark collar where a branch plank grows out of a trunk/cliff wall
  const x = side < 0 ? X - 2 : X + 2; g.fillStyle = C.ink; g.beginPath(); g.ellipse(x, Y + 5, 7, 9, 0, 0, 7); g.fill();
  g.fillStyle = C.bark; g.beginPath(); g.ellipse(x, Y + 5, 5.5, 7.5, 0, 0, 7); g.fill(); g.fillStyle = C.lt; g.fillRect(x - 3, Y, 2, 9);
  g.strokeStyle = C.leaf2; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 5, Y + 11); g.quadraticCurveTo(x, Y + 15, x + 5, Y + 11); g.stroke();
}
export function drawSupport(g, p, map, biomeKey) {
  const C = BARK[biomeKey] || BARK.overpass, s = p.sup, seed = hash2(p.x0, p.y);
  if (p.kind === 'plank' || (p.kind === 'trap' && p.sub === 'saw') || p.kind === 'island') {
    const topY = p.kind === 'island' ? (p.y + 1) * TILE - 6 : p.kind === 'trap' ? p.y * TILE + 14 : p.y * TILE + 8;
    if (s.type === 'trunk') s.ends.forEach((e, i) => { const c = s.cols[i], x = c * TILE + 12, w = p.kind === 'island' ? 14 : 10; trunk(g, C, x, topY, endY(e, map), w, hash2(c, p.y), p.kind === 'island' ? 0 : 12); });
    else if (s.type === 'vines') s.ends.forEach((e, i) => { const x = i ? (p.x1 + 1) * TILE - 5 : p.x0 * TILE + 5; vine(g, C, x + (i ? 3 : -3), ceilY(e), x, p.y * TILE + 2, hash2(x, p.y), 3, true); });
    else if (s.type === 'wall' || s.type === 'log') for (const e of s.ends) { const side = e.tx < p.x0 ? -1 : 1; collar(g, C, side < 0 ? p.x0 * TILE : (p.x1 + 1) * TILE, p.y * TILE - 1, side); }
  } else if (p.kind === 'anchor') {
    const e = s.ends[0];
    if (s.type === 'vine') vine(g, C, p.ax + (seed - 0.5) * 6, ceilY(e), p.ax, p.ay - 13, seed, 3, true);
    else { const wx = s.side < 0 ? (e.tx + 1) * TILE - 2 : e.tx * TILE + 2; trunkBranch(g, C, wx, p.ay - 4, p.ax, p.ay - 13); }
  } else if (p.kind === 'trap' && p.sub === 'crusher') {
    const e = s.ends[0], x = p.x0 * TILE + 12; vine(g, C, x - 6, ceilY(e), x - 6, p.y * TILE, seed, 2.4, false); vine(g, C, x + 6, ceilY(e), x + 6, p.y * TILE, 1 - seed, 2.4, false);
  } else if (p.kind === 'trap' && s.type === 'trunk') { const e = s.ends[0]; trunk(g, C, p.x0 * TILE + 12, (p.y + 1) * TILE, endY(e, map), 10, seed, 0); }
}
function trunkBranch(g, C, x0, y0, x1, y1) {
  g.lineCap = 'round'; g.strokeStyle = C.ink; g.lineWidth = 8; g.beginPath(); g.moveTo(x0, y0 + 6); g.quadraticCurveTo((x0 + x1) / 2, y0 + 10, x1, y1); g.stroke();
  g.strokeStyle = C.bark; g.lineWidth = 5; g.stroke(); g.strokeStyle = C.lt; g.lineWidth = 1.2; g.stroke();
}
