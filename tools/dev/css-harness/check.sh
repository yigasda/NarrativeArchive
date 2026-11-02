#!/usr/bin/env bash
# One command for a cleanup step: copy the extension to the local SillyTavern → capture --quick → compare with the baseline.
#   tools/dev/css-harness/check.sh <label> [extra capture args…]
#   tools/dev/css-harness/check.sh step41                      # quick matrix, compared with "baseline"
#   tools/dev/css-harness/check.sh step41 --only layers,panel  # a few scenes while iterating
# BASE=<label> compares with another label; ST_EXT=<dir> points at another SillyTavern install.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
LABEL="${1:?label}"; shift || true
case "$LABEL" in baseline|base*) echo "refusing to overwrite a baseline label ($LABEL)"; exit 2;; esac
BASE="${BASE:-baseline}"
ST_EXT="${ST_EXT:-$HOME/sillytavern/data/default-user/extensions/NarrativeArchive}"
[ -d "$ST_EXT" ] || { echo "no SillyTavern extension dir at $ST_EXT"; exit 2; }
cp -r "$ROOT/src" "$ROOT/style.css" "$ST_EXT/"
echo "copied to $ST_EXT · lines $(wc -l < "$ROOT/style.css") · !important $(grep -c '!important' "$ROOT/style.css") · :not(#na_x) $(grep -c ':not(#na_x)' "$ROOT/style.css")"
rm -rf "$HERE/out/$LABEL"
node "$HERE/capture.cjs" "$LABEL" --quick "$@"
node "$HERE/compare.cjs" "$BASE" "$LABEL"
