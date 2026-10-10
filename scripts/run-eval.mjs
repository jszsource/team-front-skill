#!/usr/bin/env node
// Runs the real front-reviewer against evals/review-fixture N times and scores every run.
// Node 20+, zero dependencies; needs the `claude` CLI (logged in, or ANTHROPIC_API_KEY set).
//
// Usage: node scripts/run-eval.mjs [--runs 3] [--model <model>] [--budget <usd-per-run>]
//                                  [--parallel 1] [--keep] [--no-history]
//
// Each run gets a fresh copy of the fixture OUTSIDE this repo (so the repo's CLAUDE.md
// and expected.json/golden-report.txt are invisible to the model), with the package
// installed into its .claude/ by the real installer. User settings/plugins are not
// loaded (--setting-sources project). Results: evals/results/<timestamp>/ (gitignored);
// one summary line is appended to evals/history.jsonl (committed: the trend over time).
// Exits 1 when the eval fails (see `passed` below).

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPECTED_PATH, scoreReport } from './eval-review.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'evals', 'review-fixture');
const FIXTURE_FILES = ['app', 'src', 'package.json']; // never the answers
const RUN_TIMEOUT_MS = 15 * 60_000;
const PROMPT =
  'Use the front-reviewer subagent to review every file under app/ and src/. Print only its report.';
const ALLOWED_TOOLS = ['Read', 'Grep', 'Glob', 'Task', 'Agent', 'Bash(git:*)', 'Bash(ls:*)'];

function parseArgs(argv) {
  const opts = { runs: 3, model: undefined, budget: undefined, parallel: 1, keep: false, history: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[(i += 1)];
    if (a === '--runs') opts.runs = Number(next());
    else if (a === '--model') opts.model = next();
    else if (a === '--budget') opts.budget = next();
    else if (a === '--parallel') opts.parallel = Number(next());
    else if (a === '--keep') opts.keep = true;
    else if (a === '--no-history') opts.history = false;
    else {
      console.error(`Unknown argument "${a}". Usage: node scripts/run-eval.mjs [--runs N] [--model M] [--budget USD] [--parallel N] [--keep] [--no-history]`);
      process.exit(2);
    }
  }
  if (!(opts.runs >= 1) || !(opts.parallel >= 1)) {
    console.error('--runs and --parallel must be ≥ 1');
    process.exit(2);
  }
  return opts;
}

function prepareWorkdir() {
  const dir = mkdtempSync(join(tmpdir(), 'front-eval-'));
  for (const f of FIXTURE_FILES) cpSync(join(FIXTURE, f), join(dir, f), { recursive: true });
  const target = join(dir, '.claude');
  const install =
    process.platform === 'win32'
      ? spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(ROOT, 'install.ps1'), '-Target', target], { encoding: 'utf8' })
      : spawnSync('sh', [join(ROOT, 'install.sh'), target], { encoding: 'utf8' });
  if (install.status !== 0) throw new Error(`installer failed:\n${install.stdout}${install.stderr}`);
  // An untracked git repo, like a real project before its first commit.
  spawnSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

function runClaude(cwd, opts) {
  const args = [
    '-p', PROMPT,
    '--output-format', 'json',
    '--setting-sources', 'project',
    '--no-session-persistence',
    '--allowedTools', ALLOWED_TOOLS.join(','),
  ];
  if (opts.model) args.push('--model', opts.model);
  if (opts.budget) args.push('--max-budget-usd', String(opts.budget));
  return new Promise((done) => {
    const child = spawn(process.env.CLAUDE_BIN ?? 'claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), RUN_TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      done({ error: `cannot start claude: ${e.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        done({ json: JSON.parse(stdout), code, stderr });
      } catch {
        done({ error: `exit ${code}, no JSON output:\n${stderr || stdout}`.slice(0, 2000) });
      }
    });
  });
}

async function oneRun(n, opts, expected, outDir) {
  const dir = prepareWorkdir();
  const started = Date.now();
  try {
    const res = await runClaude(dir, opts);
    const json = res.json ?? {};
    const report = typeof json.result === 'string' ? json.result : '';
    writeFileSync(join(outDir, `run-${n}.txt`), report || res.error || '');
    writeFileSync(join(outDir, `run-${n}.json`), `${JSON.stringify(json, null, 2)}\n`);
    const score = scoreReport(report, expected);
    const subagents = json.subagent_stats?.spawned ?? 0;
    const error = res.error ?? (json.is_error ? `claude reported an error (${json.terminal_reason ?? json.subtype ?? 'unknown'})` : undefined);
    return {
      run: n,
      ...score,
      ok: score.ok && subagents > 0 && !error,
      subagents,
      error,
      permissionDenials: (json.permission_denials ?? []).length,
      costUSD: json.total_cost_usd ?? 0,
      durationMs: Date.now() - started,
      models: Object.keys(json.modelUsage ?? {}),
    };
  } finally {
    if (opts.keep) console.log(`  run ${n} workdir kept: ${dir}`);
    else rmSync(dir, { recursive: true, force: true });
  }
}

async function pool(count, limit, task) {
  const results = [];
  let next = 1;
  const worker = async () => {
    while (next <= count) {
      const n = next++;
      results.push(await task(n));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, count) }, worker));
  return results.sort((a, b) => a.run - b.run);
}

const pct = (x) => `${(x * 100).toFixed(0)}%`;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const stddev = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

const opts = parseArgs(process.argv.slice(2));
const expected = JSON.parse(readFileSync(EXPECTED_PATH, 'utf8'));
const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = join(ROOT, 'evals', 'results', stamp);
mkdirSync(outDir, { recursive: true });

console.log(`front-reviewer eval v${version}: ${opts.runs} run(s)${opts.model ? `, model ${opts.model}` : ''} → ${outDir}`);
const runs = await pool(opts.runs, opts.parallel, async (n) => {
  const r = await oneRun(n, opts, expected, outDir);
  const status = r.error ? `ERROR ${r.error.split('\n')[0]}` : `${r.ok ? '✔' : '✖'} recall ${pct(r.recall)}, FP ${r.falsePositives.length}, subagents ${r.subagents}`;
  console.log(`  run ${n}: ${status} ($${r.costUSD.toFixed(2)}, ${Math.round(r.durationMs / 1000)}s)`);
  return r;
});

const recalls = runs.map((r) => r.recall);
const hitRate = Object.fromEntries(expected.mustFind.map((i) => [i.id, runs.filter((r) => r.found.includes(i.id)).length / runs.length]));
const flaky = Object.keys(hitRate).filter((id) => hitRate[id] > 0 && hitRate[id] < 1);
const alwaysMissed = Object.keys(hitRate).filter((id) => hitRate[id] === 0);
const fpRuns = runs.filter((r) => r.falsePositives.length).length;
const summary = {
  date: new Date().toISOString(),
  version,
  models: [...new Set(runs.flatMap((r) => r.models))],
  runs: runs.length,
  meanRecall: Number(mean(recalls).toFixed(3)),
  minRecall: Number(Math.min(...recalls).toFixed(3)),
  maxRecall: Number(Math.max(...recalls).toFixed(3)),
  stddevRecall: Number(stddev(recalls).toFixed(3)),
  passRate: Number((runs.filter((r) => r.ok).length / runs.length).toFixed(3)),
  falsePositiveRuns: fpRuns,
  noSubagentRuns: runs.filter((r) => !r.subagents).length,
  errorRuns: runs.filter((r) => r.error).length,
  meanUnmatched: Number(mean(runs.map((r) => r.unmatched.length)).toFixed(1)),
  costUSD: Number(runs.reduce((s, r) => s + r.costUSD, 0).toFixed(2)),
  flaky,
  alwaysMissed,
};
// Mean recall over the bar, never a trap finding, and every run really used the reviewer.
const passed =
  summary.meanRecall >= expected.minRecall && fpRuns === 0 && summary.noSubagentRuns === 0 && summary.errorRuns === 0;

writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify({ ...summary, passed, hitRate, runs }, null, 2)}\n`);
const md = [
  `# front-reviewer eval — v${version}, ${summary.date}`,
  '',
  `Models: ${summary.models.join(', ') || 'unknown'} · runs: ${summary.runs} · cost: $${summary.costUSD} · **${passed ? 'PASSED' : 'FAILED'}**`,
  '',
  `Recall mean ${pct(summary.meanRecall)} (min ${pct(summary.minRecall)}, max ${pct(summary.maxRecall)}, σ ${pct(summary.stddevRecall)}) · bar ${pct(expected.minRecall)}`,
  `False-positive runs: ${fpRuns} · runs without the subagent: ${summary.noSubagentRuns} · errors: ${summary.errorRuns}`,
  '',
  '| finding | hit rate |',
  '| --- | --- |',
  ...Object.entries(hitRate).map(([id, rate]) => `| ${id} | ${pct(rate)} |`),
  '',
  '## Findings outside expected.json (review by hand: new real issue → add to the fixture; noise → reviewer precision problem)',
  '',
  ...runs.flatMap((r) => [`### run ${r.run}`, '', ...(r.unmatched.length ? r.unmatched.map((l) => `- ${l.trim()}`) : ['- none']), '']),
].join('\n');
writeFileSync(join(outDir, 'summary.md'), `${md}\n`);
if (opts.history) appendFileSync(join(ROOT, 'evals', 'history.jsonl'), `${JSON.stringify({ ...summary, passed })}\n`);

console.log(`\nrecall mean ${pct(summary.meanRecall)} (min ${pct(summary.minRecall)}, max ${pct(summary.maxRecall)}, σ ${pct(summary.stddevRecall)}), bar ${pct(expected.minRecall)}`);
console.log(`false-positive runs ${fpRuns}, no-subagent runs ${summary.noSubagentRuns}, errors ${summary.errorRuns}, cost $${summary.costUSD}`);
if (flaky.length) console.log(`flaky: ${flaky.map((id) => `${id} ${pct(hitRate[id])}`).join(', ')}`);
if (alwaysMissed.length) console.log(`always missed: ${alwaysMissed.join(', ')}`);
console.log(passed ? '✔ eval passed' : '✖ eval failed');
console.log(`details: ${join(outDir, 'summary.md')}`);
process.exit(passed ? 0 : 1);
