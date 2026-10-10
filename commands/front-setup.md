---
description: Audit and set up a Next.js or React project to the team frontend standards — package-manager detection, dependency version check (with confirmation), ESLint/Prettier/husky/lint-staged/commitlint, Vitest + MSW, Playwright E2E + axe, GitHub Actions CI, Tailwind + shadcn/ui, axios client + serverFetch (Next server), security headers/CSP, Sentry + Web Vitals, optional i18n, TanStack Query/Zustand providers, FSD folder skeleton, TanStack Router for React.
argument-hint: "[audit-only]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Set up or audit this project according to the `team-frontend` skill
(`.claude/skills/team-frontend/SKILL.md` and `STANDARDS.md`). If that folder is
not present (plugin install), find it with Glob
`**/skills/team-frontend/STANDARDS.md` (under `~/.claude/plugins`). Use only
the local reference files; do not browse the web.

If `$ARGUMENTS` contains `audit-only`, perform steps 1–2 and stop after the report.

1. **Detect** mode from `package.json` (`next` → Next.js, else React; neither →
   ask). Detect the **package manager** (`packageManager` field, else lockfile;
   several lockfiles → ask) per `references/tooling.md` and use only it in every
   command, hook and CI file.
2. **Audit** and print a checklist table (✅ / ❌ / ⚠️) of:
   - **dependency versions** vs latest (`references/dependency-updates.md`) —
     this is where the version check runs; keep the result for the session
   - ESLint flat config (`defineConfig`) with required plugins, `max-lines` 150,
     `no-console`, axios `no-restricted-imports`; Prettier; husky hooks
     (pre-commit, commit-msg, pre-push) using the detected runner; lint-staged;
     commitlint; `.nvmrc` + `engines.node`
   - Vitest config (excludes `e2e/**`), setup file, MSW, render helper, `test*` scripts
   - Playwright: `playwright.config.ts`, `e2e/` with auth setup + smoke spec,
     `@axe-core/playwright` helper, `test:e2e` script, `.gitignore` entries
     (`references/e2e-playwright.md`)
   - CI: `.github/workflows/ci.yml` with frozen install, lint, typecheck,
     test:coverage, build, audit, E2E (`references/ci.md`)
   - Tailwind v4, shadcn `components.json` with FSD aliases, `cn()`
   - `shared/api/http.ts` with single-flight refresh interceptor, `token.ts`,
     `api-error.ts` (no axios); Next: `shared/api/http.server.ts` (`serverFetch`)
     and no axios in server code (`references/http-axios.md`)
   - Env: `shared/config/env.ts` (+ Next `env.server.ts` with `server-only`);
     no secrets in `NEXT_PUBLIC_*`/`VITE_*`; `.env.example`
   - Security: CSP (Next nonce in `proxy.ts`; Vite host header), security
     headers, `poweredByHeader: false`, `sanitizeHtml`/`safeHref` helpers
     where HTML/URLs are rendered (`references/security.md`)
   - Monitoring: Sentry init for every runtime, `error.tsx` /
     `global-error.tsx` (Next) or `errorComponent` + root error hooks (React)
     reporting, `shared/lib/logger`, Web Vitals reporter (`references/observability.md`)
   - i18n — **only if the product has more than one locale** (ask if unclear):
     next-intl / react-i18next setup per `references/i18n.md`
   - Query provider, Zustand usage pattern
   - FSD skeleton (`src/{app-layer|app,views,widgets,features,entities,shared}`), `@/*` path alias
   - Next: `proxy.ts`, `loading.tsx`/`error.tsx`, env validation
   - React: TanStack Router plugin + `routes/` + router context with QueryClient
3. **Ask for confirmation** once, listing what will be installed/created and
   any dependency upgrades (major upgrades listed separately).
4. **Apply** the confirmed items using the templates in the skill's
   `references/` (tooling.md, ci.md, testing-vitest.md, e2e-playwright.md,
   http-axios.md, security.md, observability.md, i18n.md, state-data.md,
   ui-tailwind-shadcn.md, fsd.md, nextjs.md / react-tanstack-router.md),
   translating commands to the detected package manager. Merge with existing
   configs rather than overwriting; show diffs for changed config files. Never
   move existing source files in this command — propose an FSD migration plan
   instead.
5. **Verify**: run `lint`, `typecheck`, `test` and `build` (and `test:e2e` if
   Playwright was set up and a backend is reachable). Report real results.
6. Print a final summary: what was added, what was skipped, what needs manual
   action (e.g. CI secrets `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`,
   `SENTRY_AUTH_TOKEN`, host-level CSP headers for Vite).
