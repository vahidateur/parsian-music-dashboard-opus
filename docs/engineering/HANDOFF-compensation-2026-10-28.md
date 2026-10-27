# HANDOFF — Compensation slice (end-to-end), 2026-10-28

> Implements `docs/engineering/HANDOFF-plan-compensation-2026-10-26.md`
> (and the 10-27 revision) under the owner's constraints: reuse
> `schedule.read` / `schedule.write`, no new permission ids; teacher
> read-scope option B with PB-1 fail-closed for unlinked accounts.
> No staging, commit, push, merge, reset, checkout or history edits.
> Only an additive migration; only ID-scoped cleanup of probe records.
> `PROJECT_STATE.md` untouched. Working tree holds this slice plus all
> prior uncommitted work (203 files, nothing staged).

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     d354f001e730d05563ce5601a0485c99d9eb027a (4 ahead of origin)
```

## 1. What existed, what was blocked

- **Existed (demo, frozen contract):** `repository.ts` (5 verbs —
  `list/get/register/schedule/complete`; no delete/reopen/add-participant),
  `types.ts` (`COMPENSATION_ERRORS`, frozen-student + derived read model),
  `derive.ts` (lineage/status), `localRepository.ts` (demo, composes
  scheduling + attendance), `useCompensations.ts`, `Compensation.tsx`
  (already gated on `schedule.read` / `schedule.write`), full demo tests.
- **Blocked:** no server tables, policy, routes; client resolved
  compensation to the `DOMAIN_UNAVAILABLE` stub — the last entry of
  `UNAVAILABLE_DOMAINS` (branding left in §38).
- **Decisions (§39, new):** compensation authorized for v1 under the
  **existing** `schedule.read` / `schedule.write` ids — vocabulary stays at
  **35**; no matrix change. A make-up IS a session write, so this is the
  domain's own declared gate, not a §26.3 borrow. Teacher reads are scoped
  to their own classes (T-02, option B, owner-approved); unlinked teacher
  accounts fail closed with PB-1, exactly like sessions. Recorded in
  `DECISIONS.md §39` + `.opencode/specs/auth-rbac.md` (Compensation: LIFTED).

## 2. Changes

**Backend (new):** migration `2026_10_28_000000_create_compensation_tables`
(one table; composite PK `(organization_id, id)`; unique
`(organization_id, original_session_id, student_id)` pair-lifetime key;
no FKs to sessions/students/classes — an obligation outlives its rows);
`Compensation` model (+`HasFactory`, `setKeysForSave/SelectQuery` per the
chat precedent) + `CompensationFactory`; `CompensationPolicy`
(`schedule.read` / `schedule.write` via `PermissionGate`, no scope — scope
lives in `SessionPolicy` so the two domains cannot drift); `CompensationService`
(port of `derive.ts` lineage + read model; register/schedule/complete in
transactions with `lockForUpdate`; pair + cap re-checked inside the write
txn; unique key as backstop; actor always the token user); 3 policy-first
FormRequests (`Store/Schedule/CompleteCompensationRequest`, PB-1 before
permission, mirroring `StoreSessionRequest`); `CompensationController` + **5
routes** (`GET|POST /compensations`, `GET /compensations/{id}`,
`POST /compensations/{id}/schedule|complete`); `CompensationTest` (**18**,
incl. the §3 filter regression).

**Backend (edited):** `routes/api.php` (+ compensation block, §37-style
comment); nothing else — scheduling/attendance/organization are composed
read-only (`SessionService::create/roster`, `OrganizationService::get`),
never modified. No `CompensationResource` (learning precedent:
service-owned wire arrays; a Resource wrapper was created and deleted).

**Frontend (new):** `ApiCompensationRepository` (actor stripped from the
wire — chat-`from` precedent; `bumpDataVersion` only after an accepted
write) + `apiRepository.test.ts` (9: every verb's URL/method/body, the
no-actor assertion, bump/no-bump).

**Frontend (edited):** `registry.client.ts` (real `ApiCompensationRepository`
+ header comment updated); `unavailableDomains.ts` → `[]` (**0 ids left**);
`registryClient.test.ts` (empty-enumeration pin + instance check);
`cacheInvalidationAudit.test.ts` (register bump + refused-schedule no-bump);
`targetFeatures.client.tsx` (empty-list guard returns null — no sentence
naming nothing) + `targetFeatures.client.test.tsx` (empty-state regression).

**Governance docs:** `DECISIONS.md §39` (matrix: admin/manager/staff read+write,
teacher read-only, accountant neither; option B; PB-1), `auth-rbac.md`
(Compensation: LIFTED). Both were already in the tree from prior-session
work; this session verified them against code and tests.

## 3. Defects found and fixed this session (all in uncommitted slice code)

1. **Dead exception import** — `CompensationService` caught
   `UniqueConstraintViolationException` while importing `QueryException`:
   the concurrency backstop would have fatalled instead of mapping to
   `ALREADY_OPEN`/`ALREADY_SETTLED`. Fixed the import.
2. **Arity mismatch** — `pairConflict($original->id, …, 0, $e)` (4 args)
   vs a 2-param definition: `ArgumentCountError` on the race path. Fixed
   the call. Both paths are defensive (pre-checks fire first); proven by
   `php -l` + the 18-test suite, not by a true race.
3. **List filters silently ignored over HTTP** — controller read camelCase
   `only([...])` while the wire is snake_case (`toQuery`), so
   `?student_id=` etc. filtered nothing. Fixed by accepting both spellings
   (snake primary); the service keeps the domain's camelCase params.
   Regression test `test_list_accepts_the_snake_case_wire_filters`
   (student + derived status + openOnly) fails before, passes after.
4. Tidying: `matchesDerived` missing `: bool`; removed unused
   `Student`/`Enrollment`/`Collection`/`TenantRules` imports.

Pre-existing camelCase/snake filter mismatches in older slices (gallery,
chat) were observed and deliberately NOT touched — out of scope.

## 4. Verification (actual commands and results, this session)

- `vendor/bin/phpunit --filter CompensationTest` → **OK (18 tests, 131 assertions)**
- `vendor/bin/phpunit` (full backend) → **OK (428 tests, 2982 assertions)**
- `npx vitest run` registryClient + cacheInvalidationAudit +
  permissionParity + apiAuthPersistence + targetCopy + targetFeatures.client +
  compensation apiRepository → **7 files, 78 tests passed**
- `npm run typecheck`, `tsc -p tsconfig.client.json`, `tsc -p tsconfig.demo.json` → **all exit 0**
- `npm run build:client` → fresh `dist/client` in 6.03s;
  `bundleBoundary.test.ts` → **6 passed, 2 skipped** (demo-build probes,
  `dist/demo` absent)
- Live (pre-existing dev stack, left running: mariadbd 3307, API 8080,
  vite 5173; migration already applied, tables verified present):
  baselines `compensations 0 / sessions 137 / rooms 4 / students 15`.
  Probe (admin token) on private class `cl2` + enrolled `st7`:
  create session → cancel → register (**201**) →
  `GET ?student_id=st7` returns exactly the probe (**snake_case live**) →
  schedule (**200**, `rescheduleCount 0`, `studentOnRoster true`) →
  second schedule **409 ALREADY_SCHEDULED** →
  complete (**200 `completed`**) → schedule **409 ALREADY_SETTLED** →
  re-register **409 ALREADY_SETTLED**.
  Teacher (`teacher1@`, linked `t1`): list `total 1` (own class only),
  register **403 FORBIDDEN `schedule.write`**.
  Accountant (`finance@`): list **403 FORBIDDEN `schedule.read`**.
  Login page: no disclosure note, no broken sentence (empty-list edge live).
  `/compensation` view: renders probe as completed (counts 0/0/1/0), no stub,
  no error; persists across reload. Cleanup by exact ids only
  (`DELETE … WHERE id='<cp>'`, sessions `IN ('<booked>','<orig>')`);
  baselines restored (`0 / 137 / 4 / 15`).
- Browser QA scope (honest): view rendering, empty disclosure, and reload
  persistence checked in the browser; the role matrix and all refusal codes
  checked over HTTP with role tokens, not via browser logins.

## 5. Remaining risks / explicitly deferred

- `COMPENSATION_SESSION_ALREADY_LINKED` (demo contract: a session is never
  the make-up of two obligations) has **no server check**: every booking
  creates a fresh session through `SessionService::create`, so a pre-linked
  row cannot arrive through the API. If a future verb ever accepts an
  existing session id, this check must be added with it.
- True concurrent double-submit was not race-tested (single-process suite);
  the unique key + in-txn re-checks are the enforcement, the refusal-path
  tests are the evidence.
- Full frontend suite (~7 min) not re-run: 3 known load-flaky files plus the
  environmental `projectState` branch-drift failure are pre-existing and
  unrelated; focused suites covering every touched file are green above.
