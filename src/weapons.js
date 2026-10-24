// Weapons, gadgets and hub upgrades. All names are original.
export const WEAPONS = {
  blade: { name: 'Leaf Blade', icon: 'blade', color: '#bff5c8', pal: ['#59e08a', '#eaffd8', '#1d6b3a'], style: 'Fast combo', desc: 'Fast 5-hit combo: slash, reverse, spin, lunge, vine slam', moveMul: 0.55,
    combo: [ // v1.9: each hit has its own move, hitbox, lunge, stagger and sound
      { dmg: 9, wind: 0.07, active: 0.08, rec: 0.11, w: 44, h: 32, oy: -4, lunge: 80, kb: 110, hs: 0.04, shake: 0.08, sfx: 'slashA', mv: 'cut', stag: 0.28 },
      { dmg: 10, wind: 0.06, active: 0.08, rec: 0.11, w: 46, h: 36, oy: -6, lunge: 80, kb: 120, hs: 0.04, shake: 0.08, sfx: 'slashB', mv: 'rev', stag: 0.28 },
      { dmg: 8, wind: 0.08, active: 0.16, rec: 0.11, w: 78, h: 36, oy: -4, lunge: 110, kb: 150, hs: 0.035, shake: 0.1, sfx: 'spin', mv: 'spin', both: true, ticks: 2, stag: 0.32 },
      { dmg: 13, wind: 0.1, active: 0.1, rec: 0.17, w: 74, h: 20, oy: -2, lunge: 300, kb: 240, hs: 0.055, shake: 0.14, sfx: 'thrust', mv: 'lunge', thrust: true, stag: 0.45 },
      { dmg: 22, wind: 0.15, active: 0.1, rec: 0.3, w: 66, h: 46, oy: -6, lunge: 120, kb: 330, hs: 0.1, shake: 0.42, sfx: 'finisher', mv: 'slam', fin: true, launch: 300, lashL: 120, breaks: true, stag: 0.8 }],
    heavy: { dmg: 9, wind: 0.05, active: 0.5, rec: 0.26, w: 112, h: 56, oy: -6, lunge: 0, kb: 160, hs: 0.03, shake: 0.12, sfx: 'whirl', mv: 'whirl', both: true, ticks: 5, pull: 1, burst: 20, breaks: true, stag: 0.4 },
    air: { dmg: 11, wind: 0.04, active: 0.1, rec: 0.12, w: 44, h: 40, oy: 0, lunge: 0, kb: 160, hs: 0.04, shake: 0.1, sfx: 'slashA', mv: 'air', stag: 0.3 } },
  hammer: { name: 'Thorn Hammer', icon: 'hammer', color: '#ffc06a', pal: ['#ff8a2a', '#fff0c8', '#7a2a10'], style: 'Heavy smash', desc: 'Slow 3-hit smash: slam, uppercut, shockwave. Breaks shields and armor', moveMul: 0.3,
    combo: [ // v2.0: overhead slam -> uppercut launcher -> earth-splitting finisher (every hit breaks guards)
      { dmg: 20, wind: 0.17, active: 0.1, rec: 0.2, w: 60, h: 50, oy: -6, lunge: 70, kb: 300, hs: 0.085, shake: 0.3, sfx: 'hamA', mv: 'slam', breaks: true, quake: 'small', stag: 0.6 },
      { dmg: 16, wind: 0.12, active: 0.1, rec: 0.2, w: 56, h: 60, oy: -10, lunge: 60, kb: 140, hs: 0.07, shake: 0.24, sfx: 'hamB', mv: 'rise', launch: 430, kdir: 'up', breaks: true, stag: 0.6 },
      { dmg: 34, wind: 0.24, active: 0.12, rec: 0.36, w: 96, h: 56, oy: -6, lunge: 110, kb: 520, hs: 0.14, shake: 0.55, sfx: 'hamFin', mv: 'slam', fin: true, quake: true, lashL: 150, breaks: true, stag: 1 }],
    heavy: { dmg: 55, wind: 0.08, active: 0.14, rec: 0.42, w: 120, h: 40, oy: 4, lunge: 0, kb: 520, hs: 0.15, shake: 0.6, sfx: 'thump', arc: 4, breaks: true, quake: true, both: true, mv: 'slam' },
    air: { dmg: 20, wind: 0.1, active: 0.12, rec: 0.2, w: 50, h: 46, oy: 6, lunge: 0, kb: 360, hs: 0.08, shake: 0.3, sfx: 'hamA', arc: 2, breaks: true, mv: 'air' } },
  bow: { name: 'Thornbow', icon: 'bow', color: '#a6e47a', desc: 'Shoots from afar, charged shot pierces', moveMul: 0.7,
    combo: [
      { dmg: 9, wind: 0.05, active: 0.02, rec: 0.2, proj: { speed: 640, life: 0.7 }, kb: 90, hs: 0.03, shake: 0.05, sfx: 'bow' },
      { dmg: 9, wind: 0.05, active: 0.02, rec: 0.2, proj: { speed: 640, life: 0.7 }, kb: 90, hs: 0.03, shake: 0.05, sfx: 'bow' }],
    heavy: { dmg: 30, wind: 0.02, active: 0.02, rec: 0.3, proj: { speed: 900, life: 0.8, pierce: true, big: true }, kb: 300, hs: 0.08, shake: 0.2, sfx: 'bow', breaks: true },
    air: { dmg: 9, wind: 0.04, active: 0.02, rec: 0.18, proj: { speed: 640, life: 0.7 }, kb: 90, hs: 0.03, shake: 0.05, sfx: 'bow' } },
  whip: { name: 'Vine Whip', icon: 'whip', color: '#b8f07a', pal: ['#9ae04a', '#f4ffd0', '#2f5a14'], style: 'Long reach', desc: 'Long 4-hit lash: crack, backlash, sky-crack, snap-pull. Tip hits crit', moveMul: 0.6,
    combo: [ // v2.0: hits with the very tip of the whip are crits ("TIP!")
      { dmg: 9, wind: 0.1, active: 0.1, rec: 0.13, w: 92, h: 22, oy: -4, lunge: 30, kb: 150, hs: 0.04, shake: 0.1, sfx: 'whipCrack', arc: 5, mv: 'cut', tip: true },
      { dmg: 10, wind: 0.09, active: 0.1, rec: 0.13, w: 92, h: 22, oy: 2, lunge: 30, kb: 150, hs: 0.04, shake: 0.1, sfx: 'whipCrack', arc: 5, mv: 'rev', tip: true },
      { dmg: 11, wind: 0.1, active: 0.1, rec: 0.16, w: 76, h: 70, oy: -24, lunge: 20, kb: 90, hs: 0.05, shake: 0.14, sfx: 'whipCrack', mv: 'rise', launch: 340, kdir: 'up', tip: true, stag: 0.5 },
      { dmg: 17, wind: 0.13, active: 0.12, rec: 0.26, w: 112, h: 26, oy: -2, lunge: 40, kb: 300, hs: 0.08, shake: 0.24, sfx: 'whipSnap', arc: 5, mv: 'slam', fin: true, kdir: 'pull', tip: true, lashL: 150, stag: 0.8 }],
    heavy: { dmg: 13, wind: 0.05, active: 0.36, rec: 0.3, w: 170, h: 90, oy: -10, lunge: 0, kb: 340, hs: 0.1, shake: 0.35, sfx: 'whirl', arc: 6, both: true, breaks: true, mv: 'whirl', ticks: 3, pull: 1 },
    air: { dmg: 10, wind: 0.05, active: 0.1, rec: 0.12, w: 84, h: 30, oy: 0, lunge: 0, kb: 150, hs: 0.04, shake: 0.1, sfx: 'whipCrack', arc: 5, mv: 'air', tip: true } },
  // v1.3 (Drowned Glowroots) weapons
  spear: { name: 'Tidespear', icon: 'spear', color: '#7ff6ff', desc: 'Long piercing thrusts, heavy lunges through foes', moveMul: 0.5, biome: 'caverns',
    combo: [
      { dmg: 12, wind: 0.08, active: 0.08, rec: 0.16, w: 92, h: 16, oy: -2, lunge: 90, kb: 170, hs: 0.05, shake: 0.12, sfx: 'thrust', thrust: true, mv: 'lunge' },
      { dmg: 20, wind: 0.12, active: 0.1, rec: 0.26, w: 104, h: 18, oy: -2, lunge: 140, kb: 300, hs: 0.08, shake: 0.22, sfx: 'swingHeavy', thrust: true }],
    heavy: { dmg: 38, wind: 0.06, active: 0.18, rec: 0.32, w: 120, h: 22, oy: -2, lunge: 420, kb: 420, hs: 0.12, shake: 0.45, sfx: 'thrust', thrust: true, breaks: true, mv: 'lunge' },
    air: { dmg: 12, wind: 0.05, active: 0.1, rec: 0.12, w: 84, h: 18, oy: 0, lunge: 0, kb: 170, hs: 0.04, shake: 0.1, sfx: 'thrust', thrust: true, mv: 'lunge' } },
  sickle: { name: 'Glowsickle', icon: 'sickle', color: '#9affd8', desc: 'Very fast 4-hit flurry, heavy hits both sides', moveMul: 0.75, biome: 'caverns',
    combo: [
      { dmg: 7, wind: 0.03, active: 0.07, rec: 0.08, w: 36, h: 30, oy: -2, lunge: 50, kb: 80, hs: 0.03, shake: 0.06, sfx: 'slashA', arc: 1, mv: 'cut' },
      { dmg: 7, wind: 0.03, active: 0.07, rec: 0.08, w: 36, h: 30, oy: 0, lunge: 50, kb: 80, hs: 0.03, shake: 0.06, sfx: 'slashB', arc: -1, mv: 'rev' },
      { dmg: 8, wind: 0.03, active: 0.07, rec: 0.08, w: 52, h: 32, oy: -2, lunge: 60, kb: 90, hs: 0.03, shake: 0.08, sfx: 'spin', arc: 1, mv: 'spin', both: true },
      { dmg: 15, wind: 0.06, active: 0.09, rec: 0.2, w: 44, h: 36, oy: -4, lunge: 110, kb: 260, hs: 0.07, shake: 0.2, sfx: 'finisher', arc: 2, mv: 'slam', fin: true, launch: 220, lashL: 90 }],
    heavy: { dmg: 10, wind: 0.04, active: 0.36, rec: 0.28, w: 110, h: 50, oy: -4, lunge: 0, kb: 300, hs: 0.1, shake: 0.35, sfx: 'whirl', arc: 6, both: true, mv: 'whirl', ticks: 4, pull: 1 },
    air: { dmg: 8, wind: 0.03, active: 0.08, rec: 0.08, w: 40, h: 38, oy: 0, lunge: 0, kb: 100, hs: 0.03, shake: 0.06, sfx: 'slashA', arc: 1, mv: 'air' } },
};
export const STYLES = ['blade', 'hammer', 'whip']; // v2.0 earnable fighting styles (missions or the shop)
export const palOf = (id) => (WEAPONS[id] && WEAPONS[id].pal) || [WEAPONS[id] ? WEAPONS[id].color : '#fff', '#ffffff', '#333'];
export const GADGETS = {
  popseed: { name: 'Popseed', icon: 'popseed', cd: 6, desc: 'Throw a seed bomb' },
  sentry: { name: 'Thornling', icon: 'sentry', cd: 13, desc: 'Plant a little turret friend' },
};
export const UPGRADES = [
  { id: 'hammer', name: 'Thorn Hammer', icon: 'hammer', cost: 60, desc: 'A slow, mighty hammer. Smashes shields and armor.' },
  { id: 'sentry', name: 'Thornling', icon: 'sentry', cost: 70, desc: 'Second gadget: a turret friend.' },
  { id: 'flask1', name: 'Dew Flask +1', icon: 'flask', cost: 70, desc: 'Carry one more healing flask.' },
  { id: 'vigor1', name: 'Heartwood', icon: 'heart', cost: 60, desc: '+20 max health.' },
  { id: 'bow', name: 'Thornbow', icon: 'bow', cost: 90, desc: 'Shoot from a safe distance.' },
  { id: 'vine', name: 'Long Vine', icon: 'hook', cost: 50, desc: 'Hook reaches further.' },
  { id: 'whip', name: 'Vine Whip', icon: 'whip', cost: 120, desc: 'Long whip. Tip hits crit.' },
  { id: 'lucky', name: 'Lucky Seeds', icon: 'glimmer', cost: 100, desc: '+25% glimmers from enemies.' },
  { id: 'vigor2', name: 'Heartwood II', icon: 'heart', cost: 140, desc: '+20 more max health.', req: 'vigor1' },
  { id: 'flask2', name: 'Dew Flask +2', icon: 'flask', cost: 150, desc: 'Carry yet another flask.', req: 'flask1' },
  { id: 'spear', name: 'Tidespear', icon: 'spear', cost: 130, desc: 'Start runs with the long-reach spear.' },
  { id: 'sickle', name: 'Glowsickle', icon: 'sickle', cost: 130, desc: 'Start runs with the fast sickle.' },
  { id: 'revive', name: 'Ember Heart', icon: 'heart', cost: 160, desc: 'Skill: once per biome, rise again at 40% health instead of dying.', req: 'vigor1' },
];
