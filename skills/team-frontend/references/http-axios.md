# HTTP — axios on the client, typed `fetch` on the Next.js server

## Files

```
shared/config/
  env.ts             # browser-safe env (zod), mode-neutral `env.API_URL`
  env.server.ts      # server-only env (Next): `serverEnv.API_URL`, secrets
shared/api/
  http.ts            # axios instance + interceptors (client only)
  http.server.ts     # serverFetch<T>() for RSC / Server Actions / route handlers (Next only)
  api-error.ts       # ApiError + createApiError (no axios import — shared by both)
  token.ts           # access token in memory (module variable)
  index.ts           # client public API — never re-exports http.server.ts
entities/session/    # Zustand store mirroring auth state (user, status), logout
```

`antd-scss-react-router` profile: `shared/lib/{env,http-client,auth-http-client,api-error,token}.ts`
and `shared/stores/auth.store.ts` instead (see the `antd-scss-react-router` profile subsection below).

- Client feature code imports `http` from `@/shared/api` (`antd-scss-react-router` profile:
  `httpClient` from `@/shared/lib/http-client`) — never `axios` directly.
- Next server code imports `serverFetch` from `@/shared/api/http.server` —
  **never `axios`, never `http`** (no axios in RSC, Server Actions, route
  handlers or `proxy.ts`).

| Where the code runs | Client | Why |
| --- | --- | --- |
| Browser (both modes) | `http` (axios) | interceptors, single-flight refresh |
| Next RSC / Server Action / route handler | `serverFetch` (fetch) | request memoization, `"use cache"`, `revalidate`, cache tags only work with `fetch` |

## Env — mode-neutral base URL

```ts
// shared/config/env.ts — browser-safe values only
import { z } from "zod";

const EnvSchema = z.object({ API_URL: z.string().url() });

// Next.js:  API_URL: process.env.NEXT_PUBLIC_API_URL  (literal access, inlined at build)
// React/Vite: API_URL: import.meta.env.VITE_API_URL
export const env = EnvSchema.parse({
  API_URL: process.env.NEXT_PUBLIC_API_URL,
});
```

```ts
// shared/config/env.server.ts — Next only
import "server-only";
import { z } from "zod";

export const serverEnv = z
  .object({ API_URL: z.string().url() }) // no trailing slash
  .parse({ API_URL: process.env.API_URL });
```

Code always reads `env.API_URL` / `serverEnv.API_URL`; only `env.ts` knows the
mode-specific variable name. Anything prefixed `NEXT_PUBLIC_` / `VITE_` is
shipped to the browser — never put secrets there (see `security.md`).

## Token strategy

- **Access token**: short-lived, **in memory only** — a module variable in
  `shared/api/token.ts`. It is not in Zustand, not persisted, not in any storage.
- **Session entity** (`entities/session`): a Zustand store that **mirrors auth
  state** for the UI (`user`, `status: 'unknown' | 'authenticated' | 'anonymous'`).
  It never holds the token itself.
- **Refresh token**: `httpOnly; Secure` cookie set and read by the backend only.
  JS never sees it. `SameSite` per the cookie rules below.
- On page load the app calls `/auth/refresh` once to obtain an access token.
- Never store tokens in `localStorage`/`sessionStorage`.

## `shared/api/token.ts`

```ts
type TokenListener = () => void;

let accessToken: string | null = null;
let onLogout: TokenListener = () => {};

export const tokenStorage = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  setLogoutHandler: (fn: TokenListener) => {
    onLogout = fn;
  },
  logout: () => {
    accessToken = null;
    onLogout();
  },
};
```

`shared` must not import from `entities`, so the logout handler is registered
from above — the app layer wires it once at startup. The handler runs the full
logout sequence (`state-data.md` → "Root auth/session store + logout
sequence"): token cleared, session store reset, **`resetAllStores()`**,
**`queryClient.clear()`**, redirect to login.

```ts
// app/init-auth.ts — runs once before the router renders (antd-scss-react-router profile: src/app/init-auth.ts)
import { tokenStorage } from "@/shared/api/token";
import { useSessionStore } from "@/entities/session";
import { router } from "./router";

tokenStorage.setLogoutHandler(() => {
  // session logout = token null + session reset + resetAllStores() + queryClient.clear()
  useSessionStore.getState().logout();
  void router.navigate({ to: "/login" }); // React Router: router.navigate("/login")
});
```

User-initiated logout calls the backend logout endpoint (clears the refresh
cookie) and then `tokenStorage.logout()`, so both paths — button and failed
refresh — end in the same handler. Next.js: the client `SessionProvider`
registers the handler (effect justified: sync with the token module) and runs
`resetAllStores()`, `getQueryClient().clear()` and `router.replace("/login")`
(`useRouter` from `next/navigation`).

## `shared/api/http.ts` (client)

```ts
import axios, { isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";
import { env } from "@/shared/config/env";
import { tokenStorage } from "./token";
import { ApiError, createApiError } from "./api-error";

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const REFRESH_URL = "/auth/refresh";

export const http = axios.create({
  baseURL: env.API_URL,
  withCredentials: true, // send refresh cookie
  timeout: 15_000,
});

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    return error.response
      ? createApiError(error.response.status, error.response.data, error.message)
      : new ApiError(error.message, null, error.code);
  }
  return new ApiError("Unexpected error", null);
}

http.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // single-flight: all concurrent 401s await the same promise
  // bare axios (not `http`) → the refresh request never passes through these interceptors
  refreshPromise ??= axios
    .post<{ accessToken: string }>(REFRESH_URL, null, {
      baseURL: env.API_URL,
      withCredentials: true,
    })
    .then(({ data }) => {
      tokenStorage.set(data.accessToken);
      return data.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function rejectWithApiError(error: unknown): Promise<never> {
  const apiError = toApiError(error);
  if (apiError.status !== null && apiError.status >= 500) {
    // the ONLY place a 5xx is toasted; fixed id → Query retries don't stack toasts
    toast.error("Something went wrong on our side. Please try again.", { id: "server-error" });
  }
  return Promise.reject(apiError);
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const isUnauthorized = error.response?.status === 401;
    const isRefreshCall = original?.url?.includes(REFRESH_URL);

    if (!original || !isUnauthorized || isRefreshCall || original._retry) {
      return rejectWithApiError(error);
    }

    original._retry = true;
    try {
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return http(original);
    } catch (refreshError) {
      tokenStorage.logout(); // → logout handler: resetAllStores(), queryClient.clear(), redirect
      return Promise.reject(toApiError(refreshError));
    }
  },
);
```

Why this shape:

- **Single-flight** via shared `refreshPromise` — N parallel 401s → 1 refresh;
  if it fails, every waiting request rejects (none stays pending forever).
- Refresh uses bare `axios`, not `http` → no interceptor recursion. This is
  how STANDARDS §6 "the refresh request itself is excluded from the
  interceptor" is met; a dedicated interceptor-less instance
  (`antd-scss-react-router` profile, below) is an equivalent way to meet it.
- `_retry` → each request retried at most once.
- Refresh failure → logout handler (full logout sequence), all waiting requests reject.
- **5xx toasts live only here** — components, query hooks and mutations don't
  toast server errors again (they show 4xx/domain messages: inline form errors,
  specific toasts). Multi-locale products take the message from `i18n.t(...)`;
  `antd-scss-react-router` projects call the AntD `notify` bridge
  (`shared/lib/notify.ts`, `ui-antd-scss.md`) instead of `sonner` (see the
  profile subsection below).

### `antd-scss-react-router` profile: `shared/lib/http-client.ts` + `shared/lib/auth-http-client.ts`

Same rules, same interceptor logic — different paths and names:

| FSD (`shared/api/…`) | `antd-scss-react-router` profile |
| --- | --- |
| `http.ts` → `http` | `shared/lib/http-client.ts` → `httpClient` (the single business instance) |
| bare `axios.post` inside `refreshAccessToken` | `shared/lib/auth-http-client.ts` → bare instance + `refreshAccessToken()` |
| `api-error.ts`, `token.ts` | `shared/lib/api-error.ts`, `shared/lib/token.ts` |
| `shared/config/env.ts` | `shared/lib/env.ts` |
| `entities/session` | `shared/stores/auth.store.ts` |
| 5xx: `toast.error(…)` from `sonner` | `notify.error(…)` from `./notify` (AntD bridge, `ui-antd-scss.md`) |

```ts
// shared/lib/auth-http-client.ts
import axios from "axios";
import { env } from "./env";

// NO interceptors on this instance: a 401 from /auth/refresh can never loop back into refresh.
// Used ONLY by refreshAccessToken() — never for business requests.
const authHttpClient = axios.create({
  baseURL: env.API_URL,
  withCredentials: true, // refresh cookie
  timeout: 15_000,
});

export async function refreshAccessToken(): Promise<string> {
  const { data } = await authHttpClient.post<{ accessToken: string }>("/auth/refresh");
  return data.accessToken;
}
```

```ts
// shared/lib/http-client.ts — the only difference from shared/api/http.ts above
import { refreshAccessToken as requestNewToken } from "./auth-http-client";

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  refreshPromise ??= requestNewToken() // single-flight stays in http-client.ts
    .then((token) => {
      tokenStorage.set(token);
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
// export const httpClient = axios.create(...) with the same request/response interceptors
// and toApiError as in shared/api/http.ts; only rejectWithApiError differs (below)
```

```ts
// shared/lib/http-client.ts — 5xx message via the AntD notify bridge (no sonner in this profile)
import { notify } from "./notify";

function rejectWithApiError(error: unknown): Promise<never> {
  const apiError = toApiError(error);
  if (apiError.status !== null && apiError.status >= 500) {
    // the ONLY place a 5xx is shown; <NotifyBridge /> inside AntD <App> registers the instance
    notify.error("Something went wrong on our side. Please try again.", "server-error");
  }
  return Promise.reject(apiError);
}
```

- `httpClient` is the only instance feature code uses
  (`features/<domain>/lib/api.ts` imports it); the auth instance is not
  exported. ESLint `no-restricted-imports` allows `axios` only in these two files.
- The refresh request is excluded from the interceptor by construction (it
  runs on another instance), which satisfies STANDARDS §6. Keep the
  `isRefreshCall` guard anyway — it costs nothing if someone calls refresh
  through `httpClient`.
- Both forms are acceptable in both SPA profiles: new `antd-scss-react-router` projects use
  the separate `auth-http-client.ts`; FSD projects keep the in-file bare call
  so `shared/api/http.ts` stays the single configured instance (STANDARDS §6).
- Next.js is unchanged: browser code uses `http`, server code `serverFetch`.

## `shared/api/api-error.ts` (shared, no axios)

```ts
type ErrorBody = { message?: string; code?: string };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number | null,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiError(status: number, body: unknown, fallback: string): ApiError {
  const b = (typeof body === "object" && body !== null ? body : {}) as ErrorBody;
  return new ApiError(b.message ?? fallback, status, b.code, body);
}
```

Both clients throw the **same `ApiError`**, so UI error handling doesn't care
where the request ran.

## Next.js server — `shared/api/http.server.ts`

Next's request memoization, `"use cache"`, `next.revalidate` and cache tags
hook into the global `fetch`. axios (XHR/`http` adapter) bypasses all of them,
so server code uses this thin typed wrapper instead.

```ts
import "server-only";
import { cookies } from "next/headers";
import type { ZodType } from "zod";
import { serverEnv } from "@/shared/config/env.server";
import { ApiError, createApiError } from "./api-error";

export type ServerFetchInit<T> = Omit<RequestInit, "body"> & {
  next?: { revalidate?: number | false; tags?: string[] };
  /** forward the user's cookies (default true). Must be false inside "use cache". */
  auth?: boolean;
  /** JSON body; sets Content-Type */
  json?: unknown;
  /** validate + type the response */
  schema?: ZodType<T>;
  /** opt-in; a signal disables request memoization, so use it for mutations only */
  timeoutMs?: number;
};

export async function serverFetch<T>(path: string, init: ServerFetchInit<T> = {}): Promise<T> {
  const { auth = true, json, schema, timeoutMs, headers, ...rest } = init;

  const h = new Headers(headers);
  h.set("Accept", "application/json");
  if (json !== undefined) h.set("Content-Type", "application/json");
  if (auth) {
    const cookieHeader = (await cookies()).toString();
    if (cookieHeader) h.set("Cookie", cookieHeader);
  }

  let res: Response;
  try {
    res = await fetch(`${serverEnv.API_URL}${path}`, {
      ...rest,
      headers: h,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: rest.signal ?? (timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined),
    });
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : "Network error", null);
  }

  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!res.ok) throw createApiError(res.status, body, res.statusText);
  if (!schema) return body as T;

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      "Unexpected response shape",
      res.status,
      "INVALID_RESPONSE",
      parsed.error.issues,
    );
  }
  return parsed.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
```

Rules:

- **No token refresh on the server.** `proxy.ts` redirects to login when the
  session cookie is missing; a 401 from `serverFetch` → `redirect('/login')`
  in the view. If the backend requires a Bearer on the server, exchange the
  cookie in a BFF route handler — still via `serverFetch`.
- `auth: true` calls `cookies()` → the caller becomes dynamic (per request).
  **Never** cache a response fetched with the user's cookies in a shared cache.
- Inside `"use cache"` you cannot read `cookies()` — pass `auth: false` and
  only fetch public data there.

### Server API functions + caching

```ts
// entities/product/api/product.server.ts
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { serverFetch } from "@/shared/api/http.server";
import { ProductListSchema, ProductSchema } from "../model/schema";

// Cache Components (Next 16 default): cached, shared, public data
export async function getProducts() {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  return serverFetch("/products", { auth: false, schema: ProductListSchema });
}

// Without Cache Components: fetch-level cache options
export const getProduct = (id: string) =>
  serverFetch(`/products/${id}`, {
    auth: false,
    schema: ProductSchema,
    next: { revalidate: 3600, tags: ["products", `product:${id}`] },
  });

// User-specific (e.g. entities/order/api/order.server.ts): per request, memoized within the render
// export const getMyOrders = () => serverFetch('/me/orders', { schema: OrderListSchema })
```

```ts
// features/edit-product/api/update-product.action.ts
"use server";
import { updateTag } from "next/cache";
import { serverFetch } from "@/shared/api/http.server";
import { UpdateProductSchema } from "../model/schema";

export async function updateProduct(id: string, input: unknown) {
  const data = UpdateProductSchema.parse(input); // + auth check, see security.md
  await serverFetch(`/products/${id}`, { method: "PATCH", json: data, timeoutMs: 15_000 });
  updateTag(`product:${id}`); // read-your-writes in this action
  // elsewhere (webhook/route handler): revalidateTag('products', 'max')
}
```

Two GET `serverFetch` calls with the same URL and options in one render are
**deduped** by Next request memoization — call the API function where you need
the data instead of prop-drilling it.

## Client API functions (entity/feature `api/` segment; `antd-scss-react-router` profile: `features/<domain>/lib/api.ts`)

```ts
// entities/product/api/product.api.ts
import { http } from "@/shared/api";
import type { Product } from "../model/types";

export const productApi = {
  list: (params: { page: number }) =>
    http.get<Product[]>("/products", { params }).then((r) => r.data),
  byId: (id: string) => http.get<Product>(`/products/${id}`).then((r) => r.data),
};
```

Always return `data`, typed, and accept an optional `{ signal }` that query
functions pass through to axios (`state-data.md` → "Query options + `signal`"). Validate with zod (`ProductSchema.parse`) when the
backend contract is unstable. In Next, a slice that reads on both sides has
`product.api.ts` (client, axios) and `product.server.ts` (server, `serverFetch`)
sharing the same zod schemas and query keys.

## Cookies — `SameSite` and CSRF

Decide by whether the **app origin and API origin are same-site** (same
registrable domain, e.g. `app.example.com` + `api.example.com`):

| Setup | Refresh cookie | CSRF |
| --- | --- | --- |
| Same-site (or API behind the app origin) | `httpOnly; Secure; SameSite=Strict` (`Lax` if you need top-level navigation from other sites to arrive logged in) | SameSite is the main defence; still require a CSRF token or `Origin` check on cookie-auth mutations |
| Cross-site API — **preferred** | Put a **BFF / route-handler proxy on the app origin** (`app/api/[...path]/route.ts` → `serverFetch`), so the browser only talks same-site; then use the row above | as above |
| Cross-site API — direct | `httpOnly; Secure; SameSite=None` + backend CORS allow-list with credentials | **mandatory** CSRF token (double-submit or synchronizer) on every state-changing request |

`SameSite=Strict` on a cross-site API means the cookie is **never sent** —
refresh silently fails. Details and the CSRF header pattern: `security.md`.

## Required tests (see `testing-vitest.md`)

Client (`http.ts` / `antd-scss-react-router`: `http-client.ts`):

1. Attaches bearer token.
2. 401 → refresh → original request retried with new token.
3. Two parallel 401s → exactly one refresh call.
4. Refresh fails → `logout` called, request rejects with `ApiError`.
5. 401 from the refresh endpoint itself → no loop.

Also assert: a 5xx shows exactly one toast (`antd-scss-react-router`: one
`notify.error` call) and rejects with `ApiError`; a 4xx shows none.

Server (`http.server.ts`, MSW + mocked `next/headers`):

6. Forwards the `Cookie` header when `auth` is true, omits it when false.
7. Non-2xx → `ApiError` with status/code from the body.
8. Schema mismatch → `ApiError` with code `INVALID_RESPONSE`.
