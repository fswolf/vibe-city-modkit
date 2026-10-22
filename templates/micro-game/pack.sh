#!/usr/bin/env bash
# pack.sh : packs this mod into one archive, <folder>.asar, the same way the
# game client packs itself into app.asar. The game (1.0.2 and later) loads a
# packed mod exactly like a loose folder.
#
#   ./pack.sh             build  ../packed/vb-visual.asar
#   ./pack.sh --install   build it and copy it into Documents/Vibe City/mods
#
# Only files the game can serve go in (pictures, pages, scripts, sounds,
# fonts, json, txt). README.md, this script and anything else stay out.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAME="$(basename "$HERE")"
OUT_DIR="$(cd "$HERE/.." && pwd)/packed"
OUT="$OUT_DIR/$NAME.asar"
KEEP='png|jpg|jpeg|webp|gif|svg|html|js|css|json|txt|ogg|mp3|wav|woff2'
MAX=$((64 * 1024 * 1024))

say()  { printf '\033[36m%s\033[0m\n' "$*"; }
warn() { printf '\033[33mwarning: %s\033[0m\n' "$*"; }
die()  { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# ---- checks
[ -f "$HERE/mod.json" ] || die "no mod.json in $HERE"
command -v node >/dev/null || die "node is needed (the same one you build the client with)"
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$HERE/mod.json" || die "mod.json is not valid JSON"
ID="$(node -p 'require(process.argv[1]).id' "$HERE/mod.json")"
VER="$(node -p 'require(process.argv[1]).version || "?"' "$HERE/mod.json")"

# ---- the asar tool: the one the client build already has, else fetch it once
ASAR=""
for c in "$HERE/../../release/node_modules/@electron/asar/bin/asar.js" \
         "$HERE/../../release/node_modules/.bin/asar"; do
  [ -e "$c" ] && { ASAR="$c"; break; }
done

# ---- stage a clean copy
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
COUNT=0
while IFS= read -r -d '' f; do
  rel="${f#"$HERE"/}"
  depth="$(tr -cd '/' <<<"$rel" | wc -c)"
  if [ "$depth" -gt 1 ]; then warn "skipped $rel (the game reads one sub folder deep at most)"; continue; fi
  if [ "$(stat -c %s "$f")" -gt "$MAX" ]; then warn "skipped $rel (over 64 MB)"; continue; fi
  mkdir -p "$STAGE/$(dirname "$rel")"; cp "$f" "$STAGE/$rel"; COUNT=$((COUNT + 1))
done < <(find "$HERE" -type f -regextype posix-extended -iregex ".*\.($KEEP)$" \
           -not -path '*/.*' -not -name '*.asar' -print0 | sort -z)
[ -f "$STAGE/mod.json" ] || die "mod.json did not make it into the stage"

# ---- pack
mkdir -p "$OUT_DIR"
say "packing $NAME ($ID $VER), $COUNT files"
if [ -n "$ASAR" ]; then node "$ASAR" pack "$STAGE" "$OUT"
else npx --yes @electron/asar pack "$STAGE" "$OUT"; fi
say "built $OUT ($(du -h "$OUT" | cut -f1))"

# ---- install
if [ "${1:-}" = "--install" ]; then
  DOCS="$(xdg-user-dir DOCUMENTS 2>/dev/null || echo "$HOME/Documents")"
  MODS="$DOCS/Vibe City/mods"
  mkdir -p "$MODS"; cp "$OUT" "$MODS/"
  say "installed to $MODS/$NAME.asar"
  if [ -d "$MODS/$NAME" ]; then
    warn "the loose folder $MODS/$NAME is still there. Both have the id \"$ID\", so the game"
    warn "loads the folder and skips the archive. Move the folder out to test the packed one."
  fi
fi
