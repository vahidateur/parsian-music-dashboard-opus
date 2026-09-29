# F8 — Telegram + Bale + Backup Integration Contracts — READ-ONLY INVENTORY

> Branch `arena/frontend-completion-spec` HEAD `2f5b11a` F7 VERIFIED CLOSED, PR #4 OPEN UNMERGED. No file modifications during inventory.

## 1. F8 Goal (canonical from 11-roadmap.md)

Telegram backup = REQUIRED PRODUCT CAPABILITY, Telegram student access = REQUIRED, Bale student access = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile, no business logic in bots.

## 2. Domains / Integrations

- chat/provider, demo/backup.ts, media, scheduling, learning, attendance, compensation, export, auth
- RBAC, media abstraction, student portal identity linking O-10 O-11, backup envelope I8, research I7
- Decision IDs: TG-01 Telegram backup vs student access different adapters not business owner, BALE-01 Bale adapter contract avoid duplicate logic Core->Adapter->Telegram/Bale, MOB-01 Mobile same backend (F9 own), PORTAL-01 Student portal architecture (F7 done), CHAT-01 Tickets/chat/files topology (F6 done)
- Open decisions: O-09 Telegram backup semantics REQUIRED, O-11 Bale linking REQUIRED, O-10 identity linking user↔student self/guardian REQUIRED, O-12 mobile auth bearer vs cookie REQUIRED, O-13 student portal auth separate app REQUIRED, O-14 org/user relation, O-08 file ownership owner+org_id REQUIRED, O-16 media storage S3 signed scanning REQUIRED, O-17 notification provider integration REQUIRED, O-20 backup restore versioned integrity encryption REQUIRED

Slices per 11-roadmap F8 + 10-integration-architecture:
- A NOW (frontend/demo-capable): backup envelope versioned format with schemaVersion 1.1 environment demo kind arena.demo.backup, validation WRONG_ENVIRONMENT honest, UNSUPPORTED_SCHEMA_VERSION, FORBIDDEN_KEYS credential-like fields, PROTOTYPE_KEYS stripping __proto__/constructor/prototype, datasetStats, createBackup, backupFileName Persian safe via safeFilename, provider seam MessageProviderAdapter interface id/isAvailable/deliver with backendRequiredProvider for telegram/bale honest unavailable reason no token in React, no business logic in bots, scope pure functions self via user_student_links
- B CONTRACT NOW BACKEND LATER REQUIRED: Telegram backup adapter BackupService → TelegramBackupAdapter → Telegram Bot API sendDocument with encryption org key backend-only never in React, retention how long Telegram keeps file OPEN I7 research, integrity hash sha256 stored alongside verified on restore, restore decrypt validate envelope environment migration accepts old envelopes WRONG_ENVIRONMENT honest, encryption PII minors must encrypt before sending to external provider backend-only key, failure Telegram unavailable → queued retry backoff honest status unavailable/failed with reason; Telegram student access StudentTelegramAdapter vs BackupAdapter different adapters not business owner flow student links Telegram account via student portal auth → bot verifies via code → student can query via bot commands /schedule /level /resources /progress /attendance /tickets each calls domain service with actor scope self linked studentId no business logic in adapter; Bale student access same as Telegram but Bale API common MessagingAdapter interface sendMessage domain services own RBAC scope eligibility file resolution persistence not adapter adapter only transmits avoid duplicate logic per D5; backup envelope versioned format version field migration accepts old envelopes integrity hash optional environment label fixed always demo I8 + validation filename Persian UTF-8 safe PII encryption needed if sent externally OPEN
- C DEFERRED: actual bot implementation, webhook, credential handling, queue retry, S3/MinIO, signed URLs — stays B contract, no code

## 3. Current Implementation State — Partial (needs verification)

**Already complete (verified via grep and existing files):**

- Provider abstraction VERIFIED in `src/domains/chat/provider.ts`: MessageProviderAdapter interface id/isAvailable/deliver DeliveryResult status reason, inAppProvider genuinely delivers isAvailable true status sent, backendRequiredProvider for telegram/bale/sms/email isAvailable false status unavailable with concrete Persian reason "ارسال از طریق تلگرام به سرویس سمت سرور نیاز دارد؛ توکن ربات هرگز نباید در مرورگر قرار گیرد." — honest, no network call, no setTimeout fake success, no token in React, security §24 no VITE_* variable localStorage committed demo data, BACKEND REQUIRED comment with POST /messages GET /messages/{id} POST /webhooks/telegram POST /webhooks/bale server holds credentials enforces rate limits maps contacts persists receipts, provider APIs NOT researched per brief no hardcoded endpoint payload rate limit — VERIFIED, availableProviders filters isAvailable — used to build UI picker.

- Provider enum includes bale VERIFIED in `src/domains/chat/types.ts` — MessageProvider in_app|telegram|bale|sms|email, providerLabel Persian includes bale, status unavailable when no backend — VERIFIED.

- Backup envelope versioned VERIFIED in `src/domains/demo/backup.ts`: BACKUP_SCHEMA_VERSION 1.1, BACKUP_ENVIRONMENT demo, BACKUP_KIND arena.demo.backup, DemoBackup interface kind schemaVersion environment exportedAt app seedVersion stats data, FORBIDDEN_KEYS password/passwordHash/token/accessToken/refreshToken/apiKey/secret/sessiontoken/session_token/cookie/credentials/authorization, PROTOTYPE_KEYS __proto__/constructor/prototype with stripPrototypeKeys recursive rebuild without polluting own properties applied immediately after JSON.parse before validation, datasetStats counts total, createBackup returns versioned envelope, backupFileName Persian safe via ISO replace, ValidationCode MALFORMED_JSON NOT_AN_OBJECT UNSUPPORTED_SCHEMA_VERSION WRONG_ENVIRONMENT MISSING_COLLECTION INVALID_COLLECTION MISSING_ID DUPLICATE_ID INVALID_REFERENCE FORBIDDEN_FIELD, parseBackup never throws stripPrototypeKeys then validateBackup, validateBackup checks schemaVersion !== BACKUP_SCHEMA_VERSION → UNSUPPORTED_SCHEMA_VERSION, environment !== demo → WRONG_ENVIRONMENT honest, data object check, validateDataset checks organization, DEMO_COLLECTIONS array, ids present unique, has() helper, ref() helper, classes teacherId roomId, enrollments studentId classId, sessions classId teacherId roomId, attendance sessionId entries studentId, scheduledSessions classId teacherId roomId date ISO isIsoDate startTime endTime durationMinutes rescheduledFromId/ToId, sessionCompensations classId studentId originalSessionId uniqueness key originalSessionId::studentId attempts sessionId scheduledAt scheduledByUserId uniqueness compensationSessions, pieces instrumentId, pieceAssignments studentId pieceId, progressEvents assignmentId studentId, students nationalId required valid unique via normalizeNationalId validateNationalId seenNationalIds Map, invoices studentId, payments studentId, users role teacherId, findForbiddenKeys recursive depth 12 FORBIDDEN_KEY_SET PROTOTYPE_KEY_SET — VERIFIED, but migration old->new not yet — only exact version 1.1 supported.

- Media abstraction App->Media/File->Storage provider VERIFIED two-part split metadata dataset blobStore vs object storage — VERIFIED media/types.ts allow-list image jpeg/png/webp/gif SVG excluded XSS audio mp3/mp4/ogg/wav/webm doc pdf/txt size ceilings per kind — VERIFIED.

- Student portal identity linking spec VERIFIED in `docs/frontend-completion/15-student-portal-architecture.md` + `src/domains/auth/scope.ts` F7 added validateUserStudentLink validateTelegramLink validateBaleLink pure validation types UserStudentLinkInput TelegramLinkInput BaleLinkInput LinkValidationResult relation self/guardian orgId verifiedAt nullable ISO UUID_LIKE demo compatible — VERIFIED F7 commit e7c30d6.

- Scope pure functions self vs assigned vs org VERIFIED F2/F7 — isSelfStudent, isAssignedStudent, canReadStudent, canReadStudentOrgWide historical ALLOWED evidence preserved T-02, canWriteAttendance, canWriteCompensation, isEligibleLevel Level N=>1..N — VERIFIED.

- Integration architecture doc VERIFIED in `docs/frontend-completion/10-integration-architecture.md` — Core Boundary diagram Core API→Auth+RBAC→Domain Services→Adapters→External Providers→Storage Provider→Clients, Frontend client same backend contracts no second API VERIFIED registry seam, Media abstraction VERIFIED, Auth Sanctum cookie primary + bearer fallback B1 VERIFIED ApiClient Bearer, RBAC server must enforce UX-only VERIFIED permissions.ts header, Telegram Adapter two use cases Backup vs Student Access different adapters not business owner with flows commands /schedule etc no business logic in adapter identity linking telegram_links table security no PII logs rate limiting, Classification CORRECTION Telegram backup REQUIRED, Telegram student access REQUIRED, Bale student access REQUIRED, Mobile REQUIRED, Adapter architecture Core->Adapter->Telegram/Bale/Mobile no business logic in bots — VERIFIED requirement, Bale Adapter Contract Avoid Duplicate Logic Core->Adapter->Telegram/Bale common MessagingAdapter interface sendMessage deduplication eligibility scope RBAC file resolution persistence in domain service not adapter provider enum includes bale status unavailable failure queued unavailable failed with statusReason, Mobile App Client Same Backend Contracts Auth bearer secure storage Registry same composition root Offline C deferred Features same as web B contract No new backend Laravel domain structure B1, Student Portal Architecture Profile/Classes/Schedule/Level/Resources/Progress/Attendance/Tickets/Messages/Files demo vs backend identity architecture diagram Student Portal SPA → Auth → RBAC → Domain Services → API Client, Tickets/Chat/Files Topology Auth Ownership Unread/Read Scope Validation/Storage flat collections normalized thread order lastMessageAt, Media Abstraction Interface MediaRepository create/list/get/delete + blobStore, Telegram Backup Retention/Integrity/Restore/Encryption/Failure OPEN — VERIFIED.

- Decision register VERIFIED TG-01 NEW-TG-01 Telegram backup vs student access different adapters not business owner PROVISIONAL, BALE-01 NEW-BALE-01 Bale avoid duplicate logic PROVISIONAL, MOB-01 NEW-MOB-01 Mobile same backend PROVISIONAL, PORTAL-01 NEW-PORTAL-01 Student portal architecture PROVISIONAL, CHAT-01 NEW-CHAT-01 Tickets/chat/files topology PROVISIONAL — all preserved.

- Open decisions VERIFIED O-09 Telegram backup semantics REQUIRED OPEN, O-11 Bale linking REQUIRED OPEN, O-10 identity linking REQUIRED OPEN, O-12 mobile auth REQUIRED OPEN, O-13 student portal auth REQUIRED OPEN, O-14 org/user relation OPEN, O-08 file ownership REQUIRED OPEN, O-16 media storage REQUIRED OPEN, O-17 notification REQUIRED OPEN, O-20 backup restore REQUIRED OPEN — all remain OPEN per correction, not resolved by assumption.

**Gaps / Needs implementation (F8 scope):**

- Backup envelope versioned migration old->new — GAP: backup.ts currently only supports exact version 1.1, no migration function that accepts old envelopes e.g. 1.0 -> 1.1, WRONG_ENVIRONMENT honest but migration missing — needs migration function parse with fallback or migrateBackup(old) → new that accepts old schemaVersion and migrates dataset, per F8 acceptance "migration accepts old envelopes".

- Backup integrity hash — GAP: no sha256 hash stored alongside backup, no verification on restore — needs spec doc for integrity hash optional, but frontend could compute hash for verification? B CONTRACT — for frontend demo-capable, we can add hash field optional and verification function that checks hash if present, without inventing backend encryption.

- Backup retention/integrity/restore/encryption/failure spec — GAP: 10-integration-architecture.md marks OPEN with research tasks I7, but F8 requires spec docs for Telegram backup adapter vs student access adapter different adapters not business owner, Bale adapter contract avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter interface, backup envelope versioned format migration retention/integrity/restore/encryption/failure OPEN marked — need dedicated spec doc `docs/frontend-completion/16-telegram-bale-backup-integration.md` that documents BackupService → TelegramBackupAdapter → Telegram Bot API sendDocument with encryption org key backend-only never in React, retention I7 research, integrity hash sha256, restore decrypt validate envelope environment migration, encryption PII minors backend-only key, failure queued retry backoff honest status.

- Adapter interface mock tests — GAP: need tests that assert MessageProviderAdapter interface, availableProviders, backendRequiredProvider returns unavailable with reason, no business logic in bot asserted via architectureBoundaries test that scans provider.ts and ensures no business logic like enrollment, eligibility, RBAC, file resolution — currently no architectureBoundaries test for Telegram/Bale.

- Identity linking validation tests — PARTIAL: F7 added validateUserStudentLink etc but need explicit tests for telegram_links bale_links validation relation self/guardian verified_at unique constraints — F7 has some but F8 should extend.

- Scope pure functions for Telegram/Bale linking — PARTIAL: scope.ts has self scope but need tests for telegram_chat_id linking flow: student links Telegram account via portal auth → bot verifies via code → student can query via bot commands /schedule etc each calls domain service with actor scope self linked studentId — needs unit test that actor with telegram_chat_id linked to studentId can read own schedule via isSelfStudent + telegram link validation.

- No business logic in bots — GAP: need architectureBoundaries test that ensures provider.ts does not import enrollment, eligibility, RBAC, file resolution, persistence — only types.

- Backup restore versioned migration old->new WRONG_ENVIRONMENT honest — GAP: need test for parseBackup with old version 1.0 migrates to 1.1 or returns UNSUPPORTED_SCHEMA_VERSION honest, and WRONG_ENVIRONMENT returns honest Persian message.

## 4. Dependencies / Blockers

- RBAC scope self vs assigned vs org O-01 O-10 O-13 O-14 — VERIFIED scope.ts implements assigned-only smallest, O-01 per-program vs global remains OPEN provisional per-program — no blocker for contract doc.
- Media abstraction — VERIFIED two-part split, allow-list SVG excluded, no data URL — no blocker.
- Student portal identity linking O-10 high-cost before backend — B contract — VERIFIED F7 spec user_student_links + telegram_links bale_links — no blocker for F8 contract doc.
- Backup envelope I8 environment always demo label wrong — VERIFIED BACKUP_ENVIRONMENT demo fixed always demo + validation WRONG_ENVIRONMENT honest — I8 fixed in backup.ts? Actually I8 says environment label fixed always demo + validation — VERIFIED, but migration still gap — no blocker for contract.
- Research I7 Telegram file retention/how long Telegram keeps file — OPEN — needs research but for contract doc we can mark OPEN with research tasks, no blocker.
- No blocker for F8-1 inventory — begin first vertical slice.

## 5. Exact Files Likely to Change

- `src/domains/chat/provider.ts` — already has MessageProviderAdapter interface, backendRequiredProvider, availableProviders — may need to add common MessagingAdapter interface documentation for Telegram/Bale backup vs student access, but no business logic — keep clean, no new logic — maybe add BackupAdapter interface spec for backup envelope? But backup adapter is backend-only, frontend should not implement sendDocument — keep provider.ts as messaging only, add doc for backup adapter separate.
- `src/domains/demo/backup.ts` — already versioned 1.1, validation WRONG_ENVIRONMENT, FORBIDDEN_KEYS, PROTOTYPE_KEYS — may need to add migration function migrateBackup(old) that accepts old envelopes (e.g. 1.0) and returns new, plus integrity hash optional field hash sha256 and verify function, plus safeFilename already via backupFileName — additive only, no breaking.
- `docs/frontend-completion/10-integration-architecture.md` — already has Telegram backup vs student access different adapters, Bale contract, retention/integrity/restore/encryption/failure OPEN — may need cross-ref to new F8 spec doc, but preserve existing — no functional change.
- `docs/frontend-completion/16-telegram-bale-backup-integration.md` NEW — dedicated spec doc for F8: Telegram backup adapter vs student access adapter different adapters not business owner, Bale adapter contract avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter interface, backup envelope versioned format migration retention/integrity/restore/encryption/failure OPEN marked, no business logic in bots — B CONTRACT NOW BACKEND LATER REQUIRED.
- `docs/frontend-completion/12-decision-register.md` — TG-01 BALE-01 already PROVISIONAL, may need update to ACCEPTED when F8 spec lands, but keep provisional until F8 complete — no functional change.
- `docs/frontend-completion/13-open-decisions.md` — O-09 O-11 O-10 O-12 O-13 O-14 O-08 O-16 O-17 O-20 remain OPEN REQUIRED — no resolution by assumption.
- `docs/frontend-completion/README.md` — index update to include new 16 doc — docs-only.
- `src/domains/auth/scope.ts` — already has identity linking validation from F7, may need to ensure telegram_chat_id validation pure — already added validateTelegramLink etc — no change needed unless gap.
- `src/domains/auth/__tests__/scope.test.ts` — already has F7 tests, may need additional tests for telegram linking flow — additive.
- `src/domains/demo/__tests__/backup.test.ts` — existing? Need to check — may need to add tests for versioned migration old->new WRONG_ENVIRONMENT honest, integrity hash, no business logic in bot — new file or extend existing.
- `src/domains/chat/__tests__/provider.test.ts` NEW — adapter interface mock, availableProviders, backendRequiredProvider unavailable reason, no business logic in bot asserted via architectureBoundaries — A NOW.
- `src/__tests__/architectureBoundaries.test.ts` — may need to add assertion that chat/provider.ts does not import enrollment/eligibility/RBAC/file resolution/persistence — no business logic in bots.
- No backend/Laravel/database/migrations — per hard boundary.
- No PROJECT_STATE.md modification for governance drift — per hard boundary.
- No new Library route, no publication workflow invention, no inactive/archived eligibility invention — per F1 dispositions preserved.
- No credentials, no VITE_* token, no PII in logs — per security §24.

## 6. Implementation Order

- F8-1 leaf: inventory (this file) — VERIFIED no blocker.
- F8-2: backup envelope versioned migration — add migration function that accepts old envelopes (1.0) and migrates to 1.1, plus integrity hash optional field and verification, plus tests for WRONG_ENVIRONMENT honest, UNSUPPORTED_SCHEMA_VERSION honest, migration old->new — A NOW frontend/demo-capable.
- F8-3: Telegram/Bale adapter contracts spec doc — create `docs/frontend-completion/16-telegram-bale-backup-integration.md` with sections: Telegram backup REQUIRED BackupService → TelegramBackupAdapter → Telegram Bot API sendDocument encryption org key backend-only never in React retention I7 research integrity hash sha256 restore decrypt validate envelope environment migration accepts old envelopes WRONG_ENVIRONMENT honest encryption PII minors backend-only key failure queued retry backoff honest status unavailable/failed with reason; Telegram student access REQUIRED StudentTelegramAdapter vs BackupAdapter different adapters not business owner flow student links Telegram account via portal auth bot verifies via code student can query via bot commands /schedule /level /resources /progress /attendance /tickets each calls domain service with actor scope self linked studentId no business logic in adapter; Bale student access REQUIRED same as Telegram Bale API common MessagingAdapter interface sendMessage domain services own RBAC scope eligibility file resolution persistence not adapter adapter only transmits avoid duplicate logic per D5; backup envelope versioned format version field migration; no business logic in bots — B CONTRACT NOW BACKEND LATER REQUIRED.
- F8-4: adapter interface mock tests + architecture boundaries — create provider.test.ts that mocks MessageProviderAdapter, tests availableProviders returns only in_app in demo, backendRequiredProvider returns unavailable with Persian reason, no network call, no token in React, no business logic in bot asserted via architectureBoundaries test scanning provider.ts imports — A NOW.
- F8-5: final verification — full Vitest regression, no F1-F7 regression, docs update README index, decision register cross-ref, ensure D1 preserved no student role in admin, T-02 remains OPEN, O-09 O-11 O-10 etc remain OPEN, no invented backend, no architecture redesign, no PROJECT_STATE.md mod, no F9 start, no merge PR #4.

No blocker exists for F8-2 — begin first vertical slice: backup envelope versioned migration + integrity hash + spec doc.

## 7. Frontend/Demo-Capable vs Backend/Integration-Deferred

**Frontend/Demo-Capable NOW (A):**

- Backup envelope versioned format with schemaVersion 1.1 environment demo kind arena.demo.backup — VERIFIED backup.ts
- Validation WRONG_ENVIRONMENT honest Persian "این فایل متعلق به محیط دمو نیست." + UNSUPPORTED_SCHEMA_VERSION honest — VERIFIED
- FORBIDDEN_KEYS credential-like fields + PROTOTYPE_KEYS stripping __proto__/constructor/prototype via stripPrototypeKeys recursive — VERIFIED security
- datasetStats counts total, createBackup, backupFileName Persian safe via ISO replace — VERIFIED
- Provider seam MessageProviderAdapter interface id/isAvailable/deliver honest unavailable reason no token in React no VITE_* localStorage — VERIFIED provider.ts
- Scope pure functions self via user_student_links relation self/guardian — VERIFIED scope.ts F7
- No business logic in bots — VERIFIED provider.ts has no enrollment/eligibility/RBAC/file resolution imports — needs architectureBoundaries test
- Backup migration old->new — GAP needs implementation migrateBackup that accepts old version 1.0 and returns new 1.1 — A NOW
- Integrity hash optional — GAP needs spec + verification function verifyBackupHash — A NOW frontend can compute sha256? But browser crypto async — for demo we can store hash as optional field and verify if present, without inventing backend encryption
- Tests: adapter interface mock, backup restore versioned migration old->new WRONG_ENVIRONMENT honest, no business logic in bot asserted via architectureBoundaries — A NOW

**Backend/Integration-Deferred B CONTRACT NOW BACKEND LATER REQUIRED:**

- Telegram backup adapter BackupService → TelegramBackupAdapter → Telegram Bot API sendDocument with encryption org key backend-only never in React — B REQUIRED — spec doc, no code
- Retention how long Telegram keeps file OPEN I7 research — B REQUIRED — spec marks OPEN with research task
- Integrity hash sha256 stored alongside verified on restore — B REQUIRED — backend must compute hash server-side, frontend verification optional
- Restore decrypt validate envelope environment migration accepts old envelopes WRONG_ENVIRONMENT honest — B REQUIRED — backend must decrypt with org key, validate, migrate
- Encryption PII minors must encrypt before sending to external provider backend-only key — B REQUIRED — backend-only key never in React, per security §24
- Failure Telegram unavailable → queued retry backoff honest status unavailable/failed with reason — B REQUIRED — backend queue
- Telegram student access StudentTelegramAdapter vs BackupAdapter different adapters not business owner flow student links Telegram account via portal auth → bot verifies via code → student can query via bot commands /schedule /level /resources /progress /attendance /tickets each calls domain service with actor scope self linked studentId no business logic in adapter — B REQUIRED — spec doc
- Identity linking user↔student↔telegram_id table telegram_links (user_id, student_id, telegram_chat_id, verified_at, org_id, unique telegram_chat_id, unique user_id student_id) — B REQUIRED — O-10
- Bale student access same as Telegram Bale API common MessagingAdapter interface sendMessage domain services own RBAC scope eligibility file resolution persistence not adapter adapter only transmits avoid duplicate logic per D5 — B REQUIRED — O-11
- Bale linking table bale_links similar — B REQUIRED
- No PII in Telegram logs no credentials in client rate limiting — B REQUIRED — security
- Credentials backend-only never VITE_* localStorage — B REQUIRED — security §24
- Mobile same backend contracts — F9 own — not F8
- All B items are REQUIRED PRODUCT CAPABILITY per correction 2026-09-19 — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile no business logic in bots

**Explicitly Deferred C:**

- Actual bot implementation, webhook endpoint, Bot API calls, credential handling, queue retry, S3/MinIO, signed URLs — stays B contract, no code in F8
- Offline queue for mobile — C DEFERRED per F9
- Finance/Reports domain — C DEFERRED per D6
