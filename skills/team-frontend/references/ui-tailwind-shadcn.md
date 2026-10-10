# UI — Tailwind CSS v4 + shadcn/ui

Applies to the `next` and `shadcn-tailwind-tanstack-router` profiles (both
FSD, STANDARDS §1.1, §8). **`antd-scss-react-router` projects (Ant Design v5 +
SCSS modules, no Tailwind) read `ui-antd-scss.md` instead** — it carries its
own accessibility, async-state, forms, tables and performance rules.

| | Path (FSD) |
| --- | --- |
| shadcn components | `shared/ui/` |
| `cn()` | `shared/lib/cn.ts` |
| zod schemas | `<slice>/model/{name}.schema.ts` |

## Setup

```bash
npx shadcn@latest init        # choose: new-york style, CSS variables, neutral base
npx shadcn@latest add button input form dialog dropdown-menu sonner skeleton
```

`components.json` aliases:

```json
{
  "aliases": {
    "components": "@/shared/ui",
    "ui": "@/shared/ui",
    "utils": "@/shared/lib/cn",
    "hooks": "@/shared/hooks",
    "lib": "@/shared/lib"
  }
}
```

Tailwind v4: config lives in CSS (`@import "tailwindcss";` + `@theme { … }`),
no `tailwind.config.js` unless a plugin needs it. Prettier with
`prettier-plugin-tailwindcss` sorts classes.

## Rules

- Build product UI by **composing** shadcn primitives from `@/shared/ui`.
  Change `shared/ui/*` source only for design-system-wide changes.
- `cn()` (`clsx` + `tailwind-merge`) for conditional classes; never string
  concatenation.
- Variants via `cva`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
const badge = cva("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", {
  variants: {
    intent: {
      neutral: "bg-muted text-muted-foreground",
      success: "bg-success/15 text-success",
      danger: "bg-destructive/15 text-destructive",
    },
  },
  defaultVariants: { intent: "neutral" },
});
type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badge>;
export function Badge({ className, intent, ...props }: BadgeProps) {
  return <span className={cn(badge({ intent }), className)} {...props} />;
}
```

- **Tokens only:** colours from CSS variables (`bg-primary`, `text-muted-foreground`),
  spacing from the scale. No hex colours, no arbitrary values (`mt-[13px]`)
  without a comment.
- Mobile-first: base classes = mobile, then `sm:` `md:` `lg:`.
- Dark mode via `.dark` class + tokens (`next-themes` in Next).
- Forms: shadcn `Form` + react-hook-form + zod — template below.
- Toasts: `sonner` (5xx toasts come only from the HTTP interceptor,
  `http-axios.md`). Icons: `lucide-react`, named imports, `aria-hidden` when decorative.
- **Icon-only buttons have an `aria-label`** (translated in multi-locale products):

```tsx
import { X } from "lucide-react";
import { Button } from "@/shared/ui/button";

<Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
  <X aria-hidden="true" />
</Button>;
```

## Forms — react-hook-form + zod + shadcn `Form`

Schema in its own file, form rendered only with the shadcn wrappers
(`Form` / `FormField` / `FormItem` / `FormLabel` / `FormControl` /
`FormMessage`) — they wire `id`, `htmlFor`, `aria-describedby` and
`aria-invalid`. **No hand-written error markup.**

```ts
// features/create-inspection/model/inspection.schema.ts
import { z } from "zod";

export const inspectionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  notes: z.string().trim().max(2000).optional(),
});

export type InspectionInput = z.infer<typeof inspectionSchema>;
```

```tsx
// features/create-inspection/ui/InspectionForm.tsx
// Next.js: add "use client" — this is an interactive leaf
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { applyServerErrors, isClientError } from "@/shared/lib/apply-server-errors";
import { useCreateInspectionMutation } from "../api/inspection.queries";
import { inspectionSchema, type InspectionInput } from "../model/inspection.schema";

export function InspectionForm() {
  const form = useForm<InspectionInput>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: { title: "", notes: "" },
  });
  const createInspection = useCreateInspectionMutation();

  const submit = async (values: InspectionInput) => {
    try {
      await createInspection.mutateAsync(values);
      form.reset();
    } catch (error) {
      // field errors → into the form; other 4xx → one toast (5xx already toasted by the interceptor)
      if (!applyServerErrors(form, error) && isClientError(error)) toast.error(error.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(submit)(e)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Save
        </Button>
      </form>
    </Form>
  );
}
```

```ts
// shared/lib/apply-server-errors.ts — maps ApiError field errors into react-hook-form
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/shared/api/api-error";

// Adapt to the backend contract; this assumes { errors: { field: ["message"] } } on 400/422.
type FieldErrorBody = { errors?: Record<string, string[] | string> };

/** Returns true when at least one field error was applied. */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
): boolean {
  if (!(error instanceof ApiError) || (error.status !== 400 && error.status !== 422)) return false;
  const fieldErrors = Object.entries((error.details as FieldErrorBody | undefined)?.errors ?? {});
  for (const [name, messages] of fieldErrors) {
    const message = Array.isArray(messages) ? messages[0] : messages;
    form.setError(name as Path<T>, { type: "server", message }, { shouldFocus: true });
  }
  return fieldErrors.length > 0;
}

export function isClientError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError && error.status !== null && error.status >= 400 && error.status < 500
  );
}
```

Rules:

- Server validation errors go back into the form with `form.setError` (never
  a separate error banner duplicating field messages).
- `onSubmit={(e) => void form.handleSubmit(submit)(e)}` — satisfies
  `no-misused-promises`.
- Disable submit while `isSubmitting`; destructive submits need a confirm dialog.
- Next.js Server Action forms: same schema file, validated again on the server
  (`security.md`); return field errors in the `useActionState` state and apply
  them with `form.setError`.

## Design quality

- One cohesive palette: neutral base + one primary + semantic (success,
  warning, destructive). Dominant colour with sharp accents beats evenly
  distributed colours.
- Typographic scale with clear hierarchy (e.g. 12/14/16/20/24/30/36); max 2
  font families, loaded with `next/font`. Line length 60–75 characters.
- Consistent spacing rhythm (4px grid); generous whitespace; align to a grid.
- Simplicity through reduction: remove until only the essential remains.
- Progressive disclosure: summary → details → advanced.
- Feedback within 100 ms for every interaction (pressed/pending state).
- Prevent errors (disable invalid submit, confirm destructive actions) and
  allow recovery (undo toast).
- Motion: 150–300 ms, ease-out for enter, ease-in for exit; animate only
  `transform` and `opacity`; wrap in `motion-safe:` / respect
  `prefers-reduced-motion`.
- Composition over configuration: no boolean-prop soup on UI components.

## Accessibility checklist (mandatory)

- [ ] Semantic HTML (`button` for actions, `a` for navigation, landmarks,
      one `h1`, ordered headings)
- [ ] Every input has a visible `<Label>`; errors linked via `aria-describedby`
- [ ] Icon-only buttons have `aria-label`; decorative icons `aria-hidden`
- [ ] Visible focus ring (`focus-visible:ring-2`); never `outline-none` without replacement
- [ ] Full keyboard navigation; logical tab order; focus trapped in dialogs and
      restored on close (Radix does this — don't break it)
- [ ] Contrast ≥ 4.5:1 text, ≥ 3:1 large text/UI; check both themes
- [ ] Information not conveyed by colour alone (icons/text for status, links underlined)
- [ ] Images: meaningful `alt`, decorative `alt=""`
- [ ] Touch targets ≥ 44×44 px; `cursor-pointer` on clickable non-buttons
- [ ] Live regions (`aria-live="polite"`) for async status messages
- [ ] Descriptive link text (no "click here")

## States every async UI must have

Loading (skeleton matching final layout, no layout shift) · Empty (message +
primary action) · Error (message + retry) · Success.

## Performance

`next/image` with `sizes`, lazy below the fold; `next/dynamic` for heavy
widgets; `content-visibility: auto` for long sections.

### Long lists — virtualise over 100 rows

Any list/table that can render **more than 100 rows** uses `@tanstack/react-virtual`
(or server pagination that keeps pages ≤ 100):

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { Inspection } from "../types";
import { InspectionRow } from "./components/InspectionRow";

export type InspectionListProps = { items: Inspection[] };

export function InspectionList({ items }: InspectionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // row height in px
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="h-150 overflow-auto">
      <ul className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index];
          if (!item) return null;
          return (
            <li
              key={row.key}
              className="absolute inset-x-0 top-0"
              style={{ height: row.size, transform: `translateY(${row.start}px)` }}
            >
              <InspectionRow inspection={item} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

React Compiler: `react-hooks` may report `useVirtualizer` / `useReactTable` as
incompatible libraries; keep those components small and, if rows render stale,
add the `"use no memo"` directive to that component only.

### Data tables — `@tanstack/react-table`

- One headless wrapper in the UI kit: `shared/ui/data-table/DataTable.tsx`,
  built from the shadcn
  `Table` primitives; it owns rendering, sorting indicators, empty/loading
  rows and (over 100 rows) virtualisation.
- Each feature defines only its `columns.tsx` (`ColumnDef<T>[]`) and passes
  data from a query hook. Sorting, filtering and pagination that hit the API
  live in URL search params → query key (`state-data.md`), with
  `manualPagination` / `manualSorting`.
- No second table/grid library.

### Lazy-load heavy, rarely shown parts

Charts, rich-text/code editors, maps, PDF/Excel export, big dialogs are split
out and loaded on demand with a skeleton fallback:

```tsx
import { lazy, Suspense } from "react";
import { Skeleton } from "@/shared/ui/skeleton";

const ExportDialog = lazy(() =>
  import("./components/ExportDialog").then((m) => ({ default: m.ExportDialog })),
);

// render only when needed
{
  isExportOpen && (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ExportDialog onClose={closeExport} />
    </Suspense>
  );
}
```

Next.js: `next/dynamic(() => import(…), { loading: () => <Skeleton … /> })`
(`ssr: false` only inside a client component). Libraries used only inside an
action (e.g. the Excel writer) are imported with `await import(…)` in the
event handler.
