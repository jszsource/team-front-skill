# Components — size, decomposition, composition

## Size limit

- **Max 150 lines per `.tsx` file** — the whole file, imports, types and helpers included, blank lines and comments excluded (ESLint `max-lines: ["error", { max: 150, skipBlankLines: true, skipComments: true }]`).
- Target ≤100. Hooks ≤80 lines. Functions ≤40 lines.

## Decomposition procedure

When a component approaches 150 lines (or has more than one responsibility):

1. **Derived values** → compute as `const` during render, or move to a pure
   function in the slice's `lib/`.
2. **Stateful logic** → custom hook in `model/` (`useProductFilters`).
3. **JSX blocks** → sub-components in a `components/` folder **next to the
   parent**:

```
features/checkout-form/ui/
├── CheckoutForm.tsx              # orchestrates, ≤150 lines
└── components/
    ├── ShippingSection.tsx
    ├── PaymentSection/
    │   ├── PaymentSection.tsx
    │   └── components/CardFields.tsx   # nested decomposition repeats the rule
    └── OrderSummary.tsx
```

4. Sub-components in `components/` are **private** to the parent — not exported
   from the slice `index.ts`. Second consumer appears → promote to the right
   layer.
5. Each extracted piece gets its own test if it contains logic.

Good split boundaries: visually distinct sections, list item vs list, form
sections, header/body/footer, each conditional branch rendering a different
view (replace `switch` with a component map).

## Rules

- One exported component per file, named like the file.
- **Never define a component inside another component** (remounts every render).
- Props type in the same file: `type ButtonGroupProps = { … }`.
- Destructure props in the signature; default values there.
- Early returns for loading/empty/error states keep JSX flat.
- Conditional rendering: `{count > 0 && …}` — never `{count && …}` (renders `0`).
- Hoist static JSX/objects outside the component.
- Lists need stable `key` from data (never index for reorderable lists).

## Composition over configuration

Bad:

```tsx
<Card compact withHeader showFooter isEditable />;
```

Good — compound + explicit variants:

```tsx
<Card>
  <Card.Header>…</Card.Header>
  <Card.Body>…</Card.Body>
</Card>
<EditableCard />   // explicit variant component instead of isEditable
```

### Boolean props — what's allowed

- **Allowed:** state / ARIA-like booleans and props that mirror native
  attributes — `disabled`, `open`, `checked`, `required`, `loading`,
  `readOnly`, `invalid`, `selected`, `defaultOpen`. They describe *state*, not
  a different component.
- **Not allowed:** booleans that switch layout/structure or behaviour mode —
  `isCompact`, `withHeader`, `showFooter`, `isEditable`, `isAdmin`. Use `cva`
  variants (`variant="compact"`), composition (`<Card.Header>`) or an explicit
  variant component (`<EditableCard/>`).
- **Rule of thumb:** more than 2 behaviour/structure booleans on one component
  → split it.

```tsx
<Button disabled loading>Save</Button>               // ok — state
<Dialog open onOpenChange={setOpen}>…</Dialog>        // ok — state
<Card variant="compact">…</Card>                      // ok — cva variant
<UserTable isAdmin showActions isCompact />           // bad — split / compose
```

- Style variants (size, intent) → `cva` variants, not booleans.
- `children` / named slot props (`header`, `footer`) over render props.
- Headless logic (hook) + presentational component for reusable widgets.
- React 19: `ref` is a regular prop; no `forwardRef`. `use(Context)` over `useContext`.
- Polymorphism via Radix `Slot` / `asChild` (shadcn style), not custom `as` hacks.

## Container / presentational

- **Next:** the async Server Component is the container; it fetches and passes
  data to a presentational component.
- **React:** the route `loader` + `useSuspenseQuery` in a thin container; the
  presentational component only receives props.
- Presentational components: no fetching, no store access, pure props → JSX.
  These are the easiest to unit test.

## Prop drilling

More than 2 levels → restructure with `children` composition first; if state
is genuinely shared, use a Zustand store (or a small context for compound
components).
