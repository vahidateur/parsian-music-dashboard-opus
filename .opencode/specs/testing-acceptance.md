# Spec — Test strategy and acceptance

**Status:** CURRENT · **Authority:** the test files themselves.

## Layout

| Kind | Where | Example |
|---|---|---|
| unit / pure domain | `src/domains/<d>/__tests__/` | `src/domains/teachers/__tests__/demoRepository.test.ts` |
| view behaviour | `src/views/__tests__/` | `src/views/__tests__/studentsRelations.test.tsx` |
| cross-cutting gates | `src/__tests__/` | `src/__tests__/architectureBoundaries.test.ts` |
| domain-wide gates | `src/domains/shared/__tests__/` | `src/domains/shared/__tests__/staleQueryGates.test.tsx` |
| target seam | `src/targets/__tests__/` | `src/targets/__tests__/targetCopy.test.ts` |
| backend (PHP) | `backend/tests/Feature/` | `backend/tests/Feature/StudentsTest.php` |

The suite is Vitest + jsdom; `src/test/setup.ts` is the global setup; `src/test/` holds
fakes (`src/test/fetchMock.ts`, `src/test/repositoryStubs.ts`,
`src/test/demoEnvironment.ts`).

## How to run

```bash
npx vitest run <file> [<file> …]     # focused — the default choice
npm test                              # full suite (~8 min on this machine)
npx vitest run -t "case name"        # one case
```

**Prefer focused runs.** Run the full suite only when a focused run cannot answer the
question, and say why. Never re-run an expensive command whose output is already in the
conversation.

## Acceptance

A change is done when:

1. the **root cause is proven**, not guessed (name the mechanism, not the symptom);
2. a **regression test** exists that fails without the fix — check it by reverting the
   fix in a scratch copy and watching it go red, when that is cheap;
3. the **focused** tests for the touched area pass;
4. `npm run typecheck` is exit 0 — plus `tsconfig.demo.json` and `tsconfig.client.json`
   when the change touches a target seam or a composition;
5. the **right build** succeeds — demo changes → `npm run build:demo`; client-only changes →
   `npm run build:client`; shared changes → both, plus the bare `npm run build`;
6. nothing else was modified: `git status` shows only the intended paths.

**Never** weaken, delete, skip or loosen a test to make a run green. A test that encodes a
product decision is changed only by an owner decision, recorded in
`docs/engineering/DECISIONS.md`.

## Failure triage

Classify every failure before fixing it:

| Class | Meaning | Example |
|---|---|---|
| **confirmed defect** | the code is wrong | a missing invalidation after a write |
| **environment failure** | the machine/toolchain, not the code | a 5 s test budget exceeded on a slow CPU; a Windows-contaminated `node_modules` |
| **unresolved question** | needs a decision or more evidence | PB-3, whether a policy may be relaxed |

Do not "fix" an environment failure by changing the product. Report it as such.

## Known environment limits

- **The backend toolchain varies by machine.** Check `command -v php composer` before
  saying either way. Where PHP and Composer exist (2026-10-29: PHP 8.4, Composer 2.10,
  `backend/vendor` present) the suite runs without MySQL, because `backend/phpunit.xml`
  uses in-memory SQLite. `backend/.env` points at a MySQL database, so pin the connection:
  `cd backend && DB_CONNECTION=sqlite DB_DATABASE=:memory: php artisan test --filter=<Class>`.
  Never aim the suite at the `.env` database (it would migrate it; see `git-safety.md`,
  rule 5). On a machine without the toolchain, claim only inherited CI evidence, dated.
- **No browser tooling** → browser QA is *NOT VERIFIED* until someone actually opens the app.
  Do not claim it.
- **Node is pinned** by `.nvmrc` (22.22.3) because the locked deps require `^22.22.2`.
- **Line endings are load-bearing for the dataset.** `data/dataset/*` is byte-hashed by the
  manifest; a CRLF checkout breaks the artifact gate. There is deliberately no root
  `.gitattributes` yet — if you add one, add it as its own explained change. On
  2026-10-29 the dataset was LF in the index and the working tree, and 32 other tracked
  files were committed with CRLF (`git-safety.md`); do not "fix" them as a side effect.

## Gates that must stay green

`architectureBoundaries` · `bundleBoundary` · `bundleBudget` · `cspCompatibility` ·
`namingGate` · `m10Boundary` · `projectState` · `datasetSchemaGate` ·
`permissionParity` · `targetCopy`
