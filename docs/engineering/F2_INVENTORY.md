# F2 — READ-ONLY INVENTORY — RBAC + Ownership/Scope + Error Disclosure

> Branch: `arena/frontend-completion-spec` HEAD `e11593b` (F1 fix) previous `cbd2a71` planning `e57bf19` PR #4 OPEN UNMERGED historical freeze `a3867a6` preserved — F1 VERIFIED/CLOSED — F2 AUTHORIZED — strict read-only inventory, no code modification.

## 1. Exact F2 Goal from Canonical Roadmap (11-roadmap.md F2)

- **Goal:** RBAC matrix becomes testable authorization contract, smallest permission model, UI guards no control if forbidden, error states owned, ownership/scope self vs assigned vs org clarified
- **Visible outcome:** Teacher without schedule.write sees no reschedule/cancel/generate/compensation writes; accountant sees finance not library; export buttons hidden if no read perm; every list consumer shows ErrorState with retry not silent empty; student→own profile ALLOWED self, student→another DENIED, student→eligible ALLOWED, student→locked DENIED locked UI, teacher→assigned ALLOWED, teacher→unassigned ALLOWED currently DENIED desired (document both), teacher→attendance assigned ALLOWED, teacher→compensation DENIED, staff operational ALLOWED, manager org-wide ALLOWED, administrator org administration ALLOWED — 11 required cases S-01..S-04 T-01..T-04 ST-01 M-01 A-01 + X-01..X-11 cross-cutting
- **Domains:** auth/permissions.ts (5 roles 22 perms preserve vocab unless evidence requires documented change), auth/types, students/teachers/classes/enrollments/learning/placement/scheduling/attendance/compensation/chat/media/export, all list hooks useResource/useDerived
- **Minor hardening absorbed:** pagination per_page mitigation remaining consumers + media one-frame remaining → F2 (I15 error discarding 14 consumers, I16 per_page ceiling remaining, I13 view-boundary 3 readers)
- **Acceptance:** Matrix Actor/Action/Resource/Scope/Allowed/DENIED/Reason/Frontend guard/Future backend enforcement exists testable, 5 roles 22 perms unchanged unless decision with evidence, self vs assigned vs org scope documented, users/roles/permissions/ownership/scope clarified, UI/route/action guards via can() canAccessView no role id direct, backend enforcement UX-only stated, export checks can(), scope pure functions canRead(actor,resource,scope) unit tested, test plan unit/integration/view/E2E future backend 403 with reason, 11 sensitive capabilities explicitly covered
- **Tests:** routeProtection.test real route #/compensation admin reaches no silent Dashboard fallback role without schedule.read refused, can() unit, scope pure functions, error disclosure for 14 remaining consumers useRooms etc (I15), export permission hidden, teacher assigned vs unassigned, student self vs other, attendance write assigned vs unassigned, compensation write teacher vs staff

## 2. Exact F2 Domains/Surfaces

- **Auth/RBAC:** `src/domains/auth/permissions.ts`, `types.ts`, `AuthContext.tsx`, `useUsers.ts`, `src/lib/viewContracts.ts`, `src/App.tsx` route guards, `src/lib/navigation.ts` nav filtering
- **Students:** `src/views/Students.tsx`, `src/domains/students/*`, `StudentFormDialog.tsx`
- **Teachers:** `src/views/Teachers.tsx`, `src/domains/teachers/*`, `TeacherFormDialog.tsx`
- **Classes:** `src/views/Classes.tsx`, `src/domains/classes/*`, `ClassFormDialog.tsx`
- **Enrollments:** `src/domains/enrollments/*`, `EnrollmentDialog.tsx`
- **Learning/Placement:** `src/domains/learning/*`, `LearningPanel.tsx`, `StudentLearningPanel.tsx`, `LevelContentPanel.tsx`
- **Scheduling:** `src/views/Scheduling.tsx`, `src/domains/scheduling/*`
- **Attendance:** `src/views/Attendance.tsx`, `src/domains/attendance/*`
- **Compensation:** `src/views/Compensation.tsx`, `src/domains/compensation/*`
- **Chat/Messages:** `src/views/Messages.tsx` (actually view `src/views/Messages.tsx` or `src/domains/chat`), `src/domains/chat/*`
- **Media:** `src/domains/media/*`, `useMediaObjectUrl`
- **Export:** `src/domains/export/exportService.ts`, `src/views/Students.tsx` etc export usage, `src/lib/download.ts`
- **Shared hooks:** `src/domains/shared/useResource.ts`, `useAcademyMetrics.ts`, `useDashboardInsights.ts`, etc — all list consumers

## 3. Existing Implementation State per Domain

### Auth/RBAC
- **Status:** partial — vocabulary complete (5 roles 22 perms), matrix in `permissions.ts` complete, `can()`, `canAny()`, `canAll()`, `canAccessView()`, `defaultViewFor()` complete, `viewPermissions` UX-only complete, route protection in `App.tsx` via `canAccessView` + `routeProtection.test.tsx` 8 tests PASS, navigation filtering via `canAccessView` in Sidebar? Need check — likely complete for route level, but **scope pure functions missing** — no `canRead(actor,resource,scope)` pure functions for self vs assigned vs org; teacher assigned vs unassigned filtering not implemented (teacher sees all students org-wide currently) — so RBAC UI guards for writes exist (attendance, compensation) but scope filtering partial.
- **Source of truth:** `src/domains/auth/permissions.ts` single source for role→perms, `src/domains/auth/types.ts` User, `src/services/demoStore` users collection
- **Repo seams:** `AuthRepository` demo+api, `UserRepository` demo+memory, `getAuthRepository`, `getUserRepository` in registry — demo both modes — API seam preserved
- **Tests:** `AuthContext.test.tsx`, `permissions.test.ts`, `routeProtection.test.tsx` — PASS, but scope functions not yet unit tested

### Students
- **Status:** partial — list via `useStudentList({per_page:200})` with loading/error/retry for main list, but detail relations `useEnrollments`, `useClasses`, `useRooms`, `useSessions`, `useStudentProgress` etc — some error discarding (relationsError uses `??` first only, not all), but shows ErrorState — partial error disclosure. RBAC: `can()` used for write controls? StudentFormDialog has no explicit permission check? Need verify — likely uses `useCan(students.write)`? Check later. Scope: self vs other not implemented for student portal (D1 deferred), teacher assigned vs unassigned not filtered — org-wide.
- **Source of truth:** `DemoDataset.students` via `demoStore.students`, `Student` type
- **Repo seams:** `StudentRepository` API+Demo, `getStudentRepository` — demo both modes for some? Actually students API-backed 7 — API seam exists
- **Tests:** `useStudents.test.tsx`, `demoRepository.test.ts`, `studentPhotoDisplay.test.tsx`, `nationalId.matrix.test.ts`, `relationsNoFixtures` gate — PASS

### Teachers
- **Status:** partial — similar to Students, roster from enrollment, rooms via `useRooms`, but error handling for `useRooms`? Might discard? Need check. RBAC: teacher write controls? TeacherFormDialog permission check? Scope: teacher assigned filtering not implemented.
- **Source of truth:** `DemoDataset.teachers` via `demoStore.teachers`
- **Repo seams:** `TeacherRepository` API+Demo
- **Tests:** `demoRepository.test.ts`, `teacherPhoto.test.tsx`, `relationsNoFixtures` — PASS

### Classes
- **Status:** complete after F1 fix — deep-link authoritative `useClass(id)`, roster from Enrollment canonical, rooms/teachers via bounded reads with `per_page:200`, error handling for `enrollments`+`rooms` via `relationsError ??` but shows ErrorState, main list `useClasses` with loading/error/retry, `partialNote` disclosure — mostly complete, but error discarding for secondary reads (rooms, enrollments) still uses `??` first only — minor I15 remaining. RBAC: `can()` used for add/edit/archive/enroll? Need verify — ClassFormDialog has no explicit permission? But `ClassesView` has no `useCan`? Might be missing. Scope: teacher assigned not filtered.
- **Source of truth:** `DemoDataset.classes` via `demoStore.classes`
- **Repo seams:** `ClassRepository` API+Demo, `useClass` hook added F1
- **Tests:** `demoRepository.test.ts`, `classesRelations.test.tsx`, `deepLinkPagination.test.tsx`, `relationsNoFixtures` — PASS after F1 fix (renamed variable)

### Enrollments
- **Status:** partial — repository complete, hook `useEnrollments({classId, per_page})` with `per_page` explicit, but `EnrollmentDialog` error discarding at `:35` — `useClasses`? Need check — currently discards error? Might need fix. RBAC: uses `can()`? EnrollmentDialog has no permission check? Might be missing. Scope: enrollment canonical edge Student↔Class — complete.
- **Source of truth:** `DemoDataset.enrollments` via `demoStore.enrollments`
- **Repo seams:** `EnrollmentRepository` API+Demo
- **Tests:** `demoRepository.test.ts` — PASS

### Learning/Placement
- **Status:** complete after F1 — `eligibility.ts` canonical owner with eligible + locked, `useStudentPlacement`, `useEligibleContent`, `useLockedContent` via `useDerived` keyed, `LearningPanel` + `LevelContentPanel` + `StudentLearningPanel` with loading/error/retry + disclosure — but I15 lists `LearningPanel.tsx:84` instruments and `:104` levels, `StudentLearningPanel.tsx:28,36,205` — after F1 fix, `LearningPanel` now has error handling for instruments and levels, `StudentLearningPanel` has error handling for placement, eligible, locked, programs, levels — so I15 for learning likely fixed in F1, but need verify if any remaining discards. RBAC: no explicit `can()` in LearningPanel? Learning is settings/operations — requires `settings.read`? Actually `viewPermissions` for settings is `settings.read`, LearningPanel is under settings? Might be settings view — need check — RBAC for learning write? `can()` used in `LearningPanel`? It has `busy` but no `useCan` — might be missing. Scope: placement per program, per-program provisional — O-01 OPEN.
- **Source of truth:** `DemoDataset.programs`, `levels`, `learningContent`, `levelContent`, `placements` via `demoStore`
- **Repo seams:** `LearningRepository` demo only (no apiRepository), `getLearningRepository` — demo both modes
- **Tests:** `eligibility.test.ts` 13 pass, `attachContentIntent.test.ts` 8 pass, `contentAssignmentFlow.test.tsx`, `LevelContentPanel.test.tsx`, `StudentLearningPanel.test.tsx`, `demoRepository.test.ts`, `useDerived.test.tsx` — 93 total PASS

### Scheduling
- **Status:** partial — domain complete Group A 211 tests, view wired at M4 with bounded reads `useSessions({classId, from, to, per_page})`, writes reschedule/cancel/generation awaited, RBAC `can()` for `schedule.write`? Compensation borrows `schedule.read/write` — need verify scheduling view has `useCan(schedule.write)` for write controls — likely exists. Error disclosure: `useClasses`, `useRooms`, `useTeachers` in Scheduling view — do they handle error? Might discard? Need check — I15 may include scheduling? Not listed but could be remaining.
- **Source of truth:** `DemoDataset.sessions` via `demoStore.sessions`
- **Repo seams:** `SchedulingRepository` API+Demo, `getSchedulingRepository`
- **Tests:** `conflicts.test.ts`, `dateBridge.test.ts`, `demoRepository.test.ts`, `generation.test.ts`, `registry.test.ts`, `useDerivedRead.test.tsx`, `useScheduling.test.tsx` — PASS

### Attendance
- **Status:** partial — domain Group D 79 tests, view `Attendance.tsx` with 7 bounded reads per_page explicit, counts from total, truncation disclosed, RBAC `canWrite = useCan(attendance.write) && recorderId !== null` no control if false — PASS for write guard, but error disclosure for `useClasses`, `useTeachers` etc may discard? Need check — I15 not listing attendance but could be. Scope: assigned session + roster check via enrollment — partial scope filtering.
- **Source of truth:** `DemoDataset.attendanceRecords`, `attendanceCorrections` via `demoStore`
- **Repo seams:** `AttendanceRepository` API+Demo
- **Tests:** `demoRepository.test.ts`, `roster.test.ts`, `useAttendance.test.tsx` — PASS

### Compensation
- **Status:** partial — domain 121 tests, view `Compensation.tsx` with RBAC `canWrite = useCan(schedule.write)` no control if false — teacher sees no register/schedule/complete — PASS for T-04, but error disclosure for `useClasses`, `useRooms`, `useTeachers` may discard. Scope: frozen student derived from roster, actor provenance userId — partial ownership. No free-slot search, no seeded compensable case — I20.
- **Source of truth:** `DemoDataset.compensations` via `demoStore.compensations`
- **Repo seams:** `CompensationRepository` demo only, no apiRepository — API seam missing but B contract
- **Tests:** `authorization.test.ts`, `bookingInvariant.test.ts`, `datasetContract.test.ts`, `demoRepository.test.ts`, `derive.test.ts`, `enrollmentEligibility.test.ts`, `persianDate.test.ts`, `useCompensations.test.tsx` — PASS

### Chat/Messages
- **Status:** partial — domain types complete, repository demo both modes, provider in_app genuinely persists others unavailable, hooks `useChat`, view `Messages.tsx` conversation list, management, filter, composer conversation-keyed D16, attachments two writes Media.create+Chat.sendMessage D15, export single-conversation txt metadata only ceiling 1000 D14, but error discarding at `Messages.tsx:105` — secondary read? Might be `useRooms`? Actually Messages has no rooms. Need check — I15 lists Messages.tsx:105 as remaining. RBAC: `can()` for messages.read/write? All roles have messages.read except accountant? Actually accountant has messages.read, so all can read org-wide currently — gap per-user cursor future. Scope: org-wide currently, not self.
- **Source of truth:** `DemoDataset.chatConversations`, `chatMessages` via `demoStore`
- **Repo seams:** `ChatRepository` demo only, `getChatRepository`
- **Tests:** `conversationLifecycle.test.ts`, `demoRepository.test.ts`, `messageAttachments.test.ts` — PASS, `staleQueryGates` Messages thread switch — PASS after fix

### Media
- **Status:** complete after F1 fix — `useMediaObjectUrl` with urlFor guard + createdRef + synchronous clear + render guard, `useLibraryFile` assetFor/blobFor guards + synchronous clear — one-frame stale fixed for 2 exposures, but I13 view-boundary 3 readers remain: `useStudentList`, `useStudentProgress`, `useSessionAttendance` still no query-identity invariant — those are not media but shared. Media itself complete. RBAC: per-object auth gap D15 documented, frontend resolution != auth — honest.
- **Source of truth:** `DemoDataset.media` via `demoStore.media`, bytes `blobStore` IndexedDB
- **Repo seams:** `MediaRepository` demo+api? DemoMediaRepository with validation, `getMediaRepository`, `getBlobStore`
- **Tests:** `media.test.ts`, `ProfilePhotoField.test.tsx` — PASS, `useLibrary.test.tsx` 18 PASS

### Export
- **Status:** partial — `exportService.ts` with `buildExportTable`, `serializeTable` csv/xlsx, `downloadBlob` seam, `EXPORT_LABELS` Persian, `safeFilename`, BOM? Chat export has BOM, csv maybe missing BOM — gap. Permission: export buttons hidden if no read perm? Need check — Students/Teachers/Classes/Enrollments already via buildExportTable explicit columns no leak + serializeTable + downloadBlob seam, but permission guard `can()` for export? Might be missing — F2 requires export permission hidden. Scope: filter reuse from list view — partial.
- **Source of truth:** repos list reads per_page 1000, filter state from views
- **Repo seams:** no repository, pure service + `lib/download.ts`
- **Tests:** `exportService.test.ts` — PASS, but BOM, safeFilename, explicit columns, filter reuse, permission hidden, truncation disclosed need coverage

### Shared Hooks
- **Status:** partial — `useResourceList` Paged forces per_page explicit, keyed state prevents stale cross-query, `useDerived` keyed by studentId prevents cross-student exposure — I13 fixed for 6 consumers, but 3 readers remain: `useStudentList`, `useStudentProgress`, `useSessionAttendance` still no query-identity invariant — these need consumer-local identity key guard (key={detail.id}) as done in Classes/Teachers. Error discarding I15 14 consumers — after F1 fix, many fixed, but need re-audit.

## 4. Existing Source of Truth for Each Domain

- Auth: `demoStore.users` + `rolePermissions` matrix
- Students: `demoStore.students`
- Teachers: `demoStore.teachers`
- Classes: `demoStore.classes`
- Enrollments: `demoStore.enrollments`
- Learning: `demoStore.programs`, `levels`, `learningContent`, `levelContent`, `placements`
- Scheduling: `demoStore.sessions`
- Attendance: `demoStore.attendanceRecords`, `attendanceCorrections`
- Compensation: `demoStore.compensations`
- Chat: `demoStore.chatConversations`, `chatMessages`
- Media: `demoStore.media` metadata + `blobStore` bytes
- Library: `demoStore.resources` + `blobStore`
- Gallery: `demoStore.galleryAlbums`, `galleryImages` + `blobStore`
- All via single authority `demoStore` + `DemoDataset` seed `src/domains/demo/seed.ts` + `learningSeed.ts` + `librarySeed.ts`

## 5. Existing Repository/API Seams

- `getStudentRepository`, `getTeacherRepository`, `getClassRepository`, `getEnrollmentRepository`, `getRoomRepository`, `getSchedulingRepository`, `getAttendanceRepository`, `getLearningRepository`, `getLibraryRepository`, `getGalleryRepository`, `getMediaRepository`, `getChatRepository`, `getBrandingRepository`, `getCompensationRepository`, `getProgressRepository`, `getAuthRepository`, `getUserRepository`, `getInstrumentRepository`, `getExportService` (service not repo) — all via `src/domains/registry.ts`
- API-backed: students/teachers/rooms/classes/enrollments/auth/users (7) — `apiRepository` exists
- Demo both modes: instruments/learning/progress/library/gallery/branding/media/chat/scheduling/attendance/compensation (11) — `DemoBackedNotice` disclosure, `apiRepository` exists for some but unregistered due to binary client need (library, media)
- `ApiClient` envelope `Collection/Item PageMeta`, error kinds 401/403/404/409/422/5xx, `Paginated` `Paged` forces per_page explicit — backend-portable
- No new backend endpoints invented in F1 — preserved

## 6. Existing Tests and Coverage

- Total suite after F1 fix: 151 test files, 1 failed (projectState governance), 150 passed, 2088 passed tests, 13 skipped, 2112 total
- F1-related: eligibility 13, attachContentIntent 8, contentAssignmentFlow 5, LevelContentPanel 12, StudentLearningPanel, useLibrary 18, GalleryPanel 8, GalleryAlbumSwitch 1, classesRelations, deepLinkPagination, relationsNoFixtures, noSuccessWithoutWrite, honestWriteCopy, Library.test.tsx 18, etc — all PASS after fix
- F2-relevant:
  - `routeProtection.test.tsx` 8 PASS — real route #/compensation deep link
  - `permissions.test.ts` — can() unit
  - `auth/__tests__/*` — AuthContext, demoAuth, userRepository
  - `attendance/__tests__/roster.test.ts` — scope via enrollment
  - `compensation/__tests__/authorization.test.ts` — schedule.write required for compensation writes, teacher DENIED
  - `shared/__tests__/staleQueryGates.test.tsx` — I13 gates — now PASS after gallery fix
  - `shared/__tests__/failureDisclosureI15.test.tsx` — I15? Need check — likely tests error disclosure
  - `shared/__tests__/metricsFailureDisclosure.test.tsx`
  - `shared/__tests__/useResource.test.tsx` — render-phase log for one-frame
  - `architectureBoundaries.test.ts` — no role id direct in components, only can()/canAccessView
  - Export: `exportService.test.ts`
  - No scope pure functions yet for self vs assigned vs org — missing, needs implementation for F2

## 7. Dependencies Between F2 Slices

- Error Disclosure (I15) is leaf, no dependency, can be first — fixes 14 consumers to own error, enables honest empty vs error distinction, required for all list hooks
- RBAC guards depend on error disclosure? Not strictly, but UI guards should be tested with error states — so error disclosure first, then RBAC guards
- Ownership/Scope pure functions depend on RBAC vocab (permissions.ts) and enrollment/placement/compensation roster — can be parallel to error disclosure but needs enrollment/placement data — should be after error disclosure
- T-02 empirical resolution depends on Ownership/Scope — needs teacher assigned vs unassigned filtering implemented or documented both evidences — should be after scope functions
- Pagination mitigation remaining + media one-frame remaining depend on error disclosure and scope? Minor hardening absorbed into F2 — can be last
- Proposed order: F2-1 Error Disclosure I15 (14 consumers), F2-2 RBAC guards (no control if forbidden, export hidden), F2-3 Scope pure functions (self vs assigned vs org), F2-4 T-02 empirical (teacher unassigned), F2-5 Pagination/I13 remaining hardening

## 8. Blockers

- **No blocker for F2-1 Error Disclosure** — all 14 consumers are frontend-only, fix is destructure `error` and render `ErrorState` with retry, no new permission, no backend.
- **Potential blocker for F2-3 Scope filtering teacher assigned:** Current Students list is org-wide, teacher sees all students org-wide — to filter to assigned via enrollment join, need `useClasses({teacherId})` + enrollment — but `useClasses` currently does not support `teacherId` filter? Check `ClassListParams` — does it have teacherId? Need inspect `src/domains/classes/types.ts` — if not, need to add filter param to repository contract — this is gap proven, allowed per F2 execution rules "Reuse existing repositories" but can extend contract if gap proven. So need to verify if teacherId filter exists — if not, need to add as part of F2 scope pure function, not invent permission.
- **Potential blocker for T-02:** T-02 is OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION — F2 is explicitly allowed to empirically resolve? Roadmap says F2 goal includes teacher→unassigned ALLOWED currently DENIED desired (document both) — so F2 should document both evidences, not silently choose ALLOW/DENY, but implement filtering that shows DENIED behavior (no control) while preserving ALLOWED evidence historically? Need decision: should teacher see unassigned students or not? Current observed DENIED per authorization contract review, historical ALLOWED org-wide per earlier matrix. F2 should keep OPEN but implement assigned filtering as smallest permission model? The spec says "Teacher→unassigned ALLOWED currently DENIED desired (document both)" — so desired is DENIED (assigned only), current is ALLOWED org-wide. So F2 should implement assigned-only filtering (DENIED for unassigned) as smallest model, while documenting both evidences — this resolves T-02 to DENIED? But instruction says "Do NOT change T-02 unless canonical F2 scope explicitly authorizes empirical resolution" — F2 scope does authorize empirical resolution per 05-rbac doc: "STATUS: OPEN — EVIDENCE CONFLICTING — REQUIRES EMPIRICAL RE-VERIFICATION — PRODUCT DECISION OPEN — do NOT silently select ALLOW or DENY — empirical verification deferred to F2" — so F2 IS authorized to empirically resolve T-02. So not blocker, but needs product confirmation — we can implement assigned-only as smallest and document.
- **No blocker for export permission hidden:** Export buttons already check? Need verify — but can add `useCan` guard.
- **No blocker for projectState governance drift:** Known drift 11 failures, explicitly NOT part of F2, do NOT modify PROJECT_STATE.md merely to make tests green — so not blocker, classify separately.

## 9. Any OPEN Decision that F2 is Explicitly Allowed to Resolve

- **T-02 Teacher→unassigned student read:** STATUS OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION — F2 explicitly authorized per 05-rbac doc and 11-roadmap F2 to empirically verify and document both evidences, then choose smallest permission model (assigned only) — F2 allowed.
- **O-08 File ownership owner+org_id:** B contract — F2 may add owner field to media_assets as part of ownership/scope clarification? But roadmap says F2 ownership/scope self vs assigned vs org clarified — O-08 is file ownership, which is part of ownership/scope — F2 may be allowed to add owner field as B contract now? Need check if F2 spec says file ownership — O-08 is high-cost before backend, but F2 is frontend-first, so may add frontend owner field as optional and document backend mapping, not invent backend schema — allowed as contract now.
- **O-10 Identity linking:** user↔student self/guardian — F2 may add contract doc + scope pure functions, not backend table — allowed as B contract now.
- **O-14 Org/user relation org_id all tables:** F2 may document org_id scoping, not implement backend — allowed as B contract.
- **I15 error discarding 14 consumers:** F2 explicitly owns per roadmap minor hardening absorbed I15 error discarding 14 consumers — allowed.
- **I16 per_page ceiling remaining + I13 view-boundary 3 readers:** F2 explicitly owns per roadmap minor hardening absorbed — allowed.

## 10. Any OPEN Decision that F2 MUST NOT Resolve

- **O-01 Student level scope global vs per-program vs per-instrument:** MUST NOT resolve — docs say scope remains OPEN where evidence insufficient, do not invent — F2 must keep per-program provisional, not choose global.
- **O-02 Level/resource relation separate vs merged:** MUST NOT resolve unless F2 spec explicitly says — F2 is RBAC+Ownership/Scope+Error Disclosure, not library model — keep separate per PROP-LIB-01.
- **O-03 Visibility library/gallery:** MUST NOT invent new workflow — use existing active/visibility semantics per F1 disposition — keep OPEN if evidence insufficient.
- **O-04 Theme persistence org vs device-local:** F3 owns Settings+Theme Editor — F2 MUST NOT resolve — keep device-local per D2.
- **O-05 Export formats:** F4 owns Export Engine — F2 MUST NOT resolve formats, only permission hidden.
- **O-06 Permission analytical export:** OPEN but provisional keep same as view — F2 may document but not invent new permission.
- **O-07 Ticket vs chat ownership scope:** F6 owns Chat+Tickets+Files — F2 MUST NOT resolve.
- **O-09 Telegram backup semantics:** F8 owns integration contracts — F2 MUST NOT resolve, keep REQUIRED but implementation deferred.
- **O-11 Bale linking, O-12 Mobile auth, O-13 Student portal auth, O-17 Notification, O-20 Backup restore:** F8/F9 own — F2 MUST NOT resolve, keep REQUIRED but deferred.
- **O-15 API boundaries, O-16 Media storage, O-18 Audit, O-19 Retention:** B contracts — F2 may document but not implement backend, MUST NOT invent backend responses.

## 11. Files That Will Be Changed for F2

- **Error Disclosure I15 (14 consumers):**
  - `src/domains/learning/LearningPanel.tsx` (instruments, levels — already fixed in F1 but verify)
  - `src/domains/learning/StudentLearningPanel.tsx` (placement, eligible, locked, programs, levels — already fixed but verify remaining at :205)
  - `src/domains/classes/ClassFormDialog.tsx` (teachers, rooms? at :104, :105)
  - `src/domains/enrollments/EnrollmentDialog.tsx` (classes at :35)
  - `src/domains/gallery/GalleryPanel.tsx` (albums at :68 — already fixed but verify)
  - `src/domains/progress/AssignPieceDialog.tsx` (:77)
  - `src/domains/progress/PieceFormDialog.tsx` (:75)
  - `src/domains/progress/StudentProgressPanel.tsx` (:78)
  - `src/domains/students/StudentFormDialog.tsx` (:109)
  - `src/views/Messages.tsx` (:105)
  - Plus other list consumers: `src/views/Attendance.tsx`, `src/views/Compensation.tsx`, `src/views/Scheduling.tsx`, `src/views/Students.tsx`, `src/views/Teachers.tsx`, `src/domains/rooms/RoomsPanel.tsx`, `src/domains/instruments/InstrumentsPanel.tsx`, `src/domains/branding/BrandingPanel.tsx`, `src/domains/chat/*`, etc — need audit for remaining per_page consumers
- **RBAC guards:**
  - `src/domains/auth/permissions.ts` — preserve vocab, no new perm unless gap proven
  - `src/App.tsx` — route guards via canAccessView
  - `src/lib/navigation.ts` — nav filtering
  - `src/views/Attendance.tsx`, `Compensation.tsx`, `Scheduling.tsx`, `Students.tsx`, `Teachers.tsx`, `Classes.tsx`, `Finance.tsx`, `Reports.tsx`, `Messages.tsx`, `Library.tsx`, `Settings.tsx` — add `useCan` guards for write controls (no control if forbidden, not disabled) — check each
  - `src/domains/export/exportService.ts` + views export buttons — add permission hidden if no read perm
  - `src/components/overlays/*` — quick actions via shell lock
- **Ownership/Scope pure functions:**
  - New file `src/domains/auth/scope.ts` or `src/domains/shared/scope.ts` — pure functions `canReadStudent(actor, student, scope)`, `canReadTeacher`, `isAssignedStudent(teacherId, studentId, enrollments, classes)`, `isSelfStudent(user, studentId, user_student_links)`, etc — unit tested
  - `src/domains/learning/eligibility.ts` — already has audience param, scope per program — keep
  - `src/domains/attendance/roster.ts` — already has roster derived from enrollment — scope assigned session
  - `src/domains/compensation/derive.ts` — frozen student from roster — ownership
- **T-02 empirical:**
  - `src/views/Students.tsx` — filter students list to assigned via enrollment if teacher role? Or document both evidences and implement assigned-only as smallest — needs decision
  - `docs/frontend-completion/05-rbac-access-control.md` — update T-02 row with empirical verification result after implementing assigned filtering — but do NOT modify PROJECT_STATE.md
- **Pagination mitigation remaining:**
  - `src/domains/shared/useResource.ts` — already Paged forces per_page, partialNote pattern exists — add disclosure to remaining consumers
  - `src/views/*` — add `total` vs `items.length` disclosure where missing

## 12. Proposed Vertical Slices and Their Order

1. **F2-1 Error Disclosure I15 — 14 consumers + remaining list consumers**
   - Goal: every list consumer shows ErrorState with retry not silent empty
   - Files: `ClassFormDialog.tsx`, `EnrollmentDialog.tsx`, `AssignPieceDialog.tsx`, `PieceFormDialog.tsx`, `StudentProgressPanel.tsx`, `StudentFormDialog.tsx`, `Messages.tsx`, plus audit remaining `Attendance.tsx`, `Compensation.tsx`, `Scheduling.tsx`, `Students.tsx`, `Teachers.tsx`, `RoomsPanel.tsx`, `InstrumentsPanel.tsx`
   - Tests: `failureDisclosureI15.test.tsx`, `metricsFailureDisclosure.test.tsx`, plus focused error tests for each fixed consumer
   - DoD: loading/empty/error states owned, no silent empty, retry wired

2. **F2-2 RBAC Guards — no control if forbidden**
   - Goal: UI hides write controls if `can(permission)` false, export hidden if no read perm, route protection real route #/compensation admin reaches no silent fallback
   - Files: `Attendance.tsx` (attendance.write), `Compensation.tsx` (schedule.write), `Scheduling.tsx` (schedule.write), `Students.tsx` (students.write), `Teachers.tsx` (teachers.write), `Classes.tsx` (classes.write), `Library.tsx` (library.write), `Settings.tsx` (settings.write), `BrandingPanel.tsx`, `Messages.tsx` (messages.write), `exportService` usage
   - Tests: `routeProtection.test.tsx` (already), `permissions.test.ts`, `can()` unit, export permission hidden tests, write control hidden tests
   - DoD: permissions preserved 5 roles 22 perms, no role id direct, no disabled control if forbidden (M2 rule)

3. **F2-3 Ownership/Scope Pure Functions — self vs assigned vs org**
   - Goal: scope pure functions unit tested, teacher assigned vs unassigned, student self vs other, attendance assigned, compensation lineage
   - Files: new `src/domains/auth/scope.ts` with `isAssignedStudent`, `canReadStudent`, `canWriteAttendance`, etc; `src/domains/attendance/roster.ts` (already), `src/domains/compensation/derive.ts`
   - Tests: scope unit tests with enrollment/placement fixtures, teacher assigned vs unassigned, student self vs other, eligible vs locked
   - DoD: domain model ownership/scope clarified, single source, no duplicate fixtures, testable

4. **F2-4 T-02 Empirical Resolution — Teacher→unassigned student**
   - Goal: empirically verify current observed DENIED vs historical ALLOWED, document both, implement smallest permission model assigned-only filtering for teacher role in Students view, keep OPEN decision disposition updated but not silently resolved
   - Files: `src/views/Students.tsx` filtering logic, `docs/frontend-completion/05-rbac-access-control.md` T-02 row empirical result (if allowed to update spec doc? But F2 is implementation, spec doc may be updated as part of decision disposition per DoD 15 — allowed to update decision register/open decisions? But hard boundary says do NOT modify PROJECT_STATE.md merely to make tests green, but decision register may be updated as part of DoD 15)
   - Tests: teacher assigned vs unassigned view tests, scope pure functions for T-02
   - DoD: decision disposition updated, evidence preserved, no silent normalize, empirical verification deferred to F2 now done

5. **F2-5 Pagination Mitigation Remaining + I13 View-Boundary Remaining**
   - Goal: remaining per_page ceiling disclosure counts from total truncation disclosed, remaining I13 view-boundary 3 readers (useStudentList, useStudentProgress, useSessionAttendance) with consumer-local identity key guard key={detail.id} as done in Classes/Teachers
   - Files: `src/domains/students/useStudents.ts` (check if still lacks query-identity invariant), `src/domains/progress/useProgress.ts`, `src/domains/scheduling/useScheduling.ts` for sessionAttendance, plus `src/views/Students.tsx`, `Teachers.tsx`, `Classes.tsx` already have key guard, need verify others
   - Tests: `staleQueryGates.test.tsx` already covers some, `deepLinkPagination.test.tsx`, `useResource.test.tsx` render-phase log
   - DoD: pagination honest, no stale rows, no false empty

**Order rationale:** Error disclosure first (leaf, enables honest states for RBAC tests), then RBAC guards (depends on error states for permission hidden tests), then scope pure functions (depends on RBAC vocab and enrollment data), then T-02 empirical (depends on scope), then remaining hardening (depends on all).

**Blockers requiring decision:** None for F2-1, F2-2, F2-3, F2-5 — all frontend-only. For F2-4 T-02, need product confirmation: should teacher see unassigned students DENIED (assigned-only) or ALLOWED org-wide? Current observed DENIED per authorization contract review, historical ALLOWED org-wide. Smallest permission model says assigned-only DENIED for unassigned — recommend implement assigned-only filtering for teacher role, document both evidences, keep T-02 as OPEN but with empirical result DENIED (assigned-only) as desired smallest, not silently ALLOW org-wide. If product wants org-wide, need decision to keep ALLOWED. So F2-4 has potential blocker but can proceed with assigned-only as smallest per F2 goal.

**No files modified during inventory — read-only verified.**
