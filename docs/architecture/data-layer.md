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
| Messages (chat) | **IMPLEMENTED** | `useConversations` / `useMessages` → `ChatRepository` |
| Settings → Academy identity | **IMPLEMENTED** | `useBranding` → `BrandingRepository` |
| Settings → Instruments | **IMPLEMENTED** | `useInstruments` → `InstrumentRepository` |
| Settings → Programs & levels | **IMPLEMENTED** | `usePrograms` / `useLevels` → `LearningRepository` |
| Settings → Gallery | **IMPLEMENTED** | `useAlbums` → `GalleryRepository` + `MediaRepository` |
| Student → learning path | **IMPLEMENTED** | `useStudentPlacement` / `useEligibleContent` |
| Library (audio playback) | **PARTIAL** | fixture metadata; player real, no seeded audio |
| Scheduling, Attendance, Finance, Reports | **PARTIAL** | static `@/data/records` + `@/data/academy` |
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


## Profiles, learning and media (this phase)

Six domains were added: `instruments`, `learning`, `chat`, `media`, `branding`,
`gallery`.

### These six resolve to Demo in BOTH modes

No server implements them yet. Rather than let production silently fall back to
demo data (§37), `registry.ts` returns the Demo implementation in both modes and
documents that at the getter. The interface boundary is already in place, so
adding an API implementation later is a one-line registry change per domain and
touches no UI.

### Instruments are data, not a union

The closed union `Instrument = "piano" | "guitar" | …` and its exhaustive
`instrumentLabel` map are **removed**. Instruments are rows owned by
`InstrumentRepository`, so an academy can define its own.

**Single source of truth.** `src/domains/instruments/catalog.ts` holds the six
seeded definitions and a synchronous, read-through projection of the
instruments collection. Fields that reference an instrument are typed
`InstrumentId` (a string alias) and hold an `InstrumentRecord.id`.

Why a projection exists at all: the repository is async, but ~60 call sites
need a Persian label *while rendering* a table cell, a CSV row or a search
result. `instrumentName(id)` serves those. It is not a second state store —
the repository remains the only writer, the cache is a projection of exactly
one collection, and it is refreshed by `useInstrumentCatalogSync()` (mounted
once in `App`) on every `dataVersion` bump, plus directly by the demo data
manager after a reset/restore/import so a CSV written immediately after a
restore cannot carry stale names.

| Need | Use |
|---|---|
| A label while rendering or in a service | `instrumentName(id)` |
| A list (pickers, filter chips), re-rendering on change | `useInstrumentCatalog()` |
| Full CRUD | `useInstruments()` → `InstrumentRepository` |

**The six seeded instruments keep their historical ids** (`piano`, `violin`, …)
because every existing record, every saved backup and every previously
exported CSV stores those exact strings. `catalog.test.ts` asserts this.

**Fallback behaviour.** `instrumentName()` returns the id itself for an unknown
instrument and `—` for a missing one, so a record pointing at a deleted
instrument degrades to a readable token rather than rendering `undefined` mid
table. `InstrumentGlyph` falls back to a generic music note for
academy-defined instruments.

Deactivating an instrument removes it from pickers but keeps it selectable on
records that already use it, so saving an unrelated field cannot silently
change a student's instrument. An instrument that is still referenced cannot
be deleted (`INSTRUMENT_IN_USE`).

`organization.instruments` — a second copy of the list on the settings object —
was deleted as part of this change; it had no readers and was pure drift risk.

Because the compiler can no longer catch a bad instrument reference, an
`architectureBoundaries` check fails the build if a union, an `instrumentLabel`
map, a `Record<Instrument, …>` or an inline `["piano", "guitar", …]` list is
reintroduced.

### Learning is one repository

Programs, levels, level↔content links and student placements live in a single
repository because the invariants span all four: contiguous level ordering, no
deleting a level that still has students or content, and placements that must
reference a level belonging to their own program.

**Eligibility is derived, never stored.** A student sees content attached to any
active level of their program with `order <= currentLevel.order`; a level marked
`exclusive` restricts its content to students placed exactly there. No placement
means an empty set — never a fallback to "show everything". Because the student
page and the content list read the same derived function, moving a student
between levels changes their access immediately with no separate bookkeeping.

### Media: metadata in the dataset, bytes in IndexedDB

`DemoStore` holds only media *metadata*; the bytes go to IndexedDB
(`ava:media` / `blobs`). This keeps the JSON dataset (and every backup and
export) free of megabytes of base64.

Consequences that are surfaced in the UI rather than hidden:

- Uploaded files live in one browser only and do **not** travel in backups.
  After restoring a backup, metadata resolves but `getBlob()` returns
  `undefined`, and the gallery renders "file not available in this browser".
- Validation is an allow-list of MIME types **cross-checked against magic
  bytes**, plus per-kind size caps (image 5 MB, audio 25 MB, document 20 MB).
  SVG is excluded because it can carry script. Filenames are sanitized against
  path traversal, control characters and leading dots.
- If the blob write fails, the metadata row is rolled back, so no record ever
  points at bytes that were never stored.

**BACKEND REQUIRED:** signed upload URLs, server-side re-validation, virus
scanning, and a real object store. Client-side checks are a UX filter, not a
security boundary.

### Audio playback never decodes

`AudioMessagePlayer` renders its waveform from stored `peaks`, or from a
deterministic id-seeded placeholder when none exist. It never calls
`decodeAudioData` (which would need the whole file in memory and block the main
thread), uses `timeupdate` rather than a `requestAnimationFrame` loop, and draws
48 `<div>` bars instead of a canvas so it reflows correctly in RTL and exposes a
real `role="slider"` with arrow-key seeking (mirrored for RTL).

The demo ships no audio binaries, so in the Library the player renders disabled
with a stated reason instead of animating a waveform that plays nothing.

### Chat delivery honesty

Only `in_app` messages actually deliver, and only those are marked `sent`.
Telegram / Bale / SMS / email have no server, so messages on those transports
are stored with status `unavailable` plus a Persian reason and rendered with a
visible "ارسال نشد" marker. The message is still recorded — nothing is
silently dropped, and nothing claims a send that did not happen.

**Bot tokens must never reach `VITE_*`** — anything in a Vite env var is
compiled into the client bundle and is public. Telegram/Bale integration
requires a server-side webhook relay.

### Branding

Branding is a singleton inside the dataset, so it travels in backups and is
restored by `createEmptyDataset()`. It is distinct from the per-browser `ava:*`
viewer preferences (theme, density, motion), which are personal and stay in
`localStorage`.

Colours are validated strictly as `#RRGGBB` and fonts against an allow-list,
because these values are written into CSS custom properties.
`applyBranding()` re-validates before touching the DOM, so a backup predating a
validation rule still cannot inject a CSS expression.

## Learning and student progress

Two domains, deliberately separate:

- **`learning`** — curriculum: programs, levels, content, eligibility. Mostly
  static, edited by administrators, bounded in size.
- **`progress`** — what a student is actually doing: pieces, assignments,
  practice events, analytics. High-churn, append-mostly, grows without bound.

Splitting them matters because a progress history grows forever while a
curriculum does not, and because a **piece is not learning content**.

### Piece vs LearningContent

A `LearningContent` is a *resource* (a PDF method book, a backing track). A
`Piece` is a *musical work* a student learns and performs. One piece may have
several contents; a scale-exercise sheet belongs to no piece. Progress is
tracked against the piece, never against the PDF — "mastery of a PDF" is not a
meaningful sentence.

### Progress events are append-only

`ProgressEvent` is the authoritative record. Nothing edits or deletes an event
in normal operation: correcting a mistake appends a new observation. Every
analytic, chart and recommendation is computed from this log, so a chart can
never silently change shape.

`PieceAssignment.latest` is a **denormalized snapshot** of the newest event,
recomputed on every append. It exists so listing twenty assignments does not
need twenty history scans, and it is always rebuildable from the log. It is
derived from the newest event *by timestamp*, so a back-dated entry cannot make
the snapshot disagree with the history.

Deleting an assignment that has events is refused (`ASSIGNMENT_HAS_HISTORY`);
close it instead. Deleting an assigned piece is refused (`PIECE_IN_USE`).

### Range units

Pieces are subdivided differently: a sonata in `measure`s, a recording in
`timestamp`s, drum rudiments in `freeform`. The unit is chosen per piece, and
the repository enforces the matching shape — a free-form piece rejects numeric
ranges and requires a label, and vice versa. Changing a piece's unit later is
allowed but warned about: past numbers were recorded in the old unit.

### Analytics — every definition is explicit

`analytics.ts` is pure arithmetic over a loaded event list. An undocumented
metric is worse than no metric, because people act on it.

| Metric | Definition |
|---|---|
| Learning velocity | `(latest mastery − first mastery) / span days × 7`, in points/week. `null` under two events or a zero-day span. |
| Tempo change | latest BPM − first BPM, across events that carry a tempo. |
| Tempo target % | latest ÷ target, capped at 100. |
| Practice consistency | distinct days with an event ÷ weeks elapsed. |
| Days at level | from the current placement's effective date. |
| Average days per level | mean gap between consecutive placement changes. |

`null` is used — never `0` — where a value is unknown, so "no tempo recorded"
and "tempo did not change" stay distinguishable.

### Plateau detection

Flagged only when **all four** hold: the same range repeats for N trailing
events, over at least M elapsed days, with mastery flat within a band and tempo
flat within a band. Thresholds live in `DEFAULT_THRESHOLDS` and are a parameter,
not a constant.

The status is `possible_plateau`, never "stuck". The data can show that nothing
measurable changed; it cannot show why, and a student may be consolidating.
Regression is checked *before* plateau, because losing ground is more urgent.

Statuses: `improving`, `stable`, `slowing`, `possible_plateau`, `regression`,
`insufficient_data`. Each insight carries the evidence that produced it.

### Recommendations — deterministic, before any AI

`recommendations.ts` maps an insight to concrete advice with a stated reason
built from the actual numbers ("۳ جلسهٔ متوالی روی ۳۷–۴۲…"). Rules encode
ordinary pedagogy: slow down, isolate the passage, revisit prerequisites,
extend the range, escalate to the teacher.

Two properties are tested: a recommendation always explains itself, and
**suggested content is always drawn from `resolveEligibleContent`** — advice
can never surface material the student may not open.

Silence is a valid output. Padding the panel with filler would train people to
ignore it.

**AI is deliberately not implemented in this phase.** This layer exists so a
model can later narrate structured facts instead of being asked to invent
clinical judgements from raw rows. AI must never compute a statistic that code
can compute reliably.

### Eligibility additions

`LearningContent.visibility` (`students` | `teachers`) is now enforced inside
`resolveEligibleContent`. The `audience` parameter defaults to `students` — the
safer default, so a caller that forgets it cannot leak teacher-only material.

### Placement history

`PlacementHistoryEntry` records **both ends** of a move (`levelId` →
`toLevelId`) plus an optional `effectiveDate` distinct from `changedAt`, so a
promotion can be back-dated to the exam date. History is append-only; level
reordering does not rewrite it.

`prerequisiteLevelIds` on a level is **advisory, not enforced** — a transferring
student may legitimately start at level 5.

### Profile photos

`Student.photoMediaId` / `Teacher.photoMediaId` hold a `MediaAsset.id`, never a
data URL. Upload, replace and delete go through the existing media abstraction
(validation + IndexedDB), and replacing a photo frees the previous blob. Object
URLs are revoked by `useMediaObjectUrl` on unmount and on every id change.

### Status

| Capability | Status |
|---|---|
| Programs, levels, reorder, placement + history | **IMPLEMENTED** |
| Content, eligibility, visibility | **IMPLEMENTED** |
| Pieces, assignments, range/tempo/mastery, event log | **IMPLEMENTED** |
| Analytics, plateau, recommendations | **IMPLEMENTED (deterministic)** |
| Teacher + student progress workflows | **IMPLEMENTED** |
| Profile photos | **DEMO ONLY** (per-browser, excluded from backups) |
| `ApiProgressRepository` | **CONTRACT ONLY** — compiles, no server serves it |
| AI narration | **NOT IMPLEMENTED** (deliberate; data model first) |
| Browser QA | **NOT VERIFIED** — no browser automation available |
