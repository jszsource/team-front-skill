#!/usr/bin/env node
// Registers / removes the front-check PostToolUse hook in <target>/settings.json.
// Used by install.* / uninstall.* (copy-based installs; plugin installs use hooks/hooks.json).
// Usage: node scripts/hook-settings.mjs add|remove <target-.claude-dir>
// Node 20+, zero dependencies. Other settings and hooks are left untouched.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const MARKER = 'front-check.mjs';
const [action, targetArg] = process.argv.slice(2);
if (!['add', 'remove'].includes(action) || !targetArg) {
  console.error('Usage: node scripts/hook-settings.mjs add|remove <target-.claude-dir>');
  process.exit(1);
}

const target = resolve(targetArg);
const settingsPath = join(target, 'settings.json');
const isUserDir = target === resolve(homedir(), '.claude');

// A project's .claude/ is committed and shared → path relative to the project dir.
const command =
  basename(target) === '.claude' && !isUserDir
    ? `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${MARKER}"`
    : `node "${join(target, 'hooks', MARKER).replaceAll('\\', '/')}"`;

let settings = {};
if (existsSync(settingsPath)) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    console.error(`WARNING: ${settingsPath} is not valid JSON (${e.message}) - hook not ${action === 'add' ? 'registered' : 'removed'}`);
    process.exit(0);
  }
} else if (action === 'remove') {
  process.exit(0);
}

const isOurs = (h) => typeof h?.command === 'string' && h.command.includes(MARKER);
const post = (settings.hooks?.PostToolUse ?? [])
  .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((h) => !isOurs(h)) }))
  .filter((group) => group.hooks.length);

if (action === 'add') {
  post.push({ matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command, timeout: 60 }] });
}

settings.hooks = { ...settings.hooks, PostToolUse: post };
if (!post.length) delete settings.hooks.PostToolUse;
if (!Object.keys(settings.hooks).length) delete settings.hooks;

writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
console.log(`${action === 'add' ? 'Registered' : 'Removed'} front-check hook in ${settingsPath}`);
