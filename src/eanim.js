// v1.4 enemy animation rig. Picks a painted frame (enemies.webp) per AI state and layers procedural motion on top:
// breathing, distance-matched walk cycles, telegraph shake, attack smears, recover blends, hurt flinch, turn squash,
// landing squash and a shard death. Render-only: it reads AI state but never writes anything the AI or hitboxes use.
import { G, hasE, drawE, eTint, spr, shaded, tinted } from './gfx.js';
import { drawGlow } from './art.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// render-side bookkeeping (state age, turn/land timers, walk phase) derived from e.anim so it follows hit-stop and pauses
export function track(e) {
  const t = e.anim || 0, dt = clamp(t - (e._ra ?? t), 0, 0.1); e._ra = t;
  if (e._pst !== e.st) { e._from = e._pst; e._pst = e.st; e._sst = 0; } else e._sst = (e._sst || 0) + dt;
  if (e._pf !== undefined && e._pf !== e.face) e._turn = 0.12; e._pf = e.face; e._turn = Math.max(0, (e._turn || 0) - dt);
  if (!e.fly && e.onGround && e._pg === false) e._land = 0.16; e._pg = e.onGround; e._land = Math.max(0, (e._land || 0) - dt);
  e._ph = (e._ph || 0) + dt * Math.abs(e.vx || 0);
  return dt;
}
const STRIDE = { charger: 13, puffcap: 9, knight: 11, bomber: 10, shellback: 12, warden: 13, tidegolem: 14, boss: 20, boss2: 20 }; // world px per walk frame
const ATTACK = new Set(['tele', 'charge', 'swoop', 'swing', 'hop', 'pulse', 'bash', 'bashTele', 'leapTele', 'leap', 'slamTele', 'slam', 'volleyTele', 'beamTele', 'beam', 'chargeTele']);
// pose for a regular enemy: { fr, rot, sx, sy, ox, oy, shake, smear, spin }
export function regPose(e) {
  const n = e.type, t = e.anim || 0, st = e.st || 'idle', tele = e.tele || 0, f = e.face || 1, s = e._sst || 0;
  const P = { fr: 'base', rot: 0, sx: 1, sy: 1, ox: 0, oy: 0, shake: tele > 0 ? 0.6 + tele * 1.2 : 0, smear: null, sk: 0, spin: false };
  const moving = Math.abs(e.vx || 0) > 6, stride = STRIDE[n] || 12, ph = (e._ph || 0) / stride;
  const breath = (r = 3.2, a = 0.035) => { const b = Math.sin(t * r); P.sy *= 1 + b * a; P.sx *= 1 - b * a * 0.5; };
  const gait = (a = 'walk0', b = 'walk1') => { if (moving) { P.fr = Math.floor(ph) % 2 ? b : a; const k = ph * Math.PI; P.oy = -Math.abs(Math.sin(k)) * 1.6; P.rot = Math.sin(k) * 0.035; } else { P.fr = a; breath(); } };
  const fired = st === 'idle' && e._from === 'tele' && s < 0.3, fk = 1 - s / 0.3;
  switch (n) {
    case 'hopper':
      if (!e.onGround) { P.fr = 'leap'; P.rot = clamp((e.vy || 0) / 900, -0.3, 0.3) * -f; P.sy = 1 + clamp(Math.abs(e.vy || 0) / 2000, 0, 0.12); }
      else if (e._land > 0) P.fr = 'land';
      else if (st === 'tele') { P.fr = 'crouch'; }
      else { P.fr = (t % 1.3) < 0.22 ? 'crouch' : 'base'; breath(); } break;
    case 'charger':
      if (e.stun > 0) { P.fr = 'walk0'; P.rot = Math.sin(t * 9) * 0.12; }
      else if (st === 'tele') { P.fr = 'tele'; P.rot = -tele * 0.1 * f; P.ox = -f * tele * 2; }
      else if (st === 'charge') { P.fr = 'charge'; P.rot = Math.sin(t * 40) * 0.04 + 0.05 * f; P.smear = 'streak'; P.sk = (t * 3) % 1; }
      else if (st === 'rest') { P.fr = s < 0.18 ? 'charge' : 'walk0'; P.rot = -0.14 * f * Math.max(0, 1 - s / 0.5); }
      else gait(); break;
    case 'moth':
      if (st === 'tele') { P.fr = 'tele'; P.rot = -tele * 0.2 * f; }
      else if (st === 'swoop') { P.fr = 'swoop'; P.rot = Math.atan2(e.vy || 0, Math.abs(e.vx || 0) + 1) * 0.7 * f; P.smear = 'trail'; P.sk = s; }
      else { P.fr = Math.floor(t * 10) % 2 ? 'down' : 'up'; P.rot = Math.sin(t * 7) * 0.06 + clamp((e.vx || 0) / 500, -0.3, 0.3) * f; } break;
    case 'puffcap':
      if (st === 'tele') { P.fr = 'tele'; P.sx = P.sy = 1 + tele * 0.12; }
      else if (fired) { P.fr = 'puff'; P.sx = 1 + fk * 0.12; P.sy = 1 - fk * 0.1; P.smear = 'puff'; P.sk = 1 - fk; }
      else { P.fr = Math.floor(t * 1.6) % 2 ? 'walk1' : 'walk0'; breath(); } break;
    case 'knight':
      if (st === 'tele') { P.fr = 'tele'; P.rot = -tele * 0.08 * f; P.ox = -f * tele * 1.5; }
      else if (st === 'swing') { P.fr = 'swing'; P.rot = 0.1 * f; P.smear = 'arc'; P.sk = s / 0.16; P.ox = f * 2; }
      else if (st === 'rec') { P.fr = s < 0.2 ? 'swing' : 'walk0'; P.rot = 0.1 * f * Math.max(0, 1 - s / 0.35); if (s < 0.2) { P.smear = 'arc'; P.sk = 1 + s / 0.2; } }
      else gait(); break;
    case 'bomber':
      if (st === 'tele') { P.fr = 'tele'; P.rot = -tele * 0.1 * f; }
      else if (fired) { P.fr = 'lob'; P.rot = 0.08 * f * fk; }
      else gait(); break;
    case 'lurefish':
      if (st === 'tele') { P.fr = 'tele'; P.rot = -tele * 0.15 * f; }
      else if (st === 'swoop') { P.fr = 'bite'; P.rot = Math.atan2(e.vy || 0, Math.abs(e.vx || 0) + 1) * 0.6 * f; P.smear = 'trail'; P.sk = s; }
      else { P.fr = Math.floor(t * 4) % 2 ? 'swim1' : 'swim0'; P.rot = Math.sin(t * 5) * 0.06; } break;
    case 'jelly': {
      const p = Math.sin(t * 4);
      if (st === 'tele') { P.fr = 'tele'; P.sy = 1 + tele * 0.12; P.sx = 1 - tele * 0.06; P.smear = 'zap'; P.sk = t; }
      else if (st === 'pulse') { P.fr = 'open'; const r = e.ring || 0; P.sx = 1 + (1 - r) * 0.25; P.sy = 1 - (1 - r) * 0.15; }
      else { P.fr = p > 0 ? 'open' : 'shut'; P.sy = 1 + p * 0.07; P.sx = 1 - p * 0.04; } break; }
    case 'shellback':
      if (st === 'tele') { P.fr = 'tele'; }
      else if (st === 'charge') { P.fr = 'spin'; P.rot = t * 18 * f; P.spin = true; P.smear = 'streak'; P.sk = (t * 3) % 1; }
      else if (st === 'rest') { P.fr = s < 0.4 ? 'tele' : 'walk0'; }
      else gait(); break;
    case 'tturret':
      if (st === 'tele') { P.fr = 'tele'; }
      else if (fired) { P.fr = 'fire'; P.ox = -f * 3 * fk; P.sx = 1 - fk * 0.08; }
      else { P.fr = Math.floor(t * 2) % 2 ? 'idle1' : 'idle0'; } break;
    case 'dummy':
      if (e.flash > 0) { const k = e.flash / 0.15; P.fr = k > 0.7 ? 'squash' : Math.floor(t * 22) % 2 ? 'bendL' : 'bendR'; }
      else { P.fr = 'stand'; P.rot = Math.sin(t * 1.3) * 0.02; } break;
  }
  // hurt flinch (never hides a telegraph or attack frame)
  if (e.flash > 0 && n !== 'dummy') { const k = Math.min(1, e.flash * 7); if (!ATTACK.has(st) && hasE(n + '_hurt')) P.fr = 'hurt'; P.rot += -0.16 * f * k; P.ox -= f * 2 * k; P.sx *= 1 - 0.06 * k; }
  post(e, P); return P;
}
function post(e, P) {
  if (e._turn > 0) P.sx *= 1 - 0.6 * Math.sin((e._turn / 0.12) * Math.PI);
  if (e._land > 0) { const k = e._land / 0.16; P.sy *= 1 - 0.18 * k; P.sx *= 1 + 0.14 * k; }
}
// pose for a mini-boss (Scrap Warden / Tide Golem)
export function wardenPose(e) {
  const t = e.anim || 0, st = e.st, tele = e.tele || 0, f = e.face || 1, s = e._sst || 0, ph = (e._ph || 0) / STRIDE[e.type === 'tidegolem' ? 'tidegolem' : 'warden'];
  const P = { fr: 'walk0', rot: 0, sx: 1, sy: 1, ox: 0, oy: 0, shake: tele > 0 ? 0.8 + tele * 1.4 : 0, smear: null, sk: 0 };
  if (e.stun > 0) { P.fr = 'stagger'; P.rot = Math.sin(t * 7) * 0.08; }
  else if (st === 'sleep') { P.fr = 'crouch'; P.sy = 1 + Math.sin(t * 1.5) * 0.02; }
  else if (st === 'wake') P.fr = s < 0.5 ? 'crouch' : 'roar';
  else if (st === 'idle') { if (Math.abs(e.vx) > 6) { P.fr = 'walk' + (Math.floor(ph) % 4); P.oy = -Math.abs(Math.sin(ph * Math.PI)) * 1.5; } else { P.fr = 'walk0'; P.sy = 1 + Math.sin(t * 2.5) * 0.025; } }
  else if (st === 'bashTele') { P.fr = 'bashTele'; P.rot = -tele * 0.08 * f; }
  else if (st === 'bash') { P.fr = 'bash'; P.rot = 0.08 * f; P.smear = 'streak'; P.sk = (t * 3) % 1; }
  else if (st === 'leapTele') { P.fr = 'crouch'; P.sy = 1 - tele * 0.08; }
  else if (st === 'leap') { P.fr = e.onGround && s > 0.2 ? 'slam' : 'air'; }
  else if (st === 'rest') P.fr = s < 0.3 ? (e._from === 'leap' ? 'slam' : 'bash') : s < 0.6 ? 'stagger' : 'walk0';
  else if (st === 'summon') { P.fr = 'roar'; P.shake = 1 + tele; }
  if (e.flash > 0) { const k = Math.min(1, e.flash * 7); if (!ATTACK.has(st)) P.fr = 'hurt'; P.ox -= f * 2 * k; }
  post(e, P); return P;
}
// pose for a boss (Furnace / Drowned Bloom). Windups grow with the phase: stronger shake, lift and faster cycles.
export function bossPose(e) {
  const t = e.anim || 0, st = e.st, tele = e.tele || 0, f = e.face || 1, s = e._sst || 0, phs = e.phase || 1, ph = (e._ph || 0) / STRIDE.boss;
  const amp = 1 + (phs - 1) * 0.45;
  const P = { fr: 'walk0', rot: 0, sx: 1, sy: 1, ox: 0, oy: 0, shake: tele > 0 ? (0.9 + tele * 1.6) * amp : 0, smear: null, sk: 0, arms: true };
  if (e.stun > 0) { P.fr = 'walk1'; P.rot = Math.sin(t * 6) * 0.06; }
  else if (st === 'sleep') { P.fr = 'walk0'; P.sy = 1 + Math.sin(t * 1.2) * 0.012; }
  else if (st === 'intro') { P.fr = s < 0.9 ? 'walk0' : 'roar'; if (s >= 0.9) P.shake = 1.5; }
  else if (st === 'roar' || st === 'summon' || st === 'pillarsTele') { P.fr = 'roar'; P.shake = 1.6 * amp; P.sy = 1 + Math.sin(t * 20) * 0.015; }
  else if (st === 'dying') { P.fr = Math.floor(t * 8) % 2 ? 'roar' : 'walk1'; P.shake = 2 + s * 2; P.rot = Math.sin(t * 13) * 0.05 * (1 + s); }
  else if (st === 'idle') { if (Math.abs(e.vx) > 6) { P.fr = Math.floor(ph) % 2 ? 'walk1' : 'walk0'; P.oy = -Math.abs(Math.sin(ph * Math.PI)) * 2; P.rot = Math.sin(ph * Math.PI) * 0.025; } else { P.fr = 'walk0'; P.sy = 1 + Math.sin(t * (1.8 + phs * 0.3)) * 0.015; } }
  else if (st === 'slamTele') { P.fr = 'slamTele'; P.oy = -tele * 4 * amp; P.sy = 1 + tele * 0.04 * amp; }
  else if (st === 'slam') { P.fr = s < 0.45 ? 'slam' : 'walk0'; if (s < 0.45) { P.smear = 'shock'; P.sk = s / 0.45; } }
  else if (st === 'volleyTele' || st === 'volley') { P.fr = st === 'volley' && s > 0.5 ? 'walk0' : 'volleyTele'; if (st === 'volley') P.sy = 1 + Math.max(0, 0.06 - s * 0.1); }
  else if (st === 'beamTele' || st === 'beam') { P.fr = 'beamTele'; if (st === 'beam') P.shake = 0.8 * amp; }
  else if (st === 'chargeTele') { P.fr = 'walk1'; P.rot = -tele * 0.1 * f; P.ox = -f * tele * 3; }
  else if (st === 'charge') { P.fr = 'charge'; P.rot = 0.08 * f; P.smear = 'streak'; P.sk = (t * 3) % 1; }
  if (e.flash > 0) { const k = Math.min(1, e.flash * 7); P.ox -= f * 2 * k; P.sx *= 1 - 0.03 * k; }
  post(e, P); return P;
}
function smear(g, kind, H, f, k) {
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.scale(f, 1);
  if (kind === 'arc') { // sword swipe: arc sweeps over the first ~0.16 s, then fades on recovery
    const a0 = -2.0, a1 = 0.55, e = clamp(k, 0, 1), fade = k > 1 ? 2 - k : 1, a = a0 + (a1 - a0) * Math.min(1, e * 1.4);
    g.strokeStyle = '#ffd2b8'; g.globalAlpha = 0.85 * fade; g.lineWidth = H * 0.08; g.beginPath(); g.arc(H * 0.1, -H * 0.55, H * 0.66, Math.max(a0, a - 1.4), a); g.stroke();
    g.globalAlpha = 0.25 * fade; g.lineWidth = H * 0.24; g.stroke();
  } else if (kind === 'streak' || kind === 'trail') { // speed lines behind the body
    g.strokeStyle = kind === 'trail' ? '#bff4ff' : '#ffe2c8'; g.lineWidth = Math.max(1.2, H * 0.04);
    for (let i = 0; i < 3; i++) { const y = -H * (0.22 + i * 0.25), o = ((k + i * 0.37) % 1), L = H * (0.35 + 0.4 * o); g.globalAlpha = 0.55 * (1 - o * 0.6); g.beginPath(); g.moveTo(-H * 0.4 - o * 6, y); g.lineTo(-H * 0.4 - o * 6 - L, y); g.stroke(); }
  } else if (kind === 'puff') { // spore puff ring at the cap
    g.strokeStyle = '#ffe9b0'; g.globalAlpha = 0.6 * (1 - k); g.lineWidth = 2; g.beginPath(); g.arc(H * 0.1, -H * 0.8, H * (0.25 + k * 0.5), 0, 7); g.stroke();
  } else if (kind === 'zap') { // jelly charge-up sparks
    g.strokeStyle = '#d8fbff'; g.lineWidth = 1.3; g.globalAlpha = 0.85;
    for (let i = 0; i < 3; i++) { const a = (Math.floor(k * 14) * 2.3 + i * 2.1) % 6.28, r0 = H * 0.42, r1 = H * 0.66; g.beginPath(); let x = Math.cos(a) * r0, y = -H * 0.6 + Math.sin(a) * r0; g.moveTo(x, y); for (let j = 1; j <= 3; j++) { const r = r0 + (r1 - r0) * j / 3, b = a + ((j % 2) ? 0.25 : -0.2); x = Math.cos(b) * r; y = -H * 0.6 + Math.sin(b) * r; g.lineTo(x, y); } g.stroke(); }
  } else if (kind === 'shock') { // slam shockwave arcs at the feet
    g.strokeStyle = '#ffd08a'; g.lineWidth = 3; g.globalAlpha = 0.7 * (1 - k);
    for (const d of [1, -0.6]) { g.beginPath(); g.ellipse(d * H * 0.25, 0, H * (0.2 + k * 0.5), H * (0.05 + k * 0.08), 0, Math.PI, 0); g.stroke(); }
  }
  g.restore();
}
// draw an enemy with pose P. H = neutral height in world px. hotK = red telegraph tint, opts.under/opts.over = callbacks in local space.
export function drawRig(g, e, typ, P, H, hotK, opts = {}) {
  let fr = typ + '_' + P.fr; if (!hasE(fr)) fr = typ + '_base';
  const X = e.cx, Y = e.y + e.h, f = e.face || 1, t = e.anim || 0, flip = opts.flip !== undefined ? opts.flip : f < 0;
  const shx = P.shake ? Math.sin(t * 57) * P.shake : 0, bob = e.fly ? Math.sin(t * 4) * 2 : 0;
  g.save(); g.translate(X + P.ox + shx, Y + 1 + P.oy + bob);
  if (P.smear === 'streak' || P.smear === 'trail' || P.smear === 'shock') smear(g, P.smear, H, f, P.sk);
  if (P.spin) { g.translate(0, -H * 0.45); g.rotate(P.rot); g.translate(0, H * 0.45); } else g.rotate(P.rot);
  const sq = e.sq || 1; g.scale(P.sx / Math.sqrt(sq), P.sy * sq);
  opts.under && opts.under(g);
  const k = drawE(g, fr, 0, 0, H, flip);
  if (hotK > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, hotK); drawE(g, fr, 0, 0, H, flip, eTint(fr, '#ff3040')); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
  if (e.flash > 0) { g.globalAlpha = Math.min(1, e.flash * 14); drawE(g, fr, 0, 0, H, flip, eTint(fr, '#ffffff')); g.globalAlpha = 1; }
  opts.over && opts.over(g);
  if (P.smear === 'arc' || P.smear === 'puff' || P.smear === 'zap') smear(g, P.smear, H, f, P.sk);
  g.restore();
  // remember the last drawn frame (world rect) so a kill can shatter exactly what was on screen
  const F = G.en.f[fr], w = F[2] * k, h = F[3] * k, ox = F[4] * k;
  e._dr = { img: G.en.img, f: F, k, flip, fr, x: X + P.ox + (flip ? -(w - ox) : -ox), y: Y + P.oy - (h - F[6] * k) };
  e._fr = fr; return fr;
}
export { spr, shaded, tinted };
