---
name: front-template
description: Generates code in the team frontend format — a new Next.js or React project (profile shadcn-tailwind-tanstack-router = FSD + TanStack Router + Tailwind + shadcn, or antd-scss-react-router = feature folders + React Router + Ant Design + SCSS; CSP, Playwright + axe, CI), an FSD slice (entity / feature / widget / view), a feature module with Vitest tests, or a component. Use when the user runs /front-template or asks to scaffold a project, page, entity, feature, widget or component.
argument-hint: "react | react-shadcn | react-antd | next | project <name> [next|react|react-shadcn|react-antd] | entity|feature|widget|view <name> | component <path> <Name>"
---

# Front Template

Generates files in **exactly** the team format. The standard is
`../team-frontend/STANDARDS.md`; detailed rules live in
`../team-frontend/references/`. File templates for this skill live in
`templates/`. Everything is local — do not browse the web for the format.

## Step 0 — Parse the request

`$ARGUMENTS` (or the user's words) selects the mode:

| Mode | Example | Template file |
| --- | --- | --- |
| `react [name]` | `react` | asks the profile (below): `shadcn-tailwind-tanstack-router` → `templates/project.md` § A; `antd-scss-react-router` → `templates/antd-scss-react-router.md` § Project — **in the current folder** |
| `react-shadcn [name]` | `react-shadcn` | `templates/project.md` § A — Vite + TanStack Router + FSD + Tailwind + shadcn/ui, **in the current folder** |
| `react-antd [name]` | `react-antd` | `templates/antd-scss-react-router.md` § Project — Vite + React Router + feature folders + Ant Design v5 + SCSS modules, **in the current folder** |
| `next [name]` | `next` | `templates/project.md` § B — latest Next.js **in the current folder** |
| `project <name> [next\|react\|react-shadcn\|react-antd]` | `project shop-admin react-antd` | same templates, in a **new sub-folder** `<name>/` |
| `entity <name>` | `entity product` | `templates/slices.md` § Entity (FSD only) |
| `feature <name>` | `feature add-to-cart` / `feature inspections` | FSD → `templates/slices.md` § Feature; `antd-scss-react-router` → `templates/antd-scss-react-router.md` § Feature module |
| `widget <name>` | `widget product-list` | `templates/slices.md` § Widget (FSD only) |
| `view <name>` | `view product` | `templates/slices.md` § View (+ route file) (FSD only) |
| `component <path> <Name>` | `component widgets/header UserMenu` · `component features/inspections InspectionCard` | `templates/component.md` (both layouts) |

Rules for the first argument:

- `react` / `react-shadcn` / `react-antd` / `next` (case-insensitive; also
  `vite`, `react-vite` → `react`; `react-tanstack`, `react-tailwind` →
  `react-shadcn`; `react-router`, `antd` → `react-antd`; `nextjs`, `next.js`
  → `next`) → **in-place project mode**: scaffold the project **inside the
  current working folder** — no sub-folder. The package name is the optional
  `[name]`, else the current folder's name converted to lowercase kebab-case
  (npm rule).
- `react` without a profile → derive it (STANDARDS §1.1): the current folder's
  `CLAUDE.md` has a `## Frontend profile` section → use its `profile:` line;
  otherwise ask **one** question: "React profile:
  `shadcn-tailwind-tanstack-router` (FSD + TanStack Router + Tailwind +
  shadcn/ui, default) or `antd-scss-react-router` (feature folders + React
  Router + Ant Design v5 + SCSS modules)?". Each profile is a fixed bundle —
  never ask about the UI kit or the router separately.
- No arguments and the current folder has **no `package.json`** → it is a new
  project: ask one question — "Next.js, React
  `shadcn-tailwind-tanstack-router` or React `antd-scss-react-router`?" —
  then run in-place project mode.
- No arguments and `package.json` exists → ask which slice/feature/component to create.
- Every project scaffold writes the choice to the project's `CLAUDE.md`
  (create the file or append the section) — exactly one line:

  ```md
  ## Frontend profile

  - profile: antd-scss-react-router   # next | shadcn-tailwind-tanstack-router | antd-scss-react-router | legacy
  ```

If the mode or name is missing otherwise, ask **one** short question listing these modes.
Names are given in kebab-case; derive the placeholders:

| Placeholder | Example (`add-to-cart`) | Example (`inspections`, `antd-scss-react-router`) |
| --- | --- | --- |
| `__name__` | `add-to-cart` (folders, slice name) | `inspections` (feature folder, URL path) |
| `__Name__` | `AddToCart` (components, types) | `Inspections` (page/list components, store hook) |
| `__camel__` | `addToCart` (stores, functions, keys) | `inspections` (handlers, store file) |
| `__item__` | — | `inspection` (singular camel: keys, API object, schema file) |
| `__Item__` | — | `Inspection` (singular Pascal: entity type, form, mutations) |
| `__ITEM__` | — | `INSPECTION` (singular SCREAMING_SNAKE: cache-policy constants) |

`__item__` / `__Item__` / `__ITEM__` are the singular of the domain; derive it (`inspections`
→ `inspection`, `categories` → `category`) and ask only when it is ambiguous.

## Step 1 — Detect the target (not for project modes)

1. Read `package.json`: `next` → **Next mode** (FSD). `react` without `next` →
   **React mode**; pick the profile exactly as
   `../team-frontend/SKILL.md` Step 0 does — **existing structure first**:
   FSD layers, `@tanstack/react-router` or shadcn `components.json` →
   `shadcn-tailwind-tanstack-router`; `features/<domain>` + `shared/` without
   FSD layers, `react-router`/`react-router-dom` or `antd` →
   `antd-scss-react-router`; neither → `legacy` (generate the file next to
   similar existing code in the project's own style, no FSD/feature folders);
   mixed signals → follow what the code uses (structure, router, UI kit), the
   closest profile's other rules, and report the deviation; empty project →
   the `CLAUDE.md` `## Frontend profile` section, else ask. No `package.json`,
   or neither dependency → this is not a project yet: offer the project modes.
   Also note: the package manager
   (`packageManager` field, else lockfile —
   `../team-frontend/references/tooling.md`), i18n (`next-intl` /
   `react-i18next` present → no literal user-facing strings), Playwright
   (`@playwright/test` → `e2e/` exists).
2. Check the structure exists — FSD: `src/` layers and the `@/*` alias;
   `antd-scss-react-router`: `src/features/`, `src/shared/lib/http-client.ts`,
   `src/shared/stores/create-resettable-store.ts`, `src/test/test-utils.tsx`,
   `src/shared/components/FormField.tsx`, `src/shared/lib/notify.ts`.
   Missing → tell the user and offer `/front-setup` first; do not silently
   invent a different structure.
3. Refuse to overwrite: if the slice/feature/component already exists, stop and
   ask (`antd-scss-react-router`: adding hooks/components to an existing feature module
   is fine — generate only the new files).
4. Layer/profile rules:
   - FSD (`../team-frontend/references/fsd.md`): the name must fit the layer
     (entity = noun, feature = verb/action, widget = composed block, view = one
     screen). If it doesn't, say which layer fits and ask.
   - `antd-scss-react-router` (`../team-frontend/references/feature-architecture.md`):
     `feature <name>` is a **business domain** (plural noun the backend knows:
     `inspections`, `users`), not a user action — "approve inspection" is a
     mutation inside `features/inspections`. `entity`, `widget` and `view` do
     not exist in this profile: say so and map them (entity/view → `feature
     <domain>` with its page component, widget → `component
     features/<owner> <Name>`). Never create FSD folders in an
     `antd-scss-react-router` project or feature folders in an FSD one, and
     never add Tailwind/shadcn to it or AntD/SCSS modules to an FSD one.

## Step 2 — Ask only what changes the output

Ask at most these, in one message, only when not obvious from the request:

- **entity** (FSD) / **feature module** (`antd-scss-react-router`): main fields of the
  type (else generate `id`, `title`/`name`, `createdAt` and mark with
  `// TODO: real fields`), API path (default `/__name__s` FSD, `/__name__`
  `antd-scss-react-router`), cache policy if known (owner, freshness — else the
  template's `TODO` values).
- **feature** (FSD): which entity it acts on; is it a mutation (form/button) or a
  client-state toggle (Zustand)? Next form → Server Action variant by
  default; which permission it requires.
- **widget / view**: which entities/features it composes.

## Step 3 — Generate

Copy the template, replace placeholders, then adapt to the answers. Hard rules
from the standard apply to every generated file:

- every `.tsx` ≤ 150 lines; sub-components go to `components/` next to parent;
- one component per file, `export type XxxProps` in the same file, no `forwardRef`;
- Next: Server Component by default, `"use client"` only on the interactive leaf;
- no `useEffect` (use the replacements in `use-effect.md`); the only
  exception is reporting in `error.tsx`/`global-error.tsx` / the React Router
  `ErrorBoundary` (`observability.md`); page titles via React 19 `<title>` in
  the component (Next: `metadata`), never an effect;
- client HTTP only via the single axios instance — FSD: `http` from
  `@/shared/api`; `antd-scss-react-router`: `httpClient` from `@/shared/lib/http-client` —
  **Next server code (RSC, Server Actions, route handlers, `proxy.ts`) only via
  `serverFetch` from `@/shared/api/http.server` — never axios** (`http-axios.md`);
- server data via TanStack Query: key factory + `queryOptions`, `{ signal }`
  passed to axios, a cache-policy comment next to the key factory, narrow
  invalidation (create → `lists()`, update → `detail(id)` + `lists()`, delete →
  `lists()` + `removeQueries(detail(id))`) (`state-data.md`); shared client
  state via Zustand with selectors; feature stores only via
  `createResettableStore`;
- forms: react-hook-form + `zodResolver`, schema in its own file, shadcn
  `Form` / `FormField` / `FormMessage` wrappers (`antd-scss-react-router`: the
  shared `FormField` — RHF controller inside AntD `Form.Item`, `validateStatus`
  / `help` from the field error, AntD inputs; never AntD's own `Form` store),
  server field errors via `form.setError`;
- security (`security.md`): every Server Action / mutating route handler
  calls `requireSession()`, checks permission and zod-`safeParse`s its input;
  no `dangerouslySetInnerHTML` without `sanitizeHtml`; user URLs through
  `safeHref`, redirect targets through `safeRedirect`; secrets only in
  `env.server.ts`, never in `NEXT_PUBLIC_*` / `VITE_*`;
- UI from the project's one kit — FSD: shadcn/ui from `@/shared/ui` +
  Tailwind tokens (logical `ms/me/ps/pe`); `antd-scss-react-router`: `antd`
  components + `ConfigProvider` theme tokens (`shared/lib/theme.ts`) +
  co-located `*.module.scss` (`--ant-*` variables, logical properties), shared
  components in `@/shared/components`, toasts via `App.useApp()` / `notify`,
  tables via AntD `Table` (`virtual` for 100+ rows), no Tailwind, `cn()` or
  `cva` (`../team-frontend/references/ui-antd-scss.md`) — accessible, with
  loading / empty / error states; errors shown as a generic message, reported
  through `shared/lib/logger` (no `console.log`);
- boolean props: state booleans (`disabled`, `open`, `loading` …) are fine;
  layout/behaviour-mode booleans (`isCompact`, `withHeader`, `isAdmin`) → `cva`
  variant (`antd-scss-react-router`: AntD props or an SCSS modifier class from a
  typed `variant` prop), composition or an explicit variant component;
- i18n project (`i18n.md`): no hard-coded user-facing strings in
  views/widgets/features (incl. `aria-label`, `alt`, `placeholder`, zod
  messages) — keys in the slice/feature namespace, `Intl` for numbers/dates;
- public API only through `index.ts`; sub-components never exported;
  `*.server.ts` never re-exported from `index.ts`; `antd-scss-react-router`:
  `lib/api.ts` is not exported either;
- a Vitest test for every `model/`, `lib/`, `api/` unit (`antd-scss-react-router`:
  `lib/`, `queries/`, store) and every feature/widget component (MSW for network);
- new top-level route → added to `e2e/specs/smoke.spec.ts` (renders + axe);
  a critical flow (auth, checkout-like, core create/edit/delete, search) gets
  or extends a Playwright journey spec (`e2e-playwright.md`);
- code style: Prettier config from `tooling.md` (double quotes, semicolons,
  trailing commas, width 100); imports ordered builtin → external → `@/…` →
  relative → type, inline `type` imports.

Commands below are written with npm — run them with the detected package
manager (`tooling.md` mapping: `pnpm dlx`, `yarn dlx`, `bunx` …).
FSD projects: if a shadcn primitive used by the template is missing in the UI
folder, run `npx shadcn@latest add <name>` (ask first if the project has no
`components.json`). Never run it in an `antd-scss-react-router` project.
If an MSW handlers file exists, append the slice's/feature's handler to it.

## Step 4 — Verify and report

1. Run `format` on the generated files, then the `lint`, `typecheck`, `test`
   scripts (only the ones that exist) with the detected manager; `test:e2e` too
   when a spec was added/changed and browsers are installed. Fix what the
   template introduced. Report real results; never claim green without running.
2. Print the created file tree and one line on how to use it
   (e.g. `import { ProductCard } from "@/entities/product"` or
   `import { InspectionsPage } from "@/features/inspections"`).
3. List any `// TODO` left for the user (real fields, endpoints, cache policy,
   copy text).
