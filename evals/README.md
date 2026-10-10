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

Run it (from the repo root):

```bash
sh install.sh evals/review-fixture/.claude
cd evals/review-fixture
claude -p "Use the front-reviewer subagent to review every file under app/ and src/. Print only its report." > ../../review-report.txt
cd ../..
node scripts/eval-review.mjs review-report.txt     # or: npm run eval:review -- review-report.txt
```

The scorer passes when recall ≥ `minRecall` (80%) and no `mustNotFlag` item is
reported. Model output varies: run it a few times after changing the reviewer,
STANDARDS or a reference it reads, and note the result in the PR.

CI does not call a model; it only runs the scorer against `golden-report.txt`
(a hand-written ideal report) so `expected.json` and the scorer stay consistent.

## Changing the fixture

- New violation → add the code to the fixture **and** an entry to
  `expected.json` **and** a matching line to `golden-report.txt`.
- `scripts/validate.mjs` checks that every `expected.json` file exists and
  every section number is a real STANDARDS section.
