# scheduling

**Implemented, registered and protected — the *view* is not wired to it.**

The domain below is real code with real tests: a session model, a repository contract, two pure
engines (generation, conflicts), a calendar bridge, a demo implementation, an unregistered REST
implementation and a read layer. What is *not* true is that anyone can see it: `src/views/Scheduling.tsx`
still renders the legacy fixtures in `src/data/records.ts`, and no shipped surface reads this domain
today. That gap is **H1a**, scheduled as **M4** — see
[docs/engineering/OPEN_ITEMS.md](../../../docs/engineering/OPEN_ITEMS.md) and
[docs/engineering/PRODUCT_PHASE_SPECIFICATION.md](../../../docs/engineering/PRODUCT_PHASE_SPECIFICATION.md).

This file describes the domain as it is, not as it was planned. Where a contract does not exist, that
is said explicitly.

---

## 1. The three concepts — do not collapse them

`types.ts` carries the authoritative rationale in its header comment; in one paragraph:

| Concept | What it is | Where it lives |
|---|---|---|
| **CLASS** | the offering: title, teacher, room, capacity, tuition | `AcademyClass`, owned by the classes domain |
| **RECURRENCE** | "Sunday and Tuesday at 17:00 for 90 minutes" | `class.days` / `class.time` / `class.duration` — this domain **reads** those fields and never writes them; no separate `RecurrenceRule` entity exists |
| **SESSION** | one real, dated occurrence: "Tue 2026-09-15, 17:00–18:30, room r1" | `Session` in `types.ts` — the entity this domain owns |

A session is **materialized**, not computed on demand, because it carries per-occurrence state a
derived value cannot hold: cancellation with a reason, a substitute teacher, a one-off room change, a
reschedule link, and the attendance records that hang off it.

Three things are **deliberately absent** from `Session`, and adding them is a regression:

- **no `students[]`** — the roster is derived from active `Enrollment` scoped to the session's date, so
  a student who joins in week 6 never appears on week 2 and one who withdraws in week 8 still appears
  on weeks 1–7;
- **no `conflictWith`** — conflicts are derived by `conflicts.ts`. The legacy fixture stored them by
  hand, which meant they could not react to a reschedule;
- **no attendance summary** — `attendanceAvg` is a derived projection owned by the attendance domain.

## 2. Files

| File | Responsibility |
|---|---|
| `types.ts` | `Session`, `SessionListParams`, the input shapes, `SESSION_ERRORS`, the conflict and generation-plan types, the caps (`MAX_GENERATION_DAYS = 180`, `MAX_GENERATION_SESSIONS = 500`) |
| `repository.ts` | the `SchedulingRepository` interface — the contract both implementations satisfy |
| `demoRepository.ts` | the implementation in use. Every domain invariant lives here, never in a view |
| `apiRepository.ts` | a REST implementation that compiles against the same interface. **Deliberately NOT registered** — see §7 |
| `generation.ts` | pure, bounded, idempotent planning: `planGeneration`, `deterministicSessionId`, `exceedsSessionCap` |
| `conflicts.ts` | pure conflict detection with a date index, so a check inspects one day rather than the whole academy |
| `dateBridge.ts` | pure calendar/clock helpers on `YYYY-MM-DD` strings, plus `weekdayIndex` for the Saturday-first Iranian week and `jalaliToIso` |
| `useScheduling.ts` | the read layer: `useSessions`, `useSessionRoster`, `useGenerationPreview`, `useConflictCheck`, over one internal `useDerivedRead` |
| `__tests__/` | six **Group A** files (211 tests, frozen) plus `useDerivedRead.test.tsx` (9 tests, not Group A) |

`generation.ts`, `conflicts.ts` and `dateBridge.ts` are pure: no storage, no repository, no network,
no ambient clock and no UI dependency. "Today" is always an argument, which is what makes them
deterministic under test and usable unchanged by a future server-side implementation.

Resolution happens in `src/domains/registry.ts:197` (`getSchedulingRepository`), which returns the demo
implementation **in both demo and api mode**, constructed with an injected attendance-presence
provider. That provider is the scheduling ↔ attendance boundary: a function returning the ids of
sessions that have marks, built in the registry so this domain never imports the attendance
implementation and the dependency stays one-directional. It fails **safe** — when presence cannot be
determined it answers `undefined`, which the repository treats as "attendance may exist" and refuses
the operation.

## 3. The contract is verbs, not field writes

`cancelSession` and `rescheduleSession` exist as verbs rather than as `update({ status })` or
`update({ date })` because each carries an invariant a caller must not be able to bypass:

- a **cancellation** always records a reason (`SESSION_CANCEL_REASON_REQUIRED` otherwise);
- a **reschedule** always cancels the original and creates a *linked* replacement — the original keeps
  `rescheduledToId`, the replacement keeps `rescheduledFromId`. Mutating a date in place would destroy
  the record that the session ever existed at the original time, which is exactly what a parent
  disputes.

Full verb list: `list`, `get`, `create`, `update`, `cancelSession`, `rescheduleSession`, `delete`,
`previewGeneration`, `generateSessions`, `checkConflicts`, `sessionRoster`.

`create` is always `origin: "manual"`; `update` marks the session `manual` so bulk generation will
never overwrite a hand edit. `delete` is a hard delete and is refused when any attendance record
exists.

Errors are typed values, not thrown strings — `SESSION_ERRORS` in `types.ts`:
`SESSION_NOT_FOUND`, `SESSION_INVALID`, `SESSION_CLASS_NOT_FOUND`, `SESSION_CLASS_ARCHIVED`,
`SESSION_HAS_ATTENDANCE`, `SESSION_ALREADY_CANCELLED`, `SESSION_CANCEL_REASON_REQUIRED`,
`SESSION_CONFLICT`, `SESSION_WARNINGS_UNACKNOWLEDGED`, `SESSION_GENERATION_WINDOW_INVALID`.

## 4. Protection invariants (enforced in the repository, never in a view)

- a session with attendance recorded is never modified or deleted;
- a past session is never modified by generation;
- a cancelled session is never resurrected;
- a manually created or edited session is never overwritten by generation;
- a future *generated* session whose class recurrence changed is updated **only** when the caller
  passes `confirmUpdates`;
- an orphaned future session is **reported**, never silently deleted.

## 5. Generation: preview and commit are separate calls on purpose

`previewGeneration` computes the identical plan and **writes nothing**, so a surface can show
«۱۲ ایجاد · ۳ بدون تغییر · ۲ محافظت‌شده» before anyone commits. An implementation that writes during a
preview is a defect, not an optimisation.

Idempotency is **structural**, not a duplicate scan: a generated slot's id is derived from its content
(class, date, start time) by `deterministicSessionId`, so re-running over the same window computes the
same ids and recognises existing sessions by identity. Windows are bounded by
`MAX_GENERATION_DAYS` / `MAX_GENERATION_SESSIONS`, and `exceedsSessionCap` is what a caller checks
before asking for a plan.

## 6. Dates and the calendar

`date` is ISO-8601 `YYYY-MM-DD` (Gregorian); times are `HH:mm`, 24-hour, local academy time, with an
**exclusive** end (17:00–18:00 and 18:00–19:00 do not overlap). Sessions must be sorted, bucketed and
range-queried, and a Persian-digit display string cannot do any of that correctly — **Jalali is a
presentation concern, formatted at the UI edge**. `Enrollment.startDate` remains a Jalali display
string and is *not* migrated; `dateBridge.jalaliToIso` reads it where needed.

`dateBridge` works on date strings through UTC-noon anchors, so no helper depends on the machine's
timezone or on DST. `weekdayIndex` converts between the product's Saturday-first `WEEKDAYS` array
(`شنبه`) and JavaScript's Sunday-first `getDay()`.

## 7. What does **not** exist

- **No server.** `apiRepository.ts` compiles against the same interface and pins the REST contract a
  backend would have to honour (`GET|POST /api/v1/sessions`, `GET|PATCH|DELETE /api/v1/sessions/{id}`,
  `POST …/cancel`, `POST …/reschedule`, `POST /api/v1/sessions/generate?preview=1`,
  `POST …/check-conflicts`, `GET …/{id}/roster`), but **no server implements those endpoints and the
  class is deliberately not registered** — wiring it would turn every call into a failing request
  presented as a feature. Nothing in this directory is production-ready against a real backend, and
  the server-side obligations (re-running conflict detection inside the write transaction with unique
  constraints on room and teacher, keeping `?preview=1` strictly read-only, enforcing every protection
  rule server-side) are recorded in that file's header and in `docs/production-handoff.md`.
- **No write binding in the read layer.** `useScheduling.ts` exposes four *reads* — `useSessions`,
  `useSessionRoster`, `useGenerationPreview`, `useConflictCheck`. There is **no** hook for `create`,
  `update`, `cancelSession`, `rescheduleSession`, `delete` or `generateSessions`; the repository has
  the verbs, the UI layer does not bind them yet. Whoever adds them inherits M2's rule: a success
  message follows an awaited repository call that actually wrote, and a failure is reported as a
  failure — never as an empty state.
- **No pager component.** Lists are read with an explicit `per_page` ceiling and no pagination UI, so a
  read that means "everything" silently stops at that ceiling (**I16**). `useSessions` takes
  `Paged<SessionListParams>`, which makes *stating* a ceiling a compile-time requirement; it says
  nothing about the ceiling being high enough. A calendar is the surface where a silent ceiling is most
  dangerous, so any consumer of this domain is expected to bound its reads with an explicit
  `from`/`to` window, size `per_page` above the window's plausible maximum rather than above today's
  data, read `Page.meta.total`, and say so when `items.length < total`.
- **No stored roster, no stored conflicts, no stored occupancy.** See §1.

## 8. Tests, and what is frozen

**Group A** — `conflicts.test.ts`, `dateBridge.test.ts`, `demoRepository.test.ts`, `generation.test.ts`,
`registry.test.ts`, `useScheduling.test.tsx`: **211 tests** pinning the model, the engines, the
repository invariants and the Jalali bridge. Group A is **frozen**: changing it is a regression, not a
refactor, and new cases go in new files.

`useDerivedRead.test.tsx` (9 tests) sits in the same directory but is **not** Group A. It pins I13's
**Checkpoint 3B** (`fba826f`): `useDerivedRead` carries the query key it answers and derives what it
exposes at render, so a session switch cannot expose the previous session's roster, plan or conflict
report as if it were the new one's. It is no less off-limits than Group A — weakening it would
re-open a fixed exposure — and **M4 is what makes those three readers reachable in shipped UI**, which
is why the checkpoint landed before the milestone rather than inside it.

## 9. The legacy fixtures this domain replaces (and what M4 must not silently keep)

`src/data/records.ts` still holds `weekSessions`, `rooms`, `TODAY_INDEX` and the `GridSession` shape,
and `src/views/Scheduling.tsx:5` imports them. The shapes are **not** the domain's:

| Fixture field | Domain equivalent |
|---|---|
| `s.day` (a weekday index) + `s.start` / `s.end` (minutes) | `date` (`YYYY-MM-DD`) + `startTime` / `endTime` (`HH:mm`) — `dateBridge` converts, and `weekdayIndex` maps to the Saturday-first week |
| `s.conflictWith` (hand-stored, read at `src/views/Scheduling.tsx:97`) | nothing — conflicts are derived by `checkConflicts` / `conflicts.ts`, so they react to a move or a cancellation |
| `s.cancelled` (a boolean) | `status: "scheduled" \| "cancelled" \| "completed"` plus a required `cancelReason` |
| `rooms[].occupancy`, `attendanceAvg` | not this domain's to redefine — `Room.occupancy` semantics are unchanged by M4, and the attendance projection stays where it is |

M4 stops this *view* from reading the fixtures. It does **not** delete the fixture collections: other
surfaces still read them, and their fate is a separate decision (**D5**, to be recorded at **M10** and
known from M4 onward) under which `src/data/records.ts` is *split by role* — entity types to their
owning domains, the canonical DEMO seed under `src/domains/demo/`, and only the third role, fake data
for unwired views, deleted once M4–M9 have removed every reader. M4 also does not redesign this
domain: the model, the engines, the repository and Group A stay exactly as they are.

## 10. Where the authoritative state lives

- [docs/engineering/PROJECT_STATE.md](../../../docs/engineering/PROJECT_STATE.md) — current phase, checkpoints, validation evidence, browser-QA status (NOT VERIFIED for every milestone).
- [docs/engineering/OPEN_ITEMS.md](../../../docs/engineering/OPEN_ITEMS.md) — **H1** (this view renders fixtures), **I13** (Checkpoints 1, 2, 3A, 3B landed; three hand-rolled readers remain), **I14**, **I16**.
- [docs/engineering/DECISIONS.md](../../../docs/engineering/DECISIONS.md) — §11 (CLASS vs RECURRENCE vs SESSION), §10 (domain boundaries), §15 (honesty rules).
- [docs/engineering/PRODUCT_PHASE_SPECIFICATION.md](../../../docs/engineering/PRODUCT_PHASE_SPECIFICATION.md) — the **M4** milestone: scope, protected areas, demo/api behaviour, tests, acceptance, out-of-scope and its rollback boundary.
