# UI — Ant Design v5 + SCSS modules (`antd-scss-react-router` profile)

The UI reference for the `antd-scss-react-router` profile (STANDARDS §1.1, §8).
Styling = AntD theme tokens (`ConfigProvider`) + SCSS modules + one small
`globals.scss`. **No Tailwind** in this profile: no preflight, no utility
classes, no `cn()` / `cva`, no `prettier-plugin-tailwindcss`. Everything else in
§8 applies: accessibility, loading/empty/error states, motion, RHF + zod forms,
virtualised long lists. Next.js and `shadcn-tailwind-tanstack-router` read
`ui-tailwind-shadcn.md` instead.

**Never mix shadcn/ui (or Radix, MUI, …) or Tailwind with Ant Design in one
project.** A project that has both is a mixed project (§1.1): follow what the
code uses, report the deviation, don't fix it unasked.

## Setup

```bash
npm i antd@5 @ant-design/cssinjs dayjs lucide-react
npm i -D sass-embedded
# React 19 + antd v5 only:
npm i @ant-design/v5-patch-for-react-19
```

```tsx
// src/app/main.tsx — first imports
import "@ant-design/v5-patch-for-react-19"; // antd v5 on React 19; drop after a major upgrade
import "@/styles/globals.scss";
```

- `@ant-design/cssinjs` must match the version `antd` depends on (check the
  lockfile) — it provides `StyleProvider`.
- antd v5 ships ESM and tree-shakes: `import { Button, Table } from "antd";`.
  No `babel-plugin-import`, no `antd/dist/antd.css`. The global reset is the
  small one in `globals.scss` (below), not `antd/dist/reset.css` (unlayered, it
  would beat the `antd` layer).
- Vite compiles `.scss` with `sass-embedded`; no Vite plugin, no PostCSS config.

## Providers, cascade layers and `globals.scss`

AntD injects CSS-in-JS. `StyleProvider layer` puts it into `@layer antd`, so a
reset can sit below it and every unlayered SCSS module wins over AntD without
`!important` or specificity hacks.

```tsx
// src/app/providers/AntdProvider.tsx
import { StyleProvider } from "@ant-design/cssinjs";
import { App, ConfigProvider, theme } from "antd";
import type { ReactNode } from "react";

import { NotifyBridge } from "@/shared/components/NotifyBridge";
import { appTheme } from "@/shared/lib/theme";
import { useUiPrefsStore } from "@/shared/stores/ui-prefs.store";

export function AntdProvider({ children }: { children: ReactNode }) {
  const isDark = useUiPrefsStore((s) => s.colorScheme === "dark");

  return (
    <StyleProvider layer>
      <ConfigProvider
        theme={{ ...appTheme, algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}
      >
        <App>
          <NotifyBridge />
          {children}
        </App>
      </ConfigProvider>
    </StyleProvider>
  );
}
```

```scss
// src/styles/globals.scss — the only global stylesheet; keep it small
@layer reset, antd; // declared first: reset < antd < unlayered SCSS modules

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
    -webkit-font-smoothing: antialiased;
  }
}
```

- `globals.scss` holds only the layer order, the reset and page-level rules
  (`html`/`body`/`#root`). Fonts, colours and typography come from tokens:
  `<App>` applies `fontFamily`, `colorText`, `fontSize`, and the root
  `RootLayout` uses AntD `Layout` (`colorBgLayout` background).
- Dark mode: the `ui-prefs` store action that switches the scheme is the only
  switch — AntD follows via `algorithm`, SCSS via the token CSS variables
  (below). No `useEffect`, no `.dark` class.

## Theme — one file

```ts
// src/shared/lib/theme.ts
import type { ThemeConfig } from "antd";

export const appTheme: ThemeConfig = {
  cssVar: true, // exposes tokens as --ant-* CSS variables for SCSS modules
  hashed: false, // one theme per app: stable class names, smaller CSS
  token: {
    colorPrimary: "#1d4ed8",
    borderRadius: 6,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  components: {
    Table: { headerBg: "#f8fafc" },
    Button: { controlHeight: 40 },
  },
};
```

- Design tokens live **only** here. No hex colours in components or SCSS —
  read tokens with `theme.useToken()` in TSX or the `--ant-*` CSS variables in
  SCSS (`var(--ant-color-primary)`, `var(--ant-padding-lg)`); the variables are
  defined on AntD components and on everything inside `<App>`.
- Customise in this order: global `token` → per-component `components` token →
  semantic `classNames` / `styles` props → SCSS module (last resort).
- Locale: `ConfigProvider locale={…}` from `antd/locale/<xx_XX>` + the matching
  `dayjs/locale/<xx>`; multi-locale products import both lazily on language
  change (`i18n.md`). RTL: `ConfigProvider direction="rtl"`.

## Messages, notifications, modals — `App.useApp()`

Static `message.*`, `notification.*`, `Modal.confirm` don't see
`ConfigProvider` (theme, locale, dark mode) — forbidden.

```tsx
const { message, modal } = App.useApp();

const onDelete = () =>
  modal.confirm({
    title: "Delete inspection?",
    okButtonProps: { danger: true },
    onOk: () => deleteMutation.mutateAsync(id).then(() => message.success("Deleted")),
  });
```

Code outside React (the 5xx toast in `http-client.ts`, mutation `onError` in
`queries/`) uses a tiny bridge, filled once by `<NotifyBridge />` inside `<App>`:

```ts
// shared/lib/notify.ts
import type { App } from "antd";

type MessageInstance = ReturnType<typeof App.useApp>["message"];

let instance: MessageInstance | null = null;

export const notify = {
  register: (m: MessageInstance | null) => {
    instance = m;
  },
  success: (text: string) => void instance?.success(text),
  // key: same key replaces the visible message instead of stacking (e.g. retried 5xx)
  error: (text: string, key?: string) => void instance?.open({ type: "error", content: text, key }),
};
```

```tsx
// shared/components/NotifyBridge.tsx
import { App } from "antd";
import { useEffect } from "react";

import { notify } from "@/shared/lib/notify";

export function NotifyBridge() {
  const { message } = App.useApp();
  // sync with an external module: lets non-React code show themed messages
  useEffect(() => {
    notify.register(message);
    return () => notify.register(null);
  }, [message]);
  return null;
}
```

`sonner` is not installed in this profile (one toast system). ESLint:

```js
"no-restricted-imports": ["error", { paths: [
  { name: "antd", importNames: ["message", "notification"], message: "Use App.useApp() or notify." },
  { name: "sonner", message: "Toasts via App.useApp() or notify (ui-antd-scss.md)." },
] }],
"no-restricted-syntax": ["error", {
  selector: "MemberExpression[object.name='Modal'][property.name=/^(confirm|info|success|error|warning)$/]",
  message: "Use App.useApp().modal.",
}],
```

(Merge `paths` with the axios entry from `feature-architecture.md` — a later
`no-restricted-imports` replaces an earlier one.)

## Layout and spacing

- Component-level layout: AntD `Flex` (`gap="middle"`, `vertical`,
  `justify`/`align`), `Space` for inline groups of controls, `Row`/`Col` for
  form and card grids, `Layout` (`Header`/`Sider`/`Content`) for app chrome in
  `src/app/layout/`.
- Page-level layouts that props can't express (`grid-template-areas`, sticky
  panels, print) → the page component's SCSS module.
- Spacing only from tokens: `gap` sizes (`small`/`middle`/`large`) or
  `var(--ant-padding*)` / `var(--ant-margin*)` in SCSS — no raw `px` values
  without a comment. Logical properties (`margin-inline-start`,
  `padding-inline`) so RTL works (`i18n.md`).
- Responsive: `Col` breakpoint props (`xs`/`md`/`lg`) or `Grid.useBreakpoint()`
  in TSX; in SCSS the `_mixins.scss` breakpoint mixins, mobile-first
  (`min-width`), using AntD's breakpoints (576/768/992/1200/1600).
- Never style AntD internals with deep descendant selectors when a token or
  `classNames`/`styles` prop exists.

## SCSS modules — only what tokens and props can't do

- Allowed for: page/section layout, complex selectors/states,
  `:global(.ant-…)` overrides that no component token covers (comment why),
  keyframes, `grid-template-areas`, print styles.
- File `Xxx.module.scss` next to `Xxx.tsx`; `import styles from "./Xxx.module.scss";`.
  camelCase class names (`styles.statusCell`). Variants = modifier classes
  chosen from a typed prop (`styles[intent]`), never string-built class names.
  Modern Sass modules: `@use`, never `@import`.
- No global SCSS except `src/styles/` (`globals.scss` + `_mixins.scss`
  partials pulled in with `@use "@/styles/mixins" as *;`). Colours via the
  `--ant-*` CSS variables, never hex.
- Shared components (`shared/components/<Name>.tsx` + `<Name>.module.scss`)
  wrap AntD for product-wide patterns (`PageHeader`, `EmptyState`,
  `ErrorState`, `FormField`, `StatusTag`); features compose them and AntD
  directly.

```scss
// features/inspections/components/InspectionTable.module.scss
.table {
  // row hover colour has no Table token in our version
  :global(.ant-table-tbody > tr.ant-table-row:hover > td) {
    background: color-mix(in oklab, var(--ant-color-primary) 8%, transparent);
  }
}
```

## Forms — react-hook-form + zod + `Controller`

One form standard: RHF owns state, zod validates, AntD renders.
Never AntD's own `Form` store (`name`/`rules` on `Form.Item`, `onFinish`).

```tsx
// shared/components/FormField.tsx
import { Form } from "antd";
import type { ReactElement } from "react";
import {
  useController,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

export type FormFieldProps<T extends FieldValues, N extends FieldPath<T>> = {
  control: Control<T>;
  name: N;
  label: string;
  required?: boolean;
  render: (field: ControllerRenderProps<T, N> & { id: string }) => ReactElement;
};

export function FormField<T extends FieldValues, N extends FieldPath<T>>(
  props: FormFieldProps<T, N>,
) {
  const { field, fieldState } = useController({ control: props.control, name: props.name });
  return (
    <Form.Item
      label={props.label}
      htmlFor={props.name}
      required={props.required}
      validateStatus={fieldState.error ? "error" : undefined}
      help={fieldState.error?.message}
    >
      {props.render({ ...field, id: props.name })}
    </Form.Item>
  );
}
```

```tsx
// features/inspections/components/InspectionForm.tsx (excerpt)
const form = useForm<InspectionFormValues>({ resolver: zodResolver(inspectionFormSchema) });

return (
  <Form layout="vertical" component={false}>
    <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} noValidate>
      <FormField
        control={form.control}
        name="title"
        label="Title"
        required
        render={(field) => <Input {...field} />}
      />
      <FormField
        control={form.control}
        name="status"
        label="Status"
        render={(field) => <Select {...field} options={statusOptions} />}
      />
      <Button type="primary" htmlType="submit" loading={form.formState.isSubmitting}>
        Save
      </Button>
    </form>
  </Form>
);
```

- Schema in `features/<domain>/schemas/<x>.schema.ts`; no hand-written error
  markup — `FormField` sets `validateStatus`/`help` (AntD links them for
  screen readers).
- Server validation errors: `form.setError("title", { type: "server", message })`;
  form-level errors → `form.setError("root.server", …)` rendered with `<Alert>`.
- `DatePicker` returns `dayjs` — convert at the boundary
  (`value ? dayjs(value) : null` in, `d?.toISOString()` out) so the schema
  and API keep ISO strings.

## Tables and long lists

- AntD `Table` is the table component in this profile (instead of
  `@tanstack/react-table` — one table solution per project). Server-side
  pagination/sorting/filter state lives in the URL (`react-router-dom.md`).
- `rowKey` always set to a stable id; `columns` defined outside the component
  or derived during render (React Compiler memoises).
- 100+ rows on one page → `virtual` + `scroll={{ x: 1200, y: 600 }}`; custom
  lists/cards → AntD `List` with server pagination (≤ 100 per page) or
  `@tanstack/react-virtual`.
- Loading → `loading` prop / `Skeleton`; empty → `locale={{ emptyText: <EmptyState /> }}`;
  error → `<Result status="error">` / `ErrorState` with retry.

## Icons

`lucide-react` (named imports, `aria-hidden` when decorative) is the default
(STANDARDS §8). `@ant-design/icons` only if the project already uses it —
pick **one** icon set per project, never both.

## Accessibility (mandatory)

- Semantic HTML, landmarks (`Layout` renders `header`/`main`/`aside`), one
  `h1` per page (`Typography.Title level={1}`), ordered headings.
- Icon-only `Button`: `aria-label` (`<Button icon={<Trash2 aria-hidden />} aria-label="Delete" />`),
  translated in multi-locale products.
- `Modal`/`Drawer`: always a `title` (accessible name); keep the default focus
  handling (focus moves in, returns to the trigger on close — don't disable
  `focusTriggerAfterClose`); destructive confirm buttons `danger` + explicit text.
- `Form.Item` labels via `FormField` (`htmlFor` + input `id`); never placeholder-only inputs.
- Visible focus: never remove AntD's focus outline in SCSS (`outline: none`)
  without a replacement; full keyboard navigation, logical tab order.
- Contrast ≥ 4.5:1 text / ≥ 3:1 UI — verify custom tokens in both algorithms
  (light/dark); axe runs on every route (§10).
- Status `Tag`s carry text, not colour only; touch targets ≥ 44px; live
  regions for async status messages (`message` already announces).
- Motion 150–300 ms, `transform`/`opacity` only, `prefers-reduced-motion`
  respected (`motion: false` token for reduced-motion users).

## States every async UI must have

Loading (`Skeleton` matching the final layout) · Empty (`Empty` + primary
action) · Error (`Result status="error"` / `ErrorState` + retry) · Success.

## Performance

- Lazy-load rarely used heavy parts with a skeleton: `Upload` with
  drag-and-drop, rich editors, charts, `DatePicker` locales
  (`await import("dayjs/locale/az")`), export dialogs —
  `const ExportModal = lazy(() => import("./ExportModal"));`.
- Watch the route budget (§14): `rollup-plugin-visualizer` shows which AntD
  components land in each chunk; import only what a route uses.

## Testing

- `test/setup.ts` adds `window.matchMedia` and `ResizeObserver` stubs (AntD
  responsive/`Table` need them in jsdom).
- Never assert on SCSS module or `.ant-*` class names — query by role/label.
- Components that call `App.useApp()` are wrapped in `<App>` at the call site:
  `renderWithProviders(<App><InspectionForm /></App>)` — `renderWithProviders`
  itself wraps only `QueryClientProvider`.
- Query AntD controls by role/label (`getByRole("combobox", { name: "Status" })`);
  open `Select` with `userEvent.click`, pick with `getByTitle`/`getByText` in
  the portal.
