# Rootswing v2.2.0 progress log (versionCode 14) — "harder + surprises"

Resume notes: build `node build.mjs`; tests `node tests/v22.mjs` (~15 s), `node tests/v21.mjs`, `node tests/run-all.mjs` (bg, ~5 min).
Bot: `node tools/diff-bot.mjs <diff> 1,2,3,4,5` (bg, logs /tmp/v22b-<diff>.log; v2.1 baselines /tmp/base-<diff>.log).

## Log
- [done before log] v2.2 code: src/ai22.js (smart AI: guard vs mashing, dodge-punish, feints), src/foes22.js (hunter, mimic, hollow), src/surprise.js + src/surprisePlan.js (seeded events, boons, shrine pacts, merchant, pockets/mini-games, set-pieces, continues, rank, mastery), boss phases + fake death + phase-4 arena, secret chapter 6, Assist toggle, painted sprites art/v22 -> assets/gfx/s_*.webp.
- 2026-10-24 21:00 fixed: tile-hazard damage capped (v2.1 level on Normal); mashGuard in stun branch; Daily excluded from surprises.
- 21:10 fixed: trap state cleared on done; Assist auto-on adds +2 tries; continueRun clears stale spRun; auto-Assist resets on load.
- 21:15 fixed real bug: `sort(() => rng()-0.5)` gave engine-dependent layouts for the same seed (traps/foes/events differed ~1 in 8 loads). Replaced with seeded Fisher-Yates in gauntlet.js + surprisePlan.js. tests/v22.mjs 27/28 (only missing docs/bot-v22.json).
- 21:18 launched bots all 4 difficulties ch1-5 in parallel (do not build until done).
- 21:35 bots done (4 diffs x ch1-5); Hard bossHp 1.7->1.95, bossAggro 1.45->1.55; docs/bot-v22.json written. Normal deaths v2.1 8 -> v2.2 24 (boss 0 -> 4). HUD: moves hint + event banner no longer overlap chapter title. tools/shots-v22.mjs -> shots/v22 (25 shots).
- 21:24 Fixed hud.js comment bug (ReferenceError 'al' from a // comment inside a one-line fn); boon offers now wait for story beats (fixes v21 warden comic test). v21 32/32 (drag test flaky once under load), v22 34/34.
- 21:32 run-all 107/111 -> fixed 3 intentional-change tests (map check masks sealed secret pockets; weapon test closes warden boon card; boss test follows the fake death + revive) — all pass in isolation; combat-kill flake passes in isolation.
- 21:32 Shots re-run after HUD fix (25 shots, 0 page errors), review #2 done; version bumped to 2.2.0 / versionCode 14.
- 21:34 Signed APK+AAB built (versionCode 14 / 2.2.0); both certs SHA-256 6e59e14a…35d8de (match); APK 9.6 MB, AAB 9.4 MB.

## Summary (v2.2.0)

### Harder (bot-measured, `tools/diff-bot.mjs`, seeds 4242+ch, ch1-5; raw data in docs/bot-v22.json)
| Difficulty | v2.1 deaths ch1-5 | v2.2 deaths ch1-5 | v2.2 boss deaths |
|---|---|---|---|
| Relaxed | 0,1,0,1,0 (2) | 0,0,0,2,0 (2) | 0 — stays gentle |
| Normal (default) | 0,0,1,4,3 (8) | 3,2,5,8,6 (24) | 1,1,1,0,1 (v2.1: 0) |
| Hard | 1,5,2,36,3 (47; 36 = ch4 tile-hazard spike) | 4,6,10,7,12 (39) | 4,3,3,4,3 (v2.1: 0) |
| Nightmare | 2,8,7,14,5 (36) | 7,15,14,15,19 (70) | 1,3,3,6,8 (v2.1: 0) |
Every chapter was still cleared by the bot at every difficulty (fair). Normal HP lost/min: v2.1 8-36 -> v2.2 17-60.

Normal tuning v2.1 -> v2.2: damage taken x1.0 -> x1.45, foe HP x1.0 -> x1.2, foe count x1.0 -> x1.35, aggro 1.0 -> 1.3, elites 10% -> 16%, traps x1.0 -> x1.25,
flask heal 38%, heart drops 3% (rarer), boss HP x1.35 + aggro x1.25, smart AI level 1 (guards vs button-mashing, punishes dodge-spam, 22% feints — all feints still wind up visibly), 3 continues per run (Relaxed: unlimited).
Hard: boss HP x1.95, aggro x1.55, 2 continues. Nightmare: x2.0 boss HP, dmg x2.3, no heart drops, 1 continue.
Bosses: 3 phases + fake death ("it's not over!") + phase-4 arena change (telegraphed thorn floor / falling-plank arena). Sap parry orbs replace most free heals.
Rank (C..S) per room, mastery stars (4 per chapter: clear / no continues / boss no-hit / under par). Assist toggle (and auto-offer after repeated deaths): -35% dmg, slower foes, +2 tries.

### Surprises (seeded per run, budget 3-9 events per chapter, no soft-locks — tested)
3-card boons (12 boons), Old Shrine bless/curse pacts (5), Pip's rotating merchant (6 stock items, changes every run), mimic chests (telegraphed "!"), ambush portals, elite Thorn Hunter that tracks you between rooms (bounty), thunderstorm, blight surge, fireflies, flood, plank collapse, trap room ("survive 6 s"), lore stones,
hidden pockets behind cracked walls (1-3 per run) with mini-games (fireflies / rune order / treasure) giving Ember Sparks; 5 sparks unlock secret Chapter 6 "The Hollow Root" with the Hollow Warden and the Hollow King.
One set-piece per chapter: rolling logs, spore flood, the old bridge, lights out, blight escape.

### Self-review
Iteration 1: found nondeterministic plans (sort with random comparator), Hard bosses never killed the bot, ch4 hazard spike, banner overlap — all fixed.
Iteration 2: found a ReferenceError from a `//` comment in a one-line function (HUD), boon cards popping before the warden story comic, and 3 tests that needed updating for intentional changes (secret pockets carve sealed rock, fake death, warden boon card) — fixed.
- 21:39 Tests: run-all 111/111, v21 32/32, v22 34/34.
