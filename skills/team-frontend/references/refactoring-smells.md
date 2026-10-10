# Code smells and refactorings (frontend edition)

Common code smells mapped to React/TS/FSD.

## Bloaters

| Smell | Frontend signal | Refactoring |
| --- | --- | --- |
| **Long Method** | component > 150 lines, hook > 80, function > 40 | Extract Function → `lib/`; Extract Hook → `model/`; Extract Component → local `components/`; Replace Temp with Query (derive during render) |
| **Large Class** | component/store with many responsibilities | Extract Component / split store by concern; Extract Interface (props type) |
| **Primitive Obsession** | `status: string`, `role: string`, raw ids everywhere | union literal types, branded types (`type UserId = string & { __brand: 'UserId' }`), zod schemas, constants objects |
| **Long Parameter List** | > 5 props or function args | Introduce Parameter Object; Preserve Whole Object (pass `user` not 5 user fields); composition via `children` |
| **Data Clumps** | same group of props passed together | group into a typed object / dedicated component |

## Object-orientation abusers (React equivalents)

| Smell | Signal | Refactoring |
| --- | --- | --- |
| **Switch Statements** | `switch(type)` returning different JSX, repeated in several places | Replace Conditional with Polymorphism → `const viewByType: Record<Type, Component>` map |
| **Temporary Field** | state/props used only in one mode | split into explicit variant components |
| **Refused Bequest** | wrapper component ignoring most props of what it wraps | compose instead of wrapping; narrow props type |
| **Alternative Classes with Different Interfaces** | two components doing the same with different prop names | unify API, keep one |

## Change preventers

| Smell | Signal | Refactoring |
| --- | --- | --- |
| **Divergent Change** | one file edited for unrelated reasons (UI + API + validation) | split into FSD segments `ui/` `model/` `api/` |
| **Shotgun Surgery** | one business change touches many slices | Move Function/Field into a single entity/feature; expose via public API |
| **Parallel Inheritance Hierarchies** | every new type requires a new component + new hook + new case elsewhere | config-driven map; one generic component |

## Dispensables

| Smell | Refactoring |
| --- | --- |
| **Comments** explaining *what* code does | Rename, Extract Function. Keep comments only for *why*. |
| **Duplicate Code** | Extract Component/Hook/Function into the lowest correct FSD layer |
| **Lazy Class** (component that adds nothing) | Inline Component |
| **Data Class** (types with logic scattered elsewhere) | move related pure functions next to the type in `model/` / `lib/` |
| **Dead Code** (unused exports, props, files, feature flags) | delete (`knip` helps find it) |
| **Speculative Generality** (props/options "for later") | delete, YAGNI |

## Couplers

| Smell | Signal | Refactoring |
| --- | --- | --- |
| **Feature Envy** | component computes on another slice's data a lot | Move Function into that slice, export via public API |
| **Inappropriate Intimacy** | importing another slice's internals | public API only; same-layer cross-import → compose one layer up |
| **Message Chains** | `order.customer.address.city.name` in JSX | selector / mapper in `model/` (Hide Delegate) |
| **Middle Man** | component that only forwards props | Remove Middle Man / inline |
| **Incomplete Library Class** | patching shadcn/axios behaviour everywhere | wrap once in `shared/` (Introduce Local Extension) |

## React-specific smells

| Smell | Fix |
| --- | --- |
| Unjustified `useEffect` | see `use-effect.md` |
| Derived state stored in `useState` | compute during render |
| Prop drilling > 2 levels | composition or Zustand |
| Boolean prop soup — booleans that switch layout/structure or behaviour mode (`isCompact`, `withHeader`, `isAdmin`); > 2 such booleans → split | `cva` variants / composition / explicit variant component. State/ARIA-like and native-mirroring booleans (`disabled`, `open`, `checked`, `required`, `loading`, `readOnly`, `invalid`) are fine — see `components.md` |
| Component defined inside component | move to own file |
| Unnecessary `"use client"` (Next) | push boundary to a leaf |
| Server data copied into Zustand | read from Query |
| `axios` imported outside `shared/api` | use `http` |
| `{count && <X/>}` | `{count > 0 && <X/>}` |
| Index as key in dynamic lists | stable id |
| Manual `useMemo`/`useCallback` everywhere with React Compiler on | remove |

## Refactoring procedure

1. Ensure tests cover current behaviour (write characterisation tests first if missing).
2. Apply one refactoring at a time; keep behaviour identical.
3. Run tests after each step.
4. Commit refactor separately from feature changes (`refactor:` commit type).
