# State — TanStack Query + Zustand

## Which state goes where

| Kind | Tool |
| --- | --- |
| Server data (lists, details, user profile from API) | TanStack Query (or RSC in Next) |
| Shared client UI state (cart drawer open, wizard step, session/auth status: `user`, `status` — the token itself stays in memory in `shared/api/token.ts`) | Zustand |
| Local component state | `useState` / `useReducer` |
| Form state | react-hook-form + zod |
| Filters, pagination, tabs, search | URL search params |

**Never** copy Query data into Zustand or `useState`.

## TanStack Query

### Keys + options factory (entity `api/` segment)

```ts
// entities/product/api/product.queries.ts
import { queryOptions } from '@tanstack/react-query'
import { productApi } from './product.api'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (page: number) => [...productKeys.lists(), { page }] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
}

export const productListQuery = (page = 1) =>
  queryOptions({ queryKey: productKeys.list(page), queryFn: () => productApi.list({ page }) })

export const productDetailQuery = (id: string) =>
  queryOptions({ queryKey: productKeys.detail(id), queryFn: () => productApi.byId(id) })
```

### Mutations (feature `api/` segment)

```ts
// features/add-to-cart/api/useAddToCartMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cartKeys, cartApi } from '@/entities/cart'

export function useAddToCartMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cartApi.add,
    onSuccess: () => qc.invalidateQueries({ queryKey: cartKeys.all }),
  })
}
```

Rules:

- `staleTime` default 60s; tune per query.
- Use `useSuspenseQuery` inside Suspense boundaries; `useQuery` when you
  render loading inline.
- `select` to derive/narrow data (reduces re-renders).
- Invalidate the narrowest key.
- Optimistic: `onMutate` (cancel queries, snapshot, set) → `onError` rollback →
  `onSettled` invalidate.
- No `retry` for mutations; `retry: 2` for GETs; don't retry 4xx.
- ESLint: `@tanstack/eslint-plugin-query` recommended config.

## Zustand

```ts
// features/cart-drawer/model/cartDrawer.store.ts
import { create } from 'zustand'

type CartDrawerState = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useCartDrawerStore = create<CartDrawerState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}))
```

Rules:

- **Always select:** `const isOpen = useCartDrawerStore((s) => s.isOpen)`.
  Multiple values → `useShallow((s) => ({ a: s.a, b: s.b }))`.
- Actions live in the store. Components call actions; they don't compute next state.
- One small store per slice. No global god-store.
- `persist` middleware only for non-sensitive prefs (theme, layout), with a
  versioned `name` (`ui-prefs:v1`) and `version` + `migrate`.
- `devtools` middleware in development.
- Export custom hooks/selectors from the slice `index.ts`, not the raw store
  when consumers need only derived values.

### Next.js: per-request store

Module-level stores are shared across requests on the server. For stores that
hold user data and are read during SSR, use the context pattern:

```tsx
'use client'
import { createContext, use, useState, type ReactNode } from 'react'
import { createStore, useStore } from 'zustand'

type SessionState = { userId: string | null; setUser: (id: string | null) => void }

const createSessionStore = (userId: string | null) =>
  createStore<SessionState>()((set) => ({ userId, setUser: (id) => set({ userId: id }) }))

const SessionContext = createContext<ReturnType<typeof createSessionStore> | null>(null)

export function SessionProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [store] = useState(() => createSessionStore(userId))
  return <SessionContext value={store}>{children}</SessionContext>
}

export function useSession<T>(selector: (s: SessionState) => T) {
  const store = use(SessionContext)
  if (!store) throw new Error('useSession must be used inside SessionProvider')
  return useStore(store, selector)
}
```

Pure UI stores without SSR-relevant data (drawer open) may stay module-level.
