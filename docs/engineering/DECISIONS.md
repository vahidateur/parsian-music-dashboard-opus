# DECISIONS — durable architecture record

Only decisions that are still load-bearing. This is an index with rationale, **not** a
transcript: the deep detail lives in `docs/architecture/` and in the code comments named
below. If a decision here is ever reversed, edit the entry and say what replaced it — never
delete it silently.

Format: **Decision** → **Why** → **Enforced by** → **Status**.

---

## 1. Layering: View → Domain Hook → Repository → DemoStore | ApiClient

**Decision.** Every surface reads through a domain hook that consumes a repository interface;
the registry picks the implementation. Transport, errors and config know no domain; domain
interfaces never speak HTTP; `src/services/demoStore.ts` is the only writer of demo
`localStorage` and is never imported by a view.

**Why.** It lets the UI move from demo persistence to a real REST backend without being
redesigned, and it makes "where did this number come from?" answerable in one hop.

**Enforced by.** `docs/architecture/data-layer.md` (layers table), `src/domains/registry.ts`,
and `src/__tests__/architectureBoundaries.test.ts` — which fails the build if a view or
component touches `localStorage`, imports `demoStore`, calls `fetch(`, hardcodes an
`http(s)://` URL, references the removed `useAsyncView`, or imports `ACADEMY_NOW`. Layering is
a test, not a review convention.

**Status.** ✅ In force.

## 2. Demo is a first-class environment, not a fake production backend

**Decision.** The DemoStore is *implementation #1*, not scaffolding to be deleted. Demo mode
stays visibly demo: no simulated production behaviour, no pretending a backend exists.

**Why.** It keeps the product demonstrable with zero backend and gives the repository contract
a second implementation — which is what proves the abstraction is real rather than decorative.

**Enforced by.** `docs/architecture/data-layer.md` → "Why the DemoStore stays";
`docs/architecture/environments.md`; `docs/security.md` §5.

**Status.** ✅ In force.

## 3. No silent fallback for the data source

**Decision.** `VITE_DATA_SOURCE` resolves through `src/api/config.ts`: unset/`demo` → demo;
`api`/`production`/`prod`/`live`/`real`/`staging`/`stage` → api; **anything else is a boot
error** rendered by `ConfigGate` — no shell, no data, no login.

**Why.** Previously `VITE_DATA_SOURCE=production` silently resolved to demo, serving fabricated
records to someone who believed they had configured a real backend. That was the single most
dangerous defect in the codebase.

**Enforced by.** `src/api/__tests__/config.test.ts`, `src/__tests__/configGate.test.tsx`. The
older suite asserted the buggy behaviour was correct; it was inverted.

**Status.** ✅ In force.

## 4. Two independent axes: data source ≠ environment kind

**Decision.** `isDemoMode()` (build/config, from `VITE_DATA_SOURCE`) and the persisted
lifecycle state (`ava:demo:lifecycle`, runtime, per browser) are different facts and must never
be conflated. Demo-only affordances require **both**: `isDemoEnvironment()` =
`isDemoMode() && state === "demo"`.

**Why.** A demo-mode app can be running a customer's EMPTY environment. Labelling that
customer's own records as demo data is the same dishonesty as demo data pretending to be real.

**Rule.** Each axis answers a different question and a component must ask the right one. The
**data-source** axis decides whether a local-data affordance exists at all — in `api` mode there is
no local dataset to choose, reset, back up or sign into, so nothing of the kind renders. The
**environment** axis decides what such an affordance may *call itself*. Views therefore branch on
lifecycle state for **wording only**; seeding, filtering and hiding capability stay at the lifecycle
boundary (§5, §6). `useIsDemoEnvironment()` from `src/domains/demo/useDataLifecycle.ts` is the only
seam a view may use for that, which is why the login credential panel and the Settings data panel
read the same way.

**Enforced by.** `src/domains/demo/lifecycle.ts`, `docs/architecture/environments.md` →
"Two independent axes", and in the UI by `useIsDemoEnvironment()` from
`src/domains/demo/useDataLifecycle.ts` — consumed by `src/components/settings/DemoDataPanel.tsx`
and by `src/views/Login.tsx`. Tests: `src/views/__tests__/loginDemoIsolation.test.tsx` (api-mode
isolation), `src/views/__tests__/loginEmptyEnvironment.test.tsx` (EMPTY labels truthful **and**
the bootstrap entry preserved), `src/components/settings/__tests__/DemoDataPanel.test.tsx`.

**Status.** ✅ In force (Phase 2). The login screen's *wording* was corrected in the documentation
pass: it had been gated on the data-source axis alone, so an EMPTY environment was announced as a
demo one — see [OPEN_ITEMS.md](OPEN_ITEMS.md) H3.

## 5. Explicit lifecycle: UNINITIALIZED → { EMPTY | DEMO }

**Decision.** Three explicit states, owned by one boundary. First run shows a chooser; nothing
renders behind the gate while UNINITIALIZED. `EMPTY` means the visitor's own data (zero or
more records); `DEMO` means showcase/QA material.

**Why.** Implicit seeding on read made every environment ambiguous and made "empty product"
indistinguishable from "fresh install".

**Enforced by.** `src/domains/demo/lifecycle.ts`,
`src/components/lifecycle/DataLifecycleGate.tsx`, `FirstRunChooser.tsx`,
`src/domains/demo/__tests__/dataLifecycle.test.ts` (27 tests),
`docs/architecture/demo-data.md`.

**Status.** ✅ In force (Phase 2).

## 6. Lifecycle state is persisted, never inferred — and reads never write

**Decision.** The mode is a stored fact. It is **never** derived from row count: EMPTY with one
record is still EMPTY, and DEMO emptied by `clear()` is still DEMO. Reads are side-effect-free
with respect to lifecycle: `snapshot()` never seeds, repairs or writes; a corrupt or absent
payload produces an in-memory empty dataset with **zero** writes and leaves stored bytes
untouched.

**Why.** Inference from data makes the mode a function of user edits, and a read that writes is
unrecoverable from the UI and impossible to reason about.

**Enforced by.** `src/services/demoStore.ts` (`LIFECYCLE_STORAGE_KEY`, `isInitialized()` =
"a usable dataset is stored", not "the key exists"), `src/domains/demo/__tests__/dataLifecycle.test.ts`
(asserts `writtenKeys(storage) === []` after five kinds of read, and that the mode survives a
reload with zero rows), `src/domains/demo/__tests__/prototypePollution.test.ts`.

**Status.** ✅ In force (Phase 2).

## 7. Legacy datasets are adopted as DEMO, once, preserving everything

**Decision.** A stored dataset with no lifecycle marker is adopted as DEMO by
`persistLifecycleAdoption()` (in a hook effect — never during render, never from a repository
read). Only the marker key is written; dataset bytes are unchanged; no existing environment is
ever converted to EMPTY.

**Why.** Every dataset previous builds could write came from `createSeedDataset()` or a
demo-stamped operation, so DEMO is the only honest reading. Phase 1 `migrateDataset()` is
untouched and still runs on the same read path.

**Enforced by.** `src/domains/demo/useDataLifecycle.ts`,
`src/services/__tests__/demoStoreMigration.test.ts`, `docs/architecture/demo-data.md`.

**Status.** ✅ In force.

## 8. EMPTY must be usable, without breaking the zero-record invariant

**Decision.** `createEmptyDataset()` keeps every content collection at zero. The single
bootstrap administrator is added at the **lifecycle** layer (`createEmptyEnvironment()`), not
inside `createEmptyDataset()`, because authentication resolves a signed-in user from `users`.
The bootstrap account is not a demo account and carries no credential material beyond the
demo-mode passphrase mechanism.

**Why.** Without it, EMPTY is a dead end nobody can sign into; adding it inside the dataset
would break the pinned "all collections zero" invariant.

**Enforced by.** `src/domains/demo/seed.ts`, `src/domains/demo/lifecycle.ts`,
`src/domains/demo/__tests__/seed.test.ts`, `docs/architecture/auth.md` → bootstrap account.

**Status.** ✅ In force. Known limitation: `clear()` still empties `users` and locks everyone
out. The M1-specific recovery path is the separate gate-owned `uninitialize` flow; it does not
change the zero-record invariant or add an account back into the cleared dataset. See
[OPEN_ITEMS.md](OPEN_ITEMS.md) H5, which M1 landed as
`689a7c15951d690b1ce650a5938e6b1216ca30ed` and which stays in that file as a completed record,
because I10's zero-record invariant still constrains any future change to it.

## 9. Production means the API/backend — and it does not exist yet

**Decision.** Production is `api` mode against a real backend. `api` mode today is an
architectural seam, not a working configuration: no server, no database, no deployed endpoint.
Auth, authorization, schema, money precision, capacity enforcement, uploads, media storage,
audit logging and tenant isolation are **backend requirements**, never client-side promises.

**Why.** Anything else is a fake production backend, which is explicitly forbidden.

**Enforced by.** `docs/production-handoff.md` (blocker list + per-domain schema and
server-side enforcement), `docs/security.md` §8, `src/api/client.ts`, `src/api/errors.ts`
(the `ApiError.kind` model already represents e.g. `SCHEDULE_VERSION_CONFLICT`).

**Status.** ✅ Decision stands; backend ❌ not built.

## 10. Domain boundaries

**Decision.** One directory per domain under `src/domains/<domain>/`, following the Students
reference pattern: `types.ts` → `repository.ts` (interface) → `demoRepository.ts` →
`apiRepository.ts` → hook, wired in `src/domains/registry.ts`. Cross-domain reads go through
the other domain's hook, never through its store. Enrollment is the canonical Student ↔ Class
edge. `national_id` rules, cross-domain invalidation and the frozen demo clock (`ACADEMY_NOW`)
are owned by the domain layer.

**Why.** It is what makes Group A / Group D style work additive instead of invasive, and it
keeps the fixture-free guarantee checkable per domain.

**Enforced by.** `docs/architecture/data-layer.md` ("Domain model rules", "Enforced
boundaries", "Migration status"), `docs/architecture/students.md`,
`src/__tests__/architectureBoundaries.test.ts`, `src/domains/shared/__tests__/crossDomain.test.tsx`.

**Status.** ✅ In force. Gap: Finance and Reports still have no domain layer; Scheduling and
Attendance have one that their views do not use.

## 11. Scheduling: CLASS vs RECURRENCE vs SESSION — sessions are materialized

**Decision.** Three concepts are never collapsed. `CLASS` is the offering (classes domain);
`RECURRENCE` is `class.days`/`time`/`duration`, read-only from this domain; `SESSION` is one
real dated occurrence and is **materialized, not computed on demand**, because it carries
per-occurrence state (cancellation + reason, substitute teacher, room change, reschedule link,
attendance). Deliberately absent from a Session: `students[]` (roster is derived from active
Enrollment scoped to the date), `conflictWith` (conflicts are derived by `conflicts.ts`), and
any attendance summary (`attendanceAvg` is a projection). Dates are ISO-8601 `YYYY-MM-DD` with
`HH:mm` times; Jalali is a presentation concern handled at the UI edge via `dateBridge.ts`.

**Why.** A stored roster cannot express "joined in week 6, withdrew in week 8"; hand-stored
conflicts cannot react to a reschedule; a Persian-digit display string cannot be sorted,
bucketed or range-queried.

**Enforced by.** `src/domains/scheduling/types.ts` (the rationale is in its header comment),
`conflicts.ts`, `generation.ts`, `dateBridge.ts`, and 211 tests across
`src/domains/scheduling/__tests__/` (**Group A**).

**Status.** ✅ Domain complete and protected — 211 **Group A** tests, plus a further suite in the same
directory that is **not** Group A (`src/domains/scheduling/__tests__/useDerivedRead.test.tsx`, 9
tests): I13 **Checkpoint 3B** (`fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`) made `useDerivedRead`
carry its query key, so the three derived reads behind `useSessionRoster`, `useGenerationPreview` and
`useConflictCheck` expose only the session they were asked about, and `Paged<SessionListParams>`
(`7e72887761f07f48e115160611a9785bfaae9060`) makes omitting `per_page` a compile error at the call
site. ✅ **The view is wired to it (M4, 2026-09-14).** `src/views/Scheduling.tsx` no longer imports
`src/data/records.ts` at all: its rows are `Session` values read through `useSessions` for a bounded
`from`/`to` window, and its three operations — `rescheduleSession`, `cancelSession` and
`generateSessions` — are awaited repository calls made from
`src/views/scheduling/SessionWriteDialogs.tsx` and `src/views/scheduling/GenerateSessionsDialog.tsx`,
with `useConflictCheck` and `useGenerationPreview` driving those dialogs. **The decision above is
unchanged by the wiring, and the wiring did not touch this domain:** across the whole milestone the
only path under `src/domains/scheduling/` that changed is its README, so sessions are still
materialized, still carry no `students[]`, no `conflictWith` and no attendance summary, and Jalali is
still a presentation concern at the UI edge. What the view does **not** do is part of this record too:
no create, edit or delete surface — five verbs (`get`, `create`, `update`, `delete`, `sessionRoster`)
have no shipped caller, for the reasons in `src/domains/scheduling/README.md` §3 — no
recurrence-scoped write, no rendered roster, and no copy implying a server. **H1a is closed; H1 stays
OPEN** on its attendance half (**H1b**, M5's) — see [OPEN_ITEMS.md](OPEN_ITEMS.md) **H1**.
*(Superseded 2026-09-14, and kept as M4's record: **M5 landed and closed H1b, so H1 is closed.** The
"no rendered roster" clause needs one correction rather than a deletion — a roster **is** now rendered
in shipped UI, but not by this domain: the attendance view derives it through its own
`useSessionAttendance`, so scheduling's `sessionRoster` verb and the `useSessionRoster` hook behind it
are still unconsumed and now belong to no milestone. See **D13**.)*
*M2's record, kept because it explains why there was no write to wire:* M2
(`c42f274ac10d4087f9280e3bf7b47141d0672e32`) *removed* both «انتقال به اتاق ۴» controls rather than
wiring them, so between M2 and M4 what remained was fabricated **content** (a hardcoded room, weekday
and occupancy narrative), not a claimed write.

## 12. Attendance and progress are append-only; corrections require a reason

**Decision.** Attendance marks about a minor are never silently edited: the current record stays
mutable for fast reads, but every change appends an immutable `AttendanceCorrection` carrying
`previousStatus`, `newStatus` and a **required** reason. Corrections are never edited or
deleted. `ProgressEvent` follows the same discipline (`POST /progress-events` only — no PATCH,
no DELETE). Server-side this must be enforced by table grants (INSERT-only), not by convention.

**Why.** "My child WAS there" is a dispute about a child's record; an unauditable edit is
unacceptable.

**Enforced by.** `src/domains/attendance/types.ts` (corrections section),
`src/domains/attendance/apiRepository.ts`, `src/domains/progress/repository.ts`,
`src/domains/progress/demoRepository.ts`, and the Group D suites
(`src/domains/attendance/__tests__/`: `demoRepository`, `roster`, `useAttendance` — 79 tests)
plus `src/domains/progress/__tests__/`.

**Status.** ✅ In force and protected — **and since M5, in front of users.**
`9505ade4011b37a34e3488fd51206512829205ec` wired `src/views/Attendance.tsx` to this domain without
changing a file in it, so the decision is now exercised by shipped UI rather than only by Group D:
`record`, `bulkRecord` and `correct` are all awaited, a correction requires a reason before any write
is attempted, the trail is read back newest-first and paginated, and **no control offers an update, a
delete or an un-record** — `src/views/__tests__/attendanceWrites.test.tsx` asserts the absence of
«حذف», «پاک کردن», «بازگرداندن», «ویرایش رکورد» and «ثبت نهایی» rather than trusting it, and
`src/views/__tests__/attendanceNoFixtures.test.ts` forbids the verbs the interface does not have
(`.update(`, `.delete(`, `.remove(`, `.save(`, `.destroy(`, `.bulkSave(`). Provenance comes from the
authenticated principal (`recorderId = user?.id`), never from a form field, so `changedByUserId` is a
fact about the session rather than a claim by the operator. Cancellation stays domain-owned: the view
reports the `locked` flag the repository derived from `session.status === "cancelled"` and withdraws
its controls instead of deciding lock state itself.

## 13. Media: metadata in the dataset, bytes in IndexedDB — never a fabricated URL

**Decision.** Media metadata lives with the dataset; bytes live in IndexedDB through one blob
store. Missing bytes produce an explicit unavailable state. Downloads use real object bytes
(`src/lib/download.ts`), never an invented URL. Audio playback never decodes what it does not
have. Demo library material (`res1` / `md_demo_res1`) is provisioned **only** in a DEMO
environment, and `uninitializeEnvironment()` removes binaries so they cannot leak into the next
environment.

**Why.** A placeholder that looks like a file teaches the user to distrust every file, and a
fake download URL is a lie with a progress bar.

**Enforced by.** `src/domains/media/useMedia.ts`, `src/domains/library/useLibrary.ts`,
`src/domains/library/demoContent.ts`, `src/domains/demo/librarySeed.ts`,
`src/views/__tests__/Library.test.tsx`, `src/domains/library/__tests__/`,
`docs/architecture/data-layer.md` → "Media: metadata in the dataset, bytes in IndexedDB".

**Status.** ✅ In force (Phase 1 + Phase 2).

## 14. No-data is an explicit typed value, never `NaN` and never a consumer-side patch

**Decision.** Aggregations over an empty set return `null` (`meanOf`, `ratioPct`, `topBy` in
`src/lib/stats.ts`), and formatting renders `NO_DATA = "—"` (`src/lib/format.ts`,
`faPercent(number | null)`). Empty states are fixed at the computation/domain boundary.
Blanket `|| []` / `?? []` patches at consumers are forbidden: they hide broken contracts.

**Why.** `0/0` prints as `NaN٪` in a Persian UI, and a defensive `|| []` in twelve views leaves
the real bug — a function that promises a number it cannot produce — in place.

**Enforced by.** `src/lib/stats.ts`, `src/lib/format.ts`,
`src/views/__tests__/emptyEnvironment.test.tsx` (full-shell walk of all 16 surfaces in EMPTY,
asserting no `NaN`/`Infinity` artefacts), `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx`.

**Status.** ✅ In force (Phase 2). Latent risk: `Sparkline` and `BusinessIntelligence` still
crash on an empty series — unreachable today because their callers pass static fixtures.

## 15. Honesty rules for UX

**Decision.** No fake success toasts, no fabricated metrics presented as measurement, no
swallowed errors, no hardcoded fallback data, no demo labelling on a customer's own data.
"Academy intelligence" is a product/UX pattern (signal → evidence → insight → action) over
display data and makes no claim of real AI. Recommendations stay deterministic before any AI.

**Why.** Every one of these teaches the operator that the panel lies, and the panel's whole job
is to be trusted with children's records and money.

**Enforced by.** `src/__tests__/privacyPosture.test.ts` ("Fixture data shown as real
measurement — REMOVED"), `src/__tests__/architectureBoundaries.test.ts`,
`src/__tests__/writeFeedbackHonesty.test.ts`, `src/views/__tests__/noSuccessWithoutWrite.test.tsx`,
`src/views/__tests__/honestWriteCopy.test.tsx`,
`docs/architecture/data-layer.md` → "Chat delivery honesty" and "Analytics — every definition
is explicit", `README.md`.

**Status.** ⚠️ Decision stands. The two violations M2 was scoped to remove are **removed**: none of
the seven fake-success sites (**H2**) claims a write any more — each now reports honestly in `info`,
performs a truthful navigation, or is gone — and the five demo-mislabelled real writes (**H3**) take
their wording from `useIsDemoEnvironment()`, so a customer's own record is no longer announced as
demo data. Both are now enforced rather than merely decided: a view that cannot reach a repository
may not report success at all, and a confirmation may not hardcode the demo label outside an
explicitly tracked exception list.

**Violations that remain,** all recorded with evidence in [OPEN_ITEMS.md](OPEN_ITEMS.md): the
dashboard insight panels presenting fabricated text as measurement (**H4**, which M9 owns), and the
attendance «ثبت نهایی» wording, deferred to the attendance wiring by explicit decision (**I12**,
which M5 owns).

**Closed since M2:** the three Settings panels that hardcoded the demo label on a real write
(**H7**) and the edit dialogs that opened with an empty draft and could silently overwrite a stored
record (**H6**) both landed in **M2.1** (`73b40d9`). The honesty ratchet in
`src/__tests__/writeFeedbackHonesty.test.ts` therefore tracks **zero** files carrying a hardcoded
demo label, and pins all eight surfaces that derive their copy from the environment seam — so this
decision now has no known violation left in the write-feedback path it governs.

## 16. Protected domains and the no-regression principle

**Decision.** Some areas are protected: a bug is fixed at the boundary that owns it, assertions
are never weakened to get green, and a phase that touches a protected area re-runs its suites
explicitly. Protected today: **Group A** (scheduling), **Group D** (attendance), library/media
bytes, student profile, messages dataset, persistence (migration/backup/restore/integrity),
layering, privacy posture, CSP compatibility, route protection — and these engineering
documents.

**Why.** Regression is the cheapest way to destroy finished work, and a weakened test destroys
the evidence that the work was finished.

**Enforced by.** The suites listed in [PROJECT_STATE.md](PROJECT_STATE.md) §6, plus
`src/__tests__/projectState.test.ts` for this document set.

**Status.** ✅ In force. At `33b1031`: Group A + Group D 314 tests green, protected-domain run
15 files / 166 tests green.

## 17. Privacy is a product property

**Decision.** The panel is private: no indexing, no share metadata, no sitemap, no product or
operator name in the document title, secrets only via build config, and no private keys, JWTs or
32-hex access slugs anywhere in source. The demo passphrase is a deliberately committed,
development-only, non-secret value documented in `docs/architecture/auth.md` — and it is kept
out of these engineering documents so they stay safe to paste into any session context.

**Enforced by.** `src/__tests__/privacyPosture.test.ts`, `src/__tests__/cspCompatibility.test.ts`,
`docs/security.md`, `public/robots.txt`, `index.html`.

**Status.** ✅ In force. Edge/nginx header configs exist but were **not deployed** by this work.

## 18. Boot chain and access path — nothing renders above a gate it depends on

**Decision.** The application boots through a fixed chain, and each gate exists to refuse one
specific kind of lie:

```
src/main.tsx   AccessGate          the panel is private; the access path comes from build
                                   config, never from a literal in source
src/App.tsx    ConfigGate          refuse to boot on an unrecognised data source (§3)
               DataLifecycleGate   decide what KIND of local environment this is before
                                   anything reads it (§5) — mounted ABOVE AuthProvider,
                                   because authentication resolves the signed-in user
                                   from the dataset's own `users` collection
               AuthProvider        session, then AuthGate, then the shell and the views
```

**Rule.** No view, panel or provider may be mounted above a gate whose decision it depends on:
nothing that reads the dataset may sit above `DataLifecycleGate`, nothing that renders a route may
sit above `ConfigGate`, and nothing at all may sit above `AccessGate`. The access-path slug is
*generated* — `scripts/gen-access-path.mjs` writes `src/security/accessPath.ts` — and must never be
hardcoded, committed as a literal, or logged.

**Why.** Each gate closes a failure that already happened or was one refactor away. Reading the
environment before it has been chosen is precisely how implicit demo seeding kept creeping back
into read paths (§5, §6). Booting on a mistyped data source used to serve fabricated records to
someone who believed they had configured a real backend (§3). And the access-path slug is the only
thing keeping a private panel out of indexes and "sites running X" datasets, so a hardcoded
literal would publish it to Git and to every clone.

**Enforced by.** `src/main.tsx`, `src/App.tsx` (the order is documented in its own comment block),
`src/security/AccessGate.tsx`, `src/security/accessPath.ts`, `scripts/gen-access-path.mjs`,
`src/__tests__/routeProtection.test.tsx`, `src/__tests__/configGate.test.tsx`,
`src/components/lifecycle/__tests__/DataLifecycleGate.test.tsx`, and the "hardcodes no access path"
rule in `src/__tests__/privacyPosture.test.ts`.

**Status.** ✅ In force. The M1-specific recovery path is gate-owned and reachable from the
unauthenticated branch outside the signed-in shell for local EMPTY/DEMO environments; API mode
has no local recovery affordance. M1 landed as `689a7c15951d690b1ce650a5938e6b1216ca30ed` with its
lockout/way-back tests green — recorded in [PHASES.md](PHASES.md) and validated in
[PROJECT_STATE.md](PROJECT_STATE.md) §4 — so the recovery path is no longer provisional. What is
still open is everything it deliberately did not touch: `clear()` semantics and the zero-record
invariant (**I10**).

---

## 19. Product-phase decision register (D1–D19)

Nineteen decisions gate the product-feature phase planned in
[PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md). They are numbered **D1–D19** to
keep them distinguishable from the §1–§18 architecture decisions above, which they never override:
where a D-entry touches an existing section, that section is the authority and the D-entry says so.
Twelve are decided (**D3** and **D4** by M1's landing, **D10**, **D11** and **D12** by M3's, **D13** by
M5's, **D14**, **D15** and **D16** by M6's, **D17** by M7's, and **D18** and **D19** by the **Class
Compensation P1** workstream's landing `a21311d7e32c82e3a46b1581c94f6b3478bf646c` — the first two
decided outside the M0–M11 milestone sequence), two are settled by deferral
(**D1**, **D6**), and five are open (**D2**, **D5**, **D7**, **D8**, **D9**) —
each open entry names the milestone it blocks. An open decision is **not** an invitation to implement
— it is a stop sign with a reason. The three M3 entries were missing from this table until M4's CP0
documentation reconciliation, while their sections below already existed; the heading's **D1–D12**
was right and the table was not. **D13** was added by M5's documentation reconciliation, together with
its table row and its section, so that neither half drifts the way those three did. **D14–D16** were
added the same way by M6's documentation reconciliation — each with its row and its section, written
from M6's measured evidence rather than from its plan. **D18 and D19 were added the same way by Class
Compensation P1's** — with their rows and their sections, written from what landed. **D17's row is
repaired here too:** the M7 reconciliation (`e7a6d72`) added its section and updated this heading and
tally, but the table stopped at D16 — the same "heading right, table wrong" failure this paragraph
records for the M3 trio, caught this time by the reconciliation that followed rather than by the next
milestone.

| ID | Decision | Status | Blocks |
|---|---|---|---|
| D1 | Student / guardian role in this panel, or a separate app | **DEFERRED** | M-none (I5, I4) |
| D2 | Branding as the source of truth for the academy identity | **OPEN** | M8 |
| D3 | Where the environment-recovery affordance lives | **DECIDED — M1-specific** | M1 |
| D4 | `clear()` semantics against the zero-record invariant | **DECIDED — M1-specific** | M1 |
| D5 | Shape of the fixture / type / seed separation | **OPEN** | M10 |
| D6 | Creating the finance and reports domains in this phase | **DEFERRED** | M-none (I2) |
| D7 | How accessibility is enforced | **OPEN** | M11 |
| D8 | How the api-mode hybrid is disclosed | **OPEN** | M11 |
| D9 | Bundle budget | **OPEN — measure first** | M11 |
| D10 | A write target taken from a rendered row is paired with a parent resolved independently | **DECIDED — landed with M3** | M3 |
| D11 | An assignment surface renders outside the list it assigns to, and derives its own selection | **DECIDED — landed with M3** | M3 |
| D12 | A failed secondary read is reported as a failure, never as an empty list | **DECIDED — landed with M3's F1 fix** | M3 |
| D13 | A wired view derives its own selection and renders the register its own domain derives | **DECIDED — landed with M5** | M5 |
| D14 | An operation the existing contract already expresses gets no new verb and no second write or read path | **DECIDED — landed with M6** | M6 |
| D15 | An attachment is a reference (`mediaId`), not a copy — resolution is not authorization, and bytes never travel in an export | **DECIDED — landed with M6** | M6 |
| D16 | Write state and in-flight work are keyed to the identity they started with, not to whatever is on screen when they resolve | **DECIDED — landed with M6** | M6 |
| D17 | A relation is a bounded repository read, and a count is a claim that needs a complete one | **DECIDED — landed with M7** | M7 |
| D18 | A compensation is an obligation of its own, keyed by a typed id, with a derived state and an append-only attempt ledger | **DECIDED — landed with Class Compensation P1** | P1 / later consumers |
| D19 | Compensation is one-to-one only, registered by a person, and the make-up is an ordinary session booked through the scheduling repository | **DECIDED — landed with Class Compensation P1** | P1 / later consumers |

### D1. Student role — deferred, not designed

**Decision.** No `student` role is added to this panel in the product phase. The question stays
open exactly as [OPEN_ITEMS.md](OPEN_ITEMS.md) I5 frames it — a role in this panel, or a separate
app — and is **deferred by product-owner instruction (2026-09-09)**. Nothing is implemented before
the decision is recorded here as decided.

**Why.** `src/domains/auth/permissions.ts` states that frontend RBAC is UX only and that real
authorization must be enforced server-side; there is no server. A `student` principal in a
browser-local environment would see the same `localStorage` as the administrator, so the role
would be a **security boundary that does not exist** — a fake UX of exactly the kind §15 forbids.
Attendance and progress records concern minors, so `docs/security.md` §7 and the privacy section of
`docs/production-handoff.md` apply to any future design.

**Enforced by.** [OPEN_ITEMS.md](OPEN_ITEMS.md) I5 (*"Do not implement before the role decision is
recorded in DECISIONS.md"*), `src/domains/auth/permissions.ts`, and the absence of any student
workspace in `src/views`.

**Status.** ⏸️ Deferred by decision. Consequence: I5 and I4 (teacher visual workspace — what a
teacher role may see is the same authorization question) stay out of the phase. The chat domain
already models a student *counterpart* (`ChatParticipantRole` includes `student` and `guardian`),
which is not a login principal and is unaffected. **Since M5 the deferral is stated in the UI rather
than merely absent from it:** the wired attendance register and its correction dialog each say out loud
that no teacher, student or guardian is notified, and no `sendMessage` call exists anywhere in
`src/views/Attendance.tsx` or `src/views/attendance/`. The H2 site that once claimed «پیام پیگیری
ارسال شد · … و ولی ایشان مطلع شدند» was removed at M2 and did not return beside the real writes —
see [OPEN_ITEMS.md](OPEN_ITEMS.md) **H2** and **I7**.

### D2. Branding is the source of truth for the academy identity

**Decision.** To be recorded before M8: the academy name, tagline, colours and font shown in the
shell, the login screen and exports come from the persisted `BrandingSettings`, and the fixture
value in `src/data/academy.ts` is demo seed material only. The shipped default name is decided in
the same entry — today `DEFAULT_BRANDING.academyName` in `src/domains/branding/types.ts` is
«آموزشگاه موسیقی پارسیان» while the fixture `academy.name` rendered on screen is «آکادمی موسیقی
آوا», and the two cannot both be the product's name.

**Why.** `src/domains/branding/useBranding.ts` already implements `applyBranding` with a
CSS-injection guard and is tested — but it has **only test callers**, and the `--brand-*` custom
properties it writes have **zero consumers**. Meanwhile `src/components/layout/Sidebar.tsx` and
`src/views/Login.tsx` render the fixture name. The result is a settings panel that saves an identity
the product does not use: a write that visibly does nothing is the same dishonesty as a fake
success toast (§15).

**Enforced by.** `src/domains/branding/useBranding.ts`, `src/domains/branding/types.ts`,
`src/domains/branding/__tests__/branding.test.ts`, and — once M8 lands — the design-system token
definitions in `src/index.css` plus a test asserting the saved identity is the rendered identity.

**Status.** 🔶 Open. Blocks M8. Constraints that are not negotiable: writes stay in the CSSOM
(`style-src 'self'` with `style-src-attr 'unsafe-inline'` as the one narrow exception — see
`deploy/nginx.conf` and `src/__tests__/cspCompatibility.test.ts`), and `logoMediaId` /
`faviconMediaId` remain `MediaAsset.id` references, never data URLs (§13).

### D3. Placement of the environment-recovery affordance

**Decision.** For M1, recovery/uninitialization is owned by the lifecycle gate and is reachable
outside the signed-in shell. The gate-owned controller may hand the visible affordance to the
unauthenticated branch, but it must never render recovery controls inside `Shell` or `Settings`.
It is available only for initialized local EMPTY/DEMO environments; API mode remains transparent.

**Why.** §18 forbids mounting anything above a gate whose decision it depends on. Recovery changes
the lifecycle state, so it must render **at or below** `DataLifecycleGate` in the boot chain
(AccessGate → ConfigGate → DataLifecycleGate → AuthProvider); placing it above would let a control
mutate the environment before the environment's kind has been decided, which is precisely the
failure §5 and §6 were written to prevent.

**Enforced by.** `src/components/lifecycle/DataLifecycleGate.tsx`, `src/domains/demo/lifecycle.ts`
(`uninitializeEnvironment`), `src/__tests__/routeProtection.test.tsx`, and the gate tests in
`src/components/lifecycle/__tests__`.

**Status.** ✅ M1-specific decision. This does not generalize to backend or production
architecture. API mode has no local environment to recover and exposes no affordance.

### D4. `clear()` keeps its meaning; recovery is `uninitialize`

**Decision.** For M1, existing `clear()` semantics remain unchanged: it continues to empty every
collection including `users`. The recovery/uninitialization path is **`uninitialize`**, not a
re-added bootstrap account.

**Why.** §8 and [OPEN_ITEMS.md](OPEN_ITEMS.md) I10 pin the invariant: an empty dataset keeps every
collection at zero, and the single bootstrap administrator is added at the **lifecycle** layer
(`createEmptyEnvironment()` in `src/domains/demo/lifecycle.ts`), not inside the dataset, because a
dataset that quietly contains an account is not empty. `src/domains/demo/__tests__/seed.test.ts`
pins it. Weakening it to make recovery convenient would trade a durable invariant for a shortcut,
and §16 forbids that trade.

**Enforced by.** `src/domains/demo/__tests__/seed.test.ts`, `src/domains/demo/lifecycle.ts`,
`src/domains/demo/useDemoData.ts` (whose `DESTRUCTIVE_LABELS` must state the real consequence), and
the lockout/recovery tests M1 adds.

**Status.** ✅ M1-specific decision. This does not generalize to backend or production
architecture. Clearing removes **records** and keeps the environment and its mode;
uninitializing removes **the environment itself**, binaries included.

### D5. Fixtures have three roles; only one of them is a defect

**Decision.** To be recorded before M10 (and known from M4 onward): `src/data/records.ts` and
`src/data/academy.ts` are split by role — **entity types** move to their owning domains, the
**canonical DEMO seed** moves under `src/domains/demo/`, and the third role, **fake data for
unwired views**, is deleted once M4–M9 have removed every reader. The modules are *relocated*, not
removed: DEMO is a first-class environment (§2) and its showcase dataset must stay exactly as rich.

**Why.** The two files are 822 and 539 lines with **51 non-test importers**. `src/data/records.ts`
defines `Student`, which `src/domains/students/types.ts`, `src/domains/teachers/types.ts` and
`src/domains/classes/types.ts` re-import so there is one source of truth; and
`src/domains/demo/seed.ts` *derives* the shipped demo dataset from the same fixtures. Treating the
files as "fake data to delete" would break the type layer and the seed together — and §16 makes
that a regression, not a cleanup.

**Enforced by.** `src/domains/demo/__tests__/seed.test.ts`,
`src/services/__tests__/demoStoreMigration.test.ts`, `src/__tests__/architectureBoundaries.test.ts`
and the new M10 boundary test asserting no view imports those modules at all.

**Status.** 🔶 Open. Blocks M10; constrains M4–M9 (they remove *data* imports only, never the type
or seed roles). **M4 has removed its reader:** `src/views/Scheduling.tsx` imports neither
`src/data/records.ts` nor `src/data/academy.ts` any more. The scheduling fixtures stay in the dataset
because `src/views/Classes.tsx` still reads them — the third role retiring one reader at a time, with
the type and seed roles untouched. **M5 has removed the attendance view's reader too, and is the
clearest case yet of the three roles being separable:** `src/views/Attendance.tsx` and both of its
panels import nothing from either module, so `todayAttendance`, `attendanceTrend`, `attendanceByDay`,
`attendanceLabel` and `AttendanceRoster` have no reader in the view that owns them — while the **seed**
role survives untouched (`src/domains/demo/seed.ts:166` still seeds a legacy `attendance` collection
and `src/domains/demo/backup.ts:242` still reads it, so a round-trip stays lossless) and the **type**
role was never in question. Deleting the fixtures was therefore *not* possible inside M5's
authorization, and the one remaining shipped reader is `src/views/Reports.tsx:143` (`attendanceByDay`)
— **I2** and M9's. **M7 has now removed the three profile surfaces' *relation* readers** (`f1ec0ddde783aec14d6429ac2457f085f851ad9a`): `src/views/Students.tsx`, `src/views/Teachers.tsx` and `src/views/Classes.tsx` resolve every foreign key, roster, seat count, room and weekly window through the domains and import only **label maps and types** from `@/data/records` — `teacherById`, `studentById`, `classById`, `roomById`, `weekSessions`, `TODAY_INDEX`, `academyClasses` and the denormalized `AcademyClass.studentIds` projection are all forbidden in those files by `src/views/__tests__/relationsNoFixtures.test.ts`, which now enforces five surfaces with empty deferral ledgers. What still reads the fixtures is the *third role* elsewhere and untouched: `src/views/Library.tsx` (`libraryShelves`), `src/views/Settings.tsx` (`settingsSections`), the composer templates in `src/views/Messages.tsx` (`messageTemplates`), `Finance.tsx`/`Reports.tsx` (**I2**) and the dashboard insight panels (**M9/H4**) — so this decision is still **Open**, its **Enforced by** list now includes M7's gate, and the M10 boundary test that will cover *every* view is still to be written. M7 also retired the *count* half of the same habit in the chrome rather than moving it: see **D17**. One deliberate non-change belongs to this entry: `attendance` **stays** in
`src/views/__tests__/emptyEnvironment.test.tsx`'s fixture list, because that membership asserts
`inFlightMarkers() === 0` — a semantic claim about issuing no domain read, which a wired view would
fail — and moving it would have been a test-semantics change the milestone was not authorized to make.
Only that file's labels and comments were corrected.

### D6. Finance and reports domains are not built in this phase

**Decision.** No `finance`, `reports`, `messaging` or `notifications` domain is created in the
product phase — **deferred by product-owner instruction (2026-09-09)**. What the phase does instead
is stop their controls from lying: the fake reminders and the fabricated follow-up message are
disabled or removed in M2.

**Why.** The four README stubs state the contracts that make these domains non-trivial: balances
are computed by Finance and **never** from session counters, and reports are *"authoritative
server-side results, not client-side math"*. Money precision, idempotency and gateway behaviour are
backend requirements listed in `docs/production-handoff.md`. A local implementation would either
duplicate that logic in the browser or fake it — §15 forbids the second and
[OPEN_ITEMS.md](OPEN_ITEMS.md) I2 scopes the first as its own phase.

**Enforced by.** `src/domains/finance/README.md`, `src/domains/reports/README.md`,
`src/domains/messaging/README.md`, `src/domains/notifications/README.md`, and the honest
`tone: "info"` "requires a server" toasts in `src/views/Finance.tsx` and `src/views/Reports.tsx`.

**Status.** ⏸️ Deferred by decision; I2 stays open. The `invoices` and `payments` collections
continue to persist and to be validated for referential integrity by the backup contract — they are
not deleted, they are simply not yet read by a domain.

### D7. Accessibility is enforced without a new dependency

**Decision.** To be recorded before M11: a11y assertions are written with the tooling already
present (Testing Library queries by role and accessible name, focus assertions, and a
`prefers-reduced-motion` case). Adding an automated audit dependency requires separate
authorization and is **not** assumed by this phase.

**Why.** §10 of [PROJECT_STATE.md](PROJECT_STATE.md) forbids adding dependencies without
authorization, and `package.json` contains no axe-family package today. Forty-two source files
already carry `aria-*`/`role` attributes and the motion preference is honoured and persisted, so
the gap is **assertions**, not implementation — and assertions can be written with what exists.

**Enforced by.** the milestone suites added in M11, alongside the existing behaviour tests; the
product requirement itself is §10's *"Persian-first, RTL, accessible, performant"*.

**Status.** 🔶 Open. Blocks M11.

### D8. api mode must disclose which domains are still local

**Decision.** To be recorded before M11: the ten registry getters that resolve to the Demo
implementation in **both** modes become visible to the operator as local, rather than being implied
to sit behind the configured API.

**Why.** `src/domains/registry.ts` already documents the reason those getters do not switch:
*"silently returning demo data while claiming to be in API mode would be exactly the dishonest
fallback"* §37 of `docs/architecture/data-layer.md` forbids. Only seven getters switch on
`isApiMode()`, while nine domains already ship an `apiRepository.ts` that nothing selects. An
operator who sets the data source to `api` therefore gets a hybrid, and a hybrid that does not say
so reads as a production-ready deployment (§3, §9, §15).

**Enforced by.** `src/domains/registry.ts`, `docs/architecture/data-layer.md`, and the M11 test
that asserts the disclosure renders in api mode and not in demo mode.

**Status.** 🔶 Open. Blocks M11. Note the deployment constraint that goes with it: both edge
configs set `connect-src 'self'`, so an api deployment is same-origin or the CSP changes by
recorded decision.

### D9. The bundle budget is measured before it is set

**Decision.** No numeric budget is written into this register until M11 has measured a real build
and recorded the numbers. The budget then becomes a **test**, and it may never be satisfied by
raising `chunkSizeWarningLimit`.

**Why.** [OPEN_ITEMS.md](OPEN_ITEMS.md) I6 requires the warning to be resolved *"by real splitting
(not by raising the warning threshold), with a measured before/after"*. `dist/` is a gitignored
build artifact and is absent from a fresh workspace, so any size quoted from memory is unverifiable
— including I6's own figure, which is dated to `33b1031`. A budget chosen before measurement is a
guess with a test wrapped around it.

**Enforced by.** `vite.config.ts`, `src/App.tsx` (13 static view imports, no `lazy`/`Suspense`
today), `src/index.css` (the six imported `@fontsource/vazirmatn` weights, of which the design
system uses four), `src/__tests__/cspCompatibility.test.ts` and the budget assertion M11 adds.

**Status.** 🔶 Open — deliberately empty. Blocks M11, and is filled in by M11's measurement step.

### D10. A write target taken from a rendered row is paired with a parent resolved independently

**Decision.** When a surface writes through a rendered row *and* needs that row's parent context —
a program, an album, a session, a student — the row's id comes from the row and the parent's id comes
from the query that produced the **current selection**. Reading the parent back off the row is
forbidden, even when the two are equal in the honest case, and even when the repository would accept
it. M3's assignment surface therefore calls `attachContent(levelId, contentId, { programId })` with
`levelId` from the level row and `programId` from `usePrograms`' selection.

**Why.** A guard that compares two values taken from one object is a tautology: it cannot fail, so it
proves nothing — the limitation [OPEN_ITEMS.md](OPEN_ITEMS.md) I13 recorded against its own
Checkpoint 2. And the two values genuinely *can* disagree, because a list hook commits a frame
holding the previous query's rows while the selection has already moved (I11/I13). Pairing
independently is what turns that disagreement into an honest refusal at the repository instead of a
silent write into the wrong parent.

**Enforced by.** `src/domains/learning/LearningPanel.tsx` (the wiring),
`src/domains/learning/demoRepository.ts` (`LINK_INVALID` before the duplicate check),
`src/domains/learning/__tests__/attachContentIntent.test.ts` (the guard, and the tautology named as a
failure mode) and `src/domains/learning/__tests__/contentAssignmentFlow.test.tsx`, which reproduces
the crossed frame at the repository boundary, asserts the repository was handed the independent
program, and goes red when the wiring is mutated to `contentLevel.programId` — so the rule is pinned
by a test that fails without it, not by a sentence.

**Status.** ✅ Landed with M3's first checkpoint `e5b0a57d8f33dc04838670a2cd4158a88dd34022`. Binding on M4, M5 and every later
surface that writes through a rendered row: the mutation check above is the acceptance test for this
decision, and a new surface that cannot fail it has not proved anything. **M4 is bound by it and
honours it:** the scheduling view resolves its write target against the loaded page rather than storing
a `Session`, so a window change that stops resolving the id leaves no target and no dialog — asserted by
`src/views/__tests__/schedulingStaleWindow.test.tsx`, which also asserts that a superseded window's
late answer is ignored. **No mutation or reversion check was recorded for M4's own checkpoints**, so
this is behavioural evidence rather than the mutation evidence M3 carries, and it is recorded as the
weaker of the two.

### D11. An assignment surface renders outside the list it assigns to, and derives its own selection

**Decision.** `LevelContentPanel` is a sibling of the levels grid inside `LearningPanel`'s panel, not
a row of the levels column. Everything it can act on is **derived**, never stored: the level is
`levels.find(id)` over the current query's rows, the picked content is kept only if it is in *this*
level's available rows, and the selection is dropped when the selected program changes.

**Why.** The levels column's row count is an assertion in a protected harness —
`src/domains/learning/__tests__/LearningPanel.test.tsx` counts every `li` in that column — and mixing
content rows into it would make the level list claim rows it does not own. Deriving instead of storing
is the same principle as I13 Checkpoint 1 applied to local state: a stale id then resolves to
*nothing* rather than rendering a target that no longer belongs to the selection, so a mid-switch
frame cannot leave an armed button pointing at the previous level.

**Enforced by.** `src/domains/learning/LevelContentPanel.tsx`,
`src/domains/learning/LearningPanel.tsx`,
`src/domains/learning/__tests__/LevelContentPanel.test.tsx` (the level-switch case, which fails when
the pick is stored raw instead of derived, and the in-flight case, which fails when the empty state is
shown while a read is pending) and `src/domains/learning/__tests__/LearningPanel.test.tsx` —
unchanged and green, which is the evidence that the levels column still counts only levels.

**Status.** ✅ Landed with M3's implementation checkpoint `e5b0a57d8f33dc04838670a2cd4158a88dd34022`.
**The same reasoning was applied again at M5, to a different domain:** attendance's `get` verb has no
shipped UI caller, because the register is read for the **derived** selected session and the mark a
correction targets is a row the register or the record list already holds — a second read by id would
add a second copy of the same fact, and a second copy a write could target after the window moved. See
**D13** and `src/domains/attendance/README.md` §3.

---

### D12. A failed secondary read is reported as a failure, never as an empty list

**Decision.** When a surface renders more than one read, **each read owns its own error**. A read that
failed renders an error carrying the failure's own message and a retry, and withholds whatever that
read would offer — even when another read on the same screen answered honestly. It never renders the
empty copy, and it never offers choices from a page it cannot currently justify.

**Why.** The shared list hook keeps the previous page when a *refetch* fails
(`src/domains/shared/useResource.ts:113`) while publishing `error` beside `items`
(`src/domains/shared/useResource.ts:55`). A consumer that destructures only `items` therefore cannot
distinguish "the read found nothing" from "the read failed", and renders whichever of two lies is
handier: an empty copy claiming the data does not exist, or a picker offering writes the read cannot
support. This is the `error` half of the family **I13** Checkpoint 1 fixed for `loading`, and until
M3's acceptance audit nothing in the codebase pinned it.

**Enforced by.** `src/domains/learning/LevelContentPanel.tsx` — the catalogue read consumes `error`,
`available` is withheld while it is set, and only the add affordance is replaced by an `ErrorState`,
so the links above (whose read answered) stay rendered — and
`src/domains/learning/__tests__/LevelContentPanel.test.tsx`, whose F1 case makes `listContent` reject
*only* for the catalogue query and asserts the false-empty copy is absent, that no picker and no
submit button exist, that the linked row is still shown, and that the retry restores the picker. That
case fails against the pre-fix component (1 failed / 11 passed), so the rule is pinned by a test that
detects its violation rather than by this sentence.

**Status.** ✅ Landed with M3's completion checkpoint `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`.
**Scope is deliberately one surface:** fourteen other consumers still discard `error` — recorded as
[OPEN_ITEMS.md](OPEN_ITEMS.md) **I15**, not authorized, not started. This decision states the rule the
product means; it does not claim the codebase obeys it.
**M5 obeyed it at a second surface, and at a wider one:** `src/views/Attendance.tsx` renders **six**
independent error states — sessions (`:524`), classes (`:563`), the register (`:587`), recorded
absences (`:636`), the window's records (`:712`) and the correction trail (`:766`) — each with the
failure's own message and its own retry, and each withholding only what that read would offer. A
failed register read therefore offers **no write at all**, asserted by
`src/views/__tests__/attendanceWrites.test.tsx` ("reports a failed register read with a retry, and
offers no write") and ("reports a failed session read with its own message and a retry, never as an
empty window"). **I15's count is unchanged by this:** M5 fixed its own surface, as M3 did, and did not
touch the fourteen others.

---

### D13. A wired view derives its own selection, and renders the register its own domain derives

**Decision.** `src/views/Attendance.tsx` derives the session it shows from the window it read —
`sessions.items.find((row) => row.id === selectedSessionId)` over the page currently on screen — rather
than storing a selection, and it renders the register its **own** domain derives: one
`useSessionAttendance` pass, in which the attendance repository joins the roster resolved from active
Enrollment at that session's date with whatever marks exist. It does this even though the scheduling
domain offers `sessionRoster` and `useSessionRoster` for the same session. And where a hook it depends
on cannot guarantee what its own doc comment claims (**I13**), the view **guards the exposure at its own
boundary and keeps the defect named** instead of either fixing a frozen domain file or shipping the
exposure silently.

**Why.** A stored id outlives the window that produced it, so a day/week switch, a refetch or a
truncated page can leave a selection no row justifies — the principle **D11** and I13 Checkpoint 1
already established, applied to a session instead of a level. A register assembled from two domains
would oblige the view to reconcile two rosters, and a view that reconciles is a view that can disagree
with both; the attendance domain already derives one, atomically, with the marks joined in the same
pass, so rendering what the domain owns removes the disagreement rather than managing it. Choosing the
sibling verb would also have made a *scheduling* protection depend on an *attendance* read. The guard
exists because M5's authorization froze every file under `src/domains/`: `useSessionAttendance` still
carries no query key, so a committed frame can hold the previous session's register, and the honest
options were to withhold the register while identities disagree or to render it.

**Enforced by.** `src/views/Attendance.tsx:237` (the derived selection), `:241` (the domain's own
register) and `:250` (the boundary guard, `attendance.sessionId === selectedSessionId`);
`src/views/__tests__/attendanceNoFixtures.test.ts` — "selects a session from the window it read, never
a default id", "compares the register's session with the one selected", "withholds a register that
answers for another session", "keeps the upstream defect visible rather than claiming a fix" — and
`src/views/__tests__/attendanceWrites.test.tsx` — "does not render a register that answers for another
session". Removing the guard is **mutation-checked**: 2 of the 53 cases across the two files fail.

**Status.** ✅ Landed with M5's implementation checkpoint
`9505ade4011b37a34e3488fd51206512829205ec`. **Taken by the implementer inside M5's authorization and
recorded here so the next reader knows it was a choice, not an accident:** the milestone was scoped to
the view, the domain was frozen, and the consequence is that scheduling's `sessionRoster` verb and
`useSessionRoster` hook remain unconsumed and **now belong to no milestone**. The guard is a
**mitigation, not a closure** of **I13** — the hook is still unfixed and now sits behind shipped UI.
Attendance's `get` verb is unconsumed for **D11**'s reason, and `sessionIdsWithAttendance` is
unconsumed because it is a **cross-domain boundary** rather than a view read: scheduling reaches it
through the registry's presence provider (`src/domains/registry.ts:223`) and its synchronous sibling,
which fails safe. All three reasons are in `src/domains/attendance/README.md` §3.

---

### D14. An operation the existing contract already expresses gets no new verb, and no second write or read path

**Decision.** Where the chat contract can already express an operation, M6 added **no verb** for it and
kept **one** path to the data. Two applications, both deliberate:

1. **Archive is one reversible patch, not a pair of verbs.** `updateConversation(id, { archived })`
   carries the flag in both directions and `archiveConversation(id)` is a one-line convenience that
   delegates to it (`src/domains/chat/demoRepository.ts:101`). There is therefore **no unarchive
   verb** — restore *is* `updateConversation(id, { archived: false })` — and the management dialog
   writes through that same single path. Consequently `archiveConversation` itself has **no shipped
   caller**, and that is recorded as a choice rather than left to look like an oversight.
2. **The export got no verb, and the chat domain was not added to `ExportEntity`.** `ExportEntity`
   still lists exactly `"students" | "teachers" | "classes" | "enrollments"`
   (`src/domains/export/exportService.ts:25`). A conversation transcript is composed from the reads
   that already exist — `getConversation(id)` and `listMessages({ conversationId, per_page })`
   (`src/views/messages/conversationExport.ts` lines 197–198) — and the only thing the surface borrows is the
   export domain's **existing download seam**, `downloadBlob`
   (`src/views/messages/conversationExport.ts:246`), which the exporter owns exclusively: the gate
   requires that file to contain `downloadBlob(` and forbids `getBlob(`
   (`src/views/__tests__/messagesNoFixtures.test.ts` lines 241 and 253).

**Why.** A convenience verb beside a general one is a second code path that can disagree with the
first — with the flag, the trim, the validation or the persistence — and a second code path is where
"restore works" stops being provable. The same logic applies to reads: a hypothetical
`exportConversation` verb would have to re-implement the paging and identity rules `listMessages`
already enforces, and adding chat to the CSV/XLSX `ExportEntity` union would have meant inventing a
tabular projection of a conversation that the data does not support (and dragging the
formula-injection guard into a text artifact where it does not apply). Composing existing reads keeps
the export's honesty checkable against the same reads the view uses: what the file contains is what
the repository returned, not what a parallel path decided to say.

**Enforced by.** `src/domains/chat/demoRepository.ts:101` (the delegation) with
`src/domains/chat/__tests__/conversationLifecycle.test.ts` — "restores through updateConversation,
because no unarchive verb exists", "round-trips archive → restore → archive without losing the
thread", "combines archive with a rename in one call, without dropping either"; and, for the export,
`src/views/messages/conversationExport.ts` lines 197–198 plus
`src/views/__tests__/messagesConversationExport.test.tsx` — "reads that conversation by id, its own
messages, and nothing else", "hands the finished artifact to the browser only through the export
domain's download seam", "downloads a file containing the selected conversation's stored messages" —
with `src/views/__tests__/messagesNoFixtures.test.ts` lines 241 and 253 pinning the seam and forbidding a second
one. Mutation-checked at CP4: removing the "read before download" ordering fails 8 cases; making the
identity the list's first row instead of the selected conversation fails 6.

**Status.** ✅ Landed with M6's implementation checkpoints — the contract half at CP1
`43e7882f051b46abfa9f0530137cedfb3a541ce0` and the export at CP4
`4e03b8762bebcb87e46cf7044af5da99d709b4d2`. **The consequence is recorded, not hidden:**
`archiveConversation` now belongs to no shipped caller, and the export deliberately has no domain
half. Both are listed in `src/domains/chat/README.md` as what the domain does *not* provide.

---

### D15. An attachment is a reference, not a copy — and resolution is not authorization

**Decision.** A chat message carries an attachment as a **`mediaId` reference** into the media domain
and nothing else: the contract adds one optional field to `SendMessageInput`
(`src/domains/chat/types.ts:110`) and one to `ChatMessage` (`:79`), the bytes stay in the media blob
store, and **no filename or mime type is copied onto the message** — the message's rendering resolves
the asset's metadata when it needs it. The repository validates that the reference **resolves**
(`src/domains/chat/demoRepository.ts:137`, refusing with `MESSAGE_INVALID` and `fields.mediaId`)
**before** the provider is asked to deliver and **before** anything is written, so a dangling
reference can never produce a half-sent message or a thread preview. **That check is resolution, not
authorization:** per-object ownership and access control remain a backend concern
(`src/domains/media/types.ts:22`, "BACKEND REQUIRED"), and neither the domain nor the view claims a
frontend security guarantee. Consistent with the same rule, an export carries attachment **metadata**
(name, kind, mime, size, id) and **never bytes**
(`src/views/messages/conversationExport.ts` lines 125 and 144), and an attachment whose metadata no longer
resolves is described as unavailable rather than invented (`:168`).

**Why.** Copying bytes or metadata onto the message would create a second source of truth that can
outlive the asset it describes and silently disagree with the media domain, and it would make the
message row grow with the file. A reference keeps the product's existing rule — metadata in the
dataset, bytes in the blob store, never a fabricated URL (§13). Stating resolution ≠ authorization
explicitly is the difference between a dangling-reference check (which this product can honestly
make) and a security boundary (which only a server can), and M6's rule is that the code says which of
the two it is doing.

**Enforced by.** `src/domains/chat/__tests__/messageAttachments.test.ts` — "keeps the attachment as a
REFERENCE — a megabyte of bytes never enters the dataset", "refuses an unknown mediaId, and writes no
message at all", "refuses before delivery — no thread preview is written for a refused send", "claims
no ownership or authorization check — resolution only", "does not copy the asset's filename or mime
type onto the message", "refuses a reference whose bytes were removed — a dangling metadata row"; the
surface by `src/views/__tests__/messagesAttachments.test.tsx` — "stores the bytes, references them on
the message, and renders them", "keeps the metadata, says the file is unavailable, and offers no open
or download", "says the reference no longer resolves when the asset metadata is gone too", "reports a
failed message write, frees the stored asset, and allows a retry"; and the export boundary by
`src/views/__tests__/messagesConversationExport.test.tsx` — "carries attachment metadata and denies
that the bytes are included", "returns a .txt artifact whose bytes are UTF-8 text with a BOM, and no
attachment content". Mutation-checked: dropping the attachment line from the artifact fails 3 cases.

**Status.** ✅ Landed with M6 — the contract at CP1
`43e7882f051b46abfa9f0530137cedfb3a541ce0`, the UI at CP3
`563b8d85ee48614963cb3c182ac9b84239645c3d`, the export boundary at CP4
`4e03b8762bebcb87e46cf7044af5da99d709b4d2`. **The backend half is deferred and must be built before
this is production-ready:** server-side per-object authorization, signed and expiring URLs, and
content sniffing/virus scanning. Attachment **bytes stay browser-local** in the meantime, which is why
"the file is unavailable" is a real state the UI renders rather than an error it survives.

---

### D16. Write state and in-flight work are keyed to the identity they started with

**Decision.** Any state that belongs to an object is stored **against that object's id**, and any act
that takes time is **pinned to the identity it started for** before the first await. Three
applications: the composer holds `{ key, draft, attachment }` and derives its visible state only when
the key matches the conversation on screen, so a draft cannot follow the operator between threads,
cannot be cached for the way back, and cannot be resurrected by returning
(`src/views/messages/useComposer.ts:83`, `:131`); a send that resolves after the operator has switched
conversations clears **only** the conversation it was sent for, so a late promise cannot wipe the new
thread's typing; and an export captures the selected conversation as a value before awaiting
`readChatExport` (`src/views/Messages.tsx` lines 382–386), so a list that refetches mid-read cannot
retarget the file, and the artifact is named from the artifact's own conversation
(`src/views/messages/conversationExport.ts`), never from "whatever is selected now".

**Why.** This is **D10**, **D11** and **D13** applied to write state and to work in flight. A stored
draft outlives the object that produced it exactly the way a stored id outlives the window that
produced it; a promise that resolves into a different screen is the same hazard (I13) in a second
guise. Deriving from the key instead of trusting a stored record makes "the draft I am looking at is
this conversation's draft" a property of the render, not a hope about the order of effects, and
capturing the target before the await removes the last window in which a rendered row could change
under an operation already running.

**Enforced by.** `src/views/__tests__/messagesStateSafety.test.tsx` — "never shows the previous
conversation's draft under the new header", "discards the draft rather than caching it for the way
back", "keeps each conversation's own typing while both are visited", "does not wipe the new
conversation's draft when a send for the old one resolves late", "survives a clearFor aimed at another
conversation, and is cleared by its own"; `src/views/__tests__/messagesAttachments.test.tsx` — "does
not follow the operator into another conversation, or back", "does not let a slow send clear the new
conversation's draft or attachment"; and `src/views/__tests__/messagesConversationExport.test.tsx` —
"keeps an in-flight export pinned to the conversation it started for", "claims nothing until the
repository read resolves". **Mutation-checked:** reading the selection at download time instead of
capturing it before the await fails 8 cases.

**Status.** ✅ Landed with M6 — composer state at CP2
`42c54f41ed3099cf65ac4ca035146958a1a51f76`, the export's captured identity at CP4
`4e03b8762bebcb87e46cf7044af5da99d709b4d2`. The composer is a view-layer hook by design: the chat
domain has no draft concept and gained none.

---

### D17. A relation is a bounded repository read, and a count is a claim that needs a complete one

**Decision.** Decided by M7's landing (`f1ec0ddde783aec14d6429ac2457f085f851ad9a`), and binding every
later milestone:

1. **A displayed relation is resolved by reading the domain that owns it.** A view may not import a
   fixture resolver (`teacherById`, `classById`, `roomById`, `studentById`) or a fixture collection to
   answer "who teaches this", "which room", "who is enrolled", "what is scheduled"; it reads the
   owning domain's page (bounded, with an explicit `per_page`, and with `from`/`to` as well for
   sessions), builds **one** index per loaded page (`src/views/relations/indexById.ts`) and resolves
   the foreign key from that.
2. **A denormalized projection is never a source of truth.** `AcademyClass.studentIds` and
   `AcademyClass.enrolled` are display projections the enrollment repository keeps in sync; a roster, a
   seat count or a membership decision is derived from `Enrollment` rows. The identifier is therefore
   **forbidden in a view by name**, not merely discouraged.
3. **"Now" comes from the academy clock only.** A window, a weekday column or a "today" marker is
   reformatted from `academyNow()` through `src/views/relations/academyDay.ts`; `new Date()`,
   `Date.now()`, a fixture date and a second clock are all out.
4. **A count in the chrome exists only where a repository answered it completely.** A badge renders a
   number only when the read behind it succeeded **and** covered the set it counted
   (`total === items.length`); in flight, failed, partial and zero all render **nothing**. Absence is
   the honest default and is not the same as zero. Where no scoped, pageable read exists to answer a
   count, the count is **removed** — inventing an aggregate to keep a badge alive is the defect, not
   the fix.
5. **A partial page never masquerades as a complete one.** Where a read stopped short, the surface
   prints «N ردیف از M» and withholds the values that would otherwise be a count: «—», never `0`.

**Why.** The three profile surfaces rendered relations from `src/data/records.ts` while their own
domains were complete and tested — a class's roster came from a denormalized projection a real
enrollment write could contradict, a week came from a fixture grid with no dates at all, and the shell
showed «۳» and «۵» badges that no read had produced (**I1**). A relation is a *read* and a count is a
*claim*: the same reasoning as §14 (no-data is an explicit typed value) and §15 (no fabricated metric
presented as measurement), applied to the boundary the M7 surfaces sit on.

**Enforced by.** `src/views/__tests__/relationsNoFixtures.test.ts` — the per-surface gate over five
surfaces (plumbing, students, teachers, classes, navigation), each `enforced` with empty deferral
ledgers, with a both-direction liveness test for every view-scoped rule, a numeric-hint rule covering
both digit scripts and every quoting style, `studentIds` named as a forbidden relation identifier, a
required consumer-side identity key per guarded surface (because `useStudentList` is un-keyed, **I13**),
and relapse replays that re-introduce each retired coupling and assert it is caught — plus the four
per-surface suites (`relationsPlumbing.test.ts`, `studentsRelations.test.tsx`,
`teachersRelations.test.tsx`, `classesRelations.test.tsx`) and the navigation suite
(`navigationCounts.test.tsx`). What makes it concrete is measured in
[PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M7 validation": the pre-CP4 reversion that fails 17 of 20
cases, and the seven gate injections, each of which turns the gate red.

**Status.** ✅ **Landed at M7.** Scope of the claim, stated so it is not read as more than it is: the
fixtures are **not deleted** (**D5**/**M10**), the gate covers the five surfaces M7 owned rather than
every view, `useStudentList` still carries no query key (**I13** — mitigated at three consumer mounts,
not fixed), the `per_page: 200` ceilings stand (**I16**), and no browser QA has run on any of it.

### D18. A compensation is an obligation of its own, keyed by a typed id, with a derived state and an append-only attempt ledger

**Decision.** Decided by the **Class Compensation P1** workstream's landing
(`a21311d7e32c82e3a46b1581c94f6b3478bf646c`), and binding on every later consumer of the flow:

1. **The obligation is an entity, not a flag.** `SessionCompensationRecord`
   (`src/domains/compensation/types.ts`) is a record in its own collection — never a field or a status
   on `Session`, and never inferred from the mere existence of a cancelled session.
2. **The link to the cancelled session is the typed `originalSessionId`.** Free-text linkage through
   `notes` is not a relation: it cannot be filtered, counted or enforced — the rule **D17** applied to
   displayed relations, applied here to the obligation.
3. **The state is derived on read and never stored.** `completedAt` set ⇒ `completed`; otherwise a
   newest attempt whose session exists and is not cancelled ⇒ `scheduled`; otherwise `required`. There
   is no status column, and nothing was added to `cancelSession` to maintain one.
4. **The attempt ledger is append-only.** The newest line is the current attempt, so no separate
   pointer can disagree with the history, and a cancelled attempt stays in the record.
5. **`completed` on the obligation is a decision, not a session lifecycle.** It records who discharged
   the debt and when. `Session.status === "completed"` is a different fact about a different thing, and
   the two are deliberately not derived from each other. Automatic completion of elapsed sessions is a
   **separate** workstream: not designed here, not authorized, and not part of this decision.

**Why.** A stored status would be a second source of truth that `cancelSession` — a protected verb,
frozen for this phase — would have to be taught to maintain. Derived on read, the rule this workstream
was authorized under — cancelling the make-up returns the requirement to `required`, and the cancelled
attempt stays in the history — holds with **no write at all**. Keeping the obligation separate is also what lets it outlive
the row it compensates for: scheduling may hard-delete a session with no attendance, and the read model
reports `originalMissing` / `attemptBroken` instead of losing the debt.

**Enforced by.** `src/domains/compensation/__tests__/derive.test.ts` (20 cases — the derivation with no
environment, store or clock) and `demoRepository.test.ts` (27) — including a cancelled attempt returning
the obligation to `required`, a hard-deleted attempt reported as `missing`, a discharge that stays
terminal while still reporting the contradiction, and the append-only ledger across a re-booking.

**Status.** ✅ **Landed at P1.** Scope of the claim, stated so it is not read as more than it is: the
flow has **no UI** and **no `apiRepository`** (**I20**), the demo ships **no compensable case**, there
are **no mutation or reversion checks** for it, and browser QA has never run on anything.

### D19. Compensation is one-to-one only, registered by a person, and the make-up is an ordinary session booked through the scheduling repository

**Decision.** Decided by the same landing, and binding on every later consumer:

1. **Eligibility is the class's `kind`, never the roster size.** `AcademyClass.kind === "private"` is
   the authority; a group class is refused even when it currently holds exactly one student. Counting
   roster rows would make eligibility a function of enrolment data that changes.
2. **Registration is an explicit human act.** Cancelling a session creates nothing. A secretary,
   manager or admin holding `schedule.write` registers the obligation; a teacher cannot register, book
   or discharge one. The recorded actor is **provenance, never authorization** — the server enforces
   who may write.
3. **The affected student is derived and frozen.** Exactly one student, from the scheduling domain's
   `sessionRoster` at the original's date — never the class's denormalized `studentIds`, never a mark —
   and it must be the student the caller named.
4. **An attendance mark on the cancelled original is asked about, not assumed.** Registration is
   refused unless the caller acknowledges it explicitly, and the mark itself is derived on read rather
   than copied onto the obligation.
5. **At most one obligation per `(originalSessionId, studentId)`, for the pair's lifetime.** `register`
   is never an upsert: an open pair answers `ALREADY_OPEN`, a discharged one `ALREADY_SETTLED`.
6. **The make-up is an ordinary session, created through the scheduling repository's own `create()`.**
   No second session model and no second conflict engine: shape validation, the 15–480 minute bounds,
   the hard/warning conflict rules and `origin: "manual"` stay in the domain that owns them.
7. **The default is a prefill, not a booking.** The original's date, room and teacher, one hour long —
   offered only when the original is readable, never computed from "today", with **no free-slot search**
   behind it.
8. **Not built, by decision:** notification of any kind (**D1**, **I7**), group and class-wide
   compensation, a Settings limit rule, a compensation UI, and any server-side implementation.

**Why.** The requirement this answers (**I18**) is a debt owed to a *specific* student, and the failures
that matter are a wrong student compensated, a debt silently created by a cancellation, and a make-up
booked through a path that ignores the scheduling engine's rules — hence clauses 2, 3, 4 and 6. Clause 7
expresses the owner's "one hour, same day" default as a proposal for a form: computing a slot is the
free-slot search this phase deliberately does not build.

**Enforced by.** `src/domains/compensation/__tests__/demoRepository.test.ts` (27),
`datasetContract.test.ts` (15 — the dataset, registry and backup contract) and `persianDate.test.ts`
(2 — the Jalali date the operator types). The exclusions are enforced the same way rather than promised:
a group class is refused by code, no notification row is written anywhere, and the make-up session is
created through `create()` and carries `origin: "manual"`.

**Status.** ✅ **Landed at P1**, as a **workstream** rather than a milestone ("Workstream — Class
Compensation P1" in [PHASES.md](PHASES.md); it advances no phase-checkpoint row). **I18 remains OPEN and
is only PARTLY LANDED:** group and class-wide compensation and any notification are still unbuilt, and
the flow has no UI.

### Adding a decision

Append a numbered entry with the same four fields, name the file or test that enforces it, and
link it from [PROJECT_STATE.md](PROJECT_STATE.md) §6 if it is test-protected. A decision nobody
can point at in code is a wish, not a decision.
