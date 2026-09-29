# OPEN ITEMS — categorised backlog of unresolved work

> **✅ POST-CONSOLIDATION — 2026-09-21 — canonical branch `main`** (consolidation base `f63ebaab37096fcb25063aca51c713e26d3b3da7`; **D1 documentation checkpoint `6ca25be654b56579054c88cd498a42f57ea63582` on top of it, committed locally — push pending**).
> This backlog rides the canonical tip since PR #5 merged the frontend F0–F10 completion, the Arena
> Frontend Freeze line (M-1..M-6, D7, D9) and the governance checkpoint into `main`. **PR #4 is
> CLOSED and was never merged.**
>
> **Recovery quartet and live sources of truth — read in this order for a fresh session:**
> [PROJECT_STATE.md](PROJECT_STATE.md) (current state) · [PHASES.md](PHASES.md) (ledger, including
> "Consolidation — 2026-09-20") · [DECISIONS.md](DECISIONS.md) **§20** (pointer to the governance
> register) · [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) (**live law** for `T-02` /
> `O-*` / `PERF` / `HELP`) · this file.
>
> **⚠️ `T-02` is NOT unresolved.** Its live status is **ACCEPTED / ASSIGNED-ONLY** (teacher
> student-read = active enrollment ∩ `class.teacherId`; fail-closed; do not revisit). Older text in
> this repository that presents `T-02` as *"OPEN — EVIDENCE CONFLICTING — do NOT change"* belongs to
> the superseded **historical F0 / 2026-09-19 snapshot** in
> `docs/frontend-completion/13-open-decisions.md`, which must not be treated as current law.
>
> **Laravel / backend remains ❌ NOT STARTED and NOT AUTHORIZED.** The Git-consolidation gate that
> preceded it is discharged, but backend work may begin only after the documentation gate (D1/D2)
> completes and the owner authorizes it explicitly. See [PRE_CLEANUP_HANDOFF.md](PRE_CLEANUP_HANDOFF.md).
>
> Historical freeze records and the pre-M1 handoff are preserved unedited — see
> [archive/SESSION_HANDOFF-2026-09-18-pre-M1.md](archive/SESSION_HANDOFF-2026-09-18-pre-M1.md) and
> [SESSION_HANDOFF.md](SESSION_HANDOFF.md) §5.

> **Arena Frontend Freeze — 2026-09-19 — frozen HEAD `a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb` on canonical `arena/01a0b6be-parsian-music-dashboard-opus` — documentation-only closure.** **M-1 Quick Actions CLOSED, D7 Accessibility CLOSED, M-2 Teacher Photo CLOSED, M-3 Student Photo CLOSED, M-4 I15 Failure Disclosure CLOSED, M-5 I16 Deep Links CLOSED, M-6 Settings Honesty CLOSED, D9 Performance CLOSED** at this checkpoint. **Known 10 `projectState.test.ts` SHA/branch failures preserved**, test not altered. **Browser QA NOT VERIFIED** as formal final-audit disposition — no claim of complete browser verification, no claim backend functionality already exists. **Deferred items below explicitly do NOT modify the frozen frontend** — frontend freeze precedes Laravel/backend implementation. **Backend boundary:** frontend freeze precedes Laravel/backend. **Canonical branch policy:** all future frontend fixes require explicit decision to reopen freeze. Historical checkpoints preserved: M11 chain `3ed0bfe→3eed4f1→24998d8→53794d5→f7eb867`, M10 `e7a64b7` on `98af31b`, working branch previously `arena/01a0aa83` at `d31cbe9`, other branches unchanged (main `a646975`, `arena/01a0b059` `251af96`, `handoff/...` `94d32de`). **No production code/tests changed in this freeze pass — docs only.** **HISTORICAL FREEZE PRESERVED — intentionally reopened below for FRONTEND PRODUCT COMPLETION.**

> **Frontend freeze INTENTIONALLY REOPENED — 2026-09-19 — FRONTEND PRODUCT COMPLETION — CORRECTED SHA SEMANTICS — F1-KICKOFF CORRECTION — branch `arena/frontend-completion-spec` — CURRENT_BRANCH: `arena/frontend-completion-spec` — CURRENT_HEAD: `a251e6942b2a645987286de6e822607554e84df9` = `a251e69` (actual Git HEAD before this F1-KICKOFF correction commit, frozen `a3867a6` descendant) — PLANNING_CHECKPOINT: `e57bf1922e4ca3b80796715028445cfe8a077c9c` = `e57bf19` (last completed planning checkpoint before documentation-only correction commits) — PREVIOUS_PLANNING_CHECKPOINT: `c244fec142fcc35faff8e8548c8ebbc05cb53bf5` = `c244fec` preserved as historical — PREVIOUS_CORRECTION_COMMITS: `969509783748b18b04eb17ca759127e420a3784c` = `9695097` docs-only stale SHA fix + `a251e6942b2a645987286de6e822607554e84df9` = `a251e69` is documentation-only correction, NOT planning milestone, do NOT treat as new planning milestone — PLANNING_CHECKPOINT = e57bf19 remains last completed planning checkpoint — CURRENT_HEAD = a251e69 is actual Git HEAD before this F1-KICKOFF correction — BEFORE = a251e69 (actual HEAD before this F1-KICKOFF correction) — AFTER = new correction commit (to be — this commit) — SHA semantics no longer ambiguous after this correction: BEFORE a251e69 AFTER new commit PLANNING e57bf19 PREVIOUS c244fec — SHA semantics no longer ambiguous: CURRENT_HEAD = actual Git HEAD, PLANNING_CHECKPOINT = last planning checkpoint, PREVIOUS_PLANNING_CHECKPOINT = historical, PREVIOUS_CORRECTION_COMMIT = documentation-only, NOT planning milestone — do NOT call e57bf19 the current Git HEAD — PR #4 https://github.com/vahidateur/parsian-music-dashboard-opus/pull/4 docs-only OPEN — spec `docs/frontend-completion/` v14 @ `e57bf19` planning checkpoint + corrections — F0 Documentation/state closure COMPLETE + REVIEW CORRECTIONS DONE + FINAL CHECKPOINT CORRECTION stale SHA fix DONE + F1-KICKOFF CORRECTION — F1 NEXT — exactly ONE NEXT ACTION F1.** Historical freeze `a3867a6` preserved not deleted. **CURRENT_BRANCH:** `arena/frontend-completion-spec`. **CURRENT_HEAD:** `a251e6942b2a645987286de6e822607554e84df9` (actual Git HEAD before this correction). **PLANNING_CHECKPOINT:** `e57bf1922e4ca3b80796715028445cfe8a077c9c` = `e57bf19` (last completed planning checkpoint). **PREVIOUS_PLANNING_CHECKPOINT:** `c244fec142fcc35faff8e8548c8ebbc05cb53bf5` preserved as historical. **PREVIOUS_CORRECTION_COMMIT:** `9695097` documentation-only, NOT planning milestone. **Spec path/version:** `docs/frontend-completion/` v14 @ `e57bf19` planning checkpoint + corrections — 01-audit-reconstruction, 02-capability-matrix, 03-domain-map, 04-learning-access-policy, 05-rbac-access-control, 06-library-gallery-spec, 07-settings-theme-architecture, 08-export-architecture, 09-dashboard-analytics, 10-integration-architecture, 11-roadmap, 12-decision-register, 13-open-decisions, 14-handoff-checkpoint + README — F0..F10 canonical sequence — PLANNING_CHECKPOINT = e57bf19 exactly, PREVIOUS = c244fec historical only. **PR #4:** docs-only. **Current phase:** FRONTEND_COMPLETION — F0 COMPLETE, next F1 Learning+Level Access+Library+Gallery — exactly ONE NEXT ACTION F1. **Completed planning checkpoint:** F0 docs/state closure DONE + REVIEW CORRECTIONS docs-only pass DONE — 14 docs + corrections — A/B/C classification, capability matrix, domain map, learning policy Level N=>1..N owner learning/eligibility.ts scope OPEN, RBAC testable contract 11 cases S-01..S-04 T-01..T-04 ST-01 M-01 A-01 + X-01..X-11 with T-02 explicitly OPEN CURRENT OBSERVED BEHAVIOR DENIED PRODUCT DECISION OPEN, library/gallery genuine vs shallow, settings/theme WordPress-customizer-like org vs device-local, export reusable, dashboard no fabricated Raw->Derivation->Insight->Visualization->Export, integration Core->Adapter->Telegram/Bale/Mobile + Media abstraction + Telegram backup REQUIRED PRODUCT CAPABILITY, roadmap F0..F10 canonical, decision register ACCEPTED/PROVISIONAL/OPEN/DEFERRED + 3 proposals, open register 20 O-01..O-20 high-cost 7. **Accepted decisions:** D1..D20, B1, NEW-LRN-01/LIB-01/GAL-01/SET-01/EXP-01/DASH-01/RBAC-01/PORTAL-01/CHAT-01/TG-01/BALE-01/MOB-01/CLASS-01 + 3 proposals. **Open decisions:** 20 O-01..O-20 — O-01 student level scope global vs per-program vs per-instrument OPEN, O-02 level/resource relation, O-03 visibility, O-04 theme persistence, O-05 export formats, O-06 permission analytical, O-07 ticket vs chat ownership scope, O-08 file ownership, O-09 Telegram backup semantics REQUIRED, O-10 identity linking, O-11 Bale linking REQUIRED, O-12 mobile auth REQUIRED, O-13 portal auth REQUIRED, O-14 org/user relation, O-15 API boundaries, O-16 media storage, O-17 notification REQUIRED, O-18 audit, O-19 retention, O-20 backup restore REQUIRED — high-cost 7 O-01,O-02,O-08,O-09,O-10,O-13,O-14 before Laravel schema/API — RBAC T-02 remains explicitly STATUS OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION Teacher→unassigned student DENIED + ALLOWED evidences preserved — empirical to F2 must be resolved before RBAC implementation reaches this scope — do NOT change product decisions. **Blockers:** high-cost opens before backend, Telegram/Bale/Backup/Mobile integration contracts B require backend/integration layer but are REQUIRED PRODUCT CAPABILITY not optional, Finance/Reports I2/D6 C deferred, per_page 200 I16 mitigation disclosure, I13 view-boundary not closure 3 readers, I15 error discarding 14 consumers, L4 browser QA NOT VERIFIED. **Exact next slice:** **F1 — Learning + Level Access + Library + Gallery** — exactly ONE NEXT ACTION — absorb minor hardening Classes deep-link get(id) authoritative, pagination per_page mitigation, media one-frame issue into F1/F2 rather than competing product phase. **Backend intentionally deferred:** Laravel/backend/migrations/controllers/routes/models, Finance/Reports domain money precision idempotency gateway, notification/localization/working-hours/session-rules server wiring, free-slot search, Telegram/Bale/Mobile integration IMPLEMENTATION deferred until backend/integration layer exists (but REQUIRED CAPABILITY), media S3/MinIO signed URLs scanning, export streaming, dashboard aggregation, RBAC backend enforcement org_id+permission+scope+per-object auth, student portal auth identity linking per-user cursor, backup encryption retention integrity restore. **Classification correction:** Telegram backup = REQUIRED PRODUCT CAPABILITY, Telegram student access = REQUIRED, Bale student access = REQUIRED, Mobile student client = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists, adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile, no business logic in bots. **Roadmap canonical F0..F10:** F0 Documentation/state closure COMPLETE, F1 Learning+Level Access+Library+Gallery NEXT, F2 RBAC+Ownership/Scope+Error Disclosure, F3 Settings+Theme Editor, F4 Export Engine, F5 Dashboard Analytics+Export, F6 Chat+Tickets+Files, F7 Student Portal, F8 Telegram+Bale+Backup integration contracts, F9 Mobile client contract, F10 Cross-surface QA+final frontend freeze. **Canonical engineering docs updated:** PROJECT_STATE.md, PHASES.md, OPEN_ITEMS.md, SESSION_HANDOFF.md point same active branch `arena/frontend-completion-spec` CURRENT_BRANCH arena/frontend-completion-spec CURRENT_HEAD a251e6942b2a645987286de6e822607554e84df9 PLANNING_CHECKPOINT e57bf1922e4ca3b80796715028445cfe8a077c9c PREVIOUS_PLANNING_CHECKPOINT c244fec142fcc35faff8e8548c8ebbc05cb53bf5 spec `docs/frontend-completion/` @ `e57bf19` planning checkpoint + corrections PR #4 F0 complete F1 next — SHA semantics no longer ambiguous — PLANNING_CHECKPOINT = e57bf19 exactly, PREVIOUS = c244fec historical only, CURRENT_HEAD = a251e69 actual Git HEAD before this F1-KICKOFF correction, PREVIOUS_CORRECTION_COMMIT = 9695097 documentation-only NOT planning milestone. **F1-KICKOFF CORRECTION — CURRENT_HEAD = a251e69 actual Git HEAD before F1-KICKOFF correction, PLANNING_CHECKPOINT = e57bf19 last planning checkpoint, PREVIOUS = c244fec historical only — RBAC T-02 STATUS OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION — DENIED + ALLOWED evidences preserved — empirical to F2 — NEXT ACTION exactly ONE F1.**

> **F1-KICKOFF CORRECTION — 2026-09-19 — CURRENT_BRANCH arena/frontend-completion-spec CURRENT_HEAD a251e6942b2a645987286de6e822607554e84df9 PLANNING_CHECKPOINT e57bf1922e4ca3b80796715028445cfe8a077c9c PREVIOUS_PLANNING_CHECKPOINT c244fec142fcc35faff8e8548c8ebbc05cb53bf5 PREVIOUS_CORRECTION_COMMITS 969509783748b18b04eb17ca759127e420a3784c + a251e6942b2a645987286de6e822607554e84df9 — previous correction commit 9695097 documentation-only NOT planning milestone — PLANNING_CHECKPOINT = e57bf19 remains last completed planning checkpoint — CURRENT_HEAD = a251e69 actual Git HEAD before this F1-KICKOFF correction — SHA semantics no longer ambiguous: CURRENT_HEAD = actual Git HEAD, PLANNING_CHECKPOINT = last planning checkpoint, PREVIOUS_PLANNING_CHECKPOINT = historical, PREVIOUS_CORRECTION_COMMIT = documentation-only NOT planning milestone — do NOT call e57bf19 the current Git HEAD — RBAC T-02 STATUS OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION — DENIED + ALLOWED evidences preserved — empirical to F2 — NEXT ACTION exactly ONE F1 — no src/tests/package/backend changes — no branch/history rewrite — push only arena/frontend-completion-spec — do NOT merge PR #4 — do NOT change product decisions/architecture/roadmap/F1 definition/RBAC T-02/accepted/open/historical.**

> **Deferred at freeze (explicit, do NOT modify frozen frontend — HISTORICAL, preserved):**
> - **Classes deep-link beyond capped list** — `src/views/Classes.tsx:678` capped `find` without `get(id)` authoritative fallback, deferred beyond M-5 — **now absorbed into F1/F2 as minor hardening, not competing phase** per roadmap reconciliation.
> - **Finance/Reports backend/domain implementation** — I2/D6 deferred, README-only, no repository, no fabricated revenue, visible deferral — remains C deferred.
> - **Notification server wiring** — Settings notification toggles disabled (7), honest deferral Surface, server wiring deferred — remains C deferred but REQUIRED? Actually notification via Telegram/Bale/SMS/email is REQUIRED PRODUCT CAPABILITY per correction, implementation deferred until backend/integration layer.
> - **Localization/settings server wiring** — 6 selects disabled, honest deferral — remains C deferred.
> - **Working-hours/session-rules server wiring** — 4 inputs + Friday toggle disabled "— غیرفعال", honest deferral — remains C deferred.
> - **Free-slot search** — `freeSlotsTuesday` removed, honest typed no-data, no backend search — remains C deferred.
> - **External browser QA** — NOT VERIFIED disposition, external QA required, no claim complete — remains for F10.

> **Frontend Product Completion — NEW DEFERRED/REQUIRED classification (2026-09-19 correction):**
> - **Telegram backup = REQUIRED PRODUCT CAPABILITY** — backup via Telegram Bot API sendDocument with encryption, retention, integrity, restore — IMPLEMENTATION deferred until backend/integration layer exists, adapter architecture Core domain/business logic → BackupAdapter → Telegram, no business logic in bot, backend-only credentials, PII encryption.
> - **Telegram student access = REQUIRED PRODUCT CAPABILITY** — student accesses schedule/level/resources/progress/attendance/tickets/messages/files via Telegram bot commands /schedule /level /resources /progress /attendance /tickets — IMPLEMENTATION deferred until backend/integration layer, adapter StudentTelegramAdapter → Telegram, calls domain services with self scope, no business logic in bot, identity linking table telegram_links.
> - **Bale student access = REQUIRED PRODUCT CAPABILITY** — same as Telegram but Bale API, common MessagingAdapter interface to avoid duplicate logic Core->Adapter->Telegram/Bale — IMPLEMENTATION deferred until backend/integration layer.
> - **Mobile student client = REQUIRED PRODUCT CAPABILITY** — mobile app client of same backend contracts same envelope Collection/Item PageMeta same domain repos same RBAC media/file abstraction -> storage provider bearer secure storage — IMPLEMENTATION deferred until backend/integration layer but contract now.
> - **Minor hardening absorbed:** Classes deep-link get(id) authoritative beyond 200 → F1, pagination per_page mitigation disclosure → F1/F2, media one-frame exposure useLibraryFile/useMediaObjectUrl → F1/F2 — not competing product phase.

Nothing in this file is complete. Items may only leave it by **landing** (with the commit SHA
recorded in [PHASES.md](PHASES.md)) or by an explicit, written decision to drop them.
**Deferred work must never be reported as finished work. Deferred at freeze explicitly do NOT modify frozen frontend.**

> **Start here:** read [PROJECT_STATE.md](PROJECT_STATE.md) first — it carries the current
> checkpoint, phase status, validation results and the DO-NOT list. This file is the backlog that
> document points at (§8), and its §9 says which item to begin with.

Every item carries evidence (`file:line` or a test/doc path) so the next session can verify it
instead of trusting this file. Line numbers were correct at `33b1031` (2026-09-08) and may
drift — re-grep before editing.

---

## CRITICAL / HIGH

### H1. Scheduling and Attendance views ignore their own real domains — ✅ CLOSED (2026-09-14: H1a by M4, H1b by M5)
- **What (as found):** Both domains are complete and heavily tested (Group A: 211 tests; Group D: 79
  tests) with `repository.ts` / `demoRepository.ts` / `apiRepository.ts` / hooks / registry
  wiring — yet `src/views/Scheduling.tsx` and `src/views/Attendance.tsx` read static fixtures from
  src/data/records.ts (the design-time fixture module, dissolved at M10) and src/data/academy.ts (the design-time fixture module, dissolved at M10). **All of that sentence is now history:** M4 wired
  the scheduling view to its own domain and **M5 wired the attendance view to its own**, so neither
  reads fixtures any more. The umbrella item is closed — see the Status bullet, which checks the
  original "Done when" clause by clause rather than restating it in easier terms.
- **Why it is critical:** the product looks finished where it is not, and the tested domain
  logic (conflict engine, materialized sessions, append-only corrections, derived rosters) is
  invisible to the user. *(Since M5 that is true of neither: scheduling's conflict engine,
  materialized sessions and generation are read and written by the shipped calendar, and attendance's
  append-only corrections and derived rosters are read and written by the shipped register.)*
- **Deferred because:** Phase 2 was scoped to the data lifecycle; re-wiring two views is a
  product-phase change with its own UX decisions.
- **Status (2026-09-14): ✅ CLOSED — H1a (scheduling) by M4, H1b (attendance) by M5 at
  `9505ade4011b37a34e3488fd51206512829205ec`.** Both views are wired, so this item's **own** "Done
  when" is satisfied; it is checked clause by clause at the bottom of this entry, and its definition
  was **not** rewritten to make closure easier. One distinction still matters, because two different
  defects are easy to conflate:
  - **The fake-success half of the scheduling view is already gone, and M2 removed it rather than
    wiring it.** `c42f274ac10d4087f9280e3bf7b47141d0672e32` deleted both «انتقال به اتاق ۴» controls
    and the local `resolved` flag whose only real effect was hiding the conflict warning, kept the
    evidence on screen, and left the one truthful action («مشاهده در تقویم»). **No scheduling write
    existed in any view then**, and nothing in `src/views/Scheduling.tsx` claimed one — so no document
    may describe this view as still "faking success". *(That sentence described M2's state and is no
    longer the whole truth: M4's CP2 added the first three real scheduling writes. What stands is the
    distinction this bullet exists to make — M2 removed a **claim** rather than adding a write, and M4
    added the write separately, awaited and refuseable.)* It is pinned by
    `src/views/__tests__/noSuccessWithoutWrite.test.tsx` and
    `src/__tests__/writeFeedbackHonesty.test.ts`.
  - **H1a is CLOSED (2026-09-14, by M4).** What this bullet used to record — `src/views/Scheduling.tsx`
    importing `TODAY_INDEX, WEEKDAYS, classById, rooms, teacherById, teachers, weekSessions,
    GridSession` from src/data/records.ts (the design-time fixture module, dissolved at M10), rendering a frozen weekday as "today" and carrying a
    fabricated room, occupancy and free-slot narrative (**H4**'s shape inside this view) — is gone.
    The fixture imports are out of the file, and every row is now a `Session` read through
    `useSessions` (`src/domains/scheduling/useScheduling.ts:49`) for a bounded `from`/`to` window
    (`src/views/Scheduling.tsx:311`), labelled from the classes, rooms and teachers domains and dated
    through `dateBridge`. The first three real scheduling operations exist, and each is awaited before
    anything is claimed: **reschedule** (`rescheduleSession` guarded by `checkConflicts`) and
    **cancel** (`cancelSession` with its required reason) in
    `src/views/scheduling/SessionWriteDialogs.tsx`, and **generation** in
    `src/views/scheduling/GenerateSessionsDialog.tsx`, which renders `useGenerationPreview`'s plan
    before `generateSessions` writes it. Checkpoints: CP0 `84fb7cb` (documents), CP1 `0f875a7` (reads),
    CP2 `f8c3472` (writes), CP3 `6f54caf` (generation), acceptance coverage `df70148` (test files
    only); measured evidence in [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M4 validation".
    **What closure does not mean, and must be carried into any report:** five repository verbs still
    have no shipped caller — `get`, `create`, `update`, `delete` and `sessionRoster`, each with its
    reason in `src/domains/scheduling/README.md` §3 — so there is no create, edit or delete surface and
    the roster a session really has is still not rendered; the fixture view's recurrence-scoped controls
    («فقط این جلسه» / «این و جلسات بعدی») were **not** reimplemented, because no domain contract exists
    for a recurrence write; **no mutation or reversion check was recorded for CP1–CP3**; and **browser
    QA is NOT VERIFIED**.
  - **H1b is CLOSED (2026-09-14, by M5).** What the bullet here used to record —
    `src/views/Attendance.tsx:31` keeping rosters in local React state (`useState(todayAttendance)`),
    with `setMark`, `markAllPresent` and `submit` down to line 58 writing only to that state, over a
    fixture keyed by legacy `g*` session ids — **is gone**. There is no `useState(todayAttendance)` and
    no `setMark`/`markAllPresent`/`submit` in the file; the selected session is **derived** from the
    window the view read (`src/views/Attendance.tsx:237`) rather than stored, and the three setters
    were replaced by three awaited repository calls: `record` (`:304`), `bulkRecord` (`:349`) and
    `correct` (`:390`), each with an honest failure path reporting `apiErrorFromThrown(cause).message`.
    The reads are `useSessions` (`:208`), `useSessionAttendance` (`:241`), two `useAttendanceRecords`
    queries the repository filters (`:215`, `:217`) and `useAttendanceCorrections` (`:219`).
    **I12** — the «ثبت نهایی» wording the owner deferred to this milestone — is closed with it,
    clause by clause, in its own entry below. Checkpoint: `9505ade4011b37a34e3488fd51206512829205ec`
    (one implementation checkpoint, built on M4's final reconciliation
    `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b`); measured evidence in
    [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M5 validation"; the milestone's own record in
    [PHASES.md](PHASES.md) → "Product phase — M5".
    **What closure does not mean, and must be carried into any report:** the academy-wide rate, trend
    and per-day chart the fixture view faked were **removed, not rebuilt** — no percentage, no
    sparkline, no per-instrument breakdown and no «آخرین حضور» projection, because the window this view
    reads cannot support them honestly (**H5**'s ceiling honoured by absence); **no notification of any
    kind is sent** to a teacher, a student or a guardian (**D1**, **I7**), and the UI says so out loud;
    there is **no un-record, no edit and no delete** of a mark or of a correction, because the model is
    append-only by contract; two of the domain's eight verbs (`get`, `sessionIdsWithAttendance`) have
    no shipped UI caller, each with its reason in `src/domains/attendance/README.md` §3, and
    scheduling's `useSessionRoster` is **still** unconsumed — M5 read the attendance domain's own
    derived register instead, so that verb now belongs to no milestone; **I13 stays OPEN** with a
    view-boundary mitigation only; **I16 stays OPEN** with this view's ceilings stated rather than
    removed; the legacy `attendance` seed collection survives with no reader in the view that owns it
    (**D5**, **M10**); `src/domains/attendance/apiRepository.ts` stays deliberately unregistered, so
    backend aggregation does not exist; **no acceptance audit of M5 ever ran**, so no audit findings
    and no **B**-numbered coverage items exist for it; and **browser QA is NOT VERIFIED**.
  - Group A has since grown one suite that is **not** part of the protected six:
    `src/domains/scheduling/__tests__/useDerivedRead.test.tsx` (9 tests, I13 Checkpoint 3B), so the
    scheduling `__tests__` directory holds 220 tests while **Group A itself remains 211**.
- **Done when:** both views read exclusively through `useScheduling` / `useAttendance`, the
  fixture imports are gone, `src/__tests__/architectureBoundaries.test.ts` still passes, and
  new suites assert that fixture records do **not** appear when the repository returns
  something else (the `Students.test.tsx` pattern).
  **The scheduling half of that criterion is satisfied and measured:** `src/views/Scheduling.tsx`
  reads exclusively through `useSessions`, its fixture imports are gone,
  `src/__tests__/architectureBoundaries.test.ts` passes with three *more* callers in
  `PAGE_SIZE_CALLERS` than before, and `src/views/__tests__/schedulingNoFixtures.test.ts` (14 cases)
  asserts that fixture records do not appear when the repository returns something else.
  **The attendance half is satisfied and measured too** (2026-09-14, M5 at
  `9505ade4011b37a34e3488fd51206512829205ec`), clause by clause against the criterion exactly as
  originally written:
  - *"both views read exclusively through `useScheduling` / `useAttendance`"* — `src/views/Attendance.tsx`
    imports `useSessions` from `src/domains/scheduling/useScheduling.ts` and `useSessionAttendance`,
    `useAttendanceRecords` and `useAttendanceCorrections` from
    `src/domains/attendance/useAttendance.ts`, and reaches the repository itself only for the three
    writes (`getAttendanceRepository()`). Its remaining reads — `useClasses`, `useTeachers`,
    `useStudentList` — resolve ids the domain's records carry into labels, exactly as the scheduling
    view's do, and none of them is a source of register data.
  - *"the fixture imports are gone"* — the file imports nothing from src/data/records.ts (the design-time fixture module, dissolved at M10) or
    src/data/academy.ts (the design-time fixture module, dissolved at M10); `grep -nE "src/data/|todayAttendance|attendanceTrend|attendanceByDay|attendanceLabel|AttendanceRoster"`
    over the view and both of its panels matches only prose inside comments, never an import or a use,
    and `src/views/__tests__/attendanceNoFixtures.test.ts` pins that structurally ("imports nothing
    from the fixture module", "names no fixture symbol anywhere in the view or its panels").
  - *"`src/__tests__/architectureBoundaries.test.ts` still passes"* — green at **11** tests with **no
    new entry needed**: `useSessions`, `useAttendanceRecords` and `useAttendanceCorrections` were
    already in that file's `PAGE_SIZE_CALLERS`, and all seven of this view's bounded reads state an
    explicit page size. One honest gap in that list is recorded rather than left implied:
    `useStudentList` is **not** among the policed hooks, so this view's new call site
    (`src/views/Attendance.tsx:211`, `per_page: SUPPORT_PER_PAGE`) is checked by review and by
    `attendanceNoFixtures` rather than by that gate — see **I16**.
  - *"new suites assert that fixture records do **not** appear when the repository returns something
    else"* — `src/views/__tests__/attendanceNoFixtures.test.ts` (31 cases: "renders none of the retired
    narratives", "carries none of the five fabricated figures", "computes no percentage", "hardcodes no
    ISO date and no fixture session id", "calls no verb the repository does not have") and
    `src/views/__tests__/attendanceWrites.test.tsx` (22 behavioural cases driven through the real
    repository in DEMO **and** in a customer's own EMPTY environment: "records one mark, and shows the
    record the repository wrote", "renders honest empty surfaces and no fabricated figure", "reads the
    correction history back on the history tab"). Three of those cases are **mutation-checked**: a
    fabricated rate, a crossed register and a missing RBAC gate each turn them red (§4 → "M5
    validation").

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
- **What landed, and the rule that decided each shape** *(M2's record; at the time, none of the four
  views could write — scheduling and attendance had real domains the views did not use, finance had
  none — so no site could become "the result of an awaited repository call". **M4 has since wired
  scheduling**, so three of the four remain in that position; the rule below is unchanged and still
  decides every shape.)* Each therefore became an honest
  `info` in the sanctioned "requires a server" shape, a truthful navigation, or nothing at all.
  Where no truthful action existed the control was **removed rather than disabled**, on the owner's
  explicit decision: a disabled button still advertises a capability the product does not have.
  - `src/views/Scheduling.tsx` — both «انتقال به اتاق ۴» buttons are gone, together with the local
    `resolved` flag whose only real effect was hiding the warning. The conflict card and the
    drawer's overlap evidence stay on screen until a real `rescheduleSession` resolves them, the
    drawer no longer closes on a claimed write, and «مشاهده در تقویم» still navigates. *(This is M2's
    record and stands as written; since M4's CP2 the real `rescheduleSession` does exist, and the
    conflict evidence an operator sees is the preview `useConflictCheck` derives **inside the
    reschedule dialog** — the calendar itself renders no conflict count, badge or card, because an
    invented number would be worse than none.)*
  - `src/views/Attendance.tsx` — «همه حاضر» keeps its genuine on-screen convenience, relabelled
    «همه حاضر (موقت)», and now says in `info` that no attendance has been recorded; a real
    `bulkRecord` needs a domain session id and an authenticated `recordedByUserId` this view does
    not have. The «پیگیری» button, which claimed a student **and their guardian** had been
    notified, is removed; the row still opens that student's real profile. *(This is M2's record and
    stands as written. **M5 discharged the reason it gives:** a real `bulkRecord` now exists, is
    awaited, and carries the authenticated principal, so the control is no longer «موقت» — it is
    labelled with the count it will write, «همه حاضر (N)», withdrawn rather than disabled when there
    is nothing to write, and its success sentence reports a count of records that exist. **Site 3's
    retracted claim «همه حاضر ثبت شدند» is now a forbidden string**, pinned by
    `src/views/__tests__/attendanceNoFixtures.test.ts`. **Site 4 stays removed:** no notification of
    any kind is sent — nothing messages a teacher, a student or a guardian (**D1**, **I7**) — and the
    register panel and the correction dialog each say so out loud rather than leaving it implied.)*
  - `src/views/Finance.tsx` — both reminders now say in `info` that an SMS service is required and
    that nothing was sent or queued. The invented «N پیام در صف ارسال قرار گرفت» count is gone.
  - `src/views/Classes.tsx` — the waitlist button no longer claims a suggestion was filed with
    scheduling (no such record exists anywhere); it opens the schedule, the one truthful action
    available before session generation lands. *(Generation landed at M4's CP3 — in the schedule view,
    through `src/views/scheduling/GenerateSessionsDialog.tsx`; this button still only navigates, and
    still claims nothing.)*
- **Enforced by** `src/__tests__/writeFeedbackHonesty.test.ts` (a view may only report success where
  it can reach a repository, and the views on its `FIXTURE_DRIVEN_VIEWS` list may contain no success
  toast at all — for them the absence is a proof, not a convention. That list held **four** views when
  M2 landed, held **three** after M4 graduated `views/Scheduling.tsx` into the `GRADUATED_VIEWS`
  ratchet described above, and holds **two** since M5 graduated `views/Attendance.tsx` the same way —
  Finance and Reports only) and
  `src/views/__tests__/noSuccessWithoutWrite.test.tsx` (each site's new behaviour, driven through
  the real view in DEMO and in a customer's EMPTY environment).
- **Not fake (verified — do not "fix" these):** `src/views/Classes.tsx:118` (archive, with a
  real `catch` → `tone: "danger"` at :121), `Classes.tsx:279` / `:291` (dialog `onSaved` /
  `onEnrolled` after real writes), `Students.tsx:136/628/755`, `Teachers.tsx:126/365`,
  `Messages.tsx:131/190`, and every honest `tone: "info"` toast that says a server is required
  (`Attendance.tsx:51`, `Finance.tsx:170`, `Library.tsx:334`, `Messages.tsx:172` and `:313`,
  `Reports.tsx:43`, `Students.tsx:677`, `Teachers.tsx:321`,
  `src/components/layout/TopBar.tsx:91`, `src/components/overlays/ActionSheet.tsx:94`).
  **The `Attendance.tsx:51` entry is now historical and must not be read as a live line number:** M5
  rewrote the file, and the honest `info` toast it blessed no longer exists — a real awaited write
  replaced it, and the environment-dependent «دمو» wording disappeared with it rather than being
  routed through `useIsDemoEnvironment()` (see **I12**, closed clause by clause). The remaining
  entries are unchanged.
  `src/views/DesignSystemView.tsx:178` is the design-system showcase, not a product surface.
- **Done when:** every success toast is the result of an awaited repository call with an honest
  failure path, and a test asserts that no success notification can fire without a write.
  **Satisfied at M2**, in the second of those two forms and in the only form these views could
  then reach: no success notification *could* fire from them, because none existed in their source
  and `src/__tests__/writeFeedbackHonesty.test.ts` failed the suite if one was added. The first form
  needs the awaited repository calls that M4 (scheduling) and M5 (attendance) bring.
  **Update (2026-09-14, M4):** `src/views/Scheduling.tsx` has left that list in the only direction the
  gate allows — it now satisfies the **first** form. Its success toasts follow awaited
  `rescheduleSession`, `cancelSession` and `generateSessions` calls, asserted by
  `src/views/__tests__/schedulingWrites.test.tsx` (16 cases) and
  `src/views/__tests__/schedulingGeneration.test.tsx` (15 cases), and
  `src/__tests__/writeFeedbackHonesty.test.ts` tracks it in a new `GRADUATED_VIEWS` ratchet asserted in
  both directions: the file must reach `getSchedulingRepository(` **and** report a success it can now
  honestly claim, so it can neither slip back into `FIXTURE_DRIVEN_VIEWS` nor keep a toast after losing
  its write. The three views still on the fixture list (`src/views/Attendance.tsx`,
  `src/views/Finance.tsx`, `src/views/Reports.tsx`) keep the second form; **M5's attendance half is
  still outstanding**, and the sites that already wrote for real keep satisfying it and are the
  "not fake" list below.
  **Update (2026-09-14, M5):** `src/views/Attendance.tsx` has left that list in the same direction,
  and it now satisfies the **first** form. Its success messages follow awaited `record`, `bulkRecord`
  and `correct` calls (`src/views/Attendance.tsx:304`, `:349`, `:390`), asserted by
  `src/views/__tests__/attendanceWrites.test.tsx` (22 cases) and
  `src/views/__tests__/attendanceNoFixtures.test.ts` (31 cases), and
  `src/__tests__/writeFeedbackHonesty.test.ts` tracks it in the same `GRADUATED_VIEWS` ratchet,
  asserted in both directions: the file must reach `getAttendanceRepository(` **and** report a success
  it can honestly claim. **Two views remain on the fixture list — `src/views/Finance.tsx` and
  `src/views/Reports.tsx` — and both are **I2**'s**, deferred by **D6**, because neither has a domain
  layer to be wired to. So this item's "Done when" is satisfied for every view that *has* a domain.
  *(This line said "both are **I2** and M9's" while M9 was ahead; **M9 landed (2026-09-16,
  `8d34eb3d1cd639cffc794596250c897b5ed4b6b3`) without creating either domain** — its own money slot was
  rebuilt from the student records instead — so the two views cannot satisfy it until a Finance/Reports
  domain exists, which is **M10**-and-later territory under **I2**.)*

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

### H4. Dashboard insight panels present fabricated text as measurement — ✅ CLOSED (2026-09-16, landed by M9 at `8d34eb3d1cd639cffc794596250c897b5ed4b6b3`)
- **What:** `src/components/panels/Intelligence.tsx`, `BusinessIntelligence.tsx`,
  `Signals.tsx` and `AttentionAndFlow.tsx` import static fixtures from src/data/academy.ts (the design-time fixture module, dissolved at M10)
  (`signals`, `growthSeries`, `revenueSeries`, `occupancy`, `quickActions`, `todayFlowIds`) and
  render sentences such as a retention-rate increase or a Tuesday piano-occupancy figure that
  have no relation to stored records — including in EMPTY, where there are zero records.
- **Deferred because:** the correct fix is deriving every number from live repositories
  (`useAcademyMetrics` already exists for the hero metrics), which is product-phase work.
- **Update (2026-09-14, M5):** this item's own four panels are untouched, but one more instance of
  its **shape** is gone. `src/views/Attendance.tsx` used to print a hardcoded «نرخ حضور امروز» of 92٪
  against a fabricated «میانگین ماه» of 89٪ plus a per-instrument breakdown nobody computed — the same
  defect, in a view rather than a panel. M5 **removed** those figures rather than recomputing them:
  no percentage, no trend, no per-instrument breakdown and no «آخرین حضور» projection, because the
  bounded window the view reads cannot support an academy-wide rate honestly, and `attendanceTrend`
  and `attendanceByDay` are pinned as forbidden by
  `src/views/__tests__/attendanceNoFixtures.test.ts` ("computes no percentage", "carries none of the
  five fabricated figures", "draws no trend, ring or meter over data it does not have"). The only
  aggregate this domain still feeds is the dashboard's hero metric, in
  `src/domains/shared/useAcademyMetrics.ts`. `src/views/Reports.tsx` still renders `attendanceByDay`
  (**I2**, deferred by **D6** — and **M9** landed without touching that view).
- **Done when:** each insight is computed from loaded data, states «داده‌ای نیست» when the
  input set is empty (via `src/lib/stats.ts` + `NO_DATA`), and a test renders the dashboard in
  EMPTY asserting no fabricated figure or sentence survives.
- **Status (2026-09-16, M9 `8d34eb3d1cd639cffc794596250c897b5ed4b6b3`):** the done-when is met, and
  measured on the real tree rather than asserted. The four panels and `src/views/Dashboard.tsx` read one
  read set (`src/domains/shared/useDashboardInsights.ts` — `useStudentList` / `useClasses` / `useRooms` /
  `useTeachers` plus a bounded `useSessions` window, every call stating `per_page: 500`) and derive every
  displayed figure in `src/domains/shared/dashboardInsights.ts` through `meanOf` / `ratioPct` / `topBy`
  (`src/lib/stats.ts`), whose empty-set answers are `null` and which therefore cannot print `NaN`. The
  traced map (which figure comes from which record) is in [PROJECT_STATE.md](PROJECT_STATE.md) §4 →
  "M9 validation". `signals`, `growthSeries`, `revenueSeries`, `occupancy`, `instruments`, `quickActions`,
  `todayFlowIds`, `attentionItems`, `attentionQueue` and `intelligenceCards` no longer reach those
  surfaces; the seeded room clash is detected from the stored sessions instead of a sentence naming
  «پیانو پیشرفته», and the dashboard's own mobile pulse kicker («اوج ۱۴:۰۰ تا ۱۵:۰۰ · ۱ نقطهٔ توجه») was
  the last hand-written figure on the page. **EMPTY is asserted over the real `Dashboard`:** every panel
  renders, each states «داده‌ای نیست», the two measures with no stored history render `NO_DATA` glyphs, no
  `NaN`/`Infinity` appears in text **or in any SVG attribute**, and none of 24 retired fixture sentences
  or 5 retired fixture figures survives — with the fixture sources substituted by absurd values
  afterwards leaving all 82 cases across the four M9 suites and the two gate suites they drive green,
  which is what makes them inert rather than merely unwired
  (`src/views/__tests__/dashboardInsightsLive.test.tsx`, `src/components/panels/__tests__/panelsEmpty.test.tsx`).
  **What this closure does *not* cover, stated so it is not read as more than it is:** the
  design-system gallery (`src/views/DesignSystemView.tsx`) still renders fixture *samples* (`signals`,
  `intelligenceCards`, `attentionItems`, `schedule`, `insights`) as component demonstrations, and
  `src/views/Finance.tsx` / `src/views/Reports.tsx` remain fixture-driven (**I2**, deferred by **D6**) —
  separating the fixtures' three roles is **D5**, recorded for **M10**, and M9 did not start it. `Hero.tsx`
  and `demo/seed.ts` are untouched (see **M10**'s scope and [PROJECT_STATE.md](PROJECT_STATE.md) §7 item 20).
  **One surface the milestone *removed*:** the revenue chart had no authoritative source — Finance/Reports
  are README-only and `invoices`/`payments` have no repository — so it was **deleted** rather than
  recomputed, and the money slot shows the receivables the student records carry. **No Finance domain, no
  repository and no fabricated revenue figure were created.**

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

### I1. Static sidebar badges and hints — ✅ CLOSED (2026-09-15, landed by M7)
`src/components/layout/Sidebar.tsx:120` ~~renders `badge={n.badge}` from the static `navGroups`
fixture in src/data/academy.ts (the design-time fixture module, dissolved at M10), so counts (e.g. attendance, messages) are shown in EMPTY
where the true value is zero.~~ **Done when:** badges come from repositories and disappear at
zero. (Verified false-in-EMPTY during the Phase 2 audit; deliberately not fixed there because
it needs live counters, not a lifecycle change.)
- **Status (2026-09-15, M7 `f1ec0ddde783aec14d6429ac2457f085f851ad9a`):** the *done-when* is met, and by the strictest available reading of it — `NavDef` no longer has a `badge` field at all, so a static count cannot be reintroduced without failing `src/views/__tests__/relationsNoFixtures.test.ts`; `Sidebar.tsx` computes its badges once per shell in `useNavBadges()` from `useConversations({ per_page: 200 })`, summing the `unread` field the chat repository returns, and renders the badge **only** while that read is complete (`total === items.length`) and the sum is positive — in flight, failed, partial and zero all render **nothing**. Pinned in both directions by `src/views/__tests__/navigationCounts.test.tsx` (7 cases: the repository's own total, a real `markRead` moving it, and silence on a failed read, a partial page and zero unread). **The attendance badge was REMOVED, not rebuilt:** «۳ کلاس ثبت‌نشده» needed a scoped "sessions with no register" query, the attendance domain exposes none (`sessionIdsWithAttendance` is a one-directional protection seam over the whole table, not a bounded read), and inventing an aggregate was explicitly out of scope — the reason is documented in `src/components/layout/Sidebar.tsx` next to the code. The *hints* half of this item went the same way: the command palette's «مالی · ۳ مورد», «حضور · ۳ کلاس ثبت‌نشده», «هنرجویان · ۵ نفر», «گزارش‌ها · ۶ ماه», the room option «اتاق ۴ (۵۸٪ آزاد)» and the recipient option «هنرجویان در معرض ریزش (۵)» now name a target, a filter, a room or a group and claim no figure; the gate rejects a digit written into any nav or command hint (both digit scripts, every quoting style) and a parenthesised count inside a select option. **What this does not close:** the *fixture identity* still on screen (the academy name in the shell and on the login screen) is a different item — **M8/D2** — and the dashboard panels' fabricated sentences **were** a third — **M9/H4**, **closed at M9** (`8d34eb3d1cd639cffc794596250c897b5ed4b6b3`, 2026-09-16), which left only the design-system gallery's fixture samples and Finance/Reports behind (**D5**/**M10**, **I2**). Recorded in [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M7 coverage matrix" (rows 11, 12, 13, 14 and 21) and §7 item 2.

### I18. A cancelled class or teacher requires a compensatory session — **requirement; PARTLY LANDED (private one-to-one), item still OPEN**
**Recorded 2026-09-15 at M7's closure, by product-owner instruction. NOT implemented, NOT designed and NOT authorized.** The requirement, in the owner's words: when a class or a teacher is cancelled, the **affected students require a compensatory session**; the stated default is a **one-hour session on the same day**, and otherwise the date and time are **coordinated with the secretary**. Nothing in this build does any of that today: `cancelSession` (the scheduling domain's cancel verb, `src/domains/scheduling/repository.ts`) cancels a session and appends a required reason, the view reports exactly what happened (`src/views/scheduling/SessionWriteDialogs.tsx`), and **no compensation row, entity, verb, reminder or UI exists** — nor may one be inferred, because the current cancellation model is "this session does not happen", not "this session is owed". **Done when (to be designed, not assumed):** the requirement is turned into a written design — what a compensation is (a new `Session` for the same class, a make-up slot, or a credit), who may create it (the secretary, not the teacher), how the same-day one-hour default is expressed against availability and the conflict engine, how students are told (today no notification of any kind is sent — **D1**, **I7**), and what happens when no slot can be agreed. Evidence and boundaries: the cancel path above; the scheduling section of [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) §9 (deferred, recorded at M7's closure); **Group A is frozen** — any design that needs a scheduling contract change is a decision before it is code. **M7 did not touch it**, and no part of this item may be reported as started.

**Status (2026-09-15, Class Compensation P1 `a21311d7e32c82e3a46b1581c94f6b3478bf646c`): PARTLY
LANDED — the item stays OPEN, and the paragraph above is kept as written.** The *done-when* clause "the
requirement is turned into a written design" is met, and the design is implemented as a domain:
`src/domains/compensation/` (types, pure derivation, a five-verb contract, the demo implementation, a
read layer, a README and 69 tests at that commit — **121 tests in eight files** now), registered at
`src/domains/registry.ts:231` and backed by a new `sessionCompensations` dataset collection. **What shipped is narrower than what this item records, and
must not be read as satisfying it:** P1 covers **cancelled sessions of private (one-to-one) classes
only** — a group class is refused by `kind`, never by roster size; the obligation is registered by an
**explicit act** of a secretary, manager or admin holding `schedule.write` — enforced: all three verbs
refuse an actor without that permission (`COMPENSATION_FORBIDDEN`) before any read, client-side, so the
server still owes the independent check — (a teacher cannot register, book or discharge), not created
by the cancellation; the "same-day one-hour" default is a **prefill of
the original session's own date**, never a computed "today" and never a free-slot search; and **nothing
notifies anybody** (**D1**, **I7**).

**Status (2026-09-15/16, the packages after P1 — this item stays OPEN, and the group and class-wide
scope below is still the reason why).** Three further packages landed on the same workstream, none of
them narrowing what this item records:

- **`cd91ed6a75a9c053b60e4e9dbbc10e06cf89a291` (C-1 + C-1.1)** — an obligation carries **at most one live
  make-up**: a second booking is refused (`COMPENSATION_ALREADY_SCHEDULED`) inside one serialized section
  shared by `schedule` and `complete`, so a double submit produces one session and one refusal and a
  booking racing a discharge cannot lose the race silently. A booking is read as **lineage**, not as a
  row: moving a make-up with scheduling's own `rescheduleSession` cancels the moved-from row and links a
  replacement, and the derived `scheduled` state, the refusal and the completion gate all follow that
  chain to the session the make-up is on now — so a **moved** make-up stays booked, still refuses a
  second one and is discharged against the session it was moved to, while cancelling or deleting the
  **end** of the chain returns the obligation to `required` with no write. The ledger is never
  re-pointed, and an unwalkable chain is reported (`attemptBroken`, `needsAttention`) rather than guessed
  at.
- **`07f89db779ca4017dbbb22db1ac7624b18fb95be` (C-2)** — **D20**: the frozen student's roster state at
  the make-up's date is **disclosed per booking** (`currentAttempt.studentOnRoster`, derived on every read
  from the scheduling domain's roster for the effective session's date, never stored, `undefined` when not
  determinable) and is **never** a booking or completion gate. The debt is owed to the frozen student, the
  make-up stays bookable and dischargeable when an enrollment has ended, and the refusal that owns the
  rule stays in attendance (`ATTENDANCE_STUDENT_NOT_ON_ROSTER`).
- **`b7a97b325741b1129f6d50a7d067d1aa6459597c`** — the write-authorization and lifetime-uniqueness
  hardening (every verb refuses an actor without `schedule.write` before any read; the `(original,
  student)` pair is re-checked immediately before the write).
- **`fc83d6d6246a4679425223e271bdf610a027a67b`, `79fd44eea260ed8eec4a2eb592e4568f884bca9b` and
  `79ec13d0ab2671a612a578605a1fa7a91effc435` — the secretary surface and its two hardening packages.** The
  read layer and the three write verbs gained their shipped caller (`src/views/Compensation.tsx` and
  `src/views/compensation/CompensationDialogs.tsx`), gated by `schedule.read` to open the surface and
  `schedule.write` for register / schedule / complete through the existing permission matrix: the ledger,
  its counts, the three dialogs, the disclosure C-2 requires, the bounded candidate window with its
  truncation stated, and one real `#/compensation` route case in `src/__tests__/routeProtection.test.tsx`.
  **What this does not narrow:** nothing in the requirement above — group and class-wide compensation, any
  coordination flow (including "no slot can be agreed") and every notification stay unbuilt, the demo
  still seeds no compensable case, there is still no server and no `apiRepository`, the per-surface gate
  coverage was deliberately left open (**I21**) and **has since been closed** by
  `bf8bd91150d6fca3392115c7eccd6c738e9091ee` (the surface's own dedicated boundary gate — see I21
  below), and browser QA has never run. Nine findings of the
  surface's own audit are recorded closed in [PHASES.md](PHASES.md) → the workstream section; the tenth,
  **I21**, is closed by the same commit.

**Still unbuilt, and why this item stays OPEN:** group and class-wide compensation (the requirement's
own subject beyond private one-to-one lessons), any coordination flow beyond a form the operator fills —
including "what happens when no slot can be agreed", which the owner's wording asks for and nothing
answers — and a server (the **UI** landed after this paragraph was written, as the bullet above
records). Decisions **D18**/**D19**/**D20** in [DECISIONS.md](DECISIONS.md); the workstream record is
[PHASES.md](PHASES.md) → "Workstream — Class Compensation P1" (which registers this chain and the
surface) and [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "Compensation P1 validation" and "Compensation UI
validation". Automatic completion
of elapsed sessions is a **separate** workstream with no decision and no implementation, and is not part
of this item.

### I20. The compensation contract has a UI and no server (found 2026-09-15, by P1's landing; the UI half landed 2026-09-16)
**The domain is complete, tested and registered; nothing in the product calls it.** The five verbs and
the read layer (`src/domains/compensation/useCompensations.ts`) have **no shipped caller**: no view
offers registering an obligation, booking a make-up or discharging one, and `src/domains/compensation/README.md`
records the same fact from the domain's side. There is also **no `apiRepository`** for the domain, so
api mode would silently serve the demo implementation for an **eleventh** domain — the disclosure
problem **D8** exists to prevent (M11), which now has one more member: the registry getter
(`src/domains/registry.ts:231`) resolves demo in **both** modes. Finally, the demo dataset ships **no
compensable case at all** (`sessionCompensations: []`, and its only cancelled session belongs to a
group class), so even a hand-run cannot exercise the flow without first creating a cancelled private
session and registering by hand. **Done when:** a surface wires the read layer and the three write
verbs (register, schedule, complete) through the RBAC permission that owns them, the demo can produce a compensable case (seeded or by hand,
without inventing data that contradicts the seed), and a server implements the pinned contract or the
api-mode hybrid is disclosed where the flow is offered — the same standard M4/M5 met for scheduling and
attendance. **What this is not:** a defect in the domain. It is the deliberate scope of the P1
authorization ("no UI in P1"), recorded so it cannot be mistaken for a delivered capability.

**Status (2026-09-16, the UI packages — the item stays OPEN, and one of its three done-when clauses is
met).** The **surface** now exists. `fc83d6d6246a4679425223e271bdf610a027a67b`
(*feat(compensation): add the secretary compensation surface* — 7 files, +2 243/−1) wires the read layer
and the three write verbs into `src/views/Compensation.tsx` and
`src/views/compensation/CompensationDialogs.tsx` through the RBAC permission that owns them
(`schedule.read` to reach the surface, `schedule.write` for register / schedule / complete), and
`79fd44eea260ed8eec4a2eb592e4568f884bca9b` plus `79ec13d0ab2671a612a578605a1fa7a91effc435` harden it —
indeterminate counts with a named failure and a per-read retry, a refresh-failure banner that keeps the
last good rows and says so, a warning-consent toggle that names the warnings it accepts, a failed
effective-session read reported as a failure with the move disabled, the bounded candidate window (365
days back / 120 days forward / 200 rows) and its truncation disclosed, the C-2 disclosure rendered as
information and never as a gate, one shared Jalali date-input boundary
(`src/views/shared/jalaliInput.ts`), a real `#/compensation` route case, and one submit/refusal wrapper
for the three dialogs. **The other two clauses are not met and are not claimed:** there is still **no
`apiRepository`** — api mode keeps serving Demo for an eleventh domain and discloses nothing where the
flow is offered (**D8**) — and the demo dataset still ships **no compensable case**
(`sessionCompensations: []`, and its only cancelled session belongs to a group class), so a hand-run
still needs a cancelled private session created first. **The server clause is untouched:** the
permission gate, the lifetime `(original, student)` uniqueness and the single-row roster claim are still
client-side, and server-side enforcement in one transaction remains owed. **Update (2026-09-16, the
S-6 gate):** that last clause has since been discharged — the surface has its own dedicated boundary
gate and **I21** is closed at `bf8bd91150d6fca3392115c7eccd6c738e9091ee`; every other clause of this
item, and the server clause, is untouched.

### I21. The compensation surface is not named by the per-surface gates (found 2026-09-16, during the UI workstream's own read-only audit — finding **S-6**) — ✅ CLOSED (2026-09-16: by `bf8bd91150d6fca3392115c7eccd6c738e9091ee`)
**The surface is pinned by its own suite and by the gates that scan every view, and by nothing
list-driven beyond that.** What covers it today: `src/views/__tests__/compensationUi.test.tsx` (16 cases
— the ledger's loading / empty / error states and the copy that distinguishes them, the indeterminate
counts, the refresh-failure retry, the three dialogs including the bounded-window and truncation copy,
the C-2 disclosure scoped to its own drawer, and the Persian Jalali date handling);
`src/__tests__/routeProtection.test.tsx` (9, two of them this surface's — the real route and the role
without `schedule.read`); and the *global* view-layer gates
`src/__tests__/architectureBoundaries.test.ts`, `src/__tests__/privacyPosture.test.ts` and
`src/__tests__/writeFeedbackHonesty.test.ts`'s rule that a success toast needs a data layer (the surface
does reach `getSchedulingRepository(`). What does **not** cover it, measured at `79ec13d`:
`src/views/__tests__/relationsNoFixtures.test.ts`'s `SURFACES` list does not name
`src/views/Compensation.tsx`; `src/views/__tests__/emptyEnvironment.test.tsx` names it in neither
`LIVE_VIEWS` nor `FIXTURE_VIEWS`; and `writeFeedbackHonesty`'s `GRADUATED_VIEWS` ratchet has no
compensation entry — so the rules those lists enforce per surface (a windowed `useSessions` read
carrying `per_page`/`from`/`to`, empty- and failure-honest rendering, and the fixture/figure rules) hold
on this surface **by convention, not by gate**. **Done when:** that coverage exists — most likely by
registering the surface in those lists and adding a dedicated list-driven fixture suite, the way M7 and
the attendance/chat milestones did. **Deliberately not done here:** those are gate-architecture and
test-list changes, i.e. exactly the work the UI workstream's authorization excluded, so this item
records the gap instead of closing it. Evidence: the five test files above and
[PHASES.md](PHASES.md) → the workstream section's **S-6** entry.

**Status (2026-09-16, the S-6 gate — this item is CLOSED).** The coverage the done-when clause asks for now
exists, in the form chosen when the gap was designed: a **dedicated list-driven boundary gate in a new
file**, `src/views/__tests__/compensationNoFixtures.test.ts` (*test(compensation): add dedicated UI
boundary gate* — one file, 768 insertions / 0 deletions, **40 cases**), rather than registrations added to
the protected per-surface lists — editing `relationsNoFixtures`' `SURFACES`, `emptyEnvironment`'s view
lists or `writeFeedbackHonesty`'s `GRADUATED_VIEWS` would change gates this workstream is not authorized
to change. The gate discovers the surface's own boundary (`src/views/Compensation.tsx`, everything under
`src/views/compensation/` and `src/views/shared/jalaliInput.ts`) and asserts the discovery itself — the
exact file set, existence, non-emptiness and a ≥3-file floor — so a **zero-file scan fails** instead of
passing. Twelve rules are enforced in asserted order, each with its own mutation probe so no rule is
vacuous: `fixture-import`, `fixture-identifier`, `own-source-of-truth`, `unbounded-read`,
`fabricated-figure`, `timer`, `hardcoded-iso-date`, `effective-session-target`, `permission-boundary`,
`dialog-owned-feedback`, `roster-disclosure-not-a-gate` and `read-failure-honesty`. Measured at the
landing: the new gate **40/40**; the eleven-file batch **172/172**; the full suite **1 908 passed /
2 failed of 1 910** — exactly the gate's 40 cases over the 1 870 baseline, the two failures the recorded
environmental pair; `npm run typecheck` clean; `npm run build` exit 0 (4.06 s); sixteen source mutations
and two discovery proofs killed, each reporting the rule that owns it, with every source file restored
byte-identically against recorded sha256 baselines. **What the closure does not claim:** the three fixed
lists above still do not enumerate this surface, and six further **gate-architecture** gaps found while
building the gate are **deferred, not fixed** — `architectureBoundaries`' demoStore/URL import rules are
string-blind, `relationsNoFixtures`' `surfaceFiles()` assumes a basename and case this directory breaks,
`useCompensations` is missing from **both** page-size catalogues, `src/views/shared/jalaliInput.ts` is
owned by no per-surface gate, the success-toast ratchet accepts any `get*Repository(`, and no
repository-refusal coverage exists for any compensation verb. (Findings about the global gates — **not**
the milestones M1–M7.) The full record is [PHASES.md](PHASES.md) → the workstream section's S-6 entry and
[PROJECT_STATE.md](PROJECT_STATE.md) §4 → "S-6 boundary gate validation".

### I2. Finance and Reports have no domain layer
`src/views/Finance.tsx` and `src/views/Reports.tsx` are fixture renderers with no
`src/domains/finance` / `src/domains/reports` implementation (only README stubs exist). Money
precision, idempotency and gateway behaviour are backend requirements — see
`docs/production-handoff.md`. **Done when:** both follow the Students pattern with demo *and*
API implementations, tests, and no fixture imports.
- **Update (2026-09-14, M5):** these are now the **only two views left on
  `src/__tests__/writeFeedbackHonesty.test.ts`'s `FIXTURE_DRIVEN_VIEWS` list** — scheduling graduated
  at M4 and attendance at M5 — and `src/views/Reports.tsx:143` is the **last shipped consumer of the
  attendance fixtures**, still rendering `attendanceByDay` from src/data/records.ts (the design-time fixture module, dissolved at M10). The wired
  attendance view reads neither `attendanceTrend` nor `attendanceByDay`, so this item's Reports half
  now also owns the only place a fabricated attendance chart survives. Cleaning the fixtures
  themselves up is **D5**/**M10**, not a wiring milestone's work — and **M9** (2026-09-16) left these
  two views exactly as they were, because it created no domain.
- **Update (2026-09-16, M10 `e7a64b7777be36ddd97fc3337898fad794118e5b`):** the fixtures themselves
  are now dissolved and the two views are **no longer fixture renderers** — they carry an explicit,
  visible, mechanically testable **deferral** (`src/lib/financeReportsDeferral.ts`, **D6**; the
  surfaces name this work item on screen, and `src/__tests__/m10Boundary.test.ts` enforces that no
  domain read sits behind it). **They are NOT implemented and this item stays open unchanged:** the
  Finance and Reports domains, repositories and backend seam remain future work; per its done-when
  clause they still do not follow the Students pattern.

### I3. Learning-content → level assignment UI — ✅ CLOSED (2026-09-13, landed and completed by M3)
The learning domain models `Piece` vs `LearningContent`, programs, levels, placement history,
eligibility and deterministic recommendations (`src/domains/learning`,
`src/domains/progress`, documented in `docs/architecture/data-layer.md`), but there ~~is~~ **was** no
UI to assign content to a level. *(The gap is described as it was found, because that is the record of
why M3 existed; it no longer holds — see the status below.)*

**Scope clarification — this is a UI and workflow gap, not a schema redesign.** The join entity and
its repository surface already exist and are already tested: `LevelContentLink` at
`src/domains/learning/types.ts:183`; the contract methods `listLinks` / `attachContent` at
`src/domains/learning/repository.ts:56`; the demo implementation, including link ordering and the
`CONTENT_ALREADY_LINKED` conflict, at `src/domains/learning/demoRepository.ts:233`; and coverage in
`src/domains/learning/__tests__/demoRepository.test.ts`. Today **only tests call them**. *(Kept as
written because it is the record of the gap; superseded by M3 — see the status below.)*

**Done when:** an assignment surface exists in Settings → Programs & levels (or the learning
workspace), writes through that existing contract, and is covered by a test.

- **Status (2026-09-13): ✅ CLOSED — landed by M3 and accepted complete.** All three "done when"
  conditions are met and were verified by a formal acceptance audit against this item and the
  milestone's spec: `LevelContentPanel` renders in Settings → Programs & levels
  (`src/views/Settings.tsx:368`) behind a per-level «منابع» toggle, it writes through
  `attachContent` / `detachContent` and reads through `listContent` (no new contract, no schema
  change, **1414 insertions and 0 deletions** in source), and it is covered by **17 tests** in
  `src/domains/learning/__tests__/LevelContentPanel.test.tsx` (12) and
  `src/domains/learning/__tests__/contentAssignmentFlow.test.tsx` (5), each mapping to a clause of
  the spec, four of them mutation-verified. Implementation checkpoint `e5b0a57`; the audit's one
  product finding — the picker's catalogue read discarded `error`, so a failed catalogue rendered as
  «منبعی برای اتصال باقی نمانده» — was fixed at `3bec881` with a regression case and a reversion
  check. M3 is **COMPLETE**.
- **What closing I3 does NOT close.** Four limitations survive the milestone and are recorded rather
  than absorbed into it: the surface's **detach** has no stale-context guard (**I13**, which stays
  open); lists that mean "everything" stop at `per_page: 200` (**I16**, new); link `sortOrder` is
  written and honoured student-side but not displayed or manageable in the assignment surface
  (**I17**, new); and no test performs a storage round-trip, so "persists across a reload" is proven
  by remount plus the store's single-persistence-authority code path rather than by a re-hydration
  case. **Browser QA has never run** on this surface and is NOT VERIFIED (§5 of
  [PROJECT_STATE.md](PROJECT_STATE.md)) — closing I3 is a statement about the contract having a
  tested UI, not about the UI having been used by a human in a browser.

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

### I6. Performance and code-splitting — ✅ CLOSED (2026-09-17, by M11 across `3eed4f190b6538ad62bf35d7b0c9fa5afc310acc` and `24998d8330a95510cd969c872edb28ddcc59ef16`)
`npm run build` emits a main chunk > 500 kB (`dist/assets/index-*.js` ≈ 844 kB at `33b1031`).
`src/App.tsx` imports all thirteen `src/views` eagerly (13 static view imports), so there is no
route-level code-splitting and no lazy loading; the build config in `vite.config.ts` sets no
bundle budget. **Done when:** the warning is resolved by real splitting (not by raising the
warning threshold), with a measured before/after, and `src/__tests__/routeProtection.test.tsx`
plus the EMPTY-environment suites still pass against lazily mounted views.
- **Status (2026-09-17, M11 `3eed4f190b6538ad62bf35d7b0c9fa5afc310acc`, gate `24998d8330a95510cd969c872edb28ddcc59ef16`):** closed exactly on its
  own Done-when contract. The split is real — every routed view except first-paint Login/Dashboard
  lazy-loads in two workspace groups (`academicViews`,`operationsViews`), the React family rides a
  hashed **vendor** chunk — and `chunkSizeWarningLimit` was **not** raised (its assignment is itself
  a test failure in `src/__tests__/bundleBudget.test.ts`). Measured before/after per **D9**: entry
  JS gzip 273 791 → **108 207 B**, vendor 60 108 B, total JS+CSS+HTML gzip **298 249 B**, largest
  chunk 108 207 B, `dist/` raw 1 964 789 B; the warning no longer fires. `routeProtection` and the
  EMPTY-environment suites pass against the lazily mounted views, full suite 2 020 passed / 7
  failed (the seven known environmental `projectState` checkpoint-object failures — set identical
  to M10's recorded baseline). **Recorded residual:** first-paint is fast but the first visit to a
  non-eager view pays its workspace chunk's fetch (~50/~46 kB gz) — jsdom-verified, never
  browser-measured; first-view navigation timing belongs in L4's checklist if external QA ever runs
  (PROJECT_STATE.md §7 item 23).

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

### I9. Latent crashes in the design system on empty series — ✅ CLOSED (2026-09-16, by M9 at `8d34eb3d1cd639cffc794596250c897b5ed4b6b3`)
`Sparkline` (`src/components/ds/primitives.tsx:184`) computes `Math.min(...data)` /
`Math.max(...data)`, which on `data={[]}` yield `Infinity` / `-Infinity` and degenerate
coordinates; `BusinessIntelligence` (`src/components/panels/BusinessIntelligence.tsx:63`) reads
`revenueSeries[n - 1].value` and `[n - 2].value`, which throws on an empty series. Unreachable
today because every caller passes a static fixture from src/data/academy.ts (the design-time fixture module, dissolved at M10) — it becomes
reachable the moment H4 lands. **Done when:** both guard empty input and render `NO_DATA`
(`src/lib/format.ts`), with a test that passes `[]`.
- **Status (2026-09-16, M9 `8d34eb3d1cd639cffc794596250c897b5ed4b6b3`):** closed, and closed **first** —
  I9 landed before the live data that would have reached it, exactly as the milestone's spec required.
  `Sparkline` now takes `readonly number[] | null` (null meaning "no stored history", a different fact
  from "the value is zero") and guards in both its render and its geometry `useMemo`, so `Math.min(...[])`
  is unreachable; its bars branch reads the guarded array rather than the parameter; `Delta` takes
  `number | null` for the same reason (a change against a zero previous period is not «۰٪»); and each
  chart in `BusinessIntelligence` guards its own empty model before any index — the `revenueSeries[n - 1]`
  read the item recorded no longer exists anywhere. Both paths render the product's established
  `NO_DATA` glyph; no new empty-state vocabulary was introduced. Pinned by
  `src/components/ds/__tests__/seriesGuards.test.tsx` (**7 cases** — line and bars, `[]` and `null`, plus
  the signals row over an empty record set) and `panelsEmpty.test.tsx`; removing the guard was measured
  to fail 5 of them with the original `Cannot read properties of undefined (reading 'x')`, and the guard
  was restored byte-identically. **DECISIONS.md §14's latent-risk sentence is annotated accordingly.**

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

### I12. Attendance's «ثبت نهایی» toast reports a local state change as a demo recording — ✅ CLOSED (2026-09-14, by M5)
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
- **Status (2026-09-14): ✅ CLOSED by M5 at `9505ade4011b37a34e3488fd51206512829205ec`, and the
  closure is clause by clause against the definition above rather than a restatement of it.**
  - *"M5 wires the view to `src/domains/attendance`"* — done: `useSessionAttendance`,
    `useAttendanceRecords` (twice) and `useAttendanceCorrections` from
    `src/domains/attendance/useAttendance.ts`, plus `getAttendanceRepository()` for the writes
    (`src/views/Attendance.tsx:208`, `:215`, `:217`, `:219`, `:241`).
  - *"this toast becomes the result of an awaited `record`/`bulkRecord` with an honest failure path"*
    — done: `record` at `:304` and `bulkRecord` at `:349` are both `await`ed, and success is announced
    only after the promise resolves, naming only what happened (`… ثبت شد` for one mark,
    «{faNum(n)} حضور ثبت شد» for a bulk save). A refusal reaches the operator in `danger` with
    `apiErrorFromThrown(cause).message`, so `ATTENDANCE_DUPLICATE`, `ATTENDANCE_RECORDER_REQUIRED` and
    the rest are the repository's own sentences. Nothing is mutated optimistically, so a refusal leaves
    the register exactly as it was. **The retracted claim «همه حاضر ثبت شدند» — H2's site 3 — no longer
    exists and is pinned as a forbidden string** by
    `src/views/__tests__/attendanceNoFixtures.test.ts` ("renders none of the retired narratives"); the
    bulk control is labelled with the count it will write, «همه حاضر (N)», and is **withdrawn** rather
    than disabled when there is nothing to write.
  - *"`recordedBy` must come from the authenticated user rather than a fixture name"* — done: the
    hardcoded «آرمان احمدی» attribution is gone and `recorderId = user?.id` (`:174`) is what every
    write is attributed to, asserted by `attendanceNoFixtures` ("attributes every write to the
    authenticated principal", "hands the correction dialog no provenance of its own") and by
    `attendanceWrites` ("attributes the mark to whoever is signed in", "performs no write when nobody
    is signed in").
  - *"the demo wording must come from `useIsDemoEnvironment()` **if any environment-dependent wording
    survives at all**"* — the conditional resolved to **no**: the word «دمو» appears nowhere in
    `src/views/Attendance.tsx`, `src/views/attendance/RegisterPanel.tsx` or
    `src/views/attendance/CorrectMarkDialog.tsx`, and neither file imports `useIsDemoEnvironment`,
    because the writes are real in both modes and the honest `info` sentence the old toast carried —
    «ثبت دائمی و اطلاع‌رسانی به مدرس به سرور نیاز دارد» — was split rather than kept: its persistence
    half is now a real awaited write, and its notification half is stated where it belongs, with the
    register panel and the correction dialog each saying out loud that no teacher, student or guardian
    is notified (**D1**, **I7**). **This is a deviation from the spec's Tests clause, which asked that
    the sentence be preserved literally, and it is recorded as a deviation rather than presented as
    compliance** — see [PHASES.md](PHASES.md) → "Product phase — M5" → "What completion does NOT
    claim", and **L6** below for the two stale claims left in the view's own header comment.
  - **What closure does not mean:** no notification is sent, there is no un-record, no edit and no
    delete of a mark or of a correction, and **browser QA is NOT VERIFIED**.

### I13. A list hook publishes the previous query's rows, with no loading marker, when its params change (found 2026-09-12 while triaging I11)
- **Status (2026-09-13): IN PROGRESS — Checkpoints 1 (A′), 2, 3A and 3B implemented and validated;
  the rest of Checkpoint 3 (**three** hand-rolled readers) not authorized and not started; I14
  untouched and explicitly deferred. The item is NOT closed and must not be reported as fixed — not all
  of its readers are fixed.** **Checkpoint 3B — the scheduling derived read — landed as
  `fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`**, one of the two pre-M4 remediation commits the owner
  authorized after M3's acceptance audit: `useDerivedRead`
  (`src/domains/scheduling/useScheduling.ts:115`), the single boundary behind `useSessionRoster`,
  `useGenerationPreview` and `useConflictCheck`, now carries its query key in state and derives what it
  exposes at render, exactly as Checkpoints 1 and 3A did at theirs — a new key reports in flight with no
  value and no error, a same-key refetch keeps the value it already has, and a query nobody issued is
  reported as *not* in flight. The public `DerivedState<T>` shape, the ticket guard, the AbortController
  and the "cancelled is not a failure" rule are unchanged, and no scheduling domain contract, repository
  behaviour or view was touched. Its evidence is the same discipline as 3A's: a **new** suite in a
  **new** file (`src/domains/scheduling/__tests__/useDerivedRead.test.tsx`, 9 cases) that records every
  committed frame from inside the render body, and a **reversion check** — with the pre-fix hook
  restored from HEAD, 4 of the 9 fail on *identity* (a frame asked for `ses_b` exposed `ses_a`'s roster,
  plan and report with `loading === false`; session A's error exposed as B's; the last session's data
  still on screen when nobody is selected), while the 5 cases pinning the pre-existing
  ticket/abort/refetch contract pass either way. Group A stayed untouched and green
  (`useScheduling.test.tsx` 14/14 among 211). **The 6 consecutive full-suite runs at 105 files /
  1435 tests / 0 failed / 0 skipped were measured on the tree after the second remediation commit
  (`7e72887761f07f48e115160611a9785bfaae9060`), which contains both**, not on `fba826f` alone —
  recorded that way rather than claimed per-commit. Repeated runs are evidence, not a proof of
  determinism. **M3 landed (`e5b0a57d8f33dc04838670a2cd4158a88dd34022`) and is now COMPLETE — `3bec881` closed the
  acceptance audit's one product finding — as Checkpoint 2's first real caller, and it did not weaken
  the caveat, it pinned it:** the assignment surface takes its level from a rendered
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
  **This item is nevertheless still open.** The **rest of Checkpoint 3** (three
  hand-rolled readers — `useStudentList`, `useStudentProgress`, `useSessionAttendance`) is **not
  authorized and not started**; the two further exposures below
  (`useLibraryFile`, `useMediaObjectUrl`) are **not fixed**; and **I14 is not implemented** and
  remains a separate item, **explicitly deferred** rather than closed. What Checkpoints 1, 2, 3A and 3B
  together removed is the read-side window in every `useResourceList` list, the write-side
  consequence for the learning ladder, and the read-side window in the two hand-rolled readers that
  matter next — learning's `useDerived` (3A, a real consumer today) and scheduling's `useDerivedRead`
  (3B, whose three consumers M4 makes reachable) — not the whole finding. **Post-M4 (2026-09-14):** M4
  has landed and made **two of those three** reachable in shipped UI — `useConflictCheck` in
  `src/views/scheduling/SessionWriteDialogs.tsx` and `useGenerationPreview` in
  `src/views/scheduling/GenerateSessionsDialog.tsx` — so 3B's fix is now live on a real path rather
  than only on a test one. `useSessionRoster` is still unconsumed and stays M5's. **This item is
  unchanged in substance and still OPEN.**
  **Post-M5 (2026-09-14, measured at `9505ade4011b37a34e3488fd51206512829205ec`): M5 has landed, and
  it made one of the three remaining readers reachable in shipped UI *without fixing it*.**
  `useSessionAttendance` (`src/domains/attendance/useAttendance.ts:80`) now backs the register in
  `src/views/Attendance.tsx:241`, still carries no query key, and still has the doc comment that
  claims a guarantee it does not deliver. M5's authorization froze every file under `src/domains/`,
  so the hook could not be changed; what the view does instead is **guard the exposure at its own
  boundary**: it compares the register it holds against the session it selected
  (`attendance.sessionId === selectedSessionId`, `src/views/Attendance.tsx:250`) and withholds the
  register — rendering an in-flight state — while they disagree, so a crossed frame can neither be
  rendered nor written against. Two tests keep that mitigation honest rather than letting it read as a
  fix: `src/views/__tests__/attendanceNoFixtures.test.ts` carries a case named "keeps the upstream
  defect visible rather than claiming a fix" (plus "compares the register's session with the one
  selected" and "withholds a register that answers for another session"), and
  `src/views/__tests__/attendanceWrites.test.tsx` asserts "does not render a register that answers for
  another session". Removing the guard is **mutation-checked**: it fails 2 of the 53 cases across the
  two files. **That is a mitigation in one consumer, not a closure — this item stays OPEN, and the
  hook is now the one unfixed reader that shipped UI depends on.** `useSessionRoster`, meanwhile, was
  **not** consumed by M5 after all: the attendance view reads the attendance domain's own derived
  register, so the roster a session really has is rendered from attendance and that scheduling verb
  **now belongs to no milestone**. `useStudentProgress` still has no consumer (M6/M7). **This item is
  unchanged in substance and still OPEN.**
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
  - **Checkpoint 3: five hand-rolled readers with the same shape — TWO are now fixed (`useDerived` as
    Checkpoint 3A, scheduling's `useDerivedRead` as Checkpoint 3B), the other three are not authorized
    and not started.** The five were
    `useStudentList` (`src/domains/students/useStudents.ts:25`), `useDerived`
    (`src/domains/learning/useLearning.ts`, which backs placement and eligible content, both
    student-scoped), `useStudentProgress` (`src/domains/progress/useProgress.ts:62`), `useDerivedRead`
    (`src/domains/scheduling/useScheduling.ts:115` — the `:66` this line first quoted was its pre-fix
    location), `useSessionAttendance`
    (`src/domains/attendance/useAttendance.ts:80` — the `:69` this line first quoted was its location
    before **C2** made `per_page` a compile-time requirement and the file grew). Three carried doc
    comments claiming a guarantee
    they did not deliver — "cannot paint the previous session's register", "cannot paint the previous
    student's data": the ticket guard they cite discards a late *response*, it cannot retract an
    already-committed *state*. **`useDerived` was the one with a real consumer**, and it is fixed —
    see "Done when — Checkpoint 3A" below; **`useDerivedRead` was the one whose three consumers M4 is
    about to create**, and it is fixed as **Checkpoint 3B** (`fba826f`, see the status bullet above) —
    hardened *before* the view exists rather than after, which is the order Checkpoint 1 established.
    *(The view now exists: M4's CP1–CP3 wired it, so two of those three consumers are shipped and one —
    `useSessionRoster` — is still M5's. **Correction, 2026-09-14:** M5 landed and did **not** consume
    `useSessionRoster`; it reads the attendance domain's own derived register instead, so that verb now
    belongs to no milestone.)*
    `useSessionAttendance`'s comment still claims the guarantee it does not deliver, and that is M5's
    exposure to face, not M4's. **It faced it by guarding, not by fixing:** the reader is now reachable
    in shipped UI, the hook is unchanged, and the view compares the register's session against the
    selected one and withholds a mismatch (see the Post-M5 paragraph above). The comment's false
    guarantee therefore now sits behind a real consumer, which raises this reader's priority within the
    item even though nothing about the hook changed. **An honest reachability correction, found while
    investigating 3A:** the stale frame was *not* observable through the app's own navigation today,
    because `src/App.tsx` keys the view subtree on `detailId`
    (`key={\`${view}-${filter ?? ""}-${detailId ?? ""}\`}`), so switching students remounts
    `StudentLearningPanel` and discards the hook's state. That is an accident of an ancestor's React
    key, not a property of the hook: any consumer that switched students *in place* — a dialog with a
    student picker, a "next student" control, or M3's assignment surface reading a student-scoped
    derived read — would have inherited the exposure immediately, and a hook's correctness should not
    depend on a wrapper key three levels up. The defect was reproduced deterministically at the
    boundary rather than claimed from the shipped path. **The same reasoning is what made 3B
    necessary:** a scheduling view selects sessions *in place* (a drawer over one list, no remounting
    key), so `useSessionRoster`, `useGenerationPreview` and `useConflictCheck` become reachable in
    shipped UI at **M4** — not at M6/M7 as this paragraph previously stated, and M4 has since landed
    and made two of them reachable (`useGenerationPreview`, `useConflictCheck`), leaving
    `useSessionRoster` unconsumed. Reachability of the
    remaining three:
    `useSessionAttendance` has **no view consumer** (tests only) and becomes reachable at **M5**;
    `useStudentProgress` has none and becomes reachable at **M6/M7**; every `useStudentList` call site
    passes constant params, so it is structurally defective but unreachable. **None of the three was
    modified.** *(Updated 2026-09-14, after M5: `useSessionAttendance` **is** reachable now and still
    unmodified, guarded at the view boundary rather than fixed. `useStudentList` gained a **fourth**
    call site in `src/views/Attendance.tsx:211`, alongside `EnrollmentDialog.tsx:36`,
    `Students.tsx:558` and the hook's own definition — and like the others it passes a **constant**
    params object (`{ per_page: SUPPORT_PER_PAGE }`), so the reader remains structurally defective and
    unreachable. Note for whoever fixes this next: `useStudentList` is **not** among the hooks
    `src/__tests__/architectureBoundaries.test.ts` polices in `PAGE_SIZE_CALLERS`, and it is not
    `Paged<>`, so neither a gate nor the compiler enforces a page size on it — see **I16**. None of the
    three was modified by M5 either.)*
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
- **Done when — Checkpoint 3B (MET, and validated):** `useDerivedRead` — the single boundary behind
  `useSessionRoster`, `useGenerationPreview` and `useConflictCheck`
  (`src/domains/scheduling/useScheduling.ts:115`) — exposes only the value belonging to the query it
  was asked about: a session switch pairs no committed frame with the previous session's roster, plan
  or conflict report, the previous query's error is never exposed as the next one's, and nothing is
  exposed at all when no session is selected. **Reproduced before being fixed:** the dedicated suite
  (`src/domains/scheduling/__tests__/useDerivedRead.test.tsx`, 9 tests, a **new** file — no protected
  suite touched) was written against the *unmodified* hook and 4 of the 9 fail deterministically on
  identity, per committed frame and never by waiting on `loading`; the other 5 pin the behaviour the
  fix had to *keep* (ticket guard, abort, "cancelled is not a failure", same-key refetch, `reload()`).
  The mechanism is Checkpoint 1's, at this boundary: state carries the key it answers and what is
  exposed is derived at render. `DerivedState<T>`'s public shape is unchanged, so **no consumer moved**
  and the scheduling domain contract, repository, generation, conflict engine and date bridge were not
  touched. **Reversion-checked:** restoring the pre-fix hook fails the same 4 and no others, and the
  fix was then restored byte-identically. Group A stayed green and unweakened (211 tests across its six
  files). Measured on the tree that also carries the second remediation commit: **6 consecutive full
  `npm test` runs — 105 files / 1435 passed / 0 failed / 0 skipped each** (`dist/` built so the CSP
  gates ran instead of skipping), build clean, `tsc --noEmit` clean, `git diff --check` clean.
  **This does not close I13:** three hand-rolled readers and the two further exposures below remain,
  and I14 is untouched.

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

### I15. Fourteen list consumers discard `error`, so a failed read is rendered as an empty one (found 2026-09-13 during M3's acceptance audit)
- **What:** `useResourceList` exposes `error` beside `items`
  (`src/domains/shared/useResource.ts:55`) and **keeps the previous page when a refetch fails**
  (`src/domains/shared/useResource.ts:113`). A consumer that destructures only `items` — or `items`
  and `loading` — therefore cannot distinguish "the read found nothing" from "the read failed", and
  renders its empty copy, or an empty picker, instead of the failure. This is the *error* half of the
  same family **I13** fixed for `loading`; I13's Checkpoint 1 does not cover it, and no gate does.
- **Found where:** M3's assignment surface discarded the catalogue read's error and answered
  «منبعی برای اتصال باقی نمانده» — a false empty of exactly the shape I13 Checkpoint 1 removed from
  six consumers, in a new place. **That one is fixed**, at `3bec881`, with a regression case and a
  reversion check in `src/domains/learning/__tests__/LevelContentPanel.test.tsx`. **Fourteen remain**,
  none of them touched by that pass, because fixing one of fifteen inside M3 would have been the
  unrelated cleanup the milestone forbids:
  `src/domains/learning/LearningPanel.tsx:84` (instruments) and `:104` (levels — a failed levels read
  renders «این دوره هنوز سطحی ندارد» for a program that has twelve),
  `src/domains/learning/StudentLearningPanel.tsx:28`, `:36` and `:205`,
  `src/domains/classes/ClassFormDialog.tsx:104` and `:105`,
  `src/domains/enrollments/EnrollmentDialog.tsx:35`,
  `src/domains/gallery/GalleryPanel.tsx:68`,
  `src/domains/progress/AssignPieceDialog.tsx:77`,
  `src/domains/progress/PieceFormDialog.tsx:75`,
  `src/domains/progress/StudentProgressPanel.tsx:78`,
  `src/domains/students/StudentFormDialog.tsx:109` and
  `src/views/Messages.tsx:105`.
- **Why it survived:** the primary read of nearly every view *does* take `error`
  (`src/domains/gallery/GalleryPanel.tsx:57`, `src/domains/rooms/RoomsPanel.tsx:25`,
  `src/views/Classes.tsx:268`, `src/views/Teachers.tsx:348`), so the pattern reads as deliberate —
  and in the demo environment it nearly is: these are secondary and picker reads over repositories
  whose demo implementations have no throw path for valid params. The exposure becomes real the day
  any of these domains resolves to an API that can fail.
- **Smallest owning boundary:** each consumer, one destructure and one branch at a time — or a shared
  "picker unavailable" affordance in `src/components/ds/patterns.tsx` so fourteen sites do not invent
  fourteen wordings. **Not** `useResourceList`: the hook is already honest, and I13's remaining
  readers are a separate, unauthorized item.
- **Done when:** no consumer renders an empty state or an empty picker for a read that failed, pinned
  by a gate of the same shape as `src/domains/shared/__tests__/staleQueryGates.test.tsx`.
- **Status:** recorded 2026-09-13, **not authorized, not started**. M3 fixed its own instance and
  stopped there, on purpose.

### I16. Lists that mean "everything" stop at `per_page: 200`, and counts report `items.length` instead of `total` (found 2026-09-13 during M3's acceptance audit)
- **What:** the house convention for "load the whole list" is `{ per_page: 200 }` with no pagination
  UI. `paginate` applies **no upper clamp** (`src/domains/shared/demoCollection.ts:23` computes
  `Math.max(1, Math.trunc(...))`), so 200 is honoured and the 201st record is silently absent from
  the list, from any picker built on it, and from any heading count derived from `items.length`
  rather than `Page.meta.total` (`src/domains/shared/useResource.ts:53`).
- **Where:** M3's assignment surface reads both of its lists this way
  (`src/domains/learning/LevelContentPanel.tsx:77` and `:89`) and counts `linked.length` in its
  heading (`:178`). The convention predates it: `src/domains/learning/LearningPanel.tsx:90` and
  `:105`, and roughly twenty sites across the views and dialogs.
- **Why it is not urgent today:** learning resolves to the demo repository in **both** modes
  (`src/domains/registry.ts:143`), and the demo catalogue is derived from **12** seeded library
  resources (src/data/records.ts (the design-time fixture module, dissolved at M10) → `src/domains/demo/learningSeed.ts:137`), so the ceiling is
  about sixteen times the data that can exist. It becomes real truncation the day a learning API can
  hold more than 200 active items — with no message, which is the part that matters.
- **Smallest owning boundary:** either paginate these lists (a pager does not exist in
  `src/components/ds/patterns.tsx`), or derive counts from `total` and state the truncation when
  `items.length < total`. The second is a few lines per site and is honest; the first is a
  design-system feature.
- **Done when:** a list that means "everything" either pages or says it truncated, and every count a
  user reads comes from `total`.
- **Status:** recorded 2026-09-13, **deferred, not authorized, not started — and still OPEN after
  M4's *and* M5's mitigations below.** Distinct from **I14**
  (`per_page: 0` meaning "load nothing"), which is untouched and still deferred.
- **What C2 changed (2026-09-13, `7e72887761f07f48e115160611a9785bfaae9060`).** Omitting `per_page`
  is now a **compile error** for two hooks, because their params are `Paged<…>`
  (`src/domains/shared/useResource.ts:48`): `useSessions`
  (`src/domains/scheduling/useScheduling.ts:49`) and `useAttendanceRecords`
  (`src/domains/attendance/useAttendance.ts:36`). Two cases in
  `src/__tests__/architectureBoundaries.test.ts` pin those signatures and reject an inline params
  object without `per_page`, both mutation-checked. **That is a guarantee about *stating* a ceiling,
  not about the ceiling being high enough** — this item is unchanged in substance.
  `useClasses`, `useRooms` and `useTeachers` are **not** `Paged<>`, so M4's supporting reads (chips,
  pickers) must pass `per_page` explicitly — which they do (`src/views/Scheduling.tsx:117`), and which
  CP1 additionally gated: those three hooks are now in `PAGE_SIZE_CALLERS` inside
  `src/__tests__/architectureBoundaries.test.ts`, so an omission in them is caught by a gate as well as
  by review. They are still not `Paged<>`, so the compiler still cannot help.
- **M4's mitigation — required before the milestone, IMPLEMENTED by it, and still not a closure of this
  item (measured at `df701488362cb90cf32ccefad277879477571cf7`).** A calendar is the surface
  where a silent ceiling is most dangerous, so the scheduling view was required to: bound every session
  read with an explicit `from`/`to` window (never an unbounded "everything" read); state `per_page`
  explicitly, sized above the window's plausible maximum rather than above today's data; consume
  `Page.meta.total`, which `paginate` sets from the **filtered** row count
  (`src/domains/shared/demoCollection.ts:27`) and `useResourceList` exposes
  (`src/domains/shared/useResource.ts:53`); and surface truncation explicitly whenever
  `items.length < total` instead of rendering a calendar that looks complete. **Each clause is now
  met, with the evidence:** the window is derived from the mode the operator chose
  (`src/views/Scheduling.tsx:311`) and every read states its ceiling (`:116` for sessions, `:117` for
  the classes/rooms/teachers supporting reads); `total` drives the counts rather than `items.length`
  (`:458` defines `truncated`, `:485` and `:491` report `total`); truncation is announced in its own
  words — «این بازه N جلسه دارد؛ M جلسه نمایش داده شده است. تقویم کامل نیست» (`:563`) — and while that
  notice stands the **per-day counts are withheld** (`:711`), because a per-day breakdown of a partial
  page would be a partial answer dressed as a complete one. The three clauses are asserted by
  `src/views/__tests__/Scheduling.test.tsx` (a truncated page keeps its notice and loses its day
  counts; a complete window gets them back) and by `src/views/__tests__/schedulingStaleWindow.test.tsx`
  (each window is read once, with its own bounds) — **asserted by those suites rather than
  mutation-checked**, because no mutation or reversion check was recorded for any of M4's checkpoints. **No pager is introduced
  and no global pagination redesign is performed** — the roughly twenty other sites, and the
  `items.length`-based counts elsewhere, stay exactly as they are. Scale for the window arithmetic,
  derived from the seed's own inputs (`src/domains/demo/schedulingSeed.ts` over the ten `classes` rows
  and their `days`, in the fixed ±28-day window `2026-08-04 → 2026-09-29`): **137** sessions in the
  whole seeded window, at most **16** in any 7-day window and **9** on the busiest date — against
  `DEFAULT_PER_PAGE = 25`, so a week view at the default would already be one busy week away from
  truncating. Group A's own whole-window read uses `per_page: 500`
  (`src/domains/scheduling/__tests__/registry.test.ts:190`).

- **M5's mitigation — the same four clauses, at the attendance register, IMPLEMENTED and still not a
  closure of this item (measured at `9505ade4011b37a34e3488fd51206512829205ec`).** A register is the
  second surface where a silent ceiling is dangerous, because a truncated page of students looks
  exactly like a complete one to a teacher about to save it. So the wired view: bounds its session read
  with an explicit `from`/`to` window derived from the mode the operator chose
  (`src/views/Attendance.tsx:201`, read at `:208`) and bounds both record reads by that same window
  (`:215`, `:217`); states `per_page` explicitly on **all seven** of its bounded reads, sized above
  the window's plausible maximum rather than above today's data — `SESSIONS_PER_PAGE`,
  `SUPPORT_PER_PAGE` (classes, teachers and students) and `RECORDS_PER_PAGE` at **200**, and
  `CORRECTIONS_PER_PAGE` at **50** for the one list that grows without bound (`:112`); consumes
  `Page.meta.total` for every count rather than `items.length` (`:415`, `:432`, `:436`); and announces
  truncation in its own words whenever `items.length < total` (`:496` sessions, `:649` absences, `:727`
  records, `:779` corrections). **Asserted by** `src/views/__tests__/attendanceNoFixtures.test.ts`
  ("states a page size on every bounded read", "bounds the record reads by the window it is showing")
  and `src/views/__tests__/attendanceWrites.test.tsx` ("says when the window holds more sessions than
  the page it got") — asserted rather than mutation-checked, because no mutation of a page size was
  performed. **What this does not change:** no pager is introduced, the roughly twenty other sites are
  untouched, and `items.length`-based counts elsewhere stay as they are. **One honest gap this view
  adds, recorded rather than left implied:** its fourth `useStudentList` call site (`:211`) is policed
  by neither the compiler (the hook is not `Paged<>`) nor `PAGE_SIZE_CALLERS` (the list holds
  `useSessions`, `useAttendanceRecords`, `useAttendanceCorrections`, `useLibraryList`, `useClasses`,
  `useRooms` and `useTeachers` — not `useStudentList`), so that ceiling is held by review and by
  `attendanceNoFixtures` alone. With more than 200 students a roster row would resolve no name; the
  view renders `NO_DATA` in that case rather than inventing one, but the ceiling is real and this item
  is where it belongs.

### I17. Level-content link order is written and honoured for students but invisible to the operator (found 2026-09-13 during M3's acceptance audit)
- **What:** `attachContent` appends with `sortOrder: siblings.length`
  (`src/domains/learning/demoRepository.ts:269`) and the student-facing eligibility list sorts by it
  (`src/domains/learning/eligibility.ts:104`: level order, then `sortOrder`, then title). The
  assignment surface shows rows in `listContent` order — the content collection's order — because
  `listContent` resolves the link table into a filter and does not sort by it
  (`src/domains/learning/demoRepository.ts:182`), and `listLinks` does not sort either (`:235`). So
  the order an operator sees while assigning is **not** the order a student sees, and nothing in any
  UI can change it.
- **Why M3 did not address it:** the milestone's spec names link ordering as part of the contract it
  writes through, but requires no ordering UI, and reordering would have meant either a domain change
  (prohibited: "no new field, no model change, no edit to the learning domain") or a client-side sort
  that becomes a second source of truth.
- **Done when:** one read owns the order the product means, the assignment surface shows that order,
  and an operator can change it — or the product decides order is derived and says so.
- **Status:** recorded 2026-09-13, **not authorized, not started**.

---

### I22. `ImportExportCenter`'s export half never renders — the permission guard is handed a holder that cannot carry permissions (found 2026-09-25 during the S5-A tone audit)

- **What:** `src/domains/import/ImportExportCenter.tsx:61` filters the exportable entities with
  `can(user as any, perm)`, and `src/domains/import/ImportExportCenter.tsx:143` re-checks the same
  holder before running an export. `user` is `useAuth().user`, which is `session.user`
  (`src/domains/auth/AuthContext.tsx:147`), while `can()` reads `holder.permissions`
  (`src/domains/auth/permissions.ts:235`) — and a session carries its permission set on the
  session/context (`src/domains/auth/AuthContext.tsx:139`), not on the user record. The guard
  therefore answers *false* for every entity and every role, `allowedEntities` is empty, and
  `src/domains/import/ImportExportCenter.tsx:170` renders **«برای هیچ موجودیتی مجوز خروجی ندارید.»**
  instead of the export controls.
- **Evidence:** verified in jsdom (2026-09-25) as the seeded administrator, `admin@demo.local`,
  whose context carries 23 permissions: the export section («دانلود خروجی», entity and format
  selects) is absent, while the import half of the same panel renders normally. The export half of
  this Settings data surface is unreachable for every role, including the administrator — so the
  truncation disclosure S5-A repaired can never be seen there. The sibling control shows the correct
  holder: `src/domains/export/EntityExportButton.tsx:53` uses `can(auth, required)` (the context
  value), which is why the per-list export button works.
- **Record correction:** `docs/engineering/F4_REPORT.md:45` records this guard as implemented
  ("ImportExportCenter filters allowedEntities by can()"). The filter does run, but against a holder
  that cannot hold permissions, so that record overstates what landed.
- **Done when:** the surface filters through the same holder its sibling control uses, a regression
  test renders the panel as a permitted role and reaches «دانلود خروجی» end to end, and a role with
  no export permission still sees the honest empty state. The fix must land **separately from S5-A**:
  a product behaviour change must not ride on a type-fix commit.
- **Status:** recorded 2026-09-25, **not authorized, not started**.

---

## LOWER PRIORITY / HYGIENE

- **I19. A scheduling write test is date-dependent, and it fails on the weekdays its own fixture assigns to `cl2`.** `src/views/__tests__/schedulingWrites.test.tsx` → *"a real reschedule resolving a real conflict"* asserts that, after the move, the class that owned the contested slot holds **exactly one** scheduled session on `TODAY`, where `TODAY = isoOf(academyNow())` follows the **real calendar date** (`src/domains/shared/clock.ts` freezes only the time of day, 10:47). The demo seed is anchored to the **fixed** `SEED_DATE = 2026-09-01` window (`src/domains/demo/schedulingSeed.ts`), and the fixture gives `cl2` `days: [3]` — **Tuesday**. On 2026-09-15 (a Tuesday) the seeded `ses_cl2_20260915_1400` row fell inside the same-day filter beside the test's own replacement row, so the case failed with `expected [ 'ses_m_…' ] to deeply equal [ 'ses_m_…', 'ses_cl2_20260915_1400' ]`. **It is environmental, not a regression:** it was measured failing on the **pre-CP4 tree** (pre-CP4 files restored, sha256-verified, re-run) as well as on the M7 tip, and no M7 commit touches this file, the scheduling domain, the seed, the store or the clock. It did not appear in M6's recorded run because that run happened on Monday 2026-09-14. **Nothing was weakened to hide it** — no skip, no retry, no re-timed assertion, no edit to the test — and **it is not M7's to fix**: it sits in the protected scheduling area, and the honest fix is either a target day the fixture cannot collide with or a filter that excludes seeded rows, both of which are semantic test changes that need authorization. Recorded in [PROJECT_STATE.md](PROJECT_STATE.md) §7 item 18 and §4 → "M7 validation".

- **L1. Command-palette natural-language matching is substring-loose** (`q.includes(keyword)`),
  so it can return unrelated commands. Improve tokenisation/scoring; keep the palette's
  repository-backed result honesty (it already reports «چیزی پیدا نشد» rather than inventing rows).
- **L2. Dead code:** `TeacherNote` is declared at `src/domains/teachers/types.ts:14` — the type was
  **relocated** there at M10 (a type-only move from records.ts:31 — the design-time fixture module,
  dissolved at M10) — and still never used anywhere: the relocation did not create a consumer, so the
  item stays open with its new owner path. Delete it or land the feature that needs it.
- **L3. Domain README stubs contradict the code — ✅ both retired (2026-09-14).** `src/domains/scheduling/README.md`
  said "Planned domain — **not implemented in Phase A**" while the domain was implemented and
  protected, and sketched a contract that does not exist (`POST /sessions/{id}/move`, a version-checked
  `409 SCHEDULE_VERSION_CONFLICT`); it was **rewritten to describe the real domain** in M4's CP0
  documentation reconciliation (`84fb7cb4a4a703d52de78cd701ed21d4d242d7c5`), because M4's implementer
  reads that file before touching the view, and **reconciled again after the milestone landed**, so it
  now describes a *wired* view: which of the eleven verbs shipped UI consumes, which five it does not
  and why, and what the calendar's pagination mitigation is.
  `src/domains/attendance/README.md` **carried the same false stub** — eight lines saying "Planned
  domain — **not implemented in Phase A**" about a domain that was implemented, registered and
  protected by 79 frozen tests — and was deliberately left to M5, because retiring it in CP0 would
  have widened that pass into a second domain's documentation. **M5's documentation reconciliation
  retired it:** the file is rewritten to describe the real domain — its append-only model, the derived
  roster, all eight verbs with the six shipped UI now calls and the two it does not (each with its
  reason), the invariants enforced in the repository rather than in a view, the correction trail, what
  does **not** exist (no update/delete, no notification, no academy-wide analysis, no backend
  aggregation, an unregistered `apiRepository.ts`), the legacy fixtures the wired view replaced, and
  **I13**'s surviving defect with its view-boundary mitigation.
  **Two further falsehoods were found in the scheduling README while reconciling M5, and corrected in
  the same pass:** it said `useSessionRoster` "becomes reachable at M5" — M5 landed and did **not**
  consume it, so that verb now belongs to no milestone — and it described the attendance register as
  still fixture-driven. **Six statements in that file were falsified by M5 in total**, each corrected
  here rather than left to mislead the next reader. What L3 does **not** cover is **L6** below: two
  stale claims inside `src/views/Attendance.tsx`'s own header comment, which a documents-only pass may
  not edit.
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
  **It has now happened twice more, and the second time it destroyed completed work (2026-09-14).**
  During M5's implementation the workspace was recycled between turns: the commit and its branch
  pointer stopped existing as Git objects while the files survived on disk, so the milestone was
  re-implemented from its recorded scope and committed once, cleanly, as
  `9505ade4011b37a34e3488fd51206512829205ec`. Then the **documentation** reconciliation for that
  milestone was measured, edited, validated (full suite green, 52 gates green, three mutation checks
  taken and reverted) and committed locally — and the workspace was recycled **again** before its push
  landed. The clone, and a `git format-patch` backup written *outside* the clone, both disappeared, so
  that commit is unrecoverable and `git log` will never show it. Two lessons, both now written into the
  workflow rather than left as advice: **(1)** a backup outside the repository does not survive
  recycling either, so it is not a mitigation; **(2)** commit and push must happen **in the same
  operation**, never across a turn boundary. The pass recorded in these documents is therefore a
  **replay**: every number was re-measured from scratch on a fresh full clone of the authoritative
  pushed tip rather than copied from the lost record, the mutation checks were taken in a throwaway
  `git worktree` so that no product file in the working tree was ever altered, and the replayed commit
  carries a **different SHA** with no claim of byte-identity to the lost one.
  **Done when:** the platform preserves the local object store across turns, or the workflow no
  longer depends on an unpushed commit. Until then the rule is mechanical: `git commit && git push`
  in one command, then verify with `git ls-remote origin refs/heads/<branch>`.

- **L6. Two claims in the wired attendance view's own header comment are false, and a documents-only
  pass did not fix them** (`src/views/Attendance.tsx:6` and `:12`). The comment says the view used to
  render `todayAttendance` "(nine registers keyed by session ids `g7`–`g15` …)" where
  src/data/records.ts (the design-time fixture module, dissolved at M10) holds **eight** — the keys are `g7`, `g8`, `g9`, `g10`, `g11`, `g13`,
  `g14`, `g15`, and `g12` appears in no register, although
  `src/views/__tests__/attendanceNoFixtures.test.ts:126` forbids all nine ids (a deliberately
  conservative gate, and the reason the mistake is easy to make). It also says "Attendance has had a
  complete domain since M1", where the domain landed in **Phase A**: `git log --oneline --reverse --
  src/domains/attendance` in a full clone starts at `2acca0a` · *feat(architecture): Phase A — API
  client, error model, repository contracts and demo/API boundary*, which is **before** the recorded
  baseline `292b8b86ce7dd328b3a1510047f994e39c443a4e` — verified from Git in this pass, not from
  recollection, and verifiable only because the clone in use was full rather than shallow. Neither
  claim affects behaviour, and both are **L3**'s defect one layer down: prose that outlives the code it
  describes. **Recorded, not fixed** — this reconciliation pass is documents-only, and editing product
  source to tidy a documentation checkpoint would put a code change inside a commit whose own record
  says it made none. **Done when:** whoever next has authority over `src/views/` corrects the two
  sentences, or rewrites the comment from the code rather than from memory.

- **L7. `docs/architecture/demo-data.md` names the dissolved src/data/ directory as the hand-authored
  source of the demo dataset** (its line ~147): a **strict implementation contradiction** discovered at
  M10 closure — the source moved to `src/domains/demo/academySeed.ts` at `e7a64b7`. Editing that file
  is outside the five authorized drift targets of the M10 closure pass (its scope rule is STOP and
  report rather than expand), so it is **recorded here for the next documentation pass with owner
  authorization** instead of being fixed inline.

- **L8. A governance-contract conflict: the scanned documents may quote only HEAD-reachable full
  SHAs, and two preserved unmerged branch tips are recorded by full SHA in `PROJECT_STATE.md:221`.**
  Found 2026-09-25 during the O-1 governance reconciliation run. Both affected commits exist and are
  real: `251af96f…` is the tip of `arena/01a0b059-parsian-music-dashboard-opus` and `94d32de3…` is
  the tip of `handoff/arena-frontend-pre-backend` (full values at `PROJECT_STATE.md:221`, in the row
  that names the historical branches *"preserved — not deleted and not renamed"*). Both branches are
  unmerged, so **neither tip is reachable from `HEAD`** — measured with `git merge-base --is-ancestor`
  against `HEAD` and against `origin/main`, with both objects present in the clone. The gate that
  enforces the no-self-reference rule (`src/__tests__/projectState.test.ts:278`; the rule itself
  is stated at `PROJECT_STATE.md:295–300`) requires every full SHA quoted in these documents to
  **exist as a commit and be reachable from `HEAD`**, so it currently rejects both: the check
  *"no document quotes a commit that does not already exist"* stays red on its second clause.
  Repository governance also explicitly prohibits each candidate resolution — weakening or re-scoping
  the gate (`SESSION_HANDOFF.md:86`, `DECISIONS.md` §16, `PROJECT_STATE.md` §10), deleting or
  shortening the recorded evidence merely to satisfy the test (`PROJECT_STATE.md:1436–1443`:
  *"not … re-recorded or accommodated"*), and merging or rewriting preserved history
  (`PROJECT_STATE.md:221`, `PRE_CLEANUP_HANDOFF.md` §7/§12). **This is therefore an unresolved
  governance-contract conflict, not a product defect; no product causation exists and no automatic
  remediation is authorized.** The owner reviewed it on 2026-09-25 and deferred it under
  **δ — preserve and defer**; the contract-change options were **α** narrow the gate's SHA scope,
  **β** change the representation of the preserved branch tips, **γ** change repository history.
  **Done when:** the owner records one of those decisions and the matching smallest slice is
  authorized. ✅ **DONE 2026-09-25 — the owner chose α together with the durable working-branch
  invariant, and authorized the alignment slice.** The two full SHAs stay recorded; the gate's
  reachability check now carries them as a closed, self-guarding exception (each must still exist
  as a commit and still be registered at `PROJECT_STATE.md:221`), and the branch check no longer
  compares the recorded branch against the per-session checkout — it asserts the recorded branch
  exists on the remote and that the local ref of the same name is level with it. Both decisions
  are recorded in [DECISIONS.md](DECISIONS.md) §21 and were verified by re-running the gate
  afterwards; the two `projectState` reds this item described are gone from the suite's red list,
  and the conflict stays in this file as the record of why the exception exists.

## DOCUMENTATION DRIFT (authoritative docs that contradict the code)

Recorded, **not** fixed — Phase 2 was explicitly scoped to lifecycle documentation only.

| Document | Stale claim |
|---|---|
| `docs/gap-matrix.md` | A "Phase 0 audit" that lists teachers, classes, enrollments, scheduling, attendance, finance, messaging, library, notifications and reports as **NOT IMPLEMENTED**, and uses a different phase numbering from this ledger |
| `docs/architecture/data-layer.md` | "Scheduling itself is **not** implemented here"; "Attendance, Finance, Messages, Library and Reports remain … fixture renderers with no domain layer yet"; migration table says Library is PARTIAL with "no seeded audio" (Phase 1 shipped real library media); and its registry count — "Six domains were added" / "These six resolve to Demo in BOTH modes", which [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) §3 already corrected to ten — is now **eleven** after Class Compensation P1 added `src/domains/registry.ts:231`. **The count sentence only was corrected in place** by this reconciliation (the section now says eleven and names the five additions); the rest of that document's staleness — the claims listed above — is **still recorded here and still unedited**, because they belong to the domain-by-domain migration status, not to the counts |
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
