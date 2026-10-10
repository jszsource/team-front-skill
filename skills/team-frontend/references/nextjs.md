# Next.js (App Router) — team rules

Baseline: Next.js 16.x (latest stable at time of writing: 16.4, React 19.3).
Always confirm the installed version from `package.json`; if older than 16,
some APIs below differ (see "Version notes").

## 1. Server vs Client Components

- Every component is a **Server Component** unless it needs: `useState`,
  `useReducer`, effects, event handlers, browser APIs, Zustand hooks, TanStack
  Query hooks, context consumers, or a client-only library.
- `"use client"` goes on the **smallest leaf**. Pattern: server parent fetches,
  passes plain serialisable props to a small client child.
- Need a client wrapper (e.g. provider, collapsible) around server content?
  Pass server content as `children`:

```tsx
// widgets/sidebar/ui/Sidebar.tsx  (server)
import { Collapsible } from './components/Collapsible' // "use client"
import { NavLinks } from './components/NavLinks'       // server
export function Sidebar() {
  return (
    <Collapsible>
      <NavLinks />
    </Collapsible>
  )
}
```

- Never import a server-only module into a client component. Mark server-only
  modules with `import 'server-only'`.
- Props crossing the boundary must be serialisable (no functions, class
  instances, Dates → pass ISO strings). Server Actions are the exception.

## 2. Routing files (thin)

```
app/
  layout.tsx            # html/body, fonts, <Providers>, metadata
  page.tsx              # export { HomeView as default } from '@/views/home'
  loading.tsx           # skeleton
  error.tsx             # "use client" error boundary with reset()
  not-found.tsx
  (auth)/login/page.tsx # route groups for layout grouping
  products/[id]/page.tsx
```

```tsx
// app/products/[id]/page.tsx
import { ProductView } from '@/views/product'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: `Product ${id}` }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <ProductView id={id} />
}
```

- `params` and `searchParams` are **Promises** — always `await`.
- No business logic, no data mapping, no JSX trees in route files.

## 3. Data fetching on the server

- Fetch in async Server Components (in `views`/`widgets`), via the entity's
  `api/` functions (server axios instance or `fetch`).
- Parallelise: `const [a, b] = await Promise.all([getA(), getB()])`.
- Don't await what you don't need yet; pass the promise down and `use()` it
  inside a `<Suspense>` boundary to stream.
- Dedupe per request with `React.cache()` for non-fetch data sources.
- Slow sections: wrap in `<Suspense fallback={<Skeleton/>}>` so the shell streams.

## 4. Caching (Next 16)

- `fetch` is **not cached by default**. Opt in explicitly.
- Cache Components (default in new 16.4 projects): mark cacheable functions or
  components with `"use cache"`, tag with `cacheTag('products')`, set
  `cacheLife('hours')`.
- Invalidate: `revalidateTag('products')` (stale-while-revalidate) or
  `updateTag('products')` inside a Server Action for read-your-writes;
  `refresh()` to refresh the client router.
- Never cache user-specific data in a shared cache.

## 5. Mutations

- Forms that post to our backend: Server Action (`"use server"`) +
  `useActionState` for pending/error state + zod validation on the server.
- Interactive client mutations against the external API: TanStack Query
  `useMutation` through the axios instance (see `http-axios.md`).
- After mutation: `updateTag`/`revalidateTag` (server) or
  `queryClient.invalidateQueries` (client).

## 6. TanStack Query in Next.js

- `app-layer/providers/QueryProvider.tsx` (`"use client"`) creates the
  `QueryClient` with `useState(() => new QueryClient(...))`, `staleTime ≥ 60s`.
- Prefetch on server, hydrate on client:

```tsx
// views/products/ui/ProductsView.tsx (server)
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { productListQuery } from '@/entities/product'
import { ProductList } from '@/widgets/product-list'

export async function ProductsView() {
  const qc = new QueryClient()
  await qc.prefetchQuery(productListQuery())
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <ProductList />
    </HydrationBoundary>
  )
}
```

Use Query in Next only when the client needs refetching, pagination,
optimistic updates or polling. Static/server-only reads stay plain RSC.

## 7. Request interception — `proxy.ts`

Next 16 renamed `middleware.ts` → `proxy.ts` (export `proxy`). Use it for auth
redirects (check refresh cookie presence), locale, headers. Keep it light; no
heavy data fetching.

## 8. Built-ins you must use

`next/image` (with `sizes`), `next/font` (no external font `<link>`),
`next/link`, `next/dynamic` for heavy client-only widgets (charts, editors),
`generateMetadata`, `opengraph-image`, `sitemap.ts`, `robots.ts`.

## 9. Env

`shared/config/env.ts` validates `process.env` with zod. Server values without
prefix; browser values `NEXT_PUBLIC_*`. Never read `process.env` elsewhere.

## 10. Performance

- Turbopack is the default bundler; React Compiler is enabled
  (`reactCompiler: true`) — don't sprinkle `useMemo`/`useCallback`.
- Avoid barrel re-exports of large libs inside client components; FSD
  `index.ts` public APIs are fine but keep client and server exports separate
  when a slice has both (`index.ts` + `index.client.ts` if needed).

## Version notes

- Next ≤14: `params` sync, `fetch` cached by default, `middleware.ts`.
- Next 15: async `params`, `fetch` uncached by default, `middleware.ts`.
- Next 16: Turbopack default, `proxy.ts`, Cache Components / `"use cache"`,
  `updateTag`, `refresh`, React Compiler stable.
- Upgrades: `npx @next/codemod@latest upgrade latest`.
