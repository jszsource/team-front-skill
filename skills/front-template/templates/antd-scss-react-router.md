# `antd-scss-react-router` profile templates (React SPA)

Profile `antd-scss-react-router` (STANDARDS §1.1, §2.5, §8): React 19 + Vite +
React Compiler, **React Router** (data mode, `createBrowserRouter`), feature
folders, **Ant Design v5 + SCSS modules — no Tailwind** (no preflight, no
`prettier-plugin-tailwindcss`, no `cn()` / `cva`, no shadcn, no `sonner`).
The bundle is fixed: there is no UI or router choice. Architecture, naming and
the FSD → feature path map: `../team-frontend/references/feature-architecture.md`;
UI rules: `../team-frontend/references/ui-antd-scss.md`. Next.js and the
`shadcn-tailwind-tanstack-router` profile use `project.md` / `slices.md` instead.

Entry points:

- `react-antd [name]`, or `react` with profile `antd-scss-react-router` →
  § Project, **in place** (the in-place rules of `project.md` apply unchanged:
  scaffold into a temp sibling, move files, never clear the folder).
- `project <name> react-antd` → § Project in a new sub-folder `<name>/`.
- `feature <domain>` in an `antd-scss-react-router` project → § Feature module.
- `component features/<domain> <Name>` → `component.md` (`antd-scss-react-router` paths).

All code is in the team Prettier style (`tooling.md`: double quotes, semicolons,
trailing commas, width 100) and import order (builtin → external → `@/…` →
relative → type). Every `.tsx` stays ≤ 150 lines.

---

## Project

### 0. Before running anything — one message

Same as `project.md` ("Before running anything"): package manager, optional
Sentry / i18n, version check (add `react-router`, `antd`, `sass-embedded` to
the checked packages). Show the plan once and wait for confirmation.

### 1. Create

```bash
npm create vite@latest <name> -- --template react-ts
cd <name>
npm i
npm i react-router @tanstack/react-query zustand axios zod react-hook-form \
  @hookform/resolvers antd@5 @ant-design/cssinjs @ant-design/v5-patch-for-react-19 \
  dayjs lucide-react
npm i -D @tanstack/react-query-devtools sass-embedded babel-plugin-react-compiler @types/node
```

- `@ant-design/cssinjs` must match the version `antd` depends on (check the
  lockfile). No `tailwindcss`, `@tailwindcss/vite`, `sonner`,
  `components.json`, `class-variance-authority`, `clsx`, `tailwind-merge`,
  `@tanstack/react-table` — AntD `Table` (`virtual` for 100+ rows) is the
  table, `App.useApp()` / `notify` the toasts.
- `@tanstack/react-virtual` only when a custom (non-`Table`) list needs it.

Delete the Vite demo files (`src/App.tsx`, `src/App.css`, `src/main.tsx`,
`src/index.css`, `src/assets/`, `public/vite.svg`) — they are replaced below.

### 2. `vite.config.ts`

```ts
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// SCSS modules compile through sass-embedded — no Vite plugin, no PostCSS config
export default defineConfig({
  plugins: [react({ babel: { plugins: ["babel-plugin-react-compiler"] } })],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
```

Add the production-only `cspMeta` plugin exactly as in `project.md` § A (CSP,
`../team-frontend/references/security.md`) — or set CSP + security headers at
the host and skip it. AntD CSS-in-JS injects `<style>` tags: `style-src` needs
`'unsafe-inline'` or a nonce passed to `StyleProvider` / `ConfigProvider csp`.

`tsconfig.app.json`: the compiler options from `tooling.md` ("TypeScript"),
plus `"types": ["vite/client", "vitest/globals"]`. `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
```

`index.html`: `<html lang="en">`, a default `<title>`, and
`<script type="module" src="/src/app/main.tsx"></script>`.

### 3. Record the profile — project `CLAUDE.md`

```md
## Frontend profile

- profile: antd-scss-react-router
```

### 4. Tree

```
<name>/
├── index.html  vite.config.ts  vitest.config.mts  playwright.config.ts
├── eslint.config.mjs           # React `antd-scss-react-router` variant (tooling.md)
├── .prettierrc.json  .prettierignore  commitlint.config.mjs
├── .env.example  .nvmrc  CLAUDE.md
├── .husky/{pre-commit,commit-msg,pre-push}
├── .github/workflows/ci.yml
├── e2e/{a11y.ts,specs/smoke.spec.ts}
└── src/
    ├── app/
    │   ├── main.tsx            # createRoot + providers + RouterProvider
    │   ├── router.tsx          # createBrowserRouter — route table only
    │   ├── guards.ts           # restoreSession / requireAuth loaders
    │   ├── init-auth.ts        # logout handler (stores, cache, redirect)
    │   ├── providers/{AppProviders.tsx,AntdProvider.tsx}
    │   └── layout/{RootLayout.tsx,RouteError.tsx,RootSkeleton.tsx}
    ├── routes/{home.tsx,not-found.tsx}   # thin route modules (lazy)
    ├── features/               # one folder per business domain (§ Feature module)
    ├── shared/
    │   ├── components/         # AntD-based shared components + *.module.scss
    │   │                       #   (NotifyBridge.tsx, FormField.tsx, …)
    │   ├── hooks/  types/
    │   ├── lib/{http-client.ts,http-client.test.ts,auth-http-client.ts,token.ts,
    │   │        api-error.ts,query-client.ts,env.ts,logger.ts,safe-url.ts,
    │   │        notify.ts,theme.ts}
    │   └── stores/{auth.store.ts,ui-prefs.store.ts,create-resettable-store.ts,
    │                create-resettable-store.test.ts}
    ├── test/{setup.ts,test-utils.tsx,mocks/{server.ts,handlers.ts,handlers/}}
    ├── styles/{globals.scss,_mixins.scss}
    └── vite-env.d.ts
```

### 5. App shell

```tsx
// src/app/main.tsx
import "@ant-design/v5-patch-for-react-19"; // antd v5 on React 19 — must stay the first import
import "@/styles/globals.scss";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { logger } from "@/shared/lib/logger";

import { initAuth } from "./init-auth";
import { AppProviders } from "./providers/AppProviders";
import { router } from "./router";

initAuth();

createRoot(document.getElementById("root")!, {
  // React 19 root error hooks (observability.md); Sentry dedupes repeats
  onUncaughtError: (error) => logger.error(error, { boundary: "root" }),
  onCaughtError: (error) => logger.error(error, { boundary: "caught" }),
}).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
```

```tsx
// src/app/providers/AppProviders.tsx — server state + AntD (theme, App, notify bridge)
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "@/shared/lib/query-client";

import { AntdProvider } from "./AntdProvider";

import type { ReactNode } from "react";

export type AppProvidersProps = { children: ReactNode };

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AntdProvider>{children}</AntdProvider>
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-left" />}
    </QueryClientProvider>
  );
}
```

Take verbatim from `../team-frontend/references/ui-antd-scss.md`:
`src/app/providers/AntdProvider.tsx` (`StyleProvider layer` → `ConfigProvider`
with `appTheme` + light/dark `algorithm` → `App` → `NotifyBridge`),
`src/shared/lib/theme.ts` (the only place for design tokens, `cssVar: true`),
`src/shared/lib/notify.ts`, `src/shared/components/NotifyBridge.tsx`,
`src/shared/components/FormField.tsx` (RHF `useController` inside
`Form.Item`, `validateStatus` / `help` from the field error) and
`src/styles/globals.scss` (layer order + small reset — no
`antd/dist/reset.css`). `src/shared/stores/ui-prefs.store.ts`: a small
Zustand store with `colorScheme: "light" | "dark"` and `setColorScheme` — the
only dark-mode switch (AntD `algorithm` + `--ant-*` variables follow it, no
effect, no `.dark` class).

```tsx
// src/app/router.tsx — route table only; route modules are lazy chunks
import { createBrowserRouter } from "react-router";

import { requireAuth, restoreSession } from "./guards";
import { RootLayout } from "./layout/RootLayout";
import { RootSkeleton } from "./layout/RootSkeleton";
import { RouteError } from "./layout/RouteError";

export const router = createBrowserRouter([
  {
    id: "root",
    Component: RootLayout,
    ErrorBoundary: RouteError,
    HydrateFallback: RootSkeleton,
    loader: restoreSession,
    children: [
      { index: true, lazy: () => import("@/routes/home") },
      {
        // protected group: every child needs a session
        loader: requireAuth,
        children: [
          // { path: "__name__", lazy: () => import("@/routes/__name__") },
        ],
      },
      // TODO: { path: "login", lazy: () => import("@/routes/login") } — features/auth
      { path: "*", lazy: () => import("@/routes/not-found") },
    ],
  },
]);
```

```ts
// src/app/guards.ts — loaders; React Router runs parent and child loaders in parallel,
// so requireAuth awaits the same restore promise instead of reading "unknown"
import { redirect, type LoaderFunctionArgs } from "react-router";

import { refreshAccessToken } from "@/shared/lib/auth-http-client";
import { tokenStorage } from "@/shared/lib/token";
import { useAuthStore } from "@/shared/stores/auth.store";

let restoring: Promise<null> | null = null;

async function restore(): Promise<null> {
  const { status, setStatus } = useAuthStore.getState();
  if (status !== "unknown") return null;
  try {
    tokenStorage.set(await refreshAccessToken()); // one refresh on page load (http-axios.md)
    setStatus("authenticated"); // TODO: load the user in features/auth and call setUser
  } catch {
    setStatus("anonymous");
  }
  return null;
}

export function restoreSession(): Promise<null> {
  restoring ??= restore();
  return restoring;
}

export async function requireAuth({ request }: LoaderFunctionArgs) {
  await restoreSession();
  if (useAuthStore.getState().status === "authenticated") return null;
  const { pathname, search } = new URL(request.url);
  throw redirect(`/login?redirect=${encodeURIComponent(pathname + search)}`); // read via safeRedirect()
}

type Loader = (args: LoaderFunctionArgs) => Promise<unknown>;

// a child loader that fetches runs in parallel with requireAuth → it must guard itself
export function withAuth(loader: Loader): Loader {
  return async (args) => {
    await requireAuth(args);
    return loader(args);
  };
}
```

```ts
// src/app/init-auth.ts — both logout paths end here: the logout button (after the
// backend logout call) and a failed refresh in shared/lib/http-client.ts
import { tokenStorage } from "@/shared/lib/token";
import { useAuthStore } from "@/shared/stores/auth.store";

import { router } from "./router";

export function initAuth() {
  tokenStorage.setLogoutHandler(() => {
    useAuthStore.getState().logout(); // token, auth store, resetAllStores(), queryClient.clear()
    void router.navigate("/login");
  });
}
```

```tsx
// src/app/layout/RootLayout.tsx — app-wide chrome (Header/Sider go in layout/ too)
import { Layout } from "antd";
import { Outlet, useNavigation } from "react-router";

import styles from "./RootLayout.module.scss";

export function RootLayout() {
  const isNavigating = useNavigation().state === "loading";

  return (
    <Layout className={styles.root}>
      <Layout.Content aria-busy={isNavigating}>
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
```

```scss
// src/app/layout/RootLayout.module.scss — tokens via --ant-* variables, never hex
.root {
  min-height: 100dvh;
}
```

```tsx
// src/app/layout/RouteError.tsx — generic message + retry, never error.message
import { Button, Result } from "antd";
import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";

import { logger } from "@/shared/lib/logger";

export function RouteError() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const heading = isNotFound ? "Page not found" : "Something went wrong";

  useEffect(() => {
    // sync with an external system: the error reporter (observability.md)
    if (!isNotFound) logger.error(error, { boundary: "route" });
  }, [error, isNotFound]);

  return (
    <main>
      <title>{heading}</title>
      <Result
        status={isNotFound ? "404" : "error"}
        title={<h1>{heading}</h1>}
        extra={
          <Button type="primary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
```

```tsx
// src/app/layout/RootSkeleton.tsx — shown while the root loader restores the session
import { Skeleton } from "antd";

import styles from "./RootSkeleton.module.scss";

export function RootSkeleton() {
  return (
    <div role="status" aria-label="Loading" className={styles.root}>
      <Skeleton active paragraph={{ rows: 4 }} />
    </div>
  );
}
```

```scss
// src/app/layout/RootSkeleton.module.scss
.root {
  min-height: 100dvh;
  padding: var(--ant-padding-xl);
}
```

```tsx
// src/routes/home.tsx — thin route module; page titles are React 19 <title>, no effect
import { Button, Flex, Typography } from "antd";

import styles from "./home.module.scss";

export function Component() {
  return (
    <main className={styles.page}>
      <title>Home</title>
      <Flex vertical gap="middle" align="flex-start">
        <Typography.Title level={1}>Home</Typography.Title>
        <Typography.Paragraph type="secondary">TODO: product description</Typography.Paragraph>
        <Button type="primary">Get started</Button>
      </Flex>
    </main>
  );
}
```

```scss
// src/routes/home.module.scss — page width/padding; the same shape for every page
.page {
  max-width: 1200px; // content width — no token for it
  margin-inline: auto;
  padding: var(--ant-padding-xl) var(--ant-padding-lg);
}
```

`src/routes/not-found.tsx`: same shape — `<title>`, `Result status="404"` with
an `h1` "Page not found" and `<Link to="/">` home. Only one `<title>` is
rendered at a time: the leaf route renders it, layouts don't.

### 6. `shared/lib` — env, logger, errors, query client

```ts
// src/shared/lib/env.ts — browser-safe values only; everything VITE_* is public
import { z } from "zod";

const EnvSchema = z.object({ API_URL: z.url() });

export const env = EnvSchema.parse({ API_URL: import.meta.env.VITE_API_URL });
```

`.env.example`: `VITE_API_URL=http://localhost:8080/api`. A Vite SPA has no secrets.

```ts
// src/shared/lib/logger.ts — the only logging API (no console.log elsewhere)
type LogContext = Record<string, string | number | boolean | null>;

export const logger = {
  warn: (message: string, context?: LogContext) => {
    if (import.meta.env.DEV) console.warn(message, context ?? "");
  },
  error: (error: unknown, context?: LogContext) => {
    console.error(error, context ?? ""); // replaced by Sentry.captureException when monitoring is on
  },
};
```

```ts
// src/shared/lib/api-error.ts — one error type for the whole app (no axios import)
import { z } from "zod";

type ErrorBody = { message?: string; code?: string };

export class ApiError extends Error {
  readonly status: number | null;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number | null, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createApiError(status: number, body: unknown, fallback: string): ApiError {
  const b = (typeof body === "object" && body !== null ? body : {}) as ErrorBody;
  return new ApiError(b.message ?? fallback, status, b.code, body);
}

// TODO: match the backend's validation error shape
const FieldErrorsBody = z.object({ errors: z.record(z.string(), z.string()) });

/** Field errors of a 422 response, for form.setError(). Empty when there are none. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 422) return {};
  const parsed = FieldErrorsBody.safeParse(error.details);
  return parsed.success ? parsed.data.errors : {};
}
```

```ts
// src/shared/lib/query-client.ts — the one QueryClient (STANDARDS §7)
import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api-error";

const MAX_RETRIES = 2;

function shouldRetry(failureCount: number, error: unknown) {
  const isClientError =
    error instanceof ApiError && error.status !== null && error.status >= 400 && error.status < 500;
  return !isClientError && failureCount < MAX_RETRIES; // never retry 4xx
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // fallback only — every endpoint sets its own (lib/query-keys.ts)
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
    mutations: { retry: false },
  },
});
```

### 7. `shared/lib` — HTTP: token, bare refresh client, `httpClient`

```ts
// src/shared/lib/token.ts — access token in memory only (never storage, never Zustand)
type LogoutHandler = () => void;

let accessToken: string | null = null;
let onLogout: LogoutHandler = () => {};

export const tokenStorage = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  setLogoutHandler: (handler: LogoutHandler) => {
    onLogout = handler;
  },
  logout: () => {
    accessToken = null;
    onLogout();
  },
};
```

```ts
// src/shared/lib/auth-http-client.ts
import axios from "axios";
import { z } from "zod";

import { env } from "./env";

// Bare instance WITHOUT interceptors: a 401 from /auth/refresh must never re-enter
// httpClient's refresh flow (infinite loop). Not exported — used ONLY by refreshAccessToken().
const authHttpClient = axios.create({
  baseURL: env.API_URL,
  timeout: 15_000,
  withCredentials: true, // sends the httpOnly refresh cookie
});

const RefreshResponse = z.object({ accessToken: z.string().min(1) });

export async function refreshAccessToken(): Promise<string> {
  const res = await authHttpClient.post<unknown>("/auth/refresh");
  return RefreshResponse.parse(res.data).accessToken;
}
```

```ts
// src/shared/lib/http-client.ts — the single axios instance for all business requests
import axios, { isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { ApiError, createApiError } from "./api-error";
import { refreshAccessToken } from "./auth-http-client";
import { env } from "./env";
import { notify } from "./notify"; // themed AntD message outside React (ui-antd-scss.md)
import { tokenStorage } from "./token";

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const httpClient = axios.create({ baseURL: env.API_URL, timeout: 15_000 });

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    return error.response
      ? createApiError(error.response.status, error.response.data, error.message)
      : new ApiError(error.message, null, error.code);
  }
  return new ApiError("Unexpected error", null);
}

httpClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight refresh: one /auth/refresh at a time; concurrent 401s wait in the queues.
// Success AND failure are both delivered, so no waiting request stays pending forever.
let isRefreshing = false;
let successSubscribers: Array<(token: string) => void> = [];
let failureSubscribers: Array<(error: unknown) => void> = [];

function waitForRefresh(): Promise<string> {
  return new Promise((resolve, reject) => {
    successSubscribers.push(resolve);
    failureSubscribers.push(reject);
  });
}

function notifyRefreshed(token: string) {
  successSubscribers.forEach((resolve) => resolve(token));
  successSubscribers = [];
  failureSubscribers = [];
}

function notifyRefreshFailed(error: unknown) {
  failureSubscribers.forEach((reject) => reject(error));
  successSubscribers = [];
  failureSubscribers = [];
}

async function refreshOnce(): Promise<string> {
  if (isRefreshing) return waitForRefresh();
  isRefreshing = true;
  try {
    const token = await refreshAccessToken();
    tokenStorage.set(token);
    isRefreshing = false;
    notifyRefreshed(token);
    return token;
  } catch (error) {
    isRefreshing = false;
    notifyRefreshFailed(error);
    tokenStorage.logout(); // → logout sequence in app/init-auth.ts
    throw error;
  }
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry) {
      original._retry = true; // each request is retried at most once
      try {
        const current = tokenStorage.get();
        // a parallel request already refreshed the token → retry with it, no new refresh
        const isStale = current !== null && original.headers.Authorization !== `Bearer ${current}`;
        const token = isStale ? current : await refreshOnce();
        original.headers.Authorization = `Bearer ${token}`;
        return await httpClient(original);
      } catch (retryError) {
        return Promise.reject(toApiError(retryError));
      }
    }

    if (status !== undefined && status >= 500) {
      notify.error("Server error. Please try again later.", "server-error"); // the only message in the HTTP layer
    }
    return Promise.reject(toApiError(error));
  },
);
```

```ts
// src/shared/lib/http-client.test.ts — refresh flow (STANDARDS §10)
import { http, HttpResponse } from "msw";

import { server } from "@/test/mocks/server";

import { httpClient } from "./http-client";
import { tokenStorage } from "./token";

const protectedMe = http.get("*/me", ({ request }) =>
  request.headers.get("Authorization") === "Bearer fresh"
    ? HttpResponse.json({ ok: true })
    : new HttpResponse(null, { status: 401 }),
);

describe("httpClient refresh flow", () => {
  it("refreshes once for parallel 401s and retries every request", async () => {
    let refreshCalls = 0;
    server.use(
      protectedMe,
      http.post("*/auth/refresh", () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: "fresh" });
      }),
    );
    const results = await Promise.all([httpClient.get("/me"), httpClient.get("/me")]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(refreshCalls).toBe(1);
  });

  it("rejects all waiting requests and logs out when the refresh fails", async () => {
    const onLogout = vi.fn();
    tokenStorage.setLogoutHandler(onLogout);
    server.use(
      protectedMe,
      http.post("*/auth/refresh", () => new HttpResponse(null, { status: 401 })),
    );
    const results = await Promise.allSettled([httpClient.get("/me"), httpClient.get("/me")]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(tokenStorage.get()).toBeNull();
  });
});
```

### 8. `shared/stores`

```ts
// src/shared/stores/create-resettable-store.ts — every feature store is created here
import { create, type StateCreator, type StoreMutatorIdentifier } from "zustand";

type Resettable = { reset: () => void };

const resetters = new Set<() => void>();

/** Calls reset() on every registered store. Used only by logout (and test setup). */
export function resetAllStores(): void {
  resetters.forEach((reset) => reset());
}

// Mos keeps middleware typing (persist → reset() must also call api.persist.clearStorage())
export function createResettableStore<
  T extends Resettable,
  Mos extends [StoreMutatorIdentifier, unknown][] = [],
>(initializer: StateCreator<T, [], Mos>) {
  const useStore = create<T>()(initializer);
  resetters.add(() => useStore.getState().reset());
  return useStore;
}
```

```ts
// src/shared/stores/auth.store.ts — root store: plain create(), it calls resetAllStores()
import { create } from "zustand";

import { queryClient } from "@/shared/lib/query-client";
import { tokenStorage } from "@/shared/lib/token";

import { resetAllStores } from "./create-resettable-store";

export type AuthUser = { id: string; name: string }; // TODO: real fields
export type AuthStatus = "unknown" | "authenticated" | "anonymous";

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  setUser: (user: AuthUser) => void;
  setStatus: (status: AuthStatus) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: "unknown",
  setUser: (user) => set({ user, status: "authenticated" }),
  setStatus: (status) => set({ status }),
  logout: () => {
    tokenStorage.set(null); // 1. in-memory access token
    set({ user: null, status: "anonymous" }); // 2. this store
    resetAllStores(); // 3. every feature store (+ persisted keys)
    queryClient.clear(); // 4. all cached server data — no user data survives a logout
  },
}));
```

`create-resettable-store.test.ts`: create a store with the factory, change it,
call `resetAllStores()`, expect the initial state (same shape as the feature
store test below).

### 9. Tests — `src/test/`

```ts
// vitest.config.mts
import path from "node:path";

import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
    env: { VITE_API_URL: "http://localhost:8080/api" },
    css: { modules: { classNameStrategy: "non-scoped" } }, // readable SCSS module names
    coverage: {
      provider: "v8",
      include: ["src/features/**", "src/shared/lib/**", "src/shared/stores/**"],
      thresholds: { lines: 80 },
    },
  },
});
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";

import { tokenStorage } from "@/shared/lib/token";
import { useAuthStore } from "@/shared/stores/auth.store";
import { resetAllStores } from "@/shared/stores/create-resettable-store";

import { server } from "./mocks/server";

// jsdom lacks these; AntD responsive utilities and Table need them (ui-antd-scss.md)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetAllStores();
  tokenStorage.set(null);
  useAuthStore.setState({ user: null, status: "unknown" });
});
afterAll(() => server.close());
```

```tsx
// src/test/test-utils.tsx — wraps ONLY QueryClientProvider; router/theme are added at the
// call site (createMemoryRouter + RouterProvider), never inside this helper
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ReactElement } from "react";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  const queryClient = createTestQueryClient();
  return {
    queryClient,
    user: userEvent.setup(),
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options),
  };
}

export * from "@testing-library/react";
```

```ts
// src/test/mocks/server.ts
import { setupServer } from "msw/node";

import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```ts
// src/test/mocks/handlers.ts — one spread per feature: handlers/<domain>.ts
export const handlers = [
  // ...inspectionsHandlers,
];
```

### 10. Common parts — take from `project.md` / references

Everything in `project.md` "Common to both" applies, with
`antd-scss-react-router` paths (`feature-architecture.md` path map) and
without the Tailwind/shadcn rows:

| File(s) | Source |
| --- | --- |
| `eslint.config.mjs` — **React `antd-scss-react-router` variant** (incl. the `antd` `message`/`notification`, `sonner` and static `Modal.*` restrictions from `ui-antd-scss.md`); husky, lint-staged, commitlint, scripts (`"typecheck": "tsc -b"`), `.nvmrc` | `../team-frontend/references/tooling.md` |
| `.prettierrc.json` — the team config **without** `plugins` / `tailwindStylesheet` (no `prettier-plugin-tailwindcss` in this profile; all other settings unchanged), `.prettierignore` | `../team-frontend/references/tooling.md` |
| `.github/workflows/ci.yml` (`VITE_API_URL` placeholder in `env:`) | `../team-frontend/references/ci.md` |
| `playwright.config.ts` (Vite `preview` on 4173), `e2e/a11y.ts`, `e2e/specs/smoke.spec.ts` | `project.md` "Common to both", `../team-frontend/references/e2e-playwright.md` |
| `shared/lib/safe-url.ts` (+ test); `sanitize.ts` only when HTML is rendered | `../team-frontend/references/security.md` |
| `AntdProvider`, `theme.ts`, `notify.ts`, `NotifyBridge`, `FormField`, `styles/globals.scss`, `_mixins.scss` breakpoints | `../team-frontend/references/ui-antd-scss.md` |
| testing devDependencies (`vitest`, `jsdom`, Testing Library, `msw`, `@vitest/coverage-v8`, Playwright + axe) | `project.md` "Then:" block (no `vite-tsconfig-paths` — alias above; no `shadcn init`) |
| Sentry (optional) — `@sentry/react` with the React Router integration, `src/shared/lib/monitoring/` | `../team-frontend/references/observability.md` |
| i18n (optional) — `react-i18next`, `src/shared/lib/i18n/`, namespace loaded in the route `loader`; AntD + `dayjs` locales via `ConfigProvider locale` | `../team-frontend/references/i18n.md` |

Finish exactly as `project.md` "Finish" (format, lint, typecheck, test, build,
test:e2e; first commit `chore: scaffold project from team frontend template`).
Next step: `/front-template feature <domain>`.

---

## Feature module

`feature <domain>` → `src/features/__name__/`. `__name__` is the plural domain
(`inspections`), `__item__` / `__Item__` its singular (`inspection` /
`Inspection`), `__ITEM__` the singular in SCREAMING_SNAKE (`INSPECTION`).
Generate only what the domain needs: no form → no `components/__Item__Form.tsx`;
no shared UI state → no store.

```
features/__name__/
├── components/
│   ├── __Name__Page.tsx         # the screen this feature owns (route renders it)
│   ├── __Name__Page.module.scss # page layout only (--ant-* tokens)
│   ├── __Name__List.tsx         # AntD Table: loading / empty / error states
│   ├── __Item__Form.tsx         # RHF + zod + FormField (Form.Item) + AntD inputs
│   └── __Item__Form.test.tsx
├── lib/
│   ├── api.ts                   # httpClient + AbortSignal + zod parse (not exported)
│   └── query-keys.ts            # key factory + cache-policy block
├── queries/
│   ├── use__Name__Query.ts      # list: queryOptions + hook
│   ├── use__Item__Query.ts      # detail
│   ├── useCreate__Item__Mutation.ts
│   └── useDelete__Item__Mutation.ts
├── schemas/
│   └── __item__.schema.ts       # zod + inferred types
├── __name__.store.ts            # only if shared UI state is needed
├── __name__.store.test.ts
└── index.ts
```

Plus `src/routes/__name__.tsx`, its entry in `src/app/router.tsx`, and
`src/test/mocks/handlers/__name__.ts` registered in `handlers.ts`.

```ts
// schemas/__item__.schema.ts
import { z } from "zod";

export const __item__Schema = z.object({
  id: z.string(),
  title: z.string(), // TODO: real fields
  createdAt: z.string(), // ISO string
});
export const __item__ListSchema = z.array(__item__Schema);

export const __item__FormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
});

// URL search params: invalid values fall back instead of throwing
export const __item__FiltersSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});

export type __Item__ = z.infer<typeof __item__Schema>;
export type __Item__FormValues = z.infer<typeof __item__FormSchema>;
export type __Item__Filters = z.infer<typeof __item__FiltersSchema>;
```

```ts
// lib/api.ts — the only place this feature talks HTTP
import { httpClient } from "@/shared/lib/http-client";

import {
  __item__ListSchema,
  __item__Schema,
  type __Item__Filters,
  type __Item__FormValues,
} from "../schemas/__item__.schema";

type RequestOptions = { signal?: AbortSignal };

const BASE = "/__name__"; // TODO: real endpoint

export const __item__Api = {
  list: async (filters: __Item__Filters, { signal }: RequestOptions = {}) => {
    const res = await httpClient.get<unknown>(BASE, { params: filters, signal });
    return __item__ListSchema.parse(res.data);
  },
  byId: async (id: string, { signal }: RequestOptions = {}) => {
    const res = await httpClient.get<unknown>(`${BASE}/${encodeURIComponent(id)}`, { signal });
    return __item__Schema.parse(res.data);
  },
  create: async (input: __Item__FormValues) => {
    const res = await httpClient.post<unknown>(BASE, input);
    return __item__Schema.parse(res.data);
  },
  remove: async (id: string) => {
    await httpClient.delete(`${BASE}/${encodeURIComponent(id)}`);
  },
};
```

```ts
// lib/query-keys.ts
/**
 * Cache policy — __name__ (STANDARDS §7)
 * owner:        TODO team
 * purpose:      TODO what the data is used for
 * keys:         __item__Keys.* (["__name__", ...])
 * staleTime:    60 s list / 30 s detail   gcTime: 10 min   — TODO: from business freshness
 * invalidation: create → lists(); update → detail(id) + lists();
 *               delete → lists() + removeQueries(detail(id))
 * retry:        global default (GET ×2 with backoff, never 4xx; mutations never)
 * realtime:     none — TODO (WebSocket event → setQueryData / invalidate)
 */
import type { __Item__Filters } from "../schemas/__item__.schema";

export const __item__Keys = {
  all: ["__name__"] as const,
  lists: () => [...__item__Keys.all, "list"] as const,
  list: (filters: __Item__Filters) => [...__item__Keys.lists(), filters] as const,
  details: () => [...__item__Keys.all, "detail"] as const,
  detail: (id: string) => [...__item__Keys.details(), id] as const,
};

export const __ITEM___LIST_CACHE = { staleTime: 60_000, gcTime: 10 * 60_000 } as const;
export const __ITEM___DETAIL_CACHE = { staleTime: 30_000, gcTime: 10 * 60_000 } as const;
```

```ts
// queries/use__Name__Query.ts
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { __item__Api } from "../lib/api";
import { __ITEM___LIST_CACHE, __item__Keys } from "../lib/query-keys";

import type { __Item__Filters } from "../schemas/__item__.schema";

// shared by the hook, the route loader (ensureQueryData) and tests
export const __item__ListQuery = (filters: __Item__Filters) =>
  queryOptions({
    queryKey: __item__Keys.list(filters),
    queryFn: ({ signal }) => __item__Api.list(filters, { signal }),
    ...__ITEM___LIST_CACHE,
  });

export function use__Name__Query(filters: __Item__Filters) {
  return useQuery({ ...__item__ListQuery(filters), placeholderData: keepPreviousData });
}
```

```ts
// queries/use__Item__Query.ts
import { queryOptions, useQuery } from "@tanstack/react-query";

import { __item__Api } from "../lib/api";
import { __ITEM___DETAIL_CACHE, __item__Keys } from "../lib/query-keys";

export const __item__DetailQuery = (id: string) =>
  queryOptions({
    queryKey: __item__Keys.detail(id),
    queryFn: ({ signal }) => __item__Api.byId(id, { signal }),
    ...__ITEM___DETAIL_CACHE,
  });

export function use__Item__Query(id: string) {
  return useQuery(__item__DetailQuery(id));
}
```

```ts
// queries/useCreate__Item__Mutation.ts — narrow invalidation: create → lists() only
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { __item__Api } from "../lib/api";
import { __item__Keys } from "../lib/query-keys";

export function useCreate__Item__Mutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: __item__Api.create,
    onSuccess: (item) => {
      queryClient.setQueryData(__item__Keys.detail(item.id), item); // response has the entity
      return queryClient.invalidateQueries({ queryKey: __item__Keys.lists() });
    },
  });
}
```

```ts
// queries/useDelete__Item__Mutation.ts — delete → lists() + removeQueries(detail(id))
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { notify } from "@/shared/lib/notify";

import { __item__Api } from "../lib/api";
import { __item__Keys } from "../lib/query-keys";

export function useDelete__Item__Mutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: __item__Api.remove,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: __item__Keys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: __item__Keys.lists() });
    },
    onError: () => notify.error("Could not delete. Please try again."),
  });
}
```

Update mutation (when needed): `useUpdate__Item__Mutation.ts` — `detail(id)` via
`setQueryData` + `lists()`; optimistic only where UX needs it (worked example in
`feature-architecture.md`).

```tsx
// components/__Item__Form.tsx — RHF owns state, zod validates, AntD renders (never AntD's Form store)
import { zodResolver } from "@hookform/resolvers/zod";
import { App, Button, Form, Input } from "antd";
import { useForm } from "react-hook-form";

import { FormField } from "@/shared/components/FormField";
import { fieldErrors } from "@/shared/lib/api-error";

import { useCreate__Item__Mutation } from "../queries/useCreate__Item__Mutation";
import { __item__FormSchema, type __Item__FormValues } from "../schemas/__item__.schema";

export type __Item__FormProps = { onCreated?: (id: string) => void };

const defaultValues: __Item__FormValues = { title: "" };

export function __Item__Form({ onCreated }: __Item__FormProps) {
  const { message } = App.useApp();
  const form = useForm<__Item__FormValues>({
    resolver: zodResolver(__item__FormSchema),
    defaultValues,
  });
  const create = useCreate__Item__Mutation();

  function onSubmit(values: __Item__FormValues) {
    create.mutate(values, {
      onSuccess: (item) => {
        form.reset(defaultValues);
        void message.success("Saved");
        onCreated?.(item.id);
      },
      onError: (error) => {
        const errors = Object.entries(fieldErrors(error));
        if (errors.length === 0) {
          void message.error("Could not save. Please try again.");
          return;
        }
        // server validation errors go back into the same form state
        for (const [field, text] of errors) {
          form.setError(field as keyof __Item__FormValues, { type: "server", message: text });
        }
      },
    });
  }

  return (
    // component={false}: AntD layout/context only — RHF's <form> owns submit
    <Form layout="vertical" component={false}>
      <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} noValidate>
        <FormField
          control={form.control}
          name="title"
          label="Title"
          required
          render={(field) => <Input autoComplete="off" {...field} />}
        />
        <Button type="primary" htmlType="submit" loading={create.isPending}>
          Save
        </Button>
      </form>
    </Form>
  );
}
```

```tsx
// components/__Name__List.tsx — AntD Table; every async UI has loading, empty and error states
import { App, Button, Empty, Result, Table, type TableColumnsType } from "antd";

import { useDelete__Item__Mutation } from "../queries/useDelete__Item__Mutation";
import { use__Name__Query } from "../queries/use__Name__Query";

import type { __Item__, __Item__Filters } from "../schemas/__item__.schema";

export type __Name__ListProps = { filters: __Item__Filters };

const VIRTUAL_FROM = 100; // STANDARDS §8: 100+ rows → virtual

export function __Name__List({ filters }: __Name__ListProps) {
  const { modal } = App.useApp();
  const { data, isPending, isError, refetch } = use__Name__Query(filters);
  const remove = useDelete__Item__Mutation();

  if (isError) {
    return (
      <Result
        status="error"
        title="Could not load the list."
        extra={<Button onClick={() => void refetch()}>Try again</Button>}
      />
    );
  }

  const confirmDelete = (item: __Item__) =>
    modal.confirm({
      title: `Delete ${item.title}?`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: () => remove.mutateAsync(item.id),
    });

  const columns: TableColumnsType<__Item__> = [
    { title: "Title", dataIndex: "title" },
    {
      title: "Actions",
      key: "actions",
      align: "end",
      render: (_, item) => (
        <Button
          type="text"
          danger
          aria-label={`Delete ${item.title}`}
          onClick={() => confirmDelete(item)}
        >
          Delete
        </Button>
      ),
    },
  ];
  const rows = data ?? [];
  const isLarge = rows.length >= VIRTUAL_FROM;

  return (
    <Table<__Item__>
      rowKey="id"
      columns={columns}
      dataSource={rows}
      loading={isPending}
      pagination={false} // server pagination: page/size live in the URL filters
      virtual={isLarge}
      scroll={isLarge ? { y: 600 } : undefined}
      locale={{ emptyText: <Empty description="Nothing here yet." /> }}
    />
  );
}
```

```tsx
// components/__Name__Page.tsx — the screen; filters live in the URL
import { Flex, Typography } from "antd";
import { useSearchParams } from "react-router";

import { __item__FiltersSchema } from "../schemas/__item__.schema";
import { __Item__Form } from "./__Item__Form";
import { __Name__List } from "./__Name__List";
import styles from "./__Name__Page.module.scss";

export function __Name__Page() {
  const [searchParams] = useSearchParams();
  const filters = __item__FiltersSchema.parse(Object.fromEntries(searchParams));

  return (
    <main className={styles.page}>
      <title>__Name__</title>
      <Flex vertical gap="large">
        <Typography.Title level={1}>__Name__</Typography.Title>
        <__Item__Form />
        <__Name__List filters={filters} />
      </Flex>
    </main>
  );
}
```

```scss
// components/__Name__Page.module.scss — page layout only; colours/spacing from --ant-* tokens
.page {
  max-width: 1200px; // content width — no token for it
  margin-inline: auto;
  padding: var(--ant-padding-xl) var(--ant-padding-lg);
}
```

```ts
// __name__.store.ts — only for UI state shared across components (never server data)
import { createResettableStore } from "@/shared/stores/create-resettable-store";

type __Name__State = {
  selectedId: string | null;
  select: (id: string | null) => void;
  reset: () => void;
};

const initialState: Pick<__Name__State, "selectedId"> = { selectedId: null };

export const use__Name__Store = createResettableStore<__Name__State>((set) => ({
  ...initialState,
  select: (selectedId) => set({ selectedId }),
  reset: () => set(initialState),
}));
```

Consumers always select: `use__Name__Store((s) => s.selectedId)`.

```ts
// index.ts — public API; export only what other code uses (lib/api.ts stays private)
export { __Name__Page } from "./components/__Name__Page";
export { __item__Keys } from "./lib/query-keys";
export { __item__DetailQuery, use__Item__Query } from "./queries/use__Item__Query";
export { __item__ListQuery, use__Name__Query } from "./queries/use__Name__Query";
export { __item__FiltersSchema } from "./schemas/__item__.schema";
export type { __Item__, __Item__Filters } from "./schemas/__item__.schema";
// store generated: export { use__Name__Store } from "./__name__.store";
```

```tsx
// src/routes/__name__.tsx — thin route module: loader + Component, nothing else
import { withAuth } from "@/app/guards";
import { __item__FiltersSchema, __item__ListQuery, __Name__Page } from "@/features/__name__";
import { queryClient } from "@/shared/lib/query-client";

// withAuth: the route sits in the protected group (react-router-dom.md)
export const loader = withAuth(async ({ request }) => {
  const searchParams = new URL(request.url).searchParams;
  const filters = __item__FiltersSchema.parse(Object.fromEntries(searchParams));
  void queryClient.prefetchQuery(__item__ListQuery(filters)); // list: don't block navigation
  return null;
});

export { __Name__Page as Component };
```

Register it in `src/app/router.tsx` (inside the protected group when it needs a
session): `{ path: "__name__", lazy: () => import("@/routes/__name__") }`.
Add `/__name__` to `e2e/specs/smoke.spec.ts`; core create/edit/delete of the
main entity gets a journey spec (`e2e-playwright.md`). With i18n, load the
`__name__` namespace in the `loader` and replace literals with `t("…")`.

```ts
// src/test/mocks/handlers/__name__.ts — then add ...__camel__Handlers to handlers.ts
import { http, HttpResponse } from "msw";

import type { __Item__ } from "@/features/__name__";

export const __item__Fixture: __Item__ = {
  id: "1",
  title: "First",
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const __camel__Handlers = [
  http.get("*/__name__", () => HttpResponse.json([__item__Fixture])),
  http.post("*/__name__", () =>
    HttpResponse.json({ ...__item__Fixture, id: "2", title: "New" }, { status: 201 }),
  ),
  http.delete("*/__name__/:id", () => new HttpResponse(null, { status: 204 })),
];
```

```tsx
// components/__Item__Form.test.tsx — App.useApp() needs <App> at the call site
import { App } from "antd";
import { http, HttpResponse } from "msw";

import { server } from "@/test/mocks/server";
import { renderWithProviders, screen } from "@/test/test-utils";

import { __Item__Form } from "./__Item__Form";

import type { __Item__FormProps } from "./__Item__Form";

function renderForm(props: __Item__FormProps = {}) {
  return renderWithProviders(
    <App>
      <__Item__Form {...props} />
    </App>,
  );
}

describe("__Item__Form", () => {
  it("shows the schema message for an empty title", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });

  it("creates the item and reports its id", async () => {
    const onCreated = vi.fn();
    const { user } = renderForm({ onCreated });
    await user.type(screen.getByLabelText("Title"), "New");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("2"));
  });

  it("puts server field errors into the form", async () => {
    server.use(
      http.post("*/__name__", () =>
        HttpResponse.json(
          { message: "Invalid", errors: { title: "Already exists" } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderForm();
    await user.type(screen.getByLabelText("Title"), "Duplicate");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Already exists")).toBeInTheDocument();
  });
});
```

```ts
// __name__.store.test.ts
import { resetAllStores } from "@/shared/stores/create-resettable-store";

import { use__Name__Store } from "./__name__.store";

describe("use__Name__Store", () => {
  it("selects an item and is cleared by resetAllStores() on logout", () => {
    use__Name__Store.getState().select("1");
    expect(use__Name__Store.getState().selectedId).toBe("1");
    resetAllStores();
    expect(use__Name__Store.getState().selectedId).toBeNull();
  });
});
```

`__Name__List` gets a test too, rendered inside `<App>` (success, empty via
`server.use(... [])` → "Nothing here yet.", error via a 500 handler → "Try
again" button; query rows by role `row`/`cell`, never by AntD class names),
same shape as the widget test in `slices.md`. Commit scope = the feature
folder: `feat(__name__): add __item__ list`.
