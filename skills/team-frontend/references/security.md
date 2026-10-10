# Security — CSP, XSS, cookies/CSRF, Server Actions, secrets

Applies to both modes unless marked **Next** or **React (Vite)**. Token
storage and the HTTP clients are in `http-axios.md`; this file covers
everything around them.

## 1. Content Security Policy

Goal: no inline script runs unless we put it there; no script loads from an
origin we didn't allow-list.

### Next — nonce via `proxy.ts`

```ts
// proxy.ts (project root, next to app/)
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? ` 'unsafe-eval'` : ''}`,
    `style-src 'self' 'unsafe-inline'`, // Tailwind/Radix inline style attrs; scripts are what matter
    `img-src 'self' data: blob: https://cdn.example.com`,
    `font-src 'self'`, // next/font self-hosts
    `connect-src 'self' https://api.example.com https://*.ingest.sentry.io`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce) // Next applies it to its own scripts
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  // auth redirect / locale logic goes in this same function (nextjs.md §7)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

```tsx
// reading the nonce for a third-party <Script> (server component)
import { headers } from 'next/headers'
import Script from 'next/script'

export async function Analytics() {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return <Script src="https://analytics.example.com/a.js" strategy="afterInteractive" nonce={nonce} />
}
```

- A nonce CSP makes every matched page **dynamic** (new nonce per request) —
  static/`"use cache"` page output can't carry it. For mostly-static sites use
  a static CSP header without nonces (`script-src 'self'` + allow-listed hosts)
  from `next.config.ts` and keep inline scripts out.
- Roll out with `Content-Security-Policy-Report-Only` first, then enforce.
- Origins in the policy come from env (`env.ts`), not hard-coded per page.

### React (Vite) — hosting headers, `<meta>` fallback

A Vite SPA build has no inline scripts, so a strict static policy works:
`script-src 'self'`. Set it as a **response header at the host/CDN**
(nginx `add_header`, `_headers` file, `vercel.json` `headers`, CloudFront
response-headers policy) together with the headers in §2.

If the host can't set headers, use a meta tag in `index.html` — note that
`frame-ancestors`, `report-uri` and `sandbox` are **ignored** in `<meta>`:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
           img-src 'self' data: https:; connect-src 'self' https://api.example.com;
           base-uri 'self'; form-action 'self'; object-src 'none'" />
```

The Vite dev server injects inline scripts (HMR) — apply the meta only in the
production build (e.g. a small `transformIndexHtml` plugin with `apply: 'build'`).

## 2. Security headers

Set on every HTML response (Next: `headers()` in `next.config.ts`; Vite: host).

| Header | Value |
| --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` (legacy twin of `frame-ancestors 'none'`) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` (enable only what's used) |
| `Cross-Origin-Opener-Policy` | `same-origin` |

```ts
// next.config.ts (excerpt)
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}
```

## 3. XSS

React escapes text output — the holes are the escape hatches.

- **`dangerouslySetInnerHTML` is banned** unless the HTML is sanitised with
  DOMPurify in a `shared/lib` helper (in Next server code use
  `isomorphic-dompurify`). Never sanitise inline at the call site.

```ts
// shared/lib/sanitize.ts
import DOMPurify from 'dompurify'

export const sanitizeHtml = (dirty: string) =>
  DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
```

```tsx
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.bodyHtml) }} />
```

- **No `javascript:` / `data:` URLs** from user data in `href`, `src`,
  `formAction`. Pass user-supplied links through an allow-list:

```ts
// shared/lib/safe-url.ts
const ALLOWED = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function safeHref(input: string): string | undefined {
  try {
    const url = new URL(input, 'https://placeholder.invalid')
    return ALLOWED.has(url.protocol) ? input : undefined
  } catch {
    return undefined
  }
}

/** Open-redirect guard for ?next= / ?returnTo= params: same-origin paths only. */
export function safeRedirect(target: string | null | undefined, fallback = '/'): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return fallback
  }
  return target
}
```

- Every `redirect()`, `router.navigate()`, `window.location` assignment that
  uses a query param or API value goes through `safeRedirect`.
- No `eval`, `new Function`, string `setTimeout`, or `innerHTML`/`outerHTML`/
  `insertAdjacentHTML` on refs.
- `postMessage` listeners check `event.origin` against an allow-list.
- Markdown/rich text: render with a library that doesn't emit raw HTML by
  default (e.g. `react-markdown` without `rehype-raw`), or sanitise.
- Don't serialise untrusted data into `<script>` tags yourself; use the
  framework's data passing (RSC props, loaders).

## 4. Cookies and CSRF

- Auth cookies are always `httpOnly; Secure; Path=/`. `SameSite` depends on
  whether app and API are same-site — table in `http-axios.md` ("Cookies").
- **Cross-site API → prefer a BFF**: a route handler on the app origin
  (`app/api/[...path]/route.ts`, `serverFetch` upstream) so cookies stay
  same-site and `SameSite=Strict|Lax` works. In React (Vite) mode the BFF is
  the host's reverse proxy (`/api` → API) — never `SameSite=None` just to
  avoid setting one up.
- `SameSite=None` is allowed only with `Secure` + a CSRF token on every
  state-changing request + a credentialed CORS allow-list (no `*`).
- CSRF token pattern for cookie-auth mutations:
  - Same-site: double-submit — backend sets a readable `csrf_token` cookie;
    axios sends it back automatically:
    `axios.create({ xsrfCookieName: 'csrf_token', xsrfHeaderName: 'X-CSRF-Token' })`.
  - Cross-site: the app can't read the API's cookies — fetch the token from
    `GET /auth/csrf`, keep it in memory next to the access token, attach it in
    the request interceptor.
- Never perform state changes on `GET`.
- Bearer-token requests (`Authorization` header) aren't CSRF-able; the refresh
  call is cookie-auth, so it needs the rules above.

## 5. Server Actions and route handlers (Next)

Every Server Action is a **public POST endpoint** — anyone can call it with
any payload, regardless of which UI renders it.

```ts
// features/delete-product/api/delete-product.action.ts
'use server'
import { z } from 'zod'
import { updateTag } from 'next/cache'
import { requireSession } from '@/entities/session/api/session.server'
import { serverFetch } from '@/shared/api/http.server'

const Input = z.object({ id: z.string().uuid() })

export async function deleteProduct(_prev: unknown, formData: FormData) {
  const session = await requireSession() // reads cookie, redirects to /login if absent
  if (!session.permissions.includes('product:delete')) {
    return { ok: false as const, error: 'Forbidden' }
  }

  const parsed = Input.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }

  await serverFetch(`/products/${parsed.data.id}`, { method: 'DELETE' })
  updateTag('products')
  return { ok: true as const }
}
```

- **Authenticate and authorise inside the action** (and inside each route
  handler) — never rely on the page/proxy having checked. `proxy.ts` is for
  redirects, not authorization.
- **Validate all input with zod** (`safeParse`), including ids from hidden
  fields and bound arguments.
- Return minimal, serialisable results — never whole backend objects,
  stack traces or secrets. Map errors to user-safe messages.
- Next checks `Origin` vs `Host` for actions; set
  `experimental.serverActions.allowedOrigins` only for known reverse proxies.
- Don't capture secrets in closures of inline actions; read them from
  `serverEnv` inside the action body.
- Route handlers that mutate check `Origin`/CSRF token themselves.

## 6. Env and secrets

- Secrets live only in server env: `shared/config/env.server.ts` with
  `import 'server-only'` (Next). A React (Vite) SPA has **no** secrets — every
  value the build reads is public.
- `NEXT_PUBLIC_*` and `VITE_*` are inlined into the JS bundle at build time.
  Only public values (API base URL, Sentry DSN, feature flags) get the prefix.
  Never change Vite's `envPrefix` to `''`.
- Never pass secrets or full server config as props to client components.
- `.env*.local` is git-ignored; commit `.env.example` with placeholder values.
- Any secret that reached a bundle, log or repo is rotated, not just removed.

## 7. Dependencies and supply chain

- Lockfile committed; CI installs with the frozen command
  (`npm ci` / `pnpm install --frozen-lockfile` / `yarn install --immutable` /
  `bun install --frozen-lockfile`).
- Audit in CI, failing on high+ for production deps:
  `npm audit --audit-level=high --omit=dev` ·
  `pnpm audit --audit-level high --prod` ·
  `yarn npm audit --severity high --environment production` · `bun audit`.
- Unfixable advisory → documented, time-boxed exception, not a disabled job.
- Restrict install scripts (pnpm `onlyBuiltDependencies`); review new deps
  before adding them (`dependency-updates.md`).

## 8. Third-party scripts

- Every external script is a full XSS vector — needs team sign-off and an
  entry in the CSP allow-list.
- Next: load via `next/script` with the CSP `nonce` and the latest acceptable
  `strategy` (`afterInteractive` / `lazyOnload`). Vite: add in `index.html` or
  load dynamically after consent.
- Pin versions; static CDN files get `integrity` (SRI) + `crossorigin="anonymous"`;
  prefer self-hosting.
- Tag managers and analytics load only after consent; embeds go in
  `<iframe sandbox>` with the minimum `allow-*` flags.
- Error reporting/analytics scrub PII and tokens (`sendDefaultPii: false`,
  `beforeSend` redaction).

## Reviewer checklist

- [ ] No `dangerouslySetInnerHTML` without `sanitizeHtml`; no `innerHTML`/`eval`
- [ ] User-supplied URLs pass `safeHref`; redirect targets pass `safeRedirect`
- [ ] CSP present (nonce in `proxy.ts` for Next, host header for Vite); no `'unsafe-inline'` in `script-src`
- [ ] Security headers from §2 set; `poweredByHeader: false`
- [ ] Tokens only in memory / `httpOnly` cookies; nothing in `localStorage`
- [ ] `SameSite` matches topology; cross-site API goes through a BFF or has `SameSite=None; Secure` + CSRF token
- [ ] Every Server Action / mutating route handler authenticates, authorises and zod-validates its input
- [ ] Server code uses `serverFetch`, never axios; server modules have `import 'server-only'`
- [ ] No secrets in `NEXT_PUBLIC_*` / `VITE_*`; `process.env` read only in `shared/config/env*.ts`
- [ ] CI runs the package manager's audit and a frozen install
- [ ] New third-party script: approved, CSP-listed, nonce/SRI, consent-gated
- [ ] Errors/logs don't leak PII, tokens or stack traces to the client
