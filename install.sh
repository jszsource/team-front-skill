#!/usr/bin/env sh
# Installs the team frontend skills, agents and command into a .claude directory.
# Usage: install.sh [target-.claude-dir]   (default: ./.claude)
#
# - Writes the package version to <skill>/.installed-version.
# - If an installed skill folder differs from the one being installed (local
#   edits or an older version), it is backed up to
#   <target>/.team-front-backup/<skill>-<old-version> before being replaced.
# Keep behaviour identical to install.ps1.
set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-./.claude}"
STAMP=".installed-version"
VERSION="$(tr -d ' \r\n' < "$SRC/VERSION")"
BACKUP_ROOT="$TARGET/.team-front-backup"

mkdir -p "$TARGET/skills" "$TARGET/agents" "$TARGET/commands"

OLD_VERSION="none"
if [ -f "$TARGET/skills/team-frontend/$STAMP" ]; then
  OLD_VERSION="$(tr -d ' \r\n' < "$TARGET/skills/team-frontend/$STAMP")"
elif [ -d "$TARGET/skills/team-frontend" ]; then
  OLD_VERSION="unknown"
fi

for skill in "$SRC"/skills/*/; do
  name="$(basename "$skill")"
  dest="$TARGET/skills/$name"
  if [ -d "$dest" ]; then
    prev="unknown"
    [ -f "$dest/$STAMP" ] && prev="$(tr -d ' \r\n' < "$dest/$STAMP")"
    # Same files + contents (ignoring the stamp) -> nothing to back up.
    if ! diff -rq -x "$STAMP" "${skill%/}" "$dest" > /dev/null 2>&1; then
      backup="$BACKUP_ROOT/$name-$prev"
      [ -e "$backup" ] && backup="$backup-$(date +%Y%m%d%H%M%S)"
      mkdir -p "$BACKUP_ROOT"
      cp -R "$dest" "$backup"
      if [ "$prev" = "$VERSION" ]; then
        echo "WARNING: local modifications in $dest (v$prev) - backed up to $backup"
      else
        echo "WARNING: $dest (v$prev) differs from v$VERSION (older version and/or local edits) - backed up to $backup"
      fi
    fi
    rm -rf "$dest"
  fi
  cp -R "${skill%/}" "$TARGET/skills/"
  printf '%s\n' "$VERSION" > "$dest/$STAMP"
done
cp "$SRC"/agents/*.md "$TARGET/agents/"
cp "$SRC"/commands/*.md "$TARGET/commands/"

echo "team-front-skill: $OLD_VERSION -> $VERSION"
echo "Installed team-frontend + front-template skills, front-reviewer/front-refactorer agents and /front-setup into $TARGET"
