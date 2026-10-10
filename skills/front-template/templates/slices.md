# FSD slice templates

Placeholders: `__name__` (kebab), `__Name__` (Pascal), `__camel__` (camel).
All paths are relative to `src/`. Generate only the segments the slice needs —
an empty `lib/` or `config/` is not created.

---

## Entity — `entities/__name__/`

```
entities/__name__/
├── api/
│   ├── __camel__.api.ts
│   ├── __camel__.queries.ts
│   └── __camel__.api.test.ts
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
// api/use__Name__Mutation.ts
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
shadcn `Form` + react-hook-form + `zodResolver`; Next forms posting to our BFF
may use a Server Action + `useActionState` instead (see `nextjs.md` §5).

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
the same grid as the final layout (no layout shift).

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
import { __Widget__ } from '@/widgets/__widget-name__'

export async function __Name__View() {
  const qc = new QueryClient()
  await qc.prefetchQuery(__entity__ListQuery())

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

Also create `app/__name__/loading.tsx` (skeleton) and `app/__name__/error.tsx`
(`'use client'`, `reset()` button). Dynamic segment (`[id]`): type
`params: Promise<{ id: string }>` and `await params` (see `nextjs.md` §2).

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
`useSuspenseQuery(__entity__ListQuery())` — no `useEffect` fetching.

```ts
// views/__name__/index.ts
export { __Name__View } from './ui/__Name__View'
```

---

Placeholders `__entity-name__`, `__entity__` (camel), `__Entity__`,
`__entityCamel__`, `__Widget__`, `__widget-name__` refer to the composed
slices the user named in Step 2. If a composed slice doesn't exist yet, offer
to generate it first (entity before feature before widget before view).
