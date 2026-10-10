# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A distributable Claude Code package (Markdown content; the only code is the Node validator and the install/uninstall scripts) encoding the team's frontend standards for Next.js (App Router) and React (Vite + TanStack Router). It is installed either as a Claude Code plugin or copied into a target project's `.claude/` directory; it is not itself a frontend app.

## Install / try it locally

```bash
bash install.sh [target-.claude-dir]                          # default ./.claude
powershell -ExecutionPolicy Bypass -File install.ps1 [-Target <dir>]
bash uninstall.sh [target-.claude-dir]
powershell -ExecutionPolicy Bypass -File uninstall.ps1 [-Target <dir>]
node scripts/validate.mjs                                     # package QA (npm run validate)
```

As a plugin: `/plugin marketplace add <path-or-git-url>` then `/plugin install team-front-skill@team-front` (commands become `/team-front-skill:<name>`).

Installers copy `skills/*/` (replacing each skill folder wholesale, after backing up a folder that differs to `<target>/.team-front-backup/<skill>-<old-version>`), write `VERSION` to `<skill>/.installed-version`, and copy `agents/*.md` and `commands/*.md`. Uninstallers remove exactly the shipped items and keep backups. Keep `install.sh`/`install.ps1` and `uninstall.sh`/`uninstall.ps1` behaviourally identical; if you add a skill, agent, command or new top-level content directory, update all four (the validator checks uninstallers name every shipped item). `.gitattributes` keeps `*.sh` LF and `*.ps1` CRLF.

## Architecture

- `skills/team-frontend/STANDARDS.md` — **single source of truth** (§1–§16; §16 is the Definition of Done). Everything else enforces what is written here. Version/status line at the top.
- `skills/team-frontend/SKILL.md` — auto-applied skill: Step 0 detects mode from `package.json` (`next` → Next.js, `react` only → React/TanStack Router), package manager, tooling, FSD (version check only on setup/request), then routes to the topic files via its **Reference index** (must list every file in `references/` — validator-enforced).
- `skills/team-frontend/references/*.md` — detailed rules + code templates per topic (FSD, components, useEffect, patterns, HTTP axios + serverFetch, security, state, router, Next.js, UI, testing, E2E, observability, i18n, tooling, CI, deps, smells).
- `skills/front-template/` — `/front-template` skill; `SKILL.md` maps arguments (`react`, `next`, `project`, `entity|feature|widget|view`, `component`) to file templates in `templates/` (`project.md`, `slices.md`, `component.md`).
- `agents/front-reviewer.md` (read-only review) and `agents/front-refactorer.md` (edits, keeps tests green) — subagents that read STANDARDS + specific references and cite STANDARDS § numbers.
- `commands/front-setup.md` — `/front-setup [audit-only]` slash command.
- `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` — plugin manifest and single-plugin marketplace (`team-front-skill@team-front`).
- `VERSION`, `CHANGELOG.md`, `package.json` (only for `npm run validate`).
- `scripts/validate.mjs` — zero-dependency checks: frontmatter, cross-references, reference index, version consistency, installer parity, no external URLs in rule text. `.github/workflows/validate.yml` runs it plus installer smoke tests.

### Path conventions (easy to break)

- Agents and the command reference files by their **installed** path: `.claude/skills/team-frontend/...`, with a fallback for plugin installs (Glob `**/skills/team-frontend/STANDARDS.md`). Keep the `.claude/skills/` prefix — the validator resolves it to `skills/`.
- `front-template` references its sibling skill relatively: `../team-frontend/STANDARDS.md`, `../team-frontend/references/`.
- If you rename/move a file in `references/` or `templates/`, grep all of `skills/`, `agents/`, `commands/` for the old name. If you renumber a STANDARDS section, grep for `§`.

### Content rules

- All knowledge must be local: skills/agents explicitly forbid browsing external URLs, so don't add rules that depend on links (validator fails on URLs outside fenced code, except localhost/example.com).
- Frontmatter `description` fields drive auto-triggering — keep them specific when editing.
- Command examples are written with npm; rules say to translate to the detected package manager.

## Changing the standard

1. Edit `STANDARDS.md` first.
2. Update the matching file(s) in `references/` (and `front-template/templates/` if generated code changes; agents/command if a check changes). New reference file → add it to the SKILL.md Reference index.
3. Bump the version in **all** of: `VERSION`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, the `> Status: **vX.Y.Z**` line of `STANDARDS.md`; add a `CHANGELOG.md` entry `## [X.Y.Z] - YYYY-MM-DD`.
4. Run `node scripts/validate.mjs` — it must pass.
