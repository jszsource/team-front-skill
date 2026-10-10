# State — TanStack Query + Zustand

Implements STANDARDS §7. Paths are given for both layouts:

| Concern | FSD (`next`, `shadcn-tailwind-tanstack-router`) | `antd-scss-react-router` profile |
| --- | --- | --- |
| QueryClient | `shared/api/query-client.ts` | `shared/lib/query-client.ts` |
| Key factory | `<slice>/api/query-keys.ts` | `features/<domain>/lib/query-keys.ts` |
| Query options / hooks | `<slice>/api/*.queries.ts`, `use*Query.ts` | `features/<domain>/queries/use*Query.ts` |
| API functions | `<slice>/api/*.api.ts` | `features/<domain>/lib/api.ts` |
| Resettable-store factory | `shared/lib/create-resettable-store.ts` | `shared/stores/create-resettable-store.ts` |
| Feature store | `<slice>/model/{domain}.store.ts` | `features/<domain>/{domain}.store.ts` |
| Root auth/session store | `entities/session/model/session.store.ts` | `shared/stores/auth.store.ts` |

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

### One QueryClient with explicit defaults

```ts
// shared/api/query-client.ts   (antd-scss-react-router profile: shared/lib/query-client.ts)
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-error";

const MAX_RETRIES = 2;

function shouldRetry(failureCount: number, error: unknown): boolean {
  // 4xx is a client/business error — retrying cannot fix it
  if (
    error instanceof ApiError &&
    error.status !== null &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000, // FALLBACK only — every endpoint sets its own policy (see below)
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
        refetchOnWindowFocus: true, // only refetches stale data; turn off per query for heavy endpoints
        refetchOnReconnect: true,
        networkMode: "online", // "offlineFirst" only for an offline-capable app
      },
      mutations: {
        retry: false, // mutations are not idempotent
        networkMode: "online",
      },
    },
  });
}

// React SPA (shadcn-tailwind-tanstack-router + antd-scss-react-router): one module-level client — also used by logout and the router context
export const queryClient = makeQueryClient();
```

- Exactly one client per app (per request on the Next server). `QueryClientProvider`
  sits at the root; `ReactQueryDevtools` is rendered only when
  `import.meta.env.DEV` / `process.env.NODE_ENV === "development"`.
- **Next.js:** don't export a module singleton used on the server. Use
  `getQueryClient()` — a new client per server request, one cached client in
  the browser (the provider calls it; logout calls it too):

```ts
// shared/api/query-client.ts (Next.js addition)
import { isServer, type QueryClient } from "@tanstack/react-query";

let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
```

- `refetchOnWindowFocus` is a decision per query: keep it for data users expect
  to be fresh after tab switches (orders, queues); set `false` for expensive
  reports or data that is pushed via WebSocket.

### Key factory — the only way to build keys

```ts
// entities/order/api/query-keys.ts   (antd-scss-react-router profile: features/orders/lib/query-keys.ts)
/**
 * Cache policy — orders
 * owner:        team-orders
 * keys:         orderKeys.* (["orders", ...])
 * staleTime:    60 s   gcTime: 10 min
 * invalidation: create → lists + stats; update → detail + lists; delete → lists + stats, remove detail
 * realtime:     WebSocket "order.updated" → setQueryData(detail) + invalidate(lists)
 */
export type OrderFilters = { status?: "new" | "paid" | "shipped"; page: number };

export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  stats: () => [...orderKeys.all, "stats"] as const,
};

export const ORDER_CACHE = { staleTime: 60_000, gcTime: 10 * 60_000 } as const;
```

Rules:

- One factory per slice/feature, file named `query-keys.ts`; every query and
  every invalidation uses it. Never an inline array (`useQuery({ queryKey: ["orders"] })`).
- Hierarchical: `all → lists() → list(filters)`, `all → details() → detail(id)`,
  plus extras (`stats()`, `history(id)`) — so partial invalidation works.
- Typed `as const`, **deterministic**: only serialisable, minimal params
  (ids, filter primitives/plain objects). Never `Date.now()`, `Math.random()`,
  class instances, functions or a whole entity object in a key.
- The factory file starts with the **cache-policy comment block**: owner,
  keys, `staleTime`, `gcTime`, invalidation rule, realtime source (or "none").

Anti-patterns (reviewers flag them):

```ts
["data"];
["list"];
["temp"]; // generic, collides across features
["orders", Date.now()];
["orders", Math.random()]; // new key every render → no cache, refetch loop
["orders", { filters, onChange }]; // function in a key — not serialisable
queryClient.invalidateQueries(); // argless — refetches the whole app
axios.get("/orders"); // inside a component — use the api function + query hook
```

### Cache policy per endpoint (example)

Decide `staleTime` / `gcTime` by how fresh the business needs the data, not by
habit. The global 60 s is only the fallback for endpoints nobody has decided
yet. Example table — record the real values in each key factory's comment block:

| Endpoint | `staleTime` | `gcTime` | Why |
| --- | --- | --- | --- |
| Settings | 2 h | 4 h | changes rarely, changes by this user invalidate it |
| Categories | 1 h | 2 h | reference data |
| User profile | 30 s | 2 min | may change in another tab/device |
| Orders | 1 min | 10 min | operational, realtime events patch it |
| Reports | 10 min | 30 min | expensive to compute, `refetchOnWindowFocus: false` |

`gcTime` ≥ `staleTime`. Sensitive data (PII-heavy screens) gets a short
`gcTime`. Everything is dropped on logout anyway (`queryClient.clear()`).

### Query options + `signal`

```ts
// entities/order/api/order.queries.ts   (antd-scss-react-router profile: features/orders/queries/useOrdersQuery.ts)
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { orderApi } from "./order.api";
import { ORDER_CACHE, orderKeys, type OrderFilters } from "./query-keys";

export const orderListQuery = (filters: OrderFilters) =>
  queryOptions({
    queryKey: orderKeys.list(filters),
    queryFn: ({ signal }) => orderApi.list(filters, { signal }), // cancelled on unmount / key change
    ...ORDER_CACHE,
  });

export const orderDetailQuery = (id: string) =>
  queryOptions({
    queryKey: orderKeys.detail(id),
    queryFn: ({ signal }) => orderApi.byId(id, { signal }),
    ...ORDER_CACHE,
  });

export function useOrdersQuery(filters: OrderFilters) {
  return useQuery({
    ...orderListQuery(filters),
    placeholderData: keepPreviousData, // pagination without flashing a skeleton
    select: (page) => ({ ...page, items: page.items.filter((o) => !o.archived) }),
  });
}

export function useOrderQuery(id: string | undefined) {
  return useQuery({
    ...orderDetailQuery(id ?? ""),
    enabled: id !== undefined, // dependent query — no request until the id exists
  });
}
```

```ts
// api function: pass the signal to axios
list: (filters: OrderFilters, opts?: { signal?: AbortSignal }) =>
  http.get<OrderPage>("/orders", { params: filters, signal: opts?.signal }).then((r) => r.data),
```

- `queryOptions()` so the same object serves `useQuery`, `useSuspenseQuery`,
  `prefetchQuery`, `ensureQueryData` (route loaders) and Next server prefetch.
- `select` for transformations (component re-renders only when the selected
  value changes); no heavy mapping inside components.
- `enabled` for dependent queries; `placeholderData: keepPreviousData` for
  pagination/filters.
- `useSuspenseQuery` inside Suspense boundaries; `useQuery` when you render
  loading inline.
- ESLint: `@tanstack/eslint-plugin-query` recommended config.

### Mutations — narrow invalidation

| Mutation | `detail(id)` | `lists()` | `stats()` |
| --- | --- | --- | --- |
| Create | — (or `setQueryData` with the response) | invalidate | invalidate |
| Update | `setQueryData` with the response (else invalidate) | invalidate | invalidate only if the change affects stats |
| Delete | `removeQueries` | invalidate | invalidate |

```ts
// features/edit-order/api/useUpdateOrderMutation.ts   (antd-scss-react-router profile: features/orders/queries/)
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orderApi, orderKeys } from "@/entities/order";

export function useUpdateOrderMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orderApi.update,
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.detail(order.id), order); // response is the new entity — no refetch
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
```

- Prefer `setQueryData` when the response already contains the new entity.
- **Forbidden:** `queryClient.invalidateQueries()` without a `queryKey`, and
  invalidating `all` when `lists()` is enough.
- Mutations don't retry. Errors: 5xx are toasted once by the HTTP interceptor
  (`http-axios.md`); the mutation shows only domain/4xx messages (form errors
  via `form.setError`, see `ui-tailwind-shadcn.md` / `ui-antd-scss.md`).

### Optimistic update template

Only where UX needs instant feedback (toggles, reorder, like):

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orderApi, orderKeys, type Order } from "@/entities/order";

export function useToggleOrderFlagMutation(id: string) {
  const qc = useQueryClient();
  const key = orderKeys.detail(id);

  return useMutation({
    mutationFn: (flagged: boolean) => orderApi.setFlag(id, flagged),
    onMutate: async (flagged) => {
      await qc.cancelQueries({ queryKey: key }); // don't let an in-flight fetch overwrite us
      const previous = qc.getQueryData<Order>(key); // snapshot
      qc.setQueryData<Order>(key, (old) => (old ? { ...old, flagged } : old));
      return { previous };
    },
    onError: (_error, _flagged, context) => {
      qc.setQueryData(key, context?.previous); // rollback
      toast.error("Could not update the order."); // antd-scss-react-router: notify.error(...); translate in multi-locale products
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
```

### Infinite queries — bounded

```ts
import { infiniteQueryOptions } from "@tanstack/react-query";

export const orderFeedQuery = (filters: Omit<OrderFilters, "page">) =>
  infiniteQueryOptions({
    queryKey: orderKeys.feed(filters), // factory: feed: (f) => [...orderKeys.lists(), "feed", f] as const
    queryFn: ({ pageParam, signal }) =>
      orderApi.feed({ ...filters, cursor: pageParam }, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    maxPages: 10, // memory cap — older pages are dropped (needs getPreviousPageParam to scroll back)
    getPreviousPageParam: (first) => first.prevCursor ?? undefined,
  });
```

Large lists also need virtualisation (> 100 rows, `ui-tailwind-shadcn.md`;
`antd-scss-react-router`: AntD `Table` with `virtual`, `ui-antd-scss.md`).

### Realtime

- Event-based updates first: a WebSocket/SSE message updates the cache via
  **specific keys** — `setQueryData(detail(id), payload)` when the event carries
  the entity, else `invalidateQueries({ queryKey: lists() })`.
- The socket subscription lives in one place (a provider or a hook used once
  at the root, `useEffect` justified as "sync with WebSocket"), not per component.
- Polling (`refetchInterval`) only as a fallback where no push channel exists,
  with the interval documented in the cache-policy block; disable it in
  background tabs (`refetchIntervalInBackground: false`, the default).

```ts
// one root subscriber
socket.on("order.updated", (order: Order) => {
  queryClient.setQueryData(orderKeys.detail(order.id), order);
  void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
});
```

## Zustand

### `createResettableStore` — every feature store

```ts
// shared/lib/create-resettable-store.ts   (antd-scss-react-router profile: shared/stores/create-resettable-store.ts)
import { create, type StateCreator, type StoreMutatorIdentifier } from "zustand";

type Resettable = { reset: () => void };

const resetters = new Set<() => void>();

/** Calls reset() on every registered store. Used only by logout. */
export function resetAllStores(): void {
  resetters.forEach((reset) => reset());
}

/** For stores created elsewhere (Next per-request stores). Returns an unregister function. */
export function registerResettable(reset: () => void): () => void {
  resetters.add(reset);
  return () => resetters.delete(reset);
}

// Mos keeps middleware typing (e.g. persist → useStore.persist.*)
export function createResettableStore<
  T extends Resettable,
  Mos extends [StoreMutatorIdentifier, unknown][] = [],
>(initializer: StateCreator<T, [], Mos>) {
  const useStore = create<T>()(initializer);
  registerResettable(() => useStore.getState().reset());
  return useStore;
}
```

```ts
// features/cart-drawer/model/cart-drawer.store.ts   (antd-scss-react-router profile: features/cart/cart.store.ts)
import { createResettableStore } from "@/shared/lib/create-resettable-store";

type CartDrawerState = {
  isOpen: boolean;
  step: "items" | "delivery";
  open: () => void;
  close: () => void;
  setStep: (step: CartDrawerState["step"]) => void;
  reset: () => void;
};

const initialState: Pick<CartDrawerState, "isOpen" | "step"> = { isOpen: false, step: "items" };

export const useCartDrawerStore = createResettableStore<CartDrawerState>((set) => ({
  ...initialState,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setStep: (step) => set({ step }),
  reset: () => set(initialState),
}));
```

### Persisted store — reset also clears storage

```ts
// features/table-prefs/model/table-prefs.store.ts
import { persist } from "zustand/middleware";
import { createResettableStore } from "@/shared/lib/create-resettable-store";

type TablePrefsState = {
  density: "compact" | "comfortable";
  setDensity: (density: TablePrefsState["density"]) => void;
  reset: () => void;
};

const initialState: Pick<TablePrefsState, "density"> = { density: "comfortable" };

export const useTablePrefsStore = createResettableStore(
  persist<TablePrefsState>(
    (set, _get, api) => ({
      ...initialState,
      setDensity: (density) => set({ density }),
      reset: () => {
        set(initialState);
        api.persist.clearStorage(); // removes the "table-prefs:v1" key from storage
      },
    }),
    { name: "table-prefs:v1", version: 1 },
  ),
);
```

A persisted store whose `reset()` only resets memory would re-hydrate the old
user's values on the next load — `reset()` must clear storage too (persist API
`clearStorage()`, or `localStorage.removeItem(key)` for hand-rolled storage).

- `persist` only for non-sensitive prefs (theme, layout, density) — never
  tokens or user data — with a versioned `name` (`ui-prefs:v1`) and
  `version` + `migrate`.

### Selecting

```ts
import { useShallow } from "zustand/react/shallow";

const isOpen = useCartDrawerStore((s) => s.isOpen); // one field → plain selector
const { step, close } = useCartDrawerStore(
  useShallow((s) => ({ step: s.step, close: s.close })), // several fields → useShallow
);
```

Rules:

- **Always select.** Never `const store = useCartDrawerStore()` / destructure
  the whole store.
- Actions live in the store. Components call actions; they don't compute next state.
- One small store per slice/feature (`{domain}.store.ts`). No global god-store.
- Feature stores **only** via `createResettableStore` (must expose `reset()`);
  plain `create()` only for root stores (auth/session) that themselves call
  `resetAllStores()`.
- `devtools` middleware in development.
- Export custom hooks/selectors from the slice `index.ts`, not the raw store
  when consumers need only derived values.

### Root auth/session store + logout sequence

```ts
// entities/session/model/session.store.ts — React SPA `shadcn-tailwind-tanstack-router`
// antd-scss-react-router profile: shared/stores/auth.store.ts, imports from @/shared/lib/* and ./create-resettable-store
// Next.js: session lives in the per-request SessionProvider below; its logout runs the same steps with getQueryClient()
import { create } from "zustand";
import { queryClient } from "@/shared/api/query-client";
import { tokenStorage } from "@/shared/api/token";
import { resetAllStores } from "@/shared/lib/create-resettable-store";

type User = { id: string; name: string };

type SessionState = {
  user: User | null;
  status: "unknown" | "authenticated" | "anonymous";
  setUser: (user: User) => void;
  logout: () => void;
};

export const useSessionStore = create<SessionState>()((set) => ({
  user: null,
  status: "unknown",
  setUser: (user) => set({ user, status: "authenticated" }),
  logout: () => {
    tokenStorage.set(null); // 1. in-memory access token gone
    set({ user: null, status: "anonymous" }); // 2. root store
    resetAllStores(); // 3. every feature store (+ persisted keys)
    queryClient.clear(); // 4. all cached server data
    // 5. redirect — the handler registered via tokenStorage.setLogoutHandler navigates to /login
    //    with the router (router.navigate / redirect), never window.location for internal routes
  },
}));
```

Logout sequence (user action **or** refresh failure in the interceptor — both
end in the same function, wired via `tokenStorage.setLogoutHandler`, see
`http-axios.md`):

1. clear the in-memory access token (and call the backend logout endpoint so
   it clears the refresh cookie, for user-initiated logout);
2. reset the root auth/session store;
3. `resetAllStores()` — including `persist` storage keys;
4. `queryClient.clear()`;
5. redirect to login.

No user data survives a logout.

### Next.js: per-request store

Module-level stores are shared across requests on the server. For stores that
hold user data and are read during SSR, use the context pattern:

```tsx
"use client";
import { createContext, use, useState, type ReactNode } from "react";
import { createStore, useStore } from "zustand";

type SessionState = { userId: string | null; setUser: (id: string | null) => void };

const createSessionStore = (userId: string | null) =>
  createStore<SessionState>()((set) => ({ userId, setUser: (id) => set({ userId: id }) }));

const SessionContext = createContext<ReturnType<typeof createSessionStore> | null>(null);

export function SessionProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [store] = useState(() => createSessionStore(userId));
  return <SessionContext value={store}>{children}</SessionContext>;
}

export function useSession<T>(selector: (s: SessionState) => T) {
  const store = use(SessionContext);
  if (!store) throw new Error("useSession must be used inside SessionProvider");
  return useStore(store, selector);
}
```

Pure UI stores without SSR-relevant data (drawer open) may stay module-level
(via `createResettableStore`). A per-request **feature** store created in a
provider exposes `reset()` and registers itself while mounted:

```tsx
// sync with an external system: the logout reset registry
useEffect(() => registerResettable(() => store.getState().reset()), [store]);
```
