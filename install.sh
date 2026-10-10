#!/usr/bin/env sh
# Installs the team frontend skill, agents and command into a .claude directory.
# Usage: install.sh [target-.claude-dir]   (default: ./.claude)
set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-./.claude}"

mkdir -p "$TARGET/skills" "$TARGET/agents" "$TARGET/commands"
for skill in "$SRC"/skills/*/; do
  name="$(basename "$skill")"
  rm -rf "$TARGET/skills/$name"
  cp -R "${skill%/}" "$TARGET/skills/"
done
cp "$SRC"/agents/*.md "$TARGET/agents/"
cp "$SRC"/commands/*.md "$TARGET/commands/"

echo "Installed team-frontend + front-template skills, front-reviewer/front-refactorer agents and /front-setup into $TARGET"
