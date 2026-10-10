# React patterns

## A. Composition

1. **Replace layout/behaviour-mode boolean props with composition.** Each such
   boolean doubles the states a component can be in. State booleans
   (`disabled`, `open`, `checked`, `loading`) are fine — see `components.md`.
2. **Compound components with context.** Parent owns state, children
   (`Tabs.List`, `Tabs.Trigger`, `Tabs.Panel`) read it via context. Use when
   parts must share implicit state; skip for simple one-piece components.
3. **Explicit variant components** (`<ThreadComposer/>`, `<EditMessageComposer/>`)
   instead of `mode="edit"` flags.
4. **Children over render props.** Render props only when the child needs
   data from the parent at render time.
5. **Decouple state from UI.** Provider exposes `{ state, actions, meta }`;
   UI components don't know whether the state comes from Zustand, Query or
   `useState`.
6. **Lift state into provider components** when siblings need it.
7. **Slot pattern** for layouts: `<PageLayout header={…} sidebar={…}>`.
8. **Headless components/hooks** for reusable behaviour (shadcn/Radix model).
9. **React 19:** `ref` as prop, `use()` for context and promises, Actions
   (`useActionState`, `useOptimistic`, `useFormStatus`).

## B. Hooks

- Custom hooks extract reusable **stateful logic**, named `useXxx`, return an
  object (or tuple for 2 values).
- Hooks only at top level; never conditional.
- A hook that only computes from args without state is a **function**, not a hook.

## C. Container / Presentational

Container decides *what* data (fetch, store); presentational decides *how* it
looks. In Next the Server Component is the natural container. Don't force it
for tiny components.

## D. Data fetching

1. **Parallelise independent fetches** (`Promise.all`) — never sequential awaits
   for unrelated data.
2. **Defer await** until the value is needed; pass promises down and `use()`
   them under `<Suspense>`.
3. **TanStack Query for client data** (cache, dedupe, retries, refetch).
4. **Suspense for loading states** — declarative skeletons per section.
5. **Prefetch before navigation** — `defaultPreload: 'intent'` (TanStack Router),
   `<Link prefetch>` (Next), `queryClient.prefetchQuery` on hover.
6. **`React.cache()`** to dedupe server calls within one request.
7. **Optimistic updates** — `useOptimistic` (Server Actions) or Query
   `onMutate` + rollback in `onError`.
8. **Avoid waterfalls in component trees** — hoist data loading to the route /
   page level; children receive data or promises.
9. Dedupe global event listeners (one listener, many subscribers via store).
10. Passive listeners for scroll/touch.
11. Version keys of anything persisted in client storage (`cart:v2`).

## E. Render optimisation

React Compiler handles most memoisation. Focus on structure:

1. Compute derived values during render — don't store them in state.
2. Subscribe to coarse-grained state (`s => s.items.length > 0`), not raw arrays.
3. Lazy state init: `useState(() => expensive())`.
4. Functional setState: `setCount(c => c + 1)`.
5. Interaction logic in event handlers, not effects.
6. `useRef` for transient, high-frequency values (scroll pos, timers).
7. `startTransition` / `useTransition` for non-urgent updates and navigation.
8. `useDeferredValue` for expensive renders driven by input.
9. Stable default props (hoist `const EMPTY: Item[] = []`).
10. `content-visibility: auto` for long lists; virtualise (TanStack Virtual) > 200 rows.
11. Hoist static JSX.
12. Never define components inside components.
13. Explicit checks in conditional rendering (`> 0`, `!= null`).
14. Narrow effect deps to primitives.
15. Prevent hydration flicker for client-only data (render placeholder on server,
    or `suppressHydrationWarning` only for known-safe cases like timestamps).
16. Animate `transform`/`opacity`, wrap SVGs and animate the wrapper.

## F. Rendering strategies (Next)

| Strategy | Use for |
| --- | --- |
| Static (default, `"use cache"`) | marketing, docs, catalogue pages |
| Partial prerender / Cache Components | static shell + dynamic holes |
| Streaming SSR (`Suspense`) | pages with slow sections |
| Dynamic (request-time) | personalised pages (cookies/headers) |
| Client-side only | highly interactive islands (`next/dynamic`, `ssr: false`) |

Selective hydration happens automatically per Suspense boundary — more,
smaller boundaries = faster interactivity.

## G. Resilience

- **Error boundary** per route segment (`error.tsx`) and around risky widgets.
- **Async boundary** = Suspense + ErrorBoundary pair around each data section.
- **Loading state**: skeletons matching final layout; no layout shift.
- **Retry**: Query `retry: 2` for idempotent GETs, none for mutations.
- **Error handling**: normalised `ApiError`, user-friendly messages, toast for
  mutations, inline for forms.

## H. Security

Full rules + reviewer checklist: `security.md`. In components specifically:

- Tokens stay in memory (`http-axios.md`); never `localStorage`.
- No `dangerouslySetInnerHTML` unless sanitised with DOMPurify; no
  `javascript:` URLs; validate redirect targets.
- Don't bypass React's output encoding; redact PII in logs and error reports.

## I. Performance fundamentals

Code-splitting by route (automatic), `next/dynamic`/`lazy` for heavy widgets,
debounce expensive handlers, lazy-load below-the-fold images, keep barrel
files out of hot client paths.
