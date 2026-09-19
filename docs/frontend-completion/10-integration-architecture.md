# 10 — Integration Architecture — Telegram / Bale / Mobile / Student Portal

> Integration boundary Core API->Auth+RBAC->Domain Services->Adapters Telegram/Bale/Mobile/Web Media abstraction App->Media/File abstraction->Storage provider Telegram backup retention/integrity/restore/encryption/failure OPEN

## Core Boundary

```
Core API (Laravel)
  → Auth + RBAC (Sanctum cookie primary + bearer fallback, org_id OrganizationScope, rolePermissions matrix)
    → Domain Services (students/teachers/classes/scheduling/attendance/compensation/learning/progress/library/gallery/branding/media/chat/export)
      → Adapters (TelegramAdapter, BaleAdapter, SmsAdapter, EmailAdapter)
        → External Providers (Telegram Bot API, Bale API)
      → Storage Provider (S3/MinIO via Media abstraction)
      → Clients (Web SPA, Mobile App, Student Portal)
```

- Frontend is client of same backend contracts — no second API — VERIFIED registry seam
- Media abstraction: App → Media/File abstraction → Storage provider — VERIFIED media/types.ts two-part split metadata dataset / bytes blobStore vs object storage
- Auth: Sanctum cookie primary + bearer fallback — B1 decision — VERIFIED ApiClient Bearer
- RBAC: server must enforce on every endpoint — frontend UX-only — VERIFIED permissions.ts header

## Telegram Adapter — Two Different Use Cases (Task J)

**Use case 1 — Backup (server-side):**
- What: Telegram as backup channel? Or notification? Task says "Telegram bot backup vs student access different adapters not business owner"
- Current: no backup via Telegram, backup is JSON file via demo/backup.ts with environment label demo always I8 — VERIFIED
- Desired backup via Telegram? Could be bot sends backup file to admin channel — but backup contains org data, needs encryption, retention, integrity, restore — OPEN per task
- Adapter: BackupService → TelegramBackupAdapter → Telegram Bot API sendDocument
- Retention: how long Telegram keeps file? Telegram file retention? Unknown — OPEN
- Integrity: hash of backup, verification on restore — needs spec
- Restore: from Telegram file — needs decryption, validation WRONG_ENVIRONMENT, migration — OPEN
- Encryption: backup contains PII (students minors) — must encrypt before sending to Telegram — OPEN, credentials backend-only
- Failure: Telegram unavailable → queued + retry, honest failure reporting — OPEN

**Use case 2 — Student Access (student portal via Telegram):**
- What: student accesses schedule/level/resources/progress/attendance/tickets/messages/files via Telegram bot
- Different adapter: StudentTelegramAdapter vs BackupAdapter — not business owner (business owner is academy, not Telegram)
- Flow: student links Telegram account via student portal auth → bot verifies via code → student can query via bot commands
- Commands: /schedule, /level, /resources, /progress, /attendance, /tickets — each calls domain service with actor scope self (linked studentId)
- No business logic in adapter — adapter calls domain services, domain services enforce RBAC + scope
- Identity linking: user ↔ student ↔ telegram_id — needs table telegram_links (user_id, student_id, telegram_chat_id, verified_at) — B
- Security: no PII in Telegram logs, no credentials in client, rate limiting

**Classification:**
- Telegram backup — C DEFERRED? Or B CONTRACT NOW? Task says backup vs student access different adapters not business owner — so both are B CONTRACT NOW BACKEND LATER, but backup may be C if not needed first product — needs decision: backup via Telegram is C DEFERRED (explicit), student access via Telegram is B CONTRACT NOW
- For now: contract spec for both, no implementation — B

## Bale Adapter — Contract Avoid Duplicate Logic (Task K)

- Same as Telegram but Bale API
- Core → Adapter → Telegram / Bale — avoid duplicate logic — so Core domain services same, Adapter interface common, TelegramAdapter and BaleAdapter implement same interface
- Interface: MessagingAdapter { sendMessage(conversationId, body, mediaId?) → MessageStatus, provider label }
- Deduplication: eligibility, scope, RBAC, file resolution, message persistence in domain service, not adapter — adapter only transmits
- Contract: provider enum already includes bale — VERIFIED chat/types.ts
- Status unavailable when no backend — VERIFIED
- Failure: same as Telegram — queued, unavailable, failed with statusReason
- Classification: B CONTRACT NOW BACKEND LATER

## Mobile App — Client of Same Backend Contracts (Task L)

- Mobile app is client of same backend contracts as Web SPA — no second API
- Auth: same Sanctum cookie/bearer, but mobile uses bearer token stored securely (not localStorage) — B
- Registry: same composition root, but mobile may have different overrides? Actually mobile uses same API endpoints — VERIFIED isApiMode would be true for mobile
- Media/File abstraction: App → Media/File abstraction → Storage provider — mobile uploads via same media endpoint, bytes to S3, metadata to DB
- Offline? Demo has local persistence, but mobile + backend would need offline queue? C DEFERRED
- Features: same as web? Or subset? For academy, mobile could be teacher/student portal — B contract
- No new backend — same Laravel domain structure — B1 decision: Laravel domain structure
- Classification: B CONTRACT NOW

## Student Portal Architecture (Task H)

### Profile

- Student's own profile: name, instrument, level, since, balance, photo via mediaId, guardian? — needs Student type fields
- Scope self: student sees own record where studentId = linked studentId — needs identity linking table
- Demo vs backend: demo single-viewer, no per-user — demo can simulate by selecting student in UI? But real portal needs auth — B

### Classes / Schedule

- Classes: enrollment active scoped to date → classes student enrolled in — via enrollment repo
- Schedule: sessions where classId in student's enrolled classes, bounded from/to window — via scheduling repo + enrollment
- Level: placement current level + history — via learning repo
- Resources: eligible content via resolveEligibleContent with placement — VERIFIED pure
- Progress: pieces assignments events — via progress repo
- Attendance: records where studentId = self, correction trail? — via attendance repo
- Tickets/Messages/Files: conversations where subjectId = studentId or role=student, messages in those conversations, files via mediaId — via chat + media

### Communication Demo vs Backend Identity

- Demo: single-viewer, no auth, chat unread per conversation — VERIFIED
- Backend: per-user read cursor, actor from token, org_id scoping, per-object auth for files
- Identity: student ↔ user linking + telegram linking + mobile auth — same linking table
- Auth: student portal auth separate from admin panel? D1 deferred decision: student role in this panel or separate app — currently deferred — so student portal could be separate app sharing same backend contracts — B contract

### Architecture

```
Student Portal SPA (or Mobile)
  → Auth (student credentials, not admin passphrase)
    → RBAC (student role has self scope only)
      → Domain Services (same as admin but scoped)
        → API Client (same envelope)
```

- No student role in admin panel (D1 deferred) — student portal is separate app or separate view with self scope — decision needed
- For frontend completion now: contract/UX preparation — mock student portal routes #/portal/profile etc with self scope filter over demo data — A? But task says student portal architecture B CONTRACT NOW BACKEND LATER — so spec doc now, no UI? Or UI contract preparation now — classify B

## Tickets / Chat / Files Topology (Task I)

### Auth

- Chat requires messages.read/write permission — VERIFIED
- No per-conversation auth yet — all conversations org-wide readable if permission — gap: should scope by subjectId? Teacher sees conversations where subjectId in assigned students? — OPEN decision

### Ownership

- Conversation has no owner field — needs owner userId + org_id — B
- Message from me/them — from is viewer-relative, not owner — needs actor userId — B
- MediaId reference — resolution != authorization — VERIFIED D15 — backend must enforce per-object ownership

### Unread / Read Scope

- Unread per conversation single-viewer demo — VERIFIED
- Backend needs per-user read cursor table (user_id, conversation_id, last_read_message_id, unread count) — B
- Nav badge sums unread where read complete — VERIFIED M7 — but per-user needed backend

### Validation / Storage

- Validation: body max 4000, mediaId must resolve — VERIFIED
- Storage: metadata dataset (conversations, messages), bytes blobStore — VERIFIED, but backend needs DB tables + object storage
- Export: single-conversation txt metadata only ceiling 1000 — VERIFIED, bulk deferred

### Topology

- Flat collections normalized, not nested — VERIFIED chat/README decision
- Thread list order by lastMessageAt — VERIFIED
- No tickets vs chat distinction — chat is tickets currently — needs decision: ticket has status open/closed? Or conversation is ticket? For academy, ticket could be support ticket separate from chat? OPEN

## Media Abstraction

- App → Media/File abstraction → Storage provider — VERIFIED two-part split
- Interface MediaRepository create/list/get/delete + blobStore put/get
- Demo: blobStore IndexedDB — VERIFIED
- Backend: S3/MinIO via MediaService → StorageProvider, signed expiring URLs, content-type sniffing, virus scanning — BACKEND REQUIRED documented — B
- Allowed types: image jpeg/png/webp/gif (SVG excluded XSS), audio mp3/mp4/ogg/wav/webm, doc pdf/txt — VERIFIED
- Size ceilings per kind — VERIFIED
- No data URL — mediaId ref only — VERIFIED

## Telegram Backup — Retention / Integrity / Restore / Encryption / Failure (OPEN)

- Retention: how long backup kept in Telegram? Telegram file storage indefinite? But channel may delete? Needs research I7 — OPEN
- Integrity: hash (sha256) of backup JSON, stored alongside, verified on restore — spec B
- Restore: decrypt, validate envelope environment, migration accepts old envelopes, integrity check — spec B, implementation B
- Encryption: backup contains PII minors — must encrypt with org key before sending to external provider — backend-only key, never in React — spec B
- Failure: Telegram API unavailable → queue, retry with backoff, honest status unavailable/failed with reason — spec B

## Classification Summary

| Capability | Classification | Reason |
|---|---|---|
| Telegram backup adapter | C DEFERRED (or B if product needs) | Backup via Telegram not needed first usable product, but contract spec B possible |
| Telegram student access adapter | B CONTRACT NOW | Student access via Telegram is integration, needs adapter contract, backend later |
| Bale adapter | B CONTRACT NOW | Same as Telegram, avoid duplicate logic via common MessagingAdapter interface |
| Mobile app | B CONTRACT NOW | Client of same backend, same contracts |
| Student portal architecture | B CONTRACT NOW | Contract/UX prep now, backend identity later |
| Media abstraction storage provider | B CONTRACT NOW | Abstraction exists, provider seam now, S3 later |
| Chat tickets topology | A NOW doc + B backend ownership/read cursor | Topology doc now, per-user cursor backend |
| Backup envelope fix I8 | B CONTRACT NOW | Versioned format change, migration |
| Notifications via Telegram/Bale/SMS/email | C DEFERRED except honest UI already | No provider integration without backend — D1/I7 |

## Acceptance

- Integration boundary diagram Core API→Auth+RBAC→Domain Services→Adapters exists
- Telegram backup vs student access different adapters documented, not business owner
- Bale adapter contract avoids duplicate logic Core->Adapter->Telegram/Bale documented
- Mobile app client of same backend contracts documented
- Media abstraction App->Media/File abstraction->Storage provider documented
- Student portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files demo vs backend identity documented
- Tickets/chat/files topology auth ownership unread/read scope validation storage documented
- Telegram backup retention/integrity/restore/encryption/failure marked OPEN with research tasks
