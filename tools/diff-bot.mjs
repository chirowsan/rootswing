// v2.2 difficulty metrics: a "skilled kid" bot (no god mode) walks each chapter's main path cell by cell, fights,
// dodges telegraphs, parries some shots, drinks flasks, then fights the chapter boss. A death is counted and the
// bot is refilled (as if retrying from the checkpoint), so one pass measures deaths / health lost / time.
// Usage: node tools/diff-bot.mjs <difficulty> <chapters e.g. 1,2,3> [seed]  -> prints one JSON line per chapter
import { serve, launch, sleep, drive } from './lib.mjs';
const DIF = process.argv[2] || 'normal', CHS = (process.argv[3] || '1').split(',').map(Number), SEED = +(process.argv[4] || 4242);
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 1 });
await page.goto(url); await sleep(600);
const BOT = (W, P, f, m) => {
  if (!m.init) { m.init = 1; m.hits = 0; m.dmg = 0; m.deaths = 0; m.hp = P.hp; m.flasks = 0; m.parries = 0; m.ev = {};
    m.cause = {}; const dp = W.damagePlayer.bind(W); W.damagePlayer = (d, x, i) => { m.last = (i && i.name) || 'hazard'; return dp(d, x, i); };
    const hh = W.hazardHit.bind(W); W.hazardHit = (p, k) => { m.last = 'tile' + k; return hh(p, k); }; W.tryRevive = (p) => { m.deaths++; m.cause[m.last] = (m.cause[m.last] || 0) + 1; p.hp = p.maxHp; p.flasks = p.maxFlasks; p.iframes = 2; return true; };
    W.on((n) => { m.ev[n] = (m.ev[n] || 0) + 1; if (n === 'hurt') m.hits++; if (n === 'flask') m.flasks++; }); }
  if (P.hp < m.hp) m.dmg += m.hp - P.hp; m.hp = P.hp;
  if (W.countdown > 0) return {};
  if (W.game.paused || document.querySelector('#ui .card, #ui .boon, #ui .res')) return m.boss ? null : {};
  const live = W.enemies.filter((e) => !e.dead && (m.boss ? true : e.cell === m.cell) && e.type !== 'dummy' && e.type !== 'mimicIdle');
  if (!live.length) { m.idle = (m.idle || 0) + 1; return m.idle > 30 ? null : {}; } m.idle = 0;
  if (f > m.limit) return null;
  let tg = live[0], bd = 1e9; for (const e of live) { const d = Math.hypot(e.cx - P.cx, e.cy - P.cy); if (d < bd) { bd = d; tg = e; } }
  const dx = tg.cx - P.cx, dy = tg.cy - P.cy, a = { mx: Math.abs(dx) > 30 ? Math.sign(dx) : 0, my: 0, b: [] };
  const rnd = ((f * 2654435761) >>> 0) % 100;
  // danger read: the nearest telegraphing/charging foe, or an incoming shot
  let threat = null; for (const e of live) { const d = Math.hypot(e.cx - P.cx, e.cy - P.cy); const hot = (e.tele > 0.55) || e.st === 'charge' || e.st === 'swoop' || e.st === 'lunge' || e.st === 'swing'; if (hot && d < (e.boss ? 200 : 110)) { threat = e; break; } }
  let shot = null; for (const s of W.shots) if (s.owner === 'enemy' && Math.hypot(s.x - P.cx, s.y - P.cy) < 70 && (s.vx * (P.cx - s.x) + s.vy * (P.cy - s.y)) > 0) { shot = s; break; }
  if (P.hp < P.maxHp * 0.4 && P.flasks > 0 && !threat && f % 30 === 0) a.b.push('flask');
  if (shot) { if (rnd < 45) a.b.push('parry'); else a.b.push('jump'); return a; }
  if (threat && !m.react) { m.react = f + 8 + (rnd % 8); } // kid reaction time 8-15 frames
  if (threat && m.react && f >= m.react) { const away = -Math.sign(threat.cx - P.cx) || 1;
    if (rnd < 30 && !threat.boss) a.b.push('parry'); else if (P.dashCd <= 0) { a.mx = rnd < 50 ? away : -away; a.b.push('dash'); } else { a.mx = away; a.b.push('jump'); }
    if (f > m.react + 12) m.react = 0; return a; }
  if (!threat) m.react = 0;
  if (Math.abs(dx) < 30 && P.face !== Math.sign(dx) && dx) a.mx = Math.sign(dx) * 0.3;
  if ((dy < -50 && P.onGround) || (P.onWall && f % 20 < 10)) a.b.push('jump');
  if (P.onGround && Math.abs(P.vx) < 5 && a.mx && f % 40 === 0) a.b.push('jump');
  if (Math.abs(dx) < 60 && Math.abs(dy) < 60 && f % 9 < 4) a.b.push('attack');
  return a;
};
const out = [];
for (const ch of CHS) {
  const info = await page.evaluate((d, ch, seed) => { localStorage.clear(); __RS.save.settings.difficulty = d; __RS.save.progress.tutorialDone = true; const c = __RS.story.camp(); c.intro = true; c.unlocked = 5;
    __RS.start('run', { seed, chapter: ch }); __RS.god(false); __RS.manual(true); const W = __RS.W; return { cells: W.cells.filter((c) => !c.branch).map((c) => ({ i: c.index, kind: c.kind, need: [...c.need], x: c.x, y: c.y })) }; }, DIF, ch, SEED + ch);
  const tot = { ch, dif: DIF, hits: 0, dmg: 0, deaths: 0, frames: 0, flasks: 0, cells: info.cells.length, maxHp: 0 };
  for (const c of info.cells) {
    if (c.kind === 'start') continue;
    await page.evaluate((c) => { const W = __RS.W, P = W.player, T = __RS.TILE; const ox = c.x * 34, oy = c.y * 20; let tx = ox + 2, ty = oy + 17; if (c.need.includes('U') && !c.need.includes('L')) { tx = ox + 16; ty = oy + 2; } P.x = tx * T + 3; P.y = (ty + 1) * T - P.h - 1; P.vx = P.vy = 0; P.hook.s = 'none'; W.updateRoom(false); W.snapCamera(); }, c);
    const r = await drive(page, `(${BOT.toString()})`.replace('if (!m.init)', `m.cell = ${c.i}; m.limit = ${c.kind === 'miniboss' ? 5000 : 1800}; if (!m.init)`), 5200);
    tot.hits += r.mem.hits || 0; tot.dmg += r.mem.dmg || 0; tot.deaths += r.mem.deaths || 0; tot.frames += r.frames; tot.flasks += r.mem.flasks || 0; if ((r.mem.deaths || 0) >= 2) (tot.hot = tot.hot || []).push(c.i + ':' + r.mem.deaths + ':' + JSON.stringify(r.mem.cause));
    await page.evaluate(() => { const ui = document.querySelector('#ui [data-act="boonPick0"], #ui [data-act="shrineSkip"], #ui [data-act="shopLeave"]'); ui && ui.click(); });
  }
  tot.maxHp = await page.evaluate(() => __RS.W.player.maxHp);
  // boss
  await page.evaluate((ch, seed) => { __RS.start('boss', { chapter: ch, seed }); __RS.god(false); __RS.manual(true); }, ch, SEED);
  const b = { deaths: 0, hits: 0, dmg: 0, frames: 0 };
  for (let k = 0; k < 12; k++) { const r = await drive(page, `(${BOT.toString()})`.replace('if (!m.init)', 'm.boss = 1; m.limit = 3000; if (!m.init)'), 3000);
    b.deaths += r.mem.deaths || 0; b.hits += r.mem.hits || 0; b.dmg += r.mem.dmg || 0; b.frames += r.frames;
    const s = await page.evaluate(() => ({ hp: __RS.W.boss ? __RS.W.boss.hp : 0, mode: __RS.W.mode })); if (!s.hp || s.hp <= 0) break; }
  tot.boss = b; tot.bossWon = await page.evaluate(() => !__RS.W.boss || __RS.W.boss.hp <= 0 || __RS.W.boss.dead);
  tot.sec = Math.round(tot.frames / 60); tot.bossSec = Math.round(b.frames / 60); tot.hpLostPerMin = Math.round(tot.dmg / Math.max(1, tot.frames / 3600));
  console.log(JSON.stringify(tot)); out.push(tot);
}
console.log('ERRORS', errors.length, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
