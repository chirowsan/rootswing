// Weapons, gadgets and hub upgrades. All names are original.
export const WEAPONS = {
  blade: { name: 'Rustblade', icon: 'blade', color: '#d8e6f0', desc: 'Quick 3-hit combo', moveMul: 0.55,
    combo: [
      { dmg: 10, wind: 0.06, active: 0.09, rec: 0.13, w: 40, h: 30, oy: -2, lunge: 70, kb: 130, hs: 0.045, shake: 0.12, sfx: 'swing', arc: 1 },
      { dmg: 11, wind: 0.06, active: 0.09, rec: 0.14, w: 42, h: 30, oy: 0, lunge: 80, kb: 140, hs: 0.045, shake: 0.12, sfx: 'swing', arc: -1 },
      { dmg: 19, wind: 0.10, active: 0.11, rec: 0.26, w: 50, h: 38, oy: -4, lunge: 150, kb: 300, hs: 0.08, shake: 0.25, sfx: 'swingHeavy', arc: 2 }],
    heavy: { dmg: 34, wind: 0.05, active: 0.14, rec: 0.3, w: 62, h: 44, oy: -4, lunge: 220, kb: 420, hs: 0.11, shake: 0.4, sfx: 'swingHeavy', arc: 3, breaks: true },
    air: { dmg: 11, wind: 0.04, active: 0.1, rec: 0.12, w: 44, h: 40, oy: 0, lunge: 0, kb: 160, hs: 0.04, shake: 0.1, sfx: 'swing', arc: 1 } },
  hammer: { name: 'Gearhammer', icon: 'hammer', color: '#ffc06a', desc: 'Slow, huge knockback, smashes shields', moveMul: 0.3,
    combo: [
      { dmg: 22, wind: 0.16, active: 0.1, rec: 0.24, w: 54, h: 44, oy: -4, lunge: 60, kb: 380, hs: 0.09, shake: 0.32, sfx: 'swingHeavy', arc: 2, breaks: true },
      { dmg: 30, wind: 0.2, active: 0.12, rec: 0.36, w: 60, h: 50, oy: -6, lunge: 90, kb: 480, hs: 0.12, shake: 0.45, sfx: 'swingHeavy', arc: 3, breaks: true, quake: true }],
    heavy: { dmg: 55, wind: 0.08, active: 0.14, rec: 0.42, w: 120, h: 40, oy: 4, lunge: 0, kb: 520, hs: 0.15, shake: 0.6, sfx: 'thump', arc: 4, breaks: true, quake: true, both: true },
    air: { dmg: 20, wind: 0.1, active: 0.12, rec: 0.2, w: 50, h: 46, oy: 6, lunge: 0, kb: 360, hs: 0.08, shake: 0.3, sfx: 'swingHeavy', arc: 2, breaks: true } },
  bow: { name: 'Thornbow', icon: 'bow', color: '#a6e47a', desc: 'Shoots from afar, charged shot pierces', moveMul: 0.7,
    combo: [
      { dmg: 9, wind: 0.05, active: 0.02, rec: 0.2, proj: { speed: 640, life: 0.7 }, kb: 90, hs: 0.03, shake: 0.05, sfx: 'bow' },
      { dmg: 9, wind: 0.05, active: 0.02, rec: 0.2, proj: { speed: 640, life: 0.7 }, kb: 90, hs: 0.03, shake: 0.05, sfx: 'bow' }],
    heavy: { dmg: 30, wind: 0.02, active: 0.02, rec: 0.3, proj: { speed: 900, life: 0.8, pierce: true, big: true }, kb: 300, hs: 0.08, shake: 0.2, sfx: 'bow', breaks: true },
    air: { dmg: 9, wind: 0.04, active: 0.02, rec: 0.18, proj: { speed: 640, life: 0.7 }, kb: 90, hs: 0.03, shake: 0.05, sfx: 'bow' } },
  whip: { name: 'Vinelash', icon: 'whip', color: '#7fe0a0', desc: 'Long reach, sweeping heavy spin', moveMul: 0.6,
    combo: [
      { dmg: 9, wind: 0.08, active: 0.1, rec: 0.14, w: 84, h: 20, oy: -4, lunge: 30, kb: 150, hs: 0.04, shake: 0.1, sfx: 'swing', arc: 5 },
      { dmg: 10, wind: 0.08, active: 0.1, rec: 0.14, w: 88, h: 20, oy: 2, lunge: 30, kb: 150, hs: 0.04, shake: 0.1, sfx: 'swing', arc: 5 },
      { dmg: 16, wind: 0.1, active: 0.12, rec: 0.24, w: 96, h: 26, oy: -2, lunge: 60, kb: 260, hs: 0.07, shake: 0.2, sfx: 'swingHeavy', arc: 5 }],
    heavy: { dmg: 30, wind: 0.05, active: 0.22, rec: 0.3, w: 170, h: 90, oy: -10, lunge: 0, kb: 340, hs: 0.1, shake: 0.35, sfx: 'swingHeavy', arc: 6, both: true, breaks: true },
    air: { dmg: 10, wind: 0.05, active: 0.1, rec: 0.12, w: 80, h: 30, oy: 0, lunge: 0, kb: 150, hs: 0.04, shake: 0.1, sfx: 'swing', arc: 5 } },
};
export const GADGETS = {
  popseed: { name: 'Popseed', icon: 'popseed', cd: 6, desc: 'Throw a seed bomb' },
  sentry: { name: 'Thornling', icon: 'sentry', cd: 13, desc: 'Plant a little turret friend' },
};
export const UPGRADES = [
  { id: 'hammer', name: 'Gearhammer', icon: 'hammer', cost: 60, desc: 'A slow, mighty hammer. Smashes shields.' },
  { id: 'sentry', name: 'Thornling', icon: 'sentry', cost: 70, desc: 'Second gadget: a turret friend.' },
  { id: 'flask1', name: 'Dew Flask +1', icon: 'flask', cost: 70, desc: 'Carry one more healing flask.' },
  { id: 'vigor1', name: 'Heartwood', icon: 'heart', cost: 60, desc: '+20 max health.' },
  { id: 'bow', name: 'Thornbow', icon: 'bow', cost: 90, desc: 'Shoot from a safe distance.' },
  { id: 'vine', name: 'Long Vine', icon: 'hook', cost: 50, desc: 'Hook reaches further.' },
  { id: 'whip', name: 'Vinelash', icon: 'whip', cost: 120, desc: 'Long sweeping whip.' },
  { id: 'lucky', name: 'Lucky Seeds', icon: 'glimmer', cost: 100, desc: '+25% glimmers from enemies.' },
  { id: 'vigor2', name: 'Heartwood II', icon: 'heart', cost: 140, desc: '+20 more max health.', req: 'vigor1' },
  { id: 'flask2', name: 'Dew Flask +2', icon: 'flask', cost: 150, desc: 'Carry yet another flask.', req: 'flask1' },
];
