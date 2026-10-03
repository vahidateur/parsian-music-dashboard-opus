# BACKEND STATUS — Laravel API (`backend/`)

Implementation record of the first backend slice on branch `cleanup/demo-migration-lineage`
(local commits, not pushed).

> **PB-1..PB-5 ARE RESOLVED — owner decision 2026-10-02, all option A** (keep the existing
> restrictive behaviour). They were **OPEN** when this document was written. The decision register
> is [DECISIONS.md §26](DECISIONS.md); the original sheets, evidence and reasoning stay in
> [OPEN_ITEMS.md](OPEN_ITEMS.md) and are not rewritten. **Every option A keeps the behaviour that
> was already implemented**, so the `403 OWNER_DECISION_REQUIRED_PB<n>` codes below are the
> *expected and final* answers rather than placeholders awaiting a choice. Where a behavior depends
> on one, the server fails closed with that code (see the PB-isolation map). No permission id was
> created, no existing permission was reinterpreted, and `TenantContext` was not touched.

Stack: Laravel 12, Sanctum 4 (Bearer personal access tokens), SQLite for dev and tests, PHPUnit via
`php artisan test`. 160 backend feature tests pass at the end of the PB-1 enforcement commit
(158 at the end of the Scheduling + Attendance slice, 122 at the end of the first slice).

## Verification status — read this before trusting any number below

Every claim in this document is tagged with how it was actually established. "Previously
verified" means it was observed in the interrupted Opus 5.5 session and could not be persisted
as an artifact; "verified in this continuation" means it was re-executed and the output recorded.

| Claim | Status | How it is established |
|---|---|---|
| 158 backend tests pass | **verified in this continuation** | `.github/workflows/backend-tests.yml`, job `PHP 8.3 — Laravel test suite`, PHP 8.3, `php artisan test` → `Tests: 158 passed (1090 assertions)` on `d6098c5`, run `36885088076`. Re-runnable on every push that touches `backend/`. |
| 160 backend tests pass (PB-1 enforcement) | **verified in this continuation** | same job, `php artisan test` → `Tests: 160 passed (1114 assertions)`, **0 failed**, on `86610cf`, run `36929494095`. `backend-test-tally` and `backend-http-smoke` both `success`. The two added tests are `SchedulingTest::test_pb1_closes_generation_and_every_session_write` and `SchedulingTest::test_teacher_with_teacher_id_is_unaffected_by_the_pb1_guard`. |
| PB-1 on every session endpoint | **verified in this continuation** | same run, HTTP smoke step: `GET /sessions`, `/attendance`, `/attendance/corrections` and `/sessions/with-attendance` all answer `403 OWNER_DECISION_REQUIRED_PB1` for `teacher6` (no `teacherId`). |
| Scheduling + Attendance behave per contract, over HTTP | **verified in this continuation, over HTTP** | same workflow, job `HTTP smoke`, step `Scheduling + Attendance — over HTTP`. See "Slice 3" §10. |
| T-02 (teacher sees only their own enrolled students) | **verified in this continuation, over HTTP** | same workflow, job `HTTP smoke — T-02 / PB-1 / PB-3`. See "HTTP smoke" below. |
| PB-1 fails closed for a teacher with no `teacherId` | **verified in this continuation, over HTTP** | `403 OWNER_DECISION_REQUIRED_PB1` |
| PB-3 blocks rooms for every role, administrator included | **verified in this continuation, over HTTP** | `403 OWNER_DECISION_REQUIRED_PB3` on `GET rooms` and `GET rooms/r1` |
| Unauthenticated request → 401 | **verified in this continuation, over HTTP** | `401` on `GET students` with no token |
| All 169 PHP files parse | **verified in this continuation** | PHP 8.3 grammar parse of every `.php` file under `backend/` (the one Blade template excluded). Also enforced in CI by the `PHP syntax lint` step, which runs real `php -l` |
| `npm run typecheck` clean | **verified in this continuation** | `tsc --noEmit`, no output |
| `npm test` result | **verified in this continuation** | 2648 passed / 4 failed / 18 skipped (204 files). The 4 failures are **pre-existing frontend failures**, not backend contracts — see "Frontend gates" below. |
| Everything else in this document | **previously verified**, then re-read and audited in this continuation | code audit against `SESSION_HANDOFF.md` §10, `GOVERNANCE_CHECKPOINT.md` and the committed frontend API repositories |

**Not run / blocked.** The backend suite cannot be executed inside the sandbox this continuation
ran in: there is no PHP runtime and no package repository (`packagist.org`, `getcomposer.org`,
`deb.debian.org` are all unreachable from it). Rather than record an unverified number, the suite
was moved to GitHub Actions and executed there. The result above is the Actions run, not an
inference.

## How to run

```powershell
cd backend
composer install
copy .env.example .env
php artisan key:generate
$env:DEMO_SEED_PASSWORD = '<choose a local password>'   # blank => seeded users cannot log in
php artisan migrate:fresh --seed                        # seeder refuses outside local/testing
php artisan serve --port=8080                           # deploy/ already proxies /api/* to 127.0.0.1:8080
php artisan test
```

Frontend against the API: `VITE_DATA_SOURCE=api` (the existing `Api*Repository` classes; no frontend
code was changed). Seeded accounts come from `data/dataset/users.json` (`admin@demo.local`,
`manager@demo.local`, `desk@demo.local`, `finance@demo.local`, `teacher1..8@demo.local`). No credential
is committed; the password is whatever `DEMO_SEED_PASSWORD` was when seeding.

**Running the suite without a local PHP toolchain.** `.github/workflows/backend-tests.yml` runs the
same two commands on GitHub Actions, on every push or PR touching `backend/`:

```bash
gh workflow run backend-tests.yml            # or just push to a branch
gh run list --branch <branch> --limit 1      # find the run id
gh run watch <run-id>
```

The workflow has two jobs:

1. `PHP 8.3 — Laravel test suite` — `composer install`, `key:generate`, a `php -l` lint over every
   PHP file, then `php artisan test`. Because the Actions console log is served from a host that is
   not reachable from every environment this repository is worked on from, the step republishes the
   PHPUnit tally as a **check run** named `backend-test-tally (PHP 8.3)`, readable through the REST
   API from anywhere:

   ```bash
   gh api "repos/vahidateur/parsian-music-dashboard-opus/commits/<sha>/check-runs" \
     --jq '.check_runs[] | select(.name | startswith("backend-")) | .output.summary'
   ```

2. `HTTP smoke — T-02 / PB-1 / PB-3` — boots the API against the committed demo dataset and asserts
   the governance rules over the wire (see below). Its report is published the same way as a check
   run named `backend-http-smoke`.

The frontend gates are deliberately **not** in CI: they carry pre-existing, governance-recorded
failures that must not be hidden or disabled, and folding them in would only turn a recorded
failure into a red build.

## Architecture (one boundary)

Route (`routes/api.php`, prefix `api/v1`, every route except login behind `auth:sanctum` + `tenant`)
→ thin controller (`App\Http\Controllers\Api\V1\*`) → `ApiFormRequest` subclass (domain 422 code;
calls the domain policy before validation so 403 precedes 422) → application service
(`App\Domain\<X>\<X>Service`, authorizes again — authoritative) → domain policy → the single
`App\Support\Authorization\PermissionGate` → tenant-scoped Eloquent model
(`App\Models\Concerns\BelongsToOrganization`, fail-closed when no tenant) → migrations.

- Permissions: only the existing 23-id vocabulary of `src/domains/auth/permissions.ts`
  (`config/permissions.php`); per-organization role overrides in `roles.permissions`. No permission
  was created (no `rooms.*`, `instruments.*`, `learning.*`, `progress.*`, `roles.read`, `enrollments.*`).
- Tenancy: `organization_id` NOT NULL on every org-owned table, resolved only from the authenticated
  user (`App\Http\Middleware\ResolveTenant`, `App\Support\Tenancy\TenantContext`); never accepted
  from a request, never emitted on the wire. Other-organization ids return 404.
- Envelope: `{data}`, `{data, meta:{page, per_page, total}}` (per_page default 25, clamped to 100),
  DELETE → 204; errors `{error:{code, message, fields?, …}}` mapped in `bootstrap/app.php`.

## Endpoints and authorization basis

| Endpoint | Authorization | Notes |
|---|---|---|
| `POST auth/login` | public, throttled 5/min per email+IP (429 `RATE_LIMITED`) | 401 `AUTH_INVALID_CREDENTIALS`, 403 `AUTH_USER_DISABLED` / `ORGANIZATION_SUSPENDED` |
| `POST auth/logout`, `GET auth/me` | authenticated | `me` returns `token: ""` |
| `GET organization` | `settings.read` | one record, the caller's own organization |
| `PATCH organization` | `settings.write` | partial patch; 422 `ORGANIZATION_INVALID` with `error.fields` |
| `GET users`, `GET users/{id}`, `GET users/{id}/password` | `users.read` | |
| `POST users`, `PATCH users/{id}`, `DELETE users/{id}`, `POST users/{id}/password` | `users.write` + `PrivilegedIdentityPolicy` (PB-2) | 409 `USER_EMAIL_TAKEN`; password body `{password}` only |
| `GET roles`, `GET roles/{id}` | authenticated org member (see "Flagged for owner review") | |
| `PATCH roles/{id}`, `POST roles/{id}/reset` | `roles.write` | administrator must keep `roles.write` (422 `ROLE_INVALID`) |
| `GET teachers`, `GET teachers/{id}` | `teachers.read` | |
| `POST/PATCH/DELETE teachers…`, `POST teachers/{id}/deactivate` | `teachers.write` | deactivate/delete disable linked accounts; 409 `TEACHER_HAS_CLASSES`, `TEACHER_PHONE_TAKEN` |
| all six `rooms` endpoints | **BLOCKED** — `RoomPolicy` (PB-3) | persistence, validation and `RoomService` implemented and tested without HTTP |
| `GET students`, `GET students/{id}` | `students.read` + `StudentAccessPolicy::scopeQuery` (T-02 / PB-1) | |
| `POST students` | `StudentAccessPolicy::authorizeCreate` (scope, then `students.write`) | |
| `PATCH/DELETE students/{id}` | `students.write` + scope (out of scope → 404) | 409 `STUDENT_NATIONAL_ID_TAKEN` |
| `GET classes`, `GET classes/{id}` | `classes.read` (org-wide) | `enrolled`, `waitlist`, `studentIds` computed from enrollments; archived hidden unless `status` given |
| `POST classes`, `PATCH classes/{id}`, `POST classes/{id}/archive`, `DELETE classes/{id}` | `classes.write` | 422 inactive teacher / inactive room; 409 `CLASS_CAPACITY_BELOW_ENROLLED`, `CLASS_HAS_ENROLLMENTS` |
| `GET enrollments`, `GET enrollments/{id}` | `classes.read` | filters `student_id`, `class_id`, `status`, `active=1` |
| `POST enrollments`, `PATCH enrollments/{id}`, `POST enrollments/{id}/withdraw`, `DELETE enrollments/{id}` | `classes.write` | see enrollment invariants |

**Scheduling** (`App\Domain\Scheduling\SessionPolicy`) — table `class_sessions`:

| Endpoint | Authorization | Notes |
|---|---|---|
| `GET sessions`, `GET sessions/{id}`, `GET sessions/{id}/roster`, `POST sessions/check-conflicts` | `schedule.read` + teacher scope (T-02 / PB-1) | conflicts derived, never stored |
| `POST sessions/generate?preview=1` | `schedule.read` | strictly read-only, writes nothing |
| `POST sessions`, `PATCH sessions/{id}`, `DELETE sessions/{id}`, `POST sessions/{id}/cancel`, `POST sessions/{id}/reschedule` | `schedule.write` | re-checks conflicts **inside** the write transaction |
| `POST sessions/generate` | `schedule.write` | `MAX_GENERATION_DAYS = 180`, `MAX_GENERATION_SESSIONS = 500` |

**Attendance** (`App\Domain\Attendance\AttendancePolicy`) — tables `attendance_records`,
`attendance_corrections`:

| Endpoint | Authorization | Notes |
|---|---|---|
| `GET attendance`, `GET attendance/{id}`, `GET attendance/corrections`, `GET sessions/{id}/attendance`, `GET sessions/with-attendance` | `attendance.read` + teacher scope (T-02 / PB-1) | roster re-derived server-side |
| `POST attendance`, `POST attendance/bulk`, `POST attendance/{id}/correct` | `attendance.write` | bulk = one transaction, all or nothing; correct appends an audit row |

Enrollment invariants (`App\Domain\Enrollments\EnrollmentService`, one `DB::transaction` per write,
class row `lockForUpdate()`): student and class must exist in the organization (422
`ENROLLMENT_INVALID`); archived class → 409 `CLASS_ARCHIVED`; one open (active|waitlist) enrollment
per student+class → 409 `ENROLLMENT_DUPLICATE`, also backed by the partial unique index
`enrollments_open_unique` (sqlite/pgsql; on MySQL only the transactional check applies) whose
violation is mapped to the same code; active count ≥ capacity → 409 `CLASS_FULL` (waitlist does not
occupy a seat; promotion to active re-checks). Withdraw = `cancelled` + `endDate` today (ISO date).
Defaults: `pricingPlan = {label: class.level, amount: class.tuition}`, `startDate` = today (ISO date).

## PB-isolation map

| PB | Isolating method | Blocked code | Status |
|---|---|---|---|
| PB-1 teacher without `teacherId` | `App\Domain\Students\StudentAccessPolicy::teacherWithoutTeacherIdScope()`, `App\Domain\Scheduling\SessionPolicy::teacherScope()`, `App\Domain\Attendance\AttendancePolicy::scope()` | 403 `OWNER_DECISION_REQUIRED_PB1` | IMPLEMENTED-BLOCKED on students list/get/create/update/delete **and on every session and attendance endpoint** (including `roster`, `check-conflicts`, `corrections`, `with-attendance`). Teacher WITH `teacherId` = T-02 implemented in SQL — students: active enrollment ∩ `classes.teacher_id`; sessions: `class_sessions.teacher_id`; attendance: through the session. `students.teacher_id` is never an authorization source. **RESOLVED 2026-10-02 — option A:** fail-closed is the chosen policy, applied consistently to students, scheduling sessions, attendance, attendance corrections, related attendance reads and `with-attendance` — never org-wide. The gap that `sessions/generate` and the write verbs left is closed: `SessionPolicy::assertTeacherLinked()` runs in all seven scheduling Form Requests **before** the permission check, and in all five `SessionService` write methods, so the refusal cannot be bypassed by reaching a verb that selects no rows. |
| PB-2 privileged identity | `App\Domain\Users\PrivilegedIdentityPolicy::assertAllowed()` — (a) self-edit, (b) editing another administrator, (c) assigning `administrator`, (d) email change of an administrator/manager | 403 `OWNER_DECISION_REQUIRED_PB2` | IMPLEMENTED-BLOCKED for a–d; other user writes implemented. Single `name` field and no current-password field kept (current contract, not a decision). **RESOLVED 2026-10-02 — option A:** all four restrictions (a–d) are kept deliberately. The server is **not** relaxed to match the more permissive frontend panel; the frontend stays the wider surface. |
| PB-3 rooms / instruments / learning / progress | `App\Domain\Rooms\RoomPolicy::authorizeRead()` / `authorizeWrite()` | 403 `OWNER_DECISION_REQUIRED_PB3` | Rooms: IMPLEMENTED-BLOCKED on all six endpoints for every role. Instruments, learning, progress: LEFT-UNIMPLEMENTED. Class validation still checks room existence/active as data integrity, not as room authorization. **RESOLVED 2026-10-02 — option A:** rooms stay blocked and **no** `rooms.*`, `instruments.*`, `learning.*` or `progress.*` permission is created. `settings.write` and `library.write` are **not** reinterpreted as covering these domains, and nothing authorizes on `role === "teacher"`. The vocabulary remains the **23** ids in `backend/config/permissions.php` — which contains no `rooms.*` id at all. |
| PB-4 `useCan(...) \|\| !user` | none (frontend idiom; every server route except login requires a token → 401) | – | LEFT-UNTOUCHED — **RESOLVED 2026-10-02 — option A:** kept as the documented test seam. Removal would break legacy view tests, and the idiom has no production reach because `AuthGate` never renders those views with a null user. Backend authentication is **not** weakened: the smoke job asserts `401` with no token. |
| PB-5 notifications | none | – | LEFT-UNIMPLEMENTED (no table, no route) — **RESOLVED 2026-10-02 — option A:** v1 has **no** notifications domain, inbox, table, permission or delivery implementation; Telegram/Bale/SMS/email stay **later adapter capabilities only**. This also reconciles the O-17 vs integration-architecture conflict: both documents are read as *“required later capability, not in v1”* and neither is rewritten. |

## HTTP smoke — governance assertions over the wire

The interrupted session verified T-02 by hand over HTTP and could not persist the output. The
`HTTP smoke — T-02 / PB-1 / PB-3` job is that check, made re-runnable. It seeds the committed
dataset (`data/dataset/*.json`), boots the API, and asserts against expectations **computed from
the seeded rows** — never hard-coded — so it stays meaningful if the dataset changes.

Verbatim report of the run recorded in this continuation:

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

Read it as four separate facts:

1. **T-02 holds, and it is enforced in SQL.** `teacher1@demo.local` (`teacher_id = t1`) receives
   exactly `st1, st11, st13, st5, st7` — the five students with an `active` enrollment in one of the
   two classes `t1` teaches.
2. **`students.teacher_id` is provably not the authorization source.** That column points at `t1`
   for `st1, st13, st5, st7` — four students, a *different* set. The job fails if the two sets ever
   coincide, so a regression to the old rule cannot pass quietly.
3. **The scope is a strict subset.** The administrator sees all 15 students over the same endpoint;
   the teacher sees 5. The job fails if the teacher's count is 0 (fail-closed-empty) or equal to the
   organization total (org-wide) — the two outcomes PB-1 **has now decided between**: the owner chose
   fail-closed (option A, 2026-10-02), so 0 is the correct answer and the org-wide total is not.
4. **PB-1 and PB-3 fail closed over HTTP, not only in unit tests.** Detaching `teacher6`'s
   `teacher_id` yields `403 OWNER_DECISION_REQUIRED_PB1`; every rooms endpoint yields
   `403 OWNER_DECISION_REQUIRED_PB3` even for the administrator.

### The Scheduling + Attendance step

Added with the slice. Same discipline as the checks above: every expectation is computed from the
seeded rows (`sqlite3 database/database.sqlite`) or from the response itself, so nothing is pinned to
a value that a dataset change would silently invalidate.

Verbatim report of the run on `d6098c5`:

```text
teacher1 -> t1
sessions: db=137 admin_http=137
sessions visible to teacher1: 26 of 137
PB-1 GET /sessions as teacher6: HTTP 403 OWNER_DECISION_REQUIRED_PB1
PB-1 GET /attendance as teacher6: HTTP 403 OWNER_DECISION_REQUIRED_PB1
PB-1 GET /attendance/corrections as teacher6: HTTP 403 OWNER_DECISION_REQUIRED_PB1
PB-1 GET /sessions/with-attendance as teacher6: HTTP 403 OWNER_DECISION_REQUIRED_PB1
POST /sessions/generate?preview=1: HTTP 200
created session: ses_01m3w1j59t22x5j9attr6xskvj origin=manual
GET /sessions/ses_01m3w1j59t22x5j9attr6xskvj/roster: HTTP 200
cancel -> cancelled
cancel without reason: HTTP 422
teacher1 session=ses_cl1_20260804_1700 student=st1
recorded attendance: att_01m3w1j5czkpms6czps4zzstvx by سارا احمدی
re-record: rows=1 corrections=1
corrected -> excused
audit rows over HTTP: 2
Scheduling + Attendance OK
```

Read it as:

1. **The seeded schedule is reachable and complete.** 137 rows in, 137 visible to the administrator.
2. **T-02 holds for sessions too** — `teacher1` sees 26 of 137, a strict subset (the job fails on 0
   or on the full total, the two outcomes PB-1 **has now decided between** — option A, fail-closed).
3. **PB-1 fails closed on every new endpoint**, including the derived reads.
4. **Static routes are not shadowed.** `POST sessions/generate?preview=1` answers 200 rather than
   being swallowed by `sessions/{id}`, and the step re-counts the table afterwards to prove the
   preview wrote nothing.
5. **The attendance invariants hold at the database level, not only in the response.** After
   re-recording the same student: `rows=1` (the UNIQUE constraint) and `corrections=1` (the mark was
   not silently overwritten). After a correction: two audit rows survive with their previous values
   (`present`, `late`) and new values (`late`, `excused`) intact.

## Recorded deviations and tensions

- **O-12 transport:** Bearer tokens only (the only transport `src/api/client.ts` speaks). The
  cookie + CSRF half of O-12 is not built — recorded deviation.
- **Wire casing vs O-15:** O-15 says snake_case on the wire; the existing `Api*Repository` classes send
  and read the TS domain objects unmapped, so resources are camelCase (`teacherId`, `studentIds`, …).
  Query params and `meta` are snake_case; the auth session keeps snake_case `expires_at`,
  `created_at`, `updated_at`. The client contract was implemented; the tension is open.
- **Enrollment dates:** server defaults (`startDate`, withdraw `endDate`) are ISO dates; the local
  repository writes the display word «امروز» and the TS comment describes Jalali display dates.
  Client-supplied date strings are stored verbatim.

## Flagged for owner review (implementation choices, not PB items)

- **Roles read:** `GET roles` / `GET roles/{id}` are allowed to any authenticated member of the
  organization (no permission names role-read; the client syncs role policy in every session). No
  permission was invented.
- **Enrollment and class reads are org-wide under `classes.read`**, so a teacher can list every
  enrollment (and every class's `studentIds`) of the organization even though T-02 limits which
  student records they can open. This follows the settled mapping (gap matrix row M) literally.

## Deferred student wire fields

Stored verbatim in `students.deferred` (type-validated only, never derived, not authoritative):
`photoMediaId`, `sessionsUsed`, `sessionsTotal`, `attendance`, `progress`, `balance`, `lastSeen`,
`nextClass`, `notes`, `activity`, `skills`.

## Local-repository behaviors not mirrored

- Teacher → linked account name/phone sync (only the disable-on-inactive direction is mirrored).
- Class capacity vs room capacity check, and `programId`/`levelId` existence checks (no programs or
  levels domain server-side; they are plain strings).
- `includeArchived` / `assignableOnly` class list params are not sent by `toQuery` and not implemented.

## Frontend gates (run in this continuation, backend not involved)

The backend slice changed no frontend source, but the repository gates were run so the state of the
branch is recorded honestly rather than assumed.

- `npm run typecheck` — **clean**, no output. `tsconfig.json` still includes only `src` and
  `vite.config.ts`, so `backend/**` is already outside the frontend program; no exclusion was needed.
- `npm test` — **2648 passed / 4 failed / 18 skipped (2670)** across 204 files (3 files failing),
  re-run in this continuation after `npm ci`. Identical to the baseline recorded by the previous
  continuation — **no regression, and no new failure**. The failures are pre-existing and unrelated
  to this slice; none was hidden, skipped or edited:

  | Test | Failure |
  |---|---|
  | `src/__tests__/m10Boundary.test.ts` → "makes the deferred surfaces carry their deferral instead of a read path" | `src/views/Finance.tsx` imports `@/domains/auth/AuthContext`, which the M10 boundary forbids for a deferred surface |
  | `src/views/__tests__/honestWriteCopy.test.tsx` → "in EMPTY names the academy's own data…" and "in DEMO still says plainly that the data is demo data" | the «ذخیرهٔ تغییرات» (branding save) control is not rendered for the acting role, so the test cannot find it |
  | `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx` → "saving the academy's identity never calls it demo data" | same missing save control over an EMPTY environment |

  Three further facts about this baseline, all recorded because they change how the numbers read:

  - **Flaky count — and one correction to the previous note.** The previous continuation recorded
    three full runs producing 13, 14 and 4 failures and attributed the spread to the shallow clone,
    curable with `git fetch --unshallow`. This continuation reproduced the 13-failure run and then
    found that **`--unshallow` alone is not sufficient**: one preserved-branch tip the gate checks
    (`251af96f405df5935ee17ddc9ba6b490f7989c2d`) exists only behind the tag
    `archive/palette-focus-251af96`, so it stays missing until all refs are fetched:

    ```bash
    git fetch --unshallow
    git fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune   # brings the archive tags
    ```

    With that, `projectState.test.ts` is 52/52 green and the full suite settles at the 4 failures
    above. This matters beyond bookkeeping: a fresh clone that only unshallows will show 9 spurious
    failures and read as a regression that no one introduced.
  - **I19 did not reproduce.** `src/views/__tests__/schedulingWrites.test.tsx:1234` (extra id
    `ses_cl2_20260929_1400`) is recorded as a known pre-existing failure in
    [SESSION_HANDOFF.md](SESSION_HANDOFF.md) §8. It did not reproduce in any run of this
    continuation either. That is not evidence it was fixed — the Scheduling + Attendance slice
    changed no frontend source and no seed file the test reads — only that it did not reproduce
    here. It stays on the record.

  - **What was ruled out before recording the number.** A first full run here returned 13 failures,
    9 of them in `projectState.test.ts`. Rather than record that as a new baseline, the cause was
    traced to the clone (`git rev-parse --is-shallow-repository` → `true`) and fixed; only the
    re-run is recorded above. The intermediate 13-failure figure is reported here and nowhere else,
    and is not carried forward as a result.

## Remaining work

The backend now covers authentication, users and roles, teachers, rooms, students, classes,
enrollments, **sessions** and **attendance**. Everything built so far is contract-complete against
`SESSION_HANDOFF.md` §10 and is covered by a re-runnable CI gate
(`.github/workflows/backend-tests.yml`). Nothing in it needs rebuilding.

The backend now ALSO covers **organization settings** (`GET`/`PATCH /organization`) — see the
Organization settings slice below.

Still unbuilt, all of it outside the slices built so far: library/resources, progress, finance,
reports, instruments, learning, tickets, chat, files/media, notifications (PB-5), audit events
(O-18), MFA, cookie transport (O-12), Telegram/Bale/push, student portal.

PB-1..PB-5 were **resolved by the owner on 2026-10-02, all option A** (see DECISIONS.md §26 and the
PB-isolation map). They are no longer open: each option A keeps the behaviour that was already
implemented, so the `403 OWNER_DECISION_REQUIRED_PB<n>` answers are the expected and final ones, and
the HTTP smoke job proves them over the wire.

---

## Slice 3 — Scheduling + Attendance (BUILT AND VERIFIED)

This is the "Next recommended slice" the Kiro handoff named and the previous section carried as
`NOT YET STARTED`. Both halves are now built, in the order the handoff gives them, against the wire
contracts already present in the frontend.

### 1. Provenance

| | |
|---|---|
| Starting SHA | `7215633` (base both lineages branched from); branch tips at handoff were `897ca39` (`arena/01a0f73f-…`) and `86dab3f` (`cleanup/demo-migration-lineage`) |
| Resulting SHA | `d6098c5` (see commit list below) |
| Branch | `arena/01a0f73f-parsian-music-dashboard-opus` |
| Plan source | the `86dab3f` diff (`docs/engineering/BACKEND_STATUS.md` + `SESSION_HANDOFF.md`), merged into the branch as a two-parent merge `edb21f1` |

Commits, in order:

| SHA | Subject |
|---|---|
| `edb21f1` | docs(backend): merge the Kiro session handoff and next-slice plan |
| `4bbbdc4` | feat(backend): Scheduling + Attendance slices |
| `c083187` | ci: publish failure digests as check runs |
| `23ba401` | fix(backend): name the table `class_sessions`; rename the test `session()` helper |
| `7605a4c` | fix(backend): attendance id assignment, PB-1 on check-conflicts, preview path |
| `d6098c5` | fix(backend): deterministic correction ordering |

`edb21f1` is a real merge of `897ca39` × `86dab3f`; both parents' documentation was kept, with the
one genuinely duplicated paragraph dropped. No force push, no reset, no rebase, no history rewrite.

### 2. Files added

Backend (`backend/`):

| File | Role |
|---|---|
| `database/migrations/2026_10_01_120001_create_class_sessions_table.php` | table `class_sessions` |
| `database/migrations/2026_10_01_130001_create_attendance_tables.php` | `attendance_records` + `attendance_corrections` |
| `app/Models/ClassSession.php` | the `Session` of `src/domains/scheduling/types.ts` |
| `app/Models/AttendanceRecord.php` | the `AttendanceRecord` |
| `app/Models/AttendanceCorrection.php` | insert-only audit log row |
| `app/Domain/Scheduling/SessionPolicy.php` | `schedule.read` / `schedule.write` + T-02 row scope |
| `app/Domain/Scheduling/ConflictDetector.php` | derives `ConflictReport` on every call |
| `app/Domain/Scheduling/ConflictReport.php` | the wire shape |
| `app/Domain/Scheduling/SessionService.php` | CRUD + cancel + reschedule + roster |
| `app/Domain/Scheduling/SessionGenerator.php` | bounded generation, preview + commit |
| `app/Domain/Attendance/AttendancePolicy.php` | `attendance.read` / `attendance.write` + T-02 row scope |
| `app/Domain/Attendance/AttendanceService.php` | record, bulk, correct, corrections, derived reads |
| `app/Http/Controllers/Api/V1/SessionController.php` | 9 actions |
| `app/Http/Controllers/Api/V1/AttendanceController.php` | 8 actions |
| `app/Http/Requests/Scheduling/*.php` (8) | Form Requests, camelCase wire keys |
| `app/Http/Requests/Attendance/*.php` (6) | Form Requests, camelCase wire keys |
| `app/Http/Resources/SessionResource.php`, `AttendanceResource.php` | wire shapes |
| `database/factories/ClassSessionFactory.php`, `AttendanceRecordFactory.php` | test data |
| `tests/Feature/SchedulingTest.php`, `tests/Feature/AttendanceTest.php` | 36 new tests |

Files changed: `backend/routes/api.php` (route registration),
`backend/database/seeders/DemoDatasetSeeder.php` (`seedSessions()`),
`.github/workflows/backend-tests.yml` (a Scheduling + Attendance smoke step, and failure digests).

### 3. Endpoints

Scheduling — `schedule.read` / `schedule.write`:

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/sessions` | `schedule.read` |
| POST | `/api/v1/sessions` | `schedule.write` |
| GET | `/api/v1/sessions/{id}` | `schedule.read` |
| PATCH | `/api/v1/sessions/{id}` | `schedule.write` |
| DELETE | `/api/v1/sessions/{id}` | `schedule.write` |
| POST | `/api/v1/sessions/{id}/cancel` | `schedule.write` |
| POST | `/api/v1/sessions/{id}/reschedule` | `schedule.write` |
| GET | `/api/v1/sessions/{id}/roster` | `schedule.read` |
| POST | `/api/v1/sessions/generate` | `schedule.write` (`?preview=1` → `schedule.read`) |
| POST | `/api/v1/sessions/check-conflicts` | `schedule.read` |

Attendance — `attendance.read` / `attendance.write`:

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/attendance` | `attendance.read` |
| POST | `/api/v1/attendance` | `attendance.write` |
| GET | `/api/v1/attendance/{id}` | `attendance.read` |
| POST | `/api/v1/attendance/bulk` | `attendance.write` |
| POST | `/api/v1/attendance/{id}/correct` | `attendance.write` |
| GET | `/api/v1/attendance/corrections` | `attendance.read` |
| GET | `/api/v1/sessions/{id}/attendance` | `attendance.read` |
| GET | `/api/v1/sessions/with-attendance` | `attendance.read` |

Static segments — `sessions/generate`, `sessions/check-conflicts`, `sessions/with-attendance`,
`attendance/bulk`, `attendance/corrections` — are registered **before** the `{id}` routes, because
Laravel matches in registration order. The smoke job asserts the generate route answers 200 rather
than being swallowed by `sessions/{id}`.

### 4. Request / response contracts

Every shape is the camelCase TS type, read unmapped by `ApiSchedulingRepository` /
`ApiAttendanceRepository`; query strings are snake_case, as `toQuery()` sends them.

- `Session` — `id, classId, date, startTime, endTime, teacherId, roomId, status, origin`, plus
  `cancelReason` / `rescheduledFromId` / `rescheduledToId` / `notes` when non-empty. `createdAt` /
  `updatedAt` are server-generated ISO timestamps.
- `ConflictReport` — `{ hard[], warnings[], ok }`; each item is
  `{ kind, severity, message, ... }` with `severity` echoing the bucket.
- `GenerationPlan` — `{ classId, from, to, creates[], updates[], skips[], orphans[], conflicts }`.
- `GenerationResult` — `{ plan, created[], updated[], noop }`. `?preview=1` returns the plan **as the
  item** (`{ data: GenerationPlan }`), matching `previewGeneration()`.
- `AttendanceRecord` — `id, sessionId, studentId, status, recordedBy, recordedAt`, optional `notes`,
  `updatedAt`.
- `AttendanceCorrection` — `id, recordId, sessionId, studentId, previousStatus, newStatus, reason,
  changedBy, changedAt`.
- `SessionAttendance` — `{ sessionId, records[], corrections[] }`.
- `RosterEntry` — `{ studentId, studentName, photoMediaId? }`.
- `sessions/with-attendance` and `attendance/bulk` return bare lists
  (`{ data: [...] , meta: {...} }`), as their repositories' `Promise<string[]>` / `Promise<AttendanceRecord[]>`
  expect.

Errors follow the existing envelope, `{ error: { code, message, fields?, ...extra } }`:
`SESSION_NOT_FOUND` (404), `SESSION_INVALID` (422), `SESSION_CLASS_NOT_FOUND` (422),
`SESSION_CANCEL_REASON_REQUIRED` (422), `SESSION_ALREADY_CANCELLED` (409), `SESSION_CONFLICT` (409,
carries `error.conflicts`), `SESSION_WARNINGS_UNACKNOWLEDGED` (409, carries `error.conflicts`),
`SESSION_HAS_ATTENDANCE` (409), `SESSION_GENERATION_WINDOW_INVALID` (422),
`ATTENDANCE_INVALID` (422), `ATTENDANCE_NOT_FOUND` / `ATTENDANCE_SESSION_NOT_FOUND` (404),
`ATTENDANCE_DUPLICATE` (409), `ATTENDANCE_STUDENT_NOT_ENROLLED` (422),
`ATTENDANCE_CORRECTION_REASON_REQUIRED` (422), `ATTENDANCE_CORRECTION_NOOP` (409),
`FORBIDDEN` (403, carries `error.permission`), `OWNER_DECISION_REQUIRED_PB1` (403).

### 5. Permissions

Only ids already in the shipped 23-id vocabulary (`config/permissions.php`) are used —
`schedule.read`, `schedule.write`, `attendance.read`, `attendance.write`. **Nothing was invented.**

The vocabulary's own asymmetry is honoured and asserted, not assumed:

| Role | schedule.read | schedule.write | attendance.read | attendance.write |
|---|---|---|---|---|
| administrator | ✔ | ✔ | ✔ | ✔ |
| manager | ✔ | ✔ | ✔ | ✔ |
| teacher | ✔ | ✘ | ✔ | ✔ |
| staff | ✔ | ✔ | ✔ | ✘ |
| accountant | ✘ | ✘ | ✘ | ✘ |

A teacher teaches the schedule but does not author it; a teacher does record attendance. Both
`SchedulingTest` and `AttendanceTest` assert the 403 with `error.permission` rather than only
asserting the happy path.

### 6. Tenancy

Unchanged model — `TenantContext` + the `BelongsToOrganization` global scope. No new tenancy seam.

- Requests resolve the tenant through the existing `auth:sanctum` + `tenant` middleware.
- Every query on `ClassSession`, `AttendanceRecord` and `AttendanceCorrection` is auto-scoped; with
  no resolved organization the scope matches nothing (fail closed).
- T-02 extension, as the handoff requires: a teacher's rows are limited to
  `class_sessions.teacher_id = actor.teacher_id`. For attendance, which has no teacher column of its
  own, the scope runs through the session (`session_id IN (SELECT id FROM class_sessions WHERE
  teacher_id = ?)`).
- A teacher account with no `teacher_id` is **PB-1** and fails closed: 403
  `OWNER_DECISION_REQUIRED_PB1` on every session and attendance endpoint — including
  `check-conflicts`, `roster`, `corrections` and `with-attendance`. Neither an empty result nor an
  org-wide one.
- Out-of-scope and out-of-tenant ids are 404, so ids are not enumerable.

### 7. Migrations

`class_sessions` — one real, dated occurrence of a class. Materialized rather than derived because
it carries per-occurrence state a computed value cannot hold: cancellation with a reason, a
substitute teacher, a one-off room move, and the attendance records that hang off it. `date` is an
ISO date and the times are `HH:mm` because sessions are range-queried and sorted; Jalali stays a
display concern. Indexed on `(org, date)`, `(org, class_id, date)`, `(org, teacher_id, date)`,
`(org, room_id, date)`, `(org, status)`.

**The table is `class_sessions`, not `sessions`.** The base migration
`0001_01_01_000000_create_users_table.php` already creates `sessions` for the framework's database
session store — discovered by running the migration, not by reading it. Same reason `AcademyClass`
lives on `classes`.

`attendance_records` — `UNIQUE(session_id, student_id)` as a real DB constraint, not a service-level
check, so a concurrent request cannot violate it. `recorded_by_user_id` has **no foreign key**: an
audit trail that disappears when a user is deleted is not an audit trail.

`attendance_corrections` — insert-only. `previous_status` and `new_status` are stored on the log
rather than reconstructed, so the history survives even if the parent record is later replaced.

### 8. Seeding

`data/dataset/scheduledSessions.json` (137 rows) is seeded: its records already match the server
`Session` shape exactly.

Deliberately **not** seeded:

- `sessions.json` and `attendance.json` are the legacy demo format (`g7`-style ids, a `mark` field,
  `recordedBy` as a free-text person name). Neither can be mapped onto the schema without inventing
  data, and `g7` does not exist in `scheduledSessions.json`, so there is no join to map through.
- `attendanceRecords.json`, `attendanceCorrections.json` and `sessionCompensations.json` are empty
  arrays (3 bytes each). Attendance test data comes from factories, not fixtures.

### 9. Tests executed

`php artisan test`, run in CI (there is no local PHP/Composer toolchain in this environment), on
commit `d6098c5`, run `36885088076`:

```
Tests:    158 passed (1090 assertions)
Duration: 3.08s
```

Up from `122 passed (915 assertions)` before this slice — **36 new tests, 175 new assertions, none
removed, none skipped, none hidden.** New files: `tests/Feature/SchedulingTest.php` (18 tests),
`tests/Feature/AttendanceTest.php` (18 tests).

What they cover, beyond the happy paths: 401 unauthenticated; the role/permission matrix above;
PB-1 for a teacher with no `teacherId`; T-02 session scope (another teacher's session is 404, not
403); overlapping room and teacher bookings are hard conflicts; an adjacent slot
(`13:00–14:00` vs `14:00–15:00`, exclusive end) is **not** a conflict; an inactive resource warns and
requires `acknowledgeWarnings`; cancel requires a reason and refuses a second cancel; reschedule
links both ways and preserves the original as cancelled; delete is refused once attendance exists;
the roster excludes withdrawn students; generate preview writes nothing; generate applies
deterministic slot ids (`ses_{classId}_{Ymd}_{Hi}`); a window over 180 days is 422; a teacher may
preview but not commit; re-recording attendance does not add a row and does append a correction;
bulk is all-or-nothing (one off-roster entry with no acknowledgement rolls back all three); the
UNIQUE constraint holds even against a direct non-HTTP write; a correction carries
previous/new/reason/actor; a correction with no reason is 422 and a no-op correction is 409;
`sessionAttendance` and `with-attendance` return the derived shapes; and cross-tenant reads and
writes are invisible/refused.

### 10. HTTP smoke (CI)

The `smoke` job now has a **Scheduling + Attendance** step, run against the committed demo dataset
with expectations computed from the seeded rows. Result on `d6098c5`:

```
sessions: db=137 admin_http=137
sessions visible to teacher1: 26 of 137
PB-1 GET /sessions            as teacher6: HTTP 403 OWNER_DECISION_REQUIRED_PB1
PB-1 GET /attendance          as teacher6: HTTP 403 OWNER_DECISION_REQUIRED_PB1
PB-1 GET /attendance/corrections       as teacher6: HTTP 403 OWNER_DECISION_REQUIRED_PB1
PB-1 GET /sessions/with-attendance     as teacher6: HTTP 403 OWNER_DECISION_REQUIRED_PB1
POST /sessions/generate?preview=1: HTTP 200
created session: ses_01m3w1j59t22x5j9attr6xskvj origin=manual
GET /sessions/ses_01m3w1j59t22x5j9attr6xskvj/roster: HTTP 200
cancel -> cancelled
cancel without reason: HTTP 422
teacher1 session=ses_cl1_20260804_1700 student=st1
recorded attendance: att_01m3w1j5czkpms6czps4zzstvx by سارا احمدی
re-record: rows=1 corrections=1
corrected -> excused
audit rows over HTTP: 2
Scheduling + Attendance OK
no token: HTTP 401
```

The pre-existing checks in the same job are unchanged and still pass: T-02 student scope
(`st1/st11/st13/st5/st7`, with `st11` the discriminator against the 4 students whose
`students.teacher_id` points at `t1`), PB-1, PB-3 (`/rooms` and `/rooms/r1` are 403
`OWNER_DECISION_REQUIRED_PB3` even for the administrator), and 401 with no token.

### 11. Frontend gates

No frontend source was changed by this slice, but both gates were run rather than assumed.

- `npm run typecheck` → exit 0, clean.
- `npm test` → **2648 passed / 4 failed / 18 skipped (2670)** across 204 files, after `npm ci`.
  Identical to the baseline the previous continuation recorded — no regression. The four failures
  are pre-existing and enumerated under "Frontend gates" above, together with the one correction
  this continuation found to that baseline's flakiness note (`git fetch --unshallow` is not
  sufficient on its own; the archive tags must be fetched too).

### 12. Governance decisions relied on

- **Fail closed where governance is silent.** PB-1 (teacher with no `teacherId`) is 403 everywhere
  rather than an empty or org-wide result.
- **Only the existing permission vocabulary.** No `rooms.*`, `instruments.*`, `learning.*`,
  `progress.*` or any other id was derived from `settings.*`/`library.*`/`students.read`/`role`.
- **TenantContext preserved.** No new tenancy model.
- **No OWNER DECISION REQUIRED item was resolved.** PB-1..PB-5 are all still open; the backend only
  implements the fail-closed behaviour for each.
- **Conflicts are derived, never stored**, so they react to a reschedule instead of going stale.
- **A cancellation and a correction both require a stated reason.** A change with no reason is not an
  audit trail.
- **Generation is bounded** (180 days / 500 sessions) and refuses rather than truncating.

### 13. PB-1..PB-5 status — all still OWNER DECISION REQUIRED, nothing resolved

| | Status | How this slice behaves |
|---|---|---|
| PB-1 | OPEN | teacher without `teacherId` → 403 `OWNER_DECISION_REQUIRED_PB1` on every session and attendance endpoint |
| PB-2 | OPEN | privileged-identity / user-management restrictions untouched |
| PB-3 | OPEN | rooms still blocked as implemented; no room permission invented. Sessions reference `room_id` as a plain string and never check a room permission |
| PB-4 | OPEN | untouched |
| PB-5 | OPEN | notifications still out of scope |

### 14. Known limitations

1. ~~`SESSION_OUTSIDE_WORKING_HOURS` and `SESSION_TIGHT_TURNAROUND` are not evaluated.~~ **RESOLVED
   2026-10-03 by the Organization settings slice.** Both kinds are now evaluated server-side against
   `OrganizationRules`, the server copy of `src/domains/organization/rules.ts`, and both are emitted
   as WARNINGS — never as hard conflicts — exactly as `src/domains/scheduling/conflicts.ts`
   classifies them ("a session outside it is a warning, never a refusal"). A rule that cannot be read
   is NOT emitted. (An earlier version of this note claimed the academy had no working-hours domain at
   all; that was wrong and was corrected here.)
2. **Room/teacher double-booking is enforced transactionally, not by a DB constraint.** An
   exclusive-end time range cannot be expressed as a UNIQUE index, so the check is re-run inside the
   write transaction. `UNIQUE(session_id, student_id)` *is* a real constraint; the schedule
   equivalent cannot be.
3. **The roster is not date-scoped.** The TS comment in `apiRepository.ts` describes it as "derived
   from active Enrollment scoped to the session's date", but `Enrollment.startDate` is a Jalali
   display string in the dataset (`۱۴۰۴/۰۷/۰۱`) and is stored verbatim, so it is not a queryable ISO
   date. The roster therefore reflects *currently active* enrollment. Recording and correcting this
   in the backend would need an owner decision on the enrollment date format (O-series, unchanged).
4. **`SKIP_CLOSED_DAY` is never emitted.** Generation only walks weekdays in `class.days`, so a day
   the class does not meet is not a "slot" at all. Academy-level closed weekdays live in
   `OrganizationSettings.closedWeekdays` — see limitation 1.
5. **`late` is a status, not a duration.** `attendance.json` records lateness as a mark, so a minutes
   column would hold invented precision.
6. **`sessions.json` and `attendance.json` are not seeded** (see §8). The seeded schedule is
   `scheduledSessions.json`; there is no seeded attendance at all.

### 15. Unresolved

- ~~PB-1..PB-5, all with the owner.~~ **Resolved 2026-10-02, all option A** — see DECISIONS.md §26.
  Nothing here reopens them.
- The enrollment date format (limitation 3), which also blocks the `O-` items recorded in
  `OPEN_ITEMS.md`.
- Whether a teacher should be able to author the schedule at all. The shipped vocabulary says no
  (`schedule.read` without `schedule.write`); the backend follows the vocabulary and does not
  reinterpret it.

### 16. Exact next unfinished task

**DONE 2026-10-03.** `GET /organization` and `PATCH /organization` exist, using `settings.read` /
`settings.write`, against the contract in `src/domains/organization/apiRepository.ts`.

The next slice after it is **Library / resources** — `library.read` and `library.write` are already
in the vocabulary and `src/domains/library/apiRepository.ts` is written, so it needs no governance
decision to begin. It is not authorized yet.

For the record, the ordering that pointed here was: Organization settings came first because it is
the earliest item on the plan's "After" list that the standing scope constraints do not exclude

It is the right next step for two reasons beyond ordering: it is the first item on the plan's
"After" list that is not excluded by the standing scope constraints (tickets, chat, files,
notifications, Telegram/Bale/push, student portal, finance and reports are all out of scope unless
an existing plan brings them in), **and** it unblocks limitation 1 — the two unevaluated conflict
kinds need a server-side `OrganizationSettings`.

After that, and requiring an owner decision first: **progress**, whose `apiRepository.ts` exists but
whose `progress.read` / `progress.write` permissions are **not in the vocabulary** — that slice is
blocked until governance adds them. The same is true of `instruments.*` and `learning.*`. Library is
unblocked (`library.read` / `library.write` exist and `apiRepository.ts` is written).

### 17. Verification commands

```bash
# backend suite + HTTP smoke — the durable form, no local PHP needed
git push origin arena/01a0f73f-parsian-music-dashboard-opus   # triggers the workflow
gh run list --workflow=backend-tests.yml --limit 1
# tally + smoke report are published as check runs (the Actions log blob is not
# reachable from every environment):
gh api repos/vahidateur/parsian-music-dashboard-opus/commits/<sha>/check-runs \
  --jq '.check_runs[] | select(.name | startswith("backend-")) | .name + " [" + .conclusion + "]\n" + (.output.summary // "")'

# with a local PHP 8.3 + Composer toolchain:
cd backend && composer install && cp .env.example .env && php artisan key:generate
php artisan test
php artisan migrate:fresh --seed --force        # local/testing only
php artisan serve --host=127.0.0.1 --port=8080  # then the smoke steps by hand

# frontend gates (node_modules is not committed)
npm ci
npm run typecheck
npm test
```

---

## Slice 4 — Organization settings (BUILT AND VERIFIED)

### 1. Provenance

Authorized by the owner on 2026-10-03 as the next unfinished backend slice, and
named by this document's own §16 as exactly that task. The contract was already
written and waiting: `src/domains/organization/apiRepository.ts` is marked
**BACKEND REQUIRED** for `GET /organization` and `PATCH /organization`, and
`ApiOrganizationRepository` was unselected by the registry only because no
endpoint existed. This slice builds the endpoint the contract describes; it does
not invent a second organization-settings architecture or a parallel rules engine.

### 2. Files added

| File | Role |
|---|---|
| `app/Domain/Organization/OrganizationPolicy.php` | `settings.read` / `settings.write` via `PermissionGate` |
| `app/Domain/Organization/OrganizationRules.php` | server copy of `src/domains/organization/rules.ts` |
| `app/Domain/Organization/OrganizationService.php` | tenant-scoped read and partial patch |
| `app/Http/Controllers/Api/V1/OrganizationController.php` | `show` / `update` |
| `app/Http/Requests/Organization/UpdateOrganizationRequest.php` | validation, incl. the stored-pair rule |
| `app/Http/Resources/OrganizationResource.php` | camelCase wire shape = TS `OrganizationSettings` |
| `database/migrations/2026_10_02_140000_add_settings_to_organizations_table.php` | the settings columns |
| `tests/Feature/OrganizationTest.php` | 24 tests |

Modified: `routes/api.php`, `app/Models/Organization.php`,
`app/Domain/Scheduling/ConflictDetector.php`, `ConflictReport.php`,
`database/seeders/DemoDatasetSeeder.php`, `database/factories/OrganizationFactory.php`,
`tests/Feature/SchedulingTest.php`.

### 3. Endpoints

`GET /organization` (`settings.read`) and `PATCH /organization` (`settings.write`).
One record, two verbs — no list, no delete, no `/organization/settings`,
`/settings/organization` or `/working-hours` alias. "Removing" a rule means
writing the default back, which `update` already does.

### 4. Request / response contracts

`{ "data": OrganizationSettings }` on both verbs, through the existing envelope.
Validation failure is `422 ORGANIZATION_INVALID` with an `error.fields` map in the
same shape the client renders (`validateOrganizationInput()` returns the same keys).
The policy runs before validation, so an unauthorized caller gets 403 and never a
422 that would describe a valid body.

### 5. Permissions

`settings.read` and `settings.write` only — both already in the shipped **23**-id
vocabulary. No `organization.read`, `organization.write`, `working_hours.read` or
`working_hours.write` was created, and no neighbouring permission was borrowed.
The shipped vocabulary gives `settings.write` to the administrator **only**; the
manager holds `settings.read`. That asymmetry is asserted by the tests.

### 6. Tenancy

The settings columns live on `organizations`, not on a side table: an academy has
exactly one set of rules and exactly one organization row, so the rules ARE the
tenant record. That keeps a single authoritative source for the academy name and
makes isolation structural — `OrganizationService` always loads
`whereKey(TenantContext::organizationId())`, so another organization's settings are
never queried, not merely filtered out. `BelongsToOrganization` cannot apply here
because this model has no `organization_id` column. `TenantContext` is unmodified.

### 7. Migrations

One additive migration on `organizations`. Every default is a value from
`DEFAULT_ORGANIZATION_SETTINGS` (types.ts), not an invented one. `closed_weekdays`
is nullable on purpose: a row predating the migration has no value, and absent
means "the shipped default [6]", never "no closed day".

### 8. Seeding

`DemoDatasetSeeder::seedOrganization()` now writes the whole record from
`data/dataset/organization.json` rather than the name alone, so the seeded academy
has the rules the dataset states instead of silently falling back to column
defaults.

### 9. Tests executed

Backend suite: **184 passed (1241 assertions), 0 failed** on `f7ca279`, CI run
`37119421685` — up from 160 passed (1114 assertions). `OrganizationTest` contributes
24 tests covering: 401 unauthenticated; `settings.read` and `settings.write` for
every role; the policy preceding validation; GET defaults; `updatedAt` stamping;
partial patch leaving untouched fields alone; out-of-bounds rules; a malformed
clock; the one-sided window patch against the stored other half; whole-window
acceptance; `closedWeekdays` bounds and membership; enum rejection; tenant
isolation both over HTTP and at the service boundary; and the derived rules
(working window, inside/outside, unreadable rule → null, closed-weekday fallback,
`schedulingRules`, gap read-back).

### 10. Conflict integration

`SESSION_OUTSIDE_WORKING_HOURS` and `SESSION_TIGHT_TURNAROUND` — the two kinds
§14.1 recorded as unevaluated for want of this slice — are now emitted by
`ConflictDetector`, as **warnings**, matching `src/domains/scheduling/conflicts.ts`.
They are appended last so no existing caller's first warning moves. Turnaround
compares every non-cancelled same-day session, not only overlapping ones, which is
what `overlappingSessions()` cannot provide.

**Deliberate behaviour change:** a booking adjacent to an existing session is still
not a hard conflict, but it is now an advisory turnaround warning (the academy's
configured gap). `SchedulingTest::test_adjacent_slot_is_not_a_conflict` therefore
sends `acknowledgeWarnings`; two new tests pin both kinds, and a third proves the
rule follows the academy's own settings by widening the window and watching the
same 22:00 booking become unremarkable.

### 11. HTTP smoke

Green on `f7ca279`: T-02 OK, PB-1 OK, PB-3 OK, Scheduling + Attendance OK, no-token
401 OK. The smoke's own session create already sends `acknowledgeWarnings: true`,
so the new warnings do not disturb it.

### 12. Governance

PB-1..PB-5 remain resolved as A and are untouched. No permission id was added.
No unrelated domain was started: no notifications, Telegram, Bale, Push, student
portal, finance or reports.

### 13. Known limitations after this slice

1. The registry still selects `LocalOrganizationRepository` in every mode. Flipping
   it to `ApiOrganizationRepository` is a frontend change that was out of this
   slice's scope, so the panels continue to read the demo store.
2. `closedWeekdays` is stored and served but still consumes nothing: `SKIP_CLOSED_DAY`
   remains unemitted (§14.4) and `isClosedWeekday` has no server caller yet. Wiring
   it into generation is a separate decision, not an oversight of this slice.
3. `cancellationGraceHours`, `maxMakeupsPerTerm` and `defaultSessionMinutes` are now
   stored authoritatively but are not yet read by any server rule — the cancellation
   window and make-up ceiling are still frontend-side.
