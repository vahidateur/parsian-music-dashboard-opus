# Data layer

Arena React is the primary product. This document describes the boundary that lets the
existing UI migrate from demo persistence to a real REST backend **without being redesigned**.

```
View / Hook
    ↓  domain contract  (StudentRepository, …)
Repository
    ↓
DemoStore (mode: demo)      ApiClient → HTTP (mode: api)
```

## Layers

| Layer | Path | Responsibility | Must not |
|---|---|---|---|
| Transport | `src/api/client.ts` | fetch, query strings, JSON, auth header, timeout/abort, envelope unwrapping | know any domain |
| Errors | `src/api/errors.ts` | normalize every failure into `ApiError` with a `kind` | contain UI text decisions per view |
| Config | `src/api/config.ts` | pick `demo` vs `api`, resolve base URL from Vite env | expose a fake "production" mode |
| Domain | `src/domains/<domain>/` | business-facing contracts + implementations | speak HTTP in the interface |
| Composition | `src/domains/registry.ts` | choose the implementation, hold the auth token | contain business logic |
| Demo persistence | `src/services/demoStore.ts` | the only writer of demo `localStorage` | be imported by views |

## Why the DemoStore stays

The DemoStore is *implementation #1*, not scaffolding. It keeps the product demonstrable
with zero backend, gives the repository contract a second implementation (which is what
proves the abstraction is real), and remains the fallback whenever `VITE_DATA_SOURCE`
is not `api`. It is never deleted as part of the API migration — it is simply not selected.

Demo mode stays visibly demo: no simulated "production" behaviour is added.

## ApiClient

```ts
api.get<T>(path, { query, signal, headers })
api.getPage<T>(path, { query })   // → Page<T> = { data, meta:{page,per_page,total} }
api.post<T>(path, body)
api.patch<T>(path, body)
api.delete(path)
```

* Base URL: `VITE_API_BASE_URL` (default `/api/v1`) — no backend host is hardcoded.
* Auth: `getToken()` callback → `Authorization: Bearer …`; `onUnauthenticated()` fires on 401.
* Cancellation: caller `AbortSignal` is composed with an internal timeout signal.
* Envelope: `{ data, meta, errors }` is unwrapped so repositories see plain entities.

## Error model

`ApiError.kind` ∈ `network | timeout | cancelled | authentication | authorization |
validation | not_found | conflict | server | unknown`, plus optional `status`, `code`,
`fields`. A future scheduling response

```json
409 { "error": { "code": "SCHEDULE_VERSION_CONFLICT", "message": "…" } }
```

is already representable: `error.isConflict("SCHEDULE_VERSION_CONFLICT")`.
Scheduling itself is **not** implemented here.

## Student repository contract

```ts
interface StudentRepository {
  list(params?: StudentListParams, signal?: AbortSignal): Promise<Page<Student>>;
  get(id: string, signal?: AbortSignal): Promise<Student>;
  create(input: CreateStudentInput): Promise<Student>;
  update(id: string, input: UpdateStudentInput): Promise<Student>;
  delete(id: string): Promise<void>;
}
```

Ids are domain ids (`"st1"`), never URLs. `Student` is reused from `src/data/records.ts`
so there is exactly one entity shape in the app; only operation types are new.

Implementations:

* `DemoStudentRepository` — filtering/paging over `demoStore.students.*`. It owns no persistence.
* `ApiStudentRepository` — `GET|POST /students`, `GET|PATCH|DELETE /students/{id}`,
  with `StudentListParams → snake_case` query mapping.

Selection: `getStudentRepository()` in `src/domains/registry.ts`
(`setStudentRepository()` is the test seam).

Every other domain follows this shape verbatim; see "Phase 2" below.
Flipping `VITE_DATA_SOURCE=api` switches all of them to the real backend at once.

## Domain model rules (enforced by naming, not shortcuts)

```
Organization → Users(Roles/Permissions), Students, Teachers, Rooms, Classes
Student → Enrollment → Class → Session → Attendance
```

`Student ≠ Enrollment ≠ Class ≠ Session`. `Student.teacherId` in the demo dataset is a
denormalized display field and is **not** the authoritative relationship; enrollments own
Student ↔ Class over time.

## Phase 2 — the interactive core

Five domains are now wired end to end through repositories: **students, teachers,
rooms, classes, enrollments**. Each folder holds the same five files —
`types.ts`, `repository.ts` (the contract), `demoRepository.ts`, `apiRepository.ts`,
`useX.ts` — plus its dialog component. Operation inputs are always
`CreateXInput` / `UpdateXInput`; list params are snake_case (`per_page`).

```
React view / dialog
    ↓ domain hook (useStudents, useTeachers, useRooms, useClasses, useEnrollments)
    ↓ repository contract
DemoXRepository → demoStore        ApiXRepository → ApiClient → backend
```

### Invariants owned by the repository, not the form

Dialogs validate fields for fast feedback; repositories own the rules, and the
`ApiError.fields` map merges into the same error state so a demo rejection and a
future server rejection render identically. Demo error codes:

`STUDENT_INVALID`, `STUDENT_NATIONAL_ID_TAKEN`,
`TEACHER_{NOT_FOUND,PHONE_TAKEN,HAS_CLASSES,INVALID}`,
`ROOM_{NOT_FOUND,NAME_TAKEN,IN_USE,INVALID}`,
`CLASS_{NOT_FOUND,INVALID,ARCHIVED,FULL,HAS_ENROLLMENTS,CAPACITY_BELOW_ENROLLED}`,
`ENROLLMENT_{NOT_FOUND,INVALID,DUPLICATE}`.

### Enrollment is the canonical Student ↔ Class edge

`class.enrolled`, `class.waitlist` and `class.studentIds` are a **projection** of
enrollment rows, recomputed by `syncClassProjection()` on every write. Nothing may
hand-write them — including the seed, which builds both sides from one source via
`withDerivedEnrollments()` in `src/domains/demo/seed.ts`. Records reference each
other by id; a class never embeds student objects.

Rules: no duplicate open enrollment per (student, class); capacity is enforced at
write time; an archived class and an inactive student cannot be enrolled;
withdrawal frees the seat and is kept as history rather than deleted.

### national_id

`Student.nationalId` is required and unique. `src/lib/nationalId.ts` normalizes
(Persian/Arabic digits → ASCII, 8–9 digit zero-padding) and checksum-validates it.
Uniqueness in demo is a store scan; in production it is
`UNIQUE(organization_id, national_id)` — **the client check is convenience only**.
The national ID never appears in palette subtitles, telemetry, or URLs.

### Cross-domain invalidation

One coarse counter, `src/domains/shared/dataVersion.ts`, fed by `demoStore.subscribe()`.
Every list hook reads `useDataVersion()`, so a write in any domain refreshes every
dependent view. There is deliberately no second store, cache, or state framework.

### Demo clock

`src/domains/shared/clock.ts` (`academyNowMinutes()`, `useAcademyNow()`) returns a
frozen demo time in demo mode and real time otherwise. Views no longer import the
deprecated `ACADEMY_NOW` constant. Time-sensitive authorization or billing remains
**BACKEND REQUIRED** — a client clock is not a trust boundary.

### Dashboard metrics

`src/domains/shared/useAcademyMetrics.ts` derives counts from repository data.
Each tile is labelled DOMAIN-DERIVED DEMO METRIC, CURATED DEMO PRESENTATION, or
BACKEND-REQUIRED METRIC. Attendance % was removed from the hero rather than faked.
Fanning out to N `list()` calls is acceptable at demo scale; production wants
`GET /dashboard/metrics`.

### Command palette

`src/domains/shared/useDomainSearch.ts` searches the four entity repositories live,
so a record created seconds ago is findable. The static search index was deleted.
Nav/help/action commands remain, and action commands call real repository
operations. Recents live in `src/domains/shared/recentTargets.ts` — a validated,
per-browser UI preference kept **out of** `DemoStore`, so it survives a demo reset
and never appears in a backup. Production wants `GET /search?q=`.

### Import / export

`src/domains/import/` parses CSV and XLSX (`spreadsheet.ts`) under hard caps —
5 MB, 5000 rows, 60 columns, 1000 chars/cell, 64 zip entries, 40 MB inflated —
treating every file as untrusted. Import is **atomic by policy**: the whole file is
parsed, mapped, validated and previewed before a single `DemoStore` write. Rows
carry per-row rejection reasons and a downloadable error report. Formula-like cells
in an import are rejected, not silently escaped. True DB-level atomicity is
**BACKEND REQUIRED** (a transactional bulk-import endpoint).

`src/domains/export/exportService.ts` exports students, teachers, classes and
enrollments to CSV and XLSX from **current** state. Column lists are explicit
(never `Object.entries(record)`) so a secret can never leak by accident; formulas
are escaped; CSV carries a UTF-8 BOM for Persian in Excel; XLSX writes inline
strings so leading zeros survive. Nothing is uploaded anywhere.

## Enforced boundaries

`src/__tests__/architectureBoundaries.test.ts` scans source (comments and string
literals stripped) and fails the build if a view or component touches
`localStorage`, imports `demoStore`, calls `fetch(`, hardcodes an `http(s)://` URL,
references the deleted `useAsyncView`, or imports `ACADEMY_NOW`. Layering is a
test, not a review convention.

Untrusted JSON (`localStorage`, imported backups) is stripped of
`__proto__` / `constructor` / `prototype` before use.

## Intentionally NOT implemented

Backend of any kind (no Laravel involvement is part of this work), server-side
permission enforcement, scheduling conflict detection / recurrence, uploads,
server-side reports, `GET /search`, `GET /dashboard/metrics`, realtime, and the
audit log. Attendance, Finance, Messages, Library and Reports remain honest
read-only fixture renderers with no domain layer yet.

## Migration status (verified by execution, not by intent)

`Student` is the reference migration: `StudentsView` reads exclusively through
`useStudentList()` → `StudentRepository` → `DemoStudentRepository | ApiStudentRepository`.
It has no `students` fixture import, derives its stat counts from loaded data, and
renders real loading / error / not-found states. Regression coverage lives in
`src/views/__tests__/Students.test.tsx`, which asserts that fixture records do **not**
appear when the repository returns something else.

| View / component | Status | Reads from |
|---|---|---|
| Students | **IMPLEMENTED** | `useStudentList` → repository |
| Teachers | **IMPLEMENTED** | `useTeachers` → repository |
| Classes | **IMPLEMENTED** | `useClasses` → repository |
| Rooms (Settings → operations) | **IMPLEMENTED** | `useRooms` → repository |
| Enrollments | **IMPLEMENTED** | `useEnrollments` → repository |
| Dashboard metrics | **IMPLEMENTED** | `useAcademyMetrics` → repositories |
| Command Palette | **IMPLEMENTED** | `useDomainSearch` → repositories |
| Import / Export Center | **IMPLEMENTED** | `src/domains/{import,export}` |
| Settings → Users & Roles | **IMPLEMENTED** | `useUsers` → `UserRepository` |
| Settings → Demo data | **IMPLEMENTED** | `useDemoData` → `demoDataManager` |
| Login / auth | **IMPLEMENTED** | `useAuth` → `AuthRepository` |
| Scheduling, Attendance, Finance, Messages, Library, Reports | **PARTIAL** | static `@/data/records` + `@/data/academy` |
| Notifications | **PARTIAL** | static fixtures |

### Why the rest were not migrated in this phase

Each remaining view needs its own domain contract (Session, Attendance, Invoice,
Conversation, Resource) plus demo *and* API implementations
and tests. Doing that mechanically — pointing views at a repository that merely
re-exports the same fixture — would add indirection while leaving the data just as
static, and would make the wiring look finished when it is not. The remaining views
are honest, read-only fixture renderers today.

### Boundary rules currently enforced

- No view imports `localStorage`, `fetch`, an HTTP URL, or `ACADEMY_NOW`
  — asserted by `src/__tests__/architectureBoundaries.test.ts`.
- `demoStore` is imported only by `src/domains/**` and `src/services/**`.
- Untrusted JSON (`localStorage`, imported backups) is stripped of
  `__proto__` / `constructor` / `prototype` before use, and command-palette
  recents are validated field-by-field rather than cast.
