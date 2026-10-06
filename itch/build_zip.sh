#!/usr/bin/env bash
# Package the game for an itch.io HTML upload.
#
# itch serves the zip's contents directly, so index.html must sit at the root and
# every path inside it must be relative. Only what the game needs at runtime goes
# in: no tests, no tooling, no store art, no node_modules.
#
# fonts/OFL.txt is included deliberately. Fraunces is Open Font Licence, and the
# licence has to travel with the font files wherever they are redistributed.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="itch/beamline-web.zip"

rm -f "$OUT"
zip -q -r -X "$OUT" index.html favicon.svg css js fonts \
  -x "*.DS_Store" "*/.*"

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT" | tail -n +4
