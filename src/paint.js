// v1.7 painted rendering: 4-plane parallax (sky / far trunks / near trunks / dark foreground framing), per-area light
// & grading, biome particles, organic painted kit (branch platforms, mushroom caps, bracket fungi, boulders, vine bridges).
import { G, pattern } from './gfx.js';
import { TILE, clamp } from './util.js';
import { PAL, drawGlow, CHUNK_T, isSolidCh } from './art.js';
import { drawSupport, supportBox, plankStyle } from './supportsDraw.js';
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
// per-area mood. ray = god-ray colour, haze = depth veil between trunk planes, near = near-trunk silhouette colour,
// fgc = foreground silhouette colour, grade = [top, bottom] soft-light grade, mote = particle kind
const SETS = {
  overpass: { sky: 'g_sky', tr: 'g_trunks', ray: '255,214,130', haze: '150,140,90', hazeA: 0.30, farA: 0.62, near: 'rgba(18,22,10,A)', nearA: 0.74, fgc: '#0b0f06', grade: ['rgba(255,196,90,0.30)', 'rgba(40,70,20,0.30)'], dim: 0.16, mote: 'pollen' },
  hub: { sky: 'm_sky', tr: 'm_trunks', ray: '160,255,215', haze: '40,110,100', hazeA: 0.34, farA: 0.6, near: 'rgba(6,22,20,A)', nearA: 0.78, fgc: '#04100e', grade: ['rgba(120,230,200,0.26)', 'rgba(10,50,60,0.34)'], dim: 0.2, mote: 'spore' },
  boss: { sky: 'd_sky', tr: 'd_trunks', ray: '255,150,90', haze: '120,60,100', hazeA: 0.34, farA: 0.6, near: 'rgba(22,8,24,A)', nearA: 0.8, fgc: '#0c0510', grade: ['rgba(255,140,70,0.30)', 'rgba(90,40,130,0.36)'], dim: 0.2, mote: 'firefly', rayA: 0.6 },
  caverns: { sky: 'c_sky', tr: 'c_trunks', ray: '110,200,255', haze: '30,60,120', hazeA: 0.36, farA: 0.58, near: 'rgba(4,10,26,A)', nearA: 0.82, fgc: '#03060f', grade: ['rgba(90,170,255,0.28)', 'rgba(10,20,70,0.36)'], dim: 0.22, mote: 'bio' },
};
export const setFor = (B) => SETS[B.key] || SETS.overpass;
export const paintedOK = () => G.ready && !!G.img.g_sky;
// cached silhouette / shaded copies of whole images (source-atop fill: no canvas filter needed)
const _shade = new Map();
function shaded(name, col, a, fade = 0) {
  const k = name + col + a + fade; let c = _shade.get(k); const img = G.img[name]; if (!img) return null; if (c && c._v === G.ver) return c;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c._v = G.ver; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  if (fade) { x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; const gr = x.createLinearGradient(0, 0, 0, c.height * fade); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height * fade); }
  _shade.set(k, c); return c;
}
function tileLayer(g, img, f, camx, rs, cw, y, h, flipAlt = true, off = 0) {
  const w = img.width * h / img.height; let ox = -((camx * f * rs + off * w) % (2 * w)); if (ox > 0) ox -= 2 * w;
  for (let x = ox, i = 0; x < cw; x += w, i++) {
    if (i % 2 && flipAlt) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img, 0, 0, w + 1, h); g.restore(); }
    else g.drawImage(img, x, y, w + 1, h);
  }
}
export function drawPaintedBg(W, g, cw, ch, rs, camx, camy, lo) {
  const S = setFor(W.biome); const vy = camy - (W.map.h * TILE - (W.viewH || 340)), pv = (f, k) => clamp(vy * f * rs * 0.25, -ch * k, ch * k);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sky = G.img[S.sky]; if (sky) tileLayer(g, sky, 0.03, camx, rs, cw, -ch * 0.05 - pv(0.04, 0.04), ch * 1.1);
  if (!lo) drawRays(W, g, cw, ch, rs, camx, S, 1);
  // far trunk plane: smaller, hazy, lower contrast
  const tr = G.img[S.tr];
  if (tr) { const far = shaded(S.tr, `rgb(${S.haze})`, S.hazeA, 0.45), h = ch * 0.82; g.globalAlpha = S.farA; tileLayer(g, far || tr, 0.12, camx, rs, cw, ch - h * 0.98 - pv(0.12, 0.08), h, true, 0.37); g.globalAlpha = 1; }
  // haze veil between planes (aerial perspective) - strongest low down
  const hz = g.createLinearGradient(0, 0, 0, ch); hz.addColorStop(0, `rgba(${S.haze},0.06)`); hz.addColorStop(0.6, `rgba(${S.haze},0.16)`); hz.addColorStop(1, `rgba(${S.haze},0.24)`); g.fillStyle = hz; g.fillRect(0, 0, cw, ch);
  // near trunk plane: big, dark, saturated silhouettes
  if (tr) { const near = shaded(S.tr, S.near.replace('A', '1'), S.nearA), h = ch * 1.3; tileLayer(g, near || tr, 0.32, camx, rs, cw, ch - h * 0.97 - pv(0.3, 0.14), h, true, 0.71);
    if (!lo) drawRays(W, g, cw, ch, rs, camx, S, 0.45); }
  // keep the backdrop below the play layer in value
  g.fillStyle = `rgba(6,6,14,${S.dim})`; g.fillRect(0, 0, cw, ch);
  if (W.biome.key === 'boss') { // warm focal pool behind the boss
    const B = W.boss && !W.boss.dead ? W.boss : null, fx = B ? (B.cx - camx) * rs : cw * 0.65, fy = B ? (B.cy - camy) * rs : ch * 0.6, pulse = 0.85 + 0.15 * Math.sin(W.t * 1.6);
    const fr = g.createRadialGradient(fx, fy, 0, fx, fy, ch * 0.95); fr.addColorStop(0, `rgba(255,120,60,${0.22 * pulse})`); fr.addColorStop(0.45, 'rgba(160,50,40,0.08)'); fr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = fr; g.fillRect(0, 0, cw, ch); g.globalCompositeOperation = 'source-over';
  }
}
function drawRays(W, g, cw, ch, rs, camx, S, a) {
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const span = cw * 1.5, x = (((i * 0.31 + 0.07) * cw - camx * rs * 0.05) % span + span) % span - cw * 0.25, w = cw * (0.035 + (i % 3) * 0.03);
    const k = 0.55 + 0.45 * Math.sin(W.t * 0.35 + i * 1.9); const gr = g.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, `rgba(${S.ray},${0.2 * a * k})`); gr.addColorStop(0.75, `rgba(${S.ray},${0.05 * a * k})`); gr.addColorStop(1, `rgba(${S.ray},0)`);
    g.fillStyle = gr; g.globalAlpha = 0.34 * (S.rayA || 1); // 3 nested shafts = soft feathered edges instead of hard polygons
    for (const f of [1, 0.66, 0.33]) { const o = w * (1 - f) / 2; g.beginPath(); g.moveTo(x + o, 0); g.lineTo(x + w - o, 0); g.lineTo(x + w - o + cw * 0.28, ch); g.lineTo(x + o + cw * 0.28, ch); g.fill(); }
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over';
}
// foreground framing: near-black canopy silhouettes at the top + undergrowth at the bottom, parallax > 1, swaying
export function drawForeground(W, g, cw, ch, rs, camx, camy) {
  const S = setFor(W.biome), t = W.t; g.setTransform(1, 0, 0, 1, 0, 0);
  const top = shaded('fg_top', S.fgc, 0.86);
  if (top) { const h = ch * 0.36, sw = Math.sin(t * 0.7) * 0.03 + Math.sin(t * 1.9) * 0.008; g.save(); g.transform(1, 0, sw, 1, 0, 0);
    tileLayer(g, top, 1.3, camx, rs, cw + 40, -h * 0.3 - clamp((camy % 700) * 0.03 * rs, 0, h * 0.12), h, true, 0.2); g.restore(); }
  const bot = shaded('fg_bottom', S.fgc, 0.9);
  if (bot) { const h = ch * 0.2; tileLayer(g, bot, 1.45, camx, rs, cw, ch - h * 0.62, h, true, 0.55); }
}
// ambient particles in world space, per area: pollen + drifting leaves, teal spores, blinking fireflies, rising bio-spores
export function drawMotes(W, g, vx0, vx1, vy0, vy1) {
  const S = setFor(W.biome), t = W.t, kind = S.mote, span = 900, n = kind === 'firefly' ? 26 : 44, sx = (vx1 - vx0) / span;
  const fall = kind === 'pollen' ? -10 : kind === 'spore' ? -5 : kind === 'bio' ? -16 : -3;
  for (let i = 0; i < n; i++) {
    const r1 = hash2(i, 1), r2 = hash2(i, 2), r3 = hash2(i, 3);
    const baseX = vx0 + ((r1 * span - (vx0 * 0.3) % span + span * 2) % span) * sx;
    const x = baseX + Math.sin(t * (0.5 + r2) + i) * 16, yy = ((r2 * 400 + t * fall * (0.6 + r3)) % 400 + 400) % 400, y = vy0 + yy * (vy1 - vy0) / 400;
    if (kind === 'pollen' && i % 4 === 0) { // falling leaf
      const ly = vy0 + (((r2 * 400 + t * 22 * (0.6 + r3)) % 400 + 400) % 400) * (vy1 - vy0) / 400, a = t * (1.5 + r3) + i;
      g.save(); g.translate(x + Math.sin(a) * 10, ly); g.rotate(Math.sin(a) * 0.9); g.fillStyle = r3 > 0.5 ? '#d8b040' : '#8fc040'; g.beginPath(); g.ellipse(0, 0, 3.2, 1.5, 0, 0, 7); g.fill(); g.restore(); continue;
    }
    const tw = 0.5 + 0.5 * Math.sin(t * (kind === 'firefly' ? 3 + r3 * 2 : 2) + i * 3);
    if (kind === 'firefly' || kind === 'bio') { const c = kind === 'firefly' ? '#e8ff70' : '#70e8ff'; if (tw > 0.25) drawGlow(g, x, y, 7 + r3 * 4, c, 0.5 * tw); g.globalCompositeOperation = 'lighter'; g.globalAlpha = tw; g.fillStyle = kind === 'firefly' ? '#fbffc0' : '#c8fbff'; g.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); }
    else { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + 0.4 * tw; g.fillStyle = kind === 'pollen' ? '#fff0a8' : '#a8ffd8'; const s = 0.8 + r3 * 1.4; g.fillRect(x, y, s, s); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
}
// per-area colour grade (soft-light split tone) + vignette
export function drawGrade(W, g, cw, ch) {
  const S = setFor(W.biome); if (!W._grade || W._gradeW !== cw || W._gradeH !== ch || W._gradeK !== W.biome.key) {
    const v = g.createRadialGradient(cw / 2, ch * 0.48, ch * 0.32, cw / 2, ch / 2, cw * 0.7); v.addColorStop(0, 'rgba(6,4,14,0)'); v.addColorStop(1, 'rgba(6,4,14,0.62)');
    const top = g.createLinearGradient(0, 0, 0, ch); top.addColorStop(0, S.grade[0]); top.addColorStop(1, S.grade[1]);
    W._grade = [top, v]; W._gradeW = cw; W._gradeH = ch; W._gradeK = W.biome.key;
  }
  g.globalCompositeOperation = 'soft-light'; g.fillStyle = W._grade[0]; g.fillRect(0, 0, cw, ch); g.globalCompositeOperation = 'source-over';
  g.fillStyle = W._grade[1]; g.fillRect(0, 0, cw, ch);
}
// ---------- textured tile chunks ----------
const _toned = new Map();
function toned(m, filt) {
  const k = m.join(',') + (filt || ''); let c = _toned.get(k); if (c && c._v === G.ver) return c;
  c = document.createElement('canvas'); c.width = m[2]; c.height = m[3]; c._v = G.ver; const g = c.getContext('2d'); if (filt) g.filter = filt;
  g.drawImage(G.atlas, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]); _toned.set(k, c); return c;
}
// flat-colour silhouette of an atlas sprite (rim lights / lit top edges that follow the painted contour)
function sil(m, col) {
  const k = m.join(',') + '#' + col; let c = _toned.get(k); if (c && c._v === G.ver) return c;
  c = document.createElement('canvas'); c.width = m[2]; c.height = m[3]; c._v = G.ver; const g = c.getContext('2d');
  g.drawImage(G.atlas, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, m[2], m[3]); _toned.set(k, c); return c;
}
// per-biome tile skin
const SKIN = {
  overpass: { fill: 'tex_earth', fs: 0.3, lipH: 26, rim: '#ffe6a0', lipF: 'saturate(1.05) brightness(1.0)', hang: 40, propP: 0.42, propF: 'brightness(0.95)', glow: '#fff0a0', body: 'rgba(30,20,10,', kit: '',
    props: [['dc_fern', 20], ['dc_grass', 17], ['dc_flower', 13], ['dc_rock', 11], ['dc_fern', 24], ['dc_mush', 14, '#fff0a0'], ['dc_bush', 18], ['dc_pebble', 8], ['dc_grass', 15], ['dc_flower', 12]] },
  hub: { fill: 'tex_earth', fs: 0.3, tint: 'rgba(10,60,60,0.22)', lipH: 26, rim: '#c8ffe0', lipF: 'hue-rotate(18deg) saturate(1.0) brightness(0.92)', hang: 40, propP: 0.4, propF: 'hue-rotate(18deg) brightness(0.9)', glow: '#a0fff0', body: 'rgba(6,26,26,', kit: 'hue-rotate(15deg) saturate(0.95) brightness(0.92)',
    props: [['dc_fern', 22], ['dc_grass', 17], ['dc_mush', 15, '#a0fff0'], ['dc_rock', 11], ['dc_fern', 18], ['dc_bush', 18], ['dc_pebble', 8], ['dc_root', 12]] },
  caverns: { fill: 'tex_rootcave', fs: 0.3, tint: 'rgba(8,30,90,0.32)', lipH: 24, rim: '#90f0ff', lipF: 'hue-rotate(85deg) saturate(0.9) brightness(0.8)', hang: 46, hangF: 'hue-rotate(60deg) brightness(0.75)', propP: 0.36, propF: 'hue-rotate(80deg) brightness(0.85)', glow: '#70f0ff', body: 'rgba(4,8,30,', kit: 'hue-rotate(70deg) saturate(0.85) brightness(0.82)',
    props: [['dc_mush', 16, '#70f0ff'], ['dc_fern', 18], ['dc_rock', 12], ['dc_mush', 20, '#70f0ff'], ['dc_pebble', 8], ['dc_root', 12], ['d_crys', 16, '#90e0ff']] },
  boss: { fill: 'tex_dusk', fs: 0.32, tint: 'rgba(60,20,60,0.2)', lipH: 24, rim: '#ffb080', lipF: 'saturate(0.85) brightness(0.8) hue-rotate(-14deg)', hang: 30, hangF: 'brightness(0.7)', propP: 0.32, propF: 'saturate(0.8) brightness(0.78) hue-rotate(-14deg)', glow: '#ffb070', body: 'rgba(20,6,20,', kit: 'saturate(0.85) brightness(0.82) hue-rotate(-14deg)',
    props: [['dc_fern', 18], ['dc_mush', 15, '#ffb070'], ['dc_grass', 15], ['dc_rock', 11], ['dc_flower', 12], ['dc_pebble', 8]] },
};
// plank runs -> owning support piece (so platforms are drawn in the style of what holds them up)
function pieceAt(map, x, y) {
  const sup = map.sup; if (!sup) return null; if (!sup._by) { sup._by = new Map(); for (const p of sup.pieces) if (p.kind === 'plank') for (let i = p.x0; i <= p.x1; i++) sup._by.set(i + ',' + p.y, p); }
  return sup._by.get(x + ',' + y) || null;
}
export function renderPaintedChunk(map, cx, cy, rs, biome) {
  const Wd = CHUNK_T * TILE, c = document.createElement('canvas');
  c.width = Math.ceil(Wd * rs); c.height = Math.ceil(Wd * rs); const g = c.getContext('2d');
  g.scale(rs, rs); g.translate(-cx * Wd, -cy * Wd);
  const x0 = cx * CHUNK_T, y0 = cy * CHUNK_T, at = (x, y) => map.get(x, y), S = (x, y) => isSolidCh(at(x, y));
  const boss = biome.key === 'boss', DBG = globalThis.__tileDbg || {};
  const SK = SKIN[biome.key] || SKIN.overpass, pFill = pattern(g, G.img[SK.fill] ? SK.fill : 'tex_earth', SK.fs), pRoot = pattern(g, 'tex_root', 0.4);
  const path = (X, Y, tl, tr, br, bl) => { g.beginPath(); g.moveTo(X + tl, Y); g.lineTo(X + TILE - tr, Y); g.quadraticCurveTo(X + TILE, Y, X + TILE, Y + tr); g.lineTo(X + TILE, Y + TILE - br); g.quadraticCurveTo(X + TILE, Y + TILE, X + TILE - br, Y + TILE); g.lineTo(X + bl, Y + TILE); g.quadraticCurveTo(X, Y + TILE, X, Y + TILE - bl); g.lineTo(X, Y + tl); g.quadraticCurveTo(X, Y, X + tl, Y); g.closePath(); };
  const each = (fn) => { for (let ty = y0 - 1; ty < y0 + CHUNK_T + 1; ty++) for (let tx = x0 - 1; tx < x0 + CHUNK_T + 1; tx++) { const ch = at(tx, ty); if (isSolidCh(ch)) fn(tx, ty, ch); } };
  const corners = (tx, ty) => { const up = !S(tx, ty - 1), dn = !S(tx, ty + 1), lf = !S(tx - 1, ty), rt = !S(tx + 1, ty), r = 7; return [up, dn, lf, rt, up && lf ? r : 0, up && rt ? r : 0, dn && rt ? r : 0, dn && lf ? r : 0]; };
  const spr = G.spr, at2 = (x, y) => at(x, y) || ' ', air = (ch) => ch === '.' || ch === ' ';
  const L0 = x0 * TILE - 80, T0 = y0 * TILE - 80, R0 = (x0 + CHUNK_T) * TILE + 80, B0 = (y0 + CHUNK_T) * TILE + 80;
  // organic supports behind the tiles so trunks/roots grow out of and sink into the earth
  const sup = map.sup;
  if (sup && !DBG.noSup) { const l = x0 * TILE, t = y0 * TILE, r = l + Wd, b = t + Wd;
    for (const p of sup.pieces) { const bx = p.box || (p.box = supportBox(p, map)); if (bx[2] < l || bx[0] > r || bx[3] < t || bx[1] > b) continue; g.save(); drawSupport(g, p, map, biome.key); g.restore(); sup.drawn.add(p.id); } }
  // ink rim + textured fill
  each((tx, ty) => { const [up, dn, lf, rt, a, b, cc, d] = corners(tx, ty); if (!(up || dn || lf || rt)) return; g.strokeStyle = PAL.ink; path(tx * TILE, ty * TILE, a, b, cc, d); g.lineWidth = 4; g.stroke(); });
  each((tx, ty, ch) => { const [, , , , a, b, cc, d] = corners(tx, ty); g.fillStyle = ch === 'B' ? pRoot : pFill; path(tx * TILE, ty * TILE, a, b, cc, d); g.fill(); if (SK.tint && ch !== 'B') { g.fillStyle = SK.tint; g.fill(); } });
  // depth shading: earth body darkens fast below the lit surface so tops read first
  each((tx, ty, ch) => {
    const X = tx * TILE, Y = ty * TILE, [up, dn, lf, rt] = corners(tx, ty), dU = up ? 0 : !S(tx, ty - 2) ? 1 : !S(tx, ty - 3) ? 2 : 3;
    const side = Math.min(lf || rt ? 0 : (!S(tx - 2, ty) || !S(tx + 2, ty)) ? 1 : 2, 2);
    const k = Math.min(0.8, 0.12 + dU * 0.2 + side * 0.08 + (boss ? 0.06 : 0)); g.fillStyle = SK.body + k + ')'; g.fillRect(X, Y, TILE, TILE);
    if (ch === 'B') { g.strokeStyle = 'rgba(255,230,170,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X + 4, Y + 3); g.lineTo(X + 11, Y + 11); g.lineTo(X + 7, Y + 18); g.moveTo(X + 11, Y + 11); g.lineTo(X + 20, Y + 9); g.moveTo(X + 13, Y + 14); g.lineTo(X + 17, Y + 21); g.stroke(); }
    if (rt) { g.fillStyle = 'rgba(255,210,150,0.12)'; g.fillRect(X + TILE - 3, Y, 3, TILE); }
    if (lf) { g.fillStyle = 'rgba(5,4,12,0.28)'; g.fillRect(X, Y, 4, TILE); }
    if (dn) { g.fillStyle = 'rgba(5,4,12,0.4)'; g.fillRect(X, Y + TILE - 4, TILE, 4); }
    const h = hash2(tx, ty);
    if (!up && dU >= 2 && h > 0.94) { drawGlow(g, X + 12, Y + 12, 7, SK.glow, 0.45); g.fillStyle = '#fff'; g.globalAlpha = 0.7; g.fillRect(X + 11, Y + 11, 1.6, 1.6); g.globalAlpha = 1; }
    else if (!up && h > 0.8 && spr.dc_rock) { const q = spr.dc_rock, w = 10 + h * 8, hh = w * q[3] / q[2]; g.globalAlpha = 0.55; g.drawImage(toned(q, 'brightness(0.55)'), 0, 0, q[2], q[3], X + h * 8, Y + 4, w, hh); g.globalAlpha = 1; } // buried stones
  });
  // jagged ledge undersides with hanging root tendrils
  if (!DBG.noCrumb) each((tx, ty) => {
    if (S(tx, ty + 1) || at(tx, ty + 1) === '=') return; const X = tx * TILE, Y = (ty + 1) * TILE, h = hash2(tx, ty + 7);
    const lf = S(tx - 1, ty) && !S(tx - 1, ty + 1), rt = S(tx + 1, ty) && !S(tx + 1, ty + 1);
    const pts = [[lf ? 0 : 5, 0]]; const n = 3 + (h * 2 | 0);
    for (let i = 0; i <= n; i++) { const u = (lf ? 0 : 5) + (TILE - (lf ? 0 : 5) - (rt ? 0 : 5)) * i / n; pts.push([u, 2 + hash2(tx * 3 + i, ty) * (i % 2 ? 9 : 3)]); }
    pts.push([rt ? TILE : TILE - 5, 0]);
    g.beginPath(); pts.forEach(([u, v], i) => i ? g.lineTo(X + u, Y - 1 + v) : g.moveTo(X + u, Y - 1 + v)); g.closePath();
    g.strokeStyle = PAL.ink; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke(); g.fillStyle = pFill || '#3a3d50'; g.fill(); g.fillStyle = 'rgba(8,6,18,0.62)'; g.fill();
    if (h > 0.45) { g.strokeStyle = '#1d2a1a'; g.lineWidth = 2.4; g.lineCap = 'round'; const rx = X + 4 + h * 14; g.beginPath(); g.moveTo(rx, Y); g.bezierCurveTo(rx + 4, Y + 6, rx - 3, Y + 10, rx + 1, Y + 9 + h * 14); g.stroke(); g.strokeStyle = '#4a6a3a'; g.lineWidth = 1; g.stroke(); }
  });
  const runs = (rowFn, cb) => { for (let ty = y0 - 3; ty < y0 + CHUNK_T + 2; ty++) { let tx = x0 - 30; while (tx < x0 + CHUNK_T + 30) { if (!rowFn(tx, ty)) { tx++; continue; } let e = tx; while (rowFn(e + 1, ty)) e++; if (e >= x0 - 3 && tx <= x0 + CHUNK_T + 3) cb(tx, e, ty); tx = e + 1; } } };
  const strip = (m, X0, X1, Y, h, off, alpha, filt) => {
    const src = filt === '#' ? m : toned(m, filt), w = m[2] * h / m[3]; g.save(); g.beginPath(); g.rect(X0, Y - h, X1 - X0, h * 3); g.clip(); g.globalAlpha = alpha;
    for (let x = X0 - off * w; x < X1; x += w) g.drawImage(src, 0, 0, m[2], m[3], x, Y, w + 0.6, h);
    g.restore();
  };
  // hanging roots under ceilings
  if (spr.hang && SK.hang && !DBG.noHang) runs((x, y) => isSolidCh(at(x, y)) && air(at2(x, y + 1)) && air(at2(x, y + 2)), (tx, e, ty) => {
    if (e - tx < 1) return; const X0 = tx * TILE + 6, X1 = (e + 1) * TILE - 6, h = SK.hang * (0.85 + hash2(tx, ty) * 0.3);
    strip(spr.hang, X0, X1, (ty + 1) * TILE - h * 0.2, h, hash2(ty, tx), 0.9, SK.hangF);
  });
  // painted ground lip (irregular mossy/grassy top with roots and stones) + a lit edge that follows its contour
  const m = spr.lip2 || spr.lip;
  const prop = (k, X, Y, fl, sc = 1, glow = true) => { const q = spr[k[0]]; if (!q) return; const ph = k[1] * 1.25 * sc, pw = q[2] * ph / q[3]; if (k[2] && glow) drawGlow(g, X, Y - ph * 0.6, ph, k[2], 0.4);
    g.save(); g.translate(X, Y); if (fl) g.scale(-1, 1); g.drawImage(toned(q, SK.propF), 0, 0, q[2], q[3], -pw / 2, -ph, pw, ph); g.restore(); };
  if (m && !DBG.noLip) runs((x, y) => isSolidCh(at(x, y)) && !S(x, y - 1) && at(x, y - 1) !== '^', (tx, e, ty) => {
    const lx = !S(tx - 1, ty), rx = !S(e + 1, ty), X0 = tx * TILE - (lx ? 6 : 0), X1 = (e + 1) * TILE + (rx ? 6 : 0), Y = ty * TILE, mh = SK.lipH, ly = Y - mh * 0.3, off = hash2(tx, ty * 3);
    const clipEnds = () => { g.beginPath(); const r = 9; g.moveTo(X0, Y - mh * 2); g.lineTo(X1, Y - mh * 2);
      if (rx) { g.lineTo(X1, Y + mh * 0.2); g.quadraticCurveTo(X1, Y + mh * 0.75, X1 - r, Y + mh * 0.8); } else g.lineTo(X1, Y + mh * 1.2);
      if (lx) { g.lineTo(X0 + r, Y + mh * 0.8); g.quadraticCurveTo(X0, Y + mh * 0.75, X0, Y + mh * 0.2); } else g.lineTo(X0, Y + mh * 1.2); g.closePath(); g.clip(); };
    g.save(); clipEnds();
    strip(sil(m, PAL.ink), X0, X1, ly + 1.5, mh, off, 0.9, '#'); // ink under-shadow
    strip(sil(m, SK.rim), X0, X1, ly - 1.4, mh, off, 0.95, '#'); // lit top edge
    strip(m, X0, X1, ly, mh, off, 1, SK.lipF); g.restore();
    // overlapping edge dressing: ferns / roots spilling over exposed run ends
    if (!DBG.noProps) for (const [ex, d] of [[lx, -1], [rx, 1]]) { if (!ex) continue; const h = hash2(tx * 7 + d, ty), k = h < 0.5 ? ['dc_fern', 20] : h < 0.8 ? ['dc_root', 15] : ['dc_grass', 17]; prop(k, (d < 0 ? X0 + 4 : X1 - 4), Y + 5, d < 0, 0.9 + h * 0.3); }
  });
  // dense ground decor on open tops (behind gameplay, low, never on spawn/door columns)
  if (SK.props.length && !DBG.noProps) for (let ty = y0 - 1; ty < y0 + CHUNK_T + 2; ty++) for (let tx = x0 - 1; tx < x0 + CHUNK_T + 1; tx++) {
    if (!isSolidCh(at(tx, ty)) || !air(at2(tx, ty - 1)) || !air(at2(tx, ty - 2))) continue;
    for (let j = 0; j < 2; j++) { const h = hash2(tx * 1.7 + j * 13, ty * 2.3); if (h > SK.propP * (j ? 0.5 : 1)) continue;
      const k = SK.props[(hash2(tx + j * 3, ty * 5) * SK.props.length) | 0], X = tx * TILE + 12 + (hash2(tx, 3 + j) - 0.5) * 16, fl = hash2(tx, 11 + j) > 0.5;
      prop(k, X, ty * TILE + 4, fl, 0.8 + hash2(ty, tx + j) * 0.4); }
  }
  // islands: a painted mossy boulder wraps the floating earth block
  if (sup && spr.bo0) for (const p of sup.pieces) {
    if (p.kind !== 'island' || p.x1 - p.x0 > 4) continue; const bx0 = p.x0 * TILE, bx1 = (p.x1 + 1) * TILE; if (bx1 < L0 || bx0 > R0 || p.y * TILE > B0 || (p.y + 2) * TILE < T0) continue;
    let top = p.y; while (top > p.y - 3 && (S(p.x0, top - 1) || S(p.x1, top - 1))) top--; const q = spr['bo' + ((hash2(p.x0, p.y) * 3) | 0)], w = bx1 - bx0 + 18, hh = Math.min((p.y + 1 - top) * TILE + 34, Math.max((p.y + 1 - top) * TILE + 16, w * q[3] / q[2] * 0.75));
    const yT = top * TILE + 4; g.save(); g.translate((bx0 + bx1) / 2, yT); if (hash2(p.y, p.x0) > 0.5) g.scale(-1, 1); g.drawImage(toned(q, SK.kit), 0, 0, q[2], q[3], -w / 2, 0, w, hh); g.restore();
    // re-lay the mossy lip over the boulder crown so the walkable top stays a crisp lit line
    if (m) { const ly = top * TILE - SK.lipH * 0.3, X0 = bx0 - 6, X1 = bx1 + 6; g.save(); g.beginPath(); g.ellipse((X0 + X1) / 2, top * TILE, (X1 - X0) / 2, SK.lipH * 1.4, 0, 0, 7); g.clip();
      strip(sil(m, SK.rim), X0, X1, ly - 1.4, SK.lipH, 0.3, 0.95, '#'); strip(m, X0, X1, ly, SK.lipH, 0.3, 1, SK.lipF); g.restore(); }
  }
  // one-way platforms ('='), drawn per whole run in the style of their support
  runs((x, y) => at(x, y) === '=', (tx, e, ty) => drawPlankRun(g, map, tx, e, ty, SK, boss));
  return c;
}
// 3-slice a horizontal kit sprite across [X0,X1]: caps keep their shape, the middle repeats
function slice3(g, src, m, X0, X1, Y, h, flip, capL = 0.28, capR = 0.3) {
  const s = h / m[3], W = X1 - X0, cl = Math.min(m[2] * capL * s, W * 0.4), cr = Math.min(m[2] * capR * s, W * 0.45), mw = (m[2] * (1 - capL - capR)) * s;
  g.save(); if (flip) { g.translate(X0 + X1, 0); g.scale(-1, 1); }
  g.drawImage(src, 0, 0, m[2] * capL, m[3], X0, Y, cl + 0.5, h);
  for (let x = X0 + cl, i = 0; x < X1 - cr; x += mw, i++) { const w = Math.min(mw, X1 - cr - x); const sx = m[2] * capL + (i % 2 ? m[2] * 0.08 : 0); g.drawImage(src, sx, 0, (w / s), m[3], x, Y, w + 0.6, h); }
  g.drawImage(src, m[2] * (1 - capR), 0, m[2] * capR, m[3], X1 - cr, Y, cr, h); g.restore();
}
function drawPlankRun(g, map, tx, e, ty, SK, boss) {
  const spr = G.spr, p = pieceAt(map, tx, ty), st = p && p.sup ? plankStyle(p) : 'tree', X0 = tx * TILE, X1 = (e + 1) * TILE, Y = ty * TILE, n = e - tx + 1, h = hash2(tx, ty);
  // which side holds it? (broken branch tip points away from the trunk / wall)
  const hold = p && p.hold || 0;
  g.fillStyle = 'rgba(5,4,12,0.35)'; g.beginPath(); g.ellipse((X0 + X1) / 2, Y + 16, (X1 - X0) / 2, 5, 0, 0, 7); g.fill(); // contact shadow
  if (st === 'mush' && spr.mc0) { const q = spr['mc' + ((h * 3) | 0)], w = X1 - X0 + 20, hh = Math.min(w * q[3] / q[2], 34); g.drawImage(sil(q, SK.rim), 0, 0, q[2], q[3], X0 - 10, Y - 6.5, w, hh); g.drawImage(toned(q, SK.kit), 0, 0, q[2], q[3], X0 - 10, Y - 5, w, hh); return; }
  if (st === 'shelf' && spr.fb0) { const q = spr['fb' + ((h * 3) | 0)], w = X1 - X0 + 14, hh = Math.min(w * q[3] / q[2] * 0.8, 30), fl = hold > 0; g.save(); if (fl) { g.translate(X0 + X1, 0); g.scale(-1, 1); }
    const ax = X0 - (hold ? 10 : 7); g.drawImage(sil(q, SK.rim), 0, 0, q[2], q[3], ax, Y - 6.5, w, hh); g.drawImage(toned(q, SK.kit), 0, 0, q[2], q[3], ax, Y - 5, w, hh); g.restore(); return; }
  if (st === 'vines') { // sagging vine-rope bridge: slats + two ropes, max ~3px sag
    const C = '#2f5a2a', sag = (x) => Math.sin(Math.PI * clamp((x - X0) / (X1 - X0), 0, 1)) * Math.min(3, n * 0.6);
    for (let x = X0 + 2, i = 0; x < X1 - 2; x += 7.8, i++) { const r = hash2(i, tx), y = Y + sag(x + 3); g.save(); g.translate(x + 3, y + 3); g.rotate((r - 0.5) * 0.12); g.fillStyle = PAL.ink; g.beginPath(); g.roundRect(-4, -3.6, 8, 8.2, 2.5); g.fill();
      const wg = g.createLinearGradient(0, -3, 0, 4); wg.addColorStop(0, boss ? '#b07a5a' : '#c09060'); wg.addColorStop(0.35, boss ? '#6a4232' : '#7a5232'); wg.addColorStop(1, '#2e1a10'); g.fillStyle = wg; g.beginPath(); g.roundRect(-3, -2.6, 6, 6.2, 2); g.fill(); g.fillStyle = SK.rim; g.globalAlpha = 0.8; g.fillRect(-2.6, -2.8, 5.2, 1); g.globalAlpha = 1; g.restore(); }
    for (const dy of [1, 6]) { g.strokeStyle = PAL.ink; g.lineWidth = 3; g.beginPath(); for (let x = X0 - 2; x <= X1 + 2; x += 4) { const y = Y + dy + sag(x); x === X0 - 2 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); g.strokeStyle = C; g.lineWidth = 1.5; g.stroke(); }
    for (let x = X0 + 4; x < X1; x += 13) { const r = hash2(x, ty); if (r < 0.4) continue; g.fillStyle = r > 0.7 ? '#7fcf4e' : '#3f8a3a'; g.beginPath(); g.ellipse(x, Y + 8 + sag(x) + r * 3, 3.5, 1.6, r * 2, 0, 7); g.fill(); }
    return; }
  // branch / log platforms
  const isLog = st === 'log' && spr.glog, q = isLog ? spr.glog : spr['br' + ((h * 3) | 0)] || spr.br0; if (!q) return;
  const hh = isLog ? 24 : 19, yT = Y - (isLog ? 5 : 5), flip = isLog ? h > 0.5 : hold > 0, ext = isLog ? 2 : 8, xa = X0 - (hold < 0 ? 4 : ext), xb = X1 + (hold > 0 ? 4 : ext);
  slice3(g, sil(q, PAL.ink), q, xa - 1, xb + 1, yT + 1.6, hh, flip); slice3(g, sil(q, SK.rim), q, xa, xb, yT - 1.5, hh, flip); slice3(g, toned(q, SK.kit), q, xa, xb, yT, hh, flip);
  if (!isLog) for (let x = X0 + 10; x < X1 - 6; x += 22) { const r = hash2(x, ty * 3); if (r < 0.45) continue; const k = r > 0.8 ? 'dc_flower' : r > 0.62 ? 'dc_grass' : 'dc_fern', s2 = spr[k]; if (!s2) continue; const ph = 9 + r * 4, pw = s2[2] * ph / s2[3]; g.drawImage(toned(s2, SK.propF), 0, 0, s2[2], s2[3], x - pw / 2, Y - ph + 1, pw, ph); }
  void clamp;
}
// kit helpers shared with the trap painter
export function kitDraw(g, name, X0, X1, Y, h, flip, filt, rim) {
  const q = G.spr[name]; if (!q || !G.ready) return false;
  if (rim) slice3(g, sil(q, rim), q, X0, X1, Y - 1.4, h, flip);
  slice3(g, toned(q, filt || ''), q, X0, X1, Y, h, flip); return true;
}
