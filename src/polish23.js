// v2.3 presentation polish: chapter title ribbon + boss/warden intro cards (screen space, canvas only)
import * as ST from './story.js';
const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
export function introCard(W, e) {
  if (!W || !e || W.mode === 'tutorial' || W.mode === 'hub') return; const C = W.chapter && ST.CHAPTERS[W.chapter];
  const boss = e === W.boss || e.type === 'boss'; const name = boss ? (C ? C.boss : (e.info && e.info.name) || 'Boss') : (C ? C.wardName : (e.info && e.info.name) || 'Warden');
  W.icard = { t0: W.t, name, sub: boss ? 'GUARDIAN OF THE ROOT' : 'WARDEN', col: (C && C.col) || '#ffb13b', boss };
}
function band(g, y, h, cw, col, a) { g.globalAlpha = a; g.fillStyle = 'rgba(8,6,16,0.78)'; g.fillRect(0, y, cw, h); g.fillStyle = col; g.fillRect(0, y, cw, 2); g.fillRect(0, y + h - 2, cw, 2); g.globalAlpha = 1; }
export function drawIntro(g, W, cw, ch, s) {
  const I = W.icard; if (!I) return; const age = W.t - I.t0, L = 2.4; if (age > L || age < 0) { W.icard = null; return; }
  const inA = ease(age / 0.35), outA = 1 - ease((age - (L - 0.4)) / 0.4), a = Math.min(inA, outA), H = 64 * s, y = ch * 0.3;
  g.save(); g.translate((1 - inA) * -cw * 0.4 + (1 - outA) * cw * 0.4, 0); band(g, y, H, cw, I.col, 0.95 * a);
  g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = I.col; g.font = `900 ${11 * s}px system-ui,sans-serif`; g.fillText(I.sub.split('').join(String.fromCharCode(8202)), cw / 2, y + 16 * s);
  g.font = `900 ${26 * s}px system-ui,sans-serif`; g.lineWidth = 5 * s; g.strokeStyle = '#15131f'; g.strokeText(I.name, cw / 2, y + 40 * s); g.fillStyle = '#fff4dc'; g.fillText(I.name, cw / 2, y + 40 * s);
  g.restore(); g.globalAlpha = 1; g.textBaseline = 'alphabetic';
}
// chapter ribbon: slides in, medallion with the chapter number, name with outline; S.banner counts 4 -> 0
export function drawChapter(g, W, C, n, S, cw, ch, s) {
  const age = 4 - S.banner, inA = ease(age / 0.45), outA = Math.min(1, S.banner / 0.5), a = Math.min(inA, outA), H = 66 * s, y = ch * 0.12;
  g.save(); g.globalAlpha = a; const w = Math.min(cw * 0.9, 460 * s) * (0.6 + 0.4 * inA), x = cw / 2 - w / 2;
  const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(8,6,16,0)'); gr.addColorStop(0.18, 'rgba(8,6,16,0.8)'); gr.addColorStop(0.82, 'rgba(8,6,16,0.8)'); gr.addColorStop(1, 'rgba(8,6,16,0)');
  g.fillStyle = gr; g.fillRect(x, y, w, H); g.fillStyle = C.col; g.fillRect(x + w * 0.15, y, w * 0.7, 2 * s); g.fillRect(x + w * 0.15, y + H - 2 * s, w * 0.7, 2 * s);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = C.col; g.font = `900 ${12 * s}px system-ui,sans-serif`; g.fillText(('CHAPTER ' + n + (W.mode === 'boss' ? '  ·  BOSS' : '')).split('').join(String.fromCharCode(8202)), cw / 2, y + 17 * s);
  const name = W.mode === 'boss' ? C.boss : C.name; g.font = `900 ${24 * s}px system-ui,sans-serif`; g.lineWidth = 5 * s; g.strokeStyle = '#15131f'; g.strokeText(name, cw / 2, y + 42 * s); g.fillStyle = '#fff4dc'; g.fillText(name, cw / 2, y + 42 * s);
  g.restore(); g.textBaseline = 'alphabetic';
}
