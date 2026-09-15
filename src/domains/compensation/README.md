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
cannot register, book or discharge one; that is the permission model, not a convention.

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

Three decisions decide everything else in this directory:

- **A separate entity, keyed to a session by a typed id.** `SessionCompensationRecord`
  (`types.ts:119`) carries `originalSessionId`, `classId`, the frozen `studentId`, the `reason` and
  its provenance, an append-only `attempts[]` ledger, and the discharge fields. It is a collection of
  its own rather than a field on `Session` because it must **survive its own fulfilment being
  cancelled** and must be listable and countable on its own. The link is a typed id, never free text
  in `notes`: a note cannot be filtered, counted or enforced, which is the class of quiet defect
  **D17** removed elsewhere.
- **The status is derived, never stored.** `required` → `scheduled` → `completed` is computed on
  every read by `compensationStatusOf` (`derive.ts:63`) from the recorded facts plus the **current**
  state of the attempt's session. That is what makes the owner's rule — *cancelling the make-up
  returns the requirement to `required`, and the cancelled attempt stays history* — true with **no
  write, no listener, and no hook inside `cancelSession`**. A stored status would be a second source
  of truth that a protected verb would have to be taught to maintain.
- **The ledger only grows.** An attempt is a line (`CompensationAttempt`, `types.ts:103`) recording
  the session it booked, when, and by whom. Lines are never edited and never removed, so the newest
  line *is* the current attempt and there is no pointer that can fall out of step with the history.

`completed` here is **not** `Session.status === "completed"`. The obligation's `completedAt` is a
**decision** — recorded with an actor and a timestamp — while the session status is a lifecycle
transition owned by scheduling. They can disagree (an attempt still `scheduled` while the obligation
was discharged, or a discharge whose session was cancelled afterwards), and the read model reports
both instead of hiding the contradiction (`attemptBroken`, `types.ts:172`).

Eligibility is the **class kind**, never the roster size (DECISIONS, P1). A group class with one
enrolled student on a quiet week is still a group class and is refused. The roster is used only as a
**safety check** on the named student: exactly one expected, and it must be the one the caller named.

## 2. Files

| File | Responsibility |
|---|---|
| `types.ts` | the record, the read model (`SessionCompensation`), the three input shapes, the list params, `DEFAULT_COMPENSATION_MINUTES = 60` (`:256`) and `COMPENSATION_ERRORS` (`:294`) |
| `derive.ts` | pure derivation — `attemptStateOf` (`:48`), `compensationStatusOf` (`:63`), `attemptBroken` (`:85`), `currentAttemptOf` (`:100`), `compensationDefaultFor` (`:115`), `isCompensableClass` (`:138`), `isCompensableOriginal` (`:155`), `resolveAffectedStudent` (`:187`). No store, no clock, no React |
| `repository.ts` | the `CompensationRepository` interface — five verbs, with the composition, no-auto-registration and uniqueness rules in its header |
| `demoRepository.ts` | the implementation in use. Every invariant and every operator-facing sentence lives here, never in a view |
| `useCompensations.ts` | the read layer: the list plus the three verbs, resolved from the registry, re-read after each awaited write |
| `__tests__/` | five new files, **69 tests** — see §8 |

Resolution happens in `src/domains/registry.ts:231` (`getCompensationRepository`), which returns the
demo implementation **in both demo and api mode** — the same disclosure scheduling and attendance
carry. It is **composed, not duplicated**: the constructor receives the scheduling and attendance
repositories as their **interfaces** (`registry.ts:231-239`), so an override injected for either
domain (`setSchedulingRepository`, `setAttendanceRepository`) is honoured here too, and this domain
never imports another domain's implementation.

## 3. The contract — five verbs, and no more

`list` (`repository.ts:53`), `get` (`:56`), `register` (`:64`), `schedule` (`:71`), `complete`
(`:77`).

**There is deliberately no `reopen` verb.** The owner's rule returns an obligation to `required` when
its attempt is cancelled before completion, and that is a *derivation* of the attempt's live state —
not a write. Re-booking is a second `schedule` call: an operation the existing contract already
expresses does not get a new verb (**D14**).

Reads are filtered by the **typed link** and by the derived state: `originalSessionId`, `studentId`,
`classId`, `status`, `openOnly`, `compensationSessionId` (reverse lookup — which obligation's current
attempt is this session) and `needsAttention` (the current attempt was cancelled or deleted), newest
requirement first.

Errors are typed values, not thrown strings — `COMPENSATION_ERRORS` (`types.ts:294`):
`COMPENSATION_NOT_FOUND`, `COMPENSATION_ORIGINAL_NOT_FOUND`, `COMPENSATION_ORIGINAL_NOT_CANCELLED`,
`COMPENSATION_CLASS_NOT_FOUND`, `COMPENSATION_CLASS_NOT_PRIVATE`, `COMPENSATION_NO_AFFECTED_STUDENT`,
`COMPENSATION_ROSTER_AMBIGUOUS`, `COMPENSATION_STUDENT_MISMATCH`, `COMPENSATION_REASON_REQUIRED`,
`COMPENSATION_ORIGINAL_ATTENDANCE_UNACKNOWLEDGED`, `COMPENSATION_ALREADY_OPEN`,
`COMPENSATION_ALREADY_SETTLED`, `COMPENSATION_NOT_SCHEDULED`, `COMPENSATION_SESSION_ALREADY_LINKED`,
`COMPENSATION_ACTOR_REQUIRED`. Each carries its own Persian sentence from the demo repository
(«جبرانی فقط برای کلاس‌های خصوصی (یک‌به‌یک) ثبت می‌شود.», «دلیل نیاز به جبرانی الزامی است.»), and the three
roster failures are mapped by `AFFECTED_STUDENT_MESSAGES` (`demoRepository.ts:409`) so the caller
reports the sentence rather than paraphrasing it.

## 4. Invariants enforced in the repository, never in a view

- **Cancellation registers nothing.** There is no code path from `cancelSession` into this domain
  (`demoRepository.ts` never calls it, and scheduling never calls in). `register` is an explicit
  human act.
- **Only a cancelled private session is eligible** — `ORIGINAL_NOT_CANCELLED`, then
  `CLASS_NOT_PRIVATE`, in the order the operator would ask it. The class kind is **re-checked at
  booking time** (`:239`), because a class can be archived or have its `kind` edited between
  registration and booking.
- **The affected student is derived from `sessionRoster` and frozen** (`:182`), never from the
  class's denormalized `studentIds` and never from a mark: an empty roster is
  `NO_AFFECTED_STUDENT`, two or more is `ROSTER_AMBIGUOUS`, and a different single student is
  `STUDENT_MISMATCH`.
- **A reason and a named actor are required** (`REASON_REQUIRED`, `ACTOR_REQUIRED`). Provenance is
  recorded, never treated as authorization — the server enforces who may write; this field records
  who did.
- **Uniqueness is the `(originalSessionId, studentId)` pair, for its lifetime**: a second
  registration is `ALREADY_OPEN` while the obligation is open and `ALREADY_SETTLED` once it is
  discharged. `register` is therefore **never an upsert** — a discharged obligation cannot be
  re-created as if it had never been honoured.
- **Completion requires a live current attempt**: something was booked and that booking still stands
  (`NOT_SCHEDULED` otherwise), and a discharged obligation refuses both `complete` and `schedule`
  (`ALREADY_SETTLED`). Attendance on the make-up is **not** required — a discharge is a recorded
  decision, and requiring a register would make it a function of another domain's data.
- **A session may never be the attempt of two obligations** (`SESSION_ALREADY_LINKED`,
  `demoRepository.ts:358`).

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

## 6. Attendance on the cancelled original: asked about, never assumed

Cancelling a session is **not** blocked by attendance (existing behaviour, unchanged), so a cancelled
original can already carry a mark — the lesson partly happened. That is not proof that compensation
is owed, and it is not something to ignore either: registration is **refused** with
`ORIGINAL_ATTENDANCE_UNACKNOWLEDGED` unless the caller explicitly acknowledges it, and the
acknowledgement timestamp is stored (`originalAttendanceAcknowledgedAt`, `types.ts:151`).

The mark itself is **never copied**: `originalStudentAttendance` is derived from the attendance
domain on every read (`demoRepository.ts:389-393`), so a correction to the original changes what the
obligation shows without a second write. `undefined` means "no mark", which is a different fact from
"not read" — and a **failed attendance read fails the read** rather than rendering "no mark"
(**D12**). The rule applies to `register` too: an unreadable attendance answer never silently becomes
consent to skip the question.

## 7. The demo dataset

- The collection is `sessionCompensations` (`demoStore.ts:444`, ids `cmp_…`), declared in
  `DEMO_COLLECTIONS` (`demo/types.ts:200`) and carried by **both** canonical datasets — as **`[]`**
  in each (`seed.ts:210`, `:268`). That is a recorded demo limitation, not a missing feature: the
  demo ships no compensable case at all, because its only cancelled session belongs to a group class
  and registration is a human act. The flow is exercised by the tests instead of by seeded fiction.
- Because it is a dataset collection, it is part of export, import, restore, statistics and the
  destructive paths without any of them being taught about it (the settings panel's collection list
  needed one label — §8) — and `validateDataset`
  (`backup.ts:319-423`) checks it: a dangling `studentId`/`classId`, a missing typed link, a
  malformed ledger, two obligations for one `(original, student)` pair, and one session claimed by
  two obligations are all refused.
- **The `originalSessionId` link is structural, not referential, on purpose.** The scheduling
  repository allows hard-deleting a session with no attendance, and an obligation **outlives** the
  row it compensates for; a backup therefore must not refuse to load because a cancelled session is
  gone. The read model reports that state (`originalMissing`, `attemptBroken`) instead.

## 8. Tests

**69 tests, five new files** — none of them in a frozen group, and no existing suite was modified:

| File | Cases | What it pins |
|---|---|---|
| `__tests__/derive.test.ts` | 20 | the derivation itself, with no environment: the three states, the return to `required` on a cancelled or deleted attempt, terminal completion with the contradiction reported, eligibility by kind, the roster resolution, the prefill (including "no default" when the original is gone) |
| `__tests__/demoRepository.test.ts` | 27 | the invariants end to end on the demo store: cancellation registers nothing, the refusals and their codes, the frozen student, the attendance gate and its acknowledgement, uniqueness, booking through `create()`, the append-only ledger with the attempt cancelled and re-booked, hard deletion, completion, and every read filter |
| `__tests__/datasetContract.test.ts` | 15 | the collection contract: both datasets, the `cmp_` prefix, the registry seam (including overrides of the collaborators), and the backup rules — accepted, refused, and the deliberately accepted orphan |
| `__tests__/useCompensations.test.tsx` | 5 | the read layer: the list, refresh after each awaited write, a refusal propagated verbatim with no success claimed, and the injected repository being the one asked |
| `__tests__/persianDate.test.ts` | 2 | a Jalali date typed by the operator lands on the right Gregorian day (۱۴۰۶/۰۱/۱۵ → `2027-04-04`), and a date that does not exist fails closed instead of being guessed |

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
- **A cancelled or deleted attempt is only visible if somebody looks.** Nothing notifies anyone;
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
