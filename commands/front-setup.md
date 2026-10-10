---
description: Audit and set up a Next.js or React project to the team frontend standards — records the profile (next / shadcn-tailwind-tanstack-router / antd-scss-react-router / legacy) in CLAUDE.md, dependency version check, strict ESLint/TS, Prettier, husky/commitlint, Vitest + MSW, Playwright + axe, CI, UI kit, axios + serverFetch, query-client defaults, resettable stores, CSP, Sentry, optional i18n, FSD or feature skeleton.
argument-hint: "[audit-only]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Set up or audit this project according to the `team-frontend` skill
(`.claude/skills/team-frontend/SKILL.md` and `STANDARDS.md`). If that folder is
not present (plugin install), find it with Glob
`**/skills/team-frontend/STANDARDS.md` (under `~/.claude/plugins`). Use only
the local reference files; do not browse the web.

If `$ARGUMENTS` contains `audit-only`, perform steps 1–3 and stop after the
report (do not write `CLAUDE.md` either — report the profile you would record).

1. **Detect** mode from `package.json` (`next` → Next.js, `react` only → React;
   neither → ask). Detect the **package manager** (`packageManager` field, else
   lockfile; several lockfiles → ask) per `references/tooling.md` and use only
   it in every command, hook and CI file.
2. **Profile** (STANDARDS §1.1, SKILL.md Step 0):
   - Next.js → `profile: next` (always FSD + Tailwind + shadcn/ui).
   - React: **the existing structure decides** — FSD layers in `src/`,
     `@tanstack/react-router` or shadcn `components.json` →
     `shadcn-tailwind-tanstack-router`; `features/<domain>` + `shared/`
     without FSD layers, `react-router`/`react-router-dom` or `antd` →
     `antd-scss-react-router`; code that matches neither → `legacy` (record
     it, keep the layout, offer — don't start — a migration plan to one of
     the two profiles); mixed signals → record the closest profile, follow
     what the code uses and report the deviation as ⚠️.
   - **New React project** (nothing to detect) → ask **one** question:
     `shadcn-tailwind-tanstack-router` (FSD + TanStack Router + Tailwind v4 +
     shadcn/ui, default) or `antd-scss-react-router` (feature folders + React
     Router + Ant Design v5 + SCSS modules, no Tailwind). Each profile is a
     fixed bundle — never ask about the router or UI kit separately.
   - An existing section that contradicts the code (e.g. says
     `antd-scss-react-router` but `src/` is FSD) → report ❌ and correct the
     section to match the code (outside `audit-only`); never move files to
     match the section. An old multi-line section (`ui:` / `router:` lines)
     is replaced by the single `profile` line.
   - Write / update the section in the project-root `CLAUDE.md` (create the
     file if missing). Replace **only** the `## Frontend profile` section (up
     to the next `## ` heading); never touch other content:

     ```md
     ## Frontend profile

     - profile: antd-scss-react-router
     ```

     One line; the value is `next`, `shadcn-tailwind-tanstack-router`,
     `antd-scss-react-router` or `legacy`.

   Every later step uses this profile. Reference files to use per profile:
   Next → `references/fsd.md`, `references/nextjs.md`,
   `references/ui-tailwind-shadcn.md`; `shadcn-tailwind-tanstack-router` →
   `references/fsd.md`, `references/react-tanstack-router.md`,
   `references/ui-tailwind-shadcn.md`; `antd-scss-react-router` →
   `references/feature-architecture.md`, `references/react-router-dom.md`,
   `references/ui-antd-scss.md`. Where references show FSD paths,
   `antd-scss-react-router` translates them with the path map in
   `references/feature-architecture.md` (`shared/api/http.ts` →
   `shared/lib/http-client.ts`, `shared/config/env.ts` → `shared/lib/env.ts`, …).
3. **Audit** and print the profile line, then a checklist table (✅ / ❌ / ⚠️) of:
   - **profile** — recorded in `CLAUDE.md` as one `- profile:` line, matches
     the structure and installed router/UI deps; no second router or UI kit
     (`antd-scss-react-router`: no `tailwindcss`, shadcn, Radix or `sonner`)
     (§1, §1.1)
   - **dependency versions** vs latest (`references/dependency-updates.md`) —
     this is where the version check runs; keep the result for the session
   - ESLint flat config (`defineConfig`) per §11: `typescript-eslint`
     `recommendedTypeChecked` on `src/**` with `projectService`; required rules
     `no-floating-promises`, `no-misused-promises`, `consistent-type-imports`,
     `no-explicit-any` (warn), `eqeqeq`, `prefer-const`, `no-var`,
     `no-debugger`; `react-hooks` (current major), `jsx-a11y`,
     `import/order`, `unused-imports`, `max-lines` 150, `no-console`, axios
     `no-restricted-imports`; profile plugins — Next `@next/eslint-plugin-next`,
     `shadcn-tailwind-tanstack-router` `@tanstack/eslint-plugin-router` +
     `boundaries`, `antd-scss-react-router` `no-restricted-imports` against
     `@/features/*/*` deep imports and static `antd` `message` /
     `notification`; React SPAs
     `react-refresh`; all `@tanstack/eslint-plugin-query`; `lint` with
     `--max-warnings 0`
   - `tsconfig`: `strict`, `noUnusedLocals`, `noUnusedParameters`,
     `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
   - Prettier `.prettierrc.json` exactly as §11 (`semi: true`, double quotes,
     `trailingComma: "all"`, `printWidth: 100`, `arrowParens: "always"`,
     `endOfLine: "lf"`; `plugins: ["prettier-plugin-tailwindcss"]` only for
     `next` / `shadcn-tailwind-tanstack-router` — the `antd-scss-react-router`
     config has no Tailwind plugin); husky
     hooks (pre-commit, commit-msg, pre-push) using the detected runner;
     lint-staged; commitlint; `.nvmrc` + `engines.node`
   - Vitest config (excludes `e2e/**`), setup file, MSW, render helper, `test*`
     scripts; `antd-scss-react-router`: `src/test/setup.ts`, `src/test/test-utils.tsx`
     (`renderWithProviders` wraps only `QueryClientProvider`),
     `src/test/mocks/handlers.ts` + `mocks/handlers/<domain>.ts`
   - Playwright: `playwright.config.ts`, `e2e/` with auth setup + smoke spec,
     `@axe-core/playwright` helper, `test:e2e` script, `.gitignore` entries
     (`references/e2e-playwright.md`)
   - CI: `.github/workflows/ci.yml` with frozen install, lint, typecheck,
     test:coverage, build, audit, E2E (`references/ci.md`)
   - UI: `next` / `shadcn-tailwind-tanstack-router` → Tailwind v4 + `cn()`,
     shadcn `components.json` aliases (`shared/ui`), `sonner`;
     `antd-scss-react-router` → `antd` v5 (+ React 19 patch import first in
     `main.tsx`), `ConfigProvider` theme tokens in `shared/lib/theme.ts` +
     `App` wrapper (toasts via `App.useApp()`), shared components in
     `shared/components/` with co-located `*.module.scss`, `sass-embedded`,
     no Tailwind / shadcn / `sonner`
   - HTTP: one axios instance with single-flight refresh interceptor, in-memory
     token, `ApiError` without axios — Next / `shadcn-tailwind-tanstack-router`:
     `shared/api/http.ts`,
     `token.ts`, `api-error.ts`, Next `shared/api/http.server.ts`
     (`serverFetch`) and no axios in server code; `antd-scss-react-router`:
     `shared/lib/http-client.ts` + `shared/lib/auth-http-client.ts` (bare
     instance used only by `refreshAccessToken`) (`references/http-axios.md`)
   - Env: `shared/config/env.ts` (+ Next `env.server.ts` with `server-only`;
     `antd-scss-react-router`: `shared/lib/env.ts`); no secrets in
     `NEXT_PUBLIC_*`/`VITE_*`;
     `.env.example`
   - Security: CSP (Next nonce in `proxy.ts`; Vite host header), security
     headers, `poweredByHeader: false`, `sanitizeHtml`/`safeHref` helpers
     where HTML/URLs are rendered (`references/security.md`)
   - Monitoring: Sentry init for every runtime, `error.tsx` /
     `global-error.tsx` (Next) or route `errorComponent` / `errorElement` +
     root error hooks (React) reporting, logger (`shared/lib/logger`),
     Web Vitals reporter (`references/observability.md`)
   - i18n — **only if the product has more than one locale** (ask if unclear):
     next-intl / react-i18next setup per `references/i18n.md`
   - State (§7, `references/state-data.md`): one `QueryClient` with the
     standard defaults (fallback `staleTime` 60 s, GET `retry: 2` with
     exponential `retryDelay`, no retry on 4xx, mutations `retry: 0`),
     provider at the root, Devtools dev-only; key factories; Zustand via
     `createResettableStore` (`antd-scss-react-router`:
     `shared/stores/create-resettable-store.ts`)
     with `resetAllStores()`; logout calls `resetAllStores()` +
     `queryClient.clear()` + clears the in-memory token
   - Structure: Next / `shadcn-tailwind-tanstack-router` → FSD skeleton
     (`src/{app-layer|app,views,widgets,features,entities,shared}`);
     `antd-scss-react-router` →
     `src/{app,routes,features,shared/{components,hooks,lib,stores,types},test,styles}`
     (§2.5); `@/*` path alias in both tsconfig and Vite
   - Next: `proxy.ts`, `loading.tsx`/`error.tsx`, env validation
   - `shadcn-tailwind-tanstack-router`: TanStack Router plugin + `routes/` +
     router context with QueryClient
   - `antd-scss-react-router`: React Router data mode (`createBrowserRouter` +
     `RouterProvider`), route modules in `src/routes/` with `loader`s using
     `queryClient.ensureQueryData`, auth guard as a `loader` `redirect()` (not
     `useEffect`), `errorElement` per data route, lazy route modules
4. **Ask for confirmation** once, listing what will be installed/created and
   any dependency upgrades (major upgrades listed separately).
5. **Apply** the confirmed items using the templates in the skill's
   `references/` (tooling.md, ci.md, testing-vitest.md, e2e-playwright.md,
   http-axios.md, security.md, observability.md, i18n.md, state-data.md,
   and per profile: Next → fsd.md + nextjs.md + ui-tailwind-shadcn.md;
   `shadcn-tailwind-tanstack-router` → fsd.md + react-tanstack-router.md +
   ui-tailwind-shadcn.md; `antd-scss-react-router` → feature-architecture.md
   + react-router-dom.md + ui-antd-scss.md), translating commands to the
   detected package manager. Profile-specific installs:
   `shadcn-tailwind-tanstack-router` → `@tanstack/react-router` + its Vite
   plugin and ESLint plugin, Tailwind v4 + `prettier-plugin-tailwindcss`,
   shadcn init with `shared/ui` aliases, `sonner`; `antd-scss-react-router` →
   `react-router`, `antd@5` + `@ant-design/v5-patch-for-react-19` (React 19),
   `sass-embedded` (dev), `ConfigProvider` theme in `shared/lib/theme.ts` —
   no Tailwind, no Tailwind Prettier plugin, no shadcn, no `sonner`. Never
   install a second router or UI kit. Write all new config/code in the §11 Prettier style
   (double quotes, semicolons). Merge with existing configs rather than
   overwriting; show diffs for changed config files. Never move existing source
   files in this command and never convert between profiles — propose an FSD /
   feature-folder migration plan instead.
6. **Verify**: run `lint`, `typecheck`, `test` and `build` (and `test:e2e` if
   Playwright was set up and a backend is reachable). Report real results.
   Turning on the stricter ESLint/TS rules in an existing project may surface
   many errors — report the count per rule and propose a fix plan instead of
   disabling rules.
7. Print a final summary: profile recorded, what was added, what was skipped,
   what needs manual action (e.g. CI secrets `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`,
   `SENTRY_AUTH_TOKEN`, host-level CSP headers for Vite).
