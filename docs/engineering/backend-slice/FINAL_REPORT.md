# FINAL REPORT — workflow `backend-laravel-first-slice`

Durable, tracked copy of `.agents/tasks/backend-slice/FINAL_REPORT.md`.

> **Why there are two copies.** `.agents/` is listed in the repository-root `.gitignore`
> (`.gitignore:7`), so the workflow-local copy under `.agents/` can never be committed and can
> never survive a fresh clone. This tracked copy is the durable one; the `.agents/` copy exists so
> the Kiro workflow layout stays intact for a session that has it on disk. **Edit both or neither.**
>
> **This is a report, not a recovery pointer.** The single live recovery pointer for this
> repository remains [../SESSION_HANDOFF.md](../SESSION_HANDOFF.md). Start there. Come here for the
> backend slice's evidence.

Recorded 2026-10-01, at the end of the `build-loop` and `finalize` steps of the workflow
`backend-laravel-first-slice`, which was started with Claude Opus 5.5 and interrupted by a usage
limit part-way through `feat-003`.

---

## 1. Baseline SHA

`7215633c18550c9faf053e8b2bde5ea2e8da08e8` — `feat(backend): add classes and enrollments`

Verified at the start of this continuation, three ways:

- `git rev-parse HEAD` → `7215633c18550c9faf053e8b2bde5ea2e8da08e8`
- `git ls-remote origin refs/heads/cleanup/demo-migration-lineage` → the same value (local and
  remote were level; nothing to reconcile)
- `git status --porcelain` → empty (clean tree, no unrelated WIP)

Its parent chain was confirmed by read-only `git fetch --deepen` (the sandbox clone is shallow and
showed a single grafted commit):

```text
0c88215  docs(engineering): synchronize Phase B lineage pointers
  -> dec2016  feat(backend): Laravel foundation, auth, users and roles
  -> b38ff25  feat(backend): teachers, rooms (PB-3 blocked) and students with T-02 scope
  -> 7215633  feat(backend): add classes and enrollments
```

## 2. Final SHA

The continuation added five commits. The tip is the documentation commit that carries this report.

| # | SHA | Subject |
|---|---|---|
| 1 | `f953f090a8e6bb9864d53c5894ebdd51a2800615` | `ci(backend): add re-runnable execution gate for the Laravel suite` |
| 2 | `2aca43e913cf913c4f73d1bae4c5c87e4776b286` | `ci(backend): republish the PHPUnit tally as a check run` |
| 3 | `baf195c8540cd119bb2fd2fba17cf0b32cb71341` | `ci(backend): verify T-02, PB-1 and PB-3 over HTTP` |
| 4 | `038b15c05cafa77218f49a0173c1f8432c303dc4` | `ci(backend): publish the HTTP smoke report as a check run` |
| 5 | *(the commit that carries this file)* | `docs(engineering): record the backend first-slice continuation` |

Commit 5 does not contain its own SHA — the same convention the rest of this repository's lineage
pointers use. Read the real tip with:

```bash
git ls-remote origin refs/heads/arena/01a0f73f-parsian-music-dashboard-opus
```

## 3. Branch

- **Session branch (created by this continuation, pushed):**
  `arena/01a0f73f-parsian-music-dashboard-opus`
- **Baseline branch (untouched, still level with its remote):**
  `cleanup/demo-migration-lineage` @ `7215633c18550c9faf053e8b2bde5ea2e8da08e8`
- **No other branch was created, pushed to, switched to, reset, rebased or force-pushed.**
- **No merge to `main` was opened or performed.** Ahead-by is not merge authorization.

## 4. Implementation summary

**No backend source was written by this continuation, and none needed to be.** The audit below
found `feat-001`, `feat-002` and `feat-003` materially complete and governance-compliant; the
interruption had cost the workflow its *evidence*, not its code. The work was therefore:

1. **Audit** every backend file against the authoritative contracts and governance documents.
2. **Recover the lost evidence** — re-execute the test suite and the HTTP smoke check, and make both
   re-runnable so a future session never has to trust a transcript again.
3. **Persist the handoff chain** so a fresh agent can continue from files alone.

What the three feature commits had already produced (135 PHP files under `backend/`, 11
migrations, 13 test files):

| Area | Where |
|---|---|
| Laravel 12 foundation, Sanctum auth, envelope, error mapping | `backend/bootstrap/app.php`, `backend/app/Support/Api/`, `backend/app/Domain/Auth/` |
| Tenancy | `backend/app/Support/Tenancy/TenantContext.php`, `backend/app/Http/Middleware/ResolveTenant.php`, `backend/app/Models/Concerns/BelongsToOrganization.php` |
| Authorization | `backend/app/Support/Authorization/{PermissionGate,PermissionMatrix,OwnerDecisionRequired}.php` |
| Users + roles, with PB-2 fail-closed | `backend/app/Domain/Users/`, `backend/app/Domain/Roles/` |
| Teachers | `backend/app/Domain/Teachers/` |
| Rooms, implemented but PB-3-blocked | `backend/app/Domain/Rooms/` |
| Students, with T-02 scope in SQL and PB-1 fail-closed | `backend/app/Domain/Students/` |
| Classes | `backend/app/Domain/Classes/`, `backend/app/Http/Controllers/Api/V1/ClassController.php` |
| Enrollments | `backend/app/Domain/Enrollments/`, `backend/app/Http/Controllers/Api/V1/EnrollmentController.php` |
| Demo dataset seeder (local/testing only, no committed credential) | `backend/database/seeders/DemoDatasetSeeder.php` |

## 5. API endpoints implemented

Prefix `/api/v1`, every route except `auth/login` behind `auth:sanctum` + `tenant`. Source:
`backend/routes/api.php`. This is exactly the family named in
[../SESSION_HANDOFF.md](../SESSION_HANDOFF.md) §10; no endpoint was added, removed or reshaped, and
none was invented.

| Endpoint | Authorization |
|---|---|
| `POST auth/login` | public, throttled 5/min per email+IP |
| `POST auth/logout`, `GET auth/me` | authenticated |
| `GET users`, `GET users/{id}`, `GET users/{id}/password` | `users.read` |
| `POST users`, `PATCH users/{id}`, `DELETE users/{id}`, `POST users/{id}/password` | `users.write` + `PrivilegedIdentityPolicy` (PB-2) |
| `GET roles`, `GET roles/{id}` | authenticated org member (no permission names role-read; none invented) |
| `PATCH roles/{id}`, `POST roles/{id}/reset` | `roles.write` |
| `GET teachers`, `GET teachers/{id}` | `teachers.read` |
| `POST/PATCH/DELETE teachers/{id}`, `POST teachers/{id}/deactivate` | `teachers.write` |
| all six `rooms` endpoints | **blocked — `RoomPolicy` (PB-3)**, `403` for every role |
| `GET students`, `GET students/{id}` | `students.read` + `StudentAccessPolicy::scopeQuery` (T-02 / PB-1) |
| `POST students` | `StudentAccessPolicy::authorizeCreate`, then `students.write` |
| `PATCH/DELETE students/{id}` | `students.write` + scope |
| `GET classes`, `GET classes/{id}` | `classes.read` |
| `POST/PATCH/DELETE classes/{id}`, `POST classes/{id}/archive` | `classes.write` |
| `GET enrollments`, `GET enrollments/{id}` | `classes.read` |
| `POST/PATCH/DELETE enrollments/{id}`, `POST enrollments/{id}/withdraw` | `classes.write` |

**Contract conformance, checked field by field against the committed frontend repositories:**
`ClassResource` emits exactly the TS `AcademyClass` shape and `EnrollmentResource` exactly the TS
`Enrollment` shape (`src/domains/{classes,enrollments}/types.ts`); `ApiEnrollmentRepository.toQuery`
sends `student_id` / `class_id` / `status` / `active`, which is exactly what
`ListEnrollmentsRequest` validates. Nothing was remapped.

## 6. Permissions used

The 23-id vocabulary of `src/domains/auth/permissions.ts`, mirrored verbatim in
`backend/config/permissions.php`. Requests are resolved through one gate
(`App\Support\Authorization\PermissionGate`); per-organization role overrides in `roles.permissions`
are always filtered back to that vocabulary, so a stored row cannot grant an id the product does
not define.

Enrollment reads and writes use `classes.read` / `classes.write` (PHASE_B gap matrix row M) —
delegated through `ClassPolicy` so the mapping lives in one place.

## 7. Permissions intentionally not invented

`rooms.write`, `instruments.write`, `learning.write`, `progress.write` do **not** exist and were
**not** created. Nor was `roles.read`, nor any `enrollments.*`.

This is structurally enforced, not merely documented: `PermissionGate::allows()` throws
`InvalidArgumentException` for any id outside the vocabulary, so a typo or an inferred permission
fails loudly instead of being silently granted or denied.

No inference was made from name similarity. Specifically not treated as authorization evidence:
`settings.write` → rooms, `library.write` → instruments, `library.write` → learning,
`students.read` → `progress.write`, and `role === "teacher"` → any authorization.

## 8. Tenancy behavior

- No new tenancy model. No `organization_id` column was added — the existing seam was reused.
- `organization_id` NOT NULL on every organization-owned table, resolved **only** from the
  authenticated principal (`ResolveTenant` → `TenantContext`, a per-request scoped singleton).
- Never accepted from a body, header or query string; never emitted on the wire.
- `TenantContext::organizationId()` is fail-closed: with no resolved organization it throws
  `403 ORGANIZATION_UNRESOLVED` rather than returning null.
- Another organization's id is a `404`, indistinguishable from a missing row.

## 9–13. PB status

All five remain **OWNER DECISION REQUIRED** in
[../OPEN_ITEMS.md](../OPEN_ITEMS.md) (`PHASE B OWNER DECISIONS — 2026-09-30`). **This continuation
resolved none of them and changed none of their recorded status.** Where a behavior depends on one,
the server fails closed with `403 OWNER_DECISION_REQUIRED_PB<n>` via
`App\Support\Authorization\OwnerDecisionRequired`.

| PB | State | Detail |
|---|---|---|
| **PB-1** | **IMPLEMENTED-BLOCKED, fail-closed — verified over HTTP** | `StudentAccessPolicy::teacherWithoutTeacherIdScope()` throws `403 OWNER_DECISION_REQUIRED_PB1` for a teacher account with no linked `teacherId`: neither an empty result nor org-wide. A teacher **with** a `teacherId` gets T-02, enforced in SQL (active enrollment ∩ `classes.teacher_id`). `students.teacher_id` is never an authorization source — and the smoke job fails if the two sets ever coincide. |
| **PB-2** | **IMPLEMENTED-BLOCKED, fail-closed** | `PrivilegedIdentityPolicy` blocks (a) self-edit, (b) editing another administrator, (c) assigning `administrator`, (d) changing an administrator's or manager's email. All other user writes are implemented. Request formats were preserved; no current-password field was added (that is part of the undecided question). |
| **PB-3** | **IMPLEMENTED-BLOCKED, fail-closed — verified over HTTP** | `RoomPolicy` blocks all six rooms endpoints for **every** role, administrator included → `403 OWNER_DECISION_REQUIRED_PB3`. Room persistence, validation and `RoomService` exist and are unit-tested; only HTTP authorization is withheld. Class validation still checks room existence/active as *data integrity*, which is not room authorization. Instruments, learning and progress: **LEFT-UNIMPLEMENTED** — no table, no route, no permission. |
| **PB-4** | **LEFT-UNTOUCHED** | `useCan(...) \|\| !user` is a frontend idiom. Every server route except login requires a token, so a null principal is a `401`, never a granted write. |
| **PB-5** | **LEFT-UNIMPLEMENTED** | No notifications table, route or permission. O-17 says no notifications domain in v1; the conflict with `docs/frontend-completion/10-integration-architecture.md` is exactly the undecided question. |

## 14. Tests run

| Suite | Where it ran | Result |
|---|---|---|
| `php artisan test` (backend, 122 tests) | GitHub Actions, job `PHP 8.3 — Laravel test suite`, PHP 8.3 | **122 passed (915 assertions)** |
| `php -l` over every PHP file | same job | 135 files, no syntax errors |
| PHP 8.3 parse of every PHP file | this sandbox (no PHP runtime available — parsed with a PHP-grammar parser) | 134/134 parse clean (the one `.blade.php` template excluded) |
| HTTP smoke — T-02 / PB-1 / PB-3 / 401 | GitHub Actions, job `HTTP smoke` | **all assertions pass**; report quoted verbatim below |
| `npm run typecheck` | this sandbox | **clean** |
| `npm test` (frontend, 204 files) | this sandbox, three full runs | 2648 passed / 4 failed / 18 skipped |

## 15. Test results

**Backend — 122 passed (915 assertions), 2.21s.** Re-verified in this continuation, not carried
over from the interrupted session. Re-runnable:

```bash
gh workflow run backend-tests.yml
gh api "repos/vahidateur/parsian-music-dashboard-opus/commits/<sha>/check-runs" \
  --jq '.check_runs[] | select(.name | startswith("backend-")) | .output.summary'
```

Test methods per file, counted statically (sums to 122): Auth 15, Classes 11, Enrollments 14,
Envelope 11, PrivilegedIdentityPolicy 5, Roles 11, Rooms 6, StudentScope 8, Students 11,
Teachers 13, Users 15, and one example test in each of Unit and Feature.

**Frontend — 4 pre-existing failures, none of them a backend contract.** They are listed with their
failure text in [../BACKEND_STATUS.md](../BACKEND_STATUS.md) → "Frontend gates". None was hidden,
skipped, edited or disabled.

Two facts that change how those numbers read, both recorded rather than smoothed over:

- **The failure count is flaky across runs (13, 14, then 4).** The variation is
  `src/__tests__/projectState.test.ts`, which checks that the SHAs quoted in
  `PROJECT_STATE.md` / `PHASES.md` / `DECISIONS.md` / `OPEN_ITEMS.md` are real commits reachable
  from `HEAD`. The sandbox clone was **shallow**, so the historical objects were absent. After a
  read-only `git fetch --unshallow`, that file is **52/52 green**. This is the environmental failure
  [../SESSION_HANDOFF.md](../SESSION_HANDOFF.md) §8 already documents as "Do not edit … to hide
  them" — confirmed environmental, and confirmed not to require an edit.
- **I19 did not reproduce.** `src/views/__tests__/schedulingWrites.test.tsx:1234` (extra id
  `ses_cl2_20260929_1400`) is the documented pre-existing frontend failure. It **passed** in all
  three runs here. Nothing in this continuation touched it; "did not reproduce" is not "fixed", and
  it stays on the record.

## 16. HTTP smoke results

Reproduced durably as the `HTTP smoke — T-02 / PB-1 / PB-3` job. It seeds the committed
dataset, boots the API, and asserts against expectations **computed from the seeded rows**, so it
stays meaningful if the dataset changes. Verbatim report:

```text
T-02 expected (active enrollment ∩ classes.teacher_id = t1):
st1
st11
st13
st5
st7
T-02 actual (GET /api/v1/students as teacher1):
st1
st11
st13
st5
st7
students.teacher_id = t1 (NOT the scope):
st1
st13
st5
st7
org total: db=15 admin_http=15
T-02 OK
PB-1: HTTP 403 OWNER_DECISION_REQUIRED_PB1
PB-1 OK
PB-3 GET /rooms as administrator: HTTP 403 OWNER_DECISION_REQUIRED_PB3
PB-3 GET /rooms/r1 as administrator: HTTP 403 OWNER_DECISION_REQUIRED_PB3
PB-3 OK
no token: HTTP 401
```

Four facts, separately:

1. **T-02 holds over HTTP.** `teacher1@demo.local` (`teacher_id = t1`) receives exactly
   `st1, st11, st13, st5, st7` — the five students with an active enrollment in one of the two
   classes `t1` teaches. This matches the count the interrupted session reported by hand.
2. **`students.teacher_id` is provably not the scope.** It points at `t1` for `st1, st13, st5, st7`
   — four students, a different set. The job **fails** if the two sets ever coincide, so a
   regression to the old rule cannot pass quietly.
3. **Strict subset.** The administrator sees 15/15; the teacher sees 5. The job fails if the
   teacher's count is 0 or equals the organization total — the two outcomes PB-1 has not decided
   between.
4. **PB-1 and PB-3 fail closed over HTTP**, not only in unit tests.

## 17. Frontend gate results

- `npm run typecheck` — **clean**. `tsconfig.json` includes only `src` and `vite.config.ts`, so
  `backend/**` was already outside the frontend program; the previously allowed exclusion turned out
  not to be needed, and no repository configuration was changed.
- `npm test` — **2648 passed / 4 failed / 18 skipped**, 204 files. See §15 for what the 4 are and
  why they are pre-existing.
- **No frontend source was changed by this continuation.**

## 18. Files changed

**Added**

| File | Purpose |
|---|---|
| `.github/workflows/backend-tests.yml` | the two CI jobs: backend suite + lint, and the HTTP smoke |
| `docs/engineering/backend-slice/FINAL_REPORT.md` | this file (durable, tracked copy) |
| `.agents/tasks/backend-slice/FINAL_REPORT.md` | workflow-local copy — **untracked, `.agents/` is gitignored** |

**Modified**

| File | Change |
|---|---|
| `docs/engineering/BACKEND_STATUS.md` | added the verification-status table (previously verified / verified here / blocked), the CI "how to run without a local PHP toolchain" section, the HTTP smoke section with the verbatim report, the frontend-gates section, and an updated "Remaining work" |
| `docs/engineering/SESSION_HANDOFF.md` | added a new live pointer at the top, above the 2026-09-30 lineage pointer, recording the baseline, the continuation branch, the five commits, the unchanged PB states, the protected refs and the next action. Nothing was deleted; no SHA was removed |

**Not touched:** `backend/**` (no source change at all), `src/**`, `package.json`, `tsconfig*.json`,
`vite.config.ts`, `.gitignore`, `PROJECT_STATE.md`, `PHASES.md`, `DECISIONS.md`, `OPEN_ITEMS.md`.

## 19. Commits created

Five, all pushed to `arena/01a0f73f-parsian-music-dashboard-opus`, all small and single-purpose,
each reviewed with `git status` and `git diff --stat` before committing. See §2 for the SHA table.
No commit contains a secret: `DEMO_SEED_PASSWORD` in the workflow is a throwaway value for an
ephemeral CI sqlite file, clearly commented as such, and it protects nothing that outlives the job.
No `.env` file was created or committed.

## 20. Refs changed

| Ref | Before | After |
|---|---|---|
| `arena/01a0f73f-parsian-music-dashboard-opus` | **did not exist** | created, 5 commits, pushed, tracking `origin` |
| `cleanup/demo-migration-lineage` | `7215633…` | **unchanged** |
| `main` | `15775ea…` | **unchanged** |
| `backup/pre-f2-2026-09-29` | `62deb84…` | **unchanged** |
| `docs/demo-migration-plan` | `1b23336…` | **unchanged** |
| `arena/01a0e8ec-parsian-music-dashboard-opus` (protected WIP) | `eb973eb…` | **unchanged** |

No force push, no reset, no rebase, no cherry-pick, no amend of a historical commit, no branch
switch to a protected or WIP ref, no branch or tag deleted.

## 21. Unresolved owner decisions

1. **PB-1** — a teacher account with no linked `teacherId`: no students, or every student?
2. **PB-2** — privileged account identity: one `name` field or two; may an administrator edit
   another administrator; may a manager edit an administrator; may a privileged email change; does
   that change require the target account's current password?
3. **PB-3** — which existing permission, if any, hides each of the room, instrument,
   learning-curriculum and progress writes?
4. **PB-4** — remove `useCan(...) || !user`, or keep it as a test seam?
5. **PB-5** — is v1 allowed a notifications domain, or only a later adapter with no inbox table?

Plus the pre-existing open items this slice did not address: O-18 audit events, O-19 retention, the
cookie half of O-12, O-13's portal credential factor, O-10/O-11 messaging identity details, and
I19's scheduling seed-date failure.

## 22. Known limitations

- **The backend suite cannot be executed in every environment.** There is no PHP runtime in this
  sandbox and no reachable package repository for it (`packagist.org`, `getcomposer.org` and
  `deb.debian.org` are all unreachable; only `github.com`, `api.github.com` and the npm registry
  are). The CI workflow is the workaround, not a convenience.
- **The Actions console log is not reachable from this sandbox** either (it is served from
  `results-receiver.actions.githubusercontent.com` and an Azure blob). That is why both the PHPUnit
  tally and the smoke report are republished as check runs — the REST API *is* reachable.
- **Wire casing deviates from O-15.** O-15 says snake_case on the wire; the committed
  `Api*Repository` classes read the TS domain objects unmapped, so resources are camelCase. Query
  parameters and `meta` are snake_case. Recorded in BACKEND_STATUS.md as an open tension; **not**
  changed here, because changing it is a frontend compatibility decision.
- **Only the Bearer half of O-12** is built (cookie + CSRF is not).
- **Roles read is unpermissioned**: `GET roles` / `GET roles/{id}` are open to any authenticated
  member of the organization, because no permission in the vocabulary names role-read and none may
  be invented. Flagged for owner review, not decided.
- **Enrollment and class reads are org-wide under `classes.read`**, so a teacher can list every
  enrollment of the organization even though T-02 limits which *student records* they can open. This
  follows the settled mapping (gap matrix row M) literally and is flagged, not changed.
- **Deferred student fields** (`photoMediaId`, `sessionsUsed`, `progress`, `balance`, …) are stored
  verbatim and type-validated only — never derived, never authoritative.
- **The demo seeder refuses to run outside `local` / `testing`**, and seeded users have no password
  unless `DEMO_SEED_PASSWORD` is set. No credential is committed.

## 23. Next recommended action

**Stop and hand the PB decisions back to the owner.** The first backend slice is contract-complete
and, as of this report, independently verifiable. The next thing that needs a human is not code.

When the owner answers PB-1..PB-5, the change set is small and already localized:

| Decision | The only place to change |
|---|---|
| PB-1 | `StudentAccessPolicy::teacherWithoutTeacherIdScope()` |
| PB-2 | `PrivilegedIdentityPolicy::assertAllowed()` |
| PB-3 | `RoomPolicy::authorizeRead()` / `authorizeWrite()`, routed through `PermissionGate` with the decided permission ids |

Do not start the next backend slice (scheduling, attendance, finance, reports, library,
organization settings, progress, instruments, learning, tickets, chat, files/media, notifications,
audit events, MFA, cookie transport, Telegram/Bale/push, student portal) without a separate
authorization. §14 of the workflow brief puts all of it out of scope.

## 24. Exact continuation instructions for the next agent

1. **Read [../SESSION_HANDOFF.md](../SESSION_HANDOFF.md) first.** It is the only live recovery
   pointer. This file is a report, not a pointer.
2. **Verify the refs before trusting anything** — do not assume this report's SHAs are still the tip:
   ```bash
   git ls-remote origin refs/heads/arena/01a0f73f-parsian-music-dashboard-opus
   git ls-remote origin refs/heads/cleanup/demo-migration-lineage   # expect 7215633c18550c9faf053e8b2bde5ea2e8da08e8
   git ls-remote origin refs/heads/main                             # expect 15775ea9486cb57fbfb8fefa3268658cbe7eb669
   ```
   If any of the three differs unexpectedly, **stop and report.** Do not reset, rebase or force-push.
3. **Confirm the branch is green before changing anything:**
   ```bash
   gh run list --branch arena/01a0f73f-parsian-music-dashboard-opus --limit 1
   ```
4. **Check whether PB-1..PB-5 have been decided.** They were not at the time of this report. If any
   now is, find the decision recorded by the owner first; implement only what it says, and only in
   the single place named in §23.
5. **Re-verify after every change:**
   ```bash
   git push origin arena/01a0f73f-parsian-music-dashboard-opus    # triggers both CI jobs
   gh run watch <run-id>
   ```
   Backend only needs CI. If you can run the frontend gates, run them — but expect the 4
   pre-existing failures of §15, and **do not edit a test to make the suite green**.
6. **Keep the evidence chain intact.** Update `BACKEND_STATUS.md` (and its verification-status
   table) with what you ran and what actually passed, distinguishing previously verified from
   verified-now. Extend this report rather than starting a new one. Extend
   `SESSION_HANDOFF.md` with a new pointer on top; do not delete the existing ones.
7. **Never** invent a permission, reinterpret an undecided PB item as decided, add an
   `organization_id` column without an explicit decision, or merge to `main`.
