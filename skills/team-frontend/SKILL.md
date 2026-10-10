---
name: team-frontend
description: Team frontend standards for Next.js (App Router, FSD) and React SPAs (profile shadcn-tailwind-tanstack-router = FSD, or antd-scss-react-router = feature folders) — RSC first, ≤150-line components, minimal useEffect, axios client + serverFetch on the Next server, Zustand, TanStack Query, shadcn or AntD UI, Vitest + Playwright, security, Sentry, i18n, tooling/CI. Use whenever writing, scaffolding, reviewing or refactoring frontend code in a Next.js or React project, or setting up/upgrading one.
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
   - `react` without `next` → **React mode**. Then pick the **profile**
     (STANDARDS §1.1) — **look at the existing structure first**:
     1. FSD layers in `src/` (`entities`, `widgets`, `views`) or
        `@tanstack/react-router` or shadcn `components.json` →
        `shadcn-tailwind-tanstack-router`
        (`references/react-tanstack-router.md`, `references/ui-tailwind-shadcn.md`);
     2. `src/features/<domain>/` + `shared/` without FSD layers, or
        `react-router`/`react-router-dom`, `antd` → `antd-scss-react-router`
        (`references/feature-architecture.md`, `references/react-router-dom.md`,
        `references/ui-antd-scss.md`);
     3. code that matches neither → `legacy`: keep its layout, put new code
        next to similar existing code, apply only non-structural rules;
     4. mixed signals → follow what the code uses (structure, router, UI kit),
        apply the closest profile's other rules and report the deviation;
     5. empty/new project → the `CLAUDE.md` `## Frontend profile` section,
        else ask (default `shadcn-tailwind-tanstack-router`); `/front-setup` records the choice.
     The `CLAUDE.md` section only confirms: if it contradicts the code, follow
     the code and tell the user about the mismatch.
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
6. Structure follows what already exists. Next.js and
   `shadcn-tailwind-tanstack-router` → FSD, `antd-scss-react-router` → feature folders; a new/empty project adopts its profile's
   layout. A `legacy` or mixed project keeps its layout: write new code where
   similar code already lives, never move existing files unasked, and only
   propose an incremental migration.

## Step 1 — Where does the code go?

- **FSD (Next.js, `shadcn-tailwind-tanstack-router`)** — read `references/fsd.md`. Decide the layer and
  slice **before** writing code: `shared` (business-agnostic) → `entities`
  (business noun) → `features` (user action) → `widgets` (composed block) →
  `views` (page) → route file (thin). Import only through a slice's
  `index.ts`. No cross-imports within one layer.
- **`antd-scss-react-router`** — read `references/feature-architecture.md`. Code goes
  into `features/<domain>/{components,hooks,lib,queries,schemas,types}` or
  `shared/`; other features are imported only via `@/features/<domain>`.
  Where the references show FSD paths, translate them with its path map.

## Step 2 — Write the component

Hard rules (details: `references/components.md`):

- **≤150 lines per `.tsx` file** (whole file, blank/comment lines excluded —
  ESLint `max-lines`). If it would exceed, decompose.
  Put sub-components in a `components/` folder **next to the parent file**.
- One component per file; never declare components inside components.
- No layout/behaviour-mode boolean props (`isCompact`, `withHeader`) — use
  `cva` variants (`antd-scss-react-router`: typed `variant` prop + SCSS-module
  modifiers) or composition; state booleans (`disabled`, `open`,
  `loading`…) are fine. Compound components; `children` slots.
- **Avoid `useEffect`.** Before writing one, walk the replacement table in
  `references/use-effect.md`. Allowed only to sync with an external system,
  with a one-line comment saying which system.
- **Next.js:** Server Component by default. Add `"use client"` only to the
  smallest leaf that needs interactivity. Never on `page.tsx`/`layout.tsx`.
- UI: shadcn/ui primitives from `shared/ui` + Tailwind tokens
  (`references/ui-tailwind-shadcn.md`); `antd-scss-react-router` → Ant Design v5 + SCSS
  modules (`references/ui-antd-scss.md`). One UI approach per project. Accessibility is
  mandatory.
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
- Server state: RSC + `serverFetch` (Next) or TanStack Query with key
  factories and a per-endpoint cache policy. Client shared state: Zustand with
  selectors; feature stores via `createResettableStore`, all reset on logout.
  Details: `references/state-data.md`.
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
| `references/react-tanstack-router.md` | `shadcn-tailwind-tanstack-router` routing |
| `references/react-router-dom.md` | `antd-scss-react-router` routing |
| `references/fsd.md` | deciding where any file goes (Next.js, `shadcn-tailwind-tanstack-router`) |
| `references/feature-architecture.md` | `antd-scss-react-router`: folders, naming, imports, FSD → feature path map |
| `references/ui-antd-scss.md` | `antd-scss-react-router`: Ant Design v5 + SCSS modules |
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
