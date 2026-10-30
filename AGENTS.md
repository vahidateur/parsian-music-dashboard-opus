# Parsian — music academy panel (آوا)

A private, Persian/RTL admin panel for a music academy. Frontend: React 19 + TypeScript
(strict) + Vite + Tailwind v4. Backend: a Laravel REST API under `backend/` — for backend
behaviour, that code is the authority, not any roadmap or document.

## The two compositions — never mix them

| Target | What it is | Commands |
|---|---|---|
| **demo** | local store, no server | `npm run dev` (default) · `npm run build:demo` → `dist/demo` |
| **client** | the real API, no demo code at all | `npm run dev:full` · `npm run build:client` → `dist/client` |

- There is **no third build**. `npm run build` is the bare demo build → `dist/`.
- The client composition must contain **zero** demo capability. A domain the server does
  not serve resolves to an explicit *unavailable* repository — never to demo data, never to
  a silent local fallback.
- Wording that differs between targets goes through the target seam (`src/targets/*`, via
  the `@/targets/targetCopy` alias) — never an `if (demo)` inside a view.
- Detail: `.opencode/specs/architecture-targets.md`

## Commands (verified on this machine)

```bash
npm run typecheck                              # tsc --noEmit            → exit 0
npx tsc -p tsconfig.demo.json --noEmit         # demo composition
npx tsc -p tsconfig.client.json --noEmit       # client composition
npx vitest run <files>                        # focused tests — prefer this
npm test                                      # full suite (~8 min here)
npm run build | build:demo | build:client
npm run dev                                   # http://localhost:5173/
```

Demo login: `admin@demo.local` / `arena-demo` (other roles: `manager@`, `desk@`, `finance@`,
`teacher1@`). Node is pinned by `.nvmrc` (**22.22.3** — the locked deps require `^22.22.2`).
Use nvm; do not replace the system Node, and do not use `sudo`.

## Honesty rules (non-negotiable)

- No fabricated data, metrics or success states. A success message needs the write behind it.
- "Browser QA NOT VERIFIED" until it actually happened. Report what you ran, not what you assume.
- Deferred work is never reported as finished; a spec or roadmap line is not evidence.
- Separate **confirmed defect** · **environment failure** · **unresolved question** in every report.
- A frontend permission check is UX, not security. Authentication is server-owned.

## Git safety

- **Never** `git push`, force-push, open a PR or publish — unless the owner says so in that
  same conversation.
- Never commit, amend, reset, rebase, clean, stash or stage unless asked. Stage specific
  paths, never `git add .`.
- Never rewrite history; the repo has a documented non-destructive recovery procedure for a
  moved HEAD.
- Never run `migrate:fresh`, `db:wipe`, seeds or resets without explicit owner authorization.
- Detail: `.opencode/specs/git-safety.md`

## Where the truth lives — read on demand, do not load it all

| Need | Read |
|---|---|
| current state · checkpoints · decisions | `docs/engineering/PROJECT_STATE.md` → `docs/engineering/PHASES.md` → `docs/engineering/DECISIONS.md` |
| open work and known issues | `docs/engineering/OPEN_ITEMS.md` |
| standing project guidance | `.kiro/steering/00…12` — only the file you need |
| capability availability, error classes | `.opencode/specs/api-capability-errors.md` |
| auth · RBAC · identity scope | `.opencode/specs/auth-rbac.md` |
| test strategy, what "done" means | `.opencode/specs/testing-acceptance.md` |

`.opencode/agents/`, `.opencode/skills/`, `opencode.json` and `skills-lock.json` are local-only agent tooling and are not included in the published repository snapshot; the specs under `.opencode/specs/` are published with it.

## Working rules

- Prove the root cause before implementing. Reuse the existing domain hook/repository; no
  duplicate business logic.
- No business logic in presentational components; no `localStorage`, `demoStore`, `fetch(`
  or hardcoded `http(s)://` URL in a view or component — `src/__tests__/architectureBoundaries.test.ts`
  enforces this.
- One logical change at a time. Focused tests first; run the full suite only when a focused
  run cannot answer the question.
- Prefer narrow reads (`grep`, `glob`) over dumping files, and reuse verified command results
  instead of re-running them.
- For bounded, mechanical, low-risk work, a local `routine` sub-agent (only if your OpenCode
  setup provides one) can take it; the repository does not ship that agent, so keep
  architectural decisions and ambiguous failures in the main session either way.

## Skills and agents — optional local tooling

The repository provides instructions and specs, not runnable agent tooling. Names such as
`focused-fix`, `target-verify`, `git-audit`, `runtime-verify`, `repo-explore` and the `routine`
sub-agent are **optional local installations** under `.opencode/skills/` and `.opencode/agents/`
— both directories are ignored and absent from a fresh clone, so none of them is a guaranteed
capability.

A clone without them can still do all the work; apply the same discipline directly:

- reproduce a defect before fixing it, and prove the root cause;
- for anything touching the target seam, run the three typechecks and both composition builds;
- inspect Git state read-only before any commit, and stage explicit paths only;
- prefer narrow reads (`grep`, `glob`) over dumping files.

If your local setup does provide such a skill or sub-agent, load it on demand (`skill` tool
with the folder name, or `@<id>`). Nothing in this repository requires it.
