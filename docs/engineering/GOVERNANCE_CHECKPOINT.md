# Governance Decision Register — Laravel-bound checkpoint

**Recorded:** 2026-09-21  
**Workspace branch:** `arena/01a0bf6d-parsian-music-dashboard-opus`  
**Parent HEAD at record:** `02b74996e6458d10a5d9e8d1023890239342c4e4` (frontend freeze; this file does not implement backend)  
**Nature:** documentation-only closure of product/architecture audits. **Does not authorize** Laravel code, migrations, or frontend edits.

> **Date provenance.** First recorded **2026-09-20** (the date cited by [DECISIONS.md](DECISIONS.md) §20, `SESSION_HANDOFF.md` and `PROJECT_STATE.md`); amended **2026-09-21** to add the O-01 / O-02 closure rows. Both dates are correct for what they name; no T-02 / O-* / PERF / HELP status changed between them. Further amended **2026-11-10** to add the owner-approved RBAC decisions `T-02-A` / `O-21`..`O-23`; **revised 2026-11-12** with the owner's clarification that the current `accountant` role is the Secretary and `staff` is not; **amended 2026-11-13** to record the backend enforcement status of `T-02-A` and the current financial-transaction blocker; **amended 2026-11-14** to record the owner-approved F2 decisions `T-02-B`..`T-02-H` and the confirmed `O-24` financial scope, then to record the Stage 18.1 implementation of B2/C1/PB-1. The 2026-09-21 statuses and the 2026-11-10 draft are preserved as historical.

IDs **T-02** and **O-*** are **not** D1–D20 in [DECISIONS.md](DECISIONS.md) §19. D1–D20 stay unchanged. This register does not reopen closed D-entries.

Evidence was frozen frontend (PR #4 / local contracts) plus prior session audits. Implementation remains **BACKEND REQUIRED**.

---

## Index

| ID | Topic | Status | v1 Laravel |
|---|---|---|---|
| T-02 | Teacher student-read scope | **ACCEPTED / ASSIGNED-ONLY — REAFFIRMED 2026-11-12 (T-02-A)** | Enforce in query/policy; owner decision extends the rule to all student-targeted operations |
| T-02-A | T-02 Student Access Scope — owner reaffirmation and extension | **APPROVED — 2026-11-12; Progress/Learning enforcement implemented 2026-11-13; Stage 18.1 B2/C1 implemented 2026-11-14** | Progress/Learning and class/enrollment student-targeted queries enforced; Stages 18.2–18.6 pending |
| T-02-B | Class visibility for teachers | **APPROVED — B2 — IMPLEMENTED 2026-11-14; write-side field denial APPROVED 2026-11-16** | Assigned-class-only server scope and field redaction; a teacher write carrying `tuition`/`attendanceAvg`/`termProgress` is denied `403` regardless of a `classes.write` override (2026-11-16); see [F2 decision packet](T02_F2_OWNER_DECISION_PACKET.md) |
| T-02-C | Enrollment visibility for teachers | **APPROVED — C1 — IMPLEMENTED 2026-11-14** | Active-only, assigned-class server scope and pricing redaction; see [F2 decision packet](T02_F2_OWNER_DECISION_PACKET.md) |
| T-02-D | Historical teacher access after assignment termination | **APPROVED — D2 — 2026-11-14** | Implementation pending Stage 18.2 after provenance/history design; see [F2 decision packet](T02_F2_OWNER_DECISION_PACKET.md) |
| T-02-E | Withdrawn/completed student access | **APPROVED — E1 — 2026-11-14** | Implementation pending Stage 18.2; see [F2 decision packet](T02_F2_OWNER_DECISION_PACKET.md) |
| T-02-F | Substitute teacher access | **APPROVED — F3 — 2026-11-14** | Schema/permission review required before Stage 18.3; see [F2 decision packet](T02_F2_OWNER_DECISION_PACKET.md) |
| T-02-G | Ownership transfer and reassignment | **APPROVED — G3 — 2026-11-14** | Implementation pending Stage 18.4 after history design; see [F2 decision packet](T02_F2_OWNER_DECISION_PACKET.md) |
| T-02-H | `staff` role purpose and permissions | **APPROVED — H4 — 2026-11-14** | Retire `staff`; Reception matrix/migration review required before Stage 18.5; see [F2 decision packet](T02_F2_OWNER_DECISION_PACKET.md) |
| O-24 | Financial transaction lifecycle and audit | **CONFIRMED — invoice-only v1 — 2026-11-14** | No financial lifecycle expansion; see [F2 decision packet](T02_F2_OWNER_DECISION_PACKET.md) §8 |
| O-21 | Secretary role represented by the current `accountant` role | **APPROVED — 2026-11-12** | Responsibility boundary; no permission/default change here |
| O-22 | Future finance separation — Accountant and Finance Manager | **APPROVED — INTENT ONLY; activation NOT APPROVED — 2026-11-12** | No future role creation/activation; migration requires separate approval |
| O-23 | Dynamic role-holder counts, role assignment, and permission assignment | **APPROVED — 2026-11-12** | Requirement only; current role-only permission model unchanged |
| O-01 | Student level scope (per-program/instrument) | **DECIDED 2026-09-21 — PER-PROGRAM** | Placement key `(student_id, program_id)`; one active placement per (student, program); level independent per program/instrument; teacher may grant exceptional per-resource access (resource-grant only, no level change; persistence model future decision). See `docs/frontend-completion/12-decision-register.md` → “O-01 closure — 2026-09-21”. |
| O-02 | Library resource level | **DECIDED 2026-09-21 — DESCRIPTIVE VOCABULARY** | `library_items.level` is descriptive catalogue string vocabulary; NOT an authorization field; NO direct FK to `learning_levels`; student learning eligibility remains governed by O-01 and the Learning domain; exact database column type/length is a Laravel migration implementation detail (no specific SQL type/length enforced as product requirement). See `docs/frontend-completion/12-decision-register.md` → “O-02 closure — 2026-09-21”. |
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

### O-01 — Student Level Scope — DECIDED 2026-09-21 — PER-PROGRAM

Placement key `(student_id, program_id)`; one active placement per (student, program); level independent per program/instrument; teacher exceptional per-resource access (resource-grant only, no level change). See `docs/frontend-completion/12-decision-register.md` → “O-01 closure — 2026-09-21”.

### O-02 — Library Resource Level — DECIDED 2026-09-21 — DESCRIPTIVE VOCABULARY

`library_items.level` is descriptive catalogue string vocabulary. It is **NOT** an authorization field and has **NO** direct FK to `learning_levels`. Student learning eligibility remains strictly governed by O-01 and the Learning domain. Do not create `library_item_levels` or bridge tables for v1. Do not merge Library and Learning domains. Exact column type/length is a Laravel migration implementation detail (no specific SQL type/length enforced as product requirement). See `docs/frontend-completion/12-decision-register.md` → “O-02 closure — 2026-09-21”.

### O-12 — Authentication Persistence — ACCEPTED / DUAL TRANSPORT

One identity, one `/api/v1`. **Web:** Sanctum cookie. **Mobile:** Bearer in OS secure storage. Demo `localStorage` is **not** production.

### O-13 — Student Portal Authentication — ACCEPTED

Portal = **separate guard**, **same `users`**. Access via verified `user_student_links`. **OPEN:** portal credential factor (password vs OTP vs other).

### O-10 / O-11 — Telegram / Bale Identity Linking — ACCEPTED

Messaging `chat_id` binds to **`user_id` + `org_id`**. Adapters are not authorization. Do not require `student_id` on the link row as the authz key. **OPEN:** uniqueness details and linking UX. Tokens never in the SPA.

---

## 2026-11-10 OWNER-APPROVED RBAC GOVERNANCE (documentation only)

These entries use this register's existing `T-02` / `O-*` namespace. `T-02-A` is a dated
revision of T-02, **not** a reopening of the 2026-09-21 decision; `O-21`..`O-23` are new
owner decisions in the same `O-*` namespace. They are **product/governance decisions**, not
OpenCode Go agent-governance decisions, and therefore are recorded here rather than in
[`docs/governance/GOVERNANCE_DECISION_REGISTER.md`](../governance/GOVERNANCE_DECISION_REGISTER.md)
(which owns the independent `OCG-XX` namespace and explicitly excludes product decisions).

**Nature.** Documentation only. These decisions **do not authorize** backend or frontend
implementation, role/default changes, schema changes, migrations, tests, seeds, or a commit.
The architecture specification, role matrix, enforcement invariants, extensibility
assessment, and open questions are in
[`.opencode/specs/auth-rbac.md`](../../.opencode/specs/auth-rbac.md). Stage 18 (or another
explicitly authorized implementation stage) is required before any code changes. The
2026-11-13 T-02 enforcement recorded below was a separate, explicitly instructed
implementation change; it is **not** Stage 18.

### T-02-A — T-02 Student Access Scope — owner reaffirmation and extension

**Status:** `APPROVED`. **Decision date:** 2026-11-12.

**Context and rationale.** T-02 was accepted on 2026-09-21 as
`ACCEPTED / ASSIGNED-ONLY` (historical text above). Stage 17 found that student-targeted
progress, learning, and nested endpoints did not consistently apply that scope. The owner
reaffirms the assigned-only rule and extends it to **all** student-related operations. The
owner further clarified on 2026-11-12 that the current internal `accountant` role is the
product-facing Secretary, and `staff` is **not** the secretary.

**Approved policy.**

| Role | Student visibility |
|---|---|
| `administrator` | All students in the organization |
| `manager` | All students in the organization |
| Current `accountant` (product-facing Secretary) | All students in the organization |
| `teacher` | Only the students assigned to that teacher |
| Other roles | No implicit organization-wide student access unless explicitly authorized |

A teacher **MUST NOT** gain access to another teacher's students merely because both
teachers belong to the same organization. The restriction applies consistently to student
list/search, details, progress and progress events, learning placements, eligibility and
locked-content reads, student assignments, piece assignments, and **any other
student-targeted read or mutation**, including indirect access through nested resources.
The exact technical definition of teacher ownership is the existing domain rule:
**active enrollment ∩ `classes.teacher_id` = the teacher's linked `teacher_id`**. The
current `staff` role has explicit `students.read` / `students.write` and therefore currently
has organization-wide student access; whether that is intended under this policy is a
`NEEDS OWNER DECISION` item, not a silent grant or revocation.

**Consequences.** Organization-wide student access is limited to the approved roles and
explicitly authorized future roles. A role title alone does not grant organization-wide
student access. Missing assignment relationships fail closed.

**Affected architecture areas.** Backend student/learning/progress policies and services;
nested resource lookups; tenant-scoped queries; frontend permission projection and
student-list filtering; Stage 15 role-policy lifecycle; Stage 16 403 invalidation.

**Implementation implications.** A future implementation stage MUST enforce object-level
scope in backend query/policy logic, not only in list filtering or UI. It MUST cover direct
and indirect paths, and add authorized/unauthorized teacher/student tests.

**Implementation status (2026-11-14).** Progress and Learning student-targeted surfaces
enforce T-02 as of 2026-11-13. Stage 18.1 (2026-11-14) implements B2/C1: class reads are
assigned-class-only; class responses omit tuition, waitlist and student-derived metrics for
teachers; enrollment reads are active-only in assigned classes; enrollment pricing is
omitted for teachers; PB-1 closes the class/enrollment bypass; a teacher permission
override cannot widen object scope or self-grant enrollment; and scheduling class
references are scoped for teachers. The full backend suite reports
**490 passed, 2 skipped (3414 assertions)**. Stages 18.2–18.6 remain pending: D2/E1
historical access, F3 substitute entity, G3 transfer/audit, H4 Reception, and final
verification. T-02 remains blocked until those stages and Stage 18.6 verification complete.

**F2 owner resolution (2026-11-14).** The read-only F2 packet is
[`T02_F2_OWNER_DECISION_PACKET.md`](T02_F2_OWNER_DECISION_PACKET.md). The owner approved
`T-02-B` (B2 assigned-class-only), `T-02-C` (C1 active enrollments in assigned classes),
`T-02-D` (D2 effective-dated historical read-only), `T-02-E` (E1 immediate loss on
non-active enrollment), `T-02-F` (F3 explicit substitute assignment entity), `T-02-G` (G3
effective-dated transfer with approval and audit), and `T-02-H` (H4 retire `staff`;
independent Reception role). `O-24` is confirmed as invoice-only v1 with no financial
lifecycle expansion. Stage 18.1 (B2/C1/PB-1/redaction/role-override guards) is implemented;
Stages 18.2–18.6 are pending. T-02 remains blocked until implementation and verification
of the remaining stages.

### T-02-B write-side addendum — teacher financial-field write denial (2026-11-16)

**Status:** `APPROVED`. **Decision date:** 2026-11-16. **Decision source:** the owner's
explicit decision in the 2026-11-16 engineering session. No separate approval artifact,
approval ID, event ID or reviewer identity exists, and none is claimed here.

**Policy.** A class creation or update request must be rejected with HTTP `403` and the
standard `FORBIDDEN` code when the authenticated actor is a teacher and the request payload
contains any of `tuition`, `attendanceAvg` or `termProgress`. The rule applies whether or
not the teacher holds `classes.write` through a role override, on both create and update,
for a protected field submitted alone or mixed with permitted fields, and whenever the key
is present — including an explicit `null` or an invalid value/type. The whole request is
rejected: protected fields are never silently stripped and the remaining fields are never
partially saved. Administrators and managers keep their existing authorized behaviour.

**Rationale.** `classes.write` is a verb grant. It must not widen a teacher's object scope
(`T-02-B` B2) and it must not widen their field scope to financial or student-derived data.

**Implementation status.** Recorded before implementation; the implementation and its
focused test evidence are appended to this checkpoint only after that focused run passes.

**Implementation (2026-11-16).** Enforced once in
`ClassPolicy::assertTeacherWriteFieldsAllowed()` and invoked from
`StoreClassRequest`/`UpdateClassRequest::authorizeBeforeValidation()` — before validation, so a
present-but-invalid value is a `403`, not a `422` — and again from
`ClassService::create()`/`update()` for internal callers. Class and enrollment resources now
use an allow-list, so a missing or unrecognized actor fails closed instead of falling through
to the unrestricted branch. Focused evidence: the T-02 field matrix **10 passed (41
assertions)**, `ResourceSerializationTest` **14 passed (47 assertions)**, and
`ClassesTest` + `EnrollmentsTest` **51 passed (374 assertions)**. The full backend suite was
not re-run in this wave.

**Related findings and acceptance criteria.** Stage 17 F1/F2; C5.2, C5.4, C5.5. F1 is
fixed for the Progress/Learning surfaces as of 2026-11-13; F2 B2/C1 are implemented as of
2026-11-14. Full acceptance still requires Stages 18.2–18.5 and confirmation that no
student-targeted endpoint bypasses the scope. C5 remains `INVESTIGATE`; this decision does
not resolve C5.

### O-21 — Secretary role represented by the current `accountant` role

**Status:** `APPROVED`. **Decision date:** 2026-11-12.

**Context and rationale.** The owner clarified that the current internal role ID
`accountant` represents the product-facing position **Secretary / منشی**, not a future
accounting role. The earlier 2026-11-10 draft that used `staff` as the secretary is
superseded; it is preserved here as historical context. Current secretary responsibilities:
student registration, student administration, enrollment management, class scheduling,
managing student payments, and access to the financial section necessary for current
student payment operations.

**Approved policy.** The current `accountant` role retains its existing necessary financial
permissions, including `finance.pay`, as confirmed by the actual implementation. The
Secretary has organization-wide student access under T-02-A. The `staff` role is **not** the
secretary: it MUST NOT be renamed, merged, deleted, or have its permissions modified based
on that assumption. Its current purpose and future role remain `OPEN` / `NEEDS OWNER
DECISION` in the RBAC specification.

**Consequences.** Current `accountant` keeps `finance.read`, `finance.write`, and
`finance.pay` (plus its other current ids) until a separately approved migration. Source
inspection also shows it currently has `students.read`, `classes.read`, `instruments.read`,
`rooms.read`, `branding.read`, `reports.read`, `messages.read` — but **not**
`students.write`, `schedule.write`, or `classes.write`. The owner's stated Secretary
responsibilities (registration, enrollment, class scheduling) therefore cannot all be
performed by the current default without a future permission change; that gap is
`NEEDS OWNER DECISION`, not silently added here. `staff` keeps its current explicit
permissions unchanged, including its existing explicit `finance.pay`; that grant is not
evidence that `staff` is the secretary.

**Affected architecture areas.** `backend/config/permissions.php`,
`src/domains/auth/permissions.ts`, user/role administration, finance and student policies,
frontend role labels/navigation, and the role responsibility matrix.

**Implementation implications.** No role/default/label/permission change is authorized here.
A future implementation stage MUST preserve current `accountant` financial permissions
unless the owner approves a migration, and MUST resolve the missing Secretary operational
writes before claiming the role can perform its approved responsibilities. The future
finance separation is governed by O-22.

**Related findings and acceptance criteria.** Stage 17 F1/F2; C5.2/C5.5. Acceptance requires
the owner to confirm the `staff` role's purpose and to approve any future separation
migration before defaults or assigned users change.

### O-22 — Future finance separation — Accountant and Finance Manager

**Status:** `APPROVED — INTENT ONLY; activation NOT APPROVED`. **Decision date:** 2026-11-12.

**Context and rationale.** The owner intends a future organizational separation:

| Future position | Responsibility |
|---|---|
| Secretary | Student administration, registration, enrollment, class scheduling |
| Accountant | Accounting and financial operations |
| Finance Manager | Finance department oversight and management |

Future access expectations: the Secretary retains organization-wide student access; the
future Accountant and Finance Manager MUST NOT automatically receive organization-wide
student-management access; the Secretary loses accounting/finance permissions when the
separation is formally activated.

**Approved policy.** This future structure is **not approved for activation**. No future
role is created or seeded now. The existing `accountant` role ID MUST NOT be silently renamed
or repurposed; it currently means Secretary (O-21). A controlled migration of role IDs,
permissions, and assigned users is required. Exact future role IDs and the migration strategy
remain subject to explicit owner approval.

**Consequences.** The current `accountant` role remains the Secretary for now. The future
Accountant and Finance Manager are product intentions, not implemented roles. Any future
migration must preserve auditability and must not leave users with the previous role's
permissions.

**Affected architecture areas.** Role vocabulary, permission defaults, user role
assignments, finance authorization, role-policy projection, permission parity tests, and
migration design.

**Implementation implications.** No role creation, seed, rename, permission change, or
migration is authorized. A future stage MUST obtain exact role IDs and permission sets from
the owner and provide a reversible migration plan before implementation.

**Related findings and acceptance criteria.** Stage 17 F2 and C5.5. Acceptance requires an
owner-approved future role matrix and migration strategy; until then the current Secretary
interpretation remains in force.

### Financial transaction lifecycle — O-24 confirmed invoice-only (2026-11-14)

**Status:** `CONFIRMED — INVOICE-ONLY v1`. This changes no role or permission and
authorizes no financial expansion.

**Current source.** Finance is invoice-only: `Invoice` / `InvoiceService` support a due
invoice discharged by exactly one accepted payment (`due → paid`). There is no partial
payment, balance sync, refund, void, correction/reversal, transaction ledger, or append-only
`audit_events` table. `O-18` audit logging is not implemented.

**Consequence.** A financial transaction lifecycle with corrections, voids, refunds,
permanent history, or management audit visibility remains out of scope. Any future work
requires a separate financial domain decision on: allowed correction/void/refund operations
and who may perform them; ledger/audit schema and retention; whether history is immutable or
reversible; and the exact permission ids (any proposed names are proposals, not vocabulary).
No financial permission, migration, or endpoint was added.

### O-23 — Dynamic role-holder counts, role assignment, and permission assignment

**Status:** `APPROVED`. **Decision date:** 2026-11-12.

**Context and rationale.** The system MUST NOT depend on fixed user counts or fixed numbers
of role holders. Adding or removing a user assigned to a role MUST NOT require code changes.
Role assignment MUST be separate from user identity. Permissions MUST be independently
configurable and auditable. Future roles MUST be addable without scattering role-name checks
across unrelated modules. Role changes MUST be enforced by the backend, not merely reflected
in frontend visibility. Removing a role assignment MUST NOT leave the user with the previous
role's permissions.

**Approved policy.** The organization MAY have any supported number of users assigned to
`staff`, `teacher`, `manager`, or the current `accountant` (Secretary); the number of
secretaries and teachers MUST NOT be hardcoded. Permission assignment is currently
**role-level**, not per-user: no user-specific permission override model was found. Exact
per-user assignment is therefore a future requirement, not a claimed current capability.

**Consequences.** Current source confirms dynamic assignment among a fixed role list,
organization-scoped role rows, per-request permission re-evaluation, and no hardcoded
role-holder counts. It does **not** confirm arbitrary runtime role creation, per-user
permission overrides, a security audit log, or scattered-role-check elimination.

**Affected architecture areas.** `users.role`, `PermissionMatrix`, `PermissionGate`,
`RoleService`, `UserRules`, domain policies with teacher-specific scope checks, frontend
role-policy projection, and role/permission audit logging (O-18 residue).

**Implementation implications.** Future work MUST separate role identity from user identity,
centralize authorization checks, avoid `role === "..."` conditionals in unrelated modules,
and provide auditable permission changes. Per-user permission assignment, if required,
needs an owner decision and a schema/API design; it is not authorized here.

**Related findings and acceptance criteria.** Stage 17 F1/F3/F4 and C5.2/C5.4/C5.5.
Acceptance requires tests that adding/removing users and changing role assignments does not
require code changes and that backend authorization reflects current role/permission state.

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

## Pointer — OpenCode Go governance register (OCG-XX)

AI-agent / OpenCode Go operating governance (model routing, agent-traffic privacy, token
efficiency, agent roles, approval gates) is registered in
[docs/governance/GOVERNANCE_DECISION_REGISTER.md](../governance/GOVERNANCE_DECISION_REGISTER.md)
under its own **`OCG-XX`** identifier namespace — a fourth namespace, **independent and
non-interchangeable** with this checkpoint's `T-02`/`O-*`/`PERF`/`HELP`, with
[DECISIONS.md](DECISIONS.md)'s `D1–D42`, and with the frontend-completion register's
identifiers. No shared IDs, no implicit inheritance; **this pointer transfers no decision
ownership or authority** and this checkpoint's statuses are unchanged. Recorded 2026-10-30.
