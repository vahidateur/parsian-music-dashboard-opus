# scheduling

**Implemented, registered, protected — and wired: `src/views/Scheduling.tsx` reads and writes this
domain (M4, 2026-09-14).**

The domain below is real code with real tests: a session model, a repository contract, two pure
engines (generation, conflicts), a calendar bridge, a demo implementation, an unregistered REST
implementation and a read layer. **M4 closed the gap that used to be recorded here** — the view no
longer renders the legacy fixtures in `src/data/records.ts`; it reads `Session` rows through
`useSessions` for a bounded date window and writes through `rescheduleSession`, `cancelSession` and
`generateSessions`. **H1a is closed.** What is still true: five of this domain's eleven verbs have no
shipped caller (§3), and **browser QA has never run**. M4 changed **no file in this directory except
this README** — the model, the engines, the repository, the hooks and Group A are exactly as they were.

**Two of those three "still true" claims were falsified by M5 (2026-09-14) and are corrected here
rather than left to mislead.** **H1 is now closed on both halves:** M5 wired
`src/views/Attendance.tsx` to the attendance domain at
`9505ade4011b37a34e3488fd51206512829205ec`, so **H1b** is closed and the umbrella item with it. And a
roster **is** now rendered in shipped UI — but **not by this domain**: M5 derives it through
attendance's own `useSessionAttendance`, which joins the roster resolved from active Enrollment with
the marks that exist in one repository pass, instead of consuming this domain's `sessionRoster` verb.
So `sessionRoster` and the `useSessionRoster` hook behind it are **still unconsumed and now belong to
no milestone** (§3, §8), the verb count in §3 is unchanged at five, and that choice is registered as
**D13** in [docs/engineering/DECISIONS.md](../../../docs/engineering/DECISIONS.md). **M5 changed no
file in this directory at all** — `git diff --name-only 24caf3a..9505ade` lists nothing under
`src/domains/`, this README included; the corrections you are reading were made by the documentation
pass that follows the milestone. See
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

### Which verbs shipped UI calls, and which it does not

M4 wired **six** of the eleven: `list` (through `useSessions`), `checkConflicts` (through
`useConflictCheck`), `previewGeneration` (through `useGenerationPreview`), and `rescheduleSession`,
`cancelSession` and `generateSessions` as awaited direct calls on `getSchedulingRepository()`. There
are **no write hooks** — the read layer stays read-only, and the view calls the verbs itself, which is
what keeps every invariant in this directory.

The other **five** have no shipped caller, each for a reason that is a decision rather than an
omission:

| Verb | Why nothing calls it |
|---|---|
| `get` | The selected session is **derived** from the page already loaded — `sessions.items.find(id)` at `src/views/Scheduling.tsx:353` — never fetched by id. A second read for a row the list already holds would reintroduce exactly the frame the derivation removes: a stale `Session` in state that a write could target after the window moved (DECISIONS **D11**, and `src/views/__tests__/schedulingStaleWindow.test.tsx`) |
| `create` | M4's writes are the operations this domain already guards. A generic create in the UI would offer a path around `rescheduleSession`'s linked-replacement rule and `generateSessions`' idempotency, and no hand-made-session need was authorized |
| `update` | The same reason, sharper: `update` marks a session `manual`, so exposing it would let an operator edit a generated session out from under the generation engine's protections. `RescheduleInput` and `cancelSession` cover the two edits the product decided to allow |
| `delete` | Excluded by **E-2**, the clause of M4's own authorization that keeps a hard delete out of the UI (applied at `src/views/Scheduling.tsx:45` and `src/views/scheduling/GenerateSessionsDialog.tsx:35`). Cancellation *is* this domain's destructive operation, because a hard delete destroys the record that a session ever existed — which is exactly what a parent disputes. `delete` stays a contract a backend may need and the UI must not offer |
| `sessionRoster` | **Deferred to M5 — and M5 landed without taking it (2026-09-14).** The attendance view derives its register through its own domain's `sessionAttendance` (`useSessionAttendance`), which already joins the Enrollment-derived roster with the marks in one pass, so consuming this verb too would put a second roster in shipped UI for the view to reconcile — and a view that reconciles two rosters can disagree with both. The reasoning is registered as **D13**. `useSessionRoster` remains key-carrying (I13 Checkpoint 3B) and unconsumed, so **this verb now belongs to no milestone**; it is not a gap M6 inherits by default |

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
  `update`, `cancelSession`, `rescheduleSession`, `delete` or `generateSessions`. **Since M4 the UI
  calls three of those verbs directly** — `cancelSession`, `rescheduleSession` and `generateSessions`,
  awaited, on `getSchedulingRepository()` — and inherits M2's rule in full: a success message follows
  an awaited repository call that actually wrote, and a failure is reported in `danger` with the
  repository's own sentence (`apiErrorFromThrown(cause).message`), never as an empty state. The
  remaining verbs are unconsumed for the reasons in §3. Whoever adds a write *hook* later inherits the
  same rule, plus this one: a hook must not own an invariant the repository already owns.
- **No pager component.** Lists are read with an explicit `per_page` ceiling and no pagination UI, so a
  read that means "everything" silently stops at that ceiling (**I16**). `useSessions` takes
  `Paged<SessionListParams>`, which makes *stating* a ceiling a compile-time requirement; it says
  nothing about the ceiling being high enough. A calendar is the surface where a silent ceiling is most
  dangerous, so any consumer of this domain is expected to bound its reads with an explicit
  `from`/`to` window, size `per_page` above the window's plausible maximum rather than above today's
  data, read `Page.meta.total`, and say so when `items.length < total`. **The shipped calendar does all
  four (M4):** the window comes from the mode the operator chose (`src/views/Scheduling.tsx:311`), the
  ceilings are named constants (`:116` sessions, `:117` the classes/rooms/teachers supporting reads),
  the counts come from `total` (`:458`), a truncated page says so in its own words (`:563`) and its
  per-day counts are withheld while that notice stands (`:711`) — a partial answer is never dressed as
  a complete one. **I16 is still open:** the ceiling is still 200 and the rest of the product is
  unchanged.
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
re-open a fixed exposure — and **M4 was what made those readers reachable in shipped UI**, which is
why the checkpoint landed before the milestone rather than inside it. It has now landed, so the fix is
live on a real path for two of the three: `useConflictCheck` in
`src/views/scheduling/SessionWriteDialogs.tsx` and `useGenerationPreview` in
`src/views/scheduling/GenerateSessionsDialog.tsx`. `useSessionRoster` is still unconsumed — **and M5
did not consume it**: the attendance view derives its register through attendance's own
`useSessionAttendance` instead (**D13**), so this hook now belongs to no milestone. It stays
key-carrying and off-limits to weakening all the same, because the fix it carries is what makes the
other two readers safe on their real paths.

## 9. The legacy fixtures this domain replaced (and what M4 did not silently keep)

`src/data/records.ts` still holds `weekSessions`, `rooms`, `TODAY_INDEX` and the `GridSession` shape;
**`src/views/Scheduling.tsx` no longer imports any of them** (M4 / CP1), and `src/views/Classes.tsx` is
now the view that does. The shapes were never the domain's:

| Fixture field | Domain equivalent |
|---|---|
| `s.day` (a weekday index) + `s.start` / `s.end` (minutes) | `date` (`YYYY-MM-DD`) + `startTime` / `endTime` (`HH:mm`) — `dateBridge` converts, and `weekdayIndex` maps to the Saturday-first week |
| `s.conflictWith` (hand-stored in the fixture, and read by the pre-M4 view) | nothing — conflicts are derived by `checkConflicts` / `conflicts.ts`, so they react to a move or a cancellation. The shipped view asks `useConflictCheck` |
| `s.cancelled` (a boolean) | `status: "scheduled" \| "cancelled" \| "completed"` plus a required `cancelReason` |
| `rooms[].occupancy`, `attendanceAvg` | not this domain's to redefine — `Room.occupancy` semantics are unchanged by M4, and the attendance projection stays where it is |

**M4 stopped this *view* from reading the fixtures. It did not delete the fixture collections:**
`src/views/Classes.tsx` still reads them — **`src/views/Attendance.tsx` no longer does, as of M5**
(`9505ade4011b37a34e3488fd51206512829205ec`), and the only shipped reader of the *attendance* fixtures
left anywhere is `src/views/Reports.tsx:143`, which renders `attendanceByDay`. Their fate is a separate
decision (**D5**, to be recorded at **M10** and known from M4 onward) under which
`src/data/records.ts` is *split by role* — entity types to their owning domains, the canonical DEMO
seed under `src/domains/demo/`, and only the third role, fake data for unwired views, deleted once
M4–M9 have removed every reader. **M4 also did not redesign this domain:** the model, the engines, the
repository, the hooks and Group A are byte-identical to what they were at
`7e72887761f07f48e115160611a9785bfaae9060`.

## 10. Where the authoritative state lives

- [docs/engineering/PROJECT_STATE.md](../../../docs/engineering/PROJECT_STATE.md) — current phase, checkpoints, validation evidence, browser-QA status (NOT VERIFIED for every milestone).
- [docs/engineering/OPEN_ITEMS.md](../../../docs/engineering/OPEN_ITEMS.md) — **H1** (✅ **closed on both halves**: H1a, this view, by M4; H1b, attendance, by M5), **I13** (Checkpoints 1, 2, 3A, 3B landed; three hand-rolled readers remain), **I14**, **I16** (this domain's calendar mitigation implemented, the item still open).
- [docs/engineering/DECISIONS.md](../../../docs/engineering/DECISIONS.md) — §11 (CLASS vs RECURRENCE vs SESSION — with M5's correction that a roster is now rendered, just not by
this domain), §10 (domain boundaries), §12 (attendance and progress are append-only — in front of users
since M5), §15 (honesty rules) and **D13** (a wired view derives its own selection and renders the
register its own domain derives, which is why `sessionRoster` went unconsumed).
- [docs/engineering/PRODUCT_PHASE_SPECIFICATION.md](../../../docs/engineering/PRODUCT_PHASE_SPECIFICATION.md) — the **M4** and **M5** milestones (scope, protected areas, demo/api behaviour, tests, acceptance, out-of-scope, rollback boundary) with its **LANDED** record at the end of that section, and the **M5** milestone that follows it.
