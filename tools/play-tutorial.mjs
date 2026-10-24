import { serve, launch, sleep, drive } from './lib.mjs';
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 1 });
await page.goto(url); await sleep(600);
await page.evaluate(() => { localStorage.clear(); __RS.start('tutorial'); }); await sleep(300);
const r = await drive(page, (W, P, f, m) => {
  const T = 24, x = P.cx, t = __RS.tut(); if (!t || W.mode !== 'tutorial') return null; m.log = m.log || []; if (t.step !== m.ls) { m.log.push([f, t.step, Math.round(x / T), Math.round(P.y / T)]); m.ls = t.step; }
  if (!m.on) { m.on = 1; m.ev = {}; W.on((n) => { m.ev[n] = (m.ev[n] || 0) + 1; }); }
  if (W.countdown > 0) return { };
  if (P.hp < (m.hp ?? P.hp)) m.log.push(['hurt', f, Math.round(x / T)]); m.hp = P.hp;
  const a = { mx: 1, b: [] }; const hs = P.hook.s;
  if (x > 17.5 * T && x < 20 * T) { a.b.push('jump'); }
  if (x > 27 * T && x < 34 * T && hs === 'none' && P.hookTarget && f - (m.h1 || -99) > 10) { a.b.push('hook'); m.h1 = f; m.log.push(['hook', f, Math.round(x / T)]); }
  if (x > 27 * T && x < 31.5 * T && P.onGround && !P.hookTarget) a.b.push('jump');
  if (hs === 'swing' && x > 39.5 * T && P.vx > 0) { a.b.push('jump'); }
  if (0) m.log.push([f, Math.round(P.x), Math.round(P.y + P.h), Math.round(P.vx), Math.round(P.vy), hs, P.dead ? 1 : 0]);
  if (hs !== m.hs) { m.log.push(['hs', f, hs, Math.round(x / T)]); m.hs = hs; }
  if (t.step === 4 && !t.done.includes(4)) { const d = W.enemies.find((e) => e.type === 'dummy'); a.mx = d && d.x - x > 30 ? 1 : 0; if (f % 16 === 0) a.b.push('attack');   }
  if (x > 64.6 * T && x < 67 * T) { a.b.push('jump'); if (P.vy > -60 && !P.onGround) a.b.push('dash'); }
  if (x > 76 * T && x < 82 * T && hs === 'none' && !m.z && P.onGround) { a.my = -1; a.b.push('hook'); m.z = f; }
  if (hs === 'zip' || hs === 'fly') a.mx = 0.3;
  if (t.step === 7 && !t.done.includes(7) && x > 96 * T) { a.mx = 0; for (const s of W.shots) if (s.owner === 'enemy' && Math.abs(s.x - x) < 40 && Math.abs(s.y - P.cy) < 40) a.b.push('parry'); }
  if (f === 3599) { const q = W.enemies.find((e) => e.type === 'tturret'); if (q) m.q = { x: q.x, y: q.y, st: q.st, cd: q.cd, act: q.active, sleep: q.sleep, shots: W.shots.length, py: P.y }; }
  if (t.done.includes(7)) { const dr = W.props.find((o) => o.kind === 'door'); const ddx = dr.x + dr.w / 2 - x; a.mx = Math.abs(ddx) > 8 ? Math.sign(ddx) : 0; a.b = !a.mx && f % 10 === 0 ? ['attack'] : []; }
  if (W.mode !== 'tutorial' || __RS.game.state !== 'play') return null;
  return a;
}, 60 * 60);
console.log(JSON.stringify(r).slice(0, 300)); console.log('AFTER', JSON.stringify(await page.evaluate(() => ({ s: __RS.state(), tutDone: __RS.save.tutorialDone ?? __RS.save.tut })))); await sleep(1200); await page.screenshot({ path: '../shots/pt-tutorial.png' }); console.log('ERR', errors);
await browser.close(); server.close();
