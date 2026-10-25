// Painted art loader (v1.1). Everything degrades to the procedural v1.0 drawing when assets are missing.
export const G = { ready: false, ver: 0, img: {}, spr: {}, atlas: null, meta: null, tint: new Map(), hero: null, en: null };
G.prog = 0; let nWant = 0, nGot = 0; /* v2.3: load progress for the title loading bar */
const loadImg = (src) => new Promise((res) => { nWant++; const i = new Image(); const done = (v) => { nGot++; G.prog = Math.max(G.prog, nGot / Math.max(nWant, 12)); res(v); }; i.onload = () => done(i); i.onerror = () => done(null); i.src = src; });
export async function loadGfx(base = 'gfx/') {
  try {
    const meta = await (await fetch(base + 'atlas.json')).json(); G.meta = meta;
    const names = [...Object.keys(meta.bg), 'tex_root', 'tex_earth', 'tex_rootcave', 'tex_dusk', 'tex_bark'];
    const imgs = await Promise.all([loadImg(base + 'atlas.webp'), ...names.map((n) => loadImg(base + n + '.webp'))]);
    if (!imgs[0]) return false;
    try { const [hm, hi] = await Promise.all([fetch(base + 'hero.json').then((r) => r.json()), loadImg(base + 'hero.webp')]); if (hi && hm) G.hero = { img: hi, f: hm.f, gait: hm.gait || {}, hand: hm.hand || {}, cache: new Map() }; } catch (e) { G.hero = null; }
    try { const [em, ei] = await Promise.all([fetch(base + 'enemies.json').then((r) => r.json()), loadImg(base + 'enemies.webp')]); if (ei && em) G.en = { img: ei, f: em.f, cache: new Map() }; } catch (e) { G.en = null; }
    loadStory(base); // v2.1 story sprites (Moss, Great Root, Blight) stream in after the core art; never blocks boot
    G.atlas = imgs[0]; names.forEach((n, i) => { if (imgs[i + 1]) G.img[n] = imgs[i + 1]; }); G.spr = meta.spr; G.prog = 1; G.ready = true; G.ver++;
    return true;
  } catch (e) { return false; }
}
export const STORY_SPR = ['s_moss', 's_root0', 's_root1', 's_blight', 's_boss', 's_boss2', 's_warden', 's_mimic', 's_hunter', 's_shrine', 's_merchant', 's_altar', 's_hollow'];
export function loadStory(base = 'gfx/') { if (G.storyP) return G.storyP; G.storyP = Promise.all(STORY_SPR.map((n) => loadImg(base + n + '.webp').then((i) => { if (i) G.img[n] = i; }))); return G.storyP; }
// draw a whole story image so its height is h world units, anchored bottom-centre
export function sImg(g, n, x, y, h, flip = false, alpha = 1) { const i = G.img[n]; if (!i) return false; const w = i.width * h / i.height; if (alpha !== 1) g.globalAlpha = alpha; if (flip) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(i, -w / 2, y - h, w, h); g.restore(); } else g.drawImage(i, x - w / 2, y - h, w, h); if (alpha !== 1) g.globalAlpha = 1; return true; }
export const has = (n) => G.ready && !!G.spr[n];
export const sprAspect = (n) => { const s = G.spr[n]; return s ? s[2] / s[3] : 1; };
// draw sprite n so its height is h world units with anchor (ax, ay) in 0..1 at (x, y)
export function spr(g, n, x, y, h, ax = 0.5, ay = 1, flip = false, src = null) {
  const s = G.spr[n]; if (!s) return false; const w = s[2] * h / s[3];
  const img = src || G.atlas, sx = src ? 0 : s[0], sy = src ? 0 : s[1];
  if (flip) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(img, sx, sy, s[2], s[3], -w * ax, -h * ay, w, h); g.restore(); }
  else g.drawImage(img, sx, sy, s[2], s[3], x - w * ax, y - h * ay, w, h);
  return true;
}
// a flat-colour silhouette of sprite n (cached), for hurt flashes and outlines
export function tinted(n, color) {
  const k = n + color; let c = G.tint.get(k); if (c) return c; const s = G.spr[n]; if (!s) return null;
  c = document.createElement('canvas'); c.width = s[2]; c.height = s[3]; const x = c.getContext('2d');
  x.drawImage(G.atlas, s[0], s[1], s[2], s[3], 0, 0, s[2], s[3]); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, s[2], s[3]);
  G.tint.set(k, c); return c;
}
// darkened copy of a sprite (cached) — replaces per-frame ctx.filter brightness
export function shaded(n, k) {
  const key = n + '@' + k; let c = G.tint.get(key); if (c) return c; const s = G.spr[n]; if (!s) return null;
  c = document.createElement('canvas'); c.width = s[2]; c.height = s[3]; const x = c.getContext('2d');
  x.drawImage(G.atlas, s[0], s[1], s[2], s[3], 0, 0, s[2], s[3]); x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(10,8,20,${1 - k})`; x.fillRect(0, 0, s[2], s[3]);
  G.tint.set(key, c); return c;
}
// world-anchored texture pattern (scale = world units per texture pixel)
export function pattern(g, n, scale) {
  const img = G.img[n]; if (!img) return null; const p = g.createPattern(img, 'repeat');
  if (p && p.setTransform) p.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0])); return p;
}
// v1.3 painted hero frame: [x, y, w, h, faceX, faceY] in hero.webp; white silhouette cached for hurt flashes
export function heroFlash(n) {
  const H = G.hero; if (!H.f[n]) n = 'idle0'; let c = H.cache.get(n); if (c) return c; const f = H.f[n]; c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
  const x = c.getContext('2d'); x.drawImage(H.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, f[2], f[3]); H.cache.set(n, c); return c;
}
// v2.0 tinted silhouette for style afterimages (cached per frame+colour)
export function heroTint(n, col) {
  const H = G.hero; if (!H.f[n]) n = 'idle0'; const k = n + col; let c = H.cache.get(k); if (c) return c; const f = H.f[n]; c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
  const x = c.getContext('2d'); x.drawImage(H.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, f[2], f[3]); H.cache.set(k, c); return c;
}
// v1.4 enemy animation frames (enemies.webp): f[name] = [x, y, w, h, pivotX, hRel, pad]; ink border + rim are baked in
export const hasE = (n) => !!(G.en && G.en.f[n]);
// draw frame n of an enemy whose neutral pose is H world units tall, pivot (feet centre) at (x, y). Returns draw info for shattering.
export function drawE(g, n, x, y, H, flip = false, src = null) {
  const f = G.en.f[n]; const k = H * f[5] / (f[3] - 2 * f[6]); const w = f[2] * k, h = f[3] * k, ox = f[4] * k, oy = h - f[6] * k;
  const img = src || G.en.img, sx = src ? 0 : f[0], sy = src ? 0 : f[1];
  if (flip) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(img, sx, sy, f[2], f[3], -ox, -oy, w, h); g.restore(); }
  else g.drawImage(img, sx, sy, f[2], f[3], x - ox, y - oy, w, h);
  return k;
}
// flat-colour silhouette of an enemy frame (cached) for hurt flashes / hot tints
export function eTint(n, color) {
  const E = G.en, key = n + color; let c = E.cache.get(key); if (c) return c; const f = E.f[n]; c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
  const x = c.getContext('2d'); x.drawImage(E.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, f[2], f[3]); E.cache.set(key, c); return c;
}
