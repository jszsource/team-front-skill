# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A distributable Claude Code package (Markdown only, no build/lint/test) encoding the team's frontend standards for Next.js (App Router) and React (Vite + TanStack Router). It is installed into a target project's `.claude/` directory; it is not itself a frontend app.

## Install / try it locally

```bash
bash install.sh [target-.claude-dir]                          # default ./.claude
powershell -ExecutionPolicy Bypass -File install.ps1 [-Target <dir>]
```

Installers copy `skills/*/` (replacing each skill folder wholesale), `agents/*.md` and `commands/*.md` into the target. Keep `install.sh` and `install.ps1` behaviourally identical; if you add a new top-level content directory, update both.

## Architecture

- `skills/team-frontend/STANDARDS.md` — **single source of truth**. Everything else enforces what is written here. Version/status line at the top.
- `skills/team-frontend/SKILL.md` — auto-applied skill: Step 0 detects mode from `package.json` (`next` → Next.js, `react` only → React/TanStack Router), checks versions/tooling/FSD, then routes to the topic files in `references/`.
- `skills/team-frontend/references/*.md` — detailed rules + code templates per topic (FSD, components, useEffect, axios, state, router, Next.js, testing, tooling, deps, smells).
- `skills/front-template/` — `/front-template` skill; `SKILL.md` maps arguments (`react`, `next`, `project`, `entity|feature|widget|view`, `component`) to file templates in `templates/` (`project.md`, `slices.md`, `component.md`).
- `agents/front-reviewer.md` (read-only review) and `agents/front-refactorer.md` (edits, keeps tests green) — subagents that read STANDARDS + specific references.
- `commands/front-setup.md` — `/front-setup [audit-only]` slash command.

### Path conventions (easy to break)

- Agents and the command reference files by their **installed** path: `.claude/skills/team-frontend/...`.
- `front-template` references its sibling skill relatively: `../team-frontend/STANDARDS.md`, `../team-frontend/references/`.
- If you rename/move a file in `references/` or `templates/`, grep all of `skills/`, `agents/`, `commands/` for the old name.

### Content rules

- All knowledge must be local: skills/agents explicitly forbid browsing external URLs, so don't add rules that depend on links.
- Frontmatter `description` fields drive auto-triggering — keep them specific when editing.

## Changing the standard

1. Edit `STANDARDS.md` first.
2. Update the matching file(s) in `references/` (and `front-template/templates/` if generated code changes).
3. Bump the version line at the top of `STANDARDS.md`.
