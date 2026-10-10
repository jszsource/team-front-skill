# Changelog

All notable changes to this package are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: SemVer.
The version here must match `VERSION`, `.claude-plugin/*.json`, `package.json`
and the status line of `skills/team-frontend/STANDARDS.md` (checked by
`node scripts/validate.mjs`).

## [2.0.0] - 2026-10-10

### Breaking

- Prettier style is now `semi: true`, double quotes, `trailingComma: "all"`,
  `printWidth: 100`, plugins listed explicitly (`prettier-plugin-tailwindcss`
  only for `next` and `shadcn-tailwind-tanstack-router`). All examples in the
  package follow it; existing projects reformat once.
- ESLint is stricter: type-checked `typescript-eslint` on `src/**`
  (`no-floating-promises`, `no-misused-promises`), `import/order`,
  `unused-imports`, `consistent-type-imports`, `eqeqeq`; tsconfig adds
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.

### Added

- Project profiles (STANDARDS §1.1), each a fixed bundle of architecture,
  router and UI kit: `next` (FSD + Tailwind + shadcn/ui), React
  `shadcn-tailwind-tanstack-router` (default: FSD + TanStack Router +
  Tailwind v4 + shadcn/ui) and React `antd-scss-react-router` (feature
  folders + React Router v7 data mode + Ant Design v5 + SCSS modules, no
  Tailwind: AntD `Table`, `App.useApp()` toasts, `ConfigProvider` theme
  tokens in `shared/lib/theme.ts`, shared components in `shared/components/`
  with `*.module.scss`), plus `legacy`. Recorded as one line in the project's
  `CLAUDE.md` (`## Frontend profile` → `- profile: <name>`) or auto-detected;
  there is no separate `ui:` or `router:` choice.
- STANDARDS §2.5 feature-folder architecture; new references
  `feature-architecture.md` (incl. FSD → feature path map), `react-router-dom.md`,
  `ui-antd-scss.md`; `front-template` `antd-scss-react-router` templates.
- State rules (§7): key factories only, per-endpoint cache policy documented
  next to the keys, exponential-backoff retry, `signal` cancellation,
  invalidation matrix, no argless `invalidateQueries()`, `createResettableStore`
  and full reset on logout (`resetAllStores()` + `queryClient.clear()`).
- UI rules (§8): RHF + zod form wrappers with `form.setError` for server
  errors, virtualisation from 100 rows, `@tanstack/react-table`, `aria-label`
  on icon-only buttons, lazy-loaded heavy parts.
- Naming (§3.3): `{domain}.store.ts`, `{name}.schema.ts`, `query-keys.ts`,
  named exports, `z.infer` types.
- `/front-setup` (one profile question for a new React project, installs
  per profile), front-reviewer and front-refactorer (antd profile: flags a
  second UI kit such as Tailwind/shadcn/`sonner`, static `message` /
  `notification`, global SCSS instead of modules) are profile-aware. The
  profile is detected from the **existing structure first**; the `CLAUDE.md`
  section only confirms it (on conflict the code wins and the mismatch is
  reported). Projects matching neither layout are `legacy`: their layout is
  kept, new code goes next to similar code, only non-structural rules apply.

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
