---
inclusion: always
---

# 06 — SECURITY & BACKEND

> Separates what the frontend can enforce from what only the backend can. Preserves legacy
> `05_SECURITY.md`, `02_LARAVEL.md`, `06_DATABASE.md` principles. Authority for backend behavior
> is the current `backend/` implementation + `docs/security.md` + `docs/engineering/BACKEND_STATUS.md`.

## Frontend reality (CURRENT — be clear-eyed)

- A frontend cannot be secure on its own. UI permission checks (`canAccess`, RBAC vocabulary)
  improve UX and reduce accidental exposure but are **not** a security control.
- The panel is private: not indexed, not discoverable (robots/meta/headers/edge refusal in
  `docs/security.md`). The **only real control is authentication**, which is backend-owned.
- No secrets in frontend code or bundles; auth token handled via the registry/`ApiClient` seam
  (`Authorization: Bearer …`, `onUnauthenticated` on 401).

## Backend requirements (BACKEND REQUIRED — Laravel API under `backend/`)

Preserved from legacy, still the standard where backend work happens:

- Validate all input (Form Request); authorization via **Policy/Gate**, not scattered checks.
- Parameterized queries (Eloquent/Query Builder) — **never raw SQL concatenation**.
- `$fillable` for mass-assignment control; schema changes **only via migration**.
- Multi-tenant isolation (org scoping / `org_id`) is load-bearing and must be enforced server-side.
- Safe file uploads (validate type/size, safe storage/names, out of webroot).
- No secrets in code (`.env` only); no sensitive data in logs or error responses.
- Rate-limit sensitive endpoints; transactions for multi-step operations; monetary values as
  integers (smallest unit). Eager loading to avoid N+1.
- RBAC enforcement (org_id + permission + scope + per-object auth) is server-side; the frontend
  vocabulary must stay in parity with `backend/config/permissions.php` (parity test, I24 closed).

## Destructive DB operations (OWNER AUTHORIZATION REQUIRED)

**Never** run `migrate:fresh`, `migrate:fresh --seed`, `db:wipe`, resets or seeds without the
owner's explicit authorization. This is non-negotiable and applies in every environment.

## Verification status (CURRENT — honest)

- Backend runtime verification is **not asserted by this steering file**; it depends on toolchain
  availability (PHP/Composer/MySQL) in whatever environment is running. As of the 2026-10-05 canonical
  consolidation, the recorded backend status was **PASS by inherited CI evidence** (CI run 37240671916
  on the byte-identical backend tree `7eba988…`), **not** re-executed in that pass. Treat that as a
  dated historical record; re-verify against `docs/engineering/PROJECT_STATE.md`,
  `CONSOLIDATION_CHECKPOINT.md` and `BACKEND_STATUS.md` for the live status, and claim nothing
  beyond what those record.
- **Laravel/backend is NOT authorized merely by the legacy roadmap.** New backend work begins only
  on explicit owner authorization (`docs/engineering/PROJECT_STATE.md`, `PRE_CLEANUP_HANDOFF.md`).
