# Tooling — package manager, ESLint, Prettier, TypeScript, husky, lint-staged, commitlint

Implements STANDARDS §11. Three ESLint variants, one per project profile
(STANDARDS §1.1): **`next`**, **`shadcn-tailwind-tanstack-router`** (FSD +
TanStack Router + Tailwind + shadcn/ui) and **`antd-scss-react-router`**
(feature folders + React Router + Ant Design + SCSS modules, no Tailwind).
tsconfig, husky, lint-staged and commitlint are identical for all of them;
Prettier is identical except that `antd-scss-react-router` has no Tailwind
plugin.

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
# all profiles
npm i -D eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-jsx-a11y \
  eslint-plugin-import eslint-import-resolver-typescript eslint-plugin-unused-imports \
  @tanstack/eslint-plugin-query eslint-config-prettier \
  prettier husky lint-staged \
  @commitlint/cli @commitlint/config-conventional
# next:                            npm i -D prettier-plugin-tailwindcss @next/eslint-plugin-next eslint-plugin-boundaries
# shadcn-tailwind-tanstack-router: npm i -D prettier-plugin-tailwindcss @tanstack/eslint-plugin-router eslint-plugin-react-refresh eslint-plugin-boundaries
# antd-scss-react-router:          npm i -D eslint-plugin-react-refresh   (no prettier-plugin-tailwindcss)
```

- `eslint/config` (`defineConfig`, `globalIgnores`, `extends` in config
  objects) ships with ESLint ≥ 9.22 — no extra package.
- `eslint-plugin-react-hooks`: install the **current major** (not pinned to an
  old one); its flat `recommended` preset includes the React Compiler rules.
- `typescript-eslint` is the unified package — never the separate
  `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` setup, never
  a legacy `.eslintrc*`.

## What every variant contains (STANDARDS §11)

| Block | Applies to | Contents |
| --- | --- | --- |
| `globalIgnores` | — | build output, coverage, Playwright output, generated files, shadcn sources (`next`, `shadcn-tailwind-tanstack-router`) |
| `tseslint.configs.recommended` | all TS/JS files | baseline, no type information |
| app block | `src/**/*.{ts,tsx}` (Next: also root `app/`, `proxy.ts`, `instrumentation*.ts`) | `recommendedTypeChecked` with `projectService`, `react-hooks` flat `recommended`, `jsx-a11y`, `import`, `unused-imports`, the team rules — **never** applied to config files |
| framework | app block | `next`: `@next/eslint-plugin-next` · `shadcn-tailwind-tanstack-router`: `@tanstack/eslint-plugin-router` + `react-refresh` · `antd-scss-react-router`: `react-refresh` |
| architecture | app block | `next` / `shadcn-tailwind-tanstack-router`: `eslint-plugin-boundaries` (FSD layers) + public-API `no-restricted-imports` · `antd-scss-react-router`: `no-restricted-imports` only (no deep feature imports, `shared/` never imports `features/`) |
| axios restriction | app block | axios importable only in the HTTP client files, never in `*.server.ts` |
| AntD static APIs | app block, `antd-scss-react-router` only | no `message`/`notification` imports from `antd`, no static `Modal.confirm` & co. — `App.useApp()` or `notify` (`ui-antd-scss.md`) |
| `max-lines` | `**/*.tsx` except tests | 150, blank lines and comments skipped |
| `prettier` | — | always **last** |

Team rules (identical in all three variants): `no-floating-promises`,
`no-misused-promises` (error), `consistent-type-imports` (inline),
`no-explicit-any` (warn), `unused-imports/*` (and
`@typescript-eslint/no-unused-vars` off), `import/order`, `import/no-duplicates`,
`eqeqeq`, `prefer-const`, `no-var`, `no-debugger`, `no-console` (warn, allow
`warn`/`error`), `react-hooks/exhaustive-deps` (error). `lint` runs with
`--max-warnings 0` in CI and in pre-commit, so every warning blocks.

`no-misused-promises` keeps `checksVoidReturn.attributes: false` so
`onSubmit={form.handleSubmit(onSubmit)}` and `onClick={() => mutateAsync(x)}`
are allowed; promises passed anywhere else that expects a `void` callback are
still errors.

## `eslint.config.mjs` — Next variant

```js
import nextPlugin from "@next/eslint-plugin-next";
import pluginQuery from "@tanstack/eslint-plugin-query";
import prettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// app code: FSD in src/ + Next routing/runtime files at the root (never config files)
const appFiles = ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "proxy.ts", "instrumentation*.ts"];

export default defineConfig(
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "src/shared/ui/**", // shadcn sources
    "next-env.d.ts",
  ]),
  tseslint.configs.recommended,
  pluginQuery.configs["flat/recommended"],
  {
    files: appFiles,
    extends: [
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      "@next/next": nextPlugin,
      boundaries,
      import: importPlugin,
      "unused-imports": unusedImports,
    },
    settings: {
      "import/resolver": { typescript: true, node: true },
      "import/internal-regex": "^@/",
      "boundaries/elements": [
        { type: "app", pattern: "src/app-layer/*" },
        { type: "views", pattern: "src/views/*", capture: ["slice"] },
        { type: "widgets", pattern: "src/widgets/*", capture: ["slice"] },
        { type: "features", pattern: "src/features/*", capture: ["slice"] },
        { type: "entities", pattern: "src/entities/*", capture: ["slice"] },
        { type: "shared", pattern: "src/shared/*" },
        { type: "routes", pattern: "app/*" },
      ],
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/exhaustive-deps": "error",

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],

      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling"], "index", "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": ["error", { "prefer-inline": true }],

      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-var": "error",
      "no-debugger": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],

      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "axios",
              message:
                "Client: http from @/shared/api. Server: serverFetch from @/shared/api/http.server",
            },
          ],
          patterns: [
            {
              // deep imports banned, except server-only `<slice>/api/<name>.server`
              // (index.ts never re-exports it; server code imports it by path)
              regex: "^@/(views|widgets|features|entities)/[^/]+/(?!api/[^/]+\\.server$).+",
              message: "Import slices only through their public API (index.ts)",
            },
          ],
        },
      ],
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "routes", allow: ["views", "app", "shared"] },
            { from: "app", allow: ["views", "widgets", "features", "entities", "shared"] },
            { from: "views", allow: ["widgets", "features", "entities", "shared"] },
            { from: "widgets", allow: ["features", "entities", "shared"] },
            { from: "features", allow: ["entities", "shared"] },
            { from: "entities", allow: ["shared"] },
            { from: "shared", allow: ["shared"] },
          ],
        },
      ],
    },
  },
  {
    // axios allowed only in the client http layer — never in *.server.ts
    files: ["src/shared/api/**"],
    ignores: ["src/shared/api/**/*.server.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: { "max-lines": ["error", { max: 150, skipBlankLines: true, skipComments: true }] },
  },
  prettier,
);
```

Same-slice relative imports are unaffected. `prettier` stays **last**.

## `eslint.config.mjs` — `shadcn-tailwind-tanstack-router` variant (Vite + TanStack Router + FSD)

```js
import pluginQuery from "@tanstack/eslint-plugin-query";
import pluginRouter from "@tanstack/eslint-plugin-router";
import prettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const appFiles = ["src/**/*.{ts,tsx}"];

export default defineConfig(
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "src/shared/ui/**", // shadcn sources
    "src/routeTree.gen.ts",
  ]),
  tseslint.configs.recommended,
  pluginQuery.configs["flat/recommended"],
  pluginRouter.configs["flat/recommended"],
  {
    files: appFiles,
    extends: [
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      boundaries,
      import: importPlugin,
      "react-refresh": reactRefresh,
      "unused-imports": unusedImports,
    },
    settings: {
      "import/resolver": { typescript: true, node: true },
      "import/internal-regex": "^@/",
      "boundaries/elements": [
        { type: "app", pattern: "src/app/*" },
        { type: "routes", pattern: "src/routes/*" },
        { type: "views", pattern: "src/views/*", capture: ["slice"] },
        { type: "widgets", pattern: "src/widgets/*", capture: ["slice"] },
        { type: "features", pattern: "src/features/*", capture: ["slice"] },
        { type: "entities", pattern: "src/entities/*", capture: ["slice"] },
        { type: "shared", pattern: "src/shared/*" },
      ],
    },
    rules: {
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],

      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling"], "index", "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": ["error", { "prefer-inline": true }],

      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-var": "error",
      "no-debugger": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],

      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "axios", message: "Use http from @/shared/api" }],
          patterns: [
            {
              group: ["@/views/*/*", "@/widgets/*/*", "@/features/*/*", "@/entities/*/*"],
              message: "Import slices only through their public API (index.ts)",
            },
          ],
        },
      ],
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "routes", allow: ["views", "app", "shared"] },
            {
              from: "app",
              allow: ["routes", "views", "widgets", "features", "entities", "shared"],
            },
            { from: "views", allow: ["widgets", "features", "entities", "shared"] },
            { from: "widgets", allow: ["features", "entities", "shared"] },
            { from: "features", allow: ["entities", "shared"] },
            { from: "entities", allow: ["shared"] },
            { from: "shared", allow: ["shared"] },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/api/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // route files export `Route`, not a component — Fast Refresh rule doesn't apply
    files: ["src/routes/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: { "max-lines": ["error", { max: 150, skipBlankLines: true, skipComments: true }] },
  },
  prettier,
);
```

## `eslint.config.mjs` — `antd-scss-react-router` variant (Vite + React Router + feature folders + AntD)

No `eslint-plugin-boundaries` (there are no FSD layers). Architecture is
enforced with `no-restricted-imports` (`feature-architecture.md`): other code
imports a feature only via `@/features/<domain>`, `shared/` never imports
`features/` or `app/`, and axios is importable only in
`shared/lib/http-client.ts` and `shared/lib/auth-http-client.ts`. A later
`no-restricted-imports` entry **replaces** an earlier one for the files it
matches, so every block repeats what still applies. AntD's static
`message`/`notification`/`Modal.confirm` APIs are banned in favour of
`App.useApp()` / the `notify` bridge (`ui-antd-scss.md`). There are no shadcn
sources to ignore.

```js
import pluginQuery from "@tanstack/eslint-plugin-query";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const appFiles = ["src/**/*.{ts,tsx}"];

const noAxios = { name: "axios", message: "Use httpClient from @/shared/lib/http-client." };
const noDeepFeature = {
  group: ["@/features/*/*"],
  message: "Import a feature only through its public API: @/features/<domain>.",
};
const noFeaturesInShared = {
  group: ["@/features", "@/features/**", "@/app/**"],
  message: "shared/ is business-agnostic: it never imports features/ or app/.",
};
const noAntdStatic = {
  name: "antd",
  importNames: ["message", "notification"],
  message: "Use App.useApp() or notify from @/shared/lib/notify.",
};

export default defineConfig(
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  tseslint.configs.recommended,
  pluginQuery.configs["flat/recommended"],
  {
    files: appFiles,
    extends: [
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      import: importPlugin,
      "react-refresh": reactRefresh,
      "unused-imports": unusedImports,
    },
    settings: {
      "import/resolver": { typescript: true, node: true },
      "import/internal-regex": "^@/",
    },
    rules: {
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],

      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling"], "index", "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": ["error", { "prefer-inline": true }],

      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-var": "error",
      "no-debugger": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],

      "no-restricted-imports": [
        "error",
        { paths: [noAxios, noAntdStatic], patterns: [noDeepFeature] },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='Modal'][property.name=/^(confirm|info|success|error|warning)$/]",
          message: "Use App.useApp().modal.",
        },
      ],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [noAxios, noAntdStatic], patterns: [noDeepFeature, noFeaturesInShared] },
      ],
    },
  },
  {
    // the only two files that may import axios
    files: ["src/shared/lib/http-client.ts", "src/shared/lib/auth-http-client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [noAntdStatic], patterns: [noFeaturesInShared] },
      ],
    },
  },
  {
    // route modules export `loader` next to `Component`; test helpers export functions
    files: ["src/routes/**", "src/app/router.tsx", "src/test/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: { "max-lines": ["error", { max: 150, skipBlankLines: true, skipComments: true }] },
  },
  prettier,
);
```

Inside a feature use relative imports (`../lib/api`); between features always
the alias `@/features/<domain>`, never `../../other-feature/…`.

### About `max-lines`

The rule counts **every non-blank, non-comment line of the whole `.tsx` file**
— imports, the props type, hoisted constants and helpers included — not just
the component function body. A file at 150 lines is the signal to decompose
(`components.md`), not to squeeze code onto fewer lines. Tests are excluded.

### Type-aware linting notes

- `projectService: true` picks the nearest `tsconfig*.json` for each file
  (works with Vite's `tsconfig.app.json` / `tsconfig.node.json` references).
  A file in `appFiles` that no tsconfig includes is a lint error — add it to
  `include`, don't widen `appFiles`.
- Type-aware rules are slower; that is why they are scoped to app code and
  why pre-commit lints staged files only.

## Prettier — `.prettierrc.json`

`next` and `shadcn-tailwind-tanstack-router`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/app-layer/styles/globals.css"
}
```

- `plugins` **must** list `prettier-plugin-tailwindcss` in the config file —
  installing the package is not enough; Prettier does not load a plugin it
  does not see in `plugins`.
- `tailwindStylesheet` points at the CSS file containing `@import "tailwindcss"`
  (Tailwind v4 needs it to know the project's theme classes):

| Profile | `tailwindStylesheet` |
| --- | --- |
| `next` | `./src/app-layer/styles/globals.css` |
| `shadcn-tailwind-tanstack-router` | `./src/app/styles/globals.css` |

`antd-scss-react-router` — same settings, **no Tailwind plugin** (the profile has
no Tailwind; `prettier-plugin-tailwindcss` is not installed):

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

- The style is the team standard (STANDARDS §11), not a suggestion. An existing
  project with another style switches in **one separate commit**
  (`style: apply team prettier config`, `npm run format`, nothing else) and
  adds that commit hash to `.git-blame-ignore-revs`. Never mix reformatting
  with behaviour changes in one commit.
- Code written by hand or by templates follows the same style (double quotes,
  semicolons, trailing commas); run `format` after generating files.

`.prettierignore`:

```
dist
.next
coverage
playwright-report
test-results
src/routeTree.gen.ts
package-lock.json
pnpm-lock.yaml
```

## TypeScript — `tsconfig`

`compilerOptions` (Next: `tsconfig.json`; Vite: `tsconfig.app.json`, keep the
template's other options):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- Unused-but-required names (callback params, destructured rest) are prefixed
  `_` — both `tsc` and `unused-imports/no-unused-vars` ignore them.
- `typecheck` script: Next `tsc --noEmit`; Vite `tsc -b` (the root
  `tsconfig.json` is a solution file with `"files": []` and `references`, so
  `tsc --noEmit` on it checks nothing).

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
    "*.{ts,tsx,js,mjs}": ["eslint --fix --max-warnings 0", "prettier --write"],
    "*.{css,scss,md,json}": ["prettier --write"]
  }
}
```

(Vite: `"typecheck": "tsc -b"`. CI runs `lint -- --max-warnings 0`, `ci.md`.)

`commitlint.config.mjs`

```js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // scope = FSD slice or feature folder name: feat(inspections): add status filter
    "scope-case": [2, "always", "kebab-case"],
  },
};
```

- Commit scope = the slice (`next` / `shadcn-tailwind-tanstack-router`) or feature folder (`antd-scss-react-router`)
  the change belongs to: `feat(inspections): add status filter`,
  `fix(add-to-cart): disable button while pending`. Cross-cutting changes use
  the area: `chore(deps): …`, `ci(workflow): …`, or no scope.
- Optional, for larger teams: `"scope-enum": [2, "always", ["inspections", "users", "deps", "ci"]]`
  kept in sync with `src/features/` (or the FSD slices).

Commit types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`,
`style`, `build`, `ci`.

## Node version

Commit `.nvmrc` (e.g. `22`) and `"engines": { "node": ">=22" }`; CI reads
`.nvmrc` (`ci.md`).

## Optional

`knip` for dead code/unused deps; `@next/bundle-analyzer` /
`rollup-plugin-visualizer`; `size-limit` for bundle budgets in CI.

## Verify

After setup run `lint`, `typecheck`, `test` with the detected manager, run
`format` and check `git diff` is empty on a second run, and make a test commit
with a bad message to confirm commitlint rejects it (then abort).
