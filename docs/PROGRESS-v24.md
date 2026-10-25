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
