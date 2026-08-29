# AGENTS

## Principles
- Clarity and consistency over cleverness. Minimal changes. Match existing patterns.
- Keep components/functions short; break down when it improves structure.
- TypeScript everywhere; no `any` unless isolated and necessary.
- No unnecessary `try/catch`. Avoid casting; use narrowing.
- Named exports only (no default exports, except Next.js pages).
- Absolute imports via `@/` unless same directory.
- Follow existing Ultracite / Oxlint setup; don't reformat unrelated code.
- Zod type-only: `import type * as z from 'zod';`.
- Let compiler infer return types unless annotation adds clarity.
- Options object for 3+ params, optional flags, or ambiguous args.
- Hypothesis-driven debugging: 1-3 causes, validate most likely first.

## Project knowledge
- Start at `docs/README.md` when a task changes architecture, data flow, authentication, database structure, or a documented feature.
- Read `docs/KNOWLEDGE_MAINTENANCE.md` before creating, restructuring, or materially updating knowledge-base documents.
- Treat accepted ADRs in `docs/adr/` as active architectural constraints. Replace an accepted decision only with a new ADR that supersedes it.
- Update the relevant current-state document in the same change when behavior, invariants, ownership, boundaries, or operational procedures change.
- Use judgment to identify significant development problems; record each in Chinese under a numbered heading in `docs/PROBLEMS.md` with only the problem, root cause, and solution.
- Do not document trivial implementation details, temporary debugging state, or facts that are clearer from a single nearby function.
- Historical documents explicitly marked non-authoritative are context only; verify current behavior in code and current-state documents.

## Token efficiency
- Skip recaps unless the result is ambiguous or you need more input.

## Commands
Use these `npm run` scripts: `dev:next`, `dev`, `build:next`, `build-local`, `build`, `start`, `clean`, `lint`, `lint:fix`, `check:types`, `test`, `test:e2e`, `db:generate`, `db:migrate`, and `db:studio`.

`build` and `build:next` never run migrations. Use `build-local` when a local production-build check must start temporary PGlite and apply migrations first; production migrations remain part of the release activation workflow.

## Git Commits
Conventional Commits: `type: summary` without scope. The summary should be a short, specific sentence that explains what changed and where or why, not a vague phrase. Types: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`. `BREAKING CHANGE:` footer when needed.

## Env
All env vars validated in `Env.ts`; never read `process.env` directly.

## Styling
Tailwind v4 utility classes. Reuse shared components. Responsive. No unnecessary classes.

## React
- No `useMemo`/`useCallback` (React compiler handles it). Avoid `useEffect`.
- Single `props` param with inline type; access as `props.foo` (no destructuring).
- Use `React.ReactNode`, not `ReactNode`.
- Inline short event handlers; extract only when complex.

## Pages
- Default export name ends with `Page`. Props alias (if reused) ends with `PageProps`.
- Escape glob chars in shell commands for Next.js paths.
- Dashboard pages (sit behind auth); define meta once in layout, not in each page.

## JSDoc
- Start each block with `/**` directly above the symbol.
- Short, sentence-case, present-tense description of intent.
- Order: description → `@param` → `@returns` → `@throws` (only if it can throw).

## Tests
- `*.test.ts` for unit tests; `*.integ.ts` for integration tests; `*.e2e.ts` for Playwright tests.
- `*.test.ts` co-located with implementation; `*.integ.ts` and `*.e2e.ts` in `tests/` directory.
- Top `describe` = subject; nested `describe` to group scenarios or contexts.
- `it` titles: short, third-person present, `verb + object + context`. Sentence case, no period.
- Omit "should/works/handles/checks/validates". State what, not how.
- Avoid mocking unless necessary.
