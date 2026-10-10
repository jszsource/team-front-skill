# Changelog

All notable changes to this package are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: SemVer.
The version here must match `VERSION`, `.claude-plugin/*.json`, `package.json`
and the status line of `skills/team-frontend/STANDARDS.md` (checked by
`node scripts/validate.mjs`).

## [1.3.0] - 2026-10-10

### Added

- STANDARDS §5: App Router only (no Pages Router APIs); Server Action file
  rules (`'use server'` files export only async functions, no inline actions in
  client files, `void` form action vs `useActionState`); `redirect()`/`notFound()`
  outside `try/catch`; navigation (`<Link>`/`redirect()`/`useRouter`, no
  `window.location` for internal routes); `useSearchParams` inside `<Suspense>`;
  `notFound()` + `generateStaticParams`/`dynamicParams`; route handlers only for
  external callers; parallel-route `default.tsx` and intercepting-route modals;
  cookies written only on the server.
- STANDARDS §4: replacements for reading `window`/`navigator` and
  browser-dependent rendering.
- `references/nextjs.md` §11–17: navigation and URL state, route handlers,
  dynamic segments/404, parallel and intercepting routes, cookies, draft mode,
  root layout/special files; Server Action file shapes; Pages → App Router
  mapping table.
- `references/use-effect.md`: new replacement rows and a hydration-safety section.
- front-reviewer: matching Next.js checks.

## [1.2.0] - 2026-10-10

### Added

- `evals/review-fixture/`: deliberately broken Next.js app, `expected.json`
  (19 required findings + a false-positive trap) and `scripts/eval-review.mjs`
  (`npm run eval:review`) to score a real front-reviewer run. CI scores the
  hand-written `golden-report.txt` to keep fixture and scorer consistent.
- Validator checks: frontmatter descriptions ≤ 500 chars; component/hook line
  limits in every file match STANDARDS; eval fixture files and § numbers exist;
  non-failing warning when STANDARDS "Last reviewed" is older than 180 days.
- MIT `LICENSE`; `license` field in `package.json` and `plugin.json`.

### Changed

- front-reviewer counts the 150-line limit like ESLint `max-lines` (blank and
  comment lines excluded) instead of raw `wc -l`, which produced false positives.
- Installers back up a locally modified agent/command file to
  `.team-front-backup/<agents|commands>-<old-version>/` before overwriting it.
- Agents use `model: inherit` instead of a hard-coded model.
- Shorter frontmatter descriptions for both skills, both agents and `/front-setup`.

## [1.1.0] - 2026-10-10

### Added

- Next.js server-side HTTP: thin typed `fetch` wrapper (`shared/api/http.server.ts`)
  for RSC, Server Actions and route handlers, so request memoization,
  `"use cache"`, `revalidate` and cache tags keep working. axios stays
  client-only (single-flight refresh interceptor) and is never imported in server code.
- Cookie `SameSite` / CSRF rules; cross-site APIs must go through a BFF or a same-site origin.
- New references: `security.md` (XSS, `dangerouslySetInnerHTML`, CSP, cookies),
  `e2e-playwright.md` (Playwright + automated a11y with `@axe-core/playwright`),
  `observability.md` (Sentry, error boundaries, Web Vitals, bundle budgets),
  `i18n.md` (next-intl for Next.js, react-i18next for React),
  `ci.md` (GitHub Actions template for target projects).
- Package-manager awareness: npm / pnpm / yarn / bun detected from the lockfile.
- Claude Code plugin manifest (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`).
- Installers write a version stamp (`.installed-version` in every installed skill folder),
  print the old → new version, and back up locally modified skill folders to
  `.claude/.team-front-backup/<skill>-<old-version>` before replacing them.
- `uninstall.sh` / `uninstall.ps1`.
- `VERSION`, this changelog, `scripts/validate.mjs` (frontmatter, cross-references,
  reference index, version consistency, installer parity, no external URLs)
  and a GitHub Actions workflow running it plus installer smoke tests.

### Changed

- ESLint config uses `defineConfig`.
- Boolean-props rule softened.
- Dependency version check no longer runs every session.

## [1.0.0]

### Added

- Initial release: `STANDARDS.md`, `team-frontend` skill with topic references,
  `front-template` skill, `front-reviewer` / `front-refactorer` agents,
  `/front-setup` command, `install.sh` / `install.ps1`.
