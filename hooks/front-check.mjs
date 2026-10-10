#!/usr/bin/env node
// PostToolUse hook (Write | Edit | MultiEdit) for the team frontend standards.
// Node 20+, zero dependencies. Reads the hook event JSON from stdin.
//
// - `.tsx` file > COMPONENT_MAX_LINES (STANDARDS §3.1) or a `use*.ts(x)` hook
//   file > HOOK_MAX_LINES (STANDARDS §9) → feedback to Claude (exit 2).
//   Lines are counted like ESLint `max-lines` with skipBlankLines/skipComments.
// - If the project has ESLint installed, the edited file is linted too and
//   errors/warnings are fed back (`--max-warnings 0`, STANDARDS §11).
// Exit 0 = nothing to report. Never blocks on its own failures.
//
// Only runs in projects whose nearest package.json depends on `react` or `next`.
// Disable: TEAM_FRONT_HOOK=off · skip only ESLint: TEAM_FRONT_HOOK_ESLINT=off.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

// Keep in sync with the STANDARDS.md smells row (validator-enforced).
const COMPONENT_MAX_LINES = 150;
const HOOK_MAX_LINES = 80;
const ESLINT_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_LINES = 40;

const LINTABLE = /\.(tsx?|jsx?|mjs|cjs)$/;
const TEST_FILE = /\.(test|spec|stories)\.[jt]sx?$/;
const SKIP_DIR = /[\\/](node_modules|dist|build|\.next|coverage)[\\/]/;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

// Nearest package.json that depends on react/next → that directory, else null.
function findFrontendRoot(file) {
  let dir = dirname(file);
  for (;;) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
        return deps.react || deps.next ? dir : null;
      } catch {
        return null;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Non-blank lines that are not entirely comments (ESLint max-lines semantics).
function countCodeLines(source) {
  let inBlock = false;
  let count = 0;
  for (const raw of source.split(/\r?\n/)) {
    let line = raw.trim();
    let code = false;
    while (line) {
      if (inBlock) {
        const end = line.indexOf('*/');
        if (end === -1) {
          line = '';
        } else {
          inBlock = false;
          line = line.slice(end + 2).trim();
        }
      } else if (line.startsWith('//')) {
        line = '';
      } else if (line.startsWith('/*')) {
        inBlock = true;
        line = line.slice(2);
      } else {
        code = true;
        // A block comment opened after code on the same line.
        const open = line.lastIndexOf('/*');
        if (open !== -1 && line.indexOf('*/', open) === -1 && !line.slice(0, open).includes('//')) inBlock = true;
        line = '';
      }
    }
    if (code) count += 1;
  }
  return count;
}

function sizeFindings(file, root) {
  const name = basename(file);
  if (TEST_FILE.test(name)) return [];
  const rel = relative(root, file).replaceAll('\\', '/');
  // shadcn/ui sources are generated and lint-ignored (references/tooling.md).
  if (rel.startsWith('src/shared/ui/') && existsSync(join(root, 'components.json'))) return [];

  const lines = countCodeLines(readFileSync(file, 'utf8'));
  const findings = [];
  if (name.endsWith('.tsx') && lines > COMPONENT_MAX_LINES) {
    findings.push(
      `${rel}: ${lines} lines > ${COMPONENT_MAX_LINES} (STANDARDS §3.1, blank lines/comments excluded). ` +
        'Decompose: move sub-components into a `components/` folder next to the parent and logic into a hook (references/components.md).',
    );
  }
  if (/^use[A-Z]\w*\.tsx?$/.test(name) && lines > HOOK_MAX_LINES) {
    findings.push(
      `${rel}: hook file has ${lines} lines > ${HOOK_MAX_LINES} (STANDARDS §9, Long Method). ` +
        'Extract Hook / Extract Function (references/refactoring-smells.md).',
    );
  }
  return findings;
}

function eslintFindings(file, root) {
  if (process.env.TEAM_FRONT_HOOK_ESLINT === 'off') return [];
  const bin = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
  if (!existsSync(bin)) return [];
  const res = spawnSync(
    process.execPath,
    [bin, '--max-warnings', '0', '--no-warn-ignored', '--format', 'stylish', file],
    { cwd: root, encoding: 'utf8', timeout: ESLINT_TIMEOUT_MS },
  );
  // 0 = clean; 2 = config/crash or timeout → not the author's problem here.
  if (res.status !== 1) return [];
  const out = `${res.stdout}`.trim().split('\n');
  const shown = out.slice(0, MAX_OUTPUT_LINES).join('\n');
  const more = out.length > MAX_OUTPUT_LINES ? `\n… ${out.length - MAX_OUTPUT_LINES} more lines` : '';
  return [`ESLint (STANDARDS §11, --max-warnings 0) on ${relative(root, file).replaceAll('\\', '/')}:\n${shown}${more}`];
}

function main() {
  if (process.env.TEAM_FRONT_HOOK === 'off') return 0;
  const event = readStdin();
  const input = event.tool_input ?? {};
  const target = input.file_path ?? input.path;
  if (!target) return 0;
  const file = resolve(event.cwd ?? process.cwd(), target);
  if (!LINTABLE.test(file) || SKIP_DIR.test(file) || !existsSync(file)) return 0;

  const root = findFrontendRoot(file);
  if (!root) return 0;

  const findings = [...sizeFindings(file, root), ...eslintFindings(file, root)];
  if (!findings.length) return 0;
  process.stderr.write(
    `team-front-skill check failed — fix before continuing:\n- ${findings.join('\n- ')}\n`,
  );
  return 2;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stderr.write(`team-front-skill hook error (ignored): ${e.message}\n`);
  process.exitCode = 0;
}
