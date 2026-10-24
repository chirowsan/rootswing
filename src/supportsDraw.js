// v1.7 organic support painter: asymmetric trees whose limbs grow into the branch platforms, root arches, mushroom
// stalks, sagging vine ropes, wall knots. Drawn into the cached tile chunks *behind* the solid tiles, so trunks sink
// into the earth and vines vanish into the canopy. Works with or without painted textures (fallback renderer too).
import { TILE } from './util.js';
import { G, pattern } from './gfx.js';
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export const BARK = {
  overpass: { bark: '#6e4a2a', dk: '#2e1c10', lt: '#c89a5e', rim: 'rgba(255,214,140,0.55)', tint: 'rgba(90,60,30,0.18)', leaf: '#7fcf4e', leaf2: '#3f8a3a', vine: '#2f6a32', stalk: '#efe2c4', ink: 'rgba(18,14,20,0.9)' },
  hub: { bark: '#5a4a34', dk: '#1e2018', lt: '#9ab48a', rim: 'rgba(170,255,220,0.45)', tint: 'rgba(20,70,60,0.28)', leaf: '#5fcf8a', leaf2: '#2f8a6a', vine: '#2a6450', stalk: '#d8ecd8', ink: 'rgba(10,16,16,0.9)' },
  caverns: { bark: '#2c3448', dk: '#0c1020', lt: '#6a8ab8', rim: 'rgba(120,240,255,0.55)', tint: 'rgba(20,40,110,0.42)', leaf: '#46d0c0', leaf2: '#2a7a88', vine: '#24506a', stalk: '#bfe8f0', ink: 'rgba(6,10,20,0.92)' },
  boss: { bark: '#45302c', dk: '#160c14', lt: '#d08a5a', rim: 'rgba(255,150,90,0.6)', tint: 'rgba(80,30,70,0.36)', leaf: '#9a8a48', leaf2: '#5a5a30', vine: '#3c4a2a', stalk: '#f0d0c0', ink: 'rgba(14,8,18,0.92)' },
};
const endY = (e, map) => (e.on === 'edge' ? map.h * TILE + TILE : e.ty * TILE + (e.on === 'plank' ? 2 : 6));
const ceilY = (e) => (e.on === 'edge' ? -TILE : e.on === 'plank' ? e.ty * TILE + 8 : (e.ty + 1) * TILE - 4);
// visual style for a piece (shared with the plank painter in paint.js): tree | arch | mush | vines | shelf | wallbranch | log
export function plankStyle(p) {
  if (p.st) return p.st; const s = p.sup, n = p.x1 - p.x0 + 1, h = hash2(p.x0 * 1.3, p.y * 0.7);
  let st = 'tree';
  if (s.type === 'vines') st = 'vines';
  else if (s.type === 'log') st = 'log';
  else if (s.type === 'wall') st = n <= 3 ? 'shelf' : 'wallbranch';
  else if (s.type === 'trunk') {
    const two = s.ends.length === 2 && s.ends.every((e) => e.on !== 'edge') && Math.abs(s.ends[0].ty - s.ends[1].ty) <= 1;
    if (n <= 3 && !p.crumble) st = h < 0.7 ? 'mush' : 'tree';
    else if (two && n >= 5 && h < 0.22 && s.ends[0].ty - p.y <= 4) st = 'arch';
  }
  if (s.cols && s.cols.length > 1) p.hold = h < 0.5 ? -1 : 1; else if (s.cols) p.hold = s.cols[0] * 2 + 1 < p.x0 + p.x1 + 1 ? -1 : 1;
  if (s.type === 'wall') p.hold = s.ends[0].tx < p.x0 ? -1 : 1;
  return (p.st = st);
}
// bbox in px of everything a piece's support paints (for chunk culling)
export function supportBox(p, map) {
  const s = p.sup, xs = [p.x0 * TILE - 44, (p.x1 + 1) * TILE + 44], ys = [p.y * TILE - 50, (p.y + 1) * TILE + 30];
  for (const e of s.ends) { xs.push(e.tx * TILE - 34, (e.tx + 1) * TILE + 34); ys.push(Math.min(endY(e, map), ceilY(e)) - 20, Math.max(endY(e, map), ceilY(e)) + 30); }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function barkFill(g, C, x0, x1, lit = 1) {
  // painted bark texture (if loaded) + biome tint + cylinder shading with a warm rim on the lit (right) side
  const pb = pattern(g, 'tex_bark', 0.09); g.fillStyle = pb || C.bark; g.fill();
  g.fillStyle = C.tint; g.fill();
  const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(8,6,14,0.62)'); gr.addColorStop(0.45, 'rgba(8,6,14,0.12)'); gr.addColorStop(0.82, 'rgba(8,6,14,0.05)'); gr.addColorStop(1, 'rgba(8,6,14,0.35)');
  g.fillStyle = gr; g.fill();
  if (lit) { g.save(); g.clip(); g.fillStyle = C.rim; g.fillRect(x1 - (x1 - x0) * 0.16, -1e4, (x1 - x0) * 0.1, 2e4); g.restore(); }
}
// tapered, leaning, slightly S-curved trunk from ground y1 up to y0 (top centre xt, base centre xb)
function trunk(g, C, xb, y1, xt, y0, wb, wt, seed, roots = true) {
  const h = y1 - y0; if (h < 2) return; const wob = (seed < 0.5 ? -1 : 1) * Math.min(14, 4 + h * 0.1);
  const L = [[xb - wb / 2, y1], [xb - wb * 0.42 + wob, y1 - h * 0.35], [xt - wt / 2 - wob * 0.5, y0 + h * 0.3], [xt - wt / 2, y0]];
  const R = [[xt + wt / 2, y0], [xt + wt / 2 - wob * 0.5, y0 + h * 0.3], [xb + wb * 0.42 + wob, y1 - h * 0.35], [xb + wb / 2, y1]];
  const path = () => { g.beginPath(); g.moveTo(...L[0]); g.bezierCurveTo(...L[1], ...L[2], ...L[3]); g.lineTo(...R[0]); g.bezierCurveTo(...R[1], ...R[2], ...R[3]); g.closePath(); };
  g.lineJoin = 'round'; g.lineCap = 'round';
  path(); g.strokeStyle = C.ink; g.lineWidth = 3; g.stroke(); barkFill(g, C, Math.min(xb, xt) - wb / 2, Math.max(xb, xt) + wb / 2);
  // knots + moss patches
  for (let i = 0; i < Math.floor(h / 60); i++) { const u = 0.2 + hash2(seed * 9, i) * 0.6, ky = y1 - h * u, kx = xb + (xt - xb) * u + (hash2(i, seed) - 0.5) * wt * 0.4; g.fillStyle = C.dk; g.beginPath(); g.ellipse(kx, ky, 2, 3.2, 0, 0, 7); g.fill(); g.strokeStyle = C.lt; g.lineWidth = 0.8; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1; }
  g.fillStyle = C.vine; g.globalAlpha = 0.45;
  for (let i = 0; i < 2 + Math.floor(h / 80); i++) { const u = hash2(seed * 3, i + 7) * 0.8, my = y1 - h * u, mx = xb + (xt - xb) * u - wb * 0.18; g.beginPath(); g.ellipse(mx, my, 3 + wt * 0.15, 6 + hash2(i, seed) * 8, 0.1, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if (roots && h > 10) for (const [d, k] of [[-1, 1], [1, 0.8], [-1, 0.55], [1, 0.5]]) { // splayed buttress roots
    const rl = wb * (0.55 + k * 0.5 + seed * 0.3), x0 = xb + d * wb * 0.25 * k, x1 = xb + d * (wb * 0.5 + rl);
    g.beginPath(); g.moveTo(x0 - d * 4, y1 - 14 * k); g.quadraticCurveTo(x0 + d * rl * 0.5, y1 - 6 * k, x1, y1 + 3); g.lineTo(x1 - d * 3, y1 + 4); g.quadraticCurveTo(x0 + d * rl * 0.2, y1 + 2, x0 - d * 2, y1 + 2); g.closePath();
    g.strokeStyle = C.ink; g.lineWidth = 2.4; g.stroke(); barkFill(g, C, Math.min(x0, x1), Math.max(x0, x1), 0);
  }
}
// tapered limb (curved) from (x0,y0) thickness w0 to (x1,y1) thickness w1, control point (cx,cy)
function limb(g, C, x0, y0, x1, y1, cx, cy, w0, w1) {
  const n = 10, Lp = [], Rp = [];
  for (let i = 0; i <= n; i++) { const u = i / n, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u, px = a * x0 + b * cx + c * x1, py = a * y0 + b * cy + c * y1;
    const dx = 2 * (1 - u) * (cx - x0) + 2 * u * (x1 - cx), dy = 2 * (1 - u) * (cy - y0) + 2 * u * (y1 - cy), l = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * u) / 2;
    Lp.push([px - dy / l * w, py + dx / l * w]); Rp.push([px + dy / l * w, py - dx / l * w]); }
  g.beginPath(); Lp.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); for (let i = Rp.length - 1; i >= 0; i--) g.lineTo(...Rp[i]); g.closePath();
  g.strokeStyle = C.ink; g.lineWidth = 2.6; g.lineJoin = 'round'; g.stroke(); barkFill(g, C, Math.min(x0, x1, cx) - w0, Math.max(x0, x1, cx) + w0, 0);
  // limbs are mostly sideways: shade top-lit / underside-dark so they read as round wood, not flat planks
  const yt = Math.min(y0, y1, cy) - w0 / 2, yb = Math.max(y0, y1, cy) + w0 / 2, gv = g.createLinearGradient(0, yt, 0, yb);
  gv.addColorStop(0, C.rim.replace(/[\d.]+\)$/, '0.35)')); gv.addColorStop(0.3, 'rgba(8,6,14,0.1)'); gv.addColorStop(1, 'rgba(8,6,14,0.62)'); g.fillStyle = gv; g.fill();
}
function leafTuft(g, C, x, y, r, seed) {
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (hash2(seed, i) - 0.5) * 2.6, d = r * (0.3 + hash2(i, seed) * 0.7); g.fillStyle = i % 3 ? C.leaf2 : C.leaf; g.strokeStyle = C.ink; g.lineWidth = 0.8;
    g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * 0.42, r * 0.22, a, 0, 7); g.fill(); g.stroke(); }
}
function vine(g, C, x0, y0, x1, y1, seed, thick = 2.6, leaves = true) {
  // hanging vine from (x0,y0) (canopy/ceiling) down to (x1,y1): twisted double strand, leaf pairs
  const mx = (x0 + x1) / 2 + (seed - 0.5) * 14, my = (y0 + y1) / 2;
  g.lineCap = 'round'; g.strokeStyle = C.ink; g.lineWidth = thick + 2.4; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
  g.strokeStyle = C.vine; g.lineWidth = thick; g.stroke();
  g.strokeStyle = C.leaf2; g.lineWidth = 1; g.beginPath(); const len = Math.hypot(x1 - x0, y1 - y0), tw = Math.max(2, Math.floor(len / 9));
  for (let i = 0; i <= tw; i++) { const u = i / tw, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u, px = a * x0 + b * mx + c * x1 + Math.sin(i * 1.7) * thick * 0.4, py = a * y0 + b * my + c * y1; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
  g.fillStyle = C.vine; g.beginPath(); g.ellipse(x0, y0 + 1, 5, 3, 0, 0, 7); g.fill();
  if (!leaves) return; const n = Math.max(1, Math.floor(len / 18));
  for (let i = 1; i <= n; i++) { const u = i / (n + 1), a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u, px = a * x0 + b * mx + c * x1, py = a * y0 + b * my + c * y1, s = (i + Math.floor(seed * 7)) % 2 ? 1 : -1;
    g.fillStyle = (i % 3) ? C.leaf : C.leaf2; g.strokeStyle = C.ink; g.lineWidth = 0.9; g.beginPath(); g.ellipse(px + s * 4.5, py, 4.6, 2.1, s * 0.6, 0, 7); g.fill(); g.stroke(); }
}
function knot(g, C, X, Y, side) {
  // gnarled bark knot where a branch / shelf grows out of a cliff wall
  const x = X + side * 3; g.beginPath(); g.ellipse(x, Y + 5, 8, 11, 0, 0, 7); g.strokeStyle = C.ink; g.lineWidth = 2.4; g.stroke(); barkFill(g, C, x - 8, x + 8);
  g.strokeStyle = C.dk; g.lineWidth = 1; g.beginPath(); g.ellipse(x, Y + 5, 4, 6, 0, 0, 7); g.stroke();
  g.fillStyle = C.leaf2; g.beginPath(); g.ellipse(x - side * 2, Y - 2, 7, 2.4, 0, 0, 7); g.fill();
}
export function drawSupport(g, p, map, biomeKey) {
  const C = BARK[biomeKey] || BARK.overpass, s = p.sup, seed = hash2(p.x0, p.y);
  if (p.kind === 'plank') {
    const st = plankStyle(p), topY = p.y * TILE + 9, L = p.x0 * TILE, R = (p.x1 + 1) * TILE;
    if (st === 'tree' || st === 'arch' || st === 'mush') {
      const cols = s.cols, ends = s.ends;
      if (st === 'mush') { // pale mushroom stalk(s) under a painted cap
        ends.forEach((e, i) => { const c = cols[i], xb = c * TILE + 12, xt = cols.length > 1 ? xb + (i ? -6 : 6) : (L + R) / 2 + (seed - 0.5) * 6;
          const y1 = endY(e, map); g.beginPath(); g.moveTo(xb - 7, y1); g.bezierCurveTo(xb - 6, y1 - (y1 - topY) * 0.5, xt - 4 + (seed - 0.5) * 8, topY + 20, xt - 4, topY); g.lineTo(xt + 4, topY); g.bezierCurveTo(xt + 4 + (seed - 0.5) * 8, topY + 20, xb + 6, y1 - (y1 - topY) * 0.5, xb + 7, y1); g.closePath();
          g.strokeStyle = C.ink; g.lineWidth = 2.6; g.stroke(); const gr = g.createLinearGradient(xb - 8, 0, xb + 8, 0); gr.addColorStop(0, 'rgba(60,50,60,1)'); gr.addColorStop(0.35, C.stalk); gr.addColorStop(0.8, C.stalk); gr.addColorStop(1, 'rgba(90,80,90,1)'); g.fillStyle = gr; g.fill();
          g.fillStyle = 'rgba(10,8,20,0.35)'; g.fill(); g.fillStyle = C.leaf2; g.beginPath(); g.ellipse(xb, y1 - 2, 11, 3.5, 0, 0, 7); g.fill(); });
        return;
      }
      if (st === 'arch') { // one great root arch: both feet in the ground, crown under the platform
        const e0 = ends[0], e1 = ends[1], xa = cols[0] * TILE + 6, xc = cols[1] * TILE + 18, ya = endY(e0, map), yc = endY(e1, map), mid = (xa + xc) / 2;
        limb(g, C, xa - 6, ya + 2, mid, topY + 2, xa + 4, topY - 8, 20, 12); limb(g, C, xc + 6, yc + 2, mid, topY + 2, xc - 4, topY - 4, 18, 12);
        trunk(g, C, xa - 6, ya, xa - 4, ya - 8, 22, 18, seed, true); trunk(g, C, xc + 6, yc, xc + 4, yc - 8, 20, 16, 1 - seed, true);
        // a thinner secondary root looping under
        limb(g, C, xa + 10, ya + 2, mid + 10, topY + 10, mid - 10, ya - (ya - topY) * 0.2, 7, 4);
        return;
      }
      // tree: ONE real trunk (thick, grows past the platform into a leafy crown) - the platform is its branch; a curved
      // brace limb reaches toward the far end; a short angled root strut only when the far end is low enough to look natural
      const main = p.hold === 1 ? cols.length - 1 : 0, e = ends[main], c = cols[main], xb = c * TILE + 12, y1 = endY(e, map), H = y1 - topY;
      const wb = Math.max(22, Math.min(38, 18 + H * 0.09)) * (p.crumble ? 0.85 : 1), lean = (hash2(c, 3) - 0.5) * Math.min(26, H * 0.18), xt = xb + lean, crown = 16 + seed * 8;
      trunk(g, C, xb, y1, xt, topY - crown, wb, wb * 0.46, seed, true);
      leafTuft(g, C, xt + (seed - 0.5) * 6, topY - crown - 2, 11 + seed * 4, seed * 9);
      for (const far of [L + 8, R - 8]) { const d = far - xt; if (Math.abs(d) < 40) continue; const drop = Math.max(26, Math.min(H * 0.6, Math.abs(d) * 0.75, 64));
        limb(g, C, xt, topY + drop, xt + d * 0.55, topY + 10, xt + d * 0.1, topY + drop * 0.4, wb * 0.42, 3); // a side branch rising to cradle the far end
        leafTuft(g, C, xt + d * 0.55, topY + 13, 7, seed * 5 + d); }
      if (cols.length > 1) { const c2 = cols[1 - main], y2 = endY(ends[1 - main], map); // just a little root flare + hanging roots at the far end
        g.lineCap = 'round'; for (let k = 0; k < 4; k++) { const x = c2 * TILE + 3 + k * 6, l = 5 + hash2(c2, k) * Math.min(10, Math.max(3, y2 - topY - 30)), sw = (hash2(k, c2) - 0.5) * 6;
          g.strokeStyle = C.ink; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, topY + 8); g.quadraticCurveTo(x + sw, topY + 8 + l * 0.6, x + sw * 0.4, topY + 8 + l); g.stroke();
          g.strokeStyle = C.dk; g.lineWidth = 1; g.stroke(); } }
    } else if (st === 'vines') s.ends.forEach((e, i) => { const x = i ? R - 5 : L + 5; vine(g, C, x + (i ? 4 : -4), ceilY(e), x, p.y * TILE + 3, hash2(x, p.y), 3.2, true); });
    else if (st === 'shelf' || st === 'wallbranch' || st === 'log') for (const e of s.ends) { const side = e.tx < p.x0 ? -1 : 1; knot(g, C, side < 0 ? L : R, p.y * TILE - 1, side); }
  } else if ((p.kind === 'trap' && p.sub === 'saw') || p.kind === 'island') {
    const isl = p.kind === 'island', topY = isl ? (p.y + 1) * TILE - 4 : p.y * TILE + 14;
    if (s.type === 'trunk') s.ends.forEach((e, i) => { const c = s.cols[i], x = c * TILE + 12, sd = hash2(c, p.y), lean = (sd - 0.5) * 10; const H = endY(e, map) - topY, w = Math.max(isl ? 22 : 16, Math.min(34, 14 + H * 0.07)); trunk(g, C, x - lean, endY(e, map), x, topY, w, w * 0.62, sd, true); });
    else if (s.type === 'vines') s.ends.forEach((e, i) => { const x = i ? (p.x1 + 1) * TILE - 5 : p.x0 * TILE + 5; vine(g, C, x + (i ? 3 : -3), ceilY(e), x, p.y * TILE + 2, hash2(x, p.y), 3, true); });
  } else if (p.kind === 'anchor') {
    const e = s.ends[0];
    if (s.type === 'vine') vine(g, C, p.ax + (seed - 0.5) * 6, ceilY(e), p.ax, p.ay - 13, seed, 3, true);
    else { const wx = s.side < 0 ? (e.tx + 1) * TILE - 2 : e.tx * TILE + 2; limb(g, C, wx, p.ay - 2, p.ax, p.ay - 13, (wx + p.ax) / 2, p.ay - 2, 9, 4); knot(g, C, wx, p.ay - 8, -s.side); }
  } else if (p.kind === 'trap' && p.sub === 'crusher') {
    const e = s.ends[0], x = p.x0 * TILE + 12; vine(g, C, x - 6, ceilY(e), x - 6, p.y * TILE, seed, 2.6, false); vine(g, C, x + 6, ceilY(e), x + 6, p.y * TILE, 1 - seed, 2.6, false);
  } else if (p.kind === 'trap' && s.type === 'trunk') { const e = s.ends[0], x = p.x0 * TILE + 12; trunk(g, C, x, endY(e, map), x, (p.y + 1) * TILE - 2, 18, 22, seed, true); }
  void G;
}
