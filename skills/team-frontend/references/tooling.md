# Tooling — ESLint, Prettier, husky, lint-staged, commitlint

## Detection

Check `package.json` devDependencies and files:
`eslint.config.*`, `.prettierrc*`, `.husky/`, `lint-staged` config,
`commitlint.config.*`, `vitest.config.*`. Anything missing → install and
configure as below. Existing config → **merge** our rules, don't overwrite
team-specific settings blindly; show the diff.

## Install

```bash
npm i -D eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-jsx-a11y \
  eslint-plugin-boundaries @tanstack/eslint-plugin-query eslint-config-prettier \
  prettier prettier-plugin-tailwindcss husky lint-staged \
  @commitlint/cli @commitlint/config-conventional
# Next:  npm i -D @next/eslint-plugin-next   (or eslint-config-next)
# React: npm i -D @tanstack/eslint-plugin-router eslint-plugin-react-refresh
```

## `eslint.config.mjs` (Next variant)

```js
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import boundaries from 'eslint-plugin-boundaries'
import pluginQuery from '@tanstack/eslint-plugin-query'
import nextPlugin from '@next/eslint-plugin-next'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'src/shared/ui/**', 'next-env.d.ts'] },
  ...tseslint.configs.recommended,
  ...pluginQuery.configs['flat/recommended'],
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
    files: ['src/shared/api/**'],
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

Same-slice relative imports are unaffected. For the React/Vite variant replace
the Next plugin with `@tanstack/eslint-plugin-router` (`flat/recommended`) and
`eslint-plugin-react-refresh`, and change element patterns (`src/app/*`,
`src/routes/*`).

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

(If the project already has a Prettier style, keep it — only add the Tailwind plugin.)

## husky + lint-staged + commitlint

```bash
npx husky init
```

`.husky/pre-commit`

```sh
npx lint-staged
```

`.husky/commit-msg`

```sh
npx --no -- commitlint --edit "$1"
```

`.husky/pre-push`

```sh
npm run typecheck && npm run test
```

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
    "test:coverage": "vitest run --coverage"
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

## Optional

`knip` for dead code/unused deps; `@next/bundle-analyzer`.

## Verify

After setup run `npm run lint`, `npm run typecheck`, `npm run test` and make a
test commit with a bad message to confirm commitlint rejects it (then abort).
