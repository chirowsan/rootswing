// v1.4 feel harness: scripted attack / air-attack / hook / hook+attack sequences, per-frame traces, metrics, contact strips.
// node tools/feel.mjs <tag>   -> shots/v14/feel-<tag>.json + shots/v14/strip-<tag>-<scenario>.png
import { serve, launch, sleep } from './lib.mjs'; import fs from 'fs'; import { execFileSync } from 'child_process';
const tag = process.argv[2] || 'now';
const { server, url } = await serve(); const L = await launch(); await L.page.goto(url); await sleep(1200);
const res = await L.page.evaluate(() => {
  const S = __RS; S.save.progress.tutorialDone = true; S.save.settings.hookAssist = true; const out = { metrics: {}, traces: {}, strips: {} };
  const setup = (opts = {}) => {
    S.start('hub', {}); S.manual(true); const W = S.W; W.countdown = 0; W.fade = 0; W.props = []; W.anchors = []; W.enemies = []; S.god(true);
    const P = W.player; P.weapon = opts.weapon || 'blade'; P.x = 6 * S.TILE; P.y = 18 * S.TILE - P.h; P.vx = P.vy = 0; P.face = 1; P.hook = { s: 'none' }; P.atk = null;
    W.snapCamera(); S.axes(0, 0); for (const b of ['jump', 'attack', 'hook', 'dash']) S.release(b); S.step(10); return { W, P, gy: 18 * S.TILE };
  };
  // plan: { f: { press:[], release:[], axes:[x,y] } }; returns per-frame trace
  const run = (W, P, n, plan, onFrame, strip) => {
    const tr = []; let ax = [0, 0]; const shots = [];
    for (let f = 0; f < n; f++) {
      const p = plan[f] || {}; if (p.axes) { ax = p.axes; S.axes(ax[0], ax[1]); } for (const b of p.release || []) S.release(b); for (const b of p.press || []) S.press(b);
      S.step(1);
      const a = P.atk; tr.push({ f, x: +P.x.toFixed(2), y: +P.y.toFixed(2), vx: +P.vx.toFixed(1), vy: +P.vy.toFixed(1), g: P.onGround ? 1 : 0, atk: a ? a.kind + ':' + a.phase + (a.up ? ':up' : '') : '', hook: P.hook.s, hs: W.hs > 0 ? 1 : 0 });
      if (onFrame) onFrame(f, tr[tr.length - 1]);
      if (strip && f % strip.every === 0 && f >= (strip.from || 0) && shots.length < (strip.max || 12)) {
        S.renderNow(); const c = document.getElementById('c'), [zr, tox, toy] = W.wt; const rs = zr; const sx = P.cx * zr + tox, sy = P.cy * zr + toy; const cw = 150 * rs * (strip.wide || 1), chh = 150 * rs; const o = document.createElement('canvas'); o.width = 220 * (strip.wide || 1); o.height = 220;
        o.getContext('2d').drawImage(c, sx - cw / 2, sy - chh * 0.6, cw, chh, 0, 0, o.width, o.height); shots.push(o.toDataURL('image/png'));
      }
    }
    return { tr, shots };
  };
  const tap = (plan, f, b, len = 1) => { (plan[f] = plan[f] || {}).press = [...(plan[f].press || []), b]; (plan[f + len] = plan[f + len] || {}).release = [...(plan[f + len].release || []), b]; };
  const M = out.metrics;
  // 1 ground attack startup
  { const { W, P } = setup(); const plan = {}; tap(plan, 0, 'attack'); const r = run(W, P, 30, plan, null, { every: 2, max: 10 }); M.groundAtkFirstActiveFrame = r.tr.findIndex((t) => t.atk.includes('active')) + 1; out.traces.groundAtk = r.tr; out.strips.groundAtk = r.shots; }
  // 1b running combo momentum: hold right, 3 taps
  { const { W, P } = setup(); const plan = { 0: { axes: [1, 0] } }; tap(plan, 30, 'attack'); tap(plan, 38, 'attack'); tap(plan, 46, 'attack'); const r = run(W, P, 80, plan);
    const base = r.tr[29].vx; const seg = r.tr.slice(30, 70); M.runComboMinVxPct = Math.round(Math.min(...seg.map((t) => t.vx)) / base * 100); M.runComboDist40f = Math.round(r.tr[69].x - r.tr[29].x); M.runNoAtkDist40f = Math.round(base * 40 / 60); out.traces.runCombo = r.tr; }
  // 2 air attack momentum vs plain jump
  const jumpRun = (withAtk, extra = {}) => { const { W, P } = setup(); const plan = { 0: { axes: [1, 0] } }; tap(plan, 40, 'jump', 14); if (withAtk) tap(plan, withAtk, 'attack'); Object.assign(plan, extra);
    const r = run(W, P, 110, plan, null, withAtk ? { every: 3, from: 40, max: 12 } : null); const land = r.tr.findIndex((t, i) => i > 45 && t.g); return { r, land, x: r.tr[land].x - r.tr[40].x, v0: r.tr[39].vx, minVx: Math.min(...r.tr.slice(41, land).map((t) => t.vx)), apex: Math.min(...r.tr.slice(40, land).map((t) => t.y)) }; };
  { const a = jumpRun(0), b = jumpRun(46); M.airAtkMomentumLostPct = Math.round((1 - b.minVx / b.v0) * 100); M.airAtkDistDeltaPx = Math.round(b.x - a.x); M.airAtkAirtimeDeltaF = b.land - a.land; M.airAtkApexDeltaPx = Math.round(a.apex - b.apex);
    const c = jumpRun(46); out.traces.airAtk = b.r.tr; out.traces.plainJump = a.r.tr; out.strips.airAtk = b.r.shots;
    // 3 air swings in one jump
    const d = (() => { const { W, P } = setup(); const plan = { 0: { axes: [1, 0] } }; tap(plan, 40, 'jump', 20); tap(plan, 43, 'attack'); tap(plan, 52, 'attack'); tap(plan, 61, 'attack'); const r = run(W, P, 100, plan); let n = 0; for (let i = 1; i < r.tr.length; i++) if (r.tr[i].atk.startsWith('air:wind') && !r.tr[i - 1].atk.startsWith('air:wind')) n++; return n; })(); M.airSwingsIn1Jump = d; }
  // 2b jump + attack on the same frame
  { const { W, P } = setup(); const plan = {}; tap(plan, 0, 'jump', 10); tap(plan, 0, 'attack'); const r = run(W, P, 12, plan); M.jumpAtkSameFrame = { jumped: r.tr.some((t) => t.vy < -100), airAtk: r.tr.some((t) => t.atk.startsWith('air')) }; }
  // 2c down-air / up-air
  { const { W, P } = setup(); const plan = {}; tap(plan, 0, 'jump', 14); plan[8] = { axes: [0, 1] }; tap(plan, 8, 'attack'); const r = run(W, P, 40, plan); M.downAir = r.tr.some((t) => t.atk.startsWith('plunge')); }
  { const { W, P } = setup(); const plan = {}; tap(plan, 0, 'jump', 14); plan[6] = { axes: [0, -1] }; tap(plan, 6, 'attack'); const r = run(W, P, 30, plan); M.upAir = r.tr.some((t) => t.atk.includes(':up')); }
  // 2d attack right after a wall-jump: wall at the right
  { const { W, P, gy } = setup(); const tx = 12; for (let y = 8; y < 18; y++) W.map.set(tx, y, '#'); W.chunkCache.clear(); P.x = tx * S.TILE - P.w - 1; P.y = gy - P.h - 70; P.vy = 80; P.coyote = 0; P.onGround = false; const plan = { 0: { axes: [1, 0] } }; tap(plan, 3, 'jump', 10); tap(plan, 5, 'attack'); const r = run(W, P, 25, plan);
    out.traces.wall = r.tr; M.atkAfterWallJump = { wallJumped: r.tr.some((t) => t.vx < -100), airAtk: r.tr.some((t) => t.atk.startsWith('air')) }; }
  // 3 rapid tapping: 8 taps/s for 3 s, standing
  { const { W, P } = setup(); const plan = {}; const taps = []; for (let f = 0; f < 180; f += 7) { tap(plan, f, 'attack'); taps.push(f); } const a0 = P.stats.attacks; const r = run(W, P, 200, plan); const started = P.stats.attacks - a0;
    let idle = 0; for (let f = 0; f < 176; f++) if (!r.tr[f].atk) idle++; M.rapidTaps = { taps: taps.length, attacksStarted: started, idleFramesDuringTapping: idle }; }
  // 3b cancels out of an attack (press during the wind-up)
  const cancel = (b, test) => { const { W, P } = setup(); const plan = {}; tap(plan, 0, 'attack'); tap(plan, 2, b, b === 'jump' ? 10 : 1); W.anchors.push({ x: P.cx + 90, y: P.y - 110, kind: 'swing', pulse: 0 }); const r = run(W, P, 40, plan); const i = r.tr.findIndex((t, k) => k >= 2 && test(t)); return i < 0 ? 'dropped' : i - 2 + 1; };
  M.cancelFrames = { jump: cancel('jump', (t) => t.vy < -100), hook: cancel('hook', (t) => t.hook !== 'none'), dash: cancel('dash', (t) => Math.abs(t.vx) > 400) };
  // 4 hook swing: attach, swing, jump-release; velocity discontinuity = max |dv - g dt| per frame
  const dvMax = (tr, from, to) => { let m = 0, at = -1; for (let i = Math.max(1, from); i < to; i++) { const ddx = tr[i].vx - tr[i - 1].vx, ddy = tr[i].vy - tr[i - 1].vy - 1480 / 60; const v = Math.hypot(ddx, ddy); if (v > m) { m = v; at = i; } } return { px_s: Math.round(m), frame: at }; };
  { const { W, P } = setup(); W.anchors.push({ x: P.cx + 110, y: P.y - 120, kind: 'swing', pulse: 0 }); const plan = {}; tap(plan, 0, 'hook'); plan[20] = { axes: [1, 0] }; tap(plan, 60, 'jump', 12); const r = run(W, P, 100, plan, null, { every: 6, max: 14, wide: 1.4 });
    const att = r.tr.findIndex((t) => t.hook === 'swing'); M.hookThrowToAttachF = att + 1; M.swingDvMax = dvMax(r.tr, 1, 59); M.swingReleaseDv = dvMax(r.tr, 59, 64); M.swingAttachDv = dvMax(r.tr, att - 1, att + 3); out.traces.swing = r.tr; out.strips.swing = r.shots; }
  // 4b zip to crystal
  { const { W, P } = setup(); W.anchors.push({ x: P.cx + 150, y: P.y - 90, kind: 'zip', pulse: 0 }); const plan = {}; tap(plan, 0, 'hook'); const r = run(W, P, 60, plan, null, { every: 3, max: 12 }); M.zipDvMax = dvMax(r.tr, 1, 59); out.traces.zip = r.tr; out.strips.zip = r.shots; }
  // 4c re-hook chain: hook A, press hook again while swinging toward B
  { const { W, P } = setup(); W.anchors.push({ x: P.cx + 90, y: P.y - 110, kind: 'swing', pulse: 0 }, { x: P.cx + 260, y: P.y - 130, kind: 'swing', pulse: 1 }); const plan = { 0: { axes: [1, 0] } }; tap(plan, 0, 'hook'); tap(plan, 40, 'hook'); let tgtB = -1;
    const r = run(W, P, 80, plan, (f) => { if (tgtB < 0 && P.hook.tgt && P.hook.tgt.x > P.x + 0 && P.hook.tgt === W.anchors[1]) tgtB = f; }); M.rehookFramesToSecondAnchor = tgtB < 0 ? 'none' : tgtB - 40 + 1; M.rehookDv = dvMax(r.tr, 38, 70); }
  // 5 hook light enemy, then attack
  const enemyHit = (type, atkDelay) => { const { W, P } = setup(); W.spawnEnemy(type, P.cx + 130, P.y + P.h - 2); const e = W.enemies[W.enemies.length - 1]; e.stun = 0; e.hp = e.maxHp = 9999; const hp0 = e.hp; const plan = {}; tap(plan, 0, 'hook'); let atkF = -1, hitF = -1, hookHitDone = -1;
    const r = run(W, P, 70, plan, (f, t) => { if (hookHitDone < 0 && e.hp < hp0) hookHitDone = f; if (hookHitDone >= 0 && atkF < 0 && f >= hookHitDone + atkDelay) { atkF = f; S.press('attack'); } else if (atkF >= 0 && f === atkF + 1) S.release('attack'); if (atkF >= 0 && hitF < 0 && f > atkF && e.hp < (e.hpAtAtk ?? (e.hpAtAtk = e.hp))) hitF = f; }, { every: 3, max: 14 });
    return { hookHit: hookHitDone + 1, atkToHitF: hitF < 0 ? 'missed' : hitF - atkF, r }; };
  { const a = enemyHit('hopper', 2); M.hookLightThenAttack = { hookHitFrame: a.hookHit, attackPressToHitF: a.atkToHitF }; out.strips.hookAttack = a.r.shots; out.traces.hookAttack = a.r.tr; }
  { const { W, P } = setup(); W.spawnEnemy('puffcap', P.cx + 150, P.y + P.h - 2); const e = W.enemies[W.enemies.length - 1]; e.stun = 0; e.hp = e.maxHp = 9999; const plan = {}; tap(plan, 0, 'hook'); let zipF = -1, atkHits = 0, hp = e.hp; const hits = [];
    const r = run(W, P, 60, plan, (f, t) => { if (zipF < 0 && t.hook === 'zip') { zipF = f; S.press('attack'); } else if (zipF >= 0 && f === zipF + 1) S.release('attack'); if (e.hp < hp) { hits.push(f); hp = e.hp; } });
    out.traces.heavy = r.tr; out.heavyInfo = { light: e.light, hp: e.hp, type: e.type, ex: e.cx, dead: e.dead }; M.hookHeavyAttackDuringZip = { zipFrame: zipF, hitFrames: hits, hits: hits.length }; }
  // 6 swing attack: attack while swinging keeps the swing?
  { const { W, P } = setup(); W.anchors.push({ x: P.cx + 110, y: P.y - 120, kind: 'swing', pulse: 0 }); const plan = {}; tap(plan, 0, 'hook'); tap(plan, 35, 'attack'); const r = run(W, P, 60, plan, null, { every: 3, from: 30, max: 10, wide: 1.4 });
    M.swingAttack = { attacked: r.tr.slice(35, 50).some((t) => t.atk), stillSwinging10fLater: r.tr[46].hook === 'swing', dv: dvMax(r.tr, 34, 46) }; out.strips.swingAttack = r.shots; }
  S.manual(false); S.god(false); return out;
});
fs.writeFileSync(`shots/v14/feel-${tag}.json`, JSON.stringify({ heavyInfo: res.heavyInfo, metrics: res.metrics, traces: res.traces }, null, 0));
for (const [k, arr] of Object.entries(res.strips)) { const dir = `/tmp/strip-${tag}-${k}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); arr.forEach((d, i) => fs.writeFileSync(`${dir}/${String(i).padStart(2, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')));
  execFileSync('python3', ['-c', `import sys,glob;from PIL import Image,ImageDraw;fs=sorted(glob.glob('${dir}/*.png'));ims=[Image.open(f) for f in fs];w=sum(i.width for i in ims)+4*len(ims);S=Image.new('RGB',(w,ims[0].height+22),(20,18,30));d=ImageDraw.Draw(S);d.text((4,4),'${tag}: ${k}',fill=(255,226,122));x=0
for i in ims: S.paste(i,(x,22)); x+=i.width+4
S.save('shots/v14/strip-${tag}-${k}.png')`]); }
console.log(JSON.stringify(res.metrics, null, 1)); console.log('errors', L.errors.slice(0, 3)); await L.browser.close(); server.close();
