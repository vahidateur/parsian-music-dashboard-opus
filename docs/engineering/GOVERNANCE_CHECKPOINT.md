# Governance Decision Register — Laravel-bound checkpoint

**Recorded:** 2026-09-20  
**Workspace branch:** `arena/01a0bf6d-parsian-music-dashboard-opus`  
**Parent HEAD at record:** `02b74996e6458d10a5d9e8d1023890239342c4e4` (frontend freeze; this file does not implement backend)  
**Nature:** documentation-only closure of product/architecture audits. **Does not authorize** Laravel code, migrations, or frontend edits.

IDs **T-02** and **O-*** are **not** D1–D20 in [DECISIONS.md](DECISIONS.md) §19. D1–D20 stay unchanged. This register does not reopen closed D-entries.

Evidence was frozen frontend (PR #4 / local contracts) plus prior session audits. Implementation remains **BACKEND REQUIRED**.

---

## Index

| ID | Topic | Status | v1 Laravel |
|---|---|---|---|
| T-02 | Teacher student-read scope | **ACCEPTED / ASSIGNED-ONLY** | Enforce in query/policy |
| O-12 | Web vs mobile auth transport | **ACCEPTED / DUAL TRANSPORT** | Same `/api/v1`; cookie web, Bearer mobile |
| O-13 | Student portal authentication | **ACCEPTED** | Same `users`; separate guard; credential factor **OPEN** |
| O-10 / O-11 | Telegram / Bale identity | **ACCEPTED** | `chat_id` → `user_id` + `org_id`; uniqueness/UX **OPEN** |
| O-08 | Ownership | **ACCEPT WITH CONDITIONS** | No universal `owner_id` |
| O-09 / O-20 | Backup / restore | **ACCEPT WITH CONDITIONS** | Org jobs + object storage; demo JSON ≠ prod |
| O-14 | Organization / tenant | **ACCEPT WITH CONDITIONS** | `users.organization_id` NOT NULL; tenant from auth |
| O-16 | Media storage | **ACCEPT WITH CONDITIONS** | Metadata DB; bytes object storage; signed URL after ACL |
| O-18 | Audit / event logging | **ACCEPT WITH CONDITIONS** | Append-only security log ≠ app log ≠ domain history |
| O-15 | API boundaries | **ACCEPT WITH CONDITIONS** | `/api/v1` JSON envelope; files not wrapped |
| PERF | Performance / resources | **ACCEPT WITH CONDITIONS** | Architecture now; no Redis/WS/ES/CDN/microservices |
| O-07 | Tickets / support | **KEEP OPEN** | **No** tickets domain in v1 |
| O-17 | Notifications | **KEEP OPEN** | **No** notifications domain in v1 |
| O-19 | Retention / erasure | **KEEP OPEN** | No numeric policy; no purge workers |
| HELP | Help / Training / KB / AI | **KEEP OPEN** | **No** Help/KB/AI in v1 (not register O-15) |

---

## ACCEPTED

### T-02 — Teacher Scope — ACCEPTED / ASSIGNED-ONLY

Teacher student-read = **active enrollment ∩ `class.teacherId`**. `Student.teacherId` is **not** authorization. Fail-closed. Do not revisit.

### O-12 — Authentication Persistence — ACCEPTED / DUAL TRANSPORT

One identity, one `/api/v1`. **Web:** Sanctum cookie. **Mobile:** Bearer in OS secure storage. Demo `localStorage` is **not** production.

### O-13 — Student Portal Authentication — ACCEPTED

Portal = **separate guard**, **same `users`**. Access via verified `user_student_links`. **OPEN:** portal credential factor (password vs OTP vs other).

### O-10 / O-11 — Telegram / Bale Identity Linking — ACCEPTED

Messaging `chat_id` binds to **`user_id` + `org_id`**. Adapters are not authorization. Do not require `student_id` on the link row as the authz key. **OPEN:** uniqueness details and linking UX. Tokens never in the SPA.

---

## ACCEPT WITH CONDITIONS

### O-08 — Ownership

No personal `owner_id` on catalogue/academy rows. Tenant = `organization_id`. `created_by` / `uploaded_by` / `recordedByUserId` = **provenance**, not ACL. Media ACL = parent + org + T-02/O-13. Unreferenced media = uploader or admin. Backup jobs are org-level.

### O-09 / O-20 — Backup / Restore

Demo `kind: arena.demo.backup` JSON (no bytes) is **not** production. Prod = org `backup_jobs` to **object storage**; admin-gated; checksum; pre-restore snapshot; **no secrets** in blobs. Telegram/Bale = notify ± encrypted **secondary**, not source of truth. Restore is not a naive overwrite.

### O-14 — Organization / Tenant

Real tenancy. v1: many users : one org via **`users.organization_id` NOT NULL**. No membership pivot in v1. Tenant from **token**, not client body/header. `user_student_links.organization_id` must match user.org and student.org. Uniqueness of national_id/phone/room/instrument **per org**; email/org slug **global**. Org `status` suspend = fail-closed. No super-admin switcher.

### O-16 — Media Storage

`media_assets` metadata + **object storage** (S3/MinIO or local driver, same contract). No `owner_id`. No public permanent URL. Server size/MIME/sniff. Two-phase upload then parent `mediaId`. Signed GET **after** authz. No video kind in v1. Orphan = uploader/admin. Refuse delete while parent FKs exist.

### O-18 — Audit / Event Logging

One append-only `audit_events` for **security-relevant** actions (login, account/role, export, delete, backup, media, identity link). Not Event Sourcing. Not Laravel logs. Not progress/attendance history. Actor from server principal. No secrets/PII bodies. Retention **OPEN (O-19)**. Frontend must not `POST /audit`.

### O-15 — API Boundaries

Prefix **`/api/v1`**. JSON `{ "data" }` / `{ "data", "meta": { page, per_page, total } }`. Errors `{ "error": { code, message, fields? } }`. Wire **snake_case**; ISO-8601 dates; Jalali is UI. 401/403/404/409/422/5xx as in `ApiError.kind`. **204** allowed on DELETE. **Do not** JSON-wrap files. Media bytes and export/backup downloads are raw or signed URL. Backup/restore = **async job** + status. Authz in **policy/SQL**, not load-then-filter. GraphQL / universal CRUD: no.

### PERF — Performance / Resource Strategy

Order: **Measure → Profile → Bottleneck → Change → Re-measure**.

**Architectural now:**

- Pagination and a **server-side `per_page` cap** (do not freeze a magic default as law)
- Tenant / T-02 / O-13 filtering **inside SQL/query**, never load-then-filter
- Indexes only for real filters / FKs / uniques (org + T-02 join keys)
- Time-bounded calendar/session queries
- Media bytes **outside** the Laravel request path (object storage + signed URL)
- Backup / restore / large export as **async jobs**
- Keep frontend **code-splitting** (D9); do not undo it for speed theatre
- Audit **must not** sit on the hot path of ordinary reads

**Ongoing operational requirement**, **not** a blocker for Laravel v1 schema.

**Do not build now:** Redis, Elasticsearch, WebSocket, CDN, microservices, or similar “for later.”

---

## KEEP OPEN

### O-07 — Tickets / Support

No tickets domain in v1. Chat ≠ helpdesk. Do not invent assignee/SLA/priority.

### O-17 — Notifications

No notifications domain in v1. Toast ≠ inbox. Chat unread ≠ alerts. Attendance/compensation currently **must not claim** a send. Backup may notify via existing adapter **without** an inbox table. AI **must not** create notifications.

### O-19 — Retention / Erasure

**No numeric retention policy is evidenced.** Archive/deactivate ≠ delete. Do not cascade-delete attendance/progress/compensation. No purge/anonymize/legal-hold workers until product/legal close this.

### Help / Training / Knowledge Base / AI readiness

Not register O-15. No Help CMS, RAG, vector DB, or in-app AI in v1. Operator copy stays in the SPA. `learning`/`library` are pedagogy, not staff Help.

---

## Explicitly not in this checkpoint

Laravel implementation, migrations, frontend source, dependency bumps, branch moves, and reopening T-02 / closed O-* conditions above.
