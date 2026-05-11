#!/usr/bin/env bash
# Regenerate all PULSE app icons + splash images from the SVG masters.
# Uses macOS built-ins (`qlmanage` for SVG -> PNG, `sips` for resize)
# so no external tools needed.
#
# Outputs:
#   public/favicon.png            32×32   (browser tab)
#   public/apple-touch-icon.png  180×180  (iOS Safari home-screen add)
#   public/icon-192.png          192×192  (PWA manifest icon)
#   public/icon-512.png          512×512  (PWA manifest icon)
#   ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
#                              1024×1024  (iOS native app icon)
#   ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png
#   splash-2732x2732-1.png
#   splash-2732x2732-2.png       2732×2732 (iOS native launch screen)
#
# Run from repo root:  bash scripts/generate-icons.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

ICON_SRC="scripts/icon-master.svg"
SPLASH_SRC="scripts/splash-master.svg"
TMP_DIR="$(mktemp -d -t pulse-icons)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [ ! -f "$ICON_SRC" ] || [ ! -f "$SPLASH_SRC" ]; then
  echo "ERR: master SVGs missing at $ICON_SRC and/or $SPLASH_SRC" >&2
  exit 1
fi

echo "═══ Rendering icon-master.svg → 1024px PNG via qlmanage..."
qlmanage -t -s 1024 -o "$TMP_DIR" "$ICON_SRC" >/dev/null 2>&1
ICON_1024="$TMP_DIR/icon-master.svg.png"
[ -f "$ICON_1024" ] || { echo "ERR: qlmanage did not produce $ICON_1024" >&2; exit 1; }

echo "═══ Rendering splash-master.svg → 2732px PNG via qlmanage..."
qlmanage -t -s 2732 -o "$TMP_DIR" "$SPLASH_SRC" >/dev/null 2>&1
SPLASH_2732="$TMP_DIR/splash-master.svg.png"
[ -f "$SPLASH_2732" ] || { echo "ERR: qlmanage did not produce $SPLASH_2732" >&2; exit 1; }

resize() {
  local size="$1" out="$2"
  echo "  → ${size}×${size}  $out"
  sips -z "$size" "$size" "$ICON_1024" --out "$out" >/dev/null
}

echo "═══ Writing icon variants..."
resize 32   public/favicon.png
resize 180  public/apple-touch-icon.png
resize 192  public/icon-192.png
resize 512  public/icon-512.png
resize 1024 ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png

echo "═══ Writing splash variants..."
SPLASH_DIR="ios/App/App/Assets.xcassets/Splash.imageset"
cp "$SPLASH_2732" "$SPLASH_DIR/splash-2732x2732.png"
cp "$SPLASH_2732" "$SPLASH_DIR/splash-2732x2732-1.png"
cp "$SPLASH_2732" "$SPLASH_DIR/splash-2732x2732-2.png"
echo "  → 2732×2732 ×3  $SPLASH_DIR/"

echo "═══ Done. Built from $ICON_SRC + $SPLASH_SRC."
