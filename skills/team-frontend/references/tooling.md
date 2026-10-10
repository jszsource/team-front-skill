# Tooling — package manager, ESLint, Prettier, husky, lint-staged, commitlint

## Detection

Check `package.json` devDependencies and files:
`eslint.config.*`, `.prettierrc*`, `.husky/`, `lint-staged` config,
`commitlint.config.*`, `vitest.config.*`. Anything missing → install and
configure as below. Existing config → **merge** our rules, don't overwrite
team-specific settings blindly; show the diff.

## Package manager

Detect once per session, then use **only** that manager in every command you
run or write (scripts, husky hooks, CI, docs). Never mix managers — a second
lockfile is a bug.

1. `package.json` → `"packageManager": "pnpm@9.x"` field wins if present.
2. Otherwise the lockfile in the project root:

| Lockfile | Manager |
| --- | --- |
| `package-lock.json` | npm |
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` (+ `.yarnrc.yml` → Yarn Berry, none → Yarn 1) | yarn |
| `bun.lock` / `bun.lockb` | bun |

3. Several lockfiles → stop and ask which one is real; propose deleting the others.
   No lockfile → npm (or ask, for a fresh project).

Command mapping (examples in this package are written with npm — translate):

| Purpose | npm | pnpm | yarn | bun |
| --- | --- | --- | --- | --- |
| install (CI, frozen) | `npm ci` | `pnpm install --frozen-lockfile` | `yarn install --immutable` (Berry) / `--frozen-lockfile` (v1) | `bun install --frozen-lockfile` |
| add dev dep | `npm i -D x` | `pnpm add -D x` | `yarn add -D x` | `bun add -d x` |
| run script | `npm run lint` | `pnpm lint` | `yarn lint` | `bun run lint` |
| local binary | `npx --no -- x` | `pnpm exec x` | `yarn x` | `bunx x` |
| one-off remote tool | `npx x@latest` | `pnpm dlx x@latest` | `yarn dlx x@latest` (Berry) / `npx` (v1) | `bunx x@latest` |
| outdated | `npm outdated --json` | `pnpm outdated --format json` | `yarn outdated` (v1) / `yarn upgrade-interactive` (Berry) | `bun outdated` |
| audit | `npm audit --audit-level=high` | `pnpm audit --audit-level high` | `yarn npm audit --severity high` (Berry) / `yarn audit --level high` (v1) | `bun audit --audit-level=high` |

## Install

```bash
npm i -D eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-jsx-a11y \
  eslint-plugin-boundaries @tanstack/eslint-plugin-query eslint-config-prettier \
  prettier prettier-plugin-tailwindcss husky lint-staged \
  @commitlint/cli @commitlint/config-conventional
# Next:  npm i -D @next/eslint-plugin-next
# React: npm i -D @tanstack/eslint-plugin-router eslint-plugin-react-refresh
```

(`eslint/config` — `defineConfig`, `globalIgnores` — ships with ESLint ≥9.22.)

## `eslint.config.mjs` (Next variant)

```js
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import boundaries from 'eslint-plugin-boundaries'
import pluginQuery from '@tanstack/eslint-plugin-query'
import nextPlugin from '@next/eslint-plugin-next'
import prettier from 'eslint-config-prettier'

export default defineConfig(
  globalIgnores(['.next/**', 'node_modules/**', 'coverage/**', 'playwright-report/**',
    'test-results/**', 'src/shared/ui/**', 'next-env.d.ts']),
  tseslint.configs.recommended,
  pluginQuery.configs['flat/recommended'],
  jsxA11y.flatConfigs.recommended,
  {
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin, boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app-layer/*' },
        { type: 'views', pattern: 'src/views/*', capture: ['slice'] },
        { type: 'widgets', pattern: 'src/widgets/*', capture: ['slice'] },
        { type: 'features', pattern: 'src/features/*', capture: ['slice'] },
        { type: 'entities', pattern: 'src/entities/*', capture: ['slice'] },
        { type: 'shared', pattern: 'src/shared/*' },
        { type: 'routes', pattern: 'app/*' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/exhaustive-deps': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: 'Client: http from @/shared/api. Server: serverFetch from @/shared/api/http.server',
            },
          ],
          patterns: [
            {
              // deep imports banned, except server-only `<slice>/api/<name>.server`
              // (index.ts never re-exports it; server code imports it by path)
              regex: '^@/(views|widgets|features|entities)/[^/]+/(?!api/[^/]+\\.server$).+',
              message: 'Import slices only through their public API (index.ts)',
            },
          ],
        },
      ],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'routes', allow: ['views', 'app', 'shared'] },
            { from: 'app', allow: ['views', 'widgets', 'features', 'entities', 'shared'] },
            { from: 'views', allow: ['widgets', 'features', 'entities', 'shared'] },
            { from: 'widgets', allow: ['features', 'entities', 'shared'] },
            { from: 'features', allow: ['entities', 'shared'] },
            { from: 'entities', allow: ['shared'] },
            { from: 'shared', allow: ['shared'] },
          ],
        },
      ],
    },
  },
  {
    // axios allowed only in the client http layer — never in *.server.ts
    files: ['src/shared/api/**'],
    ignores: ['src/shared/api/**/*.server.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: { 'max-lines': ['error', { max: 150, skipBlankLines: true, skipComments: true }] },
  },
  prettier,
)
```

Same-slice relative imports are unaffected. `prettier` stays **last**.

## `eslint.config.mjs` (React / Vite + TanStack Router variant)

```js
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import boundaries from 'eslint-plugin-boundaries'
import pluginQuery from '@tanstack/eslint-plugin-query'
import pluginRouter from '@tanstack/eslint-plugin-router'
import prettier from 'eslint-config-prettier'

export default defineConfig(
  globalIgnores(['dist/**', 'node_modules/**', 'coverage/**', 'playwright-report/**',
    'test-results/**', 'src/shared/ui/**', 'src/routeTree.gen.ts']),
  tseslint.configs.recommended,
  pluginQuery.configs['flat/recommended'],
  pluginRouter.configs['flat/recommended'],
  jsxA11y.flatConfigs.recommended,
  {
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/*' },
        { type: 'routes', pattern: 'src/routes/*' },
        { type: 'views', pattern: 'src/views/*', capture: ['slice'] },
        { type: 'widgets', pattern: 'src/widgets/*', capture: ['slice'] },
        { type: 'features', pattern: 'src/features/*', capture: ['slice'] },
        { type: 'entities', pattern: 'src/entities/*', capture: ['slice'] },
        { type: 'shared', pattern: 'src/shared/*' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'axios', message: 'Use http from @/shared/api' }],
          patterns: [
            {
              group: ['@/views/*/*', '@/widgets/*/*', '@/features/*/*', '@/entities/*/*'],
              message: 'Import slices only through their public API (index.ts)',
            },
          ],
        },
      ],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'routes', allow: ['views', 'app', 'shared'] },
            { from: 'app', allow: ['routes', 'views', 'widgets', 'features', 'entities', 'shared'] },
            { from: 'views', allow: ['widgets', 'features', 'entities', 'shared'] },
            { from: 'widgets', allow: ['features', 'entities', 'shared'] },
            { from: 'features', allow: ['entities', 'shared'] },
            { from: 'entities', allow: ['shared'] },
            { from: 'shared', allow: ['shared'] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/api/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // route files export `Route`, not a component — Fast Refresh rule doesn't apply
    files: ['src/routes/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: { 'max-lines': ['error', { max: 150, skipBlankLines: true, skipComments: true }] },
  },
  prettier,
)
```

### About `max-lines`

The rule counts **every non-blank, non-comment line of the whole `.tsx` file**
— imports, the props type, hoisted constants and helpers included — not just
the component function body. A file at 150 lines is the signal to decompose
(`components.md`), not to squeeze code onto fewer lines. Tests are excluded.

## Prettier — `.prettierrc.json`

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/app-layer/styles/globals.css"
}
```

`tailwindStylesheet` must point at the CSS file containing `@import "tailwindcss"`:

| Mode | `tailwindStylesheet` |
| --- | --- |
| Next | `./src/app-layer/styles/globals.css` |
| React / Vite | `./src/app/styles/globals.css` |

(If the project already has a Prettier style, keep it — only add the Tailwind plugin.)

## husky + lint-staged + commitlint

```bash
npx husky init        # pnpm exec husky init · yarn husky init · bunx husky init
```

Hooks call tools through the **detected** package manager (see mapping above).
npm shown; pnpm in comments:

`.husky/pre-commit`

```sh
npx lint-staged                      # pnpm exec lint-staged
```

`.husky/commit-msg`

```sh
npx --no -- commitlint --edit "$1"   # pnpm exec commitlint --edit "$1"
```

`.husky/pre-push`

```sh
npm run typecheck && npm run test    # pnpm typecheck && pnpm test
```

Pre-push notes:

- It runs on the **whole repo** (not staged files), so keep it fast — target
  under a minute. Typecheck + unit tests only; E2E, `build` and `audit` belong
  in CI (`ci.md`).
- Tests that need the network or a browser don't belong in `vitest run`.
- `git push --no-verify` is for emergencies only and CI still gates the merge.

`package.json`

```json
{
  "scripts": {
    "prepare": "husky",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  },
  "lint-staged": {
    "*.{ts,tsx,js,mjs}": ["eslint --fix", "prettier --write"],
    "*.{css,md,json}": ["prettier --write"]
  }
}
```

`commitlint.config.mjs`

```js
export default { extends: ['@commitlint/config-conventional'] }
```

Commit types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`,
`style`, `build`, `ci`.

## tsconfig essentials

`"strict": true`, `"noUncheckedIndexedAccess": true`, `"paths": { "@/*": ["./src/*"] }`.

## Node version

Commit `.nvmrc` (e.g. `22`) and `"engines": { "node": ">=22" }`; CI reads
`.nvmrc` (`ci.md`).

## Optional

`knip` for dead code/unused deps; `@next/bundle-analyzer`; `size-limit` for
bundle budgets in CI.

## Verify

After setup run `lint`, `typecheck`, `test` with the detected manager and make
a test commit with a bad message to confirm commitlint rejects it (then abort).
