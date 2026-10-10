#!/usr/bin/env node
// Unit tests for the eval scorer (scripts/eval-review.mjs → scoreReport).
// Usage: node scripts/test-scorer.mjs   (or: npm run test:scorer). Node 20+, zero dependencies.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPECTED_PATH, scoreReport } from './eval-review.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = JSON.parse(readFileSync(EXPECTED_PATH, 'utf8'));
const golden = readFileSync(join(ROOT, 'evals', 'review-fixture', 'golden-report.txt'), 'utf8');
const failures = [];
let passed = 0;

function expect(ok, message) {
  if (ok) passed += 1;
  else failures.push(message);
}

const g = scoreReport(golden, expected);
expect(g.ok && g.recall === 1, `golden report must score 100%: ${JSON.stringify(g.missed)}`);

// Real reviewer prose seen in a run: explains why the trap is NOT a finding → must not count.
const prose = `${golden}\n\`src/widgets/catalog/ui/CatalogNav.tsx\` has no size finding. It is 175 raw lines but about 111 once blank and comment lines are left out, which is under the §3.1 limit of 150.\n`;
const p = scoreReport(prose, expected);
expect(p.ok && !p.falsePositives.length, 'prose mentioning § must not be scored as a false positive');

// A real size finding on the trap file, in every accepted line shape → false positive.
for (const line of [
  'src/widgets/catalog/ui/CatalogNav.tsx:1 — §3.1 Components — 175 lines > 150. Fix: decompose.',
  '- `src/widgets/catalog/ui/CatalogNav.tsx:1` — §3.1 size — over 150 lines. Fix: decompose.',
  '* CatalogNav.tsx - §3 max-lines exceeded. Fix: split.',
]) {
  const r = scoreReport(`${golden}\n${line}\n`, expected);
  expect(!r.ok && r.falsePositives.includes('catalog-size-false-positive'), `trap finding not detected: ${line}`);
}

// Finding format with a parenthesised note, and unmatched findings are reported.
const extra = scoreReport(`${golden}\n- \`CLAUDE.md\` (missing) — §1.1 profile record — no section.\n`, expected);
expect(extra.findings === g.findings + 1 && extra.unmatched.length === 1, 'parenthesised path note must count as one unmatched finding');

// Below the recall bar → fails.
const half = golden.split('\n').filter((_, i) => i % 3 === 0).join('\n');
expect(!scoreReport(half, expected).ok, 'a report with most findings missing must fail');

if (failures.length) {
  console.error(`✖ ${failures.length} scorer test(s) failed (${passed} passed):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✔ ${passed} scorer tests passed`);
