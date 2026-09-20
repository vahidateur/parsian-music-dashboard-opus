# F7 — Student Portal — READ-ONLY INVENTORY

> Branch `arena/frontend-completion-spec` HEAD `35802cf` F6 VERIFIED CLOSED PR #4 OPEN UNMERGED. No file modifications during inventory.

## 1. F7 Goal (canonical from 11-roadmap.md)

Student portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity

## 2. Domains / Slices

- students, classes, enrollments, scheduling, learning/eligibility, progress, attendance, chat, media, auth, export
- auth/scope.ts: Actor userId/role/permissions/teacherId/studentId, StudentRef/ClassRef/EnrollmentRef/SessionRef/AttendanceRecordRef, isAssignedStudent, assignedStudentIdsForTeacher, isSelfStudent, canReadStudentOrgWide, canReadStudent, canWriteStudent, canReadTeacher, canWriteAttendance, canReadAttendance, canWriteCompensation, canReadCompensation, canReadSchedule, canWriteSchedule, canExport, isEligibleLevel
- auth/permissions.ts: 5 roles 22 perms, rolePermissions matrix, viewPermissions, can(), D1 student role not in admin panel
- learning/eligibility.ts: resolveEligibleContent pure Level N=>1..N cumulative exclusive exact-only, per-program provisional O-01 OPEN, visibility students/teachers
- students/types, classes, enrollments, scheduling, progress, attendance, chat/types, media/types
- Docs: 10-integration-architecture.md Student Portal Architecture section, 12-decision-register D1 + NEW-PORTAL-01, 13-open-decisions O-01 O-10 O-13 O-14, 05-rbac-access-control, 03-domain-map

Slices per 11-roadmap F7 + 10-integration-architecture:
- A NOW: scope pure functions self vs assigned vs org (isSelfStudent, isAssignedStudent, canReadStudent, canReadStudentOrgWide, canWriteAttendance, canWriteCompensation, canExport), identity linking table spec doc, student portal architecture doc profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files, demo vs backend identity doc (single-viewer demo vs per-user read cursor actor from token org_id scoping per-object auth), contract/UX preparation no UI yet per D1
- B CONTRACT NOW BACKEND LATER: linking tables user_student_links (user_id, student_id, relation self/guardian, verified_at) + telegram_links (user_id, student_id, telegram_chat_id, verified_at) + bale_links similar, self scope enforcement via actor.studentId, per-user cursor table user_id conversation_id last_read_message_id unread count, media signed URLs per-object auth D15, Sanctum cookie primary + bearer fallback B1, separate app vs same panel D1 decision, org_id scoping
- C DEFERRED: UI for student portal (first product contract only no UI per D1, then separate app later keeps admin RBAC clean)

## 3. Current Implementation State — Partial

**Already complete (verified via grep and existing tests):**
- Scope pure functions self vs assigned vs org — VERIFIED: scope.ts implements isAssignedStudent (teacher classIds Set, active enrollment check), assignedStudentIdsForTeacher, isSelfStudent (actor.studentId===studentId), canReadStudentOrgWide (permissions.includes students.read), canReadStudent (teacher assigned-only smallest model T-02 DENIED desired vs org-wide ALLOWED historical documented, manager/admin/staff/accountant org-wide ALLOWED, student self via isSelfStudent future portal, teacher without teacherId fallback org-wide honest), canWriteStudent (requires students.write, teacher assigned check), canReadTeacher, canWriteAttendance (attendance.write + session teacherId + assigned student), canReadAttendance, canWriteCompensation (schedule.write, teacher DENIED staff/manager/admin ALLOWED), canReadCompensation, canReadSchedule, canWriteSchedule, canExport, isEligibleLevel (contentLevelOrder <= currentOrder)
- Tests: scope.test.ts 15+ cases covering isAssignedStudent true/false/waitlist, assignedStudentIdsForTeacher, isSelfStudent, S-01 self ALLOWED S-02 other DENIED future portal, T-01 assigned ALLOWED T-02 unassigned DENIED smallest vs ALLOWED historical via canReadStudentOrgWide, M-01 manager org-wide, A-01 admin org-wide, canWriteStudent teacher none, attendance write assigned vs unassigned vs session not taught, compensation write teacher DENIED staff ALLOWED, export permission hidden if no read perm, teacher without schedule.write no reschedule, accountant finance not library — VERIFIED
- D1 preserved: No student role in admin panel, ROLES 5, viewPermissions no portal, financeReportsDeferral — VERIFIED
- Learning eligibility canonical owner learning/eligibility.ts pure Level N=>1..N — VERIFIED via eligibility.test 17 cases, per-program provisional O-01 OPEN
- Enrollment canonical Student↔Class edge — VERIFIED via classesRelations
- Media abstraction App->Media/File abstraction->Storage provider — VERIFIED two-part split metadata dataset blobStore vs object storage, allow-list SVG excluded, size ceilings, mediaId ref never data URL, D15 ref not auth
- Chat topology flat collections normalized thread order lastMessageAt — VERIFIED F6
- Identity linking table spec doc — PARTIAL: exists in 10-integration-architecture.md as tables user_student_links (user_id, student_id, relation self/guardian, verified_at) + telegram_links (user_id, student_id, telegram_chat_id, verified_at) + bale_links, but no dedicated student portal spec doc file — gap A NOW needs spec doc
- Student portal architecture doc profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files — PARTIAL: 10-integration-architecture.md has section Student Portal Architecture with profile (name instrument level since balance photo mediaId guardian), classes via enrollment active scoped to date, schedule sessions where classId in enrolled classes bounded window, level placement current + history, resources eligible via resolveEligibleContent, progress pieces assignments events, attendance records where studentId=self correction trail, tickets/messages/files conversations where subjectId=studentId role=student messages in those conversations files via mediaId, communication demo single-viewer vs backend per-user cursor actor from token org_id scoping per-object auth, identity linking, auth student portal separate app or separate view with self scope per D1 deferred — but no dedicated doc file docs/frontend-completion/xx-student-portal-architecture.md — gap A NOW needs dedicated spec doc per F7 visible outcome
- Demo vs backend identity doc — PARTIAL: 10-integration-architecture.md has Communication Demo vs Backend Identity section but needs explicit doc for student portal demo single-viewer no per-user vs backend per-user read cursor actor from token org_id scoping per-object auth for files — gap A NOW
- Contract/UX preparation no UI yet — VERIFIED: no student role UI in admin, no portal routes #/portal — preserves D1, but contract doc should state separate app later keeps admin RBAC clean — gap A NOW needs doc
- Scope self = linked studentId via user_student_links relation self/guardian, assigned = teacher's classes' students via enrollment, org = manager/admin all in org — VERIFIED via scope.ts but needs doc table
- Tests for eligible vs locked — VERIFIED via eligibility.test Level N=>1..N, locked reason «در سطح X باز می‌شود» — but need test for self vs other student with enrollment fixtures already in scope.test — VERIFIED but identity linking validation test missing — gap A NOW small
- No student role in admin panel D1 preserved no fake boundary — VERIFIED

**Gaps / Needs implementation (F7 scope A NOW):**
- Dedicated student portal architecture spec doc: profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files exists as file — MISSING, need create docs/frontend-completion/xx or docs/engineering/F7_PORTAL_ARCHITECTURE.md? But canonical docs are in docs/frontend-completion/ — should add 15-student-portal-architecture.md? Check existing docs list: 01-audit-reconstruction, 02-capability-matrix, 03-domain-map, 04-learning-access-policy, 05-rbac-access-control, 06-library-gallery-spec, 07-settings-theme-architecture, 08-export-architecture, 09-dashboard-analytics, 10-integration-architecture, 11-roadmap, 12-decision-register, 13-open-decisions, 14-handoff-checkpoint, README — F7 asks spec doc for portal architecture — should create docs/frontend-completion/15-student-portal.md or similar, but need to check if F7 expects new doc — per F7 visible outcome: Spec doc for portal architecture exists — currently only section in 10-integration-architecture.md, not dedicated — gap
- Identity linking table spec: user_student_links (user_id, student_id, relation self/guardian, verified_at) + telegram_links bale_links — exists in 10-integration-architecture but needs formal spec with columns, constraints, validation, relation enum, verified_at semantics — gap A NOW
- Scope pure functions self vs assigned vs org — VERIFIED but needs additional self portal tests: self vs other student with enrollment/placement fixtures, eligible vs locked — partially exists but need to add explicit student portal actor tests for profile/classes/schedule/resources — gap small A NOW
- Demo vs backend identity doc — needs explicit section in portal architecture doc: demo single-viewer no per-user vs backend per-user read cursor actor from token org_id scoping per-object auth for files, media signed URLs — gap
- No UI yet per D1 but contract/UX preparation — need to document that first product contract only no UI, then separate app later keeps admin RBAC clean, no student role in admin panel D1 preserved — gap doc
- O-01 O-10 O-13 O-14 remain OPEN — must NOT resolve by assumption — preserve

## 4. Dependencies / Blockers

- RBAC scope self vs assigned vs org O-01 O-10 O-13 O-14 — OPEN, but scope.ts already implements smallest model with evidence helper for T-02 — no blocker for A NOW, B later
- Learning eligibility pure — VERIFIED — no blocker
- Library media abstraction — VERIFIED — no blocker
- Media abstraction allow-list size ceilings — VERIFIED — no blocker
- DemoStore single authority — VERIFIED — no blocker
- D1 student role deferred — VERIFIED — no blocker, actually enables F7 contract only no UI
- Identity linking table spec — B CONTRACT — no blocker for doc
- No backend/Laravel/database/migrations needed for F7 A NOW — per hard boundary — no blocker
- No blocker for F7-1 leaf: create student portal architecture spec doc + identity linking spec + demo vs backend identity doc + scope pure functions tests

## 5. Exact Files Likely to Change

- `src/domains/auth/scope.ts` — already has self vs assigned vs org, may add additional helpers for student portal: canReadOwnProfile, canReadOwnClasses, canReadOwnSchedule, canReadOwnResources, canReadOwnProgress, canReadOwnAttendance, canReadOwnTickets etc — but must keep pure, no repo — A NOW small addition if needed, or keep existing and document that existing covers student portal self scope via isSelfStudent + canReadStudent
- `src/domains/auth/__tests__/scope.test.ts` — add tests for self portal: self vs other student, eligible vs locked, identity linking validation (relation self/guardian), enrollment active vs waitlist vs completed, placement per-program vs global O-01 — A NOW
- `docs/frontend-completion/10-integration-architecture.md` — already has Student Portal Architecture section — may need update to reference new dedicated doc, but preserve existing
- `docs/frontend-completion/15-student-portal-architecture.md` or `docs/frontend-completion/07b-student-portal.md` — NEW file A NOW: student portal architecture doc profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files exists, scope self = linked studentId via user_student_links relation self/guardian assigned = teacher's classes' students via enrollment org = manager/admin all in org, demo single-viewer no per-user vs backend per-user read cursor actor from token org_id scoping per-object auth for files, identity linking table user_student_links + telegram_links bale_links, auth student portal separate app or separate view with self scope per D1 deferred contract only no UI then separate app later keeps admin RBAC clean, no student role in admin panel D1 preserved no fake boundary
- `docs/frontend-completion/12-decision-register.md` — may need entry for PORTAL-02 student portal architecture? But NEW-PORTAL-01 already exists provisional — may keep
- `docs/frontend-completion/13-open-decisions.md` — O-01 O-10 O-13 O-14 remain OPEN — no change per hard boundary do not resolve by assumption
- `docs/engineering/F7_INVENTORY.md` — this file
- `docs/engineering/F7_REPORT.md` — final report after implementation
- No backend/Laravel/database/migrations — per hard boundary
- No PROJECT_STATE.md modification — per hard boundary for known governance drift
- No src/data/ — dissolved

## 6. Implementation Order

- F7-1 leaf: student portal architecture spec doc — create dedicated doc file in docs/frontend-completion/ with sections: goal, profile, classes, schedule, level, resources, progress, attendance, tickets/messages/files, communication demo vs backend identity, identity linking table spec user_student_links (user_id, student_id, relation self/guardian, verified_at) + telegram_links bale_links, scope self/assigned/org pure functions, auth separate app vs same panel D1 deferred contract only no UI then separate app later, no student role in admin panel D1 preserved, demo single-viewer vs backend per-user cursor actor from token org_id scoping per-object auth, media signed URLs, export permission, risks O-01 O-10 O-13 O-14
- F7-2: scope pure functions additional helpers if needed for student portal self scope — ensure isSelfStudent covers profile, canReadOwnClasses via enrollment active, canReadOwnSchedule via sessions where classId in enrolled classes, canReadOwnResources via resolveEligibleContent, canReadOwnProgress/Attendance/Tickets via studentId filter — may add wrappers that reuse existing isAssignedStudent + isSelfStudent but keep pure — plus tests for self vs other student, eligible vs locked, identity linking validation
- F7-3: demo vs backend identity doc explicit — part of F7-1 doc but ensure section covers actor from token org_id scoping per-object auth for files, per-user read cursor, Sanctum cookie primary + bearer fallback B1, separate app keeps admin RBAC clean
- Final: focused tests scope.test.ts + eligibility.test + noSuccessWithoutWrite, full Vitest regression no F1-F6 regression, docs update

No blocker exists for F7-1 — begin first vertical slice: create student portal architecture spec doc + identity linking spec + demo vs backend identity doc + scope tests.
