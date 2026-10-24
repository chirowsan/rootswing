# Rootswing

A small, original 2D action platformer for Android and the web. You play a little sprout with a vine hook, swinging through a ruined city that is slowly turning green again.

- **Play in the browser:** https://chirowsan.github.io/rootswing/
- **Android APK:** see [Releases](https://github.com/chirowsan/rootswing/releases)

## What's in it
- **Moves:** run, jump (hold for higher), wall-slide and wall-jump, dash (you can't be hit mid-dash), and a vine hook to **swing** or **zip** to rings. Coyote time, jump buffering, ledge help and hook aim-assist make it forgiving.
- **Fighting:** combo attacks, a heavy attack (hold attack), parry, 4 weapons (Rustblade, Vinelash, Gearhammer, Thornbow), 2 skills (Popseed, Thornling), and Dew Flasks for healing. Enemies pop into sparks.
- **World:** a calm hub garden, then *Rustvine Overpass*: 15–25 randomly arranged rooms with hidden secret rooms, a mini-boss (the Warden) and a 3-phase boss (the Furnace).
- **Keep what you earn:** glimmers buy permanent unlocks in the hub. Progress, settings and a mid-run checkpoint are saved on the device.
- **Gentle by default:** game speed 0.8 and Easy difficulty (both adjustable). There's an option to reduce screen shake, plus music and sound toggles.
- **Controls:** touch (stick on the left, buttons on the right), keyboard, or a gamepad.

Free. No accounts, no ads, no network calls. Everything runs locally.

## Keyboard
Arrows/WASD move · Space/Z jump · X attack (hold for heavy) · Shift/C dash · V hook · F parry · Q/1 and R/2 skills · H/3 flask · Esc pause

## Build
```bash
npm install && npm run build      # -> dist/
npm test                          # headless puppeteer suite (needs puppeteer available)
cd mobile && npm install && ./build-android.sh   # needs JDK 17, Android SDK, KEYSTORE + KSPW
```

## Art (v1.1)
v1.1 replaces the flat code-drawn look with painted backgrounds, tiles, props, characters, a cutout-rigged hero, a painted HUD and lighting/particle effects. See [docs/ART.md](docs/ART.md). Game-ready WebP atlases are in `assets/gfx/`; source paintings are in `art/src/` (rebuilt with `python3 tools/build-art.py`). The Graphics **Fast** setting (and automatic low-performance mode) turns off the lighting, outlines and particles, and the old code-drawn fallback still works if the images fail to load. All sound and music are made with WebAudio. MIT licensed.

Before/after screenshots: `shots/before/` vs `shots/after/`.

## Art (v1.2): readability pass
- **Bigger on screen:** the camera is closer (250 world units tall, 270 in the boss arena; it was 340), and the hero rig is drawn 1.22x (1.28x in the boss arena) around the feet. On a 915x412 phone the hero is about 1.6–1.66x taller than in v1.1. Controls, physics and hitboxes are unchanged. The look-ahead was raised a little to fit the narrower view.
- **Hero rig:** separate hood and leaf sprout, with spring-driven secondary motion on the sprout; a back arm that counter-swings; expressive eyes (blink, angry, focused, hurt, knocked-out); a knee-lift run cycle; and the face now points the way the hero runs.
- **Separation:** the far and mid paintings are blurred, desaturated and darkened at build time, with cool depth-fog veils between layers. Enemies and bosses get an ink outline plus a red-orange danger rim, and every hook anchor glows the same cyan.
- **Results screens:** painted victory and death screens with full-bleed key art, a glimmer count-up and progress toward Seedhouse unlocks.

v1.1 vs v1.2 screenshots: `shots/v11/` vs `shots/v12/`; side-by-side sheets: `shots/compare-v12-*.png` (built with `python3 tools/compare.py`).
