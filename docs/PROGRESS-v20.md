# Rootswing v2.0.0 (versionCode 12) — "Brawl" update

## Director review (harsh, vs Dead Cells / Hollow Knight / Ori / Hades)
Starting point (v1.9): 6.5/10 combat. One weapon, every hit read the same, no reason to vary
attacks, enemies were HP sponges, no hit-stop hierarchy, toasts piled up, critters too small,
boss died with a pop. Missing: weapon identity (Dead Cells), readable telegraphs + poise (Hollow
Knight), flow/juggle (Ori), style feedback + build choice (Hades).

## What changed
- **3 weapon styles**, each with its own combo, smear VFX, sound and animation:
  - Leaf Blade (start) — fast 4-hit string, spin finisher. ~35 DPS, short reach.
  - Thorn Hammer (mission reward) — slow 3-hit, armor breaker, **hold attack** for a ground quake. ~43 DPS.
  - Vine Whip (mission reward) — long reach (92 px), **tip hits crit**, pulls flyers. ~31 DPS.
  - Switch in the Wardrobe weapon row, or quick-swap: T / 4 / Tab, gamepad button 8, or tap the weapon badge.
- **Combo counter + style rank D→C→B→A→S** (top-right), with variety bonus labels; rank decays if you stop or get hit.
- Hit-stop scaled by hit weight, directional knockback, **wall splat** (bonus damage), **trap KO** (bonus + label).
- Enemies: shield knights need a **guard break** (heavy / finisher / launcher), **armored** foes show plates that only heavy hits strip, flyers are juggleable, **elites** have a pink aura + crown and drop more.
- Boss: phase cine labels (PHASE 2 / FINAL PHASE), telegraph rings, **poise break** cinematic (BREAK!), slowed shatter death.
- Juice: layered additive smears, decals, debris, zoom punch, capped controlled shake, particle caps, unified audio bus levels.
- Polish: critters 1.4x with idle/happy anims; toasts merge by key (no stacking); callout words never overlap damage numbers or each other; hammer finisher FX trimmed so the hero stays visible.
- Fixes: v1.9 `W.quake` bug (now `BR.quake`); enemy onGround physics line; save migration from v1.9.

## "More traps, more enemies, harder" (owner steering, folded into v2.0)
- **6 new trap types** (src/traps20.js, placed by src/gauntlet.js): swinging log pendulum, poison thorn vine
  (pulses), falling thorn branch (shakes ~0.7 s, then drops), spore cloud (swells before bursting), rolling thorn
  wall on a visible track, and timed thorn gates. Every one is telegraphed (at least 0.5 s warning, or always visible
  on its track), has safe ground on both sides, does 8–12 damage, and has a codex tip.
- **Density ramp**: new traps are placed only on safe floor or ceiling spots, at least 4 tiles from starts,
  checkpoints, seeds and doors, and at least 6 tiles from each other. Rooms mix two kinds. Map tiles never change, so
  the reach validator result still holds. Average new traps per run over 6 seeds: Relaxed ~9, Normal ~26, Hard ~36,
  Nightmare ~44. Late rooms get about 3x as many as early rooms.
- **More enemies**: up to 4 extra foes per room, rising with depth and difficulty.
  - Variants: Rustbrute (big armored charger), Thornling packs, Stormmoth.
  - Elite affixes, each with its own aura colour: Mighty (pink), Swift (cyan), Thorned (orange) and Splitter (green;
    splits into 2 Thornlings).
- **Arenas**: wave-locked rooms. Gates slam shut, the ARENA! card shows, and 2–3 waves (more foes on harder
  difficulties) arrive through telegraphed portals (0.9 s with a "!"). Clearing them opens the gates and pays glimmers
  plus a heart. Leaving or dying opens it again, and there is a 100 s safety timeout.
- **Ambushes**: in some rooms, portals open around you at mid-room. There is no lock.
- **Mini-boss variety**: Classic, Thornback (summons chargers, more HP) and Stormhide (faster, cyan aura) Wardens,
  chosen by seed.
- **Difficulty select** (Settings): Relaxed / Normal (new default) / Hard / Nightmare. The "Tough" setting from older
  saves now maps to Hard.

  | | Foe HP | Ramp/room | Damage taken | Aggression | Traps | Foes | Arenas | Reward | Bonus stars |
  |---|---|---|---|---|---|---|---|---|---|
  | Relaxed | 0.85x | +5% | 0.55x | 0.8 | 0.5x | 0.5x | 0 | 1x | 0 |
  | Normal | 1x | +9% (was +6%) | 1x | 1.0 | 1x | 1x | 1 | 1x | 0 |
  | Hard | 1.3x | +11% | 1.45x | 1.25 | 1.5x | 1.6x | 2 | 1.5x | +1 |
  | Nightmare | 1.6x | +13% | 1.9x | 1.45 | 2x | 2.2x | 3 | 2x | +2 |

## Review iterations (frame captures in shots/v20/)
1. Text overlap, faint elite aura, hammer finisher hides hero → word stacking, louder aura.
2. Callouts under damage numbers, quake shards too noisy → liftWords, fewer shards.
3. Hammer leaves/sparks cut, stacked callouts spaced; boss phase/poise/death readable; toasts merge. Remaining nit: death strobe is bright for several frames.
4. (traps/enemies pass) The ARENA! card overlapped WAVE 1/3, so the first wave is now delayed 1.2 s. Portals could open on traps and now avoid them. Arena rooms were overcrowded, so they now keep only 1 new trap. The 4-way difficulty selector wrapped onto two lines, so the hint is shorter. Arenas next to the Warden room were blocked by the Warden fight and are excluded. A swallowed line made enemy HP NaN; the new tests caught it.

## Tests
111/111 automated tests (23 new for v2.0).
- Combat (13): style damage and timing, combo counter, trap KO, wall splat, guard break, armor, elites, boss phases,
  poise and death, no soft-lock, v1.9 save migration, weapon grants and toasts, no page errors.
- Gauntlet (10): Normal is the default; each new trap is telegraphed with fair damage; density ramps with depth and
  difficulty; fair placement with the map unchanged; foe, arena and ambush scaling with variants and affixes; HP,
  reward and star scaling and the tough-to-Hard migration; 3 Warden variants; the arena lock, waves, unlock and
  no-soft-lock abort; the Splitter; no page errors.
- Full-run bot (tools/play-run.mjs, seed 7, on Normal): the whole run, Warden and boss kill, 0 errors.

## Unverified
- Feel and audio mix on a real phone, and touch quick-swap on small screens.
- Human playtesting of the Hard and Nightmare balance. The numbers are tuned by measurement, and no child has played
  them yet.

## Honest score
Combat and game feel: **8.5/10**. It is not a 9 yet for three reasons: hammer and boss-death FX can still be busy
(the death strobe is bright), nothing has been verified on a real device, and the new difficulty curve has not been
playtested. Content depth (traps, enemies, arenas, difficulty) has gone from about a 6 to an 8.5.
