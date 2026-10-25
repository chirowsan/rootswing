# Rootswing v2.1.0 (versionCode 13) — "Story + Modern Feel" update

Owner feedback: "It's missing the story line and the goal to keep going. Also the control like the 80s 90s games."
Correction: "I don't mean to use the classic control … the control feel like the 80, 90, you need to modernized it."
So the planned "Classic" control mode was cancelled. v2.1 adds a story campaign and modernises the feel
(Hollow Knight / Dead Cells / Celeste / Ori / Hades as the reference).

## A. Story campaign
- **Intro** (skippable, 6 comic panels, ~36 s on auto). The Great Root keeps the forest bright. Smoke from the old
  Furnace turns into the Blight and puts it to sleep. Elder Moss saves one last seed, and Sprig sprouts from it.
  The quest: gather 15 seeds and free 4 Wardens so the Great Root can wake up.
- **Elder Moss** stands in the hub (Seedhouse). Talking to him shows your next goal, a tip, seeds/Wardens/leaves
  counters, the chapter map and "Story so far".
- **Chapter map** (the hub door opens it). There are 5 chapters. Locked chapters show a lock and "???", and finished
  chapters show a star and their 3 seed pips. "Free run" keeps the old endless mode.
  1. Rustvine Overpass: Scrap Warden, then Grumblestack
  2. Drowned Glowroots: Tide Golem, then Drowned Bloom
  3. Thornback Thicket: Thornback Warden, then Thornstack
  4. Stormcanopy: Stormhide Warden, then Storm Bloom
  5. Heart of the Forest: Shadow Warden, then **The Blight** (final boss)
- **Comic panels** play at chapter start, after each Warden ("You freed the Scrap Warden!") and at chapter end.
- **Twist:** the Blight is Ember, Moss's firefly apprentice. Smoke and shame turned Ember into the Blight.
  The ending frees Ember, plants the seed, makes the Root bloom, holds a festival, then offers New Game+
  ("the forest dares you!").
- **Visible progress:** the Great Root in the hub grows from grey to blooming as chapters finish. Hub stamps (top
  centre) show finished chapters. Freed Wardens move into the hub. Memory Leaves (lore) drop from Wardens and get
  saved. Every death or victory screen ends with a "Next:" goal.
- The unlock ladder has **no new traversal abilities**, so the reach validator still holds.
- Save migration: v2.0 players keep everything. A veteran starts with Chapter 2 open, and the intro plays once.

## B. Modern controls (what changed vs v2.0)
v2.0 already had coyote time, jump buffer, wall slide/jump, corner correction, dash i-frames, a floating stick and
haptics. It still felt stiff ("80s/90s"), so v2.1 changes the moment-to-moment feel. Movement physics are
**unchanged**, and the shared HERO constants that the validator models are the same. Every new number in `FEEL`
(src/player.js) only adds capability on top.

| Feel item | v2.0 | v2.1 |
|---|---|---|
| Turnaround at full run | ~10 frames, no skid | **7 frames**, turn boost x1.8 carried through zero, skid dust + sound + lean-back |
| Air control | ACC_A 1200, same when reversing | 1500, x1.35 when reversing (intentional air steering) |
| Jump apex | plain arc | **apex hang** (half gravity near the top while jump is held), float pose |
| Falling | 600 cap | hold down = **fast-fall** 780 (x1.3 gravity) |
| Dash input | dropped if pressed during cooldown/parry | **buffered 0.13 s** |
| Attack input | dropped during locks | **buffered 0.16 s** (fires when the lock ends) |
| Dash → jump | dash had to finish | **dash-jump cancel**, keeps x1.3 run speed (vx 236) |
| Dash into a ledge | bonk | **mantles** up |
| Attack wind-up | locked facing | can turn during the first 0.09 s (no hard-commit lunges) |
| Landing | squash only on hard landings | soft-landing tick + squash, haptic pulse on hard landings |
| Animation | fixed lean per state | smoothed lean with acceleration term, **hat spring** physics, apex float |
| Camera | lookahead 0.035 | faster lookahead 0.05 at speed, **look down** (hold 0.35 s) / look up, falling leads the view |
| Pickup feel | hit-stop on seeds | zoom kick instead; **hit-stop only on hits** |
| Touch buttons | fixed spots | **drag-to-place editor** (Settings → Button places), saved + clamped on screen, Reset |
| Context | separate door/talk | Attack button glows and changes icon (door/gear/eye/gift/flask/key) |
| Pressed feedback | colour | button grows to 1.08x |
| Talking near fights | n/a | Moss/stations never open a menu while an enemy is close |

## C. Tests
- `node tests/v21.mjs`: **32/32** (feel numbers, buffers, coyote, dash-jump, fast-fall, button sizes, editor, contextual
  button, full story flow intro→hub→map→chapter→Warden→boss→ending→NG+, lore, persistence, v2.0 save migration, no page errors).
- `node tests/run-all.mjs`: **111/111**, including the physics reach validator.
- Bot: `node tools/play-run.mjs 7`: path + boss cleared, 0 errors.
- Regression found and fixed: in a fight, tap-spamming next to Elder Moss opened his menu.

## D. Self-review
- Pass 1: the layout editor bar wrapped and covered the dash button (fixed: compact one-line bar). The tap-spam
  regression next to Moss was fixed. Test bugs fixed: coyote/buffer tests teleported with a live coyote timer, and
  the boss lookup used minified class names.
- Pass 2: screenshots re-taken (shots/v21/). Remaining known issue: on short phones the default flask button sits over
  the mission panel (from v2.0). It can now be dragged away.
- Scores: Story **8.5** (clear goal, map, comics, twist, ending, NG+; the panels are still pictures with one line of
  text, with no voice and no in-level cutscenes). Controls **8.5** (all modern assists are measured; not yet tested
  on a real phone for touch latency/haptics).

## Screenshots (shots/v21/)
01/02 intro panels · 03 hub before · 06 hub after 3 chapters · 04/07 chapter map · 05 Warden story beat ·
08 final boss · 09 ending comic · 10 ending victory · 11 bloomed hub · 12 modern touch layout · 13 layout editor

## Ship record (2026-10-24, PDT)
- Commit f0328e0, tag v2.1.0. Release https://github.com/chirowsan/rootswing/releases/tag/v2.1.0
  - Rootswing-2.1.0.apk 9,308,058 B, Rootswing-2.1.0.aab 9,123,775 B, rootswing-2.1.0-src.zip 18,500,119 B (excludes dist/, art/, older shots)
  - APK + AAB cert SHA-256 6e59e14a…ab35d8de (same key as before), versionCode 13 / versionName 2.1.0
- Pages: gh-pages b84e423 built; https://chirowsan.github.io/rootswing/ live HTTP 200, 0 console errors, v2.1 bundle confirmed
