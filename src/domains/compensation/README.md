# compensation

**NEW in P1 (Class Compensation). Implemented, registered, tested — and deliberately not wired to a
view yet: there is no compensation UI in P1, and no `apiRepository` either.**

This directory did not exist before P1. What is described below is the contract that was approved
before any of it was written, implemented exactly, with the parts that were deliberately left out
named as omissions rather than smoothed over.

A compensation is a make-up lesson owed to **one student of a cancelled PRIVATE (one-to-one)
session**. It is not a status on a session, not a note, and not something cancellation creates by
itself: cancelling changes nothing except the session, and a person — a secretary, a manager or an
admin holding `schedule.write` — decides, explicitly, that this student is owed a make-up. A teacher
cannot register, book or discharge one, and that is now **enforced, not merely intended**: all three
writes refuse an actor without `schedule.write` (`COMPENSATION_FORBIDDEN`), through the existing role
matrix and `can()` — no second permission was invented (see §4 and the honest boundary in §10).

What does **not** exist yet, and why:

| Not implemented | Why, and where it is recorded |
|---|---|
| **No UI** | P1's scope is the domain and its contract. The three verbs and the read layer are shipped and tested; the screen is the next workstream, and until then nothing in the product offers this flow |
| **No REST implementation** | The verbs are pinned in `repository.ts` for a server to satisfy. Registering an implementation no server answers would turn every call into a failing request presented as a feature (**D8**) |
| **No notification, SMS or provider of any kind** | Deliberate scope exclusion for P1 (**D1**, **I7**) |
| **No free-slot search** | The same-day/one-hour shape is a **prefill**, never a search: nothing here proposes a slot the operator did not type |
| **No group compensation** | `kind: "group"` is refused outright, without exception |
| **No Settings compensation-limit rule** | No quota, no window, no policy value: an obligation exists because a person created it |
| **No session auto-completion** | `Session.status === "completed"` is a different concern (the SL workstream). This domain never writes a session status |

---

## 1. The model — an obligation, not a session flag

Four decisions decide everything else in this directory:

- **A separate entity, keyed to a session by a typed id.** `SessionCompensationRecord`
  (`types.ts:138`) carries `originalSessionId`, `classId`, the frozen `studentId`, the `reason` and
  its provenance, an append-only `attempts[]` ledger, and the discharge fields. It is a collection of
  its own rather than a field on `Session` because it must **survive its own fulfilment being
  cancelled** and must be listable and countable on its own. The link is a typed id, never free text
  in `notes`: a note cannot be filtered, counted or enforced, which is the class of quiet defect
  **D17** removed elsewhere.
- **The status is derived, never stored.** `required` → `scheduled` → `completed` is computed on
  every read by `compensationStatusOf` (`derive.ts:216`) from the recorded facts plus the current
  state of the attempt's **effective** session — the session the booking stands on now, resolved from
  Scheduling's own reschedule links, the next bullet — through the named predicate `attemptIsLive`
  (`derive.ts:198`). That is what makes the owner's rule — *cancelling the make-up returns the
  requirement to `required`, and the cancelled attempt stays history* — true with **no** write, no
  listener, and no hook inside `cancelSession`. A stored status would be a second source of truth that
  a protected verb would have to be taught to maintain. The **same predicate** is what the booking
  refusal reads (§4), so the derived status and the refusal can never disagree about what "live"
  means.
- **The ledger only grows.** An attempt is a line (`CompensationAttempt`, `types.ts:116`) recording
  the session it booked (the ENTRY of that booking's lineage), when, and by whom. Lines are never
  edited, never removed and never re-pointed, so the newest line *is* the current attempt and there is
  no stored pointer that can fall out of step with the history.
- **A booking is a LINEAGE, not a row.** Where the make-up is NOW is derived by `attemptLineageOf`
  (`derive.ts:125`): a pure walk of Scheduling's own `rescheduledToId` links from the entry, with the
  reverse `rescheduledFromId` relation as the fallback when a moved-from row has been deleted. The
  reason is structural, not cosmetic — `rescheduleSession` implements a move as *cancel the row,
  create a linked replacement*, so after a legitimate move the entry is `cancelled` **by
  construction**. Reading the entry as the make-up would report a booked make-up as cancelled: it
  would let a second make-up be booked while the first is still on the calendar, and it would refuse
  to discharge a make-up that is being honoured. The read model therefore reports both ids
  (`currentAttempt.sessionId` is the effective session, `bookedSessionId` the entry) and the number of
  moves between them.

`completed` here is **not** `Session.status === "completed"`. The obligation's `completedAt` is a
**decision** — recorded with an actor and a timestamp — while the session status is a lifecycle
transition owned by scheduling. They can disagree (an attempt still `scheduled` while the obligation
was discharged, or a discharge whose session was cancelled afterwards), and the read model reports
both instead of hiding the contradiction (`attemptBroken`, `types.ts:217`).

Eligibility is the **class kind**, never the roster size (DECISIONS, P1). A group class with one
enrolled student on a quiet week is still a group class and is refused. The roster is used only as a
**safety check** on the named student: exactly one expected, and it must be the one the caller named.

**The frozen student's eligibility at the make-up's date is DISCLOSED, never enforced (C-2, D20).**
The student is frozen at registration; the enrollment behind them is live data and can end, be
withdrawn, or start after the date an operator picks. The read model answers that question per booking
— `currentAttempt.studentOnRoster`, recomputed on every read from the scheduling domain's own roster
**for the effective session's date** — and nothing else changes: the booking is allowed, the obligation
stays `scheduled`, it stays dischargeable, and `needsAttention` stays silent. The refusal that exists
stays in the domain that owns it: attendance refuses a mark for a student the session's roster does not
expect, and this domain neither loosens that nor duplicates it. See §4 and §5.

## 2. Files

| File | Responsibility |
|---|---|
| `types.ts` | the record, the read model (`SessionCompensation`), the three input shapes, the list params, `DEFAULT_COMPENSATION_MINUTES = 60` (`:335`) and `COMPENSATION_ERRORS` (`:375`) |
| `derive.ts` | pure derivation — `attemptStateOf` (`:51`), `attemptLineageOf` (`:125`) with `ATTEMPT_LINEAGE_MAX_MOVES` (`:76`), `attemptIsLive` (`:198`), `compensationStatusOf` (`:216`), `attemptBroken` (`:236`), `currentAttemptOf` (`:251`), `compensationDefaultFor` (`:266`), `isCompensableClass` (`:289`), `isCompensableOriginal` (`:306`), `resolveAffectedStudent` (`:338`). No store, no clock, no React |
| `repository.ts` | the `CompensationRepository` interface — five verbs, with the composition, no-auto-registration and uniqueness rules in its header |
| `demoRepository.ts` | the implementation in use. Every invariant and every operator-facing sentence lives here, never in a view |
| `useCompensations.ts` | the read layer: the list plus the three verbs, resolved from the registry, re-read after each awaited write |
| `__tests__/` | eight new files, **121 tests** — see §8 |

Resolution happens in `src/domains/registry.ts:231` (`getCompensationRepository`), which returns the
demo implementation **in both demo and api mode** — the same disclosure scheduling and attendance
carry. It is **composed, not duplicated**: the constructor receives the scheduling and attendance
repositories as their **interfaces** (`registry.ts:231-239`), so an override injected for either
domain (`setSchedulingRepository`, `setAttendanceRepository`) is honoured here too, and this domain
never imports another domain's implementation.

## 3. The contract — five verbs, and no more

`list` (`repository.ts:132`), `get` (`:135`), `register` (`:143`), `schedule` (`:156`), `complete`
(`:167`).

**There is deliberately no `reopen` verb.** The owner's rule returns an obligation to `required` when
its attempt is cancelled before completion, and that is a *derivation* of the attempt's live state —
not a write. Re-booking is a second `schedule` call: an operation the existing contract already
expresses does not get a new verb (**D14**) — and it is allowed exactly while the current booking is
NOT live, refused with `ALREADY_SCHEDULED` while it is: the test is the END of the booking's
reschedule lineage, so a moved make-up still refuses a second one (§4, §5).

Reads are filtered by the **typed link** and by the derived state: `originalSessionId`, `studentId`,
`classId`, `status`, `openOnly`, `compensationSessionId` (reverse lookup — which obligation's booking
has this session in its LINEAGE, the entry it created or any replacement a move produced) and
`needsAttention` (the current booking's effective session was cancelled or deleted), newest
requirement first.

Errors are typed values, not thrown strings — `COMPENSATION_ERRORS` (`types.ts:375`):
`COMPENSATION_NOT_FOUND`, `COMPENSATION_ORIGINAL_NOT_FOUND`, `COMPENSATION_ORIGINAL_NOT_CANCELLED`,
`COMPENSATION_CLASS_NOT_FOUND`, `COMPENSATION_CLASS_NOT_PRIVATE`, `COMPENSATION_NO_AFFECTED_STUDENT`,
`COMPENSATION_ROSTER_AMBIGUOUS`, `COMPENSATION_STUDENT_MISMATCH`, `COMPENSATION_REASON_REQUIRED`,
`COMPENSATION_ORIGINAL_ATTENDANCE_UNACKNOWLEDGED`, `COMPENSATION_ALREADY_OPEN`,
`COMPENSATION_ALREADY_SETTLED`, `COMPENSATION_ALREADY_SCHEDULED`, `COMPENSATION_NOT_SCHEDULED`,
`COMPENSATION_SESSION_ALREADY_LINKED`, `COMPENSATION_ACTOR_REQUIRED`, `COMPENSATION_FORBIDDEN` —
**seventeen** in all. Each carries its own Persian sentence from the demo repository («جبرانی فقط
برای کلاس‌های خصوصی (یک‌به‌یک) ثبت می‌شود.», «دلیل نیاز به جبرانی الزامی است.»), and the three roster
failures are mapped by `AFFECTED_STUDENT_MESSAGES` (`demoRepository.ts:733`) so the caller
reports the sentence rather than paraphrasing it.

## 4. Invariants enforced in the repository, never in a view

- **Cancellation registers nothing.** There is no code path from `cancelSession` into this domain
  (`demoRepository.ts` never calls it, and scheduling never calls in). `register` is an explicit
  human act.
- **Only a cancelled private session is eligible** — `ORIGINAL_NOT_CANCELLED`, then
  `CLASS_NOT_PRIVATE`, in the order the operator would ask it. The class kind is **re-checked at
  booking time** (`:350`), because a class can be archived or have its `kind` edited between
  registration and booking.
- **The affected student is derived from `sessionRoster` and frozen** (`:256`), never from the
  class's denormalized `studentIds` and never from a mark: an empty roster is
  `NO_AFFECTED_STUDENT`, two or more is `ROSTER_AMBIGUOUS`, and a different single student is
  `STUDENT_MISMATCH`.
- **All three writes are protected operations.** `register`, `schedule` and `complete` take an actor
  (`{ userId, permissions }`) and refuse one that does not hold **`schedule.write`** —
  `COMPENSATION_FORBIDDEN`, an `authorization`/403 error — checked with the existing `can()` against
  the existing role matrix. There is **no compensation-specific permission**, and the check is the
  first statement of each verb, before any read, so a refused caller cannot use the domain as an
  existence oracle. A teacher (and an accountant) is therefore refused by the code, not by convention.
  **The boundary this does not cross is documented in §10**: the permissions travel with the call
  because the browser is where they are known, so the server must re-derive them from the token.
- **A reason and a named actor are required** (`REASON_REQUIRED`, `ACTOR_REQUIRED`; `actor.userId`
  must be non-empty even when the permission is held). Provenance is recorded — the `userId` on the
  record and on each attempt — and is never the authorization decision: the permission check is.
- **Uniqueness is the `(originalSessionId, studentId)` pair, for its lifetime**: a second
  registration is `ALREADY_OPEN` while the obligation is open and `ALREADY_SETTLED` once it is
  discharged. `register` is therefore **never an upsert** — a discharged obligation cannot be
  re-created as if it had never been honoured.
- **At most ONE live make-up per obligation** (`ALREADY_SCHEDULED`). A second booking is refused
  while the current booking's **effective** session is live — so MOVING a make-up never opens a window
  in which a second one may be booked. Nothing is superseded, re-pointed or auto-cancelled, and no
  session an operator booked is touched: the correction path is the scheduling domain's own
  `rescheduleSession`. `schedule` and `complete` run the whole of their work after authorization
  inside one **serialized section per obligation** (`demoRepository.ts:520`), so two concurrent
  bookings produce one session and one refusal, and a booking racing a discharge resolves in a fixed
  order — the discharge sees the committed attempt, or the booking is refused as terminal. Only the
  END of the chain decides: when it is cancelled, deleted or unresolvable the obligation is back to
  `required`, and booking again is then exactly what the owner's rule asks for.
- **Completion requires a live make-up**: something was booked and that booking still stands on the
  session it was moved to (`NOT_SCHEDULED` otherwise), and a discharged obligation refuses both `complete` and `schedule`
  (`ALREADY_SETTLED` — checked before the liveness refusal, so the precedence of the existing
  terminal error is unchanged). `complete` shares `schedule`'s serialized section, which is what makes
  those two answers consistent instead of racy. Attendance on the make-up is **not** required — a
  discharge is a recorded decision, and requiring a register would make it a function of another
  domain's data.
- **Eligibility is NOT re-checked at the make-up's date, and the fact is disclosed instead** (C-2,
  D20). `schedule` refuses for exactly two reasons — the obligation is terminal (`ALREADY_SETTLED`) or
  it already has a live make-up (`ALREADY_SCHEDULED`) — and never because the frozen student's
  enrollment has ended, been withdrawn, or not started. Refusing there would lose a debt the owner's
  rule says is owed, and it is not answerable before the write anyway: the roster is derived for a
  session's own date and the session does not exist until `create()` mints it. What the read model owes
  instead is the fact, per booking: `currentAttempt.studentOnRoster` (derived, never stored — a
  re-enrollment or a corrected end date clears it with no write), `undefined` when there is no real
  session to ask about. The enforcement belongs to attendance, which refuses the mark
  (`ATTENDANCE_STUDENT_NOT_ON_ROSTER`).
- **A session may never be the make-up of two obligations** (`SESSION_ALREADY_LINKED`). The ledger is
  verified **before** the session write (`demoRepository.ts:623`): the id of the session about to be
  created does not exist until `create()` mints it, so what is asserted is the model property — no
  session claimed twice — in the one ordering in which that refusal cannot itself leave a stray
  session in the calendar. A refusal after the write would. A claim counts every session in an
  attempt's **lineage**, not only its entry: otherwise a move would hide the collision and one make-up
  would be credited to two debts.

## 5. Booking goes through the scheduling repository

`schedule` performs **one session write**, through `SchedulingRepository.create()` — the verb that
already owns session creation. Shape validation, the 15–480 minute bounds, the hard/warning conflict
engine and `origin: "manual"` (so bulk generation never reclaims a make-up) are the scheduling
domain's answers, not restated here. The make-up is an ordinary session on the ordinary calendar: no
second session model, no second overlap rule.

The default booking is the original's own **date, room and teacher**, one hour long, computed by
`compensationDefaultFor` — a **prefill for a form**, never an automatic booking and never a search.
It returns `null` when the original is gone or its times are unreadable, because an invented default
would be looked at as if it were a stored fact. If the original row has been hard-deleted and the
caller supplied neither teacher nor room, the refusal is the scheduling domain's own shape error.

An off-schedule make-up (a lesson on a day the class does not normally meet) is a **WARNING**: it is
refused unless the caller sets `acknowledgeWarnings`, which is passed straight through. That
integration is tested, not assumed (§8).

**`schedule()` books; `rescheduleSession` moves.** They are not two spellings of one act:

| | Compensation `schedule()` | Scheduling `rescheduleSession` |
|---|---|---|
| what it does | creates a NEW session through `SchedulingRepository.create()` and appends one ledger line | creates a replacement session and cancels the one it moved, linked by `rescheduledFromId`/`rescheduledToId` |
| when it is allowed | only while the obligation has no live make-up — tested on the EFFECTIVE session, so a moved make-up still refuses a new booking (`ALREADY_SCHEDULED` otherwise) | any live, attendance-free session, with a reason |
| who owns the rule | this domain | the scheduling domain, unchanged by P1 |

The BOOKING RESPONSE carries `currentAttempt.studentOnRoster`, which is the one place this domain can
honestly put it: the session exists by then, so the roster question has an answer, and the operator
learns at booking time what the register will say on the day — instead of discovering it when the
family arrives. It is a report, not a gate: nothing downstream of it refuses, blocks or rewrites.

So an operator who needs to MOVE a booked make-up moves the session, and the compensation ledger is
left alone — it is not a place to record a correction. But a move is a **continuation**, not a
cancellation: the attempt keeps the entry its line recorded, and the derived answers follow the move
to the session the make-up is on now, so the obligation stays `scheduled` — it cannot be booked a
second time, and it is discharged against the session the operator actually moved it to. The walk
uses the scheduling domain's own links, and nothing is invented to smooth it over (§1, §10).

## 6. Attendance on the cancelled original: asked about, never assumed

Cancelling a session is **not** blocked by attendance (existing behaviour, unchanged), so a cancelled
original can already carry a mark — the lesson partly happened. That is not proof that compensation
is owed, and it is not something to ignore either: registration is **refused** with
`ORIGINAL_ATTENDANCE_UNACKNOWLEDGED` unless the caller explicitly acknowledges it, and the
acknowledgement timestamp is stored (`originalAttendanceAcknowledgedAt`, `types.ts:170`).

The mark itself is **never copied**: `originalStudentAttendance` is derived from the attendance
domain on every read (`demoRepository.ts:708`), so a correction to the original changes what the
obligation shows without a second write. `undefined` means "no mark", which is a different fact from
"not read" — and a **failed attendance read fails the read** rather than rendering "no mark"
(**D12**). The rule applies to `register` too: an unreadable attendance answer never silently becomes
consent to skip the question.

## 7. The demo dataset

- The collection is `sessionCompensations` (`demoStore.ts:444`, ids `cmp_…`), declared in
  `DEMO_COLLECTIONS` (`demo/types.ts:169`, the dataset field of the same name is at `:132`) and carried by **both** canonical datasets — as **`[]`**
  in each (`seed.ts:210`, `:268`). That is a recorded demo limitation, not a missing feature: the
  demo ships no compensable case at all, because its only cancelled session belongs to a group class
  and registration is a human act. The flow is exercised by the tests instead of by seeded fiction.
- Because it is a dataset collection, it is part of export, import, restore, statistics and the
  destructive paths without any of them being taught about it (the settings panel's collection list
  needed one label — §8) — and `validateDataset`
  (`backup.ts:319-424`) checks it: a dangling `studentId`/`classId`, a missing typed link, a
  malformed ledger, two obligations for one `(original, student)` pair, and one session claimed by
  two obligations are all refused.
- **The `originalSessionId` link is structural, not referential, on purpose.** The scheduling
  repository allows hard-deleting a session with no attendance, and an obligation **outlives** the
  row it compensates for; a backup therefore must not refuse to load because a cancelled session is
  gone. The read model reports that state (`originalMissing`, `attemptBroken`) instead.

## 8. Tests

**121 tests, eight new files** — none of them in a frozen group, and no suite that existed **before
P1** was touched. Four of the seven were extended by the C-1/C-1.1 work, and one Turn-1 case in
`demoRepository.test.ts` was replaced: it pinned the behaviour the amendment corrects (a moved make-up
reading as unbooked). Nothing was weakened — the case it replaced is now covered by the lineage suite
below, on the real behaviour:

| File | Cases | What it pins |
|---|---|---|
| `__tests__/derive.test.ts` | 31 | the derivation itself, with no environment: the three states, the return to `required` on a cancelled or deleted attempt, terminal completion with the contradiction reported, eligibility by kind, the roster resolution, the prefill (including "no default" when the original is gone), the named liveness predicate — pinned as the one definition the derived status and the C-1 refusal share — and the lineage walk: one and two hops, a cancelled end, a cancelled entry with a live successor, a deleted entry recovered through the reverse link, a missing entry, a cycle, and the hop cap |
| `__tests__/demoRepository.test.ts` | 38 | the invariants end to end on the demo store: cancellation registers nothing, the refusals and their codes, the frozen student, the attendance gate and its acknowledgement, uniqueness (including the pair becoming duplicated **inside** the awaited reads), booking through `create()`, **the refusal of a second booking while the make-up is live**, booking again once the attempt was cancelled or hard-deleted, the append-only ledger, hard deletion, completion, and every read filter. A suite of its own pins the amendment: the refusal and the completion on the MOVED session, two moves with one ledger line, the chain's end cancelled ⇒ `required` and re-bookable, the entry cancelled alone ⇒ still `scheduled`, a deleted entry resolved through `rescheduledFromId`, an unresolvable chain reported rather than guessed, and the reverse lookup matching any session in the lineage |
| `__tests__/datasetContract.test.ts` | 15 | the collection contract: both datasets, the `cmp_` prefix, the registry seam (including overrides of the collaborators), and the backup rules — accepted, refused, and the deliberately accepted orphan |
| `__tests__/useCompensations.test.tsx` | 5 | the read layer: the list, refresh after each awaited write, a refusal propagated verbatim with no success claimed, and the injected repository being the one asked |
| `__tests__/persianDate.test.ts` | 2 | a Jalali date typed by the operator lands on the right Gregorian day (۱۴۰۶/۰۱/۱۵ → `2027-04-04`), and a date that does not exist fails closed instead of being guessed |
| `__tests__/authorization.test.ts` | 11 | the protected operations: the role matrix the gate rests on (`schedule.write` for staff/manager/admin, not for teacher/accountant), a refusal for each unauthorized path with no side effect written, a refusal that precedes every other check (so the domain is not an existence oracle — including the C-1 refusal, which a refused caller is never told about), the unchanged `ACTOR_REQUIRED` for an unnamed actor, reads staying ungated, and an authorized actor carried through the whole flow with provenance recorded |
| `__tests__/enrollmentEligibility.test.ts` | 9 | C-2 end to end on the demo store, through the REAL enrollment repository: the ordinary booking saying `true`; an ended/withdrawn enrollment saying `false` while the booking still succeeds, stays `scheduled`, stays one make-up and still discharges; `needsAttention` staying silent; the disclosure following the LINEAGE (a move to a date the enrollment still covers clears it, with one ledger line); the disclosed fact being exactly the one attendance refuses a mark for; booking writing no enrollment and re-enrolling clearing it with no compensation write; no roster field stored anywhere on the record; the C-1 refusal still answering while the student is off the roster; authorization still the only refusal; and a session deleted mid-read being REPORTED as `missing` instead of failing the read |
| `__tests__/bookingInvariant.test.ts` | 10 | the concurrency cases, which need a real interleaving and therefore live in their own file: the live-make-up refusal from a second adapter and its `conflict` kind, two concurrent bookings of one obligation (one session, one refusal, never two session writes in flight), a booking racing a discharge in BOTH orders, a second booking racing a discharge, the pre-write ledger refusal leaving no stray session — and the lineage cases on top of them: the refusal while the MOVED-TO session is live (then allowed once the chain's end is cancelled), the discharge against the moved-to session while the racing booking is refused, and a session claimed **inside another obligation's lineage** refused before the write |

Adding a collection to the dataset touches the generic suites that enumerate every collection, and
exactly **two additive edits** were needed outside this directory — recorded here rather than left to
be discovered:

| Edit | Why it is required, and what it does not do |
|---|---|
| `demo/__tests__/seed.test.ts` — `sessionCompensations` added to `INTENTIONALLY_EMPTY` | That set is the file's own sanctioned way of saying "empty on purpose" (it already holds `galleryImages`, `attendanceRecords`, `attendanceCorrections`), and the loop asserts emptiness for anything in it. **No assertion was weakened**: the collection is still checked, just against the honest expectation. Seeding a compensable case was rejected: the demo has no private cancelled session to derive one from, and registration is a human act |
| `components/settings/DemoDataPanel.tsx` — one label | Its `COLLECTION_LABELS` map is a **total** `Record` over `DEMO_COLLECTIONS`, so the new collection is a compile error until it has a Persian name («جبرانی جلسات لغوشده»). The panel lists collection counts; nothing else changed |

Everything else ran over the new collection unchanged: `dataIntegrity.test.ts`, `dataLifecycle.test.ts`
and `demoDataManager.test.ts` (clear ⇒ every collection at zero) all passed without being touched.
Group A (211 tests), Group D, the scheduling and attendance suites and the frozen M7 surfaces are
untouched — no assertion in any of them was weakened, and the new cases live in new files.

## 9. Where the authoritative state lives

Obligations live in the demo store's `sessionCompensations` collection, reached only through this
domain's repository; the sessions an obligation points at live in the scheduling domain; the roster
comes from Enrollment through the scheduling domain's `sessionRoster`; the mark on the original comes
from the attendance domain. This domain **owns no session, no roster and no mark**, and its derived
half is computed on read — no read in this directory seeds, repairs or mutates anything
(DECISIONS §6).

## 10. Known limits, recorded rather than smoothed over

- **No UI, no REST implementation** — §the table at the top; the next workstreams, not defects of
  this one.
- **The authorization gate is client-side, and is exactly as strong as the rest of this product's
  RBAC and no stronger.** `register`, `schedule` and `complete` refuse an actor without
  `schedule.write`, at the single point every write passes through — but the permission list arrives
  **with the call**, because the browser is where the current user's permissions are known
  (`permissions.ts` states plainly that frontend RBAC is UX-only and bypassable). What that buys is
  that no caller — today's tests, tomorrow's screen, a future integration — can perform a write
  without stating an actor that holds the permission, and that a teacher's path is refused by the
  domain rather than by a hidden button. **What it cannot buy is security:** the server must
  re-derive the actor and its permissions from the session token and refuse independently, exactly as
  a server must for every other domain here. A REST implementation of this contract may not trust a
  payload that names its own permissions.
- **Uniqueness is enforced in-process, not across clients.** `register` re-checks the
  `(originalSessionId, studentId)` pair immediately before the write, with no `await` between the
  check and the synchronous store write, so an interleaved second registration in this adapter cannot
  slip through. Two browsers do not share that event loop: the server needs the same rule as a unique
  constraint or a transaction.
- **The booking section is in-process as well.** `schedule` and `complete` are serialized per
  obligation by a promise chain (`demoRepository.ts:520`), which is enough for one page and for two
  adapters over one store — and is deliberately NOT a global lock, and not a claim about two
  browsers. The lineage is resolved inside that section, so the refusal and the discharge are decided
  on the same state. A server needs the same invariant from a transaction plus an idempotent write,
  and the repository contract says so.
- **Moving a make-up is read as a continuation, and the ledger is never re-pointed.** The attempt
  keeps the entry its line recorded; the derived state, the booking refusal and the completion gate
  follow the reschedule lineage to the effective session (`derive.ts:125`, `demoRepository.ts:690`).
  What is deliberately NOT done is re-pointing a ledger line at the replacement: that would mutate an
  append-only history and store something that is derivable. The residual case is a **run** of deleted
  moved-from rows, where a booking can no longer be walked to a real row: the walk then reports
  `resolvable: false`, the obligation reads `required` with `attemptBroken` true and appears under
  `needsAttention` — fail-visible rather than silently re-openable. The clean fix is a scheduling-side
  guard on deleting a moved-from row (a scheduling decision, **I18**), not a compensation-side write.

- **OPEN — an unresolvable lineage is fail-VISIBLE but not fail-CLOSED, and that is a decision, not an
  oversight.** A booking whose lineage cannot be walked (a deleted run of moved-from rows, a cycle, or
  a chain longer than `ATTEMPT_LINEAGE_MAX_MOVES`) is reported rather than guessed at: the walk returns
  `resolvable: false`, the obligation reads `required` with `attemptBroken` true and appears under
  `needsAttention`. That is the whole of the behaviour — and it is deliberately unchanged by C-1.1:
  because the derived status is `required`, `schedule` is then permitted, so a **crafted** dataset
  whose last accepted row still stands could in principle see a second make-up booked while the first
  is still on the calendar. The fail-visible signal does not by itself block the booking.
  **Where such a dataset can come from:** not from the Scheduling API — `rescheduleSession` refuses a
  `cancelled` row (`ALREADY_CANCELLED`), so a row is moved at most once, a written `rescheduledToId` is
  never overwritten, and `rescheduledFromId` always names the source row, which makes every chain the
  API produces linear and acyclic; session ids are minted by `create()`, so a lineage cannot be shared
  either. But `validateDataset` (`backup.ts`) checks both links REFERENTIALLY and refuses a session
  claimed by two obligations, and it does **not** reject a cycle — so a hand-edited backup is the one
  route into this state. **The fix is therefore not here:** either the dataset validator refuses a
  cyclic / over-length chain at import (dataset side), or the booking path treats `resolvable: false`
  as fail-closed by refusing to book (this domain, which would need the decision first). Both are
  recorded as an open item and neither is implemented; there is no `I`-number assigned to it yet, and
  no behaviour was changed for it.
- **`studentOnRoster` is reported and nothing renders it yet (C-2).** The field is on every read, and
  it is the booking response's own answer, but the flow still has no UI (**I20**), so no screen shows
  it today. A server implementation must compute it the same way — re-deriving the roster for the
  effective session's date — and there is nothing to store for it.
- **A cancelled, deleted or unresolvable booking is only visible if somebody looks.** Nothing notifies anyone;
  `needsAttention` exists so a future screen can find these, and there is no scheduler, job or badge
  behind it.
- **An obligation whose original session was hard-deleted cannot be re-created or re-pointed.** It
  stays readable (`originalMissing`) and bookable from its own retained `classId`, and that is all
  the contract promises.
- **Session lifecycle is not touched.** Automatic completion of elapsed sessions is the separate SL
  workstream and is **not** implemented here; `Session` and `SessionStatus` are unchanged by P1.
- **The known environment-level test failures are unrelated to this domain**: `projectState.test.ts`
  asserts a branch name this sandbox does not use (recorded, with the owner's standing ruling and the
  measured "fails identically on the pre-CP4 tree" evidence, as §7 item 16 in
  [PROJECT_STATE.md](../../../docs/engineering/PROJECT_STATE.md)), and **I19** is a date-dependent
  failure of the scheduling-writes filter that reproduces before P1 and is recorded as §7 item 18.

Authoritative engineering state — this domain's shipped contract is registered in all four documents,
and those records are the authority wherever this file and they disagree:

- [docs/engineering/PROJECT_STATE.md](../../../docs/engineering/PROJECT_STATE.md) → §3 "Last completed
  work (Class Compensation P1…)", §4 "Compensation P1 validation" (measured at
  `a21311d7e32c82e3a46b1581c94f6b3478bf646c`), §6 (the protected-surface row for this contract) and
  §7 item 19 (the workstream's limitations, including that there is no UI and no `apiRepository`).
- [docs/engineering/PHASES.md](../../../docs/engineering/PHASES.md) → "Workstream — Class Compensation
  P1" — a **non-milestone workstream**, built on `e7a6d72` (M7's reconciliation), which is therefore
  P1's effective safe rollback boundary.
- [docs/engineering/DECISIONS.md](../../../docs/engineering/DECISIONS.md) → **D18** (the obligation,
  the typed link, the derived state, the append-only ledger) and **D19** (one-to-one only, registered
  by a person, booked through the scheduling repository), plus the older entries this domain depends on
  — D1, D8, D12, D14, D17.
- [docs/engineering/OPEN_ITEMS.md](../../../docs/engineering/OPEN_ITEMS.md) → **I18** (the requirement
  this domain partly answers: **OPEN and only PARTLY LANDED** — group and class-wide compensation and
  any notification are still unbuilt), **I20** (no UI and no server), I7 and I19.
- The scheduling domain's own [README](../scheduling/README.md), whose `create()` verb books the make-up
  and whose `sessionRoster()` is authoritative for the affected student.

Automatic completion of elapsed sessions (the SL workstream) has **no decision and no implementation**
in those documents: it is a separate concern, deliberately kept out of P1 (§10 above).
