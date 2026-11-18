# Spec — Authentication, authorization and identity scope

**Status:** CURRENT · **Authority:** `backend/config/permissions.php` (the server is the
authority) + `docs/engineering/GOVERNANCE_CHECKPOINT.md` for the live decision register.

**Owner-approved RBAC governance (2026-11-12 clarification).** `T-02-A` / `O-21`..`O-23`
are recorded in
[`docs/engineering/GOVERNANCE_CHECKPOINT.md`](../../docs/engineering/GOVERNANCE_CHECKPOINT.md)
§"2026-11-10 OWNER-APPROVED RBAC GOVERNANCE" (revised 2026-11-12). That register is the
authoritative source for the approved policy; this spec records the architecture, role
boundaries, enforcement requirements, extensibility model, and open questions. **Approved
policy is not the same as implemented behavior**: source-verified current behavior is
labelled below, and no implementation change is authorized by this documentation stage.

## The permission vocabulary is exactly 37 ids

`attendance.read/write` · `branding.read/write` · `classes.read/write` · `demo.manage` ·
`finance.read/write/pay` · `gallery.read/write` + display-only `gallery.details` · `instruments.read/write` · `learning.read/write` ·
`library.read/write` · `messages.read/write` · `progress.read/write` · `reports.read` ·
`roles.write` · `rooms.read/write` · `schedule.read/write` · `settings.read/write` ·
`students.read/write` · `teachers.read/write` · `users.read/write`

Two copies exist — the PHP file and `src/domains/auth/permissions.ts` — and
`src/domains/auth/__tests__/permissionParity.test.ts` parses the **shipped PHP file** to
prove they match. **Never invent, rename, borrow or drop a permission id.** If a capability
needs a permission that does not exist, that is an owner decision (see PB-3 below), not a
frontend problem to work around.

Note the asymmetry: `roles.write` and `reports.read` have no `.read`/`.write` twin. That is
the vocabulary as it stands — do not "fix" it by adding a symmetric id.

## Frontend checks are UX, not security

`useCan(...)` / `canAccess(...)` in the UI improve the experience and prevent accidental
exposure. They are **not** a security control. Authentication and authorization are
server-owned (`backend/app/Domain/*/…Policy.php`, `App\Support\Authorization\PermissionGate`).
Never describe a hidden button as protection.

## Multi-tenancy

Every backend read is org-scoped (`org_id` via `TenantContext` / `BelongsToOrganization`).
The client never sends an organization id — the server derives the caller's own. Adding a
client-settable `organization_id` is a security defect, not a feature.

## Restrictive identity policies (fail closed)

- **T-02 — teacher student-read: ACCEPTED / ASSIGNED-ONLY.** A teacher may read a student
  only when the student is in an **active enrollment** in a class whose `class.teacherId` is
  that teacher. Anything else is denied. Enforce it in the query/policy, not in the view.
  (Older documents that call T-02 "OPEN / conflicting" are a superseded 2026-09-19 snapshot.)
  Owner decision `T-02-A` (2026-11-12) reaffirms this rule and extends it to **all**
  student-targeted operations, including progress, learning placements, eligibility /
  locked-content reads, assignments, and nested resources; see
  [`GOVERNANCE_CHECKPOINT.md`](../../docs/engineering/GOVERNANCE_CHECKPOINT.md) and the
  "T-02 Enforcement Specification" below. The current `accountant` role is the product-facing
  Secretary and has organization-wide student access; `staff` is not the secretary. The
  extension is **approved**; Progress and Learning enforcement landed 2026-11-13. Stage
  18.1 (2026-11-14) implements `T-02-B` B2 (assigned-class-only), `T-02-C` C1 (active
  enrollments in assigned classes), the PB-1 class/enrollment closure, teacher field
  redaction, and permission-override object-scope guards. `T-02-D` D2, `T-02-E` E1,
  `T-02-F` F3, `T-02-G` G3, and `T-02-H` H4 remain pending Stages 18.2–18.5.
- **PB-3 — gallery: LIFTED by DECISIONS §36.** Gallery left the unavailable list with its
  own `gallery.read` / `gallery.write` ids (§26.3 forbade reusing `library.write`, the
  demo-era X-02 borrow). PB-3 has no blocked domain left. The decision stands as the
  standing rule — block without a permission id — but its scope is now empty: every
  domain it ever covered (progress §29, instruments §33, learning §34, rooms §35,
  gallery §36) carries its own ids. Older text naming a blocked domain here is superseded.
- **Gallery details are display-gated (DECISIONS §42).** `gallery.details` shows the
  furnished readout (caption, album, date) down to reception; teachers open the
  showcase but see bare photographs. Display-only: bytes and metadata stay
  authorized by `gallery.read`. No backend authorization change.
- **Branding: LIFTED by DECISIONS §38.** Branding left the unavailable list with its
  own `branding.read` / `branding.write` ids (§26.3 forbade reusing `settings.write`,
  the demo-era X-06 borrow). `branding.read` is universal (identity renders on
  every authenticated surface); `branding.write` is administrator-only,
  mirroring `settings.write` — the manager who opens Settings read-only gains
  no new write.
- **Compensation: LIFTED by DECISIONS §39.** Compensation left the unavailable
  list under the *existing* `schedule.read` / `schedule.write` ids — a make-up
  IS a session, so no new id is invented (§26.3 forbids borrowing for a
  *different* domain only). Teachers read only their own classes'
  obligations (T-02, option B approved); unlinked teacher accounts fail
  closed with PB-1, exactly like sessions. No delete/reopen/add-participant
  verbs exist; no external delivery.
- **Finance: LIFTED for the client by DECISIONS §40 (demo stays deferred).**
  Invoices left the unavailable list under the *existing* `finance.read` /
  `finance.write` ids — a receipt IS the finance capability, so no new id
  is invented (§26.3 forbids borrowing for a *different* domain only). v1
  issues due invoices and discharges each with exactly one accepted payment;
  no partial payments, no balance sync, and no invoice verbs beyond
  list/get/create/update/pay. §41 splits confirmation off authoring with a
  verb-scoped `finance.pay` (staff and manager confirm; issuing stays
  administrator/accountant): vocabulary 35 → 36. Overdue is a derived
  display badge only — no enforcement gate.
- **Chat reads are participation-scoped (DECISIONS §37).** `messages.read` /
  `messages.write` needed no new ids — the vocabulary already names this
  capability. A thread is visible only to its participants (404 otherwise, for
  every role including administrator); the sender is always the authenticated
  user. Whether oversight tooling needs a wider read is an open owner
  decision, not an implementation gap to fill silently.
- Owner-decision refusals surface as `OWNER_DECISION_REQUIRED_PB*` and must be presented as
  *not permitted* — never as a missing server and never with a retry that cannot succeed.

## Unresolved

- `O-08` (file ownership), `O-09` (Telegram backup semantics), `O-14` (org/user relation)
  and the student-portal credential factor remain open; see
  `docs/engineering/GOVERNANCE_CHECKPOINT.md` and `docs/engineering/OPEN_ITEMS.md`.
- The backend suite is **not** verifiable on a machine without PHP/Composer/MySQL. Backend
  results may only be claimed from inherited CI evidence, dated as such.

---

## RBAC architecture specification (owner-approved policy vs current implementation)

**Authority.** Approved decisions are in
[`GOVERNANCE_CHECKPOINT.md`](../../docs/engineering/GOVERNANCE_CHECKPOINT.md)
§"2026-11-10 OWNER-APPROVED RBAC GOVERNANCE" (`T-02-A`, `O-21`, `O-22`, `O-23`). This
section is a **specification**, not an implementation claim. Source-verified current
behavior is labelled "CURRENT"; approved-but-unimplemented policy is labelled "APPROVED
POLICY"; future work is labelled "FUTURE REQUIREMENT".

**Role versus permission.** A *role* is a named assignment on a user (`users.role`). A
*permission* is one of the 37 ids in `backend/config/permissions.php` and
`src/domains/auth/permissions.ts`. Permissions are the actual authorization mechanism;
a role title MUST NOT be treated as a permission. CURRENT: `PermissionGate` is the single
backend permission check; `PermissionMatrix::permissionsFor()` resolves a user's role to the
organization's saved role row (filtered to the vocabulary) or the shipped default. Unknown
roles resolve to `[]` (fail closed); unknown permission ids are rejected.

**Role assignment versus user identity.** CURRENT: identity is `users.id`; role assignment
is the `users.role` string; teacher linkage is `users.teacher_id`; organization membership
is `users.organization_id`. `UserService::create()` / `update()` write these fields;
`UserRules` validates `role` against the fixed `config('permissions.roles')` list and
`teacherId` against an organization-scoped teacher. Removing a role assignment MUST NOT
leave the user with the previous role's permissions: CURRENT backend re-evaluates the role
and role row on every request; the frontend session snapshot may remain stale until
reauth/role-sync/403 (C5.4, NEEDS OWNER DECISION).

**Organization-scoped access.** CURRENT: `ResolveTenant` derives `organization_id` from the
authenticated user, never from a request body/header; `BelongsToOrganization` constrains
every tenant-owned model query and fails closed with no tenant; `Role` rows are also
organization-scoped. Cross-tenant isolation is independent of role scope and remains
mandatory. A client-settable `organization_id` is a security defect, not a feature.

**Student visibility scope.** APPROVED POLICY (`T-02-A`): see the Role Responsibility Matrix
and T-02 Enforcement Specification below. CURRENT: `StudentAccessPolicy::scopeQuery()`
applies `active enrollment ∩ class.teacher_id = actor.teacher_id` to the student list and
detail; scheduling, attendance, and compensation apply analogous teacher scopes; Progress
and Learning student-targeted endpoints apply the student scope as of 2026-11-13. Stage
18.1 (2026-11-14) applies B2/C1 to class and enrollment reads: teachers see only owned
classes and active enrollments in those classes, with tuition/waitlist/student-derived
metrics and enrollment pricing redacted. The PB-1 bypass through classes/enrollments is
closed. The remaining F2 decisions (`T-02-D`..`T-02-H`) are pending Stages 18.2–18.5.
`src/domains/auth/scope.ts` mirrors the assigned-only rule for frontend UX,
but a teacher without `teacherId` falls back to an org-wide branch that is explicitly marked
`OWNER DECISION REQUIRED` there.

**Backend enforcement requirements.** The backend MUST re-derive the actor from the token,
MUST derive tenant from authenticated context, MUST check permission via `PermissionGate`,
MUST apply object-level scope in SQL/policy — not load-then-filter — and MUST fail closed on
missing or ambiguous relationships. Frontend checks MUST NOT be treated as a security
boundary. CURRENT: Progress and Learning (2026-11-13) and class/enrollment B2/C1
(2026-11-14) follow this pattern. Stage 17 F2 B2/C1 is closed; F3–F4 and the remaining F2
historical/substitute/transfer/Reception workstreams remain open.

**Frontend projection responsibilities.** CURRENT: `src/domains/auth/permissions.ts` holds
the UX matrix; Stage 15 added a session-aware Fresh/Stale/Unavailable role-policy projection;
Stage 16 invalidates affected read caches on a resource-level 403. The projection MUST NOT
grant access the server denies, MUST NOT outlive its session, and MUST NOT silently fall
back to shipped defaults in API mode. Stale last-known-good behavior is disclosed but is a
C5.4 acceptance question, not an approved indefinite grant.

**Permission lifecycle and revocation expectations.** CURRENT: `RolesTest` proves that
granting or revoking a permission in a saved role row changes server enforcement for an
already-issued token on the next request; no server-side permission cache exists. The
frontend MAY still show stale controls until its next request. A future implementation MUST
define how quickly client-visible revocation takes effect and MUST NOT rely on
session-issued permissions after the server has revoked them.

**Future role extensibility.** FUTURE REQUIREMENT: roles MUST be addable without scattering
`role === "..."` checks across unrelated modules; permissions MUST be independently
configurable and auditable; role changes MUST be backend-enforced. CURRENT: role assignment
is dynamic among a **fixed** list of five role ids; there is no runtime role-creation
endpoint. This spec MUST NOT be read as claiming arbitrary custom-role creation exists.

**Auditability of role and permission changes.** CURRENT: `roles.updated_at` exists, but
there is no append-only security audit log; `docs/security.md` records "Security-event
audit log — NOT IMPLEMENTED" and `O-18` is `ACCEPT WITH CONDITIONS`, not implemented. A
future implementation MUST record actor, action, target role/permission, and timestamp from
the server principal, with no secrets/PII bodies.

**Current architecture vs desired future capability.**

| Capability | CURRENT | FUTURE REQUIREMENT |
|---|---|---|
| Multiple users per role | Yes — no hardcoded count; `UserService` can create many users with the same `role` | Preserved; MUST NOT introduce a count cap |
| Multiple secretaries (current `accountant`), teachers, managers | Yes — no role-holder uniqueness constraint | Preserved |
| Organization-scoped role rows | Yes — `BelongsToOrganization` + `PermissionMatrix` org filter | Preserved |
| Independent permission configuration | Partly — per-org `Role` row overrides defaults; vocabulary fixed | Fully auditable, independently configurable permission grants |
| Backend enforcement of role changes | Yes — per request; `RolesTest` grant/revoke | Preserved, with explicit client-side revocation SLA |
| Arbitrary runtime role creation | No — fixed `config('permissions.roles')`, no create-role endpoint | MAY be added only after an owner decision; MUST avoid scattered role checks |
| Append-only security audit log | No | MUST be added per `O-18` before claiming auditability |

## Role responsibility matrix

The matrix documents **intended responsibility boundaries**, not automatic grants. Exact
permission ids are taken from the current implementation; no new ids are invented here.

| Role | Student scope | Operational responsibility | Financial access | Role administration |
|---|---|---|---|---|
| `administrator` | Organization-wide | Full administration | Subject to explicit permissions (CURRENT: all 37 ids, including `finance.read`, `finance.write`, `finance.pay`) | Subject to explicit permissions (CURRENT: holds `roles.write`; admin lockout guard enforced) |
| `manager` | Organization-wide | School management | Subject to explicit permissions (CURRENT: `finance.read`, `finance.pay`; no `finance.write`) | Subject to explicit permissions (CURRENT: no `roles.write`) |
| `staff` | CURRENT: organization-wide via explicit `students.read` / `students.write`. **APPROVED `T-02-H` H4:** retire `staff` and introduce an independent Reception role; Reception student scope/matrix pending review. | Purpose unresolved in current source; **not** the Secretary. CURRENT explicit operational writes: `students.write`, `schedule.write`. H4 requires an independently reviewed Reception job description and matrix; no permission follows from the name. | No implicit access; CURRENT explicit `finance.pay` only. H4 forbids granting `finance.read` / `finance.write` / `finance.pay` merely because the role is named Reception. | No implicit access (CURRENT: no `users.write` / `roles.write` / `settings.write`) |
| `teacher` | Assigned students only (active enrollment ∩ `classes.teacher_id`). `T-02-B` B2: class reads assigned-class-only; `T-02-C` C1: ordinary enrollment reads active enrollments in assigned classes only. **Implemented Stage 18.1 (2026-11-14).** | Teaching and assigned-student operations | No implicit access (CURRENT: no `finance.*` id) | No implicit access |
| `accountant` (CURRENT = product-facing Secretary) | Organization-wide via CURRENT `students.read` | Secretary responsibilities per owner: student registration, administration, enrollment, class scheduling, managing student payments. CURRENT source grants `students.read`, `classes.read`, `finance.read/write/pay` but **not** `students.write`, `schedule.write`, or `classes.write`; the missing operational writes are `NEEDS OWNER DECISION` | CURRENT explicit: `finance.read`, `finance.write`, `finance.pay`; retain per `O-21` | No implicit access (CURRENT: no `users.write` / `roles.write` / `settings.write`) |

**Future finance separation (intent only; not active).** Per `O-22`, the owner intends a
future Secretary / Accountant / Finance Manager split. No future role is created, seeded,
renamed, or activated. Exact role IDs and migration remain `NEEDS OWNER DECISION`.

| Future position | Student scope | Financial access | Role administration |
|---|---|---|---|
| Secretary (current `accountant` role, after formal separation) | Organization-wide | Loses accounting/finance permissions when separation is activated | No implicit access |
| Accountant (future role id TBD) | No automatic organization-wide student management | Explicitly granted financial permissions only | No implicit access |
| Finance Manager (future role id TBD) | No automatic organization-wide student management | Explicit finance oversight permissions | No implicit access |

**Rules.** A role title MUST NOT automatically grant every permission associated with a
broad job description. Permissions remain the actual authorization mechanism. The current
`accountant` role is the Secretary per `O-21` and retains its current financial permissions;
it MUST NOT be silently renamed or repurposed. `staff` is **not** the Secretary; its current
purpose is unresolved and MUST NOT be changed based on that assumption. The future
Accountant/Finance Manager are product intentions per `O-22`, not implemented roles.

## T-02 enforcement specification

**Status:** APPROVED POLICY (`T-02-A`, 2026-11-12; F2 decisions `T-02-B`..`T-02-H`
approved 2026-11-14), **Stage 18.1 implemented 2026-11-14; Stages 18.2–18.6 pending**.
Progress and Learning student-targeted endpoints enforce T-02 as of 2026-11-13. Stage 18.1
implements B2/C1 class/enrollment scope, PB-1 closure, field redaction, and
permission-override object-scope guards. D2/E1, F3, G3, and H4 remain pending. The original
T-02 decision is preserved in
[`GOVERNANCE_CHECKPOINT.md`](../../docs/engineering/GOVERNANCE_CHECKPOINT.md). The F2
owner-decision packet (exposures, alternatives, recommended matrix, test matrix, financial
checklist) is
[`T02_F2_OWNER_DECISION_PACKET.md`](../../docs/engineering/T02_F2_OWNER_DECISION_PACKET.md);
the selected options and Stage 18.1 results are recorded there and in the checkpoint.

1. Organization-wide student access MUST be limited to the approved roles
   (`administrator`, `manager`, and the current `accountant`/Secretary) and explicitly
   authorized future roles. `staff` currently has explicit `students.read` / `students.write`
   and therefore organization-wide access; the owner approved `T-02-H` H4 to retire `staff`
   and introduce an independent Reception role. Until that matrix and migration are
   approved, the current `staff` permissions remain source behavior and no new Reception
   grant is authorized.
2. Teachers MUST be limited to their own assigned students. Under approved `T-02-B` B2,
   class reads are assigned-class-only; under approved `T-02-C` C1, ordinary enrollment
   reads are active enrollments in assigned classes only. **Implemented Stage 18.1
   (2026-11-14).**
3. Student scope MUST apply to direct and indirect access paths, including student list,
   detail, search, progress, progress events, learning placements, eligible/locked content,
   student assignments, piece assignments, attendance, scheduling, compensation, media
   references, and any other student-targeted read or mutation.
4. List filtering alone is insufficient; object-level access MUST also be enforced in the
   backend query/policy.
5. A teacher MUST NOT bypass scope by supplying another student's id.
6. Nested resources MUST inherit or independently enforce student scope.
7. Missing assignment relationships MUST fail closed.
8. Frontend filtering MUST NOT be treated as a security boundary.
9. Cross-tenant isolation remains independent and mandatory.
10. Tests MUST cover both authorized and unauthorized teacher/student combinations, including
    nested and indirect endpoints.
11. Historical teacher access MUST use approved `T-02-D` D2 effective-dated read-only
    responsibility periods and MUST NOT be inferred from the current `classes.teacher_id`.
    Under `T-02-E` E1, historical access applies only while the relevant enrollment remains
    active.
12. Substitute teacher access MUST use approved `T-02-F` F3: an explicit assignment entity,
    limited to assigned sessions/operational data, with no automatic class ownership,
    historical student access, financial access, or compensation access.
13. Class ownership transfer MUST use approved `T-02-G` G3: effective-dated, approved,
    audited, and boundary-preserving. Ordinary class updates must not silently transfer
    ownership.

## Dynamic extensibility requirements

**Approved (`O-23`).** The system MUST NOT depend on fixed user counts or fixed numbers of
role holders. The organization MAY have any supported number of `staff`, `teacher`,
`manager`, or current `accountant` (Secretary) users; the number of secretaries and teachers
MUST NOT be hardcoded. Adding or removing a user assigned to a role MUST NOT require code
changes. Role assignment MUST be separate from user identity. Permissions MUST be
independently configurable and auditable. Future roles MUST be addable without scattering
role-name checks across unrelated modules. Role changes MUST be enforced by the backend, not
merely reflected in frontend visibility. Removing a role assignment MUST NOT leave the user
with the previous role's permissions. Per-user permission overrides are **not currently
supported**: permissions resolve from the user's role only; exact per-user assignment, if
required, is a future owner decision.

**Already present (CURRENT).** Multiple users per role (no count cap in `UserService` or
schema inspected); organization-scoped role rows; dynamic assignment among the fixed role
list; per-request permission re-evaluation; centralized `PermissionGate`; frontend
permission projection that does not itself authorize.

**Not yet present (FUTURE REQUIREMENT).** Arbitrary runtime role creation; elimination of
remaining `role === "teacher"` scope checks in `StudentAccessPolicy`, `SessionPolicy`,
`AttendancePolicy`, `CompensationService`, and `src/domains/auth/scope.ts`; append-only
security audit log; explicit client-side permission-revocation SLA; permission changes
without scattered UI/controller conditionals. This spec MUST NOT promise unrestricted
custom-role creation.

## Critical ambiguities (document, do not guess)

The high-level T-02 policy is approved; the following implementation semantics are **not**
decided by that approval. Each row records CURRENT source behavior and a consequence, then
marks the item `OPEN` (needs engineering/source investigation) or `NEEDS OWNER DECISION`.
No behavior is silently selected here.

| Ambiguity | CURRENT implementation | Security / product consequence | Status |
|---|---|---|---|
| Exact relationship defining a teacher's assigned students | `StudentAccessPolicy::scopeQuery()`: `enrollments.status = 'active'` AND `classes.teacher_id = actor.teacher_id`; `Student.teacherId` is not authorization. `src/domains/auth/scope.ts` mirrors it for UX. | If another endpoint uses a different relation, a teacher can bypass T-02 through an indirect path. | `NEEDS OWNER DECISION` |
| Does an active class enrollment establish the relationship? | Yes — only `active` enrollments qualify; `waitlist`, `completed`, `cancelled` do not. | Waitlisted/completed/withdrawn students are immediately out of scope. | `NEEDS OWNER DECISION` |
| Withdrawn, completed, suspended, or transferred students | No special handling. Enrollment statuses are `active`, `waitlist`, `completed`, `cancelled`; no `suspended` / `transferred` status was found. A status change removes active-enrollment scope. | Historical access and transfer semantics are undefined; data may become invisible without an explicit rule. | `NEEDS OWNER DECISION` |
| Read-only historical progress after a student leaves the teacher's class | Progress/learning endpoints now apply T-02 (2026-11-13), so a student outside the actor's active-enrollment scope is not readable. No post-leave historical rule exists. | Historical access and transfer semantics are undefined; data may become invisible without an explicit rule. | `NEEDS OWNER DECISION` |
| Temporary or substitute teachers | Single `users.teacher_id` link and single `classes.teacher_id`; no date-bounded or substitute assignment model. | A substitute cannot be represented without reassigning the class or user link; scope would be wrong or fail closed. | `NEEDS OWNER DECISION` |
| May the current Secretary create or edit teacher assignments? | Current `accountant` has `classes.read`, `students.read`, `finance.read/write/pay`, but no `classes.write`, `teachers.write`, `users.write`, or `schedule.write`; no teacher-assignment endpoint was found. | Owner approved class scheduling / operational coordination but did not say whether that includes editing `class.teacherId`, teacher links, or class write operations. | `NEEDS OWNER DECISION` |
| Does the current `accountant` have the full Secretary operational permission set? | CURRENT: `students.read`, `classes.read`, `finance.read`, `finance.write`, `finance.pay`, plus lookup/report/message reads; **no** `students.write`, `schedule.write`, or `classes.write`. | The current default cannot perform all owner-stated Secretary responsibilities (registration/enrollment/class scheduling). Adding permissions would be a separate approved implementation change; leaving it is an operational gap. | `NEEDS OWNER DECISION` |
| What is the purpose of the current `staff` role? | CURRENT explicit: `students.write`, `schedule.write`, `attendance.read`, `messages.*`, `reports.read`, `finance.pay`, `gallery.details`, plus read-only core; no `users.write` / `roles.write` / `settings.write`. It is **not** the Secretary. | Changing or removing staff permissions based on the old secretary assumption would be wrong; the role's actual purpose is undocumented. | `NEEDS OWNER DECISION` |
| Are multiple `staff` users fully supported by the current backend? | Yes for assignment: `users.role` is a validated string, no uniqueness/count cap, `UserService::create()` can create many same-role users. PB-2 privileged-identity rules still apply. "Fully" (audit, UI, bulk workflows) was not exhaustively verified. | No hardcoded staff count is evident; claiming full operational support without verification would overstate. | `OPEN` |
| Are role assignments organization-scoped? | Yes: user has `organization_id`; `Role` rows use `BelongsToOrganization`; `PermissionMatrix` queries the role by the user's org; `RolesTest::test_role_edits_are_per_organization` exists. Tenant comes from auth. | Confirmed for CURRENT fixed roles; dynamic future roles must preserve this. | `OPEN` |
| Dynamic role creation or only dynamic role assignment? | Only dynamic assignment among fixed `config('permissions.roles')`; `RoleService::assertRole()` rejects unknown ids; `UserRules` validates `role` against the fixed list; no create-role route. | Future roles require config/schema work; claiming runtime custom roles now would be false. | `OPEN` |
| Are per-user permission overrides supported? | No user-specific permission field or resolver was found; `PermissionMatrix::permissionsFor()` resolves from the user's role only. | A future requirement for per-user overrides needs an owner decision and schema/API design; it is not implemented. | `NEEDS OWNER DECISION` |
| How are permission changes audited? | No append-only security audit log; `docs/security.md` says NOT IMPLEMENTED; `O-18` is accepted with conditions but unimplemented; `roles.updated_at` is the only timestamp evidence found. | No tamper-evident record of who changed a role/permission or when. | `NEEDS OWNER DECISION` |
| Financial transaction lifecycle and audit visibility | Invoice-only model: one accepted payment per invoice (`due → paid`); no partial payment, refund, void, correction/reversal, transaction ledger, or `audit_events` table. | Corrections, refunds, permanent history, and management audit visibility cannot be represented safely without inventing semantics/schema and permission ids. | `NEEDS OWNER DECISION` |
| How quickly must permission revocation take effect in existing sessions? | Backend re-evaluates on every request (`PermissionMatrix`), and `RolesTest` grant/revoke proves immediate server enforcement for an existing token. Frontend session-issued permissions/projection may remain stale until reauth, role sync, or a 403 (Stage 15/16, C5.4). | Server denies immediately; client MAY still display stale controls/data. An explicit SLA is missing. | `NEEDS OWNER DECISION` |
| Future finance separation: Secretary / Accountant / Finance Manager | CURRENT `accountant` is the Secretary; future Accountant and Finance Manager role ids do not exist as separate roles. No rename/repurpose or migration is approved. | The owner intends a controlled migration; exact role ids, permissions, and user reassignment are unresolved. Silent reuse of `accountant` would conflate Secretary and Accountant. | `NEEDS OWNER DECISION` |

**Non-goals of this documentation stage.** The 2026-11-10/12 documentation stage changed no
backend authorization code, frontend role or permission code, role defaults, seeds,
payloads, tests, schemas, or migrations. The separate 2026-11-13 T-02 enforcement changed
Progress/Learning backend scope and tests only. The 2026-11-14 Stage 18.1 implementation
changed class/enrollment scope, field redaction, PB-1 guards, and focused tests only; it did
not add a role, permission, schema, migration, endpoint, or financial feature, and it did
not start Stages 18.2–18.6. C5 remains `INVESTIGATE`.
