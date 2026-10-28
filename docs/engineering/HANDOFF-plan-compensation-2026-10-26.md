# HANDOFF — Compensation slice: implementation plan, 2026-10-27

> Planning and read-only inspection only. No code, test, or doc changes except
> this file. No staging, commits, pushes, merges, resets, checkout, cleanup, or
> database operations. `PROJECT_STATE.md` untouched. All prior work preserved
> (~193 uncommitted files, nothing staged).

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     d354f001e730d05563ce5601a0485c99d9eb027a (4 commits ahead of origin)
```

## 1. Status: absent backend, complete demo contract, explicit stub in client

- **Backend: nothing exists.** No `backend/app/Domain/Compensation/`, no
  models, no migration, no routes, no tests (`grep` confirms zero hits).
- **Frontend contract: complete and frozen.** `repository.ts` (5 verbs:
  `list/get/register/schedule/complete` — no delete, no reopen, no
  add-participant), `types.ts` (stored record + derived read model +
  `COMPENSATION_ERRORS`), `derive.ts` (pure lineage/status functions),
  `LocalCompensationRepository` (demo; composes scheduling+attendance),
  `useCompensations.ts` (list + 3 verbs, refresh-after-resolve),
  `Compensation.tsx` (gated on `schedule.read`/`schedule.write`, honest
  empty/error/retry states), full demo test coverage.
- **Client: explicit `DOMAIN_UNAVAILABLE` stub** — the last of the list
  (`UNAVAILABLE_DOMAINS` = `[{branding removed →}]` exactly
  `[{id:"compensation"}]`), disclosed on login. Demo serves the local repo
  (unchanged by this slice).

## 2. Intended data model (from the contract, not invented)

- `compensations`: `id` (`cm_*`+ulid would collide with chat; use `cp_*`),
  `organization_id`, `original_session_id` (typed link, §D17),
  `class_id` (snapshot), `student_id` (frozen), `reason`,
  `required_at`, `required_by_user_id`, `attempts` JSON (append-only ledger
  of `{sessionId, scheduledAt, scheduledByUserId}`),
  `original_attendance_acknowledged_at?`, `completed_at?`,
  `completed_by_user_id?`, timestamps. **Unique key
  `(organization_id, original_session_id, student_id)`** — pair-lifetime
  uniqueness incl. settled rows (never upsert; `ALREADY_OPEN`/
  `ALREADY_SETTLED`).
- No `status` column (derived), no current-attempt pointer (newest ledger
  line), no media columns (attachments are out of contract — verified: no
  `mediaId` in `types.ts`, no media UI in the view).
- One table suffices (ledger as JSON column, matching the "facts only"
  stored shape); no delete/reopen/participant verbs exist.

## 3. API contract (repo verbs → endpoints)

- `GET /compensations` (filters: `originalSessionId, studentId, classId,
  status?, openOnly?, compensationSessionId?, needsAttention?`, paged) —
  derived filters are computed over the full derived set *before* paging so
  `meta.total` stays honest (hundreds of rows; same coarse approach as
  `dataVersion` documents).
- `POST /compensations` (register) · `GET /compensations/{id}` ·
  `POST /compensations/{id}/schedule` · `POST /compensations/{id}/complete`.
- `register` refuses unless: original `cancelled` + class `kind:"private"` +
  derived roster yields exactly the named student + pair free + reason
  present + (mark on original ⇒ explicit acknowledgement) + makeup cap
  (`OrganizationService::get()->max_makeups_per_term`, counted over *all* of
  the student's obligations). `schedule` creates an ordinary `scheduled`
  manual session **through `SchedulingService::create` inside the same DB
  transaction** (conflict engine, duration bounds, `origin:"manual"`
  hard-coded server-side — verified in `SessionService`, no client trust),
  appends the ledger line; refuses on terminal obligation or live effective
  make-up. `complete` requires a live effective session.
- **Wire carries no actor.** `CompensationActor` (`userId`, `permissions`)
  exists in TS inputs for the demo repo; the Api repository strips it
  (chat `from` precedent) and the server uses the token user exclusively.
- Errors reuse the contract's codes verbatim (`COMPENSATION_*`; 409 for
  `ALREADY_*`/cap/refusals, 422 validation, 404 unknown ids); `get` of an
  unknown id → `COMPENSATION_NOT_FOUND` (check existing code or add it).

## 4. Permissions: reuse `schedule.*` — evidence, not naming

The contract itself designates the gate ("no second, compensation-specific
permission... a make-up IS a session write", `COMPENSATION_FORBIDDEN`),
the view gates on it (`canWrite = useCan("schedule.write")`,
`viewPermissions` `compensation: "schedule.read"`), and the matrix already
grants it to exactly the operating roles. This is **not** a §26.3 borrow
(which forbids reinterpreting an id for a *different* domain): it is the
domain's own declared rule, mirroring how the view already behaves.
**Recommendation: no new ids; vocabulary stays 35** (the 35-count tests
guard against invention).

Role matrix (existing grants, verified in `permissions.ts` + backend config):

| role | read (`schedule.read`) | write (`schedule.write`) |
|---|---|---|
| administrator | yes | yes |
| manager | yes | yes |
| staff | yes | yes |
| teacher | yes | **no** |
| accountant | no | no |

**Open decision (requires owner approval): teacher read scope.** Sessions
are teacher-scoped (T-02: own classes via `teacherScope()` SQL filter;
unlinked teacher → 403 `OWNER_DECISION_REQUIRED_PB1`, scope checked before
permission — verified in `SessionPolicy` + `SchedulingTest`), but the
written compensation contract says reads are governed by view permission
only. Options: (A) contract-literal — any `schedule.read` holder lists all
obligations (simpler; exposes other teachers' private-lesson obligations +
student names); (B) teacher-scoped to own classes (`class.teacher_id`) +
PB-1 for unlinked (consistent with sessions; narrows the written contract).
**Recommended: B**, explicitly approved, or A with the leak acknowledged.
Mechanically B is a `whereExists`/`whereIn` on `class_id` via the classes
table (obligations carry no `teacher_id`; classes do) — `AcademyClass` has
the tenant scope, so the subquery stays in-org.

## 5. Smallest complete slice (ordered)

1. Migration (1 table as §2; unique pair key; FK cascade on org only) +
   model (`Compensation`, `organization_id`-scoped queries like
   `Room`/`GalleryImage`; no trait needed if keyed by org — follow
   `Room` composite pattern) + factory.
2. `CompensationPolicy` (`schedule.read`/`write` via `PermissionGate`,
   plus `teacherScope()`/`assertTeacherLinked()` mirroring
   `SessionPolicy`, incl. PB-1 throw) — separate policy; no shared
   abstraction with scheduling (branding-vs-organization rationale).
3. `CompensationService` (actor = token user; `register` incl. cap/roster/
   uniqueness/acknowledgement checks; `schedule` = transaction over ledger
   + `SchedulingService::create`; `complete` terminal; derivation ported
   from `derive.ts` — pure functions, learning-eligibility precedent;
   roster/attendance evidence via existing scheduling/attendance services,
   read-only).
4. 3 policy-first FormRequests + 2 resources + controller + 5 routes.
5. `ApiCompensationRepository` (+ bump on the 3 accepted writes only) +
   contract test; registry wiring; `unavailableDomains.ts` → `[]` **plus**
   empty-disclosure handling (login notice with zero names currently
   renders "…نشان نمی‌دهند: ." — conditionally hide or retire the notice).
6. View: no gate changes (already `schedule.*`); keep fallback/error
   states. `useCompensations` unchanged (local refresh + global bump).
7. Tests: `CompensationTest` (matrix incl. teacher-write 403 + accountant
   denial + unauth 401; forbidden-before-validation; 422/409 catalogue;
   cap; lineage-effective rules; pair-lifetime incl. settled; tenant
   isolation; teacher-scope A/B per decision); registry instance check;
   invalidation audit (+3 bumps + refused no-bump); `targetCopy`/bundle
   tests unchanged (no demo-only copy in this view — verify by bundle
   scan).

## 6. Architecture fit (no new abstractions, no completed-slice edits)

Reuses `ApiClient`, `PermissionGate`, policy-first FormRequests,
`ApiResponse` envelopes, service-to-service composition (gallery→media
precedent), derivation port (learning precedent), unique constraints +
transactions (contract's server-transactionality section). Zero edits to
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
- Concurrency: unique pair key + transactional schedule/complete (assert
  the refusal paths, not true races).
- `PROJECT_STATE.md`, merges, pushes, DB resets: all out of scope (no-op).
