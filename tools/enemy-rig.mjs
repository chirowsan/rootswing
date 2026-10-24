// v1.4 enemy animation probe: renders every enemy in every animation state at 4 sample times, returns per-state pixel
// hashes + painted frame names (for the test) and optional contact-sheet PNGs (shots/v14/enemies/<name>.png).
export async function enemyStates(page, sheets = false) {
  return page.evaluate((sheets) => {
    __RS.save.progress.tutorialDone = true; if (!__RS.W) { __RS.start('hub'); __RS.manual(true); __RS.skipCountdown && __RS.skipCountdown(); __RS.step(5); }
    const W = __RS.W, F = __RS.foes;
    const mk = (n) => n === 'warden' ? new F.Warden(0, 0, 1) : n === 'tidegolem' ? new F.TideGolem(0, 0, 1) : n === 'boss' ? new F.Boss(0, 0) : n === 'drowned' ? new F.DrownedBloom(0, 0) : new F.Enemy(n, 0, 0, 2);
    const four = (fn) => [0, 1, 2, 3].map(fn);
    const idle = ['idle (breathe)', { st: 'idle' }, four((i) => ({ anim: 0.2 + i * 0.37 }))];
    const move = (vx, stride) => ['move', { st: 'idle', vx }, four((i) => ({ _ph: i * stride + 1, anim: 0.3 + i * 0.09 }))];
    const tele = (st = 'tele', x = {}) => [st, { st, ...x }, four((i) => ({ tele: 0.15 + i * 0.28, anim: 0.4 + i * 0.07 }))];
    const hurt = (st = 'idle') => ['hurt', { st }, four((i) => ({ flash: 0.15 - i * 0.035, anim: 0.5 + i * 0.03 }))];
    const turn = (st = 'idle', x = {}) => ['turn', { st, ...x }, four((i) => ({ _turn: 0.11 - i * 0.03, anim: 0.6 + i * 0.03 }))];
    const ss = (label, st, x, step = 0.08, extra = () => ({})) => [label, { st, ...x }, four((i) => ({ _sst: i * step, anim: 0.7 + i * step, ...extra(i) }))];
    const fired = (label = 'attack (fire)') => [label, { st: 'idle', _from: 'tele' }, four((i) => ({ _sst: i * 0.07, anim: 0.8 + i * 0.07 }))];
    const T = {
      hopper: [idle, ['move (hop arc)', { st: 'hop', onGround: false, vx: 120 }, four((i) => ({ vy: -320 + i * 210, anim: i * 0.1 }))], tele(), ['land / recover', { st: 'idle' }, four((i) => ({ _land: 0.15 - i * 0.04, anim: i * 0.05 }))], hurt(), turn()],
      charger: [idle, move(45, 13), tele(), ss('attack (charge)', 'charge', { vx: 300 }, 0.05), ss('recover', 'rest', {}, 0.15), hurt(), turn('idle', { vx: 45 })],
      moth: [['idle (flap)', { st: 'idle', fly: true }, four((i) => ({ anim: 0.2 + i * 0.05 }))], ['move', { st: 'idle', vx: 100 }, four((i) => ({ anim: 0.25 + i * 0.05 }))], tele(), ss('attack (swoop)', 'swoop', { vx: 220, vy: 200 }, 0.06, (i) => ({ vy: 260 - i * 120 })), hurt(), turn()],
      puffcap: [idle, ['move (shuffle)', { st: 'idle' }, four((i) => ({ anim: 0.1 + i * 0.32 }))], tele(), fired('attack (puff)'), ['recover', { st: 'idle', _from: 'tele' }, four((i) => ({ _sst: 0.2 + i * 0.05, anim: 1 + i * 0.05 }))], hurt(), turn()],
      knight: [idle, move(55, 11), tele(), ss('attack (swing)', 'swing', { vx: 90 }, 0.045), ss('recover', 'rec', {}, 0.12), hurt(), turn('idle', { vx: 55 })],
      bomber: [idle, move(50, 10), tele(), fired('attack (lob)'), ['recover', { st: 'idle', _from: 'tele' }, four((i) => ({ _sst: 0.2 + i * 0.05, anim: 1 + i * 0.05 }))], hurt(), turn('idle', { vx: 50 })],
      lurefish: [['idle (swim)', { st: 'idle' }, four((i) => ({ anim: 0.1 + i * 0.13 }))], ['move', { st: 'idle', vx: 80 }, four((i) => ({ anim: 0.3 + i * 0.13 }))], tele(), ss('attack (bite)', 'swoop', { vx: 240, vy: 150 }, 0.06, (i) => ({ vy: 200 - i * 120 })), hurt(), turn()],
      jelly: [['idle (pulse)', { st: 'idle' }, four((i) => ({ anim: 0.1 + i * 0.4 }))], ['move', { st: 'idle', vx: 50 }, four((i) => ({ anim: 0.3 + i * 0.4 }))], tele(), ['attack (pulse)', { st: 'pulse' }, four((i) => ({ ring: 0.1 + i * 0.28, anim: 1 + i * 0.07 }))], hurt(), turn()],
      shellback: [idle, move(40, 12), tele(), ss('attack (roll)', 'charge', { vx: 260 }, 0.04), ss('recover', 'rest', {}, 0.2), hurt(), turn('idle', { vx: 40 })],
      tturret: [['idle', { st: 'idle' }, four((i) => ({ anim: 0.1 + i * 0.5 }))], tele(), fired('attack (fire)'), ['recover', { st: 'idle', _from: 'tele' }, four((i) => ({ _sst: 0.18 + i * 0.05, anim: 1 + i * 0.05 }))], hurt(), turn()],
      dummy: [['idle (sway)', { st: 'idle' }, four((i) => ({ anim: 0.3 + i * 0.6 }))], hurt(), ['hurt (late)', { st: 'idle' }, four((i) => ({ flash: 0.09 - i * 0.02, anim: 2 + i * 0.03 }))]],
    };
    const WD = [['sleep', { st: 'sleep' }, four((i) => ({ anim: i * 0.6 }))], ss('wake', 'wake', {}, 0.3), idle, move(60, 13), tele('bashTele'), ss('attack (bash)', 'bash', { vx: 330 }, 0.05), tele('leapTele'), ['attack (leap)', { st: 'leap', onGround: false }, four((i) => ({ _sst: i * 0.15, anim: i * 0.15, onGround: i === 3 }))],
      ss('recover', 'rest', { _from: 'leap' }, 0.22), ss('summon', 'summon', { tele: 0.8 }, 0.1), hurt(), ['stunned', { st: 'idle', stun: 1 }, four((i) => ({ anim: i * 0.12 }))], turn()];
    const BS = (ph) => [idle, move(55, 20), ['slamTele p1', { st: 'slamTele', phase: 1 }, four((i) => ({ tele: 0.15 + i * 0.28, anim: i * 0.05 }))], ['slamTele p3', { st: 'slamTele', phase: 3 }, four((i) => ({ tele: 0.15 + i * 0.28, anim: i * 0.05 }))],
      ss('attack (slam)', 'slam', {}, 0.12), tele('volleyTele'), ss('volley', 'volley', {}, 0.2), tele('beamTele'), ss('beam', 'beam', { beamT: 0.3 }, 0.1), tele('chargeTele'), ss('attack (charge)', 'charge', { vx: 380 }, 0.05), ss('roar (phase)', 'roar', {}, 0.2), ss('dying', 'dying', {}, 0.5), hurt(), turn()];
    T.warden = WD; T.tidegolem = WD; T.boss = BS(); T.drowned = BS();
    const out = {};
    const hash = (g, x, y, w, h) => { const d = g.getImageData(x, y, w, h).data; let a = 2166136261; for (let i = 0; i < d.length; i += 12) { a ^= d[i] + (d[i + 1] << 8) + (d[i + 2] << 16); a = Math.imul(a, 16777619); } return (a >>> 0).toString(16); };
    for (const [name, rows] of Object.entries(T)) {
      const big = ['warden', 'tidegolem'].includes(name), huge = ['boss', 'drowned'].includes(name);
      const cw = huge ? 250 : big ? 140 : 84, chh = huge ? 230 : big ? 120 : 78, rs = huge ? 1.2 : big ? 1.6 : 2.2, lw = 70;
      const allRows = [...rows, ['death (shatter)', null, four((i) => ({ dt: 0.06 + i * 0.12 }))]];
      const c = document.createElement('canvas'); c.width = Math.round((lw + 4 * cw) * rs); c.height = Math.round(allRows.length * chh * rs); const g = c.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#3a4456'; g.fillRect(0, 0, c.width, c.height);
      const res = { hashes: {}, frames: {}, errors: [] };
      allRows.forEach(([label, base, samples], r) => {
        g.setTransform(rs, 0, 0, rs, 0, 0); g.fillStyle = '#e8e8c0'; g.font = '9px sans-serif'; g.fillText(label, 3, r * chh + chh / 2); g.fillText(name, 3, r * chh + chh / 2 + 11);
        samples.forEach((smp, i) => {
          const e = mk(name), cx = lw + i * cw + cw / 2, fy = r * chh + chh - 12;
          e.x = 2000 - e.w / 2; e.y = 1000 - e.h;
          Object.assign(e, { st: 'idle', t: 0.3, tele: 0, vx: 0, vy: 0, onGround: true, flash: 0, stun: 0, sq: 1, face: 1, ring: 0, anim: 0.5, phase: e.phase || 1 });
          if (base) Object.assign(e, base); const s2 = { ...smp }; delete s2.dt; Object.assign(e, s2);
          e._ra = undefined; e._pst = e.st; e._sst = e._sst ?? smp._sst ?? 0.1; e._pf = e.face; e._pg = e.onGround; e._ph = e._ph || 0; e._turn = e._turn || 0; e._land = e._land || 0;
          g.setTransform(rs, 0, 0, rs, 0, 0); g.fillStyle = '#2a3140'; g.fillRect(lw + i * cw + 3, fy, cw - 6, 2);
          g.save(); g.beginPath(); g.rect(lw + i * cw, r * chh, cw, chh); g.clip(); g.setTransform(rs, 0, 0, rs, (cx - 2000) * rs, (fy - 1000) * rs);
          try {
            if (base) { e.draw(g, W); }
            else { e.draw(g, W); g.restore(); g.save(); g.setTransform(rs, 0, 0, rs, 0, 0); g.fillStyle = '#3a4456'; g.fillRect(lw + i * cw, r * chh, cw, chh - 12); g.beginPath(); g.rect(lw + i * cw, r * chh, cw, chh); g.clip(); g.setTransform(rs, 0, 0, rs, (cx - 2000) * rs, (fy - 1000) * rs);
              const keep = W.fx.p; W.fx.p = []; W.fx.shatter(e._dr, huge ? 5 : big ? 4 : 3, huge ? 1.4 : 1); for (let k = 0; k < Math.round(smp.dt / 0.02); k++) W.fx.update(0.02); W.fx.draw(g); W.fx.p = keep; }
          } catch (err) { res.errors.push(label + ': ' + err.message); }
          g.restore();
          (res.hashes[label] ||= []).push(hash(g, Math.round((lw + i * cw) * rs), Math.round(r * chh * rs), Math.round(cw * rs), Math.round((chh - 12) * rs)));
          (res.frames[label] ||= []).push(e._fr || '?');
        });
      });
      if (sheets) res.url = c.toDataURL('image/png');
      out[name] = res;
    }
    return out;
  }, sheets);
}
