// Local-only save data (localStorage). No accounts, no network.
const KEY = 'rootswing.save.v1';
export const DEFAULT_SETTINGS = {
  speed: 0.8,          // Game Speed: 0.7 Very calm, 0.8 Calm (default), 0.9 Steady, 1.0 Full
  difficulty: 'relaxed', // relaxed | normal | tough
  ctrlOpacity: 0.45, ctrlSize: 1.0, leftStyle: 'stick', // stick | pads
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
    }
  } catch (e) { console.warn('save load failed', e); }
  return save;
}
export function writeSave() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* storage full or blocked */ }
}
export function resetSave() { save.settings = clone(DEFAULT_SETTINGS); save.progress = clone(DEFAULT_PROGRESS); save.run = null; writeSave(); }
export const DIFF = {
  relaxed: { dmgTaken: 0.55, dmgDealt: 1.2, parry: 0.30, coyote: 0.16, buffer: 0.2, keep: 1.0, aggro: 0.8, label: 'Relaxed' },
  normal: { dmgTaken: 1.0, dmgDealt: 1.0, parry: 0.22, coyote: 0.12, buffer: 0.15, keep: 0.7, aggro: 1.0, label: 'Normal' },
  tough: { dmgTaken: 1.45, dmgDealt: 0.9, parry: 0.16, coyote: 0.09, buffer: 0.12, keep: 0.5, aggro: 1.2, label: 'Tough' },
};
export const diff = () => DIFF[save.settings.difficulty] || DIFF.relaxed;
