# BACKEND STATUS — Laravel API (`backend/`)

Implementation record of the first backend slice on branch `cleanup/demo-migration-lineage`
(local commits, not pushed). Phase B owner decisions PB-1..PB-5 remain **OPEN**; this slice does not
resolve any of them. Where a behavior depends on one, the server fails closed with
`403 OWNER_DECISION_REQUIRED_PB<n>` (see the PB-isolation map).

Stack: Laravel 12, Sanctum 4 (Bearer personal access tokens), SQLite for dev and tests, PHPUnit via
`php artisan test`. 122 backend feature tests pass at the end of this slice.

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

## Remaining work

Scheduling, attendance, finance, reports, library, organization settings, progress, instruments,
learning, tickets, chat, files/media, notifications (PB-5), audit events (O-18), MFA, cookie
transport (O-12), Telegram/Bale/push, student portal. All PB-1..PB-5 decisions remain with the owner.

---

## Next recommended slice — Scheduling + Attendance (NOT YET STARTED)

Wire contracts already exist in the frontend:
- `src/domains/scheduling/apiRepository.ts` + `types.ts`
- `src/domains/attendance/apiRepository.ts` + `types.ts`

Seed data available:
- `data/dataset/scheduledSessions.json`
- `data/dataset/attendance.json`
- `data/dataset/attendanceCorrections.json`

### Scheduling endpoints (`schedule.read` / `schedule.write`)
`GET/POST/PATCH/DELETE sessions`, `POST sessions/{id}/cancel`, `POST sessions/{id}/reschedule`,
`POST sessions/generate?preview=1`, `POST sessions/check-conflicts`, `GET sessions/{id}/roster`.

### Attendance endpoints (`attendance.read` / `attendance.write`)
`GET/POST attendance`, `POST attendance/bulk`, `POST attendance/{id}/correct`,
`GET attendance/corrections`, `GET sessions/{id}/attendance`, `GET sessions/with-attendance`.

### Key constraints for the next agent
- T-02 extension: sessions/attendance teacher scope = `sessions.teacher_id = actor.teacher_id`.
- Teacher without `teacher_id` → `OwnerDecisionRequired('PB-1')` on all session and attendance endpoints.
- `recorded_by_user_id` / `changed_by_user_id` come from `$request->user()->id` only — never accepted from body.
- `attendance_corrections` is INSERT-only (append-only audit trail); no UPDATE or DELETE route or service method.
- `UNIQUE(session_id, student_id)` on `attendance_records` must be a DB constraint.
- `POST /attendance/bulk`: one `DB::transaction` — all or nothing.
- `POST /sessions/generate`: `MAX_GENERATION_DAYS = 180`, `MAX_GENERATION_SESSIONS = 500` (422 SESSION_GENERATION_WINDOW_INVALID on exceed).
- Register static routes (`/bulk`, `/corrections`, `/with-attendance`) **before** `{id}` parameterized routes (Laravel matches in registration order).
- Tests required: `SchedulingTest.php` + `AttendanceTest.php` following the pattern in `ClassesTest.php` / `EnrollmentsTest.php`.
- Original Kiro plan with full slice spec: `.agents/tasks/backend-slice/plan.md` §4 (slices 7–8 equivalent) and §8 (test checklist).

### After Scheduling + Attendance
Organization settings, library/resources, progress, finance, reports, instruments, learning,
tickets, chat, files/media, notifications (PB-5), audit events (O-18), MFA, cookie transport (O-12),
Telegram/Bale/push, student portal.
