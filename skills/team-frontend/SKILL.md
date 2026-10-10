---
name: team-frontend
description: Team frontend standards for Next.js (App Router) and React (Vite + TanStack Router) — Feature-Sliced Design, Server Components first, ≤150-line components, minimal useEffect, axios client + serverFetch on the Next server, Zustand, TanStack Query, Tailwind + shadcn/ui, Vitest + Playwright, security, Sentry, i18n, husky/ESLint/CI. Use whenever writing, scaffolding, reviewing or refactoring frontend code in a Next.js or React project, or setting up/upgrading one.
---

# Team Frontend Standards

You write and change frontend code **only** in the way described here. The full
standard is `STANDARDS.md` (in this skill folder, sections §1–§16); the files in
`references/` hold the detailed rules and code templates. All knowledge needed
is local — do **not** browse external URLs to look up these rules.

## Step 0 — Detect the project (every session, before any code)

1. Read `package.json`.
   - `next` in dependencies → **Next.js mode**. Routing = Next.js App Router.
     Keep framework principles (see `references/nextjs.md`).
   - `react` without `next` → **React mode**. Routing = TanStack Router
     (see `references/react-tanstack-router.md`).
   - Neither → ask the user which one to scaffold.
2. **Package manager** (`references/tooling.md` → "Package manager"):
   `packageManager` field, else the lockfile (`package-lock.json` → npm,
   `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock`/`bun.lockb` → bun).
   Several lockfiles → ask. Use only that manager in every command you run or
   write; examples in the references use npm — translate them.
3. **Version check — not every session** (`references/dependency-updates.md`):
   only during `/front-setup`, when the user asks, or before a
   dependency-related task; at most once per session (reuse the table, re-run
   only after the lockfile changed). Never upgrade without confirmation; majors
   get a breaking-change summary and the official codemod.
4. **Tooling check** (`references/tooling.md`): if husky, lint-staged,
   commitlint, ESLint (with the required plugins), Prettier, Vitest or
   Playwright are missing, tell the user and propose `/front-setup`.
5. Note what is present: `@sentry/*` (`references/observability.md`),
   `next-intl` / `react-i18next` (`references/i18n.md` — i18n rules apply when
   the product has >1 locale), `.github/workflows/ci.yml` (`references/ci.md`).
6. Detect FSD: does `src/` contain `shared/`, `entities/`, `features/`, … ? If
   not and the project is new or small, adopt FSD. If it is large and legacy,
   apply FSD to new code and propose an incremental migration — don't rewrite
   unasked.

## Step 1 — Where does the code go? (FSD)

Read `references/fsd.md`. Decide the layer and slice **before** writing code:
`shared` (business-agnostic) → `entities` (business noun) → `features` (user
action) → `widgets` (composed block) → `views` (page) → route file (thin).
Import only through a slice's `index.ts`. No cross-imports within one layer.

## Step 2 — Write the component

Hard rules (details: `references/components.md`):

- **≤150 lines per `.tsx` file** (whole file, blank/comment lines excluded —
  ESLint `max-lines`). If it would exceed, decompose.
  Put sub-components in a `components/` folder **next to the parent file**.
- One component per file; never declare components inside components.
- No layout/behaviour-mode boolean props (`isCompact`, `withHeader`) — use
  `cva` variants or composition; state booleans (`disabled`, `open`,
  `loading`…) are fine. Compound components; `children` slots.
- **Avoid `useEffect`.** Before writing one, walk the replacement table in
  `references/use-effect.md`. Allowed only to sync with an external system,
  with a one-line comment saying which system.
- **Next.js:** Server Component by default. Add `"use client"` only to the
  smallest leaf that needs interactivity. Never on `page.tsx`/`layout.tsx`.
- UI: shadcn/ui primitives from `shared/ui` + Tailwind tokens. Accessibility is
  mandatory. Details: `references/ui-tailwind-shadcn.md`.
- Multi-locale product: no hard-coded user-facing strings (incl. `aria-label`,
  `alt`, `placeholder`, toasts); logical Tailwind utilities (`ms-*`, `pe-*`).
  `references/i18n.md`.
- Never `dangerouslySetInnerHTML` without `sanitizeHtml`; user URLs through
  `safeHref`, redirects through `safeRedirect` (`references/security.md`).
- No `console.log` — use `shared/lib/logger` (`references/observability.md`).

## Step 3 — Data, state, HTTP

- Browser HTTP: only via `shared/api/http.ts` (axios instance + single-flight
  refresh interceptor). **Next server code** (RSC, Server Actions, route
  handlers, `proxy.ts`): only `serverFetch` from `shared/api/http.server.ts` —
  **never axios**. Template: `references/http-axios.md`. If the project lacks
  these files or the interceptor lacks single-flight refresh, create/fix them.
- Server Actions / mutating route handlers: authenticate, authorise, zod-validate
  (`references/security.md` §5). Secrets only in `shared/config/env.server.ts`.
- Server state: RSC + `serverFetch` (Next) or TanStack Query. Client shared
  state: Zustand with selectors. Details: `references/state-data.md`.
- Patterns (composition, data fetching, render optimisation, RSC):
  `references/react-patterns.md`.

## Step 4 — Tests

Every new/changed `model/`, `lib/`, `api/` unit and feature/widget component
gets a Vitest test in the same change. MSW for network. Template and rules:
`references/testing-vitest.md`. A change to a critical flow (auth, checkout-like
flow, core create/edit/delete, search via URL, new top-level route) adds or
updates a Playwright spec + axe check (`references/e2e-playwright.md`). Run the
detected manager's `test` script (and `test:e2e` when you touched E2E) and
report the real result.

## Step 5 — Self-review before finishing

Run through `references/refactoring-smells.md`, the security checklist in
`references/security.md` and the Definition of Done in `STANDARDS.md` §16.
Then run `lint`, `typecheck`, `test`. Report failures honestly; do not claim
green without running.

## Reference index

| File | Read when |
| --- | --- |
| `references/nextjs.md` | Next.js project: routing, RSC, caching, Server Actions, proxy, navigation, route handlers, parallel/intercepting routes, cookies |
| `references/react-tanstack-router.md` | React (non-Next) project routing |
| `references/fsd.md` | deciding where any file goes |
| `references/components.md` | writing/decomposing components, boolean props |
| `references/use-effect.md` | about to write `useEffect` |
| `references/react-patterns.md` | composition, data-fetching, performance patterns |
| `references/http-axios.md` | any HTTP / auth / token / env work — axios client + `serverFetch` (Next server) |
| `references/security.md` | CSP, security headers, XSS / `dangerouslySetInnerHTML`, cookies/CSRF, Server Action auth, env secrets, audit, third-party scripts |
| `references/state-data.md` | Zustand, TanStack Query |
| `references/ui-tailwind-shadcn.md` | any UI/styling/accessibility work |
| `references/refactoring-smells.md` | review or refactor |
| `references/testing-vitest.md` | writing unit/component tests, Vitest setup |
| `references/e2e-playwright.md` | E2E tests, Playwright setup, automated a11y (axe) |
| `references/observability.md` | Sentry, error boundaries, logging, Web Vitals, performance budgets, bundle analysis |
| `references/i18n.md` | translations, locales, next-intl / react-i18next, `Intl` formatting, RTL |
| `references/tooling.md` | package-manager detection, husky, ESLint, Prettier, commitlint, `.nvmrc` |
| `references/ci.md` | GitHub Actions CI template for the project |
| `references/dependency-updates.md` | version check / upgrades |
