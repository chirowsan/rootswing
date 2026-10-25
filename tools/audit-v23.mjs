// v2.3 QA audit: captures every key screen at small (640x360), wide (915x412) and portrait (360x640) phones and checks layout.
// usage: node tools/audit-v23.mjs <outDir> [vp,...]   -> <outDir>/<vp>-<screen>.png + <outDir>/audit.json
import { serve, launch, sleep } from './lib.mjs';
import fs from 'fs';
const out = process.argv[2] || 'shots/v23/audit'; fs.mkdirSync(out, { recursive: true });
const VPS = { small: { w: 640, h: 360, dpr: 2, mobile: true }, wide: { w: 915, h: 412, dpr: 2.6, mobile: true }, portrait: { w: 360, h: 640, dpr: 2, mobile: true } };
const want = (process.argv[3] || 'small,wide,portrait').split(',');
const { server, url } = await serve(); const report = {};
const CHECK = () => { // layout problems of the visible DOM overlay
  const vw = innerWidth, vh = innerHeight, bad = [], small = [];
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const inScroll = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p; } return null; };
  for (const el of document.querySelectorAll('#ui *, #rotate *, .cm *')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(), sc = inScroll(el);
    const name = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + (el.dataset.act ? '[' + el.dataset.act + ']' : '') + ' "' + (el.textContent || '').trim().slice(0, 24) + '"';
    if (!sc && (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1)) bad.push('offscreen ' + name + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
    const cs = getComputedStyle(el); if (el.children.length === 0 && (el.textContent || '').trim() && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible') bad.push('clipped ' + name);
    if ((el.tagName === 'BUTTON' || el.dataset.act) && !el.disabled && (r.height < 40 || r.width < 40)) small.push(name + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (el.children.length === 0 && (el.textContent || '').trim()) { const fs = parseFloat(cs.fontSize); if (fs < 11) small.push('tiny text ' + fs + 'px ' + name); } }
  return { bad: [...new Set(bad)].slice(0, 30), small: [...new Set(small)].slice(0, 30), open: (window.__RS && __RS.UI.ui.open) || null };
};
for (const vp of want) { const o = VPS[vp]; const { browser, page, errors } = await launch(o); await page.goto(url); await sleep(900); const E = (f, ...a) => page.evaluate(f, ...a); const rep = report[vp] = {};
  const shot = async (n, settle = 350) => { await sleep(settle); await E(() => __RS.renderNow()); await page.screenshot({ path: `${out}/${vp}-${n}.png` }); rep[n] = await E(CHECK); };
  await shot('00-firstboot', 1200);
  await E(() => { localStorage.clear(); const c = __RS.story.camp(); c.intro = true; c.unlocked = 6; __RS.save.progress.tutorialDone = true; __RS.save.progress.glimmers = 640; __RS.writeSave(); __RS.UI.showTitle(); }); await shot('01-title');
  if (vp === 'portrait') { await browser.close(); continue; }
  await E(() => __RS.UI.showSettings('title')); await shot('02-settings');
  await E(() => __RS.UI.showShop()); await shot('03-shop');
  await E(() => __RS.UI.showLoadout()); await shot('04-loadout');
  await E(() => __RS.UI.showJournal()); await shot('05-journal');
  await E(() => { __RS.UI.close && __RS.UI.close(); __RS.start('hub'); __RS.manual(true); __RS.step(60); }); await shot('06-hub');
  await E(() => { __RS.storyUI.showMap({ go() {}, free() {}, back() {} }); }); await shot('07-worldmap');
  await E(() => { __RS.UI.close && __RS.UI.close(); __RS.storyUI.playComic('intro', __RS.story.INTRO, () => {}, {}); }); await shot('08-comic', 900);
  await E(() => { __RS.skipComic(); __RS.game.spRun = null; __RS.start('run', { chapter: 1, seed: 4243 }); __RS.manual(true); __RS.step(2); __RS.skipComic(); __RS.step(40); }); await shot('09-ch1-start');
  await E(() => { const W = __RS.W, P = W.player; __RS.god(true); W.countdown = 0; const c = W.cells.find((c) => !c.branch && W.enemies.some((e) => !e.dead && e.cell === c.index && !e.boss)); const p = W.findFloorIn(c); P.x = p.x; P.y = p.y - P.h; W.updateRoom(false); W.snapCamera(); for (let i = 0; i < 90; i++) { if (i % 9 === 0) __RS.press('attack'); if (i % 9 === 3) __RS.release('attack'); __RS.step(1); } }); await shot('10-combat');
  await E(() => __RS.game.pause()); await shot('11-pause');
  await E(() => { __RS.UI.close(); __RS.game.paused = false; __RS.UI.showDeath('A thorn got you', 12, 30, { rooms: 7, kills: 9, cont: 2, next: __RS.story.nextGoal(1) }); }); await shot('12-death');
  await E(() => { __RS.UI.close(); __RS.UI.showVictory(120, { title: 'Chapter 1 clear!', kills: 31, time: '6:12', stars: 3, bonus: 40, diffLabel: 'Normal', next: __RS.story.nextGoal(1) }); }); await shot('13-victory');
  await E(() => { __RS.UI.close(); __RS.game.paused = false; __RS.game.spRun = null; __RS.start('boss', { chapter: 3, seed: 11 }); __RS.manual(true); __RS.step(2); __RS.skipComic(); __RS.step(90); }); await shot('14-boss-intro');
  await E(() => { __RS.W.countdown = 0; for (let i = 0; i < 240; i++) __RS.step(1); }); await shot('15-boss-fight');
  await E(() => { __RS.storyUI.playComic('ch5end', __RS.story.FINALE, () => {}, {}); }); await shot('16-ending', 900);
  await E(() => { __RS.skipComic(); __RS.UI.close && __RS.UI.close(); __RS.game.paused = false; __RS.save.progress.tutorialDone = false; __RS.start('tutorial'); __RS.manual(true); __RS.step(60); }); await shot('17-tutorial');
  rep.errors = errors.slice(0, 5); await browser.close(); }
fs.writeFileSync(`${out}/audit.json`, JSON.stringify(report, null, 1)); server.close();
for (const [vp, r] of Object.entries(report)) for (const [n, c] of Object.entries(r)) if (c && (c.bad?.length || c.small?.length)) console.log(vp, n, 'bad:', c.bad.length, 'small:', c.small.length);
console.log('errors', JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v.errors])))); process.exit(0);
