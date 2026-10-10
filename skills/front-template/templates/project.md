# Project template

Entry points:

- `react [name]` / `react-shadcn [name]` with profile
  `shadcn-tailwind-tanstack-router` (default) → § A **in place** (current folder).
- `react [name]` with profile `antd-scss-react-router`, `react-antd [name]` →
  **`antd-scss-react-router.md`** § Project (Vite + React Router + feature
  folders + Ant Design v5 + SCSS modules); the in-place rules below still apply.
- `next [name]` → § B **in place** (current folder), latest Next.js.
- `project <name> [next|react|react-shadcn|react-antd]` → § A, § B or
  `antd-scss-react-router.md` in a new sub-folder `<name>/`. Framework missing → ask:
  **Next.js** (App Router), **React `shadcn-tailwind-tanstack-router`** (Vite +
  TanStack Router + FSD + Tailwind + shadcn/ui, default) or **React
  `antd-scss-react-router`** (Vite + React Router + feature folders + Ant Design
  v5 + SCSS modules).

Every scaffold records the profile in the project's `CLAUDE.md` under
`## Frontend profile` — one line (STANDARDS §1.1):
§ A → `- profile: shadcn-tailwind-tanstack-router`; § B → `- profile: next`.

React projects are **always built with Vite** — never CRA, never Next for a
React-mode request. Next projects always use `create-next-app@latest` (latest
stable Next.js).

Generated code follows the team Prettier config (`tooling.md`: semicolons,
double quotes, trailing commas). Some code blocks below are still written
without semicolons — run `format` after generating (the "Finish" step does).

## Before running anything — one message

1. **Package manager** (`../team-frontend/references/tooling.md` → "Package
   manager"): `packageManager` field, else the lockfile next to/above the
   target. Nothing found (empty folder) → ask, default **npm**. Every command
   in this file is written with npm — translate each one with the tooling.md
   mapping (`npm i` → `pnpm add`, `npx x@latest` → `pnpm dlx x@latest`, local
   binary → `pnpm exec x`, `npm run x` → `pnpm x`, `npm ci` → frozen install).
   Create commands: `npm create vite@latest` · `pnpm create vite` ·
   `yarn create vite` · `bun create vite`; `create-next-app` gets
   `--use-npm|--use-pnpm|--use-yarn|--use-bun`.
2. **Optional parts** — ask together, defaults in brackets:
   - Sentry error monitoring? [no] → § Optional — Monitoring.
   - Locales? [single locale `en`] → more than one → § Optional — i18n.
3. Show the plan (commands + file tree) once and wait for confirmation.

## In-place mode (current folder)

The scaffolding CLIs refuse — or offer to **delete** files in — a non-empty
folder, and the current folder usually already has `.claude/` (this skill),
maybe `.git/`, `README.md`, `.vscode/`. Never let a CLI clear the folder.

1. **Pre-check.** `package.json` already exists → stop: this is an existing
   project; offer `/front-setup` or a slice mode instead. Any other existing
   files are kept.
2. **Scaffold into a temp sibling** next to the CWD, never inside it:
   `../.front-template-tmp-<name>/`, using the § A / § B "Create" command with
   that path instead of `<name>`. Use non-interactive flags (Vite:
   `--template react-ts`; Next: the flags below plus `--yes`). Do **not**
   install dependencies there.
3. **Move everything** (including dotfiles like `.gitignore`) from the temp
   folder into the CWD. If a file already exists in the CWD (e.g. `README.md`,
   `.gitignore`): keep the user's file, and for `.gitignore` append the
   missing lines. Never overwrite `.claude/` or `.git/`.
4. Delete the temp folder (and any lockfile of a *different* manager the CLI
   wrote), set `"name": "<name>"` in `package.json`, then continue every
   remaining step (install, extra packages, config, files) **in the CWD** —
   i.e. skip the `cd <name>` lines below.
5. `git init` only if `.git/` does not exist yet.

**Version check** (a setup action — once per session, reuse the result):
`npm view <pkg> version` (`pnpm view` / `yarn npm info` / `bun pm view`) for
`next`, `react`, `vite`, `@tanstack/react-router`, `@tanstack/react-query`,
`zustand`, `axios`, `tailwindcss`, `vitest`, `@playwright/test`; use the latest
stable versions (`../team-frontend/references/dependency-updates.md`). Offline
→ say so and install `@latest`. If a CLI's flags differ from below, check
`<cli> --help` and adapt — the resulting structure must still match this file.

---

## A. React — Vite + TanStack Router

### 1. Create

```bash
npm create vite@latest <name> -- --template react-ts
cd <name>
npm i
npm i @tanstack/react-router @tanstack/react-query zustand axios zod \
  react-hook-form @hookform/resolvers class-variance-authority clsx tailwind-merge lucide-react
npm i -D @tanstack/router-plugin @tanstack/router-devtools @tanstack/react-query-devtools \
  tailwindcss @tailwindcss/vite babel-plugin-react-compiler @types/node
```

Delete the Vite demo files (`src/App.tsx`, `src/App.css`, `src/assets/`,
`src/index.css`, `public/vite.svg`) — they are replaced below.

### 2. `vite.config.ts`

```ts
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";

// Production-only CSP <meta> (dev HMR needs inline scripts). Prefer setting CSP +
// security headers at the host/CDN — security.md §1-2; then delete this plugin.
function cspMeta(apiUrl: string): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' ${new URL(apiUrl).origin}`, // + Sentry ingest host if monitoring is on
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: csp },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }), // must be before react()
      react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
      tailwindcss(),
      cspMeta(env.VITE_API_URL ?? "http://localhost:8080"),
    ],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  };
});
```

`tsconfig.app.json`: the compiler options from `tooling.md` ("TypeScript":
`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
`noUncheckedIndexedAccess`, `"paths": { "@/*": ["./src/*"] }`).

### 3. Tree

```
<name>/
├── index.html                 # <div id="root">, title, <html lang="en">
├── vite.config.ts  vitest.config.mts  playwright.config.ts
├── eslint.config.mjs          # React `shadcn-tailwind-tanstack-router` variant from tooling.md
├── .prettierrc.json  commitlint.config.mjs  components.json  .env.example  .nvmrc
├── .husky/{pre-commit,commit-msg,pre-push}
├── .github/workflows/ci.yml
├── e2e/{a11y.ts,specs/smoke.spec.ts}
└── src/
    ├── main.tsx
    ├── routeTree.gen.ts       # generated by the router plugin — not edited
    ├── app/
    │   ├── router.tsx
    │   ├── providers/{QueryProvider.tsx,index.tsx}
    │   └── styles/globals.css
    ├── routes/
    │   ├── __root.tsx
    │   └── index.tsx
    ├── views/home/{ui/HomeView.tsx,index.ts}
    ├── widgets/  features/  entities/session/
    └── shared/
        ├── api/{http.ts,api-error.ts,token.ts,query-client.ts,http.test.ts,index.ts}
        ├── config/{env.ts,tests/{setup.ts,render.tsx,msw/{server.ts,handlers.ts}}}
        ├── lib/{cn.ts,cn.test.ts,logger.ts,safe-url.ts,safe-url.test.ts,create-resettable-store.ts}
        ├── ui/                # shadcn output
        ├── hooks/  types/
```

### 4. Key files

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./app/router";
import { Providers } from "./app/providers";
import "./app/styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
```

```tsx
// src/app/providers/QueryProvider.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../router";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

`src/app/router.tsx`, `src/routes/__root.tsx` → exactly as in
`../team-frontend/references/react-tanstack-router.md` ("Router + Query
integration"). `__root.tsx` also renders `TanStackRouterDevtools` and
`ReactQueryDevtools` in `import.meta.env.DEV` only; the router gets a
`defaultErrorComponent` that shows a generic message + retry (never
`error.message`).

```tsx
// src/routes/index.tsx — thin
import { createFileRoute } from "@tanstack/react-router";
import { HomeView } from "@/views/home";

export const Route = createFileRoute("/")({ component: HomeView });
```

```ts
// src/shared/config/env.ts — browser-safe, mode-neutral (http-axios.md "Env")
import { z } from "zod";

const EnvSchema = z.object({ API_URL: z.string().url() });

export const env = EnvSchema.parse({ API_URL: import.meta.env.VITE_API_URL });
```

`http.ts` reads `env.API_URL` in both modes. `.env.example`:
`VITE_API_URL=http://localhost:8080/api`. Everything `VITE_*` is public — a
Vite SPA has no secrets.

---

## B. Next.js — App Router

### 1. Create

```bash
npx create-next-app@latest <name> --ts --tailwind --eslint --app --turbopack \
  --import-alias "@/*" --use-npm --no-src-dir
cd <name>
npm i @tanstack/react-query zustand axios zod react-hook-form @hookform/resolvers \
  class-variance-authority clsx tailwind-merge lucide-react next-themes server-only
npm i -D @tanstack/react-query-devtools
```

`--no-src-dir` is deliberate: Next owns `app/` (and `proxy.ts`,
`instrumentation*.ts`) at the root, FSD lives in `src/`. Then set
`"paths": { "@/*": ["./src/*"] }` in `tsconfig.json` and move
`app/globals.css` → `src/app-layer/styles/globals.css`. Replace the generated
ESLint config with the tooling.md Next variant.

axios is for **client** code only. Server code (RSC, Server Actions, route
handlers, `proxy.ts`) uses `serverFetch` from `@/shared/api/http.server` —
never axios (`../team-frontend/references/http-axios.md`).

### 2. Tree

```
<name>/
├── app/                        # routing only, thin files
│   ├── layout.tsx              # html/body, next/font, <Providers>, metadata
│   ├── page.tsx                # export { HomeView as default } from '@/views/home'
│   ├── loading.tsx  error.tsx  global-error.tsx  not-found.tsx
├── proxy.ts                    # CSP nonce + auth redirect (root, next to app/)
├── next.config.ts              # reactCompiler, security headers, poweredByHeader: false
├── vitest.config.mts  playwright.config.ts  eslint.config.mjs  components.json
├── .prettierrc.json  commitlint.config.mjs  .env.example  .nvmrc
├── .husky/{pre-commit,commit-msg,pre-push}
├── .github/workflows/ci.yml
├── e2e/{a11y.ts,specs/smoke.spec.ts}
└── src/
    ├── app-layer/
    │   ├── providers/{QueryProvider.tsx,ThemeProvider.tsx,index.tsx}
    │   └── styles/globals.css
    ├── views/home/{ui/HomeView.tsx,index.ts}
    ├── widgets/  features/
    ├── entities/session/       # store (user, status) + api/session.server.ts
    └── shared/
        ├── api/{http.ts,http.server.ts,api-error.ts,token.ts,query-client.ts,index.ts,
        │        http.test.ts,http.server.test.ts}
        ├── config/{env.ts,env.server.ts,tests/{setup.ts,render.tsx,msw/{server.ts,handlers.ts}}}
        ├── lib/{cn.ts,cn.test.ts,logger.ts,safe-url.ts,safe-url.test.ts,create-resettable-store.ts}
        ├── ui/  hooks/  types/
```

`shared/api/index.ts` exports the client API only — it never re-exports
`http.server.ts`; server code imports `@/shared/api/http.server` directly.

### 3. Key files

```tsx
// src/app-layer/providers/QueryProvider.tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/shared/api/query-client"; // defaults: state-data.md

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const client = getQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/app-layer/providers";
import "@/app-layer/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = { title: "<name>" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```ts
// src/shared/config/env.ts — browser-safe; literal access so Next inlines it
import { z } from "zod";

const EnvSchema = z.object({ API_URL: z.string().url() });

export const env = EnvSchema.parse({ API_URL: process.env.NEXT_PUBLIC_API_URL });
```

```ts
// src/shared/config/env.server.ts — server values + secrets
import "server-only";
import { z } from "zod";

export const serverEnv = z
  .object({ API_URL: z.string().url() }) // no trailing slash
  .parse({ API_URL: process.env.API_URL });
```

`.env.example`: `NEXT_PUBLIC_API_URL=http://localhost:8080/api` and
`API_URL=http://localhost:8080/api`. `process.env` is read only in these two
files and in root-level runtime files (`next.config.ts`, `proxy.ts` for
`NODE_ENV`, `instrumentation*.ts`).

```ts
// next.config.ts — security headers (security.md §2)
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
// Wrapping order when added: withSentryConfig(withNextIntl(withBundleAnalyzer(nextConfig)))
```

```ts
// proxy.ts — per-request CSP nonce (security.md §1) + auth redirect (nextjs.md §7)
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/shared/config/env";

const PROTECTED: string[] = []; // TODO: e.g. ['/account']
const REFRESH_COOKIE = "refresh_token"; // TODO: the backend's cookie name

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !request.cookies.has(REFRESH_COOKIE)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname); // read back through safeRedirect()
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? ` 'unsafe-eval'` : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${new URL(env.API_URL).origin}`, // + Sentry ingest host if monitoring is on
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
```

A nonce CSP makes every matched page dynamic. Mostly-static site → ask, then
move CSP to a static `Content-Security-Policy` header in `next.config.ts`
(`script-src 'self'`, no nonce) and keep only the auth redirect in `proxy.ts`.
Roll out as `Content-Security-Policy-Report-Only` first if the app embeds
third-party scripts.

```ts
// src/entities/session/api/session.server.ts — used by every Server Action
import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/shared/api/api-error";
import { serverFetch } from "@/shared/api/http.server";

const SessionSchema = z.object({ userId: z.string(), permissions: z.array(z.string()) });
export type Session = z.infer<typeof SessionSchema>;

export async function getSession(): Promise<Session | null> {
  try {
    return await serverFetch("/auth/me", { schema: SessionSchema }); // TODO: real endpoint
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
```

`app/error.tsx` (`'use client'`) and `app/global-error.tsx` (renders its own
`<html>/<body>`) show a generic message + `reset()` and report with
`logger.error(error)` in a `useEffect` keyed on `error` (the one legitimate
effect — syncing with an external system, `observability.md`).

---

## Common to both

Take these verbatim from `../team-frontend/references/`:

| File(s) | Source |
| --- | --- |
| `shared/api/{http.ts,api-error.ts,token.ts,query-client.ts,index.ts}` + the 5 interceptor tests; Next: `http.server.ts` + its 3 tests (MSW + mocked `next/headers`) | `http-axios.md` |
| `vitest.config.mts` (with `exclude: [...configDefaults.exclude, 'e2e/**']`), `shared/config/tests/*`, test scripts | `testing-vitest.md` |
| `eslint.config.mjs` — **Next variant** or **React `shadcn-tailwind-tanstack-router` variant** (`defineConfig` + `globalIgnores`, type-checked `src/` block, `import`, `unused-imports`, `no-console`, `max-lines`) | `tooling.md` |
| `.prettierrc.json` (team config: semicolons, double quotes, `plugins: ["prettier-plugin-tailwindcss"]`) + `.prettierignore` — `tailwindStylesheet`: Next `./src/app-layer/styles/globals.css`, React `./src/app/styles/globals.css` | `tooling.md` |
| `tsconfig` strict options (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`); `typecheck`: Next `tsc --noEmit`, Vite `tsc -b` | `tooling.md` |
| husky hooks (detected runner: `npx` / `pnpm exec` / `yarn` / `bunx`), lint-staged, commitlint, scripts incl. `test:e2e` | `tooling.md` |
| `.nvmrc` (`22`) + `"engines": { "node": ">=22" }` | `tooling.md` |
| `.github/workflows/ci.yml` — detected-manager variant; Next adds the `.next/cache` step; `env:` gets non-secret placeholders for build-time env (Next `NEXT_PUBLIC_API_URL` + `API_URL`, Vite `VITE_API_URL` = `https://api.example.com`) | `ci.md` |
| `e2e/a11y.ts` (`expectNoA11yViolations`) | `e2e-playwright.md` |
| `shared/lib/safe-url.ts` (`safeHref`, `safeRedirect`); `sanitize.ts` only when the app renders HTML (adds `dompurify`) | `security.md` |
| `components.json` FSD aliases, `cn()`, `globals.css` tokens | `ui-tailwind-shadcn.md` |
| `entities/session` (store mirrors `user`/`status`; token stays in `shared/api/token.ts`; `setLogoutHandler`) | `http-axios.md`, `state-data.md` |

Then:

```bash
npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react \
  @testing-library/user-event @testing-library/jest-dom @vitest/coverage-v8 msw \
  @playwright/test @axe-core/playwright
npx playwright install chromium webkit   # CI uses --with-deps (ci.md)
npx shadcn@latest init
npx shadcn@latest add button card input form skeleton sonner
git init   # skip if .git/ already exists
npx husky init
```

`.gitignore` — append if missing: `.env*.local`, `coverage/`, `e2e/.auth/`,
`playwright-report/`, `test-results/`.

```ts
// playwright.config.ts — scaffold version (no auth yet)
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000; // Next `start` → 3000 · Vite `preview` → 4173
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 14"] } },
  ],
  // Production build under test. Use the detected manager in `command`.
  // Vite: 'npm run build && npm run preview -- --port 4173 --strictPort'
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
```

When the first login flow exists, add the `setup` project + `storageState`,
`e2e/fixtures.ts` and `e2e/auth.setup.ts` exactly as in `e2e-playwright.md`.

```ts
// e2e/specs/smoke.spec.ts — every top-level route: renders, no console errors, axe clean
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "../a11y";

for (const path of ["/"]) {
  test(`${path} renders cleanly and is accessible`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}
```

```ts
// src/shared/lib/logger.ts — the only logging API (no console.log elsewhere)
type Ctx = Record<string, string | number | boolean | null>;

const isDev = process.env.NODE_ENV !== "production"; // Vite: import.meta.env.DEV

export const logger = {
  warn: (msg: string, ctx?: Ctx) => {
    if (isDev) console.warn(msg, ctx ?? "");
  },
  error: (err: unknown, ctx?: Ctx) => {
    console.error(err, ctx ?? ""); // replaced by Sentry.captureException when monitoring is on
  },
};
```

```ts
// src/shared/lib/safe-url.test.ts
import { safeHref, safeRedirect } from "./safe-url";

it("blocks javascript: links", () => expect(safeHref("javascript:alert(1)")).toBeUndefined());
it("keeps https links", () => expect(safeHref("https://a.test/x")).toBe("https://a.test/x"));
it("blocks protocol-relative redirects", () => expect(safeRedirect("//evil.test")).toBe("/"));
it("keeps same-origin paths", () => expect(safeRedirect("/account")).toBe("/account"));
```

`views/home/ui/HomeView.tsx`: a `<main>` with one `h1`, a short description and
a shadcn `Button` — proves Tailwind + shadcn + alias work and gives the smoke
spec its `main` landmark.

## Optional — Monitoring (Sentry), only if the user said yes

Follow `../team-frontend/references/observability.md` for the mode:

- Next: `@sentry/nextjs`, `instrumentation.ts`, `instrumentation-client.ts`,
  `src/shared/config/monitoring/{scrub,sentry}.ts`, `withSentryConfig` in
  `next.config.ts`, `app/error.tsx` + `app/global-error.tsx` report via
  `logger.error` → `Sentry.captureException`.
- Vite: `@sentry/react` + `@sentry/vite-plugin`, `src/app/sentry.ts` imported
  first in `main.tsx`, root `onUncaughtError`/`onCaughtError` hooks,
  `build.sourcemap: 'hidden'`.
- Swap `shared/lib/logger.ts` for the Sentry version; add the Sentry ingest
  host to `connect-src` in the CSP.
- **DSN is never hard-coded and never asked for in chat.** Add
  `SENTRY_DSN: z.string().url().optional()` and `APP_ENV` to `env.ts` (Next
  `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_APP_ENV`, Vite `VITE_SENTRY_DSN` /
  `VITE_APP_ENV`), an empty line in
  `.env.example`, and `enabled` only when production **and** a DSN is set.
  Report `// TODO: put the DSN in .env.local / CI secrets`;
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` exist only as CI secrets.
- Web Vitals reporter (`WebVitals.tsx` / `src/app/vitals.ts`) only when a
  same-site vitals endpoint exists — otherwise leave a TODO.

## Optional — i18n, only for more than one locale

Follow `../team-frontend/references/i18n.md`:

- Next: `next-intl`; routes move under `app/[locale]/` (layout validates the
  locale and sets `<html lang dir>`), `messages/<locale>.json` at the root,
  `src/shared/config/i18n/{routing,request,navigation}.ts`, `withNextIntl` in
  `next.config.ts`. `proxy.ts`: auth redirect first, then
  `const response = intl(request)`, then set the CSP headers on that response.
- React: `react-i18next` + ICU, `src/shared/config/i18n/i18n.ts` imported once
  in `main.tsx`, `locales/<lng>/common.json`, typed `CustomTypeOptions`.
- `HomeView` text comes from messages; add one smoke spec per extra locale.

## Finish

1. With the detected manager: `format`, `lint`, `typecheck`, `test`, `build`, then
   `test:e2e` — all must pass; report real output.
2. First commit: `chore: scaffold project from team frontend template`.
3. Print the tree, the TODOs (API URL, refresh cookie name, protected routes,
   Sentry DSN), and next steps (`/front-template entity <name>` …).
