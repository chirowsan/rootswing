// v2.1 story + campaign: chapters, comic panels, lore leaves, clues, unlock ladder, NG+.
// Pure data + save logic (no DOM) so tests can drive it directly.
import { save, writeSave, runMod } from './save.js';
import { grant } from './missions.js';
export const SEEDS_PER = 3, CH_N = 5;
export const MOSS = 'Elder Moss';
// stage: which painted area the chapter is built from; mod: run-only difficulty extras (never touches jump/hook physics)
export const CHAPTERS = [
  null,
  { n: 1, name: 'Rustvine Overpass', stage: 0, warden: 'classic', wardName: 'Scrap Warden', boss: 'Grumblestack', sky: 'd_sky', col: '#ffb13b', mod: null,
    reward: ['wpn:hammer', 'cape:leaf'], hint: 'Grab 3 glowing seeds. They open the boss door!' },
  { n: 2, name: 'Drowned Glowroots', stage: 1, warden: 'tide', wardName: 'Tide Golem', boss: 'Drowned Bloom', sky: 'c_sky', col: '#4fe0f0', mod: null,
    reward: ['pet:bunny', 'up:vigor1'], hint: 'Jellies float. Hit them from below!' },
  { n: 3, name: 'Thornback Thicket', stage: 0, warden: 'thornback', wardName: 'Thornback Warden', boss: 'Thornstack', sky: 'd_sky', hue: -25, col: '#ff6a3a', tint: 'rgba(160,40,20,0.10)', parts: 'thorn',
    mod: { trap: 1.3, foes: 1.15, elite: 0.04, aggro: 1.08 }, reward: ['wpn:whip', 'hat:flower'], hint: 'Thornback charges. Jump over it, then hit its back!' },
  { n: 4, name: 'Stormcanopy', stage: 1, warden: 'stormhide', wardName: 'Stormhide Warden', boss: 'Storm Bloom', sky: 'c_sky', hue: 60, col: '#5ad8ff', tint: 'rgba(40,60,140,0.13)', parts: 'rain',
    mod: { foes: 1.2, arenas: 1, aggro: 1.1, elite: 0.04 }, reward: ['up:flask1', 'pet:squirrel', 'cape:sky'], hint: 'Stormmoths swoop. Dash through, then strike!' },
  { n: 5, name: 'Heart of the Forest', stage: 1, warden: 'shadow', wardName: 'Shadow Warden', boss: 'The Blight', sky: 'm_sky', hue: 200, col: '#c08aff', tint: 'rgba(70,20,110,0.16)', parts: 'ash',
    mod: { hp: 1.15, foes: 1.25, elite: 0.08, aggro: 1.15, arenas: 1 }, reward: ['cape:gold', 'hat:crown', 'vine:rainbow'], hint: 'The Blight is sad, not evil. Be brave!' },
];
export const NGP = { hp: 1.35, dmgTaken: 1.3, trap: 1.3, foes: 1.3, elite: 0.1 };
// 10 Memory Leaves (2 per chapter): read in the Journal, they slowly reveal who the Blight really is
export const LORE = [
  { id: 'l1', ch: 1, t: 'Elder Moss once had a helper: a tiny firefly named Ember.' },
  { id: 'l2', ch: 1, t: 'Ember loved the Great Root. Ember lit every lantern.' },
  { id: 'l3', ch: 2, t: 'One winter was so cold the Root started to shiver.' },
  { id: 'l4', ch: 2, t: 'Ember said: "I will build something to keep it warm!"' },
  { id: 'l5', ch: 3, t: 'Ember built a big Furnace. It was warm... but very smoky.' },
  { id: 'l6', ch: 3, t: 'The smoke made the leaves sick. Ember felt terrible.' },
  { id: 'l7', ch: 4, t: 'Ember hid near the Furnace and would not come out.' },
  { id: 'l8', ch: 4, t: 'Ember\'s sadness grew darker and bigger... and bigger.' },
  { id: 'l9', ch: 5, t: 'Moss still keeps a lantern lit, every single night.' },
  { id: 'l10', ch: 5, t: '"If you find Ember, tell them I\'m not angry." - Moss' },
];
export const CLUES = { 1: 'A Warden whispers: "Long ago, a little light lived by the Root..."',
  2: 'Tide Golem: "I saw a little light hiding near the Furnace long ago..."',
  3: 'Thornback: "The Blight cries at night. It sounds... sad."',
  4: 'Stormhide: "Ember built the Furnace to keep the Root warm in winter."',
  5: 'The Shadow Warden fades: "Please... help my friend."' };
// ---------- comic panels (bg = gfx/<name>.webp; over = sprite overlay; mix = root growth blend) ----------
const P = (bg, cap, o = {}) => ({ bg, cap, ...o });
export const INTRO = [
  P('p_intro1', 'The Great Root keeps the whole forest bright.'),
  P('p_intro2', 'One cold winter, a Furnace woke up. Smoke filled the sky!'),
  P('p_intro3', 'The Blight! It turned the 4 forest guardians into grumpy Wardens.'),
  P('p_intro4', 'Elder Moss saved the very last seed... and out popped YOU, Sprig!'),
  P('p_intro5', 'Find 15 Root Seeds. Free 4 Wardens. Reach the Heart of the Forest!', { icons: ['seed15', 'warden4', 'heart'] }),
  P('p_intro6', 'Let\'s go, Sprig!'),
];
export function chapterStart(n) {
  const C = CHAPTERS[n];
  return [
    P(C.sky, C.name, { title: 'Chapter ' + n, hue: C.hue || 0 }),
    P(n === 5 ? 'p_ward5' : 'p_ward' + n, n === 5 ? 'The Blight waits in the Heart of the Forest.' : 'The ' + C.wardName + ' guards this place. Free them!', { fit: 'contain' }),
    P('g_sky', MOSS + ': "' + C.hint + '"', { over: 's_moss', icons: ['seed3', 'warden1', 'door'] }),
  ];
}
export function wardenBeat(n) {
  if (n === 5) return [P('p_ward5', 'The Shadow Warden fades away...', { fit: 'contain' }), P('p_intro6', CLUES[5])];
  return [P('p_free' + n, 'You freed the ' + CHAPTERS[n].wardName + '!'), P('p_free' + n, CLUES[n], { zoom: 1 })];
}
export function chapterEnd(n, k) {
  const C = CHAPTERS[n];
  return [
    P(C.sky, C.boss + ' is calm!', { over: n % 2 ? 's_boss' : 's_boss2', hue: C.hue || 0, title: 'Chapter ' + n + ' clear!' }),
    P('g_sky', 'The Great Root grows a little more...', { mix: k, icons: ['stamp' + n] }),
    P('p_intro6', n < CH_N ? 'Next: ' + CHAPTERS[n + 1].name + '!' : 'Home to the Seedhouse!', { title: n < CH_N ? 'Chapter ' + (n + 1) + ' unlocked!' : '' }),
  ];
}
export const FINALE = [
  P('p_ember', 'The Blight cracks... and a tiny crying firefly flies out. It\'s Ember!'),
  P('p_ember', 'Ember: "I only wanted to keep the forest warm. I\'m so sorry."', { zoom: 1 }),
  P('p_plant', 'Sprig and Ember plant the last Root Seed. Together.'),
  P('p_bloom', 'The Great Root blooms! The smoke is gone!'),
  P('p_festival', MOSS + ': "Mistakes can be fixed, together." THE END'),
];
// ---------- campaign save ----------
export function ensureCampaign(p = save.progress) {
  if (p.campaign && p.campaign.v === 1) return p.campaign;
  const old = p.campaign || {};
  const veteran = (p.wins || 0) > 0; // v2.0 savers who already beat the Drowned Bloom start with chapter 2 open (story still plays)
  p.campaign = Object.assign({ v: 1, intro: false, unlocked: veteran ? 2 : 1, done: {}, freed: {}, seeds: {}, lore: [], ng: 0, ngOn: false, ending: false, fresh: 0, hint: 0, best: {} }, old, { v: 1 });
  for (const k of ['done', 'freed', 'seeds', 'best']) if (!p.campaign[k] || typeof p.campaign[k] !== 'object') p.campaign[k] = {};
  if (!Array.isArray(p.campaign.lore)) p.campaign.lore = [];
  return p.campaign;
}
export const camp = () => ensureCampaign(save.progress);
export const chapterDone = (n) => !!camp().done[n];
export const isUnlocked = (n) => n >= 1 && n <= camp().unlocked;
export const seedTotal = () => { const s = camp().seeds; let t = 0; for (let n = 1; n <= CH_N; n++) t += Math.min(SEEDS_PER, s[n] || 0); return t; };
export const freedCount = () => [1, 2, 3, 4].filter((n) => camp().freed[n]).length;
export const doneCount = () => [1, 2, 3, 4, 5].filter((n) => camp().done[n]).length;
export const rootK = () => Math.min(1, doneCount() / CH_N);
export const currentChapter = () => { const c = camp(); for (let n = 1; n <= c.unlocked; n++) if (!c.done[n]) return n; return Math.min(CH_N, c.unlocked); };
// run-only difficulty mixing (chapter extras * NG+), read by save.diff()
export function setRunMod(ch, ng) {
  const m = {}; const add = (o) => { if (!o) return; for (const k in o) m[k] = k === 'elite' || k === 'arenas' ? (m[k] || 0) + o[k] : (m[k] || 1) * o[k]; };
  if (ch) add(CHAPTERS[ch].mod); if (ng) add(NGP);
  runMod.m = Object.keys(m).length ? m : null;
}
export function onSeed(ch, count) { if (!ch) return; const c = camp(); c.seeds[ch] = Math.max(c.seeds[ch] || 0, Math.min(SEEDS_PER, count)); writeSave(); }
export function onWardenFreed(ch) { if (!ch) return; const c = camp(); c.freed[ch] = true; writeSave(); }
export function addLore(id) { const c = camp(); if (c.lore.includes(id)) return false; c.lore.push(id); writeSave(); return true; }
export const loreFor = (ch) => LORE.filter((l) => l.ch === ch);
// chapter clear: stamp, unlock the next one, hand out the ladder rewards. Returns { rewards, unlocked, ending }
export function completeChapter(ch) {
  const c = camp(), first = !c.done[ch]; c.done[ch] = true; c.freed[ch] = true; c.seeds[ch] = SEEDS_PER;
  const out = { rewards: [], unlocked: 0, ending: false, first };
  if (first) { const m = save.progress.missions; for (const r of CHAPTERS[ch].reward) { if (r.startsWith('up:')) save.progress.unlocks[r.slice(3)] = true; else if (m) grant(m, r); out.rewards.push(r); } }
  if (ch < CH_N && c.unlocked < ch + 1) { c.unlocked = ch + 1; c.fresh = ch + 1; out.unlocked = ch + 1; }
  if (ch === CH_N) { out.ending = !c.ending; c.ending = true; if (c.ngOn) c.ng = Math.max(c.ng, 1); }
  writeSave(); return out;
}
// the end-of-run "Next:" goal line (icon + short words)
export function nextGoal(ch) {
  const c = camp();
  if (!ch) { const n = currentChapter(); return c.ending ? { icon: 'star', t: 'Try New Game+ for a bigger challenge!' } : { icon: 'door', t: 'Next: Chapter ' + n + ' - ' + CHAPTERS[n].name }; }
  if (!c.done[ch]) { const s = c.seeds[ch] || 0; if (s < SEEDS_PER) return { icon: 'glimmer', t: 'Next: find ' + (SEEDS_PER - s) + ' more Root Seed' + (SEEDS_PER - s > 1 ? 's' : '') + ' in ' + CHAPTERS[ch].name };
    if (!c.freed[ch]) return { icon: 'shield', t: 'Next: free the ' + CHAPTERS[ch].wardName };
    return { icon: 'trophy', t: 'Next: calm ' + CHAPTERS[ch].boss + '!' }; }
  if (ch < CH_N) return { icon: 'door', t: 'Next: Chapter ' + (ch + 1) + ' - ' + CHAPTERS[ch + 1].name };
  return c.ending ? { icon: 'star', t: 'Next: New Game+ - the forest dares you!' } : { icon: 'heart', t: 'Next: the Heart of the Forest' };
}
// Moss: one line that always points at the next goal, plus a rotating hint
const TIPS = ['Hold jump to jump higher. Tap for a little hop.', 'Hold up and press attack for an up-swing.', 'Red glow means an attack is coming. Dash away!',
  'Shrines save your spot. Touch them!', 'Glowing seeds open the boss door.', 'Memory Leaves tell Ember\'s story. Find them all!'];
export function mossLines() {
  const c = camp(), g = nextGoal(null), n = currentChapter(), out = [];
  if (!c.done[1] && !c.freed[1]) out.push('Sprig! The Great Root needs you. Take the door to the map.');
  else if (c.ending) out.push('Ember lights the lanterns now. Thank you, Sprig.');
  else out.push(['', 'You did it! The Root is waking up.', 'The water is clean again!', 'The thorns are gone. You are so brave.', 'The storm stopped. Just one place left...', ''][doneCount()] || 'Keep going, Sprig!');
  out.push(g.t);
  if (c.lore.length >= 6 && !c.ending) out.push('Those leaves... they remind me of someone I lost.');
  out.push('Tip: ' + TIPS[c.hint % TIPS.length]); c.hint++; writeSave();
  return { lines: out, chapter: n, goal: g };
}
