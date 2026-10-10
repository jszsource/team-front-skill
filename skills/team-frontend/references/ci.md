# CI — GitHub Actions template for target projects

`.github/workflows/ci.yml` gates every PR and push to `main`:
`lint` → `typecheck` → `test:coverage` → `build`, plus `audit` and Playwright
E2E as separate jobs. Same scripts as `tooling.md`; nothing runs in CI that
can't be run locally.

## Prerequisites

- Lockfile committed; package manager detected as in `tooling.md`.
- `.nvmrc` committed (CI reads the Node version from it).
- `package.json` scripts: `lint`, `typecheck`, `test:coverage`, `build`,
  `test:e2e` (Playwright `webServer` builds and starts the production app —
  `e2e-playwright.md`). Browsers installed in CI must match the config's projects.
- Build-time env vars: env validation (`shared/config/env.ts`) runs during
  `build`, so CI needs values. Use non-secret placeholders in `env:` for
  public URLs; real secrets via `${{ secrets.X }}` — never commit them.

## `ci.yml` (npm)

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  NEXT_TELEMETRY_DISABLED: 1
  # NEXT_PUBLIC_API_URL: https://api.example.test   # placeholders for env validation

jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run lint -- --max-warnings 0
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build
      # Optional — bundle budget (fails when a budget in .size-limit.json is exceeded)
      # - run: npx size-limit

  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - run: npm audit --audit-level=high --omit=dev

  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium webkit
      # webServer in playwright.config.ts builds and starts the production app
      - run: npm run test:e2e
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 7
```

Jobs run in parallel; branch protection should require `quality`, `audit` and
`e2e`.

## Package-manager variants

Change only the setup + install/run lines:

| Manager | Setup steps | Install | Run |
| --- | --- | --- | --- |
| npm | `actions/setup-node@v4` with `cache: npm` | `npm ci` | `npm run x` / `npx` |
| pnpm | `pnpm/action-setup@v4` **before** `actions/setup-node@v4` with `cache: pnpm` | `pnpm install --frozen-lockfile` | `pnpm x` / `pnpm exec` |
| yarn (Berry) | `corepack enable` step, then `actions/setup-node@v4` with `cache: yarn` | `yarn install --immutable` | `yarn x` |
| bun | `oven-sh/setup-bun@v2` (+ `actions/setup-node@v4` for Node-only tools) | `bun install --frozen-lockfile` | `bun run x` / `bunx` |

pnpm setup (reads the version from the `packageManager` field):

```yaml
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint --max-warnings 0
      - run: pnpm typecheck
      - run: pnpm test:coverage
      - run: pnpm build
```

Audit per manager: `pnpm audit --audit-level high --prod`,
`yarn npm audit --severity high --environment production` (Berry),
`bun audit --audit-level=high`.

## Next.js build cache

Add to `quality` before `build` and to `e2e` before `test:e2e` (faster rebuilds):

```yaml
      - uses: actions/cache@v4
        with:
          path: .next/cache
          key: nextjs-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('src/**', 'app/**') }}
          restore-keys: nextjs-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-
```

Swap the lockfile name for the detected manager (`pnpm-lock.yaml`, `yarn.lock`,
`bun.lock`).

## Optional — bundle budget

`.size-limit.json` (React/Vite):

```json
[{ "path": "dist/assets/*.js", "limit": "200 kB", "gzip": true }]
```

Install `size-limit @size-limit/file`, add `"size": "size-limit"` and uncomment
the step. Next: point `path` at `.next/static/chunks/**/*.js` or keep
`@next/bundle-analyzer` for manual review. Budget values follow STANDARDS.

## Rules

- Action references use major version tags only (`actions/checkout@v4`,
  `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/cache@v4`,
  `pnpm/action-setup@v4`, `oven-sh/setup-bun@v2`).
- Always frozen/immutable installs — CI never rewrites the lockfile.
- `permissions: contents: read` by default; widen per job only when needed.
- Never `continue-on-error` on lint/typecheck/test/build to "get green".
- Upload the Playwright report only on failure; keep retention short.
- Secrets only via `secrets.*`; never echo env values in logs.
