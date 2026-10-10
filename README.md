# team-front-skill

🇦🇿 [Azərbaycanca oxu](README.az.md)

Claude Code package with the team's frontend standards for Next.js and React.
Next.js projects use Feature-Sliced Design + Tailwind + shadcn/ui. React SPAs
choose one of two fixed profiles: `shadcn-tailwind-tanstack-router` (default:
FSD + TanStack Router + Tailwind v4 + shadcn/ui) or `antd-scss-react-router`
(feature folders + React Router + Ant Design v5 + SCSS modules, no Tailwind).
The choice is stored as one line in the project's `CLAUDE.md`
(`## Frontend profile` → `- profile: <name>`, STANDARDS §1.1).
Current version: see `VERSION` (changes in `CHANGELOG.md`).

| Path | What it is |
| --- | --- |
| `skills/team-frontend/STANDARDS.md` | **The standard** (paste into Confluence). Single source of truth. |
| `skills/team-frontend/SKILL.md` | Skill: applied automatically when writing/reviewing frontend code |
| `skills/team-frontend/references/` | Detailed rules + code templates (offline, no external URLs) |
| `skills/front-template/` | Skill: `/front-template` generates projects, FSD slices and components in the team format |
| `agents/front-reviewer.md` | Subagent: read-only review against the standard |
| `agents/front-refactorer.md` | Subagent: decomposes/refactors code to the standard, keeps tests green |
| `commands/front-setup.md` | `/front-setup [audit-only]`: audit + set up tooling, tests, CI, http, security, monitoring, FSD |
| `hooks/` | `front-check.mjs` PostToolUse hook (line limits + ESLint after every edit) and its plugin registration `hooks.json` |
| `.claude-plugin/` | Plugin manifest (`plugin.json`) and marketplace (`marketplace.json`) |
| `install.*` / `uninstall.*` | Copy-based install into a `.claude/` folder, and removal |
| `scripts/validate.mjs` | Package QA (run locally and in GitHub Actions) |
| `evals/` + `scripts/eval-review.mjs` | Behaviour eval: broken fixture app + scorer for a real front-reviewer run |

### References

| File | Topic |
| --- | --- |
| `fsd.md` | Feature-Sliced Design layers, slices, public API (Next.js, `shadcn-tailwind-tanstack-router`) |
| `feature-architecture.md` | `antd-scss-react-router` profile: feature folders, naming, imports, FSD → feature path map |
| `components.md` | 150-line limit, decomposition, props |
| `use-effect.md` | `useEffect` replacements |
| `react-patterns.md` | composition, data-fetching, performance patterns |
| `nextjs.md` | App Router, RSC, caching, Server Actions, `proxy.ts` |
| `react-tanstack-router.md` | `shadcn-tailwind-tanstack-router` profile routing with TanStack Router |
| `react-router-dom.md` | `antd-scss-react-router` profile routing with React Router |
| `http-axios.md` | axios client + refresh interceptor, `serverFetch` for the Next server, env, tokens, cookies |
| `security.md` | CSP, security headers, XSS, cookies/CSRF, Server Actions, secrets, audit |
| `state-data.md` | TanStack Query (key factories, cache policy, invalidation), Zustand (resettable stores, logout reset) |
| `ui-tailwind-shadcn.md` | Next.js and `shadcn-tailwind-tanstack-router`: Tailwind v4, shadcn/ui, forms, virtualised lists, accessibility |
| `ui-antd-scss.md` | `antd-scss-react-router`: Ant Design v5 + SCSS modules, theme tokens, `App.useApp()` toasts, AntD `Table` |
| `testing-vitest.md` | Vitest + Testing Library + MSW |
| `e2e-playwright.md` | Playwright E2E + automated a11y (`@axe-core/playwright`) |
| `observability.md` | Sentry, error boundaries, logging, Web Vitals, performance budgets |
| `i18n.md` | next-intl (Next) / react-i18next (React), `Intl`, RTL |
| `tooling.md` | package-manager detection, ESLint, Prettier, husky, commitlint |
| `ci.md` | GitHub Actions template for target projects |
| `dependency-updates.md` | version check and upgrades |
| `refactoring-smells.md` | code smells and refactorings |

## Quick start for teammates

**Before you start:** you need Claude Code and read access to
`jszsource/team-front-skill` on GitHub. If the repo is private, ask to be added
to it, then make sure git can reach GitHub (SSH key or `gh auth login`).

Pick **one** of these options:

1. **Your frontend repo already has `.claude/settings.json` with the plugin
   (Option B below).** Open the project in Claude Code and accept the prompt to
   install the plugin. That's all.
2. **Only you want it:** run the two `/plugin` commands in Option A.
3. **Check that it works:** in a React/Next.js project, ask Claude to "create a
   product list page", or run `/team-front-skill:front-setup audit-only`.

Update to a new version with `/plugin marketplace update team-front`.

## Install

### Option A — Claude Code plugin (recommended)

```text
/plugin marketplace add jszsource/team-front-skill
/plugin install team-front-skill@team-front
```

You can also use a full git URL or a local path in place of `jszsource/team-front-skill`.

Plugin commands and skills are namespaced, e.g. `/team-front-skill:front-setup`,
`/team-front-skill:front-template next`. After a new version is published,
refresh the marketplace (`/plugin marketplace update team-front`) and update the
plugin from the `/plugin` menu.

### Option B — enable it for a whole frontend repo (team-wide)

Commit this to the **frontend project's** `.claude/settings.json`. Anyone who
opens that project in Claude Code is asked to install the plugin, so nobody
runs any commands by hand:

```json
{
  "extraKnownMarketplaces": {
    "team-front": {
      "source": { "source": "github", "repo": "jszsource/team-front-skill" }
    }
  },
  "enabledPlugins": {
    "team-front-skill@team-front": true
  }
}
```

If the file already exists, merge these keys into it.

### Option C — copy into `.claude/` with the installer

From the project root (where `.claude/` should live):

```bash
# macOS / Linux / Git Bash
bash /path/to/team-front-skill/install.sh
```

```powershell
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File C:\path\to\team-front-skill\install.ps1
```

To install for all your projects instead, pass the target:
`install.sh ~/.claude` / `install.ps1 -Target $HOME\.claude`.

**Upgrades.** Re-run the installer from the new version. It writes the version
to `skills/<skill>/.installed-version` and prints old → new. If an installed
skill folder differs from the one being installed (local edits or an older
version), it is first backed up to `.claude/.team-front-backup/<skill>-<old-version>`
(a timestamp is appended if that backup already exists), then replaced. Agents
and commands are overwritten. Re-apply any local edits from the backup by hand.

**Uninstall.**

```bash
bash /path/to/team-front-skill/uninstall.sh [target-.claude-dir]
```

```powershell
powershell -ExecutionPolicy Bypass -File C:\path\to\team-front-skill\uninstall.ps1 [-Target <dir>]
```

Removes exactly the shipped skills, agents, command and hook (and its entry in
`settings.json`); backups in `.team-front-backup/` are kept. Plugin installs
are removed with `/plugin uninstall team-front-skill@team-front`.

### Edit-time check (hook)

After every `Write`/`Edit`, `hooks/front-check.mjs` checks the edited file and
reports problems back to Claude, which then fixes them:

- `.tsx` over 150 lines (STANDARDS §3.1) or a `use*.ts(x)` hook over 80 lines
  (§9), counted like ESLint `max-lines` (blank lines and comments skipped);
  tests, stories and shadcn sources in `src/shared/ui/` are exempt;
- if the project has ESLint installed: ESLint on that file with
  `--max-warnings 0` (§11).

It runs only in projects whose nearest `package.json` depends on `react` or
`next`, and needs Node 20+. The plugin registers it via `hooks/hooks.json`; the
installers copy it to `.claude/hooks/` and add it to `.claude/settings.json`
(other settings are kept). Turn it off with `TEAM_FRONT_HOOK=off`, or only the
ESLint part with `TEAM_FRONT_HOOK_ESLINT=off`.

## Use

- Just work: "create a product list page", "add login with refresh token" → the
  skill is picked up automatically.
- `/front-template react` — in an empty folder (no `package.json`): sets up a React project right in this folder; asks for the profile (`shadcn-tailwind-tanstack-router` by default, or `antd-scss-react-router`).
- `/front-template react-shadcn` — `shadcn-tailwind-tanstack-router` profile (Vite + TanStack Router + FSD + Tailwind v4 + shadcn/ui).
- `/front-template react-antd` — `antd-scss-react-router` profile (Vite + React Router + feature folders + Ant Design v5 + SCSS modules).
- `/front-template next` — same, with the latest Next.js (App Router).
- `/front-template project my-app react` — new React project (Vite + TanStack Router) in a new `my-app/` folder.
- `/front-template project my-app next` — new Next.js (App Router) project.
- `/front-template entity product` · `feature add-to-cart` · `widget product-list` · `view products` — FSD slice with tests. In an `antd-scss-react-router` project `feature inspections` creates a feature module.
- `/front-template component widgets/header UserMenu` — component in the right folder.
- `/front-setup` — audit and bring a project up to the standard (also runs the dependency version check).
- `/front-setup audit-only` — report only.
- "use front-reviewer to review my changes"
- "use front-refactorer on src/widgets/product-list"

With a plugin install, prefix commands with `team-front-skill:`.

## Validate the package

```bash
node scripts/validate.mjs     # or: npm run validate   (Node 20+, no dependencies)
node scripts/test-hook.mjs    # or: npm run test:hook  (front-check hook + settings.json merge)
```

Checks frontmatter (incl. description length ≤ 500), cross-references, the
reference index in `SKILL.md`, version consistency, installer/uninstaller
parity, line limits matching STANDARDS, the eval fixture, and that rule text
has no external URLs; warns when STANDARDS was last reviewed > 180 days ago.
The same check plus installer smoke tests run in GitHub Actions
(`.github/workflows/validate.yml`).

To check that the reviewer actually applies the standard, run the eval in
`evals/README.md` after changing the reviewer, STANDARDS or a reference.

## Changing the standard

1. Edit `STANDARDS.md` (discuss in Confluence first).
2. Update the matching file(s) in `references/` (and `front-template/templates/`
   if generated code changes).
3. Bump the version everywhere: `VERSION`, `.claude-plugin/plugin.json`,
   `.claude-plugin/marketplace.json`, `package.json`, the status line of
   `STANDARDS.md`, and add a `CHANGELOG.md` entry.
4. Run `node scripts/validate.mjs` and fix every problem; for rule changes
   that the reviewer checks, also run the eval (`evals/README.md`).
5. Push; teammates update the plugin from the `/plugin` menu or re-run the installer.
