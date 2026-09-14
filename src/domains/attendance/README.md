# attendance

**Implemented, registered, protected — and wired: `src/views/Attendance.tsx` reads and writes this
domain (M5, 2026-09-14).**

The domain below is real code with real tests: an append-only record model, a roster derived from
Enrollment, a repository contract, a demo implementation, an unregistered REST implementation and a
read layer. It has existed since **Phase A** (`2acca0a`, before the recorded baseline `292b8b8`) —
the stub this file replaced said "Planned domain — **not implemented in Phase A**", which was false
when it was written and is retired here rather than left to mislead the next reader. That is the
same defect **L3** named in the scheduling README, one directory over; M4's CP0 retired it there,
M5's documentation reconciliation retires it here.

**M5 closed the gap that used to be recorded here.** The view no longer renders `todayAttendance`,
`attendanceTrend` or `attendanceByDay` from `src/data/records.ts`; it reads a bounded window of real
sessions through `useSessions`, one derived register through `useSessionAttendance`, the window's
marks and absences through `useAttendanceRecords`, and the correction trail through
`useAttendanceCorrections` — and it writes through `record`, `bulkRecord` and `correct`. **H1b is
closed, and with it the umbrella item H1.**

What is still true, and is recorded rather than smoothed over: **two of this domain's eight verbs
have no shipped UI caller** (§3); `useSessionAttendance` **still does not carry its query key**
(**I13**, mitigated at the view boundary only, not fixed); no notification of any kind is sent
(**D1**, **I7**); there is **no un-record, no edit and no delete** of a mark, because the model is
append-only by design; and **browser QA has never run**.

**M5 changed no file in this directory at all.** Across `24caf3a..9505ade` nothing under
`src/domains/` differs — not the model, not the derived roster, not the repository, not the hooks,
not the 79 **Group D** tests, not even a README. This file is changed by the documentation pass that
*follows* the milestone, which is the only place that reconciliation lives.

This file describes the domain as it is, not as it was planned. Where a contract does not exist,
that is said explicitly.

---

## 1. The model — append-only marks over a derived roster

Three rules decide everything else in this directory:

- **A mark is never edited in place.** `record` writes one; `correct` changes one and appends an
  immutable `AttendanceCorrection` (`types.ts:142`) carrying the previous status, the new status, a
  required reason, the changing principal and a timestamp. There is no `update` and no `delete` verb
  (`repository.ts:16-22` states the reason in its own header): a bare update would let a disputed
  absence be rewritten with no trace.
- **The roster is derived, never stored.** `sessionAttendance` joins the roster resolved from active
  Enrollment at the session's date (`roster.ts:78`, `coversDate` at `:118`) with whatever marks
  exist, in one pass. A student who joined in week 6 or withdrew in week 8 is on the register
  exactly when the enrollment says so, and no session carries a `students[]` (DECISIONS §11).
- **A register is saved as one act.** `bulkRecord` is all-or-nothing: every entry is validated —
  roster membership, session state, duplicates — before any of them is written
  (`repository.ts:24-29`), so a teacher never ends up with half a register and no idea which half.

`SessionAttendance` (`types.ts:186`) is the shape a register screen needs: `sessionId`, the derived
`roster` of `RosterAttendance` rows (`:180`, where `record` is `undefined` for a student nobody has
marked — the "no row" rule surfaced to the UI instead of a placeholder), `recorded`, `expected` and
`locked` (true when the session is cancelled). Statuses are `present | absent | late | excused`
(`:47`), labelled by `ATTENDANCE_STATUS_LABEL` (`:49`), with `ATTENDED_STATUSES = [present, late]`
(`:70`) as the only aggregate-worthy pair.

## 2. Files

| File | Responsibility |
|---|---|
| `types.ts` | `AttendanceRecord`, `AttendanceCorrection`, the input shapes, the list params, `SessionAttendance` / `RosterAttendance`, the status label map and `ATTENDANCE_ERRORS` (`:202`) |
| `repository.ts` | the `AttendanceRepository` interface — the contract both implementations satisfy, with the no-update/no-delete, atomic-bulk and derived-roster rules in its header |
| `demoRepository.ts` | the implementation in use. Every invariant lives here, never in a view |
| `apiRepository.ts` | a REST implementation that compiles against the same interface. **Deliberately NOT registered** — see §7 |
| `roster.ts` | pure roster derivation: `resolveSessionRoster` (`:78`), `coversDate` (`:118`), `resolveRosterStudentIds` (`:136`) |
| `useAttendance.ts` | the read layer: `useAttendanceRecords` (`:36`), `useAttendanceCorrections` (`:52`), `useSessionAttendance` (`:80`) |
| `__tests__/` | three **Group D** files — `demoRepository.test.ts` (36), `roster.test.ts` (32), `useAttendance.test.tsx` (11) — **79 tests, frozen** |

Resolution happens in `src/domains/registry.ts:208` (`getAttendanceRepository`), which returns the
demo implementation **in both demo and api mode** (`:209`). The scheduling ↔ attendance boundary
also lives in the registry (`:223`, `attendancePresence`): scheduling is constructed with an
injected presence provider so it never imports this implementation and the dependency stays
one-directional. It fails **safe** — when presence cannot be determined it answers `undefined`,
which the scheduling repository treats as "attendance may exist" and refuses the destructive
operation.

## 3. The contract is verbs, not field writes

Full verb list (`repository.ts`): `list` (`:40`), `get` (`:41`), `record` (`:48`), `bulkRecord`
(`:51`), `correct` (`:57`), `listCorrections` (`:62`), `sessionAttendance` (`:70`),
`sessionIdsWithAttendance` (`:80`).

### Which verbs shipped UI calls, and which they do not

M5 wired **six** of the eight: `list` (through `useAttendanceRecords`, twice — once for the window's
marks and once filtered to `status: "absent"`), `sessionAttendance` (through `useSessionAttendance`),
`listCorrections` (through `useAttendanceCorrections`), and `record`, `bulkRecord` and `correct` as
awaited direct calls on `getAttendanceRepository()` (`src/views/Attendance.tsx:304`, `:349`, `:390`).
There are **no write hooks** — the read layer stays read-only, and the view calls the verbs itself,
which is what keeps every invariant in this directory. `list` also had a shipped caller before M5:
`src/domains/shared/useAcademyMetrics.ts:164` reads it for the dashboard's academy-wide rate, so
this domain was never quite "called by nothing but tests" — what was missing was the view that owns
it.

The other **two** have no shipped UI caller, each for a reason that is a decision rather than an
omission:

| Verb | Why nothing in the UI calls it |
|---|---|
| `get` | The register is read for the **derived** selected session, and the mark a correction targets is a row the register or the record list already holds. Fetching one record by id would add a second read for data already on screen, and a second copy a write could target after the window moved — the same reasoning DECISIONS **D11** records for scheduling |
| `sessionIdsWithAttendance` | This is the **cross-domain** boundary, not a UI read: it answers "which sessions have marks" so scheduling can refuse to destroy one. The shipped path reaches it through the registry's presence provider, which for the demo implementation calls the synchronous sibling `sessionIdsWithAttendanceSync` (`demoRepository.ts:255`, used at `registry.ts:227`). The async verb is the contract a backend must honour (`apiRepository.ts` maps it to `GET /api/v1/sessions/with-attendance`) and is exercised by Group D; no view needs it, and a view that fetched it would be duplicating a protection the repository already enforces |

Errors are typed values, not thrown strings — `ATTENDANCE_ERRORS` in `types.ts:202`:
`ATTENDANCE_NOT_FOUND`, `ATTENDANCE_INVALID`, `ATTENDANCE_SESSION_NOT_FOUND`,
`ATTENDANCE_SESSION_CANCELLED`, `ATTENDANCE_STUDENT_NOT_ON_ROSTER`, `ATTENDANCE_DUPLICATE`,
`ATTENDANCE_REASON_REQUIRED`, `ATTENDANCE_RECORDER_REQUIRED`. Each carries its own Persian sentence
from the demo repository («دلیل اصلاح الزامی است.» for a missing reason, «ثبت گروهی انجام نشد؛ هیچ
رکوردی ذخیره نشد.» for a refused bulk save), and the view reports that sentence verbatim rather than
paraphrasing it.

## 4. Invariants enforced in the repository, never in a view

- A cancelled session accepts no mark: `sessionAttendance` reports `locked: session.status ===
  "cancelled"` (`demoRepository.ts:234`) and a write against it is refused with
  `ATTENDANCE_SESSION_CANCELLED` (`:271`). **The protection stays domain-owned:** the view reports
  the `locked` flag and withdraws its controls; it never decides lock state itself.
- A student who is not on the derived roster cannot be marked (`ATTENDANCE_STUDENT_NOT_ON_ROSTER`,
  `:72`) — the roster the client sees is not authoritative.
- One mark per `(session, student)`: a second `record` is refused with `ATTENDANCE_DUPLICATE`
  (`:80`), and the way to change a mark is `correct`.
- A correction without a reason is refused (`ATTENDANCE_REASON_REQUIRED`, `:162`); a write without a
  principal is refused (`ATTENDANCE_RECORDER_REQUIRED`, `:312`); an unknown status is refused
  (`ATTENDANCE_INVALID`, `:297`).
- `bulkRecord` validates every entry before writing any (`:133`), so a partial register cannot
  exist.

The view's job is to call, await, re-read and report. It withdraws a control whose operation cannot
run (a cancelled or locked session, an empty roster, a missing permission) instead of disabling it
into a promise — M2's rule, unchanged — and it announces success only after the promise resolves,
naming only what happened: one record written, `N` records written, one status corrected. Nothing is
mutated optimistically, so a refusal leaves the register exactly as it was.

## 5. Corrections: an append-only trail with a required reason

`correct(id, { status, reason, changedByUserId })` updates the current record **and** appends an
`AttendanceCorrection`. The trail grows without bound, so `listCorrections` is paginated by contract
(`repository.ts:61`) and `useAttendanceCorrections` is never called without a page size. The UI
renders it newest-first as history: previous status ← new status, the reason, who changed it and
when. There is no control that edits or deletes a correction, and
`src/views/__tests__/attendanceWrites.test.tsx` asserts the absence rather than trusting it («حذف»,
«پاک کردن», «بازگرداندن», «ویرایش رکورد» and «ثبت نهایی» must appear as no control).

Provenance is taken from the authenticated principal (`user?.id`), never from a form field and never
from a fixture name — which is what **I12** required when it deferred the old «ثبت نهایی» toast to
this milestone.

## 6. The derived register and its one known defect

`useSessionAttendance(sessionId)` is the read a register screen needs: one repository pass returning
the derived roster already joined with the marks, so a student cannot be rendered unmarked while
their mark is loading in another request. It refreshes on every `dataVersion` bump, which is how a
record, a bulk save and a correction all appear without the caller wiring anything.

**It does not carry its query key, and M5 did not fix that.** `useSessionAttendance` is one of the
three hand-rolled readers **I13** names: when `sessionId` changes, the committed frame can still hold
the previous session's register with no in-flight marker. Fixing it means changing
`src/domains/attendance/useAttendance.ts`, which M5's authorization froze. What M5 did instead is
**mitigate at the view boundary and keep the defect visible**:

- the view compares the register it holds against the session it selected
  (`attendance.sessionId === selectedSessionId`, `src/views/Attendance.tsx:250`) and withholds the
  register — showing an in-flight state instead — when they disagree, so a crossed frame cannot be
  rendered or written against;
- `src/views/__tests__/attendanceNoFixtures.test.ts` carries a case named for exactly this
  ("keeps the upstream defect visible rather than claiming a fix"), so the mitigation cannot be
  mistaken for a closure;
- `src/views/__tests__/attendanceWrites.test.tsx` asserts a register that answers for another
  session is not rendered.

**I13 stays OPEN.** The mitigation is a guard in one consumer; the hook still does not uphold the
guarantee its own doc comment claims.

## 7. What does **not** exist

- **No `update`, no `delete`, no un-record.** Append-only is the model (§1), not an omission.
- **No notification.** Nothing messages a teacher, a student or a guardian: no `sendMessage` call,
  no `MessageStatus`, no queue. The register panel and the correction dialog say so in those words
  («اطلاع‌رسانی به مدرس، هنرجو یا سرپرست انجام نمی‌شود»), because **D1** defers the student role and
  **I7** defers provider research. M2 had already removed the «پیام پیگیری ارسال شد» control that
  claimed a delivery; M5 did not bring it back and made the absence explicit instead.
- **No academy-wide rate, trend or per-day chart in this view.** `attendanceTrend` and
  `attendanceByDay` are gone from it, and no replacement was invented: the only aggregate this
  domain feeds is the dashboard's, in `useAcademyMetrics`. A rate over a window nobody read would be
  **H4**'s defect again.
- **No per-student longitudinal history and no "last seen".** The correction trail is per record, not
  per student, and no `lastSeen` projection exists.
- **No backend aggregation, no server.** `apiRepository.ts` compiles against the same interface and
  documents the endpoints a backend must honour — `GET/POST /api/v1/attendance`,
  `POST /api/v1/attendance/bulk`, `POST /api/v1/attendance/{id}/correct`,
  `GET /api/v1/attendance/corrections`, `GET /api/v1/sessions/{id}/attendance`,
  `GET /api/v1/sessions/with-attendance`, and **no** `PATCH` or `DELETE`, mirroring the interface —
  but it is **deliberately NOT registered**: no server implements those endpoints, and registering it
  would turn every call into a failing request presented as a feature. The stub this file replaced
  sketched a `PATCH /attendance/{id}` that has never existed in either the interface or the REST
  implementation.
- **No attendance-derived balances.** Fee state is never computed from session counters
  (DECISIONS §12).

## 8. Tests, and what is frozen

**Group D — 79 tests, frozen:** `__tests__/demoRepository.test.ts` (36), `__tests__/roster.test.ts`
(32), `__tests__/useAttendance.test.tsx` (11). They pin the record model, the refusals, the atomic
bulk save, the append-only correction trail, the derived roster and the read layer. Weakening one to
get a view green is a regression, not a refactor.

M5 added no test in this directory. It added two in the view layer —
`src/views/__tests__/attendanceNoFixtures.test.ts` (31 structural cases: the view imports nothing
from the fixture module, names no fixture symbol, computes no percentage, carries none of the five
fabricated figures, hardcodes no session id, states a page size on every bounded read, calls no verb
the repository does not have, gates its write controls on `attendance.write`, and keeps I13's
defect visible) and `src/views/__tests__/attendanceWrites.test.tsx` (22 behavioural cases: the four
read states, a truncated page, a crossed register, a cancelled session, an empty roster, the three
writes and their refusals, the correction trail, permission and provenance, the scheduling
protection a mark creates, and a customer's own EMPTY environment). It also re-drove the attendance
cases in `src/views/__tests__/noSuccessWithoutWrite.test.tsx` from the repository instead of the
fixture (11 cases → 14), and moved `views/Attendance.tsx` from `FIXTURE_DRIVEN_VIEWS` into
`GRADUATED_VIEWS` in `src/__tests__/writeFeedbackHonesty.test.ts` — a ratchet asserted in both
directions, so the file must keep reaching `getAttendanceRepository(` **and** keep reporting a
success it can honestly claim.

## 9. The legacy fixtures this view replaced (and what M5 did not silently keep)

`src/data/records.ts` still holds the attendance fixtures: `AttendanceMark` (`:419`, nullable — the
fixture's own model, not the domain's), `attendanceLabel` (`:420`, a second label map duplicating
`ATTENDANCE_STATUS_LABEL`), `AttendanceRoster` (`:427`), `todayAttendance` (`:436`, **eight**
registers keyed by legacy ids `g7`–`g15` that match no session the scheduling domain has ever
produced), `attendanceTrend` (`:447`) and `attendanceByDay` (`:455`).

After M5 **no view reads the register fixtures**. What still does:

- `src/domains/demo/seed.ts:166` seeds a legacy `attendance: todayAttendance` collection into the
  DEMO dataset, while the domain's own collections start empty (`attendanceRecords: []`,
  `attendanceCorrections: []` at `:202-203`). That is the honest demo reality the wired view shows:
  real sessions, a real derived roster, and **zero marks until the operator writes one**.
- `src/domains/demo/backup.ts:242` reads that legacy collection so a backup round-trip stays
  lossless.
- `src/views/Reports.tsx:143` still renders `attendanceByDay` — a different view, still
  fixture-driven, which is **I2** and M9's.

So the fixture is now **retained data with no reader in the view that owns it** — neither deleted
(which would change the seed, the backup envelope and the zero-record invariant, none of them
authorized here) nor rendered. Separating the three roles a fixture can play is **D5**, and it is
**M10**'s.

Two inaccuracies in the M5 view's own header comment are recorded rather than fixed here, because
this reconciliation pass is documents-only and `src/views/Attendance.tsx` is byte-frozen to
`9505ade4011b37a34e3488fd51206512829205ec`: it calls `todayAttendance` "nine registers" where the
array holds eight (`g12` appears in no register, though the structural gate forbids all nine ids),
and it dates the domain "since M1" where it landed in Phase A. See
[docs/engineering/OPEN_ITEMS.md](../../../docs/engineering/OPEN_ITEMS.md) **L6**.

## 10. Where the authoritative state lives

Marks and corrections live in the demo store's `attendanceRecords` and `attendanceCorrections`
collections (`src/services/demoStore.ts`), reached only through this domain's repository; sessions
live in the scheduling domain; the roster lives in Enrollment and is derived at read time. The view
holds **no** roster state of its own — the `useState(todayAttendance)` the fixture view kept is gone
— and derives its selected session from the page it loaded rather than storing a copy
(`src/views/Attendance.tsx:237`). Nothing here writes on read, and no read in this directory seeds,
repairs or mutates anything (DECISIONS §6).

Authoritative engineering state:
[docs/engineering/PROJECT_STATE.md](../../../docs/engineering/PROJECT_STATE.md),
[docs/engineering/PHASES.md](../../../docs/engineering/PHASES.md) → "Product phase — M5",
[docs/engineering/DECISIONS.md](../../../docs/engineering/DECISIONS.md) §12 and §15,
[docs/engineering/OPEN_ITEMS.md](../../../docs/engineering/OPEN_ITEMS.md) → **H1**, **I12**, **I13**.
