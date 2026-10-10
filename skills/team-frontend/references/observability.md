# Observability — errors, logging, Web Vitals, performance budgets

Goal: every production error reaches Sentry with a readable stack and no
personal data; every route has a measured performance budget.
Commands use `npm`; use the package manager detected from the lockfile.

## Where it lives (FSD)

```
src/shared/config/monitoring/   # Sentry options shared by all runtimes (dsn, env, scrub)
src/shared/lib/logger.ts        # the only logging API
src/app-layer/WebVitals.tsx     # Next: useReportWebVitals reporter ("use client")
src/app/vitals.ts               # Vite: web-vitals reporter
```

DSN and sample rates are read through `shared/config/env` (validated with zod)
like any other env value and exposed mode-neutrally as `env.SENTRY_DSN` /
`env.APP_ENV` (mapped in `env.ts` from `NEXT_PUBLIC_SENTRY_DSN` /
`NEXT_PUBLIC_APP_ENV` or `VITE_SENTRY_DSN` / `VITE_APP_ENV`, same pattern as
`env.API_URL`). `SENTRY_AUTH_TOKEN` (CI only, never in the browser bundle).

## Sentry — Next.js (`@sentry/nextjs`)

```bash
npm i @sentry/nextjs
```

```ts
// src/shared/config/monitoring/scrub.ts — used by Next and Vite
import type { ErrorEvent } from "@sentry/nextjs"; // '@sentry/react' in Vite projects

const SECRET_KEYS = /pass(word)?|token|secret|authorization|cookie|email|phone|card|iban/i;

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  if (event.user) event.user = { id: event.user.id }; // id only, never email/name/IP
  if (event.extra) {
    for (const key of Object.keys(event.extra))
      if (SECRET_KEYS.test(key)) event.extra[key] = "[scrubbed]";
  }
  return event;
}
```

```ts
// src/shared/config/monitoring/sentry.ts — Next: options shared by client, server, edge
import { env } from "@/shared/config/env";
import { scrubEvent } from "./scrub";

export const sentryBase = {
  dsn: env.SENTRY_DSN,
  environment: env.APP_ENV,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
};
```

```ts
// instrumentation-client.ts (project root, browser)
import * as Sentry from "@sentry/nextjs";
import { sentryBase } from "@/shared/config/monitoring/sentry";

Sentry.init({
  ...sentryBase,
  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1, // optional; remove the integration if the product forbids replay
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

```ts
// instrumentation.ts (project root, server + edge)
import * as Sentry from "@sentry/nextjs";
import { sentryBase } from "@/shared/config/monitoring/sentry";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryBase);
  }
}

// Errors thrown in RSC, Server Actions, route handlers, proxy.ts
export const onRequestError = Sentry.captureRequestError;
```

```ts
// next.config.ts
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* … */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN, // present only in CI → upload only in CI
  silent: !process.env.CI,
  sourcemaps: { deleteSourcemapsAfterUpload: true }, // never serve .map files publicly
  widenClientFileUpload: true,
});
```

`npx @sentry/wizard@latest -i nextjs` generates a similar setup; keep the result
aligned with the files above (one shared options object, scrubbing on).

### Error boundaries (Next)

Server errors are reported by `onRequestError`. Client render errors are
reported from the boundaries — this is a legitimate `useEffect` (sync with an
external system):

```tsx
// app/error.tsx (and nested error.tsx for sections with their own fallback)
"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorState } from "@/shared/ui/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return <ErrorState onRetry={reset} />;
}
```

```tsx
// app/global-error.tsx — replaces the root layout, so it renders <html>/<body>
"use client";
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
```

- Every route group that loads data has an `error.tsx`; `global-error.tsx` is mandatory.
- Never show `error.message` from the server to the user — show a generic
  message; `error.digest` links the UI to the server log.

## Sentry — React + Vite (`@sentry/react`)

```bash
npm i @sentry/react
npm i -D @sentry/vite-plugin
```

```ts
// src/app/sentry.ts — imported first in main.tsx
import * as Sentry from "@sentry/react";
import { env } from "@/shared/config/env";
import { scrubEvent } from "@/shared/config/monitoring/scrub";
import { router } from "./router";

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.APP_ENV,
  enabled: import.meta.env.PROD,
  sendDefaultPii: false,
  integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
  tracesSampleRate: 0.1,
  tracePropagationTargets: [env.API_URL], // only our API gets trace headers
  beforeSend: scrubEvent,
});
```

```tsx
// src/app/main.tsx — React 19 root error hooks
import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import "./sentry";

createRoot(document.getElementById("root")!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(<App />);
```

Route errors: `errorComponent` on every route that loads data (and a
`defaultErrorComponent` on the router) — render `ErrorState` with `reset`;
reporting already happens through the root hooks above.

```ts
// vite.config.ts — source maps uploaded in CI only, then deleted
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  build: { sourcemap: "hidden" },
  plugins: [
    // …tanstackRouter(), react(), tailwindcss()
    process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
      }),
  ],
});
```

## PII rules

- `sendDefaultPii: false`; user context is `Sentry.setUser({ id })` only.
- `beforeSend` scrubs cookies, headers, request bodies, query strings, and keys
  matching password/token/secret/email/phone/card.
- Replay (if enabled at all): `maskAllText`, `blockAllMedia`, error-only sampling.
- Never put user input or API response bodies into `extra`/`tags`/breadcrumbs.
- Release = commit SHA (`SENTRY_RELEASE` / plugin default) so stacks map to source.

## Logging

- **No `console.log` in committed code.** ESLint: `'no-console': ['warn', { allow: ['warn', 'error'] }]`;
  CI runs lint with `--max-warnings 0`.
- Use the logger; in production it becomes breadcrumbs/events, not console noise.

```ts
// src/shared/lib/logger.ts
import * as Sentry from "@sentry/nextjs"; // '@sentry/react' in Vite projects

type Ctx = Record<string, string | number | boolean | null>;
const isDev = process.env.NODE_ENV !== "production"; // Vite: import.meta.env.DEV

export const logger = {
  debug: (msg: string, ctx?: Ctx) => isDev && console.warn(`[debug] ${msg}`, ctx ?? ""),
  info: (msg: string, ctx?: Ctx) =>
    Sentry.addBreadcrumb({ level: "info", message: msg, data: ctx }),
  warn: (msg: string, ctx?: Ctx) => {
    if (isDev) console.warn(msg, ctx ?? "");
    Sentry.addBreadcrumb({ level: "warning", message: msg, data: ctx });
  },
  error: (err: unknown, ctx?: Ctx) => {
    if (isDev) console.error(err, ctx ?? "");
    Sentry.captureException(err, { extra: ctx });
  },
};
```

- Context values are ids and flags, never personal data.
- Expected errors (`ApiError` 4xx shown to the user) are not sent as exceptions;
  5xx / network / unexpected-shape errors are.

## Web Vitals

Next — one reporter mounted once in the root layout:

```tsx
// src/app-layer/WebVitals.tsx
"use client";
import { useReportWebVitals } from "next/web-vitals";
import { sendVital } from "@/shared/lib/vitals";

export function WebVitals() {
  useReportWebVitals(sendVital);
  return null;
}
```

Vite:

```ts
// src/app/vitals.ts — called once from main.tsx
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import { sendVital } from "@/shared/lib/vitals";

export function reportWebVitals() {
  [onCLS, onFCP, onINP, onLCP, onTTFB].forEach((on) => on(sendVital));
}
```

```ts
// src/shared/lib/vitals.ts
type Vital = { name: string; value: number; rating?: string; id: string; navigationType?: string };

export function sendVital(metric: Vital) {
  const body = JSON.stringify({ ...metric, path: location.pathname });
  const url = "/api/vitals"; // our analytics endpoint (route handler / BFF), same-site
  if (!navigator.sendBeacon?.(url, body)) {
    void fetch(url, { method: "POST", body, keepalive: true });
  }
}
```

Report the route **pattern** (`/products/[id]`) when available, not raw URLs
with ids or query strings.

## Performance budgets

| Metric (p75, mobile) | Budget |
| --- | --- |
| JS first load per route (gzip) | ≤ 170 kB |
| LCP | ≤ 2.5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 |
| TTFB (SSR routes) | ≤ 800 ms |

- A PR that pushes a route over budget needs a justification in the PR and a
  follow-up ticket; otherwise split (`next/dynamic`, route-level lazy loading,
  `autoCodeSplitting`) or drop the dependency.
- Field data (Web Vitals endpoint / Sentry performance) is the source of truth;
  lab tools are for diagnosis.

### Bundle analysis

Next:

```bash
npm i -D @next/bundle-analyzer
```

```ts
// next.config.ts
import bundleAnalyzer from "@next/bundle-analyzer";
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
export default withBundleAnalyzer(nextConfig); // wrap inside withSentryConfig
```

`@next/bundle-analyzer` works with webpack builds: `ANALYZE=true next build --webpack`.
On Turbopack, use the built-in analyzer if your Next version ships one
(`next experimental-analyze`). Script: `"analyze": "ANALYZE=true next build --webpack"`
(use `cross-env` on Windows).

Vite:

```ts
// vite.config.ts
import { visualizer } from "rollup-plugin-visualizer";
// plugins: [..., process.env.ANALYZE && visualizer({ filename: 'stats.html', gzipSize: true, brotliSize: true })]
```

Check before adding any dependency > 20 kB gz: is there a smaller alternative
or a native API (`Intl`, `structuredClone`, `fetch`)?

### `size-limit` in CI (optional, recommended for Vite)

```bash
npm i -D size-limit @size-limit/file
```

```json
// .size-limit.json
[
  { "name": "entry", "path": "dist/assets/index-*.js", "limit": "170 kB" },
  { "name": "all JS", "path": "dist/assets/*.js", "limit": "450 kB" }
]
```

Script `"size": "size-limit"`, run after `build` in CI; the job fails when a
limit is exceeded. For Next, prefer the analyzer report per route — chunk file
names don't map 1:1 to routes.

## Rules

- Sentry initialised for every runtime (client, server, edge / browser), `enabled` only in production.
- Source maps: generated, uploaded **from CI only** (`SENTRY_AUTH_TOKEN` exists only there), deleted after upload.
- PII scrubbed in `beforeSend`; user = id only.
- Next: `error.tsx` per data route group + `global-error.tsx`, both report to Sentry.
  React: `errorComponent` per data route + root `onUncaughtError`/`onCaughtError`.
- No `console.log`; use `shared/lib/logger`.
- Web Vitals reported to our endpoint; budgets above enforced in review/CI.
