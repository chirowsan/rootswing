import { vineColors } from './objective.js';
import { capeSheet, drawHat } from './missionsWorld.js';
import { missions } from './missions.js';
// Sprig, the hero: movement, grappling vine, combat, drawing.
import { TILE, clamp, approach, sign, lerp } from './util.js';
import { moveBody, groundBelow, touchingWall, hazardAt, HERO, isPlank, swingInit, swingStep, swingRelease } from './physics.js';
import { input, pressed, held, released, vibrate } from './input.js';
import { sfx, sfxV } from './audio.js';
import { WEAPONS, GADGETS } from './weapons.js';
import { diff, save } from './save.js';
import { PAL, drawGlow } from './art.js';
import { G, has, spr, sprAspect, shaded, heroFlash, heroTint } from './gfx.js';
import { palOf, STYLES } from './weapons.js';
import * as WH from './whip.js'; import * as BW from './bow.js';
import { MV, GAUGE_MAX, trail, lash, decal, wave, leaves, petals, gain } from './combat.js';

const C = HERO; // unchanged values (moved to physics.js in v1.5 so the validator shares them)
// v2.1 modern feel: every number here only ADDS capability on top of HERO (the reach validator models the v2.0 minimum, so it stays a safe lower bound)
export const FEEL = {
  TURN_K: 1.8,      // ground turn-around: reversing uses 1.8x accel (no ice-skating, no 80s instant flip)
  AIR_ACC: 1500,    // air steering accel (v2.0: 1200) -- intentional mid-air corrections
  AIR_TURN_K: 1.35, // air reversal boost
  APEX_V: 95, APEX_G: 0.5, // apex hang: |vy| < 95 with jump held -> half gravity (v2.0: 70 / 0.6)
  FALL_G: 1.3, FAST_FALL: 780, // hold down in the air: faster, intentional drop (v2.0: none)
  DASH_BUF: 0.13, ATK_BUF: 0.16, // input buffers (jump/hook buffers already existed: diff().buffer, 0.16)
  DASH_JUMP_K: 1.3, // jump out of a dash keeps 1.3x run speed (dash-jump)
  WIND_TURN: 0.09,  // attack wind-up can still be turned around for 90 ms
  LAND_KEEP: 1,     // landing keeps horizontal speed
};
export const HERO_K = 1.22; // v1.2 visual scale of the hero rig around the feet (hitbox unchanged)
export const HERO_PX = 47 / 223; // v1.3 world units per painted-frame pixel (idle frame = 44 units tall before HERO_K)
// front-fist anchor in frame pixels per painted pose (weapon grip); measured from the annotated sheets
const GAIT = { MOVE: 14, RUN_UP: 118, RUN_DN: 92, START_T: 0.09, STOP_T: 0.16, TURN_T: 0.08 }; // v1.4.1 (was RUN_BOB: per-frame y jumps of up to 16 px)
const FIST = { slash1: [170, 73], slash2: [124, 23], thrust: [169, 70], hwind: [123, 29], slam: [141, 139], parry: [120, 50], airatk: [150, 60], throw: [161, 45], swing: [81, 11] };
export class Player {
  constructor(x, y, stats) {
    this.w = 18; this.h = 34; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.face = 1;
    this.maxHp = stats.maxHp; this.hp = stats.hp ?? stats.maxHp; this.maxFlasks = stats.maxFlasks; this.flasks = stats.flasks ?? stats.maxFlasks;
    this.weapon = stats.weapon || 'blade'; this.gadgets = stats.gadgets || ['popseed']; this.gcd = [0, 0]; this.hookRange = stats.hookRange || 220;
    this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.wallDir = 0; this.wallCoyote = 0; this.wallLock = 0; this.airDash = true; this.freeJump = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDir = 1; this.iframes = 0; this.hurtT = 0; this.flash = 0; this.dead = false; this.deadT = 0; this.respawnT = 0;
    this.hook = { s: 'none' }; this.atk = null; this.chargeT = 0; this.charged = false; this.comboT = 0; this.comboIdx = 0; this.queued = false; this.airHang = 0; this.hookBuf = 0;
    this.parryT = 0; this.parryLock = 0; this.flaskT = 0; this.healLeft = 0;
    this.gauge = stats.gauge || 0; this.critT = 0; this.counterT = 0; this.dashEnd = 0; this.perfCd = 0; this.airStep = 0; this.airStepT = 0; this.airHover = 0; this.dashSlashes = 0; this.charged2 = false; // v1.9 combat state
    this.sx = 1; this.sy = 1; this.runPh = 0; this.stepT = 0; this.t = 0; this.safe = { x, y }; this.hookTarget = null; this.drop = 0; this.mantleT = 0;
    this.scarf = Array.from({ length: 7 }, () => ({ x: x + 9, y: y + 12, px: x + 9, py: y + 12 }));
    this.lastHit = null; this.stats = { jumps: 0, hooks: 0, dashes: 0, attacks: 0, parries: 0, kills: 0 };
  }
  get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
  get busy() { return this.dead || this.respawnT > 0; }
  update(W, dt) {
    this.t += dt; const D = diff();
    for (const k of ['coyote', 'jumpBuf', 'wallCoyote', 'wallLock', 'dashCd', 'iframes', 'hurtT', 'flash', 'parryT', 'parryLock', 'comboT', 'freeJump', 'drop', 'mantleT', 'hookBuf', 'critT', 'counterT', 'dashEnd', 'perfCd', 'airStepT', 'dashBuf', 'atkBuf', 'skidT', 'turnT', 'rehookBuf', 'flipT', 'whooshT']) this[k] = Math.max(0, this[k] - dt);
    if (this.onGround || this.atk || this.dashT > 0 || this.hurtT > 0) this.flipT = 0;
    this.gcd = this.gcd.map((v) => Math.max(0, v - dt));
    this.sx = lerp(this.sx, 1, Math.min(1, dt * 12)); this.sy = lerp(this.sy, 1, Math.min(1, dt * 12));
    { // v2.1 animation layer: smoothed lean that reads acceleration (leans into a start, back on a skid) + a damped spring for hat/cape secondary motion
      const acc = (this.vx - (this._pvx ?? this.vx)) / Math.max(dt, 1e-4); this._pvx = this.vx;
      const lt = this.skidT > 0 ? -sign(this.vx) * 0.16 : clamp(this.vx / 900 + clamp(acc, -2500, 2500) * 0.00003, -0.22, 0.22);
      this.leanS = lerp(this.leanS || 0, lt, Math.min(1, dt * 14));
      const ht = clamp(-this.vx / 600 - (this.onGround ? 0 : this.vy / 1400), -0.5, 0.5); this.hatV = ((this.hatV || 0) + (90 * (ht - (this.hatA || 0)) - 9 * (this.hatV || 0)) * dt); this.hatA = clamp((this.hatA || 0) + this.hatV * dt, -0.6, 0.6);
      if (!this.onGround && Math.abs(this.vy) < FEEL.APEX_V && this.dashT <= 0 && this.hook.s === 'none') { this.sy = lerp(this.sy, 0.95, dt * 6); this.sx = lerp(this.sx, 1.04, dt * 6); } // apex float pose
    }
    this.updateScarf(dt);
    if (this.dead) { this.deadT += dt; this.vx *= 0.9; return; }
    if (this.respawnT > 0) { this.respawnT -= dt; if (this.respawnT <= 0) { this.x = this.safe.x; this.y = this.safe.y; this.vx = this.vy = 0; this.iframes = 1.2; W.fx.burst(this.cx, this.cy, 16, { color: ['#bff7a0', '#fff'], max: 160, g: -50, life: 0.5 }); } return; }
    const mx = input.mx, my = input.my;
    if (Math.abs(mx) > 0.1 && (!this.atk || this.atk.phase === 'rec' || (this.atk.phase === 'wind' && this.atk.t < FEEL.WIND_TURN && this.atk.kind !== 'special' && this.atk.kind !== 'plunge')) && this.dashT <= 0 && this.hook.s !== 'swing') this.face = sign(mx); // v2.1: a wind-up can still be aimed // v1.4: can turn during attack recovery
    if (pressed('jump')) this.jumpBuf = D.buffer;
    if (pressed('dash')) this.dashBuf = FEEL.DASH_BUF; if (pressed('attack')) this.atkBuf = FEEL.ATK_BUF;
    if (pressed('hook')) this.hookBuf = 0.16; // v1.4: buffered hook (fires as soon as an attack can be cancelled / after a zip)
    if (this.jumpBuf > 0 && !this.canCancel()) this.jumpBuf = Math.max(this.jumpBuf, dt * 2); // keep a jump pressed mid-swing alive until recovery
    // healing over time
    if (this.healLeft > 0) { const h = Math.min(this.healLeft, this.maxHp * 0.9 * dt); this.hp = Math.min(this.maxHp, this.hp + h); this.healLeft -= h; }
    if (this.flaskT > 0) this.flaskT -= dt;
    // aim for hook (assist picks the best target)
    this.hookTarget = W.findHookTarget(this, mx, my);
    if (this.rehookBuf > 0 && (this.hook.s === 'none' || this.hook.s === 'miss') && this.hookTarget && !(this.lastAnchor && Math.abs(this.hookTarget.x - this.lastAnchor.x) < 1 && Math.abs(this.hookTarget.y - this.lastAnchor.y) < 1) && this.hookTarget.kind !== 'enemy' && !this.onGround) { this.rehookBuf = 0; this.hookBuf = 0; this.hook = { s: 'none' }; this.atk = null; this.fireHook(W, mx, my); } // v2.4 buffered re-hook
    if (this.hook.s !== 'none') { this.updateHook(W, dt, mx, my); if (this.hook.s === 'swing' || this.hook.s === 'none') this.updateAttack(W, dt, mx, my); this.postMove(W, dt); return; }
    // actions
    if (this.hookBuf > 0 && this.canCancel()) { this.atk = null; this.queued = false; this.hookBuf = 0; this.fireHook(W, mx, my); } // v1.4: hook cancels attack recovery / air attacks
    if (this.dashBuf > 0 && this.dashCd <= 0 && this.parryLock <= 0 && (this.onGround || this.airDash || this.coyote > 0)) { this.dashBuf = 0; this.startDash(W, mx); } // v2.1: buffered dash (fires the moment the cooldown ends)
    this.swapCd = Math.max(0, (this.swapCd || 0) - dt); this.swapBuf = Math.max(0, (this.swapBuf || 0) - dt); if (pressed('swap')) this.swapBuf = 0.3; // v2.0 quick-swap (buffered; cancels recovery)
    if (this.swapBuf > 0 && this.swapCd <= 0 && (!this.atk || this.atk.phase === 'rec') && this.atk?.kind !== 'special') { this.swapBuf = 0; this.atk = null; this.swapStyle(W); }
    if (pressed('parry') && this.parryLock <= 0 && this.dashT <= 0) { this.parryT = D.parry; this.parryLock = D.parry + 0.14; this.atk = null; this.vx *= 0.3; sfx('block'); W.emit('parryTry'); }
    if (pressed('flask') && this.flasks > 0 && this.flaskT <= 0) { if (this.hp < this.maxHp) { this.flasks--; W.emit('flask'); this.flaskT = 0.45; this.healLeft = this.maxHp * (diff().flaskHeal ?? 0.5); sfx('flask'); W.fx.burst(this.cx, this.cy, 20, { color: ['#9ff0ff', '#e8ffff', '#7fe0a0'], g: -120, max: 120, life: 0.8, kind: 'star' }); W.emit('flask'); } else W.fx.text(this.cx, this.y - 6, 'Full!', '#bff', 12); }
    for (let i = 0; i < 2; i++) if (pressed(i ? 'skill2' : 'skill1') && this.gadgets[i] && this.gcd[i] <= 0) { this.gcd[i] = GADGETS[this.gadgets[i]].cd; W.useGadget(this.gadgets[i], this); }
    if (pressed('attack') && this.jumpBuf > 0 && !this.atk && (this.onGround || this.coyote > 0) && this.parryLock <= 0 && this.dashT <= 0) this.doJump(W); // jump+attack on the same frame -> jump first, then an air swing
    this.updateAttack(W, dt, mx, my);
    if (this.dashT > 0) {
      this.dashT -= dt; this.vx = this.dashDir * C.DASH; this.vy = 0;
      if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0) && this.dashT < C.DASH_T - 0.03) { this.dashT = 0; this.dashEnd = 0.15; this.vx = this.dashDir * C.RUN * FEEL.DASH_JUMP_K; this.doJump(W); W.emit('dashJump'); } // v2.1: dash-jump cancel keeps momentum
      if (Math.random() < 0.7) W.fx.burst(this.cx - this.dashDir * 8, this.cy + 6, 1, { color: '#e8fff0', min: 10, max: 40, g: 0, life: 0.25, size: 5 });
      if (this.dashT <= 0 && this.vy === 0) { this.vx = this.dashDir * C.RUN * 0.9; this.dashEnd = 0.15; } // v1.9: short window after a dash for the dash-slash
    } else {
      // horizontal
      const mm = WEAPONS[this.weapon].moveMul, slow = this.bowS ? (this.onGround ? (this.bowS.k > 0 ? 0.45 : 0.75) : 0.8) : this.atk ? (!this.onGround ? 1 : this.atk.phase === 'rec' ? Math.max(mm, 0.85) : Math.max(mm, mm * 0.5 + 0.35)) : this.parryLock > 0 ? 0.1 : this.flaskT > 0 ? 0.4 : 1;
      const target = mx * C.RUN * slow;
      if (this.wallLock > 0) { if (mx && sign(mx) !== sign(this.vx)) this.vx = approach(this.vx, target, C.ACC_A * 0.45 * dt); } // v1.4: wall-jump keeps its kick but a stick back toward the wall is honoured gently
      else if (this.onGround) { const rev = target && this.vx && sign(target) !== sign(this.vx);
        if (rev) this.turnT = 0.14; const boost = rev || (this.turnT > 0 && target && Math.abs(this.vx) < Math.abs(target));
        if (rev && Math.abs(this.vx) > 120 && this.skidT <= 0) { this.skidT = 0.18; W.fx.dust(this.cx + sign(this.vx) * 6, this.y + this.h, 4, { dir: sign(this.vx), speed: 70, size: 3.6, life: 0.35 }); sfx('step'); W.emit('skid'); } // v2.1 skid puff
        this.vx = approach(this.vx, target, (boost ? (this.atk ? C.DEC_G * 1.2 : C.ACC_G * FEEL.TURN_K) : Math.abs(target) > Math.abs(this.vx) ? C.ACC_G : this.atk ? C.DEC_G * 0.55 : C.DEC_G) * dt); }
      else if (Math.abs(this.vx) > C.RUN && sign(this.vx) === sign(target || this.vx) && Math.abs(target) <= Math.abs(this.vx)) this.vx = approach(this.vx, target || sign(this.vx) * C.RUN, (target ? 160 : 520) * dt); // keep fling momentum in the air
      else this.vx = approach(this.vx, target, FEEL.AIR_ACC * (target && this.vx && sign(target) !== sign(this.vx) ? FEEL.AIR_TURN_K : 1) * dt); // v2.1 intentional air control
      if (this.hurtT > 0) this.vx *= 0.98;
      // gravity (lighter at the jump apex while held for floaty control)
      let g = this.vy > 0 ? C.GRAV_FALL : C.GRAV; if (Math.abs(this.vy) < FEEL.APEX_V && held('jump')) g *= FEEL.APEX_G; // v2.1 tuned apex hang
      const ff = !this.onGround && this.vy > 0 && input.my > 0.5 && !this.wallDir && !this.atk; if (ff) g *= FEEL.FALL_G; // v2.1 fast fall
      if (this.atk && !this.onGround && this.atk.kind === 'air' && this.atk.phase !== 'rec' && this.vy > 0 && (this.airHang += dt) < 0.22) g *= 0.7; // v1.4: only a tiny hang (keeps momentum + gravity)
      this.vy = Math.min(this.vy + g * dt, ff ? FEEL.FAST_FALL : C.MAXFALL);
      // wall slide
      this.wallDir = 0;
      if (!this.onGround) { for (const d of [-1, 1]) if (touchingWall(W.map, this, d)) this.wallDir = d; }
      if (this.wallDir && !this.onGround && sign(mx) === this.wallDir && this.vy > 0) { this.vy = Math.min(this.vy, C.SLIDE); this.wallCoyote = 0.12; this.wallSide = this.wallDir; if (Math.random() < 0.3) W.fx.burst(this.wallDir > 0 ? this.x + this.w : this.x, this.y + 8, 1, { color: '#cbb', min: 10, max: 30, g: 100, life: 0.3 }); }
      else if (this.wallDir && !this.onGround) { this.wallCoyote = Math.max(this.wallCoyote, 0.06); this.wallSide = this.wallDir; }
      // jump
      if (this.jumpBuf > 0 && this.parryLock <= 0 && this.canCancel()) { // v1.4: jump cancels attack recovery
        const can = this.onGround || this.coyote > 0 || this.freeJump > 0 || this.wallCoyote > 0;
        if (can && this.atk && this.atk.kind !== 'air' && this.atk.kind !== 'kick') { this.atk = null; this.queued = false; }
        if (this.onGround || this.coyote > 0 || this.freeJump > 0) this.doJump(W);
        else if (this.wallCoyote > 0) this.doWallJump(W);
      }
      if (released('jump') && this.vy < 0 && !this.wallJumping) this.vy *= C.CUT;
      if (this.vy >= 0) this.wallJumping = false;
      if (pressed('down') && this.onGround && isPlank(W.map.get(Math.floor(this.cx / TILE), Math.floor((this.y + this.h + 2) / TILE)))) { this.drop = 0.25; this.y += 2; }
    }
    this.postMove(W, dt);
  }
  postMove(W, dt) {
    const wasGround = this.onGround, prevVy = this.vy, prevVx = this.vx;
    const r = this.hook.s === 'swing' ? { ground: false } : moveBody(W.map, this, dt, { drop: this.drop > 0, corner: this.vy < -120 }); // v2.4: the swing integrator already moved the body (was moving twice per step => rope jitter + energy drift)
    this.onGround = r.ground || (this.vy >= 0 && !!groundBelow(W.map, this) && this.drop <= 0 && this.hook.s !== 'zip');
    if (this.onGround && !wasGround) W.emit('land');
    if (this.onGround) { this.coyote = diff().coyote; this.airDash = true; this.wallJumping = false; this.airHang = 0; this.airHover = 0; if (!wasGround && this.atk && this.atk.kind === 'air' && this.atk.phase !== 'active') { this.atk = null; } } // landing cancels an air swing cleanly
    if (r.ground && !wasGround && prevVy > 60 && prevVy <= 160) { sfx('step'); this.sy = 0.88; this.sx = 1.1; } // v2.1 soft-landing tick
    if (r.ground && !wasGround && prevVy > 160) { if (prevVy > 420) vibrate(12); this.sy = 0.72; this.sx = 1.25; sfx('land'); W.fx.dust(this.cx, this.y + this.h, prevVy > 420 ? 8 : 5, { speed: 50 + Math.min(80, prevVy * 0.12), size: prevVy > 420 ? 5 : 3.8, life: 0.5 }); W.fx.burst(this.cx, this.y + this.h, 4, { color: '#d9d2c0', min: 30, max: 90, angle: -Math.PI / 2, spread: 1.4, g: 200, life: 0.35 }); }
    if (this.dashT > 0 && this.hook.s === 'none' && (r.wallL || r.wallR) && this.vy >= 0) this.tryMantle(W, r.wallL ? -1 : 1); // v2.1: a dash into a knee-high lip steps up instead of stopping dead
    // ledge assist: pop up onto a ledge we barely missed
    if (!this.onGround && this.hook.s === 'none' && this.dashT <= 0) {
      const dir = (r.wallL ? -1 : r.wallR ? 1 : 0) || (Math.abs(input.mx) > 0.3 && touchingWall(W.map, this, sign(input.mx)) ? sign(input.mx) : 0);
      if (dir && (sign(input.mx) === dir || Math.abs(prevVx) > 60) && this.vy > -260) this.tryMantle(W, dir);
    }
    if (r.ceil && this.hook.s === 'zip') this.hookArrive(W);
    // safe spot for hazard respawn
    if (this.onGround && r.ground && !r.oneway) {
      const ty = Math.floor((this.y + this.h + 2) / TILE), l = Math.floor((this.x - 10) / TILE), rr = Math.floor((this.x + this.w + 10) / TILE);
      let ok = true; for (let x = l; x <= rr; x++) { if (!W.map.solid(x, ty) || W.map.hazard(x, ty - 1)) ok = false; }
      if (ok) { this.safe.x = this.x; this.safe.y = this.y; }
    }
    // run anim + footsteps
    if (this.onGround && Math.abs(this.vx) > 20) this.runPh += dt * Math.abs(this.vx) * 0.075;
    this.gaitStep(W, dt);
    const hz = hazardAt(W.map, this); if (hz && this.respawnT <= 0) W.hazardHit(this, hz);
  }
  tryMantle(W, dir) {
    const tx = Math.floor((dir > 0 ? this.x + this.w + 2 : this.x - 2) / TILE);
    const feet = this.y + this.h;
    for (let ty = Math.floor((feet - 34) / TILE); ty <= Math.floor((feet + 4) / TILE); ty++) {
      const top = ty * TILE;
      if (top < feet - 34 || top > feet + 4) continue;
      if (W.map.solid(tx, ty) && !W.map.solid(tx, ty - 1) && !W.map.solid(tx, ty - 2) && !W.map.solid(Math.floor(this.cx / TILE), Math.floor((top - this.h) / TILE))) {
        this.y = top - this.h; this.x += dir * 6; this.vy = 0; this.vx = dir * 80; this.onGround = true; this.mantleT = 0.15; this.sy = 0.8; this.sx = 1.15; sfx('step'); W.emit('mantle'); return true;
      }
    }
    return false;
  }
  doJump(W) {
    this.vy = -C.JUMP; this.jumpBuf = 0; this.coyote = 0; this.freeJump = 0; this.onGround = false; this.sy = 1.3; this.sx = 0.78; sfx('jump'); this.stats.jumps++; W.emit('jump');
    W.fx.burst(this.cx, this.y + this.h, 5, { color: '#e8e2d0', min: 20, max: 80, angle: Math.PI / 2, spread: 1.2, g: 100, life: 0.3 });
  }
  doWallJump(W) {
    const d = -(this.wallSide || this.wallDir || this.face);
    this.vx = d * C.WJX; this.vy = -C.WJY; this.face = d; this.jumpBuf = 0; this.wallCoyote = 0; this.wallLock = 0.14; this.wallJumping = true; this.airDash = true;
    this.sy = 1.25; this.sx = 0.8; sfx('walljump'); W.emit('walljump');
    W.fx.burst(d > 0 ? this.x : this.x + this.w, this.cy, 6, { color: '#fff', min: 40, max: 120, angle: d > 0 ? 0 : Math.PI, spread: 0.8, g: 0, life: 0.3 });
  }
  startDash(W, mx) {
    this.dashDir = Math.abs(mx) > 0.2 ? sign(mx) : this.face; this.face = this.dashDir; this.dashT = C.DASH_T; this.dashCd = C.DASH_CD; this.iframes = Math.max(this.iframes, 0.26);
    if (!this.onGround) this.airDash = false; this.atk = null; this.dashSlashes = 0; this.sx = 1.35; this.sy = 0.75; sfx('dash'); this.stats.dashes++; W.emit('dash'); vibrate(10);
  }
  // ---------------- grappling vine ----------------
  fireHook(W, mx, my) {
    const t = this.hookTarget; this.stats.hooks++;
    const hx = this.cx + this.face * 6, hy = this.y + 12;
    if (t) { this.hook = { s: 'fly', tgt: t, hx, hy, t: 0 }; sfx('hookThrow'); W.emit('hookThrow'); this.flipT = 0; }
    else { let ax = Math.abs(mx) > 0.2 ? sign(mx) : this.face, ay = my < 0 ? -1 : -0.7; const l = Math.hypot(ax, ay); this.hook = { s: 'miss', hx, hy, dx: ax / l, dy: ay / l, t: 0 }; sfx('hookThrow'); this.rehookBuf = 0.18; this.lastAnchor = null; }
  }
  updateHook(W, dt, mx, my) {
    const h = this.hook; h.t += dt; const ox = this.cx, oy = this.y + 10;
    if ((h.s === 'miss' || h.s === 'retract') && pressed('attack')) { this.hook = { s: 'none' }; return; } // v1.4: attack cancels hook recovery
    if ((h.s === 'fly' || h.s === 'zip') && pressed('attack')) h.slash = true; // hook slash / buffered strike on arrival
    if (h.s === 'miss') { const d = Math.min(1, h.t / 0.12) * this.hookRange * 0.6; const back = h.t > 0.12 ? (h.t - 0.12) / 0.12 : 0; const k = d * (1 - back); h.hx = ox + h.dx * k; h.hy = oy + h.dy * k; if (back >= 1) this.hook = { s: 'none' }; if (h.t > 0.12 && h.t - dt <= 0.12) sfx('hookMiss'); this.freeMove(W, dt, mx); return; }
    if (h.s === 'fly') {
      const tg = h.tgt; const tx = tg.ent ? tg.ent.cx : tg.x, ty = tg.ent ? tg.ent.cy : tg.y; const dx = tx - h.hx, dy = ty - h.hy, d = Math.hypot(dx, dy), sp = 1600 * dt;
      if (tg.ent && tg.ent.dead) { this.hook = { s: 'none' }; return; }
      if (d <= sp) { h.hx = tx; h.hy = ty; this.attachHook(W, tg.ent ? { ...tg, x: tx, y: ty } : tg); } else { h.hx += dx / d * sp; h.hy += dy / d * sp; }
      this.freeMove(W, dt, mx); return;
    }
    if (h.s === 'swing') {
      const ax = h.tgt.x, ay = h.tgt.y; h.ax = ax; h.ay = ay;
      if (pressed('jump')) { this.releaseSwing(W, true); return; }
      if (pressed('hook')) { this.hookBuf = 0; const t2 = this.hookTarget; if (t2 && t2 !== h.tgt) { this.hook = { s: 'fly', tgt: t2, hx: h.hx, hy: h.hy, t: 0 }; sfx('hookThrow'); this.stats.hooks++; W.emit('hookThrow'); return; } this.lastAnchor = h.tgt; this.rehookBuf = 0.22; this.releaseSwing(W, false); return; } // v2.4: no new target yet -> buffered re-hook fires the moment one lines up; v1.4: re-hook chains straight to the next anchor
      if (pressed('dash')) { this.releaseSwing(W, false); this.startDash(W, mx); return; }
      // v1.4: attacking no longer drops the swing (updateAttack runs after this branch)
      // v2.4: shared integrator (physics.js swingStep) — tangent-projected pump, accel-limited reel, near-lossless pendulum, soft taut catch
      const r = swingStep(W.map, this, h, mx, my, dt);
      this.face = this.vx > 15 ? 1 : this.vx < -15 ? -1 : this.face;
      const sp = Math.hypot(this.vx, this.vy);
      if (r.crossed && sp > 170) { sfxV('swingWhoosh', clamp((sp - 170) / 360, 0.3, 1.1), 0.25); this.whooshT = 0.3; }
      if (sp > 300 && Math.random() < (sp - 300) / 600) { const hd = this.handPt || [this.cx, this.y + 8]; W.fx.burst(hd[0] + (h.hx - hd[0]) * Math.random(), hd[1] + (h.hy - hd[1]) * Math.random(), 1, { color: Math.random() < 0.5 ? '#7bd389' : '#a8e66a', min: 10, max: 50, g: 120, life: 0.5, size: 3 }); }
      h.hx = ax; h.hy = ay; this.airDash = true;
      if (h.t > 0.25 && groundBelow(W.map, this) && Math.abs(this.vx) < 30 && my >= 0) { this.hook = { s: 'none' }; }
      if (h.t > 6) this.releaseSwing(W, false);
      return;
    }
    if (h.s === 'zip') {
      const tg = h.tgt; const tx = tg.ent ? tg.ent.cx : tg.x, ty = tg.ent ? tg.ent.cy : tg.y;
      const dx = tx - this.cx, dy = ty - (this.y + 12), d = Math.hypot(dx, dy);
      if (h.v0 == null) h.v0 = Math.max(120, (this.vx * dx + this.vy * dy) / (d || 1));
      const sp = Math.min(640, h.v0 + h.t * 2600) * Math.max(0.5, Math.min(1, d / 70)); // v1.4: ramps from current speed, eases out near the target
      this.vx = dx / (d || 1) * sp; this.vy = dy / (d || 1) * sp; h.hx = tx; h.hy = ty;
      if (Math.random() < 0.6) W.fx.burst(this.cx, this.cy, 1, { color: '#bffaf0', min: 5, max: 30, g: 0, life: 0.25, size: 4 });
      if (d < (tg.ent ? 30 : 20) || h.t > 0.9 || (tg.ent && tg.ent.dead)) this.hookArrive(W);
      else if (h.t > 0.12 && Math.hypot(this.vx, this.vy) < 1) this.hookArrive(W);
      if (pressed('jump') && h.t > 0.08) { this.hookArrive(W); this.doJump(W); }
      return;
    }
    if (h.s === 'retract') { const dx = ox - h.hx, dy = oy - h.hy, d = Math.hypot(dx, dy), sp = 1500 * dt; if (d < sp) this.hook = { s: 'none' }; else { h.hx += dx / d * sp; h.hy += dy / d * sp; } this.freeMove(W, dt, mx); }
  }
  freeMove(W, dt, mx) { if (!this.onGround && Math.abs(this.vx) > C.RUN && sign(mx || this.vx) === sign(this.vx)) this.vx = approach(this.vx, sign(this.vx) * C.RUN, 160 * dt); else this.vx = approach(this.vx, mx * C.RUN, (this.onGround ? C.ACC_G : C.ACC_A) * dt); this.vy = Math.min(this.vy + C.GRAV * dt, C.MAXFALL); }
  attachHook(W, tg) {
    sfx('hookAttach'); vibrate(8); W.emit('hookAttach', tg.kind); W.fx.burst(tg.x, tg.y, 8, { color: tg.kind === 'zip' ? PAL.zip : PAL.swing, min: 40, max: 140, g: 0, life: 0.3, glow: 1 });
    if (tg.kind === 'swing') { this.hook = { s: 'swing', tgt: tg, hx: tg.x, hy: tg.y, ...swingInit(this, tg.x, tg.y, this.onGround, this.hookRange), t: 0 }; this.onGround = false; this.flipT = 0; sfx('thwip'); const hd = this.handPt || [this.cx, this.y + 8]; W.fx.burst(hd[0], hd[1], 5, { color: '#a8e66a', min: 20, max: 80, g: 60, life: 0.3, size: 3 }); W.emit('swing'); }
    else if (tg.kind === 'zip') { this.hook = { s: 'zip', tgt: tg, hx: tg.x, hy: tg.y, t: 0 }; W.emit('zip'); }
    else if (tg.kind === 'enemy') {
      const e = tg.ent;
      if (e.light && !e.boss) { W.hitEnemy(e, { dmg: 4, kb: 0, hs: 0.04, shake: 0.08, stun: 0.9, src: 'hook' }, this); e.yank(this); e.yankUntil = W.t + 0.9; /* v1.4: yank after the hit; v1.9: a hit on a yanked foe is a crit */ this.hook = { s: 'retract', hx: tg.x, hy: tg.y, t: 0 }; W.emit('hookEnemy'); }
      else { this.hook = { s: 'zip', tgt: tg, hx: tg.x, hy: tg.y, t: 0, strike: true }; }
    }
  }
  hookArrive(W) {
    const h = this.hook;
    let slash = false;
    if (h.strike && h.tgt.ent && !h.tgt.ent.dead) { const e = h.tgt.ent; slash = !!h.slash; this.face = sign(e.cx - this.cx || this.face); W.hitEnemy(e, slash ? { dmg: 22, kb: 320, hs: 0.1, shake: 0.3, stun: 0.6, stag: 0.8, crit: true, src: 'hook' } : { dmg: 14, kb: 260, hs: 0.08, shake: 0.25, stun: 0.4, stag: 0.6, src: 'hook' }, this); trail(W, this, { kind: 'spin', r: 34, th: 12, dur: 0.14, col: WEAPONS[this.weapon].color }); sfx('zip'); this.vx = -this.face * (slash ? 150 : 200); this.vy = -300; this.iframes = Math.max(this.iframes, 0.3); W.emit('hookEnemy'); if (slash) { sfx('swing'); W.fx.ring(e.cx, e.cy, 26, WEAPONS[this.weapon].color, 0.25, 5); } }
    else { this.vx *= 0.75; this.vy = Math.min(this.vy * 0.75, -200); } // v1.4: keeps the zip's direction instead of snapping
    this.freeJump = 0.32; this.airDash = true; this.hook = { s: 'none' }; this.sy = 1.2; this.sx = 0.85;
    if (h.slash && !slash) { this.atk = null; this.startAttack(W, input.my); } // buffered attack fires on arrival
    if (slash) { this.atk = { kind: 'air', step: 2, phase: 'active', t: 0, wind: 0, def: { ...WEAPONS[this.weapon].air, mv: 'airspin', both: true }, hit: new Set([h.tgt.ent]), slash: true }; this.stats.attacks++; }
  }
  releaseSwing(W, boost) {
    const h = this.hook;
    if (boost && h.s === 'swing') { const r = swingRelease(this, h, true); sfx('jump'); sfxV(r.sweet ? 'swingSweet' : 'swingWhoosh', r.sweet ? 1 : 0.6, 0.1); this.sy = 1.3; this.sx = 0.8; this.flipDur = r.sweet ? 0.46 : 0.34; this.flipT = this.flipDur; this.flipDir = sign(this.vx) || this.face; this.sweetRel = r.sweet;
      W.fx.burst(this.cx, this.cy, r.sweet ? 10 : 5, { color: '#a8e66a', min: 40, max: 140, g: 160, life: 0.5, size: 3 }); if (r.sweet) { W.fx.ring(this.cx, this.cy, 22, '#bffaf0', 0.22, 3); W.zoomKick && W.zoomKick(0.25); } W.emit('swingRelease', r.sweet); this.lastAnchor = h.tgt; }
    this.hook = { s: 'none' }; this.airDash = true; this.wallJumping = true;
  }
  // ---------------- combat ----------------
  updateAttack(W, dt, mx, my) {
    if (this.weapon === 'bow') { // v2.4 Thornbow: own one-button draw/charge/shoot loop (no generic melee charge)
      const pr = pressed('attack') || (this.atkBuf > 0 && !this.bowS && this.dashT <= 0 && this.hurtT <= 0);
      let pA = false; if (pr && this.parryLock <= 0 && this.flaskT <= 0) { this.atkBuf = 0; if (!W.tryInteract(this)) pA = true; }
      this.atk = null; this.chargeT = 0; BW.update(W, this, dt, mx, my, pA, held('attack')); return; }
    const wpn = WEAPONS[this.weapon];
    const atkP = pressed('attack') || (this.atkBuf > 0 && !held('attack') && !this.atk && this.dashT <= 0 && this.hurtT <= 0); // v2.1: a tap during parry/flask/hurt/dash is kept for 160 ms
    if (atkP && this.parryLock <= 0 && this.flaskT <= 0) { this.atkBuf = 0;
      if (W.tryInteract(this)) { /* used as interact */ }
      else if ((this.dashT > 0 || this.dashEnd > 0) && !this.atk && this.weapon !== 'bow' && this.dashSlashes < 1 && this.hook.s === 'none') this.startDashSlash(W); // v1.9 dash + tap
      else if (this.dashT > 0) { /* dash owns the frame */ }
      else if (!this.atk) this.startAttack(W, my);
      else this.queued = true;
    }
    // charge while holding after the first hit; with a full Bloom gauge keep holding for the special
    if (held('attack') && !this.atk && this.dashT <= 0 && this.parryLock <= 0) {
      this.chargeT += dt; if (this.chargeT > 0.2 && this.chargeT - dt <= 0.2) sfx('charge');
      if (this.chargeT >= 0.55 && !this.charged) { this.charged = true; sfx('charged'); W.fx.ring(this.cx, this.cy, 30, wpn.color, 0.3, 4); W.emit('charged'); }
      if (this.charged && !this.charged2 && this.chargeT >= 1.05 && this.gauge >= GAUGE_MAX) { this.charged2 = true; sfx('charged2'); W.fx.ring(this.cx, this.cy, 44, '#ffc2e0', 0.4, 5); petals(W, this.cx, this.cy - 6, 10, { max: 120 }); W.emit('bloomReady'); }
    }
    if (released('attack') || !held('attack')) {
      if (this.charged2 && !this.atk) this.startSpecial(W);
      else if (this.charged && !this.atk) { this.startAttack(W, my, 'heavy'); W.emit('heavy'); }
      this.chargeT = 0; this.charged = false; this.charged2 = false;
    }
    const a = this.atk; if (!a) return;
    a.t += dt;
    if (a.kind === 'plunge') return this.updatePlunge(W, a);
    const d = a.def;
    if (a.wm && WH.update(W, this, a, dt)) { this.onConnect(W, a); if (d.pogo && !this.onGround) { this.vy = -400; this.airDash = true; this.airHover = 0; } }
    if (a.phase === 'wind' && a.t >= (a.wind ?? d.wind)) { a.phase = 'active'; a.t = 0; this.onActive(W, a, d, wpn); }
    if (a.phase === 'active') {
      if (d.ticks > 1) { const n = Math.min(d.ticks - 1, Math.floor(a.t / (d.active / d.ticks))); if (n !== (a.tick || 0)) { a.tick = n; a.hit.clear(); if (d.mv === 'whirl') sfx('spin', 0.05); } }
      if (d.pull) for (const e of W.enemies) if (!e.dead && e.light && !e.boss && Math.abs(e.cx - this.cx) < 110 && Math.abs(e.cy - this.cy) < 60) e.vx = approach(e.vx, sign(this.cx - e.cx) * 160, 900 * dt);
      if (a.kind === 'special') this.updateSpecial(W, a);
      else if (!d.proj && !a.wm) { const box = this.attackRect(d); if (W.attackBox(box, a.hd || d, this, a.hit)) this.onConnect(W, a); }
      if (a.t >= d.active) { a.phase = 'rec'; a.t = 0; if (d.burst) this.vineBurst(W, d); }
    } else if (a.phase === 'rec') {
      if (this.queued && a.t > d.rec * 0.35 && a.kind === 'combo') { const n = wpn.combo.length; if (a.step + 1 < n) { this.queued = false; this.startAttack(W, my, 'combo', a.step + 1); return; } }
      if (this.queued && a.t > d.rec * 0.45 && (a.kind === 'air' || a.kind === 'kick' || (a.kind === 'rise' && !this.onGround))) { this.queued = false; this.atk = null; this.startAttack(W, my); return; } // chained air swings
      if (a.t >= d.rec) { this.atk = null; this.comboT = 0.25; this.comboIdx = a.kind === 'combo' ? a.step + 1 : 0; if (this.queued) { this.queued = false; this.comboIdx = 0; this.startAttack(W, my); } } // v1.4: a tap during the finisher restarts the combo instead of being dropped
    }
  }
  onActive(W, a, d, wpn) { // v1.9: the strike frame -- sound, lunge, trail, finisher shockwave
    sfx(d.sfx);
    if (d.lunge && this.onGround) { const lv = d.lunge * (Math.abs(input.mx) > 0.1 || W.nearestEnemyAhead(this) || a.kind === 'counter' ? 1 : 0.4); this.vx = this.face * Math.max(lv, sign(this.vx) === this.face ? Math.abs(this.vx) : 0); } // lunge never slows a running swing
    if (d.hop) { this.vy = d.hop; this.onGround = false; this.coyote = 0; }
    if (d.proj) W.spawnArrow(this, d); if (d.quake) W.quake(this, d);
    a.hd = { ...d, crit: d.crit || this.critT > 0, air: a.kind === 'air' };
    const mv = MV[a.mv || d.mv], pal = palOf(this.weapon), col = pal[0], core = pal[1], heavy = this.weapon === 'hammer', up = a.kind === 'rise' || a.up;
    if (mv && !a.wm && !d.proj && this.weapon === 'whip' && !mv.spin && !mv.foot && (mv.arc || mv.thrust)) trail(W, this, { kind: 'whip', arc: mv.arc || [-0.15, 0.1], r: Math.min(124, (d.w || 90) * 1.02), sq: mv.thrust ? 0.4 : 1, dur: Math.max(0.07, d.active * 0.9), fade: 0.13, col, core, ox: 2, oy: up ? -10 : -6 });
    if (heavy && !d.proj && a.kind !== 'special') { W.fx.burst(this.cx + this.face * 30, this.cy - 4, d.fin ? 10 : 6, { color: [col, '#ffd08a', core], kind: 'spark', min: 90, max: d.fin ? 340 : 230, life: 0.4, glow: 1, g: 420, angle: this.face > 0 ? -0.7 : Math.PI + 0.7, spread: 0.9, size: 3 }); } // embers off the hammer head
    else if (this.weapon === 'blade' && a.kind !== 'special' && !d.proj) leaves(W, this.cx + this.face * 26, this.cy - 8, d.fin ? 6 : 2, { angle: up ? -Math.PI / 2 : (this.face > 0 ? 0 : Math.PI), spread: 0.9 });
    if (mv && !d.proj && !(this.weapon === 'whip' && !mv.spin)) {
      if (mv.thrust) trail(W, this, { kind: 'thrust', L: Math.min(110, d.w * 0.95), h: 16, dur: d.active, col, core, heavy, oy: -4 + (d.oy || 0) });
      else if (mv.line) trail(W, this, { kind: 'dash', L: 74, h: 18, dur: d.active, fade: 0.2, col, core, heavy });
      else if (mv.spin) trail(W, this, { kind: 'spin', r: Math.min(64, (d.w || 70) * 0.5), th: mv.th, dur: d.active, turns: d.ticks > 2 ? d.ticks * 0.6 : 1, col, core, heavy, oy: -2 });
      else if (mv.foot) trail(W, this, { kind: 'foot', dur: d.active, col: '#e8fff0' });
      else if (mv.arc) trail(W, this, { kind: 'arc', arc: mv.arc, r: mv.r, th: mv.th, dur: Math.max(0.06, d.active * 0.85), col, core, heavy, ox: a.kind === 'rise' || a.up ? 6 : 2, oy: a.kind === 'rise' || a.up ? -10 : -6 });
    }
    if (d.fin) { // finisher: vine lash along the ground, shockwave, crack decal, white flash
      const gy = this.y + this.h, fx0 = this.cx + this.face * 18; W.fx.flash = Math.max(W.fx.flash, 0.22); W.fx.flashColor = '#fff6d8'; W.fx.shake(0.22); W.zoomKick(0.45);
      if (this.onGround) { wave(W, fx0, gy, heavy ? 90 : 64, col); decal(W, fx0, gy, 1.1); leaves(W, fx0, gy - 4, 10, { angle: -Math.PI / 2, spread: 1.2 }); W.fx.dust && W.fx.dust(fx0, gy, 6, { dir: this.face, speed: 90, size: 4, life: 0.5 });
        if (d.lashL) { lash(W, fx0, gy, this.face, d.lashL, col); const L = d.lashL; W.attackBox({ x: this.face > 0 ? fx0 : fx0 - L, y: gy - 22, w: L, h: 22 }, a.hd, this, a.hit); } }
    }
  }
  ownedStyles() { const u = save.progress.unlocks || {}; return STYLES.filter((id) => id === 'blade' || u[id] || id === this.weapon); }
  swapStyle(W) { // v2.0 quick-swap: cycle the fighting styles you have earned (Leaf Blade / Thorn Hammer / Vine Whip)
    const own = this.ownedStyles(); this.swapCd = 0.3;
    if (own.length < 2) { W.fx.text(this.cx, this.y - 18, 'Earn styles in missions!', '#d8e6ff', 11); sfx('uiBack'); return; }
    const i = own.indexOf(this.weapon), next = own[(i + 1) % own.length], pal = palOf(next); this.weapon = next; this.bowS = null; this.comboIdx = 0; this.comboT = 0; this.queued = false;
    if (W.mode !== 'run') save.progress.weapon = next;
    const gy = this.onGround ? this.y + this.h : this.cy + 14; wave(W, this.cx, gy, 52, pal[0]); W.fx.burst(this.cx, this.cy - 4, 14, { color: pal, kind: next === 'blade' ? 'leaf' : next === 'hammer' ? 'spark' : 'leaf', min: 60, max: 200, life: 0.5, glow: 1, size: 4 });
    W.fx.text(this.cx, this.y - 18, WEAPONS[next].name.toUpperCase(), pal[1], 13); sfx(next === 'hammer' ? 'hamA' : next === 'whip' ? 'whipCrack' : 'slashA'); vibrate(10); W.emit('styleSwap', next);
  }
  onConnect(W, a) {
    if (a.connected) return; a.connected = true; if (this.critT > 0 && a.hd && a.hd.crit) this.critT = 0;
    if (!this.onGround && (a.kind === 'air' || a.kind === 'rise') && this.airHover < 4) { this.airHover++; if (this.vy > -60) this.vy = -110; } // v1.9: air hits give a small hover so juggles chain; momentum (vx) is kept
    if (a.kind === 'counter') { W.fx.text(this.cx, this.y - 14, 'COUNTER!', '#bff2ff', 15); W.hitstop(0.12); }
    if (a.kind === 'dash') { W.slow = Math.max(W.slow || 0, 0.12); }
    if (a.kind === 'kick') { this.vx *= 0.85; }
  }
  vineBurst(W, d) { // end of the charged whirlwind: thorny vines burst out both ways
    const gy = this.onGround ? this.y + this.h : this.cy + 10; sfx('vineBurst'); W.fx.shake(0.3); wave(W, this.cx, gy, 90, '#c8f08a'); leaves(W, this.cx, gy - 6, 16); if (this.onGround) decal(W, this.cx, gy, 1.2);
    for (const dir of [-1, 1]) lash(W, this.cx, gy, dir, 90);
    W.attackBox({ x: this.cx - 96, y: gy - 40, w: 192, h: 44 }, { dmg: d.burst, kb: 300, hs: 0.08, shake: 0.3, launch: 340, stag: 0.8, breaks: true, fin: true }, this, new Set());
  }
  updatePlunge(W, a) {
    if (a.phase === 'wind' && a.t > 0.08) { a.phase = 'active'; a.t = 0; this.vy = 560; sfx('plunge'); }
    if (a.phase === 'active') { this.vy = 560; this.vx *= 0.9; const box = { x: this.x - 6, y: this.y + this.h - 6, w: this.w + 12, h: 22 };
      if (W.attackBox(box, a.def, this, a.hit)) { this.vy = -430; this.atk = null; this.airDash = true; this.airHover = 0; sfx('plungeHit'); wave(W, this.cx, this.y + this.h + 8, 40); W.fx.burst(this.cx, this.y + this.h + 6, 10, { color: ['#fff', '#ffe27a'], kind: 'spark', min: 120, max: 320, angle: Math.PI / 2, spread: 1.4, glow: 1, life: 0.3 }); W.emit('plungeBounce'); return; }
      if (this.onGround) { const gy = this.y + this.h; W.fx.burst(this.cx, gy, 14, { color: '#e8e2d0', angle: -Math.PI / 2, spread: 1.4, max: 200, life: 0.4 }); W.fx.shake(0.32); W.hitstop(0.05); sfx('slam'); wave(W, this.cx, gy, 84); decal(W, this.cx, gy, 1.2); leaves(W, this.cx, gy - 4, 8, { angle: -Math.PI / 2, spread: 1.3 });
        W.attackBox({ x: this.x - 40, y: gy - 22, w: this.w + 80, h: 22 }, { ...a.def, launch: 260, stag: 0.6 }, this, a.hit); a.phase = 'rec'; a.t = 0; W.emit('plungeLand'); } }
    if (a.phase === 'rec' && a.t > 0.2) this.atk = null;
  }
  attackRect(d, up = !!(this.atk && this.atk.up)) { if (d.mv === 'rise') { const w = d.w; return { x: this.face > 0 ? this.cx - 6 : this.cx + 6 - w, y: this.y - 26, w, h: this.h + 30 }; } if (up && !d.both) { const L = d.w * 0.9, Wd = d.h + 10; return { x: this.cx - Wd / 2, y: this.y + 10 - L, w: Wd, h: L }; } const w = d.w, h = d.h; const x = d.both ? this.cx - w / 2 : this.face > 0 ? this.cx - 4 : this.cx + 4 - w; return { x, y: this.cy - h / 2 + (d.oy || 0), w, h }; }
  startAttack(W, my, kind = 'combo', step = 0) { // v2.4: the Vine Whip picks a lash per direction (forward / up / diagonal / air-down)
    if (this.weapon !== 'whip' || kind === 'heavy') return this._startAttack(W, my, kind, step);
    const mx = input.mx, diag = my < -0.3 && Math.abs(mx) > 0.35, swingKick = this.hook.s === 'swing';
    if (kind === 'combo' && !this.onGround && !swingKick && this.hook.s === 'none' && my > 0.5) { // air down-lash (pogo on hit)
      if (Math.abs(mx) > 0.2) this.face = sign(mx); const A = WEAPONS.whip.air;
      this.atk = { kind: 'air', step: 0, phase: 'wind', t: 0, wind: A.wind * 0.75, def: { ...A, mv: 'wdown', pogo: true }, hit: new Set(), wm: 'down' }; this.stats.attacks++; W.emit('attack'); return;
    }
    const prev = this.atk; this._startAttack(W, diag ? 0 : my, kind, step); const a = this.atk;
    if (!a || a === prev || a.wm || !['combo', 'air', 'rise'].includes(a.kind)) return;
    const wm = diag ? 'diag' : a.kind === 'rise' || a.up ? 'up' : a.kind === 'air' ? 'air' : ({ wcut: 'cut', wrev: 'rev', wrise: 'rise', wfin: 'fin' })[a.def.mv] || 'cut';
    a.wm = wm; a.up = false; a.def = { ...a.def, mv: 'w' + wm, tip: true, w: WH.WM[wm].L };
    if (a.kind === 'rise') a.def.sfx = 'whipWind';
  }
  _startAttack(W, my, kind = 'combo', step = 0) {
    const wpn = WEAPONS[this.weapon]; if (Math.abs(input.mx) > 0.2) this.face = sign(input.mx); else this.autoFace(W);
    const melee = this.weapon !== 'bow', up = my < -0.5 && melee && kind !== 'heavy', thr = wpn.combo[0].thrust;
    if (kind === 'combo' && this.counterT > 0 && melee && this.hook.s === 'none') return this.startCounter(W);
    if (kind === 'combo' && !this.onGround && (this.hook.s === 'none' || this.hook.s === 'swing')) {
      if (my > 0.5 && melee) { this.atk = { kind: 'plunge', phase: 'wind', t: 0, def: { dmg: 16, kb: 200, hs: 0.06, shake: 0.2, breaks: this.weapon === 'hammer', stag: 0.5 }, hit: new Set() }; this.vy = -120; sfx('swing'); W.emit('attack'); return; }
      if (this.hook.s === 'swing' && melee) { // v1.9 swing kick: feet first, speed adds damage, the swing keeps going
        const sp = Math.hypot(this.vx, this.vy); this.atk = { kind: 'kick', step: 0, phase: 'wind', t: 0, wind: 0.02, def: { dmg: Math.round(8 + Math.min(12, sp / 40)), wind: 0.02, active: 0.14, rec: 0.1, w: 36, h: 28, oy: 12, kb: 200 + sp * 0.4, hs: 0.05, shake: 0.16, sfx: 'kick', mv: 'kick', stag: 0.55 }, hit: new Set() }; this.stats.attacks++; W.emit('attack'); W.emit('kick'); return; }
      if (this.airStepT <= 0) this.airStep = 0; const st = melee ? this.airStep % 3 : 0; this.airStep++; this.airStepT = 0.6;
      const A = wpn.air, def = !melee ? A : thr ? { ...A, mv: 'lunge' } : up ? { ...A, mv: 'rise' } : st === 0 ? { ...A, mv: 'air' } : st === 1 ? { ...A, dmg: A.dmg + 1, mv: 'airrev', sfx: 'slashB' } : { ...A, dmg: Math.round(A.dmg * 1.25), mv: 'airspin', both: true, w: A.w * 1.5, active: A.active * 1.4, sfx: 'spin', stag: 0.5 };
      this.atk = { kind: 'air', step: st, phase: 'wind', t: 0, wind: A.wind * 0.75, def, hit: new Set(), up }; this.stats.attacks++; W.emit('attack'); if (st === 2) W.emit('airSpin'); return;
    }
    if (kind === 'combo' && up && step === 0) { // v1.9 launcher: rising uppercut that pops light foes up and hops after them
      const def = { dmg: this.weapon === 'hammer' ? 18 : 11, wind: 0.08, active: 0.1, rec: 0.22, w: 46, h: 40, kb: 60, hs: 0.06, shake: 0.18, sfx: 'launch', mv: 'rise', launch: 540, stag: 0.7, hop: -440, breaks: this.weapon === 'hammer' };
      this.atk = { kind: 'rise', step: 0, phase: 'wind', t: 0, wind: def.wind, def, hit: new Set(), up: true }; this.stats.attacks++; this.sx = 0.9; this.sy = 1.12; W.emit('attack'); W.emit('launcher'); return;
    }
    if (kind === 'combo' && step === 0 && this.comboT > 0 && this.comboIdx < wpn.combo.length) step = this.comboIdx;
    const def = kind === 'heavy' ? wpn.heavy : wpn.combo[step];
    this.atk = { kind, step, phase: 'wind', t: 0, wind: kind === 'heavy' ? def.wind : def.wind * 0.75, def, hit: new Set(), up: up && !def.proj && !def.both }; this.stats.attacks++; // v1.4: snappier startup
    if (def.fin) W.emit('finisher'); if (kind === 'combo') W.emit('comboHit', step + 1);
    this.sx = 1.12; this.sy = 0.9; W.emit('attack');
  }
  startDashSlash(W) {
    const def = { dmg: 14, wind: 0, active: 0.14, rec: 0.12, w: 58, h: 30, oy: -2, kb: 220, hs: 0.05, shake: 0.2, sfx: 'dashSlash', mv: 'dash', stag: 0.5 };
    this.dashSlashes++; this.dashT = Math.max(this.dashT, 0.1); this.dashDir = this.face; this.iframes = Math.max(this.iframes, 0.3); this.dashEnd = 0;
    this.atk = { kind: 'dash', step: 0, phase: 'wind', t: 0, wind: 0, def, hit: new Set() }; this.stats.attacks++; W.emit('attack'); W.emit('dashSlash');
  }
  startCounter(W) { // v1.9 parry counter: flash-step slash that always crits
    this.counterT = 0; let tg = null, best = 1e9; for (const e of W.enemies) { if (e.dead) continue; const d = Math.hypot(e.cx - this.cx, e.cy - this.cy); if (d < 140 && d < best) { best = d; tg = e; } } if (tg) this.face = sign(tg.cx - this.cx) || this.face;
    const def = { dmg: 24, wind: 0.04, active: 0.1, rec: 0.2, w: 62, h: 40, oy: -4, lunge: tg ? Math.min(420, 120 + best * 2.2) : 200, kb: 360, hs: 0.1, shake: 0.4, sfx: 'counter', mv: 'counter', crit: true, breaks: true, stag: 1, poise: 2 };
    this.atk = { kind: 'counter', step: 0, phase: 'wind', t: 0, wind: def.wind, def, hit: new Set() }; this.iframes = Math.max(this.iframes, 0.35); W.slow = Math.max(W.slow || 0, 0.18); this.stats.attacks++; W.emit('attack'); W.emit('counter');
  }
  startSpecial(W) { // v1.9 Bloom: full gauge + long hold. Thorn-and-petal ring that hits everything nearby three times.
    this.gauge = 0; this.iframes = Math.max(this.iframes, 1.1); if (this.onGround) { this.vy = -220; this.onGround = false; } else this.vy = Math.min(this.vy, -120);
    this.atk = { kind: 'special', step: 0, phase: 'wind', t: 0, wind: 0.16, def: { dmg: 0, wind: 0.16, active: 0.5, rec: 0.22, mv: 'bloom', sfx: 'special' }, hit: new Set(), ticks: 0 };
    W.special = { t: 0, life: 1.15, x: this.cx, y: this.y + this.h, R: 150, seed: Math.random() * 6 }; W.slow = Math.max(W.slow || 0, 0.3); sfx('specialWind'); W.emit('special'); this.stats.attacks++;
  }
  updateSpecial(W, a) {
    const due = a.t >= a.ticks * 0.17; if (!due || a.ticks >= 3) return; a.ticks++;
    if (a.ticks === 1) { W.fx.flash = 0.5; W.fx.flashColor = '#ffc2e0'; W.fx.shake(0.5); W.zoomKick(1); petals(W, this.cx, this.cy, 36, { max: 320 }); wave(W, this.cx, this.y + this.h, 150, '#ffc2e0'); if (W.special) { W.special.x = this.cx; W.special.y = this.y + this.h; } }
    else { petals(W, this.cx, this.cy, 12, { max: 260 }); sfx('vineBurst'); }
    const S = W.special || { x: this.cx, y: this.cy, R: 150 };
    for (const e of W.enemies) { if (e.dead) continue; const dx = (e.cx - S.x) / S.R, dy = (e.cy - (S.y - 20)) / (S.R * 0.7); if (dx * dx + dy * dy > 1) continue; W.hitEnemy(e, { dmg: 16, kb: 240, launch: 360, hs: 0.05, shake: 0.25, stag: 0.8, crit: true, poise: 3, breaks: true, src: 'special' }, this); }
  }
  canCancel() { const a = this.atk; if (!a) return true; if (a.kind === 'special') return a.phase === 'rec' && a.t > 0.1; return a.kind === 'air' || a.kind === 'kick' || a.phase === 'rec' || (a.phase === 'active' && (a.kind === 'combo' || a.kind === 'rise') && !a.def.fin && a.t >= 0.034); } // v1.4 cancel window: after the first 2 active frames
  autoFace(W) { // no stick: turn toward a close enemy behind if none is in front
    let ahead = false, back = null; for (const e of W.enemies) { if (e.dead || e.type === 'dummy') continue; const dx = e.cx - this.cx; if (Math.abs(dx) > 70 || Math.abs(e.cy - this.cy) > 50) continue; if (sign(dx) === this.face) ahead = true; else back = e; }
    if (!ahead && back) this.face = -this.face;
  }
  hurt(W, dmg, srcX, info = {}) {
    if (this.dead || this.respawnT > 0) return 'none';
    if (this.parryT > 0 && info.parryable !== false) { this.parryT = 0; this.parryLock = 0.12; this.stats.parries++; W.onParry(this, info); return 'parry'; }
    if (W.god) return 'dodge';
    if (this.dashT > 0 && this.perfCd <= 0 && (info.src || info.shot)) { // v1.9 perfect dodge: slow-mo + the next hit crits
      this.perfCd = 1.6; W.slow = Math.max(W.slow || 0, 0.5); this.critT = 1.3; gain(this, 12, W); sfx('perfect'); vibrate(20);
      W.fx.text(this.cx, this.y - 8, 'PERFECT!', '#bff7ff', 15); W.fx.ring(this.cx, this.cy, 44, '#bff7ff', 0.35, 4); W.emit('perfectDodge'); return 'dodge'; }
    if (this.dashT > 0 || this.iframes > 0) { if (this.dashT > 0 && !this.dodgeShown) { this.dodgeShown = true; W.fx.text(this.cx, this.y - 4, 'dodge!', '#bff7ff', 11); setTimeout(() => (this.dodgeShown = false), 400); } return 'dodge'; }
    const real = Math.max(1, Math.round(dmg * diff().dmgTaken * (W.dmgTaken || 1)));
    this.hp -= real; this.iframes = diff().iframes ?? 1.0; this.hurtT = 0.22; this.flash = 0.25; this.atk = null; this.hook = { s: 'none' };
    const d = sign(this.cx - srcX) || -this.face; this.vx = d * 230; this.vy = -240; this.lastHit = info;
    W.fx.shake(0.45); W.hitstop(0.08); W.fx.flash = 0.35; W.fx.flashColor = '#ff5a7a'; sfx('hurt'); vibrate(35);
    W.fx.burst(this.cx, this.cy, 10, { color: ['#fff', '#ffd0d8'], max: 200, life: 0.4, kind: 'star', size: 5 });
    W.fx.text(this.cx, this.y - 6, '-' + real, '#ff8aa0', 14);
    if (this.hp <= 0 && W.tryRevive && W.tryRevive(this)) return 'hit';
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deadT = 0; W.onPlayerDeath(info); }
    return 'hit';
  }
  updateScarf(dt) {
    const s = this.scarf; const ax = this.cx - this.face * 4, ay = this.y + 13 + (this.sy - 1) * -10;
    s[0].x = ax; s[0].y = ay;
    for (let i = 1; i < s.length; i++) { const p = s[i]; const vx = (p.x - p.px) * 0.9, vy = (p.y - p.py) * 0.9; p.px = p.x; p.py = p.y; p.x += vx - this.face * 8 * dt + Math.sin(this.t * 7 + i) * 0.25; p.y += vy + 150 * dt * dt * 60 * 0.12; }
    for (let k = 0; k < 2; k++) for (let i = 1; i < s.length; i++) { const a = s[i - 1], b = s[i]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, want = 4.2; const f = (d - want) / d; b.x -= dx * f; b.y -= dy * f; }
  }
  // ---------------- drawing ----------------
  draw(g, W) {
    if (this.respawnT > 0) return;
    if (this.iframes > 0 && this.dashT <= 0 && !this.atk && !this.dead && Math.floor(this.t * 20) % 2 === 0 && this.iframes < 0.95) g.globalAlpha = 0.45;
    const t = this.t, f = this.face, X = this.cx, Y = this.y + this.h;
    // vine/hook line
    const h = this.hook;
    const pose = G.hero ? this.heroPose(W) : null;
    if (h.s !== 'none' && h.hx !== undefined) {
      let hx0 = X + f * 7, hy0 = this.y + 16; if (pose && pose.hand) [hx0, hy0] = pose.hand; this.handPt = [hx0, hy0];
      this.drawVine(g, hx0, hy0, h, t);
      g.fillStyle = '#d9a35a'; g.beginPath(); g.arc(h.hx, h.hy, 4, 0, 7); g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 1.5; g.stroke();
    }
    if (pose) this.drawFrames(g, W, pose);
    else {
    // scarf
    const rig = has('head'); if (rig) { g.save(); g.translate(X, Y); g.scale(W.heroK || HERO_K, W.heroK || HERO_K); g.translate(-X, -Y); } g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(this.scarf[0].x, this.scarf[0].y); for (const p of this.scarf) g.lineTo(p.x, p.y);
    if (rig) { g.strokeStyle = PAL.ink; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#d8622a'; g.lineWidth = 3.2; g.stroke(); g.strokeStyle = '#ffb36a'; g.lineWidth = 1; g.stroke(); }
    else { g.strokeStyle = PAL.scarf; g.lineWidth = 4.5; g.stroke(); g.strokeStyle = '#ffc77a'; g.lineWidth = 1.5; g.stroke(); }
    if (rig) g.restore();
    if (has('head')) this.drawRig(g, W);
    else {
    g.save(); g.translate(X, Y);
    let lean = this.leanS || 0; if (h.s === 'swing') lean = Math.atan2(h.hx - X, -(h.hy - this.cy)) * 0.6;
    if (this.dead) { lean = 0; g.rotate(Math.min(1.4, this.deadT * 4) * -f); }
    g.rotate(lean); g.scale(this.sx * f, this.sy);
    const run = this.onGround && Math.abs(this.vx) > 20, ph = this.runPh;
    const bob = run ? Math.abs(Math.sin(ph)) * -2.5 : Math.sin(t * 2.4) * 0.8;
    // legs
    g.fillStyle = '#3a2f45'; g.strokeStyle = PAL.ink; g.lineWidth = 2;
    const leg = (o, ph2) => { const lx = run ? Math.sin(ph2) * 6 : 0, ly = run ? Math.max(0, -Math.cos(ph2)) * -4 : 0; const air = !this.onGround ? -3 : 0; g.beginPath(); g.roundRect(-3 + o + lx - 3, -9 + ly + air, 6, 9, 2); g.fill(); g.stroke(); g.fillStyle = '#6b4a3a'; g.beginPath(); g.ellipse(o + lx + 1, -1 + ly + air, 4.5, 2.6, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#3a2f45'; };
    leg(-4, ph); leg(4, ph + Math.PI);
    g.translate(0, bob);
    // cloak body
    const sway = clamp(-this.vx / 300, -1, 1) * 4 + Math.sin(t * 3) * 1;
    g.fillStyle = PAL.heroDk; g.beginPath(); g.moveTo(-6, -32); g.quadraticCurveTo(-14, -18, -12 + sway, -6); g.quadraticCurveTo(-6, -3, -2 + sway, -7); g.quadraticCurveTo(3, -2, 8 + sway, -6); g.quadraticCurveTo(13, -14, 6, -32); g.closePath(); g.fill(); g.lineWidth = 2.2; g.stroke();
    g.fillStyle = PAL.hero; g.beginPath(); g.moveTo(-5, -31); g.quadraticCurveTo(-10, -18, -8 + sway * 0.6, -9); g.quadraticCurveTo(0, -6, 6 + sway * 0.6, -9); g.quadraticCurveTo(9, -18, 5, -31); g.closePath(); g.fill();
    // leaf pattern
    g.strokeStyle = PAL.heroDk; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -27); g.lineTo(0, -10); g.moveTo(0, -20); g.lineTo(-4, -16); g.moveTo(0, -16); g.lineTo(4, -12); g.stroke();
    // arm + gauntlet
    const atk = this.atk; let armA = 0.3 + Math.sin(ph) * (run ? 0.5 : 0.05);
    if (atk) { const prog = atk.phase === 'wind' ? -1 : atk.phase === 'active' ? 1 : 0.6; armA = atk.kind === 'plunge' ? 1.5 : prog < 0 ? -2.2 : 1.2 + (atk.step % 2) * -0.4; }
    if (this.chargeT > 0.2) armA = -2.4 + Math.sin(t * 40) * 0.05;
    if (this.parryLock > 0) armA = -0.3;
    if (h.s !== 'none') armA = -Math.atan2(h.hx - X, -(h.hy - this.cy)) * f + (f > 0 ? 0 : 0);
    g.save(); g.translate(3, -24); g.rotate(armA);
    this.drawWeapon(g, atk);
    g.fillStyle = '#c47a3a'; g.beginPath(); g.roundRect(-3, 0, 6, 11, 3); g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 1.8; g.stroke();
    g.restore();
    // head + hood
    g.translate(0, -36);
    g.fillStyle = PAL.heroDk; g.beginPath(); g.ellipse(0, 0, 11.5, 11, 0, 0, 7); g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 2.2; g.stroke();
    g.fillStyle = PAL.hero; g.beginPath(); g.ellipse(-1, -2, 10, 9, 0, 0, 7); g.fill();
    // sprout on hood
    const sp = Math.sin(t * 4) * 0.2 - clamp(this.vx / 600, -0.4, 0.4);
    g.save(); g.translate(-2, -10); g.rotate(sp - 0.3); g.strokeStyle = '#2e7a3f'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -7); g.stroke(); g.fillStyle = '#8fe07a'; g.beginPath(); g.ellipse(-4, -8, 5, 2.6, -0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(4, -9, 5, 2.6, 0.5, 0, 7); g.fill(); g.restore();
    // face
    g.fillStyle = PAL.skin; g.beginPath(); g.ellipse(3, 1.5, 7, 6.5, 0, 0, 7); g.fill();
    const blink = (t % 3.3) < 0.1;
    g.fillStyle = PAL.ink;
    if (this.dead) { g.lineWidth = 1.5; g.strokeStyle = PAL.ink; for (const ex of [1, 6.5]) { g.beginPath(); g.moveTo(ex - 2, -1); g.lineTo(ex + 2, 3); g.moveTo(ex + 2, -1); g.lineTo(ex - 2, 3); g.stroke(); } }
    else if (blink) { g.fillRect(0, 1, 3.5, 1.2); g.fillRect(5.5, 1, 3.5, 1.2); }
    else { g.beginPath(); g.ellipse(1.8, 1, 1.9, 2.6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(7, 1, 1.9, 2.6, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(2.2, -0.6, 1, 1); g.fillRect(7.4, -0.6, 1, 1); }
    g.fillStyle = 'rgba(255,120,120,0.35)'; g.beginPath(); g.arc(9, 4.5, 1.6, 0, 7); g.fill();
    g.restore(); g.globalAlpha = 1;
    }
    }
    const atk = this.atk;
    // charge glow + parry shield
    if (this.chargeT > 0.2) drawGlow(g, X + f * 10, this.cy - 4, 14 + (this.charged ? 10 + Math.sin(t * 30) * 3 : this.chargeT * 12), WEAPONS[this.weapon].color, this.charged ? 0.9 : 0.5);
    if (this.parryT > 0 || this.parryLock > 0.1) { g.strokeStyle = '#bfefff'; g.lineWidth = 3; g.globalAlpha = this.parryT > 0 ? 0.95 : 0.4; g.beginPath(); g.arc(X, this.cy, 24, f > 0 ? -1.2 : Math.PI - 1.2 + 0.0, f > 0 ? 1.2 : Math.PI + 1.2); g.stroke(); drawGlow(g, X + f * 18, this.cy, 22, '#9fe8ff', 0.5); g.globalAlpha = 1; }
    if (this.flash > 0) { drawGlow(g, X, this.cy, 30, '#ff7090', this.flash * 2); }
    // attack smear
    if (atk && atk.phase === 'active' && atk.def && !atk.def.proj && atk.kind !== 'plunge' && atk.kind !== 'special' && atk.kind !== 'kick' && !atk.wm && (!(atk.def.mv && MV[atk.def.mv]) || (this.weapon === 'whip' && !MV[atk.def.mv].spin))) { if (atk.up) { g.save(); g.translate(this.cx, this.cy); g.rotate(-this.face * Math.PI / 2); g.translate(-this.cx, -this.cy); } this.drawSmear(g, atk); if (atk.up) g.restore(); }
    if (this.weapon === 'bow') BW.draw(g, this, W, pose && pose.hand); if (atk && atk.wm) WH.draw(g, this, atk, pose && pose.hand, (W.game && W.game.lowPerf) || save.settings.quality === 'low'); // v2.4 the lash itself
    if (atk && atk.kind === 'plunge' && atk.phase === 'active') { // v1.9: falling-star streaks + a glowing blade tip instead of a flat wedge
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; for (let i = 0; i < 5; i++) { const ox = (i - 2) * 5 + Math.sin(t * 50 + i * 2) * 1.5, L = 26 + ((i * 37 + Math.floor(t * 60) * 13) % 22); g.globalAlpha = 0.25 + 0.12 * (i % 2); g.strokeStyle = i === 2 ? '#fff6d8' : '#bff7ff'; g.lineWidth = i === 2 ? 3 : 1.6; g.beginPath(); g.moveTo(X + ox, this.y - L + 6); g.lineTo(X + ox, this.y + this.h - 4); g.stroke(); }
      g.globalAlpha = 0.85; drawGlow(g, X + this.face * 2, this.y + this.h + 10, 12, '#fff6d8', 0.8); g.restore(); g.globalAlpha = 1; }
  }

  // ---- v1.3 painted frame-by-frame hero ----
  // v1.4.1 locomotion (render-only): the gait phase advances by distance travelled / cycle length, so planted feet never slide.
  // walk <-> run switches with hysteresis and keeps the phase (both cycles plant the near foot at phase 0), start/stop/turn frames bracket it.
  gaitStep(W, dt) {
    const g = this.gait || (this.gait = { ph: 0, mode: 'walk', start: 0, stop: 0, turn: 0, face: this.face, moving: false });
    const v = Math.abs(this.vx), cyc = G.hero && G.hero.gait;
    g.start = Math.max(0, g.start - dt); g.stop = Math.max(0, g.stop - dt); g.turn = Math.max(0, g.turn - dt);
    if (!this.onGround) { g.moving = false; g.start = g.stop = g.turn = 0; g.face = this.face; return; }
    if (g.face !== this.face) { g.turn = GAIT.TURN_T; g.start = 0; g.stop = 0; g.face = this.face; }
    if (g.mode === 'walk' && v > GAIT.RUN_UP) g.mode = 'run'; else if (g.mode === 'run' && v < GAIT.RUN_DN) g.mode = 'walk';
    const pushing = Math.abs(input.mx) > 0.05 && Math.sign(input.mx) === Math.sign(this.vx || input.mx);
    const moving = v > GAIT.MOVE;
    if (moving && !g.moving && g.turn <= 0) { g.start = GAIT.START_T; g.ph = 0; }
    if (!pushing && g.moving && v > GAIT.RUN_DN && g.turn <= 0) g.stop = GAIT.STOP_T;
    if (pushing) g.stop = 0;
    g.moving = moving;
    if (moving && cyc) {
      const D = (cyc[g.mode] ? cyc[g.mode].cycle_px : 120) * HERO_PX * (W.heroK || HERO_K), p0 = g.ph;
      g.ph = (g.ph + v * dt / D) % 1;
      // footfalls at phase 0 (near foot) and 0.5 (far foot): step sound + dust on the beat
      if (g.start <= 0 && g.stop <= 0 && ((p0 < 0.5 && g.ph >= 0.5) || g.ph < p0)) { sfx('step'); if (v > GAIT.RUN_UP) W.fx.dust(this.cx - sign(this.vx) * 4, this.y + this.h, 2, { dir: -sign(this.vx), speed: 40, size: 3.2, life: 0.4 }); }
    }
  }
  heroPose(W) {
    const t = this.t, h = this.hook, atk = this.atk, wpn = this.weapon, air = !this.onGround;
    const run = this.onGround && Math.abs(this.vx) > 20, dash = this.dashT > 0;
    const wall = air && this.wallDir && this.vy > 0 && Math.sign(input.mx) === this.wallDir;
    let n = 'idle0', wa = null, rot = 0, face = this.face, shake = 0, pivC = false, noW = false;
    const sweep = (a0, a1) => { const d = atk.def || {}; const k = atk.phase === 'wind' ? 0 : atk.phase === 'active' ? Math.min(1, atk.t / Math.max(0.01, d.active || 0.1)) : 1; const e = 1 - (1 - k) * (1 - k); return a0 + (a1 - a0) * e; };
    if (this.dead) n = this.deadT < 0.28 ? 'hurt' : 'dead';
    else if (this.hurtT > 0) n = 'hurt';
    else if (wpn === 'bow' && (this.bowS || this.bowRel > 0) && G.hero.f.c_bow_nock) { const bs = this.bowS; n = !bs ? 'c_bow_rel' : bs.k > 0.05 ? 'c_bow_draw' : 'c_bow_nock'; noW = true;
      const A = bs ? (bs.ang !== undefined ? bs.ang : 0) : this.bowAng || 0, fa = Math.cos(A) < -0.01 ? -1 : Math.cos(A) > 0.01 ? 1 : this.face; face = fa; const loc = fa > 0 ? A : Math.PI - A; rot = Math.max(-0.5, Math.min(0.5, loc * 0.35)) * fa;
      if (h.s === 'swing') rot += Math.atan2(h.hx - this.cx, -(h.hy - this.cy)) * 0.4; if (!bs) shake = 0; }
    else if (h.s === 'swing' && !(atk && this.combatPose(atk, wpn))) { // v2.4: lean with the rope; legs trail on the down-swing, lead on the up-swing; hang when slow
      const dx = this.cx - h.hx, sp = Math.hypot(this.vx, this.vy); rot = Math.atan2(h.hx - this.cx, -(h.hy - this.cy)) * 0.85; n = 'swing';
      if (G.hero.f.c_swing_m) n = sp < 130 ? 'c_swing_m' : Math.sign(dx) === Math.sign(this.vx) && Math.abs(dx) > 10 ? 'c_swing_f' : 'c_swing_b'; }
    else if (h.s === 'swing') { const cp = this._cp; n = cp.n; wa = cp.wa; face = cp.face; rot = cp.rot || Math.atan2(h.hx - this.cx, -(h.hy - this.cy)) * 0.4; }
    else if (this.flipT > 0 && air && !atk && h.s === 'none' && G.hero.f.c_tuck) { const k = 1 - this.flipT / (this.flipDur || 0.34), e = k * k * (3 - 2 * k); n = e > 0.85 ? 'jump' : 'c_tuck'; rot = this.flipDir * Math.PI * 2 * e; pivC = true; } // v2.4 release flip
    else if (h.s !== 'none') n = 'throw';
    else if (atk && this.combatPose(atk, wpn)) { const cp = this._cp; n = cp.n; wa = cp.wa; face = cp.face; rot = cp.rot; }
    else if (atk) {
      const st = atk.step || 0, ph = atk.phase;
      if (atk.kind === 'plunge') { n = 'slam'; wa = 1.45; }
      else if (wpn === 'bow') { n = 'thrust'; wa = -0.08; }
      else if (atk.kind === 'air') { n = ph === 'wind' ? 'apex' : 'airatk'; wa = ph === 'wind' ? -2.0 : sweep(-1.6, 0.9); if (n === 'apex') wa = null; }
      else if (atk.kind === 'heavy' || (wpn === 'hammer' && st % 2 === 0)) { n = ph === 'wind' ? 'hwind' : 'slam'; wa = ph === 'wind' ? -1.9 : sweep(-1.4, 1.25); }
      else if (wpn === 'hammer' || st % 3 === 1) { n = ph === 'wind' ? 'slash1' : 'slash2'; wa = ph === 'wind' ? 0.9 : sweep(1.0, -1.45); }
      else if (st % 3 === 2) { n = ph === 'wind' ? 'land' : 'thrust'; wa = ph === 'wind' ? null : -0.06; }
      else { n = ph === 'wind' ? 'hwind' : 'slash1'; wa = ph === 'wind' ? -2.1 : sweep(-1.6, 0.85); }
    }
    else if (this.chargeT > 0.2 && wpn !== 'bow' && G.hero.f.c_charge) { n = this.charged2 ? 'c_bloom' : 'c_charge'; wa = this.charged2 ? -1.6 : 2.5; shake = this.charged ? 1.2 : 0.5; }
    else if (this.chargeT > 0.2) { if (wpn === 'bow') { n = 'thrust'; wa = -0.08; } else { n = 'hwind'; wa = -2.0; shake = this.charged ? 1.2 : 0.5; } }
    else if (this.parryLock > 0) { n = 'parry'; wa = -1.5; }
    else if (dash) n = 'dash';
    else if (wall) { n = 'wall'; face = this.wallDir; }
    else if (air) n = this.vy < -160 ? 'jump' : this.vy < 160 ? 'apex' : 'fall';
    else if ((this.sy < 0.86 && this.sx > 1.1) || this.mantleT > 0) n = 'land';
    else if (this.gait && this.gait.turn > 0) n = 'turn0';
    else if (this.gait && this.gait.stop > 0) n = this.gait.stop > GAIT.STOP_T * 0.45 ? 'stop0' : 'stop1';
    else if (this.gait && this.gait.start > 0 && G.hero.f.start0) n = this.gait.start > GAIT.START_T * 0.5 ? 'start0' : 'start1';
    else if (this.gait && this.gait.moving && G.hero.f.walk0) { const m = this.gait.mode, N = (G.hero.gait && G.hero.gait[m] && G.hero.gait[m].frames) || 12; n = m + (Math.floor(this.gait.ph * N + 0.5) % N); }
    else if (run) n = 'run' + (((Math.floor(this.runPh / (Math.PI * 2) * 8) % 8) + 8) % 8);
    else if (G.hero.f.start0 && Math.abs(input.mx) > 0.05) n = 'start0'; // pushing off but not moving yet (e.g. right after a standing turn): lean in, no idle flicker
    else n = (t % 2.6) > 1.9 ? 'idle1' : 'idle0';
    if (this.dead) rot = 0;
    const F = G.hero.f[n] || G.hero.f.idle0, K = HERO_PX * (W.heroK || HERO_K), pvx = F.length > 6 ? F[6] : F[4] - 22; let X = this.cx, Y = this.y + this.h; if (pivC) { X -= Math.sin(rot) * 20; Y += -20 + Math.cos(rot) * 20; } // flip spins about the body centre
    const sx = (1 + (this.sx - 1) * 0.45) * face, sy = 1 + (this.sy - 1) * 0.45 + (n.startsWith('idle') ? Math.sin(t * 2.4) * 0.012 : 0);
    const pose = { n, F, K, pvx, pvy: F.length > 7 ? F[7] : F[3], X, Y, sx, sy, rot, face, wa, shake: shake ? Math.sin(t * 50) * shake : 0, hand: null, noW };
    const fi = this.fist(n); if (fi) pose.hand = this.framePt(pose, fi[0], fi[1]);
    return pose;
  }
  fist(n) { return FIST[n] || (G.hero && G.hero.hand && G.hero.hand[n]) || null; }
  combatPose(atk, wpn) { // v1.9: anticipation -> strike (smear) -> follow-through frames from the rig, blade angle keyed per move
    if (wpn === 'bow') return false;
    const key = atk.kind === 'special' ? 'bloom' : atk.kind === 'plunge' ? 'plunge' : atk.def && atk.def.mv; const mv = MV[key]; if (!mv || !G.hero.f[mv.a]) return false;
    const d = atk.def || {}, ph = atk.phase, k = ph === 'active' ? Math.min(1, atk.t / Math.max(0.01, d.active || 0.1)) : ph === 'rec' ? 1 : 0;
    let n = ph === 'wind' ? mv.a : ph === 'active' ? (k < 0.5 ? mv.s : mv.f) : mv.f, face = this.face, rot = 0, wa = null;
    if (key === 'plunge') n = ph === 'rec' ? mv.f : mv.s;
    if (mv.w) { const w = mv.w, e = 1 - (1 - k) * (1 - k); wa = ph === 'wind' ? w[0] : ph === 'active' ? w[1] + (w[2] - w[1]) * e : w[3]; }
    if (atk.wm) wa = WH.handleAt(atk);
    if (mv.spin && ph === 'active') { const turns = d.ticks > 2 ? d.ticks * 0.6 : 1, a = k * turns * Math.PI * 2; face = Math.cos(a) >= 0 ? this.face : -this.face; wa = (mv.w ? mv.w[0] : 0) + a * 1.0; }
    if (key === 'dash' || key === 'counter') rot = clamp(this.vx / 2400, -0.12, 0.12);
    if (key === 'kick' && this.hook.s === 'swing') rot = Math.atan2(this.hook.hx - this.cx, -(this.hook.hy - this.cy)) * 0.5;
    if (!G.hero.f[n]) n = mv.a;
    this._cp = { n, wa, face, rot }; return true;
  }
  framePt(p, fx, fy) { // frame pixel -> world point
    const lx = (fx - p.pvx) * p.K * p.sx, ly = (fy - p.pvy) * p.K * p.sy, c = Math.cos(p.rot), s = Math.sin(p.rot);
    return [p.X + p.shake + lx * c - ly * s, p.Y + lx * s + ly * c];
  }
  drawFrames(g, W, p) {
    const H = G.hero, F = p.F, lo = (W.game && W.game.lowPerf) || save.settings.quality === 'low';
    if (!lo) drawGlow(g, p.X, this.cy - 8, 36, '#0a0814', 0.4);
    const blink = this.iframes > 0 && !this.dead && this.flash <= 0 && Math.sin(this.t * 38) > 0;
    const atk = this.atk; if (!lo && atk && atk.phase === 'active' && atk.kind !== 'special' && !this.dead) { // v2.0 style afterimages: tinted ghosts trailing the swing
      const pal = palOf(this.weapon); g.save(); g.globalCompositeOperation = 'lighter';
      for (const [d, al] of [[16, 0.3], [32, 0.14]]) { g.save(); g.globalAlpha = al; g.translate(p.X - this.face * d, p.Y); g.rotate(p.rot); g.scale(p.sx * p.K, p.sy * p.K); g.translate(-p.pvx, -p.pvy); g.drawImage(heroTint(p.n, pal[0]), 0, 0); g.restore(); }
      g.restore();
    }
    g.save(); g.translate(p.X + p.shake, p.Y); g.rotate(p.rot); g.scale(p.sx * p.K, p.sy * p.K); g.translate(-p.pvx, -p.pvy);
    if (blink) g.globalAlpha = 0.5;
    const fi = this.fist(p.n);
    if (!p.noW && (p.wa === null || !fi)) this.frameWeapon(g, p, F[4] - 30, F[5] + 6, this.weapon === 'bow' ? 1.75 : 1.95, 0.95, 0.72); // sheathed across the back
    const wr = missions().wardrobe; g.drawImage(capeSheet(H, wr.cape) || H.img, F[0], F[1], F[2], F[3], 0, 0, F[2], F[3]);
    if (wr.hat && wr.hat !== 'none' && !this.dead) { const hm = p.n.startsWith('c_') && G.hero.hand && G.hero.hand[p.n]; const hr = (hm && hm[3] ? hm[3] * 0.012 : 0) + (this.hatA || 0) * 0.5 * (this.face || 1); if (hr) { g.save(); g.translate(F[4], F[5] - 30); g.rotate(hr); g.translate(-F[4], -(F[5] - 30)); } drawHat(g, wr.hat, F[4] - 12, F[5] - 47, 4.4, 1); if (hr) g.restore(); } // v1.8 hat rides the hood; v2.1 hat spring (secondary motion)
    if (p.wa !== null && fi) this.frameWeapon(g, p, fi[0], fi[1], p.wa, 1);
    if (this.flash > 0) { g.globalAlpha = Math.min(0.85, this.flash * 3 + 0.2); g.drawImage(heroFlash(p.n), 0, 0); }
    g.restore(); g.globalAlpha = 1;
  }
  frameWeapon(g, p, x, y, a, k, len = 1) {
    const w = this.weapon, n = 'w_' + w; if (!has(n)) return; const u = len / HERO_PX; // world units -> frame px
    g.save(); g.translate(x, y); g.rotate(a); if (k !== 1) g.globalAlpha *= k;
    if (w === 'bow') { spr(g, n, 0, 0, 24 * u, 0.35, 0.5); if (this.chargeT > 0.2) { g.strokeStyle = '#eaffc0'; g.lineWidth = 1 * u; g.beginPath(); g.moveTo(-2 * u, -10 * u); g.lineTo(-7 * u, 0); g.lineTo(-2 * u, 10 * u); g.stroke(); } }
    else { const L = (w === 'whip' ? 20 : 27) * u; spr(g, n, 0, 0, L / sprAspect(n), w === 'whip' ? 0.05 : 0.08, 0.5); }
    g.restore();
  }
  drawVine(g, x0, y0, h, t) { // v2.4: tapered vine (thick at the anchor, thin at the hand) that lands slack, then snaps taut with a decaying twang
    const wob = h.s === 'fly' || h.s === 'miss' ? 6 : 0, L = Math.hypot(h.hx - x0, h.hy - y0) || 1, dx = (h.hx - x0) / L, dy = (h.hy - y0) / L;
    const ht = h.t || 0, sp = Math.hypot(this.vx, this.vy), sw = h.s === 'swing';
    const slack = sw ? Math.min(16, L * 0.1) * Math.exp(-ht * 11) + (h.taut === false ? 8 : 0) : 0; // lands loose, pulls straight in ~0.2 s
    const twang = sw && ht < 0.7 ? Math.exp(-ht * 6) * Math.sin(ht * 46) * Math.min(7, L * 0.06) : 0;
    const sag = wob ? Math.sin(t * 40) * wob : (sw ? Math.max(0.15, 1 - sp / 380) * Math.min(6, L * 0.02) : Math.min(10, L * 0.03)) + slack;
    const n = Math.max(8, Math.min(28, Math.floor(L / 6))), P = [];
    for (let i = 0; i <= n; i++) { const k = i / n, bend = Math.sin(Math.PI * k), o = twang * bend + (wob ? Math.sin(k * 9 + t * 30) * wob * bend : 0); P.push([x0 + dx * L * k - dy * o, y0 + dy * L * k + dx * o + sag * bend]); }
    const VC = vineColors(); let gr = null; if (VC.rainbow) { gr = g.createLinearGradient(x0, y0, h.hx, h.hy); for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, `hsl(${(i * 55 + t * 120) % 360},85%,58%)`); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < n; i++) { const k = (i + 0.5) / n, wd = 2.2 + 2.6 * k; g.strokeStyle = PAL.ink; g.lineWidth = wd + 1.8; g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.lineTo(P[i + 1][0], P[i + 1][1]); g.stroke(); }
    for (let i = 0; i < n; i++) { const k = (i + 0.5) / n, wd = 2.2 + 2.6 * k; g.strokeStyle = gr || VC.dark; g.lineWidth = wd; g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.lineTo(P[i + 1][0], P[i + 1][1]); g.stroke(); }
    g.strokeStyle = VC.light; g.lineWidth = 1.1; g.beginPath(); // twisting highlight strand
    for (let i = 0; i <= n; i++) { const k = i / n, o = Math.sin(k * L * 0.35 + t * 6) * (0.6 + 0.9 * k); i ? g.lineTo(P[i][0] - dy * o, P[i][1] + dx * o) : g.moveTo(P[i][0] - dy * o, P[i][1] + dx * o); } g.stroke();
    if (has('leaf')) for (let i = 2; i < n; i += 3) { const [px, py] = P[i], side = (i % 2 ? 1 : -1); g.save(); g.translate(px, py); g.rotate(Math.atan2(dy, dx) + side * 1.1 + Math.sin(t * 5 + i) * 0.2 + side * Math.min(0.5, sp / 900)); spr(g, 'leaf', 0, 0, 5 + 2 * i / n, 0.1, 0.9); g.restore(); }
    if (sw) { g.fillStyle = VC.dark; g.strokeStyle = PAL.ink; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x0, y0, 3.6, 3, Math.atan2(dy, dx), 0, 7); g.fill(); g.stroke(); } // wrapped grip at the hand
  }
  drawRig(g, W) {
    const HK = W.heroK || HERO_K, rs = (W.rs || 3) * HK, U = 110, Sz = Math.ceil(U * rs); const t = this.t, f = this.face, X = this.cx, Y = this.y + this.h, h = this.hook;
    if (!this._off || this._off.width !== Sz) { const mk = () => { const c = document.createElement('canvas'); c.width = c.height = Sz; return c; }; this._off = mk(); this._tmp = mk(); }
    const off = this._off, o = off.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, Sz, Sz); o.globalCompositeOperation = 'source-over';
    o.setTransform(rs, 0, 0, rs, U / 2 * rs, U * 0.68 * rs);
    let lean = this.leanS || 0; if (h.s === 'swing') lean = Math.atan2(h.hx - X, -(h.hy - this.cy)) * 0.6;
    if (this.hurtT > 0) lean = -f * 0.25;
    if (this.dead) { lean = 0; o.rotate(Math.min(1.4, this.deadT * 4) * -f); }
    o.rotate(lean); o.scale(this.sx * f, this.sy);
    const run = this.onGround && Math.abs(this.vx) > 20, ph = this.runPh, air = !this.onGround, dash = this.dashT > 0;
    const wall = air && this.wallDir && this.vy > 0 && Math.sign(input.mx) === this.wallDir;
    const bob = run ? -Math.abs(Math.sin(ph)) * 2.4 + 0.6 : air ? 0 : Math.sin(t * 2.4) * 0.6;
    // leg angles (front, back)
    let la = 0, lb = 0;
    if (run) { la = Math.sin(ph) * 0.8; lb = -la; } else if (dash) { la = 0.9; lb = -0.7; } else if (wall) { la = 0.5; lb = 0.2; } else if (air) { if (this.vy < 0) { la = 0.6; lb = -0.25; } else { la = 0.15; lb = -0.35 + Math.sin(t * 12) * 0.1; } }
    if (run) { la = Math.sin(ph) * 0.85; lb = -la; }
    // foot lift on the forward swing (reads as a knee bend), tucked legs when rising
    const liftA = run ? Math.max(0, Math.cos(ph)) * 1.8 : air && this.vy < 0 ? 1.6 : 0, liftB = run ? Math.max(0, -Math.cos(ph)) * 1.8 : air && this.vy < 0 ? 1.2 : 0;
    const leg = (n, x, a, dark, lift) => { o.save(); o.translate(x, -11 - lift); o.rotate(-a); o.scale(1, 1 - lift * 0.05); spr(o, n, 0, -1, 12, 0.5, 0, false, dark ? shaded(n, 0.7) : undefined); o.restore(); };
    // back arm (behind the body, counter-swings the front arm)
    let B = 0.35 + Math.sin(t * 2.4 + 1) * 0.05;
    if (run) B = -Math.sin(ph) * 0.65 + 0.15; else if (dash) B = 1.4; else if (wall) B = -2.2; else if (air) B = this.vy < 0 ? 2.3 : 1.5 + Math.sin(t * 10) * 0.15;
    if (this.hurtT > 0) B = 2.4; if (h.s !== 'none') B = 0.7; if (this.dead) B = 1.2;
    o.save(); o.translate(-1.5, -17 + bob); o.rotate(B); spr(o, 'arm', 0, -1.5, 11.5, 0.5, 0, false, shaded('arm', 0.6)); o.restore();
    leg('leg2', -2.5, lb, true, liftB); leg('leg', 2.5, la, false, liftA);
    o.translate(0, bob);
    // torso with cloak sway
    const sway = clamp(-this.vx / 300, -1, 1) * 0.08 + Math.sin(t * 3) * 0.02;
    o.save(); o.translate(0, -7.5); o.rotate(sway * 0.5); spr(o, 'torso', 0, 0, 13, 0.5, 1); o.restore();
    // head (with hood, sprout and scarf knot)
    o.save(); o.translate(0.5, -17.5 + (run ? Math.abs(Math.sin(ph + 0.4)) * 0.5 : 0)); o.rotate(Math.sin(t * 2.2) * 0.03 - clamp(this.vx / 2500, -0.08, 0.08) + (dash ? 0.1 : 0) + (this.hurtT > 0 ? -0.15 : 0));
    if (has('hood')) this.drawHead(o, t, f); else spr(o, 'head', 0, 0, 22, 0.5, 0.86);
    o.restore();
    // arm + weapon
    const atk = this.atk; let A = -0.75 + (run ? Math.sin(ph) * 0.5 : Math.sin(t * 2.4) * 0.05);
    if (atk) {
      const d = atk.def || {}, alt = atk.step % 2 === 1;
      if (atk.kind === 'plunge') A = 0.05;
      else if (this.weapon === 'bow') A = atk.phase === 'wind' ? -1.4 : -1.57;
      else if (d.thrust) A = atk.phase === 'wind' ? -1.2 : atk.phase === 'active' ? -1.57 : -1.35;
      else if (atk.phase === 'wind') A = alt ? -2.5 : 2.4;
      else if (atk.phase === 'active') { const k = Math.min(1, atk.t / Math.max(0.01, d.active || 0.1)); A = alt ? -2.5 + k * 1.9 : 2.0 - k * 3.7; }
      else A = alt ? -0.5 : -1.5;
    }
    if (this.chargeT > 0.2) A = (this.weapon === 'bow' ? -1.5 : 2.6) + Math.sin(t * 40) * 0.05;
    if (this.parryLock > 0) A = -2.1;
    if (dash) A = 1.1; if (wall && !atk) A = -2.7;
    if (h.s !== 'none') A = Math.atan2(-(h.hx - X) * f, h.hy - (this.y + 16));
    o.save(); o.translate(2.5, -17.5); o.rotate(A); this.drawPaintedWeapon(o); spr(o, 'arm', 0, -1.5, 12, 0.5, 0); o.restore();
    // ---- composite: rim light, hurt flash, ink outline ----
    const lo = (W.game && W.game.lowPerf) || save.settings.quality === 'low'; const tmp = this._tmp, q = tmp.getContext('2d'); const px = Math.max(1, Math.round(rs * 0.7));
    o.setTransform(1, 0, 0, 1, 0, 0);
    if (!lo) { q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, Sz, Sz); q.drawImage(off, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = W.biome.key === 'boss' ? '#ffb070' : '#ffe0a0'; q.fillRect(0, 0, Sz, Sz);
      q.globalCompositeOperation = 'destination-out'; q.drawImage(off, -px * 2, px * 1.5); o.globalCompositeOperation = 'source-atop'; o.globalAlpha = 0.75; o.drawImage(tmp, 0, 0); o.globalAlpha = 1; }
    if (this.flash > 0) { o.globalCompositeOperation = 'source-atop'; o.globalAlpha = Math.min(0.85, this.flash * 3 + 0.2); o.fillStyle = '#fff'; o.fillRect(0, 0, Sz, Sz); o.globalAlpha = 1; }
    o.globalCompositeOperation = 'source-over';
    q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, Sz, Sz); q.drawImage(off, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = PAL.ink; q.fillRect(0, 0, Sz, Sz); q.globalCompositeOperation = 'source-over';
    const x0 = X - U / 2, y0 = Y - U * 0.68, e = px / rs * 1.2;
    if (this.iframes > 0 && !this.dead && this.flash <= 0 && Math.sin(t * 38) > 0) g.globalAlpha = 0.5;
    if (!lo) drawGlow(g, X, this.cy - 8, 36, '#0a0814', 0.4); // dark backing halo so the hero always separates
    g.save(); g.translate(X, Y); g.scale(HK, HK); g.translate(-X, -Y);
    if (!lo) { // v1.7 hero pop: a thin warm light halo outside the ink outline so Sprig never melts into the forest
      const t2 = this._tmp2 || (this._tmp2 = document.createElement('canvas')); if (t2.width !== Sz) { t2.width = Sz; t2.height = Sz; }
      const q2 = t2.getContext('2d'); q2.globalCompositeOperation = 'source-over'; q2.clearRect(0, 0, Sz, Sz); q2.drawImage(off, 0, 0); q2.globalCompositeOperation = 'source-in';
      q2.fillStyle = W.biome.key === 'caverns' ? '#c8f4ff' : W.biome.key === 'boss' ? '#ffd0a0' : '#fff2c8'; q2.fillRect(0, 0, Sz, Sz); q2.globalCompositeOperation = 'source-over';
      const e2 = e * 2.3; g.globalAlpha *= 0.55; for (const [dx, dy] of [[-e2, 0], [e2, 0], [0, -e2], [0, e2], [-e2 * 0.7, -e2 * 0.7], [e2 * 0.7, -e2 * 0.7]]) g.drawImage(t2, x0 + dx, y0 + dy, U, U); g.globalAlpha /= 0.55; }
    for (const [dx, dy] of [[-e, 0], [e, 0], [0, -e], [0, e]]) g.drawImage(tmp, x0 + dx, y0 + dy, U, U);
    g.drawImage(off, x0, y0, U, U); g.restore();
    g.globalAlpha = 1; void G;
  }
  drawHead(o, t, f) { // v1.2: hood + spring-driven leaf sprout + expressive eyes (head art is mirrored so the face looks forward)
    const dt = clamp(t - (this._lt ?? t), 0, 0.05); this._lt = t;
    const want = clamp(-this.vx / 420, -0.7, 0.7) * f + clamp(this.vy / 1400, -0.3, 0.4) * 0 + Math.sin(t * 2.6) * 0.06;
    this._spV = (this._spV || 0) + ((want - (this._spA || 0)) * 140 - (this._spV || 0) * 8) * dt; this._spA = (this._spA || 0) + this._spV * dt;
    if (this.sy < 0.8 && !this._kick) { this._spV += 6; this._kick = true; } else if (this.sy > 0.95) this._kick = false;
    o.scale(-1, 1);
    const hh = G.meta.spr.head[3], sh = G.meta.spr.sprout[3];
    o.save(); o.translate(-0.6, -14.3); o.rotate(-this._spA); spr(o, 'sprout', 0, 0, 22 * sh / hh, 0.47, 0.95); o.restore();
    spr(o, 'hood', 0, 0, 22, 0.5, 0.86);
    // eyes (sprite-space centres measured from the painted head)
    const E = [[-6.6, -5.85], [-2.6, -5.8]]; o.fillStyle = '#1a1a14';
    for (const [ex, ey] of E) { o.beginPath(); o.ellipse(ex, ey, 1.35, 1.75, 0, 0, 7); o.fill(); }
    const blink = (t % 3.3) < 0.12, mood = this.dead ? 'dead' : this.hurtT > 0 ? 'hurt' : (this.atk || this.chargeT > 0.2 || this.parryLock > 0) ? 'angry' : (this.dashT > 0 || this.hook.s === 'swing') ? 'focus' : blink ? 'blink' : 'open';
    o.fillStyle = '#f4f8e8'; o.strokeStyle = '#f4f8e8'; o.lineWidth = 0.55; o.lineCap = 'round';
    for (let i = 0; i < 2; i++) { const [ex, ey] = E[i], inner = i === 0 ? 1 : -1; // inner = towards the other eye
      if (mood === 'dead') { o.beginPath(); o.moveTo(ex - 0.8, ey - 0.8); o.lineTo(ex + 0.8, ey + 0.8); o.moveTo(ex + 0.8, ey - 0.8); o.lineTo(ex - 0.8, ey + 0.8); o.stroke(); }
      else if (mood === 'hurt') { o.beginPath(); o.moveTo(ex - 0.7 * inner, ey - 0.8); o.lineTo(ex + 0.6 * inner, ey); o.lineTo(ex - 0.7 * inner, ey + 0.8); o.stroke(); }
      else if (mood === 'blink') { o.fillRect(ex - 0.75, ey + 0.1, 1.5, 0.45); }
      else { const hgt = mood === 'focus' ? 0.75 : mood === 'angry' ? 1.05 : 1.45; o.beginPath(); o.ellipse(ex, ey + (1.45 - hgt) * 0.5, 0.62, hgt, 0, 0, 7); o.fill();
        if (mood === 'angry') { o.fillStyle = '#1a1a14'; o.beginPath(); o.moveTo(ex - 1.2, ey - 1.9 + (inner > 0 ? -0.4 : 1.0)); o.lineTo(ex + 1.2, ey - 1.9 + (inner > 0 ? 1.0 : -0.4)); o.lineTo(ex + 1.2, ey - 2.6); o.lineTo(ex - 1.2, ey - 2.6); o.fill(); o.fillStyle = '#f4f8e8'; }
        o.fillStyle = '#ffffff'; o.fillRect(ex - 0.35, ey - 0.75, 0.35, 0.35); o.fillStyle = '#f4f8e8'; }
    }
  }
  drawPaintedWeapon(o) {
    const w = this.weapon; o.save(); o.translate(0, 10.5);
    if (w === 'bow') { o.rotate(Math.PI / 2); spr(o, 'w_bow', 0, 0, 22, 0.35, 0.5); if (this.chargeT > 0.2) { o.strokeStyle = '#eaffc0'; o.lineWidth = 1; o.beginPath(); o.moveTo(-2, -9); o.lineTo(-6, 0); o.lineTo(-2, 9); o.stroke(); } }
    else { o.rotate(Math.PI / 2); const L = w === 'blade' ? 25 : w === 'hammer' ? 25 : w === 'spear' ? 36 : 18, n = 'w_' + w; spr(o, n, 0, 0, L / sprAspect(n), w === 'whip' ? 0.05 : 0.08, 0.5); }
    o.restore();
  }
  drawWeapon(g, atk) {
    g.save(); g.translate(0, 10);
    const w = this.weapon; g.strokeStyle = PAL.ink; g.lineWidth = 1.8;
    if (w === 'blade') { g.fillStyle = '#d8e6f0'; g.beginPath(); g.moveTo(-2.5, 0); g.lineTo(2.5, 0); g.lineTo(2, 22); g.lineTo(0, 26); g.lineTo(-2, 22); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#b8783a'; g.fillRect(-5, -1, 10, 3); }
    else if (w === 'hammer') { g.fillStyle = '#8a6a4a'; g.fillRect(-1.5, 0, 3, 20); g.fillStyle = '#ffc06a'; g.beginPath(); g.roundRect(-8, 17, 16, 10, 2); g.fill(); g.stroke(); g.fillStyle = '#c48a3a'; g.beginPath(); g.arc(0, 22, 2.5, 0, 7); g.fill(); }
    else if (w === 'bow') { g.strokeStyle = '#a6e47a'; g.lineWidth = 3; g.beginPath(); g.arc(-4, 8, 13, -1.1, 1.1); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-4 + 13 * Math.cos(-1.1), 8 + 13 * Math.sin(-1.1)); g.lineTo(-4 + 13 * Math.cos(1.1) - (this.chargeT > 0.2 ? 6 : 0), 8); g.lineTo(-4 + 13 * Math.cos(1.1), 8 + 13 * Math.sin(1.1)); g.stroke(); }
    else if (w === 'whip') { g.strokeStyle = '#2e7a3f'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, 10, 0, 18); g.stroke(); g.fillStyle = '#7fe0a0'; g.beginPath(); g.arc(0, 18, 3, 0, 7); g.fill(); }
    g.restore();
  }
  drawSmear(g, atk) {
    const d = atk.def, r = this.attackRect(d, false), k = atk.t / d.active, col = WEAPONS[this.weapon].color;
    g.save(); g.globalAlpha = 0.85 * (1 - k * 0.7); if (G.ready) { g.globalCompositeOperation = 'lighter'; g.shadowColor = col; g.shadowBlur = 0; }
    if (d.thrust) { // spear: straight piercing streak
      const f = this.face, x0 = this.cx + f * 10, y0 = this.cy + (d.oy || 0) - 4, L = d.w * Math.min(1, 0.35 + k * 2);
      const gr = g.createLinearGradient(x0, y0, x0 + f * L, y0); gr.addColorStop(0, 'rgba(127,246,255,0)'); gr.addColorStop(1, col);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x0, y0 - d.h * 0.25); g.lineTo(x0 + f * L, y0); g.lineTo(x0, y0 + d.h * 0.25); g.closePath(); g.fill();
      g.fillStyle = '#eaffff'; g.beginPath(); g.arc(x0 + f * L, y0, 3, 0, 7); g.fill();
    } else if (d.arc === 5 || (this.weapon === 'whip' && !d.both)) { // whip: long wavy lash
      g.strokeStyle = '#7fe0a0'; g.lineWidth = 4; g.beginPath(); const x0 = this.cx, y0 = this.cy - 6; g.moveTo(x0, y0);
      const L = d.w * Math.min(1, k * 2.5), dir = this.face; g.bezierCurveTo(x0 + dir * L * 0.3, y0 - 18, x0 + dir * L * 0.7, y0 + 14, x0 + dir * L, y0 + (d.oy || 0)); g.stroke();
      g.fillStyle = '#eaffc0'; g.beginPath(); g.arc(x0 + dir * L, y0 + (d.oy || 0), 4, 0, 7); g.fill();
    } else if (d.both) { g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.ellipse(this.cx, r.y + r.h / 2, r.w / 2 * (0.5 + k * 0.5), r.h / 2, 0, 0, 7); g.stroke(); }
    else {
      const cx = this.cx, cy = this.cy + (d.oy || 0), R = d.w * 0.9, f = this.face, dir = (atk.step % 2 === 0) ? 1 : -1;
      const a0 = -1.3 * dir, a1 = 1.2 * dir; const s = a0 + (a1 - a0) * Math.min(1, k * 1.6);
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i <= 10; i++) { const a = a0 + (s - a0) * i / 10; g.lineTo(cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * 0.75); }
      for (let i = 10; i >= 0; i--) { const a = a0 + (s - a0) * i / 10; const rr = R * (0.55 + 0.25 * (i / 10)); g.lineTo(cx + Math.cos(a) * rr * f, cy + Math.sin(a) * rr * 0.75); }
      g.closePath(); g.fill();
      g.globalAlpha *= 0.6; g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i <= 10; i++) { const a = a0 + (s - a0) * i / 10; g.lineTo(cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * 0.75); } for (let i = 10; i >= 0; i--) { const a = a0 + (s - a0) * i / 10; g.lineTo(cx + Math.cos(a) * R * 0.9 * f, cy + Math.sin(a) * R * 0.9 * 0.75); } g.fill();
    }
    g.restore();
  }
}
