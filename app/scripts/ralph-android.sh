#!/usr/bin/env bash
# Ralph 循环：静态验证 → Metro 探测 → 权限预授 → 深链冷启（拉最新 bundle）→ Maestro flow → 截图供 agent 看图
set -e
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
S=${ADB_SERIAL:-emulator-5554}
PKG=com.augustone.timescavenger
METRO_HOST=${METRO_HOST:-localhost}
FLOW=${1:-maestro/01_smoke.yaml}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"
npx tsc --noEmit
npx jest --silent

# Metro 必须在跑，否则 debug APK 回落 assets 红屏
code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8081/status" || true)
if [ "$code" != "200" ]; then
  echo "ERROR: Metro 未在 8081 运行（先 npx expo start --port 8081）" >&2
  exit 1
fi

"$ADB" -s "$S" reverse tcp:8081 tcp:8081
"$ADB" -s "$S" shell pm grant "$PKG" android.permission.READ_MEDIA_IMAGES || true
"$ADB" -s "$S" shell pm grant "$PKG" android.permission.READ_MEDIA_VIDEO || true
"$ADB" -s "$S" shell pm grant "$PKG" android.permission.ACCESS_MEDIA_LOCATION || true

"$ADB" -s "$S" shell am force-stop "$PKG"
sleep 1
"$ADB" -s "$S" shell "am start -a android.intent.action.VIEW -d 'timescavenger://?__expo_url=http%3A%2F%2F${METRO_HOST}%3A8081&__expo_disable_fab=1' $PKG" >/dev/null
sleep 12

"$ADB" -s "$S" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
maestro test --device "$S" "$FLOW"
mkdir -p ../screens
"$ADB" -s "$S" exec-out screencap -p > "../screens/android-$(date +%H%M%S).png"
echo "ralph done: flow=$FLOW"
