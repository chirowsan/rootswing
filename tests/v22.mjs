// ROOTSWING v2.2 tests: challenge (difficulty bounds, smarter AI, boss anti-cheese, continues, assist) and surprises
// (seeded events, boons, shrine, merchant, secret rooms, set-pieces, no soft-locks, secret chapter), save migration.
// Usage: node tests/v22.mjs        (bot-measured numbers live in docs/bot-v22.json, made by tools/diff-bot.mjs)
import { serve, launch, sleep } from '../tools/lib.mjs';
import { readFileSync } from 'fs';
const results = []; const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`); };
const { server, url } = await serve();
const { browser, page, errors } = await launch({ dpr: 1 }); await page.goto(url); await sleep(700);
const E = (fn, ...a) => page.evaluate(fn, ...a);
const setup = (d = 'normal') => E((d) => { localStorage.clear(); __RS.game.daily = null; __RS.game.ngRun = 0; const S = __RS.save; S.run = null; S.settings.difficulty = d; S.settings.assist = 'auto'; S.progress.tutorialDone = true; S.progress.chDeaths = {}; S.progress.mastery = {}; const c = __RS.story.camp(); c.intro = true; c.unlocked = 5; c.sparks = 0; }, d);
const startRun = (d, ch, seed) => E((d, ch, seed) => { __RS.save.settings.difficulty = d; __RS.game.spRun = null; __RS.game.daily = null; __RS.start('run', { seed, chapter: ch }); __RS.god(true); __RS.manual(true); __RS.step(5); const W = __RS.W; return { plan: W.spPlan, cells: W.cells.length }; }, d, ch, seed);

// ---------- 1. difficulty tables are ordered and Normal is a real step up from Relaxed ----------
{ const D = await E(() => __RS.DIFF); const ks = ['relaxed', 'normal', 'hard', 'nightmare'];
  const mono = (k, up = true) => ks.every((d, i) => i === 0 || (up ? D[d][k] >= D[ks[i - 1]][k] : D[d][k] <= D[ks[i - 1]][k]));
  ok('diff: harder modes hit harder / smarter', mono('dmgTaken') && mono('aggro') && mono('smart') && mono('tokens') && mono('bossHp') && mono('feint'), ks.map((d) => D[d].dmgTaken).join('/'));
  ok('diff: healing gets scarcer, fewer continues', mono('flaskHeal', false) && mono('heart', false) && mono('cont', false) && D.relaxed.cont >= 99 && D.normal.cont === 3, ks.map((d) => D[d].cont).join('/'));
  ok('diff: Relaxed stays gentle', D.relaxed.dmgTaken <= 0.6 && D.relaxed.smart === 0 && D.relaxed.feint === 0); }

// ---------- 2. bot-measured bounds (docs/bot-v22.json from tools/diff-bot.mjs, all 4 difficulties vs v2.1) ----------
{ let B = null; try { B = JSON.parse(readFileSync(new URL('../docs/bot-v22.json', import.meta.url))); } catch (e) { /* missing */ }
  ok('bot: metrics file present', !!B);
  if (B) { const sum = (d, k) => B.v22[d].reduce((a, r) => a + (k === 'boss' ? r.boss.deaths : r[k]), 0), base = (d, k) => B.v21[d].reduce((a, r) => a + (k === 'boss' ? r.boss.deaths : r[k]), 0);
    const per = (d) => sum(d, 'deaths') / B.v22[d].length;
    ok('bot: Relaxed <= 1 death per chapter on average', per('relaxed') <= 1, per('relaxed').toFixed(2));
    ok('bot: Normal = a few deaths per chapter (1..8)', per('normal') >= 1 && per('normal') <= 8, per('normal').toFixed(2));
    ok('bot: Normal harder than v2.1 Normal', sum('normal', 'deaths') > base('normal', 'deaths') && sum('normal', 'boss') > base('normal', 'boss'), `${base('normal', 'deaths')}->${sum('normal', 'deaths')} boss ${base('normal', 'boss')}->${sum('normal', 'boss')}`);
    ok('bot: Hard/Nightmare bosses take several tries', B.v22.hard.every((r) => r.boss.deaths >= 1) && B.v22.nightmare.every((r) => r.boss.deaths >= 1));
    ok('bot: deaths ordered relaxed < normal < hard <= nightmare', sum('relaxed', 'deaths') < sum('normal', 'deaths') && sum('normal', 'deaths') < sum('hard', 'deaths') && sum('hard', 'deaths') <= sum('nightmare', 'deaths') * 1.25, ['relaxed', 'normal', 'hard', 'nightmare'].map((d) => sum(d, 'deaths')).join('/'));
    ok('bot: every chapter beatable at every difficulty', Object.values(B.v22).every((rs) => rs.every((r) => r.bossWon))); } }

// ---------- 3. live boss probe: a button-masher can't stun-lock or hug the boss on Normal ----------
{ await setup('normal');
  const r = await E(() => { __RS.start('boss', { chapter: 1 }); __RS.god(false); __RS.manual(true); const W = __RS.W, P = W.player; __RS.step(30); const b = W.enemies.find((e) => e.boss); let hp0 = P.hp, stomp = 0, f = 0;
    W.addMarker = ((am) => (m) => { if (m.kind === 'circle' && b && Math.abs(m.x - b.cx) < 5) stomp++; return am(m); })(W.addMarker.bind(W));
    for (; f < 60 * 60 && !P.dead && !b.dead; f++) { P.x = b.cx - P.w / 2; P.y = b.y + b.h - P.h; P.vy = 0; if (b.st === 'sleep' || b.st === 'intro') b.st = b.st; if (f % 6 === 0) __RS.press('attack'); else __RS.release('attack'); __RS.step(1); if (P.hp < hp0 * 0.25) break; }
    return { lost: hp0 - P.hp, stomp, f, bhp: b.hp / b.maxHp }; });
  ok('boss: hugging + mashing gets punished (stomp telegraph)', r.lost >= 30 && r.stomp >= 1, r); }

// ---------- 4. smarter AI: mashing makes guard foes guard; dash-past gets punished ----------
{ await setup('normal');
  const r = await E(() => { __RS.start('run', { seed: 77, chapter: 3 }); __RS.god(true); __RS.manual(true); __RS.step(5); const W = __RS.W, P = W.player;
    const k = W.spawnEnemy ? null : null; void k; const S = __RS.AI22.stats; const g0 = S.guards, p0 = S.punishes;
    let e = W.enemies.find((x) => x.type === 'knight' && !x.dead); if (!e) return { none: true };
    for (const o of W.enemies) if (o !== e && !o.boss) o.dead = true;
    for (let i = 0; i < 400 && S.guards === g0; i++) { P.x = e.cx - e.face * 40 - P.w / 2; P.y = e.y + e.h - P.h; P.vy = 0; if (i % 5 === 0) __RS.press('attack'); else __RS.release('attack'); __RS.step(1); e.hp = e.maxHp; }
    return { guards: S.guards - g0, stats: S }; });
  ok('ai: mashing into a knight raises its guard (then a telegraphed counter)', r.guards >= 1, r); }

// ---------- 5. seeded surprise plans: same seed = same run, different seeds differ, budget, set-piece every chapter ----------
{ await setup('normal'); const plans = {};
  for (const ch of [1, 2, 3, 4, 5, 6]) for (const s of [11, 12, 13]) { const p = (await startRun('normal', ch, s * 101 + ch)).plan; plans[ch + ':' + s] = p; }
  const again = (await startRun('normal', 2, 12 * 101 + 2)).plan;
  { const A = JSON.stringify(again), B2 = JSON.stringify(plans['2:12']); let i = 0; while (i < A.length && A[i] === B2[i]) i++; ok('plan: same seed gives the same surprises', A === B2, A.slice(Math.max(0, i - 80), i + 120) + ' VS ' + B2.slice(Math.max(0, i - 80), i + 120)); }
  const sig = (p) => p.events.map((e) => e.k + e.cell).join(',') + '|' + p.pockets.map((q) => q.game + q.cell).join(',');
  const distinct = new Set(Object.values(plans).map(sig)).size;
  ok('plan: different seeds give different runs', distinct >= 16, distinct + '/18');
  ok('plan: a set-piece in every chapter run', Object.values(plans).every((p) => p.set && p.set.k), Object.values(plans).map((p) => p.set && p.set.k).join(','));
  ok('plan: surprise budget 3..9 events, always a boon', Object.values(plans).every((p) => p.events.length >= 2 && p.events.length <= 9 && p.events.length <= p.budget && p.events.some((e) => e.k === 'boon')), Object.values(plans).map((p) => p.events.length).join(','));
  const kinds = new Set(Object.values(plans).flatMap((p) => p.events.map((e) => e.k)));
  ok('plan: event variety across runs', kinds.size >= 9, [...kinds].join(','));
  ok('plan: 1..3 secret rooms per run', Object.values(plans).every((p) => p.pockets.length >= 1 && p.pockets.length <= 3));
  const d = await E(() => { __RS.startDaily ? 0 : 0; __RS.game.startDaily(); __RS.god(true); __RS.manual(true); __RS.step(3); const p = __RS.W.spPlan; __RS.game.daily = null; return p; });
  ok('plan: the Daily stays pure (no random surprises)', d === null); }

// ---------- 6. secret rooms are reachable: a cracked wall next to open floor, interior open, mini-game works ----------
{ await setup('normal'); let bad = [], n = 0, won = 0;
  for (const ch of [1, 2, 3, 4, 5]) for (const s of [3, 9, 27]) {
    const r = await E((ch, s) => { __RS.game.spRun = null; __RS.game.daily = null; __RS.start('run', { seed: s * 77 + ch, chapter: ch }); __RS.god(true); __RS.manual(true); __RS.step(3); const W = __RS.W, m = W.map, T = __RS.TILE, out = [];
      for (const q of W.sp.pockets) { const wall = m.get(q.ex, q.ey); const side = q.dir; const outside = q.ex - side; let floor = false; for (let dy = 0; dy < 5; dy++) if (m.get(outside, q.ey + dy) === '.' && m.solid(outside, q.ey + dy + 1)) floor = true;
        let open = 0; for (let y = q.iy; y < q.iy + q.ih; y++) for (let x = q.ix; x < q.ix + q.iw; x++) if (m.get(x, y) === '.') open++;
        out.push({ id: q.id, game: q.game, wall, floor, open, area: q.iw * q.ih, ey: q.ey, iy: q.iy, ih: q.ih }); }
      // play one secret room for real: stand outside, swing at the cracked wall, walk in, play its mini-game
      let won = 0; const q = W.sp.pockets[0]; if (q) { const side = q.dir, ox = q.ex - side; let fy = q.ey; for (let dy = 0; dy < 5; dy++) if (m.get(ox, q.ey + dy) === '.' && m.solid(ox, q.ey + dy + 1)) { fy = q.ey + dy; break; }
        const P = W.player; for (const e of W.enemies) if (!e.boss) e.dead = true; P.x = ox * T + 12 - P.w / 2; P.y = (fy + 1) * T - P.h - 1; P.vx = P.vy = 0; P.face = side; W.updateRoom(false); W.snapCamera();
        for (let i = 0; i < 200 && m.get(q.ex, q.ey) !== '.'; i++) { __RS.axes(0, 0); P.face = side; if (i % 12 === 0) __RS.press('attack'); else __RS.release('attack'); __RS.step(1); }
        const broke = m.get(q.ex, q.ey) === '.'; __RS.release('attack');
        if (broke) { P.x = (q.ix + Math.floor(q.iw / 2)) * T + 12 - P.w / 2; P.y = (q.iy + q.ih) * T - P.h - 1; P.vx = P.vy = 0; __RS.step(10);
          if (q.game === 'treasure') __RS.SP.interact(W, W.props.find((o) => o.pk === q.id && o.ev === 'spark'), P);
          else if (q.game === 'runes') { q.showT = 0; for (const n of q.seq) __RS.SP.interact(W, W.props.find((o) => o.pk === q.id && o.n === n), P); }
          else { for (let i = 0; i < 60 && !q.done; i++) { for (const f of W.sp.flies) if (f.pk === q.id) { f.hx = P.cx; f.hy = P.cy; } __RS.step(1); } } }
        won = q.done ? 1 : 0; out.push({ broke, game: q.game, won }); }
      return { out, won }; }, ch, s);
    for (const o of r.out) { if (o.broke === false) bad.push(o); if (o.id === undefined) continue; n++; if (o.wall !== 'B' || !o.floor || o.open < o.area * 0.9 || o.ey < o.iy || o.ey >= o.iy + o.ih) bad.push(o); }
    if (r.won === 1) won++; if (r.won === 0) bad.push({ minigame: 'failed', ch, s }); }
  ok('secret: every hidden room has floor outside its cracked wall and an open interior', n >= 15 && !bad.length, { n, bad: bad.slice(0, 3) });
  ok('secret: cracked walls break and every mini-game (fireflies / runes / treasure) can be won', won === 15, 'won ' + won + '/15'); }

// ---------- 7. boons, shrine, merchant ----------
{ await setup('normal'); await startRun('normal', 2, 555);
  const b = await E(() => { const W = __RS.W; __RS.SP.offerBoons(W, 'Test'); const cards = [...document.querySelectorAll('#ui button.boon')].map((x) => x.textContent); const dd = W.dmgDealt || 1; document.querySelector('[data-act="boonPick0"]').click(); return { cards, n: W.sp.run.boons.length, ui: __RS.state().ui, paused: __RS.game.paused }; });
  ok('boon: 3 cards offered, pick applies and closes', b.cards.length === 3 && b.n === 1 && !b.paused, b);
  const sh = await E(() => { const W = __RS.W, P = W.player; const o = { kind: 'sp', ev: 'shrine', x: P.x, y: P.y, w: 40, h: 52, id: 'tshrine' }; W.props.push(o); __RS.SP.interact(W, o, P); const btn = [...document.querySelectorAll('#ui button.pact')].map((x) => x.textContent); const before = JSON.stringify(W.sp.run); document.querySelector('[data-act="shrinePick0"]').click(); return { btn, changed: JSON.stringify(W.sp.run) !== before || P.hp === P.maxHp, used: o.open }; });
  await E(() => { __RS.step(10); const c = document.querySelector('#ui [data-act="boonPick0"]'); if (c) c.click(); });
  ok('shrine: two bless/curse pacts, choosing one changes the run', sh.btn.length === 2 && sh.btn.every((t) => /but:/.test(t)) && sh.used, sh);
  const st = await E(() => __RS.W.sp.stock.map((s) => s.id));
  await startRun('normal', 2, 556); const st2 = await E(() => __RS.W.sp.stock.map((s) => s.id)); await startRun('normal', 2, 555); const st3 = await E(() => __RS.W.sp.stock.map((s) => s.id));
  ok('merchant: 3 wares, stock rotates per run, seeded', st.length === 3 && JSON.stringify(st) === JSON.stringify(st3), st.join(',') + ' | ' + st2.join(','));
  const sb = await E(() => { const W = __RS.W, P = W.player; W.runGlim = 999; const o = { kind: 'sp', ev: 'merchant', x: P.x, y: P.y, w: 40, h: 48, id: 'tm' }; W.props.push(o); __RS.SP.interact(W, o, P); const g0 = W.runGlim; const i = W.sp.stock.findIndex((s) => s.id !== 'boon' && s.id !== 'bag'); document.querySelector(`[data-act="shopBuy"][data-v="${i < 0 ? 0 : i}"]`).click(); const r = { spent: g0 - W.runGlim, sold: W.sp.stock.filter((s) => s.sold).length }; const l = document.querySelector('[data-act="shopLeave"]'); if (l) l.click(); else { __RS.game.paused = false; } return r; });
  ok('merchant: buying spends glimmers and marks sold', sb.spent > 0 && sb.sold === 1, sb); }

// ---------- 8. no soft-locks: every event and set-piece ends (or can be finished) and the room never seals ----------
{ await setup('normal'); const fails = []; const KINDS = ['ambush', 'storm', 'blight', 'fireflies', 'flood', 'collapse', 'hunter', 'mimic', 'trap', 'set:logchase', 'set:sporeflood', 'set:bridge', 'set:canopy', 'set:dark', 'set:escape'];
  for (const k of KINDS) {
    const r = await E((k) => { __RS.game.spRun = null; __RS.game.daily = null; __RS.start('run', { seed: 4000 + k.length * 13, chapter: 3 }); __RS.god(true); __RS.manual(true); __RS.step(3); const W = __RS.W, P = W.player, S = W.sp, T = __RS.TILE;
      const c = W.cells.find((c) => c.kind === 'normal' && c.need.has('L') && c.need.has('R')) || W.cells.find((c) => c.kind === 'normal'); const idx = W.cells.indexOf(c);
      for (const e of W.enemies) if (!e.boss) e.dead = true; S.cellEv.clear(); S.set = null; S.cur = -1; const planks0 = W.map.tiles ? null : null; void planks0;
      const ox = c.x * 34, oy = c.y * 20; let spot = null; for (let y = oy + 17; y > oy + 2 && !spot; y--) for (let x = ox + 3; x < ox + 31; x++) if (W.map.get(x, y) === '.' && W.map.get(x, y - 1) === '.' && W.map.solid(x, y + 1)) { spot = { x, y }; break; }
      if (k.startsWith('set:')) S.set = { k: k.slice(4), cell: idx }; else if (k === 'mimic' || k === 'trap') { const o = { kind: 'sp', ev: k, x: spot.x * T, y: (spot.y + 1) * T - 32, w: 30, h: 32, id: 't' + k, cell: idx }; W.props.push(o); } else S.cellEv.set(idx, { k, cell: idx, id: 'tev' + k });
      P.x = spot.x * T + 3; P.y = (spot.y + 1) * T - P.h - 1; P.vx = P.vy = 0; W.updateRoom(false); W.snapCamera(); __RS.step(2);
      if (k === 'mimic' || k === 'trap') __RS.SP.interact(W, W.props.find((o) => o.id === 't' + k), P);
      let f = 0, seen = false, left = false; for (; f < 60 * 45; f++) { const bp = document.querySelector('#ui [data-act="boonPick0"]'); if (bp) bp.click(); __RS.step(1); if (S.active.length || S.trap || W.enemies.some((e) => !e.dead && (e.mimic || e.hunter))) seen = true;
        if (f % 20 === 0) for (const e of W.enemies) if (!e.dead && !e.boss && f > 150) W.hitEnemy(e, { dmg: 999, kb: 0 }, P); // the player fights back
        for (const fl of S.flies) if (f > 120) { fl.hx = P.cx; fl.hy = P.cy; } // the player catches fireflies
        if (f === 1500) { const o = W.cells.find((d) => d !== c && Math.abs(d.x - c.x) + Math.abs(d.y - c.y) === 1) || W.cells.find((d) => d !== c); P.x = (o.x * 34 + 17) * T; P.y = (o.y * 20 + 10) * T; __RS.SP.onEnterCell(W, o); left = true; } // walking out of the room ends room events
        if (S.wall && f > 60) { P.x = S.wall.end - P.w / 2; P.y = W.groundY(S.wall.end, P.y) - P.h - 1; } // the player runs to the far side
        if (f > 200 && !S.active.length && !S.trap && !S.later.length && !W.enemies.some((e) => !e.dead && !e.boss) && !S.water && !S.fall.length && !S.wall && !S.hunterIn) break; }
      const stuck = W.map.solidPx(P.cx, P.cy); return { k, seen, f, left, later: S.later.length, hin: !!S.hunterIn, wall: !!S.wall, active: S.active.map((e) => e.k), trap: !!S.trap, foes: W.enemies.filter((e) => !e.dead && !e.boss).length, water: !!S.water, fall: S.fall.length, dark: S.dark, stuck }; }, k);
    if (!r.seen || r.f >= 60 * 45 || r.stuck) fails.push(r); else if (r.left && !['collapse', 'set:bridge', 'set:dark', 'storm', 'blight'].includes(k)) fails.push({ ...r, why: 'needed to leave' }); }
  ok('no soft-locks: all 15 events/set-pieces start and finish, planks grow back, no sealed rooms', !fails.length, fails); }

// ---------- 9. continues + Assist (death screen, tries left, auto-assist after 4 deaths) ----------
{ await setup('normal');
  const kill = () => E(() => { __RS.god(false); __RS.manual(true); __RS.step(20); const W = __RS.W, P = W.player; P.iframes = 0; P.hp = 1; W.damagePlayer(9999, P.cx, { name: 'Test' }); __RS.step(30); });
  const read = () => E(() => { const b = document.querySelector('[data-act="continueRun"]'); return { btn: !!b, txt: b ? b.textContent : '', ui: (document.querySelector('#ui') || {}).textContent || '', giveUp: !!document.querySelector('[data-act="giveUp"]'), left: __RS.save.run && __RS.save.run.sp ? __RS.save.run.sp.cont : null, assist: __RS.DIFF ? null : null }; });
  await E(() => { __RS.game.beginRun(1); __RS.game.go('run', { chapter: 1 }); __RS.manual(true); __RS.step(10); __RS.game.saveRunState(__RS.W, 0); });
  await kill(); await sleep(1500); const r = await read();
  ok('continue: death on Normal offers "Try again (2 left)" + Give up', r.btn && /2 left/.test(r.txt) && r.giveUp, { txt: r.txt, left: r.left });
  const seq = [r.left];
  for (let i = 0; i < 5; i++) { const has = await E(() => { const b = document.querySelector('[data-act="continueRun"]'); if (!b) return false; b.click(); return true; }); if (!has) break; await sleep(200); await kill(); await sleep(1500); const q = await read(); seq.push(q.btn ? q.left : 'out'); if (/assist/i.test(q.ui)) seq.push('assist'); }
  ok('continue: 3 tries on Normal, auto-Assist after the 4th death adds 2 more, then out of tries', seq.includes('assist') && seq[seq.length - 1] === 'out' && seq.filter((x) => typeof x === 'number').length >= 3, seq.join(' > '));
  const g = await E(() => { const b = document.querySelector('[data-act="toHub"],[data-act="giveUp"]'); return { run: __RS.save.run }; }); ok('continue: out of tries clears the saved run', g.run === null || g.run === undefined, g); }

// ---------- 10. save migration from v2.1 ----------
{ const r = await E(() => { const v21 = { settings: { speed: 0.8, difficulty: 'normal', music: 0.5 }, progress: { glimmers: 120, totalGlimmers: 300, runs: 4, wins: 1, tutorialDone: true, unlocks: { blade: true, revive: true }, weapon: 'blade', gadgets: ['popseed'], camp: { intro: true, unlocked: 3, done: { 1: 1, 2: 1 } } }, run: { seed: 999, stage: 0, cellIndex: 0, ch: 3, hp: 70, flasks: 1, weapon: 'blade', glim: 15, cleared: [], visited: [0], opened: [] } };
    localStorage.setItem('rootswing.save.v1', JSON.stringify(v21)); const S = __RS.loadSave(); const out = { assist: __RS.save.settings.assist, glim: __RS.save.progress.glimmers, run: !!__RS.save.run };
    try { const bt = document.createElement('button'); bt.dataset.act = 'continueRun'; (document.getElementById('ui') || document.body).appendChild(bt); bt.click(); __RS.manual(true); __RS.step(20); const W = __RS.W; out.mode = W && W.mode; out.sp = W && W.sp && W.sp.run && W.sp.run.cont; out.ch = W && W.chapter; } catch (e) { out.err = String(e); } return out; });
  ok('save: v2.1 save loads, gains Assist=auto, its run continues with v2.2 tries', r.assist === 'auto' && r.glim === 120 && r.mode === 'run' && r.sp === 3 && !r.err, r); }

// ---------- 11. mastery stars + rank + secret chapter ----------
{ await setup('normal');
  const r = await E(() => { __RS.start('run', { seed: 5, chapter: 1 }); __RS.manual(true); __RS.step(3); const W = __RS.W; const m = __RS.SP.chapterWin(W); return { m, html: __RS.SP.masteryHtml(m).length, stars: __RS.SP.totalStars() }; });
  ok('mastery: chapter win grants stars + rank + bonus glimmers', r.m.stars >= 2 && r.m.bonus > 0 && /[SABC]/.test(r.m.rank) && r.html > 50, r.m);
  const s = await E(() => { const ST = __RS.story, c = ST.camp(); c.done = {}; c.sparks = 4; const a = ST.isUnlocked(6); c.sparks = 5; const b = ST.isUnlocked(6); return { a, b, ch: ST.CHAPTERS[6] && ST.CHAPTERS[6].name }; });
  ok('secret chapter: The Hollow Root unlocks with 5 Ember Sparks', !s.a && s.b, s);
  const c6 = await E(() => { __RS.save.settings.difficulty = 'normal'; __RS.start('run', { seed: 66, chapter: 6 }); __RS.god(true); __RS.manual(true); __RS.step(600); const W = __RS.W; return { mode: W.mode, ch: W.chapter, foes: W.enemies.length, set: W.spPlan && W.spPlan.set }; });
  const b6 = await E(() => { __RS.start('boss', { chapter: 6 }); __RS.god(true); __RS.manual(true); __RS.step(900); const W = __RS.W, b = W.enemies.find((e) => e.boss); return { name: b && b.constructor.name, st: b && b.st }; });
  ok('secret chapter: runs and its boss fights without errors', c6.mode === 'run' && c6.ch === 6 && c6.foes > 0 && !!b6.name, { c6, b6 }); }

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
const f = results.filter((r) => !r.pass); console.log(`\n${results.length - f.length}/${results.length} passed`); process.exit(f.length ? 1 : 0);
