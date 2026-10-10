# React (non-Next) — Vite + TanStack Router

Use only when the project has `react` but not `next`.

## Setup

```bash
npm i @tanstack/react-router @tanstack/react-query zustand axios
npm i -D @tanstack/router-plugin @tanstack/router-devtools @tanstack/eslint-plugin-router
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }), // must be before react()
    react({ babel: { plugins: ['babel-plugin-react-compiler'] } }),
    tailwindcss(),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

## Structure (FSD)

```
src/
  app/            # router.tsx, providers, main.tsx, styles
  routes/         # TanStack file routes — THIN (like Next route files)
    __root.tsx
    index.tsx
    products/$id.tsx
  views/ widgets/ features/ entities/ shared/
```

## Router + Query integration

```tsx
// src/app/router.tsx
import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from '../routeTree.gen'

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0, // let Query own freshness
})

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
```

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
})
```

```tsx
// src/routes/products/$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { productDetailQuery } from '@/entities/product'
import { ProductView } from '@/views/product'

export const Route = createFileRoute('/products/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(productDetailQuery(params.id)),
  pendingComponent: ProductView.Skeleton,
  component: function ProductRoute() {
    const { id } = Route.useParams()
    return <ProductView id={id} />
  },
})
```

## Rules

- Data for a route is loaded in `loader` via `ensureQueryData` → no fetch
  waterfalls, no `useEffect` fetching. Components read with
  `useSuspenseQuery(productDetailQuery(id))`.
- Search params are typed and validated with `validateSearch` (zod); use them
  for filters/pagination instead of Zustand.
- Auth guard in `beforeLoad` of a layout route (`_auth.tsx`):
  `if (!context.auth.isAuthenticated) throw redirect({ to: '/login', search: { redirect: location.href } })`.
- Navigation via `<Link to="/products/$id" params={{ id }}>` — fully typed; no
  string concatenation.
- `errorComponent` and `notFoundComponent` on routes that load data.
