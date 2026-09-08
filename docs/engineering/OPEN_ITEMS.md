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

### H3. Real writes are labelled "demo data" in domain views (found while writing these docs, 2026-09-08)
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
  pinned by `src/views/__tests__/loginDemoIsolation.test.tsx`. The five toast labels above remain
  **open**.
- **Done when:** the copy is derived from `isDemoEnvironment()` via
  `src/domains/demo/useDataLifecycle.ts` (no direct store imports in views — the boundary test
  enforces that), and `src/views/__tests__/emptyEnvironment.test.tsx` asserts the word «دمو»
  cannot appear after a real write in EMPTY.

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

### H5. No in-product recovery from an unusable environment — `clear()` is a one-way door
- **What:** `clear()` empties every collection including `users`, so no account remains and sign-in
  becomes impossible. The lifecycle marker survives, so
  `src/components/lifecycle/DataLifecycleGate.tsx` stays transparent and parks the visitor on a
  login screen that cannot succeed. Settings — and therefore "restore a backup" — sits *behind*
  that login, so it is unreachable too. `uninitializeEnvironment()` exists
  (`src/domains/demo/lifecycle.ts`) and is exposed as `demoDataManager.uninitialize()`
  (`src/domains/demo/demoDataManager.ts`), but **no component calls it**: `src/domains/demo/useDemoData.ts`
  wires only `reset | clear | import-seed | restore-backup`.
- **Priority: CRITICAL.** One confirmed click can render a customer's environment unrecoverable from
  inside the product. [PROJECT_STATE.md](PROJECT_STATE.md) §7 used to claim a recovery path existed;
  that claim has been corrected, and I10 now records the invariant any fix must respect.
- **Deliberately not implemented** in the documentation pass — a recovery affordance is product work.
- **Done when:** either `clear()` warns with the real consequence and offers an escape, or an
  explicit "start over / choose the environment again" affordance exists **outside** the signed-in
  shell (on the login screen or in the gate itself) and calls `uninitialize` — with tests covering
  both the lockout and the way back out. Record the chosen shape as a decision in
  [DECISIONS.md](DECISIONS.md) §8 and §18 first.

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
— see **H5** for the full account, including the fact that there is **no in-product recovery**. An
earlier revision of this entry offered `uninitialize` or a backup restore as recovery paths; that
was wrong, because neither is reachable from inside a locked-out product. Pre-existing behaviour.
`src/domains/demo/__tests__/seed.test.ts` pins that an empty dataset keeps every collection at zero
— correctly, since a dataset that quietly contains an account is not empty. That is why the
bootstrap administrator lives at the lifecycle layer (`createEmptyEnvironment()`,
`src/domains/demo/lifecycle.ts`) and why `clear()` cannot simply re-add one. **Done when:** the H5
fix lands without weakening that invariant, or a recorded decision in [DECISIONS.md](DECISIONS.md)
§8 changes the invariant first.

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
