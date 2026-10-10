# Component template

`component <slice-path> <Name>` — e.g. `component widgets/product-list ProductListItem`.

## Where it goes

- `<slice-path>` exists and `<Name>` is a **new public component** of the slice →
  `src/<slice-path>/ui/__Name__.tsx` and export it from `index.ts`.
- `<Name>` is a **part of an existing component** `Parent` → private
  sub-component: `src/<slice-path>/ui/components/__Name__.tsx` (or, when the
  parent itself is in `components/`, nested
  `components/Parent/components/__Name__.tsx`). Do **not** export it from
  `index.ts`. Ask which parent if unclear.
- Business-agnostic (no domain words) → `src/shared/ui/__name__/` instead; tell
  the user why.

**`antd-scss-react-router` profile** (STANDARDS §2.5, `../team-frontend/references/feature-architecture.md`) —
`component features/<domain> <Name>`:

- New component of the domain → `src/features/<domain>/components/__Name__.tsx`;
  export it from the feature's `index.ts` only if another feature or a route
  uses it.
- Part of an existing component `Parent` → `components/Parent/components/__Name__.tsx`
  (move `Parent.tsx` into `components/Parent/` if it is not there yet); never exported.
- App-wide chrome (header, sidebar, nav) → `src/app/layout/__Name__.tsx`.
- Business-agnostic → `src/shared/components/__Name__.tsx` (+ `__Name__.module.scss`).
- The code below changes accordingly (`../team-frontend/references/ui-antd-scss.md`):
  no Tailwind, no `cn()`, no `cva` — UI from `antd` (`Flex`, `Typography`,
  `Button` …), styling via AntD props / theme tokens, then a co-located
  `__Name__.module.scss` (`import styles from "./__Name__.module.scss";`,
  classes joined as `[styles.root, className].filter(Boolean).join(" ")`);
  variants are AntD props or SCSS modifier classes picked from a typed
  `variant` prop; `renderWithProviders` / `screen` from `@/test/test-utils`.
  No `"use client"`.

```tsx
// features/<domain>/components/__Name__.tsx — antd-scss-react-router
import { Flex, Typography } from "antd";

import styles from "./__Name__.module.scss";

import type { ReactNode } from "react";

export type __Name__Props = { title: string; className?: string; children?: ReactNode };

export function __Name__({ title, className, children }: __Name__Props) {
  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby="__name__-title"
    >
      <Flex vertical gap="middle">
        <Typography.Title level={2} id="__name__-title">
          {title}
        </Typography.Title>
        {children}
      </Flex>
    </section>
  );
}
```

## Presentational component (default)

```tsx
// ui/__Name__.tsx
import { cn } from "@/shared/lib/cn";

type __Name__Props = {
  title: string;
  className?: string;
  children?: React.ReactNode;
};

export function __Name__({ title, className, children }: __Name__Props) {
  return (
    <section className={cn("flex flex-col gap-4", className)} aria-labelledby="__name__-title">
      <h2 id="__name__-title" className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
```

## Interactive leaf (only if it needs state/handlers)

```tsx
// ui/components/__Name__.tsx
"use client"; // Next only — omit in React mode

import { useState } from "react";
import { Button } from "@/shared/ui/button";

type __Name__Props = { label: string; onConfirm: () => void };

export function __Name__({ label, onConfirm }: __Name__Props) {
  const [isPending, setIsPending] = useState(false);

  function handleClick() {
    setIsPending(true);
    onConfirm();
  }

  return (
    <Button onClick={handleClick} disabled={isPending} aria-busy={isPending}>
      {label}
    </Button>
  );
}
```

## Variants — `cva`, not layout/behaviour booleans

- **Fine:** state / ARIA-like booleans and props mirroring native attributes —
  `disabled`, `open`, `checked`, `required`, `loading`, `readOnly`, `invalid`.
- **Not fine:** booleans that switch layout, structure or behaviour mode —
  `isCompact`, `withHeader`, `isAdmin`. Use a `cva` variant, composition
  (`children` / slots) or an explicit variant component (`<CompactCard/>`).
- More than 2 behaviour booleans on one component → split it
  (`../team-frontend/references/components.md`).

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const __camel__Variants = cva("rounded-lg border p-4", {
  variants: { tone: { default: "bg-card", muted: "bg-muted" } },
  defaultVariants: { tone: "default" },
});

type __Name__Props = React.ComponentProps<"div"> & VariantProps<typeof __camel__Variants>;
```

## Strings, RTL, server code

- i18n enabled (`next-intl` / `react-i18next` in `package.json`): no literal
  user-facing strings (text, `aria-label`, `alt`, `placeholder`) in
  `views`/`widgets`/`features` components — `t('key')` from the slice
  namespace, or receive translated text via props (`entities`, `shared/ui`).
- Spacing/alignment with logical utilities (`ms-*`/`me-*`, `ps-*`/`pe-*`,
  `text-start`) so the component works in RTL.
- A Server Component that needs data calls the slice's `api/*.server.ts`
  (`serverFetch`); it never imports `http`/axios.

## Test (when the component has logic or interaction)

```tsx
// ui/__Name__.test.tsx
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/config/tests/render";
import { __Name__ } from "./__Name__";

describe("__Name__", () => {
  it("renders the title", () => {
    renderWithProviders(<__Name__ title="Hello" />);
    expect(screen.getByRole("heading", { name: "Hello" })).toBeInTheDocument();
  });
});
```

## Decomposition check

After generating, if the parent file now exceeds 150 lines, move JSX blocks
into `components/` following `../team-frontend/references/components.md`.
