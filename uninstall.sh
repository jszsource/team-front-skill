#!/usr/bin/env sh
# Removes the team frontend skills, agents and command from a .claude directory.
# Usage: uninstall.sh [target-.claude-dir]   (default: ./.claude)
# Only removes files installed by this package; backups in .team-front-backup are kept.
# Keep behaviour identical to uninstall.ps1.
set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-./.claude}"

if command -v node > /dev/null 2>&1; then
  node "$SRC/scripts/hook-settings.mjs" remove "$TARGET"
else
  echo "WARNING: node not found - remove the front-check hook from $TARGET/settings.json by hand"
fi

for item in \
  skills/team-frontend \
  skills/front-template \
  agents/front-reviewer.md \
  agents/front-refactorer.md \
  commands/front-setup.md \
  hooks/front-check.mjs; do
  if [ -e "$TARGET/$item" ]; then
    rm -rf "${TARGET:?}/$item"
    echo "Removed $TARGET/$item"
  fi
done

echo "Uninstalled team-front-skill from $TARGET"
