#!/usr/bin/env node
// Scores a saved front-reviewer report against evals/review-fixture/expected.json.
// Node 20+, zero dependencies.
// Usage: node scripts/eval-review.mjs <report.txt> [expected.json]
// Exits 1 when recall is below `minRecall` or a `mustNotFlag` item was reported.

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [reportPath, expectedArg] = process.argv.slice(2);
const expectedPath = expectedArg ?? join(ROOT, 'evals', 'review-fixture', 'expected.json');

if (!reportPath || !existsSync(reportPath)) {
  console.error('Usage: node scripts/eval-review.mjs <report.txt> [expected.json]');
  process.exit(2);
}

const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
// Only lines that cite a STANDARDS section count as findings.
const findings = readFileSync(reportPath, 'utf8')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .filter((l) => /§\s*\d+/.test(l));

const sectionsOf = (line) => new Set([...line.matchAll(/§\s*(\d+)/g)].map((m) => Number(m[1])));
const namesFile = (line, file) => line.includes(file) || line.includes(basename(file));

function matches(item) {
  const kw = new RegExp(item.keywords, 'i');
  return findings.some((line) => {
    if (!namesFile(line, item.file) || !kw.test(line)) return false;
    const cited = sectionsOf(line);
    return item.sections.some((s) => cited.has(s));
  });
}

const found = expected.mustFind.filter(matches);
const missed = expected.mustFind.filter((i) => !found.includes(i));
const falsePositives = (expected.mustNotFlag ?? []).filter(matches);
const recall = found.length / expected.mustFind.length;
const ok = recall >= expected.minRecall && falsePositives.length === 0;

console.log(`findings in report: ${findings.length}`);
console.log(`recall: ${found.length}/${expected.mustFind.length} (${(recall * 100).toFixed(0)}%, min ${expected.minRecall * 100}%)`);
for (const i of missed) console.log(`  missed   ${i.id} — ${i.file} §${i.sections.join('/§')}`);
for (const i of falsePositives) console.log(`  FALSE+   ${i.id} — ${i.file}: ${i.why}`);
console.log(ok ? '✔ eval passed' : '✖ eval failed');
process.exit(ok ? 0 : 1);
