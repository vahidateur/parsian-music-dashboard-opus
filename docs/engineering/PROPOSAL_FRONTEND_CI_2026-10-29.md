# PROPOSAL — frontend CI (2026-10-29)

> **Status: proposal only.** No workflow, test, timeout or governance rule was changed. The YAML and the test
> patch below are text in this document, not files under `.github/` or `src/`.

## 1. What exists

- One workflow: `.github/workflows/backend-tests.yml`, triggered by `workflow_dispatch` and by pushes and pull
  requests that touch `backend/**` or the workflow file. Its header says the frontend gates are left out on purpose
  because they "carry pre-existing, governance-recorded failures".
- `gh run list` (2026-10-29), last 8 runs: 5 success, 3 failure, all `backend-tests`. The 3 failures are on
  `arena/2e375f3f-…`, another session's branch. Nothing runs on `src/`.

## 2. Gate status measured on this machine (2026-10-29)

| Check | Result |
|---|---|
| `npm run typecheck`, `tsconfig.demo.json`, `tsconfig.client.json` | exit 0, 12 s and 9 s for the last two |
| Full `vitest run --maxWorkers=3` | 239 files: **233 passed, 6 failed**; 2925 tests passed, 4 skipped, 7 failed; 469 s |
| The 7 failures | 1 assertion, 6 timeouts, see below |
| `bundleBoundary`, `bundleBudget`, `cspCompatibility` | pass, but against a **stale `dist/`**: `dist/` and `dist/demo` are from 2026-10-22, `dist/client` from 2026-10-27, the last `src` commit is 2026-10-29 |

The failures, classified:

- **1 confirmed behaviour of the gate, not a defect:** `projectState` "recorded working branch … in step with its
  remote" fails while the local branch is ahead of its upstream. It was 1 commit ahead (an unpushed docs commit) during the run
  and passed 52 of 52 after a push earlier in the day. Documented as by design (`git-safety.md`).
- **6 environment failures (5 s default budget exceeded under load, load average 7 to 10 from a second session):**
  `deepLinkPagination` (2 cases), `libraryAccess`, `settingsHonesty`, `teachersRelations`, `contentAssignmentFlow` (2 cases).
  Re-run alone, three of these files (`settingsHonesty`, `teachersRelations`, `contentAssignmentFlow`) passed. The other
  two (`deepLinkPagination`, `libraryAccess`) passed only with `--testTimeout=60000` given on the command line
  (nothing in the repo was changed), taking **13.6 s, 5.9 s and 5.6 s** for the three slow cases. So those tests are genuinely over 5 s on this
  machine; whether a CI runner is faster is **unmeasured**.
- No assertion failure other than the one above. No test was edited, skipped or weakened.

The header remark of `backend-tests.yml` ("pre-existing failures") was **not reproduced** in this measurement: the only
failures were load-induced timeouts and the unpushed-branch rule. That is one run on one machine, not proof for CI.

## 3. Why `projectState` sits near its 30 s timeout

Mechanism, measured:

- `no document quotes a commit that does not already exist` loops over **every occurrence** of a 40-hex SHA in the four
  required docs: **654 occurrences, 102 unique** (per document: 275, 274, 35, 70 occurrences; 78, 83, 23, 38 unique).
- Each occurrence spawns `git cat-file -e` and `git merge-base --is-ancestor` through `execFileSync`: **1308 spawns**.
- A lean `node` process spawns git in about 16 ms: 21.3 s for the 1308 calls. Inside vitest at a load average of 7 the case
  took 25.5 s to 31.8 s against its fixed `30_000` ms timeout. The test is slow because of repeated work, not because of
  the git history size (`git rev-list HEAD` lists 330 commits in 29 ms).

Proposed change (needs the owner, because the test encodes a governance rule; **not applied**). Memoize the two helpers so
each SHA is asked once; assertions and messages stay the same:

```ts
// replaces isAncestor() and isCommit() in src/__tests__/projectState.test.ts
const memo = new Map<string, boolean>();
function probe(key: string, run: () => void): boolean {
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let ok = true;
  try { run(); } catch { ok = false; }
  memo.set(key, ok);
  return ok;
}
function isAncestor(older: string, newer: string): boolean {
  return probe(`anc:${older}>${newer}`, () => git("merge-base", "--is-ancestor", older, newer));
}
function isCommit(sha: string): boolean {
  return probe(`commit:${sha}`, () => git("cat-file", "-e", `${sha}^{commit}`));
}
```

Expected: 204 spawns instead of 1308, about 3.3 s lean, with the 30 s timeout untouched.
The alternative, one `git rev-list HEAD` plus one `git cat-file --batch-check`, is faster still but rewrites more of the test.
**Do not raise the timeout:** that would hide the cause.

## 4. Proposed workflow (text only)

```yaml
name: frontend-tests
on:
  workflow_dispatch:
  push:
    paths: &p ['src/**', 'data/**', 'docs/engineering/**', 'deploy/nginx.conf', 'index.html', 'public/**',
               'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig*.json', '.nvmrc',
               '.github/workflows/frontend-tests.yml']
  pull_request:
    paths: *p
permissions:
  contents: read
concurrency:
  group: frontend-tests-${{ github.ref }}
  cancel-in-progress: true
jobs:
  frontend:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }        # projectState reads every head and the 6 archive/* tags
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npx tsc -p tsconfig.demo.json --noEmit
      - run: npx tsc -p tsconfig.client.json --noEmit
      # Order matters: the bare build EMPTIES dist/, so it goes first (bundleBoundary.test.ts, header).
      - run: npm run build && npm run build:client && npm run build:demo
      - name: Refuse a silent skip of the bundle gates
        run: test -f dist/index.html && test -f dist/client/index.html && test -f dist/demo/index.html
      - run: npx vitest run --maxWorkers=2
```

Design points and what is **unverified**:

- The bundle gates skip when their artifact is absent, and a green run that skipped is worse than a red one, so the
  `test -f` step and the build order are mandatory. Locally they currently run against a stale build.
- `projectState` needs full history and tags. `fetch-depth: 0` should provide them; the case "working branch in step with
  its remote" has **not** been tried on a runner (detached pull-request checkouts differ from push checkouts).
- Runner speed is unknown. Start the job as **informational** (not a required check), collect at least five runs, then
  decide about the 5 s budget with measured numbers instead of guessing.
- Actions minutes on a private repo: about 8 to 10 minutes per run if the local 469 s carries over. Unmeasured.
- The three typechecks cost about 30 s together and could be a separate fast job that is required first.

## 5. Decisions needed from the owner

1. Approve the memoization patch in section 3 (a test change).
2. Approve adding `frontend-tests.yml` as an informational job, then promote it to required after five green runs.
3. Confirm whether the "pre-existing failures" remark in `backend-tests.yml` should be dropped once the job exists.
4. Decide whether the second session's branch (`fix/browser-qa-2e375f3f`, 5 unpushed commits) should be merged before
   CI is introduced, so that its first runs measure real code.
