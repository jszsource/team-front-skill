# Frontend Engineering Standards

> Status: **v2.1.0** · Owner: Frontend Team · Last reviewed: 2026-10-10
> Applies to: every Next.js and React (SPA) project owned by the team (profiles: §1.1).
> This document is the single source of truth. The `team-frontend` skill, the
> `front-reviewer` / `front-refactorer` agents and the `/front-setup` command all
> enforce exactly what is written here. Change the standard here first, then
> update the skill references. Sections: 1 Stack · 2 FSD · 3 Components ·
> 4 useEffect · 5 Next.js · 6 HTTP · 7 State · 8 UI · 9 Smells · 10 Testing ·
> 11 Tooling/CI · 12 Dependencies · 13 Security · 14 Observability/performance ·
> 15 i18n · 16 Definition of Done.

---

## 1. Stack (non-negotiable)

| Concern            | Next.js project                          | React SPA — `shadcn-tailwind-tanstack-router` | React SPA — `antd-scss-react-router` |
| ------------------ | ---------------------------------------- | ----------------------------------- | ----------------------------------- |
| Framework          | Next.js (latest stable, App Router)      | React 19 + Vite                     | React 19 + Vite                     |
| Routing            | Next.js file-system router (App Router)  | **TanStack Router** (file-based)    | **React Router** (data mode, `createBrowserRouter`) |
| Architecture       | **Feature-Sliced Design** (adapted)      | **Feature-Sliced Design**           | **Feature folders** (§2.5)          |
| Language           | TypeScript, `strict: true`               | TypeScript, `strict: true`          | TypeScript, `strict: true`          |
| Styling / UI       | **Tailwind CSS v4** + **shadcn/ui**      | **Tailwind CSS v4** + **shadcn/ui** | **Ant Design v5** + **SCSS modules** (no Tailwind) |
| Server state       | RSC + `serverFetch`; **TanStack Query** on client | **TanStack Query**         | **TanStack Query**                  |
| Client state       | **Zustand**                              | **Zustand**                         | **Zustand**                         |
| HTTP client        | **axios** on the client; typed `fetch` wrapper `serverFetch` (`shared/api/http.server.ts`) on the server | **axios** (single instance + interceptors) | **axios** (single instance + interceptors) |
| Forms / validation | react-hook-form + zod                    | react-hook-form + zod               | react-hook-form + zod               |
| Tables / long lists | `@tanstack/react-table` + `@tanstack/react-virtual` | same                     | AntD `Table` (`virtual` for 100+ rows) |
| Toasts             | `sonner`                                 | `sonner`                            | AntD `App.useApp().message` / `notification` |
| Unit tests         | **Vitest** + Testing Library + MSW       | **Vitest** + Testing Library + MSW  | **Vitest** + Testing Library + MSW  |
| E2E + a11y tests   | **Playwright** + `@axe-core/playwright`  | **Playwright** + `@axe-core/playwright` | **Playwright** + `@axe-core/playwright` |
| Monitoring         | **Sentry** (`@sentry/nextjs`) + Web Vitals | **Sentry** (`@sentry/react`) + `web-vitals` | **Sentry** (`@sentry/react`) + `web-vitals` |
| i18n (>1 locale)   | **next-intl**                            | **react-i18next** + ICU             | **react-i18next** + ICU             |
| Lint / format      | ESLint (flat config, type-checked) + Prettier | same                           | same                                |
| Git hooks          | husky + lint-staged + commitlint         | same                                | same                                |
| CI                 | GitHub Actions (`references/ci.md`)      | same                                | same                                |
| Package manager    | detected from `packageManager` / lockfile (npm, pnpm, yarn, bun) | same        | same                                |

Rule: never introduce a second library for a concern already covered above
(no Redux, no SWR, no other fetch wrappers besides `serverFetch` for Next server
code, no MUI/Chakra, never two UI kits or two routers in one project, no second
lockfile).

### 1.1 Profiles

Next.js projects always use FSD + Tailwind + shadcn/ui. A React SPA picks
**one** profile when it is created and keeps it. Each profile is a fixed
bundle — architecture, router and UI kit are never mixed across profiles:

- **`shadcn-tailwind-tanstack-router`** (default) — FSD + TanStack Router + Tailwind CSS v4 +
  shadcn/ui. For new, long-lived products.
- **`antd-scss-react-router`** — feature folders (§2.5) + React Router + Ant Design v5 +
  SCSS modules, no Tailwind. For enterprise/admin apps built on Ant Design and
  teams already on React Router.

The choice is recorded in the project's `CLAUDE.md` (written by `/front-setup`):

```md
## Frontend profile

- profile: antd-scss-react-router   # next | shadcn-tailwind-tanstack-router | antd-scss-react-router | legacy
```

**The existing code wins.** Before writing, reviewing or refactoring, look at
the project's real structure (`src/` folders, router and UI dependencies):

| Found in the project | Profile |
| --- | --- |
| `next` dependency | `next` (FSD) |
| FSD layers in `src/` (`entities`, `widgets`, `views`), `@tanstack/react-router`, shadcn `components.json` | `shadcn-tailwind-tanstack-router` |
| `src/features/<domain>/` + `src/shared/` without FSD layers, `react-router`/`react-router-dom`, `antd` | `antd-scss-react-router` |
| Code exists but matches neither (e.g. `src/components`, `src/pages`, `src/utils`) | `legacy` |
| Empty / new project | the `CLAUDE.md` section if present, else ask (default `shadcn-tailwind-tanstack-router`) |

- The `CLAUDE.md` section is a **record**, not an override: if it contradicts
  the code, follow the code and report the mismatch (`/front-setup` corrects
  the record). Never move files to make the code match the record.
- `legacy`: keep the existing layout. New code goes next to the closest
  existing equivalent and follows the project's own naming; all
  non-structural rules (§3–§16) still apply. Moving to FSD or feature folders
  is a separate, explicitly requested migration with a plan.
- Mixed layouts or signals from both columns (e.g. feature folders with
  shadcn): follow the structure, router and UI kit the code already uses, apply
  the closest profile's other rules, report the deviation, don't fix it unasked.

Every rule in this document applies to all profiles unless it names one.
Rules written with FSD paths map to `antd-scss-react-router` paths via the table in
`references/feature-architecture.md`.

---

## 2. Architecture — Feature-Sliced Design (FSD) / feature folders

Next.js and the `shadcn-tailwind-tanstack-router` profile use FSD (§2.1–2.4); the
`antd-scss-react-router` profile uses feature folders (§2.5).

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
├── api/           # client calls (http/axios) + TanStack Query options/hooks;
│                  #   Next: *.server.ts with serverFetch (never re-exported by index.ts)
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

With i18n (§15) routes live under `app/[locale]/…` and `messages/` sits at the
project root; the FSD layout in `src/` is unchanged.

### 2.4 FSD in React + TanStack Router

`src/routes/` holds TanStack Router file routes (thin, same rule as above),
`src/app/` holds router + providers, other layers identical.

### 2.5 `antd-scss-react-router` profile — feature folders (React SPA only)

Details, naming and the FSD → feature path map: `references/feature-architecture.md`.

```
src/
  app/                      # router, providers, root layout — no business logic
  routes/                   # route modules (thin: loader + page component)
  features/
    inspections/            # one business domain, kebab-case
      components/           # UI of this domain (+ components/ sub-folders, §3.1)
      hooks/                # domain hooks (non-query)
      lib/
        api.ts              # API functions (http-client, AbortSignal)
        query-keys.ts       # query key factory
      queries/              # useXxxQuery / useXxxMutation hooks
      schemas/              # xxx.schema.ts (zod) + inferred types
      types/
      inspections.store.ts  # Zustand slice via createResettableStore (only if needed)
      index.ts              # public API — the only import entry point
  shared/
    components/             # shared AntD-based components (+ *.module.scss)
    hooks/  lib/            # http-client.ts, auth-http-client.ts, logger.ts, sanitize.ts, env.ts
    stores/                 # auth.store.ts, create-resettable-store.ts
    types/
  test/                     # setup.ts, test-utils.tsx, mocks/handlers/<domain>.ts
  styles/globals.scss       # layer order + small reset (references/ui-antd-scss.md)
```

- Every feature has `index.ts`; other code imports **only** `@/features/<domain>`
  — no deep imports into another feature (ESLint `no-restricted-imports`).
- A feature may import `shared/` and other features' public APIs; `shared/`
  never imports `features/`. Circular feature imports are forbidden — move the
  shared part to `shared/` or compose in the route.
- Route modules stay thin (same ~20-line rule as §2.3).

---

## 3. Components

### 3.1 Size and decomposition

- **Hard limit: 150 lines per `.tsx` file** — the whole file (imports, types,
  helpers), blank lines/comments excluded (ESLint `max-lines`). Target ≤ 100. A function component body should fit on one screen.
  Claude Code also enforces it at edit time with the package's `front-check`
  hook (with the hook limit from §9 and the project's ESLint).
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

- Boolean props: state/ARIA-like and native-mirroring booleans are fine
  (`disabled`, `open`, `checked`, `required`, `loading`, `readOnly`, `invalid`).
  No booleans that switch layout/structure or behaviour mode (`isCompact`,
  `withHeader`, `isAdmin`) — use `cva` variants (`antd-scss-react-router`: a
  typed `variant` prop + SCSS-module modifiers), composition or an explicit
  variant component (`<CompactCard/>`). More than 2 behaviour booleans on one
  component → split.
- Compound components (`<Tabs><Tabs.List/>…`) for multi-part widgets.
- `children` / slots over render props.
- React 19: `ref` is a normal prop — no `forwardRef`. Use `use()` over `useContext()`.
- Container / presentational split: data fetching in a container (or RSC),
  rendering in a pure presentational component that is trivially testable.

### 3.3 Naming

- Components `PascalCase.tsx`, hooks `useCamelCase.ts`, stores
  `{domain}.store.ts` (never a bare `store.ts`), zod schemas
  `{name}.schema.ts`, query key factories `query-keys.ts`, other lib files
  `kebab-case.ts`, query hooks `useXxxQuery`, mutations `useXxxMutation`,
  folders `kebab-case`.
- Props types: `export type XxxProps = {…}` in the same file; no `React.FC`.
  Named exports everywhere except framework-required default exports (route files).
- Types from zod via `z.infer<typeof schema>`; `any` is a lint warning and
  needs a justification comment — prefer `unknown` + narrowing.

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
| Reading `window.location` / `navigator` for an action | read it inside the event handler  |
| Responsive / browser-dependent render  | Tailwind breakpoints; `useSyncExternalStore` hook with a server snapshot |

ESLint: `react-hooks/exhaustive-deps` is `error`. React Compiler is enabled, so
manual `useMemo` / `useCallback` are only added when profiling shows a need.

---

## 5. Next.js principles

- **Server Components by default.** `"use client"` only on the smallest leaf
  that needs state, effects, event handlers or browser APIs. Never on a page,
  layout or a whole widget "just in case".
- Push client boundaries down: pass Server Components as `children` into a
  client wrapper instead of turning the parent into a client component.
- Data fetching happens on the server (RSC, `async` component) via `serverFetch`
  (§6) whenever possible. Parallelise independent requests with `Promise.all`;
  stream slow parts with `<Suspense>` + `loading.tsx`. Server prefetch for
  TanStack Query overrides `queryFn` with the server function.
- Mutations: Server Actions (`"use server"`) call the API via `serverFetch`;
  client mutations via TanStack Query `useMutation` through axios. Every Server
  Action authenticates, authorises and zod-validates its input (§13).
- Caching: `"use cache"` / Cache Components, `cacheTag` + `revalidateTag(tag, 'max')`
  (two-arg form) / `updateTag` in Server Actions. `fetch` is **not** cached by
  default — be explicit. Never cache `auth: true` (cookie-forwarding) responses
  in a shared cache.
- `params` and `searchParams` are **async** — always `await` them.
- Request interception lives in `proxy.ts` (formerly `middleware.ts`).
- Use `next/image`, `next/font`, `next/link`, `next/dynamic` for heavy client-only parts.
- Metadata via `generateMetadata` / `metadata` export, never manual `<head>`.
- Every route segment with data has `loading.tsx` and `error.tsx`; the app has
  `global-error.tsx`; both report errors (§14).
- Env vars: server-only by default; `NEXT_PUBLIC_*` (and `VITE_*` in React mode)
  are public — only values safe in the browser. Browser-safe values are exposed
  mode-neutrally from `shared/config/env.ts` as `env.API_URL` (Next:
  `NEXT_PUBLIC_API_URL`, Vite: `VITE_API_URL`). Next server values/secrets live
  in `shared/config/env.server.ts` with `import 'server-only'` (`serverEnv.API_URL`).
  Validate both with zod; `process.env` is read only in `shared/config/env*.ts`.
- `server-only` package import in any module that must never reach the client.
- **App Router only.** No Pages Router APIs: `pages/`, `getServerSideProps`,
  `getStaticProps`, `getStaticPaths`, `next/router`, `next/head`, `_app`/`_document`.
- Server Actions live in a slice's `api/*.action.ts` with a file-level
  `'use server'` and export **only async functions**. Never declare an inline
  `'use server'` function inside a `"use client"` file — import the action.
  `<form action={action}>` without `useActionState` returns `void`; when the UI
  needs a result, use `useActionState` and return a typed state.
- `redirect()` / `notFound()` throw — call them outside `try/catch` (or rethrow),
  after `updateTag`/`revalidateTag`.
- Navigation: `<Link>` everywhere it is a link; server code uses `redirect()`;
  client code uses `useRouter` from `next/navigation`. Never
  `window.location.href = …` for internal routes (full reload).
  `useRouter`/`usePathname`/`useParams`/`useSearchParams` are client-only —
  server components read the `params` / `searchParams` props.
- A client component calling `useSearchParams()` is rendered inside a
  `<Suspense>` boundary (otherwise the route bails out of static rendering).
  Prefer reading `searchParams` in the page and passing values down.
- Dynamic segments: unknown id → `notFound()`; finite, known sets →
  `generateStaticParams` (+ `dynamicParams = false` when the set is closed).
- Route handlers (`route.ts`) only for external callers: webhooks, OAuth
  callbacks, BFF proxy, files/streams, CMS draft mode. Never a route handler
  just so our own components can fetch — call the server function directly.
- Parallel routes (`@slot`) always ship a `default.tsx`; route-based modals use
  `@modal` + intercepting `(.)segment` and close with `router.back()`.
- Cookies are written only on the server (Server Action, route handler,
  `proxy.ts`) via `(await cookies()).set(…)` with explicit `httpOnly`, `secure`,
  `sameSite`, `path`, `maxAge`. Client code never writes `document.cookie`;
  a client that needs a cookie value gets it as a prop from the server.

---

## 6. HTTP — axios (client) + `serverFetch` (Next server)

Details and templates: `references/http-axios.md`.

- Exactly one configured axios instance: `shared/api/http.ts`, used **only in
  browser code**. Feature code never imports `axios` directly.
- Request interceptor attaches `Authorization: Bearer <accessToken>`.
- Response interceptor handles **401 → refresh token → retry**:
  - single-flight: only one refresh request at a time; concurrent 401s wait in a queue;
  - the refresh request itself is excluded from the interceptor (no infinite loop);
  - a request is retried at most once (`_retry` flag);
  - refresh failure → clear session, reject all queued requests, redirect to login.
- Access token **in memory only** — module variable in `shared/api/token.ts`
  (not Zustand, not persisted). The `entities/session` Zustand store mirrors
  auth state (`user`, `status`) for the UI and never holds the token.
- Refresh token in an `httpOnly; Secure` cookie set by the backend.
  `SameSite=Strict` (or `Lax`) only when app and API are same-site; cross-site
  API → BFF / route-handler proxy on the app origin (preferred) or
  `SameSite=None; Secure` + CSRF token. Never store tokens in
  `localStorage`/`sessionStorage`.
- Next.js server code (RSC, Server Actions, route handlers, `proxy.ts`) uses
  `serverFetch<T>()` from `shared/api/http.server.ts` (`'server-only'`,
  forwards cookies via `cookies()`, `auth: false` for public/cached data,
  optional zod schema, same `ApiError`). **axios must never be imported in
  server code** — request memoization, `"use cache"`, `revalidate` and cache
  tags only work with `fetch`. No token refresh on the server (401 → login).
- Errors are normalised into one `ApiError` type in `shared/api/api-error.ts`
  (no axios import); the axios `toApiError` mapper lives in `http.ts`.
- API functions are typed (`(params) => Promise<Dto>`) and validated with zod at
  the boundary when the backend is not trusted.

---

## 7. State management

Details: `references/state-data.md`.

- **Server data → TanStack Query.** Never copy server data into Zustand.
  - One `QueryClient` (`shared/api/query-client.ts` / `shared/lib/query-client.ts`),
    provider at the root, Devtools in development only.
  - Query keys **only** via a per-slice/per-feature factory
    (`productKeys.all / lists() / list(filters) / details() / detail(id)`), typed
    `as const`, deterministic — never inline arrays, never `Date.now()` /
    `Math.random()` / whole objects with functions in a key.
  - Use `queryOptions()` so the same options serve `useQuery`, `prefetchQuery`
    and `ensureQueryData`. `queryFn` receives `{ signal }` and passes it to
    axios (request cancellation).
  - Next.js: prefetch on the server (override `queryFn` with the `serverFetch`
    function), pass with `HydrationBoundary`.
  - **Cache policy per endpoint**, decided by business freshness and
    documented next to the key factory (owner, `staleTime`, `gcTime`,
    invalidation rule, realtime source). Global default `staleTime` 60 s is
    only the fallback. Use `select` for transformations, `enabled` for
    dependent queries, `placeholderData: keepPreviousData` for pagination.
  - Retry: GETs `retry: 2` with exponential backoff
    (`retryDelay: (n) => Math.min(1000 * 2 ** n, 30_000)`), never on 4xx;
    mutations don't retry.
  - Mutations: **narrow** invalidation by the matrix — create → `lists()` (+ stats);
    update → `detail(id)` + `lists()`; delete → `lists()` + `removeQueries(detail(id))`.
    Prefer `setQueryData` when the response already contains the new entity.
    `queryClient.invalidateQueries()` without a key is forbidden.
  - Optimistic updates only where UX needs them: `onMutate` (cancel + snapshot +
    set) → `onError` rollback + toast → `onSettled` invalidate.
- **Client/UI state → Zustand**, only when shared across components. Local
  state stays in `useState`.
  - One store per slice/feature (`{domain}.store.ts`), small and focused.
  - Feature stores are created with `createResettableStore` (must expose
    `reset()`); only root stores such as the auth/session store use `create()`.
  - Always select with selectors: `useCartStore(s => s.count)`; several fields →
    `useShallow`. Never destructure the whole store.
  - Actions live in the store; components don't compute next state.
  - Next.js: create stores per request via a context provider (no module-level
    singleton store holding user data on the server).
- **Logout resets everything:** `resetAllStores()` (also clears `persist`
  storage keys), `queryClient.clear()`, in-memory tokens cleared. No user data
  survives a logout.
- **URL state** (filters, pagination, tabs) → search params.

---

## 8. UI — Tailwind + shadcn/ui / Ant Design + SCSS

One UI approach per project, fixed by the profile. Next.js and
`shadcn-tailwind-tanstack-router` use Tailwind + shadcn/ui; `antd-scss-react-router` uses Ant Design v5 +
SCSS modules (`references/ui-antd-scss.md`). The rules below apply to both;
in the AntD profile read "design tokens" as `ConfigProvider` theme tokens,
"variants" as AntD props/SCSS modifiers, and the Tailwind-specific bullets as
not applicable.


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
- Icons: `lucide-react`, named imports only. Icon-only buttons have `aria-label`.
- Forms: react-hook-form + `zodResolver`, schema in its own file; render with
  the shadcn `Form` / `FormField` / `FormMessage` wrappers (AntD `Form.Item`) —
  no hand-written error markup. Server validation errors go back into the form
  with `form.setError`.
- Lists/tables over 100 rows are virtualised (`@tanstack/react-virtual`);
  data tables use `@tanstack/react-table` (AntD projects: AntD `Table`,
  `virtual` for 100+ rows). Rarely shown heavy parts (charts,
  editors, PDF/Excel export) are lazy-loaded with a skeleton fallback.

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

## 10. Testing — Vitest + Playwright

Details: `references/testing-vitest.md`, `references/e2e-playwright.md`.

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
  plus their data functions (Vitest cannot render async RSC). `serverFetch`
  functions are tested with mocked `next/headers` + MSW.
- **E2E:** Playwright in `e2e/` at the project root, `*.spec.ts`; Vitest
  excludes `e2e/**`. Script `test:e2e`.
- E2E is required for **critical flows**: auth (login / error / logout /
  protected redirect), session refresh, checkout-like multi-step flow, core
  create/edit/delete of the main entity, search/filter via URL, smoke of every
  top-level route. ≤ ~20 journey specs; edge cases stay in unit tests.
- E2E runs against the production build (`build && start` / `preview`) or
  `E2E_BASE_URL`, with a real test backend; `page.route` only for third parties
  (or explicitly named error-state tests). Auth via a `storageState` setup
  project; `getByRole` locators first; no `waitForTimeout`; trace on first
  retry, CI retries 2.
- **Accessibility (blocking):** every top-level route passes
  `@axe-core/playwright` (WCAG 2.x A/AA) with zero serious/critical
  violations. Component-level `vitest-axe` is optional.

---

## 11. Tooling and Git

Details: `references/tooling.md`, `references/ci.md`.

- **Package manager is detected** (`packageManager` field, else lockfile:
  `package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn,
  `bun.lock`/`bun.lockb` → bun). All commands, husky hooks and CI use it;
  never a second lockfile. Examples in this package use npm — translate.
- `husky` hooks (run through the detected manager):
  - `pre-commit` → `lint-staged` (eslint --fix, prettier --write on staged files)
  - `commit-msg` → `commitlint` (Conventional Commits)
  - `pre-push` → `typecheck` + `test` (whole repo, keep < ~1 min; E2E, build
    and audit run in CI)
- ESLint flat config written with `defineConfig` / `globalIgnores` from
  `eslint/config`. Must include: `typescript-eslint` (`recommended` everywhere +
  `recommendedTypeChecked` scoped to `src/**/*.{ts,tsx}` with
  `projectService`), `react-hooks` (current major, incl. React Compiler rules),
  `jsx-a11y`, `@next/eslint-plugin-next` (Next) / `@tanstack/eslint-plugin-router`
  (`shadcn-tailwind-tanstack-router`) + `eslint-plugin-react-refresh` (React SPAs),
  `@tanstack/eslint-plugin-query`, `eslint-plugin-boundaries` (FSD layer rules;
  `antd-scss-react-router`: `no-restricted-imports` against deep feature imports),
  `eslint-plugin-import` (`import/order` builtin → external → internal →
  parent/sibling → index → type, `import/no-duplicates`),
  `eslint-plugin-unused-imports`, `no-restricted-imports` for axios (outside
  the HTTP client files, and in any `*.server.ts`), `max-lines` (150 for
  `*.tsx`), `no-console` (warn, allow `warn`/`error`), `prettier` config last.
  Required rules: `@typescript-eslint/no-floating-promises`,
  `@typescript-eslint/no-misused-promises`,
  `@typescript-eslint/consistent-type-imports` (inline type imports),
  `@typescript-eslint/no-explicit-any` (warn), `eqeqeq`, `prefer-const`,
  `no-var`, `no-debugger`. React/a11y/type-checked rules are scoped to `src/`,
  not to config files. `lint` runs with `--max-warnings 0` in CI and pre-commit.
- `tsconfig`: `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`; unused-but-required
  names are prefixed `_`.
- Prettier (`.prettierrc.json`, plugins listed explicitly):
  `{ "semi": true, "singleQuote": false, "trailingComma": "all",
  "bracketSpacing": true, "bracketSameLine": false, "arrowParens": "always",
  "printWidth": 100, "tabWidth": 2, "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"] }`. The Tailwind plugin is used
  only in `next` and `shadcn-tailwind-tanstack-router`; the
  `antd-scss-react-router` config is the same without `plugins`.
- Commit scope = slice/feature name: `feat(inspections): add status filter`.
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `lint:fix`, `format`,
  `typecheck`, `test`, `test:watch`, `test:coverage`, `test:e2e`.
- CI (GitHub Actions, `references/ci.md`): frozen install, `lint`,
  `typecheck`, `test:coverage`, `build`, `audit` (high, production deps),
  Playwright E2E job (+ `size` if size-limit is used); Node from `.nvmrc`;
  concurrency cancel-in-progress; `permissions: contents: read`.
- Commit `.nvmrc` + `engines.node`.

---

## 12. Dependency updates

Details: `references/dependency-updates.md`.

- The version check runs **only** on `/front-setup`, when the user asks, or
  before a dependency-related task — at most once per session (reuse the
  result; re-run only after the lockfile changed). Core packages: `next`,
  `react`, `@tanstack/*`, `zustand`, `axios`, `tailwindcss`, `vitest`,
  `typescript`, `eslint`. Use the detected package manager (`npm outdated
  --json`, `pnpm outdated --format json`, `npm view` / `pnpm view <pkg> version`).
- Patch/minor: propose update and run it **after confirmation**.
- Major: summarise breaking changes, propose a migration plan (use official
  codemods, e.g. `npx` / `pnpm dlx` / `bunx @next/codemod@latest upgrade`),
  wait for confirmation.
- After every update: `lint`, `typecheck`, `test`, `build` must pass.

---

## 13. Security

Details, templates and the reviewer checklist: `references/security.md`.

- **CSP required.** Next: per-request nonce set in `proxy.ts`; React (Vite):
  CSP header from the host (build-only `<meta>` as fallback). No
  `'unsafe-inline'` in `script-src`.
- Security headers set on every HTML response (HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options` / `frame-ancestors`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`); Next `poweredByHeader: false`.
- XSS: no `dangerouslySetInnerHTML` without the DOMPurify helper
  (`sanitizeHtml`); no `innerHTML` / `eval`; user-supplied URLs pass `safeHref`
  (no `javascript:`); redirect targets pass `safeRedirect` (no open redirects).
- Cookies / CSRF: rules in §6; no state changes on `GET`.
- Every Server Action and mutating route handler authenticates, authorises and
  zod-validates its input itself — `proxy.ts` is for redirects, not authorization.
- Secrets only server-side (`env.server.ts`); nothing secret in
  `NEXT_PUBLIC_*` / `VITE_*`; leaked secrets are rotated.
- Lockfile committed, frozen install + package-manager audit (high, production
  deps) in CI.
- Third-party scripts: team-approved, CSP-listed, nonce or SRI, consent-gated.

---

## 14. Observability and performance

Details: `references/observability.md`.

- **Sentry:** Next `@sentry/nextjs` via `instrumentation.ts` (+ `onRequestError`)
  and `instrumentation-client.ts`; Vite `@sentry/react` +
  `tanstackRouterBrowserTracingIntegration`. Enabled only in production.
- Source maps uploaded from CI only (`SENTRY_AUTH_TOKEN` exists only in CI),
  deleted after upload, never served.
- PII: `sendDefaultPii: false`, scrubbing in `beforeSend`, user = id only.
- Error boundaries: Next `error.tsx` per data route group + mandatory
  `global-error.tsx`, both report; React `errorComponent` per data route + root
  `onUncaughtError` / `onCaughtError`.
- No `console.log` (`no-console` warn, allow `warn`/`error`; lint
  `--max-warnings 0`); use `shared/lib/logger`.
- Web Vitals (Next `useReportWebVitals`, Vite `web-vitals`) are sent to our
  same-site endpoint, with the route pattern, not raw URLs.
- **Budgets (p75, mobile):** JS first load ≤ 170 kB gzip per route, LCP ≤ 2.5 s,
  INP ≤ 200 ms, CLS ≤ 0.1, TTFB ≤ 800 ms. Over budget needs a PR justification
  and a follow-up ticket. Bundle analysis: `@next/bundle-analyzer` /
  `rollup-plugin-visualizer`; `size-limit` in CI optional (recommended for Vite).

---

## 15. Internationalisation

Details: `references/i18n.md`.

- Required when the product has more than one locale. Single-locale products
  use no i18n library but keep strings ready: no sentence concatenation,
  `Intl` for plurals/dates/numbers.
- Next: **next-intl**, `app/[locale]/` segment, locale detection in `proxy.ts`,
  messages in `messages/<locale>.json`, config in `src/shared/config/i18n/`
  (routing, request, navigation). `getTranslations` on the server by default;
  `useTranslations` only in leaf client components. Typed messages via `AppConfig`.
- React: **react-i18next** + `i18next-icu`, lazy namespaces
  (`resourcesToBackend`), namespace loaded in the route `loader`, typed via
  `CustomTypeOptions`.
- No hard-coded user-facing strings in `views` / `widgets` / `features`
  (including `aria-label`, `alt`, `placeholder`, toasts and zod messages).
- ICU plurals/selects; `Intl` for dates/numbers/currency with an explicit
  locale; locale-aware `Link`/`redirect`; RTL-safe logical Tailwind utilities
  (`ms-*`/`me-*`, `ps-*`/`pe-*`); CI checks key parity across locales.

---

## 16. Definition of Done (PR checklist)

- [ ] Follows the project profile (§1.1): FSD layers or feature folders, imports only through public APIs
- [ ] No `.tsx` file > 150 lines; decomposed parts in `components/`
- [ ] No unjustified `useEffect`; no unjustified `"use client"`
- [ ] Data via RSC / TanStack Query with key factory, per-endpoint cache policy and narrow invalidation; shared UI state via Zustand selectors
- [ ] Feature stores via `createResettableStore`; logout resets stores and `queryClient.clear()`
- [ ] HTTP only through the single axios instance (`shared/api/http.ts` / `shared/lib/http-client.ts`) / `serverFetch` (Next server); no axios in server code
- [ ] UI built with the project's one UI kit + Tailwind tokens, accessible, has loading/empty/error states; forms via RHF + zod wrappers; 100+ row lists virtualised
- [ ] Security checklist in `references/security.md` passes (CSP/headers, no unsanitised HTML, Server Actions auth + zod, no secrets in public env)
- [ ] Unit tests added/updated, all green
- [ ] Critical flows covered by E2E; routes pass axe (no serious/critical)
- [ ] Errors reported via Sentry/logger, no `console.log`, no PII
- [ ] Route stays within the performance budget (§14)
- [ ] No hard-coded user-facing strings (multi-locale products)
- [ ] `lint` (type-checked, `--max-warnings 0`), `typecheck`, `build` pass; Prettier-formatted; commit messages follow Conventional Commits
