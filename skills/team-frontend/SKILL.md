---
name: team-frontend
description: Team frontend standards for Next.js (App Router) and React projects — Feature-Sliced Design, Server Components first, components ≤150 lines with decomposition into local components/ folders, minimal useEffect, axios with token-refresh interceptor, Zustand, TanStack Query, TanStack Router (React only), Tailwind + shadcn/ui, Vitest, husky + ESLint. Also checks dependency versions and proposes upgrades. Use whenever writing, scaffolding, reviewing or refactoring frontend code in a Next.js or React project, or when the user asks to set up/upgrade a frontend project.
---

# Team Frontend Standards

You write and change frontend code **only** in the way described here. The full
standard is `STANDARDS.md` (in this skill folder); the files in
`references/` hold the detailed rules and code templates. All knowledge needed
is local — do **not** browse external URLs to look up these rules.

## Step 0 — Detect the project (every session, before any code)

1. Read `package.json`.
   - `next` in dependencies → **Next.js mode**. Routing = Next.js App Router.
     Keep framework principles (see `references/nextjs.md`).
   - `react` without `next` → **React mode**. Routing = TanStack Router
     (see `references/react-tanstack-router.md`).
   - Neither → ask the user which one to scaffold.
2. **Version check** (see `references/dependency-updates.md`): run
   `npm view <pkg> version` for the core packages, compare with installed
   versions, show a short table. If anything is outdated, **propose** the upgrade
   and wait for the user's confirmation. Never upgrade without confirmation.
   Major versions: list breaking changes and use the official codemod.
3. **Tooling check** (see `references/tooling.md`): if husky, lint-staged,
   commitlint, ESLint (with the required plugins), Prettier or Vitest are
   missing, tell the user and set them up (or run `/front-setup`).
4. Detect FSD: does `src/` contain `shared/`, `entities/`, `features/`, … ? If
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

- **≤150 lines per component file.** If it would exceed, decompose. Put
  sub-components in a `components/` folder **next to the parent file**.
- One component per file; never declare components inside components.
- Composition over boolean props; compound components; `children` slots.
- **Avoid `useEffect`.** Before writing one, walk the replacement table in
  `references/use-effect.md`. Allowed only to sync with an external system,
  with a one-line comment saying which system.
- **Next.js:** Server Component by default. Add `"use client"` only to the
  smallest leaf that needs interactivity. Never on `page.tsx`/`layout.tsx`.
- UI: shadcn/ui primitives from `shared/ui` + Tailwind tokens. Accessibility is
  mandatory. Details: `references/ui-tailwind-shadcn.md`.

## Step 3 — Data, state, HTTP

- HTTP: only via `shared/api/http.ts` (axios instance + refresh interceptor).
  Template: `references/http-axios.md`. If the project lacks this file or the
  interceptor lacks single-flight refresh, create/fix it.
- Server state: RSC fetch (Next) or TanStack Query. Client shared state:
  Zustand with selectors. Details: `references/state-data.md`.
- Patterns (composition, data fetching, render optimisation, RSC):
  `references/react-patterns.md`.

## Step 4 — Tests

Every new/changed `model/`, `lib/`, `api/` unit and feature/widget component
gets a Vitest test in the same change. MSW for network. Template and rules:
`references/testing-vitest.md`. Run `npm run test` and report the real result.

## Step 5 — Self-review before finishing

Run through `references/refactoring-smells.md` and the Definition of Done in
`STANDARDS.md` §13. Then run `lint`, `typecheck`, `test`. Report failures
honestly; do not claim green without running.

## Reference index

| File | Read when |
| --- | --- |
| `references/nextjs.md` | Next.js project: routing, RSC, caching, Server Actions, proxy |
| `references/react-tanstack-router.md` | React (non-Next) project routing |
| `references/fsd.md` | deciding where any file goes |
| `references/components.md` | writing/decomposing components |
| `references/use-effect.md` | about to write `useEffect` |
| `references/react-patterns.md` | composition, data-fetching, performance patterns |
| `references/http-axios.md` | any HTTP / auth / token work |
| `references/state-data.md` | Zustand, TanStack Query |
| `references/ui-tailwind-shadcn.md` | any UI/styling/accessibility work |
| `references/refactoring-smells.md` | review or refactor |
| `references/testing-vitest.md` | writing tests, Vitest setup |
| `references/tooling.md` | husky, ESLint, Prettier, commitlint setup |
| `references/dependency-updates.md` | version check / upgrades |
