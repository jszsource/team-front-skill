#!/usr/bin/env sh
# Installs the team frontend skills, agents and command into a .claude directory.
# Usage: install.sh [target-.claude-dir]   (default: ./.claude)
#
# - Writes the package version to <skill>/.installed-version.
# - If an installed skill folder differs from the one being installed (local
#   edits or an older version), it is backed up to
#   <target>/.team-front-backup/<skill>-<old-version> before being replaced.
# - A differing installed agent/command/hook file is backed up to
#   <target>/.team-front-backup/<agents|commands|hooks>-<old-version>/<file>.
# - Registers the front-check PostToolUse hook in <target>/settings.json
#   (needs node; other settings are kept).
# Keep behaviour identical to install.ps1.
set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-./.claude}"
STAMP=".installed-version"
VERSION="$(tr -d ' \r\n' < "$SRC/VERSION")"
BACKUP_ROOT="$TARGET/.team-front-backup"

mkdir -p "$TARGET/skills" "$TARGET/agents" "$TARGET/commands" "$TARGET/hooks"

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
# Agents, commands and the hook script: back up a differing installed file before overwriting it.
for kind in agents commands hooks; do
  for file in "$SRC/$kind"/*.md "$SRC/$kind"/*.mjs; do
    [ -f "$file" ] || continue
    name="$(basename "$file")"
    dest="$TARGET/$kind/$name"
    if [ -f "$dest" ] && ! cmp -s "$file" "$dest"; then
      backup="$BACKUP_ROOT/$kind-$OLD_VERSION/$name"
      [ -e "$backup" ] && backup="$backup.$(date +%Y%m%d%H%M%S)"
      mkdir -p "$(dirname "$backup")"
      cp "$dest" "$backup"
      echo "WARNING: $dest differs from v$VERSION - backed up to $backup"
    fi
    cp "$file" "$dest"
  done
done

if command -v node > /dev/null 2>&1; then
  node "$SRC/scripts/hook-settings.mjs" add "$TARGET"
else
  echo "WARNING: node not found - hooks/front-check.mjs copied but not registered in $TARGET/settings.json"
fi

echo "team-front-skill: $OLD_VERSION -> $VERSION"
echo "Installed team-frontend + front-template skills, front-reviewer/front-refactorer agents, /front-setup and the front-check hook into $TARGET"
