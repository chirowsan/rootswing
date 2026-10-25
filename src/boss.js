// Mini-boss (Scrap Warden) and boss (Grumblestack, the Smog Furnace). Every attack shows a red marker first.
import { TILE, clamp, sign, approach, rand, lerp } from './util.js';
import { moveBody, groundBelow } from './physics.js';
import { PAL, drawGlow } from './art.js';
import { G, has, spr, tinted, hasE, shaded, sImg } from './gfx.js';
import { track, drawRig, wardenPose, bossPose } from './eanim.js';
import { sfx } from './audio.js';
import { diff } from './save.js';
import { ENEMY_INFO } from './enemies.js';

const INK = [[-1.2, 0], [1.2, 0], [0, -1.2], [0, 1.2]];
function paintSprite(g, n, x, y, H, flip, flash, hotK, src = null) { // ink outline + sprite + red telegraph tint + white hurt flash
  const ink = tinted(n, '#0c0a14'), rim = tinted(n, '#ff5a28'); for (const [dx, dy] of INK) spr(g, n, x + dx * 2.2, y + dy * 2.2, H, 0.5, 1, flip, ink); for (const [dx, dy] of INK) spr(g, n, x + dx * 1.1, y + dy * 1.1, H, 0.5, 1, flip, rim);
  spr(g, n, x, y, H, 0.5, 1, flip, src);
  if (hotK > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, hotK); spr(g, n, x, y, H, 0.5, 1, flip, tinted(n, '#ff3040')); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
  if (flash > 0) { g.globalAlpha = Math.min(1, flash * 14); spr(g, n, x, y, H, 0.5, 1, flip, tinted(n, '#ffffff')); g.globalAlpha = 1; }
}
class BigFoe {
  constructor(x, y, w, h, hp) { this.w = w; this.h = h; this.x = x - w / 2; this.y = y - h; this.vx = 0; this.vy = 0; this.maxHp = this.hp = hp; this.maxPoise = this.poise = Math.max(30, Math.round(hp * 0.16)); this.poiseBroke = 0; this.face = -1; this.st = 'sleep'; this.t = 0; this.cd = 1; this.stun = 0; this.flash = 0; this.dead = false; this.light = false; this.boss = true; this.anim = 0; this.tele = 0; this.sq = 1; this.onGround = false; }
  get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
  yank() {}
  go(st) { this.st = st; this.t = 0; this.tele = 0; }
  fall(W, dt) { this.vy = Math.min(this.vy + 1500 * dt, 700); const r = moveBody(W.map, this, dt); const was = this.onGround; this.onGround = r.ground || (this.vy >= 0 && !!groundBelow(W.map, this)); return { r, landed: this.onGround && !was }; }
}
export class Warden extends BigFoe {
  constructor(x, y, depth) { super(x, y, 42, 52, Math.round(230 * (1 + depth * 0.04))); this.type = 'warden'; this.info = ENEMY_INFO.warden; this.glim = 30; this.summoned = false; this.order = 0; }
  update(W, dt) {
    const P = W.player, A = diff().aggro * (this.aggroK || 1); this.t += dt; this.anim += dt; this.flash = Math.max(0, this.flash - dt); this.sq = approach(this.sq, 1, dt * 4);
    const dx = P.cx - this.cx;
    if (this.st === 'sleep') { if (Math.abs(dx) < 300 && Math.abs(P.cy - this.cy) < 200) { this.go('wake'); W.startFight(this); sfx('roar'); W.fx.shake(0.3); } this.fall(W, dt); return; }
    if (this.poiseBroke > 0) this.poiseBroke -= dt;
    if (this.stun > 0) { this.stun -= dt; this.vx *= 0.9; this.fall(W, dt); return; }
    if (this.st === 'wake') { if (this.t > 1.1) { this.go('idle'); this.cd = 0.6; } }
    else if (this.st === 'idle') { this.face = sign(dx) || 1; this.vx = Math.abs(dx) > 80 ? this.face * 60 : 0; this.cd -= dt * A;
      if (!this.summoned && this.hp < this.maxHp * 0.5) { this.summoned = true; this.go('summon'); }
      else if (this.cd <= 0) { this.order++; this.go(this.order % 2 ? 'bashTele' : 'leapTele'); this.vx = 0; sfx('telegraph'); } }
    else if (this.st === 'bashTele') { this.tele = this.t / 0.8; this.vx = -this.face * 15; if (this.t > 0.8) { this.go('bash'); sfx('dash'); } }
    else if (this.st === 'bash') { this.vx = this.face * 330; W.enemyAttack({ x: this.x - 4, y: this.y, w: this.w + 8, h: this.h }, 18, this, { parryable: true, name: this.info.name, tip: this.info.tip });
      const tx = Math.floor((this.face > 0 ? this.x + this.w + 2 : this.x - 2) / TILE);
      if (W.map.solid(tx, Math.floor((this.y + this.h - 6) / TILE)) || this.t > 0.75) { this.go('rest'); if (this.t > 0) { W.fx.shake(0.2); sfx('thump'); } } }
    else if (this.st === 'leapTele') { this.tele = this.t / 0.7; this.sq = 1 - this.tele * 0.25; if (this.t > 0.7) { const tx = clamp(P.cx, W.room.x + 50, W.room.x + W.room.w - 50); const T = 0.85; this.vx = (tx - this.cx) / T; this.vy = -1500 * T / 2; this.leapX = tx; this.go('leap'); W.addMarker({ kind: 'zone', x: tx - 50, y: this.y + this.h - 26, w: 100, h: 26, life: T }); sfx('jump'); } }
    else if (this.st === 'leap') { const f = this.fall(W, dt); if (f.landed && this.t > 0.2) { this.vx = 0; this.sq = 0.7; W.fx.shake(0.45); sfx('explode'); W.enemyAttack({ x: this.cx - 50, y: this.y + this.h - 30, w: 100, h: 30 }, 16, this, { parryable: false, name: this.info.name, tip: this.info.tip }); W.spawnWave(this.cx, this.y + this.h, -1, 230, this); W.spawnWave(this.cx, this.y + this.h, 1, 230, this); this.go('rest'); } return; }
    else if (this.st === 'rest') { this.vx = approach(this.vx, 0, 1200 * dt); if (this.t > 0.85) { this.go('idle'); this.cd = 0.9; } }
    else if (this.st === 'summon') { this.vx = 0; this.tele = Math.min(1, this.t / 0.6); if (this.t > 0.8) { for (const s of [-1, 1]) W.spawnEnemy(this.minion || 'hopper', this.cx + s * 120, this.y + this.h - 30); sfx('roar'); W.fx.shake(0.2); this.go('rest'); } }
    this.fall(W, dt);
  }
  drawPainted(g) {
    const X = this.cx, Y = this.y + this.h, t = this.anim, tele = this.tele || 0, f = this.face, hot = this.st === 'bash' || tele > 0;
    drawGlow(g, X, this.cy, 60, '#07060e', 0.4); if (hot) drawGlow(g, X + f * 20, Y - 30, 46 + tele * 16, '#ff2a3a', 0.3 + tele * 0.35);
    const typ = this.sprite || 'warden';
    if (hasE(typ + '_base')) { // v1.4 animated frames
      track(this); drawRig(g, this, typ, wardenPose(this), this.sprH || 66, hot ? 0.08 + tele * 0.17 : 0);
      if (this.flash > 0) drawGlow(g, X, this.cy, 50, '#ffffff', this.flash * 3);
      if (this.stun > 0) for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 20, this.y - 26 + Math.sin(a) * 5, 3, 0, 7); g.fill(); }
      return;
    }
    g.save(); g.translate(X + (tele > 0 ? Math.sin(t * 50) * 1.4 : 0), Y + 1); const lean = this.st === 'bash' ? 0.12 * f : this.st === 'bashTele' ? -tele * 0.1 * f : this.st === 'sleep' ? 0.05 : 0;
    g.rotate(lean); g.scale(1 / Math.sqrt(this.sq), this.sq * (this.st === 'idle' ? 1 + Math.sin(t * 2.5) * 0.02 : 1));
    paintSprite(g, this.sprite || 'warden', 0, 0, this.sprH || 66, f < 0, this.flash, hot ? 0.08 + tele * 0.17 : 0);
    g.restore();
    if (this.st !== 'sleep') drawGlow(g, X + f * 9, Y - 50, 9, tele > 0 ? '#ff4a5a' : '#ffb13b', 0.8);
    if (this.flash > 0) drawGlow(g, X, this.cy, 50, '#ffffff', this.flash * 3);
    if (this.stun > 0) for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 20, this.y - 26 + Math.sin(a) * 5, 3, 0, 7); g.fill(); }
  }
  draw(g) {
    if (has(this.sprite || 'warden')) return this.drawPainted(g);
    const X = this.cx, Y = this.y + this.h, t = this.anim, tele = this.tele;
    g.save(); g.translate(X, Y); g.scale(this.face / Math.sqrt(this.sq), this.sq); g.lineWidth = 3; g.strokeStyle = '#0c0a14'; g.lineJoin = 'round';
    for (const s of [-1, 1]) { g.fillStyle = '#3a2f45'; g.fillRect(s * 12 - 6, -12, 12, 12); }
    g.fillStyle = PAL.enemy; g.beginPath(); g.moveTo(-22, -10); g.lineTo(-24, -40); g.quadraticCurveTo(0, -50, 24, -40); g.lineTo(22, -10); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8a96a8'; g.beginPath(); g.moveTo(-22, -40); g.quadraticCurveTo(-22, -66, 0, -66); g.quadraticCurveTo(22, -66, 22, -40); g.closePath(); g.fill(); g.stroke();
    // gear crown
    g.fillStyle = '#d9a35a'; for (let i = 0; i < 5; i++) { g.fillRect(-14 + i * 6, -72 - (i % 2) * 3, 4, 7); } g.fillRect(-15, -68, 30, 4);
    g.fillStyle = '#0c0a14'; g.fillRect(-4, -52, 24, 6); g.fillStyle = tele > 0 ? '#ff4a5a' : PAL.eye; g.fillRect(4, -51, 10, 4);
    // big lid shield
    g.save(); g.translate(22, -28); g.fillStyle = '#c8d2e2'; g.beginPath(); g.ellipse(0, 0, 9, 22, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#9aa6b8'; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill(); g.restore();
    if (this.st === 'bash' || tele > 0) drawGlow(g, 24, -28, 30, '#ff4a5a', 0.5 + tele * 0.4);
    g.restore();
    if (this.flash > 0) drawGlow(g, X, this.cy, 50, '#ffffff', this.flash * 5);
    if (this.stun > 0) for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 20, this.y - 26 + Math.sin(a) * 5, 3, 0, 7); g.fill(); }
  }
}
export class Boss extends BigFoe {
  constructor(x, y) { super(x, y, 86, 124, 720); this.type = 'boss'; this.info = ENEMY_INFO.boss; this.glim = 80; this.phase = 1; this.order = 0; this.pending = []; this.beamT = 0; }
  update(W, dt) {
    const P = W.player, A = diff().aggro * (this.phase === 3 ? 1.15 : 1); this.t += dt; this.anim += dt; this.flash = Math.max(0, this.flash - dt); this.sq = approach(this.sq, 1, dt * 4);
    const dx = P.cx - this.cx; const floorY = W.room.y + W.room.h - 2 * TILE;
    // pending delayed hazards (embers, pillars)
    for (const p of this.pending) { p.t -= dt; if (p.t <= 0 && !p.done) { p.done = true; p.fire(); } } this.pending = this.pending.filter((p) => !p.done);
    if (this.st === 'sleep') { this.fall(W, dt); return; }
    if (this.st === 'dying') { this.vx = 0; if (Math.random() < dt * (10 + this.t * 10)) W.fx.pop(this.x + rand.range(0, this.w), this.y + rand.range(0, this.h), 0.8 + this.t * 0.3);
      const beats = [0.35, 0.85, 1.3, 1.7, 2.0]; this._dk = this._dk || 0; // v2.0: escalating death beats -- each one bigger, then the shatter
      if (this._dk < beats.length && this.t > beats[this._dk]) { const k = ++this._dk; this.flash = 0.07; W.fx.flash = Math.max(W.fx.flash, 0.1 + k * 0.05); W.fx.flashColor = '#fff2d0'; W.fx.shake(0.15 + k * 0.06); W.fx.ring(this.cx, this.cy, 60 + k * 30, ['#ffb13b', '#ffe27a', '#ff7ac8'][k % 3], 0.5, 4 + k); W.fx.burst(this.cx, this.cy, 10 + k * 4, { color: ['#ffd0e0', '#ff9ab0', '#ffe27a', '#fff'], kind: 'leaf', min: 80, max: 260 + k * 40, life: 1.1, g: 160 }); sfx(k < beats.length ? 'hitHeavy' : 'finisher'); }
      if (this.t > 2.2) { this.dead = true; W.fx.shatter(this._dr, 5, 1.4); W.fx.flash = Math.max(W.fx.flash, 0.5); W.fx.flashColor = '#fff6e0'; W.fx.shake(0.7); W.fx.ring(this.cx, this.cy, 260, '#ffe27a', 0.9, 10); W.fx.burst(this.cx, this.cy, 60, { color: ['#ffd0e0', '#ff9ab0', '#ffe27a', '#8ff6ff', '#fff'], kind: 'leaf', min: 120, max: 520, life: 1.8, g: 120, size: 7 }); W.hitstop && W.hitstop(0.12); W.onBossDefeated(this); } this.fall(W, dt); return; }
    if (this.poiseBroke > 0) this.poiseBroke -= dt;
    if (this.stun > 0) { this.stun -= dt; this.vx *= 0.9; this.fall(W, dt); return; }
    const want = this.hp > this.maxHp * 0.66 ? 1 : this.hp > this.maxHp * 0.33 ? 2 : 3;
    if (want > this.phase && this.st !== 'roar') { this.phase = want; this.go('roar'); this.beamT = 0; sfx('roar'); W.fx.shake(0.6); W.fx.ring(this.cx, this.cy, 160, '#ffb13b', 0.6, 8); W.onBossPhase(this.phase); const d = sign(P.cx - this.cx) || 1; P.vx = d * 260; P.vy = -200; }
    if (this.st === 'roar') { this.vx = 0; if (this.t > 1.6) { this.go('idle'); this.cd = 0.6; if (this.phase === 2) this.go('summon'); } }
    else if (this.st === 'intro') { if (this.t > 1.8) { this.go('idle'); this.cd = 0.8; } }
    else if (this.st === 'idle') {
      this.face = sign(dx) || 1; this.vx = Math.abs(dx) > 120 ? this.face * (this.phase === 3 ? 80 : 55) : 0; this.cd -= dt * A;
      if (this.cd <= 0) { this.vx = 0; const pool = this.pools ? this.pools[this.phase - 1] : this.phase === 1 ? ['slam', 'volley'] : this.phase === 2 ? ['slam', 'beam', 'volley', 'beam'] : ['pillars', 'charge', 'slam', 'volley']; const a = pool[this.order++ % pool.length]; this.attack(W, a, P, floorY); }
    }
    else if (this.st === 'slamTele') { this.tele = this.t / 0.9; if (this.t > 0.9) { this.go('slam'); this.sq = 0.75; W.fx.shake(0.55); sfx('explode'); const zx = this.face > 0 ? this.cx + 10 : this.cx - 130; W.enemyAttack({ x: zx, y: floorY - 48, w: 120, h: 48 }, 22, this, { parryable: true, name: this.info.name, tip: 'Parry the fist slam to stun the boss!' }); W.spawnWave(this.cx + this.face * 70, floorY, -1, 250, this); W.spawnWave(this.cx + this.face * 70, floorY, 1, 250, this); W.fx.burst(this.cx + this.face * 70, floorY, 20, { color: ['#ffb13b', '#7d5cff'], angle: -Math.PI / 2, spread: 1.2, max: 300, life: 0.6 }); } }
    else if (this.st === 'slam') { if (this.t > 0.8) { this.go('idle'); this.cd = 1.0; } }
    else if (this.st === 'volleyTele') { this.tele = this.t / 0.6; if (this.t > 0.6) { this.go('volley'); const n = this.phase === 3 ? 5 : 3; for (let i = 0; i < n; i++) { const tx = clamp(P.cx + (i - (n - 1) / 2) * 70 + rand.range(-15, 15), W.room.x + 40, W.room.x + W.room.w - 40); this.lobEmber(W, tx, floorY, 0.95 + i * 0.12); } sfx('enemyShoot'); } }
    else if (this.st === 'volley') { if (this.t > 1.2) { this.go('idle'); this.cd = 0.8; } }
    else if (this.st === 'beamTele') { this.tele = this.t / 1.4; if (this.t > 1.4) { this.go('beam'); sfx('explode'); W.fx.shake(0.4); } }
    else if (this.st === 'beam') { this.beamT = this.t; W.enemyAttack({ x: W.room.x, y: floorY - 50, w: W.room.w, h: 50 }, 16, this, { parryable: false, name: 'Smog Beam', tip: 'When the floor flashes red, get up high: hook a gold ring or a cyan diamond!' }); if (Math.random() < 0.8) W.fx.burst(rand.range(W.room.x, W.room.x + W.room.w), floorY - rand.range(0, 40), 1, { color: ['#ff5a7a', '#ffb13b'], g: -200, max: 60, life: 0.5, glow: 1 }); if (this.t > 1.3) { this.beamT = 0; this.go('idle'); this.cd = 1.0; } }
    else if (this.st === 'summon') { this.tele = Math.min(1, this.t / 0.6); if (this.t > 0.8) { for (const s of [-1, 1]) W.spawnEnemy(this.minion || 'moth', this.cx + s * 60, this.y - 20); this.go('idle'); this.cd = 1.2; } }
    else if (this.st === 'pillarsTele') { if (this.t > 0.2) { this.go('idle'); this.cd = 2.4; } }
    else if (this.st === 'chargeTele') { this.tele = this.t / 0.85; this.vx = -this.face * 20; if (Math.random() < 0.5) W.fx.burst(this.cx, this.y + 10, 1, { color: '#ddd', g: -150, max: 60, size: 8, life: 0.6 }); if (this.t > 0.85) { this.go('charge'); sfx('dash'); } }
    else if (this.st === 'charge') { this.vx = this.face * 380; W.enemyAttack({ x: this.x, y: this.y + 20, w: this.w, h: this.h - 20 }, 20, this, { parryable: true, name: this.info.name, tip: 'Jump over the charge, or parry it!' }); const tx = Math.floor((this.face > 0 ? this.x + this.w + 2 : this.x - 2) / TILE); if (W.map.solid(tx, Math.floor((this.y + this.h - 10) / TILE)) || this.t > 2.5) { this.vx = -this.face * 100; this.stun = 1.4; W.fx.shake(0.5); sfx('thump'); this.go('idle'); this.cd = 0.5; } }
    this.fall(W, dt);
  }
  attack(W, a, P, floorY) {
    sfx('telegraph');
    if (a === 'slam') { this.go('slamTele'); const zx = this.face > 0 ? this.cx + 10 : this.cx - 130; W.addMarker({ kind: 'zone', x: zx, y: floorY - 48, w: 120, h: 48, life: 0.9 }); }
    else if (a === 'volley') this.go('volleyTele');
    else if (a === 'beam') { this.go('beamTele'); W.addMarker({ kind: 'beam', x: W.room.x, y: floorY - 50, w: W.room.w, h: 50, life: 1.4 }); }
    else if (a === 'charge') { this.face = sign(P.cx - this.cx) || 1; this.go('chargeTele'); W.addMarker({ kind: 'zone', x: this.face > 0 ? this.cx : W.room.x, y: this.y + 20, w: this.face > 0 ? W.room.x + W.room.w - this.cx : this.cx - W.room.x, h: this.h - 20, life: 0.85 }); }
    else if (a === 'tide') { // v1.3 final boss: a wave rolls across the floor from one wall; each step is marked first
      this.go('pillarsTele'); const from = P.cx > W.room.x + W.room.w / 2 ? -1 : 1, n = 9, step = (W.room.w - 80) / n;
      for (let i = 0; i < n; i++) { const x = from > 0 ? W.room.x + 40 + i * step : W.room.x + W.room.w - 40 - (i + 1) * step; W.addMarker({ kind: 'zone', x, y: floorY - 40, w: step, h: 40, life: 0.9 + i * 0.13 });
        this.pending.push({ t: 0.9 + i * 0.13, fire: () => { W.enemyAttack({ x, y: floorY - 40, w: step, h: 40 }, 14, this, { parryable: false, name: 'Rising Tide', tip: 'The tide rolls along the red floor. Jump it or hang from a ring!' }); W.fx.burst(x + step / 2, floorY - 6, 6, { color: ['#9ff6ff', '#e8ffff'], g: 500, min: 80, max: 260, angle: -Math.PI / 2, spread: 0.7, life: 0.6, glow: 1 }); if (i % 3 === 0) sfx('explode', 0.25); } }); } }
    else if (a === 'pillars') { this.go('pillarsTele'); const xs = [P.cx]; for (let i = 0; i < 3; i++) xs.push(rand.range(W.room.x + 60, W.room.x + W.room.w - 60)); for (const x of xs) { W.addMarker({ kind: 'shadow', x: x - 22, y: floorY - 6, w: 44, h: 8, life: 1.0 }); this.pending.push({ t: 0.75, fire: () => W.dropPillar(x, W.room.y + TILE, floorY, this) }); } }
  }
  lobEmber(W, tx, floorY, T) {
    const sx = this.cx, sy = this.y + 6; const g = 900; const vx = (tx - sx) / T, vy = (floorY - 8 - sy - 0.5 * g * T * T) / T;
    W.addMarker({ kind: 'circle', x: tx, y: floorY - 2, r: 26, life: T });
    W.spawnEnemyShot(sx, sy, vx, vy, { dmg: 12, g, r: 9, ember: true, name: 'Ember', tip: 'Embers land on the red circles. Step out of them!', life: T + 0.05, burst: 30 });
  }
  drawPainted(g) {
    const X = this.cx, Y = this.y + this.h, t = this.anim, tele = this.tele || 0, ph = this.phase, f = this.face;
    const hot = ph === 3 ? '#ff5a2a' : ph === 2 ? '#ff8a2a' : '#ffb13b', H = 150;
    const glow = clamp(0.5 + Math.sin(t * 6) * 0.15 + tele * 0.5 + (this.beamT > 0 ? 0.6 : 0), 0, 1.4);
    drawGlow(g, X, Y - 70, 190, hot, 0.12 + glow * 0.1); drawGlow(g, X, Y - 60, 120, hot, 0.18 + glow * 0.18); // focal backlight + rim
    g.fillStyle = 'rgba(5,3,10,0.3)'; g.beginPath(); g.ellipse(X, Y + 2, 60, 5, 0, 0, 7); g.fill();
    if (tele > 0) drawGlow(g, X, Y - 60, 90 + tele * 30, '#ff2a3a', 0.3 + tele * 0.4);
    let armUp = this.st === 'slamTele' ? tele : 0; if (this.st === 'slam') armUp = -0.3;
    if (hasE('boss_base')) { // v1.4 animated frames; the painted a-sheet poses are armless so the rig keeps the fist arms on those
      track(this); const P = bossPose(this), armed = /^(walk|slam|base)/.test(P.fr), sl = P.fr === 'slam';
      const arm = (s, back) => { g.save(); g.scale(f, 1); g.translate(s * 37, -H * 0.66); g.rotate(s * 0.25 - armUp * 2.4 * (s > 0 ? 1 : 0.6) + Math.sin(t * 2 + s) * 0.05); paintSprite(g, 'fist', 0, 62, 64, false, this.flash, tele * 0.4, back ? shaded('fist', 0.6) : null); g.restore(); };
      drawRig(g, this, 'boss', P, H, tele * 0.35, { flip: sl ? f > 0 : f < 0, under: armed ? (gg) => arm(-1, true) : null,
        over: (gg) => { g.globalCompositeOperation = 'lighter'; g.save(); g.scale(f, 1); drawGlow(g, 0, -H * 0.36, 30 + glow * 12, hot, 0.4 * glow); g.restore(); g.globalCompositeOperation = 'source-over'; if (armed) arm(1, false); } });
      if (this.flash > 0) drawGlow(g, X, this.cy, 80, '#ffffff', this.flash * 3);
      if (this.stun > 0) for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.6; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 30, this.y - 20 + Math.sin(a) * 6, 4, 0, 7); g.fill(); }
      return;
    }
    g.save(); g.translate(X + (tele > 0 ? Math.sin(t * 45) * 1.5 : 0), Y + 1); g.scale(f / Math.sqrt(this.sq), this.sq * (1 + Math.sin(t * 2) * 0.012));
    const arm = (s, back) => { g.save(); g.translate(s * 37, -H * 0.66); g.rotate(s * 0.25 - armUp * 2.4 * (s > 0 ? 1 : 0.6) + Math.sin(t * 2 + s) * 0.05); paintSprite(g, 'fist', 0, 62, 64, false, this.flash, tele * 0.4, back ? shaded('fist', 0.6) : null); g.restore(); };
    arm(-1, true);
    paintSprite(g, 'boss', 0, 0, H, false, this.flash, tele * 0.35);
    // grate fire + eyes (additive, phase-coloured)
    g.globalCompositeOperation = 'lighter'; drawGlow(g, 0, -H * 0.36, 32 + glow * 12, hot, 0.55 * glow); drawGlow(g, 0, -H * 0.36, 15, '#fff0c0', 0.4 * glow);
    for (const ex of [-11, 11]) drawGlow(g, ex, -H * 0.6, 10, tele > 0 ? '#ff3a4a' : '#ffd060', 0.9);
    g.globalCompositeOperation = 'source-over';
    arm(1, false);
    g.restore();
    if (this.flash > 0) drawGlow(g, X, this.cy, 80, '#ffffff', this.flash * 3);
    if (this.stun > 0) for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.6; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 30, this.y - 20 + Math.sin(a) * 6, 4, 0, 7); g.fill(); }
  }
  draw(g) {
    if (has('boss')) return this.drawPainted(g);
    const X = this.cx, Y = this.y + this.h, t = this.anim, tele = this.tele, ph = this.phase;
    g.save(); g.translate(X, Y); g.scale(this.face / Math.sqrt(this.sq), this.sq); g.lineWidth = 3.2; g.strokeStyle = '#0c0a14'; g.lineJoin = 'round';
    const hot = ph === 3 ? '#ff6a3a' : ph === 2 ? '#ff9a3a' : '#ffb13b';
    // legs
    g.fillStyle = '#3a2f45'; for (const s of [-1, 1]) { g.beginPath(); g.roundRect(s * 22 - 10, -18, 20, 18, 4); g.fill(); g.stroke(); }
    // furnace body
    g.fillStyle = '#5a4a5e'; g.beginPath(); g.roundRect(-38, -84, 76, 70, 14); g.fill(); g.stroke();
    g.fillStyle = '#6e5c72'; g.beginPath(); g.roundRect(-32, -80, 30, 60, 10); g.fill();
    for (const [x, y] of [[-30, -76], [30, -76], [-30, -22], [30, -22]]) { g.fillStyle = '#9a8aa0'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    // grate mouth
    const glow = 0.5 + Math.sin(t * 6) * 0.15 + tele * 0.5 + (this.beamT > 0 ? 0.6 : 0);
    g.fillStyle = '#1a0e14'; g.beginPath(); g.roundRect(-6, -58, 40, 26, 6); g.fill(); g.stroke();
    g.fillStyle = hot; g.globalAlpha = clamp(glow, 0, 1); g.beginPath(); g.roundRect(-3, -55, 34, 20, 4); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = '#2a1820'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(2 + i * 8, -56); g.lineTo(2 + i * 8, -34); g.stroke(); }
    g.strokeStyle = '#0c0a14'; g.lineWidth = 3.2;
    // eyes
    for (const ex of [4, 24]) { g.fillStyle = tele > 0 ? '#ff4a5a' : '#ffe27a'; g.beginPath(); g.ellipse(ex, -70, 5, 4, 0, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = '#3a2f45'; g.fillRect(-2, -78, 14, 3); g.fillRect(18, -78, 14, 3);
    // chimney head stack
    g.fillStyle = '#4a3e50'; g.beginPath(); g.roundRect(-26, -112, 22, 30, 3); g.fill(); g.stroke(); g.fillStyle = '#7a6a80'; g.fillRect(-29, -116, 28, 6); g.strokeRect(-29, -116, 28, 6);
    // arms + fists
    let armUp = this.st === 'slamTele' ? this.tele : 0; if (this.st === 'slam') armUp = -0.3;
    for (const s of [-1, 1]) { g.save(); g.translate(s * 36, -64); g.rotate(s * 0.3 - armUp * 2.4 * (s > 0 ? 1 : 0.8) + Math.sin(t * 2 + s) * 0.05); g.fillStyle = '#5a4a5e'; g.beginPath(); g.roundRect(-6, 0, 12, 34, 5); g.fill(); g.stroke(); g.fillStyle = '#8a7a90'; g.beginPath(); g.roundRect(-11, 30, 22, 18, 6); g.fill(); g.stroke(); if (armUp > 0) drawGlow(g, 0, 40, 26, '#ff4a5a', armUp); g.restore(); }
    g.restore();
    // smoke from chimney
    if (Math.random() < 0.3) this._smoke = true;
    drawGlow(g, X + this.face * 10, Y - 46, 50, hot, 0.25 + glow * 0.25);
    if (this.flash > 0) drawGlow(g, X, this.cy, 80, '#ffffff', this.flash * 5);
    if (this.stun > 0) for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.6; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 30, this.y - 20 + Math.sin(a) * 6, 4, 0, 7); g.fill(); }
  }
}
export class TideGolem extends Warden { // caverns mini-boss: Warden moves, new body, summons glowjellies
  constructor(x, y, depth) { super(x, y, depth); this.type = 'tidegolem'; this.info = ENEMY_INFO.tidegolem; this.sprite = 'tidegolem'; this.sprH = 74; this.minion = 'jelly'; this.maxHp = this.hp = Math.round(this.hp * 1.15); this.glim = 40; }
}
export class DrownedBloom extends Boss { // final boss: Furnace fight rules, new body, Rising Tide attack, jelly adds
  constructor(x, y) { super(x, y); this.type = 'drowned'; this.info = ENEMY_INFO.drowned; this.maxHp = this.hp = 900; this.glim = 120; this.minion = 'jelly';
    this.pools = [['slam', 'volley', 'tide'], ['slam', 'beam', 'tide', 'volley'], ['tide', 'pillars', 'charge', 'slam', 'volley']]; }
  draw(g) { if (!has('boss2')) return super.draw(g);
    const X = this.cx, Y = this.y + this.h, t = this.anim, tele = this.tele || 0, f = this.face, H = 168;
    const glow = clamp(0.5 + Math.sin(t * 5) * 0.15 + tele * 0.5 + (this.beamT > 0 ? 0.6 : 0), 0, 1.4), hot = this.phase === 3 ? '#7ffcff' : '#4fe0f0';
    drawGlow(g, X, Y - 80, 200, hot, 0.1 + glow * 0.08); g.fillStyle = 'rgba(5,3,10,0.3)'; g.beginPath(); g.ellipse(X, Y + 2, 66, 6, 0, 0, 7); g.fill();
    if (tele > 0) drawGlow(g, X, Y - 70, 90 + tele * 30, '#ff2a3a', 0.3 + tele * 0.4);
    if (hasE('boss2_base')) { // v1.4 animated frames
      track(this); drawRig(g, this, 'boss2', bossPose(this), H, tele * 0.35, { over: (gg) => { g.globalCompositeOperation = 'lighter'; g.save(); g.scale(f, 1); drawGlow(g, H * 0.02, -H * 0.5, 26 + glow * 12, hot, 0.4 * glow); g.restore(); g.globalCompositeOperation = 'source-over'; } });
      if (this.stun > 0) for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.6; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 30, this.y - 20 + Math.sin(a) * 6, 4, 0, 7); g.fill(); }
      return;
    }
    const lean = this.st === 'slamTele' ? -tele * 0.06 : this.st === 'slam' ? 0.05 : this.st === 'charge' ? 0.1 * f : 0;
    g.save(); g.translate(X + (tele > 0 ? Math.sin(t * 45) * 1.5 : 0), Y + 1); g.rotate(lean); g.scale(1 / Math.sqrt(this.sq), this.sq * (1 + Math.sin(t * 1.8) * 0.015));
    paintSprite(g, 'boss2', 0, 0, H, f < 0, this.flash, tele * 0.35);
    g.globalCompositeOperation = 'lighter'; drawGlow(g, 0, -H * 0.5, 30 + glow * 14, hot, 0.5 * glow); drawGlow(g, 0, -H * 0.5, 12, '#ffffff', 0.35 * glow);
    for (const ex of [-14, 14]) drawGlow(g, ex, -H * 0.64, 9, tele > 0 ? '#ff3a4a' : '#bffcff', 0.9);
    g.globalCompositeOperation = 'source-over'; g.restore();
    if (this.stun > 0) for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.6; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 30, this.y - 20 + Math.sin(a) * 6, 4, 0, 7); g.fill(); }
  }
}

// v2.1 story: the Blight -- final boss of the campaign (Heart of the Forest). Same fight rules as the Drowned Bloom, mixed attack pools, new face.
export class Blight extends DrownedBloom {
  constructor(x, y) { super(x, y); this.type = 'blight'; this.info = { ...ENEMY_INFO.drowned, name: 'The Blight', tip: 'When it glows red, get ready to jump or dash. Hit it after each attack!' }; this.maxHp = this.hp = 1100; this.glim = 200; this.minion = 'moth';
    this.pools = [['slam', 'volley', 'tide', 'charge'], ['beam', 'volley', 'tide', 'slam', 'pillars'], ['pillars', 'charge', 'tide', 'volley', 'beam', 'slam']]; }
  draw(g) { if (!G.img.s_blight) return super.draw(g);
    const X = this.cx, t = this.anim, tele = this.tele || 0, H = 196, bob = Math.sin(t * 2.2) * 5, Y = this.y + this.h + 8 + bob;
    const glow = clamp(0.5 + Math.sin(t * 4) * 0.15 + tele * 0.5 + (this.beamT > 0 ? 0.6 : 0), 0, 1.4);
    g.fillStyle = 'rgba(5,3,10,0.35)'; g.beginPath(); g.ellipse(X, this.y + this.h + 2, 70, 7, 0, 0, 7); g.fill();
    g.globalCompositeOperation = 'lighter'; drawGlow(g, X, Y - 100, 170, '#8a3cff', 0.12 + glow * 0.1); if (tele > 0) drawGlow(g, X, Y - 110, 80 + tele * 40, '#ff2a3a', 0.3 + tele * 0.45); g.globalCompositeOperation = 'source-over';
    const sx = 1 / Math.sqrt(this.sq), sy = this.sq * (1 + Math.sin(t * 1.8) * 0.02);
    g.save(); g.translate(X + (tele > 0 ? Math.sin(t * 45) * 1.5 : 0), Y); g.scale(sx, sy); sImg(g, 's_blight', 0, 0, H, this.face < 0);
    if (this.flash > 0) { g.globalCompositeOperation = 'lighter'; sImg(g, 's_blight', 0, 0, H, this.face < 0, Math.min(0.8, this.flash * 4)); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    g.restore();
    if (this.phase >= 3) { // the twist: a small warm light flickers inside the Blight -- Ember is still in there
      const k = 0.6 + Math.sin(t * 7) * 0.25, ex = X + Math.cos(t * 1.3) * 8, ey = Y - H * 0.42 + Math.sin(t * 1.7) * 6;
      g.globalCompositeOperation = 'lighter'; drawGlow(g, ex, ey, 34, '#ffc94a', 0.55 * k); g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(ex, ey, 3.5, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
    if (this.stun > 0) for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.6; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 30, this.y - 30 + Math.sin(a) * 6, 4, 0, 7); g.fill(); }
  }
}
