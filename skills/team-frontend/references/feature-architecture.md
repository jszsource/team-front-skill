# `antd-scss-react-router` profile — feature folders (React SPA)

Implements STANDARDS §2.5 and §3.3 for the `antd-scss-react-router` profile
(§1.1): feature folders + React Router v7 (data mode) + Ant Design v5 + SCSS
modules, no Tailwind. Routing: `react-router-dom.md`. UI: `ui-antd-scss.md`.

## When to use it

- Detection (SKILL.md Step 0, structure first) finds `src/features/<domain>/`
  + `src/shared/` without FSD layers, `react-router` / `react-router-dom`, or
  `antd`; the project's `CLAUDE.md` records `- profile: antd-scss-react-router`.
- New SPA: only when the team chooses it (enterprise/admin app on Ant Design,
  team already on React Router). Otherwise the default is
  `shadcn-tailwind-tanstack-router` (FSD).
- **Never mixed with FSD, Tailwind or shadcn/ui.** No `entities/`, `widgets/`,
  `views/` in an `antd-scss-react-router` project and no
  `features/<domain>/components` in an FSD one. Moving between
  profiles is a deliberate, planned migration (one PR per domain, `CLAUDE.md`
  updated last) — never a side effect of another task.

## Folder tree

```
src/
  app/
    main.tsx                  # createRoot + providers + RouterProvider
    router.tsx                # createBrowserRouter — route table only
    providers/                # QueryProvider, AntdProvider (ui-antd-scss.md)
    layout/                   # RootLayout, AppHeader, AppSidebar (app-wide chrome)
    guards.ts                 # requireAuth / requireRole loaders
  routes/                     # route modules: loader + Component (thin, ~20 lines)
  features/
    inspections/
      components/             # InspectionList.tsx, InspectionsPage.tsx (+ components/ sub-folders)
      hooks/                  # useInspectionSelection.ts (non-query hooks)
      lib/
        api.ts                # API functions (httpClient, AbortSignal)
        query-keys.ts         # key factory + cache-policy block
        format-status.ts      # pure helpers (kebab-case)
      queries/                # useInspectionsQuery.ts, useUpdateInspectionMutation.ts
      schemas/                # inspection.schema.ts (zod + inferred types)
      types/                  # types not derived from zod
      inspections.store.ts    # only if shared UI state is needed
      index.ts                # public API
  shared/
    components/               # shared AntD-based components (+ <Name>.module.scss)
    hooks/                    # business-agnostic hooks
    lib/                      # http-client.ts, auth-http-client.ts, token.ts, api-error.ts,
                              # query-client.ts, env.ts, logger.ts, sanitize.ts, safe-url.ts,
                              # theme.ts (ConfigProvider tokens), notify.ts
    stores/                   # auth.store.ts, ui-prefs.store.ts, create-resettable-store.ts
    types/
  test/
    setup.ts                  # jest-dom, MSW server lifecycle, cleanup
    test-utils.tsx            # renderWithProviders — wraps ONLY QueryClientProvider
    mocks/
      server.ts
      handlers.ts             # [...inspectionsHandlers, ...usersHandlers]
      handlers/inspections.ts
  styles/
    globals.scss              # layer order + small reset (ui-antd-scss.md)
    _mixins.scss              # breakpoint mixins
```

## What goes where

1. Reusable by another product with different business? → `shared/`.
2. Belongs to one business domain (noun the backend knows: inspections, users,
   orders)? → `features/<domain>/`. A domain is a folder, not a user action:
   "approve inspection" is `features/inspections/queries/useApproveInspectionMutation.ts`.
3. A screen → page component in the feature that **owns** the screen
   (`features/inspections/components/InspectionsPage.tsx`, exported from
   `index.ts`); the route module only loads data and renders it.
4. A block that combines several domains → in the owning feature, importing the
   others through their public APIs. App-wide chrome (header, sidebar, nav) →
   `src/app/layout/`.
5. Server data → `queries/` + `lib/api.ts` (never a store). Shared UI state of
   one domain → `<domain>.store.ts` via `createResettableStore`. Session/auth →
   `shared/stores/auth.store.ts` only.
6. Second consumer of a sub-component in `components/` → promote it to the
   feature's `components/` root, then to `shared/components/` if business-agnostic.

## Public API and import rules

```ts
// features/inspections/index.ts — export only what other code needs
export { InspectionDetailPage } from "./components/InspectionDetailPage";
export { InspectionsPage } from "./components/InspectionsPage";
export { InspectionStatusBadge } from "./components/InspectionStatusBadge";
export { inspectionKeys } from "./lib/query-keys";
export { inspectionListQuery, useInspectionsQuery } from "./queries/useInspectionsQuery";
export { inspectionDetailQuery } from "./queries/useInspectionQuery";
export { useUpdateInspectionMutation } from "./queries/useUpdateInspectionMutation";
export { inspectionFiltersSchema } from "./schemas/inspection.schema";
export type { Inspection, InspectionFilters } from "./schemas/inspection.schema";
```

- Outside a feature: only `@/features/<domain>`. Inside: relative imports.
  Between features: always the alias, never `../../other-feature/…`.
- A feature may import `shared/` and other features' public APIs. `shared/`
  never imports `features/` or `app/`. Circular feature imports are forbidden:
  move the common part to `shared/` or compose in the owning feature/route.
- `lib/api.ts` is not exported — other features use the query options/hooks.

ESLint (merge into the `src/**` block of `tooling.md`; a later
`no-restricted-imports` entry **replaces** an earlier one, so every block
repeats the axios path):

```js
// eslint.config.mjs — antd-scss-react-router profile
const noAxios = { name: "axios", message: "Use httpClient from @/shared/lib/http-client." };
const noDeepFeature = {
  group: ["@/features/*/*"],
  message: "Import a feature only through its public API: @/features/<domain>.",
};
const noFeaturesInShared = {
  group: ["@/features", "@/features/**", "@/app/**"],
  message: "shared/ is business-agnostic: it never imports features/ or app/.",
};

export default defineConfig([
  // …base config from tooling.md
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [noAxios], patterns: [noDeepFeature] }],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [noAxios], patterns: [noDeepFeature, noFeaturesInShared] },
      ],
    },
  },
  {
    // the only two files that may import axios
    files: ["src/shared/lib/http-client.ts", "src/shared/lib/auth-http-client.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [noFeaturesInShared] }] },
  },
]);
```

## Naming (§3.3)

| Kind | Convention | Example |
| --- | --- | --- |
| Feature folder | `kebab-case`, plural domain | `features/inspections/` |
| Component | `PascalCase.tsx`, named export, `XxxProps` type | `InspectionCard.tsx` |
| Hook | `useCamelCase.ts` | `useInspectionSelection.ts` |
| Query / mutation hook | `useXxxQuery.ts` / `useXxxMutation.ts` | `useInspectionsQuery.ts` |
| Key factory | `query-keys.ts`, export `<entity>Keys` | `inspectionKeys` |
| Zod schema | `<name>.schema.ts`, export `<name>Schema` + `z.infer` types | `inspection.schema.ts` |
| Store | `<domain>.store.ts` (never bare `store.ts`), hook `use<Domain>Store` | `inspections.store.ts` |
| Lib / util | `kebab-case.ts` | `format-status.ts`, `http-client.ts` |
| MSW handlers | `test/mocks/handlers/<domain>.ts`, export `<domain>Handlers` | `inspectionsHandlers` |
| Route module | `kebab-case.tsx` in `src/routes/` | `inspection-detail.tsx` |
| Test | co-located `<File>.test.ts(x)` | `InspectionCard.test.tsx` |

Commit scope = feature folder: `feat(inspections): add status filter`.

## Import order

`import/order`: builtin → external → internal (`@/…`) → parent/sibling → index → type,
blank line between groups, alphabetised, inline `type` imports.

```tsx
import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "antd";

import { EmptyState } from "@/shared/components/EmptyState";
import { useAuthStore } from "@/shared/stores/auth.store";

import { inspectionApi } from "../lib/api";
import { inspectionKeys } from "../lib/query-keys";

import type { Inspection } from "../schemas/inspection.schema";
```

## FSD → feature path map

Every reference written with FSD paths applies to this profile through this table.

| FSD path (references) | `antd-scss-react-router` path |
| --- | --- |
| `shared/api/http.ts` (`http`) | `shared/lib/http-client.ts` (`httpClient`) |
| refresh call inside `http.ts` | `shared/lib/auth-http-client.ts` — bare instance, **no interceptors**, used only by `refreshAccessToken()` |
| `shared/api/token.ts` | `shared/lib/token.ts` |
| `shared/api/api-error.ts` | `shared/lib/api-error.ts` |
| `shared/api/query-client.ts` | `shared/lib/query-client.ts` |
| `shared/api/index.ts` | none — import the `shared/lib/*` file directly |
| `shared/config/env.ts` | `shared/lib/env.ts` (`VITE_*` only) |
| `shared/config/i18n/` | `shared/lib/i18n/` |
| `shared/config/monitoring/{sentry,scrub}.ts` | `shared/lib/monitoring/` |
| `shared/lib/logger.ts`, `sanitize.ts`, `safe-url.ts`, `vitals.ts`, `format/` | same path |
| `shared/lib/cn.ts`, `cva` variants | none — AntD props + SCSS module modifier classes (`ui-antd-scss.md`) |
| `shared/ui/<x>` (shadcn primitive) | the AntD component (`import { Button } from "antd";`) |
| `shared/ui/<x>` (product-wide composite: `ErrorState`, `EmptyState`, `FormField`) | `shared/components/<X>.tsx` (+ `<X>.module.scss`) |
| `shared/ui/data-table/` (`@tanstack/react-table`) | AntD `Table` (`virtual` for 100+ rows) |
| `sonner` / `toast.*` | `App.useApp().message` in components, `notify` from `shared/lib/notify.ts` elsewhere |
| Tailwind `@theme` tokens | `shared/lib/theme.ts` (`ConfigProvider` tokens → `--ant-*` CSS variables) |
| `shared/hooks`, `shared/types` | same path |
| `shared/lib/create-resettable-store.ts` | `shared/stores/create-resettable-store.ts` |
| `entities/session` (session store) | `shared/stores/auth.store.ts` (`useAuthStore`); login UI in `features/auth/` |
| `entities/<x>/model/types.ts` | `features/<x>/types/` (or `z.infer` in `schemas/`) |
| `entities/<x>/model/schema.ts` | `features/<x>/schemas/<x>.schema.ts` |
| `<slice>/api/<x>.api.ts` | `features/<x>/lib/api.ts` |
| `<slice>/api/query-keys.ts` (keys) | `features/<x>/lib/query-keys.ts` |
| `<slice>/api/*.queries.ts` (query options, query/mutation hooks) | `features/<x>/queries/use<X>Query.ts` (options exported next to the hook), `use<X>Mutation.ts` |
| `<slice>/model/<x>.store.ts` | `features/<x>/<x>.store.ts` |
| `<slice>/model/use<X>.ts` (non-query hooks) | `features/<x>/hooks/use<X>.ts` |
| `<slice>/lib/`, `<slice>/config/` | `features/<x>/lib/` (constants in `lib/constants.ts`) |
| `<slice>/ui/` | `features/<x>/components/` |
| `features/<action>/` (FSD user action) | `features/<domain>/` it acts on (components + `queries/use<Action>Mutation.ts`) |
| `widgets/<x>` | owning feature's `components/`; app-wide chrome → `src/app/layout/` |
| `views/<x>` | `features/<owner>/components/<X>Page.tsx` + route module in `src/routes/` |
| `app-layer/` / `src/app/providers` | `src/app/providers/` |
| `app-layer/styles/globals.css` | `src/styles/globals.scss` |
| `src/routes/` (TanStack file routes) | `src/routes/` route modules + `src/app/router.tsx` (`react-router-dom.md`) |
| `shared/config/tests/setup.ts` | `src/test/setup.ts` |
| `shared/config/tests/render.tsx` | `src/test/test-utils.tsx` (`renderWithProviders`) |
| `shared/config/tests/msw/server.ts` + handlers | `src/test/mocks/server.ts`, `handlers.ts`, `handlers/<domain>.ts` |
| co-located tests / `__tests__/` | co-located `*.test.ts(x)` next to the file; helpers only in `src/test/` |

## Worked example — `features/inspections`

```ts
// features/inspections/schemas/inspection.schema.ts
import { z } from "zod";

export const inspectionStatusSchema = z.enum(["open", "in_progress", "closed"]);

export const inspectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  status: inspectionStatusSchema,
  updatedAt: z.string(),
});
export const inspectionListSchema = z.array(inspectionSchema);

export const inspectionFormSchema = inspectionSchema.pick({ title: true, status: true });

// URL search params: invalid values fall back instead of throwing
export const inspectionFiltersSchema = z.object({
  status: inspectionStatusSchema.optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});

export type Inspection = z.infer<typeof inspectionSchema>;
export type InspectionFormValues = z.infer<typeof inspectionFormSchema>;
export type InspectionFilters = z.infer<typeof inspectionFiltersSchema>;
export type UpdateInspectionInput = { id: string } & Partial<InspectionFormValues>;
```

```ts
// features/inspections/lib/api.ts
import { httpClient } from "@/shared/lib/http-client";

import {
  inspectionListSchema,
  inspectionSchema,
  type InspectionFilters,
  type UpdateInspectionInput,
} from "../schemas/inspection.schema";

type RequestOptions = { signal?: AbortSignal };

export const inspectionApi = {
  list: async (filters: InspectionFilters, { signal }: RequestOptions = {}) => {
    const res = await httpClient.get<unknown>("/inspections", { params: filters, signal });
    return inspectionListSchema.parse(res.data);
  },
  byId: async (id: string, { signal }: RequestOptions = {}) => {
    const res = await httpClient.get<unknown>(`/inspections/${id}`, { signal });
    return inspectionSchema.parse(res.data);
  },
  update: async ({ id, ...body }: UpdateInspectionInput) => {
    const res = await httpClient.patch<unknown>(`/inspections/${id}`, body);
    return inspectionSchema.parse(res.data);
  },
};
```

```ts
// features/inspections/lib/query-keys.ts
/**
 * Cache policy — inspections
 * owner:        team-field-ops
 * keys:         inspectionKeys.* (["inspections", ...])
 * staleTime:    60 s (list) / 30 s (detail)   gcTime: 10 min
 * invalidation: update → setQueryData(detail) + lists; create/delete → lists
 * realtime:     none
 */
import type { InspectionFilters } from "../schemas/inspection.schema";

export const inspectionKeys = {
  all: ["inspections"] as const,
  lists: () => [...inspectionKeys.all, "list"] as const,
  list: (filters: InspectionFilters) => [...inspectionKeys.lists(), filters] as const,
  details: () => [...inspectionKeys.all, "detail"] as const,
  detail: (id: string) => [...inspectionKeys.details(), id] as const,
};

export const INSPECTION_LIST_CACHE = { staleTime: 60_000, gcTime: 10 * 60_000 } as const;
export const INSPECTION_DETAIL_CACHE = { staleTime: 30_000, gcTime: 10 * 60_000 } as const;
```

```ts
// features/inspections/queries/useInspectionsQuery.ts
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { inspectionApi } from "../lib/api";
import { INSPECTION_LIST_CACHE, inspectionKeys } from "../lib/query-keys";

import type { InspectionFilters } from "../schemas/inspection.schema";

// shared by the hook, route loaders (ensureQueryData / prefetchQuery) and tests
export const inspectionListQuery = (filters: InspectionFilters) =>
  queryOptions({
    queryKey: inspectionKeys.list(filters),
    queryFn: ({ signal }) => inspectionApi.list(filters, { signal }),
    ...INSPECTION_LIST_CACHE,
  });

export function useInspectionsQuery(filters: InspectionFilters) {
  return useQuery({ ...inspectionListQuery(filters), placeholderData: keepPreviousData });
}
```

```ts
// features/inspections/queries/useUpdateInspectionMutation.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { notify } from "@/shared/lib/notify"; // non-React code: themed AntD messages (ui-antd-scss.md)

import { inspectionApi } from "../lib/api";
import { inspectionKeys } from "../lib/query-keys";

import type { Inspection } from "../schemas/inspection.schema";

export function useUpdateInspectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inspectionApi.update,
    onMutate: async (input) => {
      const key = inspectionKeys.detail(input.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Inspection>(key);
      queryClient.setQueryData<Inspection>(key, (old) => (old ? { ...old, ...input } : old));
      return { previous };
    },
    onError: (_error, input, context) => {
      queryClient.setQueryData(inspectionKeys.detail(input.id), context?.previous);
      notify.error("Could not save the inspection. Changes were reverted."); // translate if multi-locale
    },
    onSuccess: (inspection) => {
      queryClient.setQueryData(inspectionKeys.detail(inspection.id), inspection);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: inspectionKeys.lists() }),
  });
}
```

`queries/useInspectionQuery.ts` follows the same shape with
`inspectionDetailQuery(id)` and `INSPECTION_DETAIL_CACHE`. Tests:
`useUpdateInspectionMutation.test.tsx` next to the hook, network via
`test/mocks/handlers/inspections.ts` (`testing-vitest.md`).
