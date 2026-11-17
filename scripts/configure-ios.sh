#!/usr/bin/env bash
set -euo pipefail
# Configure the Capacitor-generated iOS target. Safe to run repeatedly on macOS.
PLIST="${1:-ios/App/App/Info.plist}"
if [[ ! -f "$PLIST" ]]; then
  echo "iOS Info.plist not found: $PLIST" >&2
  exit 1
fi
PB=/usr/libexec/PlistBuddy
upsert_string() {
  local key="$1" value="$2"
  if "$PB" -c "Print :$key" "$PLIST" >/dev/null 2>&1; then
    "$PB" -c "Set :$key $value" "$PLIST"
  else
    "$PB" -c "Add :$key string $value" "$PLIST"
  fi
}
upsert_string CFBundleDisplayName "WorkSet"
if [[ -n "${WORKSET_IOS_APP_VERSION:-}" ]]; then
  upsert_string CFBundleShortVersionString "$WORKSET_IOS_APP_VERSION"
fi
if [[ -n "${WORKSET_IOS_BUILD_NUMBER:-}" ]]; then
  upsert_string CFBundleVersion "$WORKSET_IOS_BUILD_NUMBER"
fi
upsert_string NSLocationWhenInUseUsageDescription "WorkSet uses your location to map walks, runs and rides while tracking is active."
upsert_string NSLocationAlwaysAndWhenInUseUsageDescription "WorkSet records your route while the screen is locked during an active workout. Recording stops when the workout ends."
upsert_string NSMotionUsageDescription "WorkSet uses motion data to estimate steps during an active walk or run."
upsert_string NSCameraUsageDescription "WorkSet uses the camera only when you choose to scan a workout invitation QR code."
if ! "$PB" -c 'Print :UIBackgroundModes' "$PLIST" >/dev/null 2>&1; then
  "$PB" -c 'Add :UIBackgroundModes array' "$PLIST"
fi
if ! "$PB" -c 'Print :UIBackgroundModes' "$PLIST" | grep -q 'location'; then
  "$PB" -c 'Add :UIBackgroundModes:0 string location' "$PLIST"
fi
# Never request location at launch. The background watcher requests consent
# only when a user explicitly starts a GPS workout.
echo "Configured WorkSet iOS location, motion and camera descriptions."
