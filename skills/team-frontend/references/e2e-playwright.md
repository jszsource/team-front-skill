# E2E — Playwright + automated a11y (axe)

Vitest stays the tool for unit/component tests (`testing-vitest.md`).
Playwright covers **real browser, real routing, real backend (test env)**.
Commands below use `npm`; use the package manager detected from the lockfile.

## When E2E is required

Every project has E2E tests for its **critical flows**. A flow is critical if
breaking it loses money, data or access. Minimum list (adapt names per product):

| Flow | Must cover |
| --- | --- |
| Auth | login success, wrong password error, logout, protected route redirect |
| Session refresh | expired access token → silent refresh → page still works |
| Checkout-like flow | multi-step form / cart → submit → confirmation (payment, booking, order, signup wizard) |
| Core create/edit | create → see it in the list → edit → delete (the product's main entity) |
| Search / filter | URL search params applied, back/forward keeps state |
| Smoke | every top-level route renders without console errors + passes a11y check |

Not E2E: edge cases of validation, formatting, store logic → unit tests.
Rule of thumb: **≤ ~20 E2E specs per app**; each one a user journey, not a unit.

## Install

```bash
npm i -D @playwright/test @axe-core/playwright
npx playwright install --with-deps chromium webkit
```

## Folder (project root, outside `src/`)

```
e2e/
  fixtures.ts            # extended test: page objects + axe helper
  a11y.ts                # expectNoA11yViolations()
  auth.setup.ts          # logs in once, saves storageState
  pages/                 # page-object-light: one file per screen
    LoginPage.ts
    CheckoutPage.ts
  specs/
    auth.spec.ts
    checkout.spec.ts
    smoke.spec.ts
  .auth/                 # generated storageState — gitignored
playwright.config.ts
```

`.gitignore`: `e2e/.auth/`, `playwright-report/`, `test-results/`.
Name E2E files `*.spec.ts`; Vitest must exclude `e2e/**` (see `testing-vitest.md`).

## `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

const isNext = true; // set per project: Next → 3000, Vite preview → 4173
const PORT = isNext ? 3000 : 4173;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const authFile = "e2e/.auth/user.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: authFile },
      dependencies: ["setup"],
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 14"], storageState: authFile },
      dependencies: ["setup"],
    },
  ],
  // Test the production build, not the dev server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: isNext
          ? "npm run build && npm run start"
          : `npm run build && npm run preview -- --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
```

- `E2E_BASE_URL` set → run against a deployed preview/staging, no local server.
- Specs that must run logged-out: `test.use({ storageState: { cookies: [], origins: [] } })`.

## Auth via `storageState` (setup project)

```ts
// e2e/auth.setup.ts
import { expect, test as setup } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("navigation", { name: /account/i })).toBeVisible();
  await page.context().storageState({ path: authFile }); // httpOnly refresh cookie included
});
```

Credentials come from env / CI secrets for a **dedicated test user**; never
committed. Log in through the UI once; every other spec starts authenticated.

## Page-object-light

A page object = locators + a few intent methods. No assertions hidden inside,
no inheritance trees, no generic `BasePage`.

```ts
// e2e/pages/LoginPage.ts
import type { Page } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  readonly email = () => this.page.getByLabel(/email/i);
  readonly password = () => this.page.getByLabel(/password/i);
  readonly submit = () => this.page.getByRole("button", { name: /sign in/i });
  readonly error = () => this.page.getByRole("alert");

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.email().fill(email);
    await this.password().fill(password);
    await this.submit().click();
  }
}
```

## Fixtures + a11y helper

```ts
// e2e/a11y.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

type Options = { include?: string; exclude?: string[]; disableRules?: string[] };

export async function expectNoA11yViolations(page: Page, opts: Options = {}) {
  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
  ]);
  if (opts.include) builder = builder.include(opts.include);
  for (const sel of opts.exclude ?? []) builder = builder.exclude(sel);
  if (opts.disableRules?.length) builder = builder.disableRules(opts.disableRules);

  const { violations } = await builder.analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = blocking.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
  expect(report, "serious/critical a11y violations").toEqual([]);
}
```

```ts
// e2e/fixtures.ts
import { test as base } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { CheckoutPage } from "./pages/CheckoutPage";

export const test = base.extend<{ loginPage: LoginPage; checkoutPage: CheckoutPage }>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
});
export { expect } from "@playwright/test";
```

`minor`/`moderate` violations are reported in the PR, not blocking. Every
`disableRules` entry needs a comment with the reason and a ticket.

## Example specs

```ts
// e2e/specs/auth.spec.ts
import { expect, test } from "../fixtures";
import { expectNoA11yViolations } from "../a11y";

test.describe("auth", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows an error for a wrong password", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login("qa@example.com", "wrong-password");
    await expect(loginPage.error()).toContainText(/invalid/i);
  });

  test("login page is accessible", async ({ page, loginPage }) => {
    await loginPage.goto();
    await expectNoA11yViolations(page);
  });

  test("protected route redirects to login", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });
});
```

```ts
// e2e/specs/smoke.spec.ts
import { expect, test } from "../fixtures";
import { expectNoA11yViolations } from "../a11y";

for (const path of ["/", "/products", "/account"]) {
  test(`${path} renders cleanly and is accessible`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}
```

## Locators and waiting

- Priority: `getByRole` (with `name`) → `getByLabel` → `getByPlaceholder` →
  `getByText` → `getByTestId` (last resort, `data-testid`).
- No CSS/XPath selectors tied to Tailwind classes or DOM structure.
- Web-first assertions only (`await expect(locator).toBeVisible()`); never
  `page.waitForTimeout()`. Wait for a URL or a visible result, not for time.
- One spec must not depend on another; create its data via API or UI inside
  the test (`request` fixture) and clean up.

## Network: real backend first

- Default: real backend in a **test/staging environment** with seeded data.
  E2E exists to catch integration breaks — mocking our own API defeats it.
- `page.route()` only for **third parties** we don't control or can't run in
  test: payment provider widgets, analytics, maps, captcha, email/SMS.

```ts
await page.route("**/api.stripe.com/**", (route) =>
  route.fulfill({ status: 200, json: { id: "pi_test", status: "succeeded" } }),
);
await page.route(/google-analytics|googletagmanager/, (route) => route.abort());
```

- Mocking our API is allowed only to force a hard-to-reproduce state (e.g. 500
  to check the error UI) and must be named so in the test title.

## Scripts

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:report": "playwright show-report"
}
```

## CI notes

- Separate job after `build` (or after preview deploy with `E2E_BASE_URL`).
- Install only used browsers: `npx playwright install --with-deps chromium webkit`.
- Secrets: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, plus the app's test-env vars.
- Upload `playwright-report/` and `test-results/` as artifacts **on failure**
  (traces open with `npx playwright show-trace`).
- `retries: 2` in CI is for infrastructure flakiness; a test that only passes
  on retry is a bug — fix or quarantine with `test.fixme` + ticket.
- Required on PRs to `main`: E2E for critical flows + smoke a11y must be green.

## Rules

- Critical flows from the table above have an E2E spec before release.
- Every top-level route passes `expectNoA11yViolations` (no serious/critical).
- `getByRole` locators; no `waitForTimeout`; no test-order dependence.
- Production build under test, never `next dev` / `vite dev`.
- `page.route` only for third parties (or explicitly named error-state tests).
