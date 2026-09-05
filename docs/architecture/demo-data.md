# Demo data — seed, backup & restore

Phase B of the data-layer work. It builds on `data-layer.md` and does not change the
authoritative flow:

```
View → Domain hook → Repository → DemoStore (demo) | ApiClient (api)
```

The Demo Data Manager sits *beside* that flow, at snapshot level. Views never touch
storage; repositories never learn about backups.

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
* `createEmptyDataset()` is the "Clear" target: every collection empty, organization settings kept.

## DemoStore

One snapshot, one key: `ava:demo:dataset`. All collections live in the same serialized
object, which is exactly what makes an atomic replace possible. `DemoStoreImpl.replace()`
serializes *before* writing, so an unserializable value can never wipe existing state.
Student CRUD (used by `DemoStudentRepository`) now mutates that snapshot; the repository
contract is unchanged.

## Demo Data Manager

`src/domains/demo/demoDataManager.ts`. It owns no persistence — it orchestrates.

| Operation | Destructive | Meaning |
|---|---|---|
| `initialize()` | no | seed only if no demo database exists (idempotent) |
| `resetToSeed()` | yes | restore the canonical shipped dataset |
| `clear()` | yes | remove all records, keep a valid empty environment |
| `importSeed()` | yes | import the canonical dataset (distinct intent from reset) |
| `importDataset()` | yes | replace with an externally supplied dataset |
| `restoreBackup()` | yes | validate a backup file, then replace |
| `exportBackup()` / `exportBackupJson()` | no | versioned envelope of the current state |

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
presence and array-ness of all 13 collections, id presence and uniqueness, and referential
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
  stamped demo, and the UI is labelled «محیط توسعه / فقط دمو».
* No authentication, authorization or integrity guarantee exists in the demo layer. Nothing
  here should be treated as production persistence, and no real personal data should be
  entered into it.

## UI entry point

Settings → «عملیات آموزشگاه» → «دادهٔ دمو». It reuses existing design-system components
(`Panel`, `Surface`, `Button`, `StatusBadge`) with no visual-language change, shows per-
collection counts, and offers: download backup, restore from file, reset, import canonical
seed, clear. Reset/Clear/Import/Restore all render an explicit confirmation block first.
