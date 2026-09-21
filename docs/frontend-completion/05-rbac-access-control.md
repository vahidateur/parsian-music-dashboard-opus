# 05 — RBAC Access Control Matrix — HIGH CRITICALITY — Testable Authorization Contract

> Preserve vocab unless decision. Smallest permission model. No new permission vocabulary casually.

## Vocabulary (VERIFIED — do not rename without decision)

**ROLES (5):**
- administrator — مدیر ارشد — all permissions
- manager — مدیر آموزشگاه
- teacher — مدرس
- staff — پذیرش
- accountant — مالی

**PERMISSIONS (22):**
students.read/write, teachers.read/write, classes.read/write, schedule.read/write, attendance.read/write, finance.read/write, messages.read/write, library.read/write, reports.read, settings.read/write, users.read/write, roles.write, demo.manage

**View permissions (UX-only):**
dashboard: students.read, students: students.read, teachers: teachers.read, classes: classes.read, schedule: schedule.read, attendance: attendance.read, compensation: schedule.read (borrows), finance: finance.read, reports: reports.read, messages: messages.read, library: library.read, settings: settings.read, design-system: settings.read

**Scope values:**
- self = own linked student (student sees own profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files where studentId = linked studentId)
- assigned = teacher's classes' students via enrollment where class.teacherId = teacher's linked teacher? Or enrollment active scoped to date for class teacher teaches — smallest: teacher sees students enrolled in classes they teach
- org = manager/admin sees all within organization_id
- device = demo data clear/backup/lifecycle per-browser

## Role → Permission Matrix (from permissions.ts)

| Role | Permissions |
|---|---|
| administrator | ALL 22 |
| manager | READ_ONLY_CORE (students.read, teachers.read, classes.read, schedule.read, library.read) + students.write, teachers.write, classes.write, schedule.write, attendance.read/write, finance.read, messages.read/write, library.write, reports.read, settings.read, users.read |
| teacher | READ_ONLY_CORE + attendance.read/write, messages.read/write |
| staff | READ_ONLY_CORE + students.write, schedule.write, attendance.read, messages.read/write, reports.read |
| accountant | students.read, classes.read, finance.read/write, reports.read, messages.read |

## Testable Authorization Contract — Sensitive Capabilities

For every sensitive capability: Actor / Action / Resource / Scope / Allowed/DENIED / Reason / Frontend guard / Future backend enforcement — testable, not descriptive.

### Student Actor (Future — D1 deferred separate app, but contract now)

| # | Actor | Action | Resource | Scope | Allowed? | Reason | Frontend guard | Future backend enforcement |
|---|---|---|---|---|---|---|---|---|
| S-01 | student | read | own profile | self (studentId = linked studentId) | ALLOWED | self scope, student role has students.read self? Actually student role not in admin panel, but student portal role would have students.read self | Student portal: useCan(students.read) + scope check studentId === linkedId — no control if fails, not disabled | Server must enforce: auth token → user_id → student_id via user_student_links relation self, org_id scoping, permission students.read, scope self — 403 if not self |
| S-02 | student | read | another student's profile | org (other studentId) | DENIED | self scope only, no org-wide students.read for student role | Frontend: no control rendered, route #/portal/profile only shows self, list of students not rendered for student role, search disabled | Server: 403 — scope check fails, even if permission students.read present, scope self only — must not leak other student's PII |
| S-03 | student | read | eligible resources (levels 1..N per program) | self (placement per (student,program) — O-01 DECIDED per-program 2026-09-21) | ALLOWED | Level N => access 1..N via resolveEligibleContent owner learning/eligibility.ts, audience=students; per (student,program) independent (e.g. piano L3, vocals L1, violin L2 simultaneously); class must tie to program+level consistent with learning path; teacher may grant exceptional per-resource access outside normal level (resource-grant only, does not change level/program) | Student portal: useEligibleContent with placement per program, renders eligible cards per program, locked reason for future levels, no preview if locked, exceptional grants shown alongside normal eligibility | Server must enforce same rule: placement lookup per (student,program), reachable levels order <= current exclusive exact-only, content active, visibility != teachers; additionally enforce teacher exceptional grants (resource-level ACL, exact persistence model future decision) — 403 if requesting locked content id without normal eligibility AND without explicit teacher grant |
| S-04 | student | read | higher-level locked resources (N+1+) | self (future level in that program) | DENIED (locked UI) — **unless teacher has granted explicit exceptional access to that specific resource** | Level order > current → locked state, not not_found — UI shows locked card with reason «در سطح X باز می‌شود» + lock icon, no preview, no download; teacher-granted exceptions override per resource (resource-grant only, not level change) | Frontend: card shows lock normally, no open/download affordance; exceptionally granted resources render as accessible regardless of level (grant is per specific resource id) — M2 rule no control if forbidden | Server: 403 LOCKED response for content linked only to level order > current — 403 with reason levelName so student knows it exists but is locked; a teacher-created exceptional grant for that specific (student, resource) pair overrides and returns 200 (exact persistence of grants is a future backend decision; must be enforced in authorization policy) |

### Teacher Actor

| # | Actor | Action | Resource | Scope | Allowed? | Reason | Frontend guard | Future backend enforcement |
|---|---|---|---|---|---|---|---|---|
| T-01 | teacher | read | assigned student (enrolled in class teacher teaches) | assigned (Enrollment active scoped to date where class.teacherId = teacherId) | ALLOWED | teacher has students.read + assigned scope via enrollment → class → teacher | Frontend: Students list currently org-wide (gap) — should filter to assigned via enrollment join, but currently org-wide — T-02 ACCEPTED / ASSIGNED-ONLY decides this: filter via useClasses({teacherId}) + enrollment | Server must enforce: org_id + permission students.read + scope assigned = enrollment exists for class where teacherId = actor's linked teacherId and enrollment active — 403 if not assigned (assigned scope is the decided T-02 rule per `GOVERNANCE_CHECKPOINT.md`; the historical org-wide read is preserved only as evidence) |
| T-02 | teacher | read | unassigned student (not enrolled in any class teacher teaches) | org (other student) | **DENIED — STATUS: ACCEPTED / ASSIGNED-ONLY** (live status per [`GOVERNANCE_CHECKPOINT.md`](../engineering/GOVERNANCE_CHECKPOINT.md); reconciled 2026-09-21 — the earlier “OPEN — EVIDENCE CONFLICTING — REQUIRES EMPIRICAL RE-VERIFICATION” wording of this row is superseded and must not be reopened) — teacher student-read = **active enrollment ∩ `class.teacherId`**; `Student.teacherId` is **not** authorization; fail-closed — historical evidence preserved for the record: CURRENT OBSERVED BEHAVIOR at review time: **DENIED** (authorization contract review); HISTORICAL EVIDENCE: **ALLOWED** org-wide per earlier matrix / READ_ONLY_CORE teacher had students.read org-wide | **Decision basis:** T-02 ACCEPTED / ASSIGNED-ONLY resolved the conflicting evidences in favour of the smallest permission model — EVIDENCE 1 (DENIED, observed in authorization contract review) and EVIDENCE 2 (ALLOWED, earlier org-wide matrix READ_ONLY_CORE gave teacher students.read org-wide) are kept as history only; `src/domains/auth/scope.ts` implements assigned-only (`isAssignedStudent` / `canReadStudent`) and keeps `canReadStudentOrgWide` solely as a documented historical helper | Frontend: must hide unassigned students from the teacher (no control rendered) — assigned-only via enrollment → class → teacher; UX-only, not enforcement | Backend: **403** for an unassigned student — enforce assigned scope in query/policy (enrollment ∩ `class.teacherId`), fail-closed, inside SQL not load-then-filter (PERF) |
| T-03 | teacher | write | attendance for assigned session (session where teacher teaches and student on roster) | assigned (session teacherId = teacherId, student on roster via enrollment) | ALLOWED | teacher has attendance.write + assigned session + roster | Frontend: canWrite = useCan(attendance.write) && user?.id != null — no control if false, RegisterPanel renders, record/bulkRecord/correct awaited, provenance recorderId = user?.id, locked flag from repo derived session.status cancelled | Server must enforce: org_id + permission attendance.write + scope assigned session + roster check student on roster at session date + attendance protection (session not cancelled, no duplicate) + recorderId from token re-derived — transaction |
| T-04 | teacher | write | compensation register/schedule/complete | org | DENIED | teacher lacks schedule.write — compensation requires schedule.write per D19, teacher has attendance.write but not schedule.write | Frontend: no write control in CompensationView — canWrite = useCan(schedule.write) — teacher sees no register/schedule/complete buttons, only read | Server must enforce: COMPENSATION_FORBIDDEN 403 if actor lacks schedule.write — must re-derive actor permissions from token, not trust client — transaction SELECT FOR UPDATE for uniqueness |

### Staff Actor

| # | Actor | Action | Resource | Scope | Allowed? | Reason | Frontend guard | Future backend enforcement |
|---|---|---|---|---|---|---|---|---|
| ST-01 | staff | write | operational student/class/session actions (students.write, classes.write, schedule.write) | org | ALLOWED | staff has students.write, classes.write, schedule.write per matrix — operational secretary | Frontend: useCan(students.write) etc — form/dialog rendered, submit awaits repo, catch apiErrorFromThrown danger with repo message | Server must enforce: org_id + permission + transactional conflict enforcement for scheduling, enrollment canonical edge, no notification claim |
| ST-02 | staff | write | attendance | org | DENIED | staff has attendance.read only, not write — per matrix | Frontend: no write control — RegisterPanel no buttons if !canWrite | Server 403 |

### Manager Actor

| # | Actor | Action | Resource | Scope | Allowed? | Reason | Frontend guard | Backend enforcement |
|---|---|---|---|---|---|---|---|---|
| M-01 | manager | read/write | organization-wide operations students/teachers/classes/schedule/attendance/library (except finance.write, settings.write) | org | ALLOWED for listed perms | manager has READ_ONLY_CORE + students.write teachers.write classes.write schedule.write attendance.read/write library.write etc — org-wide | Frontend: canAccessView + useCan for writes — no control if forbidden — e.g. finance.write no control | Server must enforce org_id + permission + scope org — transaction for scheduling conflicts |
| M-02 | manager | write | finance | org | DENIED | finance.write only accountant + admin | No control rendered | Server 403 |
| M-03 | manager | write | settings/branding (org identity) | org | DENIED (read only) | manager has settings.read not write — only admin has settings.write | No write control in BrandingPanel? Actually BrandingPanel checks settings.write? Should be admin only — manager sees read only | Server 403 |

### Administrator Actor

| # | Actor | Action | Resource | Scope | Allowed? | Reason | Frontend guard | Backend enforcement |
|---|---|---|---|---|---|---|---|---|
| A-01 | administrator | any | any (including org administration users/roles/demo.manage) | org/device | ALLOWED | owns all 22 perms | can() check always true for admin, but still UX-only — frontend never claims security | Must enforce server-side on every endpoint — frontend is UX only — org_id scoping + permission + scope + per-object auth for media + transaction for scheduling/attendance/compensation + signed URLs + scanning |

### Additional Sensitive — Cross-Cutting

| # | Actor | Action | Resource | Scope | Allowed? | Reason | Frontend guard | Backend |
|---|---|---|---|---|---|---|---|---|
| X-01 | any | read | library | org | ALLOWED if library.read | READ_ONLY_CORE all except accountant lacks library.read — so accountant cannot read library | canAccessView library — accountant sees no library nav? Actually navGroups? Library requires library.read — accountant lacks — so no nav item | Server must check org_id + permission |
| X-02 | any | write | library | org | ALLOWED only manager/admin | library.write only those | useCan library.write — no control if false | Server 403 if not |
| X-03 | any | read | messages | org | ALLOWED if messages.read | all roles have messages.read — so all can read org-wide currently — gap per-user cursor future | canAccessView messages | Server per-user read cursor table user_id conversation_id last_read_message_id unread count future — currently org-wide |
| X-04 | any | write | messages | org | ALLOWED if messages.write | manager/teacher/staff/admin — accountant read only | useCan messages.write | Server per-object auth for attachments mediaId ref |
| X-05 | any | read | settings/branding | org | ALLOWED if settings.read | manager/admin | canAccessView settings | Server |
| X-06 | any | write | settings | org | ALLOWED only admin | only admin has settings.write | useCan settings.write | Server 403 |
| X-07 | any | manage | demo data clear/backup/lifecycle | device | ALLOWED only admin if demo.manage | admin only | useCan demo.manage + isDemoEnvironment check | Server N/A demo only but backend must have org isolation |
| X-08 | any | read | reports | org | ALLOWED if reports.read | manager/staff/accountant/admin | canAccessView reports | Server aggregation |
| X-09 | student (future) | read | own attendance | self | ALLOWED | self scope attendance where studentId = linked | Portal: attendance list filtered self | Server: org_id + permission attendance.read self + scope self |
| X-10 | student (future) | read | own progress pieces/assignments/events | self | ALLOWED | self scope progress where studentId = linked | Portal: progress filtered self | Server same |
| X-11 | student (future) | read | own tickets/messages/files | self | ALLOWED | self scope chat where subjectId = studentId or conversation participants include student | Portal: chat filtered self | Server per-user cursor + subjectId scope |

## Ownership / Scope — Current vs Desired

**Current (VERIFIED):**
- No owner field on Student/Teacher/Class — records org-wide
- Enrollment canonical Student↔Class edge, but does not restrict read scope — teacher sees all students org-wide currently, not just assigned via enrollment — gap closed by **T-02 ACCEPTED / ASSIGNED-ONLY** (active enrollment ∩ `class.teacherId`; per `GOVERNANCE_CHECKPOINT.md`; not O-01 — O-01 student level per-program DECIDED 2026-09-21)
- Placement key (student_id, program_id) per O-01 DECIDED — per-program level independent; teacher may grant exceptional resource-level access to specific students without changing level/program placement (resource-grant only; backend authorization enforcement required, exact persistence future decision)
- Placement links student/program, but no teacher assignment scope
- Compensation frozen student derived from roster, but no owner field — actor provenance userId in obligation, not owner of student
- Chat unread per conversation single-viewer demo, no per-user read cursor
- Media resolution != authorization — frontend checks resolves, backend must enforce per-object auth D15

**Desired for student portal (B CONTRACT NOW — REQUIRED PRODUCT CAPABILITY but implementation deferred until backend/integration layer):**
- Student ↔ User identity linking table user_student_links (user_id, student_id, relation self/guardian, verified_at)
- Scope: self = student sees own profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files where studentId = linked studentId
- Assigned = teacher sees students where Enrollment exists for class teacher teaches (class.teacherId = teacher's linked teacherId) and enrollment active scoped to date — smallest assigned scope
- Org = manager/admin sees all within organization_id
- File ownership: per-object media authorization per O-08 ACCEPT WITH CONDITIONS (`GOVERNANCE_CHECKPOINT.md`: no personal `owner_id`; tenant = `organization_id`; `uploaded_by` = provenance, not ACL; media ACL = parent + org + T-02/O-13; unreferenced media = uploader or admin) — B contract

**Smallest permission model:**
- Keep 5 roles, 22 permissions — no new permission unless gap proven with evidence and documented change — preserve vocab unless decision
- Add scope check pure function `canRead(actor, resource, scope)` where scope derived from enrollment/placement/compensation roster — testable
- Frontend guards: `useCan(permission)` + scope check via hooks — no control rendered if fails (M2 rule, not disabled)
- Backend enforcement: every endpoint must re-derive actor from token, check org_id, permission, scope — frontend UX only (permissions.ts header)

## Users / Roles / Permissions / Ownership / Scope

- Users collection: id, name, role, permissions derived from role, active
- Roles hardcoded matrix no custom roles yet — simplest
- Permissions hardcoded list no dynamic creation
- Ownership: enrollment-based, not user ownership of student record — O-08 ACCEPT WITH CONDITIONS per `GOVERNANCE_CHECKPOINT.md`: no personal `owner_id` on catalogue/academy rows; tenant = `organization_id`; `created_by` / `uploaded_by` / `recordedByUserId` = provenance, not ACL
- Scope values: self, assigned, org, device — as above
- Read vs Write: read = list/get, write = create/update/archive/delete/record/correct/register/schedule/complete

## UI / Route / Action Guards

- Route: viewPermissions + canAccessView in App.tsx shell — unauthenticated → login, unauthorized → no nav item? Actually navGroups rendered but view outlet checks? RouteProtection.test asserts real route case for compensation — admin reaches #/compensation, role without schedule.read refused — VERIFIED
- UI: useCan(permission) hook — if false, no write control rendered (not disabled) — VERIFIED attendance, compensation
- Action: submit wrappers await repo, catch apiErrorFromThrown, report danger with repo message — VERIFIED
- DemoBackedNotice: api mode disclosure for 11 domains — VERIFIED D8

## Backend Enforcement (B — REQUIRED but implementation deferred until backend/integration layer)

- Every endpoint must check: authentication Sanctum cookie primary + bearer fallback B1, org_id OrganizationScope, permission via can(), scope via enrollment/placement
- Media: per-object authorization, signed expiring URLs, content-type sniffing, virus scanning — BACKEND REQUIRED documented in media/types.ts — B contract
- Chat: per-user read cursor, not single unread count — future B
- Compensation: transaction SELECT FOR UPDATE for uniqueness, roster check, actor permission re-derived from token — B
- Student portal: self scope via user_student_links, assigned scope via enrollment join, org scope via org_id — B

## Test Plan — How to Test This Contract (No New Vocab Casually)

- Unit: can() pure, canAccessView pure, scope pure functions canRead(actor, resource, scope) with enrollment/placement fixtures — e.g. teacher assigned vs unassigned, student self vs other, eligible vs locked
- Integration: repository refusal — e.g. attachContent with mismatched programId → LINK_INVALID, compensation register without schedule.write → COMPENSATION_FORBIDDEN, attendance record student not on roster → ATTENDANCE_STUDENT_NOT_ON_ROSTER
- View: routeProtection.test — admin reaches #/compensation, role without schedule.read refused — VERIFIED, extend to student portal self vs other, teacher assigned vs unassigned, attendance write for assigned vs unassigned session, compensation write for teacher vs staff
- E2E (future backend): API returns 403 with reason for DENIED cases, 200 with data for ALLOWED, locked returns 403 LOCKED with levelName reason not 404, per-object auth for media 403 if not owner/org
- No role id tested directly in components — only can() / canAccessView / scope check — enforced by architectureBoundaries.test

## Acceptance

- Matrix doc exists and matches permissions.ts — VERIFIED
- No role id tested directly in components (only can() / canAccessView / scope) — enforced
- Teacher without schedule.write sees no reschedule/cancel/generate controls — VERIFIED
- Teacher sees no compensation write controls — VERIFIED
- Accountant sees finance but not library — VERIFIED (accountant lacks library.read)
- Student role not in this panel (D1 deferred separate app) — no fake boundary — VERIFIED, but contract for future portal now testable S-01..S-04
- Scope pure functions unit tested (future) — contract now
- Frontend guards do not claim security — comments state UX only — VERIFIED
- Testable cases S-01..S-04, T-01..T-04, ST-01..ST-02, M-01..M-03, A-01, X-01..X-11 covered — 11 required cases explicitly: student→own profile ALLOWED S-01, student→another student's profile DENIED S-02, student→eligible resources ALLOWED S-03, student→higher-level locked DENIED S-04, teacher→assigned student ALLOWED T-01, teacher→unassigned student **DENIED — T-02 ACCEPTED / ASSIGNED-ONLY per `GOVERNANCE_CHECKPOINT.md` (EVIDENCE 1 DENIED observed + EVIDENCE 2 ALLOWED historical org-wide preserved as history only)** T-02, teacher→attendance for assigned session ALLOWED T-03, teacher→compensation write DENIED T-04, staff→operational student/class/session actions ALLOWED ST-01, manager→organization-wide operations ALLOWED M-01, administrator→organization administration ALLOWED A-01 — RBAC T-02 ACCEPTED / ASSIGNED-ONLY (reconciled 2026-09-21; DENIED + ALLOWED evidences preserved as history) — NEXT ACTION exactly ONE F1
- 5-role / 22-permission vocabulary preserved unless evidence requires documented change — VERIFIED no new permission invented casually

## Risks

- Teacher currently sees all students org-wide — enrollment-based filtering is required by **T-02 ACCEPTED / ASSIGNED-ONLY** (`GOVERNANCE_CHECKPOINT.md`: active enrollment ∩ `class.teacherId`; fail-closed; do not revisit) — the formerly conflicting evidences (historical ALLOWED org-wide via READ_ONLY_CORE teacher students.read; observed DENIED per authorization contract review) are preserved as history only; the earlier “STATUS OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION” wording is superseded (O-01 student level per-program is DECIDED 2026-09-21 and is separate from T-02 teacher scope)
- Compensation client-side permission — server must re-derive — documented but not enforced yet — D19
- Media resolution != auth — frontend honest about gap — D15
- Student portal self scope requires identity linking table — O-10/O-11 ACCEPTED per `GOVERNANCE_CHECKPOINT.md` (residue OPEN: uniqueness details and linking UX) — B contract
