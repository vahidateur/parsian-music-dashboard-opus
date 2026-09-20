# 01 — Audit Reconstruction (Read-Only)

> Evidence labels: VERIFIED = inspected code, DOCUMENTED = cited from docs/engineering, INFERRED = logically implied but not directly observed, OPEN = gap requires decision.

## Verified Base

- Branch HEAD `02b74996` clean, docs-only descendant of frozen `a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb` — VERIFIED via git log
- Stack Vite + React 19 + TS strict + Tailwind v4 + Vitest — DOCUMENTED
- Registry `src/domains/registry.ts`: 7 API-backed (students/teachers/rooms/classes/enrollments/auth/users) + 11 DEMO_SERVED_DOMAINS (instruments/learning/chat/media/library/branding/gallery/progress/scheduling/attendance/compensation) — VERIFIED
- `DEMO_SERVED_DOMAINS` single enumeration consumed by `DemoBackedNotice` — VERIFIED D8
- Navigation `src/lib/navigation.ts`: 13 views (dashboard/students/teachers/classes/schedule/attendance/compensation/finance/reports/messages/library/settings/design-system) — VERIFIED
- RBAC `src/domains/auth/permissions.ts`: 5 ROLES (administrator/manager/teacher/staff/accountant), 22 PERMISSIONS, rolePermissions matrix, viewPermissions UX-only — VERIFIED
- Demo lifecycle: UNINITIALIZED → {EMPTY|DEMO} via `ava:demo:lifecycle`, reads never write, EMPTY usable with bootstrap admin at lifecycle layer — DOCUMENTED D4/D5
- Media: metadata in dataset, bytes in IndexedDB blobStore, never fabricated URL — VERIFIED `useMediaObjectUrl`

## Domain Audit

### Students
- Types `Student` photoMediaId, balance, instrument, level, since — VERIFIED
- Repository API+Demo, hooks `useStudentList` constant params `per_page:200` (not Paged<> — I16) — VERIFIED
- FormDialog uses `useEntityForm` with open sync (M2.1) — VERIFIED
- Detail surface shows relations via enrollment, not fixture `studentIds` — VERIFIED M7
- Deep-link via `get(id)` authoritative beyond 200 — VERIFIED M-5

### Teachers
- Types Teacher photoMediaId contract, weeklyHours, contractHours — VERIFIED
- Relations via classes/rooms/students through bounded reads — VERIFIED M7
- Photo via Media/ProfilePhotoField — VERIFIED M-2

### Classes
- Types AcademyClass kind private/group, capacity, enrolled denormalized — VERIFIED D17
- Repository API+Demo
- Detail roster from Enrollment canonical, not `studentIds` — VERIFIED
- Deep-link capped list `find` without `get(id)` — VERIFIED OPEN deferred at freeze (Classes.tsx:678)
- EnrollmentDialog, ClassFormDialog — VERIFIED M-1

### Scheduling
- Domain complete Group A 211 tests: Session materialized, not computed, no students[] no conflictWith, dateBridge Jalali edge — VERIFIED D11
- View wired at M4: reads via `useSessions` bounded from/to window, writes reschedule/cancel/generation awaited — VERIFIED
- 5 verbs unconsumed: get/create/update/delete/sessionRoster — DOCUMENTED
- Page size `Paged<SessionListParams>` per_page required — VERIFIED C2

### Attendance
- Domain Group D 79 tests: append-only, roster derived from Enrollment, atomic bulk, correction reason required — VERIFIED D12
- View wired at M5: reads useSessions/useSessionAttendance/useAttendanceRecords/useAttendanceCorrections, writes record/bulkRecord/correct awaited, provenance user?.id, RBAC canWrite = attendance.write + non-null principal — VERIFIED
- Mitigation for I13: view guards `attendance.sessionId === selectedSessionId` because `useSessionAttendance` still no query key — VERIFIED
- 7 bounded reads each per_page explicit, counts from total, truncation disclosed — VERIFIED I16 mitigation

### Compensation (make-up obligations)
- Domain 121 tests: obligation entity own collection, typed originalSessionId, derived state required→scheduled→completed, append-only attempt ledger, frozen student from sessionRoster, eligibility kind private only, explicit registration by schedule.write actor (client-side), prefill one hour same day — VERIFIED D18/D19/D20
- Surface CompensationView wired secretary surface with dialogs, RBAC schedule.read to see, schedule.write to register/schedule/complete — VERIFIED
- No apiRepository, demo seeds no compensable case, no free-slot search — VERIFIED I20

### Learning / Progress / Placement
- Learning types: Instrument → Program (per instrument) → Level order 1..N per program, not global, Content exists once linked via LevelContentLink sortOrder, StudentPlacement one active per (student,program) history — VERIFIED
- Eligibility pure function `resolveEligibleContent`: levels of student's program whose order <= current level order (cumulative), exclusive overrides exact only, active filter, visibility students vs teachers, lowest reachable attribution — VERIFIED `eligibility.ts`
- Owner: learning domain owns programs/levels/links/content types, placement history; progress owns pieces/assignments/events — VERIFIED D5 finalization
- LevelContentPanel assigns content to level via attachContent/detachContent with AttachContentIntent programId independently resolved — VERIFIED D10/D11
- LearningPanel mounts outside levels grid, derives selection — VERIFIED
- Gaps: detach no stale guard, per_page 200 ceiling, sortOrder invisible in assignment UI, 14 list consumers discard error (I15), no student portal role — DOCUMENTED

### Library
- Types: Resource extends catalogue shape, ResourceKind sheet/audio/video/doc, LibraryItem mediaId? createdAt, file status none/loading/ready/missing — VERIFIED
- Repository demo+api (api declared but demo served both modes), hooks useLibraryList/useLibraryFile — VERIFIED
- View Library.tsx: shelves presentation config owned by view (M10), counts derived live, download real bytes via media hook, missing bytes honest — VERIFIED Phase1+M10
- Search/filter by kind/instrument, sort, preview via useMediaObjectUrl, locked state for unavailable — VERIFIED
- Demo persistence via DemoStore resources collection, blob via blobStore — VERIFIED
- API seam: buildExportTable reads repo, serializeTable pure, downloadBlob seam — VERIFIED but library not in ExportEntity (see export doc)

### Gallery
- Types GalleryAlbum, GalleryImage with mediaId, sortOrder, alt required a11y — VERIFIED
- Repository demo both modes, hooks useGallery — VERIFIED
- Panel GalleryPanel reads albums/images via repos, no fixture thumbnails — VERIFIED post-M10
- Genuine vs shallow: albums genuine if they have images backed by media domain, metadata title/description/coverMediaId, filtering by album, ordering by sortOrder, visibility public (demo all visible) — INFERRED, needs spec (see doc 06)
- Storage seam: metadata dataset, bytes blobStore, same as library/media — VERIFIED
- No deep fake: no fabricated occupancy figure — VERIFIED M7 removal

### Branding / Settings
- Branding types: academyName, tagline, logoMediaId/faviconMediaId MediaAsset.id ref never data URL, primaryColor/accentColor/textColor hex #RRGGBB, persianFont from PERSIAN_FONTS allow-list, updatedAt — VERIFIED
- Repository demo both modes, useBranding hook — VERIFIED
- Application: BrandingApplication mounted in App.tsx below lifecycle gate above AuthProvider, CSS vars --brand-* consumed by design tokens in index.css with fallback pre-branding values — VERIFIED M8
- Shell Sidebar and Login read branding.academyName/tagline — VERIFIED
- Hero uses useBranding + useAuth (M10) — VERIFIED, no BrandingSettings persistence change
- Appearance theme: device-local per-browser preference (ava:theme, ava:accent etc) via savePref, not org data — DOCUMENTED D2
- Settings view: 13 sections? Actually settingsSections presentation config owned by view — VERIFIED M10
- Honesty: notification toggles 7 disabled, localization 6 selects disabled, working-hours 4 inputs + Friday toggle disabled "— غیرفعال", session rules disabled, all with explicit deferral Surfaces stating server required — VERIFIED M-6
- Toggle component disabled prop — VERIFIED

### Dashboard
- Views Dashboard.tsx reads useAcademyMetrics + useDashboardInsights — VERIFIED M9
- Insights derived live: at-risk count mean attendance from student rows sessionsTotal>0, sessions/cancellations from bounded useSessions window, overdue balances/waitlists from students/classes, today's rows labels from sessions/classes/rooms/teachers, receivables from Student.balance, growth from since, occupancy from seats/weekdays, instrument mix from instrument — VERIFIED dashboardInsights.ts
- Empty guards: Sparkline readonly number[]|null, Delta number|null, NO_DATA glyph — VERIFIED I9
- EMPTY renders every panel with «داده‌ای نیست», no NaN/Infinity, no retired fixture sentences — VERIFIED M9 suites
- Revenue chart removed because Finance domain README-only, invoices/payments no repository — VERIFIED D6/I2
- Export: no analytical export yet, only student/teacher/classes/enrollments CSV/XLSX — VERIFIED

### Finance / Reports
- Views FinanceView, ReportsView explicitly deferred surfaces with Panel stating D6/I2, no domain read — VERIFIED M10
- Deferral ledger src/lib/financeReportsDeferral.ts classifies every retired export — VERIFIED
- Boundary gate m10Boundary 13/13 enforces deferred-surface honesty — VERIFIED

### Communication: Tickets/Chat/Files
- Chat domain: MessageProvider in_app|telegram|bale|sms|email, MessageStatus sent/queued/unavailable/failed, ChatConversation with unread, archived, ChatMessage mediaId? — VERIFIED
- Repository demo both modes, no apiRepository, provider in_app genuinely persists, others unavailable — VERIFIED delivery honesty §37
- Hooks useChat — VERIFIED
- View Messages.tsx: conversation list, management rename/topic/pin/archive, filter includeArchived, composer conversation-keyed useComposer (draft not follow between threads), attachments via media seam two awaited writes Media.create then Chat.sendMessage, duplicate-submit guard, asset release on failed message write, missing bytes honest, export single-conversation plain-text via getConversation+listMessages no export verb, download via export domain downloadBlob, metadata only no bytes, ceiling 1000 disclosed — VERIFIED M6
- No tickets vs chat distinction currently — chat is tickets; needs decision — OPEN
- File ownership: message mediaId reference, resolution != authorization, backend-required — VERIFIED D15
- Unread/read scope: unread count per conversation from repo, summed for nav badge only while complete — VERIFIED M7

### Auth / Users / Ownership / Scope
- AuthRepository demo+api, UserRepository — VERIFIED
- Types User with role, permissions derived — VERIFIED
- Demo auth demoAuthRepository lists demo accounts, DEMO_PASSPHRASE visible — VERIFIED
- LoginView outside shell, shows passphrase, lifecycle recovery panel outside shell for EMPTY/DEMO local only — VERIFIED M1
- Ownership: student/teacher/class records have no owner field, but enrollment links student/class, placement links student/program — INFERRED ownership is enrollment-based scope, not user ownership yet
- Scope: self vs assigned vs org — currently org-wide read if permission present, teacher sees all students (not just assigned) — VERIFIED via rolePermissions (teacher has students.read)
- Future student portal needs identity linking student ↔ user — OPEN

### Integration Adapters

#### Telegram
- Currently honest info toast "requires server" in Messages — VERIFIED
- Provider enum includes telegram, status unavailable when selected — VERIFIED
- No Telegram bot research doc exists — DOCUMENTED I7
- Two use cases conflated: backup provider vs student access — needs separation — OPEN per task

#### Bale
- Same as Telegram, enum includes bale — VERIFIED
- No adapter abstraction yet, Core->Adapter->Telegram/Bale desired — INFERRED desired, not existing

#### Mobile
- No mobile app, but registry seam ready for API mode — VERIFIED
- Mobile would be client of same backend contracts — INFERRED

#### Student Portal
- Deferred D1, no student role — DOCUMENTED
- Would need profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files — OPEN per task
- Communication demo vs backend identity: currently single-viewer demo, no per-user read cursor — VERIFIED

## Cross-Cutting

- API envelope: Collection/Item, PageMeta, error kinds 401/403/404/409/422/5xx — VERIFIED `src/api/`
- RTL: dir=rtl lang=fa, Persian labels, Vazirmatn font — VERIFIED
- A11y: focus-trap, Escape, return focus, reduced-motion, role+name — VERIFIED D7/M-1
- Export: CSV via toCsv with BOM? Actually text/csv;charset=utf-8, XLSX via toXlsx, safeFilename, column lists explicit, no credential leakage — VERIFIED
- Compensation lineage safety via currentAttempt.sessionId never bookedSessionId — VERIFIED
- No fixture imports in views/components except comments — VERIFIED M10 boundary

## Residual Open (summary)

- I13 remaining 2 hand-rolled readers (useStudentList, useStudentProgress) + useSessionAttendance reachable but mitigated, useLibraryFile, useMediaObjectUrl one-frame exposures
- I14 paginate per_page 0 → 1 row trap
- I15 14 consumers discard error
- I16 per_page 200 ceiling global, counts from items.length in many places
- I2 Finance/Reports no domain
- I7 Telegram/Bale research missing
- I8 backup envelope always demo
- I18 group/class-wide compensation unbuilt
- I20 compensation no apiRepository, no seeded case, no server
- L1 palette substring loose
- L2 TeacherNote dead code
- L4 browser QA NOT VERIFIED
- L6 attendance view header false claims (9 vs 8 registers, domain since M1 vs Phase A)
- L7 demo-data.md names src/data/ as source (dissolved at M10)
- Classes deep-link beyond capped list find without get
- Notification/localization/working-hours/session-rules server wiring deferred M-6
- Free-slot search not built

## Classification Pre-Work

From audit, candidate A FRONTEND-COMPLETABLE NOW:
- Learning access policy enforcement (already implemented but needs canonical spec + UI hardening)
- Library resource model honest states (already mostly, but filter/sort/preview/locked/metadata workflow spec)
- Gallery genuine audit (spec + UI if needed)
- Settings/theme token architecture (branding applied + appearance device-local; org vs device-local schema needs spec, but UI already)
- Export mechanism reusable for students/teachers (already exists, needs extension to other entities + RTL filename)
- Dashboard analytics raw->derivation (already M9, but export reuse needs spec)
- RBAC UI guards (already, but needs matrix doc + self vs assigned vs org clarification)
- Student portal architecture doc (contract only)
- Tickets/chat/files topology doc (contract only)

Candidate B CONTRACT NOW BACKEND LATER:
- Library create/update/delete with mediaId (contract ready, backend storage/signing needed)
- Gallery upload
- Branding org persistence (currently demo dataset, needs Laravel org table)
- Theme org persistence (currently device-local, should stay device-local per D2 — needs decision)
- Export large-dataset server boundary, permission, columns
- Dashboard date-range filtering, aggregation tabular summary
- RBAC backend enforcement (frontend UX-only)
- Student portal auth, identity linking
- Telegram/Bale adapters, mobile contracts
- Media abstraction storage provider

Candidate C EXPLICITLY DEFERRED:
- Finance/Reports domain implementation (D6/I2)
- Notification server wiring
- Free-slot search
- Automatic completion of elapsed sessions
- Group/class-wide compensation coordination flow

Evidence for classification to be in 02-capability-matrix.
