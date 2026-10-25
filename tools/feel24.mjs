// v2.4 feel probe: swing / whip / bow traces + frame strips.  node tools/feel24.mjs <tag>  -> shots/v24/<tag>/
import { serve, launch, sleep } from './lib.mjs'; import fs from 'fs';
const tag = process.argv[2] || 'now', OUT = new URL(`../shots/v24/${tag}/`, import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await serve(); const L = await launch({ w: 1280, h: 576 }); await L.page.goto(url); await sleep(1500);
const res = await L.page.evaluate(() => {
  const S = __RS; S.save.progress.tutorialDone = true; S.save.settings.hookAssist = true; Object.assign(S.save.progress.unlocks, { hammer: true, whip: true, bow: true });
  const out = { m: {}, tr: {}, strips: {} };
  const setup = (wpn = 'blade') => { S.save.progress.weapon = wpn; S.start('hub', {}); S.manual(true); const W = S.W; W.countdown = 0; W.fade = 0; W.props = []; W.anchors = []; W.enemies = []; S.god(true);
    const P = W.player; P.weapon = wpn; P.x = 6 * S.TILE; P.y = 18 * S.TILE - P.h; P.vx = P.vy = 0; P.face = 1; P.hook = { s: 'none' }; P.atk = null; W.snapCamera(); S.axes(0, 0); for (const b of ['jump', 'attack', 'hook', 'dash']) S.release(b); S.step(10); return { W, P }; };
  const snap = (W, P, wide = 1, zoomOut = 1) => { S.renderNow(); const c = document.getElementById('c'), [zr, tox, toy] = W.wt; const sx = P.cx * zr + tox, sy = P.cy * zr + toy; const cw = 170 * zr * wide * zoomOut, ch = 170 * zr * zoomOut; const o = document.createElement('canvas'); o.width = Math.round(230 * wide); o.height = 230; o.getContext('2d').drawImage(c, sx - cw / 2, sy - ch * 0.62, cw, ch, 0, 0, o.width, o.height); return o.toDataURL('image/png'); };
  const run = (W, P, n, plan, strip, extra) => { const tr = [], shots = []; for (let f = 0; f < n; f++) { const p = plan[f] || {}; if (p.axes) S.axes(p.axes[0], p.axes[1]); for (const b of p.release || []) S.release(b); for (const b of p.press || []) S.press(b); if (p.fn) p.fn(W, P);
      S.step(1); const h = P.hook, a = P.atk; const r = { f, x: +P.cx.toFixed(2), y: +P.cy.toFixed(2), vx: +P.vx.toFixed(1), vy: +P.vy.toFixed(1), hook: h.s, atk: a ? (a.kind + ':' + a.phase + ':' + (a.step || 0)) : '', hs: W.hs > 0 ? 1 : 0, zoom: +(W.zoomK || 0).toFixed(3), len: h.len ? +h.len.toFixed(1) : 0, hx: h.hx, hy: h.hy, ch: +(P.chargeT || 0).toFixed(3), draw: P.bow ? +(P.bow.k || 0).toFixed(3) : 0 };
      if (extra) Object.assign(r, extra(W, P)); tr.push(r);
      if (strip && f >= (strip.from || 0) && (f - (strip.from || 0)) % strip.every === 0 && shots.length < (strip.max || 12)) shots.push(snap(W, P, strip.wide || 1, strip.zo || 1)); }
    return { tr, shots }; };
  const tap = (plan, f, b, len = 1) => { (plan[f] = plan[f] || {}).press = [...(plan[f].press || []), b]; (plan[f + len] = plan[f + len] || {}).release = [...(plan[f + len].release || []), b]; };
  const G = 1480;
  // 1) swing: hook an anchor up-ahead, no input for 150 f -> energy drift; strip
  { const { W, P } = setup(); W.anchors.push({ x: P.cx + 120, y: P.cy - 130, kind: 'swing', pulse: 0 }); const plan = {}; tap(plan, 0, 'hook'); const r = run(W, P, 170, plan, { every: 5, from: 4, max: 14, wide: 1.6, zo: 1.3 });
    const sw = r.tr.filter((t) => t.hook === 'swing'); const E = sw.map((t) => 0.5 * (t.vx * t.vx + t.vy * t.vy) - G * t.y * 1); const e0 = E[Math.min(10, E.length - 1)]; const ee = E.slice(10);
    out.m.swingFrames = sw.length; out.m.swingEnergyDriftPct = ee.length ? Math.round((Math.min(...ee) - e0) / Math.abs(e0 || 1) * 1000) / 10 : null;
    out.m.swingEnergyLossPerSecPct = ee.length > 60 ? Math.round((ee[60] - ee[0]) / (0.5 * 300 * 300) * 1000) / 10 : null;
    let dv = 0, at = -1; const att = r.tr.findIndex((t) => t.hook === 'swing'); for (let i = Math.max(1, att - 1); i < att + 8 && i < r.tr.length; i++) { const d = Math.hypot(r.tr[i].vx - r.tr[i - 1].vx, r.tr[i].vy - r.tr[i - 1].vy - G / 60); if (d > dv) { dv = d; at = i; } }
    { const L = sw.map((t) => t.len), spd = sw.map((t) => Math.hypot(t.vx, t.vy)); const st = L.findIndex((l, i) => i > 0 && Math.abs(l - L[i - 1]) < 0.05); const pk = []; for (let i = Math.max(1, st); i < spd.length - 1; i++) if (spd[i] >= spd[i - 1] && spd[i] > spd[i + 1] && spd[i] > 60) pk.push(Math.round(spd[i]));
      out.m.swingPeakSpeeds = pk; out.m.swingPeakDecayPct = pk.length > 1 ? Math.round((pk[pk.length - 1] - pk[0]) / pk[0] * 1000) / 10 : null; }
    out.m.attachJerk = Math.round(dv); out.m.attachFrame = att; out.tr.swing = r.tr; out.strips.swing = r.shots; }
  // 2) pump: same but input follows motion -> amplitude (max speed) growth over 4 s
  { const { W, P } = setup(); W.anchors.push({ x: P.cx + 60, y: P.cy - 140, kind: 'swing', pulse: 0 }); const plan = {}; tap(plan, 0, 'hook'); for (let f = 20; f < 260; f++) plan[f] = { fn: (W, P) => S.axes(P.vx > 0 ? 1 : -1, 0) };
    const r = run(W, P, 260, plan); const sw = r.tr.filter((t) => t.hook === 'swing'); const sp = sw.map((t) => Math.hypot(t.vx, t.vy));
    out.m.pumpSpeedFirstSec = Math.round(Math.max(...sp.slice(0, 60))); out.m.pumpSpeedLastSec = Math.round(Math.max(...sp.slice(-60))); out.m.pumpFrames = sw.length; out.tr.pump = r.tr; S.axes(0, 0); }
  // 3) release: swing then jump at the bottom-forward point -> launch speed and flight
  { const { W, P } = setup(); W.anchors.push({ x: P.cx + 120, y: P.cy - 130, kind: 'swing', pulse: 0 }); const plan = {}; tap(plan, 0, 'hook'); plan[18] = { axes: [1, 0] };
    let rel = -1; for (let f = 20; f < 140; f++) plan[f] = { ...(plan[f] || {}), fn: (W, P) => { if (rel < 0 && P.hook.s === 'swing' && P.vx > 0 && P.cx > P.hook.hx + 20) { rel = f; S.press('jump'); } else if (rel >= 0 && f === rel + 8) S.release('jump'); } };
    const r = run(W, P, 150, plan, { every: 4, from: 30, max: 14, wide: 1.6, zo: 1.3 }); const i = r.tr.findIndex((t, k) => k > 5 && t.hook === 'none' && r.tr[k - 1].hook === 'swing');
    const pre = i > 0 ? r.tr[i - 1] : null, post = i > 0 ? r.tr[i] : null; out.m.release = pre && { preSpeed: Math.round(Math.hypot(pre.vx, pre.vy)), postVx: post.vx, postVy: post.vy, postSpeed: Math.round(Math.hypot(post.vx, post.vy)), carry: +(Math.hypot(post.vx, post.vy) / Math.max(1, Math.hypot(pre.vx, pre.vy))).toFixed(2) };
    const land = r.tr.findIndex((t, k) => k > i + 5 && P.onGround); out.m.releaseDistPx = i > 0 ? Math.round(r.tr[r.tr.length - 1].x - r.tr[i].x) : null; out.tr.release = r.tr; out.strips.release = r.shots; }
  // 4) whip combo: 4 taps vs a dummy at 80 px
  { const { W, P } = setup('whip'); W.spawnEnemy('dummy', P.cx + 85, P.y + P.h); const e = W.enemies[W.enemies.length - 1]; if (e) { e.hp = e.maxHp = 1e6; e.stun = 0; }
    const hits = []; const h0 = W.hitEnemy.bind(W); W.hitEnemy = (en, h, p) => { hits.push({ f: fr, crit: !!h.crit, tipHit: !!h.tipHit, tip: !!h.tip, dmg: h.dmg, mv: h.mv }); return h0(en, h, p); }; let fr = 0;
    const plan = {}; for (const f of [0, 16, 32, 50]) tap(plan, f, 'attack', 2); for (let f = 0; f < 110; f++) plan[f] = { ...(plan[f] || {}), fn: () => { fr = f; } };
    const r = run(W, P, 110, plan, { every: 2, from: 0, max: 30, wide: 1.5 }, (W, P) => ({ tip: P.whipTip ? [+P.whipTip[0].toFixed(1), +P.whipTip[1].toFixed(1)] : null }));
    out.m.whipHits = hits; out.m.whipActiveFrames = r.tr.filter((t) => t.atk.includes('active')).length; out.m.whipHitstopFrames = r.tr.filter((t) => t.hs).length; out.m.whipSteps = [...new Set(r.tr.map((t) => t.atk).filter(Boolean).map((a) => a.split(':')[0] + a.split(':')[2]))];
    out.tr.whip = r.tr; out.strips.whip = r.shots; }
  // 5) bow: tap shot then hold-charge shot
  { const { W, P } = setup('bow'); W.spawnEnemy('dummy', P.cx + 260, P.y + P.h); const e = W.enemies[W.enemies.length - 1]; if (e) { e.hp = e.maxHp = 1e6; }
    const hits = []; let fr = 0; const h0 = W.hitEnemy.bind(W); W.hitEnemy = (en, h, p) => { hits.push({ f: fr, dmg: h.dmg, crit: !!h.crit, tag: h.tag || '', src: h.src, mv: h.mv || '' }); return h0(en, h, p); };
    const plan = {}; tap(plan, 0, 'attack', 3); tap(plan, 40, 'attack', 50); for (let f = 0; f < 150; f++) plan[f] = { ...(plan[f] || {}), fn: () => { fr = f; } };
    const shotsTr = []; const r = run(W, P, 150, plan, { every: 4, from: 36, max: 16, wide: 2.2 }, (W, P) => { const s = W.shots.find((s) => s.arrow); if (s) shotsTr.push([fr, +s.x.toFixed(1), +s.y.toFixed(1)]); return { bowK: P.bowS ? +P.bowS.k.toFixed(3) : -1, bowCd: +(P.bowCd || 0).toFixed(3), pose: P.heroPose(W).n }; });
    out.m.bowHits = hits; out.m.bowArrowPts = shotsTr.length; out.tr.bow = r.tr; out.tr.arrow = shotsTr; out.strips.bow = r.shots; }
  return out; });
for (const [k, list] of Object.entries(res.strips)) list.forEach((d, i) => fs.writeFileSync(`${OUT}${k}-${String(i).padStart(2, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')));
delete res.strips; fs.writeFileSync(OUT + 'feel.json', JSON.stringify(res)); console.log(JSON.stringify(res.m, null, 1)); console.log('errors', L.errors.length, L.errors.slice(0, 3));
await L.browser.close(); server.close();
