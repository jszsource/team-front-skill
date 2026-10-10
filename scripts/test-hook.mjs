#!/usr/bin/env node
// Tests hooks/front-check.mjs and scripts/hook-settings.mjs against temp projects.
// Usage: node scripts/test-hook.mjs   (or: npm run test:hook). Node 20+, zero dependencies.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(ROOT, 'hooks', 'front-check.mjs');
const SETTINGS = join(ROOT, 'scripts', 'hook-settings.mjs');
const failures = [];
let passed = 0;

function expect(ok, message) {
  if (ok) passed += 1;
  else failures.push(message);
}

const tmp = mkdtempSync(join(tmpdir(), 'front-check-'));
function write(rel, content) {
  const p = join(tmp, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
}

function runHook(file, env = {}) {
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Write', cwd: tmp, tool_input: { file_path: file } }),
    encoding: 'utf8',
    env: { ...process.env, TEAM_FRONT_HOOK_ESLINT: 'off', ...env },
  });
}

const code = (n) => Array.from({ length: n }, (_, i) => `const v${i} = ${i};`).join('\n');
const padded = (n) => `${code(n)}\n\n// comment\n/* block\n comment */\n\n`;

try {
  write('app/package.json', JSON.stringify({ dependencies: { react: '19.0.0' } }));
  write('app/components.json', '{}');
  write('lib/package.json', JSON.stringify({ dependencies: { lodash: '4.0.0' } }));

  const cases = [
    ['150 code lines + blanks/comments .tsx passes', 'app/src/Ok.tsx', padded(150), 0],
    ['151-line .tsx fails with §3.1', 'app/src/Big.tsx', code(151), 2, /§3\.1/],
    ['test file is exempt', 'app/src/Big.test.tsx', code(400), 0],
    ['shadcn source is exempt', 'app/src/shared/ui/sidebar.tsx', code(400), 0],
    ['81-line hook fails with §9', 'app/src/useThing.ts', code(81), 2, /§9/],
    ['80-line hook passes', 'app/src/useOk.ts', code(80), 0],
    ['long non-hook .ts passes', 'app/src/api.ts', code(300), 0],
    ['non-frontend package is skipped', 'lib/src/Big.tsx', code(400), 0],
    ['non-code file is skipped', 'app/README.md', code(400), 0],
  ];
  for (const [name, rel, content, status, stderr] of cases) {
    const res = runHook(write(rel, content));
    expect(res.status === status, `${name}: exit ${res.status}, expected ${status}\n${res.stderr}`);
    if (stderr) expect(stderr.test(res.stderr), `${name}: stderr does not match ${stderr}: ${res.stderr}`);
  }
  expect(runHook(join(tmp, 'app/src/Big.tsx'), { TEAM_FRONT_HOOK: 'off' }).status === 0, 'TEAM_FRONT_HOOK=off does not disable');
  const garbage = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
  expect(garbage.status === 0, `invalid stdin must not fail: exit ${garbage.status}`);

  // settings.json registration: keeps other settings, idempotent, removable.
  const claude = join(tmp, 'proj', '.claude');
  mkdirSync(claude, { recursive: true });
  const existing = { permissions: { allow: ['Bash(ls)'] }, hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }] } };
  writeFileSync(join(claude, 'settings.json'), JSON.stringify(existing));
  const settings = (action) => spawnSync(process.execPath, [SETTINGS, action, claude], { encoding: 'utf8' });
  const readSettings = () => JSON.parse(readFileSync(join(claude, 'settings.json'), 'utf8'));
  const ours = (s) => (s.hooks?.PostToolUse ?? []).flatMap((g) => g.hooks).filter((h) => h.command.includes('front-check.mjs'));

  settings('add');
  settings('add');
  let s = readSettings();
  expect(ours(s).length === 1, `add twice must register exactly one hook, got ${ours(s).length}`);
  expect(ours(s)[0]?.command.includes('$CLAUDE_PROJECT_DIR/.claude/hooks/front-check.mjs'), `project install must use $CLAUDE_PROJECT_DIR: ${ours(s)[0]?.command}`);
  expect(s.permissions?.allow?.[0] === 'Bash(ls)', 'add must keep other settings');
  expect(s.hooks.PostToolUse.some((g) => g.matcher === 'Bash'), 'add must keep other hooks');
  settings('remove');
  s = readSettings();
  expect(ours(s).length === 0, 'remove must unregister the hook');
  expect(JSON.stringify(s) === JSON.stringify(existing), `remove must restore the original settings: ${JSON.stringify(s)}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`✖ ${failures.length} hook test(s) failed (${passed} passed):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✔ ${passed} hook tests passed`);
