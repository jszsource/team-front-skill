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

- Client feature code imports `http` from `@/shared/api` — never `axios` directly.
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
import { z } from 'zod'

const EnvSchema = z.object({ API_URL: z.string().url() })

// Next.js:  API_URL: process.env.NEXT_PUBLIC_API_URL  (literal access, inlined at build)
// React/Vite: API_URL: import.meta.env.VITE_API_URL
export const env = EnvSchema.parse({
  API_URL: process.env.NEXT_PUBLIC_API_URL,
})
```

```ts
// shared/config/env.server.ts — Next only
import 'server-only'
import { z } from 'zod'

export const serverEnv = z
  .object({ API_URL: z.string().url() }) // no trailing slash
  .parse({ API_URL: process.env.API_URL })
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
type TokenListener = () => void

let accessToken: string | null = null
let onLogout: TokenListener = () => {}

export const tokenStorage = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token
  },
  setLogoutHandler: (fn: TokenListener) => {
    onLogout = fn
  },
  logout: () => {
    accessToken = null
    onLogout()
  },
}
```

The session entity calls `tokenStorage.setLogoutHandler` to reset its store
(`status: 'anonymous'`) and redirect — `shared` must not import from `entities`.

## `shared/api/http.ts` (client)

```ts
import axios, { AxiosError, isAxiosError, type InternalAxiosRequestConfig } from 'axios'
import { env } from '@/shared/config/env'
import { tokenStorage } from './token'
import { ApiError, createApiError } from './api-error'

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const REFRESH_URL = '/auth/refresh'

export const http = axios.create({
  baseURL: env.API_URL,
  withCredentials: true, // send refresh cookie
  timeout: 15_000,
})

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    return error.response
      ? createApiError(error.response.status, error.response.data, error.message)
      : new ApiError(error.message, null, error.code)
  }
  return new ApiError('Unexpected error', null)
}

http.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  // single-flight: all concurrent 401s await the same promise
  refreshPromise ??= axios
    .post<{ accessToken: string }>(REFRESH_URL, null, {
      baseURL: env.API_URL,
      withCredentials: true,
    })
    .then(({ data }) => {
      tokenStorage.set(data.accessToken)
      return data.accessToken
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const isUnauthorized = error.response?.status === 401
    const isRefreshCall = original?.url?.includes(REFRESH_URL)

    if (!original || !isUnauthorized || isRefreshCall || original._retry) {
      return Promise.reject(toApiError(error))
    }

    original._retry = true
    try {
      const token = await refreshAccessToken()
      original.headers.Authorization = `Bearer ${token}`
      return http(original)
    } catch (refreshError) {
      tokenStorage.logout()
      return Promise.reject(toApiError(refreshError))
    }
  },
)
```

Why this shape:

- **Single-flight** via shared `refreshPromise` — N parallel 401s → 1 refresh.
- Refresh uses bare `axios`, not `http` → no interceptor recursion.
- `_retry` → each request retried at most once.
- Refresh failure → logout handler, all waiting requests reject.

## `shared/api/api-error.ts` (shared, no axios)

```ts
type ErrorBody = { message?: string; code?: string }

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number | null,
    public code?: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function createApiError(status: number, body: unknown, fallback: string): ApiError {
  const b = (typeof body === 'object' && body !== null ? body : {}) as ErrorBody
  return new ApiError(b.message ?? fallback, status, b.code, body)
}
```

Both clients throw the **same `ApiError`**, so UI error handling doesn't care
where the request ran.

## Next.js server — `shared/api/http.server.ts`

Next's request memoization, `"use cache"`, `next.revalidate` and cache tags
hook into the global `fetch`. axios (XHR/`http` adapter) bypasses all of them,
so server code uses this thin typed wrapper instead.

```ts
import 'server-only'
import { cookies } from 'next/headers'
import type { ZodType } from 'zod'
import { serverEnv } from '@/shared/config/env.server'
import { ApiError, createApiError } from './api-error'

export type ServerFetchInit<T> = Omit<RequestInit, 'body'> & {
  next?: { revalidate?: number | false; tags?: string[] }
  /** forward the user's cookies (default true). Must be false inside "use cache". */
  auth?: boolean
  /** JSON body; sets Content-Type */
  json?: unknown
  /** validate + type the response */
  schema?: ZodType<T>
  /** opt-in; a signal disables request memoization, so use it for mutations only */
  timeoutMs?: number
}

export async function serverFetch<T>(path: string, init: ServerFetchInit<T> = {}): Promise<T> {
  const { auth = true, json, schema, timeoutMs, headers, ...rest } = init

  const h = new Headers(headers)
  h.set('Accept', 'application/json')
  if (json !== undefined) h.set('Content-Type', 'application/json')
  if (auth) {
    const cookieHeader = (await cookies()).toString()
    if (cookieHeader) h.set('Cookie', cookieHeader)
  }

  let res: Response
  try {
    res = await fetch(`${serverEnv.API_URL}${path}`, {
      ...rest,
      headers: h,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: rest.signal ?? (timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined),
    })
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : 'Network error', null)
  }

  const text = await res.text()
  const body: unknown = text ? safeJson(text) : null
  if (!res.ok) throw createApiError(res.status, body, res.statusText)
  if (!schema) return body as T

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError('Unexpected response shape', res.status, 'INVALID_RESPONSE', parsed.error.issues)
  }
  return parsed.data
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
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
import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { serverFetch } from '@/shared/api/http.server'
import { ProductListSchema, ProductSchema } from '../model/schema'

// Cache Components (Next 16 default): cached, shared, public data
export async function getProducts() {
  'use cache'
  cacheTag('products')
  cacheLife('hours')
  return serverFetch('/products', { auth: false, schema: ProductListSchema })
}

// Without Cache Components: fetch-level cache options
export const getProduct = (id: string) =>
  serverFetch(`/products/${id}`, {
    auth: false,
    schema: ProductSchema,
    next: { revalidate: 3600, tags: ['products', `product:${id}`] },
  })

// User-specific (e.g. entities/order/api/order.server.ts): per request, memoized within the render
// export const getMyOrders = () => serverFetch('/me/orders', { schema: OrderListSchema })
```

```ts
// features/edit-product/api/update-product.action.ts
'use server'
import { updateTag } from 'next/cache'
import { serverFetch } from '@/shared/api/http.server'
import { UpdateProductSchema } from '../model/schema'

export async function updateProduct(id: string, input: unknown) {
  const data = UpdateProductSchema.parse(input) // + auth check, see security.md
  await serverFetch(`/products/${id}`, { method: 'PATCH', json: data, timeoutMs: 15_000 })
  updateTag(`product:${id}`) // read-your-writes in this action
  // elsewhere (webhook/route handler): revalidateTag('products', 'max')
}
```

Two GET `serverFetch` calls with the same URL and options in one render are
**deduped** by Next request memoization — call the API function where you need
the data instead of prop-drilling it.

## Client API functions (entity/feature `api/` segment)

```ts
// entities/product/api/product.api.ts
import { http } from '@/shared/api'
import type { Product } from '../model/types'

export const productApi = {
  list: (params: { page: number }) =>
    http.get<Product[]>('/products', { params }).then((r) => r.data),
  byId: (id: string) => http.get<Product>(`/products/${id}`).then((r) => r.data),
}
```

Always return `data`, typed. Validate with zod (`ProductSchema.parse`) when the
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

Client (`http.ts`):

1. Attaches bearer token.
2. 401 → refresh → original request retried with new token.
3. Two parallel 401s → exactly one refresh call.
4. Refresh fails → `logout` called, request rejects with `ApiError`.
5. 401 from the refresh endpoint itself → no loop.

Server (`http.server.ts`, MSW + mocked `next/headers`):

6. Forwards the `Cookie` header when `auth` is true, omits it when false.
7. Non-2xx → `ApiError` with status/code from the body.
8. Schema mismatch → `ApiError` with code `INVALID_RESPONSE`.
