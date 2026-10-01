# BACKEND STATUS — Laravel API (`backend/`)

Implementation record of the first backend slice on branch `cleanup/demo-migration-lineage`
(local commits, not pushed). Phase B owner decisions PB-1..PB-5 remain **OPEN**; this slice does not
resolve any of them. Where a behavior depends on one, the server fails closed with
`403 OWNER_DECISION_REQUIRED_PB<n>` (see the PB-isolation map).

Stack: Laravel 12, Sanctum 4 (Bearer personal access tokens), SQLite for dev and tests, PHPUnit via
`php artisan test`. 122 backend feature tests pass at the end of this slice.

## Verification status — read this before trusting any number below

Every claim in this document is tagged with how it was actually established. "Previously
verified" means it was observed in the interrupted Opus 5.5 session and could not be persisted
as an artifact; "verified in this continuation" means it was re-executed and the output recorded.

| Claim | Status | How it is established |
|---|---|---|
| 122 backend tests pass | **verified in this continuation** | `.github/workflows/backend-tests.yml`, job `PHP 8.3 — Laravel test suite`, PHP 8.3, `php artisan test` → `Tests: 122 passed (915 assertions)`. Re-runnable on every push that touches `backend/`. |
| T-02 (teacher sees only their own enrolled students) | **verified in this continuation, over HTTP** | same workflow, job `HTTP smoke — T-02 / PB-1 / PB-3`. See "HTTP smoke" below. |
| PB-1 fails closed for a teacher with no `teacherId` | **verified in this continuation, over HTTP** | `403 OWNER_DECISION_REQUIRED_PB1` |
| PB-3 blocks rooms for every role, administrator included | **verified in this continuation, over HTTP** | `403 OWNER_DECISION_REQUIRED_PB3` on `GET rooms` and `GET rooms/r1` |
| Unauthenticated request → 401 | **verified in this continuation, over HTTP** | `401` on `GET students` with no token |
| All 135 PHP files parse | **verified in this continuation** | PHP 8.3 grammar parse of every `.php` file under `backend/` (the one Blade template excluded) |
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
| PB-1 teacher without `teacherId` | `App\Domain\Students\StudentAccessPolicy::teacherWithoutTeacherIdScope()` (reached from `resolveScope` / `scopeQuery` / `authorizeCreate`) | 403 `OWNER_DECISION_REQUIRED_PB1` | IMPLEMENTED-BLOCKED on students list/get/create/update/delete. Teacher WITH `teacherId` = T-02 implemented in SQL (active enrollment ∩ `classes.teacher_id`); `students.teacher_id` is never an authorization source. |
| PB-2 privileged identity | `App\Domain\Users\PrivilegedIdentityPolicy::assertAllowed()` — (a) self-edit, (b) editing another administrator, (c) assigning `administrator`, (d) email change of an administrator/manager | 403 `OWNER_DECISION_REQUIRED_PB2` | IMPLEMENTED-BLOCKED for a–d; other user writes implemented. Single `name` field and no current-password field kept (current contract, not a decision). |
| PB-3 rooms / instruments / learning / progress | `App\Domain\Rooms\RoomPolicy::authorizeRead()` / `authorizeWrite()` | 403 `OWNER_DECISION_REQUIRED_PB3` | Rooms: IMPLEMENTED-BLOCKED on all six endpoints for every role. Instruments, learning, progress: LEFT-UNIMPLEMENTED. Class validation still checks room existence/active as data integrity, not as room authorization. |
| PB-4 `useCan(...) \|\| !user` | none (frontend idiom; every server route except login requires a token → 401) | – | LEFT-UNTOUCHED |
| PB-5 notifications | none | – | LEFT-UNIMPLEMENTED (no table, no route) |

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
   organization total (org-wide) — the two outcomes PB-1 has not decided between.
4. **PB-1 and PB-3 fail closed over HTTP, not only in unit tests.** Detaching `teacher6`'s
   `teacher_id` yields `403 OWNER_DECISION_REQUIRED_PB1`; every rooms endpoint yields
   `403 OWNER_DECISION_REQUIRED_PB3` even for the administrator.

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
- `npm test` — **2648 passed / 4 failed / 18 skipped** across 204 files. The failures are
  pre-existing and unrelated to the backend; none was hidden, skipped or edited:

  | Test | Failure |
  |---|---|
  | `src/__tests__/m10Boundary.test.ts` → "makes the deferred surfaces carry their deferral instead of a read path" | `src/views/Finance.tsx` imports `@/domains/auth/AuthContext`, which the M10 boundary forbids for a deferred surface |
  | `src/views/__tests__/honestWriteCopy.test.tsx` → "in EMPTY names the academy's own data…" and "in DEMO still says plainly that the data is demo data" | the «ذخیرهٔ تغییرات» (branding save) control is not rendered for the acting role, so the test cannot find it |
  | `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx` → "saving the academy's identity never calls it demo data" | same missing save control over an EMPTY environment |

  Two further facts about this baseline, both recorded because they change how the numbers read:

  - **Flaky count.** Three full runs produced 13, 14 and 4 failures. `projectState.test.ts`
    contributed 9 or 10 of the failures in the first two runs — **purely environmental**: the sandbox
    clone was shallow, so the historical commits the gate checks were missing. After
    `git fetch --unshallow` that file is 52/52 green. The genuine pre-existing frontend failures are
    the 3–5 above.
  - **I19 did not reproduce.** `src/views/__tests__/schedulingWrites.test.tsx:1234` (extra id
    `ses_cl2_20260929_1400`) is recorded as a known pre-existing failure in
    [SESSION_HANDOFF.md](SESSION_HANDOFF.md) §8. It passed in all three runs of this continuation.
    That is not evidence it was fixed — nothing here touched it — only that it did not reproduce
    here. It stays on the record.

## Remaining work

The first backend slice — authentication, users and roles, teachers, rooms, students, classes and
enrollments — is **contract-complete** against `SESSION_HANDOFF.md` §10 and is now covered by a
re-runnable CI gate (`.github/workflows/backend-tests.yml`). Nothing in it needs rebuilding.

Still unbuilt, all of it outside this slice: scheduling, attendance, finance, reports, library,
organization settings, progress, instruments, learning, tickets, chat, files/media, notifications
(PB-5), audit events (O-18), MFA, cookie transport (O-12), Telegram/Bale/push, student portal.

All PB-1..PB-5 decisions remain with the owner. The backend implements each of them **fail-closed**
where it applies — see the PB-isolation map — and the HTTP smoke job proves that over the wire. It
does not decide any of them.
