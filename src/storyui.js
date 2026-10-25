// v2.1 story screens: comic panel player, chapter map, Elder Moss talk, first-run control prompt, journal lore.
// Big art, few words, big font, icon-first; every screen has a Skip / Back.
import { show, close, ui, ic, hooks, storyApi } from './ui.js';
import { save, writeSave } from './save.js';
import { sfx, audio } from './audio.js';
import { CHAPTERS, CH_N, LORE, camp, seedTotal, freedCount, doneCount, isUnlocked, currentChapter, mossLines, nextGoal, SEEDS_PER } from './story.js';
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const ICONS = { seed15: ['glimmer', '#a6f05a', '15'], seed3: ['glimmer', '#a6f05a', '3'], warden4: ['shield', '#ffb13b', '4'], warden1: ['shield', '#ffb13b', '1'], heart: ['heart', '#ff9ab0', ''], door: ['door', '#ffe27a', ''] };
function iconRow(list) {
  if (!list || !list.length) return '';
  return `<div class="cm-icons">${list.map((k) => { if (k.startsWith('stamp')) { const n = +k.slice(5); return `<span class="cm-stamps">${[1, 2, 3, 4, 5].map((i) => `<i class="${i < n ? 'on' : i === n ? 'on pop' : ''}">${i}</i>`).join('')}</span>`; }
    const d = ICONS[k]; return d ? `<span>${ic(d[0], d[1], 40)}${d[2] ? `<b>${d[2]}</b>` : ''}</span>` : ''; }).join('<em>+</em>')}</div>`;
}
// ---------------- comic player ----------------
const C = { panels: null, i: 0, done: null, tok: 0, auto: 0, name: '' };
export const comic = C;
export function playComic(name, panels, done, opts = {}) {
  audio.ending = /fin|ch5end|ch6end/i.test(name); C.panels = panels; C.i = 0; C.done = done; C.auto = opts.auto ?? 6500; C.name = name; C.log = C.log || []; C.log.push(name); C.skipped = false;
  renderPanel();
}
function renderPanel() {
  const p = C.panels[C.i], n = C.panels.length, tok = ++C.tok;
  const hue = p.hue ? `filter:hue-rotate(${p.hue}deg) saturate(1.1)` : '';
  const over = p.over ? `<img class="cm-over ${p.over === 's_moss' ? 'left' : ''}" src="gfx/${p.over}.webp" alt="" style="${p.over !== 's_moss' ? hue : ''}">` : '';
  const mix = p.mix !== undefined ? `<div class="cm-mix"><img src="gfx/s_root0.webp" alt="" style="opacity:${1 - p.mix}"><img class="grow" src="gfx/s_root1.webp" alt="" style="--k:${p.mix};--k0:${Math.max(0, p.mix - 0.2)}"></div>` : '';
  show('comic', `<div class="cm ${p.fit === 'contain' ? 'contain' : ''}" data-panel="${esc(p.bg)}" data-i="${C.i}">
    <div class="cm-art ${p.zoom ? 'zoom' : ''}" style="background-image:url(gfx/${p.bg}.webp);${hue}"></div>${p.fit === 'contain' ? `<img class="cm-fit" src="gfx/${p.bg}.webp" alt="">` : ''}${mix}${over}
    ${p.title ? `<div class="cm-title">${esc(p.title)}</div>` : ''}
    <div class="cm-cap">${iconRow(p.icons)}<span>${esc(p.cap)}</span></div>
    <div class="cm-dots">${C.panels.map((_, j) => `<i class="${j === C.i ? 'on' : j < C.i ? 'seen' : ''}"></i>`).join('')}</div>
    <button class="cm-next" data-act="cmNext" aria-label="Next">${ic(C.i === n - 1 ? 'play' : 'right', '#15131f', 34)}</button>
    <button class="cm-skip" data-act="cmSkip">Skip ${ic('right', '#fff', 16)}${ic('right', '#fff', 16)}</button>
    ${C.auto ? `<div class="cm-bar"><i style="animation-duration:${C.auto}ms"></i></div>` : ''}</div>`, 'comic');
  sfx('ui');
  if (C.auto) setTimeout(() => { if (C.tok === tok && ui.open === 'comic') nextPanel(); }, C.auto);
}
function nextPanel() { if (C.i < C.panels.length - 1) { C.i++; renderPanel(); } else finish(); }
function finish() { const d = C.done; C.done = null; C.tok++; close(); d && d(); }
export function skipComic() { C.skipped = true; finish(); }
hooks.comic = (a) => { if (a === 'cmNext') { nextPanel(); return true; } if (a === 'cmSkip' || a === 'back') { skipComic(); return true; } return false; };
// tap anywhere on the art = next (big target for small hands)
document.addEventListener('click', (e) => { if (ui.open !== 'comic' || e.target.closest('button')) return; if (e.target.closest('.cm')) nextPanel(); });
// ---------------- chapter map ----------------
const NODE = [null, [14, 70], [32, 46], [50, 66], [68, 40], [86, 22], [88, 58]]; // % positions over the cliff vista (p_intro6)
export function showMap(h = {}) {
  const c = camp(), cur = currentChapter(), fresh = c.fresh; c.fresh = 0; writeSave();
  const node = (n) => { const C = CHAPTERS[n], lock = !isUnlocked(n), done = !!c.done[n], [x, y] = NODE[n];
    return `<button class="mp-node ${lock ? 'lock' : done ? 'done' : n === cur ? 'cur' : ''} ${fresh === n ? 'fresh' : ''}" style="left:${x}%;top:${y}%;--c:${C.col}" data-act="${lock ? 'mpLocked' : 'mpGo'}" data-v="${n}" ${lock ? 'aria-disabled="true"' : ''}>
      <span class="mp-dot">${lock ? ic('lock', '#cfc8e8', 30) : done ? ic('star', '#15131f', 30) : `<b>${n}</b>`}</span>
      <span class="mp-name">${lock ? '???' : esc(C.name)}</span>${!lock ? `<span class="mp-seeds">${[0, 1, 2].map((i) => `<i class="${i < (c.seeds[n] || 0) ? 'on' : ''}"></i>`).join('')}</span>` : ''}</button>`; };
  const path = [1, 2, 3, 4].map((n) => { const [x1, y1] = NODE[n], [x2, y2] = NODE[n + 1]; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${isUnlocked(n + 1) ? 'open' : ''}"/>`; }).join('');
  show('map', `<div class="mp"><div class="mp-art"></div><svg class="mp-path" viewBox="0 0 100 100" preserveAspectRatio="none">${path}</svg>
    ${[1, 2, 3, 4, 5].map(node).join('')}${isUnlocked(6) ? node(6).replace('mp-node', 'mp-node secret') : ''}
    <div class="mp-top"><span>${ic('glimmer', '#a6f05a', 26)}<b>${seedTotal()}/15</b></span><span>${ic('shield', '#ffb13b', 26)}<b>${freedCount()}/4</b></span><span>${ic('star', '#ffe27a', 26)}<b>${doneCount()}/5</b></span>${c.ng ? `<span class="ng">NG+</span>` : ''}${(c.sparks || 0) > 0 && !isUnlocked(6) ? `<span class="spk">${ic('glimmer', '#ffb36a', 24)}<b>${c.sparks}/5</b></span>` : ''}</div>
    <div class="mp-bot"><button class="big mp-back" data-act="back">${ic('left', '#fff', 22)} Seedhouse</button>
      <button class="big primary mp-play" data-act="mpGo" data-v="${cur}">${ic('play', '#15131f', 22)} Chapter ${cur}</button>
      ${c.ending ? `<button class="big mp-ng ${c.ngOn ? 'on' : ''}" data-act="mpNG">${ic('star', c.ngOn ? '#15131f' : '#ffe27a', 22)} New Game+ ${c.ngOn ? 'ON' : 'OFF'}</button>` : ''}
      <button class="big mp-free" data-act="mpFree">${ic('dash', '#fff', 22)} Free run</button></div></div>`, 'map');
  ui.mapH = h;
  if (fresh) sfx('unlock');
  const b = [...document.querySelectorAll('#ui button:not([disabled])')]; const i = b.findIndex((x) => x.classList.contains('mp-play')); if (i >= 0) { b.forEach((x, j) => x.classList.toggle('focus', j === i)); }
}
hooks.map = (a, v, el) => {
  const h = ui.mapH || {};
  if (a === 'mpGo') { const n = +v; if (!isUnlocked(n)) return true; close(); h.go && h.go(n); return true; }
  if (a === 'mpLocked') { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); sfx('uiBack'); return true; }
  if (a === 'mpFree') { close(); h.free && h.free(); return true; }
  if (a === 'mpNG') { const c = camp(); c.ngOn = !c.ngOn; writeSave(); showMap(h); return true; }
  if (a === 'back') { close(); h.back && h.back(); return true; }
  return false;
};
// ---------------- Elder Moss ----------------
export function showMoss(h = {}) {
  const M = mossLines();
  show('moss', `<div class="moss"><img class="moss-pic" src="gfx/s_moss.webp" alt="">
    <div class="moss-talk"><h2>Elder Moss</h2>${M.lines.map((l, i) => `<p class="${i === 1 ? 'goal' : ''}">${i === 1 ? ic(M.goal.icon, '#ffe27a', 24) : ''}${esc(l)}</p>`).join('')}
    <div class="moss-row"><span>${ic('glimmer', '#a6f05a', 22)}<b>${seedTotal()}/15</b></span><span>${ic('shield', '#ffb13b', 22)}<b>${freedCount()}/4</b></span><span>${ic('eye', '#c9b8ff', 22)}<b>${camp().lore.length}/10</b></span></div>
    <div class="col"><button class="big primary" data-act="mossMap">${ic('door', '#15131f', 22)} Chapter map</button><button class="big" data-act="mossStory">${ic('play', '#fff', 22)} Story so far</button><button class="big" data-act="back">${ic('left', '#fff', 22)} Bye!</button></div></div></div>`, 'moss');
  ui.mossH = h;
}
hooks.moss = (a) => { const h = ui.mossH || {}; if (a === 'mossMap') { close(); h.map && h.map(); return true; } if (a === 'mossStory') { close(); h.story && h.story(); return true; } if (a === 'back') { close(); h.back && h.back(); return true; } return false; };
// ---------------- journal + results helpers ----------------
storyApi.journal = () => { const c = camp();
  return `<h3>${ic('star', '#ffe27a', 18)} Quest: ${seedTotal()}/15 seeds · ${freedCount()}/4 Wardens · ${doneCount()}/5 chapters</h3>
  <div class="lore">${LORE.map((l) => c.lore.includes(l.id) ? `<div class="leaf on">${ic('eye', '#c9b8ff', 18)}<span>${esc(l.t)}</span></div>` : `<div class="leaf">${ic('lock', '#6a6488', 18)}<span>Memory Leaf · Chapter ${l.ch}</span></div>`).join('')}</div>`; };
storyApi.next = nextGoal;
export { nextGoal };
