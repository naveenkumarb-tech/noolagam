#!/bin/sh
# Builds the Android app with Docker. The API address is built into the app, so it needs one to talk to.
#
#   frontend/build-apk.sh http://192.168.1.50:8000      Your computer, for phones on the same Wi-Fi
#   frontend/build-apk.sh https://api.example.com       A hosted backend, which works anywhere
#
# The result is apk/noolagam-debug.apk.
set -eu

API_URL="${1:-}"
case "$API_URL" in
  http://*|https://*) ;;
  *) echo "Usage: $0 <api-url>, for example: $0 http://192.168.1.50:8000" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER_ID="$(id -u):$(id -g)"

echo "==> Building the web app for $API_URL"
docker run --rm --user "$USER_ID" -e HOME=/tmp -e VITE_API_URL="$API_URL" \
  -v "$ROOT/frontend":/app -w /app node:22-alpine \
  sh -c "npm install --no-audit --no-fund --loglevel=error && npm run build && npx cap sync android"

echo "==> Preparing the Android tools (slow the first time)"
docker build -q -f "$ROOT/frontend/android.Dockerfile" -t noolagam-android-builder "$ROOT/frontend" > /dev/null

echo "==> Building the APK (slow the first time)"
docker volume create noolagam-gradle-cache > /dev/null
docker run --rm -v noolagam-gradle-cache:/gradle alpine chown "$USER_ID" /gradle
# ANDROID_USER_HOME keeps the debug signing key between builds. Android refuses to update an app
# signed with a different key, which would mean uninstalling it and losing the saved login.
docker run --rm --user "$USER_ID" -e HOME=/tmp -e GRADLE_USER_HOME=/gradle -e ANDROID_USER_HOME=/gradle/android \
  -e VITE_API_URL="$API_URL" \
  -v noolagam-gradle-cache:/gradle -v "$ROOT/frontend":/app -w /app/android noolagam-android-builder \
  sh -c "chmod +x gradlew && ./gradlew assembleDebug --no-daemon --console=plain --warning-mode=none"

mkdir -p "$ROOT/apk"
cp "$ROOT/frontend/android/app/build/outputs/apk/debug/app-debug.apk" "$ROOT/apk/noolagam-debug.apk"
echo "==> Done: apk/noolagam-debug.apk ($(du -h "$ROOT/apk/noolagam-debug.apk" | cut -f1))"
