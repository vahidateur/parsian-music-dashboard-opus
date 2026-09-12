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

**Status.** ✅ Domain complete and protected. ❌ The view still renders fixtures and fakes
success — see [OPEN_ITEMS.md](OPEN_ITEMS.md).

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

**Status.** ✅ In force and protected.

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
dashboard insight panels presenting fabricated text as measurement (**H4**); three Settings panels
still hardcoding the demo label on a real write (**H7**, found after H3 landed and deliberately left
outside M2's approved scope); edit dialogs that open with an empty draft and can silently overwrite
a stored record (**H6**); and the attendance «ثبت نهایی» wording, deferred to the attendance wiring
by explicit decision (**I12**).

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

## 19. Product-phase decision register (D1–D9)

Nine decisions gate the product-feature phase planned in
[PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md). They are numbered **D1–D9** to
keep them distinguishable from the §1–§18 architecture decisions above, which they never override:
where a D-entry touches an existing section, that section is the authority and the D-entry says so.
Two are already decided (both by deferral); seven are open, and each open entry names the milestone
it blocks. An open decision is **not** an invitation to implement — it is a stop sign with a reason.

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
which is not a login principal and is unaffected.

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
or seed roles).

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

---

### Adding a decision

Append a numbered entry with the same four fields, name the file or test that enforces it, and
link it from [PROJECT_STATE.md](PROJECT_STATE.md) §6 if it is test-protected. A decision nobody
can point at in code is a wish, not a decision.
