# Spec — Authentication, authorization and identity scope

**Status:** CURRENT · **Authority:** `backend/config/permissions.php` (the server is the
authority) + `docs/engineering/GOVERNANCE_CHECKPOINT.md` for the live decision register.

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
