#!/usr/bin/env bash
# Web build -> Capacitor sync -> release APK (zipaligned + apksigner) and AAB (jarsigner) into ../release/
# Needs JDK 17 (JAVA_HOME), Android SDK (ANDROID_HOME). Signing: KEYSTORE, alias boomerangbrawl, password in $KSPW.
set -euo pipefail
cd "$(dirname "$0")"
: "${JAVA_HOME:?set JAVA_HOME to a JDK 17}"; : "${ANDROID_HOME:?set ANDROID_HOME}"; export PATH="$JAVA_HOME/bin:$PATH"
BT="$ANDROID_HOME/build-tools/36.0.0"; [ -d "$BT" ] || BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
KEYSTORE="${KEYSTORE:-$HOME/dev/keys/bb-release.jks}"; ALIAS="${ALIAS:-boomerangbrawl}"
(cd .. && node build.mjs)
rm -rf www && mkdir -p www && cp -r ../dist/* www/
npx cap sync android
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
(cd android && ./gradlew assembleRelease bundleRelease --no-daemon -q)
mkdir -p ../release
"$BT/zipalign" -f -p 4 android/app/build/outputs/apk/release/app-release-unsigned.apk /tmp/rs-aligned.apk
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" --ks-pass env:KSPW --key-pass env:KSPW --out ../release/Rootswing.apk /tmp/rs-aligned.apk
cp android/app/build/outputs/bundle/release/app-release.aab ../release/Rootswing.aab
jarsigner -keystore "$KEYSTORE" -storepass:env KSPW -keypass:env KSPW -sigalg SHA256withRSA -digestalg SHA-256 ../release/Rootswing.aab "$ALIAS" >/dev/null
rm -f ../release/*.idsig; "$BT/apksigner" verify ../release/Rootswing.apk && echo "APK signed+verified"; jarsigner -verify ../release/Rootswing.aab | tail -1
ls -la ../release
