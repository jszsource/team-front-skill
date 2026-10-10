# Dependency version check and upgrades

**Not** run every session. Run the check only:

- during `/front-setup` (audit step);
- when the user asks (versions, outdated, upgrade);
- before a dependency-related task (adding/removing/upgrading a package,
  fixing a peer-dependency or version-specific error).

Run it **at most once per session**: remember the table and reuse it; re-run
only after an install/upgrade changed the lockfile. Commands use the package
manager detected in `tooling.md` → "Package manager".

## 1. Check

Core packages:

```
next react react-dom @tanstack/react-query @tanstack/react-router zustand axios
tailwindcss vitest typescript eslint
```

Preferred — one call for everything (installed vs latest):

| Manager | Command |
| --- | --- |
| npm | `npm outdated --json` |
| pnpm | `pnpm outdated --format json` |
| yarn | `yarn outdated --json` (v1) / `yarn npm info <pkg> --fields version` per package (Berry) |
| bun | `bun outdated` |

Per package, when you need just a few:

```bash
npm view <pkg> version        # latest stable  (pnpm view <pkg> version)
npm ls <pkg> --depth=0        # installed      (pnpm list <pkg> --depth 0)
```

Exit code 1 from `outdated` only means "something is outdated", not a failure.
Offline / registry unreachable → say so in one line and continue; don't retry
in a loop.

Show a table:

| Package | Installed | Latest | Type |
| --- | --- | --- | --- |
| next | 15.5.2 | 16.4.0 | **major** |
| axios | 1.11.0 | 1.12.2 | minor |

If everything is current, say so in one line and continue.

## 2. Propose — never upgrade without confirmation

- **patch/minor:** propose `npm i <pkg>@latest` (`pnpm add`, `yarn add`, `bun add`) for the batch; on "yes" run it.
- **major:** list the breaking changes you know about (Next major notes are in
  `nextjs.md` → "Version notes"), estimate impact on this codebase (grep for
  affected APIs), propose a plan, wait for "yes".

## 3. Upgrade procedure

1. Ensure working tree is clean (`git status`); suggest a branch
   `chore/upgrade-<pkg>-<version>`.
2. Next.js: `npx @next/codemod@latest upgrade latest` (or `pnpm dlx` / `bunx`;
   updates next, react,
   react-dom, types, runs codemods). Other majors: official migration guide
   codemods where they exist (e.g. `@tanstack/query` codemods).
3. Keep `react` and `react-dom` on the same version; keep `@types/react` matching.
4. Run `lint`, `typecheck`, `test`, `build` with the detected manager
   (`npm run lint && …` / `pnpm lint && …`).
5. Fix failures; report what changed and what still fails — honestly.
6. Commit: `chore(deps): upgrade next to 16.4.0`.

## Rules

- Never use `--force` / `--legacy-peer-deps` silently; explain peer conflicts.
- Don't mix dependency upgrades with feature work in one commit.
- Canary/beta/rc versions: never, unless the user asks.
- Upgrade with the project's own manager only — never create a second lockfile.
