# T-02 F2 — Owner Decision Packet

**Class/enrollment visibility, historical access, substitutes, ownership transfer, `staff`, and the financial lifecycle blocker**

**Prepared:** 2026-11-14  
**Owner resolution:** 2026-11-14  
**Status:** `OWNER DECISIONS APPROVED — STAGE 18.1 IMPLEMENTED; 18.2–18.6 PENDING`  
**Scope:** read-only source audit of the current working tree, followed by the authorized
Stage 18.1 implementation. No schema, migration, route, endpoint, role, or permission was
added. The selected options are approved policy; only Stage 18.1 is implemented.

**Owner resolution (2026-11-14).** The owner selected the following options. They supersede
the alternatives and recommendations in §5; those remain as historical preparation.

| Decision | Selected option | Status |
|---|---|---|
| T-02-B | B2 — assigned-class-only visibility | **APPROVED** |
| T-02-C | C1 — active enrollments in assigned classes only | **APPROVED** |
| T-02-D | D2 — effective-dated historical read-only access | **APPROVED** |
| T-02-E | E1 — immediate access loss on non-active enrollment | **APPROVED** |
| T-02-F | F3 — explicit substitute assignment entity | **APPROVED** |
| T-02-G | G3 — effective-dated transfer with approval and audit | **APPROVED** |
| T-02-H | H4 — retire `staff`; introduce independent Reception role | **APPROVED** |
| O-24 | Preserve invoice-only v1; no financial lifecycle expansion | **CONFIRMED** |

**Implementation status.** Stage 18.1 is implemented as of 2026-11-14: B2 class scope, C1
active enrollment scope, PB-1 closure, teacher field redaction, and permission-override
object-scope guards. Focused backend tests and the full backend suite pass; frontend
typecheck and the affected view/domain tests pass. Stages 18.2 (D2/E1 and provenance),
18.3 (F3), 18.4 (G3), 18.5 (H4/Reception), and 18.6 (final verification) remain pending.
T-02 remains **BLOCKED UNTIL IMPLEMENTATION AND VERIFICATION** of those stages.

**Relationship to T-02-A.** `T-02-A` (approved 2026-11-12) says a teacher may reach only
students assigned through **active enrollment ∩ `classes.teacher_id` = the teacher's linked
`teacher_id`**, and that the rule applies to **all** student-targeted reads and mutations,
including indirect paths. Progress and Learning enforcement landed 2026-11-13. Stage 17
finding **F2 — class/enrollment data exposure** remains open. This packet prepares the
owner decisions needed to close it.

**Authority.** Policy: [`GOVERNANCE_CHECKPOINT.md`](GOVERNANCE_CHECKPOINT.md) §T-02-A and
[`../../.opencode/specs/auth-rbac.md`](../../.opencode/specs/auth-rbac.md). Current behavior:
the source references below. This packet does not reopen T-02-A, C5, Stage 18, or any
financial decision.

---

## 1. Executive summary

F2 was a family of read paths that exposed class membership and enrollment data to every
role holding `classes.read`, including a teacher with no linked `teacher_id`. Stage 18.1
(2026-11-14) closed items 1–4 below; items 5–7 remain for Stages 18.2–18.4.

1. **Closed by Stage 18.1.** `GET /classes` and `GET /classes/{id}` were organization-wide
   and exposed `studentIds`, `enrolled`, `waitlist`, `tuition`, `attendanceAvg`, and
   `termProgress`. They are now assigned-class-only for teachers, with restricted fields
   omitted.
2. **Closed by Stage 18.1.** `GET /enrollments` and `GET /enrollments/{id}` were
   organization-wide and exposed `studentId`, `classId`, status, dates, and pricing; the
   list could be searched by student name. They are now active-only in assigned classes for
   teachers, with pricing omitted.
3. **Closed by Stage 18.1.** A teacher without a linked `teacher_id` got PB-1 on students,
   progress, learning, sessions, attendance, and compensation — but not on classes or
   enrollments. Class/enrollment now fail closed with PB-1 too.
4. **Closed by Stage 18.1.** The frontend requested org-wide class/enrollment lists; the
   backend now scopes those responses for teachers, so the browser receives only owned
   classes and active enrollments. Frontend filtering remains UX only.
5. **Pending Stage 18.2.** Session/attendance rosters are described as historical but are
   computed from **current** active enrollments. A late joiner appears on earlier sessions;
   a withdrawn student disappears from historical sessions.
6. **Pending Stage 18.4.** Class-teacher transfer is an immediate overwrite with no history.
   The old teacher loses access; the new teacher gains the active students' current
   progress/learning history.
7. **Pending Stage 18.3.** Session/attendance use the session's `teacher_id` snapshot;
   compensation uses `classes.teacher_id`. Substitute teaching therefore behaves
   differently across domains, and one compensation read path can call a session roster the
   class teacher is not allowed to read.

Stage 18.1 changed application source; see §10 for the workstream status. The owner
decisions are in §5; the approved matrix is §6; the security test matrix is §7; the
financial checklist is §8; the blockers are §9.

---

## 2. Evidence baseline and method

- Branch: `main`; HEAD `efc3949`; working tree contains the pre-existing Stage 16/17.1
  changes, the 2026-11-13 T-02 Progress/Learning changes, and the 2026-11-14 Stage 18.1
  changes. Nothing was staged, committed, reset, rebased, or stashed.
- Read-only verification run:
  `php artisan test tests/Feature/ClassesTest.php tests/Feature/EnrollmentsTest.php
  tests/Feature/StudentScopeTest.php tests/Feature/SchedulingTest.php
  tests/Feature/AttendanceTest.php tests/Feature/CompensationTest.php
  tests/Feature/InvoiceTest.php` → **119 passed, 793 assertions, 9.13s**.
- The earlier full backend suite after the T-02 Progress/Learning change:
  **481 passed, 2 skipped, 3322 assertions**.
- Stage 18.1 verification (2026-11-14): full backend suite **490 passed, 2 skipped, 3414
  assertions, 19.24s**; `npm run typecheck` **PASS**; affected frontend tests **126 passed**
  across 15 files.
- Source references use `path:line` in the current working tree. “Source-confirmed” means
  the behavior follows from the cited code; it does not mean a new runtime test was added
  in this read-only pass.
- Status vocabulary: `PASS`, `DOCUMENTED`, `PARTIAL`, `BLOCKED`, `NOT RUN`. A source
  reference is not a substitute for a test.

---

## 3. Confirmed F2 exposures

> **Historical scope.** This section records the pre-Stage-18.1 source behavior that
> motivated the decisions. Stage 18.1 (2026-11-14) closed the B2/C1 class/enrollment
> exposures, the PB-1 class/enrollment bypass, and the teacher field-redaction gaps.
> Rows about historical rosters, substitutes, and ownership transfer remain current until
> Stages 18.2–18.4.

### 3.1 Class reads

| ID | Exposure | Source reference | Current behavior |
|---|---|---|---|
| F2-01 | Class list is org-wide | `backend/app/Domain/Classes/ClassPolicy.php:8-12`, `:18-21`; `backend/app/Domain/Classes/ClassService.php:76-102` | `authorizeRead()` checks only `classes.read`. The query has no teacher/student scope. A teacher sees every class in the organization. |
| F2-02 | Class detail is org-wide | `backend/app/Domain/Classes/ClassService.php:104-109`, `:180-199`; `backend/app/Http/Controllers/Api/V1/ClassController.php:28-31` | `get()` authorizes `classes.read` and loads any same-org class by id. |
| F2-03 | Class response exposes student IDs | `backend/app/Domain/Classes/ClassService.php:58-70`; `backend/app/Http/Resources/ClassResource.php:46-48` | `withProjection()` eager-loads every active enrollment's `student_id`; `ClassResource` emits them as `studentIds`. |
| F2-04 | Class response exposes aggregate/financial data | `backend/app/Http/Resources/ClassResource.php:35-49` | Emits `enrolled`, `waitlist`, `tuition`, `attendanceAvg`, and `termProgress` to any class reader. |
| F2-05 | Class list/detail has no PB-1 guard | `backend/app/Domain/Classes/ClassPolicy.php:18-21`; `backend/tests/Feature/ClassesTest.php:74-89` | A teacher with no linked `teacher_id` still passes `classes.read`. No class test covers PB-1. |
| F2-06 | Teacher write scope is permission-only | `backend/app/Domain/Classes/ClassService.php:111-178`; `backend/app/Domain/Classes/ClassPolicy.php:23-26` | `create/update/archive/delete` check `classes.write`, not student/class ownership. The default teacher role lacks `classes.write`, but role permissions are editable (see F2-13). |

The code comment at `ClassPolicy.php:11` states the current assumption explicitly:
“Class reads are org-wide (T-02 governs student reads only).” That assumption is the
decision the owner must confirm or replace; it conflicts with T-02-A's “any other
student-targeted read … including indirect access through nested resources.”

### 3.2 Enrollment reads

| ID | Exposure | Source reference | Current behavior |
|---|---|---|---|
| F2-07 | Enrollment list is org-wide | `backend/app/Domain/Enrollments/EnrollmentPolicy.php:8-19`; `backend/app/Domain/Enrollments/EnrollmentService.php:46-79` | `EnrollmentPolicy` delegates to `ClassPolicy`, so `classes.read` is enough. The query starts at `Enrollment::query()` with no student/class scope. |
| F2-08 | Enrollment detail is org-wide | `backend/app/Domain/Enrollments/EnrollmentService.php:81-86`, `:193-201`; `backend/app/Http/Controllers/Api/V1/EnrollmentController.php:28-31` | Any same-org enrollment id is readable by any `classes.read` holder; out-of-scope is not distinguished from missing. |
| F2-09 | Enrollment response exposes identity, status, dates, and pricing | `backend/app/Http/Resources/EnrollmentResource.php:13-26` | Emits `studentId`, `classId`, `status`, `startDate`, optional `endDate`, and `pricingPlan.label` / `pricingPlan.amount`. |
| F2-10 | Enrollment list is a student-name oracle | `backend/app/Domain/Enrollments/EnrollmentService.php:60-75`; `backend/tests/Feature/EnrollmentsTest.php:310-341` | `search` matches `students.name` and `classes.title`. A teacher can test whether a name exists and receive the enrollment row (student id, class id, status, pricing). |
| F2-11 | Enrollment filters enumerate other classes/students | `backend/app/Domain/Enrollments/EnrollmentService.php:51-58`; `backend/tests/Feature/EnrollmentsTest.php:202-216` | `student_id`, `class_id`, and `status` are accepted without a scope. A teacher can enumerate a class's roster or a student's memberships. |
| F2-12 | Enrollment list/detail has no PB-1 guard | `backend/app/Domain/Enrollments/EnrollmentPolicy.php:16-19`; `backend/tests/Feature/EnrollmentsTest.php:188-200` | A teacher with no linked `teacher_id` still passes `classes.read`. The existing teacher test asserts only `200`, not scope. |
| F2-13 | Enrollment writes are permission-only | `backend/app/Domain/Enrollments/EnrollmentService.php:89-135`, `:138-170`; `backend/app/Http/Requests/Enrollments/StoreEnrollmentRequest.php:19-22`; `EnrollmentPolicy.php:21-24` | Writes check `classes.write`, not the actor's student scope. The default teacher role lacks `classes.write`, but an organization can grant it through the role editor. |

### 3.3 The PB-1 bypass

T-02/PB-1 is currently enforced in `StudentAccessPolicy` and the session/attendance/
compensation policies:

- `backend/app/Domain/Students/StudentAccessPolicy.php:52-75`, `:83-102`
- `backend/app/Domain/Scheduling/SessionPolicy.php:45-65`
- `backend/app/Domain/Attendance/AttendancePolicy.php:40-58`
- `backend/app/Domain/Compensation/CompensationService.php:271-293`

It is **not** enforced by `ClassPolicy` or `EnrollmentPolicy`. Therefore a teacher account
with `teacher_id = null` or `''` can still read classes and enrollments. This is a
source-confirmed inconsistency with the PB-1 fail-closed rule; no existing test asserts it.

### 3.4 Frontend read paths

The frontend is not an authorization boundary, but it receives whatever the backend
returns. These reads are org-wide today for a teacher because the corresponding API is
org-wide:

| ID | Path | Source reference | Consequence |
|---|---|---|---|
| F2-14 | Students view loads all classes/enrollments for client-side scope | `src/views/Students.tsx:936-946` | The browser receives all class/enrollment rows before the view narrows students. |
| F2-15 | Classes view loads all classes and enrollments | `src/views/Classes.tsx:545`, `:727` | Teacher can open the class surface and read every class/roster relation. The comment at `src/views/Classes.tsx:353-357` says teachers/accountants “can open this surface and read everything on it.” |
| F2-16 | Teacher desk loads all enrollments | `src/domains/shared/useTeacherDesk.ts:148-175` | Classes are filtered by `teacherId`, but enrollments are read whole and used to resolve the scope client-side. |
| F2-17 | Attendance/compensation/scheduling/teachers views load all classes/enrollments | `src/views/Attendance.tsx:195-198`; `src/views/Compensation.tsx:382-383`; `src/views/Scheduling.tsx:320`; `src/views/Teachers.tsx:335-336`, `:789-790` | Any teacher who opens these surfaces receives org-wide class/enrollment data from the API. |
| F2-18 | API query builders have no scope parameter | `src/domains/classes/apiRepository.ts:39-50`; `src/domains/enrollments/apiRepository.ts:43-52` | The client can only send filters; it cannot request a server-enforced teacher scope. |

### 3.5 Historical roster and attendance

| ID | Exposure / mismatch | Source reference | Current behavior |
|---|---|---|---|
| F2-19 | Session roster is current-active, not date-bounded | `backend/app/Domain/Scheduling/SessionService.php:301-341` | The docblock says a week-6 joiner must not appear on week 2 and a week-8 withdrawal must still appear on weeks 1–7, but the query filters `status = 'active'` now, with no session-date comparison. |
| F2-20 | Attendance roster has the same mismatch | `backend/app/Domain/Attendance/AttendanceService.php:191-229` | Same current-active query; the same docblock claim. |
| F2-21 | Enrollment status vocabulary is narrower than the tests | `backend/app/Models/Enrollment.php:26`; `backend/tests/Feature/SchedulingTest.php:499-516` | Canonical statuses are `active`, `waitlist`, `completed`, `cancelled`. The roster test inserts `status = 'withdrawn'`, which is outside the enum and is not writable through the enrollment API. |
| F2-22 | Withdrawal has no historical read rule | `backend/app/Domain/Enrollments/EnrollmentService.php:172-185`; `backend/tests/Feature/EnrollmentsTest.php:218-232` | `withdraw` sets `cancelled` and `end_date = today`. The teacher immediately loses student/progress/learning access; historical session/attendance visibility is not date-bounded. |

### 3.6 Substitute and ownership-transfer inconsistencies

| ID | Exposure / mismatch | Source reference | Current behavior |
|---|---|---|---|
| F2-23 | Sessions/attendance scope by session teacher | `backend/database/migrations/2026_10_01_120001_create_class_sessions_table.php:11-13`, `:43`; `SessionPolicy.php:51-65`; `AttendancePolicy.php:40-58` | `class_sessions.teacher_id` is a per-occurrence snapshot. A substitute sees the session/roster/attendance; the class teacher who did not teach that occurrence does not. |
| F2-24 | Compensation scopes by class teacher | `backend/app/Domain/Compensation/CompensationService.php:264-293` | A substitute does not see compensation for a session they covered; the class teacher sees the class's compensation regardless of who taught the occurrence. |
| F2-25 | Compensation read can call a roster the class teacher cannot read | `backend/app/Domain/Compensation/CompensationService.php:531-539`; `SessionService.php:308-311` | `readModel()` calls `SessionService::roster($viewer, ...)`; roster is scoped to `class_sessions.teacher_id`. A class teacher reading a compensation whose effective session is taught by a substitute can receive `SESSION_NOT_FOUND`. Source-confirmed; no test covers it. |
| F2-26 | Class-teacher transfer has no history | `backend/app/Domain/Classes/ClassService.php:25-42`, `:129-150`; `backend/app/Domain/Users/UserService.php:95-97` | `classes.teacher_id` and `users.teacher_id` are overwritten directly. There is no assignment-history table or audit event. The new teacher gains the active students' current progress/learning history; the old teacher loses it immediately. |

### 3.7 Role-override conditional exposure

`ClassPolicy` and `EnrollmentPolicy` authorize only permissions. The default teacher role
does not hold `classes.write`, but role permissions are editable per organization:

- `backend/app/Domain/Roles/RoleService.php:49-68`
- `backend/app/Support/Authorization/PermissionMatrix.php:93-112`
- `backend/tests/Feature/RolesTest.php:56-71` (granting `users.read` to `staff` changes an
  already-issued token's permissions)

If an owner grants `classes.write` to `teacher`, that teacher can create/update classes and
enroll any same-org student; the class/enrollment services do not apply
`StudentAccessPolicy`. This is a conditional exposure, not current default behavior. It is
a required regression test before any such grant.

### 3.8 Controls that are not exposures

- Cross-tenant isolation: `backend/app/Models/Concerns/BelongsToOrganization.php:21-37`;
  class/enrollment cross-tenant tests at `ClassesTest.php:229-244` and
  `EnrollmentsTest.php:172-185`.
- Student list/detail: `StudentAccessPolicy.php:83-102`; `StudentScopeTest.php:66-97`.
- Progress/Learning student scope: implemented 2026-11-13 (see `GOVERNANCE_CHECKPOINT.md`
  T-02-A implementation status).
- Media student photos: `backend/app/Domain/Media/MediaPolicy.php:196-207` uses
  `StudentAccessPolicy::scopeQuery`.
- Session/attendance teacher scope: `SessionPolicy.php:51-65`;
  `AttendancePolicy.php:40-58`.
- Compensation teacher class scope: `CompensationService.php:271-293`.

---

## 4. Current authorization map

| Surface | administrator | manager | accountant (Secretary) | staff | teacher (linked) | teacher (no `teacher_id`) |
|---|---|---|---|---|---|---|
| `GET /classes` | org-wide | org-wide | org-wide (`classes.read`) | org-wide (`classes.read`) | **org-wide** | **org-wide (PB-1 bypass)** |
| `GET /classes/{id}` | org-wide | org-wide | org-wide | org-wide | **org-wide** | **org-wide (PB-1 bypass)** |
| Class `studentIds` / counts / tuition | yes | yes | yes | yes | **yes** | **yes** |
| `GET /enrollments` | org-wide | org-wide | org-wide (`classes.read`) | org-wide (`classes.read`) | **org-wide** | **org-wide (PB-1 bypass)** |
| `GET /enrollments/{id}` | org-wide | org-wide | org-wide | org-wide | **org-wide** | **org-wide (PB-1 bypass)** |
| Enrollment search by student name | yes | yes | yes | yes | **yes** | **yes** |
| Enrollment write | yes | yes (`classes.write`) | no (`classes.write` absent) | no (`classes.write` absent) | no (default) | no |
| `GET /students` | org-wide | org-wide | org-wide | org-wide | assigned-only | `403 PB-1` |
| Progress/Learning | org-wide | org-wide | no domain permission | read-only / no write | assigned-only | `403 PB-1` |
| Sessions/attendance | org-wide | org-wide | no default (`schedule.read` absent) | sessions read/write; attendance read | own sessions | `403 PB-1` |
| Compensation | org-wide | org-wide | no (`schedule.read` absent) | read/write per ids | own classes | `403 PB-1` |
| Finance | read/write/pay | read/pay | read/write/pay | pay only | none | none |

“Org-wide” means the query is constrained only by tenant and permission. The table records
current source behavior, not approved policy.

---

## 5. Owner decision register entries

**Resolution note (2026-11-14).** The owner selected the options recorded at the top of
this packet. The alternatives and recommendations below are preserved as preparation
history; the selected option is the approved policy. Stage 18.1 (B2/C1/PB-1) is implemented
and tested; Stages 18.2–18.6 remain pending.

All entries are **APPROVED**. `T-02-B`/`T-02-C` are implemented; `T-02-D`..`T-02-H` are
pending their approved workstreams. Each recommendation below is historical advice, not
the current decision.

### T-02-B — Class visibility for teachers

**Owner selection (2026-11-14): B2 — assigned-class-only visibility. APPROVED; implemented Stage 18.1 (2026-11-14).**

**Question.** May a teacher read classes they do not teach, and which class fields may they
see?

**Current.** `classes.read` is the only gate. A teacher sees every class, including
`studentIds`, `enrolled`, `waitlist`, `tuition`, `attendanceAvg`, and `termProgress`
(`ClassPolicy.php:8-21`; `ClassService.php:58-102`; `ClassResource.php:35-49`).

**Alternatives.**

| Option | Description | Security implication | Data visibility |
|---|---|---|---|
| B1 | Keep class metadata org-wide; redact roster/counts/tuition/student-derived metrics for non-org-wide actors; add a scoped roster read for own classes | Closes direct student-ID and financial exposure; class catalogue remains visible | Teachers see other classes' titles/schedules/rooms/teachers but not membership or money |
| B2 | Teacher sees only classes where `classes.teacher_id = actor.teacher_id`; org-wide roles unchanged | Smallest rule consistent with T-02-A; removes cross-class context | Teachers lose other-class catalogue context; conflict checks must be a dedicated read |
| B3 | Split `classes.read` (metadata) from a new scoped roster/finance permission | Most precise; new permission ids are an owner/vocabulary decision | Can be tailored, but adds vocabulary and role-matrix work |
| B4 | Keep current behavior and explicitly accept org-wide class/roster visibility | Conflicts with T-02-A; student IDs and pricing remain exposed | Maximum operational visibility |

**Required tests.** Own vs other class list/detail; `studentIds` redaction; counts/tuition
redaction; teacher without `teacher_id`; org-wide roles; cross-tenant 404; role-override
grant.

**Recommendation.** **B2** as the security-default. If the owner confirms teachers need
other-class metadata for scheduling, use **B1** instead of B4. Rationale: class membership
is student data; B2 is the smallest rule that satisfies T-02-A and is easiest to prove.
B3 is the precise long-term model if field-level visibility is required.

### T-02-C — Enrollment visibility for teachers

**Owner selection (2026-11-14): C1 — active enrollments in assigned classes only. APPROVED; implemented Stage 18.1 (2026-11-14).**

**Question.** Which enrollment rows and fields may a teacher read?

**Current.** `EnrollmentPolicy` delegates to `ClassPolicy`; list/get are org-wide; all
statuses, dates, and pricing are returned; `search` matches student name
(`EnrollmentPolicy.php:8-19`; `EnrollmentService.php:46-86`; `EnrollmentResource.php:13-26`).

**Alternatives.**

| Option | Description | Security implication | Data visibility |
|---|---|---|---|
| C1 | Teacher sees only **active** enrollments in classes they teach; other classes/students 404 or empty; pricing redacted | Matches T-02-A exactly; closes the name oracle | No waitlist/completed/cancelled history for teachers |
| C2 | Teacher sees all enrollment statuses for their own classes, date-bounded; pricing redacted | Supports roster/history; still exposes withdrawn/completed student IDs | Own-class history only |
| C3 | Keep org-wide list but remove name search and pricing for teachers | Weak: student IDs and class edges remain | Still cross-class membership |
| C4 | Add a separate scoped enrollment-read permission/endpoint | Precise; new vocabulary/role decision | Depends on matrix |

**Required tests.** Own/other class; `student_id`, `class_id`, `status`, `search` filters;
pricing redaction; unlinked teacher PB-1; org-wide roles; cross-tenant; role-override
grant.

**Recommendation.** **C1** as the security-default. Choose C2 only if the owner approves
historical access under T-02-D/E. Rationale: active enrollment is the approved T-02
relationship; C3 leaves the main leak in place.

### T-02-D — Historical teacher access after assignment termination

**Owner selection (2026-11-14): D2 — effective-dated historical read-only access. APPROVED; implementation pending Stage 18.2 after provenance design.**

**Question.** After a student leaves a teacher's class, or a class is reassigned, may the
former teacher read historical progress, attendance, placements, and rosters?

**Current.** No historical rule. Scope is current active enrollment ∩ current
`classes.teacher_id`. Withdrawal, completion, or class transfer ends access immediately.
The new teacher gains the active student's current progress/learning history. Progress events have
no teacher provenance (`ProgressEvent.php:36-54`); attendance has
`recorded_by_user_id`; sessions have a per-occurrence `teacher_id`; piece assignments have
a provenance-only `teacher_id` (`PieceAssignment.php:34-37`, `:80-84`).

**Alternatives.**

| Option | Description | Security implication | Data visibility |
|---|---|---|---|
| D1 | Strict current scope: no historical access; new teacher sees full history | Simplest; no extra exposure; may lose legitimate handover context | Old teacher loses everything; new teacher sees everything |
| D2 | Time-bounded historical read-only for the period the teacher taught, using enrollment dates and class-teacher history | Correct but requires new history/audit schema | Old teacher sees only their period; new teacher from effective date |
| D3 | Provenance-based: teacher sees records they authored/taught (session teacher, assignment teacher, attendance recorder) | Uses existing fields; incomplete for progress events and can leak via assignment provenance | Narrow, inconsistent |
| D4 | Grace period after termination (e.g., 30/90 days) | Policy-only; needs SLA and audit; extends exposure | Temporary read-only |

**Required tests.** Old/new teacher after transfer; withdrawal/completion; historical
progress/attendance/roster; date boundaries; no access after grace period; audit event.

**Recommendation.** **D1 as interim** until the owner defines retention; **D2** if
historical access is required. Rationale: the current schema cannot prove who taught a
progress event; D2 needs a deliberate history design, not an inferred rule.

### T-02-E — Withdrawn/completed student access

**Owner selection (2026-11-14): E1 — immediate access loss on non-active enrollment. APPROVED; implementation pending Stage 18.2.**

**Question.** What happens when an enrollment becomes `waitlist`, `completed`, or
`cancelled`, and is there a `withdrawn`/`suspended`/`transferred` state?

**Current.** Canonical statuses are `active`, `waitlist`, `completed`, `cancelled`
(`Enrollment.php:26`). Only `active` grants T-02 scope. `withdraw` writes `cancelled` and
`end_date = today` (`EnrollmentService.php:172-185`). Update can set any canonical status
and an end date (`EnrollmentService.php:138-170`). No `withdrawn`, `suspended`, or
`transferred` status exists. `SchedulingTest.php:499-516` inserts `withdrawn`, outside the
enum, to test roster exclusion.

**Alternatives.**

| Option | Description | Security implication | Data visibility |
|---|---|---|---|
| E1 | Immediate loss on any non-active status (current) | Safest; no grace exposure | Teacher loses historical records immediately |
| E2 | Read-only grace period after withdrawal | Operationally friendly; needs SLA/audit | Temporary access to a former student |
| E3 | Historical read-only for the enrollment period, date-bounded | Correct with start/end dates; requires historical roster fix | Old teacher sees their period only |
| E4 | Administrative roles keep history; teacher loses immediately | Clear separation | Teacher must ask admin for history |

**Required tests.** active→waitlist/completed/cancelled; date-bounded roster; old sessions;
progress/attendance; grace-period boundaries; reject undefined statuses.

**Recommendation.** **E1 as interim**; **E3** if history is required. Do not add a
`withdrawn`/`suspended`/`transferred` status until the owner defines the vocabulary and
migration. Rationale: the current enum and tests disagree; adding a status is a product
and schema decision.

### T-02-F — Substitute teacher access

**Owner selection (2026-11-14): F3 — explicit substitute assignment entity. APPROVED; schema/permission review required before Stage 18.3.**

**Question.** What may a substitute teacher see, and what does the regular class teacher
retain?

**Current.** `class_sessions.teacher_id` is a per-occurrence snapshot
(`create_class_sessions_table.php:11-13`, `:43`). Sessions/attendance scope by that snapshot
(`SessionPolicy.php:51-65`; `AttendancePolicy.php:40-58`). Compensation scopes by
`classes.teacher_id` (`CompensationService.php:271-293`). A class teacher may not see a
substitute-taught session; a substitute may not see compensation; a compensation read can
call a roster the class teacher cannot read (F2-25).

**Alternatives.**

| Option | Description | Security implication | Data visibility |
|---|---|---|---|
| F1 | Session-teacher only (current for sessions/attendance) | Simple; inconsistent across domains | Substitute sees assigned sessions; class teacher loses them |
| F2 | Union: class teacher sees all class sessions/attendance; substitute sees assigned sessions; compensation aligned to class teacher | Better oversight; class teacher sees the substitute's roster (within their class) | Broader but bounded to the class |
| F3 | Explicit substitute assignment entity with date range and permissions; class teacher retains oversight | Correct long-term; schema/migration | Precisely bounded |
| F4 | Temporarily reassign `classes.teacher_id` | Dangerous: changes T-02 scope for all students; no history | Not recommended |

**Required tests.** Class teacher vs substitute on sessions/roster/attendance/compensation;
cross-class; PB-1; transfer/historical boundaries; compensation read for a
substitute-taught session.

**Recommendation.** **F3 long-term**; **F2 as interim** if the owner wants class-teacher
oversight. Do not use F4.

### T-02-G — Ownership transfer and reassignment

**Owner selection (2026-11-14): G3 — effective-dated transfer with approval and audit. APPROVED; implementation pending Stage 18.4 after history design.**

**Question.** How is a class or teacher-student assignment transferred, and what history is
kept?

**Current.** `classes.teacher_id` and `users.teacher_id` are mutable fields with no history
or audit (`ClassService.php:25-42`, `:129-150`; `UserService.php:95-97`). A class update
immediately transfers scope for all active students. The new teacher sees the active
students' full progress/learning; the old teacher loses it. There is no effective date,
approval, or audit event.

**Alternatives.**

| Option | Description | Security implication | Data visibility |
|---|---|---|---|
| G1 | Immediate transfer (current) | Simple; accidental change is destructive; no accountability | New teacher sees all; old teacher none |
| G2 | Effective-dated transfer with history; old teacher historical read-only to the effective date; new from the date | Correct; needs schema | Time-bounded |
| G3 | G2 plus approval/audit event and handover checklist | Strongest accountability; more process | Time-bounded + audit |
| G4 | Freeze transfer until admin confirms | Safe but operationally heavy | Controlled |

**Required tests.** Transfer date; old/new teacher scopes; progress/learning/attendance/
roster; audit event; rollback; accidental-change refusal.

**Recommendation.** **G3** if transfers are a real workflow; **G1 only as interim** with an
explicit warning. Rationale: the current model cannot reconstruct who taught when.

### T-02-H — `staff` role purpose and permissions

**Owner selection (2026-11-14): H4 — retire `staff`; introduce an independent Reception role. APPROVED; permission matrix and migration review required before Stage 18.5.**

**Question.** What job is `staff` (label «پذیرش» / reception) supposed to perform, and
which permissions follow?

**Current.** `config/permissions.php:175-187` and `src/domains/auth/permissions.ts:182-194`:
read-only core + `students.write`, `schedule.write`, `attendance.read`, `messages.read`,
`messages.write`, `reports.read`, `finance.pay`, `gallery.details`. No `classes.write`, no
`finance.read`, no `attendance.write`, no `users.write`/`roles.write`/`settings.write`.
Label/scope: `config/permissions.php:206-220`; `roleRepository.ts:42-46`.

**Consequences of the current mix.**

- Can create/edit students but cannot enroll them: enrollment write requires
  `classes.write` (`EnrollmentPolicy.php:21-24`), which `staff` lacks.
- Can create/update sessions and compensations (`schedule.write`) but cannot manage
  classes/enrollments.
- Can pay an invoice by id (`finance.pay`) but cannot list/read invoices (`finance.read`).
- Can read attendance but not record it (`attendance.read` only).
- Has `reports.read` and `students.write`, so it can read reports and write any same-org
  student.
- Is **not** the Secretary; the current `accountant` role is (O-21). Do not rename or merge
  based on the old assumption.

**Alternatives.**

| Option | Description | Security implication | Data visibility |
|---|---|---|---|
| H1 | Reception/desk operational: add `classes.write`, `attendance.write`, `finance.read`; keep `students.write`, `schedule.write`, `finance.pay`, messages; no `finance.write`/role admin | Coherent desk role; broad student write remains explicit | Can register, enroll, schedule, record attendance, read/pay invoices |
| H2 | Front-desk least privilege: `students.read`, `schedule.read`, `attendance.read`, `finance.read`/`pay`, messages; no writes | Smallest exposure; may not match desk duties | Read/take payment only |
| H3 | Secretary-lite: mirror current `accountant` + operational writes (`students.write`, `classes.write`, `schedule.write`) without `finance.write` | Overlaps Secretary; role confusion; coordinate O-21 | Broad |
| H4 | Retire `staff` or split into a new Reception role | Requires role migration/user reassignment/audit | Depends on new matrix |

**Required tests.** Each permission boundary; enrollment write; invoice list/pay; attendance
record; reports; role-admin denial; teacher-vs-staff student scope.

**Recommendation.** **H1 if `staff` is reception**, **H2 if it is payment-only**. Rationale:
the label/scope says students/scheduling/messages, but the current permissions cannot
enroll; the owner must choose the job rather than infer it from the label. Any permission
change is a separate approved implementation change.

### O-24 — Financial transaction lifecycle and audit

**Owner selection (2026-11-14): preserve invoice-only v1; no financial lifecycle expansion. CONFIRMED; §8 remains a future decision checklist.**

**Question.** What financial lifecycle, correction model, audit history, and ledger does
the academy require beyond invoice v1?

**Current.** Invoice-only: `due` → `paid` by exactly one accepted payment; no partial
payments, refunds, voids, corrections, transaction ledger, or `audit_events`
(`Invoice.php:14-17`, `:37-40`; `InvoiceService.php:18-20`, `:120-152`;
`create_invoices_table.php:11-30`; `add_payment_details_to_invoices_table.php:11-18`).
`O-18` audit logging is **NOT IMPLEMENTED** (`docs/security.md:291`;
`GOVERNANCE_CHECKPOINT.md:308-310`). See §8 for the checklist.

**Recommendation.** Keep v1 invoice-only. Do not add refund/void/correction/ledger
endpoints, permissions, or migrations until the owner answers §8. Rationale: the current
schema has no payment entity or audit store; inventing one would create unverifiable
financial history.

---

## 6. Approved authorization target matrix (Stage 18.1 class/enrollment rows implemented)

This is the **approved target** under B2, C1, D2, E1, F3, G3, and H4. The B2/C1
class/enrollment rows and the PB-1/redaction guards are implemented as of 2026-11-14; the
historical, substitute, transfer, and Reception rows remain pending. The Reception column
is intentionally **pending**: H4 requires an independently reviewed permission matrix
before implementation, and no financial permission follows from the role name.

| Surface | administrator | manager | accountant (Secretary) | Reception (H4; matrix pending) | teacher (linked) | teacher (no link) |
|---|---|---|---|---|---|---|
| Class metadata (title, teacher, room, schedule, capacity) | org-wide | org-wide | org-wide read | pending | own classes only | `403 PB-1` |
| Class roster / `studentIds` / enrollment counts | org-wide | org-wide | org-wide read | pending | own classes, active students only | `403 PB-1` |
| Class student-derived metrics (`attendanceAvg`, `termProgress`) | org-wide | org-wide read | org-wide read | pending | redacted | `403 PB-1` |
| Class tuition / enrollment pricing | org-wide | org-wide read | org-wide read | pending; no automatic finance permission | redacted | `403 PB-1` |
| Enrollment list/detail | org-wide | org-wide | org-wide read | pending | own classes, active only | `403 PB-1` |
| Enrollment write | yes | yes | owner decision (O-21 gap) | pending | no | no |
| Student list/detail | org-wide | org-wide | org-wide | pending; subject to student policy | assigned-only | `403 PB-1` |
| Sessions/attendance | org-wide | org-wide | no default | pending | own sessions; F3 substitute only where explicitly assigned | `403 PB-1` |
| Compensation | org-wide | org-wide | no default | pending | own classes; F3 substitute gets no automatic compensation | `403 PB-1` |
| Finance read/issue/pay | read/write/pay | read/pay | read/write/pay | pending; no automatic finance permission | none | none |
| Current class ownership | org-wide | org-wide | org-wide read | pending | own classes only (B2) | `403 PB-1` |
| Historical educational records | org-wide | org-wide | org-wide | pending | D2 separate effective-dated read-only path; only while enrollment active (E1) | `403 PB-1` |
| Ownership transfer | G3 approval/audit | G3 approval/audit | per approved matrix | pending | no ordinary class update | no |

Cross-tenant remains **404** for every row. Frontend filtering remains UX only. A
substitute assignment (F3) never becomes class ownership; a transfer (G3) never silently
grants pre-transfer history.

---

## 7. Security test matrix

The matrix separates the **pre-Stage-18.1 source behavior** from the **approved target**.
“PASS (Stage 18.1)” means the target is implemented and covered by the Stage 18.1 tests.
“Pending Stage 18.x” means the decision is approved but the test cannot pass until that
workstream lands. “Current PASS” already follows from an existing test that remains valid.

| ID | Actor | Request | Before Stage 18.1 | Approved target | Status |
|---|---|---|---|---|---|
| T02-F2-01 | Teacher T1 | `GET /classes` | `200`, all classes | B2: only T1 classes | **PASS (Stage 18.1)** |
| T02-F2-02 | Teacher T1 | `GET /classes/{C1}` (T1 class) | `200` | `200`; roster only active C1 students | **PASS (Stage 18.1)** |
| T02-F2-03 | Teacher T1 | `GET /classes/{C2}` (T2 class) | `200` | `404` | **PASS (Stage 18.1)** |
| T02-F2-04 | Teacher T1 | `GET /classes` and inspect `studentIds` | Contains other classes' active student IDs | Own-class active IDs only | **PASS (Stage 18.1)** |
| T02-F2-05 | Teacher T1 | `GET /enrollments` | `200`, all enrollments | C1: own-class active only | **PASS (Stage 18.1)** |
| T02-F2-06 | Teacher T1 | `GET /enrollments/{E2}` (C2) | `200` | `404` | **PASS (Stage 18.1)** |
| T02-F2-07 | Teacher T1 | `GET /enrollments?search=<student in C2>` | Returns E2 | Empty or `404` | **PASS (Stage 18.1)** |
| T02-F2-08 | Teacher T1 | `GET /enrollments?student_id=S2` | Returns S2's rows | Empty | **PASS (Stage 18.1)** |
| T02-F2-09 | Teacher T1 | `GET /enrollments?class_id=C2` | Returns C2 rows | Empty | **PASS (Stage 18.1)** |
| T02-F2-10 | Teacher T1 | `GET /enrollments` and inspect `pricingPlan` | Pricing visible | Redacted for teacher | **PASS (Stage 18.1)** |
| T02-F2-11 | Teacher no `teacher_id` | `GET /classes`, `GET /enrollments` | `200` (PB-1 bypass) | `403 OWNER_DECISION_REQUIRED_PB1` | **PASS (Stage 18.1)** |
| T02-F2-12 | Teacher no `teacher_id` | `GET /students`, `/progress-events`, `/learning/placements`, `/sessions`, `/attendance`, `/compensations` | `403 PB-1` | `403 PB-1` | Current PASS |
| T02-F2-13 | Administrator / manager / accountant | `GET /classes`, `GET /enrollments` | `200` | `200` | Current PASS |
| T02-F2-14 | Any actor | Cross-tenant class/enrollment id | `404` | `404` | Current PASS |
| T02-F2-15 | Teacher T1 | `GET /sessions/{S2}/roster` (T2 session) | `404` | `404` | Current PASS |
| T02-F2-16 | Teacher T1 | `GET /sessions/{S1}/roster` (T1 session) | `200`, current active C1 students | `200`, date-bounded C1 roster | Pending Stage 18.2 |
| T02-F2-17 | Teacher T1 | `GET /attendance?session_id=S2` | Empty (scoped) | Empty | Current PASS |
| T02-F2-18 | Teacher T1 | `POST /attendance` for S2 | `404 ATTENDANCE_SESSION_NOT_FOUND` | `404` | Current PASS |
| T02-F2-19 | Teacher T1 | `GET /compensations` | Only C1 | Own classes; F3 substitute only where assigned | Current PASS for class scope; substitute pending 18.3 |
| T02-F2-20 | Teacher T1 | `GET /compensations/{C2 compensation}` | `404` | `404` | Current PASS |
| T02-F2-21 | Teacher T1 granted `classes.write` | `POST /classes`, `POST /enrollments` for S2 | Would succeed | Object scope must still deny/scope | **PASS (Stage 18.1)** |
| T02-F2-22 | Teacher T_old after transfer to T_new | Student/progress/learning reads | Old `404`; new `200` | D2 historical read-only while enrollment active; G3 new from effective date | Pending Stage 18.2/18.4 |
| T02-F2-23 | Substitute T_sub | Session S1 roster/attendance; compensation | Sees S1 roster/attendance; no compensation | F3 explicit substitute assignment only | Pending Stage 18.3 |
| T02-F2-24 | Class teacher T1 | Compensation for substitute-taught S1 | May `404` from roster call | Must not 404; F3 resolves the scope mismatch | **Current defect — Stage 18.3** |
| T02-F2-25 | Withdrawn student S1 | Teacher student/progress/learning reads; historical roster | Student reads `404`; old rosters drop S1 | E1 immediate loss; D2 only while enrollment active | Pending Stage 18.2 |
| T02-F2-26 | Student joins after session date | `GET /sessions/{S_old}/roster` | Student appears (current active) | Student must not appear | **Current defect — Stage 18.2** |
| T02-F2-27 | Student withdraws after session date | `GET /sessions/{S_old}/roster` | Student disappears (current active) | Student must still appear while the historical rule permits it | **Current defect — Stage 18.2** |
| T02-F2-28 | Teacher T1 granted `schedule.write` | `POST /sessions`, `check-conflicts`, `generate` with C2 | Would reach C2 | `422 SESSION_CLASS_NOT_FOUND` | **PASS (Stage 18.1)** |

**Test-writing order.** Stage 18.1 adds the B2/C1/PB-1/role-override tests first. Stage
18.2 adds the historical/date-boundary tests. Stage 18.3 adds substitute tests. Stage 18.4
adds transfer/approval/audit tests. Stage 18.5 adds Reception role-boundary tests. Do not
weaken existing tests to make a new scope pass.

---

## 8. Financial domain decision checklist (O-24)

Current state: invoice-only, one accepted payment, no refunds/voids/corrections, no
`audit_events`, no ledger. **Owner resolution (2026-11-14): preserve invoice-only v1; no
financial lifecycle expansion.** This checklist is preserved for any future financial
domain decision; it is not an implementation authorization. No financial functionality is
implemented or authorized.

### 8.1 Payment acceptance

| Decision | Current source | Why it blocks |
|---|---|---|
| Accepted channels/methods | `Invoice::PAY_METHODS = ['pos','transfer']` (`Invoice.php:39-40`); `PayInvoiceRequest.php:28-34` | Are these the only methods? Cash? Gateway? Cheque? |
| Who may accept | `finance.pay` holders: administrator, manager, accountant, staff (`config/permissions.php:125-203`; `InvoiceTest.php:87-109`) | Is reception allowed to confirm? Is manager oversight? |
| Verification/reference | `paid_reference` optional, max 64 (`PayInvoiceRequest.php:32-34`) | Is a transfer reference mandatory? Who verifies it? |
| Idempotency/duplicate payment | `pay` refuses a second payment with `INVOICE_ALREADY_PAID` (`InvoiceService.php:120-152`) | What about retries, duplicate gateway callbacks, same reference? |
| Partial/over/underpayment | Explicitly out of v1 (`Invoice.php:14-17`; `DECISIONS.md:3109-3117`) | Is partial payment required? What is the balance model? |
| Currency/precision | Amount is integer toman, `unsignedBigInteger` (`create_invoices_table.php:18-20`; `types.ts:1-7`) | Is toman the only currency? Rounding? |
| Payment date vs recorded date | `paid_at = now()` (`InvoiceService.php:130-134`) | Can a payment be back-dated or corrected? |
| Receipt/numbering | No receipt number; invoice id only | Is a receipt number/sequence required? |
| Failed/chargeback handling | No model | What states and evidence are required? |

### 8.2 Refunds

| Decision | Current source | Why it blocks |
|---|---|---|
| Full vs partial refund | No refund entity or route (`routes/api.php:181-185`) | Refund amount/remaining balance? |
| Reason/approval | None | Who approves? Is a reason mandatory? |
| Method | Only `paid_method` on the invoice | Refund to original method? Cash? Transfer? |
| Linkage | No payment entity; only `paid_at`/`paid_by_user_id` | Which payment is refunded? Multiple refunds? |
| Student balance | Paying never touches `students.deferred.balance` (`Invoice.php:14-17`) | Does a refund adjust balance? |
| Permissions | No refund permission | New id? Reuse `finance.write`/`finance.pay`? |
| Reporting/audit | No refund history | How is it reported and audited? |

### 8.3 Voids and corrections

| Decision | Current source | Why it blocks |
|---|---|---|
| Void before payment | Due invoice can be edited; no void route (`InvoiceService.php:92-118`) | Delete, cancel, or void? Who may? |
| Void after payment | Paid invoice is immutable (`InvoiceService.php:147-152`; `InvoiceTest.php:216-234`) | Reversal entry? Refund? Credit note? |
| Edit vs reversal | Due invoice fields editable in place; no audit | Is in-place edit acceptable, or must every change append a correction? |
| Approval | `finance.write` only | Does a void need a second approver? |
| Audit | No `audit_events` | Who changed what, before/after, when? |
| Delete prohibition | No delete route | Must financial rows be undeletable? |

### 8.4 Invoice state transitions

| Decision | Current source | Why it blocks |
|---|---|---|
| State set | `Invoice::STATUSES = ['due','paid']` (`Invoice.php:37`) | Are `draft`, `issued`, `partially_paid`, `void`, `refunded`, `overdue` needed? |
| Overdue | Display badge only (`DECISIONS.md:3182-3185`) | Is overdue persisted or derived? Does it gate anything? |
| Reopen/cancel | None | Can a paid invoice be reopened? A due invoice cancelled? |
| Due-date changes | Allowed while due (`UpdateInvoiceRequest.php:22-31`) | Is a due-date change a correction event? |
| Instalments | Explicitly out (`DECISIONS.md:3109-3117`) | Are instalments required? |
| Student transfer | `studentId` editable while due (`InvoiceService.php:101-104`) | Does transfer rewrite history? |
| Numbering | No invoice number | Is a legal/sequence number required? |

### 8.5 Audit events

| Decision | Current source | Why it blocks |
|---|---|---|
| Event taxonomy | No `audit_events`; `O-18` not implemented (`docs/security.md:291`; `GOVERNANCE_CHECKPOINT.md:308-310`) | Which financial actions are audited? |
| Actor/provenance | `paid_by_user_id` only; no actor on edits | Who issued/edited/voided/refunded? |
| Before/after | No history | What payload is retained without PII? |
| Immutability | No append-only store | How is tamper evidence provided? |
| Retention/access | `O-19` open | Who may read the audit? For how long? |
| Export | No audit export | Is export required? |
| Separation | `O-18` says audit ≠ domain history | Which events belong to audit vs invoice history? |

### 8.6 Ledger requirements

| Decision | Current source | Why it blocks |
|---|---|---|
| Payment entity | Invoice row carries payment fields; no `payments` table | One payment per invoice only; multiple/partial payments need a payment row. |
| Ledger model | No ledger table | Single-entry vs double-entry? What accounts? |
| Balances | `students.deferred.balance` is not updated (`Invoice.php:14-17`) | Derived or stored? How reconciled? |
| Reconciliation | None | Bank/POS reconciliation? Opening balances? |
| Reversals | No reversal entries | How are refunds/voids represented? |
| Period close | None | Are periods closed? Can prior periods change? |
| Migration | Existing invoices have `paid_at`/`paid_by_user_id` but no payment id | How are existing rows migrated without inventing history? |
| Reporting | No reports domain (`src/domains/finance/README.md:3,15`) | What reports are required? |

### 8.7 Permissions and role matrix

Current ids: `finance.read`, `finance.write`, `finance.pay`
(`config/permissions.php:15-16`; `InvoicePolicy.php:12-25`). No refund/void/audit id
exists. Any proposed id is a proposal, not vocabulary. Owner must decide:

- Who may issue, edit, pay, refund, void, correct, and view audit?
- Are refunds/voids a separate permission or a verb on `finance.write`/`finance.pay`?
- Does the current Secretary (`accountant`) retain all financial verbs after O-22?
- Does `staff` keep `finance.pay` if it cannot read invoices? (See T-02-H.)

### 8.8 Recommended financial position

Keep the shipped invoice-only v1. Do not add a refund/void/correction/ledger endpoint,
permission, migration, or audit table until §8.1–8.7 are answered. The current model can
prove “this invoice was paid once by this actor at this time”; it cannot prove a lifecycle,
a correction history, or a ledger balance. Implementing those now would invent financial
semantics, which the project’s honesty rules forbid.

---

## 9. Blockers preventing T-02 completion

1. **Stages 18.2–18.5 are not implemented.** Stage 18.1 (B2/C1/PB-1/redaction/
   role-override guards) is implemented and tested; the historical, substitute, transfer,
   and Reception workstreams remain pending.
2. **D2/E1 provenance and history are not designed.** The current model cannot prove who
   was responsible for a student/class at a past time, and progress events lack teacher
   provenance. Do not infer history from the current `classes.teacher_id`.
3. **F3 substitute entity and permissions are not reviewed.** The entity schema, status
   lifecycle, and permission vocabulary need design approval before migrations.
4. **G3 transfer history/approval/audit are not designed.** Effective-dated ownership,
   rejection/cancellation, and audit references need a schema and workflow decision.
5. **H4 Reception matrix and migration are not designed.** `staff` remains active; no
   independent Reception permission matrix or user-reassignment strategy exists yet.
6. **Frontend broad list requests are server-scoped for teachers.** The views still issue
   broad class/enrollment list calls, but the Stage 18.1 backend returns only the teacher's
   own classes and active enrollments. No alternative org-wide teacher path was found;
   keep this under regression review.
7. **Test gaps.** Stage 18.1 tests cover class/enrollment scope, PB-1, redaction, and
   role-override denial. Historical-roster, substitute, transfer-boundary, and Reception
   tests remain for Stages 18.2–18.5.
8. **C5 remains `INVESTIGATE`.** This packet does not resolve client-side revocation/SLA.
9. **Stage 18.6 verification is not run.** Full suite (backend Stage 18.1 passes),
   MySQL row-lock concurrency, composition builds, and browser/runtime QA remain
   outstanding.
10. **O-24 financial expansion remains closed.** The owner confirmed invoice-only v1; any
    refund/void/correction/ledger/audit work needs a separate financial domain decision.

T-02 remains **BLOCKED UNTIL IMPLEMENTATION AND VERIFICATION**.

---

## 10. Implementation workstreams (approved sequence)

| Stage | Scope | Status | Gate |
|---|---|---|---|
| 18.1 | Immediate F2 authorization: B2, C1, PB-1 closure, pricing redaction, role-override object scope, frontend repositories/views | **IMPLEMENTED 2026-11-14** | Focused backend tests, full backend suite (490 passed, 2 skipped, 3414 assertions), frontend typecheck (all three profiles), affected frontend tests (126 passed) |
| 18.2 | Historical access: D2/E1, effective-dated responsibility history, Progress/Learning provenance, date-bounded rosters | **DESIGN REQUIRED** | Provenance/history design review before migrations |
| 18.3 | Substitute assignment: F3 entity, policy, session/attendance/compensation consistency | **DESIGN REQUIRED** | Entity schema and permission vocabulary review |
| 18.4 | Ownership transfer: G3 approval, effective-dated history, audit, cancellation/rollback | **DESIGN REQUIRED** | History/audit design review |
| 18.5 | Reception role: H4 inventory, independent matrix, safe migration/reassignment, Accountant separation | **DESIGN REQUIRED** | Reception matrix review before implementation |
| 18.6 | Final verification: full suite, cross-tenant/cross-teacher/historical/substitute/transfer/role-override, MySQL row-lock concurrency, frontend typecheck/builds, browser QA | **NOT STARTED** | All gates pass; governance matches source |

Stage 18.1 is the only workstream that does not require a new domain schema. The later
stages must not start implementation before their design review.

---

## 11. Source reference index

**F2 — classes/enrollments**

- `backend/app/Domain/Classes/ClassPolicy.php:8-26`
- `backend/app/Domain/Classes/ClassService.php:25-42`, `:58-70`, `:76-109`, `:129-150`, `:180-199`
- `backend/app/Http/Controllers/Api/V1/ClassController.php:21-31`
- `backend/app/Http/Resources/ClassResource.php:35-49`
- `backend/app/Domain/Enrollments/EnrollmentPolicy.php:8-24`
- `backend/app/Domain/Enrollments/EnrollmentService.php:46-86`, `:89-135`, `:138-191`
- `backend/app/Http/Controllers/Api/V1/EnrollmentController.php:21-31`
- `backend/app/Http/Resources/EnrollmentResource.php:13-26`
- `backend/routes/api.php:223-235`
- `backend/tests/Feature/ClassesTest.php:74-89`, `:126-141`, `:246-252`
- `backend/tests/Feature/EnrollmentsTest.php:188-200`, `:202-216`, `:310-341`, `:377-403`
- `backend/tests/Feature/StudentScopeTest.php:66-97`, `:129-146`, `:169-174`

**F2 — PB-1 and teacher scope**

- `backend/app/Domain/Students/StudentAccessPolicy.php:52-75`, `:83-102`
- `backend/app/Domain/Scheduling/SessionPolicy.php:45-65`
- `backend/app/Domain/Attendance/AttendancePolicy.php:40-58`
- `backend/app/Domain/Compensation/CompensationService.php:271-293`
- `backend/tests/Feature/SchedulingTest.php:118-130`, `:208-223`
- `backend/tests/Feature/AttendanceTest.php:116-146`
- `backend/tests/Feature/CompensationTest.php:201-211`

**F2 — historical/substitute/transfer**

- `backend/database/migrations/2026_09_30_230004_create_classes_table.php:21-22`
- `backend/database/migrations/2026_09_30_230005_create_enrollments_table.php:16-40`
- `backend/database/migrations/2026_10_01_120001_create_class_sessions_table.php:11-13`, `:43`
- `backend/database/migrations/2026_09_30_230003_create_students_table.php:10-11`, `:23`
- `backend/database/migrations/0001_01_01_000000_create_users_table.php:24-29`
- `backend/app/Models/Enrollment.php:26`
- `backend/app/Models/Student.php:10-13`
- `backend/app/Domain/Scheduling/SessionService.php:301-341`
- `backend/app/Domain/Attendance/AttendanceService.php:191-229`
- `backend/app/Domain/Compensation/CompensationService.php:264-293`, `:531-539`
- `backend/tests/Feature/SchedulingTest.php:499-516`
- `backend/tests/Feature/EnrollmentsTest.php:218-232`

**F2 — frontend reads**

- `src/views/Students.tsx:936-946`
- `src/views/Classes.tsx:353-357`, `:545`, `:727`
- `src/domains/shared/useTeacherDesk.ts:148-175`
- `src/views/Attendance.tsx:195-198`
- `src/views/Compensation.tsx:382-383`
- `src/views/Scheduling.tsx:320`
- `src/views/Teachers.tsx:335-336`, `:789-790`
- `src/domains/classes/apiRepository.ts:39-50`
- `src/domains/enrollments/apiRepository.ts:43-52`
- `src/domains/auth/scope.ts:20-23`, `:150-162`

**Role/staff**

- `backend/config/permissions.php:123`, `:161-203`, `:206-220`
- `src/domains/auth/permissions.ts:86-92`, `:169-210`
- `src/domains/auth/roleRepository.ts:42-46`
- `backend/app/Domain/Roles/RoleService.php:49-68`
- `backend/app/Support/Authorization/PermissionMatrix.php:93-112`
- `backend/tests/Feature/RolesTest.php:56-71`

**Financial**

- `backend/app/Models/Invoice.php:14-17`, `:37-40`, `:48-52`
- `backend/app/Domain/Finance/InvoicePolicy.php:12-25`
- `backend/app/Domain/Finance/InvoiceRules.php:15-27`
- `backend/app/Domain/Finance/InvoiceService.php:18-20`, `:36-58`, `:69-89`, `:92-118`, `:120-152`, `:163-184`
- `backend/app/Http/Controllers/Api/V1/InvoiceController.php:29-82`
- `backend/app/Http/Requests/Finance/StoreInvoiceRequest.php:25-36`
- `backend/app/Http/Requests/Finance/UpdateInvoiceRequest.php:22-31`
- `backend/app/Http/Requests/Finance/PayInvoiceRequest.php:28-34`
- `backend/routes/api.php:176-185`
- `backend/database/migrations/2026_10_29_000000_create_invoices_table.php:11-30`
- `backend/database/migrations/2026_10_30_000000_add_payment_details_to_invoices_table.php:11-18`
- `backend/tests/Feature/InvoiceTest.php:50-109`, `:183-234`
- `docs/security.md:262-264`, `:291`
- `docs/engineering/DECISIONS.md:3109-3146`, `:3148-3185`
- `docs/engineering/GOVERNANCE_CHECKPOINT.md:308-310`
- `src/domains/finance/README.md:3,15`
- `src/domains/finance/types.ts:1-14`

---

## 12. What this packet does not do

- It records the owner-selected options and the Stage 18.1 implementation. It does not
  implement Stages 18.2–18.6: historical access/provenance, substitute assignment,
  ownership transfer/audit, Reception role, or final verification. It does not change a
  role/default/permission, add a migration, add an endpoint, or implement a financial
  feature.
- It does not reopen T-02-A, PB-1, C5, O-21..O-23, or Stage 18.
- It does not claim browser/runtime verification. The focused backend suite and affected
  frontend tests above are the execution evidence for Stage 18.1.
