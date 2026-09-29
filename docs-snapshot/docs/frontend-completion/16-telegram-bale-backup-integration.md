# 16 — Telegram / Bale / Backup Integration Contracts — F8

> Goal: Telegram backup = REQUIRED PRODUCT CAPABILITY, Telegram student access = REQUIRED, Bale student access = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile, no business logic in bots

## Core Boundary — Preserved

```
Core API (Laravel)
  → Auth + RBAC (Sanctum cookie primary + bearer fallback B1, org_id OrganizationScope, rolePermissions matrix)
    → Domain Services (students/teachers/classes/scheduling/attendance/compensation/learning/progress/library/gallery/branding/media/chat/export)
      → Adapters (TelegramAdapter, BaleAdapter, SmsAdapter, EmailAdapter, TelegramBackupAdapter)
        → External Providers (Telegram Bot API, Bale API)
      → Storage Provider (S3/MinIO via Media abstraction App->Media/File abstraction->Storage provider)
      → Clients (Web SPA, Mobile App, Student Portal)
```

- Frontend is client of same backend contracts — no second API — VERIFIED registry seam
- Media abstraction: App → Media/File abstraction → Storage provider — VERIFIED media/types.ts two-part split
- Auth: Sanctum cookie primary + bearer fallback B1 — VERIFIED ApiClient Bearer
- RBAC: server must enforce on every endpoint — frontend UX-only — VERIFIED permissions.ts header
- No business logic in bots — adapter calls domain services, domain services enforce RBAC + scope — VERIFIED requirement

## Telegram Adapter — Two Different Use Cases — Different Adapters Not Business Owner

### Why Two Adapters

Telegram as **backup channel** vs **student access channel** are different product capabilities with different security, retention, and ownership concerns. Business owner is academy, not Telegram. So:

- **BackupAdapter** owns encryption, retention, integrity, restore, failure queue — not business logic
- **StudentAccessAdapter** owns linking, verification, command routing — not business logic
- Both call same Core Domain Services — no duplicate business logic — D5 one owner per rule

### Use Case 1 — Backup (Server-Side) — REQUIRED PRODUCT CAPABILITY — B CONTRACT NOW BACKEND LATER

**What:** Telegram as backup channel — bot sends backup file to admin channel.

**Current:** No backup via Telegram, backup is JSON file via `demo/backup.ts` with environment label demo always I8 — VERIFIED, versioned envelope `BACKUP_SCHEMA_VERSION` 1.1.

**Desired:**

```
BackupService (domain)
  → TelegramBackupAdapter (integration)
    → Telegram Bot API sendDocument (external, server-only)
```

**Contract:**

- **Trigger:** Manual export via Settings → Backup → "ارسال به تلگرام" (admin only, requires demo.manage + settings.write) — frontend shows disabled honest Surface "نیازمند سرور" until backend exists — honest deferral.
- **Encryption:** Backup contains PII (students minors, nationalId, contact) — MUST encrypt with org key before sending to external provider — backend-only key, never in React, never VITE_*, never localStorage, never committed demo data — per security §24. Encryption algo: AES-256-GCM org key stored in Laravel .env `BACKUP_ENCRYPTION_KEY`, IV random per backup, auth tag verified on restore. Frontend must NOT implement encryption — contract only.
- **Integrity:** Hash of backup JSON (sha256) stored alongside file, verified on restore — spec B. Frontend `backup.ts` may carry optional `integrity: { algo: "sha256", hash: string }` field, verification function `verifyBackupIntegrity(backup, hash)` returns ok/false — frontend can verify if hash present, but hash generation is backend. For demo, hash is optional.
- **Retention:** How long Telegram keeps file? Telegram file storage indefinite? But channel may delete? Needs research I7 — OPEN. Spec: retention indefinite for Telegram, but academy should also keep S3 copy with retention policy O-19 indefinite first product — B. Research task: verify Telegram Bot API file retention, file size limits (50MB bot API), rate limits.
- **Restore:** From Telegram file — needs decryption with org key, validation WRONG_ENVIRONMENT honest Persian "این فایل متعلق به محیط دمو نیست.", migration accepts old envelopes (1.0 → 1.1), integrity check hash verified, forbidden keys scan, prototype keys stripping. Restore flow: admin downloads file from Telegram channel → uploads via Settings → Restore → backend decrypts validates envelope environment migration — same as local file restore.
- **Failure:** Telegram API unavailable → queued + retry with backoff, honest failure reporting — status unavailable/failed with reason Persian, no fake success. Queue table `telegram_backup_queue` (id, backup_id, org_id, status queued/sent/failed, attempts, last_error, created_at). Backend retries 3 times exponential backoff 1m/5m/15m, then marks failed with reason.
- **Security:** No bot token in React, no chat id in client, credentials backend-only in .env `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BACKUP_CHAT_ID`, rate limiting per org, no PII in Telegram logs, audit log for backup sent.

**Frontend Demo-Capable NOW (A):**

- Backup envelope versioned `BACKUP_SCHEMA_VERSION` 1.1, `BACKUP_ENVIRONMENT` demo, `BACKUP_KIND` arena.demo.backup — VERIFIED
- Validation WRONG_ENVIRONMENT honest, UNSUPPORTED_SCHEMA_VERSION honest — VERIFIED
- FORBIDDEN_KEYS + PROTOTYPE_KEYS stripping — VERIFIED
- backupFileName Persian safe via ISO replace + safeFilename — VERIFIED
- Migration old->new: `migrateBackupIfNeeded` accepts 1.0 → 1.1, returns migrated flag — A NOW (implemented in F8 slice)
- Integrity hash optional field and verification — A NOW spec, optional
- No Telegram code in React — VERIFIED provider.ts has no Telegram Bot API calls

**Backend Deferred B REQUIRED:**

- Bot API webhook not needed for backup (outbound only sendDocument)
- Encryption org key backend-only
- Queue retry
- S3 copy
- Research I7 retention/file size/rate limits

### Use Case 2 — Student Access via Telegram — REQUIRED PRODUCT CAPABILITY — B CONTRACT NOW BACKEND LATER

**What:** Student accesses schedule/level/resources/progress/attendance/tickets/messages/files via Telegram bot.

**Different adapter:** StudentTelegramAdapter vs BackupAdapter — not business owner (business owner is academy, not Telegram) — D5 separation.

**Flow:**

1. Student registers via student portal (15-student-portal-architecture.md) → user_student_links relation=self verified_at set after OTP/admin approval
2. Student links Telegram account via portal: portal shows "اتصال به تلگرام" → generates verification code 6-digit expires 10m → student sends code to bot via /start <code> → bot verifies via backend → creates telegram_links (user_id, student_id, telegram_chat_id, verified_at=now, org_id, unique telegram_chat_id, unique user_id+student_id)
3. Student can query via bot commands — each command calls domain service with actor scope self linked studentId — no business logic in adapter

**Commands (each calls domain service with self scope):**

- /start <code> — link account
- /schedule — sessions where classId in student's enrolled classes bounded window — via scheduling repo + enrollment self
- /level — placement current level + history per program — via learning repo self
- /resources — eligible content via resolveEligibleContent Level N=>1..N — via learning/eligibility.ts self per program
- /progress — pieces assignments events where studentId=self — via progress repo
- /attendance — records where studentId=self — via attendance repo
- /tickets — conversations where subjectId=self — via chat repo self
- /help — list commands

**No business logic in adapter:** Adapter calls domain services, domain services enforce RBAC + scope — e.g. /resources calls `resolveEligibleContent(placement, content, levels)` same as web, not re-implemented in bot. Eligibility, scope, RBAC, file resolution, message persistence in domain service, not adapter — adapter only transmits.

**Identity linking:** user ↔ student ↔ telegram_id table telegram_links (user_id, student_id, telegram_chat_id, verified_at, org_id, UNIQUE telegram_chat_id, UNIQUE user_id+student_id) — B — per O-10. *Reconciled 2026-09-21 against `GOVERNANCE_CHECKPOINT.md` (O-10/O-11 ACCEPTED): the column list is an illustrative sketch, not a decided schema — live law binds `chat_id` to `user_id` + `org_id`, does **not** require `student_id` on the link row as the authz key, and keeps **uniqueness details and linking UX OPEN**; the `UNIQUE …` clauses above are not decided.*

**Security:**

- No PII in Telegram logs — bot logs only chat_id and command, not student name/balance/nationalId
- No credentials in client — token backend-only
- Rate limiting — per chat_id 10 commands/minute, per org 100/minute — backend
- Verification code expires 10m, single use
- No student role in admin panel D1 preserved — student portal separate app, Telegram bot is client of same backend

**Frontend Demo-Capable NOW (A):**

- Provider seam MessageProviderAdapter already exists — VERIFIED
- Scope pure functions isSelfStudent — VERIFIED
- Identity linking validation validateTelegramLink — VERIFIED F7
- No Telegram code in React — VERIFIED

**Backend Deferred B REQUIRED:**

- Bot API webhook POST /webhooks/telegram — receives updates, verifies signature, rate limits, maps telegram_chat_id → student_id via telegram_links verified_at not null
- Domain service calls with actor self
- No business logic in bot — adapter only transmits

## Bale Adapter — Contract Avoid Duplicate Logic — REQUIRED PRODUCT CAPABILITY — B CONTRACT NOW BACKEND LATER

**Same as Telegram but Bale API — avoid duplicate logic via common MessagingAdapter interface — D5.**

```
Core Domain Services (same)
  → MessagingAdapter interface { sendMessage(conversationId, body, mediaId?) → MessageStatus, id, isAvailable(), deliver() }
    → TelegramAdapter implements MessagingAdapter → Telegram Bot API
    → BaleAdapter implements MessagingAdapter → Bale API
```

- **Interface:** MessagingAdapter { sendMessage(conversationId, body, mediaId?) → MessageStatus, provider label } — already exists as MessageProviderAdapter in `chat/provider.ts` — VERIFIED, id in_app|telegram|bale|sms|email, isAvailable(), deliver({conversationId, body}) → DeliveryResult status reason
- **Deduplication:** eligibility, scope, RBAC, file resolution, message persistence in domain service, not adapter — adapter only transmits, no business logic in bots — VERIFIED requirement, provider.ts has no enrollment/eligibility/RBAC imports
- **Contract:** provider enum already includes bale — VERIFIED chat/types.ts, providerLabel Persian includes bale, status unavailable when no backend — VERIFIED
- **Failure:** same as Telegram — queued, unavailable, failed with statusReason Persian honest
- **Identity linking:** bale_links table (user_id, student_id, bale_chat_id, verified_at, org_id, UNIQUE bale_chat_id, UNIQUE user_id+student_id) — B — per O-11 — *same reconciliation note as `telegram_links` above: illustrative sketch; `chat_id` → `user_id` + `org_id`; `student_id` not the authz key; uniqueness details and linking UX remain OPEN per `GOVERNANCE_CHECKPOINT.md`*
- **Security:** same as Telegram — no token in React, backend-only, rate limiting, no PII in logs

**Frontend Demo-Capable NOW (A):**

- MessageProviderAdapter common interface — VERIFIED
- Bale provider returns unavailable with reason "ارسال از طریق بله به سرویس سمت سرور نیاز دارد؛ توکن ربات هرگز نباید در مرورگر قرار گیرد." — VERIFIED
- No business logic in adapter — VERIFIED via architectureBoundaries test
- No duplicate logic — domain services own RBAC etc

**Backend Deferred B REQUIRED:**

- Bale API integration — similar to Telegram but Bale endpoint
- Two adapters implement same interface — avoids duplicate logic
- Linking tables bale_links
- Rate limiting, no PII logs

## Backup Envelope Versioned Format — Migration Retention/Integrity/Restore/Encryption/Failure — REQUIRED PRODUCT CAPABILITY — B CONTRACT NOW BACKEND LATER

**Current:** `demo/backup.ts` versioned envelope:

- BACKUP_SCHEMA_VERSION 1.1, BACKUP_ENVIRONMENT demo, BACKUP_KIND arena.demo.backup, exportedAt ISO, app name seedVersion, stats counts total, data DemoDataset
- Validation: MALFORMED_JSON, NOT_AN_OBJECT, UNSUPPORTED_SCHEMA_VERSION, WRONG_ENVIRONMENT honest Persian, MISSING_COLLECTION, INVALID_COLLECTION, MISSING_ID, DUPLICATE_ID, INVALID_REFERENCE, FORBIDDEN_FIELD
- Security: FORBIDDEN_KEYS password/passwordHash/token/accessToken/refreshToken/apiKey/secret/sessiontoken/session_token/cookie/credentials/authorization, PROTOTYPE_KEYS __proto__/constructor/prototype stripping via stripPrototypeKeys recursive applied after JSON.parse before validation
- Referential integrity: classes teacherId roomId, enrollments studentId classId, sessions classId teacherId roomId, attendance sessionId entries studentId, scheduledSessions classId teacherId roomId date isIsoDate startTime endTime durationMinutes rescheduledFromId/ToId, sessionCompensations classId studentId originalSessionId uniqueness originalSessionId::studentId attempts sessionId scheduledAt scheduledByUserId uniqueness, pieces instrumentId, pieceAssignments studentId pieceId, progressEvents assignmentId studentId, students nationalId required valid unique via normalizeNationalId validateNationalId, invoices studentId, payments studentId, users role teacherId, findForbiddenKeys recursive depth 12

**F8 additions — Frontend Demo-Capable NOW (A):**

- Migration old->new: function `migrateBackupIfNeeded(backup)` that accepts old schemaVersion 1.0 → migrates to 1.1 (sets schemaVersion to 1.1, ensures environment demo, ensures kind, ensures app field, preserves data), returns { backup, migrated, fromVersion }. If version already 1.1, returns not migrated. If version unsupported (e.g. 99.0), returns error UNSUPPORTED_SCHEMA_VERSION honest. This satisfies F8 acceptance "migration accepts old envelopes".
- Integrity hash optional: interface `BackupIntegrity { algo: "sha256", hash: string }` optional field in DemoBackup `integrity?`, function `verifyBackupIntegrity(backup, expectedHash?)` that if integrity present verifies hash matches computed (for demo we can compute simple JSON hash placeholder, but for B contract backend must compute sha256 server-side). For frontend, we can have optional verification that if integrity field present, checks hash is non-empty hex string, without inventing crypto.
- Filename Persian safe: `backupFileName` already uses ISO replace, but should use `safeFilename` from import domain for Persian UTF-8 safe — VERIFIED via `safeFilename` reuse.
- Tests: backup.test.ts extended with migration old->new, WRONG_ENVIRONMENT honest, UNSUPPORTED_SCHEMA_VERSION honest, integrity hash optional, no business logic in bot.

**Backend Deferred B REQUIRED:**

- Version field migration accepts old envelopes — backend must accept old envelopes and migrate — B
- Integrity hash sha256 stored alongside verified on restore — B — backend computes hash server-side, stores in separate file or alongside, verifies on restore
- Environment label fixed always demo I8 + validation — VERIFIED frontend, backend must also validate WRONG_ENVIRONMENT honest
- Filename Persian UTF-8 safe — VERIFIED frontend, backend same
- PII encryption needed if sent externally OPEN — B — backend-only key, per O-09 O-20
- Retention O-19 indefinite first product — B — backend retention config later
- Backup restore versioned integrity encryption — B — per O-20

## Notifications via Telegram/Bale/SMS/Email — REQUIRED PRODUCT CAPABILITY — B CONTRACT NOW BACKEND LATER

- Provider enum in_app/telegram/bale/sms/email — VERIFIED
- Status unavailable when no backend — VERIFIED
- Settings notification toggles disabled 7 honest deferral Surfaces — VERIFIED settingsHonesty.test
- Contract doc for adapters already covers Telegram/Bale — B REQUIRED per O-17 correction
- Adapter architecture Core->Adapter->Telegram/Bale no business logic in bots — VERIFIED requirement

## Adapter Boundaries Clean — Core Business Logic Independent

**Rule:** Core business logic must remain independent of Telegram/Bale/external providers — adapter calls domain services, domain services enforce RBAC + scope.

**Verification:**

- `src/domains/chat/provider.ts` imports only `MessageProvider` `MessageStatus` from types — no enrollment, eligibility, RBAC, file resolution, persistence imports — VERIFIED via architectureBoundaries test
- `src/domains/demo/backup.ts` imports only DEMO_COLLECTIONS types seed nationalId dateBridge — no Telegram/Bale API, no token, no VITE_*, no external provider — VERIFIED
- Domain services (learning/eligibility.ts, auth/scope.ts, scheduling, attendance, compensation) have no Telegram/Bale imports — VERIFIED via architectureBoundaries
- No bot token, chat id, provider secret in React code, VITE_* variable, localStorage, committed demo data — VERIFIED security §24 — VITE_* values inlined into bundle at build time and are NOT secret

**Tests:**

- `src/domains/chat/__tests__/provider.test.ts` — adapter interface mock, availableProviders returns only in_app in demo, backendRequiredProvider returns unavailable with Persian reason, no network call, no token, no business logic
- `src/__tests__/architectureBoundaries.test.ts` — asserts provider.ts does not import enrollment/eligibility/RBAC/file resolution/persistence, backup.ts does not import Telegram/Bale, no VITE_* token in bundle
- `src/domains/demo/__tests__/backup.test.ts` — migration old->new, WRONG_ENVIRONMENT honest, UNSUPPORTED_SCHEMA_VERSION honest, integrity hash optional, forbidden keys, prototype keys

## Acceptance — F8

- Telegram backup REQUIRED: BackupService → TelegramBackupAdapter → Telegram Bot API sendDocument with encryption org key backend-only never in React, retention I7 research OPEN, integrity hash sha256 stored alongside verified on restore, restore decrypt validate envelope environment migration accepts old envelopes WRONG_ENVIRONMENT honest, encryption PII minors backend-only key, failure queued retry backoff honest status unavailable/failed with reason — B CONTRACT spec exists in this file + 10-integration-architecture.md — VERIFIED
- Telegram student access REQUIRED: StudentTelegramAdapter vs BackupAdapter different adapters not business owner, flow student links Telegram account via portal auth → bot verifies via code → student can query via bot commands /schedule /level /resources /progress /attendance /tickets each calls domain service with actor scope self linked studentId, no business logic in adapter, identity linking telegram_links, no PII in logs, rate limiting — B CONTRACT spec exists — VERIFIED
- Bale student access REQUIRED: same as Telegram Bale API common MessagingAdapter interface sendMessage domain services own RBAC scope eligibility file resolution persistence not adapter adapter only transmits avoid duplicate logic per D5 provider enum includes bale VERIFIED chat/types.ts status unavailable when no backend — VERIFIED
- Backup envelope versioned format: version field, migration accepts old envelopes, integrity hash optional, environment label fixed always demo I8 + validation, filename Persian UTF-8 safe, PII encryption needed if sent externally OPEN — VERIFIED backup.ts versioned + migration implemented F8 + this spec
- No business logic in bots — VERIFIED provider.ts + architectureBoundaries test
- Tests: adapter interface mock, identity linking validation, scope pure functions, backup restore versioned migration old->new WRONG_ENVIRONMENT honest, no business logic in bot asserted via architectureBoundaries — A NOW

## Risks

- Telegram backup retention/encryption PII minors — O-09/O-20 ACCEPT WITH CONDITIONS per `GOVERNANCE_CHECKPOINT.md` (prod = org `backup_jobs` to object storage; admin-gated; checksum; pre-restore snapshot; no secrets in blobs; Telegram/Bale = notify ± encrypted secondary, not source of truth; restore is not a naive overwrite) — retention numbers remain OPEN under O-19 (KEEP OPEN) and provider research I7 remains missing — REQUIRED per correction — mitigated by spec marking those residues OPEN with research tasks I7 *(reconciled 2026-09-21; the earlier “OPEN O-09 — needs product decision on semantics” wording predated the checkpoint)*
- Research I7 missing Telegram file retention/size/rate limits — OPEN — mitigated by spec marking OPEN
- Backup contains PII must encrypt backend-only — mitigated by spec encryption org key backend-only never in React
- Credentials backend-only never VITE_* localStorage — mitigated by security §24
- Rate limits verification requirements unknown — OPEN — mitigated by spec rate limiting

## Backend Impact — B CONTRACT NOW BACKEND LATER — REQUIRED PRODUCT CAPABILITY

- Bot API webhook POST /webhooks/telegram POST /webhooks/bale — receives updates, verifies signature, rate limits, maps chat_id → student_id via telegram_links/bale_links verified_at not null — B REQUIRED
- Credential handling backend-only .env TELEGRAM_BOT_TOKEN TELEGRAM_BACKUP_CHAT_ID BALE_BOT_TOKEN BALE_CHAT_ID BACKUP_ENCRYPTION_KEY — B REQUIRED — never in React
- Encryption org key AES-256-GCM backend-only — B REQUIRED
- Queue retry telegram_backup_queue table id backup_id org_id status queued/sent/failed attempts last_error created_at — B REQUIRED — retry 3 times exponential backoff 1m/5m/15m
- S3/MinIO MediaService → StorageProvider signed expiring URLs content-type sniffing virus scanning — B REQUIRED — per O-08 O-16
- Signed URLs per-object auth D15 — B REQUIRED
- Per-user read cursor chat_read_cursors — B REQUIRED — per F6
- Identity linking tables user_student_links telegram_links bale_links — B REQUIRED — per O-10 O-11
- No backend code in F8 — contract only — per hard boundary — frontend remains docs-only + migration helper A NOW

## Classification

B CONTRACT NOW BACKEND LATER — but REQUIRED PRODUCT CAPABILITY, not optional deferred unless product needs — wording corrected per review: Telegram backup = REQUIRED, Telegram student access = REQUIRED, Bale student access = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists — per 11-roadmap F8.

## References

- `docs/frontend-completion/10-integration-architecture.md` — Core Boundary, Telegram Adapter two use cases, Bale Adapter, Mobile App, Student Portal, Tickets/Chat/Files Topology, Media Abstraction, Telegram Backup Retention/Integrity/Restore/Encryption/Failure OPEN, Classification Summary CORRECTED
- `docs/frontend-completion/11-roadmap.md` F8 — goal, visible outcome, domains, deps, acceptance, tests, risks, backend impact, classification B CONTRACT NOW BACKEND LATER REQUIRED
- `docs/frontend-completion/12-decision-register.md` TG-01 NEW-TG-01 Telegram backup vs student access different adapters, BALE-01 NEW-BALE-01 Bale avoid duplicate logic, MOB-01 Mobile same backend, PORTAL-01 Student portal, CHAT-01 Tickets/chat/files topology
- `docs/frontend-completion/13-open-decisions.md` O-09 Telegram backup semantics REQUIRED, O-11 Bale linking REQUIRED, O-10 identity linking REQUIRED, O-12 mobile auth REQUIRED, O-13 student portal auth REQUIRED, O-14 org/user relation, O-08 file ownership REQUIRED, O-16 media storage REQUIRED, O-17 notification REQUIRED, O-20 backup restore REQUIRED
- `src/domains/chat/provider.ts` — MessageProviderAdapter interface, backendRequiredProvider honest unavailable, no token in React, no business logic
- `src/domains/demo/backup.ts` — versioned envelope BACKUP_SCHEMA_VERSION 1.1, environment demo, kind arena.demo.backup, FORBIDDEN_KEYS, PROTOTYPE_KEYS stripping, validation WRONG_ENVIRONMENT UNSUPPORTED_SCHEMA_VERSION, migration old->new F8
- `src/domains/auth/scope.ts` — identity linking validation, self scope
- `src/domains/learning/eligibility.ts` — canonical Level N=>1..N owner, no business logic in adapter
