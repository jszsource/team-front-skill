# HTTP — axios with token-refresh interceptor

## Files

```
shared/api/
  http.ts            # axios instance + interceptors (client)
  http.server.ts     # server instance for RSC / Server Actions (Next only)
  api-error.ts       # ApiError normalisation
  token.ts           # access-token accessors (backed by session store)
  index.ts
entities/session/    # session store (access token in memory), logout
```

Feature code imports `http` from `@/shared/api` — never `axios` directly.

## Token strategy

- **Access token**: short-lived, kept **in memory** (Zustand, not persisted).
- **Refresh token**: `httpOnly; Secure; SameSite=Strict` cookie, set and read
  by the backend only. JS never sees it.
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

(The session entity calls `tokenStorage.setLogoutHandler` to clear its store
and redirect — `shared` must not import from `entities`.)

## `shared/api/http.ts`

```ts
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { env } from '@/shared/config/env'
import { tokenStorage } from './token'
import { toApiError } from './api-error'

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const REFRESH_URL = '/auth/refresh'

export const http = axios.create({
  baseURL: env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // send refresh cookie
  timeout: 15_000,
})

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
      baseURL: env.NEXT_PUBLIC_API_URL,
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

## `shared/api/api-error.ts`

```ts
import { isAxiosError } from 'axios'

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

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError<{ message?: string; code?: string }>(error)) {
    return new ApiError(
      error.response?.data?.message ?? error.message,
      error.response?.status ?? null,
      error.response?.data?.code,
      error.response?.data,
    )
  }
  return new ApiError('Unexpected error', null)
}
```

## Next.js server instance — `shared/api/http.server.ts`

```ts
import 'server-only'
import axios from 'axios'
import { cookies } from 'next/headers'
import { env } from '@/shared/config/env'

export async function serverHttp() {
  const cookieHeader = (await cookies()).toString()
  return axios.create({
    baseURL: env.API_URL,
    headers: { Cookie: cookieHeader },
    timeout: 15_000,
  })
}
```

Server code doesn't refresh tokens; `proxy.ts` redirects to login when the
session cookie is missing. If the backend requires a Bearer on the server, add
a BFF route that exchanges the cookie.

## API functions (entity/feature `api/` segment)

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
backend contract is unstable.

## Required tests (see `testing-vitest.md`)

1. Attaches bearer token.
2. 401 → refresh → original request retried with new token.
3. Two parallel 401s → exactly one refresh call.
4. Refresh fails → `logout` called, request rejects with `ApiError`.
5. 401 from the refresh endpoint itself → no loop.
