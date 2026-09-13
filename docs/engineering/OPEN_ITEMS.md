# OPEN ITEMS — categorised backlog of unresolved work

Nothing in this file is complete. Items may only leave it by **landing** (with the commit SHA
recorded in [PHASES.md](PHASES.md)) or by an explicit, written decision to drop them.
**Deferred work must never be reported as finished work.**

> **Start here:** read [PROJECT_STATE.md](PROJECT_STATE.md) first — it carries the current
> checkpoint, phase status, validation results and the DO-NOT list. This file is the backlog that
> document points at (§8), and its §9 says which item to begin with.

Every item carries evidence (`file:line` or a test/doc path) so the next session can verify it
instead of trusting this file. Line numbers were correct at `33b1031` (2026-09-08) and may
drift — re-grep before editing.

---

## CRITICAL / HIGH

### H1. Scheduling and Attendance views ignore their own real domains
- **What:** Both domains are complete and heavily tested (Group A: 211 tests; Group D: 79
  tests) with `repository.ts` / `demoRepository.ts` / `apiRepository.ts` / hooks / registry
  wiring — yet `src/views/Scheduling.tsx` and `src/views/Attendance.tsx` still read static
  fixtures from `src/data/records.ts` and `src/data/academy.ts`.
- **Why it is critical:** the product looks finished where it is not, and the tested domain
  logic (conflict engine, materialized sessions, append-only corrections, derived rosters) is
  invisible to the user.
- **Deferred because:** Phase 2 was scoped to the data lifecycle; re-wiring two views is a
  product-phase change with its own UX decisions.
- **Done when:** both views read exclusively through `useScheduling` / `useAttendance`, the
  fixture imports are gone, `src/__tests__/architectureBoundaries.test.ts` still passes, and
  new suites assert that fixture records do **not** appear when the repository returns
  something else (the `Students.test.tsx` pattern).

### H2. Fake-success UX (a toast claims a write or a delivery that never happened)
- **Confirmed instances** (a `notify({ tone: "success" })` with **no** repository call behind it):
  - `src/views/Scheduling.tsx:144` — «تعارض برطرف شد · پیانو پیشرفته به اتاق ۴ منتقل شد · مدرس و هنرجو مطلع شدند»
  - `src/views/Scheduling.tsx:327` — «تعارض برطرف شد · کلاس به اتاق ۴ منتقل شد» (only sets local React state)
  - `src/views/Attendance.tsx:46` — «همه حاضر ثبت شدند»
  - `src/views/Attendance.tsx:224` — «پیام پیگیری ارسال شد»
  - `src/views/Finance.tsx:98` — «یادآوری ارسال شد · پیامک برای …»
  - `src/views/Finance.tsx:285` — «یادآوری گروهی ارسال شد · N پیام در صف ارسال قرار گرفت»
  - `src/views/Classes.tsx:234` — «پیشنهاد بازهٔ جدید ثبت شد · برای بررسی به برنامه‌ریزی ارسال شد»
- **Status: ✅ LANDED by M2** (its commit SHA is registered in [PHASES.md](PHASES.md) by the *next*
  commit, per the no-self-referential-SHA rule). Kept visible as a completed record, because the
  "not fake" list below is still the guidance for anyone touching these views. The line numbers
  above are the **pre-M2** ones: the sites themselves no longer exist.
- **What landed, and the rule that decided each shape.** None of these four views can write —
  scheduling and attendance have real domains the views do not use yet, finance has none — so no
  site could become "the result of an awaited repository call". Each therefore became an honest
  `info` in the sanctioned "requires a server" shape, a truthful navigation, or nothing at all.
  Where no truthful action existed the control was **removed rather than disabled**, on the owner's
  explicit decision: a disabled button still advertises a capability the product does not have.
  - `src/views/Scheduling.tsx` — both «انتقال به اتاق ۴» buttons are gone, together with the local
    `resolved` flag whose only real effect was hiding the warning. The conflict card and the
    drawer's overlap evidence stay on screen until a real `rescheduleSession` resolves them, the
    drawer no longer closes on a claimed write, and «مشاهده در تقویم» still navigates.
  - `src/views/Attendance.tsx` — «همه حاضر» keeps its genuine on-screen convenience, relabelled
    «همه حاضر (موقت)», and now says in `info` that no attendance has been recorded; a real
    `bulkRecord` needs a domain session id and an authenticated `recordedByUserId` this view does
    not have. The «پیگیری» button, which claimed a student **and their guardian** had been
    notified, is removed; the row still opens that student's real profile.
  - `src/views/Finance.tsx` — both reminders now say in `info` that an SMS service is required and
    that nothing was sent or queued. The invented «N پیام در صف ارسال قرار گرفت» count is gone.
  - `src/views/Classes.tsx` — the waitlist button no longer claims a suggestion was filed with
    scheduling (no such record exists anywhere); it opens the schedule, the one truthful action
    available before session generation lands.
- **Enforced by** `src/__tests__/writeFeedbackHonesty.test.ts` (a view may only report success where
  it can reach a repository, and the four fixture-driven views may contain no success toast at all —
  for them the absence is a proof, not a convention) and
  `src/views/__tests__/noSuccessWithoutWrite.test.tsx` (each site's new behaviour, driven through
  the real view in DEMO and in a customer's EMPTY environment).
- **Not fake (verified — do not "fix" these):** `src/views/Classes.tsx:118` (archive, with a
  real `catch` → `tone: "danger"` at :121), `Classes.tsx:279` / `:291` (dialog `onSaved` /
  `onEnrolled` after real writes), `Students.tsx:136/628/755`, `Teachers.tsx:126/365`,
  `Messages.tsx:131/190`, and every honest `tone: "info"` toast that says a server is required
  (`Attendance.tsx:51`, `Finance.tsx:170`, `Library.tsx:334`, `Messages.tsx:172` and `:313`,
  `Reports.tsx:43`, `Students.tsx:677`, `Teachers.tsx:321`,
  `src/components/layout/TopBar.tsx:91`, `src/components/overlays/ActionSheet.tsx:94`).
  `src/views/DesignSystemView.tsx:178` is the design-system showcase, not a product surface.
- **Done when:** every success toast is the result of an awaited repository call with an honest
  failure path, and a test asserts that no success notification can fire without a write.
  **Satisfied at M2**, in the second of those two forms and in the only form these views can
  currently reach: no success notification *can* fire from them, because none exists in their source
  and `src/__tests__/writeFeedbackHonesty.test.ts` fails the suite if one is added. The first form
  needs the awaited repository calls that M4 (scheduling) and M5 (attendance) bring; the sites that
  already wrote for real keep satisfying it and are the "not fake" list below.

### H3. Real writes are labelled "demo data" in domain views (found while writing these docs, 2026-09-08)
- **Status: ✅ LANDED by M2** for the five audited sites (its commit SHA is registered in
  [PHASES.md](PHASES.md) by the *next* commit). All five now take their wording from
  `useIsDemoEnvironment()` (`src/domains/demo/useDataLifecycle.ts`) — the seam `DemoDataPanel` and
  `DemoNote` already used — so a customer's EMPTY environment reads «تغییرات در داده‌ها ذخیره شد.»
  while DEMO keeps saying «تغییرات در دادهٔ دمو ذخیره شد.» No view branches on where data lives; it
  asks. `src/views/Students.tsx` mounted its dialog twice and carried **two copies** of the literal,
  which is how it survived review, so both now share one confirmation.
- **Pinned in both directions,** because "EMPTY must not say demo" on its own would also pass if
  someone deleted the demo label from the product: `src/views/__tests__/honestWriteCopy.test.tsx`
  asserts the EMPTY *and* the DEMO wording for all five sites through the real dialogs and real
  repositories; `src/views/__tests__/emptyEnvironment.test.tsx` gained a write case («دمو» cannot
  appear after a real write in EMPTY) and
  `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx` the branding one;
  `src/__tests__/writeFeedbackHonesty.test.ts` fails the suite if any of the four stops deriving its
  copy from the seam.
- **The same defect survives in three Settings panels,** found after this landed — recorded as
  **H7** below rather than folded in here, because those files were not part of the audited five and
  M2's scope was fixed before they were found.
- **What:** five success toasts describe a **real** repository write as demo storage, so in a
  customer's EMPTY environment the app tells the customer their own data is demo data:
  `src/views/Students.tsx:630` · `src/views/Students.tsx:757` · `src/views/Teachers.tsx:367` ·
  `src/views/Classes.tsx:281` («تغییرات در دادهٔ دمو ذخیره شد.») ·
  `src/domains/branding/BrandingPanel.tsx:115` («تغییرات در دادهٔ دمو ثبت شد.»).
- **Context:** this is the same dishonesty Phase 2 removed from
  `src/components/settings/DemoDataPanel.tsx`, which is now environment-aware — the fix pattern
  already exists in the codebase.
- **The login screen had the same defect — corrected (labels only).** An earlier revision of this
  file called `src/views/Login.tsx` "correctly gated … and intentional". That was wrong: the panel
  was gated on `isDemoMode()` alone (`src/views/Login.tsx:45`), so a customer's EMPTY environment
  was announced as «محیط دمو — بدون امنیت واقعی» and their own bootstrap administrator was listed
  as one of the «حساب‌های نمونه». The wording now comes from `useIsDemoEnvironment()`.
  **Capability deliberately preserved** — the panel still renders whenever the data source is demo,
  the passphrase is still visible and the bootstrap account still signs in, because that account is
  the only way into an EMPTY environment. Pinned by
  `src/views/__tests__/loginEmptyEnvironment.test.tsx`; api-mode isolation is unchanged and still
  pinned by `src/views/__tests__/loginDemoIsolation.test.tsx`. The five toast labels above were
  landed by M2; the three Settings panels in **H7** were not part of that audit and are still open.
- **Done when:** the copy is derived from `isDemoEnvironment()` via
  `src/domains/demo/useDataLifecycle.ts` (no direct store imports in views — the boundary test
  enforces that), and `src/views/__tests__/emptyEnvironment.test.tsx` asserts the word «دمو»
  cannot appear after a real write in EMPTY. **Satisfied at M2** for the five audited sites, through
  `useIsDemoEnvironment()` — the hook form of the same seam, so no view touches the store and
  `src/__tests__/architectureBoundaries.test.ts` stays green. H7 carries the three that were not in
  this audit.

### H4. Dashboard insight panels present fabricated text as measurement
- **What:** `src/components/panels/Intelligence.tsx`, `BusinessIntelligence.tsx`,
  `Signals.tsx` and `AttentionAndFlow.tsx` import static fixtures from `src/data/academy.ts`
  (`signals`, `growthSeries`, `revenueSeries`, `occupancy`, `quickActions`, `todayFlowIds`) and
  render sentences such as a retention-rate increase or a Tuesday piano-occupancy figure that
  have no relation to stored records — including in EMPTY, where there are zero records.
- **Deferred because:** the correct fix is deriving every number from live repositories
  (`useAcademyMetrics` already exists for the hero metrics), which is product-phase work.
- **Done when:** each insight is computed from loaded data, states «داده‌ای نیست» when the
  input set is empty (via `src/lib/stats.ts` + `NO_DATA`), and a test renders the dashboard in
  EMPTY asserting no fabricated figure or sentence survives.

### H5. Recovery from an unusable environment — `clear()` remains a one-way door for records
- **What:** `clear()` still empties every collection including `users`, so no account remains and
  sign-in becomes impossible. The lifecycle marker survives, so
  `src/components/lifecycle/DataLifecycleGate.tsx` stays transparent and parks the visitor on a
  login screen that cannot succeed. Settings — and therefore "restore a backup" — remains
  *behind* that login. The destructive operation itself is intentionally unchanged; recovery is
  the separate `uninitializeEnvironment()` path
  (`src/domains/demo/lifecycle.ts`), exposed through `demoDataManager.uninitialize()`
  (`src/domains/demo/demoDataManager.ts`).
- **Status: ✅ LANDED by M1** (this milestone; its commit SHA is registered in
  [PHASES.md](PHASES.md) by the *next* commit, per the no-self-referential-SHA rule). Kept visible
  here as a completed record rather than deleted, because I10's invariant below still constrains any
  future change and the entry is the cross-reference for it.
- **M1 landed the gate-owned recovery.** `src/components/lifecycle/DataLifecycleGate.tsx` owns the
  recovery controller and publishes it through `src/components/lifecycle/LifecycleRecoveryContext.ts`;
  `src/components/lifecycle/LifecycleRecoveryPanel.tsx` is rendered by `src/views/Login.tsx` outside
  `Shell`/Settings only for local initialized EMPTY and DEMO environments, and is absent in API
  mode. The existing destructive-action seam (`src/domains/demo/useDemoData.ts`) provides a two-step
  request/confirm flow, displays `manager.stats()` counts, awaits `uninitialize`, and surfaces the
  exact `UninitializeResult.message` including a blob-cleanup failure clause. After the reset, the
  gate returns to `FirstRunChooser`, which blocks the choices until async cleanup ends.
- **Priority: CRITICAL** (historical). A confirmed `clear()` could render a customer's environment
  unusable; that is why M1 was sequenced first. The M1-specific decisions are recorded in
  [DECISIONS.md](DECISIONS.md) §19 (D3/D4) and reflected in §8 and §18; I10 preserves the
  zero-record invariant.
- **Clear semantics remain unchanged:** M1 did not re-add a bootstrap account or alter the meaning
  of `clear()`; `uninitialize` removes the environment itself, including stored binaries.
- **Verified when it landed:** the "start over / choose the environment again" affordance is
  **outside** the signed-in shell, calls `uninitialize`, and tests cover the lockout, cancellation,
  successful transition, verbatim blob-failure propagation and the way back to both EMPTY and DEMO
  (`src/components/lifecycle/__tests__/DataLifecycleGate.test.tsx`,
  `src/domains/demo/__tests__/useDemoData.test.tsx`,
  `src/domains/demo/__tests__/dataLifecycle.test.ts`,
  `src/components/settings/__tests__/DemoDataPanel.test.tsx`).

### H6. Every edit dialog opens with an empty draft, so "edit" means retype-or-erase (found 2026-09-12, while writing M2's H3 tests)
- **Status: ✅ LANDED by M2.1** — `73b40d970816f174b56d37addc21f106a472359b`, registered in
  [PHASES.md](PHASES.md). Kept visible as a completed record, with the evidence, because the shape of
  the defect is what makes the regression tests worth reading.
- **What:** `useEntityForm` seeded its draft with `useState(initial)`
  (`src/domains/shared/useEntityForm.ts`) and nothing ever re-synced it. The dialogs stay mounted
  while closed — `if (!open) return null` runs *after* the hooks — no parent keys them by record,
  and none of them called the `reset()` the hook already exposed. So when a view set `editing` and
  opened the dialog, the operator was shown the empty create-draft defaults instead of the record.
- **Correction to this record, made during the M2.1 triage:** it originally named three dialogs
  (student, teacher, class). The affected set is **six dialogs across seven mount sites** — also
  `src/domains/instruments/InstrumentFormDialog.tsx`,
  `src/domains/rooms/RoomFormDialog.tsx` and
  `src/domains/progress/PieceFormDialog.tsx`, mounted by `InstrumentsPanel.tsx`, `RoomsPanel.tsx`
  and `RepertoirePanel.tsx`. Two dialogs were **never** affected and were left alone:
  `AssignPieceDialog` and `RecordProgressDialog`, because `StudentProgressPanel.tsx` mounts them
  conditionally (`{recording && …}`), so React remounts them with fresh state — the correct pattern,
  already in the repository.
- **Two paths to loss, not one.** (1) *Blank-on-open:* the title read «ویرایش سارا محمدی» while the
  fields held create defaults, and submitting wrote those defaults over the stored record. (2)
  *Cross-record contamination:* open A, type, cancel, open B — B's form still held **A's typed
  values**, so saving wrote A's data onto B's id. Cancel kept the typing because nothing reset it.
  Navigation was the one escape: `src/App.tsx` renders a single view at a time, so leaving the view
  unmounted the dialog.
- **Why the defaults were the dangerous part:** required-field validation blocked a wholly blank
  save, so the operator had to retype those — but every field whose `toDraft(undefined)` default is
  *plausible* passed validation silently and overwrote the record: instrument → «piano», status →
  «active», class time → «17:00», capacity → 6, tuition → 3000000, piece `rangeUnit` → «measure».
  Two of them reversed documented rules: an edit **re-activated** a deactivated instrument, room or
  piece (the panels instruct «به‌جای حذف آن را غیرفعال کنید») and **un-archived** an archived class.
  Erasure was durable, not cosmetic: `src/services/demoStore.ts` merges `{ …row, …clone(patch) }`
  and its `clone` is `structuredClone`, which preserves an explicit `undefined` — so a payload's
  `photoMediaId: undefined` deleted a student's photo, `guardian` deleted the guardian, and a
  teacher's `bio` and a piece's `programId` went the same way. Persisted to localStorage, so it
  survived reload.
- **Evidence it was already happening (not hypothetical):**
  `src/domains/instruments/__tests__/InstrumentsPanel.test.tsx` → "saves a renamed instrument"
  clicked ویرایش on گیتار, changed only the name, saved, and asserted the name — while the payload
  carried `description: ""`, erasing «ساز زهی مضرابی؛ کلاسیک، پاپ و فلامنکو.»
  (`src/domains/instruments/catalog.ts`) on every run of the suite. No test anywhere read a prefilled
  value: `getByDisplayValue`/`toHaveValue` had zero matches in `src`.
- **Why no test caught it:** the CRUD suites mount each dialog with its record already present
  (`src/views/__tests__/DomainCrud.test.tsx`, `src/views/__tests__/StudentCrud.test.tsx`), which is
  the one path that works, and the panel suite rendered the panel but only asserted the field it had
  typed. `src/views/__tests__/honestWriteCopy.test.tsx` documented the workaround it had to use —
  fill every field — rather than depending on the bug's presence or absence, so it stayed valid
  across the fix (its comment now says so in the past tense).
- **What landed:** `EntityFormOptions` gained an optional `open`, and the hook rebuilds the draft
  from the newest `initial` whenever the surface opens — `initial` is held in a ref and is
  deliberately **not** an effect dependency, because callers build it inline (`toDraft(record)`) so it
  is a fresh object every render and depending on it would wipe typing on each keystroke. `reset()`
  now has a stable identity for the same reason. The six dialogs pass the `open` prop they already
  had; no mount site changed, and no new form can inherit the defect without opting out.
  **Not changed, deliberately:** `demoStore`'s merge semantics. Hardening `update` to ignore an
  explicit `undefined` would change repository behaviour for every caller and destroy the legitimate
  "clear this optional field" intent — the wrong boundary was the form, not the store.
- **Audited while fixing:** `toDraft` ↔ payload symmetry for all six dialogs, mechanically. Every
  field sent on update is prefilled, so the prefill closes every erasure path (a class's `status`
  maps from the draft's `archived`; an instrument's `slug` is intentionally not sent on edit).
- **Pinned by** `src/domains/shared/__tests__/entityFormDraft.test.tsx` — 18 cases, three per entity
  (opens on the record's own values; changing one field preserves every other field **in the store**;
  A → cancel → B cannot carry A's draft into B), each driving the production sequence of mounting
  closed with no record and *then* opening on one. Plus the strengthened panel case above, which now
  asserts the description, `active` and `slug` survive a name edit. **Mutation-verified:** reverting
  the hook fails all 18 and the panel case, with the panel case reporting `expected '' to be 'ساز زهی
  مضرابی؛ کلاسیک، پاپ و فلامنکو.'` — the erasure itself.

### H7. Three Settings panels still call a real write "demo data" (found 2026-09-12, after H3 landed)
- **What:** the identical H3 defect in the panels that live inside Settings rather than on a route of
  their own. `src/domains/instruments/InstrumentsPanel.tsx`,
  `src/domains/progress/RepertoirePanel.tsx` and `src/domains/rooms/RoomsPanel.tsx` each confirm an
  awaited repository write with a hardcoded «تغییرات در دادهٔ دمو ذخیره شد.», so in a customer's
  EMPTY environment their own instrument, piece and room are announced as demo data.
- **Why it was missed:** H3's audit enumerated the domain *views* plus branding. These three are
  domain components rendered by `src/views/Settings.tsx`, outside the audited set, and each has a
  real `catch` → `tone: "danger"` path beside the mislabel, so it reads as honest at a glance.
- **Status: ✅ LANDED by M2.1** — `73b40d970816f174b56d37addc21f106a472359b`, registered in
  [PHASES.md](PHASES.md). All three now derive the confirmation from `useIsDemoEnvironment()`
  (`src/domains/demo/useDataLifecycle.ts`) exactly as `src/domains/branding/BrandingPanel.tsx` does:
  EMPTY reads «تغییرات در داده‌ها ذخیره شد.» and DEMO keeps «تغییرات در دادهٔ دمو ذخیره شد.». The
  awaited write, the `catch` and the `danger` path are untouched — only the label changed, and no
  panel branches on where data lives.
- **Why it was worth doing with H6 rather than after it:** H6's affected panels *are* these three
  files. Fixing H7 separately would have touched the same three files twice and left the ratchet
  non-empty in between.
- **Ratchet retired, not removed:** `src/__tests__/writeFeedbackHonesty.test.ts` asserted that the
  set of files carrying a hardcoded demo label was *exactly* these three. That list is now **empty**
  and stays in the file as a tripwire — the first source file that hardcodes the label on a write
  fails the suite — and the three panels joined the list of surfaces pinned as *deriving* their copy,
  so removing the seam from any of them fails too.
- **Pinned in both directions by** `src/views/__tests__/honestWriteCopy.test.tsx`, which gained an
  EMPTY and a DEMO case per panel (six cases) driving a real create through the real panel and
  reading the record back, so the wording is asserted about a write that demonstrably happened.
  **Mutation-verified:** reverting the three panels fails the three EMPTY cases and both ratchet
  cases, naming exactly those files, while the DEMO cases still pass — correctly, since DEMO's copy
  was never wrong.

---

## IMPORTANT

### I1. Static sidebar badges and hints
`src/components/layout/Sidebar.tsx:120` renders `badge={n.badge}` from the static `navGroups`
fixture in `src/data/academy.ts`, so counts (e.g. attendance, messages) are shown in EMPTY
where the true value is zero. **Done when:** badges come from repositories and disappear at
zero. (Verified false-in-EMPTY during the Phase 2 audit; deliberately not fixed there because
it needs live counters, not a lifecycle change.)

### I2. Finance and Reports have no domain layer
`src/views/Finance.tsx` and `src/views/Reports.tsx` are fixture renderers with no
`src/domains/finance` / `src/domains/reports` implementation (only README stubs exist). Money
precision, idempotency and gateway behaviour are backend requirements — see
`docs/production-handoff.md`. **Done when:** both follow the Students pattern with demo *and*
API implementations, tests, and no fixture imports.

### I3. Learning-content → level assignment UI
The learning domain models `Piece` vs `LearningContent`, programs, levels, placement history,
eligibility and deterministic recommendations (`src/domains/learning`,
`src/domains/progress`, documented in `docs/architecture/data-layer.md`), but there is no UI to
assign content to a level.

**Scope clarification — this is a UI and workflow gap, not a schema redesign.** The join entity and
its repository surface already exist and are already tested: `LevelContentLink` at
`src/domains/learning/types.ts:183`; the contract methods `listLinks` / `attachContent` at
`src/domains/learning/repository.ts:56`; the demo implementation, including link ordering and the
`CONTENT_ALREADY_LINKED` conflict, at `src/domains/learning/demoRepository.ts:233`; and coverage in
`src/domains/learning/__tests__/demoRepository.test.ts`. Today **only tests call them**.

**Done when:** an assignment surface exists in Settings → Programs & levels (or the learning
workspace), writes through that existing contract, and is covered by a test.

- **Status (2026-09-13): LANDED by M3 at `e5b0a57`, and M3 is 🚧 IN PROGRESS — this item is not
  closed yet.** All three of the "done when" conditions are met in code: `LevelContentPanel` renders
  in Settings → Programs & levels behind a per-level «منابع» toggle, it writes through
  `attachContent` / `detachContent` and reads through `listContent` (no new contract, no schema
  change), and it is covered by 16 tests in
  `src/domains/learning/__tests__/LevelContentPanel.test.tsx` and
  `src/domains/learning/__tests__/contentAssignmentFlow.test.tsx`. What is *not* done is the
  milestone: the owner has not accepted the surface and there is no browser QA (§5 of
  [PROJECT_STATE.md](PROJECT_STATE.md) records it NOT VERIFIED). Reporting I3 as closed now would be
  reporting unfinished work as finished, so it stays open until M3 is accepted.

### I4. Teacher visual workspace
No dedicated teacher-facing workspace exists; teachers are managed as records
(`src/views/Teachers.tsx`). Product-phase scope, including which of the teacher's own data a
teacher role may see (authorization is a backend concern).

### I5. Student visual workspace + the unresolved student-role decision
**Blocked on a product decision that has not been made:** does a student (or a parent) get a
role in this panel at all, or a separate app? `README.md` roadmap lists "پنل مدرس و اپلیکیشن
هنرجو" as future work sharing the same domain concepts. Attendance corrections concern minors,
so privacy rules in `docs/security.md` §7 and `docs/production-handoff.md` → Privacy apply.
**Do not implement before the role decision is recorded in [DECISIONS.md](DECISIONS.md).**

### I6. Performance and code-splitting
`npm run build` emits a main chunk > 500 kB (`dist/assets/index-*.js` ≈ 844 kB at `33b1031`).
`src/App.tsx` imports all thirteen `src/views` eagerly (13 static view imports), so there is no
route-level code-splitting and no lazy loading; the build config in `vite.config.ts` sets no
bundle budget. **Done when:** the warning is resolved by real splitting (not by raising the
warning threshold), with a measured before/after, and `src/__tests__/routeProtection.test.tsx`
plus the EMPTY-environment suites still pass against lazily mounted views.

### I7. Official Telegram / Bale messaging provider research
Outbound messaging is currently an honest "requires a server" info toast
(`src/views/Messages.tsx:172`, `:313`). No provider integration exists, and **no research has
been done** — official Telegram Bot API and Bale provider capabilities, rate limits,
verification requirements and credential handling are all still unknown. Credentials must be
backend-only (never in React source, `VITE_*` or `localStorage`). **Done when:** a written
comparison exists in `docs/` with a recommended integration shape and its server-side
requirements.

### I8. Backup envelope labels every backup "demo"
`createBackup()` always stamps `environment: "demo"`, an app name ending `(DEMO)` and the
filename `arena-demo-backup-*.json` — even for a customer's EMPTY data (documented in
`docs/architecture/demo-data.md`). Evidence, line by line: the `environment` field at
`src/domains/demo/backup.ts:96`, the app-name suffix at `src/domains/demo/backup.ts:98`, the
filename at `src/domains/demo/backup.ts:106` (built by `backupFileName()`), and the
`WRONG_ENVIRONMENT` restore-validation rule at lines 166–167 of the same file. Round-trip is
lossless; the **labels** are wrong, and the `WRONG_ENVIRONMENT` rule plus several tests depend
on the current shape.
**Deferred because:** changing it is a versioned format change, not a copy fix. **Done when:**
the envelope records the real lifecycle state, the validation rule and filename follow, a
migration accepts old envelopes, and the Phase 2 backup suites are extended rather than
weakened.

### I9. Latent crashes in the design system on empty series
`Sparkline` (`src/components/ds/primitives.tsx:184`) computes `Math.min(...data)` /
`Math.max(...data)`, which on `data={[]}` yield `Infinity` / `-Infinity` and degenerate
coordinates; `BusinessIntelligence` (`src/components/panels/BusinessIntelligence.tsx:63`) reads
`revenueSeries[n - 1].value` and `[n - 2].value`, which throws on an empty series. Unreachable
today because every caller passes a static fixture from `src/data/academy.ts` — it becomes
reachable the moment H4 lands. **Done when:** both guard empty input and render `NO_DATA`
(`src/lib/format.ts`), with a test that passes `[]`.

### I10. The "all collections zero" invariant constrains any fix for H5
`clear()` empties every collection including `users`, so no account remains and login is impossible
— see **H5** for the full account. M1 does **not** weaken that invariant: it does not re-add a
bootstrap account or change what `clear()` means. The separate `uninitialize` recovery path removes
the environment itself and returns to the lifecycle chooser, where a new EMPTY environment may
create its lifecycle-layer bootstrap administrator. Pre-existing behaviour remains pinned by
`src/domains/demo/__tests__/seed.test.ts`, which correctly keeps every collection at zero in the
empty dataset. That is why the bootstrap administrator lives at the lifecycle layer
(`createEmptyEnvironment()`, `src/domains/demo/lifecycle.ts`) and why `clear()` cannot simply
re-add one. **Done when:** the H5 fix lands without weakening this invariant, with the gate-owned
recovery and the zero-record tests both remaining green.

### I11. Test-harness races — both retired at their boundaries; the product behaviour behind the second is now I13 and I14
- **Retired in this pass:** `src/views/__tests__/emptyEnvironment.test.tsx` carried a harness race
  inherited from Phase 2 (`33b1031`, confirmed with `git blame`). Its shared `renderView()` waited
  only for `viewTitles[view]`, which the shell renders immediately, so it could return while
  `useResourceList` (`src/domains/shared/useResource.ts`) still had a repository read in flight.
  Symptom: *"classes reports occupancy and average attendance as absent, not as NaN"* failed twice
  in six full-suite runs with `expected '…' to contain '۰ از ۰'`, the received text still showing
  «در حال چیدن کلاس‌ها…». The *absence* assertions in the same file were unsound in the opposite
  direction: they could pass by measuring a loading placeholder.
- **Fixed at the boundary that owned it**, in test code only: `renderView()` now also waits for the
  design system's in-flight marker (`role="status"`, from `BreathingWave` in
  `src/components/ds/states.tsx`) to disappear — queried **by role, not by its Persian label**, so a
  copy change cannot silently turn the wait into a no-op. The contract is pinned for every live
  surface inside the existing `it.each(LIVE_VIEWS)` case, not only for the test that was seen to
  fail. No sleep, no retry, no assertion weakened or removed, no product source touched.
- **Evidence after the fix:** 22 consecutive targeted runs (21 tests each) and 6 consecutive full
  `npm test` runs (93 files / 1 315 tests) green, the last on the committed tree, plus one of two
  *concurrently* running full suites green — recorded in [PROJECT_STATE.md](PROJECT_STATE.md) §4.
  Only repeated runs may be reported as green; a single green run proves nothing about a race.
- **Was:** observed once under artificial double contention and left **deliberately not
  investigated**, because the pass that recorded it was scoped to three other items. **Now: ✅
  reproduced, root-caused, and the harness fixed (2026-09-12, Tier 1 — its commit SHA is registered
  in [PHASES.md](PHASES.md) by the *next* commit).** The done-when is answered, and the answer is
  **not** "an artefact of running two suites on one machine": contention only widened a window that
  exists on every run. The *product* behaviour behind that window is
  still open, split out as **I13** and **I14** below — neither is fixed and neither is reported as
  fixed.
- **Reproduction (read-only triage, 2026-09-12).** 31 focused runs of the file stayed green (10
  idle, 15 against one concurrent full suite, 6 against three). The failure then appeared in **1 of
  4** full-suite samples run as two concurrent suites — the exact original condition. It did **not**
  fail on the test this item named: the failure was
  `src/domains/learning/__tests__/LearningPanel.test.tsx` → *"adds a level at the end of the
  program"*, `AssertionError: expected 16 to be 2` at `:85`, that case taking 1373 ms against a
  306 ms baseline, while *"reorders levels and keeps the ordering contiguous"* **passed** in the same
  run (256 ms). The reorder case is named here because it is the one that lost the coin toss that
  day; every case in the file shared the two helpers and was equally exposed. A starvation timeout
  was measured and ruled out: the reorder case goes 178 ms → 483–609 ms under four-way CPU
  oversubscription, against a 5000 ms test timeout.
- **Root cause — two links, both in product code, neither changed by Tier 1.** (1)
  `src/domains/shared/useResource.ts` sets `loading` inside an effect, so when a list query's
  *params* change React commits one frame that still holds the previous query's page with
  `loading === false` and **no in-flight marker of any kind** — measured `role="status"` count 0,
  `aria-busy` count 0, both loading strings absent (**I13**). (2) `LearningPanel.tsx:104` asks for
  `{ per_page: 0 }` before a program is selected, and `paginate`
  (`src/domains/shared/demoCollection.ts:23`, `Math.max(1, …)`) turns that into **one** row — the
  globally-first level, `lv_violin_1` (**I14**). Together they produce a frame in which the heading
  reads «سطوح «ویولن کلاسیک» — ۱ سطح» over a single row while the store holds fifteen. Measured with
  a 1 ms sampler and a MutationObserver against the real component, from probes in `/tmp` that
  modified nothing in the repository: `rowsOnScreen=1 storeForThatProgram=15
  oldHarnessSaysSettled=true`, in every case of every run, lasting 63–388 ms idle and 138–999 ms
  under contention. `waitForPanel()` waited only for the two loading strings to be absent — which
  they were — so `before = levelItems().length` read **1**, and `1 + 1` is the `2` in
  `expected 16 to be 2`.
- **Fixed at the boundary that owned it, test code only.** `waitForPanel()` now settles on the data:
  it asserts against the repository that the rows on screen are the rows belonging to the program the
  heading names — same count, same order, same titles — and returns that settled state, so no case
  reads `levelItems()` before it. The two marker checks remain as necessary-but-not-sufficient
  conditions. No sleep, no retry budget, **no timeout increased** (the default `waitFor` timeout is
  untouched; the condition changed), no assertion weakened, skipped or deleted. One case added:
  *"never shows one program's levels under another program's heading"* walks every seeded program and
  refuses to treat a switch as complete until that program's own rows are on screen — the assertion
  that catches «سطوح «پیانو کلاسیک» — ۱۵ سطح». Three existing cases were also strengthened rather
  than left as they were: the default selection is now asserted to be the repository's first program,
  the reorder case states that a second level must exist before indexing it (it used to fail as a
  `TypeError` on `items[1]`), and the delete-refusal case asserts which program it switched to.
  9 tests, all green. **Only repeated runs are reported here, per this file's own rule:** 6
  consecutive full `npm test` runs (97 files / 1370 passed / 0 failed / 0 skipped each, the count
  §10.1 requires of a file that has ever flaked) and 4 samples run as **two concurrent full suites**
  — the exact condition that reproduced the failure at 1 in 4 — all green, with the file taking
  3288–3792 ms under that contention against 2498 ms idle.
- **Mutation-checked.** A read-only probe evaluated both conditions at 1 ms and on every DOM
  mutation: it recorded instants where the **old** condition holds (both markers absent, so the old
  wait would resolve) while the **new** condition is violated (`rowsOnScreen=1` against
  `storeForThatProgram=15`, titles not matching), three runs out of three. That is the evidence the
  strengthened assertion detects the state the old one passed vacuously.
- **Two honest limits of the harness fix, recorded so nobody over-reads it.** (1) Rows expose a
  level's order and name but not its id, and two seeded programs (voice and drums — 8 levels each,
  both naming them «سطح N») are indistinguishable on screen, so a stale frame *between those two*
  cannot be detected from the DOM at all; only I13 removes it. (2) The cross-program frame with
  differing depths was observed once during triage («سطوح «پیانو کلاسیک» — ۱۵ سطح», piano's name over
  violin's fifteen rows) and **not again** on re-measurement: on a program switch the intermediate
  frame normally carries the levels loader, which even the old wait handled correctly. The
  reproducible window is the mount frame above. The new case is a pin against the cross-program shape
  returning, not a claim that it was reproduced on demand.
- **The general rule this establishes, corrected:** a helper that renders a view must wait for the
  data-derived state its callers assert on. A helper that waits for a title, a heading, or merely
  "something rendered" turns every assertion in the file into a coin toss under load — and makes
  absence assertions lie. **Waiting for an in-flight marker to disappear is not sufficient either
  when the query's params can change**, because the frame between a params change and the effect that
  re-sets `loading` carries no marker at all. The marker rule in
  [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) §10.2 is correct for a refetch of
  the *same* query and is now caveated there for this case.

### I12. Attendance's «ثبت نهایی» toast reports a local state change as a demo recording (raised during M2, deferred to M5 by decision)
- **What:** `submit()` in `src/views/Attendance.tsx` marks the roster `recorded` in React state,
  attributes it to a hardcoded fixture teacher («آرمان احمدی»), and reports «حضور و غیاب در دمو ثبت
  شد». Its tone is `info` and it does say that permanent recording needs a server, which is why H2's
  verified "not fake" list blesses it — but two claims in it are still not true: nothing is recorded
  anywhere, and in an EMPTY environment the word «دمو» mislabels the customer's own session exactly
  as H3 describes.
- **Decision (2026-09-12, owner):** explicitly **not** changed in M2. It sits on H2's do-not-fix
  list, M2's scope was fixed before this reading of it was raised, and changing a blessed site
  mid-milestone would make the reviewed diff and the approved scope disagree. It belongs with the
  attendance wiring, where a real call replaces the local mutation and the wording stops being a
  question at all.
- **Done when:** M5 wires the view to `src/domains/attendance` and this toast becomes the result of
  an awaited `record`/`bulkRecord` with an honest failure path — at which point `recordedBy` must
  come from the authenticated user rather than a fixture name, and the demo wording must come from
  `useIsDemoEnvironment()` if any environment-dependent wording survives at all.

### I13. A list hook publishes the previous query's rows, with no loading marker, when its params change (found 2026-09-12 while triaging I11)
- **Status (2026-09-13): IN PROGRESS — Checkpoints 1 (A′), 2 and 3A implemented and validated; the
  rest of Checkpoint 3 (four hand-rolled readers) not authorized and not started; I14 untouched and
  explicitly deferred. The item is NOT closed and must not be reported as fixed — not all of its
  readers are fixed.** **M3 has since landed (`e5b0a57d8f33dc04838670a2cd4158a88dd34022`) as Checkpoint 2's first real caller, and it
  did not weaken the caveat — it pinned it:** the assignment surface takes its level from a rendered
  row and its `AttachContentIntent.programId` from the programs query, and
  `src/domains/learning/__tests__/contentAssignmentFlow.test.tsx` reproduces the crossed frame in
  which those two disagree, asserts the repository was handed the independent program and refused the
  write, and goes red when the wiring is mutated to `contentLevel.programId`. **The hazard this item
  describes is unchanged and still open**: M3's surface reads `useLearningContent`, whose rows come
  from `useResourceList`, so the stale-row window still exists — it is now caught downstream instead
  of silently written, and only for this one caller. `LearningPanel`'s «حذف» and move buttons still
  take their target from a stale-capable list and pass a single id, which no repository guard can
  check. **M3 added one more write of that shape, and it is recorded here rather than hidden:** the
  assignment surface's «جدا کردن» calls `detachContent(levelId, contentId)` with both ids read off
  the rows on screen, so nothing downstream can detect a crossed context — an operator who opens the
  surface from a stale level row inside that frame, and detaches, would remove a link belonging to
  the program they navigated *away* from. The attach half is guarded and pinned (**D10**); the detach
  half is not. Closing it needs either an intent parameter on `detachContent` — a learning-domain
  change, which M3's own prohibition forbids — or the hook fix this item exists to track. **Not
  fixed, not authorized, not started.** The owner authorized **Checkpoint 1 only**: the shared hook
  plus the six dynamic-params consumers that ignored `loading`. It landed as
  `289e080b56520d097d05554f2010f1723bca294f`, whose parent is I11's
  `2972a99c447de17af6d3c72d58facb62400bd707` — I11's fix untouched, nothing amended or rebased —
  and `git ls-remote` returned the same SHA as local `HEAD` after the push.
  **Measured validation, all on that tree:** 6 consecutive full `npm test` runs — 100 files /
  1384 passed / 0 failed / 0 skipped each, with `dist/` built so the CSP gates ran instead of
  skipping — plus 4 samples run as two concurrent full suites, the contention condition that
  historically amplified this area, all green: `LearningPanel.test.tsx` measured 2758–2824 ms under
  contention against 1885–2080 ms idle, so the contention was real and still did not break it. Build
  3.29 s, `tsc --noEmit` clean, documentation gates 68 green, `git diff --check` clean. Both halves
  were **reversion-checked** so that neither test is vacuous: reverting the hook to its pre-fix
  version fails the new hook suite (2 cases), and reverting the `GalleryPanel` gate alone — with the
  hook fix in place — fails the gallery gate on a false empty state. Repeated runs are evidence, not
  a proof of determinism. **Checkpoint 2 followed on the same day**, authorized separately and
  recorded as *in progress* in `be75ac6` before any of its code was written: `attachContent` is now
  handed the caller's intent and refuses a level that does not belong to it. It landed as
  `bcea26c38b011907b89ebd4343dbbd862a545282` and its measured validation is recorded under "Done
  when — Checkpoint 2" below. **Checkpoint 3A followed**: `useDerived`, the boundary behind
  `useStudentPlacement` and `useEligibleContent`, was investigated, the exposure was **reproduced
  deterministically before being fixed**, and it landed as
  `57c1dfb8967a60990021ac9fe59c6ab80045fca3` — see "Done when — Checkpoint 3A" below.
  **This item is nevertheless still open.** The **rest of Checkpoint 3** (four
  hand-rolled readers) is **not authorized and not started**; the two further exposures below
  (`useLibraryFile`, `useMediaObjectUrl`) are **not fixed**; and **I14 is not implemented** and
  remains a separate item, **explicitly deferred** rather than closed. What Checkpoints 1, 2 and 3A
  together removed is the read-side window in every `useResourceList` list, the write-side
  consequence for the learning ladder, and the read-side window in the one hand-rolled reader that
  has a real consumer — not the whole finding.
- **What (as it was, before Checkpoint 1):** `useResourceList`
  (`src/domains/shared/useResource.ts`) kept its page in state and set `loading` **inside an
  effect**. When the params changed — a new `programId`, a different page, a changed filter — the
  render that followed carried the *previous* query's page with `loading === false`, and the effect
  that re-set `loading` ran only after that commit. So there was a committed frame in which the
  component showed rows that did not belong to the params it was called with, and reported that
  nothing was in flight. The line numbers the triage quoted pointed into the pre-fix file and are no
  longer meaningful; the fixed hook derives what it exposes at render (see "Implemented as").
- **Why it matters beyond tests:** in that frame there is **no in-flight marker of any kind** —
  measured on the real component: `role="status"` count 0, `aria-busy` count 0, no loading string.
  Two consequences. (1) It falsifies the assumption written into
  [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) §10.2 and
  [PROJECT_STATE.md](PROJECT_STATE.md) §4, that "no marker in the DOM" is equivalent to "the loaded
  records are on screen" — true for a refetch of the same query, false when the params changed. (2)
  The rows are rendered with their normal controls. In
  `src/domains/learning/LearningPanel.tsx` a program switch was observed with piano's heading over
  fifteen rows belonging to violin (piano has twelve), whose «حذف» and move buttons are enabled by
  the panel's own logic; in `src/domains/learning/StudentLearningPanel.tsx:144` the same window
  rendered «سطح نامشخص از ۱ سطح این دوره» for a student the store had placed on «سطح 1» of twelve,
  with «انتقال به این سطح» enabled on the stale row.
- **Why it is not (yet) a data-integrity incident:** `assignPlacement`
  (`src/domains/learning/demoRepository.ts`) refuses a level that belongs to another program
  (`PLACEMENT_INVALID`, «سطح انتخاب‌شده به این برنامه تعلق ندارد.»), so a click in that window is
  honestly rejected. **`attachContent` has no such guard** — it takes `(levelId, contentId)`, checks
  only that both exist, and has no `programId` to check against. Any surface that attaches content to
  a level rendered from this hook inherits the window with nothing downstream to catch it, which is
  why this is recorded **before M3** rather than after it. *(Kept as written because it is the record
  of why Checkpoint 2 was authorized; the bold claim is **superseded** — `attachContent` now requires
  an `AttachContentIntent` and refuses a mismatch with `LINK_INVALID`, and M3's surface is its first
  caller. The window itself is not closed by that guard: it stops a wrong write, it does not stop a
  stale row being offered.)*
- **Blast radius:** every list in the product — 12 domain hook modules call `useResourceList`
  (attendance, chat, classes, enrollments, gallery, instruments, learning, library, progress, rooms,
  scheduling, teachers), and `paginate` has 13 callers. Of the 18 `useResourceList` call sites, 10
  take params that change at runtime, and **6 of those 10 read only `items` and ignored `loading`** —
  for those the window was not one frame but the whole refetch. `paginate` still has **no direct
  suite**; `useResource.ts` had none either, which is how this survived, and now has
  `src/domains/shared/__tests__/useResource.test.tsx`.
- **Demonstrated destructively during the read-only triage (2026-09-12):** `GalleryPanel` rendered
  the previous album's thumbnails under a newly selected album, each «حذف» closing over its own
  `image`; a probe clicked one and captured `removeImage` being called with an image of the album the
  user had navigated *away* from, while `aria-current` already marked the new one. Measured window
  41 ms uncontended. The write was intercepted, not performed. `LearningPanel`'s «حذف» and move
  buttons take their target from the same stale-capable list, and pass a *single* id —
  `deleteLevel(level.id)` — so no repository guard can detect the mismatch; only not presenting the
  row can.
- **Implemented as (Checkpoint 1):** the state now carries the key it answers
  (`{ key, page, loading, error }`) and what the hook exposes is **derived at render** from
  `state.key === key`, rather than set in an effect. This is stronger than the render-phase
  `setState` the triage proposed: it also removes the second exposure the triage found — a frame with
  `loading === true` that still held the previous query's rows, which defeats any consumer that
  renders rows without gating. A **same-key refetch keeps its rows**, which is the boundary that
  stops every list in the product flickering empty on each global data-version bump.
- **Smallest owning boundary (what the triage proposed, now superseded by the implementation):**
  `useResourceList` itself — clear the page and set `loading` during the render in which the
  serialized params change (React's documented "adjust state when a prop changes" pattern) instead of
  only in the effect. Then "no marker ⇒ the rows on screen are the rows for these params" becomes
  true app-wide and §10.2's rule holds as written. **What shipped is strictly stronger** — see
  "Implemented as": deriving the exposed values removes the second exposure too, and keeps rows on a
  same-key refetch, which the proposed `setState` alone would have emptied.
- **Not done in the I11 pass, deliberately (historical):** that pass was authorized for the test
  harness only, in one file. This changes a hook every list depends on and needed its own
  authorization, its own suite, and the six-run evidence rule in §10.1 — which is what Checkpoint 1
  then did.
- **Not done in Checkpoint 1, deliberately — Checkpoint 2 has since landed as its own pass, the rest
  is still open:**
  - **Checkpoint 2: `attachContent` carried no caller intent — DONE, `bcea26c` (kept here for
    continuity; it is no longer an open sub-item).**
    It took `(levelId, contentId)`, so there was nothing for it to compare a level against;
    `assignPlacement` can refuse a cross-program level only because it is handed a `programId` as
    well. It was not implemented inside Checkpoint 1 because M3's own prohibition ("no edit to the
    learning domain") means it has to be a separate authorized change. **The authorized shape is the
    `assignPlacement` pattern and nothing larger:** a required `AttachContentIntent { programId }`
    third argument, resolved *independently* of the level being written to (never read back from that
    level, which would make the comparison a tautology), compared against `level.programId` and
    refused with a validation error when they disagree. No schema change, no `programId` on
    `LearningContent`, no redesign of the learning domain, and every existing behaviour — including
    `CONTENT_ALREADY_LINKED` and one content item serving several levels — preserved. **That is what
    shipped**, as a required third argument (`AttachContentIntent`), so omission is a compile error
    rather than a runtime default: an optional parameter would have left the hole open for every
    caller written before the guard and the first one M3 writes in a hurry. The mismatch is checked
    *before* the duplicate check, so a write the caller did not mean is refused (`LINK_INVALID`)
    rather than excused as already-done, and an intent naming a program that does not exist answers
    `PROGRAM_NOT_FOUND` instead of being flattened into a mismatch. **One limitation is recorded
    rather than hidden:** the repository cannot detect a caller that reads `level.programId` back off
    the target and passes it as its own "intent" — that comparison is a tautology and proves nothing.
    No signature can prevent it; `attachContentIntent.test.ts` pins it as a named failure mode so
    that review has something to point at.
  - **Checkpoint 3: five hand-rolled readers with the same shape — ONE (`useDerived`) is now fixed as
    Checkpoint 3A, the other four are not authorized and not started.** The five were
    `useStudentList` (`src/domains/students/useStudents.ts:25`), `useDerived`
    (`src/domains/learning/useLearning.ts`, which backs placement and eligible content, both
    student-scoped), `useStudentProgress` (`src/domains/progress/useProgress.ts:62`), `useDerivedRead`
    (`src/domains/scheduling/useScheduling.ts:66`), `useSessionAttendance`
    (`src/domains/attendance/useAttendance.ts:69`). Three carry doc comments claiming a guarantee
    they do not deliver — "cannot paint the previous session's register", "cannot paint the previous
    student's data": the ticket guard they cite discards a late *response*, it cannot retract an
    already-committed *state*. **`useDerived` was the one with a real consumer**, and it is fixed —
    see "Done when — Checkpoint 3A" below. **An honest reachability correction, found while
    investigating it:** the stale frame was *not* observable through the app's own navigation today,
    because `src/App.tsx` keys the view subtree on `detailId`
    (`key={\`${view}-${filter ?? ""}-${detailId ?? ""}\`}`), so switching students remounts
    `StudentLearningPanel` and discards the hook's state. That is an accident of an ancestor's React
    key, not a property of the hook: any consumer that switched students *in place* — a dialog with a
    student picker, a "next student" control, or M3's assignment surface reading a student-scoped
    derived read — would have inherited the exposure immediately, and a hook's correctness should not
    depend on a wrapper key three levels up. The defect was reproduced deterministically at the
    boundary rather than claimed from the shipped path. Reachability of the remaining four:
    `useSessionAttendance`, `useSessionRoster` and
    `useStudentProgress` have **no view consumers** (tests only), so they are not reachable in
    shipped UI and become reachable at M6/M7; every `useStudentList` call site passes constant
    params, so it is structurally defective but unreachable. **None of the four was modified.**
  - **`useDomainSearch` was touched**, and only because CommandPalette is one of the authorized six:
    its gate is meaningless while the hook starts `loading: false` and keeps the previous query's
    results across a keystroke. It now carries the same key identity. No other hand-rolled reader was
    modified.
  - **Two further exposures, neither a `useResourceList` consumer, neither in the authorized six,
    neither fixed:** `useLibraryFile` (`src/domains/library/useLibrary.ts:77`) does not reset
    `asset`/`blob` when `mediaId` changes to another non-empty id, so the drawer can offer the
    *previous* item's bytes under the new item's title; `useMediaObjectUrl`
    (`src/domains/media/useMedia.ts:24`) exposes the previous object URL for one frame. The library
    one is the more serious and should be scoped in its own right.
- **Done when — Checkpoint 1 (MET, and validated):** a params change cannot be observed
  with the previous page and `loading === false`, pinned by a **render-phase log of every committed
  frame** rather than by waiting on the flag under test
  (`src/domains/shared/__tests__/useResource.test.tsx`); a same-key refetch keeps its rows; a
  previous key's error is never exposed as this key's; the six consumers show an explicit in-flight
  state and never a false empty (`src/domains/shared/__tests__/staleQueryGates.test.tsx`); an album
  switch arms no delete against the previous album
  (`src/domains/gallery/__tests__/GalleryAlbumSwitch.test.tsx`); and the §10.2 / §4 wording is
  re-checked against the new behaviour. All six are met, and the evidence rule is satisfied: 6
  consecutive full-suite runs plus 4 contention samples, all green (see the status bullet).
  One **honest limitation** is recorded rather than glossed: `GalleryAlbumSwitch.test.tsx` cannot pin
  the offending frame under `act()`, because a `fireEvent` flushes effects before sampling can start;
  it asserts the reachable invariant (no delete is ever armed against a non-selected album, and the
  armed delete targets the selected album's image) and the frame itself is pinned by the hook suite's
  render-phase log. **Still outstanding at that point:** Checkpoint 2 — since landed, see below — and
  Checkpoint 3 above.
- **Done when — Checkpoint 2 (MET, and validated):** `attachContent` cannot be called without the
  caller's program intent, and a level that does not belong to that intent is refused with nothing
  written. All of it is pinned in
  `src/domains/learning/__tests__/attachContentIntent.test.ts` (15 tests): a matching intent links
  exactly as before, including appending `sortOrder` and never copying the content row; a mismatched
  intent is refused with `LINK_INVALID` (validation, Persian message, `fields.levelId`) **and writes
  no link**; the refusal leaves every placed student's derived `eligibleContent` byte-identical, which
  is the harm that made this more than a stray row; the exact I13 window is refused — a level row from
  the program the user navigated away from, against the program they navigated to; the mismatch
  outranks the duplicate, so a stale row that happens to be linked already still tells the caller it
  was pointing at the wrong program; `LEVEL_NOT_FOUND`, `CONTENT_NOT_FOUND` and
  `CONTENT_ALREADY_LINKED` are unchanged; an unknown intent program answers `PROGRAM_NOT_FOUND`; one
  content item still serves levels of two different programs when each call states its own intent, so
  the guard refuses a *wrong* intent without forbidding the model's many-to-many sharing; and the
  guard adds exactly one comparison, pinned by an inactive level still being attachable
  (`assignPlacement` refuses one, `attachContent` never did, and this pass was not authorized to
  change that). Omission is enforced by `tsc`, with a `@ts-expect-error` pin in that file which fails
  the build if a future signature change makes the two-argument call legal again.
  **Measured validation, all on `bcea26c`:** 6 consecutive full `npm test` runs — 101 files /
  1399 passed / 0 failed / **0 skipped** each, `dist/` built so the CSP gates ran instead of skipping
  — build 2.71 s, `tsc --noEmit` clean, `git diff --check` clean, and 306 tests green across the
  learning, progress, instruments, services and shared suites before the first full run.
  **Reversion-checked, so the suite is not vacuous:** with the guard reverted to its
  pre-Checkpoint-2 state, 7 of the 15 new tests fail — every adversarial case — and `tsc` reports 31
  errors including `TS2578 Unused '@ts-expect-error' directive` on the omission pin, i.e. the compile
  guard fails *closed*; the 8 that still pass are exactly the unchanged-behaviour assertions, which is
  what they are for. The 24 pre-existing `demoRepository.test.ts` tests pass unmodified in what they
  assert: only the now-required intent argument was added at their 11 call sites, each a literal
  naming the program that test had already resolved its level from, never `level.programId`. Repeated
  runs are evidence, not a proof of determinism.
- **Done when — Checkpoint 3A (MET, and validated):** `useDerived` — the single boundary behind both
  `useStudentPlacement` and `useEligibleContent` — exposes only the value belonging to the student it
  was asked about. **Reproduced before being fixed:** the dedicated suite
  (`src/domains/learning/__tests__/useDerived.test.tsx`, 8 tests) was written against the *unmodified*
  hook and failed 4 of 8 deterministically, with the frame that proves it — *"a frame asked for st_b
  exposed st_a's placement (loading=false)"* — plus the previous student's error exposed as the next
  one's, and the last student's placement still on screen when nobody was selected. The other 4 cases
  passed before the fix, which is the point: they pin the behaviour the fix had to *keep*. After the
  fix all 8 pass, and the suite asserts, per committed frame and never by waiting on `loading`:
  a student A → B switch pairs no frame with A's placement or A's eligible content; both reads of the
  shared boundary are covered on separate lines, so a fix reaching only one hook fails on its own;
  every frame that exposes nothing says it is in flight; a same-key refetch (a data-version bump) and
  `reload()` keep the value they already had; a late response from the previous student cannot land
  and its request was aborted; and a **superseded same-key** ask answering late with a visibly wrong
  value cannot land either. The mechanism is Checkpoint 1's, at this boundary: state carries the key
  it answers and what is exposed is derived at render, so the ticket guard keeps discarding late
  *responses* while the derived exposure prevents an already-committed *state* being read as the
  current student's. `SingleState`'s public shape is unchanged, so **no consumer moved** —
  `StudentLearningPanel` already gates on `placementLoading` and `contentLoading`, which is why this
  lands as an in-flight state rather than a new false empty.
  **Measured validation, all on `57c1dfb`:** 6 consecutive full `npm test` runs — 102 files /
  1407 passed / 0 failed / **0 skipped** each, `dist/` built so the CSP gates ran instead of skipping
  — plus 2 samples run as two concurrent full suites (LearningPanel 3246/3303 ms under contention
  against 2226–2669 ms idle), build 3.88 s, `tsc --noEmit` clean, `git diff --check` clean, and 252
  tests green across the learning, progress and shared suites — including Checkpoint 1's and
  Checkpoint 2's — before the first full run. **Reversion-checked:** restoring the pre-fix hook fails
  the same 4 cases and no others, so the suite is pinned to the fix rather than passing either way.
  No sleep, no retry, no timeout increase, no assertion weakened.

### I14. `paginate` clamps `per_page: 0` to one row, so "load nothing" silently loads something (found 2026-09-12 while triaging I11)
- **What:** `src/domains/shared/demoCollection.ts:23` computes
  `Math.max(1, Math.trunc(params.per_page ?? DEFAULT_PER_PAGE))`. A caller that passes `per_page: 0`
  to mean "there is nothing to fetch yet" gets **one row** back, and since such a call usually has no
  filter either, the row it gets is whatever sorts first across the whole collection.
- **Where it is relied on:** three call sites use `{ per_page: 0 }` as "load nothing" —
  `src/domains/learning/LearningPanel.tsx:105`, `src/domains/learning/StudentLearningPanel.tsx:37`
  and `src/domains/gallery/GalleryPanel.tsx:69` (line numbers re-verified against `e5b0a57`, which
  moved the first of them by adding an import). In `LearningPanel` this is what put a single
  unrelated level (`lv_violin_1`, «۱. سطح 1») on screen under a heading claiming «۱ سطح» for a
  fifteen-level program, and it is the direct cause of the I11 failure
  (`expected 16 to be 2`).
- **Why it survived:** the returned row is plausible. It has the right shape, the right kind of name,
  and a working set of controls; only a comparison against the repository shows it does not belong to
  the program being displayed.
- **Smallest owning boundary:** either honour `per_page: 0` as an empty page in `paginate`, or stop
  the three call sites from fetching at all when there is no parent to fetch for. The first is one
  line and changes `PageRequest` semantics for 13 callers; the second is three small edits and leaves
  the trap for the next caller. The choice is a contract decision, not a bug fix, which is why it is
  recorded rather than made here.
- **Still deferred after M3 (2026-09-13), and M3 changed nothing about it:** the assignment surface
  renders only once a level is selected, so it added **no fourth call site** and issues no
  `per_page: 0` read. Nothing in `paginate`, `demoCollection` or the three call sites was touched.
- **Done when:** `per_page: 0` has one documented meaning, a test in the owning module pins it, and
  the three call sites above agree with it.

---

## LOWER PRIORITY / HYGIENE

- **L1. Command-palette natural-language matching is substring-loose** (`q.includes(keyword)`),
  so it can return unrelated commands. Improve tokenisation/scoring; keep the palette's
  repository-backed result honesty (it already reports «چیزی پیدا نشد» rather than inventing rows).
- **L2. Dead code:** `TeacherNote` is declared at `src/data/records.ts:31` and never used
  anywhere. Delete it or land the feature that needs it.
- **L3. Domain README stubs contradict the code:** `src/domains/scheduling/README.md` and
  `src/domains/attendance/README.md` both still say "Planned domain — **not implemented in
  Phase A**" while the domains are implemented and protected by 290 tests.
- **L4. No browser QA has ever run** — see [PROJECT_STATE.md](PROJECT_STATE.md) §5 for the exact
  manual checklist. This is a permanent gap until a human or a browser-capable environment
  performs it.
- **L5. Unpushed commits are not durable in this environment (observed 2026-09-08).** Between two
  turns the sandbox workspace was **re-cloned**: the local branch pointer reverted to the shallow
  graft `292b8b8`, the reflog collapsed to `clone` + `checkout`, and a local-only documentation
  commit stopped existing as a Git object (`fatal: bad object`) — so the authorized push of that
  exact SHA became impossible. Nothing was lost: the previous checkpoint was already on GitHub and
  all 94 changed/untracked files survived on disk, proved by hashing them before and after a
  non-destructive `git reset --mixed <checkpoint>` (identical aggregate content digest
  `9fb10076…` — a hash of file contents, **not** a commit SHA and not resolvable by Git — zero
  content differences against the pushed checkpoint). The recovered commit
  necessarily carries a **different SHA** with identical content, because a SHA depends on the
  author/committer timestamps of a commit that no longer exists. **Rule for every session:** push
  approved checkpoints promptly and verify any recorded SHA with `git cat-file -e <sha>^{commit}`
  before trusting it — see `docs/engineering/PROJECT_STATE.md` §2 and its recovery contract.
  **Done when:** the platform preserves the local object store across turns, or the workflow no
  longer depends on an unpushed commit.

## DOCUMENTATION DRIFT (authoritative docs that contradict the code)

Recorded, **not** fixed — Phase 2 was explicitly scoped to lifecycle documentation only.

| Document | Stale claim |
|---|---|
| `docs/gap-matrix.md` | A "Phase 0 audit" that lists teachers, classes, enrollments, scheduling, attendance, finance, messaging, library, notifications and reports as **NOT IMPLEMENTED**, and uses a different phase numbering from this ledger |
| `docs/architecture/data-layer.md` | "Scheduling itself is **not** implemented here"; "Attendance, Finance, Messages, Library and Reports remain … fixture renderers with no domain layer yet"; migration table says Library is PARTIAL with "no seeded audio" (Phase 1 shipped real library media) |
| `docs/production-handoff.md` | "Verified in this build … `npm test` — 38 files / 340 tests" (the suite has grown far past that; the live figure lives in [PROJECT_STATE.md](PROJECT_STATE.md) §4, deliberately not duplicated here) |
| `docs/architecture/auth.md` | "Known limitations" section predates the Phase 2 lifecycle model (the bootstrap-account section added in Phase 2 is current) |
| `docs/architecture/environments.md` | Lines 56–63 ("Demo-only material must not leak") claim `isDemoMode()` gates every demo affordance and that "the login screen renders no demo panel, passphrase or «بدون امنیت واقعی» banner", citing `src/views/__tests__/loginDemoIsolation.test.tsx`. Both claims hold only in **api** mode — which is exactly the mode that test runs — and both contradict the "Two independent axes" section of the same file (lines 42–52). In code the login panel is gated on the data-source axis and **does** render in EMPTY; its *wording* now comes from `useIsDemoEnvironment()` (see H3). Recorded, not rewritten |

**Done when:** each document is either corrected or explicitly marked as a historical snapshot
with its date, so no future session mistakes it for the current truth.

## BACKEND (all of it — nothing here is optional)

There is no backend in this repository. `api` mode is a seam pointing at a server that does not
exist. The authoritative blocker list, per-domain schemas and the "must be enforced server-side"
rules live in `docs/production-handoff.md` and `docs/security.md` §8 — do not duplicate them
here. Headline items: real sessions and password hashing, server-side authorization and tenant
isolation, database and API, capacity and scheduling conflict enforcement in transactions,
append-only attendance/progress grants, money precision and idempotency, media storage, audit
log, rate limiting, MFA, and a penetration test.

---

## Rules for this file

1. New findings go in with evidence (`file:line`, test or doc path) and the date they were found.
2. An item is removed only when it lands (record the SHA in [PHASES.md](PHASES.md)) or when the
   owner explicitly drops it (record the decision in [DECISIONS.md](DECISIONS.md)).
3. Never re-categorise an item downward to make a phase look finished.
4. `src/__tests__/projectState.test.ts` fails the suite if the CRITICAL/HIGH and IMPORTANT
   headings disappear from this file, so the backlog cannot be emptied by accident.
