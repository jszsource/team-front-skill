# `useEffect` — avoid it

`useEffect` exists to **synchronise with an external system**. Anything else is
a smell. Before writing one, find your case below.

## Replacement table

| You want to… | Do this instead |
| --- | --- |
| Fetch data | Next: async Server Component. React: route `loader` + `useSuspenseQuery`, or `useQuery`. |
| Compute a value from props/state | `const full = first + ' ' + last` during render; `useMemo` only for O(n) work and only if React Compiler is off. |
| Reset all state when an id changes | `<Profile key={userId} />` |
| Adjust part of state when a prop changes | Derive it, or store the id you selected instead of the object. |
| React to a click/submit | Put the logic in the event handler. |
| Send analytics on button click | Event handler. |
| Notify parent after state change | Call `onChange` in the same handler that sets state. |
| Sync two states | Keep one source of truth, derive the other. |
| Chain of effects setting state | Compute everything in the handler. |
| Read store values | Zustand selector hook. |
| Subscribe to an external store | `useSyncExternalStore`. |
| Use latest prop inside an effect without re-running it | `useEffectEvent` (React 19.2+). |
| Initialise app once | Module-level code or a guarded `if (!didInit)` at module scope. |
| Form field state/validation | react-hook-form + zod. |
| Debounce search input | `useDeferredValue` or debounced handler; query key holds the value. |
| URL-driven state | search params (Next `useSearchParams` / TanStack Router `validateSearch`). |
| Copy/share the current URL, read `navigator` for an action | Read `window.location` / `navigator` inside the click handler. |
| Show different UI per viewport | Tailwind breakpoints (`hidden md:block`) — no JS. |
| Render based on a browser-only value (UA, `matchMedia`, online) | `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` in a `shared/hooks` hook. |
| Navigate after an action | `<Link>`, `redirect()` in the Server Action, or `router.push` in the handler — never an effect watching a flag. |

## Hydration safety (Next / SSR)

Client components are also rendered on the server. A value that differs
between server and browser (`navigator`, `window`, `Date.now()`,
`Math.random()`, `localStorage`) must not be read **during render** behind a
`typeof window !== 'undefined'` check — that causes a hydration mismatch.
Use, in order: CSS, a `useSyncExternalStore` hook with a server snapshot,
passing the value from the server (cookie, header), or `next/dynamic` with
`ssr: false` for a whole browser-only widget.

## Legitimate uses (still keep them small)

- Subscribing to browser APIs: `resize`, `IntersectionObserver`, `matchMedia`
  (prefer a reusable hook in `shared/hooks`).
- Integrating a non-React widget (map, chart, editor) — init + cleanup.
- WebSocket / EventSource connection.
- Focus management after mount when `autoFocus` is not enough.

Each legitimate effect must:

1. have a one-line comment naming the external system,
2. return a cleanup function,
3. depend on primitives (narrow dependencies),
4. live in a named custom hook (`useWindowSize`), not inline in a component.

## Review question

"If I delete this effect, what external system goes out of sync?" — if the
answer is "none", delete it.
