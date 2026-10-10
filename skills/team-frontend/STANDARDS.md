# Frontend Engineering Standards

> Status: **Draft v1.0** · Owner: Frontend Team · Last reviewed: 2026-10-10
> Applies to: every Next.js and React (SPA) project owned by the team.
> This document is the single source of truth. The `team-frontend` skill, the
> `front-reviewer` / `front-refactorer` agents and the `/front-setup` command all
> enforce exactly what is written here. Change the standard here first, then
> update the skill references.

---

## 1. Stack (non-negotiable)

| Concern            | Next.js project                          | React (SPA) project                 |
| ------------------ | ---------------------------------------- | ----------------------------------- |
| Framework          | Next.js (latest stable, App Router)      | React 19 + Vite                     |
| Routing            | Next.js file-system router (App Router)  | **TanStack Router** (file-based)    |
| Language           | TypeScript, `strict: true`               | TypeScript, `strict: true`          |
| Styling            | **Tailwind CSS v4**                      | **Tailwind CSS v4**                 |
| UI components      | **shadcn/ui** (Radix primitives)         | **shadcn/ui**                       |
| Server state       | RSC fetch + **TanStack Query** on client | **TanStack Query**                  |
| Client state       | **Zustand**                              | **Zustand**                         |
| HTTP client        | **axios** (single instance + interceptors) | **axios**                         |
| Forms / validation | react-hook-form + zod                    | react-hook-form + zod               |
| Unit tests         | **Vitest** + Testing Library + MSW       | **Vitest** + Testing Library + MSW  |
| Lint / format      | ESLint (flat config) + Prettier          | ESLint (flat config) + Prettier     |
| Git hooks          | husky + lint-staged + commitlint         | husky + lint-staged + commitlint    |
| Architecture       | **Feature-Sliced Design** (adapted)      | **Feature-Sliced Design**           |

Rule: never introduce a second library for a concern already covered above
(no Redux, no SWR, no fetch wrappers next to axios, no MUI/Chakra next to shadcn).

---

## 2. Architecture — Feature-Sliced Design (FSD)

### 2.1 Layers (top may import from below, never the reverse)

```
app       → providers, global styles, app-wide config
views     → full page compositions (FSD "pages" layer — renamed, see 2.2)
widgets   → large self-contained UI blocks (Header, ProductList, Sidebar)
features  → user interactions that bring business value (add-to-cart, login-form)
entities  → business entities (user, product, order): model + api + UI card
shared    → reusable, business-agnostic code (ui kit, api client, lib, config)
```

- A slice may **not** import from another slice of the **same layer**
  (`features/a` → `features/b` is forbidden). Compose them one layer above.
- Every slice exposes a **public API** via `index.ts`. Importing internals
  (`@/entities/user/model/store`) from outside the slice is forbidden; import
  `@/entities/user`.
- `shared` has no slices, only segments: `shared/ui`, `shared/api`, `shared/lib`,
  `shared/config`, `shared/hooks`, `shared/types`.

### 2.2 Segments inside a slice

```
features/auth-by-email/
├── ui/            # React components
│   ├── LoginForm.tsx
│   └── components/        # sub-components produced by decomposition
├── model/         # zustand store, hooks, selectors, zod schemas, types
├── api/           # axios calls + TanStack Query hooks / query options
├── lib/           # pure helpers for this slice
├── config/        # constants
├── __tests__/     # or co-located *.test.ts(x)
└── index.ts       # public API — the only import entry point
```

### 2.3 FSD in Next.js

Next.js owns `app/` (routing). FSD lives in `src/`. Route files stay thin and
only import from `views`:

```
app/                          # Next.js routing ONLY
  (marketing)/page.tsx        → export { HomeView as default } from '@/views/home'
  products/[id]/page.tsx      → async page: await params, render <ProductView id={id} />
  layout.tsx                  → wraps with providers from '@/app-layer/providers'
src/
  app-layer/                  # FSD "app" layer (renamed to avoid clash with Next app/)
  views/                      # FSD "pages" layer (renamed to avoid clash with Next pages/)
  widgets/  features/  entities/  shared/
```

`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts` contain **no
business logic** — max ~20 lines, they only read params and delegate.

### 2.4 FSD in React + TanStack Router

`src/routes/` holds TanStack Router file routes (thin, same rule as above),
`src/app/` holds router + providers, other layers identical.

---

## 3. Components

### 3.1 Size and decomposition

- **Hard limit: 150 lines per component file** (enforced by ESLint `max-lines`).
  Target ≤ 100. A function component body should fit on one screen.
- When a component grows, decompose it. Sub-components go into a
  `components/` folder **next to the parent**:

```
widgets/product-list/ui/
├── ProductList.tsx
└── components/
    ├── ProductListHeader.tsx
    ├── ProductListFilters.tsx
    └── ProductListItem/
        ├── ProductListItem.tsx
        └── components/ProductPrice.tsx
```

- Sub-components in `components/` are private to their parent. If a second
  consumer appears, promote it (to `shared/ui` if business-agnostic, otherwise
  to the proper entity/feature).
- Logic extraction order: derived values → plain functions in `lib/` →
  custom hook in `model/` → sub-component.
- One component per file. Never define a component inside another component.

### 3.2 Composition rules

- No boolean props that switch behaviour (`isCompact`, `withHeader`). Use
  composition, explicit variants (`<CompactCard/>`) or `cva` variants for style.
- Compound components (`<Tabs><Tabs.List/>…`) for multi-part widgets.
- `children` / slots over render props.
- React 19: `ref` is a normal prop — no `forwardRef`. Use `use()` over `useContext()`.
- Container / presentational split: data fetching in a container (or RSC),
  rendering in a pure presentational component that is trivially testable.

### 3.3 Naming

- Components `PascalCase.tsx`, hooks `useCamelCase.ts`, stores `xxx.store.ts`,
  query hooks `useXxxQuery`, mutations `useXxxMutation`, folders `kebab-case`.
- Props types: `type XxxProps = {…}` in the same file.

---

## 4. `useEffect` — use as rarely as possible

`useEffect` is only for **synchronising with an external system** (DOM API,
browser subscription, third-party widget, WebSocket). Every `useEffect` in a PR
must justify itself. Replace:

| Instead of `useEffect` for…            | Use                                              |
| -------------------------------------- | ------------------------------------------------ |
| Fetching data                          | RSC `await`, TanStack Query `useQuery`           |
| Deriving state from props/state        | compute during render (`const x = …`) / `useMemo`|
| Resetting state when a prop changes    | `key` prop on the component                      |
| Reacting to a user action              | the event handler                                |
| Syncing two pieces of state            | one source of truth + derived value              |
| Subscribing to a store                 | Zustand selector / `useSyncExternalStore`        |
| Reading a non-reactive latest value    | `useEffectEvent` (React 19.2+)                   |
| Notifying parent of a change           | call parent callback in the handler              |
| Form state                             | react-hook-form                                  |

ESLint: `react-hooks/exhaustive-deps` is `error`. React Compiler is enabled, so
manual `useMemo` / `useCallback` are only added when profiling shows a need.

---

## 5. Next.js principles

- **Server Components by default.** `"use client"` only on the smallest leaf
  that needs state, effects, event handlers or browser APIs. Never on a page,
  layout or a whole widget "just in case".
- Push client boundaries down: pass Server Components as `children` into a
  client wrapper instead of turning the parent into a client component.
- Data fetching happens on the server (RSC, `async` component) whenever possible.
  Parallelise independent requests with `Promise.all`; stream slow parts with
  `<Suspense>` + `loading.tsx`.
- Mutations: Server Actions (`"use server"`) for form posts to our own backend-for-frontend,
  or TanStack Query `useMutation` through axios for the external API.
- Caching: `"use cache"` / Cache Components, `cacheTag` + `revalidateTag` /
  `updateTag`. `fetch` is **not** cached by default — be explicit.
- `params` and `searchParams` are **async** — always `await` them.
- Request interception lives in `proxy.ts` (formerly `middleware.ts`).
- Use `next/image`, `next/font`, `next/link`, `next/dynamic` for heavy client-only parts.
- Metadata via `generateMetadata` / `metadata` export, never manual `<head>`.
- Every route segment with data has `loading.tsx` and `error.tsx`.
- Env vars: server-only by default; `NEXT_PUBLIC_` only for values safe in the browser.
  Validate env with zod in `shared/config/env.ts`.
- `server-only` package import in any module that must never reach the client.

---

## 6. HTTP — axios

- Exactly one configured instance: `shared/api/http.ts`. Feature code never
  imports `axios` directly.
- Request interceptor attaches `Authorization: Bearer <accessToken>`.
- Response interceptor handles **401 → refresh token → retry**:
  - single-flight: only one refresh request at a time; concurrent 401s wait in a queue;
  - the refresh request itself is excluded from the interceptor (no infinite loop);
  - a request is retried at most once (`_retry` flag);
  - refresh failure → clear session, reject all queued requests, redirect to login.
- Token storage: **access token in memory** (Zustand, not persisted), **refresh
  token in an `httpOnly; Secure; SameSite=Strict` cookie** set by the backend.
  Never store tokens in `localStorage`.
- Errors are normalised into one `ApiError` type in `shared/api`.
- API functions are typed (`(params) => Promise<Dto>`) and validated with zod at
  the boundary when the backend is not trusted.
- In Next.js server code, use a server instance that forwards cookies from
  `cookies()`; the refresh interceptor is client-side only.

---

## 7. State management

- **Server data → TanStack Query.** Never copy server data into Zustand.
  - Query keys via factory: `productKeys.detail(id)`.
  - Use `queryOptions()` so the same options serve `useQuery`, `prefetchQuery`
    and `ensureQueryData`.
  - Next.js: prefetch on the server, pass with `HydrationBoundary`.
  - Mutations invalidate exact keys; optimistic updates for instant UX.
- **Client/UI state → Zustand**, only when shared across components. Local
  state stays in `useState`.
  - One store per slice (`model/xxx.store.ts`), small and focused.
  - Always select with selectors: `useCartStore(s => s.count)`, never the whole store.
  - Actions live in the store; components don't compute next state.
  - Next.js: create stores per request via a context provider (no module-level
    singleton store holding user data on the server).
- **URL state** (filters, pagination, tabs) → search params.

---

## 8. UI — Tailwind + shadcn/ui

- shadcn/ui components live in `shared/ui` (configure `components.json`
  aliases accordingly). Build product components by composing them; edit the
  generated source only for design-system-wide changes.
- Variants via `cva`; class merging via `cn()` (`clsx` + `tailwind-merge`).
- Design tokens are CSS variables (`@theme` in Tailwind v4). No hard-coded hex
  colours or arbitrary values (`w-[317px]`) unless justified.
- Mobile-first responsive classes; dark mode via `.dark` class tokens.
- Accessibility (mandatory): semantic HTML, every input labelled, visible focus
  rings, keyboard navigation, contrast ≥ 4.5:1, information never conveyed by
  colour only, `prefers-reduced-motion` respected, touch targets ≥ 44px.
- Motion 150–300 ms, animate `transform`/`opacity` only.
- Every async UI has loading (skeleton), empty and error states.
- Icons: `lucide-react`.

---

## 9. Code quality — smells and refactoring

Reviews flag these smells and apply the listed fix:

| Smell                     | Frontend symptom                               | Refactoring                                   |
| ------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Long Method / Large Class | component > 150 lines, hook > 80 lines         | Extract Component / Extract Hook / Extract Function |
| Long Parameter List       | > 5 props of the same concern                  | Introduce Parameter Object, composition       |
| Primitive Obsession       | `status: string`, ids as raw strings           | union types / branded types / value objects   |
| Data Clumps               | same 3 props passed together everywhere        | group into one typed object                   |
| Switch Statements         | big `switch` on type rendering different UI    | component map / polymorphism                  |
| Temporary Field           | state only meaningful in one mode              | split component per mode                      |
| Divergent Change          | one file changes for unrelated reasons         | split by responsibility (FSD segments)        |
| Shotgun Surgery           | one change touches many slices                 | move logic into one entity/feature            |
| Duplicate Code            | same JSX/logic in two places                   | Extract Component / hook into proper layer    |
| Dead Code / Speculative Generality | unused props, exports, "future" options | delete                                   |
| Comments explaining *what* | comment above unclear code                    | rename / extract function                     |
| Feature Envy              | component reaches deep into another slice      | move logic to that slice's public API         |
| Message Chains            | `a.b.c.d` across objects                       | selector / hide delegate                      |
| Middle Man                | wrapper component that only passes props       | inline it                                     |
| Prop drilling > 2 levels  | —                                              | composition (`children`) or Zustand / context |

---

## 10. Testing — Vitest

- Every `model/` (store, hook), `lib/` function, `api/` mapper and every
  feature/widget component has a unit test. Pure `shared/ui` wrappers of
  shadcn may skip tests.
- Co-located `Xxx.test.tsx` (or `__tests__/`). Environment `jsdom`.
- Testing Library: query by role/label, test behaviour, not implementation.
  `userEvent` over `fireEvent`.
- Network mocked with **MSW**, never by mocking axios internals.
- Interceptor refresh flow has dedicated tests (401 → refresh → retry, parallel
  401s → single refresh, refresh failure → logout).
- Coverage threshold: 80 % lines for `features`, `entities`, `shared/lib`, `shared/api`.
- Async Server Components are tested through their pure presentational part
  plus their data functions (Vitest cannot render async RSC).

---

## 11. Tooling and Git

- `husky` hooks:
  - `pre-commit` → `lint-staged` (eslint --fix, prettier --write on staged files)
  - `commit-msg` → `commitlint` (Conventional Commits)
  - `pre-push` → `tsc --noEmit` + `vitest run`
- ESLint must include: `typescript-eslint`, `react-hooks`, `jsx-a11y`,
  `@next/eslint-plugin-next` (Next) / `@tanstack/eslint-plugin-router` (React),
  `@tanstack/eslint-plugin-query`, `eslint-plugin-boundaries` (FSD layer rules),
  `max-lines` (150 for `*.tsx`), `prettier` config last.
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `lint:fix`, `format`,
  `typecheck`, `test`, `test:watch`, `test:coverage`.
- CI runs `lint`, `typecheck`, `test:coverage`, `build`.

---

## 12. Dependency updates

- On every session the assistant checks `next`, `react`, `@tanstack/*`,
  `zustand`, `axios`, `tailwindcss`, `vitest` against `npm view <pkg> version`.
- Patch/minor: propose update and run it **after confirmation**.
- Major: summarise breaking changes, propose a migration plan (use official
  codemods, e.g. `npx @next/codemod@latest upgrade`), wait for confirmation.
- After every update: `lint`, `typecheck`, `test`, `build` must pass.

---

## 13. Definition of Done (PR checklist)

- [ ] Follows FSD layers, imports only through public APIs
- [ ] No component file > 150 lines; decomposed parts in `components/`
- [ ] No unjustified `useEffect`; no unjustified `"use client"`
- [ ] Data via RSC / TanStack Query; shared UI state via Zustand selectors
- [ ] HTTP only through `shared/api/http.ts`
- [ ] UI built with shadcn + Tailwind tokens, accessible, has loading/empty/error states
- [ ] Unit tests added/updated, all green
- [ ] `lint`, `typecheck`, `build` pass; commit messages follow Conventional Commits
