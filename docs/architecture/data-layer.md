# Data layer — Phase A (API/Domain Foundation)

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

## How the Students migration will work

1. `Students.tsx` replaces `import { students } from "@/data/records"` with
   `useStudentList(params)` from `@/domains/students`.
2. Existing filter state (status / instrument / search) is passed as `StudentListParams`;
   the current in-component filtering is deleted, not reimplemented.
3. Loading/error branches reuse the existing `LoadingState` / `EmptyState` components —
   no visual change.
4. Flipping `VITE_DATA_SOURCE=api` then switches the same view to the real backend.

## Domain model rules (enforced by naming, not shortcuts)

```
Organization → Users(Roles/Permissions), Students, Teachers, Rooms, Classes
Student → Enrollment → Class → Session → Attendance
```

`Student ≠ Enrollment ≠ Class ≠ Session`. `Student.teacherId` in the demo dataset is a
denormalized display field and is **not** the authoritative relationship; enrollments own
Student ↔ Class over time.

## Intentionally NOT implemented in Phase A

Backend of any kind (no Laravel involvement), auth flow, permission enforcement,
all domains other than Students (folders carry contract sketches only), scheduling
conflict detection / recurrence, uploads, server-side reports, `/search`, realtime,
audit log, and any view refactor — `Students.tsx` still reads `@/data/records` and is
unchanged in this task.

## Next task

*Migrate the Students view from direct DemoStore/records usage to `StudentRepository`,
preserving the exact existing UI and demo behaviour.*

## Migration status (verified by inspection, not by intent)

`Student` is the reference migration: `StudentsView` reads exclusively through
`useStudentList()` → `StudentRepository` → `DemoStudentRepository | ApiStudentRepository`.
It has no `students` fixture import, derives its stat counts from loaded data, and
renders real loading / error / not-found states. Regression coverage lives in
`src/views/__tests__/Students.test.tsx`, which asserts that fixture records do **not**
appear when the repository returns something else.

| View / component | Status | Reads from |
|---|---|---|
| Students | **IMPLEMENTED** | `useStudentList` → repository |
| Settings → Users & Roles | **IMPLEMENTED** | `useUsers` → `UserRepository` |
| Settings → Demo data | **IMPLEMENTED** | `useDemoData` → `demoDataManager` |
| Login / auth | **IMPLEMENTED** | `useAuth` → `AuthRepository` |
| Teachers, Classes, Scheduling, Attendance, Finance, Messages, Library, Reports, Dashboard | **PARTIAL** | static `@/data/records` + `@/data/academy` |
| Rooms (Settings), Command Palette, Notifications | **PARTIAL** | static fixtures |

### Why the rest were not migrated in this phase

Each remaining view needs its own domain contract (Teacher, Class, Session,
Attendance, Invoice, Conversation, Resource) plus demo *and* API implementations
and tests. Doing that mechanically — pointing views at a repository that merely
re-exports the same fixture — would add indirection while leaving the data just as
static, and would make the wiring look finished when it is not. The remaining views
are honest, read-only fixture renderers today.

### Boundary rules currently enforced

- No view imports `localStorage`, `fetch`, or an HTTP URL.
- `demoStore` is imported only by `src/domains/**` and `src/services/**`.
- Untrusted JSON (`localStorage`, imported backups) is stripped of
  `__proto__` / `constructor` / `prototype` before use, and command-palette
  recents are validated field-by-field rather than cast.
