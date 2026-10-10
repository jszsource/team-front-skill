# Testing — Vitest + Testing Library + MSW

## Install

```bash
npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  @vitest/coverage-v8 msw
```

## `vitest.config.mts`

```ts
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/shared/config/tests/setup.ts"],
    css: false,
    exclude: [...configDefaults.exclude, "e2e/**"], // Playwright specs are not Vitest tests
    coverage: {
      provider: "v8",
      include: ["src/features/**", "src/entities/**", "src/shared/lib/**", "src/shared/api/**"],
      thresholds: { lines: 80 },
    },
  },
});
```

## Setup file

```ts
// src/shared/config/tests/setup.ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
```

```ts
// src/shared/config/tests/msw/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
export const server = setupServer(...handlers);
```

## Render helper with providers

```tsx
// src/shared/config/tests/render.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

export function renderWithProviders(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    user: userEvent.setup(),
    ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
  };
}
```

## `antd-scss-react-router` profile: `src/test/`

Same tools and rules; the shared test infrastructure lives in `src/test/`
instead of `src/shared/config/tests/`:

```
src/test/
  setup.ts               # jest-dom, MSW lifecycle, cleanup (same content as the setup file above)
  test-utils.tsx         # renderWithProviders + re-exports of Testing Library
  mocks/
    server.ts            # setupServer(...handlers)
    handlers.ts          # aggregates every domain's handlers
    handlers/
      inspections.ts     # one file per feature/domain, kebab-case
      users.ts
```

`vitest.config.mts`: `setupFiles: ["./src/test/setup.ts"]`, coverage
`include: ["src/features/**", "src/shared/lib/**", "src/shared/stores/**"]`.

```tsx
// src/test/test-utils.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

/** Wraps ONLY QueryClientProvider (fresh client per test). Add other providers at the call site. */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  const queryClient = createTestQueryClient();
  return {
    user: userEvent.setup(),
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options),
  };
}

export * from "@testing-library/react";
```

`renderWithProviders` is not extended with router/theme/i18n providers (or the
AntD `<App>` that `App.useApp()` needs) — a test that needs them adds them
where it renders. React Router (data mode):

```tsx
import { createMemoryRouter, RouterProvider } from "react-router";
import { renderWithProviders, screen } from "@/test/test-utils";
import { InspectionsPage } from "./InspectionsPage";

it("lists inspections", async () => {
  const router = createMemoryRouter([{ path: "/inspections", element: <InspectionsPage /> }], {
    initialEntries: ["/inspections"],
  });
  renderWithProviders(<RouterProvider router={router} />);
  expect(await screen.findByRole("heading", { name: /inspections/i })).toBeInTheDocument();
});
```

```ts
// src/test/mocks/handlers/inspections.ts
import { http, HttpResponse } from "msw";

const mockInspections = [{ id: "1", title: "Boiler room", status: "open" }];

export const inspectionsHandlers = [
  http.get("*/inspections", () => HttpResponse.json(mockInspections)),
];
```

```ts
// src/test/mocks/handlers.ts
import { inspectionsHandlers } from "./handlers/inspections";
import { usersHandlers } from "./handlers/users";

export const handlers = [...inspectionsHandlers, ...usersHandlers];
```

- Component and hook tests are **co-located in each feature**
  (`features/inspections/components/InspectionList.test.tsx`); only shared
  infrastructure lives in `src/test/`.
- Every component test renders through `renderWithProviders`; per-test
  overrides use `server.use(...)`.
- Stores created with `createResettableStore`: call `resetAllStores()` in
  `afterEach` (in `setup.ts`) so state never leaks between tests.

## Unit vs E2E — who tests what

| Concern | Vitest (unit/component) | Playwright (`e2e-playwright.md`) |
| --- | --- | --- |
| Pure logic, stores, hooks, mappers | yes | no |
| Component behaviour (states, validation messages) | yes, network via MSW | no |
| Interceptor / refresh logic | yes (MSW) | one flow: expired session still works |
| Routing, redirects, cookies, SSR/RSC output | no | yes |
| Critical user journeys (auth, checkout-like) | parts only | yes, against real test backend |
| Accessibility | optional per component (`vitest-axe`) | required per route (axe, blocking) |

Don't duplicate: if a case is fully covered in a unit test, E2E checks only the
happy path and one error path of the journey.

## What must be tested

| Unit | Test |
| --- | --- |
| `lib/` pure functions | input → output, edge cases |
| Zustand store | actions change state; selectors |
| Custom hooks | `renderHook` |
| `api/` + query hooks | MSW handler, success + error |
| Feature/widget components | user behaviour: render, interact, assert visible result |
| `shared/api/http.ts` (`antd-scss-react-router`: `shared/lib/http-client.ts`) | the 5 interceptor cases + 5xx-toast check in `http-axios.md` (`antd-scss-react-router`: spy on `notify.error`) |
| `createResettableStore` / logout | `resetAllStores()` resets every store (and clears `persist` keys); logout clears the query cache |
| `shared/api/http.server.ts` (Next) | MSW (intercepts global `fetch`): success, `ApiError` mapping, no axios import |
| Async Server Components | test the presentational child + data function separately |

Skip: thin shadcn wrappers, route files (`page.tsx`), pure re-exports.

## Examples

Store:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useCartDrawerStore } from "./cartDrawer.store";

describe("cartDrawer store", () => {
  beforeEach(() => useCartDrawerStore.setState({ isOpen: false }));
  it("toggles", () => {
    useCartDrawerStore.getState().toggle();
    expect(useCartDrawerStore.getState().isOpen).toBe(true);
  });
});
```

Component:

```tsx
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/shared/config/tests/msw/server";
import { renderWithProviders } from "@/shared/config/tests/render";
import { AddToCartButton } from "./AddToCartButton";

it("shows success after adding", async () => {
  server.use(http.post("*/cart", () => HttpResponse.json({ ok: true })));
  const { user } = renderWithProviders(<AddToCartButton productId="1" />);
  await user.click(screen.getByRole("button", { name: /add to cart/i }));
  expect(await screen.findByText(/added/i)).toBeInTheDocument();
});
```

Interceptor single-flight:

```ts
import { http as mswHttp, HttpResponse } from "msw";
import { server } from "@/shared/config/tests/msw/server";
import { http } from "./http";

it("refreshes once for parallel 401s", async () => {
  let refreshCalls = 0;
  server.use(
    mswHttp.post("*/auth/refresh", () => {
      refreshCalls++;
      return HttpResponse.json({ accessToken: "new" });
    }),
    mswHttp.get("*/me", ({ request }) =>
      request.headers.get("authorization") === "Bearer new"
        ? HttpResponse.json({ id: 1 })
        : new HttpResponse(null, { status: 401 }),
    ),
  );
  await Promise.all([http.get("/me"), http.get("/me"), http.get("/me")]);
  expect(refreshCalls).toBe(1);
});
```

## Component-level a11y (optional)

Useful for `shared/ui` compositions and complex widgets (dialogs, comboboxes,
forms). Page-level a11y is enforced in E2E.

```bash
npm i -D vitest-axe
```

```ts
// setup.ts — add
import "vitest-axe/extend-expect";
```

```tsx
import { axe } from "vitest-axe";

it("has no a11y violations", async () => {
  const { container } = renderWithProviders(<CheckoutForm />);
  expect(await axe(container)).toHaveNoViolations();
});
```

jsdom has no layout: `color-contrast` and visibility-based rules don't run
here — that is why the per-route axe check in Playwright stays mandatory.

## Rules

- Query by role/label/text — `getByTestId` last resort.
- `userEvent`, not `fireEvent`.
- Test behaviour, not implementation (no asserting on state internals of components).
- `onUnhandledRequest: 'error'` — every request must be mocked.
- `next/navigation` hooks: `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }))`.
- Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.
