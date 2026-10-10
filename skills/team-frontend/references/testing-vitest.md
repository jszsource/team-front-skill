# Testing — Vitest + Testing Library + MSW

## Install

```bash
npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  @vitest/coverage-v8 msw
```

## `vitest.config.mts`

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/shared/config/tests/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/features/**', 'src/entities/**', 'src/shared/lib/**', 'src/shared/api/**'],
      thresholds: { lines: 80 },
    },
  },
})
```

## Setup file

```ts
// src/shared/config/tests/setup.ts
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())
```

```ts
// src/shared/config/tests/msw/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
export const server = setupServer(...handlers)
```

## Render helper with providers

```tsx
// src/shared/config/tests/render.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

export function renderWithProviders(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return {
    user: userEvent.setup(),
    ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
  }
}
```

## What must be tested

| Unit | Test |
| --- | --- |
| `lib/` pure functions | input → output, edge cases |
| Zustand store | actions change state; selectors |
| Custom hooks | `renderHook` |
| `api/` + query hooks | MSW handler, success + error |
| Feature/widget components | user behaviour: render, interact, assert visible result |
| `shared/api/http.ts` | the 5 interceptor cases in `http-axios.md` |
| Async Server Components | test the presentational child + data function separately |

Skip: thin shadcn wrappers, route files (`page.tsx`), pure re-exports.

## Examples

Store:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useCartDrawerStore } from './cartDrawer.store'

describe('cartDrawer store', () => {
  beforeEach(() => useCartDrawerStore.setState({ isOpen: false }))
  it('toggles', () => {
    useCartDrawerStore.getState().toggle()
    expect(useCartDrawerStore.getState().isOpen).toBe(true)
  })
})
```

Component:

```tsx
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/shared/config/tests/msw/server'
import { renderWithProviders } from '@/shared/config/tests/render'
import { AddToCartButton } from './AddToCartButton'

it('shows success after adding', async () => {
  server.use(http.post('*/cart', () => HttpResponse.json({ ok: true })))
  const { user } = renderWithProviders(<AddToCartButton productId="1" />)
  await user.click(screen.getByRole('button', { name: /add to cart/i }))
  expect(await screen.findByText(/added/i)).toBeInTheDocument()
})
```

Interceptor single-flight:

```ts
import { http as mswHttp, HttpResponse } from 'msw'
import { server } from '@/shared/config/tests/msw/server'
import { http } from './http'

it('refreshes once for parallel 401s', async () => {
  let refreshCalls = 0
  server.use(
    mswHttp.post('*/auth/refresh', () => {
      refreshCalls++
      return HttpResponse.json({ accessToken: 'new' })
    }),
    mswHttp.get('*/me', ({ request }) =>
      request.headers.get('authorization') === 'Bearer new'
        ? HttpResponse.json({ id: 1 })
        : new HttpResponse(null, { status: 401 }),
    ),
  )
  await Promise.all([http.get('/me'), http.get('/me'), http.get('/me')])
  expect(refreshCalls).toBe(1)
})
```

## Rules

- Query by role/label/text — `getByTestId` last resort.
- `userEvent`, not `fireEvent`.
- Test behaviour, not implementation (no asserting on state internals of components).
- `onUnhandledRequest: 'error'` — every request must be mocked.
- `next/navigation` hooks: `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }))`.
- Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.
