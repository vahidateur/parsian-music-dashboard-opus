# HANDOFF — cross-domain integration audit, ۲۰۲۶-۱۰-۲۴

> No commit/push/reset/staging. No DB resets or seeds. No `PROJECT_STATE.md` edits.
> Working tree preserved (~142 files incl. prior slices). This doc is the audit record.

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     `git log -1 --format=%H` (doc cannot carry its own SHA)
```

## 1. Scope

Post-Media/Instruments/Learning/Rooms audit. Read all four handoffs first.
Checked: per-repo `bumpDataVersion` coverage, UI refresh after write, permission/
policy/gate/role consistency, cross-domain refs (media/instrument/learning/room),
client composition (real Api vs unavailable stub), error/stale-UI handling.

## 2. Defect found and fixed (only one class of defect)

**F1 — missing shared invalidation in 13 served Api repositories (severity: high, verified).**
`useResourceList` and the bespoke hooks (`useStudentList`, `useUsers`,
`useOrganization`, `useSessionAttendance`, `useStudentProgress`, …) re-read on
`dataVersion`. Demo composition bumps via `demoStore.subscribe`; client has no
store, so each Api repo must bump after an accepted write (rooms §35 precedent).
Only instruments/learning/rooms did; 10 others + users/roles did not.

Evidence (before fix): new `cacheInvalidationAudit.test.ts` — 13 write-bump
cases **failed** (version unchanged after accepted write), 4 no-bump guardrails
passed (refused write, `previewGeneration`, local-validation refusal).

Fix (existing architecture, no refactor): `bumpDataVersion()` after successful
`await` in each mutating method, mirroring rooms; refused writes bump nothing.
Touched: students, teachers (incl. `deactivate` → async), classes (incl.
`archive` → async), enrollments, scheduling (create/update/cancel/reschedule/
delete/`generateSessions`; `previewGeneration`/`checkConflicts`/`sessionRoster`
deliberately read-only), attendance (record/bulk/correct), library, media,
organization, progress (7 verbs), `ApiUserRepository` (create/update/delete),
`ApiRoleRepository` (update/reset). `setPassword`/`hasOwnPassword` intentionally
**not** bumping (credential verb, no list impact) — documented decision, not gap.

After fix: audit file 17/17 green.

## 3. Verified clean (no defect, no change)

- **Permissions (verified):** backend `permissions.php` = frontend
  `permissions.ts` = 31 ids; matrices identical (incl. §35 rooms table,
  accountant `rooms.read`). `permissionParity.test.ts` green. Policies
  (`Room/Instrument/LearningPolicy`) use `PermissionGate`; controllers check
  policy first. `RoomsPanel` has no `useCan` (like other Settings panels; route
  is `settings.read`, both writers hold it) — consistent, not a gap.
- **Composition (verified):** `registry.client.ts` resolves real Api repos for
  all served domains (incl. rooms instance check); unavailable is exactly
  chat/branding/gallery/compensation. Fresh client build:
  0 demo markers (`ava:demo:`, `@demo.local`, `arena-demo`, `localStore`,
  `DataLifecycleGate`, `VITE_DATA_SOURCE=demo`, `DemoDataPanel`); unavailable
  strings present as disclosure (expected).
- **Cross-domain refs (verified):** `TenantRules::assignableRoom`
  (exists+active, policy lives in `RoomPolicy`), `mediaAssetExists`
  (tenant-scoped, cleared `''`/`null` passes); frontend renders unknown
  names as no-data (`classFormUnresolvedReferences` green).
- **Errors/stale UI (verified):** `classifyError` (unavailable/policy/failure),
  `blockingFailure` for relation reads; stub-based tests
  (`errorAvailability`, `heroMetricsRoomsUnavailable`, `clientAvailability`)
  green and untouched (they test classification, not server behavior).
- **Media list-UI (verified):** no prod list UI (blob-by-id only:
  `useMediaObjectUrl`, `useLibraryFile`, profile photos); bump added for
  consistency, harmless. No gallery/media list to go stale.

## 4. Test evidence

- Backend suite: **373 tests, 2488 assertions — OK**.
- Frontend focused: **399** (auth/rooms/learning/instruments/registry/audit/
  errorAvailability/hero/clientAvailability/students+library+media api) +
  **58** (architectureBoundaries/relations/permissionParity/unresolved-refs) +
  **55** (rooms/instruments/learning api + audit) + **32 passed/2 skipped**
  (bundleBoundary/apiAuthPersistence/DemoBackedNotice) — all green.
- Typechecks: default, `tsconfig.client.json`, `tsconfig.demo.json` — all exit 0.
- Client build (`/tmp/opencode/dist-client-audit`): success, 0 demo markers.
- Live (mariadbd 3307 + API 8080 + vite 5173, then all stopped, ports clean):
  login disclosure lists exactly the 4 unavailable; students list 15/15 from
  server; rooms panel 4/4; UI-created probe room appeared **without reload**
  (bump, no regression); API delete 204; baselines restored (rooms 4,
  students 15). Full cleanup verified in DB.

## 5. Remaining risks / explicit non-findings

1. Full frontend suite (~8 min) not run — focused runs answer the audit;
   run `npm test` before merge.
2. Full backend suite on live MySQL not run this session (sqlite green);
   no schema changed, risk low.
3. Student UI-create not verified live (form needs national-ID checksum);
   wire format covered by unit + backend tests; bump is payload-neutral.
4. `RoomsPanel` has no delete button (product decision, endpoint+test ready).
   Unchanged.
5. `errors.ts` still carries `OWNER_DECISION_REQUIRED_PB3` copy (shared
   family, only renders on real server code). Unchanged.
6. Name-duplicate checks are collation-sensitive (sqlite vs MySQL) — pre-existing,
   out of scope.

## 6. Resume

```bash
git log -1 --format=%H; git status --short | wc -l
cd backend && vendor/bin/phpunit 2>&1 | tail -3
npx vitest run src/domains/shared/__tests__/cacheInvalidationAudit.test.ts src/domains/rooms src/domains/auth --testTimeout=30000
npm run typecheck
```
