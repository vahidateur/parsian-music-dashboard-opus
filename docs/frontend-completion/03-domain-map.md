# 03 — Canonical Domain Map — CORRECTED 2026-09-19

> **Governance status pointer — 2026-09-21 (documentation reconciliation).** The two dated header notes below are
> the F0 / 2026-09-19 snapshot and are kept verbatim. Their `RBAC T-02 OPEN … PRODUCT DECISION OPEN` and learning-scope
> `OPEN` wording is superseded: `T-02` is **ACCEPTED / ASSIGNED-ONLY** and `O-01` is **DECIDED 2026-09-21 — PER-PROGRAM**
> per [`docs/engineering/GOVERNANCE_CHECKPOINT.md`](../engineering/GOVERNANCE_CHECKPOINT.md).

> One owner per rule, one source per concept. No unjustified relations. CURRENT_BRANCH `arena/frontend-completion-spec` CURRENT_HEAD `a251e6942b2a645987286de6e822607554e84df9` = `a251e69` (actual Git HEAD before this F1-KICKOFF correction, frozen `a3867a6` descendant) PLANNING_CHECKPOINT `e57bf1922e4ca3b80796715028445cfe8a077c9c` = `e57bf19` PREVIOUS_PLANNING_CHECKPOINT `c244fec142fcc35faff8e8548c8ebbc05cb53bf5` = `c244fec` historical only PREVIOUS_CORRECTION_COMMITS `a251e6942b2a645987286de6e822607554e84df9` = `9695097` documentation-only NOT planning milestone spec `docs/frontend-completion/` v14 @ `e57bf19` planning checkpoint + corrections + SHA semantics correction PR #4 F0 COMPLETE + corrections + SHA semantics correction F1 NEXT — SHA semantics no longer ambiguous: CURRENT_HEAD = actual Git HEAD (9695097 before this correction), PLANNING_CHECKPOINT = last planning checkpoint (e57bf19), PREVIOUS_PLANNING_CHECKPOINT = historical only (c244fec), PREVIOUS_CORRECTION_COMMITS = documentation-only NOT planning milestone (9695097) — classification correction Telegram backup/student access/Bale/Mobile = REQUIRED PRODUCT CAPABILITY IMPLEMENTATION deferred until backend/integration layer exists — learning scope OPEN global vs per-program vs per-instrument do not invent O-01 — canonical Level N=>1..N owner learning/eligibility.ts — RBAC T-02 OPEN CURRENT OBSERVED DENIED PRODUCT DECISION OPEN — NEXT ACTION exactly ONE F1 — do NOT change product decisions

> **CORRECTION 2026-09-19:** Learning access scope decision remains OPEN global vs per-program vs per-instrument where evidence insufficient do not invent — O-01 — canonical rule student Level N → access 1..N owner learning/eligibility.ts named states eligible/locked/not_visible/not_found/not_applicable preserved — current implementation per-program provisional — see 04-learning-access-policy.md corrected. Classification correction Telegram backup/student access/Bale/Mobile = REQUIRED PRODUCT CAPABILITY — see 10-integration-architecture.md.

## Domain List

| Domain | Owner file(s) | Source of truth | Demo repo | API repo | Registry getter | Demo in both modes? | Relations |
|---|---|---|---|---|---|---|---|
| students | src/domains/students/types.ts | students/types.ts | DemoStudentRepository | ApiStudentRepository | getStudentRepository | no — mode-switched | Enrollment (student→class), Placement (student→program/level), PieceAssignment, Attendance (via roster) |
| teachers | teachers/types.ts | teachers/types.ts | Demo | Api | getTeacherRepository | no | Classes (teacher→class), Rooms via classes, Students via enrollments |
| rooms | rooms/types.ts | rooms/types.ts | Demo | Api | getRoomRepository | no | Classes (room→class), Sessions (room→session) |
| classes | classes/types.ts | classes/types.ts | Demo | Api | getClassRepository | no | Teacher, Room, Enrollments, Sessions |
| enrollments | enrollments/types.ts | enrollments/types.ts | Demo | Api | getEnrollmentRepository | no | Student↔Class canonical edge, pricingPlan |
| instruments | instruments/types.ts + catalog.ts | instruments/types.ts | Demo only | none | getInstrumentRepository | yes | LearningProgram.instrumentId, Student.instrument, Teacher.instrument, Library.instrument |
| learning | learning/types.ts + eligibility.ts | learning/types.ts | Demo only | none | getLearningRepository | yes | Program→Level order per program, Level↔Content via Link, Placement per (student,program) |
| progress | progress/types.ts | progress/types.ts | Demo only | none | getProgressRepository | yes | Piece instrument/program, Assignment student/piece/teacher, Events assignment |
| library | library/types.ts | library/types.ts | Demo only | Api declared but unregistered (binary client needed) | getLibraryRepository | yes | Media via mediaId, Instrument, Level string (not relation) |
| gallery | gallery/types.ts | gallery/types.ts | Demo only | none | getGalleryRepository | yes | Media via mediaId, Album→Image |
| branding | branding/types.ts | branding/types.ts | Demo only | none | getBrandingRepository | yes | Media logo/favicon via mediaId |
| media | media/types.ts | media/types.ts | Demo only | none | getMediaRepository | yes | None — leaf, but referenced by 6 domains |
| chat | chat/types.ts | chat/types.ts | Demo only | none | getChatRepository | yes | Media via mediaId, subjectId optional student/teacher |
| scheduling | scheduling/types.ts + generation.ts + conflicts.ts + dateBridge.ts | scheduling/types.ts | Demo only (api exists unregistered) | Api exists unregistered | getSchedulingRepository | yes | Classes, Rooms, Teachers, Attendance presence provider |
| attendance | attendance/types.ts + roster.ts | attendance/types.ts | Demo only | Api exists unregistered | getAttendanceRepository | yes | Sessions (via scheduling), Enrollments (roster), Students |
| compensation | compensation/types.ts + derive.ts | compensation/types.ts | Demo only, no apiRepo | none | getCompensationRepository | yes | Scheduling (create session, roster), Attendance (mark exists), Students, Classes |
| auth | auth/types.ts + permissions.ts | auth/permissions.ts | Demo | Api | getAuthRepository/getUserRepository | no | Users, Roles |
| export | export/exportService.ts | exportService.ts | reads repos | — | — | — | Students/teachers/classes/enrollments (reads) |
| demo | demo/types.ts + academySeed.ts + lifecycle.ts | demo/types.ts | — | — | — | — | All demo collections, lifecycle marker, blobStore |
| shared | shared/* + lib/navigation.ts + lib/viewContracts.ts | navigation.ts, viewContracts.ts | — | — | — | — | ViewId, NavDef, useResource, useDerived, Paged |

## Ownership Rules (D5 Finalized)

- Category A — domain/entity types live with their domain (Student→students, Teacher→teachers, etc). No duplicate types.
- Category B — canonical DEMO seed at src/domains/demo/academySeed.ts (data unchanged), consumed only by demo layer.
- Category C — fabricated UI data/measurements removed, classified in financeReportsDeferral.ts, tombstoned.
- Category D — static vocabulary/config named single owners: navigation.ts (navGroups/viewTitles), viewContracts.ts, financeVocabulary.ts, weekdays.ts, composerTemplates.ts, commands.ts, samples.ts.

## Relationships — Canonical vs Denormalized

| Relation | Canonical | Denormalized (forbidden in views) | Enforced by |
|---|---|---|---|
| Student ↔ Class | Enrollment rows active scoped to date | AcademyClass.studentIds, AcademyClass.enrolled | relationsNoFixtures gate, D17 |
| Student → Teacher | Enrollment → Class → Teacher | teacherById resolver from fixture | same |
| Class → Room | Class.roomId → Room repo | roomById fixture | same |
| Session → Class/Room/Teacher | Session classId/roomId/teacherId → repos | weekSessions fixture | schedulingNoFixtures |
| Attendance roster | Attendance domain derived roster from Enrollment | todayAttendance fixture | attendanceNoFixtures |
| Placement → Program/Level | StudentPlacement programId/levelId → learning repo | — | learning tests |
| Level → Content | LevelContentLink | — | eligibility.ts pure |
| Library → Media | mediaId → media repo | — | useLibraryFile |
| Gallery → Media | mediaId → media repo | — | useGallery |
| Branding → Media | logoMediaId/faviconMediaId → media repo | data URL forbidden | branding types |
| Compensation → Session | originalSessionId typed, currentAttempt.sessionId lineage | bookedSessionId forbidden | compensationNoFixtures gate |
| Nav badge counts | Repo total (chat unread) while complete | NavDef.badge static | navigationCounts |

## Lifecycle

| Entity | Create | Read | Update | Delete | Special |
|---|---|---|---|---|---|
| Student | repo.create | list/get | update | archive (soft) | photo via media |
| Teacher | same | same | same | — | same |
| Class | same | same | same | archive | enrollment manages roster |
| Enrollment | create | list | update status/dates | — | pricingPlan |
| Session | scheduling create (manual) + generateSessions (materialized) | list bounded from/to, get (unconsumed) | update marks manual, reschedule = cancel+create linked, cancel with reason | delete unconsumed (hard delete only if no attendance) | conflicts.ts, generation.ts, dateBridge Jalali edge |
| Attendance record | record/bulkRecord | list bounded, useSessionAttendance derived register | correct appends immutable correction with reason | no un-record/edit/delete (append-only) | roster.ts, presence provider |
| Compensation obligation | register explicit by schedule.write | list/get | schedule (creates session via scheduling create), complete | no reopen verb (terminal) | derived state, attempt ledger append-only, lineage via reschedule |
| Learning Program/Level/Content/Link/Placement | create | list/get | update | delete | attachContent intent guard, eligibility pure |
| Piece/Assignment/Event | create | list | update status | — | progress domain |
| Library Item | create via media first then library | list/get | update | delete | file status none/loading/ready/missing |
| Gallery Album/Image | create | list | update | delete | alt required |
| Media Asset | create (bytes+metadata) | list/get + useMediaObjectUrl | — | delete | validation allow-list, size ceiling |
| Chat Conversation/Message | createConversation/sendMessage | list/get | updateConversation (rename/topic/pin/archived) archiveConversation delegates | — | provider in_app only deliverable, mediaId ref |
| Branding | — | get (single record) | update | — | hex strict, font allow-list, CSS vars |

## Read/Write Seams

- All views → domain hooks → repository interface → registry getter → demo or api impl
- Demo impl → DemoStore (dataset) + blobStore (bytes) single persistence authority
- API impl → ApiClient (baseUrl, Bearer token, envelope Collection/Item PageMeta, error kinds)
- Cross-domain reads → other domain's hook, never store import
- Scheduling ↔ Attendance narrow boundary: attendancePresence() returns ReadonlySet<string>|undefined fail-safe
- Compensation composes scheduling + attendance via interfaces, honoring overrides
- Export reads repos, serializes via toCsv/toXlsx, downloads via downloadBlob (single seam)
- Branding application writes CSSOM via applyBranding, style-src self + style-src-attr unsafe-inline narrow exception

## API Envelope (VERIFIED)

- Collection: { data: T[], meta: PageMeta }
- Item: { data: T }
- PageMeta: { total, per_page, current_page? }
- Error: ApiError kind 401/403/404/409/422/5xx + message + fields?, apiErrorFromThrown maps
- ListParams: { page?, per_page?, search? } + domain-specific, Paged<> makes per_page required compile-time for scheduling/attendance

## Unjustified Relations Marked

- Student.photoMediaId → MediaAsset is justified (shared media mechanism)
- Class.studentIds is NOT justified as source — only display projection, forbidden in views
- Library.level string not relation — gap, should be levelId? But level is string display label, not relation — INFERRED gap, needs decision: keep string as vocabulary or link to LearningLevel? See open decisions.
- Gallery no visibility field — currently all visible demo, needs org visibility? OPEN

## Backend Boundary Clean

- Frontend freeze precedes Laravel
- No backend in repo, api mode seam only
- Demo served both modes 11 domains disclosed via DEMO_SERVED_DOMAINS + DemoBackedNotice persistent non-dismissable api-mode-only health-claim-free
- Server must enforce: org_id scoping, authz, transactional conflicts, append-only grants, money precision, media signed URLs + scanning
