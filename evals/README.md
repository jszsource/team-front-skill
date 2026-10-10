# Evals

Behaviour checks for the agents — does Claude actually apply the standard, not
just does the package parse. `scripts/validate.mjs` checks structure;
these check output.

## `review-fixture/` — front-reviewer

A small, deliberately broken Next.js app (it is not meant to build).
`expected.json` lists the findings the reviewer must report (file + STANDARDS §
+ keyword) and one `mustNotFlag` trap: `src/widgets/catalog/ui/CatalogNav.tsx`
is 175 raw lines but ~110 non-blank, non-comment lines, so a §3.1 size finding
there is a false positive (the `max-lines` counting rule).

### Run it

From the repo root (needs the `claude` CLI, logged in or with `ANTHROPIC_API_KEY`):

```bash
node scripts/run-eval.mjs                 # 3 runs; or: npm run eval:run
node scripts/run-eval.mjs --runs 5 --parallel 5 --model sonnet --budget 3
```

Options: `--runs N` (default 3), `--parallel N` (default 1), `--model <m>`,
`--budget <usd per run>`, `--keep` (keep the temp workdirs), `--no-history`.

Each run:

1. copies only `app/`, `src/`, `package.json` to a fresh temp dir **outside
   the repo**: the model never sees `expected.json`, `golden-report.txt` or
   this repo's `CLAUDE.md`;
2. installs the package into its `.claude/` with the real installer;
3. runs `claude -p` with `--setting-sources project` (your user settings and
   plugins are not loaded) and read-only tools;
4. scores the report with `scoreReport` from `scripts/eval-review.mjs`.

Output: `evals/results/<timestamp>/` (gitignored) — `run-N.txt` (report),
`run-N.json` (raw CLI output: cost, turns, `subagent_stats`,
`permission_denials`), `summary.json`, `summary.md` (hit rate per finding and
every finding outside `expected.json`, for a manual precision check). One line
per invocation is appended to `evals/history.jsonl` — **commit it**, it is the
quality trend across versions and models.

**Pass** = mean recall ≥ `minRecall` (80%), no run reports a `mustNotFlag`
item, every run actually spawned the reviewer subagent, no run errored. The
summary also lists **flaky** findings (found in some runs only) and
**always missed** ones — both point at a vague rule or reviewer step.

Run it after changing the reviewer, STANDARDS or a reference it reads, and put
the summary line in the PR. In GitHub Actions: **reviewer-eval** workflow
(manual, needs the `ANTHROPIC_API_KEY` secret; reports are uploaded as an
artifact).

### Score a single report

```bash
node scripts/eval-review.mjs <report.txt>     # or: npm run eval:review -- <report.txt>
```

A finding is a line in the reviewer's output format, `path[:line] — §N …`
(optionally bulleted/backticked). Prose that only mentions a § ("X.tsx has no
size finding, under the §3.1 limit") does not count.

### What CI checks without a model

`validate.yml` scores `golden-report.txt` (a hand-written ideal report) and
runs `scripts/test-scorer.mjs`, so `expected.json` and the scorer stay
consistent.

## Changing the fixture

- New violation → add the code to the fixture **and** an entry to
  `expected.json` **and** a matching line to `golden-report.txt`.
- `scripts/validate.mjs` checks that every `expected.json` file exists and
  every section number is a real STANDARDS section.
- A real finding that shows up in `summary.md` under "outside expected.json"
  in most runs is a candidate for a new `mustFind` entry; one that is wrong is
  a reviewer precision bug — fix the agent or the reference it read.
- The runner copies only the entries in `FIXTURE_FILES`
  (`scripts/run-eval.mjs`) — add a new top-level fixture folder there too.
