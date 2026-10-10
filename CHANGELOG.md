# Changelog

All notable changes to this package are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: SemVer.
The version here must match `VERSION`, `.claude-plugin/*.json`, `package.json`
and the status line of `skills/team-frontend/STANDARDS.md` (checked by
`node scripts/validate.mjs`).

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
