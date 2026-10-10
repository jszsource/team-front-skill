# Frontend Engineering Standards

> Status: **v1.3.0** · Owner: Frontend Team · Last reviewed: 2026-10-10
> Applies to: every Next.js and React (SPA) project owned by the team.
> This document is the single source of truth. The `team-frontend` skill, the
> `front-reviewer` / `front-refactorer` agents and the `/front-setup` command all
> enforce exactly what is written here. Change the standard here first, then
> update the skill references. Sections: 1 Stack · 2 FSD · 3 Components ·
> 4 useEffect · 5 Next.js · 6 HTTP · 7 State · 8 UI · 9 Smells · 10 Testing ·
> 11 Tooling/CI · 12 Dependencies · 13 Security · 14 Observability/performance ·
> 15 i18n · 16 Definition of Done.

---

## 1. Stack (non-negotiable)

| Concern            | Next.js project                          | React (SPA) project                 |
| ------------------ | ---------------------------------------- | ----------------------------------- |
| Framework          | Next.js (latest stable, App Router)      | React 19 + Vite                     |
| Routing            | Next.js file-system router (App Router)  | **TanStack Router** (file-based)    |
| Language           | TypeScript, `strict: true`               | TypeScript, `strict: true`          |
| Styling            | **Tailwind CSS v4**                      | **Tailwind CSS v4**                 |
| UI components      | **shadcn/ui** (Radix primitives)         | **shadcn/ui**                       |
| Server state       | RSC + `serverFetch`; **TanStack Query** on client | **TanStack Query**         |
| Client state       | **Zustand**                              | **Zustand**                         |
| HTTP client        | **axios** on the client; typed `fetch` wrapper `serverFetch` (`shared/api/http.server.ts`) on the server | **axios** (single instance + interceptors) |
| Forms / validation | react-hook-form + zod                    | react-hook-form + zod               |
| Unit tests         | **Vitest** + Testing Library + MSW       | **Vitest** + Testing Library + MSW  |
| E2E + a11y tests   | **Playwright** + `@axe-core/playwright`  | **Playwright** + `@axe-core/playwright` |
| Monitoring         | **Sentry** (`@sentry/nextjs`) + Web Vitals | **Sentry** (`@sentry/react`) + `web-vitals` |
| i18n (>1 locale)   | **next-intl**                            | **react-i18next** + ICU             |
| Lint / format      | ESLint (flat config) + Prettier          | ESLint (flat config) + Prettier     |
| Git hooks          | husky + lint-staged + commitlint         | husky + lint-staged + commitlint    |
| CI                 | GitHub Actions (`references/ci.md`)      | GitHub Actions (`references/ci.md`) |
| Package manager    | detected from `packageManager` / lockfile (npm, pnpm, yarn, bun) | same              |
| Architecture       | **Feature-Sliced Design** (adapted)      | **Feature-Sliced Design**           |

Rule: never introduce a second library for a concern already covered above
(no Redux, no SWR, no other fetch wrappers besides `serverFetch` for Next server
code, no MUI/Chakra next to shadcn, no second lockfile).

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

---

## 3. Components

### 3.1 Size and decomposition

- **Hard limit: 150 lines per `.tsx` file** — the whole file (imports, types,
  helpers), blank lines/comments excluded (ESLint `max-lines`). Target ≤ 100. A function component body should fit on one screen.
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
  `withHeader`, `isAdmin`) — use `cva` variants, composition or an explicit
  variant component (`<CompactCard/>`). More than 2 behaviour booleans on one
  component → split.
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

- **Server data → TanStack Query.** Never copy server data into Zustand.
  - Query keys via factory: `productKeys.detail(id)`.
  - Use `queryOptions()` so the same options serve `useQuery`, `prefetchQuery`
    and `ensureQueryData`.
  - Next.js: prefetch on the server (override `queryFn` with the `serverFetch`
    function), pass with `HydrationBoundary`.
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
  `eslint/config`. Must include: `typescript-eslint`, `react-hooks`, `jsx-a11y`,
  `@next/eslint-plugin-next` (Next) / `@tanstack/eslint-plugin-router` +
  `eslint-plugin-react-refresh` (React), `@tanstack/eslint-plugin-query`,
  `eslint-plugin-boundaries` (FSD layer rules), `no-restricted-imports` for
  axios (outside `shared/api`, and in any `*.server.ts`), `max-lines` (150 for
  `*.tsx`), `no-console` (warn, allow `warn`/`error`), `prettier` config last.
  `lint` runs with `--max-warnings 0` in CI.
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

- [ ] Follows FSD layers, imports only through public APIs
- [ ] No `.tsx` file > 150 lines; decomposed parts in `components/`
- [ ] No unjustified `useEffect`; no unjustified `"use client"`
- [ ] Data via RSC / TanStack Query; shared UI state via Zustand selectors
- [ ] HTTP only through `shared/api/http.ts` (client) / `serverFetch` (Next server); no axios in server code
- [ ] UI built with shadcn + Tailwind tokens, accessible, has loading/empty/error states
- [ ] Security checklist in `references/security.md` passes (CSP/headers, no unsanitised HTML, Server Actions auth + zod, no secrets in public env)
- [ ] Unit tests added/updated, all green
- [ ] Critical flows covered by E2E; routes pass axe (no serious/critical)
- [ ] Errors reported via Sentry/logger, no `console.log`, no PII
- [ ] Route stays within the performance budget (§14)
- [ ] No hard-coded user-facing strings (multi-locale products)
- [ ] `lint`, `typecheck`, `build` pass; commit messages follow Conventional Commits
