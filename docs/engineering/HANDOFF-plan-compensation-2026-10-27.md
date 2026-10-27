# HANDOFF — Compensation slice: implementation plan, 2026-10-27

> Planning and read-only inspection only. No code, test, or doc changes except
> this file. No staging, commits, pushes, merges, resets, checkout, cleanup, or
> database operations. `PROJECT_STATE.md` untouched. All prior work preserved
> (~192 uncommitted files, nothing staged).

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     d354f001e730d05563ce5601a0485c99d9eb027a (4 commits ahead of origin)
```

## 1. Status: absent backend, complete demo contract, explicit stub in client

- **Backend: nothing exists.** No `backend/app/Domain/Compensation/`, no
  models, no migration, no routes, no tests (`grep` confirms zero hits).
- **Frontend contract: complete.** `repository.ts` (5 verbs: `list/get/
  register/schedule/complete`), `types.ts` (stored record + derived read
  model + inputs + `COMPENSATION_ERRORS`), `derive.ts` (pure lineage/status
  functions), `localRepository.ts` (demo, composes scheduling+attendance),
  `useCompensations.ts` (list + 3 verbs, refresh-after-resolve),
  `Compensation.tsx` view (gated on `schedule.read`/`schedule.write`,
  honest empty/error/retry states), full demo test coverage.
- **Client composition: explicit `DOMAIN_UNAVAILABLE` stub** (1 of 1
  remaining with branding gone: `{id:"compensation"}`), disclosed on login.
  Demo composition serves the local repo (unchanged by this slice).

## 2. Intended data model (from the contract, not invented)

- `compensations`: `id` (`co_*`+ulid), `organization_id`, `original_session_id`
  (typed link, §D17), `class_id` (snapshot), `student_id` (frozen),
  `reason`, `required_at`, `required_by_user_id`, `attempts` JSON
  (append-only ledger of `{sessionId, scheduledAt, scheduledByUserId}`),
  `original_attendance_acknowledged_at?`, `completed_at?`,
  `completed_by_user_id?`, timestamps. **Unique key
  `(organization_id, original_session_id, student_id)`** — pair-lifetime
  uniqueness incl. settled rows (never upsert; `ALREADY_OPEN`/
  `ALREADY_SETTLED`).
- No `status` column (derived), no `current_attempt` pointer (newest ledger
  line), no media columns (attachments are out of contract).
- No delete verb, no reopen verb, no participant table (single frozen
  student, fixed at registration).

## 3. API contract (repo verbs → endpoints)

- `GET /compensations` (filters: `originalSessionId, studentId, classId,
  status?, openOnly?, compensationSessionId?, needsAttention?`, paged) —
  derived filters (`status/openOnly/needsAttention/compensationSessionId`)
  are computed over the full derived set *before* paging so `meta.total`
  stays honest (in-memory scale: hundreds of rows, same coarse approach as
  `dataVersion`).
- `POST /compensations` (register) · `GET /compensations/{id}` ·
  `POST /compensations/{id}/schedule` · `POST /compensations/{id}/complete`.
- `register` refuses unless: original `cancelled` + class `kind:"private"` +
  derived roster yields exactly the named student + pair free + reason
  present + (mark on original ⇒ explicit acknowledgement) + makeup cap
  (`OrganizationService::get().max_makeups_per_term` over all the student's
  obligations). `schedule` creates an ordinary `scheduled` manual session
  **through `SchedulingService::create` inside the same DB transaction**
  (reuses conflict engine, duration bounds, `origin:"manual"` hard-coded
  server-side), appends the ledger line; refuses on terminal obligation or
  live effective make-up. `complete` requires a live effective session.
- **Wire carries no actor.** `CompensationActor` (`userId`, `permissions`)
  exists in TS inputs for the demo repo; the Api repository must strip it
  (chat `from` precedent) and the server uses the token user exclusively
  (`requiredByUserId`/`scheduledByUserId`/`completedByUserId` =
  authenticated id).
- Errors reuse the contract's codes verbatim
  (`COMPENSATION_*`, 409 for `ALREADY_*`/cap/IN_USE-style refusals, 422 for
  validation, 404 for unknown ids).

## 4. Permissions: reuse `schedule.*` — evidence, not naming

The contract itself designates the gate ("no second, compensation-specific
permission... a make-up IS a session write"), the view already gates on it
(X-04, `viewPermissions` `compensation: "schedule.read"`), and the matrix
already grants it to exactly the operating roles. This is **not** a §26.3
borrow (which forbids reinterpreting an id for a *different* domain): it is
the domain's own declared rule. **Recommendation: no new ids; vocabulary
stays 35.** The `ProgressTest` 35-count becomes the guard against invention.

Role matrix (existing grants, verified in `permissions.ts` + backend config):

| role | read (`schedule.read`) | write (`schedule.write`) |
|---|---|---|
| administrator | yes | yes |
| manager | yes | yes |
| staff | yes | yes |
| teacher | yes | **no** |
| accountant | no | no |

Parity holds by construction (no matrix change); `permissionParity.test.ts`
needs no new table, but the slice adds a `CompensationTest` auth matrix
(read 200 for holders, write 403 `schedule.write` otherwise, accountant
403 everywhere, unauthenticated 401).

**Open decision (requires owner approval): teacher read scope.** Sessions
are teacher-scoped (T-02: own classes only; unlinked → PB-1 403), but the
written contract says compensation reads are governed by view permission
only. Options: (A) contract-literal — any `schedule.read` holder lists all
obligations (simpler; leaks other teachers' private-lesson obligations);
(B) teacher-scoped to own classes + PB-1 for unlinked (consistent with
sessions; narrows the written contract). **Recommended: B**, explicitly
approved, or A with the leak acknowledged.

## 5. Smallest complete slice (ordered)

1. Migration (2 tables as §2; unique pair key; FKs cascade on org only) +
   models (`Compensation`, `CompensationAttempt` or JSON ledger column —
   follow `ChatMessage` composite-PK style; ledger as JSON column keeps one
   table, matching the "facts only" stored shape) + factories.
2. `CompensationPolicy` (`schedule.read`/`write` via `PermissionGate`) —
   separate policy; no shared abstraction with scheduling (same rationale
   as branding vs organization).
3. `CompensationService` (actor = token user; `register` incl. cap/roster/
   uniqueness checks; `schedule` = transaction over ledger + `Scheduling-
   Service::create`; `complete` terminal; derivation ported from
   `derive.ts` — pure functions, learning-eligibility precedent; unread/
   roster/attendance evidence via existing scheduling/attendance services,
   read-only).
4. 3 policy-first FormRequests + 2 resources + controller + 5 routes.
5. `ApiCompensationRepository` (+ bump on the 3 accepted writes only) +
   contract test; registry wiring; `unavailableDomains.ts` → `[]` **plus**
   empty-disclosure handling (login notice with zero names currently
   renders "…نشان نمی‌دهند: ." — must conditionally hide or retire it).
6. View: no gate changes needed (already `schedule.*`); keep fallback/error
   states. `useCompensations` unchanged (local refresh + global bump).
7. Tests: `CompensationTest` (matrix, forbidden-first, 422/409 catalogue,
   cap, lineage-effective rules, concurrency note, tenant isolation);
   registry instance check; invalidation audit (+3 bumps);
   `targetCopy`/bundle tests unchanged (no demo-only copy in this view —
   verify by bundle scan).

## 6. Architecture fit (no new abstractions, no completed-slice edits)

Reuses `ApiClient`, `PermissionGate`, policy-first FormRequests,
`ApiResponse` envelopes, service-to-service composition (gallery→media
precedent), derivation port (learning precedent), unique constraints +
transactions (contract §"SERVER-SIDE TRANSACTIONALITY"). Zero edits to
scheduling/attendance/organization domains (read-only composition);
registry + unavailable list + shared test enumerations only. Demo
composition untouched (local repo stays).

## 7. Verification plan & acceptance

- Backend suite green incl. new `CompensationTest`; focused frontend
  (contract, registry, parity-unchanged, invalidation); 3 typechecks;
  fresh client build with 0 demo markers + 1→0 unavailable disclosure
  handled; live browser: register→schedule→complete round trip,
  derived-status transitions, `ALREADY_*` refusals, read-only teacher,
  accountant denial, persistence after reload, probe cleanup to baselines.
- Acceptance: view works against the API in client mode; teacher writes
  refused; no demo fallback; no invented ids (35-count green).

## 8. Risks & explicit approvals needed

- Permission reuse (`schedule.*`, no new ids) + teacher read-scope (A/B)
  need **explicit owner approval** before implementation.
- Derived-filter paging must filter-before-paginate or totals lie.
- Concurrency: unique pair key + transactional schedule/complete (asserted
  by contract; test the refusal paths, not true races).
- `PROJECT_STATE.md`, merges, pushes, DB resets: all out of scope (no-op).
