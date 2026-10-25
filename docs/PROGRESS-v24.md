# Rootswing v2.4.0 (versionCode 16) — feel pass: swing, whip, bow
Owner feedback: "The swings and the bow and whip doesn't feel great, can you please fix it."

## Phase 0 — start (2026-10-25 08:58 PDT)
- Base: v2.3.0 (main e36513b). Plan: audit -> bow -> swing -> whip -> cross-checks -> tests -> review loops -> ship.

## Phase 1 — audit + "before" baseline (tools/feel24.mjs before → shots/v24/before/)
**Bow: YES, one already exists — the Thornbow** (src/weapons.js `bow`). So no new bow; the Thornbow is reworked.
Problems found:
- Thornbow: shop-only (90 glimmers), *not* in STYLES (can't quick-swap, never offered by missions/wardrobe), shots fly perfectly flat at face direction only (no up/down/diagonal aim, no assist), no trail, no draw/charge meter (hold = generic heavy after 0.55 s), sfx is a generic 'bow' blip, no crit/weakpoint, hero just uses the sword 'thrust' frame.
- Hook swing: drag 0.15/s + an automatic reel toward 0.7×length on attach → energy bleeds and the rope "pulls" you up (baseline: no-input swing loses energy every arc); pump = flat `vx += mx*520` (pushes even at the top of the arc, fights gravity, feels floaty); radial velocity is simply deleted when the rope goes taut (hard stop, 50 px/s jerk at attach + a 3000 px/s² "pop" on ground attach); release = fixed `vy=min(vy-240,-430), vx*1.15` regardless of where you are in the arc (baseline carry 1.76× from 318 px/s — the same launch at the bottom or the top); hero uses one painted 'swing' frame rotated; vine drawn from body centre; camera only looks ahead by face*44 + vx*0.2, no swing framing.
- Vine Whip: hit-test is the same rectangle as a sword with an "is it far away" tip test; the visual is a crescent arc + quadratic curve (reads like a sword swipe, not a whip); hero uses the sword cut/rev/rise/slam frames; only forward (+rise); 15 hit-stop frames over a 4-hit combo; no real crack moment, no recoil, no yank except the finisher's pull.
- reach.js duplicates the swing integrator (pump 520, drag 0.15, cap 560, fixed release) → must move to a shared function so the validator proves exactly what the game does.
Baseline numbers (shots/v24/before/feel.json): attach jerk 50 px/s/frame, pump max speed 283 → 446 px/s over 4 s, release 318 → 560 px/s (carry 1.76), whip 44 active frames / 15 hit-stop frames per 4-hit combo, bow 2 hits both 9 dmg (hold gave no charged shot inside 50 f).

## Phase 2 — Hook swing (in progress, 2026-10-25)
- physics.js: new shared `SWING` constants + `swingInit / swingStep / swingRelease`; player.js AND reach.js now run the same integrator (validator can never drift from the game).
  - pump is projected on the rope tangent (only below the anchor; full with the motion, 0.7 against = brake), drag 0.15 -> 0.035/s (near-lossless pendulum), cap 560 -> 580 soft.
  - reel is rate- AND accel-limited (lenV, 4200 px/s²) -> no snap; reel-in conserves angular momentum (capped 4%/step).
  - attach: ground pop 240 spread over 0.12 s (was 0.08 s), first taut frame converts 35% of the killed radial speed into swing speed (no dead stop / pop).
  - release: old launch (vy-240, min -430, vx*1.15) PLUS speed boost up to 110 px/s; forward up-swing "sweet" release = vx*1.28 + WHOOSH ring + small zoom kick.
- player: swing poses c_swing_m/b/f (rig), release flip (c_tuck spun about body centre), vine from the hand, leaf trail at speed, thwip on attach, whoosh scaled by speed past the bottom, buffered re-hook (0.22 s), current anchor excluded by position (bug: identity compare never matched).
- world: swing look-ahead vx*0.32 (±96) eased 0.075, anchor-biased framing, speed zoom-out up to 6 %, reticle lock-on snap + shown for the NEXT anchor while swinging, anchor-ahead bias.
- tapered vine (thick at anchor), lands slack and pulls taut in ~0.2 s with decaying twang, grip wrap at the hand.
- sfx: thwip, swingWhoosh, swingSweet (+ whip/bow set for later phases), sfxV() per-call volume.
- validator: validateAllChunks() = 0 problems (35.7 s) with the new integrator.
- fix: energy reference was taken after gravity -> corrected; drag 0.02/s. Pure-sim pendulum: ~1.7 %/half-swing decay (was ~10 %), game probe peaks 236/228/223/218.
- after1 probe: swing drift -3.7 % (was -10.1), pump 345 -> 525 (was 283 -> 446), release 356 -> 619 px/s (was 318 -> 560), release distance 474 px (was 416), attach impulse spread over 7 frames (max 40/frame, was a 50 step), 0 page errors. validateAllChunks = 0 problems.

## Phase 3 — Vine Whip (in progress)
- [step] src/whip.js: 12-link verlet-free kinematic chain; handle angle wind→strike (easeOutCubic) with a travelling bend (lag) so the tip arrives last and "cracks" at crackTime; overshoot + settle = follow-through; link extension recoil.
- [step] Hits are swept per link (prev→cur box) only in the active phase: tip links 9–11 = TIP crit zone (spark, camera punch zoomKick .35, shake, whipTip sfx), body links 3–8 = normal hit.
- [step] Directional lashes: forward combo cut→rev→rise→fin(4 hits, distinct arcs), up (hold up), diagonal (up+forward), air, down (air+down = pogo lash). Finisher yanks light foes toward you.
- [step] New poses c_whip_a/s/f, c_whipup_s, c_whipdn_s (wind-up / lash / follow-through). Recovery 0.11–0.2 s; moveMul .78 keeps attack steering.
- [check] run-all (with whip dist) 111/111 PASS.
- [probe after2] whip combo vs dummy @85px: 4/4 hits (wcut f7, wrev f25, wrise f45, wfin f67), 3 tip-zone crits (TIP! x1.5), 45 active frames, 14 hit-stop frames, 0 page errors. Strip: shots/v24/after2/whip-strip.png.
- [commit] phase 3 (whip). Bow work (src/bow.js etc.) started in the same tree, committed as phase 4 next.

## Phase 4 — Thornbow (existed since v1.x as a shop weapon; now a real earnable style)
- [step] src/bow.js: one button. Tap (<0.12 s) = quick shot 8 dmg, 780 px/s, arcs (g 430), cd 0.2 s. Hold = draw k 0→1 over 0.55 s (bowDraw sfx, bowFull sfx + spark at full). Release k≥0.3 = power shot 11→22 dmg, 820→1180 px/s, flatter; full = pierce + breaks + recoil + camera punch.
- [step] Aim: 8-way from the stick (up / up-forward / forward / air down) + soft auto-aim (±23° cone, 430 px, line of sight, gravity-compensated lead). Quick shots aim at the body, charged shots at the head.
- [step] Weakpoint: arrow in the top third of a foe = BULLSEYE! crit x1.5 (bullseye sfx, gold sparks, zoom punch). Arrows stick in walls and wobble, trail ribbon, fletching; dotted predicted arc + target bracket while drawing.
- [step] Poses c_bow_nock → c_bow_draw → c_bow_rel (0.16 s), procedural bow limbs bend with draw, string vibrates after release. Movement slows while drawing; air draw caps fall to 150 px/s (aim hang). Dash / hurt / hook-fire cancel the draw cleanly.
- [step] Unlock: STYLES += bow (swap cycles 4), REWARDS gets 'wpn:bow' after 'cape:sky'; shop item still works. saveVer 24 migration: veterans past the bow's slot get it as their first open mission's reward; nothing else touched.
- [fix] bowCd undefined → never fired (undefined <= 0 is false). Fixed with !(bowCd > 0).
- [tests] tests/v24.mjs written (25 checks). First run: tap-DPS blade 36 / hammer 59 (unchanged v2.0 hammer) / whip 41 / bow 31.

## Phase 7 — feel-director review (Oct 25, 2026)
### Iteration 1 (shots/v24/bow1: plots.png, *-strip.png)
- Swing (no input): energy kept (drift −3.7%), but the PUMP trace showed saw-tooth spikes every half-swing.
- Whip: 4 cracks visible as tip-speed spikes (2–7k px/s), hits f7/25/45/67. Bow: quick arc vs charged lifted arc, draw k ramps linearly to 1 in ~0.55 s.
- Scores: swing 7.5 (pump spikes = rope going slack above the anchor then snapping), whip 8.5, bow 8.5.
### Iteration 2 (shots/v24/iter2)
- Root cause of the pump spikes (debug /tmp/pumpdbg.mjs): Player.postMove called moveBody AGAIN after swingStep, so on a rope the body moved twice per step (a bug since v1.x). The constraint then yanked it back every frame → hidden jitter, energy gain/loss, slack + snap at the top of big pumps.
- Fixes: postMove skips the move while swinging; swing gravity scale SWING.G_K = 1.3 (true pendulum would be floaty once the double move was gone); pumping is energy-capped at ARC_MAX 0.9 (~85°) so the rope never goes slack from pumping.
- Result: free-swing drift 0%, peak decay −5% over 3 swings, attach jerk 50, pump 322→580 smooth (0 snaps, was 4), release 504→713 px/s, 552 px carry (v2.3: 448).
- Scores: swing 8.5, whip 8.5, bow 8.5.
### Iteration 3 (shots/v24/iter3)
- Tried widening the whip finisher's tip zone so an 85 px finisher crits; no change (the overhead slam passes the dummy with the inner vine, the tip lands beyond) → reverted; finisher crits only at full range by design.
- tests/v24 re-run after the swing fix: 25/25 (drift 0, jerk 50, pump 318→580, release 501→712 px/s, 554 px).
- Strips/plots regenerated: release strip shows a clean launch arc into a landing roll; pump trace has no slack spikes.
- Final honest scores: swing 8.5, whip 8.5, bow 8.5 (see report for what keeps each from 9+).

## Phase 6 — full suite (clean, sequential, no builds in between)
- run-all 111/111, v21 32/32, v22 34/34, v23 21/21, v24 25/25, reach validator 0 chunk problems.
## Phase 8 — ship
- Bumped 2.4.0 / versionCode 16 (package.json, mobile/package.json, build.gradle). Android build started.
- Signed APK (9.7 MB) + AAB (9.5 MB): apksigner verified, cert SHA-256 6e59e14a…d35d8de matches for both; aapt: versionCode 16 / 2.4.0. Source zip 16 MB (src, tests, tools, docs, assets, mobile, shots/v24 as 1000px JPEG).
