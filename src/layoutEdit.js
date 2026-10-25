// v2.1: drag-to-place touch buttons (custom layout, saved per device). Offsets are stored in layout units so they survive button-size changes.
import { save, writeSave } from './save.js';
import { input, computeLayout } from './input.js';
import { show, hooks, ic } from './ui.js';
export const EDITABLE = ['jump', 'attack', 'dash', 'hook', 'parry', 'skill1', 'flask', 'stickHome'];
export function showLayoutEditor(done) {
  const w = innerWidth, h = innerHeight; const L = computeLayout(w, h);
  const items = EDITABLE.map((b) => { const p = L[b]; const r = b === 'stickHome' ? L.stickR : p.r; return `<div class="le-b" data-b="${b}" style="left:${p.x - r}px;top:${p.y - r}px;width:${r * 2}px;height:${r * 2}px">${ic(b === 'stickHome' ? 'right' : b === 'skill1' ? 'popseed' : b, '#fff', Math.max(22, r * 0.9))}</div>`; }).join('');
  show('layout', `<div class="le">${items}<div class="le-bar"><span>✋ Drag the buttons</span><button class="big" data-act="leReset">Reset</button><button class="big primary" data-act="leDone">Done</button></div></div>`, 'le-show');
  hooks.layout = (a) => { if (a === 'leReset') { save.settings.btnPos = {}; writeSave(); computeLayout(w, h); showLayoutEditor(done); return true; } if (a === 'leDone') { delete hooks.layout; computeLayout(w, h); done && done(); return true; } return false; };
  document.querySelectorAll('.le-b').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId); const b = el.dataset.b, sx = e.clientX, sy = e.clientY, l0 = parseFloat(el.style.left), t0 = parseFloat(el.style.top);
      const mv = (ev) => { el.style.left = l0 + ev.clientX - sx + 'px'; el.style.top = t0 + ev.clientY - sy + 'px'; };
      const up = (ev) => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); moveButton(b, ev.clientX - sx, ev.clientY - sy, w, h); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
  });
}
// Shift one button by (dx, dy) screen px and save; clamps so a button can never leave the screen.
export function moveButton(b, dx, dy, w = innerWidth, h = innerHeight) {
  const L = computeLayout(w, h), s = L.s, p = L[b]; if (!p) return;
  const r = b === 'stickHome' ? L.stickR : p.r; const nx = Math.max(r, Math.min(w - r, p.x + dx)), ny = Math.max(r, Math.min(h - r, p.y + dy));
  const bp = save.settings.btnPos || (save.settings.btnPos = {}); const o = bp[b] || [0, 0];
  bp[b] = [Math.round((o[0] + (nx - p.x) / s) * 10) / 10, Math.round((o[1] + (ny - p.y) / s) * 10) / 10]; writeSave(); computeLayout(w, h);
}
