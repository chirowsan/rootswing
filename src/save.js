// Local-only save data (localStorage). No accounts, no network.
const KEY = 'rootswing.save.v1';
export const DEFAULT_SETTINGS = {
  speed: 0.8,          // Game Speed: 0.7 Very calm, 0.8 Calm (default), 0.9 Steady, 1.0 Full
  difficulty: 'normal', // v2.0: relaxed | normal (default) | hard | nightmare
  ctrlOpacity: 0.45, ctrlSize: 1.0, leftStyle: 'stick', // stick | pads
  stickMode: 'float', stickSize: 1, stickOpacity: 0.5, // v1.4 Controls: floating | fixed stick
  haptics: true, music: 0.6, sfx: 0.8, shake: 'reduced', // full | reduced | off
  hookAssist: true, quality: 'auto', // auto | high | low
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
export function loadSave() {
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
  relaxed: { dmgTaken: 0.55, dmgDealt: 1.2, parry: 0.30, coyote: 0.16, buffer: 0.2, keep: 1.0, aggro: 0.8, hp: 0.85, ramp: 0.05, rampDmg: 0.0, trap: 0.5, foes: 0.5, elite: 0.04, arenas: 0, ambush: 1, waves: 1, reward: 1, stars: 0, label: 'Relaxed' },
  normal: { dmgTaken: 1.0, dmgDealt: 1.0, parry: 0.22, coyote: 0.12, buffer: 0.15, keep: 0.7, aggro: 1.0, hp: 1.0, ramp: 0.09, rampDmg: 0.04, trap: 1.0, foes: 1.0, elite: 0.10, arenas: 1, ambush: 2, waves: 2, reward: 1, stars: 0, label: 'Normal' },
  hard: { dmgTaken: 1.45, dmgDealt: 0.95, parry: 0.17, coyote: 0.1, buffer: 0.13, keep: 0.6, aggro: 1.25, hp: 1.3, ramp: 0.11, rampDmg: 0.06, trap: 1.5, foes: 1.6, elite: 0.18, arenas: 2, ambush: 3, waves: 3, reward: 1.5, stars: 1, label: 'Hard' },
  nightmare: { dmgTaken: 1.9, dmgDealt: 0.9, parry: 0.14, coyote: 0.09, buffer: 0.12, keep: 0.5, aggro: 1.45, hp: 1.6, ramp: 0.13, rampDmg: 0.08, trap: 2.0, foes: 2.2, elite: 0.28, arenas: 3, ambush: 4, waves: 3, reward: 2, stars: 2, label: 'Nightmare' },
};
DIFF.tough = DIFF.hard; // v1.x saves
export const diff = () => DIFF[save.settings.difficulty] || DIFF.normal;
