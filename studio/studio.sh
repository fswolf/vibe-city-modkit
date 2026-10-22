#!/usr/bin/env bash
# Run VC Novel Studio from this folder.
#   ./studio.sh                    the app window (after npm install), or the browser if Electron is not installed
#   ./studio.sh ../templates/visual-novel   open a novel folder
#   ./studio.sh --browser          always in your browser (node server.js)
#   PORT=8791 ./studio.sh --browser
cd "$(dirname "$(readlink -f "$0")")" || exit 1
for E in ./node_modules/.bin/electron ../release/node_modules/.bin/electron; do
  if [ "$1" != "--browser" ] && [ -x "$E" ]; then exec "$E" . "$@"; fi
done
[ "$1" = "--browser" ] && shift
command -v node >/dev/null || { echo "Node.js is not installed. Get it from https://nodejs.org or your package manager."; exit 1; }
exec node server.js "$@" --port "${PORT:-8790}"
