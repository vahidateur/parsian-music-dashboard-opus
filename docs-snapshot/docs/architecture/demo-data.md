# Demo data — seed, backup & restore

Phase B of the data-layer work. It builds on `data-layer.md` and does not change the
authoritative flow:

```
View → Domain hook → Repository → DemoStore (demo) | ApiClient (api)
```

The Demo Data Manager sits *beside* that flow, at snapshot level. Views never touch
storage; repositories never learn about backups.

## Data lifecycle — UNINITIALIZED / EMPTY / DEMO

The product ships to real academies, so "no data yet" is ambiguous unless the app
says which kind of nothing it means. Three states exist and the distinction is a
**persisted fact**, never an inference from row counts:

```
                    UNINITIALIZED
                          │  explicit first-run choice
             ┌────────────┴────────────┐
             ▼                         ▼
           EMPTY                     DEMO
   real/customer data          showcase/QA dataset
```

| State | Meaning | Marker | Dataset |
|---|---|---|---|
| `uninitialized` | No environment has been created. Nothing is persisted and nothing may be seeded implicitly. | absent | absent, or present but unusable |
| `empty` | A real customer environment with zero academy records. | `empty` | persisted |
| `demo` | The canonical showcase/QA dataset. | `demo` | persisted |

* Marker key `ava:demo:lifecycle` (`LIFECYCLE_STORAGE_KEY`), written **together
  with** the dataset in one `initializeEnvironment()` call, so a marker and its
  dataset can never disagree about existing.
* Row counts are never consulted: an EMPTY environment that has gained one
  student is still EMPTY, and a DEMO dataset emptied by `clear()` is still DEMO.
* Owner: `src/domains/demo/lifecycle.ts` — the ONE boundary that decides what
  kind of environment this is. React reaches it through
  `src/domains/demo/useDataLifecycle.ts` only, so no view or component imports
  the store or `localStorage`
  (`src/__tests__/architectureBoundaries.test.ts` enforces this).

### Reads never decide anything

`DemoStore.snapshot()` used to seed the canonical dataset on first read, which
made *every* browser that opened the app a demo environment without being asked.
Now:

* a usable persisted payload → parsed, migrated (`migrateDataset`) and returned;
* nothing persisted, or a payload that is not a dataset at all → a valid
  **in-memory** empty dataset and **zero writes**. `isInitialized()` still
  answers `false`, so the lifecycle boundary can tell "no environment yet" from
  "an EMPTY environment".

A corrupt payload therefore reports UNINITIALIZED instead of being silently
"repaired" into demo data. The stored bytes are left exactly as they were — a
read never writes and never deletes — and the first-run choice is offered again.

### First-run flow

`DataLifecycleGate` sits **above** `AuthProvider`
(`AccessGate → ConfigGate → DataLifecycleGate → AuthProvider → Shell → views`),
because authentication itself reads the environment: the signed-in user is
resolved against `users`. While the state is `uninitialized` nothing behind the
gate renders — not the login screen, not one record — and `FirstRunChooser`
offers exactly two options:

* «شروع با دادهٔ خالی» → `initializeEmptyEnvironment()` → EMPTY
* «بارگذاری دادهٔ نمونه» → `initializeDemoEnvironment()` → DEMO

Both refuse (`reason: "already-initialized"`) once an environment exists, so
neither choice can replace or erase data. Changing an existing environment's data
requires the confirm-gated manager operations below. The gate is transparent in
`api` mode: there the data source is already decided by configuration and there
is no local environment to choose.

### EMPTY is a usable environment

`createEmptyDataset()` keeps every collection at zero. On its own that is a dead
end, because demo authentication resolves the signed-in user against `users` —
zero users means nobody can ever get in to create the first student. So
`createEmptyEnvironment()` adds exactly one **access bootstrap** account
(`BOOTSTRAP_ADMIN`, `admin@academy.local`, role `administrator`, carrying no
credential material) plus the RBAC projection (`deriveRoles()`), which the
dataset validator requires.

The bootstrap lives at lifecycle level, *not* inside `createEmptyDataset()`, so
the clear-target and the "every collection is zero" invariant stay pinned by
`seed.test.ts`.

### Legacy adoption

A dataset persisted before the marker existed has no lifecycle state. It is
adopted as **DEMO**, once, by `persistLifecycleAdoption()` — called from
`useDataLifecycle`'s effect, never during render and never by a repository read:

* every dataset a previous build could write came from `createSeedDataset()` or
  from demo-stamped manager operations; this store has never held anything else;
* adoption preserves every record. Offering the chooser over existing data would
  present two options that both replace or erase it;
* it never converts an existing environment into EMPTY, which is the failure mode
  the requirement rules out.

Only the marker key is written; the dataset bytes are untouched.

### Mode transitions

| Operation | Data effect | Marker effect |
|---|---|---|
| `initializeEmptyEnvironment()` | writes the empty environment | `empty` |
| `initializeDemoEnvironment()` | writes the canonical seed | `demo` |
| `resetToSeed()` / `importSeed()` | replaces with the canonical seed | `demo` |
| `clear()` | removes records, keeps the environment | **unchanged** |
| `restoreBackup()` / `importDataset()` | replaces with the given dataset | **unchanged** |
| `uninitializeEnvironment({confirm:true})` | removes dataset, marker and stored binaries | removed → UNINITIALIZED |

`uninitializeEnvironment` is not `clear()`: clearing keeps the environment and its
kind, uninitializing removes the environment itself so the first-run choice is
offered again. Stored binaries go with it, so a DEMO environment's demo blob
cannot survive into whatever is created next. A blob store that cannot be cleared
does not block the operation (the dataset is already gone) but the failure is
reported in the result message rather than swallowed.

### Demo-only material

`isDemoEnvironment()` — persisted state **and** `isDemoMode()` — gates every
demo-only affordance centrally:

* the demo library file (resource `res1`, media asset `md_demo_res1`) is
  provisioned only in DEMO; `useDemoLibraryFile()` returns early otherwise, so an
  EMPTY environment never receives demo bytes;
* `DemoNote` renders only in DEMO, because "this section is filled with demo
  data" would mislabel a customer's own records;
* the Settings data panel labels itself by environment kind and hides the two
  operations that install the showcase dataset (`reset`, `import-seed`) outside
  DEMO.

There is deliberately **no Settings switch** for the lifecycle: the kind of an
environment is chosen once at first run, and changed only by the explicit
confirm-gated operations above.

## Canonical dataset

`src/domains/demo/seed.ts` builds a **versioned, deterministic** `DemoDataset` from the
existing hand-authored Persian academy data in `src/data/*`. It is a projection of that
data, not a copy of the domain model — entity types are still imported from
`@/data/records`, so demo and production can never drift into two models.

* `SEED_VERSION` (`2026.09.1`) identifies the dataset content/shape.
* `createSeedDataset()` is pure: repeated calls produce byte-identical JSON.
* Derived (not hand-authored) collections are generated deterministically:
  * **enrollments** from `AcademyClass.studentIds`, with stable ids `enr_<class>_<student>`
    — enrollments are the authoritative Student ↔ Class edge (`Student` has no `classId`);
  * **users** from the teacher list plus three staff accounts, containing no credential fields.
* `createEmptyDataset()` is the "Clear" target and the shape a read returns when
  nothing is persisted: every collection empty, organization settings kept. It is
  **not** by itself a usable environment — see `createEmptyEnvironment()` above,
  which adds the access bootstrap.

## DemoStore

Two keys, one authority:

| Key | Holds |
|---|---|
| `ava:demo:dataset` (`DEMO_STORAGE_KEY`) | the whole snapshot — every collection in one serialized object, which is what makes an atomic replace possible |
| `ava:demo:lifecycle` (`LIFECYCLE_STORAGE_KEY`) | the environment's kind: `empty` \| `demo`, or absent for UNINITIALIZED |

`DemoStoreImpl.replace()` serializes *before* writing, so an unserializable value
can never wipe existing state, and records an `empty` marker if none exists — data
written by the visitor is real data, never demo data, and a persisted dataset
always has a marker. Student CRUD (used by `DemoStudentRepository`) mutates that
snapshot; the repository contract is unchanged.

`isInitialized()` means "a usable dataset is persisted", not "the key exists": the
raw payload is parsed and shape-checked (cached per raw string, so a write
invalidates the cache by construction). That is what lets a corrupt payload report
UNINITIALIZED instead of pretending to be an environment.

`reset()` removes **both** keys and returns the store to UNINITIALIZED. It seeds
nothing — which is why tests say which environment they want, out loud, through
`src/test/demoEnvironment.ts` (`resetToDemoEnvironment` /
`resetToEmptyEnvironment` / `resetToUninitialized`).

## Demo Data Manager

`src/domains/demo/demoDataManager.ts`. It owns no persistence — it orchestrates.

| Operation | Destructive | Meaning |
|---|---|---|
| `lifecycleState()` | no | the persisted kind of this environment (`uninitialized` \| `empty` \| `demo`) |
| `initialize()` | no | delegates to `initializeDemoEnvironment()`: creates DEMO only if nothing exists, otherwise reports "already present" and writes nothing |
| `resetToSeed()` | yes | restore the canonical shipped dataset, and record the environment as DEMO |
| `clear()` | yes | remove all records, keep the environment **and its kind** |
| `importSeed()` | yes | import the canonical dataset (distinct intent from reset); also records DEMO |
| `importDataset()` | yes | replace with an externally supplied dataset; kind unchanged |
| `restoreBackup()` | yes | validate a backup file, then replace; kind unchanged |
| `exportBackup()` / `exportBackupJson()` | no | versioned envelope of the current state |
| `uninitialize()` | yes | remove the environment entirely — dataset, marker and stored binaries — returning to UNINITIALIZED |

Every destructive call takes an explicit `{ confirm: true }` argument; without it the call
returns a failure and writes nothing. The UI layers a second gate on top: `useDemoData`
models `request → confirm/cancel`, so a click can never be destructive on its own.

## Backup format

```jsonc
{
  "kind": "arena.demo.backup",
  "schemaVersion": "1.0",
  "environment": "demo",
  "exportedAt": "2026-09-05T10:00:00.000Z",
  "app": { "name": "Arena — Ava Music Academy (DEMO)", "seedVersion": "2026.09.1" },
  "stats": { "seedVersion": "...", "counts": { "students": 13, ... }, "total": 0 },
  "data": { "organization": {...}, "students": [...], ... }
}
```

* Deterministic except `exportedAt`.
* `environment: "demo"` and the `(DEMO)` app name make misuse obvious.
* Secrets are excluded by construction *and* checked: `findForbiddenKeys` rejects
  `password`, `token`, `accessToken`, `refreshToken`, `apiKey`, `secret`, `cookie`,
  `credentials`, `authorization`, `sessionToken`. (`sessionId` is intentionally allowed —
  in this domain it references a *class session*, not a browser session.)

## Validation strategy

`validateBackup` / `validateDataset` run **before** any write and return a list of typed
issues (`MALFORMED_JSON`, `NOT_AN_OBJECT`, `UNSUPPORTED_SCHEMA_VERSION`, `WRONG_ENVIRONMENT`,
`MISSING_COLLECTION`, `INVALID_COLLECTION`, `MISSING_ID`, `DUPLICATE_ID`,
`INVALID_REFERENCE`, `FORBIDDEN_FIELD`). Checks cover: envelope version and environment,
presence and array-ness of all 30 collections, id presence and uniqueness, and referential
integrity for classes→teacher/room, enrollments→student/class, sessions→class/teacher/room,
attendance→session/student, invoices/payments→student, users→role.

## Atomic restore

1. validate the parsed input in full — any issue aborts with zero writes;
2. capture a safety backup of the current snapshot (returned in the result);
3. one `replace()` write.

There is no per-collection write path, so a partially applied restore is not
representable. A throwing storage write is caught and reported, leaving the previous
snapshot in place. Tests assert both "invalid input performs zero writes" and "failed
write leaves state unchanged".

## Relationship to the future backend

The seed/backup format is expressed in domain entities and contains no storage keys, so an
API backend can later serve the equivalent operations —
`GET /demo/export`, `POST /demo/import`, `POST /demo/reset` — returning/accepting the same
envelope, with no UI redesign. `DemoDataManager` would then gain an API-backed sibling
selected by the same `VITE_DATA_SOURCE` switch used for repositories.

## Limitations and the security boundary

* Demo persistence is **browser localStorage**. It is per-browser, per-profile, clearable
  by the user, size-limited (~5 MB) and shared with anything else on the origin.
* The app cannot *guarantee* a demo/production distinction on its own: the safest boundary
  available is enforced instead — demo mode is the default, the API mode is a separate
  configuration, backups are stamped `environment: "demo"`, restore rejects anything not
  stamped demo, and the data panel labels itself by environment kind («محیط توسعه / فقط دمو»
  in DEMO, «دادهٔ واقعی» in a customer's EMPTY environment).
* **Backup envelope stamping (outstanding).** `createBackup()` always stamps
  `environment: "demo"`, `app.name: "Arena — Ava Music Academy (DEMO)"` and
  `backupFileName()` always produces `arena-demo-backup-*.json`. In an EMPTY environment
  those labels describe a customer's own records as demo data. Restore round-trips
  correctly (validation accepts the same stamp it wrote), so nothing is lost — but the
  envelope, the app name and the filename should become environment-aware. That is a
  versioned file-format change plus a change to the `WRONG_ENVIRONMENT` rule, so it is
  deliberately not bundled into this phase. The confirmation toast in the panel is
  already environment-aware.
* **`clear()` leaves an environment nobody can sign into.** Clearing removes every record
  including `users`, and demo authentication resolves the signed-in user against `users`,
  so after `clear()` there is no account to log in with until the environment is
  uninitialized (first-run choice again) or a backup is restored. Pre-existing behaviour,
  unchanged here: `seed.test.ts` pins every collection to zero for the clear target, and
  adding a bootstrap account inside `createEmptyDataset()` would break that invariant.
  The bootstrap exists only in `createEmptyEnvironment()`, i.e. only on the explicit
  EMPTY-initialization path.
* **A corrupt payload is reported, not repaired.** Unusable bytes under
  `ava:demo:dataset` mean UNINITIALIZED: the first-run choice returns and the bytes are
  left alone. Recovery of the previous content is the visitor's decision (restore a
  backup, or uninitialize and start again), not something a read may do silently.
* No authentication, authorization or integrity guarantee exists in the demo layer. Nothing
  here should be treated as production persistence, and no real personal data should be
  entered into it.

## UI entry point

Settings → «عملیات آموزشگاه» → «دادهٔ دمو» (DEMO) or «دادهٔ محیط» (EMPTY). It reuses
existing design-system components (`Panel`, `Surface`, `Button`, `StatusBadge`) with no
visual-language change and shows per-collection counts.

Available operations depend on the environment kind, because two of them install the
showcase dataset:

| Control | DEMO | EMPTY (customer) |
|---|---|---|
| download backup | yes | yes |
| restore from file | yes | yes |
| clear (all records) | yes | yes |
| reset to canonical seed | yes | **hidden** |
| import canonical dataset | yes | **hidden** |

Every destructive control renders an explicit confirmation block first, and the
confirmation copy for `clear` / `restore-backup` speaks of "this environment's records"
rather than "demo records" — a dialog that mislabels what it is about to destroy is how
real data gets deleted by accident. Permission is unchanged (`demo.manage`, i.e. the
administrator role); only the naming of that permission is demo-flavoured.

The first-run choice is *not* in Settings: it is `FirstRunChooser`, rendered by
`DataLifecycleGate` above the whole app while the environment is UNINITIALIZED.
