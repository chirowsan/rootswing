// v2.2 probe: a naive "mash" player vs a chapter boss; logs boss state + hp so we can see if bosses threaten at all.
import { serve, launch, sleep, drive } from './lib.mjs';
const DIF = process.argv[2] || 'normal', CH = +(process.argv[3] || 1);
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 1 });
await page.goto(url); await sleep(600);
await page.evaluate((d, ch) => { localStorage.clear(); __RS.save.settings.difficulty = d; __RS.save.progress.tutorialDone = true; const c = __RS.story.camp(); c.intro = true; c.unlocked = 6;
  __RS.start('boss', { chapter: ch, seed: 7 }); __RS.god(false); __RS.manual(true); }, DIF, CH);
const pol = (W, P, f, m) => { if (!m.i) { m.i = 1; m.d = 0; m.log = []; m.sts = {}; W.tryRevive = (p) => { m.d++; p.hp = p.maxHp; p.iframes = 2; return true; }; }
  const B = W.boss; if (!B || B.hp <= 0 || B.dead) { m.win = f; return null; } m.sts[B.st] = (m.sts[B.st] || 0) + 1; if (B.st === 'idle') { if (B.stun > 0) m.sts.STUN = (m.sts.STUN || 0) + 1; if (B.poiseBroke > 0) m.sts.PB = (m.sts.PB || 0) + 1; if (f % 60 === 0) (m.cd = m.cd || []).push(+(B.cd || 0).toFixed(2)); }
  if (f % 300 === 0) m.log.push([f, B.st, Math.round(B.hp), B.phase, Math.round(P.hp)]);
  const dx = B.cx - P.cx; const a = { mx: Math.abs(dx) > 40 ? Math.sign(dx) : 0, b: [] }; if (f % 10 < 5) a.b.push('attack'); if (f % 50 === 0) a.b.push('jump'); if (f % 90 === 0) a.b.push('dash'); return a; };
const r = await drive(page, pol, 9000);
console.log(JSON.stringify({ dif: DIF, ch: CH, frames: r.frames, deaths: r.mem.d, win: r.mem.win, sts: r.mem.sts, cd: r.mem.cd, log: r.mem.log }));
console.log('ERRORS', errors.length, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
