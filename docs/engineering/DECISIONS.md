# DECISIONS — durable architecture record

Only decisions that are still load-bearing. This is an index with rationale, **not** a
transcript: the deep detail lives in `docs/architecture/` and in the code comments named
below. If a decision here is ever reversed, edit the entry and say what replaced it — never
delete it silently.

Format: **Decision** → **Why** → **Enforced by** → **Status**.

> **§20 is a pointer, not a decision.** The Laravel-bound governance register dated **2026-09-20**
> — IDs **`T-02`**, **`O-*`**, **PERF**, **HELP** — lives in
> [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) and is reached through **§20** below. Those
> IDs are a **separate namespace** from this file's **D1–D20** (collisions: `D7 ≠ O-07`,
> `D15 ≠ O-15`), and §20 amends no D-entry. **Read §20 before treating D1–D20 as the complete
> register.** The frontend-completion register's own `D1`/`D2` identifiers are a third, unrelated
> namespace — see `docs/frontend-completion/12-decision-register.md`.

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
src/data/records.ts (the design-time fixture module, dissolved at M10) at all: its rows are `Session` values read through `useSessions` for a bounded
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
asserting no `NaN`/`Infinity` artefacts), `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx`
— and, since M9, the empty-series guards themselves: `src/components/ds/__tests__/seriesGuards.test.tsx`
and `src/components/panels/__tests__/panelsEmpty.test.tsx`.

**Status.** ✅ In force (Phase 2). ~~Latent risk: `Sparkline` and `BusinessIntelligence` still
crash on an empty series — unreachable today because their callers pass static fixtures.~~ **Closed at
M9** (`8d34eb3d1cd639cffc794596250c897b5ed4b6b3`, **I9**): the guard landed **before** the live data that
would have reached it. `Sparkline` takes `readonly number[] | null` and `Delta` takes `number | null` —
a missing series and a missing comparison are typed absences, not zeros — and every chart in
`BusinessIntelligence` returns its no-value state before any index or `Math.min` touches an empty model.
Both render `NO_DATA` rather than a shape or a «۰٪», and no consumer was given a `|| []`. **Enforced by**
`src/components/ds/__tests__/seriesGuards.test.tsx` (7 cases), `src/components/panels/__tests__/panelsEmpty.test.tsx`
(12) and `src/views/__tests__/dashboardInsightsLive.test.tsx` (7, which also sweeps SVG attributes for
`NaN`/`Infinity`).

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

**Violations that remain,** all recorded with evidence in [OPEN_ITEMS.md](OPEN_ITEMS.md): ~~the
dashboard insight panels presenting fabricated text as measurement (**H4**, which M9 owns)~~ — **closed
at M9** (`8d34eb3d1cd639cffc794596250c897b5ed4b6b3`): the four panels and `src/views/Dashboard.tsx` show
only figures derived from the environment's own records, and an input set with no records states
«داده‌ای نیست» rather than a number or a sentence nobody computed (the traced figure→source map is in
[PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M9 validation") — and the attendance «ثبت نهایی» wording,
deferred to the attendance wiring by explicit decision (**I12**, which M5 owns and **closed** at
`9505ade`). **What survives of the H4 *shape*, recorded rather than implied:** the design-system gallery
still renders fixture samples as component demonstrations, `src/views/Finance.tsx` and
`src/views/Reports.tsx` remain fixture-driven (**I2**, deferred by **D6**), and the hero panel and the
demo seed keep the fixture identity — separating the fixtures' three roles is **D5**/**M10**, and M9 did
not start it. No fabricated *measurement* remains on the dashboard itself, which is the claim M9 makes.

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

## 19. Product-phase decision register (D1–D20)

Twenty decisions gate the product-feature phase planned in
[PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md). They are numbered **D1–D20** to
keep them distinguishable from the §1–§18 architecture decisions above, which they never override:
where a D-entry touches an existing section, that section is the authority and the D-entry says so.
Eighteen are decided (**D2** by the owner's decision recorded on 2026-09-16, ahead of M8 and before any
M8 work was authorized, **D5** by the owner's decision recorded on 2026-09-16, ahead of M10 and before
any M10 work was authorized, **D7**, **D8** and **D9** by the owner's decision-record pass of
2026-09-16, ahead of M11 and before any M11 work was authorized — D9 carrying its measurement-derived
baseline and budget shape — **D3** and **D4** by M1's landing, **D10**, **D11** and **D12** by M3's,
**D13** by M5's, **D14**, **D15** and **D16** by M6's, **D17** by M7's, and **D18**, **D19** and
**D20** by the **Class Compensation** workstream — **D18**/**D19** at P1's landing
`a21311d7e32c82e3a46b1581c94f6b3478bf646c`, **D20** at C-2's
`07f89db779ca4017dbbb22db1ac7624b18fb95be` — the last three decided outside the M0–M11 milestone
sequence), two are settled by deferral
(**D1**, **D6**), and none remains open.
Recording a decision is **not** an invitation to implement — M11 still requires its own explicit
owner authorization. The three M3 entries were missing from this table until M4's CP0
documentation reconciliation, while their sections below already existed; the heading's **D1–D12**
was right and the table was not. **D13** was added by M5's documentation reconciliation, together with
its table row and its section, so that neither half drifts the way those three did. **D14–D16** were
added the same way by M6's documentation reconciliation — each with its row and its section, written
from M6's measured evidence rather than from its plan. **D18, D19 and D20 were added the same way by the Class Compensation workstream's reconciliations
(`2600667` and `f0bdecd`)** — with their rows and their sections, written from what landed. **D17's row is
repaired here too:** the M7 reconciliation (`e7a6d72`) added its section and updated this heading and
tally, but the table stopped at D16 — the same "heading right, table wrong" failure this paragraph
records for the M3 trio, caught this time by the reconciliation that followed rather than by the next
milestone.

| ID | Decision | Status | Blocks |
|---|---|---|---|
| D1 | Student / guardian role in this panel, or a separate app | **DEFERRED** | M-none (I5, I4) |
| D2 | Branding as the source of truth for the academy identity | **DECIDED — recorded before M8** | M8 |
| D3 | Where the environment-recovery affordance lives | **DECIDED — M1-specific** | M1 |
| D4 | `clear()` semantics against the zero-record invariant | **DECIDED — M1-specific** | M1 |
| D5 | Shape of the fixture / type / seed separation — one canonical owner per entity type, one shared owner for cross-cutting presentation types, domain vocabulary with its domain, UI/presentation configuration stays presentation-owned, no monolithic replacement | **DECIDED — recorded before M10** | M10 |
| D6 | Creating the finance and reports domains in this phase | **DEFERRED** | M-none (I2) |
| D7 | How accessibility is enforced | **DECIDED — recorded before M11; landed with M11** (`f7eb867`) | M11 |
| D8 | How the api-mode hybrid is disclosed | **DECIDED — recorded before M11; landed with M11** (`53794d5`) | M11 |
| D9 | Bundle budget | **DECIDED — recorded before M11, measurement-derived; landed with M11** (`3eed4f1` split, `24998d8` gate) | M11 |
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
| D20 | Compensation eligibility at the make-up's date is disclosed on every read and never enforced — the make-up stays bookable and dischargeable, and the refusal stays with the roster that owns it | **DECIDED — landed with Class Compensation C-2** | P1 / later consumers |

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

**Decision.** Recorded by the owner on 2026-09-16, before M8 begins: the academy name, tagline,
colours and font shown in the shell, the login screen and exports come from the persisted
`BrandingSettings`, and the fixture value in src/data/academy.ts (the design-time fixture module, dissolved at M10) is demo seed material only.
**The shipped default name is «آموزشگاه موسیقی پارسیان»** — the value `DEFAULT_BRANDING.academyName`
carries in `src/domains/branding/types.ts` — so the decision renames nothing and requires no
code change to be recorded. The fixture's «آکادمی موسیقی آوا» is the demo dataset's name, never the
product's, and the two cannot both be the product's name.

**Why.** `src/domains/branding/useBranding.ts` already implements `applyBranding` with a
CSS-injection guard and is tested — but it has **only test callers**, and the `--brand-*` custom
properties it writes have **zero consumers**. Meanwhile `src/components/layout/Sidebar.tsx` and
`src/views/Login.tsx` render the fixture name. The result is a settings panel that saves an identity
the product does not use: a write that visibly does nothing is the same dishonesty as a fake
success toast (§15). Two names cannot both be the product's, and the name the customer saves must be
the name on screen.

**Enforced by.** `src/domains/branding/useBranding.ts`, `src/domains/branding/types.ts`,
`src/domains/branding/__tests__/branding.test.ts`, and — since M8 landed at `735617d` (2026-09-16) — the
design-system token definitions in `src/index.css`, where the four `--brand-*` properties feed the accent
scale, the Persian font stack and the body text colour, plus
`src/domains/branding/__tests__/brandingApplication.test.tsx`, which asserts that the saved identity is the
rendered one as well as the written one.

**Status.** ✅ **Decided — recorded 2026-09-16, before M8.** **D2 blocked M8 until it was recorded, and
it is now recorded**, so that dependency is discharged; **M8 was then authorized by the owner and landed
at `735617d0324a8f4ba2e243846eedf069d389751a` on 2026-09-16**, built on `a039ab0`, so this decision is
enforced in the product rather than pending one. What remains outside it is the milestone's own recorded
limits: branding still resolves to Demo in both modes (**D8**, M11), the fixture name survives on
surfaces M8 was not authorized to rewire, and no browser pass has run
([PROJECT_STATE.md](PROJECT_STATE.md) §7 item 20). Constraints that
are not negotiable: writes stay in the CSSOM (`style-src 'self'` with `style-src-attr 'unsafe-inline'`
as the one narrow exception — see `deploy/nginx.conf` and
`src/__tests__/cspCompatibility.test.ts`), and `logoMediaId` / `faviconMediaId` remain `MediaAsset.id`
references, never data URLs (§13).

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

### D5. Fixtures have three roles; each role gets exactly one owner

**Decision.** Recorded by the owner on 2026-09-16, ahead of M10 and before any M10 work was
authorized — this is the record M10's own first dependency asks for ("D5 recorded before
execution"). The shape of the fixture / type / seed separation is governed by **seven principles**:

1. **Every domain/entity type has one canonical owner.** An entity type defined in
   src/data/records.ts (the design-time fixture module, dissolved at M10) today — `Student` at src/data/records.ts (the design-time fixture module, dissolved at M10), re-imported by
   `src/domains/students/types.ts`, `src/domains/teachers/types.ts` and
   `src/domains/classes/types.ts` — ends up owned by exactly one domain, and the other domains
   import it from there: the source of truth becomes a place, not a count.
2. **Cross-cutting presentation/application types have one shared owner.** A type that genuinely
   belongs to no single domain — a shape several views and components share — gets one shared
   presentation/application home, imported by every consumer rather than redeclared per surface.
3. **Domain vocabulary stays with its domain.** Labels, catalogues and wording that describe a
   domain concept (instruments, statuses, class kinds and the like) move with the type that owns
   them; they are domain material, not presentation material.
4. **UI/presentation configuration stays in presentation/application ownership.** Material that
   configures the interface rather than describing a domain — the library shelf layout
   (`libraryShelves`), `settingsSections`, the composer's `messageTemplates`, navigation
   definitions, design-system samples — belongs to the presentation/application layer, not to any
   domain and no longer to the src/data/ directory (the design-time fixture directory, dissolved at M10).
5. **Do not create a monolithic replacement such as `data/ui.ts`.** The separation must not
   re-create the defect one layer down: no single new dumping-ground module inherits the role the
   two fixture files play today. Presentation configuration lives with the surfaces that use it,
   under principle 4.
6. **The view layer for M10 is `src/views/**` + `src/components/**`.** When M10 executes, "the
   view layer" and its boundary test mean both directories — the panels, the hero and the chrome
   are as much the view layer as the routed views.
7. **D5 does NOT authorize M10.** This record discharges the decision dependency and nothing more:
   M10 remains NOT STARTED and requires the owner's explicit authorization before any file moves.

The fixture modules are *relocated by role*, not removed wholesale: DEMO is a first-class
environment (§2) and its showcase dataset must stay exactly as rich.

**Why.** The two files are **822 and 558 lines** at this record
(`3a16549989f6ac41ba550e18107c62ec896f32a5`), imported by **44 non-test source files** carrying
64 import statements. src/data/records.ts (the design-time fixture module, dissolved at M10)
defines `Student`, which `src/domains/students/types.ts`, `src/domains/teachers/types.ts` and
`src/domains/classes/types.ts` re-import so there is one source of truth; and
`src/domains/demo/seed.ts` *derives* the shipped demo dataset from the same fixtures. Treating the
files as "fake data to delete" would break the type layer and the seed together — and §16 makes
that a regression, not a cleanup. **One correction to the figures and the premise this entry
carried from M0 onward:** they read "822 and 539 lines with 51 non-test importers", and the
decision said the third role would be "deleted once M4–M9 have removed every reader" — the premise
that the third role is *already unused* after M4–M9. Both are stale as recorded: src/data/academy.ts (the design-time fixture module, dissolved at M10)
has grown to 558 lines, the importer count re-measures at 44 non-test files, and M4–M9 removed the
third role's *wired-view* readers one surface at a time without emptying it — at this record,
fixture **content** still reaches `src/views/Library.tsx` (`libraryShelves`),
`src/views/Settings.tsx` (`settingsSections`), `src/views/Messages.tsx` (`messageTemplates`),
`src/views/Finance.tsx` and `src/views/Reports.tsx` (**I2**), the design-system gallery
`src/views/DesignSystemView.tsx` (fixture *samples*) and `src/components/hero/Hero.tsx` (the
fixture identity), while several further files import **types only** from the two modules. Much of
what remains is therefore not fake data awaiting deletion but **UI/presentation configuration**,
and principles 4 and 5 settle its fate: it stays in presentation/application ownership, kept with
the surfaces that use it, rather than being deleted or re-piled into one new monolith.

**Enforced by.** `src/domains/demo/__tests__/seed.test.ts`,
`src/services/__tests__/demoStoreMigration.test.ts`, `src/__tests__/architectureBoundaries.test.ts`
— and, once M10 is authorized and executes, the M10 boundary test asserting that the view layer
(`src/views/**` + `src/components/**`, principle 6) imports those modules for no fixture content at
all. That test does not exist yet: D5 is recorded, M10 is not authorized, and this pass moved no
file, wrote no test and changed no gate.

**Status.** ✅ **Decided and FINALIZED — recorded 2026-09-16, before M10; finalized by owner
instruction the same day.** D5 blocked M10 as a decision that had to be recorded before execution;
it is now recorded and finalized, and that dependency is discharged. **The record — and its
finalization — is not an authorization:** principle 7 keeps M10 ❌ NOT STARTED until the owner
authorizes it, and the separation itself — the moves, the deletions, the boundary test — is M10's
work, not this record's. The follow-up records immediately below — DEMO seed, legacy
sessions/attendance, Hero, and Finance/Reports — and the **finalization record** beneath them were
added the same day by owner instruction and are **part of this decision**, not a new authorization:
**D5 = RECORDED / FINALIZED; M10 = NOT AUTHORIZED** — a separate owner authorization is required
before implementation.

**Follow-up record (2026-09-16, owner instruction) — DEMO seed, legacy sessions/attendance, Hero.**
Three decision areas settling, ahead of M10, how the seven principles above apply to the demo seed,
the legacy session/attendance material and the hero panel:

**F1 — DEMO seed.**

1. **The DEMO seed remains legitimate and may stay rich.** DEMO is a first-class environment (§2);
   the showcase dataset's richness is a property, not a debt, and D5's relocation of the canonical
   seed (principle 2's application to `src/domains/demo/`) must keep it exactly as rich.
2. **Legitimate DEMO seed data must be distinguished from fabricated UI measurements.** The seed is
   *data* — records the demo environment honestly contains. A fabricated measurement is a figure or
   sentence presented as something computed from records when nobody computed it (§15). Seeded rows
   are honest content; fabricated metrics are dishonest claims. The separation D5 orders is a move of
   **ownership**, and a move of ownership changes the honesty of nothing.
3. **Moving fabricated measurements to another file does NOT make them legitimate.** Relocating a
   fabricated figure out of src/data/academy.ts (the design-time fixture module, dissolved at M10) into any other module — including a
   presentation-owned one under principles 4 and 5 — leaves it fabricated. The defect is the claim,
   not the path. Presentation-owned configuration is legitimate *configuration*; it never becomes a
   legitimate *measurement*.

**F2 — Legacy sessions/attendance.**

1. **Legacy sessions and attendance are protected.** The legacy material — the seeded `sessions`
   (`src/domains/demo/seed.ts:165` derives them from the fixtures) and the legacy `attendance`
   collection (`src/domains/demo/seed.ts:166` still seeds it, and `src/domains/demo/backup.ts:242`
   still validates it so a round-trip stays lossless) — is protected through M10.
2. **No change to schema, IDs, collection semantics, backup envelope, or I8 behavior.** The
   collection shapes and the ids they carry are frozen; the backup envelope's `environment: "demo"`
   stamp, app-name suffix and filename, and the `WRONG_ENVIRONMENT` restore-validation rule they
   support (**I8**, still open and deliberately *not* absorbed by M10), are frozen by this record.
   Any change to what the dataset *is* — even one id — is out of scope and would need its own
   decision.
3. **Source relocation is allowed only when exact data and lifecycle semantics remain unchanged.**
   The seed may move under this decision only if the produced dataset is identical in content and
   identical in lifecycle semantics: UNINITIALIZED → { EMPTY | DEMO } (§5), adoption of marker-less
   datasets (§7), reads that never write (§6), and a backup round-trip that stays lossless. The
   check is the existing protected suites plus identity of the produced bytes — sameness is the
   acceptance criterion, and anything less is a regression under §16.

**F3 — Hero.**

1. **Hero is part of the M10 view layer, because the view layer is `src/views/**` +
   `src/components/**`** (principle 6). `src/components/hero/Hero.tsx` is therefore inside M10's
   boundary — the fixture identity and fixture status it still render (§7 items 20 and 21 of
   [PROJECT_STATE.md](PROJECT_STATE.md)) are M10's to resolve, not an exception to the boundary
   test.
2. **Identity data in Hero should use the established M8 branding mechanism** — the persisted
   `BrandingSettings` through `src/domains/branding/useBranding.ts` (`useBranding`,
   `applyBranding`, `useApplyBranding`, landed by M8 at
   `735617d0324a8f4ba2e243846eedf069d389751a` under **D2**) — not the demo fixture's `academy`
   object in src/data/academy.ts (the design-time fixture module, dissolved at M10) that `Hero.tsx:57` currently renders.
3. **Fabricated status/measurement must not remain presented as factual product state.** Hero's
   hardcoded «وضعیت: سالم» badge (`src/components/hero/Hero.tsx:70`) and the
   `academy.statusLine` narrative beside it (`:69`) are fabricated product state; after M10 they
   must not be presented as fact — consistent with F1 clause 3 and with §15.
4. **The future M10 implementation may use authoritative live data or explicit `NO_DATA`.** Where a
   status or measure has an authoritative source, M10 may render it from there; where none exists,
   the typed no-value glyph (§14) is the honest rendering — never an invented status.
5. **This D5 documentation pass does not redesign Hero.** This record settles ownership and honesty
   constraints only; the surface work is M10's, and M10 is still not authorized.

**Enforced by (follow-up).** For F2: the protected persistence and seed suites —
`src/domains/demo/__tests__/seed.test.ts`, `src/services/__tests__/demoStoreMigration.test.ts`,
`src/domains/demo/__tests__/backup.test.ts`, `contracts.test.ts`, `dataIntegrity.test.ts` —
unchanged, plus the content-and-lifecycle-identity check M10 must carry when it relocates the seed.
For F3: `src/domains/branding/__tests__/brandingApplication.test.tsx` (the M8 pattern Hero should
join) and the M10 boundary test of principle 6, neither of which covers Hero today. For F1: the
honesty gates of §15 (`src/__tests__/writeFeedbackHonesty.test.ts`,
`src/__tests__/privacyPosture.test.ts`) — relocation satisfies none of them by itself. For F4:
D6's own enforcement (the `src/domains/finance/README.md` and `src/domains/reports/README.md`
stubs and the honest server-required toasts in `src/views/Finance.tsx` and `src/views/Reports.tsx`),
the M10 boundary test of principle 6, and the classification-and-deferral visibility F4 clause 7
requires.

**Finalization record (2026-09-16, owner instruction) — D5 FINALIZED; M10 remains NOT AUTHORIZED.**
D5 is recorded as the architectural decision that separates the legacy fixture modules
**by semantic role, not by merely relocating files**, and the M10 specification becomes
*executable* — still awaiting its own owner authorization. The legacy third role resolves into two
distinct categories, giving **four** in total:

- **A. Domain/entity types.**
- **B. Canonical DEMO seed / source data.**
- **C. Fabricated UI data / fabricated measurements.**
- **D. Static domain vocabulary and UI/presentation configuration.**

The seventeen finalization clauses below fix the rules M10 must implement; where an exact
implementation file is left to M10, the *ownership principle* is what is fixed:

1. **Type ownership.** Every domain/entity type has exactly one canonical owner and lives with its
   owning domain — `Student` → students, `Teacher` → teachers, `AcademyClass` → classes, `Room` →
   rooms, `Instrument` → instruments, `Attendance` → attendance, `Scheduling` → scheduling,
   `Learning` → learning, `Library` → library, and so on; other domains and views import the
   canonical type, and **equivalent types are never duplicated**. Cross-cutting
   application/presentation types that are not business-domain entities have **one shared owner**
   rather than an arbitrary business-domain assignment — this includes, where appropriate,
   `ViewId`, `Target`, `Severity`, `Signal`, `AttentionItem` and `Insight`. The exact shared-owner
   file may be chosen during M10 according to actual consumer direction; the principle — **one
   canonical definition, no duplicate definitions** — is fixed. `InstrumentId` is owned by the
   instruments domain unless the implementation proves it genuinely cross-cutting and requiring the
   shared owner. `ClassSession` / `ClassStatus` / `statusOf` follow scheduling semantic ownership;
   no duplicate definitions.
2. **Label maps and UI configuration are category D.** They are not fixtures merely because they
   currently live under src/data/* — the design-time fixture directory, dissolved at M10. Domain vocabulary lives with its owning domain
   (`studentStatusLabel`, `paymentLabel`, `resourceKindLabel`, `attendanceLabel`,
   `subscriptionStatusLabel`); presentation/application configuration lives in the presentation or
   application ownership appropriate to its consumers (`viewTitles`, `navGroups`, `navItems`,
   `commandVerbs`, `nlCommands`, `quickActions`). **No replacement catch-all** — no `data/ui.ts`,
   no `data/constants.ts`, no `data/config.ts`, no second global dumping ground.
   `WEEKDAYS` / `WEEKDAYS_SHORT` / `TODAY_INDEX` / `DAY_START` / `DAY_END` are classified by
   their actual semantic ownership and consumers, with one source of truth each: domain vocabulary
   belongs with the domain, presentation configuration with presentation/application, and a DEMO
   clock anchor with the DEMO environment/seed layer.
3. **View-layer definition.** For the M10 fixture boundary, the view layer is exactly
   `src/views/**` + `src/components/**` — the same definition `src/__tests__/architectureBoundaries.test.ts`
   already uses. It must **not** be narrowed to `src/views/**` merely to exclude components: Hero,
   Sidebar, TopBar, overlays and every other `src/components/**` surface are inside the M10
   boundary.
4. **Category C policy.** M10's purpose is not to make old filenames disappear: a fabricated
   measurement does not become acceptable by moving from src/data/* — the design-time fixture directory, dissolved at M10 — into another fixture file
   (F1 clause 3). Where a fabricated value is presented as factual product state: **remove** it;
   where an authoritative live repository/domain read already exists, **derive from it**; where no
   authoritative seam exists, use the appropriate **`NO_DATA`** state. **Never invent a replacement
   number, status or metric.** This continues the M9 H4/I9 policy.
5. **DEMO data.** DEMO is a first-class rich showcase environment: canonical DEMO seed data remains
   rich and semantically unchanged. M10 may relocate its source definitions under
   `src/domains/demo/`, and shall change **nothing else** — not record content, not IDs, not
   collection membership, not semantic values, not ordering where protected by existing behaviour,
   not lifecycle semantics, not backup semantics. The existing seed/lifecycle/backup/integrity
   tests remain authoritative (F2). EMPTY remains EMPTY; **M10 fabricates no new EMPTY data.**
6. **Finance and Reports (F4, completed).** They remain deferred under D6/I2, and M10 creates no
   finance domain, no reports domain, no repositories for them, no backend implementation, no
   invented authoritative finance/report measurements, no recomputed unavailable revenue, and no
   connection to any new backend. They are nevertheless handled **explicitly** by the M10 boundary:
   each legacy export they consume is classified as (a) legitimate DEMO/domain record, (b) static
   configuration/vocabulary, (c) fabricated measurement, or (d) data whose proper domain is
   deferred by D6/I2. For the deferred class: the deferral is preserved explicitly, made visible
   in the relevant gate/ledger, made testable — and never hidden in a replacement fixture module
   merely to satisfy a filename-based gate. The boundary test must not be weakened to make the
   problem disappear, and Finance/Reports domains are not implemented as part of M10.
7. **Hero (F3, completed).** Hero is inside M10 because components are part of the view layer.
   Its material separates into: (a) **identity** — `academy.name`, `manager.firstName`,
   `academy.statusLine` — using the existing M8 branding mechanism where applicable; (b)
   **fabricated measurement/status** — the hardcoded «وضعیت: سالم» and fixture-derived
   schedule/status measurements — replaced by an authoritative live read where one exists,
   otherwise `NO_DATA`; and (c) **DEMO seed**, which remains rich and protected. Hero changes in
   M10 are limited to fixture separation / data honesty; **no visual redesign.**
8. **Legacy sessions / attendance (F2, completed).** They remain protected by F2/I8: M10 changes
   no schema, no IDs, no collection semantics, no backup envelope, no migration semantics and no
   I8 format. Their source definitions may be relocated only if the resulting DEMO dataset and
   lifecycle/backup behaviour remain exactly compatible with the existing protected tests. **No I8
   redesign.**
9. **Dead exports.** Verified as having no non-test product consumers and recorded as deletion
   candidates, deletable by M10 as part of the implementation: `todayFlowIds`, `revenueTarget`,
   `overdueInvoices`, `teacherAbsences`, `freeSlotsTuesday`, `studentStats`, `accessRoles`.
   Nothing is deleted merely because an automated search appears to find no consumer if it is
   required for DEMO seed/lifecycle/backup semantics. **Design-system sample data is not
   automatically dead:** `src/views/DesignSystemView.tsx` sample content is presentation/demo
   showcase content and gets an explicit owner rather than blind deletion.
10. **`atRiskStudents`.** The current domain-layer read of fixture-derived `atRiskStudents`
    (`src/domains/shared/useAcademyMetrics.ts`) must not remain an uncontrolled fixture
    dependency. During M10: use an authoritative live data derivation if one already exists; else
    derive the metric from authoritative domain records without changing domain behaviour; else
    remove the fabricated metric/read and expose the appropriate `NO_DATA` state. **No new metric
    formula is invented, and no new backend or domain model is created solely for this issue.**
11. **`viewTitles` / `src/lib/hashRoute.ts`.** `viewTitles` is presentation configuration with a
    presentation/application owner; `src/lib/hashRoute.ts` may consume the canonical
    presentation-owned definition provided the dependency direction remains intentional and
    documented. `viewTitles` never moves into a generic data/config dumping ground, and `ViewId`
    itself remains a canonical cross-cutting type with one owner.
12. **Baseline corrections.** The stale M0 figures ("51 non-test importers", src/data/academy.ts (the design-time fixture module, dissolved at M10)
    = 539 lines) and the stale "already unused" third-role premise are replaced by the verified
    baseline at finalization: **44 non-test importer files carrying 64 of the 92 import statements**
    the two modules appear in repository-wide (the remaining 28 sit in 16 test files), with
    src/data/records.ts (the design-time fixture module, dissolved at M10) at **822 lines** and src/data/academy.ts (the design-time fixture module, dissolved at M10) at **558 lines**. The current
    tree contains surviving readers. **L3 is already CLOSED (2026-09-14), leaves active M10 scope,
    and is not reopened.**
13. **Documentation drift.** M10 keeps exactly the named drift targets — `docs/gap-matrix.md`,
    `docs/architecture/data-layer.md`, `docs/production-handoff.md`, `docs/architecture/auth.md`,
    `docs/architecture/environments.md` — and each item is either **corrected** where the current
    repository establishes the current truth, or **explicitly labelled a historical snapshot and
    dated**. No unrelated documentation cleanup; `docs/architecture/demo-data.md` may be inspected
    for consistency but M10 does not expand into a general documentation rewrite; **L6 remains
    outside M10.**
14. **The M10 boundary test** enforces that no file under `src/views/**` or `src/components/**`
    imports src/data/records.ts (the design-time fixture module, dissolved at M10) or src/data/academy.ts (the design-time fixture module, dissolved at M10) as legacy fixture sources, **with
    meaningful mutation/liveness protection preserved**. The test is not satisfied by moving
    fabricated data into another hidden fixture module; Finance/Reports D6/I2 deferrals are
    explicit and testable rather than silently exempted; and existing gates remain at least as
    strict as before.
15. **Gate preservation.** All existing gates remain protected. They may be mechanically re-pointed
    during M10 after source ownership moves, but their semantic protections remain: no deleted
    assertions, no removed mutation probes, no weakened allow-lists, no failures converted to
    pending without an explicit architectural reason, no hidden known failures, and no unrelated
    gate-semantics changes.
16. **Backend.** D5 makes **no** backend technology decision: no choice between Laravel, NestJS,
    Symfony, Go or any other stack is recorded; no PostgreSQL, Redis, Docker, VPS or cloud
    decision is recorded as part of M10; no backend/API infrastructure is implemented. Backend
    architecture remains a separate future decision/workstream (as F4 clause 8 already states).
17. **Authorization.** Recording — and finalizing — D5 does not authorize M10 implementation.
    After this checkpoint: **D5 = RECORDED / FINALIZED; M10 = NOT AUTHORIZED.** A separate owner
    authorization is required before implementation.

**Enforced by (finalization).** The same suites named in the follow-up's enforcement clause, plus —
once M10 is authorized and executes — the boundary test of clause 14 with its mutation/liveness
protection, the Finance/Reports deferral-visibility mechanism of clause 6, and the dead-export
deletions of clause 9 witnessed by the suites that reference those symbols today
(`src/views/__tests__/relationsNoFixtures.test.ts`,
`src/views/__tests__/compensationNoFixtures.test.ts`). This pass itself changes no source, no test
and no gate.

**F4 — Finance and Reports (D6 / I2).**

1. **Finance and Reports remain deferred under D6 / I2.** D6 (this section, → D6) still governs
   them: no `finance` or `reports` domain is built in this phase, `src/domains/finance/` and
   `src/domains/reports/` remain README-only, and **I2** stays open as its own phase. D5's
   separation work changes nothing about that deferral.
2. **Do NOT create Finance or Reports domains.** Relocating fixture modules under this decision
   authorizes no construction of those domains; the two README stubs are the entirety of what
   exists, and stay the entirety.
3. **Do NOT create repositories for them.** The `invoices` and `payments` collections have no
   repository today (as D6's M9 update records) and D5 adds none; neither do `subscriptions`,
   revenue series, KPI figures or the report catalog acquire one through relocation.
4. **Do NOT invent, fabricate, or recompute revenue/payment data.** No pass under D5 — including
   M10 — may produce new money figures, recompute revenue or payment totals client-side, or
   substitute any client-side math for the server-side computation D6 requires (§15). M9's
   precedent stands as the required behaviour: it deleted the revenue chart rather than fake the
   seam ([DECISIONS.md](DECISIONS.md) §19 → D6, M9 update).
5. **Do NOT create a hidden fixture-backed replacement.** Moving a fixture-backed export into a
   presentation-owned module, a domain module, or any other home — without changing what it is —
   creates only a hidden replacement, forbidden by this record. Relocation changes ownership, not
   honesty (F1 clause 3), and a relocated fake remains a fake.
6. **Existing fixture-backed exports must be classified individually during M10.** Each export the
   two surfaces read — `src/views/Finance.tsx` (`revenueSeries` from src/data/academy.ts (the design-time fixture module, dissolved at M10);
   `financeKpis`, `invoices`, `payments`, `paymentLabel`, `revenueByStream`, `studentById`,
   `subscriptionStatusLabel`, `subscriptions` and the `Invoice`, `PaymentStatus`, `Subscription`,
   `SubscriptionStatus` types from src/data/records.ts (the design-time fixture module, dissolved at M10)) and `src/views/Reports.tsx`
   (`growthSeries`, `instruments`, `occupancy` from src/data/academy.ts (the design-time fixture module, dissolved at M10); `attendanceByDay`,
   `attentionQueue`, `reportCatalog`, `teachers` and the `ReportDef` type from
   src/data/records.ts (the design-time fixture module, dissolved at M10)) — gets its own classification (legitimate DEMO seed per F1, type,
   presentation configuration, deferred Finance/Reports reading, or fabricated measurement) and
   its own disposition. No bulk disposition is permitted.
7. **If an export cannot be relocated without violating D6/I2, it remains explicitly deferred, and
   that deferral must be visible and testable.** Such an export is neither deleted silently nor
   re-homed quietly: the deferral is stated in the documents and pinned so the M10 boundary test
   (principle 6) can see it — an invisible deferral is not a deferral.
8. **No backend architecture or backend technology decision is part of D5.** D5 settles the
   separation of fixture, type and seed, and the honesty of what surfaces render. It decides
   nothing about a backend stack, API surface or server design; those belong to I2's own phase and
   to `docs/production-handoff.md`, and remain entirely undecided here.

**The paragraph below is the status as it stood while D5 was still Open — kept as written, as the
record of how M4–M9 constrained themselves against an undecided milestone.** 🔶 Open. Blocks M10; constrains M4–M9 (they remove *data* imports only, never the type
or seed roles). **M4 has removed its reader:** `src/views/Scheduling.tsx` imports neither
src/data/records.ts (the design-time fixture module, dissolved at M10) nor src/data/academy.ts (the design-time fixture module, dissolved at M10) any more. The scheduling fixtures stay in the dataset
because `src/views/Classes.tsx` still reads them — the third role retiring one reader at a time, with
the type and seed roles untouched. **M5 has removed the attendance view's reader too, and is the
clearest case yet of the three roles being separable:** `src/views/Attendance.tsx` and both of its
panels import nothing from either module, so `todayAttendance`, `attendanceTrend`, `attendanceByDay`,
`attendanceLabel` and `AttendanceRoster` have no reader in the view that owns them — while the **seed**
role survives untouched (`src/domains/demo/seed.ts:166` still seeds a legacy `attendance` collection
and `src/domains/demo/backup.ts:242` still reads it, so a round-trip stays lossless) and the **type**
role was never in question. Deleting the fixtures was therefore *not* possible inside M5's
authorization, and the one remaining shipped reader is `src/views/Reports.tsx:143` (`attendanceByDay`)
— **I2** and M9's. **M7 has now removed the three profile surfaces' *relation* readers** (`f1ec0ddde783aec14d6429ac2457f085f851ad9a`): `src/views/Students.tsx`, `src/views/Teachers.tsx` and `src/views/Classes.tsx` resolve every foreign key, roster, seat count, room and weekly window through the domains and import only **label maps and types** from `@/data/records` — `teacherById`, `studentById`, `classById`, `roomById`, `weekSessions`, `TODAY_INDEX`, `academyClasses` and the denormalized `AcademyClass.studentIds` projection are all forbidden in those files by `src/views/__tests__/relationsNoFixtures.test.ts`, which now enforces five surfaces with empty deferral ledgers. ~~What still reads the fixtures is the *third role* elsewhere and untouched: `src/views/Library.tsx` (`libraryShelves`), `src/views/Settings.tsx` (`settingsSections`), the composer templates in `src/views/Messages.tsx` (`messageTemplates`), `Finance.tsx`/`Reports.tsx` (**I2**) and the dashboard insight panels (**M9/H4**)~~ — **update (2026-09-16, M9 `8d34eb3d1cd639cffc794596250c897b5ed4b6b3`):** the dashboard insight panels and `src/views/Dashboard.tsx` **came off that list** — they read the environment's own records through `src/domains/shared/useDashboardInsights.ts` and derive every figure in `src/domains/shared/dashboardInsights.ts`, and the fixtures they used to render (`signals`, `growthSeries`, `revenueSeries`, `occupancy`, `instruments`, `quickActions`, `todayFlowIds`, `attentionItems`, `attentionQueue`, `intelligenceCards`) no longer reach them. What still reads fixture *content* is therefore `Library.tsx` (`libraryShelves`), `Settings.tsx` (`settingsSections`), the composer templates in `Messages.tsx` (`messageTemplates`), `Finance.tsx`/`Reports.tsx` (**I2**), and the design-system gallery `src/views/DesignSystemView.tsx` (fixture *samples* used to demonstrate components). **M9 changed no part of this decision and did not start the separation:** it removed *readers* of its own surfaces, exactly as M4–M7 did for theirs, and the three roles — types, the canonical DEMO seed, and fake data for unwired views — are still entangled, which is why this decision is still **Open**, why the **Status** row below is unchanged, and why the M10 boundary test that will cover *every* view is still to be written. M7 also retired the *count* half of the same habit in the chrome rather than moving it: see **D17**. One deliberate non-change belongs to this entry: `attendance` **stays** in
`src/views/__tests__/emptyEnvironment.test.tsx`'s fixture list, because that membership asserts
`inFlightMarkers() === 0` — a semantic claim about issuing no domain read, which a wired view would
fail — and moving it would have been a test-semantics change the milestone was not authorized to make.
Only that file's labels and comments were corrected.
*(Superseded 2026-09-16 by the decision record above: D5 is **DECIDED**, and the sentences in this
paragraph saying the decision is "still **Open**", that the **Status** row is unchanged, and that the
M10 boundary test is "still to be written" describe the pre-decision state and stand only as its
history. The reader-removal history itself — M4, M5, M7 and M9 each retiring their own surfaces'
readers — is unchanged and remains the evidence the decision was recorded against.)*

### D5 — M10 implementation resolution (recorded 2026-09-16, documents only; D5 itself is unchanged)

M10 executed the finalized D5 separation in **one** implementation checkpoint
`e7a64b7777be36ddd97fc3337898fad794118e5b` (*fix(reliability): M10 — dissolve the fixture boundary, no
architectural sociology* — 82 files, 2 122 insertions / 1 942 deletions), **explicitly authorized by
the owner** after the finalization above and built on parent
`98af31b5b04022362f0bc95ca99c426f2d7c8446` — the D5 finalization record itself, implemented on branch
arena/01a0aa83-parsian-music-dashboard-opus (branch-name errata: the earlier-designated
arena/01a0a9b6-parsian-music-dashboard-opus **does not exist** in this repository and was never
touched; no branch repair was performed). D5 remains **RECORDED / FINALIZED and unchanged**; this note
records where the implementation actually put what the decision named, without amending the decision.

**The four categories found exactly one owner each** (enforced by `src/__tests__/m10Boundary.test.ts`):

- **A — domain/entity types** now live with their domains only: `Student`/`StudentNote` at
  `src/domains/students/types.ts`, `Teacher`/`TeacherNote` at `src/domains/teachers/types.ts`,
  `AcademyClass` at `src/domains/classes/types.ts`, `Resource` at `src/domains/library/types.ts`,
  `Conversation` at `src/domains/demo/types.ts`, `InstrumentId` at `src/domains/instruments/types.ts`
  (as the decision reserved: not cross-cutting), and the timeline `ClassSession` plus
  `ClassSessionStatus` at `src/domains/scheduling/types.ts` — the disambiguation rename the clause
  anticipated from the dissolved module's `ClassStatus`, **with no field removed** (see **Error A**) —
  while the session-lifecycle `Session` stayed where the scheduling domain already owned it.
- **B — the canonical DEMO seed** is `src/domains/demo/academySeed.ts` (data unchanged), consumed only
  by the demo ownership layer (`src/domains/demo/*`), per **F1**: it is the *source data* the dataset
  derives from, not a fixture for views.
- **C — fabricated UI data/measurements** are **removed**, not relocated: every one is named and
  classified individually in `src/lib/financeReportsDeferral.ts` (**D6**/**I2**), and the gate
  tombstones them against quiet return. Where a *question* rather than a number mattered, the answer
  became honest emptiness: `freeSlotsTuesday` is gone from executable production data, and the
  palette's Tuesday free-class query (`nlCommands` n3) survives as an honest typed no-data result
  that opens the schedule — **no free-slot search system was introduced** and no fabricated
  availability claim remains. (Milestone-scoped decision preserved: the original question stays
  recognisable; the false answer does not.)
- **D — static vocabulary and presentation configuration** have named single owners:
  `src/lib/navigation.ts` (nav groups/items, view titles), `src/lib/viewContracts.ts`,
  `src/lib/financeVocabulary.ts` (payment/subscription labels), `src/domains/scheduling/weekdays.ts`,
  `src/views/messages/composerTemplates.ts`, `src/components/overlays/commands.ts` (palette verbs and
  the honest-empty NL result), `src/components/ds/samples.ts` (design-system-plated configuration,
  not a data source).

**F2 (legacy sessions/attendance) and the I8 family are preserved:** the milestone carries **zero**
diff under the compensation and attendance domains and the persistence/backup plane — no schema, no
ID scheme, no collection semantics, no backup-envelope change, no I8 redesign — and the protected
suites pass (315 tests in the family run at the checkpoint).

**F3 (Hero) resolved as recorded:** the academy identity renders the persisted M8 branding record
via `useBranding` (**D2**), the greeting name is the signed-in operator via `useAuth` — which
**extends no `BrandingSettings` persistence and introduces no new branding schema** — and the
fabricated operational status/peak claims were *removed* (the hardcoded healthy-status badge, the
fixed peak-activity line), with live values read through the existing scheduling seam
(`useDayPulse`) or rendered as silence where no measurement exists.

**F4 (Finance/Reports) resolved as recorded:** the deferral mechanism the decision required is real
and visible — `src/lib/financeReportsDeferral.ts` names every dissolved export with a classification,
and `src/__tests__/m10Boundary.test.ts` makes the two surfaces prove they carry the deferral (the
**I2** work item named on screen, no domain read behind it). **I2 remains deferred and outside M10**;
Finance and Reports are **not** implemented, and no fabricated replacement metrics exist.

**Error A — `ClassSession.resourceId` (recorded erratum).** A previous implementation report
claimed M10 removed this field. **This is false**: the field occurs **zero** times in the pre-M10
checkpoint and **zero** times post-M10, and no runtime or demo record ever contained it; the actual
change was the type-ownership relocation recorded above. No runtime or data-model field was removed,
and no document may say one was.

**Error B — demoStore R4/R6 (recorded erratum).** The same report overstated M10's lifecycle work:
`src/services/demoStore.ts` changed by **one hunk** (a type-import re-point). The R4/R6 lifecycle
behaviour it describes — adoption of legacy datasets as DEMO, never filling EMPTY,
environment-marker ownership (`src/domains/demo/lifecycle.ts`, `src/domains/demo/demoDataManager.ts`)
— is **pre-existing machinery**, with `src/domains/demo/__tests__/dataLifecycle.test.ts` unchanged by
M10. Documentation must describe it as pre-existing, not as M10 implementation.

M10 = ✅ **COMPLETE** as of its registration in [PHASES.md](PHASES.md) and
[PROJECT_STATE.md](PROJECT_STATE.md); **M11 is NOT STARTED and this resolution does not authorize
it.** *(Superseded, 2026-09-17 — kept as the record of M10's closure: M11 was authorized by the owner
on 2026-09-17 and landed across four checkpoints ending at `f7eb867` on the boundary `3ed0bfe`; the
D7/D8/D9 statuses below carry the landed records.)*

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
not deleted, they are simply not yet read by a domain. **Update (2026-09-16, M9
`8d34eb3d1cd639cffc794596250c897b5ed4b6b3`): this decision was met head-on and held.** H4's money slot
needed a revenue figure, and the seam does not exist — `src/domains/finance/` and
`src/domains/reports/` remain README-only and the `invoices`/`payments` collections have **no
repository**. Rather than create a domain, add a repository, or compute a client-side substitute (which
§15 forbids), M9 **deleted the revenue chart** and showed the receivables the student records
themselves carry. **No Finance or Reports work was done, no domain was created, and I2 remains open.**
**Reaffirmed 2026-09-16 by the D5 follow-up (→ D5, F4):** Finance and Reports stay deferred through
the fixture separation — no domain, no repository, no recomputed or relocated fake, and D5 carries
no backend decision.

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

**Decision recorded (2026-09-16, documents only — the decision gate for M11).** The accessibility
approach is **assertion-first, dependency-free**, in four categories, all running in jsdom with the
toolchain that already exists:

1. **Accessible-identity assertions** — interactive surfaces are located by role and accessible name
   (Testing Library `getByRole`/`getAllByRole` semantics), and a surface that loses its name or its
   role fails the suite. The design-system catalogue (`src/components/ds/`) is the binding perimeter
   because every shipped control is plated there, and the same rule applies to the shell navigation,
   dialogs and forms that are their own surfaces.
2. **Focus-management assertions** — every dialog must take focus on open, trap it while open,
   escape on `Escape`, and return focus to its invoker on close; the command palette keeps a working
   keyboard flow end-to-end (arrows, Enter, Escape) with its honest-empty state reachable by keyboard.
3. **Motion-preference assertions** — when `prefers-reduced-motion: reduce` is set, no element may
   keep an active CSS animation or transition (asserted on the classes/styles the design system
   emits), and the preference's persistence path stays honoured (the existing honoured-and-persisted
   seam is not re-engineered here).
4. **Static-language/RTL checks preserved** — the existing RTL and Persian-language invariants keep
   passing; nothing in M11 may narrow them.

**No new dependency is introduced.** An axe-family audit package — or any other dependency — requires
separate owner authorization before it is even considered; the register entry stands independently of
that. **Enforcement shape (M11's work, not this pass):** these assertions live in the existing
behaviour suites plus one a11y suite M11 adds; they may not weaken
`routeProtection`, `privacyPosture` or any existing gate to pass.

**Status.** ✅ **Recorded — decided before M11 (2026-09-16, by the owner's decision-record pass); landed with M11.** The owner authorized the exact scope on 2026-09-17, and the gate landed at M11's implementation checkpoint `f7eb86762dc11f7d5dd3c7218e7c697fad29488e` (*test(m11): D7 — dependency-free accessibility gate*) in `src/__tests__/a11yGate.test.tsx` — **14 cases, dependency-free, stable across three consecutive runs**, green at the milestone's own regression boundary with `routeProtection` unchanged.

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

**Decision recorded (2026-09-16, documents only — the decision gate for M11).** When the configured
data source is `api` but a domain still resolves to its Demo implementation, the product **discloses
that to the operator, persistently, on the surfaces identity is judged from** (the shell chrome at
all times, and the login screen at entry) — as a first-class, non-dismissable status, never a
footnote and never an icon-only hint an operator could mistake for decoration. The set disclosed is
the registry's own source of truth: the **eleven** getters that resolve Demo in both modes —
`instruments`, `learning`, `chat`, `media`, `library`, `branding`, `gallery`, `progress`,
`scheduling`, `attendance`, and `compensation` (added by the Class Compensation workstream, whose own
registry paragraph already cites D8 by name; the D8 frame's original count of ten predates it).
Seven getters switch on `isApiMode()` today (`students`, `teachers`, `rooms`, `classes`,
`enrollments`, the auth repository, `users`); the disclosure must derive its wording from the same
registry seam — one enumeration, no second list to drift.

Wording rules: the indicator **names the local/demo-backed state plainly** (it never implies a
server answered, and it performs no fabricated health-check, ping, or connected-now theatre — no
backend behaviour is invented to make it look alive); it is **absent in demo mode**, where the
demo-source disclosure already exists; and in api mode it reads exactly like what it is — a hybrid
that is not production-ready — matching §3, §9, §15 and the §37 no-dishonest-fallback clause of
`docs/architecture/data-layer.md`.

**Enforcement shape (M11's work, not this pass):** a test asserts the disclosure renders in api mode
and does not render in demo mode, and that the disclosed set equals the registry's demo-in-both-modes
set; the existing `connect-src 'self'` deployment constraint stands (an api deployment is same-origin,
or the CSP changes by a separately recorded decision).

**Status.** ✅ **Recorded — decided before M11 (2026-09-16, by the owner's decision-record pass); landed with M11.** The owner authorized the exact scope on 2026-09-17, and the behaviour landed at M11's implementation checkpoint `53794d57a7375c8345f76adec9248f5da09d7a92` (*feat(m11): D8 — declare demo-backed domains in api mode*): the single `DEMO_SERVED_DOMAINS` enumeration at the registry's composition root, the persistent non-dismissable `DemoBackedNotice` in the shell and on login (api mode only, absent in demo, no health or ping claim), pinned by `src/components/shell/__tests__/DemoBackedNotice.test.tsx` — **6 cases** including the stale-enumeration tripwire.

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

**Measured baseline (2026-09-16, `npm run build` on the accepted M10 closure `c16890f`, the only
measurement this pass performed — read-only, no source or config touched):**

| Artifact | raw bytes | gzip bytes |
|---|---|---|
| `dist/assets/index-*.js` (the single JS chunk — all views eager) | 984 476 | 273 791 |
| `dist/assets/index-*.css` | 115 373 | 16 453 |
| `dist/index.html` | 1 885 | 999 |
| **JS + CSS + HTML gzip total** | — | **291 243** |
| **Total `dist/`** | **2 188 993** | — |

plus three JPgs (410 331 B raw) and twelve Vazirmatn font files. `src/App.tsx` carries **14** static
view imports with **zero** `lazy(` / `Suspense` (the spec's figure of 13 predates the Class
Compensation workstream's view; measured today). The `@fontsource/vazirmatn` class census is fresh:
`font-normal` 1, `font-medium` 115, `font-semibold` 77, `font-bold` 6 — and **`font-light`,
`font-thin`, `font-extrabold`, `font-black` occur zero times** — so weights **300 and 800 are
provably unused**; their two `@import` lines are dead code. Vite's `chunkSizeWarningLimit` fires at
500 kB today; `vite.config.ts:45-67` pins *why* assets must stay hashed-external (`script-src
'self'`). `src/__tests__/cspCompatibility.test.ts`'s eight tests key on `dist/index.html` via
`describe.skipIf`, so the same tree skips them without a build and runs them with one (this is the
documented source of the contingent 8-skipped runs in earlier session logs).

**Decision recorded (2026-09-16, documents only).** D9 fixes the **shape and anchors** of the budget,
and defers each end-figure to the mandated order (measure → split → encode — spec §M11 step ⑦):

1. **Order is enforceable:** no numeric end-figure enters any test before M11's implementation pass
   has measured the post-split build; the numbers above are the anchors, not targets.
2. **Direction is enforceable:** the entry chunk's **gzip size must strictly decrease** from
   273 791 B after splitting (lazy view mounting as the I6 done-when demands, plus a vendor chunk);
   total JS+CSS+HTML gzip may not exceed the baseline by more than **+5%** (a split pays some
   loader/chunk overhead and the margin must be pre-declared rather than negotiated after the fact);
   and no **single** chunk may reach the 400 000 B gzip mark, which is where the 500 kB raw warning
   class begins.
3. **The dead weights are removed, not merely budgeted:** the two provably unused
   `@fontsource/vazirmatn` imports (300 and 800) go; a weight returning later must name its consumer.
4. **The warning is cleared by splitting, never by threshold:** raising `chunkSizeWarningLimit` is
   recorded as a failure condition of the milestone, not a knob.

None of these margins is an *outcome* prediction — they are baseline-anchored bounds the M11
measurement writes into a test after the split lands, replacing any that the real split proves wrong
(with the proof recorded).

**Status.** ✅ **Recorded — decided before M11 (2026-09-16, by the owner's decision-record pass); landed with M11.** The owner authorized the exact scope on 2026-09-17; the split landed at `3eed4f190b6538ad62bf35d7b0c9fa5afc310acc` and the gate at `24998d8330a95510cd969c872edb28ddcc59ef16`.
**Measured after M11's landing** (CLI `gzip -6 -n`, same method as the recorded baseline) — the encoder then verified the gate is satisfiable by exactly these values: entry JS gzip **108 207** B (baseline 273 791 B), vendor gzip **60 108** B, total JS+CSS+HTML gzip **298 249** B (within the +5% cap 305 805 B), largest single chunk gzip **108 207** B (below the 400 000 B ceiling), `dist/` raw **1 964 789** B. The >500 kB raw warning is silent, `chunkSizeWarningLimit` was never raised, and Vazirmatn **300/800** are gone from `dist/` — shape **A** held: nothing outside the predicted ceiling, so no recorded decision point fired.

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

**Why.** The three profile surfaces rendered relations from src/data/records.ts (the design-time fixture module, dissolved at M10) while their own
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

**Enforced by.** `src/domains/compensation/__tests__/derive.test.ts` (**31** cases — the derivation with
no environment, store or clock, including the lineage walk: one and two hops, a cancelled end, a deleted
entry recovered through the reverse link, a cycle and the hop cap) and `demoRepository.test.ts` (**38**)
— including a cancelled attempt returning the obligation to `required`, a hard-deleted attempt reported
as `missing`, a discharge that stays terminal while still reporting the contradiction, and the
append-only ledger across a re-booking. The clauses above are further pinned by `bookingInvariant.test.ts`
(10 — at most one live make-up, one serialized section, and the lineage cases that keep a moved make-up
`live`), `authorization.test.ts` (11 — D19's registration clause and its gate), `datasetContract.test.ts`
(15 — the collection, registry and backup rules) and `enrollmentEligibility.test.ts` (9 — **D20**'s
disclosure), **121** cases in eight files in total.

**Status.** ✅ **Landed at P1**, and **refined by C-1.1 and C-2** — the derived `scheduled` state (clause 3) and the
at-most-one-live-make-up refusal are now evaluated on the effective session at the end of the attempt's
reschedule **lineage** rather than on the ledger's own row (see **D20** and the C-1.1 package in
[PHASES.md](PHASES.md)), with the ledger still never re-pointed. Scope of the claim, stated so it is not
read as more than it is: the flow's **surface** landed later in the same workstream (`fc83d6d`,
hardened at `79fd44e` and `79ec13d`) while there is still **no `apiRepository`** (**I20**), the demo
ships **no compensable case**, and browser QA has never run on anything. **On mutation checks:** P1's own commit
carried none; the C-1, C-1.1 and C-2 packages that followed carried **ten** between them (three, five and
two), each restored byte-identically against a recorded sha256 baseline and recorded in that package's
change report — not re-measured by this documentation pass.

### D19. Compensation is one-to-one only, registered by a person, and the make-up is an ordinary session booked through the scheduling repository

**Decision.** Decided by the same landing, and binding on every later consumer:

1. **Eligibility is the class's `kind`, never the roster size.** `AcademyClass.kind === "private"` is
   the authority; a group class is refused even when it currently holds exactly one student. Counting
   roster rows would make eligibility a function of enrolment data that changes.
2. **Registration is an explicit human act.** Cancelling a session creates nothing. A secretary,
   manager or admin holding `schedule.write` registers the obligation; a teacher cannot register, book
   or discharge one. The recorded actor is **provenance, never authorization** — the permission is the
   authorization, and the server is its authority.
   **Enforcement, as landed (2026-09-15, MF-2):** all three verbs take an actor
   (`{ userId, permissions }`) and refuse an actor without `schedule.write`
   (`COMPENSATION_FORBIDDEN`, `authorization`/403) as their first statement, before any read, using the
   existing role matrix and `can()` — no compensation-specific permission exists. That is enforcement
   at the point every write passes through, and it is deliberately described as **client-side**: the
   permissions travel with the call because the browser is where the current user's permissions are
   known, so a server implementation must re-derive the actor and its permissions from the session
   token and refuse independently. Nothing in this decision changed; what changed is that the rule is
   no longer only stated.
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

**Enforced by.** `src/domains/compensation/__tests__/demoRepository.test.ts` (**38**),
`datasetContract.test.ts` (15 — the dataset, registry and backup contract), `authorization.test.ts`
(11 — clause 2's gate), `enrollmentEligibility.test.ts` (9 — clauses 1 and 3 as **D20** finalised them) and
`persianDate.test.ts` (2 — the Jalali date the operator types). The exclusions are enforced the same way rather than promised:
a group class is refused by code, no notification row is written anywhere, and the make-up session is
created through `create()` and carries `origin: "manual"`.

**Status.** ✅ **Landed at P1**, as a **workstream** rather than a milestone ("Workstream — Class
Compensation P1" in [PHASES.md](PHASES.md); it advances no phase-checkpoint row). **I18 remains OPEN and
is only PARTLY LANDED:** group and class-wide compensation, any notification, any coordination flow and
every server-side implementation are still unbuilt — the flow's **surface** now exists (`fc83d6d`,
hardened at `79fd44e` and `79ec13d`), which closes the "no UI" half of **I20** and nothing else.

### D20. Compensation eligibility at the make-up's date is disclosed on every read, never enforced

**Decision.** An obligation freezes its affected student at registration, and the enrollment behind
that student can change before the make-up is played — it can end, be withdrawn, or start after the
date an operator picks. That disagreement is **reported, never gated**:

1. **`schedule` does not refuse it, and `complete` does not block on it.** The booking is created, the
   obligation stays `scheduled`, and the make-up stays dischargeable. The debt is owed to the **frozen
   student**, not to their current enrollment row: a student who finished a term still attended the
   cancelled lesson, and a student who is not expected at the make-up is exactly the case the operator
   must learn about — not a case in which the academy keeps the obligation silently open.
2. **The read model carries the fact, per booking.** `currentAttempt.studentOnRoster` is derived on
   every read from the scheduling domain's `sessionRoster` **for the effective session's date** — so it
   follows a reschedule like every other derived answer (D18's lineage rule), and a re-enrollment or a
   corrected end date clears it with no write here. It is **never stored**: a stored acknowledgement
   would freeze a fact that moves, which is the mistake clause 1 of D19 already refuses for
   eligibility itself.
3. **`undefined` means "not determinable", never `false`.** With no attempt there is no session to ask
   about; with an unresolvable lineage the effective id is evidence rather than a target (D18/C-1.1) and
   is deliberately not looked up.
4. **The refusal stays where the rule lives.** Attendance refuses a mark for a student the session's
   roster does not expect (`ATTENDANCE_STUDENT_NOT_ON_ROSTER`), unchanged. This domain neither loosens
   that rule nor duplicates it: it makes it **predictable at booking time**, because the booking
   response carries the same fact the register will apply on the day.
5. **The pre-booking check was rejected as unanswerable and wrong-owned.** The roster is derived for a
   session's own date and the session does not exist until the scheduling domain's `create()` mints it,
   so an eligibility check before the write would need an eligibility API the scheduling contract does
   not have (a scheduling decision, **I18**); a check after the write would refuse with a session
   already in the calendar that this domain may not cancel or delete. A stored acknowledgement and a
   new `COMPENSATION_*` error code were both rejected with it.

**Why.** The failures that matter here are a **lost debt** (a make-up refused because a term ended, with
the lesson never given and nobody tracking it), a **silently surprising register** (the operator finds
out at the lesson that the mark cannot be recorded), and a **second source of truth for who is
expected**. Disclosing on read answers all three: the debt stays open and traceable, the operator sees
the roster's own answer at the moment of booking, and the roster rule stays where it is derived.

**Enforced by.** `src/domains/compensation/__tests__/enrollmentEligibility.test.ts` (9 cases — the
ordinary booking, an ended and a withdrawn enrollment, the lineage-following disclosure, the same fact
attendance refuses on, no enrollment write, no stored roster field, the C-1 refusal still answering, the
teacher still refused, and a session deleted mid-read reported rather than thrown), with the C-1 lineage
suite and the rest of the domain's 121 tests unchanged. The booking response's own contract states the
rule in `src/domains/compensation/repository.ts`; the field's semantics are in `types.ts`.

**Status.** ✅ **Landed with Class Compensation C-2** (2026-09-15), as part of the same workstream as P1
rather than a milestone. **I18 remains OPEN and only PARTLY LANDED:** group and class-wide compensation,
any notification and the server are still unbuilt (**I20**); the compensation surface that landed later
in the same workstream (`fc83d6d`, hardened at `79fd44e`/`79ec13d`) **does** render `studentOnRoster`, as
the per-read disclosure this decision describes and never as a gate.

## 20. Backend governance checkpoint (2026-09-20) — recorded, not implemented

**Decision.** Laravel-bound product decisions from the 2026-09-20 architecture audits are recorded
in [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md). They use IDs **T-02** and **O-*** (plus
PERF / HELP). They **do not** amend D1–D20 above and **do not** authorize backend or frontend
implementation.

**Why.** This workspace’s D1–D20 register is the frontend product-phase ledger. The T-02 / O-*
closures were session audits against frozen frontend evidence and were not previously written into
`docs/engineering/`. Without a durable file they evaporate; stuffing them into D1–D20 would collide
IDs (D7 accessibility ≠ O-07 tickets; D15 attachment-reference ≠ O-15 API envelope).

**Enforced by.** [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) (index + conditions). No
Laravel, migration, or `src/` change is part of this record.

**Status.** ✅ Recorded 2026-09-20 as documentation. Backend ❌ not built.

Closed for Laravel *policy* (still unimplemented): T-02 ASSIGNED-ONLY; O-12 DUAL TRANSPORT; O-13
portal = separate guard / same `users` (credential factor OPEN); O-10/O-11 chat_id→user+org
(uniqueness/UX OPEN); O-08 / O-09/O-20 / O-14 / O-16 / O-18 / O-15 / PERF = ACCEPT WITH CONDITIONS.
KEEP OPEN (no v1 domain): O-07 tickets, O-17 notifications, O-19 retention numbers, Help/KB/AI.

Performance (PERF) remains an **ongoing operational requirement**, not a v1 schema gate: Measure →
Profile → Bottleneck → Change → Re-measure; paginate with a server `per_page` cap; tenant/T-02/O-13
in SQL; indexes only for real filters/FKs/uniques; time-bounded session queries; media bytes off the
Laravel path; backup/restore/large export as async jobs; keep frontend code-splitting; audit off the
read hot path; do not add Redis, Elasticsearch, WebSocket, CDN, or microservices now.

### Pre-start decision pass (2026-09-21) — pointer, amends no D-entry

**Decision.** A documents-only pass closed the documentation items a read-only backend-architecture gate
found open before Laravel work: **`B1` (Laravel Domain Structure)** was resolved from PROVISIONAL to
**DECIDED** in [12-decision-register.md](../frontend-completion/12-decision-register.md) — that file's
`B1`, **not** the unrelated M4 audit `B1`/`B2` in [PROJECT_STATE.md](PROJECT_STATE.md); the live status of
**`O-01`…`O-06`** (which the 2026-09-20 checkpoint's index does not carry) was recorded there, with `O-01`,
`O-02` and the Gallery half of `O-03` marked **open and prerequisite** for the tables they touch; the
**`O-12` client-transport reconciliation requirement** was documented without reinterpreting the decision;
and **one tenant-enforcement seam** was recorded as an implementation-level architecture decision.

**Enforced by.** [12-decision-register.md](../frontend-completion/12-decision-register.md) → “Pre-start
resolution pass — 2026-09-21”. This pointer adds no D-number, amends no D1–D20 entry, and does not alter
[GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md), whose statuses stand as recorded.

**Status.** ✅ Recorded as documentation. It is **not** implementation authorization: Laravel/backend
remains ❌ not started and not authorized, and no `src/`, test, package, deployment or backend file is
part of the pass.

## 21. The state-document gate: a bounded preserved-branch SHA exception and the durable working-branch invariant

**Decision.** Two clauses of `src/__tests__/projectState.test.ts` were aligned with the recorded
policy on 2026-09-25, by explicit owner decision (the conflict and the options were registered as
**L8** in [OPEN_ITEMS.md](OPEN_ITEMS.md)).

*The reachability clause keeps its force for every full SHA in the four state documents.* Exactly
two SHAs are exempt: the preserved, unmerged branch tips registered by full SHA in
[PROJECT_STATE.md](PROJECT_STATE.md) §2 (`251af96f…` and `94d32de3…`). History deliberately never
merged those branches, and the preservation rule requires their full SHAs to stay recorded, so
"reachable from `HEAD`" can never hold for them. The exception is closed to those two SHAs and is
self-guarding: each must still exist as a commit and still be registered by full SHA in §2, so it
covers no other SHA and cannot outlive its evidence. The rule text in
[PROJECT_STATE.md](PROJECT_STATE.md) §3 records the exception; the gate cites this entry.

*The working-branch clause stops comparing a durable fact with a per-session fact.* The old
assertion — "the recorded working branch is the branch actually checked out" — failed by
construction in every session sandbox, where the checkout is a per-session branch
([PROJECT_STATE.md](PROJECT_STATE.md) §7 item 16). The replacement asserts the durable facts
instead: the recorded branch exists on the remote as a fetched remote-tracking ref, and the local
branch of the same name, when it exists, is level with it.

**Why.** Both clauses as written contradicted recorded rules of their own: the reachability clause
against the preservation of the two branch tips, and the checkout clause against the fact that a
sandbox branch is not durable (item 16 measured the failure as environmental — "recorded, not
fixed, silenced or accommodated"). The three alternatives were rejected by name: weakening the
reachability rule for every SHA, shortening or deleting the recorded evidence, and merging or
rewriting the preserved history. This entry is the recorded owner decision the earlier state
demanded; it changes the *testable form* of two checks and no product behaviour.

**Enforced by.** `src/__tests__/projectState.test.ts` — "no document quotes a commit that does not
already exist" (the closed, self-guarding exception) and "the recorded working branch is a durable
branch, in step with its remote". [OPEN_ITEMS.md](OPEN_ITEMS.md) item **L8** records the conflict
and its resolution; [PROJECT_STATE.md](PROJECT_STATE.md) §7 item 16 remains the record of the
period in which the old assertion failed.

**Status.** ✅ In force 2026-09-25. A governance-document decision: it authorizes no product,
dependency, threshold, backend or history change, and it is the only reason either gate clause
reads differently today.

### Adding a decision

Append a numbered entry with the same four fields, name the file or test that enforces it, and
link it from [PROJECT_STATE.md](PROJECT_STATE.md) §6 if it is test-protected. A decision nobody
can point at in code is a wish, not a decision. Laravel-bound T-02 / O-* closures go in
[GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md), not as new D-numbers.
