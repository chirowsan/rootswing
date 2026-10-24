// Unified input: keyboard, gamepad, and on-screen touch controls.
import { save } from './save.js';
import { clamp } from './util.js';
import { drawIcon } from './art.js';

const BTN = ['jump', 'attack', 'dash', 'hook', 'parry', 'skill1', 'skill2', 'flask', 'pause', 'up', 'down', 'confirm'];
export const input = {
  mx: 0, my: 0, // move axes -1..1
  held: {}, queued: {}, rel: {},
  touchActive: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches, lastDevice: 'keys', // phones show touch controls from the start
  visible: { parry: true, skill1: true, skill2: false, flask: true, hook: true, dash: true, attack: true },
  highlight: {}, // name -> true (tutorial pulse)
  stick: { active: false, id: null, bx: 0, by: 0, x: 0, y: 0 },
  pads: {}, layout: null, enabled: true, w: 1, h: 1,
};
for (const b of BTN) { input.held[b] = false; input.queued[b] = false; input.rel[b] = false; }
export const pressed = (b) => input.queued[b];
export const held = (b) => input.held[b];
export const released = (b) => input.rel[b];
export function endStep() { for (const b of BTN) { input.queued[b] = false; input.rel[b] = false; } }
function press(b) { if (!input.held[b]) input.queued[b] = true; input.held[b] = true; }
function release(b) { if (input.held[b]) input.rel[b] = true; input.held[b] = false; }
export function clearAll() { for (const b of BTN) { input.held[b] = false; input.queued[b] = false; input.rel[b] = false; } keyAxes.clear(); input.stick.active = false; touchMap.clear(); }

// ---------- keyboard ----------
const KEYMAP = { Space: 'jump', KeyZ: 'jump', KeyK: 'jump', KeyX: 'attack', KeyJ: 'attack', ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'dash', KeyL: 'dash', KeyV: 'hook', KeyI: 'hook', KeyF: 'parry', KeyU: 'parry', KeyQ: 'skill1', Digit1: 'skill1', KeyR: 'skill2', Digit2: 'skill2', KeyH: 'flask', Digit3: 'flask', Escape: 'pause', KeyP: 'pause', Enter: 'confirm' };
const keyAxes = new Set();
const AXES = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D' };
function onKey(e, down) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  const c = e.code; input.lastDevice = 'keys';
  if (AXES[c]) { if (down) keyAxes.add(AXES[c]); else keyAxes.delete(AXES[c]); if (AXES[c] === 'U') (down ? press : release)('up'); if (AXES[c] === 'D') (down ? press : release)('down'); e.preventDefault(); }
  if (KEYMAP[c]) { if (e.repeat) { e.preventDefault(); return; } (down ? press : release)(KEYMAP[c]); e.preventDefault(); }
}
// ---------- gamepad ----------
const PADMAP = { 0: 'jump', 2: 'attack', 1: 'dash', 5: 'hook', 4: 'parry', 6: 'skill1', 7: 'skill2', 3: 'flask', 9: 'pause', 12: 'up', 13: 'down' };
let padPrev = {};
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null;
  for (const p of pads) if (p && p.connected) { gp = p; break; }
  if (!gp) return null;
  for (const [i, name] of Object.entries(PADMAP)) {
    const b = gp.buttons[i]; const v = b && (b.pressed || b.value > 0.5);
    if (v && !padPrev[i]) { press(name); input.lastDevice = 'pad'; } else if (!v && padPrev[i]) release(name);
    padPrev[i] = v;
  }
  let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
  if (gp.buttons[14] && gp.buttons[14].pressed) x = -1; if (gp.buttons[15] && gp.buttons[15].pressed) x = 1;
  if (gp.buttons[12] && gp.buttons[12].pressed) y = -1; if (gp.buttons[13] && gp.buttons[13].pressed) y = 1;
  if (Math.abs(x) < 0.25) x = 0; if (Math.abs(y) < 0.35) y = 0;
  if (x || y) input.lastDevice = 'pad';
  return { x, y };
}
// ---------- touch ----------
const touchMap = new Map(); // id -> control name
export function computeLayout(w, h) {
  const s = save.settings.ctrlSize * clamp(Math.min(w, h * 2.1) / 412 * 0.5 + 0.5, 0.8, 1.35) * (h < 360 ? 0.85 : 1);
  const R = (dx, dy) => ({ x: w + dx * s, y: h + dy * s });
  const L = {
    s,
    jump: { ...R(-78, -80), r: 46 * s }, attack: { ...R(-182, -64), r: 42 * s }, dash: { ...R(-168, -166), r: 32 * s },
    hook: { ...R(-70, -190), r: 36 * s }, parry: { ...R(-268, -54), r: 28 * s }, skill1: { ...R(-262, -138), r: 26 * s }, skill2: { ...R(-238, -212), r: 24 * s },
    flask: { x: 58 * s, y: h - 232 * s, r: 25 * s }, pause: { x: w - 34 * s, y: 32 * s, r: 22 * s },
    stickHome: { x: 118 * s, y: h - 104 * s }, stickR: 58 * s * (save.settings.stickSize || 1),
    padL: { x: 70 * s, y: h - 74 * s, r: 44 * s }, padR: { x: 180 * s, y: h - 74 * s, r: 44 * s }, padD: { x: 125 * s, y: h - 168 * s, r: 30 * s },
  };
  input.layout = L; input.w = w; input.h = h; return L;
}
const RIGHT_BTNS = ['jump', 'attack', 'dash', 'hook', 'parry', 'skill1', 'skill2', 'flask', 'pause'];
const SLIDE = new Set(['jump', 'attack', 'dash', 'hook', 'parry']);
function hitButton(x, y, k = 1.3) {
  const L = input.layout; let best = null, bd = 1e9;
  for (const b of RIGHT_BTNS) {
    if (b !== 'pause' && b !== 'jump' && input.visible[b] === false) continue;
    const p = L[b]; const d = Math.hypot(x - p.x, y - p.y); const lim = p.r * (b === 'pause' ? 1.6 : k);
    if (d < lim && d / lim < bd) { bd = d / lim; best = b; }
  }
  return best;
}
function onTouch(e, type) {
  if (!input.enabled) return;
  input.touchActive = true; input.lastDevice = 'touch';
  const L = input.layout; if (!L) return;
  for (const t of e.changedTouches) {
    const x = t.clientX, y = t.clientY;
    if (type === 'start') {
      const b = hitButton(x, y);
      if (b) { touchMap.set(t.identifier, b); press(b); vibrate(8); continue; }
      if (x < input.w * 0.45) {
        if (save.settings.leftStyle === 'pads') { touchMap.set(t.identifier, 'pads'); padTouch(t.identifier, x, y); }
        else { const st = input.stick, fixed = save.settings.stickMode === 'fixed'; st.active = true; st.id = t.identifier; st.bx = fixed ? L.stickHome.x : x; st.by = fixed ? L.stickHome.y : Math.max(y, input.h * 0.35); st.x = x; st.y = y; touchMap.set(t.identifier, 'stick'); }
      } else if (x > input.w * 0.55) {
        // empty right side: nearest big button within a generous radius
        const near = nearestBig(x, y); if (near) { touchMap.set(t.identifier, near); press(near); vibrate(8); }
      }
    } else if (type === 'move') {
      const c = touchMap.get(t.identifier);
      if (c === 'stick') { input.stick.x = x; input.stick.y = y; const st = input.stick; const dx = x - st.bx, dy = y - st.by, d = Math.hypot(dx, dy), R = L.stickR; if (d > R * 1.25) { st.bx = x - dx / d * R * 1.25; st.by = y - dy / d * R * 1.25; } }
      else if (c === 'pads') padTouch(t.identifier, x, y);
      else if (SLIDE.has(c)) { const b = hitButton(x, y, 1.05); if (b && b !== c && SLIDE.has(b)) { release(c); press(b); touchMap.set(t.identifier, b); vibrate(6); } } // v1.4: slide a thumb from one action button onto another
    } else {
      const c = touchMap.get(t.identifier); touchMap.delete(t.identifier);
      if (c === 'stick') { input.stick.active = false; input.stick.id = null; }
      else if (c === 'pads') { delete input.pads[t.identifier]; release('down'); }
      else if (c) release(c);
    }
  }
  e.preventDefault();
}
function nearestBig(x, y) { const L = input.layout; let best = null, bd = 1e9; for (const b of ['jump', 'attack']) { const d = Math.hypot(x - L[b].x, y - L[b].y); if (d < bd) { bd = d; best = b; } } return bd < L.jump.r * 2.2 ? best : null; }
function padTouch(id, x, y) {
  const L = input.layout; let v = 0;
  if (Math.hypot(x - L.padD.x, y - L.padD.y) < L.padD.r * 1.3) v = 'D'; else v = x < (L.padL.x + L.padR.x) / 2 ? -1 : 1;
  input.pads[id] = v;
  if (Object.values(input.pads).includes('D')) press('down'); else release('down');
}
export function vibrate(ms) {
  if (!save.settings.haptics) return;
  try { const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics; if (H) H.impact({ style: ms > 20 ? 'MEDIUM' : 'LIGHT' }); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
}
export function initInput(canvas) {
  addEventListener('keydown', (e) => onKey(e, true)); addEventListener('keyup', (e) => onKey(e, false));
  addEventListener('blur', clearAll);
  const o = { passive: false };
  canvas.addEventListener('touchstart', (e) => onTouch(e, 'start'), o); canvas.addEventListener('touchmove', (e) => onTouch(e, 'move'), o);
  canvas.addEventListener('touchend', (e) => onTouch(e, 'end'), o); canvas.addEventListener('touchcancel', (e) => onTouch(e, 'end'), o);
}
// Called once per rendered frame: rebuild axes.
export function pollInput() {
  let x = 0, y = 0;
  if (keyAxes.has('L')) x -= 1; if (keyAxes.has('R')) x += 1; if (keyAxes.has('U')) y -= 1; if (keyAxes.has('D')) y += 1;
  const gp = pollPad(); if (gp && (gp.x || gp.y)) { x = gp.x; y = gp.y; }
  const st = input.stick;
  if (st.active && input.layout) {
    const dx = st.x - st.bx, dy = st.y - st.by, R = input.layout.stickR;
    let sx = clamp(dx / R, -1, 1), sy = clamp(dy / R, -1, 1);
    // v1.4: small radial dead zone, analog walk -> run (full speed at ~65% throw); up/down only on steep angles so running never ducks
    const d = Math.hypot(dx, dy) / R, ang = Math.abs(dy) / Math.max(1e-6, Math.hypot(dx, dy));
    if (d < 0.12) { sx = 0; sy = 0; } else { sx = Math.sign(dx) * Math.min(1, Math.max(0, (Math.abs(dx) / R - 0.08) / 0.57)); sy = d > 0.42 && ang > 0.74 ? Math.sign(dy) : 0; if (ang > 0.92) sx *= 0.5; }
    x = sx; y = sy;
    if (sy > 0) press('down'); else release('down'); if (sy < 0) press('up'); else release('up');
  } else if (save.settings.leftStyle === 'pads') {
    const v = Object.values(input.pads); if (v.includes(-1)) x = -1; if (v.includes(1)) x = x === -1 ? 0 : 1; if (v.includes('D')) y = 1;
  }
  if (input.simAxes) { x = input.simAxes.x; y = input.simAxes.y; }
  input.mx = x; input.my = y;
}
// ---------- drawing the touch overlay ----------
const ringCache = new Map();
function ringCanvas(r, active, S) { // v1.4: pre-rendered button body (was a fresh radial gradient per button per frame)
  const key = Math.round(r * 4) + (active ? 'a' : 'i') + S.toFixed(2); let c = ringCache.get(key); if (c) return c;
  const m = Math.ceil(r + 4 * S); c = document.createElement('canvas'); c.width = c.height = m * 2; c._m = m; const g = c.getContext('2d'), x = m, y = m;
  const gr = g.createRadialGradient(x, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, active ? 'rgba(255,226,160,0.45)' : 'rgba(46,52,60,0.42)'); gr.addColorStop(1, active ? 'rgba(120,80,30,0.5)' : 'rgba(10,10,20,0.55)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = 'rgba(12,10,20,0.6)'; g.lineWidth = 4.5 * S; g.stroke(); g.strokeStyle = active ? 'rgba(255,230,160,0.95)' : 'rgba(217,178,106,0.85)'; g.lineWidth = 2 * S; g.stroke();
  g.strokeStyle = 'rgba(160,230,140,0.35)'; g.lineWidth = 1.5 * S; g.beginPath(); g.arc(x, y, r - 3.5 * S, 3.7, 5.7); g.stroke();
  if (ringCache.size > 64) ringCache.clear(); ringCache.set(key, c); return c;
}
export function drawTouch(g, t, gadgetIcons, cooldowns = {}, flasks = 0) {
  const L = input.layout; if (!L || !input.touchActive && !input.forceTouch) return;
  let a = save.settings.ctrlOpacity;
  g.save(); g.lineWidth = 2.5 * L.s;
  const ring = (x, y, r, active, hl) => {
    g.globalAlpha = Math.min(1, a * (active ? 1.6 : 1.1));
    const rc = ringCanvas(r, active, L.s), m = rc._m; g.drawImage(rc, x - m, y - m);
    if (hl) { const p = (t * 2.2) % 1; g.globalAlpha = 1 - p; g.strokeStyle = '#ffe27a'; g.lineWidth = 4 * L.s; g.beginPath(); g.arc(x, y, r * (1 + p * 0.6), 0, 7); g.stroke(); g.lineWidth = 2.5 * L.s; g.globalAlpha = 1; g.strokeStyle = '#ffe27a'; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }
  };
  // left side
  if (save.settings.leftStyle === 'pads') {
    const v = Object.values(input.pads);
    for (const [k, dir, ic] of [['padL', -1, 'left'], ['padR', 1, 'right'], ['padD', 'D', 'down']]) { const p = L[k]; ring(p.x, p.y, p.r, v.includes(dir), input.highlight.move); g.globalAlpha = Math.min(1, a * 2); drawIcon(g, ic, p.x, p.y, p.r * 0.9, '#fff'); }
  } else {
    const st = input.stick; const bx = st.active ? st.bx : L.stickHome.x, by = st.active ? st.by : L.stickHome.y; const ca = a; a = save.settings.stickOpacity ?? a;
    ring(bx, by, L.stickR, false, input.highlight.move);
    const kx = st.active ? clamp(st.x - bx, -L.stickR, L.stickR) : 0, ky = st.active ? clamp(st.y - by, -L.stickR, L.stickR) : 0;
    g.globalAlpha = Math.min(1, a * 1.7); g.fillStyle = 'rgba(232,214,170,0.6)'; g.beginPath(); g.arc(bx + kx, by + ky, L.stickR * 0.42, 0, 7); g.fill(); g.strokeStyle = 'rgba(12,10,20,0.6)'; g.lineWidth = 2 * L.s; g.stroke(); a = ca;
  }
  // right side buttons
  for (const b of ['jump', 'attack', 'dash', 'hook', 'parry', 'skill1', 'skill2', 'flask', 'pause']) {
    if (input.visible[b] === false) continue;
    const p = L[b]; ring(p.x, p.y, p.r, input.held[b], input.highlight[b]);
    g.globalAlpha = Math.min(1, a * 2.1);
    const icon = b === 'skill1' ? gadgetIcons[0] : b === 'skill2' ? gadgetIcons[1] : b;
    drawIcon(g, icon, p.x, p.y, p.r * 0.95, { attack: '#ffd2b0', jump: '#d8ffc8', hook: '#ffe6a0', dash: '#c8fff4', parry: '#d8f0ff' }[b] || '#fff4dc');
    const cd = cooldowns[b]; if (cd > 0) { g.globalAlpha = 0.6; g.fillStyle = '#000'; g.beginPath(); g.moveTo(p.x, p.y); g.arc(p.x, p.y, p.r, -Math.PI / 2, -Math.PI / 2 + cd * Math.PI * 2); g.fill(); }
    if (b === 'flask') { g.globalAlpha = 1; g.fillStyle = '#fff'; g.font = `bold ${13 * L.s}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(String(flasks), p.x + p.r * 0.85, p.y + p.r * 0.95); }
  }
  g.restore();
}
// ---------- test / scripted input ----------
export function simButton(b, down) { if (down) press(b); else release(b); }
export function simAxes(x, y) { input.simAxes = x === null ? null : { x, y }; }
