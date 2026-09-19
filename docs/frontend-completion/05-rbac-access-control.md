# 05 — RBAC Access Control Matrix — HIGH CRITICALITY

> Preserve vocab unless decision. Smallest permission model.

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

## Role → Permission Matrix (from permissions.ts)

| Role | Permissions |
|---|---|
| administrator | ALL 22 |
| manager | READ_ONLY_CORE (students.read, teachers.read, classes.read, schedule.read, library.read) + students.write, teachers.write, classes.write, schedule.write, attendance.read/write, finance.read, messages.read/write, library.write, reports.read, settings.read, users.read |
| teacher | READ_ONLY_CORE + attendance.read/write, messages.read/write |
| staff | READ_ONLY_CORE + students.write, schedule.write, attendance.read, messages.read/write, reports.read |
| accountant | students.read, classes.read, finance.read/write, reports.read, messages.read |

## Actor / Action / Resource / Scope / Allowed / Reason / Frontend guard / Backend enforcement

| Actor | Action | Resource | Scope | Allowed? | Reason | Frontend guard | Backend enforcement |
|---|---|---|---|---|---|---|---|
| administrator | any | any | org | yes | owns all | can() check | Must enforce server-side on every endpoint — frontend is UX only |
| manager | read | students/teachers/classes/schedule/library | org | yes | READ_ONLY_CORE | canAccessView + useCan | Server must check org_id + permission |
| manager | write | students/teachers/classes/schedule/attendance | org | yes | manager perms include write | useCan + form/dialog | Server must check |
| manager | write | finance | org | no | finance.write only accountant + admin | No control rendered | Server 403 |
| teacher | read | students | org | yes | teacher has students.read | canAccessView | Server must check — currently org-wide, not just assigned |
| teacher | write | attendance | org | yes | teacher has attendance.write | canWrite = useCan(attendance.write) && user?.id != null — no control if false (M2 rule) | Server must check recorderId + permission, roster rule |
| teacher | write | schedule (reschedule/cancel/generate) | org | no | teacher lacks schedule.write | No write control | Server 403 — currently client-side only |
| teacher | write | compensation register/schedule/complete | org | no | needs schedule.write, teacher lacks | No write control in CompensationView | Server must enforce COMPENSATION_FORBIDDEN |
| staff | write | students | org | yes | staff has students.write | can() | Server |
| staff | write | schedule | org | yes | staff has schedule.write | can() | Server |
| staff | write | attendance | org | no | staff has read only | No write control | Server 403 |
| accountant | read/write | finance | org | yes | finance perms | canAccessView finance | Server |
| accountant | read | students/classes | org | yes | accountant perms | — | Server |
| accountant | write | students | org | no | no write | No control | Server 403 |
| any | read | library | org | yes if library.read | READ_ONLY_CORE all except accountant? Actually accountant lacks library.read — so accountant cannot read library | canAccessView library | Server |
| any | write | library | org | manager/admin only | library.write only those | useCan | Server |
| any | read | messages | org | if messages.read | all except? Actually all roles have messages.read except? Check: administrator all, manager yes, teacher yes, staff yes, accountant yes — so all can read | canAccessView | Server per-user read cursor future |
| any | write | messages | org | if messages.write | manager/teacher/staff/admin — accountant read only | useCan | Server |
| any | read | settings/branding | org | if settings.read | manager/admin | canAccessView | Server |
| any | write | settings | org | if settings.write | admin only? Actually manager has settings.read not write, teacher/staff/accountant none — so only admin has settings.write | useCan | Server |
| any | manage | demo data (clear, backup, lifecycle) | device | if demo.manage | admin only | useCan demo.manage + isDemoEnvironment check | Server N/A — demo only, but backend must have org isolation |
| any | read | reports | org | if reports.read | manager/staff/accountant/admin | canAccessView | Server |

## Ownership / Scope — Current vs Desired

**Current (VERIFIED):**
- No owner field on Student/Teacher/Class — records are org-wide
- Enrollment is canonical Student↔Class edge, but does not restrict read scope — teacher sees all students, not just assigned via enrollment
- Placement links student/program, but no teacher assignment scope
- Compensation frozen student derived from roster, but no owner field — actor provenance recorded as userId in obligation, not as owner of student
- Chat unread per conversation (single-viewer demo), no per-user read cursor
- Media resolution != authorization — frontend checks resolves, backend must enforce per-object auth

**Desired for student portal (B CONTRACT NOW):**
- Student ↔ User identity linking table: user_id, student_id, relation (self/guardian)
- Scope: self = student sees own profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files where studentId = linked studentId
- Assigned = teacher sees students where Enrollment exists for class teacher teaches? Or where teacherId = class.teacherId and enrollment active? Needs decision — smallest: teacher sees students enrolled in classes they teach
- Org = manager/admin sees all within organization_id
- Ownership field? For compensation, obligation actor is provenance not authorization — permission is authorization
- File ownership: MediaAsset has no owner field — needs owner userId + organization_id for per-object auth

**Smallest permission model:**
- Keep 5 roles, 22 permissions — no new permission unless gap proven
- Add scope check pure function: `canRead(actor, resource, scope)` where scope derived from enrollment/placement/compensation roster
- Frontend guards: `useCan(permission)` + scope check via hooks (useClasses etc) — no control rendered if fails (M2 rule, not disabled)
- Backend enforcement: every endpoint must re-derive actor from token, check org_id, permission, scope — frontend is UX only (permissions.ts header)

## Users / Roles / Permissions / Ownership / Scope

- Users collection: id, name, role, permissions derived from role, active
- Roles hardcoded matrix (no custom roles yet) — simplest
- Permissions hardcoded list — no dynamic creation
- Ownership: for now enrollment-based, not user ownership of student record — needs decision if student record has owner userId
- Scope values: self (own linked student), assigned (teacher's classes' students), org (all in org)
- Read vs Write: read = list/get, write = create/update/archive/delete/record/correct/register/schedule/complete

## UI / Route / Action Guards

- Route: `viewPermissions` + `canAccessView` in App.tsx shell — unauthenticated → login, unauthorized → no nav item? Actually navGroups rendered but view outlet checks? Need to verify: routeProtection.test asserts real route case for compensation — admin reaches #/compensation, role without schedule.read refused — VERIFIED
- UI: `useCan(permission)` hook — if false, no write control rendered (not disabled) — VERIFIED attendance, compensation
- Action: submit wrappers await repo, catch apiErrorFromThrown, report danger with repo message — VERIFIED
- DemoBackedNotice: api mode disclosure for 11 domains — VERIFIED D8

## Backend Enforcement (B)

- Every endpoint must check: authentication (Sanctum cookie primary + bearer fallback per B1 decision), org_id scoping (OrganizationScope), permission via can(), scope via enrollment/placement
- Media: per-object authorization, signed expiring URLs, content-type sniffing, virus scanning — BACKEND REQUIRED documented in media/types.ts
- Chat: per-user read cursor, not single unread count — future
- Compensation: transaction with SELECT FOR UPDATE for uniqueness, roster check, actor permission re-derived from token

## Acceptance

- Matrix doc exists and matches permissions.ts
- No role id tested directly in components (only can() / canAccessView)
- Teacher without schedule.write sees no reschedule/cancel/generate controls
- Teacher sees no compensation write controls
- Accountant sees finance but not library
- Student role not in this panel (D1 deferred) — no fake boundary
- Scope pure functions unit tested (future)
- Frontend guards do not claim security — comments state UX only

## Risks

- Teacher currently sees all students org-wide — if assigned scope desired, need enrollment-based filtering — decision needed, not silently assumed
- Compensation client-side permission — server must re-derive — documented but not enforced yet
- Media resolution != auth — frontend honest about gap — D15
