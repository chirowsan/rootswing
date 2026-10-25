// v2.2 smarter foes ("too easy"): attack tokens + pincers (foes no longer queue politely), feints, gap-closing lunges,
// combos, volleys, dash punishes, spam guards and keep-away. Every new attack still shows the "!" telegraph first.
import { diff } from './save.js';
import { sign, clamp, rand } from './util.js';
import { sfx } from './audio.js';
const MELEE = { hopper: 1, charger: 1, knight: 1, shellback: 1 };
const LUNGE = { hopper: 1, charger: 1, knight: 1 };
const GUARD = { knight: 1, shellback: 1, charger: 1 };
const KEEPAWAY = { puffcap: 1, bomber: 1 };
const HOT = { tele: 1, charge: 1, swoop: 1, swing: 1, lunge: 1, lungeTele: 1, ctrTele: 1, ctr: 1, pulse: 1, hop: 0 };
export const attacking = (e) => !e.dead && (HOT[e.st] === 1 || e.tele > 0);
export const stats = { feints: 0, lunges: 0, pincers: 0, combos: 0, guards: 0, punishes: 0, backsteps: 0, volleys: 0, held: 0 };
// ---- once per world step: tokens + pincers + reading the player ----
export function director(W, dt) {
  if (W.mode !== 'run' && W.mode !== 'boss') return; const D = diff(), P = W.player; if (!P || P.dead) return;
  const ai = W.ai || (W.ai = { atk: [], dashPrev: 0, lastDash: -9 });
  ai.atk = ai.atk.filter((t) => W.t - t < 1.6);
  if (P.dashT > 0 && !(ai.dashPrev > 0)) ai.lastDash = W.t; ai.dashPrev = P.dashT;
  const near = []; for (const e of W.enemies) if (!e.dead && !e.boss && e.type !== 'dummy' && e.type !== 'tturret' && Math.abs(e.cx - P.cx) < 420 && Math.abs(e.cy - P.cy) < 220) near.push(e);
  let busy = 0; for (const e of near) if (attacking(e)) busy++;
  ai.busy = busy;
  for (const e of near) { // a newly telegraphing foe calls a partner on the far side: a pincer (both still show "!")
    const startTele = e.st === 'tele' && !e._tw; e._tw = e.st === 'tele';
    if (startTele && D.smart >= 1 && busy < D.tokens) { const side = sign(e.cx - P.cx);
      const mate = near.find((o) => o !== e && !attacking(o) && o.stun <= 0 && sign(o.cx - P.cx) === -side && Math.abs(o.cx - P.cx) < 260 && o.cd > 0 && o.cd < 1.2);
      if (mate) { mate.cd = 0; mate._pincer = W.t; busy++; stats.pincers++; } }
    // feint roll when a telegraph starts (charger / knight)
    if (startTele && (e.type === 'knight' || e.type === 'charger') && D.feint > 0 && !e._feinted && rand.chance(D.feint)) e._feint = true;
  }
  if (busy >= D.tokens) for (const e of near) if (!attacking(e) && e.cd < 0.3) { e.cd = 0.3; stats.held++; } // never more than `tokens` foes swinging at once
}
const mashed = (W, ai, D) => ai.atk.filter((t) => W.t - t < 1.3).length >= 5 - Math.min(2, D.smart);
// v2.2 anti-spam: a guard foe that is being mashed shrugs off the end of its stagger and raises its guard (still shows GUARD + a counter telegraph)
export function mashGuard(W, e, P) {
  const D = diff(); if (!D.smart || !GUARD[e.type] || !e.onGround || e.stun > 0.12 || e.guardCd > W.t || e.boss || W.mode === 'hub' || W.mode === 'tutorial') return false; const ai = W.ai; if (!ai || !mashed(W, ai, D)) return false;
  if (Math.abs(P.cx - e.cx) > 80 || Math.abs(P.cy - e.cy) > 50) return false;
  e.stun = 0; e.st = 'guard'; e.t = 0; e.face = sign(P.cx - e.cx) || e.face; e.guardCd = W.t + 3.5; stats.guards++; W.fx.text(e.cx, e.y - 16, 'GUARD', '#cfe6ff', 12); sfx('block'); return true; }
export function onPlayerAttack(W) { const ai = W.ai || (W.ai = { atk: [], dashPrev: 0, lastDash: -9 }); ai.atk.push(W.t); }
// ---- per foe, before its own behaviour: returns true when an AI move owns this frame ----
export function pre(W, e, dt, P, dx, dy, adx, seen) {
  const D = diff(); if (!D.smart || W.mode === 'hub' || W.mode === 'tutorial' || e.type === 'dummy' || e.type === 'tturret') return false;
  const ai = W.ai || { atk: [], lastDash: -9 };
  // feint: the "!" rises, then the foe pulls back ("?"), then commits with a short (still visible) telegraph
  if (e._feint && e.st === 'tele' && e.tele > 0.55) { e._feint = false; e._feinted = true; e.st = 'feint'; e.t = 0; e.tele = 0; e.vx = -e.face * 90; if (e.onGround) e.vy = -140; stats.feints++; W.fx.text(e.cx, e.y - 18, '?', '#ffe27a', 16); sfx('telegraph', 0.4); }
  if (e.st === 'feint') { e.vx *= 0.9; e.physics(W, dt); if (e.t > 0.28) { e.st = 'tele'; const dur = e.type === 'knight' ? 0.7 : 0.6; e.t = dur - 0.34; e.face = sign(dx) || e.face; } return true; }
  // guard: mash the attack button into a knight / shellback / charger and it raises its guard, then counters
  if (e.st === 'guard') { e.vx = 0; e.guardT = 0.5 - e.t; e.physics(W, dt); if (e.t > 0.5) { e.guardT = 0; e.st = 'ctrTele'; e.t = 0; sfx('telegraph'); } return true; }
  if (e.st === 'ctrTele') { e.tele = e.t / 0.36; e.face = sign(dx) || e.face; e.vx = 0; e.physics(W, dt); if (e.t > 0.36) { e.st = 'ctr'; e.t = 0; e.tele = 0; e.vx = e.face * 160; sfx('swingHeavy'); } return true; }
  if (e.st === 'ctr') { e.vx *= 0.85; const box = { x: e.face > 0 ? e.cx : e.cx - 50, y: e.y - 4, w: 50, h: e.h + 4 }; if (e.t < 0.14) W.enemyAttack(box, Math.round(e.cdmg * 1.1), e, { parryable: true, name: e.info.name, tip: 'Mashing makes it guard! Wait for the "!" then parry or dash away.' }); e.physics(W, dt); if (e.t > 0.5) { e.st = 'idle'; e.cd = 0.9; } return true; }
  if (e.st === 'idle' && GUARD[e.type] && e.onGround && adx < 80 && Math.abs(dy) < 50 && mashed(W, ai, D) && !(e.guardCd > W.t)) {
    e.st = 'guard'; e.t = 0; e.face = sign(dx) || e.face; e.guardCd = W.t + 3.5; stats.guards++; W.fx.text(e.cx, e.y - 16, 'GUARD', '#cfe6ff', 12); sfx('block'); return true; }
  // gap-closer lunge (and the dash punish: dash past a foe and it whips round with a quick lunge)
  if (e.st === 'lungeTele') { e.tele = e.t / e.lt; e.face = sign(dx) || e.face; e.vx = -e.face * 15; e.physics(W, dt); if (e.t > e.lt) { e.st = 'lunge'; e.t = 0; e.tele = 0; e.vx = e.face * 400; if (e.onGround) e.vy = -120; sfx('dash'); } return true; }
  if (e.st === 'lunge') { if (Math.random() < 0.6) W.fx.burst(e.cx - e.face * 10, e.y + e.h - 4, 1, { color: '#e8d8b0', min: 10, max: 50, g: -20, life: 0.3 }); if (e.wallAhead(W, e.face) || e.ledgeAhead(W, e.face) && e.onGround) e.vx = 0; e.physics(W, dt); if (e.t > 0.3) { e.st = 'rec'; e.t = 0; e.vx = 0; } return true; }
  if (e.st === 'rec' && e._lrec) { e.vx *= 0.8; e.physics(W, dt); if (e.t > 0.55) { e.st = 'idle'; e._lrec = false; e.cd = 1.0; } return true; }
  if (LUNGE[e.type] && e.st === 'idle' && e.onGround && seen && Math.abs(dy) < 40 && !(e.lungeCd > W.t)) {
    const punish = W.t - ai.lastDash < 0.45 && adx < 140 && sign(dx) !== e.face; // player just dashed past us
    const close = adx > 140 && adx < 300 && e.cd <= 0 && rand.chance(0.35 + 0.1 * D.smart) && (ai.busy || 0) < D.tokens;
    if (punish || close) { e.st = 'lungeTele'; e.t = 0; e.lt = punish ? 0.38 : 0.45; e._lrec = true; e.face = sign(dx) || 1; e.lungeCd = W.t + (punish ? 2.2 : 3.2); if (punish) stats.punishes++; else stats.lunges++; sfx('telegraph'); return true; }
    if (adx > 140 && e.cd <= 0) e.lungeCd = W.t + 1.2;
  }
  // keep-away: shooters hop back when you get close
  if (KEEPAWAY[e.type] && e.st === 'idle' && e.onGround && adx < 85 && Math.abs(dy) < 50 && !(e.hopCd > W.t)) { const away = -sign(dx) || 1; if (!e.ledgeAhead(W, away) && !e.wallAhead(W, away)) { e.vx = away * 190; e.vy = -300; e.hopCd = W.t + 2.4; stats.backsteps++; e.physics(W, dt); return true; } }
  return false;
}
// ---- per foe, after its behaviour: combos and doubles ----
export function post(W, e, dt) {
  const D = diff(); if (!D.smart || W.mode === 'hub' || W.mode === 'tutorial') return;
  if (e.type === 'knight' && e.st === 'rec' && !e._lrec && e.t <= dt * 1.5) { // knight 2-hit combo (second swing has a short "!" too)
    if (!e._combo && rand.chance(0.3 + 0.15 * D.smart)) { e._combo = true; e.st = 'tele'; e.t = 0.7 - 0.3; stats.combos++; } else e._combo = false; }
  if (e.type === 'charger' && e.st === 'rest' && e.t <= dt * 1.5 && D.smart >= 2 && !e._dbl && rand.chance(0.4)) { e._dbl = true; e.st = 'tele'; e.t = 0.25; e.face = sign(W.player.cx - e.cx) || e.face; stats.combos++; }
  if (e.st === 'idle') { e._dbl = false; if (e.cd > 0.6) e._feinted = false; }
}
// puffcap volleys: every other shot is a 3-spread on Normal+, 5 on Nightmare
export function volley(W, e, tx, ty, speed, o) {
  const D = diff(); e._vol = (e._vol || 0) + 1; const n = D.smart >= 1 && e._vol % 2 === 0 ? (D.smart >= 3 ? 5 : 3) : 1; if (n > 1) stats.volleys++;
  const a0 = Math.atan2(ty, tx); for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.24; W.spawnEnemyShot(e.cx, e.y + 8, Math.cos(a) * speed, Math.sin(a) * speed, o); }
}
// a guarding foe blocks frontal hits (heavy/breaking hits still go through)
export function guarding(W, e, hit, p) { if (!(e.guardT > 0) || !p || hit.breaks || hit.src === 'hazard') return false; if (sign(p.cx - e.cx) !== e.face) return false;
  sfx('block'); W.fx.burst(e.cx + e.face * 14, e.cy - 4, 6, { color: ['#fff', '#cfe6ff'], kind: 'spark', max: 240, glow: 1 }); p.vx = -p.face * 200; W.fx.text(e.cx, e.y - 12, 'guarded', '#cfe6ff', 11); W.hitstop(0.03); return true; }
export function draw(g, e) { // guard glint
  if (e.st === 'guard') { g.save(); g.globalAlpha = 0.7; g.strokeStyle = '#cfe6ff'; g.lineWidth = 3; g.beginPath(); g.arc(e.cx + e.face * 10, e.cy, e.h * 0.6, -1.1, 1.1); if (e.face < 0) { g.beginPath(); g.arc(e.cx + e.face * 10, e.cy, e.h * 0.6, Math.PI - 1.1, Math.PI + 1.1); } g.stroke(); g.restore(); }
}

// v2.2: bosses no longer let you hug them. Stand inside a boss too long and it telegraphs a body STOMP
// (white ring + "STOMP!" for 0.6 s), which you can jump, dash away from, or parry.
const QUIET = new Set(['sleep', 'intro', 'dying', 'fakeDying', 'revive', 'roar', 'wake']);
export function bossHug(W, dt) {
  const B = W.boss, P = W.player, sm = diff().smart || 0; if (!B || !sm || !P || B.dead || B.hp <= 0) return;
  const r = B.w / 2 + 56;
  if (B.hug) { B.hug.t -= dt; B.flash = Math.max(B.flash || 0, 0.02);
    if (B.hug.t <= 0) { B.hug = null; W.fx.ring(B.cx, B.y + B.h - 4, r, '#fff2d0', 0.4, 6); W.fx.shake(0.3); sfx('explode');
      W.enemyAttack({ x: B.cx - r, y: B.y + B.h * 0.25, w: r * 2, h: B.h * 0.75 + 8 }, 10 + 3 * sm, B, { parryable: true, name: (B.info && B.info.name || 'Boss') + ' stomp', tip: "Don't hug the boss! When it says STOMP, jump or dash away." }); }
    return; }
  if (QUIET.has(B.st) || B.stun > 0) { B.hugT = Math.max(0, (B.hugT || 0) - dt); return; }
  const close = Math.abs(P.cx - B.cx) < B.w / 2 + 26 && P.y + P.h > B.y - 10 && P.y < B.y + B.h;
  B.hugT = close ? (B.hugT || 0) + dt : Math.max(0, (B.hugT || 0) - dt * 2);
  if (B.hugT > 1.2 - 0.2 * sm) { B.hugT = -1.2; B.hug = { t: 0.6 }; W.addMarker({ kind: 'circle', x: B.cx, y: B.y + B.h - 6, r, life: 0.6 }); W.fx.text(B.cx, B.y - 18, 'STOMP!', '#fff2d0', 16); sfx('beep'); }
}
