# FSD slice templates

Placeholders: `__name__` (kebab), `__Name__` (Pascal), `__camel__` (camel).
All paths are relative to `src/`. Generate only the segments the slice needs —
an empty `lib/` or `config/` is not created.

Cross-cutting rules for every template below:

- **Next server code** (async Server Components, Server Actions, route
  handlers) reads/writes through the slice's `api/*.server.ts` /
  `*.action.ts` built on `serverFetch` (`@/shared/api/http.server`) — never
  `http`/axios. Client code uses `http` from `@/shared/api`.
- **i18n**: if `package.json` has `next-intl` or `react-i18next`, every
  user-facing literal below (`'Saving…'`, `'Done'`, `'Try again'`, headings,
  `aria-label`, `alt`, `placeholder`, toasts, zod messages) becomes `t('key')`
  from the slice's namespace (`getTranslations` in Server Components,
  `useTranslations`/`useTranslation` in client leaves); add the keys to the
  default-locale messages and `// TODO` the other locales
  (`../team-frontend/references/i18n.md`). Use logical Tailwind utilities
  (`ms-*`, `pe-*`, `text-start`).
- **Boolean props**: state booleans (`disabled`, `open`, `checked`,
  `loading`, `readOnly`, `invalid`) are fine; no layout/behaviour-mode
  booleans (`isCompact`, `withHeader`, `isAdmin`) — use a `cva` variant,
  composition or a separate component (`../team-frontend/references/components.md`).

---

## Entity — `entities/__name__/`

```
entities/__name__/
├── api/
│   ├── __camel__.api.ts         # client (axios `http`)
│   ├── __camel__.queries.ts
│   ├── __camel__.api.test.ts
│   ├── __camel__.server.ts      # Next only — serverFetch, same zod schema
│   └── __camel__.server.test.ts # Next only
├── model/
│   └── types.ts
├── ui/
│   ├── __Name__Card.tsx
│   ├── __Name__Card.test.tsx
│   └── __Name__CardSkeleton.tsx
└── index.ts
```

```ts
// model/types.ts
import { z } from 'zod'

export const __Name__Schema = z.object({
  id: z.string(),
  name: z.string(), // TODO: real fields
  createdAt: z.string(), // ISO string — serialisable across the RSC boundary
})

export type __Name__ = z.infer<typeof __Name__Schema>
```

```ts
// api/__camel__.api.ts
import { http } from '@/shared/api'
import { __Name__Schema, type __Name__ } from '../model/types'

export const __camel__Api = {
  list: (params: { page: number }) =>
    http
      .get<__Name__[]>('/__name__s', { params })
      .then((r) => __Name__Schema.array().parse(r.data)),
  byId: (id: string) =>
    http.get<__Name__>(`/__name__s/${id}`).then((r) => __Name__Schema.parse(r.data)),
}
```

```ts
// api/__camel__.queries.ts
import { queryOptions } from '@tanstack/react-query'
import { __camel__Api } from './__camel__.api'

export const __camel__Keys = {
  all: ['__name__s'] as const,
  lists: () => [...__camel__Keys.all, 'list'] as const,
  list: (page: number) => [...__camel__Keys.lists(), { page }] as const,
  detail: (id: string) => [...__camel__Keys.all, 'detail', id] as const,
}

export const __camel__ListQuery = (page = 1) =>
  queryOptions({ queryKey: __camel__Keys.list(page), queryFn: () => __camel__Api.list({ page }) })

export const __camel__DetailQuery = (id: string) =>
  queryOptions({ queryKey: __camel__Keys.detail(id), queryFn: () => __camel__Api.byId(id) })
```

```ts
// api/__camel__.server.ts — Next only: server reads via serverFetch, never axios
import 'server-only'
import { serverFetch } from '@/shared/api/http.server'
import { __Name__Schema } from '../model/types'

// Per request with the user's cookies (memoized within one render).
// Public, shareable data instead: add 'use cache' + cacheTag('__name__s') +
// cacheLife('hours') in an async function and pass { auth: false } (nextjs.md §4).
export const get__Name__s = (page = 1) =>
  serverFetch(`/__name__s?page=${page}`, { schema: __Name__Schema.array() })

export const get__Name__ = (id: string) =>
  serverFetch(`/__name__s/${encodeURIComponent(id)}`, { schema: __Name__Schema })
```

Server functions are imported by path
(`@/entities/__name__/api/__camel__.server`) from server code only; `index.ts`
never re-exports them, so client bundles never see `server-only`.

```tsx
// ui/__Name__Card.tsx — presentational, server-safe (no hooks)
import { Card, CardHeader, CardTitle } from '@/shared/ui/card'
import type { __Name__ } from '../model/types'

type __Name__CardProps = { __camel__: __Name__; children?: React.ReactNode }

export function __Name__Card({ __camel__, children }: __Name__CardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{__camel__.name}</CardTitle>
      </CardHeader>
      {children}
    </Card>
  )
}
```

```tsx
// ui/__Name__CardSkeleton.tsx
import { Skeleton } from '@/shared/ui/skeleton'

export function __Name__CardSkeleton() {
  return <Skeleton className="h-24 w-full rounded-xl" aria-hidden />
}
```

```ts
// index.ts — public API
export type { __Name__ } from './model/types'
export { __Name__Schema } from './model/types'
export { __camel__Api } from './api/__camel__.api'
export { __camel__Keys, __camel__ListQuery, __camel__DetailQuery } from './api/__camel__.queries'
export { __Name__Card } from './ui/__Name__Card'
export { __Name__CardSkeleton } from './ui/__Name__CardSkeleton'
```

```ts
// api/__camel__.api.test.ts
import { http as mswHttp, HttpResponse } from 'msw'
import { server } from '@/shared/config/tests/msw/server'
import { __camel__Api } from './__camel__.api'

const item = { id: '1', name: 'First', createdAt: '2026-01-01T00:00:00.000Z' }

describe('__camel__Api', () => {
  it('returns a parsed list', async () => {
    server.use(mswHttp.get('*/__name__s', () => HttpResponse.json([item])))
    await expect(__camel__Api.list({ page: 1 })).resolves.toEqual([item])
  })

  it('rejects with ApiError on 500', async () => {
    server.use(mswHttp.get('*/__name__s/1', () => new HttpResponse(null, { status: 500 })))
    await expect(__camel__Api.byId('1')).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})
```

```ts
// api/__camel__.server.test.ts — Next only
import { http as mswHttp, HttpResponse } from 'msw'
import { server } from '@/shared/config/tests/msw/server'
import { get__Name__s } from './__camel__.server'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ toString: () => 'sid=1' }) }))
vi.mock('@/shared/config/env.server', () => ({ serverEnv: { API_URL: 'http://api.test' } }))

it('forwards cookies and parses the list', async () => {
  const item = { id: '1', name: 'First', createdAt: '2026-01-01T00:00:00.000Z' }
  server.use(
    mswHttp.get('http://api.test/__name__s', ({ request }) =>
      request.headers.get('cookie') === 'sid=1'
        ? HttpResponse.json([item])
        : new HttpResponse(null, { status: 401 }),
    ),
  )
  await expect(get__Name__s()).resolves.toEqual([item])
})
```

```tsx
// ui/__Name__Card.test.tsx
import { render, screen } from '@testing-library/react'
import { __Name__Card } from './__Name__Card'

it('shows the name', () => {
  render(<__Name__Card __camel__={{ id: '1', name: 'First', createdAt: '' }} />)
  expect(screen.getByText('First')).toBeInTheDocument()
})
```

---

## Feature — `features/__name__/`

Pick the variant from the user's answer.

### A. Mutation feature (button / form against the API)

```
features/__name__/
├── api/
│   └── use__Name__Mutation.ts
├── model/
│   └── schema.ts            # only for forms
├── ui/
│   ├── __Name__Button.tsx   # or __Name__Form.tsx
│   └── __Name__Button.test.tsx
└── index.ts
```

```ts
// api/use__Name__Mutation.ts — client mutation via axios `http` (both modes)
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/shared/api'
import { __entity__Keys } from '@/entities/__entity-name__'

type __Name__Input = { id: string } // TODO: real payload

export function use__Name__Mutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: __Name__Input) =>
      http.post('/__entity-name__s/__name__', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: __entity__Keys.lists() }),
  })
}
```

```tsx
// ui/__Name__Button.tsx
'use client' // Next only

import { Button } from '@/shared/ui/button'
import { use__Name__Mutation } from '../api/use__Name__Mutation'

type __Name__ButtonProps = { id: string }

export function __Name__Button({ id }: __Name__ButtonProps) {
  const { mutate, isPending, isSuccess, isError } = use__Name__Mutation()

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => mutate({ id })} disabled={isPending} aria-busy={isPending}>
        {isPending ? 'Saving…' : '__Name__'}
      </Button>
      <span aria-live="polite" className="text-sm text-muted-foreground">
        {isSuccess && 'Done'}
        {isError && 'Something went wrong'}
      </span>
    </div>
  )
}
```

Form variant: `model/schema.ts` with a zod schema, `ui/__Name__Form.tsx` with
shadcn `Form` + react-hook-form + `zodResolver`.

#### Next — Server Action variant (forms posting to our backend)

Files: `api/__camel__.action.ts` + `ui/__Name__Form.tsx` (replace the
mutation hook and button). A Server Action is a **public POST endpoint**:
it authenticates, authorises and zod-validates itself
(`../team-frontend/references/security.md` §5).

```ts
// api/__camel__.action.ts
'use server'
import { z } from 'zod'
import { updateTag } from 'next/cache'
import { requireSession } from '@/entities/session/api/session.server'
import { ApiError } from '@/shared/api/api-error'
import { serverFetch } from '@/shared/api/http.server'

const Input = z.object({ id: z.string().min(1) }) // TODO: real payload

export type __Name__State = { ok: boolean; error?: 'forbidden' | 'invalid' | 'rejected' } | null

export async function __camel__Action(_prev: __Name__State, formData: FormData): Promise<__Name__State> {
  const session = await requireSession() // redirects to /login when signed out
  if (!session.permissions.includes('__entity-name__:write')) return { ok: false, error: 'forbidden' } // TODO: real permission

  const parsed = Input.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'invalid' }

  try {
    await serverFetch('/__entity-name__s/__name__', { method: 'POST', json: parsed.data, timeoutMs: 15_000 })
  } catch (error) {
    if (error instanceof ApiError && error.status !== null && error.status < 500) {
      return { ok: false, error: 'rejected' } // user-safe code, never the backend message
    }
    throw error // 5xx/network → error.tsx + logger
  }
  updateTag('__entity-name__s') // read-your-writes for cached reads tagged with it
  return { ok: true }
}
```

```tsx
// ui/__Name__Form.tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/shared/ui/button'
import { __camel__Action } from '../api/__camel__.action'

type __Name__FormProps = { id: string }

export function __Name__Form({ id }: __Name__FormProps) {
  const [state, formAction, isPending] = useActionState(__camel__Action, null)

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" disabled={isPending} aria-busy={isPending}>
        {isPending ? 'Saving…' : '__Name__'}
      </Button>
      <span aria-live="polite" className="text-sm text-muted-foreground">
        {state?.ok && 'Done'}
        {state?.error && 'Something went wrong'}
      </span>
    </form>
  )
}
```

Test the action's guard paths with mocked `requireSession`/`serverFetch`
(unauthorised → `forbidden`, bad input → `invalid`); the form is covered by
E2E when the flow is critical (`e2e-playwright.md`).

```tsx
// ui/__Name__Button.test.tsx
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/shared/config/tests/msw/server'
import { renderWithProviders } from '@/shared/config/tests/render'
import { __Name__Button } from './__Name__Button'

it('shows success after the request', async () => {
  server.use(http.post('*/__name__', () => HttpResponse.json({ ok: true })))
  const { user } = renderWithProviders(<__Name__Button id="1" />)
  await user.click(screen.getByRole('button'))
  expect(await screen.findByText('Done')).toBeInTheDocument()
})
```

### B. Client-state feature (toggle / drawer / wizard step)

```ts
// model/__camel__.store.ts
import { create } from 'zustand'

type __Name__State = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const use__Name__Store = create<__Name__State>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}))
```

```ts
// model/__camel__.store.test.ts
import { use__Name__Store } from './__camel__.store'

describe('__camel__ store', () => {
  beforeEach(() => use__Name__Store.setState({ isOpen: false }))
  it('toggles', () => {
    use__Name__Store.getState().toggle()
    expect(use__Name__Store.getState().isOpen).toBe(true)
  })
})
```

Consumers always select: `use__Name__Store((s) => s.isOpen)`.

```ts
// index.ts
export { __Name__Button } from './ui/__Name__Button'
// Server Action variant: export { __Name__Form } from './ui/__Name__Form'
// B: export { use__Name__Store } from './model/__camel__.store'
```

---

## Widget — `features` + `entities` composed into one block

```
widgets/__name__/
├── ui/
│   ├── __Name__.tsx
│   ├── __Name__.test.tsx
│   └── components/
│       ├── __Name__Empty.tsx
│       ├── __Name__Error.tsx
│       └── __Name__Skeleton.tsx
└── index.ts
```

```tsx
// ui/__Name__.tsx — client list with all async states
'use client' // Next only; omit when rendered as a pure RSC

import { useQuery } from '@tanstack/react-query'
import { __entity__ListQuery, __Entity__Card } from '@/entities/__entity-name__'
import { __Name__Empty } from './components/__Name__Empty'
import { __Name__Error } from './components/__Name__Error'
import { __Name__Skeleton } from './components/__Name__Skeleton'

export function __Name__() {
  const { data, isPending, isError, refetch } = useQuery(__entity__ListQuery())

  if (isPending) return <__Name__Skeleton />
  if (isError) return <__Name__Error onRetry={() => refetch()} />
  if (data.length === 0) return <__Name__Empty />

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((item) => (
        <li key={item.id}>
          <__Entity__Card __entityCamel__={item} />
        </li>
      ))}
    </ul>
  )
}
```

```tsx
// ui/components/__Name__Error.tsx
import { Button } from '@/shared/ui/button'

type __Name__ErrorProps = { onRetry: () => void }

export function __Name__Error({ onRetry }: __Name__ErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-muted-foreground">Could not load data.</p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
```

`__Name__Empty` = message + primary action; `__Name__Skeleton` = skeletons in
the same grid as the final layout (no layout shift). A compact/full layout of
the widget is a `cva` variant prop or a second widget — never `isCompact`.

```tsx
// ui/__Name__.test.tsx — cover success, empty, error
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/shared/config/tests/msw/server'
import { renderWithProviders } from '@/shared/config/tests/render'
import { __Name__ } from './__Name__'

it('shows the empty state', async () => {
  server.use(http.get('*/__entity-name__s', () => HttpResponse.json([])))
  renderWithProviders(<__Name__ />)
  expect(await screen.findByText(/no /i)).toBeInTheDocument()
})

it('shows retry on error', async () => {
  server.use(http.get('*/__entity-name__s', () => new HttpResponse(null, { status: 500 })))
  renderWithProviders(<__Name__ />)
  expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
})
```

```ts
// index.ts
export { __Name__ } from './ui/__Name__'
```

---

## View — one screen (+ thin route file)

```
views/__name__/
├── ui/
│   └── __Name__View.tsx
└── index.ts
```

### Next mode

```tsx
// views/__name__/ui/__Name__View.tsx — async Server Component (container)
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { __entity__ListQuery } from '@/entities/__entity-name__'
import { get__Entity__s } from '@/entities/__entity-name__/api/__entity__.server'
import { __Widget__ } from '@/widgets/__widget-name__'

export async function __Name__View() {
  const qc = new QueryClient()
  // same queryKey as the client query, but the server queryFn uses serverFetch — never axios
  await qc.prefetchQuery({ ...__entity__ListQuery(), queryFn: () => get__Entity__s() })

  return (
    <main className="container mx-auto flex flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">__Name__</h1>
      <HydrationBoundary state={dehydrate(qc)}>
        <__Widget__ />
      </HydrationBoundary>
    </main>
  )
}
```

```tsx
// app/__name__/page.tsx — thin, ≤20 lines
import type { Metadata } from 'next'
import { __Name__View } from '@/views/__name__'

export const metadata: Metadata = { title: '__Name__' }

export default function Page() {
  return <__Name__View />
}
```

No client refetching needed → skip Query: `const items = await get__Entity__s()`
and pass plain props to a presentational component. A 401 from `serverFetch`
→ `redirect('/login')`; no token refresh on the server.

Also create `app/__name__/loading.tsx` (skeleton) and `app/__name__/error.tsx`
(`'use client'`, generic message + `reset()` button, never `error.message`;
reports with `logger.error(error)` in a `useEffect` keyed on `error` —
`observability.md`). Dynamic segment (`[id]`): type
`params: Promise<{ id: string }>` and `await params` (see `nextjs.md` §2).
With i18n the route lives under `app/[locale]/__name__/` and calls
`setRequestLocale(locale)`; `metadata` becomes `generateMetadata` with
`getTranslations`.

New top-level route → add its path to `e2e/specs/smoke.spec.ts` (renders +
axe clean). Part of a critical flow (auth, checkout-like, core create/edit) →
add or extend a journey spec (`../team-frontend/references/e2e-playwright.md`).

### React mode (TanStack Router)

```tsx
// views/__name__/ui/__Name__View.tsx — data preloaded by the route loader
import { __Widget__ } from '@/widgets/__widget-name__'

export function __Name__View() {
  return (
    <main className="container mx-auto flex flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">__Name__</h1>
      <__Widget__ />
    </main>
  )
}
```

```tsx
// routes/__name__.tsx — thin
import { createFileRoute } from '@tanstack/react-router'
import { __entity__ListQuery } from '@/entities/__entity-name__'
import { __Name__View } from '@/views/__name__'

export const Route = createFileRoute('/__name__')({
  loader: ({ context }) => context.queryClient.ensureQueryData(__entity__ListQuery()),
  component: __Name__View,
})
```

Components below the view read the preloaded data with
`useSuspenseQuery(__entity__ListQuery())` — no `useEffect` fetching. Add an
`errorComponent` (generic message + `reset`) on routes that load data, and the
new path to `e2e/specs/smoke.spec.ts`. With i18n, load the view's namespace in
the `loader` (`i18n.loadNamespaces('__name__')`).

```ts
// views/__name__/index.ts
export { __Name__View } from './ui/__Name__View'
```

---

Placeholders `__entity-name__`, `__entity__` (camel), `__Entity__`,
`__entityCamel__`, `__Widget__`, `__widget-name__` (and `get__Entity__s`, the
entity's server list function) refer to the composed
slices the user named in Step 2. If a composed slice doesn't exist yet, offer
to generate it first (entity before feature before widget before view).
