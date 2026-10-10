# UI — Tailwind CSS v4 + shadcn/ui

## Setup

```bash
npx shadcn@latest init        # choose: new-york style, CSS variables, neutral base
npx shadcn@latest add button input form dialog dropdown-menu sonner skeleton
```

`components.json` aliases for FSD:

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
import { cva, type VariantProps } from 'class-variance-authority'
const badge = cva('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', {
  variants: {
    intent: {
      neutral: 'bg-muted text-muted-foreground',
      success: 'bg-success/15 text-success',
      danger: 'bg-destructive/15 text-destructive',
    },
  },
  defaultVariants: { intent: 'neutral' },
})
type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badge>
export function Badge({ className, intent, ...props }: BadgeProps) {
  return <span className={cn(badge({ intent }), className)} {...props} />
}
```

- **Tokens only:** colours from CSS variables (`bg-primary`, `text-muted-foreground`),
  spacing from the scale. No hex colours, no arbitrary values (`mt-[13px]`)
  without a comment.
- Mobile-first: base classes = mobile, then `sm:` `md:` `lg:`.
- Dark mode via `.dark` class + tokens (`next-themes` in Next).
- Forms: shadcn `Form` + react-hook-form + zod.
- Toasts: `sonner`. Icons: `lucide-react` with `aria-hidden` when decorative.

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
widgets; virtualise long lists; `content-visibility: auto` for long sections.
