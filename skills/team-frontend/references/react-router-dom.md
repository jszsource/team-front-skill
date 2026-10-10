# React (non-Next) — Vite + React Router (`antd-scss-react-router` profile)

Use only for the `antd-scss-react-router` profile (STANDARDS §1.1, §2.5). The
`shadcn-tailwind-tanstack-router` profile uses `react-tanstack-router.md`.
Folders and the FSD → feature path map: `feature-architecture.md`. UI (Ant
Design v5 + SCSS modules, no Tailwind): `ui-antd-scss.md`.

React Router v7 in **data mode** (`createBrowserRouter` + `RouterProvider`).
Not declarative mode (`<BrowserRouter>`/`<Routes>` — no loaders) and not
framework mode (that is a separate build setup). One router per project.

## Setup

```bash
npm i react-router @tanstack/react-query zustand axios zod
npm i -D babel-plugin-react-compiler
# UI packages (antd, sass-embedded, …): ui-antd-scss.md → Setup
```

v7 ships everything from `react-router` (DOM pieces from `react-router/dom`).
An existing project importing `react-router-dom` v7 may keep it — but one
import source per project, never both.

```ts
// vite.config.ts
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react({ babel: { plugins: ["babel-plugin-react-compiler"] } })],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

No Tailwind plugin: `.scss` (incl. `*.module.scss`) compiles through
`sass-embedded`, and the `@` alias also resolves in Sass `@use`.

## Structure

```
src/
  app/
    main.tsx          # createRoot + QueryClientProvider + AntdProvider + RouterProvider
    router.tsx        # route table (routes array + createBrowserRouter)
    guards.ts         # restoreSession / requireAuth / withAuth / requireRole
    layout/           # RootLayout.tsx, RouteError.tsx, RootSkeleton.tsx
  routes/             # route modules — THIN: loader + Component (+ ErrorBoundary)
    home.tsx  login.tsx  inspections.tsx  inspection-detail.tsx  not-found.tsx
  features/  shared/  test/
```

## Router

```tsx
// src/app/router.tsx
import { createBrowserRouter, type RouteObject } from "react-router";

import { RootSkeleton } from "@/app/layout/RootSkeleton";
import { RouteError } from "@/app/layout/RouteError";

import { requireAuth } from "./guards";
import { RootLayout } from "./layout/RootLayout";

export const routes: RouteObject[] = [
  {
    id: "root",
    Component: RootLayout,
    ErrorBoundary: RouteError, // root boundary: catches everything below
    HydrateFallback: RootSkeleton, // initial load only — must be static, not lazy
    children: [
      { index: true, lazy: () => import("@/routes/home") },
      { path: "login", lazy: () => import("@/routes/login") },
      {
        id: "protected",
        loader: requireAuth, // protects child routes that have no loader of their own
        children: [
          { path: "inspections", lazy: () => import("@/routes/inspections") },
          { path: "inspections/:inspectionId", lazy: () => import("@/routes/inspection-detail") },
          { path: "admin", lazy: () => import("@/routes/admin") }, // loader = requireRole("admin")
        ],
      },
      { path: "*", lazy: () => import("@/routes/not-found") },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

```tsx
// src/app/main.tsx
import "@ant-design/v5-patch-for-react-19"; // first import (ui-antd-scss.md)
import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { queryClient } from "@/shared/lib/query-client";

import { AntdProvider } from "./providers/AntdProvider";
import { router } from "./router";
import "@/styles/globals.scss";

createRoot(document.getElementById("root")!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AntdProvider>
        <RouterProvider router={router} />
      </AntdProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

Every route is `lazy` (own chunk). A route module exports only route
properties: `loader`, `action`, `Component`, `ErrorBoundary`, `handle`.
ESLint: turn off `react-refresh/only-export-components` for `src/routes/**`.
Navigation pending UI: `useNavigation().state === "loading"` in `RootLayout`
(top progress bar + `aria-busy`), not a spinner per page.

## Route module — loader + Query

```tsx
// src/routes/inspection-detail.tsx
import { useParams, type LoaderFunctionArgs } from "react-router";

import { withAuth } from "@/app/guards";
import { InspectionDetailPage, inspectionDetailQuery } from "@/features/inspections";
import { queryClient } from "@/shared/lib/query-client";
import { requireParam } from "@/shared/lib/route-params";

export const loader = withAuth(async ({ params }: LoaderFunctionArgs) => {
  const id = requireParam(params, "inspectionId");
  await queryClient.ensureQueryData(inspectionDetailQuery(id)); // data ready before render
  return null;
});

export function Component() {
  const id = requireParam(useParams(), "inspectionId");
  return <InspectionDetailPage id={id} />;
}

export { RouteError as ErrorBoundary } from "@/app/layout/RouteError";
```

```tsx
// in the feature: data is already cached → no suspend, no waterfall
const { data: inspection } = useSuspenseQuery(inspectionDetailQuery(id));
```

Rules:

- The loader **only warms the Query cache** (`ensureQueryData` /
  `prefetchQuery` with the feature's `queryOptions`) and returns `null`.
  Components read through TanStack Query, never `useLoaderData` for server
  data — Query owns caching, refetching and invalidation.
- Detail routes `await ensureQueryData` (+ `revalidateIfStale: true` when the
  cached copy may be old). List routes with filters/pagination call
  `void queryClient.prefetchQuery(...)` without awaiting and render with
  `useInspectionsQuery` (`placeholderData: keepPreviousData`), so changing a
  filter does not block navigation.
- Loaders run in parallel; independent queries → `Promise.all`.
- No `useEffect` fetching, no fetching in route components.

## Typed params and search params

```ts
// shared/lib/route-params.ts
import { data, type Params } from "react-router";

export function requireParam<K extends string>(params: Params, key: K): string {
  const value = params[key];
  if (!value) throw data(null, { status: 404 }); // → ErrorBoundary renders "not found"
  return value;
}
```

```ts
// shared/lib/search-params.ts
import type { z } from "zod";

export function parseSearchParams<S extends z.ZodType>(
  schema: S,
  params: URLSearchParams,
): z.output<S> {
  return schema.parse(Object.fromEntries(params)); // schema uses .catch() → never throws on bad input
}
```

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const filters = parseSearchParams(inspectionFiltersSchema, searchParams);

const setStatus = (status: InspectionStatus) =>
  setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set("status", status);
    next.set("page", "1");
    return next;
  });
```

Loaders parse the same schema from `new URL(request.url).searchParams`.
Filters, pagination, tabs live in the URL — not in Zustand (§7).

## Protected and role routes

```ts
// src/app/guards.ts
import { data, redirect, type LoaderFunctionArgs } from "react-router";

import { useAuthStore, type Role } from "@/shared/stores/auth.store";

type Loader = (args: LoaderFunctionArgs) => Promise<unknown>;

// restoreSession(): calls /auth/refresh once (memoised promise) and sets the auth store status;
// full code in the `/front-template project` scaffold for this profile.

export async function requireAuth({ request }: LoaderFunctionArgs) {
  await restoreSession(); // single-flight: one /auth/refresh per page load
  if (useAuthStore.getState().status !== "authenticated") {
    const { pathname, search } = new URL(request.url);
    throw redirect(`/login?redirect=${encodeURIComponent(pathname + search)}`);
  }
  return null;
}

export function requireRole(role: Role, loader?: Loader): Loader {
  return withAuth(async (args) => {
    if (!useAuthStore.getState().user?.roles.includes(role)) throw data(null, { status: 403 });
    return loader ? loader(args) : null;
  });
}

// parent and child loaders run IN PARALLEL — a child loader that fetches must guard itself
export function withAuth(loader: Loader): Loader {
  return async (args) => {
    await requireAuth(args);
    return loader(args);
  };
}
```

- Guards live in loaders and throw `redirect()` / `data(null, { status: 403 })`
  — never a `useEffect` + `navigate` guard, never a "flash" of protected UI.
- The login route's loader redirects authenticated users away; after login,
  `navigate(safeRedirect(searchParams.get("redirect")), { replace: true })`
  (`security.md`).
- Client guards are UX only; the API authorises every request.

## Errors and 404

```tsx
// app/layout/RouteError.tsx
import { useEffect } from "react";
import { isRouteErrorResponse, useRevalidator, useRouteError } from "react-router";

import { ErrorState } from "@/shared/components/ErrorState";
import { logger } from "@/shared/lib/logger";

import { NotFoundState } from "./NotFoundState";

export function RouteError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const isResponse = isRouteErrorResponse(error);

  // sync with an external system (Sentry): loader errors never reach React's root hooks
  useEffect(() => {
    if (!isResponse) logger.error(error, { scope: "route" });
  }, [error, isResponse]);

  if (isResponse && error.status === 404) return <NotFoundState />;
  return <ErrorState onRetry={() => void revalidator.revalidate()} />;
}
```

- `ErrorBoundary` on every route with a loader **and** on the root route.
  Thrown responses (404/403) are expected — rendered, not reported. Render
  errors also reach `onCaughtError` (Sentry's dedupe drops the duplicate).
- Never show `error.message` from the server; generic text + retry.
- Unknown URLs → the `*` route (`not-found.tsx`); unknown ids → `requireParam`
  or the API's 404 mapped to `throw data(null, { status: 404 })`.
- Sentry tracing: `Sentry.reactRouterV7BrowserTracingIntegration(...)` and
  `Sentry.wrapCreateBrowserRouterV7(createBrowserRouter)` (`observability.md`).

## Navigation and page title

- Links: `<Link to={paths.inspection(id)}>` / `<NavLink>` (sets `aria-current`).
  Build paths in one place with `generatePath`:
  `inspection: (id: string) => generatePath("/inspections/:inspectionId", { inspectionId: id })`
  in `shared/lib/paths.ts` — no string concatenation in components.
- Programmatic: `useNavigate()` inside event handlers. Outside React (logout
  after refresh failure) `src/app` wires `tokenStorage.setLogoutHandler` to
  `router.navigate("/login", { replace: true })`. Never
  `window.location.href = …` for internal routes.
- Title: React 19 renders `<title>` from components — one per page, in the
  page component: `<title>{`${inspection.title} · Inspections`}</title>`. No
  `react-helmet-async`, no `useEffect` writing `document.title`.

## Testing

```tsx
// src/routes/inspection-detail.test.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { routes } from "@/app/router";
import { queryClient } from "@/shared/lib/query-client";
import { useAuthStore } from "@/shared/stores/auth.store";

it("renders the inspection after the loader warmed the cache", async () => {
  useAuthStore.setState({ status: "authenticated", user: { id: "u1", roles: ["inspector"] } });
  const router = createMemoryRouter(routes, { initialEntries: ["/inspections/1"] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  expect(await screen.findByRole("heading", { name: /boiler check/i })).toBeInTheDocument();
});
```

- Route tests use `createMemoryRouter` with the real `routes` + MSW; loaders
  use the app `queryClient`, so `test/setup.ts` calls `queryClient.clear()`
  and resets stores in `afterEach`.
- Component tests (no routing) use `renderWithProviders`; a component that
  needs a router gets `createMemoryRouter([{ path: "/", Component: () => ui }])`
  at the call site (`testing-vitest.md`).
- Guards: test redirect (anonymous → `/login?redirect=…`) and 403 directly by
  calling the loader with a `new Request("http://localhost/admin")`.
