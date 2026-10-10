#!/usr/bin/env node
// Scores a saved front-reviewer report against evals/review-fixture/expected.json.
// Node 20+, zero dependencies.
// Usage: node scripts/eval-review.mjs <report.txt> [expected.json]
// Exits 1 when recall is below `minRecall` or a `mustNotFlag` item was reported.
// Also imported by scripts/run-eval.mjs (scoreReport).

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const EXPECTED_PATH = join(ROOT, 'evals', 'review-fixture', 'expected.json');

const sectionsOf = (line) => new Set([...line.matchAll(/§\s*(\d+)/g)].map((m) => Number(m[1])));
const namesFile = (line, file) => line.includes(file) || line.includes(basename(file));

function lineMatches(item, line) {
  if (!namesFile(line, item.file) || !new RegExp(item.keywords, 'i').test(line)) return false;
  const cited = sectionsOf(line);
  return item.sections.some((s) => cited.has(s));
}

// A finding is a line in the reviewer's format `path[:line] — §N ...` (agents/front-reviewer.md
// "Output"), optionally bulleted/backticked. Prose that merely mentions a § (e.g. "X.tsx has no
// size finding, under the §3.1 limit") is not a finding.
const FINDING = /^\s*(?:[-*]\s+)?`?[^\s`]+`?(?:\s+\([^)]*\))?\s+[—–-]\s+§\s*\d+/;

export function scoreReport(text, expected) {
  const findings = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => FINDING.test(l));
  const matches = (item) => findings.some((line) => lineMatches(item, line));

  const found = expected.mustFind.filter(matches);
  const missed = expected.mustFind.filter((i) => !found.includes(i));
  const falsePositives = (expected.mustNotFlag ?? []).filter(matches);
  // Findings outside expected.json: real extra problems or noise — review them by hand.
  const unmatched = findings.filter((line) => !expected.mustFind.some((i) => lineMatches(i, line)));
  const recall = found.length / expected.mustFind.length;
  return {
    findings: findings.length,
    found: found.map((i) => i.id),
    missed: missed.map((i) => i.id),
    falsePositives: falsePositives.map((i) => i.id),
    unmatched,
    recall,
    ok: recall >= expected.minRecall && falsePositives.length === 0,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [reportPath, expectedArg] = process.argv.slice(2);
  if (!reportPath || !existsSync(reportPath)) {
    console.error('Usage: node scripts/eval-review.mjs <report.txt> [expected.json]');
    process.exit(2);
  }
  const expected = JSON.parse(readFileSync(expectedArg ?? EXPECTED_PATH, 'utf8'));
  const byId = new Map([...expected.mustFind, ...(expected.mustNotFlag ?? [])].map((i) => [i.id, i]));
  const r = scoreReport(readFileSync(reportPath, 'utf8'), expected);

  console.log(`findings in report: ${r.findings}`);
  console.log(`recall: ${r.found.length}/${expected.mustFind.length} (${(r.recall * 100).toFixed(0)}%, min ${expected.minRecall * 100}%)`);
  for (const id of r.missed) {
    const i = byId.get(id);
    console.log(`  missed   ${id} — ${i.file} §${i.sections.join('/§')}`);
  }
  for (const id of r.falsePositives) console.log(`  FALSE+   ${id} — ${byId.get(id).file}: ${byId.get(id).why}`);
  console.log(r.ok ? '✔ eval passed' : '✖ eval failed');
  process.exit(r.ok ? 0 : 1);
}
