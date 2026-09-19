# 13 — Open Decisions Register

> student level scope level/resource relation visibility theme persistence export formats permission analytical contract ticket vs chat ownership scope file ownership Telegram backup semantics identity linking Bale linking mobile auth student portal auth org/user relation API boundaries media storage notification audit retention backup restore

## O-01 — Student Level Scope

- **Question:** Is placement per (student,program) or per student global? Can student be in multiple programs with different levels?
- **Context:** Learning access policy Level N => 1..N per program
- **Evidence:** Placement per (student,program) — VERIFIED types.ts StudentPlacement programId, history
- **Options:** (a) per program (current) — student can be violin classic L3 and violin irani L1 — (b) per student global single level — simpler but breaks multi-instrument
- **Recommendation:** Keep per (student,program) — already implemented, matches multi-instrument academy
- **Impact:** Frontend already per program, backend same table student_placements (student_id, program_id, level_id, assigned_at, history JSON)
- **Status:** OPEN — needs product confirmation
- **Follow-up:** Confirm with academy — but keep current as provisional

## O-02 — Level/Resource Relation

- **Question:** Library Resource vs Learning Content — are they same or different? Library.level string vs relation to LearningLevel?
- **Context:** Task B Library resource model type/level/visibility/search/filter/sort/preview/locked/metadata
- **Evidence:** Resource is catalogue item with mediaId, LearningContent is curriculum resource linked to levels via LevelContentLink — two types — VERIFIED
- **Options:** (a) Keep separate — Library catalogue public, LearningContent curriculum gated — (b) Merge — LibraryItem linked to LearningLevel via levelId
- **Recommendation:** Keep separate — different owners, different visibility — Library public if library.read, LearningContent gated via eligibility — proposal PROP-LIB-01
- **Impact:** Frontend filter library by level string vocabulary D, learning content by level relation; backend two tables
- **Status:** OPEN
- **Follow-up:** Product decision — but for frontend completion keep separate

## O-03 — Visibility Theme Persistence

- **Question:** Library visibility field — should LibraryItem have visibility students/teachers like LearningContent? Gallery visibility?
- **Context:** Library/Gallery audit genuine vs shallow albums/metadata/filtering/ordering/visibility storage seam
- **Evidence:** LearningContent has visibility students/teachers, LibraryItem has no visibility, Gallery no visibility — VERIFIED
- **Options:** (a) Add visibility to LibraryItem and Gallery — (b) Keep public if library.read — (c) Visibility via RBAC only (no field)
- **Recommendation:** (a) Add visibility optional — default students — for teacher-only resources — A NOW spec, B backend column
- **Impact:** Frontend filter chips visibility, backend column
- **Status:** OPEN

## O-04 — Theme Persistence

- **Question:** Should theme be org or device-local? Currently appearance device-local per D2, branding org — but task says theme editor WordPress-customizer-like academy identity name/tagline/logo/color system typography light/dark tokens
- **Context:** Settings/Theme editor
- **Evidence:** D2 viewer preference vs org data split, appearance localStorage, branding org — VERIFIED
- **Options:** (a) Keep device-local per D2 — personal preference — (b) Add org theme optional — academy can set default theme for all viewers, viewer can override — (c) All org — no personal
- **Recommendation:** (a) Keep device-local for first product per D2, (b) optional later — org default theme in organizations table default_theme, viewer override localStorage — needs decision
- **Impact:** Frontend no change for (a), for (b) add org default read
- **Status:** OPEN — proposal PROP-THEME-01 naming clarification also

## O-05 — Export Formats

- **Question:** Which formats for which entities? CSV/XLSX already, but PDF? TXT for chat already
- **Context:** Data Export students/teachers formats filters columns RTL Persian UTF-8 filename
- **Evidence:** exportService csv/xlsx, chat txt with BOM — VERIFIED
- **Options:** (a) CSV/XLSX for tabular, TXT for chat single-conversation — current — (b) Add PDF for reports/dashboard — needs finance/reports domain — C deferred — (c) Add JSON for backup? Already backup JSON separate
- **Recommendation:** Keep (a) for first product, PDF C deferred until finance/reports — D6/I2
- **Impact:** None for first product
- **Status:** OPEN but provisional keep (a)

## O-06 — Permission Analytical Contract

- **Question:** What permission for dashboard export and analytical export? reports.read? students.read? dashboard view permission is students.read
- **Context:** Dashboard analytical export, export permission
- **Evidence:** viewPermissions dashboard: students.read, reports: reports.read — VERIFIED
- **Options:** (a) Dashboard export requires students.read (same as view) — (b) Requires reports.read — more restrictive — (c) New permission dashboard.export
- **Recommendation:** (a) Same as view — students.read — simplest, no new permission unless gap proven — smallest permission model
- **Impact:** Frontend guard same as view, backend same
- **Status:** OPEN

## O-07 — Ticket vs Chat Ownership Scope

- **Question:** Are tickets same as chat conversations or separate? Ticket has status open/closed? Ownership?
- **Context:** Tickets/Chat/Files topology
- **Evidence:** chat domain is conversations/messages, no ticket status, subjectId optional student/teacher — VERIFIED
- **Options:** (a) Conversation is ticket — status via archived? Or via topic? — (b) Separate ticket entity with status open/closed, linked to conversation — (c) Ticket is conversation with subjectId and status field
- **Recommendation:** (c) Add status field to conversation? Or keep simple for first product: conversation is ticket, archived = closed — for now keep simple, decision later
- **Impact:** Frontend no change for first product, backend may add status column later
- **Status:** OPEN

## O-08 — File Ownership

- **Question:** Who owns files? MediaAsset has no owner field — needs owner userId + org_id for per-object auth
- **Context:** Tickets/Chat/Files topology, media abstraction
- **Evidence:** media/types.ts no owner, D15 resolution != auth — VERIFIED
- **Options:** (a) Add owner userId + org_id to media_assets — (b) Owner via referencing entity (e.g. chat message mediaId owned by conversation) — (c) No owner, org-wide readable if permission
- **Recommendation:** (a) Add owner + org_id — simplest for per-object auth, backend must enforce
- **Impact:** Backend table media_assets owner_id org_id, signed URLs check owner or org permission
- **Status:** OPEN — B contract

## O-09 — Telegram Backup Semantics — CORRECTED 2026-09-19 REQUIRED PRODUCT CAPABILITY

- **Question:** What is backup via Telegram? Bot sends backup file to admin channel? Retention? Integrity? Restore? Encryption? Failure?
- **Context:** Task J Telegram bot backup vs student access different adapters not business owner — adapter architecture Core domain/business logic → integration adapter → Telegram, no business logic in bots
- **Evidence:** backup.ts JSON file environment always demo I8, no Telegram integration, research missing I7 — VERIFIED
- **Options:** (a) Telegram backup is notification that backup ready + file sent to admin channel — needs encryption backend-only key — (b) Telegram backup is alternative storage — file sent to Telegram, retention indefinite? But Telegram file storage? — (c) C DEFERRED — backup stays local file, Telegram only for student access — **previous recommendation (c) was pre-correction, now corrected per review**
- **Recommendation CORRECTION (2026-09-19 review):** Telegram backup = **REQUIRED PRODUCT CAPABILITY** — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → BackupAdapter → Telegram Bot API sendDocument, no business logic in bot, backend-only credentials, PII encryption org key, retention/integrity/restore/encryption/failure spec B REQUIRED — not optional deferred unless product needs — wording "C DEFERRED" corrected to REQUIRED PRODUCT CAPABILITY
- **Impact:** Contract spec for backup exists B, implementation deferred until backend/integration layer — backup contains PII minors must encrypt before sending to external provider backend-only key, credentials backend-only never VITE_* localStorage, rate limiting, queue retry, integrity hash sha256, environment validation WRONG_ENVIRONMENT honest, migration accepts old envelopes, filename Persian UTF-8 safe
- **Status:** OPEN — needs product decision on semantics retention/encryption/integrity/restore but REQUIRED PRODUCT CAPABILITY per correction — O-09 remains OPEN but classification corrected to REQUIRED PRODUCT CAPABILITY B CONTRACT NOW BACKEND LATER
- **Classification correction:** Previous C DEFERRED corrected to REQUIRED PRODUCT CAPABILITY — B CONTRACT NOW BACKEND LATER (implementation deferred)

## O-10 — Identity Linking

- **Question:** How to link user ↔ student ↔ telegram ↔ bale ↔ mobile?
- **Context:** Student portal, Telegram/Bale adapters, mobile auth
- **Evidence:** No linking table, D1 deferred, no student role — VERIFIED
- **Options:** (a) Table user_student_links (user_id, student_id, relation self/guardian, verified_at) — (b) Student has user_id FK — simpler but 1-1 not guardian — (c) Separate tables telegram_links (user_id, student_id, telegram_chat_id, verified_at), bale_links similar, mobile auth via bearer token
- **Recommendation:** (a) + (c) — user_student_links for self/guardian, telegram_links and bale_links for bot linking, mobile auth via bearer token same as web but secure storage
- **Impact:** Backend tables, frontend scope pure functions use linked studentId
- **Status:** OPEN — B contract

## O-11 — Bale Linking — CORRECTED 2026-09-19 REQUIRED PRODUCT CAPABILITY

- **Question:** Same as Telegram but Bale — should linking flow be same? Avoid duplicate logic? Bale student access REQUIRED?
- **Context:** Task K Bale adapter contract avoid duplicate logic Core->Adapter->Telegram/Bale — adapter architecture Core domain/business logic → integration adapter → Bale, no business logic in bots
- **Evidence:** provider enum includes bale, no linking — VERIFIED
- **Options:** Same as Telegram — common linking flow, common MessagingAdapter interface — avoid duplicate logic via common interface
- **Recommendation CORRECTION:** Bale student access = **REQUIRED PRODUCT CAPABILITY** — IMPLEMENTATION may remain deferred until backend/integration layer exists — same flow as Telegram, avoid duplicate logic via common MessagingAdapter interface — Core->Adapter->Telegram/Bale no business logic in bots — B CONTRACT NOW BACKEND LATER but REQUIRED per correction
- **Impact:** Backend two adapters implement same interface, linking tables similar bale_links, identity linking, scope self, no PII in logs, rate limiting
- **Status:** OPEN — B contract but REQUIRED PRODUCT CAPABILITY per correction

## O-12 — Mobile Auth — CORRECTED 2026-09-19 REQUIRED PRODUCT CAPABILITY

- **Question:** Mobile auth — bearer token secure storage vs Sanctum cookie? Same backend? Mobile student client REQUIRED?
- **Context:** Task L Mobile app client of same backend contracts — Mobile student client = REQUIRED PRODUCT CAPABILITY per correction
- **Evidence:** B1 Sanctum cookie primary + bearer fallback, ApiClient bearer — VERIFIED
- **Options:** (a) Bearer token for mobile, cookie for web — same backend supports both per B1 — (b) Only bearer — simpler — (c) OAuth
- **Recommendation CORRECTION:** Mobile student client = **REQUIRED PRODUCT CAPABILITY** — IMPLEMENTATION may remain deferred until backend/integration layer exists — (a) Per B1 — Sanctum cookie primary web + bearer fallback mobile — already decided provisional — B CONTRACT NOW BACKEND LATER but REQUIRED per correction — mobile app client of same backend contracts same envelope Collection/Item PageMeta same domain repos same RBAC media/file abstraction -> storage provider bearer secure storage
- **Impact:** Backend Sanctum, mobile secure storage for token, same Laravel structure B1
- **Status:** OPEN but provisional B1 — REQUIRED PRODUCT CAPABILITY per correction

## O-13 — Student Portal Auth — CORRECTED 2026-09-19 REQUIRED PRODUCT CAPABILITY

- **Question:** Student portal auth separate from admin panel? D1 says no student role in admin panel — so portal is separate app with separate auth? Student portal REQUIRED?
- **Context:** Task H Student Portal architecture — Student portal = REQUIRED PRODUCT CAPABILITY? Actually per correction Telegram/Bale/Mobile/Backup = REQUIRED, Student portal architecture also REQUIRED? Task says Telegram/Bale/Backup classification correct wording but also Mobile REQUIRED — student portal architecture is part of F7 REQUIRED? Per roadmap F7 Student Portal is REQUIRED PRODUCT CAPABILITY B contract
- **Evidence:** D1 deferred, no student role, auth demo passphrase — VERIFIED
- **Options:** (a) Separate app with student credentials (phone + OTP?) — (b) Same panel but self scope view #/portal — (c) No portal first product — contract only
- **Recommendation CORRECTION:** Student portal = **REQUIRED PRODUCT CAPABILITY** — B CONTRACT NOW BACKEND LATER (implementation deferred until backend/integration layer exists) — (c) Contract only for first product — portal spec doc B, no UI — then (a) separate app later — keeps admin RBAC clean — per correction Telegram/Bale/Mobile/Backup REQUIRED, student portal also REQUIRED as part of product but implementation deferred until backend/integration layer
- **Impact:** No student auth in admin for first product, portal contract B REQUIRED
- **Status:** OPEN — REQUIRED PRODUCT CAPABILITY per correction

## O-14 — Org/User Relation

- **Question:** How is org related to user? OrganizationScope, org_id on all tables?
- **Context:** Integration boundary Core API->Auth+RBAC->Domain Services
- **Evidence:** OrganizationScope mentioned in docs, but no org_id in frontend types — VERIFIED — demo single org
- **Options:** (a) All tables have org_id FK, OrganizationScope global scope — (b) Single org for first product — simpler
- **Recommendation:** (b) Single org for first product demo, (a) for backend Laravel — B contract
- **Impact:** Backend all tables org_id, frontend demo single org
- **Status:** OPEN but provisional single org demo

## O-15 — API Boundaries

- **Question:** What are API boundaries for each domain? Which endpoints? Which envelope? Which error kinds?
- **Context:** Integration boundary
- **Evidence:** ApiClient baseUrl Bearer envelope Collection/Item PageMeta error kinds 401/403/404/409/422/5xx — VERIFIED
- **Options:** Keep current envelope, add binary client for media/library/gallery, add streaming for export, add per-user cursor for chat, add identity linking endpoints
- **Recommendation:** Keep envelope, add binary client B, streaming B, cursor B, linking B — contract docs
- **Impact:** Backend needs binary upload endpoint, export streaming, chat cursor, linking
- **Status:** OPEN — B contract

## O-16 — Media Storage

- **Question:** Storage provider S3/MinIO vs local? Signed URLs? Scanning? Content sniffing? Size ceilings?
- **Context:** Media abstraction App->Media/File abstraction->Storage provider
- **Evidence:** media/types.ts allow-list image jpeg/png/webp/gif SVG excluded XSS, audio mp3/mp4/ogg/wav/webm, doc pdf/txt, size ceilings per kind — VERIFIED
- **Options:** (a) S3/MinIO with signed expiring URLs, content-type sniffing, virus scanning, size ceilings server-enforced same as frontend — (b) Local storage for first backend — simpler but not scalable
- **Recommendation:** (a) S3/MinIO — standard, scalable, secure — B
- **Impact:** Backend MediaService -> StorageProvider, signed URLs, scanning
- **Status:** OPEN — B contract

## O-17 — Notification — CORRECTED 2026-09-19 REQUIRED PRODUCT CAPABILITY

- **Question:** Notifications via Telegram/Bale/SMS/email — provider integration? REQUIRED?
- **Context:** Settings notification toggles disabled honest, chat provider enum — Telegram/Bale student access REQUIRED per correction, so notification via Telegram/Bale is REQUIRED PRODUCT CAPABILITY
- **Evidence:** notifications README, toggles disabled 7, provider enum in_app/telegram/bale/sms/email, status unavailable — VERIFIED
- **Options:** (a) C DEFERRED — no provider integration without backend — honest UI already — (b) B CONTRACT NOW — adapter contract but no implementation — **(b) corrected per review REQUIRED PRODUCT CAPABILITY**
- **Recommendation CORRECTION:** Notifications via Telegram/Bale/SMS/email = **REQUIRED PRODUCT CAPABILITY** — B CONTRACT NOW BACKEND LATER (implementation deferred until backend/integration layer exists) — honest UI stays, contract doc B for adapters already covers Telegram/Bale — adapter architecture Core->Adapter->Telegram/Bale no business logic in bots — per correction Telegram/Bale/Mobile/Backup REQUIRED
- **Impact:** None for first product implementation deferred, contract doc exists REQUIRED
- **Status:** OPEN but provisional B CONTRACT NOW BACKEND LATER — REQUIRED PRODUCT CAPABILITY per correction

## O-18 — Audit

- **Question:** Audit log — who did what when? Retention?
- **Context:** Finance/Reports, attendance provenance, compensation lineage
- **Evidence:** Attendance has recorderId + recordedAt + correction trail, compensation has actor userId + lineage via currentAttempt.sessionId + attempt ledger — VERIFIED, but no general audit log
- **Options:** (a) General audit log table (user_id, action, resource, resource_id, org_id, timestamp, metadata) — (b) Per-domain provenance only (current) — (c) C DEFERRED
- **Recommendation:** (b) For first product — per-domain provenance already (attendance, compensation) — general audit log B later
- **Impact:** Backend audit table B
- **Status:** OPEN

## O-19 — Retention

- **Question:** Data retention — how long keep attendance, compensation, messages, media, backups?
- **Context:** Integration, backup, Telegram backup retention
- **Evidence:** No retention policy doc, demo data persistent IndexedDB — VERIFIED
- **Options:** (a) Keep indefinitely for academy (simplest) — (b) Configurable retention per domain — (c) Legal requirement for minors PII?
- **Recommendation:** (a) For first product — keep indefinitely, (b) later configurable — needs legal check for minors
- **Impact:** Backend retention config B later
- **Status:** OPEN

## O-20 — Backup Restore — CORRECTED 2026-09-19 REQUIRED PRODUCT CAPABILITY

- **Question:** Backup restore — versioned format, migration, integrity, encryption, failure? REQUIRED?
- **Context:** Demo backup.ts, Telegram backup retention/integrity/restore/encryption/failure OPEN — Telegram backup = REQUIRED PRODUCT CAPABILITY per correction
- **Evidence:** I8 environment always demo label wrong, no version, no migration, no hash, no encryption — VERIFIED
- **Options:** (a) Versioned format with migration, hash integrity, env validation, filename safe, encryption optional for external — B contract — REQUIRED PRODUCT CAPABILITY — (b) Keep current simple JSON — dishonest labels
- **Recommendation CORRECTION:** (a) Versioned format — slice 9 / F8 — **REQUIRED PRODUCT CAPABILITY** — B CONTRACT NOW BACKEND LATER (implementation deferred until backend/integration layer exists) — backup envelope versioned, migration accepts old envelopes, integrity hash optional, environment label fixed always demo I8 + validation, filename Persian UTF-8 safe, PII encryption needed if sent externally backend-only key, retention/integrity/restore/encryption/failure spec B REQUIRED — per correction Telegram backup REQUIRED
- **Impact:** Frontend backup envelope versioned, backend encryption + retention B REQUIRED
- **Status:** OPEN — B contract but REQUIRED PRODUCT CAPABILITY per correction

## Summary Table — CORRECTED 2026-09-19 REQUIRED PRODUCT CAPABILITY

| ID | Title | Status | Classification |
|---|---|---|---|
| O-01 | Student level scope global vs per-program vs per-instrument OPEN | OPEN | B contract — keep per program provisional — high-cost before backend |
| O-02 | Level/resource relation separate vs merged | OPEN | A doc + B backend — keep separate — high-cost before backend |
| O-03 | Visibility library/gallery | OPEN | A spec + B column |
| O-04 | Theme persistence org vs device | OPEN | A keep device-local per D2, B org optional |
| O-05 | Export formats | OPEN | A csv/xlsx/txt, C pdf deferred |
| O-06 | Permission analytical export | OPEN | A same as view |
| O-07 | Ticket vs chat ownership scope | OPEN | A keep conversation= ticket archived=closed |
| O-08 | File ownership owner+org_id | OPEN | **REQUIRED PRODUCT CAPABILITY** B owner+org_id — high-cost before backend |
| O-09 | Telegram backup semantics | OPEN | **REQUIRED PRODUCT CAPABILITY** B CONTRACT NOW BACKEND LATER (implementation deferred) — high-cost before backend — corrected from C deferred to REQUIRED per review |
| O-10 | Identity linking user↔student self/guardian | OPEN | **REQUIRED PRODUCT CAPABILITY** B linking tables — high-cost before backend |
| O-11 | Bale linking | OPEN | **REQUIRED PRODUCT CAPABILITY** B same as Telegram common interface — implementation deferred |
| O-12 | Mobile auth bearer vs cookie | OPEN | **REQUIRED PRODUCT CAPABILITY** B B1 cookie primary + bearer fallback — Mobile student client REQUIRED |
| O-13 | Student portal auth separate app | OPEN | **REQUIRED PRODUCT CAPABILITY** B contract only first product — high-cost before backend |
| O-14 | Org/user relation org_id all tables | OPEN | **REQUIRED PRODUCT CAPABILITY** B all tables org_id, demo single org — high-cost before backend |
| O-15 | API boundaries envelope binary streaming cursor linking | OPEN | B contract |
| O-16 | Media storage S3 signed scanning | OPEN | **REQUIRED PRODUCT CAPABILITY** B S3 signed expiring URLs scanning per-object auth |
| O-17 | Notification provider integration | OPEN | **REQUIRED PRODUCT CAPABILITY** B CONTRACT NOW BACKEND LATER honest UI — corrected from C deferred to REQUIRED per review |
| O-18 | Audit log general vs per-domain | OPEN | B later, per-domain now |
| O-19 | Retention indefinite vs configurable | OPEN | A indefinite first product — B later |
| O-20 | Backup restore versioned integrity encryption | OPEN | **REQUIRED PRODUCT CAPABILITY** B versioned format — implementation deferred — corrected from B to REQUIRED per review |

**Correction note:** O-09, O-11, O-12, O-13, O-17, O-20 previously C deferred or B contract but not marked REQUIRED — now corrected to **REQUIRED PRODUCT CAPABILITY — B CONTRACT NOW BACKEND LATER (implementation deferred until backend/integration layer exists)** per 2026-09-19 review — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile no business logic in bots.

## High-Cost Decisions to Resolve Before Coding (per task principles)

1. O-01 student level scope — per program vs global — affects placement table
2. O-02 level/resource relation — separate vs merged — affects library vs learning content tables
3. O-10 identity linking — user↔student relation self/guardian — affects portal auth + scope
4. O-13 student portal auth — separate app vs same panel — affects RBAC + routes
5. O-14 org/user relation — org_id on all tables — affects backend schema all domains
6. O-08 file ownership — owner+org_id — affects media table + per-object auth
7. O-09 Telegram backup semantics — C deferred decision — affects backup encryption retention

These 7 must be decided before Laravel schema/API — documented here, not silently assumed.
