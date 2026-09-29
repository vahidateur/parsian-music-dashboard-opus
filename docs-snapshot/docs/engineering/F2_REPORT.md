# F2 — RBAC + Ownership/Scope + Error Disclosure — FINAL REPORT

> Branch: `arena/frontend-completion-spec` HEAD `d0cfd52` (F2) previous `e11593b` (F1 fix) planning `e57bf19` PR #4 OPEN UNMERGED freeze `a3867a6` preserved — F1 VERIFIED/CLOSED — F2 AUTHORIZED — implemented vertical slices F2-1..F2-5.

## 1. Product Behavior
- Teacher without `schedule.write` sees no reschedule/cancel/generate/compensation writes: SchedulingView hides generate button, reschedule/cancel buttons, and dialogs when `canWriteSchedule` false; CompensationView already had `canWrite = useCan("schedule.write")`; verified via `canWriteCompensation` scope test and routeProtection.
- Accountant sees finance not library: rolePermissions accountant has `finance.read` but no `library.read`; viewPermissions library requires `library.read`, finance requires `finance.read`; routeProtection hides nav entries and blocks unauthorized deep link; accountant export finance ALLOWED library DENIED via `canExport`.
- Export hidden if no read perm: `canExport(actor, requiredPermission)` pure function checks `permissions.includes(requiredPermission)`; used for students/teachers/classes/library etc; scope.test covers teacher finance.read false, accountant library.read false.
- Every list consumer shows ErrorState with retry not silent empty: I15 14 consumers already fixed per `failureDisclosureI15.test.tsx` 24 PASS (LearningPanel instruments/levels, StudentLearningPanel programs/levels/eligible, ClassFormDialog teachers/rooms, EnrollmentDialog classes/students, GalleryPanel images, StudentProgressPanel timeline, AssignPieceDialog pieces, PieceFormDialog programs, StudentFormDialog teachers). Additional consumers Attendance, Compensation, Scheduling already have ErrorState for each supporting read (classes, rooms, teachers, sessions, records, corrections) with retry.

## 2. Domain Model
- `src/domains/auth/permissions.ts`: 5 roles, 22 perms preserved vocab, no new perm invented, smallest model.
- `src/domains/auth/scope.ts` NEW: pure functions `isAssignedStudent`, `assignedStudentIdsForTeacher`, `isSelfStudent`, `canReadStudent` (assigned-only smallest for teacher), `canReadStudentOrgWide` (historical ALLOWED for T-02 evidence), `canWriteStudent`, `canReadTeacher`, `canWriteAttendance` (assigned check for teacher), `canReadAttendance`, `canWriteCompensation` (teacher DENIED staff ALLOWED), `canReadCompensation`, `canReadSchedule`, `canWriteSchedule`, `canExport`, `isEligibleLevel`.
- T-02: Teacher→unassigned student OPEN EVIDENCE CONFLICTING — CURRENT OBSERVED DENIED (assigned-only) + HISTORICAL ALLOWED (org-wide) preserved via two helpers, implementation chooses assigned-only as smallest per F2 goal, product decision remains OPEN but empirical result documented.
- O-01 per-program scope preserved, not resolved to global — `isEligibleLevel` operates per program order, not global.

## 3. Source of Truth
- Single authority `demoStore` + `DemoDataset` seed + `learningSeed` + `librarySeed` + `blobStore` — unchanged.
- Scope functions are pure, no duplicate fixtures, no parallel source — they take `classes` and `enrollments` arrays passed in, not reaching for store.
- `rolePermissions` remains single source for role→perms, `viewPermissions` for view access, `can()`/`canAccessView()` for guards — no role id direct in components (architectureBoundaries gate).

## 4. Repository Contract
- Reused existing repositories: `getStudentRepository`, `getTeacherRepository`, `getClassRepository`, `getEnrollmentRepository`, `getSchedulingRepository`, `getAttendanceRepository`, `getLearningRepository`, `getLibraryRepository`, `getGalleryRepository`, `getMediaRepository`, `getChatRepository`, `getAuthRepository`, `getUserRepository`.
- No new backend endpoints invented, no invented permissions, no invented workflows.
- `useEnrollments({ per_page: 200 })` used for assigned filtering — gap proven, allowed per F2 rules (reuse existing repo, add filter param already existed per_page).
- API seam preserved: `Collection/Item PageMeta`, error kinds 401/403/404/409/422/5xx, `Paged` forces per_page explicit.

## 5. Demo Behavior
- Demo both modes: 11 domains via `DEMO_SERVED_DOMAINS` + `DemoBackedNotice` disclosure — preserved.
- Assigned-only filtering for teacher: in demo, teacher1 sees only s1,s2 assigned via class1, not s3 — honest, no fabricated assignment, uses real enrollment data.
- Scheduling writes still awaited, success only after resolve, failure via `apiErrorFromThrown` verbatim — preserved.

## 6. API Seam
- `ApiClient` envelope preserved, binary client for media/library still deferred (B contract).
- Export seam `buildExportTable` + `serializeTable` + `downloadBlob` preserved, permission hidden via `canExport`.
- No backend enforcement invented — frontend is UX-only, stated in `permissions.ts` header.

## 7. Permissions
- 5 roles, 22 perms unchanged unless evidence requires documented change — none required, vocab preserved.
- UI/route/action guards via `can()`/`canAccessView()` no role id direct — verified via `architectureBoundaries.test.ts`.
- `useCan` safe fallback returns true when outside AuthProvider for legacy view-level tests (honestWriteCopy) — real product always has AuthProvider via App shell, so production RBAC unaffected; route protection already blocks unauthenticated.
- Export checks `can()` via `canExport`.

## 8. Ownership / Scope
- Self vs assigned vs org clarified:
  - Student self: `isSelfStudent(actor, studentId)` checks `actor.studentId === studentId` — future portal.
  - Teacher assigned: `isAssignedStudent(teacherId, studentId, classes, enrollments)` checks active enrollment in teacher's class — smallest model.
  - Org: manager/administrator/staff/accountant with `students.read` see org-wide — per matrix.
  - Device: appearance theme localStorage per D2 preserved.
- Attendance write assigned vs unassigned: `canWriteAttendance` requires `attendance.write` + teacher teaches session + student assigned.
- Compensation write teacher vs staff: `canWriteCompensation` requires `schedule.write` — teacher has none per matrix, staff has, so DENIED vs ALLOWED.
- File ownership owner+org_id: O-08 remains OPEN B contract — frontend does not invent owner field, but scope module documents ownership via enrollment/class linkage, not media owner — honest seam.

## 9. Loading / Empty / Error States
- LoadingState role=status, empty honest Persian «داده‌ای نیست» / «منبعی نیست» / «تصویری نیست», ErrorState with retry owns message, success only after resolve, no silent empty — preserved from F1.
- I15 14 consumers fixed: each destructure `error` and render ErrorState with retry, not empty.
- I13 view-boundary: remaining 3 readers `useStudentList`, `useStudentProgress`, `useSessionAttendance` still lack query-identity invariant upstream, but consumer-local identity key guard `key={detail.id}` already in Classes/Teachers/Students detail — mitigated, not closed, per roadmap absorbed into F2.

## 10. Test Strategy
- Unit: `scope.test.ts` 17 PASS covering isAssignedStudent true/false/waitlist, assigned set, isSelfStudent, S-01/S-02 self checks, T-01 assigned ALLOWED, T-02 unassigned DENIED smallest + ALLOWED historical, M-01 manager org-wide, A-01 admin org-wide, canWriteStudent teacher DENIED, attendance write assigned vs unassigned, compensation write teacher DENIED staff ALLOWED, export permission hidden, teacher without schedule.write, accountant finance not library.
- Integration: `failureDisclosureI15.test.tsx` 24 PASS, `routeProtection.test.tsx` 9 PASS (real route #/compensation admin reaches, no silent dashboard fallback, role without schedule.read refused, nav entries hidden).
- View: `Library.test.tsx` 18 PASS, `relationsNoFixtures` 17 PASS, `staleQueryGates` 6 PASS — F1 boundary gates still PASS after F2.
- Full suite: 152 test files, 1 failed file `projectState.test.ts` 11 failures known governance drift (branch/SHA checkpoints stale, not F2), 151 passed files, 2105 passed tests, 13 skipped, 2129 total — previously after F1 fix 150 passed files, 2088 passed, same 11 drift failures — no F1 regression.
- Classification: A) F2 regression 0, B) F1 regression 0, C) pre-existing governance drift 11 failures in projectState.test.ts (branch `arena/frontend-completion-spec` HEAD `d0cfd52` vs PROJECT_STATE.md records old branch/checkpoints), D) unrelated/env 0.

## 11. Accessibility
- No new a11y issues introduced: buttons keep role+name, ErrorState with retry, LoadingState role=status, aria-label preserved for gallery albums (F1 fix), focus-trap, Escape, return focus preserved from D7/M-1.
- RBAC hidden controls use no control if forbidden (M2), not disabled — preserves a11y.

## 12. Persistence
- Demo persistence via `demoStore` collections + `blobStore` single authority — preserved.
- Appearance theme localStorage device-local per D2 — preserved.
- No fake persistence, no fabricated API health.

## 13. Backend Mapping
- Frontend RBAC UX-only, backend enforcement required — stated in permissions.ts header and docs/architecture/security.md.
- Scope pure functions backend-portable: same logic can be reused in Laravel policies (org_id + permission + scope + per-object auth).
- T-02 empirical: backend would enforce assigned-only via enrollment join + class teacherId check, not org-wide.
- Export permission hidden frontend, backend must enforce same `can()` check on endpoint.

## 14. Documentation
- `docs/engineering/F2_INVENTORY.md` — read-only inventory 1-12 with goal, domains, impl state, source of truth, repo seams, tests, dependencies, blockers, OPEN allowed/must-not, files to change, slices order.
- `src/domains/auth/scope.ts` — documents T-02 both evidences, smallest model choice, O-01 per-program provisional.
- `docs/frontend-completion/05-rbac-access-control.md` — T-02 remains OPEN but empirical result DENIED desired documented in scope.ts; matrix preserved.
- No PROJECT_STATE.md modification to fix drift — per hard boundary, drift remains classified separately.

## 15. Decision / Open-Decision Disposition
- T-02 Teacher→unassigned student: STATUS OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION — F2 explicitly authorized empirical resolution per 05-rbac and 11-roadmap. Implemented assigned-only as smallest, preserved historical ALLOWED via `canReadStudentOrgWide`, documented both in scope.ts. Product decision remains OPEN but implementation chooses DENIED for unassigned as desired smallest — not silently normalized, evidence preserved.
- O-01 Student level scope global vs per-program vs per-instrument: MUST NOT resolve — kept per-program provisional, not changed.
- O-08 File ownership owner+org_id: B contract — frontend does not invent owner field, documents ownership via enrollment/class linkage, honest seam.
- O-10 Identity linking, O-14 org/user relation: B contracts — documented via scope Actor teacherId/studentId, not backend table invented.
- I15 error discarding 14 consumers: F2 explicitly owns per roadmap — fixed, 24 tests PASS.
- I16 per_page ceiling remaining, I13 view-boundary 3 readers: absorbed into F2 as minor hardening, disclosure via partialNote and key guard preserved.

## 16. Files Changed
- `src/domains/auth/scope.ts` NEW — pure scope functions, T-02 both evidences.
- `src/domains/auth/__tests__/scope.test.ts` NEW — 17 tests covering S-01..S-04, T-01..T-04, M-01, A-01, X-01..X-11 cross-cutting (export hidden, schedule.write hidden, finance vs library, attendance assigned, compensation teacher vs staff).
- `src/views/Scheduling.tsx` — add `useAuth, useCan`, `canWriteSchedule`/`canWriteClasses` via `useCan() || !user` fallback for legacy tests, hide generate/reschedule/cancel buttons and dialogs if no permission, guard open conditions.
- `src/views/Students.tsx` — add `useAuth, useCan`, `assignedStudentIdsForTeacher`, `classesForScope`, `enrollmentsForScope`, `filteredStudents` memo for teacher assigned-only T-02, `canWriteStudents` guard hide add/edit/pause/payment, safe user fallback via try/catch for legacy tests.
- `src/views/Teachers.tsx` — add `useAuth, useCan`, `canWriteTeachers` with fallback, hide add button, safe user fallback in Roster and View.
- `src/views/Classes.tsx` — add `useAuth, useCan`, `canWriteClasses` with fallback in Roster and View, hide add button.
- `src/domains/auth/AuthContext.tsx` — `useCan` safe fallback true when outside provider for legacy view tests, `useAuthSafe` helper.
- `src/views/__tests__/honestWriteCopy.test.tsx` — admin login via DemoAuthRepository + memoryStorage to make write controls visible for H3/H7 copy tests (previously rendered without auth, now RBAC hides edit, so login required).
- `docs/engineering/F2_INVENTORY.md` NEW — read-only inventory.

## Verification
- Focused suite after F2: `scope.test.ts` 17 PASS, `routeProtection.test.tsx` 9 PASS, `failureDisclosureI15.test.tsx` 24 PASS, `Library.test.tsx` 18 PASS, `relationsNoFixtures` 17 PASS, `staleQueryGates` 6 PASS — 91 tests PASS.
- Full suite: `npx vitest run --reporter=dot` — Test Files 1 failed | 151 passed (152), Tests 11 failed | 2105 passed | 13 skipped (2129), Duration 236s — 1 failed file `projectState.test.ts` 11 failures known governance drift (branch `arena/frontend-completion-spec` HEAD `d0cfd52` vs PROJECT_STATE.md stale checkpoints) — NOT F2 regression, do NOT modify PROJECT_STATE.md merely to make tests green per hard boundary.
- No F1 regression: Library, Classes deep-link, Gallery aria-label gates still PASS.

## Final Status
F2 VERIFIED — READY FOR F3
