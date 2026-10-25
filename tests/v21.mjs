// ROOTSWING v2.1 tests: story campaign flow + modern-feel numbers (input latency, buffers, coyote, accel). Usage: node tests/v21.mjs
import { serve, launch, sleep } from '../tools/lib.mjs';
const results = []; const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${info}`); };
const { server, url } = await serve();
async function fresh(opts = {}) { const L = await launch(opts); await L.page.goto(url); await sleep(700); return L; }
const E = (page, fn, ...a) => page.evaluate(fn, ...a);
// ---------- FEEL: numbers + frame-exact behaviour ----------
{ const { browser, page, errors } = await fresh();
  const F = await E(page, () => __RS.FEEL);
  ok('feel: constants', F.TURN_K >= 1.5 && F.AIR_ACC > 1200 && F.APEX_V >= 90 && F.APEX_G <= 0.55 && F.DASH_BUF >= 0.1 && F.ATK_BUF >= 0.12 && F.DASH_JUMP_K >= 1.2 && F.FAST_FALL > 600, JSON.stringify(F));
  const m = await E(page, () => { __RS.start('tutorial'); __RS.god(true); __RS.manual(true); __RS.step(200); const W = __RS.W, P = W.player, RUN = 182; const out = {};
    const settle = () => { __RS.axes(0, 0); P.vx = 0; P.vy = 0; __RS.step(30); };
    settle(); const x0 = P.x; __RS.axes(1, 0); let f = 0; while (P.vx < RUN * 0.9 && f < 60) { __RS.step(1); f++; } out.accelFrames = f;
    __RS.step(20); __RS.axes(-1, 0); f = 0; while (P.vx > -RUN * 0.9 && f < 60) { __RS.step(1); f++; } out.turnFrames = f; out.skid = P.skidT > 0 || f < 60;
    __RS.step(20); __RS.axes(0, 0); f = 0; while (Math.abs(P.vx) > 5 && f < 60) { __RS.step(1); f++; } out.stopFrames = f;
    settle(); __RS.press('jump'); __RS.step(1); out.jumpLatencyVy = P.vy; __RS.release('jump'); __RS.step(80);
    // jump buffer: press while falling, a few frames before touching down
    const gy = P.y; const drop = (lead) => { settle(); P.y = gy - 140; P.vy = 0; P.coyote = 0; let n = 0; while (P.y < gy - 1 && n < 200) { __RS.step(1); n++; } const land = n; settle(); P.y = gy - 140; P.vy = 0; P.coyote = 0; for (let i = 0; i < land - lead; i++) __RS.step(1); __RS.press('jump'); __RS.step(1); __RS.release('jump'); let minVy = 1e9; for (let i = 0; i < lead + 6; i++) { __RS.step(1); minVy = Math.min(minVy, P.vy); } __RS.step(70); return minVy; };
    out.buf6 = drop(6); out.buf20 = drop(20);
    // coyote: leave the ground, then press jump late
    const coy = (late) => { settle(); __RS.step(2); P.y -= 200; // lift off the ground but keep the coyote timer the last grounded frame set
    for (let i = 0; i < late; i++) __RS.step(1); __RS.press('jump'); __RS.step(1); __RS.release('jump'); const vy = P.vy; __RS.step(80); return vy; };
    out.coy4 = coy(4); out.coy14 = coy(14);
    // dash buffer: press during the cooldown, fires when it ends
    settle(); __RS.axes(1, 0); __RS.press('dash'); __RS.step(1); __RS.release('dash'); let seen = 0; while (P.dashCd > 0.09 && seen < 60) { __RS.step(1); seen++; } __RS.press('dash'); __RS.step(1); __RS.release('dash'); let redash = false; for (let i = 0; i < 10; i++) { __RS.step(1); if (P.dashT > 0) redash = true; } out.dashBuf = redash; __RS.axes(0, 0); __RS.step(40);
    // dash -> jump cancel keeps momentum
    settle(); __RS.axes(1, 0); __RS.press('dash'); __RS.step(1); __RS.release('dash'); __RS.step(3); __RS.press('jump'); __RS.step(1); __RS.release('jump'); out.dashJump = { vy: P.vy, vx: P.vx }; __RS.axes(0, 0); __RS.step(80);
    // attack buffer: tap during a parry lock -> swing starts when the lock ends
    settle(); P.parryLock = 0.08; __RS.press('attack'); __RS.step(1); __RS.release('attack'); const during = !!P.atk; let atk = false; for (let i = 0; i < 9; i++) { __RS.step(1); if (P.atk) atk = true; } out.atkBuf = { during, after: atk }; __RS.step(60);
    // fast fall: hold down in the air
    settle(); P.y = gy - 400; P.vy = 0; __RS.axes(0, 1); let maxv = 0; for (let i = 0; i < 40; i++) { __RS.step(1); maxv = Math.max(maxv, P.vy); } out.fastFall = maxv; __RS.axes(0, 0); __RS.step(60);
    settle(); P.y = gy - 400; P.vy = 0; maxv = 0; for (let i = 0; i < 40; i++) { __RS.step(1); maxv = Math.max(maxv, P.vy); } out.normalFall = maxv; __RS.step(60);
    return out; });
  ok('feel: run accel to 90% in <= 7 frames (~0.11 s)', m.accelFrames <= 7, 'frames=' + m.accelFrames);
  ok('feel: turnaround <= 8 frames (v2.0 ~10)', m.turnFrames <= 8, 'frames=' + m.turnFrames);
  ok('feel: stop <= 6 frames', m.stopFrames <= 6, 'frames=' + m.stopFrames);
  ok('feel: jump fires on the press frame (0-frame latency)', m.jumpLatencyVy < -400, 'vy=' + Math.round(m.jumpLatencyVy));
  ok('feel: jump buffer (pressed 6 frames early -> jumps on landing)', m.buf6 < -300, 'minVy=' + Math.round(m.buf6));
  ok('feel: no stale jump (pressed 20 frames early -> no jump)', m.buf20 > -100, 'minVy=' + Math.round(m.buf20));
  ok('feel: coyote time (4 frames after leaving ground -> jump)', m.coy4 < -400, 'vy=' + Math.round(m.coy4));
  ok('feel: coyote expires (14 frames -> no jump)', m.coy14 > -100, 'vy=' + Math.round(m.coy14));
  ok('feel: dash buffer during cooldown', m.dashBuf, '');
  ok('feel: dash -> jump cancel keeps momentum', m.dashJump.vy < -300 && Math.abs(m.dashJump.vx) >= 182 * 1.25, JSON.stringify(m.dashJump));
  ok('feel: attack buffer through a parry lock', !m.atkBuf.during && m.atkBuf.after, JSON.stringify(m.atkBuf));
  ok('feel: fast fall faster than normal fall cap', m.fastFall > 700 && m.normalFall <= 600, `fast=${Math.round(m.fastFall)} normal=${Math.round(m.normalFall)}`);
  // touch: big buttons, custom positions, contextual icon
  await page.setViewport({ width: 800, height: 400 });
  const t = await E(page, () => { __RS.game.relayout(); const L = __RS.layout(); const rs = ['jump', 'attack', 'dash', 'hook', 'parry'].map((b) => L[b].r); const j0 = { x: L.jump.x, y: L.jump.y };
    __RS.moveButton('jump', -120, -30, 800, 400); const L2 = __RS.layout(); const moved = { dx: Math.round(L2.jump.x - j0.x), dy: Math.round(L2.jump.y - j0.y) };
    const saved = JSON.parse(localStorage.getItem('rootswing.save.v1')).settings.btnPos; __RS.moveButton('jump', 5000, 5000, 800, 400); const L3 = __RS.layout();
    return { minR: Math.min(...rs), jumpR: L.jump.r, moved, saved: !!(saved && saved.jump), clamped: L3.jump.x <= 800 - L3.jump.r + 0.5 && L3.jump.y <= 400 - L3.jump.r + 0.5 }; });
  ok('touch: no tiny buttons (main radius >= 28 px, jump >= 44)', t.minR >= 28 && t.jumpR >= 44, JSON.stringify(t));
  ok('touch: drag-to-place buttons saved + clamped on screen', Math.abs(t.moved.dx + 120) < 2 && Math.abs(t.moved.dy + 30) < 2 && t.saved && t.clamped, JSON.stringify(t.moved));
  const ctx = await E(page, () => { __RS.save.settings.btnPos = {}; __RS.start('hub'); __RS.manual(true); __RS.step(60); const W = __RS.W, P = W.player; const d = W.props.find((o) => o.kind === 'door'); P.x = d.x + d.w / 2 - P.w / 2; P.y = d.y + d.h - P.h - 2; P.vx = P.vy = 0; __RS.step(20); return __RS.input.ctx; });
  ok('touch: Attack turns into a contextual door button', ctx === 'door', String(ctx));
  ok('no page errors (feel)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// ---------- STORY flow ----------
{ const { browser, page, errors } = await fresh();
  await E(page, () => { localStorage.clear(); }); await page.reload(); await sleep(700);
  const a = await E(page, () => { document.querySelector('[data-act="play"]').click(); return { ui: __RS.game && document.querySelector('#ui .cm') ? 'comic' : 'none', intro: __RS.story.camp().intro }; });
  await sleep(300); await page.screenshot({ path: 'shots/v21/test-intro.png' });
  const b = await E(page, () => { document.querySelector('[data-act="cmSkip"]').click(); return { mode: __RS.W && __RS.W.mode }; });
  ok('story: first Play shows the skippable intro, then the tutorial', a.ui === 'comic' && a.intro && b.mode === 'tutorial', JSON.stringify({ a, b }));
  const h = await E(page, () => { __RS.save.progress.tutorialDone = true; __RS.start('hub'); __RS.manual(true); __RS.step(40); const W = __RS.W; W.game.useDoor(W); const nodes = [...document.querySelectorAll('.mp-node')].map((n) => n.classList.contains('lock') ? 'L' : 'O').join(''); const moss = W.props.some((o) => o.kind === 'moss'); return { nodes, moss }; });
  ok('story: hub door opens the chapter map (1 open, 2-5 locked) + Elder Moss in hub', h.nodes === 'OLLLL' && h.moss, JSON.stringify(h));
  const c = await E(page, () => { document.querySelector('.mp-node.lock').click(); const still = !!document.querySelector('.mp'); document.querySelector('.mp-play').click(); const comic = !!document.querySelector('.cm'); document.querySelector('[data-act="cmSkip"]').click(); const W = __RS.W; return { still, comic, mode: W.mode, ch: W.chapter, stage: W.stage || 0 }; });
  ok('story: locked chapter refuses; Chapter 1 plays its comic then the run', c.still && c.comic && c.mode === 'run' && c.ch === 1 && c.stage === 0, JSON.stringify(c));
  const s = await E(page, () => { __RS.manual(true); __RS.god(true); const W = __RS.W; W.emit('seed', 2); const seeds = __RS.story.camp().seeds[1]; const e = W.enemies.find((x) => x.constructor.name.includes('Warden') || x.type === 'warden') || W.enemies[0]; W.onMinibossDefeated(e); const freed = __RS.story.camp().freed[1]; __RS.step(260); const comic = !!document.querySelector('.cm'); const name = __RS.storyUI.comic.name; __RS.skipComic(); const lore = W.pickups.filter((k) => k.kind === 'lore').length; return { seeds, freed, comic, name, lore }; });
  ok('story: seeds saved per chapter; Warden falls -> freed + story beat comic + Memory Leaf drop', s.seeds === 2 && s.freed && s.comic && s.name === 'warden1' && s.lore >= 1, JSON.stringify(s));
  const v = await E(page, () => { const W0 = __RS.W; const k = W0.pickups.find((x) => x.kind === 'lore'); const P = W0.player; P.x = k.x - P.w / 2; P.y = k.y - P.h / 2; __RS.step(20); const lore = __RS.story.camp().lore.slice();
    __RS.start('boss', { chapter: 1, seed: 7 }); __RS.manual(true); const W = __RS.W; const boss = W.enemies.find((e) => e.maxHp >= 300) || W.enemies[0]; W.game.onVictory(W); const comic = __RS.storyUI.comic.name; __RS.skipComic();
    const vic = !!document.querySelector('[data-act="playChapter"]'); const c = __RS.story.camp(); return { lore, comic, vic, done: !!c.done[1], unlocked: c.unlocked, chapter: W.chapter, boss: boss && boss.constructor.name }; });
  ok('story: lore leaf saved on pickup', v.lore.length >= 1, JSON.stringify(v.lore));
  ok('story: chapter boss -> ending comic -> victory with "Chapter 2" button; chapter 2 unlocked', v.comic === 'ch1end' && v.vic && v.done && v.unlocked === 2 && v.chapter === 1, JSON.stringify(v));
  await page.screenshot({ path: 'shots/v21/test-victory.png' });
  const f = await E(page, () => { const c = __RS.story.camp(); c.unlocked = 5; for (const n of [2, 3, 4]) { c.done[n] = true; c.freed[n] = true; } __RS.writeSave();
    const bosses = {}; for (const n of [3, 4, 5]) { __RS.start('boss', { chapter: n, seed: 11 }); __RS.manual(true); __RS.step(5); const b = __RS.W.enemies.find((e) => e.boss || e.maxHp >= 600); bosses[n] = b ? ((b.info && b.info.name) || b.name || b.type) + ':' + b.maxHp : 'none'; }
    const W = __RS.W; W.game.onVictory(W); const comic = __RS.storyUI.comic.name; const panels = __RS.storyUI.comic.panels.map((p) => p.bg).join(','); __RS.skipComic(); const c2 = __RS.story.camp(); const title = (document.querySelector('.res h2') || {}).textContent;
    return { bosses, comic, ember: panels.includes('p_ember'), ending: c2.ending, done5: !!c2.done[5], title, next: __RS.story.nextGoal(5).t }; });
  ok('story: ch3-5 bosses (Thornstack / Storm Bloom / The Blight)', /Blight/i.test(f.bosses[5]) && /Thornstack/.test(f.bosses[3]) && /Storm Bloom/.test(f.bosses[4]), JSON.stringify(f.bosses));
  ok('story: final boss -> FINALE (Ember twist) -> ending flag + NG+ goal', f.comic === 'ch5end' && f.ember && f.ending && f.done5 && /New Game\+/.test(f.next), JSON.stringify(f));
  const ng = await E(page, () => { __RS.start('hub'); __RS.manual(true); __RS.step(20); const W = __RS.W; W.game.useDoor(W); const ngBtn = !!document.querySelector('[data-act="mpNG"]'); document.querySelector('[data-act="mpNG"]').click(); const on = __RS.story.camp().ngOn; document.querySelector('.mp-play').click(); __RS.skipComic(); const d = __RS.save.diff ? null : null; return { ngBtn, on, ngRun: __RS.game.ngRun, friends: 0 }; });
  ok('story: NG+ toggle on the map after the ending; NG+ run flagged', ng.ngBtn && ng.on && ng.ngRun >= 1, JSON.stringify(ng));
  const hub = await E(page, () => { __RS.start('hub'); __RS.manual(true); __RS.step(20); return __RS.W.props.filter((o) => o.kind === 'friend').length; });
  ok('story: freed Wardens move into the hub', hub === 4, 'friends=' + hub);
  // persistence across reload: lore, settings, campaign
  await E(page, () => { __RS.save.settings.haptics = false; __RS.save.settings.ctrlSize = 1.2; __RS.writeSave(); });
  await page.reload(); await sleep(800);
  const p = await E(page, () => { const c = __RS.story.camp(); return { lore: c.lore.length, ending: c.ending, unlocked: c.unlocked, haptics: __RS.save.settings.haptics, size: __RS.save.settings.ctrlSize }; });
  ok('persist: campaign + lore survive reload', p.lore >= 1 && p.ending && p.unlocked === 5, JSON.stringify(p));
  ok('persist: settings survive reload', p.haptics === false && p.size === 1.2, JSON.stringify(p));
  // migration: a v2.0 save (no campaign) with a win -> chapter 2 open, intro not seen
  await E(page, () => { const s = JSON.parse(localStorage.getItem('rootswing.save.v1')); delete s.progress.campaign; s.progress.wins = 3; localStorage.setItem('rootswing.save.v1', JSON.stringify(s)); });
  await page.reload(); await sleep(800);
  const mg = await E(page, () => { const c = __RS.story.camp(); return { v: c.v, unlocked: c.unlocked, intro: c.intro, glim: __RS.save.progress.glimmers >= 0 }; });
  ok('migration: v2.0 save -> campaign v1, veteran gets chapter 2, intro will play', mg.v === 1 && mg.unlocked === 2 && mg.intro === false && mg.glim, JSON.stringify(mg));
  await E(page, () => { const s = JSON.parse(localStorage.getItem('rootswing.save.v1')); delete s.progress.campaign; s.progress.wins = 0; localStorage.setItem('rootswing.save.v1', JSON.stringify(s)); });
  await page.reload(); await sleep(800);
  const mg2 = await E(page, () => __RS.story.camp().unlocked);
  ok('migration: new v2.0 player starts at chapter 1', mg2 === 1, 'unlocked=' + mg2);
  ok('no page errors (story)', errors.length === 0, errors.slice(0, 3).join(' | ')); await browser.close(); }
server.close();
const fail = results.filter((r) => !r.pass); console.log(`\n${results.length - fail.length}/${results.length} passed`); process.exit(fail.length ? 1 : 0);
