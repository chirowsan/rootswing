// DOM menus: title, pause, settings, shop, loadout, journal, death and victory cards.
import { save, writeSave, resetSave, DEFAULT_SETTINGS } from './save.js';
import { sfx, applyVolumes, initAudio } from './audio.js';
import { drawIcon, PAL } from './art.js';
import { WEAPONS, GADGETS, UPGRADES } from './weapons.js';
import { ENEMY_INFO } from './enemies.js';
import { input, computeLayout } from './input.js';
import { has, spr, G } from './gfx.js';
import { missions, TYPES, CAPES, HATS, BADGES, CRITTERS, missionIcon, unlockedVines, wear, owns, dayKey, dailyMod } from './missions.js';
import { VINES } from './objective.js';
import { rewardIcon, rewardColor, capeSheet, drawHat } from './missionsWorld.js';
const $ = (s) => document.querySelector(s);
let root, onAct = {}, focusIdx = 0, lastWear = null;
export function initUI(handlers) {
  root = $('#ui'); onAct = handlers;
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; initAudio(); sfx(b.dataset.act === 'back' || b.dataset.act === 'resume' ? 'uiBack' : 'ui'); act(b.dataset.act, b.dataset.v, b); });
  root.addEventListener('input', (e) => { const r = e.target.closest('input[type=range]'); if (!r) return; save.settings[r.dataset.k] = +r.value; applyVolumes(); writeSave(); input.layout && onAct.relayout && onAct.relayout(); });
}
export const ui = { open: null };
export function isOpen() { return !!ui.open; }
export function close() { root.innerHTML = ''; root.className = ''; ui.open = null; }
export const hooks = {}; // v2.1: story screens (comic, map, moss, control prompt) claim their own button actions
export function show(name, html, cls = '') { ui.open = name; root.className = 'show ' + cls; root.innerHTML = html; focusIdx = 0; paintIcons(); markFocus(); }
function paintIcons() { root.querySelectorAll('canvas[data-icon]').forEach((c) => { const s = +c.dataset.size || 28, d = Math.min(2, devicePixelRatio || 1); c.width = c.height = s * d; c.style.width = c.style.height = s + 'px'; const g = c.getContext('2d'); g.scale(d, d); const n = c.dataset.icon; if (n.startsWith('spr:') && has(n.slice(4))) spr(g, n.slice(4), s / 2, s * 0.94, s * 0.86, 0.5, 1); else if (n.startsWith('hero:')) drawHeroPreview(g, s, n.slice(5)); else if (n.startsWith('hatx:')) drawHat(g, n.slice(5), s / 2, s * 0.68, s / 19, 1); else drawIcon(g, n.startsWith('spr:') ? 'pet' : n, s / 2, s / 2, s * 0.8, c.dataset.color || '#fff'); }); }
function drawHeroPreview(g, s, spec) { const H = G.hero; if (!H) return; const [cape, hat] = spec.split(','), F = H.f.idle0, k = s * 0.9 / F[3]; g.save(); g.translate(s / 2 - F[2] * k / 2, s * 0.05); g.scale(k, k); g.drawImage(capeSheet(H, cape) || H.img, F[0], F[1], F[2], F[3], 0, 0, F[2], F[3]); drawHat(g, hat, F[4] - 12, F[5] - 47, 4.4, 1); g.restore(); }
export const ic = (name, color = '#fff', size = 28) => `<canvas data-icon="${name}" data-color="${color}" data-size="${size}"></canvas>`;
function act(a, v, el) {
  if (ui.open && hooks[ui.open] && hooks[ui.open](a, v, el)) return;
  if (a === 'set') { const [k, val] = v.split(':'); save.settings[k] = isNaN(+val) ? val : +val; writeSave(); applyVolumes(); onAct.relayout && onAct.relayout(); showSettings(ui.back); return; }
  if (a === 'settings') { showSettings(ui.open); return; }
  if (a === 'back') { if (ui.back === 'pause') showPause(ui.pauseCtx); else if (ui.back === 'title') showTitle(); else { close(); onAct.resume && onAct.resume(); } return; }
  if (a === 'buy') { const u = UPGRADES.find((x) => x.id === v); if (u && save.progress.glimmers >= u.cost && !save.progress.unlocks[u.id]) { save.progress.glimmers -= u.cost; save.progress.unlocks[u.id] = true; if (u.id === 'sentry' && !save.progress.gadgets.includes('sentry')) save.progress.gadgets.push('sentry'); if (WEAPONS[u.id]) save.progress.weapon = u.id; writeSave(); sfx('unlock'); onAct.statsChanged && onAct.statsChanged(); } showShop(); return; }
  if (a === 'weapon') { save.progress.weapon = v; writeSave(); onAct.statsChanged && onAct.statsChanged(); showLoadout(); return; }
  if (a === 'swapGadgets') { save.progress.gadgets.reverse(); writeSave(); onAct.statsChanged && onAct.statsChanged(); showLoadout(); return; }
  if (a === 'reset') { if (el.dataset.armed) { resetSave(); onAct.toTitle(); } else { el.dataset.armed = 1; el.textContent = 'Tap again to erase everything'; } return; }
  if (a === 'board') { showBoard(); return; }
  if (a === 'wardrobe') { lastWear = null; showWardrobe(); return; }
  if (a === 'hudToggle') { const m = missions(); m.hud = !m.hud; writeSave(); showBoard(); return; }
  if (a === 'wear') { lastWear = v; const [k, id] = v.split(':'); wear(k, id); sfx('pickup'); showWardrobe(); onAct.statsChanged && onAct.statsChanged(); return; }
  if (onAct[a]) onAct[a](v);
}
// ---- keyboard / gamepad navigation of menus ----
function buttons() { return [...root.querySelectorAll('button:not([disabled])')]; }
function markFocus() { const b = buttons(); b.forEach((x, i) => x.classList.toggle('focus', i === focusIdx)); }
export function menuNav(dir, confirm, back) {
  const b = buttons(); if (!b.length) return;
  if (dir) { focusIdx = (focusIdx + dir + b.length) % b.length; markFocus(); b[focusIdx].scrollIntoView({ block: 'nearest' }); sfx('ui'); }
  if (confirm) b[focusIdx]?.click();
  if (back) { const bk = root.querySelector('[data-act=back],[data-act=resume]'); bk && bk.click(); }
}
// ---- screens ----
export function showTitle() {
  const hasRun = !!save.run;
  show('title', `<div class="title-wrap"><div class="logo"><span>ROOT</span><span class="sw">SWING</span></div>
  <div class="tag">${ic('hook', PAL.swing, 22)} swing · fight · grow ${ic('blade', '#bfe8ff', 22)}</div>
  <div class="col">${hasRun ? `<button class="big primary" data-act="continueRun">${ic('right', '#15131f', 22)} Continue run</button>` : ''}
  <button class="big ${hasRun ? '' : 'primary'}" data-act="play">${ic('jump', hasRun ? '#fff' : '#15131f', 22)} ${save.progress.tutorialDone ? 'Play' : 'Start'}</button>
  <button class="big" data-act="settings">${ic('gear', '#fff', 22)} Settings</button></div>
  <div class="foot">Made with love for Chirow · works offline · no ads, no sign-ups</div></div>`, 'title');
}
export function showPause(ctx) {
  ui.pauseCtx = ctx;
  const map = ctx === 'run' ? `<div class="pmap"><canvas id="pmap" width="720" height="320"></canvas><div class="legend"><b style="color:#ffe27a">■</b> you <b style="color:#7ff6ff">■</b> checkpoint <b style="color:#ff9a5a">■</b> mini-boss <b style="color:#ffe9a0">■</b> treasure <b style="color:#ff6a8a">□</b> boss door</div></div>` : '';
  show('pause', `<div class="card ${map ? 'wide pmapcard' : ''}"><h2>Paused</h2>${map}<div class="col">
  <button class="big primary" data-act="resume">${ic('right', '#15131f', 22)} Resume</button>
  <button class="big" data-act="settings">${ic('gear', '#fff', 22)} Settings</button>
  ${ctx === 'run' || ctx === 'boss' ? `<button class="big" data-act="leaveRun">${ic('door', '#fff', 22)} Give up run</button>` : ''}
  ${ctx === 'tutorial' ? `<button class="big" data-act="skipTutorial">${ic('right', '#fff', 22)} Skip practice</button>` : ''}
  <button class="big" data-act="toTitle">Title screen</button></div>
  <p class="hint">Glimmers you carry are banked when you return to the Seedhouse.</p></div>`);
  if (ctx === 'run') requestAnimationFrame(() => window.dispatchEvent(new Event('rs-pausemap')));
}
function seg(k, opts) { return `<div class="seg">${opts.map(([v, l]) => `<button data-act="set" data-v="${k}:${v}" class="${String(save.settings[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`; }
function row(label, ctl, help = '') { return `<div class="row"><div class="lab">${label}${help ? `<small>${help}</small>` : ''}</div>${ctl}</div>`; }
export function showSettings(back) {
  ui.back = back === 'settings' ? ui.back : back;
  const s = save.settings;
  show('settings', `<div class="card wide"><h2>Settings</h2><div class="scroll">
  ${row('Game speed', seg('speed', [[0.7, 'Very calm'], [0.8, 'Calm'], [0.9, 'Steady'], [1, 'Full']]), 'Slower = easier to control')}
  ${row('Difficulty', seg('difficulty', [['relaxed', 'Relaxed'], ['normal', 'Normal'], ['hard', 'Hard'], ['nightmare', 'Nightmare']]), 'Harder = more traps + foes, more stars')}
  ${row('Hook aim help', seg('hookAssist', [['true', 'On'], ['false', 'Off']]))}
  ${row('Screen shake', seg('shake', [['off', 'Off'], ['reduced', 'Low'], ['full', 'Full']]))}
  ${row('Left thumb', seg('leftStyle', [['stick', 'Stick'], ['pads', '◀ ▶ Buttons']]))}
  <h3 class="sect">Controls</h3>
  ${row('Stick style', seg('stickMode', [['float', 'Floating'], ['fixed', 'Fixed']]), 'Floating: the stick appears where your thumb lands')}
  ${row('Stick size', seg('stickSize', [[0.8, 'Small'], [1, 'Medium'], [1.25, 'Large']]))}
  ${row('Stick see-through', `<input type="range" min="0.15" max="0.9" step="0.05" value="${s.stickOpacity ?? 0.5}" data-k="stickOpacity">`)}
  ${row('Button size', seg('ctrlSize', [[0.85, 'Small'], [1, 'Medium'], [1.2, 'Large']]))}
  ${row('Button places', `<button data-act="editLayout">Move buttons</button>`, 'Drag each button where your thumb likes it')}
  ${row('Button see-through', `<input type="range" min="0.2" max="0.9" step="0.05" value="${s.ctrlOpacity}" data-k="ctrlOpacity">`)}
  ${row('Vibration', seg('haptics', [['true', 'On'], ['false', 'Off']]))}
  ${row('Music', `<input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music">`)}
  ${row('Sound effects', `<input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx">`)}
  ${row('Graphics', seg('quality', [['auto', 'Auto'], ['high', 'Sharp'], ['low', 'Fast']]))}
  ${row('Erase save', `<button class="danger" data-act="reset">Erase progress</button>`)}
  </div><div class="col"><button class="big primary" data-act="back">Done</button></div></div>`);
  // booleans saved as strings by seg → normalise
  for (const k of ['hookAssist', 'haptics']) if (typeof save.settings[k] === 'string') { save.settings[k] = save.settings[k] === 'true'; writeSave(); }
}
export function showShop() {
  const p = save.progress;
  const cards = UPGRADES.map((u) => { const owned = p.unlocks[u.id], locked = u.req && !p.unlocks[u.req], afford = p.glimmers >= u.cost;
    return `<div class="up ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}">${ic(u.icon, owned ? '#7fe08a' : '#ffe27a', 34)}<div class="t"><b>${u.name}</b><small>${u.desc}</small></div>
    ${owned ? '<span class="tick">✓</span>' : locked ? `<span class="lock">needs ${UPGRADES.find((x) => x.id === u.req).name}</span>` : `<button data-act="buy" data-v="${u.id}" ${afford ? '' : 'disabled'}>${ic('glimmer', PAL.glimmer, 16)} ${u.cost}</button>`}</div>`; }).join('');
  show('shop', `<div class="card wide"><h2>${ic('gear', '#ffd36b', 26)} Seed Workshop <span class="bank">${ic('glimmer', PAL.glimmer, 20)} ${p.glimmers}</span></h2><div class="scroll grid">${cards}</div>
  <div class="col"><button class="big primary" data-act="back">Done</button></div></div>`);
}
export function showLoadout() {
  const p = save.progress;
  const ws = Object.entries(WEAPONS).map(([id, w]) => { const has = p.unlocks[id]; return `<button class="wpn ${p.weapon === id ? 'on' : ''}" data-act="weapon" data-v="${id}" ${has ? '' : 'disabled'}>${ic(w.icon, has ? w.color : '#666', 38)}<b>${has ? w.name : '???'}</b><small>${has ? w.desc : 'Buy in the Workshop'}</small></button>`; }).join('');
  const gs = p.gadgets.map((g, i) => `<div class="gad">${ic(GADGETS[g].icon, '#fff', 30)}<b>${i ? 'Skill 2' : 'Skill 1'}: ${GADGETS[g].name}</b><small>${GADGETS[g].desc}</small></div>`).join('');
  show('loadout', `<div class="card wide"><h2>${ic('blade', '#bfe8ff', 26)} Weapon Rack</h2><div class="scroll"><div class="wgrid">${ws}</div><h3>Gadgets</h3><div class="ggrid">${gs}${p.gadgets.length > 1 ? `<button data-act="swapGadgets">⇄ Swap</button>` : ''}</div></div>
  <div class="col"><button class="big primary" data-act="back">Done</button></div></div>`);
}
export const storyApi = { journal: () => '', next: () => null }; // filled by storyui.js (keeps ui.js free of story imports)
function journalStory() { return storyApi.journal(); }
function nextHtml(n) { return n ? `<div class="next-goal">${ic(n.icon, '#ffe27a', 24)}<b>${n.t}</b></div>` : ''; }
export function showJournal() {
  const p = save.progress;
  show('journal', `<div class="card"><h2>${ic('heart', '#ff9ab0', 26)} Sprig's Journal</h2>
  <div class="stats"><div><b>${p.runs}</b>runs</div><div><b>${p.wins}</b>wins</div><div><b>${p.totalGlimmers}</b>glimmers found</div><div><b>${p.minibossBeaten}</b>Wardens beaten</div></div>
  ${journalStory()}
  <div class="col"><button class="big" data-act="replayTutorial">${ic('jump', '#fff', 22)} Practice again</button><button class="big primary" data-act="back">Done</button></div></div>`);
}
// v1.2 painted results screens: full-bleed key art, count-up glimmers, unlock progress
function dailyHtml(d) { return d ? `<div class="daily-res">${ic('sun', '#ffd36b', 26)}${ic(d.mod.icon, d.mod.color, 20)}<b>${d.score}</b>${ic('trophy', '#ffe27a', 22)}<b>${d.best}</b>${d.newBest ? '<b class="first">BEST!</b>' : ''}</div>` : ''; }
function unlockList() {
  const p = save.progress, out = [];
  for (const u of UPGRADES) { if (p.unlocks[u.id] || (u.req && !p.unlocks[u.req])) continue; out.push({ u, ready: p.glimmers >= u.cost }); }
  out.sort((a, b) => (b.ready - a.ready) || (a.u.cost - b.u.cost)); return out.slice(0, 3);
}
function unlockHtml() {
  const L = unlockList(), bank = save.progress.glimmers;
  if (!L.length) return `<div class="unl"><div class="unl-h">Every upgrade unlocked!</div></div>`;
  return `<div class="unl"><div class="unl-h">${ic('glimmer', '#ffe27a', 16)} Bank <b>${bank}</b> &middot; Seedhouse unlocks</div>${L.map(({ u, ready }) => `<div class="unl-r ${ready ? 'ready' : ''}">${ic(u.icon, ready ? '#ffe27a' : '#b9b2d6', 20)}<span>${u.name}</span><i style="--p:${Math.min(1, bank / u.cost)}"></i><em>${ready ? 'Ready!' : bank + '/' + u.cost}</em></div>`).join('')}</div>`;
}
function countUp() {
  const els = [...root.querySelectorAll('[data-count]')], t0 = performance.now(), dur = 1100, name = ui.open;
  const tick = (now) => { if (ui.open !== name) return; const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    for (const el of els) el.textContent = Math.round(+el.dataset.count * e); if (k < 1) requestAnimationFrame(tick); else root.querySelector('.res-glim')?.classList.add('pop'); };
  requestAnimationFrame(tick);
}
export function showDeath(info, kept, found, stats) {
  info = info && info.name ? info : ENEMY_INFO.thorns;
  show('death', `<div class="res-art death-art"></div><div class="res death"><h2>Sprig needs a rest</h2>
  <div class="res-glim">${ic('glimmer', '#ffe27a', 30)}<b data-count="${kept}">0</b><span>glimmers kept${found !== kept ? ` <small>(of ${found} found)</small>` : ''}</span></div>
  <div class="cause"><div class="who">Knocked out by <b>${info.name}</b></div><div class="tip">${ic('glimmer', '#ffe27a', 18)} ${info.tip}</div></div>
  <div class="stats"><div><b data-count="${stats.rooms}">0</b>rooms explored</div><div><b data-count="${stats.kills}">0</b>baddies popped</div></div>
  ${nextHtml(stats.next)}${dailyHtml(stats.daily)}${unlockHtml()}
  <div class="col"><button class="big primary" data-act="toHub">${ic('door', '#15131f', 22)} Back to the Seedhouse</button></div></div>`, 'results');
  countUp();
}
export function showVictory(glim, stats) {
  const first = save.progress.wins === 1, st = stats.stars || 1;
  const star = (on, i) => `<span class="star${on ? ' on' : ''}" style="animation-delay:${0.4 + i * 0.35}s"><svg viewBox="0 0 24 24" width="54" height="54"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="${on ? '#ffe27a' : '#3a3450'}" stroke="#15131f" stroke-width="1.6" stroke-linejoin="round"/></svg></span>`;
  show('victory', `<div class="res-art win-art"></div><div class="res win"><h2>${stats.title || (stats.final ? 'The Great Root is restored!' : 'The furnace is calm!')}</h2>
  <div class="root-restored">${['#a6f05a', '#8ff6ff', '#ffa6d8', '#ffe27a'].map((c, i) => `<i style="background:${c};animation-delay:${i * 0.15}s"></i>`).join('')}</div>
  <div class="stars">${[0, 1, 2].map((i) => star(i < st, i)).join('')}</div>${stats.bonus ? `<b class="first">${stats.diffLabel} bonus: +${stats.bonus} ★</b>` : ''}${first ? '<b class="first">First victory!</b>' : ''}
  <div class="res-glim">${ic('glimmer', '#ffe27a', 30)}<b data-count="${glim}">0</b></div>
  <div class="stats"><div><b>${stats.time}</b>⏱${stats.best ? ' <b class="first">BEST!</b>' : ''}</div><div><b>${stats.bestTime || stats.time}</b>🏆</div><div><b data-count="${stats.kills}">0</b>${ic('attack', '#fff', 16)}</div><div><b>${stats.treasures || 0}</b>${ic('glimmer', '#ffe27a', 16)}</div></div>
  ${stats.newVine ? `<div class="new-vine"><span style="background:linear-gradient(90deg,${stats.newVine.dark},${stats.newVine.light},${stats.newVine.dark})"></span>${ic('hook', stats.newVine.light, 22)} NEW!</div>` : ''}
  ${nextHtml(stats.next)}${dailyHtml(stats.daily)}${unlockHtml()}
  <div class="col">${stats.nextCh ? `<button class="big primary" data-act="playChapter" data-v="${stats.nextCh}">${ic('play', '#15131f', 22)} Chapter ${stats.nextCh}</button>` : ''}<button class="big ${stats.nextCh ? '' : 'primary'}" data-act="toHub">${ic('door', stats.nextCh ? '#fff' : '#15131f', 22)} Home to the Seedhouse</button></div></div>`, 'results');
  countUp();
}
export function showRotate(on) { $('#rotate').style.display = on ? 'flex' : 'none'; }

// ---- v1.8 Mission Board + Wardrobe: icon-first, numbers only, big touch targets ----
function noteHtml(mi) {
  const T = TYPES[mi.type], k = Math.min(1, mi.prog / mi.target);
  const extra = mi.type === 'quick' ? `<span class="mx">${ic('clock', '#7a5a2a', 18)}${Math.floor(mi.limit / 60)}:${String(mi.limit % 60).padStart(2, '0')}</span>` : mi.type === 'chain' ? `<span class="mx">×${mi.target}</span>` : '';
  return `<div class="note" data-type="${mi.type}"><i class="pin"></i><div class="ni">${ic(missionIcon(mi), T.color === '#ffe27a' ? '#c9961a' : '#3a5a2a', 54)}</div>${extra}
  <div class="bar"><i style="width:${k * 100}%;background:${T.color}"></i></div><b>${Math.min(mi.prog, mi.target)}/${mi.target}</b>
  <div class="gift">${ic('gift', '#d8622a', 20)}${ic(rewardIcon(mi.reward), rewardColor(mi.reward), 26)}</div></div>`;
}
export function showBoard() {
  const m = missions(), key = dayKey(), mod = dailyMod(key), today = m.daily.date === key;
  show('board', `<div class="card board-ui"><div class="board-roof"></div><div class="board-face">
  <div class="notes">${m.active.slice(0, 3).map(noteHtml).join('')}
  <div class="note daily"><i class="pin"></i><div class="ni">${ic('sun', '#e8a21a', 44)}${ic(mod.icon, mod.color, 26)}</div>
  <div class="best">${ic('trophy', '#c9961a', 20)}<b>${today ? m.daily.best : 0}</b></div>
  <button class="playd" data-act="startDaily" aria-label="daily">${ic('play', '#15131f', 26)}</button></div></div></div>
  <div class="board-btns"><button data-act="wardrobe" aria-label="wardrobe">${ic('hero:' + m.wardrobe.cape + ',' + m.wardrobe.hat, '#fff', 40)}</button>
  <button data-act="hudToggle" aria-label="tracker" class="${m.hud ? 'on' : ''}">${ic('eye', m.hud ? '#5ff2e6' : '#777', 30)}</button>
  <div class="medals">${ic('badge', '#ffe27a', 22)}<b>${m.badges.length}</b>${ic('star', '#ffe27a', 22)}<b>${m.done}</b></div>
  <button class="big primary" data-act="back">${ic('right', '#15131f', 22)}</button></div></div>`, 'boardwrap');
}
export function showWardrobe() {
  const m = missions(), w = m.wardrobe, vines = unlockedVines().map((v) => v.id);
  const item = (kind, id, icon, color, on, got) => `<button class="wi ${on ? 'on' : ''}" data-act="wear" data-v="${kind}:${id}" ${got ? '' : 'disabled'} aria-label="${kind} ${id}">${got ? icon : ic('lock', '#665e80', 26)}</button>`;
  const capes = CAPES.map((c) => item('cape', c.id, c.id === 'none' ? ic('cape', '#555', 30) : `<i class="sw" style="background:linear-gradient(160deg,${c.b},${c.a})"></i>`, '', w.cape === c.id, c.id === 'none' || owns(m, 'cape:' + c.id))).join('');
  const hats = HATS.map((h) => item('hat', h.id, (h.id === 'none' ? ic('hat', '#555', 30) : ic('hatx:' + h.id, '#fff', 40)), '', w.hat === h.id, h.id === 'none' || owns(m, 'hat:' + h.id))).join('');
  const vns = VINES.map((v) => item('vine', v.id, `<i class="sw vine" style="background:${v.rainbow ? 'linear-gradient(90deg,#ff5a5a,#ffd34a,#5ae07a,#5ab4ff,#b45aff)' : `linear-gradient(90deg,${v.dark},${v.light},${v.dark})`}"></i>`, '', (save.progress.vine || 'green') === v.id, vines.includes(v.id))).join('');
  const pets = ['none', ...CRITTERS].map((c) => item('pet', c, c === 'none' ? ic('pet', '#555', 30) : ic('spr:cr_' + c, '#fff', 40), '', w.pet === c, c === 'none' || owns(m, 'pet:' + c))).join('');
  const wpns = ['blade', 'hammer', 'whip'].map((id) => item('wpn', id, ic('spr:w_' + id, '#fff', 40), '', (save.progress.weapon || 'blade') === id, id === 'blade' || !!save.progress.unlocks[id])).join(''); // v2.0 fighting styles
  const badges = BADGES.map((b) => `<span class="bd ${m.badges.includes(b.id) ? 'on' : ''}">${ic(b.icon, m.badges.includes(b.id) ? b.color : '#4a4462', 26)}${b.n ? `<small>${b.n}</small>` : ''}</span>`).join('');
  show('wardrobe', `<div class="card wide wardrobe"><div class="wr-main"><div class="hero-prev">${ic('hero:' + w.cape + ',' + w.hat, '#fff', 150)}</div>
  <div class="scroll wr-rows"><div class="wr">${ic('blade', '#bff5c8', 24)}${wpns}</div><div class="wr">${ic('cape', '#ffe27a', 24)}${capes}</div><div class="wr">${ic('hat', '#ffe27a', 24)}${hats}</div><div class="wr">${ic('hook', '#9be070', 24)}${vns}</div><div class="wr">${ic('pet', '#ff9ab0', 24)}${pets}</div>
  <div class="wr badges">${badges}</div></div></div>
  <div class="col"><button class="big primary" data-act="board">${ic('board', '#15131f', 22)}</button></div></div>`, 'boardwrap');
  { const b = buttons(), j = b.findIndex((x) => x.dataset.v === lastWear), k = j >= 0 ? j : b.findIndex((x) => x.classList.contains('on')); if (k >= 0) { focusIdx = k; markFocus(); } }
}
