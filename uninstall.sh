#!/usr/bin/env sh
# Removes the team frontend skills, agents and command from a .claude directory.
# Usage: uninstall.sh [target-.claude-dir]   (default: ./.claude)
# Only removes files installed by this package; backups in .team-front-backup are kept.
# Keep behaviour identical to uninstall.ps1.
set -e

TARGET="${1:-./.claude}"

for item in \
  skills/team-frontend \
  skills/front-template \
  agents/front-reviewer.md \
  agents/front-refactorer.md \
  commands/front-setup.md; do
  if [ -e "$TARGET/$item" ]; then
    rm -rf "${TARGET:?}/$item"
    echo "Removed $TARGET/$item"
  fi
done

echo "Uninstalled team-front-skill from $TARGET"
