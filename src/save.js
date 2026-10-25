// Local-only save data (localStorage). No accounts, no network.
const KEY = 'rootswing.save.v1';
export const DEFAULT_SETTINGS = {
  speed: 0.8,          // Game Speed: 0.7 Very calm, 0.8 Calm (default), 0.9 Steady, 1.0 Full
  difficulty: 'normal', // v2.0: relaxed | normal (default) | hard | nightmare
  ctrlOpacity: 0.45, ctrlSize: 1.0, leftStyle: 'stick', // stick | pads
  stickMode: 'float', stickSize: 1, stickOpacity: 0.5, // v1.4 Controls: floating | fixed stick
  haptics: true, music: 0.6, sfx: 0.8, shake: 'reduced', // full | reduced | off
  hookAssist: true, quality: 'auto', // auto | high | low
  assist: 'auto', // v2.2 Assist: auto | on | off
};
export const DEFAULT_PROGRESS = {
  glimmers: 0, totalGlimmers: 0, runs: 0, wins: 0, bestDepth: 0,
  tutorialDone: false, seenParry: false,
  unlocks: { blade: true }, // purchased unlocks by id
  weapon: 'blade', gadgets: ['popseed'],
  bossSeen: false, minibossBeaten: 0, bossBeaten: 0,
};
function clone(o) { return JSON.parse(JSON.stringify(o)); }
export const save = { settings: clone(DEFAULT_SETTINGS), progress: clone(DEFAULT_PROGRESS), run: null };
export function loadSave() { assist.on = false; // auto-Assist is per session: it re-arms on the next death if the chapter is still hard
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      save.settings = Object.assign(clone(DEFAULT_SETTINGS), d.settings || {});
      save.progress = Object.assign(clone(DEFAULT_PROGRESS), d.progress || {});
      save.progress.unlocks = Object.assign({ blade: true }, (d.progress || {}).unlocks || {});
      save.run = d.run || null;
      if (save.settings.difficulty === 'tough') save.settings.difficulty = 'hard'; // v2.0 rename
    }
  } catch (e) { console.warn('save load failed', e); }
  return save;
}
export function writeSave() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* storage full or blocked */ }
}
export function resetSave() { save.settings = clone(DEFAULT_SETTINGS); save.progress = clone(DEFAULT_PROGRESS); save.run = null; writeSave(); }
export const DIFF = { // v2.0: hp/ramp/rampDmg scale foes, trap/foes/elite/arenas/ambush/waves scale the run, reward/stars scale the payout
  // v2.2 "too easy": contact = touch damage, iframes = after-hit invulnerability, flaskHeal = share of max HP per flask, heart/chestHeart = free-heal drop odds,
  // ckFlask = flasks refilled at a checkpoint, tokens = foes allowed to attack at once, smart = AI tier (feints, gap-closers, dodge reads), feint = feint odds,
  // cont = continues per chapter, bossHp/bossAggro = boss scaling, orb = heal per parry / perfect-dodge sap orb, surprise = event budget scale
  relaxed: { dmgTaken: 0.55, dmgDealt: 1.2, parry: 0.30, coyote: 0.16, buffer: 0.2, keep: 1.0, aggro: 0.8, hp: 0.85, ramp: 0.05, rampDmg: 0.0, trap: 0.5, foes: 0.5, elite: 0.04, arenas: 0, ambush: 1, waves: 1, reward: 1, stars: 0, label: 'Relaxed',
    contact: 0.8, iframes: 1.1, flaskHeal: 0.5, heart: 0.08, chestHeart: 0.5, ckFlask: 99, tokens: 1, smart: 0, feint: 0, cont: 99, bossHp: 0.85, bossAggro: 0.85, orb: 0.1, surprise: 0.8 },
  normal: { dmgTaken: 1.45, dmgDealt: 1.0, parry: 0.2, coyote: 0.12, buffer: 0.15, keep: 0.7, aggro: 1.3, hp: 1.2, ramp: 0.1, rampDmg: 0.06, trap: 1.25, foes: 1.35, elite: 0.16, arenas: 1, ambush: 2, waves: 2, reward: 1, stars: 0, label: 'Normal',
    contact: 1.2, iframes: 0.7, flaskHeal: 0.38, heart: 0.03, chestHeart: 0.25, ckFlask: 1, tokens: 2, smart: 1, feint: 0.22, cont: 3, bossHp: 1.35, bossAggro: 1.25, orb: 0.07, surprise: 1 },
  hard: { dmgTaken: 1.85, dmgDealt: 0.95, parry: 0.16, coyote: 0.1, buffer: 0.13, keep: 0.6, aggro: 1.5, hp: 1.5, ramp: 0.12, rampDmg: 0.08, trap: 1.6, foes: 1.7, elite: 0.24, arenas: 2, ambush: 3, waves: 3, reward: 1.5, stars: 1, label: 'Hard',
    contact: 1.3, iframes: 0.6, flaskHeal: 0.32, heart: 0.015, chestHeart: 0.15, ckFlask: 1, tokens: 3, smart: 2, feint: 0.32, cont: 2, bossHp: 1.7, bossAggro: 1.45, orb: 0.06, surprise: 1.15 },
  nightmare: { dmgTaken: 2.3, dmgDealt: 0.9, parry: 0.13, coyote: 0.09, buffer: 0.12, keep: 0.5, aggro: 1.7, hp: 1.9, ramp: 0.14, rampDmg: 0.1, trap: 2.0, foes: 2.2, elite: 0.3, arenas: 3, ambush: 4, waves: 3, reward: 2, stars: 2, label: 'Nightmare',
    contact: 1.4, iframes: 0.5, flaskHeal: 0.28, heart: 0, chestHeart: 0.1, ckFlask: 0, tokens: 4, smart: 3, feint: 0.42, cont: 1, bossHp: 2.0, bossAggro: 1.65, orb: 0.05, surprise: 1.3 },
};
// v2.2 Assist (kid-friendly, visible): 'auto' switches on after a few knock-outs in the same chapter, 'on' always, 'off' never
export const ASSIST = { dmgTaken: 0.65, aggro: 0.85, contact: 0.8, iframes: 0.35, flaskHeal: 0.1, tokens: -1, feint: 0, cont: 2, bossAggro: 0.85 };
export const assist = { on: false };
export const assistActive = () => save.settings.assist === 'on' || (save.settings.assist !== 'off' && assist.on);
DIFF.tough = DIFF.hard; // v1.x saves
export const runMod = { m: null }; // v2.1: chapter + NG+ extras for the current run (set by story.setRunMod)
let _dB = null, _dM = null, _dC = null, _dA = null;
export const diff = () => { const b = DIFF[save.settings.difficulty] || DIFF.normal, m = runMod.m, A = assistActive(); if (!m && !A) return b;
  if (_dB === b && _dM === m && _dA === A) return _dC; const o = { ...b };
  if (m) for (const k in m) o[k] = k === 'elite' || k === 'arenas' ? b[k] + m[k] : b[k] * m[k];
  o.trap = Math.min(o.trap, Math.max(b.trap, 2.0)); o.foes = Math.min(o.foes, Math.max(b.foes, 2.2)); o.elite = Math.min(o.elite, 0.35); o.arenas = Math.min(o.arenas, 3); // stay inside the v2.0 nightmare envelope the reach tests prove
  if (A) { o.dmgTaken *= ASSIST.dmgTaken; o.aggro *= ASSIST.aggro; o.contact *= ASSIST.contact; o.iframes += ASSIST.iframes; o.flaskHeal += ASSIST.flaskHeal; o.tokens = Math.max(1, o.tokens + ASSIST.tokens); o.feint = 0; o.cont += ASSIST.cont; o.bossAggro *= ASSIST.bossAggro; o.assist = true; }
  _dB = b; _dM = m; _dA = A; _dC = o; return o; };
