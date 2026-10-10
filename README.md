# team-front-skill

Claude Code package with the team's frontend standards for Next.js and React.

| Path | What it is |
| --- | --- |
| `skills/team-frontend/STANDARDS.md` | **The standard** (paste into Confluence). Single source of truth. |
| `skills/team-frontend/SKILL.md` | Skill: applied automatically when writing/reviewing frontend code |
| `skills/team-frontend/references/` | Detailed rules + code templates (offline, no external URLs) |
| `skills/front-template/` | Skill: `/front-template` generates projects, FSD slices and components in the team format |
| `agents/front-reviewer.md` | Subagent: read-only review against the standard |
| `agents/front-refactorer.md` | Subagent: decomposes/refactors code to the standard, keeps tests green |
| `commands/front-setup.md` | `/front-setup [audit-only]`: audit + set up tooling, tests, http, FSD |

## Install into a project

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

## Use

- Just work: "create a product list page", "add login with refresh token" → the
  skill is picked up automatically.
- `/front-template react` — in an empty folder (no `package.json`): sets up a React project (Vite + TanStack Router) right in this folder.
- `/front-template next` — same, with the latest Next.js (App Router).
- `/front-template project my-app react` — new React project (Vite + TanStack Router) in a new `my-app/` folder.
- `/front-template project my-app next` — new Next.js (App Router) project.
- `/front-template entity product` · `feature add-to-cart` · `widget product-list` · `view products` — FSD slice with tests.
- `/front-template component widgets/header UserMenu` — component in the right folder.
- `/front-setup` — audit and bring a project up to the standard.
- `/front-setup audit-only` — report only.
- "use front-reviewer to review my changes"
- "use front-refactorer on src/widgets/product-list"

## Changing the standard

1. Edit `STANDARDS.md` (discuss in Confluence first).
2. Update the matching file in `references/`.
3. Bump the version line at the top of `STANDARDS.md`, re-zip, share.
