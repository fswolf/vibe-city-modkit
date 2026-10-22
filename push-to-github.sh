#!/usr/bin/env bash
# Push the Vibe City Mod Kit to GitHub.
#
#   ./push-to-github.sh                       commit everything and push
#   ./push-to-github.sh -m "Add a template"   with your own commit message
#   ./push-to-github.sh --release             also build VC Novel Studio and publish a GitHub release
#
# Settings (change here or set them when you run it):
#   OWNER=fswolf REPO=vibe-city-modkit VISIBILITY=public ./push-to-github.sh
#
# The first run creates the repo on GitHub with the gh tool if you have it
# (https://cli.github.com, then: gh auth login). Without gh, create an empty
# repo on github.com with the same name first, then run this.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

OWNER="${OWNER:-fswolf}"
REPO="${REPO:-vibe-city-modkit}"
VISIBILITY="${VISIBILITY:-public}"
DESC="Templates, tools, docs and the VC Novel Studio editor for modding the Vibe City city builder."
MSG="Update the mod kit"
RELEASE=0
while [ $# -gt 0 ]; do
  case "$1" in
    -m) MSG="$2"; shift 2 ;;
    --release) RELEASE=1; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)"; exit 1 ;;
  esac
done

say() { printf '\033[36m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
command -v git >/dev/null || die "git is not installed (sudo dnf install git)."
HAS_GH=0; command -v gh >/dev/null && gh auth status >/dev/null 2>&1 && HAS_GH=1

# scripts lose their run bit on some copies
chmod +x push-to-github.sh studio/studio.sh templates/*/pack.sh 2>/dev/null || true

# ---- the local repo
if [ ! -d .git ]; then
  say "Starting a new git repo"
  git init -q -b main
fi
git config user.name >/dev/null || die "Set your git name first: git config --global user.name \"Your Name\""
git config user.email >/dev/null || die "Set your git email first: git config --global user.email you@example.com"

git add -A
if git diff --cached --quiet; then
  say "Nothing new to commit"
else
  git commit -q -m "$MSG"
  say "Committed: $MSG"
fi

# ---- the GitHub repo
if ! git remote get-url origin >/dev/null 2>&1; then
  if [ "$HAS_GH" = 1 ]; then
    if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
      git remote add origin "https://github.com/$OWNER/$REPO.git"
    else
      say "Creating $OWNER/$REPO on GitHub ($VISIBILITY)"
      gh repo create "$OWNER/$REPO" "--$VISIBILITY" --description "$DESC" --source . --remote origin
      gh repo edit "$OWNER/$REPO" --add-topic vibe-city --add-topic modding --add-topic city-builder --add-topic visual-novel --add-topic game-modding >/dev/null 2>&1 || true
    fi
  else
    git remote add origin "https://github.com/$OWNER/$REPO.git"
    say "No gh tool: make sure https://github.com/$OWNER/$REPO exists (empty) before the push."
  fi
fi

say "Pushing to $(git remote get-url origin)"
git push -u origin main

# ---- a release with the Studio built for this OS
if [ "$RELEASE" = 1 ]; then
  [ "$HAS_GH" = 1 ] || die "--release needs the gh tool, logged in (gh auth login)."
  command -v npm >/dev/null || die "--release needs Node.js and npm."
  VER="$(node -p 'require("./studio/package.json").version')"
  TAG="studio-v$VER"
  say "Building VC Novel Studio $VER"
  ( cd studio && npm install --no-audit --no-fund && if [ "$(uname -s)" = Darwin ]; then npm run build:mac; else npm run build; fi )
  FILES=$(find studio/dist -maxdepth 1 -type f \( -name '*.AppImage' -o -name '*.tar.gz' -o -name '*.zip' -o -name '*.dmg' \) | sort)
  [ -n "$FILES" ] || die "The build made no packages, see the output above."
  if gh release view "$TAG" >/dev/null 2>&1; then
    say "Adding to release $TAG"
    gh release upload "$TAG" $FILES --clobber
  else
    say "Publishing release $TAG"
    gh release create "$TAG" $FILES --title "VC Novel Studio $VER" --notes "VC Novel Studio $VER, the visual novel editor for Vibe City mods. Download the file for your system, no install needed."
  fi
fi

say "Done: https://github.com/$OWNER/$REPO"
