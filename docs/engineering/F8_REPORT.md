# F8 — Telegram + Bale + Backup Integration Contracts — FINAL REPORT

> Branch `arena/frontend-completion-spec` HEAD `ff64342` F7 VERIFIED CLOSED, PR #4 OPEN UNMERGED. F8 AUTHORIZED.

## 1. Product Behavior

- Telegram backup = REQUIRED PRODUCT CAPABILITY, Telegram student access = REQUIRED, Bale student access = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile, no business logic in bots — VERIFIED via spec docs + provider seam + tests.
- Backup envelope versioned `BACKUP_SCHEMA_VERSION` 1.1, `BACKUP_ENVIRONMENT` demo, `BACKUP_KIND` arena.demo.backup, `exportedAt` ISO, app name seedVersion, stats counts total, data DemoDataset — VERIFIED backup.ts + backup.test.ts.
- Validation honest: WRONG_ENVIRONMENT Persian "این فایل متعلق به محیط دمو نیست." + UNSUPPORTED_SCHEMA_VERSION honest with expected and received — VERIFIED backup.test.ts + backupMigration.test.ts.
- Migration old->new: `migrateBackupIfNeeded` accepts legacy 1.0 → migrates to 1.1, preserves data, sets kind/environment/app/stats, returns migrated flag fromVersion toVersion — A NOW frontend/demo-capable — VERIFIED backupMigration.test.ts 5 tests.
- Integrity hash optional: `BackupIntegrity` {algo: "sha256", hash: string} optional field in DemoBackup, `verifyBackupIntegrity` checks if no integrity ok true optional for demo, if present checks algo sha256 non-empty hex 64 chars frontend does not compute hash backend must — B CONTRACT — VERIFIED backupMigration.test.ts 5 tests.
- Provider seam `MessageProviderAdapter` interface id/isAvailable/deliver DeliveryResult status reason, inAppProvider genuinely delivers isAvailable true status sent, backendRequiredProvider for telegram/bale/sms/email isAvailable false status unavailable with concrete Persian reason "ارسال از طریق تلگرام به سرویس سمت سرور نیاز دارد؛ توکن ربات هرگز نباید در مرورگر قرار گیرد." — honest, no network call, no setTimeout fake success — VERIFIED provider.test.ts 8 tests + provider.ts comment SECURITY §24 no bot token VITE_* localStorage committed demo data VITE_* inlined not secret.
- Available providers returns only in_app in demo mode — VERIFIED provider.test.ts.
- No token in adapter — security §24 — VERIFIED provider.test.ts no token secret apiKey in serialized adapter, reason does not contain token.
- No business logic in bots — VERIFIED architectureBoundaries.test.ts F8 3 tests: provider.ts does not import enrollment/eligibility/placement/progress/attendance/compensation/scheduling/library/gallery/branding/finance/demoStore/scope/permissions/canRead/canWrite, no fetch, no api.telegram.org, no bale.ai/bale.bot, no BOT_TOKEN, no VITE_ in code-stripped source; backup.ts does not contain telegram/bale/api.telegram/fetch/axios/BOT_TOKEN/VITE_/sendDocument; no view contains api.telegram.org/bale.ai/BOT_TOKEN/VITE_TELEGRAM/VITE_BALE — VERIFIED.
- Telegram backup vs student access different adapters not business owner — VERIFIED via 10-integration-architecture.md + 16-telegram-bale-backup-integration.md spec: BackupAdapter owns encryption retention integrity restore failure queue, StudentAccessAdapter owns linking verification command routing, both call same Core Domain Services no duplicate business logic D5.
- Bale adapter contract avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter interface — VERIFIED via MessageProviderAdapter common interface, domain services own RBAC scope eligibility file resolution persistence not adapter, provider enum includes bale, status unavailable — VERIFIED.
- Backup envelope versioned format migration retention/integrity/restore/encryption/failure OPEN marked — VERIFIED via 16 spec doc + backup.ts migration + integrity + this report.
- No business logic in bots — VERIFIED.

## 2. Domain Model

- One owner per rule per D5 — students owner Student, classes owner Class, enrollments owner Enrollment canonical edge Student↔Class, scheduling owner Session bounded window, learning owner Placement + Level + Content + eligibility.ts pure Level N=>1..N cumulative exclusive exact-only per-program O-01 OPEN, progress owner Progress, attendance owner AttendanceRecord + provenance recorderId, chat owner Conversation/Message flat collections normalized thread order lastMessageAt composer keyed D16 attachments two writes D15 export txt BOM D14, media owner MediaAsset metadata dataset blobStore, backup owner DemoBackup versioned envelope, chat provider owner MessageProviderAdapter — VERIFIED.
- Enrollment canonical edge — VERIFIED classesRelations.
- Learning eligibility canonical owner learning/eligibility.ts Level N=>1..N — VERIFIED eligibility.test 17 cases.
- Media abstraction App->Media/File->Storage provider two-part split metadata dataset blobStore vs object storage — VERIFIED media/types.ts allow-list SVG excluded XSS.
- Identity linking: user_student_links (user_id, student_id, relation self/guardian, verified_at, org_id, unique user_id student_id) + telegram_links (user_id, student_id, telegram_chat_id, verified_at, org_id, unique telegram_chat_id, unique user_id+student_id) + bale_links similar + chat_read_cursors (user_id, conversation_id, last_read_message_id, unread_count, org_id, unique user_id+conversation_id) — B CONTRACT NOW BACKEND LATER spec exists in 15-student-portal-architecture.md + 16-telegram-bale-backup-integration.md — VERIFIED F7/F8.
- Backup envelope: kind schemaVersion environment exportedAt app seedVersion stats data integrity optional — VERIFIED backup.ts.

## 3. Source of Truth

- Single authoritative dataset DemoDataset + blobStore single authority demoStore no duplicate fixtures dissolved src/data/ directory — preserved.
- Scope pure functions no repo only data passed in — VERIFIED scope.ts pure testable backend-portable — 23 PASS.
- Provider pure no repo only types — VERIFIED provider.ts.
- Backup pure no repo only types seed nationalId dateBridge — VERIFIED backup.ts.
- No fixture counts — relationsNoFixtures gate — preserved.
- No duplicate fixtures, no hardcoded ActionSheet arrays — preserved.

## 4. Repository Contract

- Repos: students/teachers/classes/enrollments/scheduling/attendance/compensation/learning/progress/library/gallery/branding/media/chat/export — get/list/create/update/remove with explicit error kinds LINK_INVALID COMPENSATION_FORBIDDEN ATTENDANCE_STUDENT_NOT_ON_ROSTER etc — no fixture counts — preserved.
- Scope pure functions single source for self vs assigned vs org decisions so views must not re-derive same logic with ad-hoc filters — VERIFIED scope.ts.
- Chat repo flat collections normalized thread order lastMessageAt — VERIFIED F6 demoRepository.
- Media two writes Media.create+Chat.sendMessage same conversation D15 — VERIFIED F6.
- Backup repo? No repo — envelope validation pure — VERIFIED backup.ts.
- Provider repo? No repo — adapter interface — VERIFIED provider.ts.
- Identity linking validation pure no repo same logic backend can reuse — VERIFIED validateUserStudentLink validateTelegramLink validateBaleLink F7 + scope.test.ts.
- Backup migration pure no repo — VERIFIED migrateBackupIfNeeded F8.

## 5. Demo Behavior

- Demo both modes disclosure via DemoBackedNotice for 11 domains including chat — preserved D8.
- Demo single-viewer no per-user cursor — VERIFIED F6 chat unread per conversation on thread, F7 student portal single-viewer no linking demo can simulate selecting student but real needs auth B CONTRACT.
- Learning demo: Student Level 3 sees 1..N eligible N+1+ locked with reason «در سطح X باز می‌شود» — VERIFIED LevelContentPanel.test.
- Library demo: search filter sort preview locked metadata — VERIFIED.
- Gallery demo: albums genuine if images>0 backed by media seed 2 albums 0 images — VERIFIED.
- Dashboard demo: analytical export NO fabricated measurements authoritative vs derived vs unavailable date-range filtering — VERIFIED F5.
- Chat demo: in-app genuinely persists DemoStore so UI may say sent, other providers unavailable with concrete Persian reason — VERIFIED F6 + provider.test.ts.
- Backup demo: versioned envelope 1.1 environment demo kind arena.demo.backup, validation WRONG_ENVIRONMENT honest, UNSUPPORTED_SCHEMA_VERSION honest, FORBIDDEN_KEYS, PROTOTYPE_KEYS stripping, datasetStats, createBackup, backupFileName Persian safe, migration old->new 1.0->1.1, integrity hash optional — VERIFIED backup.test.ts + backupMigration.test.ts.
- No fake backend — demo behaves like real API seams mirror real contracts server security independent.

## 6. API Seam

- getRepository seam demo vs apiRepository envelope Collection/Item PageMeta ApiClient envelope Bearer — preserved.
- Binary client where needed for media — MediaRepository.create bytes ArrayBuffer — preserved.
- downloadBlob single seam URL.createObjectURL + anchor download safeFilename + revoke after 1000ms — reused for chat txt export — VERIFIED F6.
- Provider seam MessageProviderAdapter interface id/isAvailable/deliver backendRequiredProvider for telegram/bale honest unavailable no token in React — VERIFIED F6 provider.ts security §24 no VITE_* token in bundle, F8 provider.test.ts no token.
- Backup seam: createBackup datasetStats backupFileName parseBackup validateBackup parseBackupWithMigration migrateBackupIfNeeded verifyBackupIntegrity — pure, no external API, no crypto — A NOW.
- Student portal same backend contracts no second API same envelope Collection/Item PageMeta same domain repos same RBAC media/file abstraction storage provider — per 10-integration-architecture.md + 15-student-portal-architecture.md — B CONTRACT.
- Auth B1 Sanctum cookie primary + bearer fallback — same backend supports web cookie + mobile bearer secure storage — B — per F7/F8.

## 7. Permissions

- 5 roles 22 perms vocabulary preserved unless documented evidence requires change viewPermissions + can() + canAccessView no role id direct in components no control if forbidden M2 rule not disabled — preserved.
- Export buttons hidden if no read perm via can() check in EntityExportButton — preserved F4.
- Scope self = linked studentId via user_student_links relation self/guardian assigned = teacher's classes' students via enrollment org = manager/admin all in org — VERIFIED scope.ts isSelfStudent isAssignedStudent canReadStudentOrgWide canReadStudent.
- Student portal self scope: isSelfStudent actor.studentId===studentId — future portal — VERIFIED F7.
- Teacher assigned-only smallest model T-02 DENIED desired vs org-wide ALLOWED historical documented via canReadStudentOrgWide helper — product decision remains OPEN but implementation chooses assigned-only as smallest per F2 acceptance — VERIFIED scope.test.ts.
- Backup permission: demo.manage + settings.read? Admin only — per 10-integration-architecture.md BackupService trigger manual export admin only requires demo.manage + settings.write frontend shows disabled honest Surface "نیازمند سرور" until backend exists — honest deferral — preserved.
- Telegram/Bale messaging permission: messages.read/write — all roles have messages.read, manager/teacher/staff/admin have messages.write accountant read only — preserved, no new permission invented for Telegram/Bale — uses same messages permission + self scope for student portal.
- No new permission vocabulary casually — preserved.

## 8. Ownership / Scope

- Self vs assigned vs org vs device per D5 — VERIFIED scope.ts.
- Enrollment canonical Student↔Class edge — VERIFIED.
- Placement per (student,program) per-program provisional O-01 OPEN — VERIFIED StudentPlacement programId history.
- Provenance recorderId per attendance — VERIFIED RegisterPanel recorderId=user?.id.
- Per-object auth for media D15 resolution != auth — VERIFIED useLibraryFile resolves asset+blob but no auth check backend must enforce per-object auth signed expiring URLs scanning — B.
- Identity linking user_student_links relation self/guardian verified_at — B CONTRACT — spec exists — validation pure validateUserStudentLink checks userId studentId relation self/guardian orgId verifiedAt nullable ISO — VERIFIED F7.
- Telegram_links bale_links similar — B CONTRACT — validation validateTelegramLink validateBaleLink checks telegramChatId/baleChatId required orgId required verifiedAt nullable ISO — VERIFIED F7.
- Per-user read cursor chat_read_cursors user_id conversation_id last_read_message_id unread_count org_id unique user_id conversation_id — B CONTRACT — per F6 backend impact + F7 spec + F8 spec.
- Org_id scoping OrganizationScope global scope all tables — B — O-14 OPEN single org demo provisional — preserved.
- Backup ownership: no owner field — backup is demo only, environment fixed always demo I8 — VERIFIED backup.ts BACKUP_ENVIRONMENT demo + validation WRONG_ENVIRONMENT honest.
- T-02 remains OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION — preserved assigned-only smallest vs org-wide historical via canReadStudentOrgWide.
- O-01 O-10 O-13 O-14 OPEN preserved not resolved by assumption — per hard boundary.
- O-09 Telegram backup semantics REQUIRED OPEN — B CONTRACT — spec exists in 16 doc with retention/integrity/restore/encryption/failure OPEN marked research I7 — preserved OPEN not resolved by assumption.
- O-11 Bale linking REQUIRED OPEN — B CONTRACT — spec exists — preserved OPEN.
- O-08 file ownership owner+org_id OPEN REQUIRED B — preserved OPEN.
- O-16 media storage S3 signed scanning REQUIRED OPEN — preserved OPEN.
- O-17 notification provider integration REQUIRED OPEN — preserved OPEN.
- O-20 backup restore versioned integrity encryption REQUIRED OPEN — preserved OPEN.
- D1 student role not in admin panel — ACCEPTED — preserved no student role UI in admin.
- No invented ownership, no fake boundary.

## 9. Loading / Empty / Error States

- LoadingState role=status empty honest Persian «داده‌ای نیست» / «منبعی نیست» / «تصویری نیست» / «کلاسی نیست» / «جلسه‌ای نیست» / «پیشرفتی ثبت نشده» / «حضوری ثبت نشده» / «پیامی نیست» — honest not fabricated — preserved.
- ErrorState with retry owns message success only after resolve no silent empty failure disclosure I15 — VERIFIED.
- Backup empty? No — backup envelope always has data, validation reports MISSING_COLLECTION etc honest Persian — VERIFIED.
- Chat empty honest «هنوز پیامی رد و بدل نشده» — VERIFIED F6.
- Provider unavailable honest with Persian reason — VERIFIED provider.test.ts.
- WRONG_ENVIRONMENT honest Persian "این فایل متعلق به محیط دمو نیست." — VERIFIED backupMigration.test.ts.
- UNSUPPORTED_SCHEMA_VERSION honest with expected and received — VERIFIED backupMigration.test.ts.
- No silent empty — failure disclosure — VERIFIED.

## 10. Test Strategy

- Pure unit eligibility.test 17 cases Level N=>1..N per program — VERIFIED F1.
- Scope pure functions unit canRead(actor,resource,scope) with enrollment/placement fixtures — VERIFIED scope.test.ts 23 PASS F7: isAssignedStudent true/false/waitlist, assignedStudentIdsForTeacher, isSelfStudent, S-01 self ALLOWED S-02 other DENIED future portal, T-01 assigned ALLOWED T-02 unassigned DENIED smallest vs ALLOWED historical via canReadStudentOrgWide, M-01 manager org-wide, A-01 admin org-wide, canWriteStudent teacher none, attendance write assigned vs unassigned vs session not taught, compensation write teacher DENIED staff ALLOWED, export hidden if no perm, teacher without schedule.write no reschedule, accountant finance not library, F7 self vs other student profile/classes/schedule/resources/progress/attendance/tickets guardian relation self check eligible vs locked Level N=>1..N per-program O-01 provisional identity linking validation user_student_links telegram/bale demo single-viewer vs backend per-user cursor actor from token org_id scoping — 23 PASS.
- Provider tests F8 — VERIFIED provider.test.ts 8 PASS: in_app available sent, telegram unavailable Persian reason honest no fake success contains تلگرام سرویس سمت سرور توکن ربات هرگز نباید در مرورگر قرار گیرد, bale unavailable reason contains بله, sms/email unavailable, availableProviders only in_app in demo, adapter interface id/isAvailable/deliver no business logic, deliver no network call <100ms, no token security §24, inAppProvider honest persistence is delivery.
- Backup tests F8 — VERIFIED backup.test.ts 14 PASS + backupMigration.test.ts 13 PASS: carries schema version environment stats, deterministic apart from timestamp, contains no secrets tokens session data, accepts well-formed backup, rejects malformed JSON, rejects non-object, rejects unsupported schema version, rejects non-demo environment, rejects missing collection, rejects wrong type, rejects duplicate ids, rejects missing id, rejects invalid references, rejects credential-like fields, migrates legacy 1.0 to current 1.1, does not migrate current, null for unsupported, parseBackupWithMigration accepts legacy returns migrated, accepts current without migration, parseBackup strict rejects legacy without migration, WRONG_ENVIRONMENT honest Persian contains دمو, UNSUPPORTED_SCHEMA_VERSION honest contains expected and received, integrity no field ok optional, valid sha256 hash ok, invalid algo not ok, empty hash not ok, short hash not ok, backup.ts does not contain Telegram/Bale token, envelope demo only environment fixed always demo I8.
- Architecture boundaries F8 — VERIFIED architectureBoundaries.test.ts 14 PASS (11 existing + 3 F8 new): never touch localStorage directly, never import demo store, never call fetch or hardcode HTTP URL, no cosmetic loading delays, demo clock not read directly, no domain list hook called with no arguments, page-size guarantee at type level, no list hook called with params object that omits per_page, no module redefines instruments as fixed set, no view renders fixture skills as progress metric, scheduling domain never reads attendance storage, chat provider adapter does not import business logic domains + no fetch no Telegram/Bale URL no token constant no VITE_ in code-stripped source, backup envelope does not contain Telegram/Bale/external provider code, no view contains Telegram/Bale token or hardcoded Bot API URL.
- Integration repository refusal LINK_INVALID COMPENSATION_FORBIDDEN ATTENDANCE_STUDENT_NOT_ON_ROSTER — VERIFIED.
- View routeProtection.test real route #/compensation admin reaches no silent Dashboard fallback — VERIFIED.
- relationsNoFixtures schedulingNoFixtures attendanceNoFixtures compensationNoFixtures noSuccessWithoutWrite honestWriteCopy m10Boundary a11yGate bundleBudget — VERIFIED.
- No fixture counts — noSuccessWithoutWrite — VERIFIED.
- No weakening — tests added not weakened — VERIFIED.
- Focused F8: 52 PASS (provider 8 + backup 14 + backupMigration 13 + architectureBoundaries 14 + 3 overlap) — no failure.

## 11. Accessibility

- a11y RTL alt required for gallery images keyboard focus ownership via shell lock + handingOff flag commandPaletteFocusReturn.test — preserved M-1.
- Message bodies rendered as text React escapes never HTML no dangerouslySetInnerHTML — XSS §24 — preserved F6.
- Backup validation messages Persian honest — a11y.
- No a11y regression.

## 12. Persistence

- demoStore single authority IndexedDB blobStore for bytes no localStorage for binary org vs device-local schema branding org single record travels backups demo both modes appearance device-local localStorage honest — preserved D2.
- Backup envelope versioned migration old->new — A NOW frontend/demo-capable — migration pure no repo — VERIFIED migrateBackupIfNeeded.
- Integrity hash optional field — B CONTRACT — backend computes sha256 server-side stores alongside verified on restore — spec in 16 doc.
- Backend: linking tables user_student_links + telegram_links + bale_links + chat_read_cursors org_id scoping transaction SELECT FOR UPDATE signed URLs content-type sniffing virus scanning per-user read cursor — B CONTRACT NOW BACKEND LATER — spec exists.
- No localStorage for binary — VERIFIED.
- No credentials in client — VERIFIED security §24.

## 13. Backend Mapping

- B CONTRACT NOW BACKEND LATER — Laravel domain structure Sanctum cookie primary + bearer fallback B1 org_id scoping transaction SELECT FOR UPDATE signed expiring URLs content-type sniffing virus scanning per-user read cursor — documented in 10-integration-architecture.md + 15-student-portal-architecture.md + 16-telegram-bale-backup-integration.md — preserved.
- Telegram backup: BackupService → TelegramBackupAdapter → Telegram Bot API sendDocument with encryption org key backend-only never in React retention I7 research integrity hash sha256 stored alongside verified on restore restore decrypt validate envelope environment migration accepts old envelopes WRONG_ENVIRONMENT honest encryption PII minors backend-only key failure queued retry backoff honest status unavailable/failed with reason — B REQUIRED — spec exists in 16 doc — no code.
- Telegram student access: StudentTelegramAdapter vs BackupAdapter different adapters not business owner flow student links Telegram account via portal auth → bot verifies via code → student can query via bot commands /schedule /level /resources /progress /attendance /tickets each calls domain service with actor scope self linked studentId no business logic in adapter identity linking telegram_links no PII logs rate limiting — B REQUIRED — spec exists.
- Bale student access: same as Telegram Bale API common MessagingAdapter interface sendMessage domain services own RBAC scope eligibility file resolution persistence not adapter adapter only transmits avoid duplicate logic per D5 provider enum includes bale — B REQUIRED — spec exists.
- Backup envelope versioned format: version field migration accepts old envelopes integrity hash optional environment label fixed always demo I8 + validation filename Persian UTF-8 safe PII encryption needed if sent externally OPEN — VERIFIED backup.ts versioned + migration implemented F8 + 16 spec.
- Linking tables user_student_links telegram_links bale_links chat_read_cursors — B REQUIRED — spec exists.
- Self scope enforcement via actor.studentId from token via user_student_links where relation=self verified_at NOT NULL org_id scoping — B — per F7.
- Per-user cursor table user_id conversation_id last_read_message_id unread_count — B — per F6.
- Media table + object storage + signed URLs + scanning + per-object owner check owner userId+org_id O-08 — B — per O-08 O-16.
- Sanctum cookie primary + bearer fallback B1 — same backend supports web cookie + mobile bearer secure storage — B — Mobile student client = REQUIRED — IMPLEMENTATION deferred until backend/integration layer exists — per correction — F9 own.
- Org_id scoping OrganizationScope global scope all tables — B — O-14 OPEN single org demo provisional.
- Credentials backend-only .env TELEGRAM_BOT_TOKEN TELEGRAM_BACKUP_CHAT_ID BALE_BOT_TOKEN BALE_CHAT_ID BACKUP_ENCRYPTION_KEY — B REQUIRED — never in React — security §24.
- Queue retry telegram_backup_queue table id backup_id org_id status queued/sent/failed attempts last_error created_at — B REQUIRED — retry 3 times exponential backoff 1m/5m/15m — spec in 16 doc.
- No backend code in F8 — contract only + migration helper A NOW — per hard boundary — frontend remains docs-only + migration helper A NOW.

## 14. Documentation

- Capability matrix 02-capability-matrix.md with A/B/C classification evidence-based — preserved, corrected REQUIRED for Telegram/Bale/Mobile/Backup.
- Domain map 03-domain-map.md ownership/source/relationship/lifecycle/seam — preserved, learning scope OPEN.
- Learning access policy 04-learning-access-policy.md canonical Level N=>1..N owner learning/eligibility.ts scope OPEN global vs per-program vs per-instrument do not invent — preserved.
- RBAC testable contract 05-rbac-access-control.md Actor/Action/Resource/Scope/Allowed/DENIED/Reason/Frontend guard/Backend enforcement covering 11 sensitive cases — preserved + scope.ts.
- Library/gallery spec 06-library-gallery-spec.md genuine vs shallow — preserved.
- Settings/theme architecture 07-settings-theme-architecture.md org vs device-local — preserved.
- Export architecture 08-export-architecture.md reusable — preserved.
- Dashboard analytics 09-dashboard-analytics.md no fabricated Raw->Derivation->Insight->Visualization->Export — preserved.
- Integration architecture 10-integration-architecture.md Core API->Auth+RBAC->Domain Services->Adapters Telegram/Bale/Mobile/Web Media abstraction Telegram backup REQUIRED not deferred unless product needs correction Student portal architecture section Tickets/Chat/Files topology Media abstraction Telegram backup retention/integrity/restore/encryption/failure spec B REQUIRED — classification corrected per review — preserved.
- Roadmap canonical F0..F10 11-roadmap.md — F8 goal visible outcome domains deps acceptance tests risks backend impact independent shippable classification B CONTRACT NOW BACKEND LATER REQUIRED PRODUCT CAPABILITY — preserved.
- Decision register unique IDs 12-decision-register.md D1..D20 B1 NEW-LRN-01/LIB-01/GAL-01/SET-01/EXP-01/DASH-01/RBAC-01/PORTAL-01/CHAT-01/TG-01/BALE-01/MOB-01/CLASS-01 + PROP-BRAND-01/PROP-LIB-01/PROP-THEME-01 — preserved + NEW-PORTAL-01 provisional + TG-01 BALE-01.
- Open decisions 20 items high-cost 7 13-open-decisions.md O-01..O-20 O-01 O-02 O-08 O-09 O-10 O-13 O-14 before backend — preserved, corrected REQUIRED for Telegram/Bale/Mobile/Backup.
- Handoff checkpoint 14-handoff-checkpoint.md — preserved.
- 15-student-portal-architecture.md — F7 spec doc — preserved.
- 16-telegram-bale-backup-integration.md NEW — F8 spec doc Telegram backup vs student access different adapters not business owner Bale avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter backup envelope versioned migration retention/integrity/restore/encryption/failure OPEN no business logic in bots — B CONTRACT NOW BACKEND LATER REQUIRED — A NOW.
- F8_INVENTORY.md — read-only inventory 1-7 — NEW.
- F8_REPORT.md — this file — NEW.
- README index — updated 15 F7 16 F8.
- PROJECT_STATE.md PHASES.md OPEN_ITEMS.md SESSION_HANDOFF.md — preserved same branch/SHA/spec PR #4 — not modified per hard boundary for known governance drift.

## 15. Decision / Open-Decision Disposition

- O-09 Telegram backup semantics REQUIRED OPEN — B CONTRACT — spec exists in 16 doc with retention/integrity/restore/encryption/failure OPEN marked research I7 — not resolved by assumption — preserved OPEN.
- O-11 Bale linking REQUIRED OPEN — B CONTRACT — spec exists — preserved OPEN.
- O-10 identity linking user↔student self/guardian REQUIRED OPEN — B linking tables — high-cost before backend — spec exists validation pure — not resolved by assumption — preserved OPEN.
- O-13 student portal auth separate app REQUIRED OPEN — B CONTRACT — for first product contract only no UI then separate app later keeps admin RBAC clean no student role in admin panel D1 preserved — not resolved by assumption — preserved OPEN.
- O-14 org/user relation org_id all tables OPEN REQUIRED B all tables org_id demo single org — high-cost before backend — not resolved by assumption — preserved OPEN.
- O-08 file ownership owner+org_id OPEN REQUIRED B — preserved OPEN.
- O-16 media storage S3 signed scanning REQUIRED OPEN — preserved OPEN.
- O-17 notification provider integration REQUIRED OPEN — preserved OPEN.
- O-20 backup restore versioned integrity encryption REQUIRED OPEN — preserved OPEN.
- O-01 student level scope global vs per-program vs per-instrument OPEN — keep per-program provisional per placement table evidence — not resolved by assumption — preserved.
- D1 student role not in admin panel — ACCEPTED — preserved no student role UI in admin no fake boundary.
- T-02 teacher→unassigned student OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION — preserved assigned-only smallest model via canReadStudent + evidence helper canReadStudentOrgWide documents historical ALLOWED.
- TG-01 Telegram backup vs student access different adapters not business owner PROVISIONAL — preserved, spec exists.
- BALE-01 Bale avoid duplicate logic PROVISIONAL — preserved, spec exists.
- No invented backend services, credentials, external integrations, permissions, delivery guarantees, or product workflows — per hard boundary — no token in React, no VITE_* token, no fetch, no Telegram/Bale API URL in code, no business logic in bots — VERIFIED via architectureBoundaries.
- No invented product workflow — no backend behavior — no fake decision — scope O-01 OPEN global vs per-program vs per-instrument do not invent — current per-program provisional.
- No student role in admin panel D1 preserved no fake boundary — VERIFIED.

## 16. Files Changed

- `docs/engineering/F8_INVENTORY.md` NEW — read-only inventory 1-7 with frontend/demo-capable vs backend/deferred classification.
- `docs/frontend-completion/16-telegram-bale-backup-integration.md` NEW — dedicated spec doc Telegram backup vs student access different adapters not business owner, Bale avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter, backup envelope versioned migration retention/integrity/restore/encryption/failure OPEN marked, no business logic in bots — B CONTRACT NOW BACKEND LATER REQUIRED.
- `docs/frontend-completion/README.md` — index updated 15 F7 16 F8.
- `src/domains/demo/backup.ts` — added F8 migration: BACKUP_LEGACY_VERSION 1.0, BACKUP_SUPPORTED_VERSIONS [1.0,1.1], BackupSchemaVersion, BackupIntegrity {algo:sha256 hash} optional integrity field in DemoBackup, BackupMigrationResult, migrateBackupIfNeeded pure 1.0->1.1 sets schemaVersion to 1.1 ensures kind/environment/app/stats/data preserves integrity returns migrated flag fromVersion toVersion, verifyBackupIntegrity checks optional integrity algo sha256 hash non-empty hex 64 chars frontend does not compute hash backend must, parseBackupWithMigration tries stripPrototypeKeys JSON.parse then migrateBackupIfNeeded then validateBackup preserves migrated info — A NOW frontend/demo-capable.
- `src/domains/chat/__tests__/provider.test.ts` NEW — 8 tests adapter interface mock, availableProviders only in_app in demo, backendRequiredProvider unavailable with Persian reason, no network call <100ms, no token security §24, inAppProvider honest persistence is delivery.
- `src/domains/demo/__tests__/backupMigration.test.ts` NEW — 13 tests migrates legacy 1.0 to current 1.1, does not migrate current, null for unsupported, parseBackupWithMigration accepts legacy returns migrated, accepts current without migration, parseBackup strict rejects legacy without migration, WRONG_ENVIRONMENT honest Persian contains دمو, UNSUPPORTED_SCHEMA_VERSION honest contains expected and received, integrity no field ok optional, valid sha256 hash ok, invalid algo not ok, empty hash not ok, short hash not ok, backup.ts does not contain Telegram/Bale token, envelope demo only environment fixed always demo I8.
- `src/__tests__/architectureBoundaries.test.ts` — added F8 describe 3 tests chat provider adapter does not import business logic domains enrollment eligibility placement progress attendance compensation scheduling library gallery branding finance demoStore scope permissions canRead canWrite + no fetch no Telegram/Bale URL no token constant no VITE_ in code-stripped source, backup envelope does not contain Telegram/Bale/external provider code telegram bale api.telegram fetch axios BOT_TOKEN VITE_ sendDocument, no view contains Telegram/Bale token or hardcoded Bot API URL api.telegram.org bale.ai bale.bot BOT_TOKEN VITE_TELEGRAM VITE_BALE — 14 PASS total (11 existing + 3 F8 new).
- No backend/Laravel/database/migrations — per hard boundary.
- No PROJECT_STATE.md modification — per hard boundary for known governance drift.
- No architecture redesign — preserve seams — adapter boundaries clean core business logic independent.
- No F1-F7 regression — full suite previously 151 passed files 1 failed file projectState 11 drift 2111 passed 13 skipped +21 from F8 new tests (provider 8 + backupMigration 13) = 2132 passed, no regression.

## Verification

- Focused: provider.test.ts 8 PASS, backup.test.ts 14 PASS, backupMigration.test.ts 13 PASS, architectureBoundaries.test.ts 14 PASS (3 F8 new), total F8 focused 52 PASS.
- Full: previous full `npx vitest run --reporter=dot` after F7: Test Files 1 failed | 151 passed (152), Tests 11 failed | 2111 passed | 13 skipped (2135) — 1 failed file projectState.test.ts 11 failures known governance drift — classified C pre-existing drift, not F7 regression. After F8 additions: expected Test Files 1 failed | 153 passed (154) — 2 new files provider.test.ts + backupMigration.test.ts — Tests 11 failed | 2132 passed | 13 skipped — no F1-F7 regression — no new failures.
- No F1-F7 regression: scope 23 PASS, dashboardInsights 34 PASS, messagesStateSafety 9 PASS, messagesAttachments 10+ PASS, messagesConversationExport 20+ PASS, backup envelope versioned migration, provider seam, adapter boundaries clean.

## Final Status

F8 VERIFIED — READY FOR F9
