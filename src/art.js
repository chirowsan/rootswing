// Procedural art: palette, glow sprites, icons, tile chunk renderer, parallax backgrounds.
import { TILE, hash2, makeRng } from './util.js';
export const PAL = {
  ink: '#15131f', stone: '#2c2a3a', stone2: '#37344a', stoneHi: '#4a4560', moss: '#5fb556', mossHi: '#9ee06f', mossDk: '#2f7a3f',
  plank: '#9a6a42', plankDk: '#5c3a24', hazard: '#ff3d6e', hazardDk: '#8a1240', hazardGlow: '#ff5a7a',
  swing: '#ffd25a', zip: '#5ff2e6', glimmer: '#eaff8a', hero: '#5fcf6a', heroDk: '#2e8a4a', skin: '#ffe6c7', scarf: '#ff9a3c',
  enemy: '#2a1f3d', enemyHi: '#4b3a6b', eye: '#ffb13b', spark: '#ffd36b', inkPop: '#7d5cff', ui: '#fff4dc',
};
const glowCache = new Map();
// normalise #rgb / #rgba / #rrggbbaa to #rrggbb so alpha suffixes are valid
export function hex6(c) { if (c[0] !== '#') return c; if (c.length === 4 || c.length === 5) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return c.slice(0, 7); }
export function glowSprite(color, size = 64) {
  const k = color + size; if (glowCache.has(k)) return glowCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const c6 = hex6(color); gr.addColorStop(0, c6); gr.addColorStop(0.35, c6 + '88'); gr.addColorStop(1, c6 + '00');
  g.fillStyle = gr; g.fillRect(0, 0, size, size); glowCache.set(k, c); return c;
}
export function drawGlow(g, x, y, r, color, alpha = 1) {
  const s = glowSprite(color); const old = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha;
  g.drawImage(s, x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; g.globalCompositeOperation = old;
}
// ---------- icons (used by touch buttons, HUD, tutorial, menus) ----------
export function drawIcon(g, name, x, y, size, color = '#fff') {
  const s = size / 24; g.save(); g.translate(x, y); g.scale(s, s); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 3;
  const P = (pts, close, fill) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); if (close) g.closePath(); fill ? g.fill() : g.stroke(); };
  switch (name) {
    case 'jump': P([-9, 4, 0, -6, 9, 4]); P([-9, 11, 0, 1, 9, 11]); break;
    case 'attack': case 'blade': g.rotate(-0.7); P([0, -13, 3, -9, 3, 6, -3, 6, -3, -9], true, true); P([-7, 6, 7, 6]); P([0, 6, 0, 12]); break;
    case 'spear': g.rotate(-0.7); P([0, 13, 0, -6]); P([0, -14, 4, -6, 0, -4, -4, -6], true, true); P([-3, 4, 3, 4]); break;
    case 'sickle': g.beginPath(); g.arc(2, -2, 10, -2.6, 0.6); g.stroke(); P([-4, 6, -9, 12]); break;
    case 'hammer': g.rotate(-0.5); P([0, -4, 0, 13]); g.fillRect(-9, -12, 18, 9); break;
    case 'bow': g.beginPath(); g.arc(-4, 0, 12, -1.2, 1.2); g.stroke(); g.lineWidth = 1.5; P([0, -11, 0, 11]); g.lineWidth = 2.5; P([-8, 0, 12, 0]); P([8, -4, 12, 0, 8, 4]); break;
    case 'whip': g.beginPath(); g.moveTo(-10, 10); g.bezierCurveTo(-2, -6, 8, 14, 11, -10); g.stroke(); g.beginPath(); g.arc(11, -10, 2.5, 0, 7); g.fill(); break;
    case 'dash': P([-11, -8, -3, 0, -11, 8]); P([-1, -8, 7, 0, -1, 8]); P([9, -8, 9, 8]); break;
    case 'hook': g.beginPath(); g.arc(1, 3, 7, 0.2, Math.PI * 1.05); g.stroke(); P([1, -12, 1, 3]); P([-6, 5, -9, 1]); g.beginPath(); g.arc(1, -12, 2.5, 0, 7); g.fill(); break;
    case 'parry': P([0, -12, 10, -8, 9, 3, 0, 12, -9, 3, -10, -8], true); g.lineWidth = 2; P([0, -6, 0, 6]); P([-5, 0, 5, 0]); break;
    case 'flask': P([-3, -12, 3, -12, 3, -5, 9, 3, 7, 11, -7, 11, -9, 3, -3, -5], true); g.globalAlpha *= 0.6; P([-7, 3, 7, 3, 6, 9, -6, 9], true, true); break;
    case 'pause': g.fillRect(-7, -9, 5, 18); g.fillRect(2, -9, 5, 18); break;
    case 'left': P([5, -10, -6, 0, 5, 10], true, true); break;
    case 'right': P([-5, -10, 6, 0, -5, 10], true, true); break;
    case 'down': P([-10, -5, 0, 6, 10, -5], true, true); break;
    case 'popseed': g.beginPath(); g.arc(0, 3, 8, 0, 7); g.fill(); g.lineWidth = 2; P([0, -5, 3, -11]); g.fillStyle = '#ffb13b'; g.beginPath(); g.arc(4, -12, 3, 0, 7); g.fill(); break;
    case 'sentry': P([-9, 11, 0, -1, 9, 11]); g.beginPath(); g.arc(0, -4, 6, 0, 7); g.fill(); P([0, -4, 11, -8]); break;
    case 'glimmer': P([0, -10, 3, -3, 10, 0, 3, 3, 0, 10, -3, 3, -10, 0, -3, -3], true, true); break;
    case 'heart': g.beginPath(); g.moveTo(0, 10); g.bezierCurveTo(-14, 0, -8, -12, 0, -4); g.bezierCurveTo(8, -12, 14, 0, 0, 10); g.fill(); break;
    case 'up': P([-10, 5, 0, -6, 10, 5], true, true); break;
    case 'door': g.beginPath(); g.moveTo(-8, 12); g.lineTo(-8, -4); g.arc(0, -4, 8, Math.PI, 0); g.lineTo(8, 12); g.stroke(); break;
    case 'gear': g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 7 : 11; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.stroke(); g.beginPath(); g.arc(0, 0, 3, 0, 7); g.stroke(); break;
    default: g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke();
  }
  g.restore();
}
// ---------- tile chunk renderer ----------
export const CHUNK_T = 16;
export function isSolidCh(c) { return c === '#' || c === 'B'; }
export function renderTileChunk(map, cx, cy, rs, biome) {
  const W = CHUNK_T * TILE, c = document.createElement('canvas');
  c.width = Math.ceil(W * rs); c.height = Math.ceil(W * rs); const g = c.getContext('2d');
  g.scale(rs, rs); g.translate(-cx * W, -cy * W);
  const x0 = cx * CHUNK_T, y0 = cy * CHUNK_T;
  const at = (x, y) => (map.get(x, y));
  const S = (x, y) => isSolidCh(at(x, y));
  // pass 1: solid fills with rounded exposed corners
  for (let ty = y0 - 1; ty < y0 + CHUNK_T + 1; ty++) for (let tx = x0 - 1; tx < x0 + CHUNK_T + 1; tx++) {
    const ch = at(tx, ty); if (!isSolidCh(ch)) continue;
    const X = tx * TILE, Y = ty * TILE, up = !S(tx, ty - 1), dn = !S(tx, ty + 1), lf = !S(tx - 1, ty), rt = !S(tx + 1, ty);
    const r = 7, tl = up && lf ? r : 0, tr = up && rt ? r : 0, br = dn && rt ? r : 0, bl = dn && lf ? r : 0;
    const path = () => { g.beginPath(); g.moveTo(X + tl, Y); g.lineTo(X + TILE - tr, Y); g.quadraticCurveTo(X + TILE, Y, X + TILE, Y + tr); g.lineTo(X + TILE, Y + TILE - br); g.quadraticCurveTo(X + TILE, Y + TILE, X + TILE - br, Y + TILE); g.lineTo(X + bl, Y + TILE); g.quadraticCurveTo(X, Y + TILE, X, Y + TILE - bl); g.lineTo(X, Y + tl); g.quadraticCurveTo(X, Y, X + tl, Y); g.closePath(); };
    // outline first (expanded), then fill
    g.fillStyle = PAL.ink; path(); g.lineWidth = 5; g.strokeStyle = PAL.ink; if (up || dn || lf || rt) g.stroke(); g.fill();
  }
  for (let ty = y0 - 1; ty < y0 + CHUNK_T + 1; ty++) for (let tx = x0 - 1; tx < x0 + CHUNK_T + 1; tx++) {
    const ch = at(tx, ty); if (!isSolidCh(ch)) continue;
    const X = tx * TILE, Y = ty * TILE, up = !S(tx, ty - 1), dn = !S(tx, ty + 1), lf = !S(tx - 1, ty), rt = !S(tx + 1, ty), h = hash2(tx, ty);
    const depth = up ? 0 : !S(tx, ty - 2) ? 1 : 2;
    const ins = 1.5; g.fillStyle = ch === 'B' ? '#5a5268' : depth === 0 ? biome.stoneHi : depth === 1 ? biome.stone2 : biome.stone;
    g.fillRect(X + (lf ? ins : 0), Y + (up ? ins : 0), TILE - (lf ? ins : 0) - (rt ? ins : 0), TILE - (up ? ins : 0) - (dn ? ins : 0));
    // brick / crack texture
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1.2;
    if (h < 0.35) { g.beginPath(); g.moveTo(X + 3, Y + 8 + h * 10); g.lineTo(X + TILE - 3, Y + 8 + h * 10); g.stroke(); }
    else if (h < 0.5) { g.beginPath(); g.moveTo(X + 6, Y + 5); g.lineTo(X + 10, Y + 12); g.lineTo(X + 8, Y + 18); g.stroke(); }
    if (h > 0.9 && !up) { g.fillStyle = 'rgba(255,170,90,0.18)'; g.beginPath(); g.arc(X + 12, Y + 12, 3, 0, 7); g.fill(); }
    if (ch === 'B') { g.strokeStyle = 'rgba(255,240,200,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(X + 4, Y + 3); g.lineTo(X + 11, Y + 11); g.lineTo(X + 7, Y + 17); g.moveTo(X + 11, Y + 11); g.lineTo(X + 20, Y + 9); g.moveTo(X + 13, Y + 14); g.lineTo(X + 17, Y + 21); g.stroke(); }
    if (dn && h > 0.55) { // hanging roots
      g.strokeStyle = biome.mossDk; g.lineWidth = 1.6; g.beginPath(); const rx = X + 4 + h * 14; g.moveTo(rx, Y + TILE); g.quadraticCurveTo(rx + 3, Y + TILE + 6, rx - 1, Y + TILE + 6 + h * 10); g.stroke();
    }
  }
  // moss caps on top surfaces
  for (let ty = y0 - 1; ty < y0 + CHUNK_T + 1; ty++) for (let tx = x0 - 1; tx < x0 + CHUNK_T + 1; tx++) {
    if (!isSolidCh(at(tx, ty)) || S(tx, ty - 1) || at(tx, ty - 1) === '^') continue;
    const X = tx * TILE, Y = ty * TILE, h = hash2(tx * 3, ty * 7), lf = !S(tx - 1, ty), rt = !S(tx + 1, ty);
    g.fillStyle = biome.mossDk; g.beginPath(); g.moveTo(X + (lf ? 2 : -1), Y - 1);
    for (let i = 0; i <= 6; i++) { const px = X + i * 4; g.lineTo(px, Y + 6 + Math.sin(i * 2.1 + h * 9) * 2.2 + (lf && i === 0 || rt && i === 6 ? -2 : 0)); }
    g.lineTo(X + TILE - (rt ? 2 : -1), Y - 1); g.closePath(); g.fill();
    g.fillStyle = biome.moss; g.fillRect(X + (lf ? 2 : 0), Y - 2, TILE - (lf ? 2 : 0) - (rt ? 2 : 0), 5);
    g.fillStyle = biome.mossHi; g.fillRect(X + (lf ? 3 : 0), Y - 2, TILE - (lf ? 3 : 0) - (rt ? 3 : 0), 1.6);
    // grass tufts and tiny flowers
    g.strokeStyle = biome.moss; g.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { const gx = X + 3 + ((h * 97 + i * 7.3) % 18), gh = 3 + ((h * 31 + i) % 1) * 5; g.beginPath(); g.moveTo(gx, Y - 1); g.lineTo(gx + (i - 1) * 1.5, Y - 1 - gh); g.stroke(); }
    if (h > 0.82) { g.fillStyle = h > 0.91 ? '#ffd0f0' : '#fff2a8'; g.beginPath(); g.arc(X + 8 + h * 8, Y - 5, 2, 0, 7); g.fill(); }
  }
  // one-way planks
  for (let ty = y0; ty < y0 + CHUNK_T; ty++) for (let tx = x0; tx < x0 + CHUNK_T; tx++) {
    if (at(tx, ty) !== '=') continue; const X = tx * TILE, Y = ty * TILE;
    g.fillStyle = PAL.ink; g.fillRect(X - 1, Y - 1, TILE + 2, 10);
    g.fillStyle = PAL.plank; g.fillRect(X, Y, TILE, 7); g.fillStyle = '#c4935f'; g.fillRect(X, Y, TILE, 2);
    g.fillStyle = PAL.plankDk; g.fillRect(X + TILE - 2, Y, 1.5, 7);
    if (at(tx - 1, ty) !== '=') { g.strokeStyle = '#7a6a50'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X + 3, Y); g.lineTo(X + 3, Y - 30); g.stroke(); }
    if (at(tx + 1, ty) !== '=') { g.strokeStyle = '#7a6a50'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X + TILE - 3, Y); g.lineTo(X + TILE - 3, Y - 30); g.stroke(); }
  }
  return c;
}
// ---------- parallax backgrounds ----------
export function makeBackground(biome, rs, seed = 7) {
  const rng = makeRng(seed); const H = 420, W = 1400; const layers = [];
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * rs); c.height = Math.ceil(h * rs); const g = c.getContext('2d'); g.scale(rs, rs); return [c, g]; };
  // far: ruined skyline + giant tree
  { const [c, g] = mk(W, H); g.fillStyle = biome.far;
    for (let x = 0; x < W;) { const w = rng.range(40, 110), h = rng.range(110, 260); g.fillRect(x, H - h, w, h); if (rng.chance(0.5)) { g.beginPath(); g.moveTo(x, H - h); g.lineTo(x + w * 0.4, H - h - rng.range(10, 40)); g.lineTo(x + w * 0.7, H - h); g.fill(); }
      g.fillStyle = 'rgba(255,220,150,0.18)'; for (let i = 0; i < 6; i++) if (rng.chance(0.4)) g.fillRect(x + rng.range(5, w - 10), H - h + rng.range(10, h - 20), 4, 6); g.fillStyle = biome.far; x += w + rng.range(5, 40); }
    // giant hopeful tree
    const tx = 900; g.fillStyle = biome.farTree; g.beginPath(); g.moveTo(tx - 30, H); g.quadraticCurveTo(tx - 10, H - 200, tx - 4, H - 300); g.lineTo(tx + 8, H - 300); g.quadraticCurveTo(tx + 20, H - 200, tx + 40, H); g.fill();
    for (let i = 0; i < 26; i++) { const a = rng.range(Math.PI * 1.05, Math.PI * 1.95), r = rng.range(40, 150); g.beginPath(); g.arc(tx + Math.cos(a) * r, H - 300 + Math.sin(a) * r * 0.6, rng.range(30, 60), 0, 7); g.fill(); }
    layers.push({ c, w: W, h: H, f: 0.12, y: 0 }); }
  // mid: overpass pillars + broken road + vines
  { const [c, g] = mk(W, H); g.fillStyle = biome.mid;
    g.fillRect(0, 150, W, 26); for (let x = 60; x < W; x += 260) { g.fillRect(x, 176, 38, H); g.fillRect(x - 14, 170, 66, 12); }
    g.clearRect(560, 140, 120, 40); g.beginPath(); g.moveTo(560, 150); g.lineTo(590, 190); g.lineTo(560, 176); g.fill();
    g.strokeStyle = biome.midVine; g.lineWidth = 3; for (let i = 0; i < 40; i++) { const x = rng.range(0, W); g.beginPath(); g.moveTo(x, 176); g.quadraticCurveTo(x + 8, 220, x + rng.range(-6, 6), 176 + rng.range(30, 120)); g.stroke(); }
    g.fillStyle = biome.midVine; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(rng.range(0, W), 150 + rng.range(-6, 4), rng.range(8, 18), 0, 7); g.fill(); }
    layers.push({ c, w: W, h: H, f: 0.3, y: 30 }); }
  // near: hills and grasses
  { const [c, g] = mk(W, H); g.fillStyle = biome.near; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, 290 + Math.sin(x * 0.006) * 30 + Math.sin(x * 0.021) * 12); g.lineTo(W, H); g.fill();
    for (let i = 0; i < 14; i++) { const x = rng.range(0, W), y = 290 + Math.sin(x * 0.006) * 30; g.fillRect(x, y - 60, 6, 60); g.beginPath(); g.arc(x + 3, y - 66, rng.range(14, 26), 0, 7); g.fill(); }
    layers.push({ c, w: W, h: H, f: 0.5, y: 60 }); }
  return layers;
}
export const BIOMES = {
  overpass: { key: 'overpass', name: 'Rustvine Overpass', skyTop: '#27345a', skyMid: '#5b6489', skyLow: '#f0a96e', far: '#46507a', farTree: '#3f5f6a', mid: '#2f3656', midVine: '#2c5a4c', near: '#222842', stone: '#2c2a3a', stone2: '#35324a', stoneHi: '#433e58', moss: '#5fb556', mossHi: '#a6e47a', mossDk: '#2f7a3f', fog: 'rgba(240,169,110,0.10)', light: '#ffcf8a' },
  caverns: { key: 'caverns', name: 'Drowned Glowroots', skyTop: '#0c2230', skyMid: '#14485a', skyLow: '#3fb7b0', far: '#1a3a4e', farTree: '#1f4a50', mid: '#163044', midVine: '#1f5a54', near: '#0f2232', stone: '#1d2a38', stone2: '#233446', stoneHi: '#2e4458', moss: '#3fc0a8', mossHi: '#9ff0d8', mossDk: '#1f7068', fog: 'rgba(80,200,210,0.10)', light: '#8ff4ff' },
  hub: { key: 'hub', name: 'The Seedhouse', skyTop: '#2a4a6a', skyMid: '#5d8aa0', skyLow: '#ffd59a', far: '#4a6a86', farTree: '#4f7a62', mid: '#33506a', midVine: '#3d7a5a', near: '#27405a', stone: '#3a3346', stone2: '#443c52', stoneHi: '#544a64', moss: '#6cc860', mossHi: '#b6f080', mossDk: '#2f8a46', fog: 'rgba(255,213,154,0.08)', light: '#ffe2a8' },
  boss: { key: 'boss', name: 'The Smog Furnace', skyTop: '#1e1a34', skyMid: '#4a2f52', skyLow: '#ff8a5a', far: '#3a2a4a', farTree: '#3a3a4a', mid: '#2a2140', midVine: '#45304a', near: '#1c1730', stone: '#2a2434', stone2: '#332b40', stoneHi: '#433a52', moss: '#7aa04a', mossHi: '#c0dc70', mossDk: '#4a6a30', fog: 'rgba(255,120,80,0.10)', light: '#ff9a6a' },
};
