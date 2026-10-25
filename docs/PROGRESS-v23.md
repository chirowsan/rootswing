# Rootswing v2.3.0 progress log (versionCode 15) — "premium quality pass"

Goal: whole-game polish (audit fixes, adaptive procedural soundtrack + ambience, visual/feel polish, mobile perf, accessibility) while keeping
controls, story, art style, weapons, missions, difficulty and surprises exactly as approved. Tests green, reach validator valid, free tools only.
Resume notes: build `node build.mjs` (never while bots/tests serve dist/); tests `node tests/run-all.mjs` (bg ~5 min), `tests/v21.mjs`, `tests/v22.mjs`, `tests/v23.mjs`.
Phases: 1 audit -> 2 audio -> 3 visual/feel -> 4 mobile/perf -> 5 a11y/kids -> 6 tests -> 7 review x2 -> 8 ship.

## Log
- 2026-10-24 23:48 started v2.3 from 976816f (v2.2.0 shipped, tests 111+32+34 green).
- 2026-10-24 23:51 Phase1: audit capture shots/v23/before (small 640x360, wide 915x412, portrait) 0 page errors; layout issues listed below. Bot campaign x4 started.
- Bot campaign (v2.3 start, gameplay = v2.2): all 4 difficulties x 5 chapters, every boss won, 0 page errors. Normal deaths 3/3/1/13/9 (v2.2 record 3/2/5/8/6: same code, bot timing noise; ch4-5 'tile~' = bot can't read water currents, not a game bug).
## Phase 1 audit findings (harsh QA pass, ranked by impact)
1. Victory screen at 640x360: action buttons fall below the fold (must scroll to find "Next chapter"). FIX: sticky action bar.
2. Settings: segmented choices wrap onto 2 lines (Nightmare / Off hang alone) and are 35px tall (<44px touch target). FIX: no-wrap, 44px min.
3. Shop buy buttons 38px, death/victory buttons 39px. FIX: 44-46px min targets.
4. Scroll lists (shop, settings, loadout) cut text mid-line with no hint there is more. FIX: soft fade at the bottom edge.
5. No menu/story/ending music; chapters 2-5 share 2 themes; no ambience; no stingers for secret/mission/shrine/merchant; no ducking. FIX: Phase 2.
6. Title is static text over art; no chapter title/boss intro card polish; death flow ok but plain. FIX: Phase 3.
7. Pause minimap mostly empty early in a chapter (only explored rooms) - acceptable, keeps exploration.
8. Countdown numeral overlaps the control ring area for ~1s at chapter start - minor, left.
9. Settings missing: ambience volume, mute, bigger text, gentle flashes, Medium graphics. FIX: Phase 2/4/5.
- Phase 1 fixes in style.css (v2.3 block). Comic/result art 'offscreen' flags are intentional Ken-Burns overscan.
- 2026-10-24 23:55 Phase2 audio: 8 new original themes (menu, ch2-5, boss2/boss3 phases, story, ending), tension layer bus faded by nearby foes, 7 stingers, ambience beds (wind/water/rain + birds/crickets/drips/spores), ducking on big hits, director picks theme every frame. Settings: mute, Forest sounds slider. Smoke: songs/amb correct for hub/ch2/ch4/ch5/tutorial, tension 0.68 near foes, 0 errors.
- Phase 3 (visual polish): painted CSS logo (gradient letters drop in one by one, sprout leaf on the first O, vine underline; fixed a class clash with the wardrobe `.sw`/`.vine` swatches); title parallax (pointer/tilt; motes and new foreground frond layer move more than the painting; off in Low or with Gentle/no shake); cached title gradients (no per-frame allocs); fade-in when the painting arrives; loading bar + rotating kid tips while art streams in; screen entrance animation only when the screen changes (no flicker on settings taps; respects reduced motion/Gentle); new chapter ribbon (slides in, chapter colour lines, outlined name); new boss/warden intro card (slides across, "WARDEN" / "GUARDIAN OF THE ROOT"); chained glimmer pickups climb in pitch + small ring; Gentle flashes cut screen flashes to 25%; Bigger text scales HUD popups x1.22 and UI text. Shots: shots/v23/after/p3-*. 0 page errors.
