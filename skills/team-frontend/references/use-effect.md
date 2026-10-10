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
