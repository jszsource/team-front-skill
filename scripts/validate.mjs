#!/usr/bin/env node
// Package QA for team-front-skill. Node 20+, zero dependencies.
// Usage: node scripts/validate.mjs   (or: npm run validate)
// Exits 1 and lists every problem when any check fails.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(ROOT, 'skills');
const REFS_DIR = join(SKILLS, 'team-frontend', 'references');
const TEMPLATES_DIR = join(SKILLS, 'front-template', 'templates');
const URL_ALLOW = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|(?:[\w-]+\.)*example\.(?:com|org|net))(?=[:/\s`'")\]]|$)/;

const errors = [];
let passed = 0;

const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

function check(ok, message) {
  if (ok) passed += 1;
  else errors.push(message);
  return ok;
}

function walk(dir, filter = () => true) {
  if (!isDir(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p, filter);
    return filter(p) ? [p] : [];
  });
}

const mdIn = (dir) => walk(dir, (p) => p.endsWith('.md'));

// Minimal YAML frontmatter parser: `key: value`, quoted values, `>`/`|` blocks.
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!m) return null;
  const data = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const kv = lines[i].match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (/^[>|][+-]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && /^(\s+|$)/.test(lines[i + 1]) && !/^[A-Za-z]/.test(lines[i + 1])) {
        block.push(lines[(i += 1)].trim());
      }
      value = block.join(' ').trim();
    } else if (/^(["']).*\1$/.test(value)) {
      value = value.slice(1, -1);
    }
    data[kv[1]] = value;
  }
  return data;
}

// Lines outside fenced code blocks, with their 1-based line numbers.
function proseLines(text) {
  const out = [];
  let fence = null;
  text.split('\n').forEach((line, idx) => {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      return;
    }
    if (!fence) out.push([idx + 1, line]);
  });
  return out;
}

// ---------------------------------------------------------------------------
// a) Frontmatter
// ---------------------------------------------------------------------------
const skillFiles = readdirSync(SKILLS, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => join(SKILLS, e.name, 'SKILL.md'));
const agentFiles = mdIn(join(ROOT, 'agents'));
const commandFiles = mdIn(join(ROOT, 'commands'));

for (const file of skillFiles) {
  if (!check(existsSync(file), `[frontmatter] missing ${rel(file)}`)) continue;
  const fm = frontmatter(read(file));
  if (!check(fm, `[frontmatter] ${rel(file)}: no YAML frontmatter`)) continue;
  const folder = basename(dirname(file));
  check(fm.name, `[frontmatter] ${rel(file)}: missing "name"`);
  check(!fm.name || fm.name === folder, `[frontmatter] ${rel(file)}: name "${fm.name}" must equal folder "${folder}"`);
  check(fm.description, `[frontmatter] ${rel(file)}: missing or empty "description"`);
}
for (const file of agentFiles) {
  const fm = frontmatter(read(file));
  if (!check(fm, `[frontmatter] ${rel(file)}: no YAML frontmatter`)) continue;
  const base = basename(file, '.md');
  check(fm.name, `[frontmatter] ${rel(file)}: missing "name"`);
  check(!fm.name || fm.name === base, `[frontmatter] ${rel(file)}: name "${fm.name}" must equal file name "${base}"`);
  check(fm.description, `[frontmatter] ${rel(file)}: missing or empty "description"`);
}
for (const file of commandFiles) {
  const fm = frontmatter(read(file));
  if (!check(fm, `[frontmatter] ${rel(file)}: no YAML frontmatter`)) continue;
  check(fm.description, `[frontmatter] ${rel(file)}: missing or empty "description"`);
}

// ---------------------------------------------------------------------------
// b) Cross-references resolve
// ---------------------------------------------------------------------------
const docFiles = [
  ...mdIn(SKILLS),
  ...agentFiles,
  ...commandFiles,
  ...['README.md', 'CLAUDE.md'].map((f) => join(ROOT, f)).filter(existsSync),
];

// Strip trailing punctuation / ellipsis; a trailing "/" means a directory.
const cleanPath = (p) => p.replace(/\.{3}$/, '').replace(/[.,;:]+$/, '');

function resolves(target) {
  return target.endsWith('/') ? isDir(target) : existsSync(target);
}

for (const file of docFiles) {
  const text = read(file);
  const where = rel(file);
  const seen = new Set();
  const ref = (kind, raw, target) => {
    const key = `${kind}:${raw}`;
    if (seen.has(key)) return;
    seen.add(key);
    check(resolves(target), `[refs] ${where}: "${raw}" does not resolve (expected ${rel(target) || '.'})`);
  };

  // references/<x>.md and templates/<x>.md (not part of a longer path)
  for (const m of text.matchAll(/(?<![\w./-])(references|templates)\/([\w.-]+\.md)/g)) {
    const dir = m[1] === 'references' ? REFS_DIR : TEMPLATES_DIR;
    ref('short', m[0], join(dir, m[2]));
  }
  // ../team-frontend/... (relative to a skill root)
  for (const m of text.matchAll(/\.\.\/(team-frontend|front-template)\/([\w./-]*)/g)) {
    const path = cleanPath(m[2]);
    ref('rel', m[0], join(SKILLS, m[1], path) + (path.endsWith('/') || path === '' ? '/' : ''));
  }
  // .claude/skills/<path> (installed path) -> skills/<path>
  for (const m of text.matchAll(/\.claude\/skills\/([\w./-]+)/g)) {
    const path = cleanPath(m[1]);
    if (!path) continue;
    ref('installed', m[0], join(SKILLS, path) + (path.endsWith('/') ? '/' : ''));
  }
  // .claude/agents/<x>.md and .claude/commands/<x>.md
  for (const m of text.matchAll(/\.claude\/(agents|commands)\/([\w.-]+\.md)/g)) {
    ref('installed', m[0], join(ROOT, m[1], m[2]));
  }
}

// ---------------------------------------------------------------------------
// c) Every reference file is in the SKILL.md reference index
// ---------------------------------------------------------------------------
{
  const skillMd = read(join(SKILLS, 'team-frontend', 'SKILL.md'));
  const idx = skillMd.match(/^##\s+Reference index\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  if (check(idx, '[index] skills/team-frontend/SKILL.md: no "## Reference index" section')) {
    const listed = new Set([...idx[1].matchAll(/references\/([\w.-]+\.md)/g)].map((m) => m[1]));
    for (const f of readdirSync(REFS_DIR).filter((n) => n.endsWith('.md'))) {
      check(listed.has(f), `[index] references/${f} is not listed in the "Reference index" of skills/team-frontend/SKILL.md`);
    }
  }
}

// ---------------------------------------------------------------------------
// d) Version consistency
// ---------------------------------------------------------------------------
{
  const versions = {};
  const tryRead = (label, fn) => {
    try {
      versions[label] = fn();
    } catch (e) {
      versions[label] = undefined;
      errors.push(`[version] cannot read ${label}: ${e.message}`);
    }
  };
  tryRead('VERSION', () => read(join(ROOT, 'VERSION')).trim());
  tryRead('.claude-plugin/plugin.json', () => JSON.parse(read(join(ROOT, '.claude-plugin', 'plugin.json'))).version);
  tryRead('.claude-plugin/marketplace.json', () => {
    const mk = JSON.parse(read(join(ROOT, '.claude-plugin', 'marketplace.json')));
    const plugin = JSON.parse(read(join(ROOT, '.claude-plugin', 'plugin.json')));
    const entry = (mk.plugins ?? []).find((p) => p.name === plugin.name);
    check(entry, `[version] marketplace.json has no plugin entry named "${plugin.name}"`);
    return entry?.version;
  });
  tryRead('package.json', () => JSON.parse(read(join(ROOT, 'package.json'))).version);
  tryRead('STANDARDS.md status line', () => {
    const line = read(join(SKILLS, 'team-frontend', 'STANDARDS.md')).split('\n').find((l) => /^>\s*Status:/.test(l));
    return line?.match(/\*\*v(\d+\.\d+\.\d+)\*\*/)?.[1];
  });
  tryRead('CHANGELOG.md top entry', () => read(join(ROOT, 'CHANGELOG.md')).match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1]);

  const expected = versions.VERSION;
  check(/^\d+\.\d+\.\d+$/.test(expected ?? ''), `[version] VERSION must be x.y.z, got "${expected}"`);
  for (const [label, v] of Object.entries(versions)) {
    if (label === 'VERSION') continue;
    check(
      v === expected,
      `[version] ${label} is "${v ?? 'not found'}", expected "${expected}" (from VERSION)` +
        (label.startsWith('STANDARDS') ? ' — status line must contain **vX.Y.Z**' : ''),
    );
  }
}

// ---------------------------------------------------------------------------
// e) Installer / uninstaller parity
// ---------------------------------------------------------------------------
{
  const scripts = ['install.sh', 'install.ps1', 'uninstall.sh', 'uninstall.ps1'];
  const src = {};
  for (const s of scripts) {
    const p = join(ROOT, s);
    if (check(existsSync(p), `[installers] missing ${s}`)) src[s] = read(p);
  }
  for (const s of ['install.sh', 'install.ps1']) {
    if (!src[s]) continue;
    for (const dir of ['skills', 'agents', 'commands']) {
      check(new RegExp(`\\b${dir}\\b`).test(src[s]), `[installers] ${s} does not handle "${dir}"`);
    }
    check(src[s].includes('.installed-version'), `[installers] ${s} does not write .installed-version`);
    check(src[s].includes('.team-front-backup'), `[installers] ${s} does not back up modified skills to .team-front-backup`);
    check(src[s].includes('VERSION'), `[installers] ${s} does not read VERSION`);
  }
  // Uninstallers must remove every shipped skill, agent and command.
  const shipped = [
    ...skillFiles.map((f) => `skills/${basename(dirname(f))}`),
    ...agentFiles.map((f) => `agents/${basename(f)}`),
    ...commandFiles.map((f) => `commands/${basename(f)}`),
  ];
  for (const s of ['uninstall.sh', 'uninstall.ps1']) {
    if (!src[s]) continue;
    for (const item of shipped) {
      check(src[s].includes(item), `[installers] ${s} does not remove "${item}"`);
    }
  }
  if (src['install.sh']) {
    check(!/\r/.test(readFileSync(join(ROOT, 'install.sh'), 'utf8')), '[installers] install.sh has CRLF line endings');
  }
}

// ---------------------------------------------------------------------------
// f) No external URLs in rule text (all knowledge must be local)
// ---------------------------------------------------------------------------
for (const file of [...mdIn(SKILLS), ...agentFiles, ...commandFiles]) {
  let clean = true;
  for (const [n, line] of proseLines(read(file))) {
    for (const m of line.matchAll(/https?:\/\/[^\s`'")\]>]+/g)) {
      if (URL_ALLOW.test(m[0])) continue;
      clean = false;
      errors.push(`[urls] ${rel(file)}:${n}: external URL "${m[0]}" — rules must not depend on links (allowed: localhost, example.com, or inside fenced code)`);
    }
  }
  if (clean) passed += 1;
}

// ---------------------------------------------------------------------------
if (errors.length) {
  console.error(`✖ ${errors.length} problem(s) found (${passed} checks passed):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✔ ${passed} checks passed`);
