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
- **What:** `useEntityForm` seeds its draft with `useState(initial)`
  (`src/domains/shared/useEntityForm.ts`) and nothing ever re-syncs it. The dialogs stay mounted
  while closed — `if (!open) return null` runs *after* the hooks — no parent keys them by record,
  and none of them calls the `reset()` the hook already exposes. So when a view sets `editing` and
  opens the dialog, the operator is shown the empty create-draft defaults instead of the record.
- **Evidence (reproduced in DEMO, 2026-09-12):** editing `st1` («سارا محمدی») shows an empty name,
  national ID and teacher; editing `t5` («بهرام نیک‌نژاد») shows an empty name, title and phone;
  editing `cl5` («آواز · تکنیک صدا») shows an empty title, teacher and room. Mount points:
  `src/views/Students.tsx` (two), `src/views/Teachers.tsx`, `src/views/Classes.tsx`; dialogs
  `src/domains/students/StudentFormDialog.tsx`, `src/domains/teachers/TeacherFormDialog.tsx`,
  `src/domains/classes/ClassFormDialog.tsx`.
- **Why HIGH and not cosmetic:** `editing` is still true, so submitting calls
  `repository.update(id, …)` with whatever was retyped. Saving after a partial retyping silently
  overwrites the stored record with blanks — data loss reached through a form rather than a toast,
  and invisible to the operator, who believes they were editing.
- **Why no test caught it:** the CRUD suites mount each dialog with its record already present
  (`src/views/__tests__/DomainCrud.test.tsx`, `src/views/__tests__/StudentCrud.test.tsx`), which is
  the one path that works. `src/views/__tests__/honestWriteCopy.test.tsx` documents the workaround
  it had to use — fill every field — rather than depending on the bug's presence or absence, so it
  stays valid after the fix.
- **Fix direction (one boundary, not four):** re-sync the draft when the record or the open
  transition changes, inside `useEntityForm` or at each dialog's own mount, so no view has to key its
  dialog and no new form can inherit the defect. **Not attempted in M2:** M2 is copy and control
  flow, and this changes form state.

### H7. Three Settings panels still call a real write "demo data" (found 2026-09-12, after H3 landed)
- **What:** the identical H3 defect in the panels that live inside Settings rather than on a route of
  their own. `src/domains/instruments/InstrumentsPanel.tsx`,
  `src/domains/progress/RepertoirePanel.tsx` and `src/domains/rooms/RoomsPanel.tsx` each confirm an
  awaited repository write with a hardcoded «تغییرات در دادهٔ دمو ذخیره شد.», so in a customer's
  EMPTY environment their own instrument, piece and room are announced as demo data.
- **Why it was missed:** H3's audit enumerated the domain *views* plus branding. These three are
  domain components rendered by `src/views/Settings.tsx`, outside the audited set, and each has a
  real `catch` → `tone: "danger"` path beside the mislabel, so it reads as honest at a glance.
- **Status: OPEN — deliberately not fixed in M2.** M2's approved scope was the seven H2 sites and
  the five H3 sites; widening it mid-milestone is how a reviewed diff becomes an unreviewed one. The
  fix is the same one-line seam (`useIsDemoEnvironment()`) in each file, and the shape is proven by
  `src/domains/branding/BrandingPanel.tsx`.
- **Ratcheted so it can only shrink:** `src/__tests__/writeFeedbackHonesty.test.ts` asserts that the
  set of files carrying a hardcoded demo label is *exactly* these three. Fixing one fails that test
  until its entry is removed here, and a fourth offender fails it immediately.

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

### I11. Test-harness races — one retired at its boundary, one observed and not investigated
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
- **Still open — observed once, deliberately not investigated:** under that same artificial double
  contention the other suite failed one unrelated test,
  `src/domains/learning/__tests__/LearningPanel.test.tsx` → *"reorders levels and keeps the ordering
  contiguous"*. It has not appeared in any single-suite run and was outside this pass's scope.
  **Done when:** it is either reproduced and fixed at its owning boundary (same rule — wait for the
  real state, never sleep or retry) or shown to be an artefact of running two suites on one machine,
  with that conclusion written down here.
- **The general rule this establishes:** a helper that renders a view must wait for the data-derived
  state its callers assert on. A helper that waits for a title, a heading, or merely "something
  rendered" turns every assertion in the file into a coin toss under load — and makes absence
  assertions lie.

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
