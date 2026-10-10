# Feature-Sliced Design — team adaptation

## Layers (import direction: only downward)

| Layer | Contains | Example slices |
| --- | --- | --- |
| `app` (`app-layer` in Next) | providers, global styles, router/query client setup | — (no slices) |
| `views` (FSD "pages") | full page composition, page-level data loading | `home`, `product`, `checkout` |
| `widgets` | big self-contained UI blocks | `header`, `product-list`, `cart-summary` |
| `features` | one user action with business value | `add-to-cart`, `auth-by-email`, `filter-products` |
| `entities` | business nouns: types, api, store, display UI | `user`, `product`, `order` |
| `shared` | business-agnostic: ui kit, http, lib, config | — (segments only) |

`views` instead of `pages` and `app-layer` instead of `app` avoid clashes with
Next.js `pages/` and `app/` directories. In React+Vite projects you may keep
`app/` for the FSD app layer (no clash).

## Import rules

1. Layer may import only from layers **below** it.
2. No imports between slices of the **same layer** (`features/a` ✗→ `features/b`).
   - Entities that genuinely reference each other: use the `@x` cross-import
     notation (`entities/order/@x/user.ts`) — sparingly.
3. Import a slice only through its public API: `@/entities/user`, never
   `@/entities/user/model/user.store`.
4. Inside a slice use relative imports.

Enforce with `eslint-plugin-boundaries` (config in `tooling.md`).

## Segments

```
<slice>/
  ui/          components (+ local components/ folders after decomposition)
  model/       zustand store, hooks, selectors, zod schemas, types
  api/         axios request functions, queryOptions, query/mutation hooks
  lib/         pure helpers
  config/      constants
  index.ts     public API
```

`shared` segments: `shared/ui` (shadcn), `shared/api` (http instance, ApiError),
`shared/lib` (cn, formatters), `shared/config` (env, routes), `shared/hooks`,
`shared/types`.

## Public API example

```ts
// entities/product/index.ts
export type { Product } from "./model/types";
export { productKeys, productListQuery, productDetailQuery } from "./api/product.queries";
export { ProductCard } from "./ui/ProductCard";
```

Export only what other layers need. Keep server-only exports out of client
bundles — if a slice exposes both, split `index.ts` (shared/client-safe) and
`index.server.ts`.

## Deciding the layer — quick test

- Would another project with different business reuse it? → `shared`.
- Is it a noun of the domain with no user action? → `entities`.
- Is it a verb the user performs (submit, toggle, filter)? → `features`.
- Does it combine several features/entities into one block? → `widgets`.
- Is it one screen? → `views`.

## Next.js layout

```
app/                  # Next routing only (thin files)
src/
  app-layer/providers/{QueryProvider,StoreProvider,ThemeProvider,index}.tsx
  views/ widgets/ features/ entities/ shared/
```

tsconfig paths: `"@/*": ["./src/*"]`.

## Legacy migration (incremental)

1. Create `shared/` and move ui kit + http client.
2. Extract `entities` from type/api folders.
3. New work goes into `features`/`widgets` only.
4. Convert old pages to `views` one by one. Never big-bang rewrite unasked.
