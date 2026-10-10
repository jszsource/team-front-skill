---
name: front-setup
description: Audit and set up a Next.js or React project to the team frontend standards — dependency version check (with confirmation), ESLint/Prettier/husky/lint-staged/commitlint, Vitest + MSW, Tailwind + shadcn/ui, axios instance with refresh interceptor, TanStack Query/Zustand providers, FSD folder skeleton, TanStack Router for React.
argument-hint: "[audit-only]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Set up or audit this project according to the `team-frontend` skill
(`.claude/skills/team-frontend/SKILL.md` and `STANDARDS.md`). Use only the
local reference files; do not browse the web.

If `$ARGUMENTS` contains `audit-only`, perform steps 1–2 and stop after the report.

1. **Detect** mode from `package.json` (`next` → Next.js, else React; neither →
   ask). Note package manager from lockfile (npm/pnpm/yarn/bun) and use it.
2. **Audit** and print a checklist table (✅ / ❌ / ⚠️) of:
   - dependency versions vs latest (`references/dependency-updates.md`)
   - ESLint flat config with required plugins + `max-lines` 150, Prettier,
     husky hooks (pre-commit, commit-msg, pre-push), lint-staged, commitlint
   - Vitest config, setup file, MSW, render helper, `test*` scripts
   - Tailwind v4, shadcn `components.json` with FSD aliases, `cn()`
   - `shared/api/http.ts` with single-flight refresh interceptor + `ApiError`
   - Query provider, Zustand usage pattern
   - FSD skeleton (`src/{app-layer|app,views,widgets,features,entities,shared}`), `@/*` path alias
   - Next: `proxy.ts`, `loading.tsx`/`error.tsx`, env validation
   - React: TanStack Router plugin + `routes/` + router context with QueryClient
3. **Ask for confirmation** once, listing what will be installed/created and
   any dependency upgrades (major upgrades listed separately).
4. **Apply** the confirmed items using the templates in the skill's
   `references/` (tooling.md, testing-vitest.md, http-axios.md, state-data.md,
   ui-tailwind-shadcn.md, fsd.md, nextjs.md / react-tanstack-router.md).
   Merge with existing configs rather than overwriting; show diffs for changed
   config files. Never move existing source files in this command — propose an
   FSD migration plan instead.
5. **Verify**: run `lint`, `typecheck`, `test`, and `build`. Report real results.
6. Print a final summary: what was added, what was skipped, what needs manual action.
