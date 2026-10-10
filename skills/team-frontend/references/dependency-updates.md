# Dependency version check and upgrades

Run at the start of a session (Step 0) and whenever the user asks to upgrade.

## 1. Check

Core packages:

```
next react react-dom @tanstack/react-query @tanstack/react-router zustand axios
tailwindcss vitest typescript eslint
```

For each one present in `package.json`:

```bash
npm view <pkg> version        # latest stable
npm ls <pkg> --depth=0        # installed
```

or all at once: `npm outdated --json`.

Show a table:

| Package | Installed | Latest | Type |
| --- | --- | --- | --- |
| next | 15.5.2 | 16.4.0 | **major** |
| axios | 1.11.0 | 1.12.2 | minor |

If everything is current, say so in one line and continue.

## 2. Propose — never upgrade without confirmation

- **patch/minor:** propose `npm i <pkg>@latest` for the batch; on "yes" run it.
- **major:** list the breaking changes you know about (Next major notes are in
  `nextjs.md` → "Version notes"), estimate impact on this codebase (grep for
  affected APIs), propose a plan, wait for "yes".

## 3. Upgrade procedure

1. Ensure working tree is clean (`git status`); suggest a branch
   `chore/upgrade-<pkg>-<version>`.
2. Next.js: `npx @next/codemod@latest upgrade latest` (updates next, react,
   react-dom, types, runs codemods). Other majors: official migration guide
   codemods where they exist (e.g. `@tanstack/query` codemods).
3. Keep `react` and `react-dom` on the same version; keep `@types/react` matching.
4. Run `npm run lint && npm run typecheck && npm run test && npm run build`.
5. Fix failures; report what changed and what still fails — honestly.
6. Commit: `chore(deps): upgrade next to 16.4.0`.

## Rules

- Never use `--force` / `--legacy-peer-deps` silently; explain peer conflicts.
- Don't mix dependency upgrades with feature work in one commit.
- Canary/beta/rc versions: never, unless the user asks.
