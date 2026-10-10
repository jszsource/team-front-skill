---
name: front-template
description: Generates ready-to-use code templates in the team frontend format (team-frontend standards) — a full new Next.js or React project skeleton, an FSD slice (entity / feature / widget / view) with ui/model/api/lib/index.ts and Vitest tests, or a single component with its local components/ folder. Use when the user runs /front-template, or asks to scaffold/generate/create a template, boilerplate, starter, new project, new page, new entity, new feature, new widget or new component in a Next.js or React project.
argument-hint: "react | next | project <name> [next|react] | entity|feature|widget|view <name> | component <slice-path> <Name>"
---

# Front Template

Generates files in **exactly** the team format. The standard is
`../team-frontend/STANDARDS.md`; detailed rules live in
`../team-frontend/references/`. File templates for this skill live in
`templates/`. Everything is local — do not browse the web for the format.

## Step 0 — Parse the request

`$ARGUMENTS` (or the user's words) selects the mode:

| Mode | Example | Template file |
| --- | --- | --- |
| `react [name]` | `react` | `templates/project.md` § A — React **Vite** project **in the current folder** |
| `next [name]` | `next` | `templates/project.md` § B — latest Next.js **in the current folder** |
| `project <name> [next\|react]` | `project shop-admin react` | `templates/project.md` — new project in a **new sub-folder** `<name>/` (React = **Vite** + TanStack Router) |
| `entity <name>` | `entity product` | `templates/slices.md` § Entity |
| `feature <name>` | `feature add-to-cart` | `templates/slices.md` § Feature |
| `widget <name>` | `widget product-list` | `templates/slices.md` § Widget |
| `view <name>` | `view product` | `templates/slices.md` § View (+ route file) |
| `component <slice-path> <Name>` | `component widgets/header UserMenu` | `templates/component.md` |

Rules for the first argument:

- `react` / `next` (case-insensitive; also `vite`, `react-vite` → `react`;
  `nextjs`, `next.js` → `next`) → **in-place project mode**: scaffold the
  project **inside the current working folder** — no sub-folder. The package
  name is the optional `[name]`, else the current folder's name converted to
  lowercase kebab-case (npm rule).
- No arguments and the current folder has **no `package.json`** → it is a new
  project: ask one question — "React (Vite) or Next.js?" — then run in-place
  project mode.
- No arguments and `package.json` exists → ask which slice/component to create.

If the mode or name is missing otherwise, ask **one** short question listing these modes.
Names are given in kebab-case; derive the placeholders:

| Placeholder | Example (`add-to-cart`) |
| --- | --- |
| `__name__` | `add-to-cart` (folders, slice name) |
| `__Name__` | `AddToCart` (components, types) |
| `__camel__` | `addToCart` (stores, functions, keys) |

## Step 1 — Detect the target (not for `react` / `next` / `project`)

1. Read `package.json`: `next` → **Next mode**, `react` without `next` →
   **React mode**. No `package.json`, or neither dependency → this is not a
   project yet: offer `react` (Vite) or `next` in-place mode.
2. Check the FSD root (`src/`) and `@/*` alias exist. Missing → tell the user and
   offer `/front-setup` first; do not silently invent a different structure.
3. Refuse to overwrite: if the slice/component already exists, stop and ask.
4. Check layer rules (`../team-frontend/references/fsd.md`): the name must fit
   the layer (entity = noun, feature = verb/action, widget = composed block,
   view = one screen). If it doesn't, say which layer fits and ask.

## Step 2 — Ask only what changes the output

Ask at most these, in one message, only when not obvious from the request:

- **entity**: main fields of the type (else generate `id`, `name`, `createdAt`
  and mark with `// TODO: real fields`), API path (default `/__name__s`).
- **feature**: which entity it acts on; is it a mutation (form/button) or a
  client-state toggle (Zustand)?
- **widget / view**: which entities/features it composes.

## Step 3 — Generate

Copy the template, replace placeholders, then adapt to the answers. Hard rules
from the standard apply to every generated file:

- every `.tsx` ≤ 150 lines; sub-components go to `components/` next to parent;
- one component per file, `type XxxProps` in the same file, no `forwardRef`;
- Next: Server Component by default, `"use client"` only on the interactive leaf;
- no `useEffect` (use the replacements in `use-effect.md`);
- HTTP only via `http` from `@/shared/api`; server data via TanStack Query
  `queryOptions` factory; shared client state via Zustand with selectors;
- UI from `@/shared/ui` (shadcn) + Tailwind tokens, accessible, with loading /
  empty / error states;
- slice public API only through `index.ts`; sub-components never exported;
- a Vitest test for every `model/`, `lib/`, `api/` unit and every
  feature/widget component (MSW for network).

If a shadcn primitive used by the template is missing in `src/shared/ui`, run
`npx shadcn@latest add <name>` (ask first if the project has no `components.json`).
If MSW handlers file exists, append the slice's handler to it.

## Step 4 — Verify and report

1. Run `npm run lint`, `npm run typecheck`, `npm run test` (only the ones that
   exist). Fix what the template introduced. Report real results; never claim
   green without running.
2. Print the created file tree and one line on how to use it
   (e.g. `import { ProductCard } from '@/entities/product'`).
3. List any `// TODO` left for the user (real fields, endpoints, copy text).
