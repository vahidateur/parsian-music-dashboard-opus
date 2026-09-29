<!--
ARCHIVE COPY — not operational.

- Historical pre-M-1 session handoff (2026-09-18) from
  handoff/arena-frontend-pre-backend @ 94d32de3220cee314606c0c4705e20e0fdcfb2af
- Source path: docs/engineering/SESSION_HANDOFF.md
- Source blob: a150114cd8937ed90a525d85aaf18bcc4d0b0d02 (64858 bytes)
- This file is an archive. It is not the live next-action document.
- Do not treat §9 (M-1…M-6 work order) as current work.
- The Arena AI Auditor is not in this repository and is not reconstructed here.
- Live governance: docs/engineering/GOVERNANCE_CHECKPOINT.md
-->

# SESSION HANDOFF — Arena frontend, pre-backend checkpoint

> **Purpose.** A durable hand-off for the next agent session. This document records the decisions,
> history, current state, the latest read-only product audit, and the exact continuation order, so
> the next session does not need chat history. It changes **no product code**.
>
> **Created:** 2026-09-18 (2026-09-19 in the owner's local timezone) on branch
> `handoff/arena-frontend-pre-backend`, committed as a single-file documentation commit.
> **Read first:** [PROJECT_STATE.md](PROJECT_STATE.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md) · [PHASES.md](PHASES.md) · then this file.
>
> **Standing rule for the next session:** the repository is the source of truth, not this file and
> not a prior conversation. Re-verify `git status`, `git log`, the four governance documents and the
> named source paths **before** implementing anything. Where this document and the code disagree,
> the code wins and this document is wrong.

---

## 1. Current checkpoint

| Fact | Value |
|---|---|
| Product | **Arena** — a Persian (فارسی), RTL, dark-theme management dashboard for a music academy («آموزشگاه موسیقی آوا» in the seed data; the branding seam lets an academy rename itself — see M8) |
| Stack | React 19.2.6 + Vite 7.3.6 + TypeScript 5.9.3 + Tailwind 4.1.17; `vitest` 3 + `@testing-library/react` + `jsdom`; `fflate` for archives; `lucide-react` icons. No router library: the "route" is a validated hash (`src/lib/hashRoute.ts`), no state library, no data library |
| Scripts | `npm test` → `vitest run`, `npm run typecheck` → `tsc --noEmit`, `npm run build` → `vite build`, `npm run gen:access-path` → `scripts/gen-access-path.mjs` |
| Frontend/backend boundary | **There is no backend.** Every domain reads and writes through its own repository seam (`View → domain hook → repository → DemoStore | ApiClient`, DECISIONS §1). `demoRepository.ts` + `apiRepository.ts` exist side by side per domain; the data source is resolved once at the composition root (`src/domains/registry.ts`) from `VITE_DATA_SOURCE` (`src/api/config.ts`, `ConfigGate`). The Laravel backend is the next phase; the frontend's job now is to hand it an honest contract |
| Session branch (this checkout) | `arena/01a0b059-parsian-music-dashboard-opus` |
| Local HEAD | `d31cbe9d83ce327d4c1b14e352f2de1b0a6c16b8` — `docs(m11): close the performance/disclosure/a11y phase and register the M11 checkpoint` — **the canonical M11 closure SHA** |
| **Remote tip of the same branch** | `d6430df272cf6b6b88efd9d68e0387fc353e39c3` — `fix: disclose failed dashboard reads` |
| `main` | `a6469759fea743b9332702bb9a20e69fc4abc1be` — the true merge commit of PR #3 ("Consolidate canonical Arena history (through M11, d31cbe9) into main"). Untouched by this handoff |
| Working tree at handoff time | 8 modified + 2 untracked files (the dashboard-disclosure work + its two test files) — **deliberately left uncommitted and unmodified by this checkpoint**, see §4 |

### Environment discrepancy — read this before trusting any "current state"

The repository this handoff was written in is **not** the owner's Windows checkout, and neither is
identical to the other:

* the sandbox clone sits on `d31cbe9` (M11 closure) and is a **shallow clone** (`.git/shallow`
  present, fetch refspec limited to `main`);
* the owner's checkout — and the remote tip of this very branch — is `d6430df`, **one commit ahead**,
  and `d6430df` is **not reachable from the sandbox clone** (`git cat-file -t d6430df…` → *not a
  valid object name*);
* the sandbox therefore could not be used to verify `d6430df`'s contents locally. The statements
  about `d6430df` below were verified through GitHub's read-only API on 2026-09-18 by comparing blob
  OIDs path by path — the method and the result are recorded in §4.

Consequences: do not describe the sandbox HEAD as "the current state of the product"; do not assume
`d31cbe9` is an ancestor of what the owner is looking at without checking; do not claim a fix landed
because it exists in the sandbox worktree.

### Deliberately excluded from this checkpoint

`docs/engineering/SESSION_HANDOFF.md` is the only file added by this commit. Nothing under `out/`,
no generated artifact, and none of the uncommitted product changes above are included. The **Arena
AI Auditor** (a separate, external, zero-dependency tool — see §5) was never part of this repository
and is not added here.

---

## 2. Product history (from the repository's own records)

Milestones M0–M11 are specified and recorded in [PHASES.md](PHASES.md); the table below is a summary
with the SHAs those records name. **No milestone beyond M11 is specified, so no next milestone
exists yet** — inventing "M12" is out of scope (see §8, §9).

| Milestone | What it was | Key SHAs / state |
|---|---|---|
| **M3** | Learning-content → level assignment UI (**I3**) — the first surface that writes a real relation, with `AttachContentIntent.programId` taken from an independent query and a crossed frame *refused* | `e5b0a57d8f33dc04838670a2cd4158a88dd34022` → `3bec881` (closure of the acceptance audit's one product finding) |
| **M4** | Scheduling **view** wiring (**H1a**): calendar reads through `useSessions` over a bounded `from`/`to`; the first three real scheduling writes — `rescheduleSession`, `cancelSession` (reason required), `generateSessions` behind `useGenerationPreview` | CP0 `84fb7cb` · CP1 `0f875a7` · CP2 `f8c3472` · CP3 `6f54caf` · coverage `df70148` · reconciliation `24caf3a` |
| **M5** | Attendance **view** wiring (**H1b**, and with it the umbrella **H1** and **I12**): the register is derived from active Enrollment at the session's date; `record` / `bulkRecord` / `correct` are awaited repository calls with real failure paths | `9505ade4011b37a34e3488fd51206512829205ec` · reconciliation `9190da0` |
| **M6** | Contracts without UI: chat management verbs, attachments, export coverage | CP1 `43e7882` · CP2 `42c54f4` · CP3 `563b8d8` · CP4 `4e03b87` · `e6ab6f9` · coverage `8131c5c`; accepted with recorded limitations |
| **M7** | Relation de-fixturing + **live sidebar counts** (**I1**): the people/class surfaces read the domains that own the relations, and `navGroups` was stripped of any static count — a live number that the sidebar cannot stand behind was removed rather than faked. The demo-data boundary was protected: `src/lib/navigation.ts:15-21` now documents that "a LIVE count is not part of this data", and `Sidebar.tsx` passes counts read from repositories at render time | I1 recorded ✅ CLOSED (2026-09-15) in `OPEN_ITEMS.md` §I1 |
| **M8** | Academy branding & visual identity (**D2**): the persisted `BrandingSettings` is what the product renders — `applyBranding`/`useApplyBranding` mounted in `src/App.tsx` below the lifecycle gate and above `AuthProvider`, four `--brand-*` properties consumed by the design tokens, and `Sidebar`/`Login` reading `branding.academyName` / `tagline` instead of a fixture. (The academy's own name is data, not a code constant; an academy such as «آموزشگاه موسیقی پارسیان» is expressed through this seam) | `735617d0324a8f4ba2e243846eedf069d389751a` (6 files, 360/26, 15 new cases) · reconciled at `c186baa` |
| **M9** | Live dashboard insights + removal of fabricated measurement (**H4**, **I9**): every figure in the four insight panels and the dashboard derives from the records of the environment being read (`useAcademyMetrics`, the read set in `src/domains/shared/useDashboardInsights.ts`, `src/lib/stats.ts`), guarded for empty series first (I9 before H4, deliberately, so live data could not reach the crash). **Collected-revenue chart removed** — invoices/payments have no repository, so the money slot shows the receivables the *student records* carry rather than inventing a Finance domain | `8d34eb3d1cd639cffc794596250c897b5ed4b6b3` (14 files, 3 025/328, 61 new cases) · built on `c186baa` |
| **M10** | Dissolution of `src/data/records.ts` and `src/data/academy.ts` (**D5**): four categories, one owner each — **A** entity types moved to their domains (`Student`/`StudentNote` in `domains/students/types.ts`, `Teacher`/`TeacherNote` in `domains/teachers/types.ts`, `AcademyClass`, `Resource`, `Conversation`, `InstrumentId`, `ClassSession`/`ClassSessionStatus`); **B** the canonical DEMO seed at `src/domains/demo/academySeed.ts` (data unchanged, consumed only by the demo layer); **C** fabricated UI data **removed** and classified item-by-item in the deferral ledger `src/lib/financeReportsDeferral.ts` (**D6**/**I2**) with tombstones enforced by `src/__tests__/m10Boundary.test.ts`; **D** static vocabulary to named single owners (`lib/navigation.ts`, `lib/viewContracts.ts`, `lib/financeVocabulary.ts`, `domains/scheduling/weekdays.ts`, `views/messages/composerTemplates.ts`, `components/overlays/commands.ts`, `components/ds/samples.ts`). Dashboard identity became live (branding + `useAuth` + `useDayPulse`), and `freeSlotsTuesday` became an honest typed no-data result — **no free-slot search system was built** | `e7a64b7777be36ddd97fc3337898fad794118e5b` (82 files, 2 122/1 942) · built on `98af31b` (D5 finalization, the effective rollback boundary). **Known errata, kept as written:** the session lifecycle rename `Session`→ disambiguation kept every field (§7 item 22); `PROJECT_STATE.md` still carries the M10-era sentence "M11 remains ❌ NOT STARTED" inside a blockquote that then marks itself *Superseded* — that is the M10 state, not the current state |
| **M11** | Performance (**I6**), api-hybrid disclosure (**D8**), accessibility (**D7**), browser-QA checklist (**L4**): every routed view except first-paint Login/Dashboard lazy-loads in two workspace groups (`src/views/lazy/`), the React family rides a hashed vendor chunk, `chunkSizeWarningLimit` deliberately unset (D9), Vazirmatn 300/800 dropped — entry JS gzip 108 207 B (was 273 791 B), total JS+CSS+HTML 298 249 B; the persistent non-dismissable `DemoBackedNotice` derives from the single `DEMO_SERVED_DOMAINS` enumeration and renders in api mode only; fourteen dependency-free a11y gate cases (roles/names, focus-trap entry/loop/escape/return, palette keyboard flow, `prefers-reduced-motion`, RTL/Persian invariants) | CP1 `3eed4f190b6538ad62bf35d7b0c9fa5afc310acc` · CP2 `24998d8330a95510cd969c872edb28ddcc59ef16` · CP3 `53794d57a7375c8345f76adec9248f5da09d7a92` · CP4 `f7eb86762dc11f7d5dd3c7218e7c697fad29488e` · closure record `d31cbe9`; **starting SHA `3ed0bfe`** (the D7/D8/D9 decision record) = effective safe rollback boundary. **Final validation state: everything jsdom-verified; L4 / browser QA recorded `NOT VERIFIED` for M11 and for every milestone before it** (§5 of `PROJECT_STATE.md`) |
| Documentation checkpoints | Thirty-plus pushed documentation-only commits (decision records, reconciliations, the D5/D7/D8/D9 records). They are history, not implementation, and they are immutable | — |

Earlier foundation (for orientation, not for re-litigation): PR #1 built the admin panel (theme
system, command palette, student/finance/report/design-system workspaces); PR #2 (`Phase 1 + Phase 2
+ product-phase specification (M0): real library media, explicit data lifecycle, D1–D9 decision
register`) was **superseded/closed**; PR #3 consolidated the canonical history through M11 into
`main`. Phase 0 audit, Phase 1 (real library media, honest profile messaging, protected regressions)
and Phase 2 (explicit data lifecycle UNINITIALIZED → {EMPTY | DEMO} + empty-state audit) precede the
M-series and are recorded in `PHASES.md`.

---

## 3. Important architectural decisions (authoritative)

These are decisions **already made and recorded**; the next session applies them, it does not
re-open them. Primary sources: [DECISIONS.md](DECISIONS.md) §1–§19 and the Compensation P1 workstream
record in [PHASES.md](PHASES.md).

1. **Demo is a first-class environment, not a fake production backend** (DECISIONS §2). A repository-backed write in demo mode is *real product behaviour*. Do not "fix" demo-backed features by pretending they are broken; the defect class that matters is a **claim** that is not backed by a write.
2. **No fake product data to make a UI look complete.** Fabricated measurements were removed at M9/M10 and are tombstoned by `m10Boundary.test.ts` so they cannot return quietly. "No data" is an explicit typed value — `NO_DATA` — never `NaN`, never a zero, never a consumer-side patch (DECISIONS §14).
3. **No silent fallback for the data source** (§3) and **data source ≠ environment kind** (§4): unknown `VITE_DATA_SOURCE` values block boot at `ConfigGate`; api mode declares demo-served domains through `DemoBackedNotice` (D8) rather than pretending otherwise.
4. **Explicit lifecycle** (§5–§8): `UNINITIALIZED → { EMPTY | DEMO }`, persisted and never inferred, reads never write, and EMPTY must remain usable without breaking the zero-record invariant.
5. **Production means the API/backend — and it does not exist yet** (§9). Frontend work that pre-empts a backend design is out of scope; frontend work that *defines the seam* the backend will implement is in scope.
6. **Domain boundaries** (§10): one owner per entity type; views go through their domain's hooks/repositories, never across a neighbour's store. Enforced by `src/__tests__/architectureBoundaries.test.ts` (which is also where the retired `useAsyncView` fake-loading helper is kept dead).
7. **Finance and Reports are intentionally deferred** (D6/**I2**). Both surfaces render their own deferral and are mechanically prevented from hiding a fixture-backed replacement. `Student.payment` / `Student.balance` are **stored record fields** rendered as such — not a computed ledger. Do not invent an invoice/payment backend in the frontend.
8. **Scheduling: CLASS vs RECURRENCE vs SESSION, sessions are materialized** (§11). `cancelSession` always carries a reason; `rescheduleSession` cancels-and-links (`rescheduledToId` / `rescheduledFromId`) and is **not** a compensation; a hard `delete` is excluded from the UI (M4's E-2 clause) because it would destroy the record that a session ever existed. The five unexposed verbs (`get`, `create`, `update`, `delete`, `sessionRoster`) are decisions, each with its reason in `src/domains/scheduling/README.md` §3.
9. **Attendance and progress are append-only; corrections require a reason** (§12). A correction is an immutable history entry, not an overwrite.
10. **Media: metadata in the dataset, bytes in IndexedDB — never a fabricated URL** (§13). The contract is `MediaAsset` + a `photoMediaId` reference on the entity (`src/domains/media/types.ts`), and the file states plainly that production needs object storage with signed expiring URLs, server-side content-type sniffing and per-object authorization. The demo path is *not* a security boundary.
11. **Honesty rules for UX** (§15): a control whose operation cannot run is removed or says so; an empty list must never be shown where a read failed; a partial read withholds rather than estimates.
12. **Privacy is a product property** (§17): a full national ID is never rendered in list/detail chrome (`src/views/Students.tsx:52` masks it; checksum validation is `src/lib/nationalId.ts`); attendance corrections concern minors, so `docs/security.md` §7 applies.
13. **Boot chain** (§18): nothing renders above a gate it depends on (`ConfigGate` → lifecycle gate → `AuthGate` → shell).
14. **Compensation (settled, do not re-open).** Private one-to-one only. It is an **obligation with lineage and an attempt ledger**, not a booking: the affected student is **frozen at registration** (the roster is derived from the scheduling domain's `sessionRoster` at that moment and never stored), make-up **eligibility is disclosed rather than used as a booking gate**, a **teacher cannot create or approve** a compensation, compensation writes require **`schedule.write`**, cancellation/retry are awaited with disclosure, and **group compensation is out of contract**. `rescheduleSession` is not compensation and must not be conflated with it.
15. **No invented notification/SMS behaviour.** The messaging domain is demo chat through `ChatRepository`; a Telegram/Bale provider needs a server-held bot token and is research item **I7**, not a frontend feature. The `Settings → اعلان‌ها` toggles must not be "wired" into anything that does not exist (§6 M-6).
16. **Backend authorization must ultimately enforce permissions** — the client-side table in `src/domains/auth/permissions.ts` (roles `administrator | manager | teacher | staff | accountant`, `viewPermissions`, `can/canAny/canAll`) is a UX affordance, bypassable by construction. Server enforcement is Laravel's job; the frontend's duty is to not *contradict* it (see §6 M-6 and the per-action gating inconsistency in the appendix).
17. **Free-slot search: not built** (M10). The palette's Tuesday free-class question returns the typed no-data result on purpose.
18. **M11's D7/D8/D9** — dependency-free accessibility strategy (no new a11y library), api-hybrid disclosure (declare, never claim backend health), and measurement-derived bundle budgets (no arbitrary thresholds, `chunkSizeWarningLimit` unset).
19. **No M12 has been defined.** The phase specification names no milestone beyond M11; the next phase is neither started nor authorized. Do not invent one, and do not let the §6 list be re-scoped into an architecture phase — it is pre-freeze product completion.

---

## 4. Current session work (2026-09-18)

Two distinct things happened, and only one of them is landed.

### 4a. Dashboard failure-disclosure work — **landed on the remote tip `d6430df`**

Subject: `fix: disclose failed dashboard reads`. Verified from the sandbox not by reading a chat log
but by comparing blob OIDs path by path against `d6430df`'s tree via GitHub's read-only API: of the
ten changed product paths in the sandbox worktree, **nine are content-identical** to `d6430df`.
What it changed (all still true in `d6430df`):

* **`useAcademyMetrics` failure propagation** — the aggregate read now reports a failed read as an
  error instead of absorbing it into zeros; a partial failure keeps the row-derived counts and marks
  only the rate whose source failed unavailable; an *aborted* read is not reported as a failure.
* **`Hero` NO_DATA behaviour** — `Hero` no longer calls `useAcademyMetrics` itself (a second copy of
  the same read inside one view could disagree with the first: the alert clearing while the tiles
  stayed withheld). The view owns the read set and passes `stats` in; a `null` figure renders
  `NO_DATA`, and the unit suffix goes silent with the value rather than standing alone.
* **`useDashboardInsights` metrics-failure handling** — the read set hands the derivations `null`
  when a read did not answer, so a derivation cannot resurrect a zero from an unanswered query.
* **`dashboardInsights` nullable session model** — `DashboardCounts.sessions: number | null`,
  `InsightInput.metrics: AcademyMetrics | null`, `InsightInput.sessions: readonly Session[] | null`,
  plus one shared sentence for the failure: `export const CALENDAR_UNAVAILABLE = "خواندن تقویم کامل نشد"`
  ("an unread calendar is not a still one"), used at all three sites so an unread calendar cannot
  look like a quiet one. Weekly series, deltas and the «ثبت نشده» claim are reserved for reads that
  actually answered.
* **`AttentionAndFlow` / `Intelligence` / pulse surfaces** — `TodayFlow` accepts
  `summary: FlowSummary | null` and renders an `EmptyState` naming the failed read; the counts lines
  render `NO_DATA` for a `null` session count.
* **Dashboard retry** — the disclosure carries a retry that re-reads the set; when the read answers,
  the alert and the dashes both go away.
* **This is the dashboard's half of audit finding I15** (recorded as **I15-A**: the read-error
  family, first fixed where the operator looks first).
* **Tests added:** `src/domains/shared/__tests__/metricsFailureDisclosure.test.tsx` — 15 cases across
  three groups: "the aggregate read knows when it has not read" (success unchanged; rejected students
  read reported not absorbed; **no hero tile turns a failed read into a factual zero**; partial
  failure; complete failure → unavailable, not empty; abort ≠ failure; one retry on the surface that
  showed the dashes clears them), "the dashboard shows the disclosure the read set already computed"
  (alert + retry + dash on every affected tile; a sessions-only failure discloses itself **without
  dragging the tiles down**; silence when every read answered; the alert's retry re-reads), and "an
  unread calendar is never reported as an empty one".
* In the sandbox, `src/domains/shared/dashboardInsights.ts`, `useAcademyMetrics.ts`,
  `useDashboardInsights.ts`, `Hero.tsx`, `AttentionAndFlow.tsx`, `Intelligence.tsx`,
  `Dashboard.tsx` and `metricsFailureDisclosure.test.tsx` all match `d6430df` exactly.

### 4b. Command-palette focus-return defect — **found, reproduced, fixed in code; NOT landed**

* **The defect (independently reproduced in a browser):** trigger a control → open the palette
  (Ctrl+K, or Enter on a focused row) → press Escape → focus returned to `document.body` instead of
  the element that opened the palette. Keyboard/RTL users lose their place in the page. This is an
  **a11y regression of M11's D7 promise** ("focus-trap entry/loop/escape/return" is one of the
  fourteen gate cases for overlays generally, but the palette owns its own focus because it also
  owns a 30 ms deferred focus into its search field).
* **The Auditor-side finding** (from the external read-only Auditor's product audit, §5) is the same
  shape seen from the other side: **palette → `ActionSheet` focus handoff can steal focus** — the
  palette's close path and the sheet's own focus management both claim the caret, so the operator ends
  up nowhere. See also §6 **M-1**: the palette's verbs open those sheets at
  `src/components/overlays/CommandPalette.tsx:183`.
* **What the fix does** (in this sandbox's *worktree*, uncommitted): `returnFocusToOpener(opener)` is
  captured *before* the deferred focus moves the caret and while `paletteOpen` is true, and restored
  in the one cleanup every close path runs through — Escape, backdrop, an action handing off to the
  sheet, or a navigation. Two guards the shared focus trap does not need: `document.body` means
  nothing was focused when the palette opened (the Ctrl+K shell shortcut is exactly that case, so no
  opener is invented), and an element removed while the palette was up restores nothing rather than
  throwing at close time. A `try/catch` around `.focus()` keeps a control that refuses focus from
  crashing the page.
* **Status, stated precisely — this is the part the next session must not get wrong:**
  * present in the sandbox **worktree** as uncommitted changes: `M src/components/overlays/CommandPalette.tsx` (blob `98b57bb…`) and new file `src/components/overlays/__tests__/commandPaletteFocusReturn.test.tsx` (4 cases: Escape returns focus to the exact opener; the backdrop path does the same; an opener removed while the palette was up restores nothing and throws nothing; an open with nothing focused invents no opener);
  * **absent from `d31cbe9`** (the sandbox HEAD) — `git show d31cbe9:src/components/overlays/CommandPalette.tsx | grep -c returnFocusToOpener` → `0`;
  * **absent from `d6430df`** (the remote tip of this branch, i.e. the owner's current state) — that tree contains **no** `commandPaletteFocusReturn.test.tsx`, its `CommandPalette.tsx` is blob `38cd842…` with **0** occurrences of `returnFocusToOpener`.
  * ⇒ **The focus-return fix has NOT landed on any branch. Nobody should describe it as fixed.** It exists as unreviewed work in a sandbox worktree and as four tests in an untracked file. **Continuation item 1 must handle this**: either bring these two files over as a commit on the product branch (then run `npm test`, `npm run typecheck`, `npm run build`) or discard them and re-implement — and while touching the palette, fix the palette→sheet handoff (§6 M-1) rather than leaving two focus owners.
* This handoff commit **does not** carry those two files: committing someone else's in-progress work
  into a documentation checkpoint would violate the "preserve working-tree changes exactly / do not
  stage pre-existing changes" rule. They remain in the sandbox worktree, and their content is
  recoverable from the blob OIDs above.

---

## 5. Arena AI Auditor — status: FROZEN, external, and **not recoverable from this repository**

The **Arena AI Auditor** was developed in a **sibling workspace**, `/home/user/arena-auditor` —
never inside this repository, never committed here, and deliberately not added by this handoff.

* Design: zero-dependency Node ≥ 20 ESM engine; strict read-only architecture; a single subprocess
  boundary with an allowlist of exactly one program (`git`, always with `--no-optional-locks`, refused
  before spawn when outside policy); a path guard that may write **only** inside the configured
  `outDir`; snapshot capture + integrity verification; a contract extractor over the repository's own
  governance documents (clause ids, authority ranking, enforcement refs, preserved conflicts —
  contradictions kept, never resolved); and Phase 3 = risk **targeting**: mutation paths and candidate
  seams, with deferred / out-of-scope / browser-only statements removed *before* targeting, every
  entry phrased as a question, and a hard prohibition on numeric risk scores, severity vocabulary and
  findings.
* Phases completed and recorded: **Phase 0, 1, 2, 3.**
* Recorded test counts at each closure (whole-suite totals at the time, as the project kept them):
  **Phase 0 — 43/43**, **Phase 1 — 104/104**, **Phase 2 — 156/156**, **Phase 3 — 217/217** (of which
  Phase 3's own new suites were 27 mutation-path + 28 target-seam cases, plus 6 new CLI cases; strict
  `tsc --noEmit --checkJs` over `src/**` and `test/**` was clean at 0 errors).
* Its Phase-3 inventory of this repository was recorded at 320 mutation paths / 505 candidate seams /
  105 statements excluded before targeting / 83 unresolved, digest `324bf80857b91293` — an inventory
  of *questions with provenance*, never findings.
* **What happened to it:** after Phase 3 completed, the sandbox was rebuilt from the **repository**
  snapshot, and because the Auditor lived *outside* the repository it was not carried over. A
  subsequent read-only recovery sweep proved it is nowhere recoverable: no `/home/user/arena-auditor`,
  no file named for any of its modules anywhere on the filesystem, **no Auditor path in any tree of any
  reachable commit**, no Auditor content in **any** object of the repository (its complete object
  store was byte-scanned, reachable and unreachable alike), and no copy in the environment's patch
  captures (which contain only Arena product paths). **SOURCE NOT RECOVERABLE FROM CURRENT ARENA
  ENVIRONMENT.**
* **Directives for the next session:** do **not** fabricate, reconstruct, or stub Auditor source into
  this repository; do not add "fake Auditor source" as a placeholder. The Auditor is **intentionally
  FROZEN** and will be resumed later, in its own workspace, from the phase records above (its design,
  file lists, budgets and digests are described here and in the session's reports). If a future session
  is asked to continue the Auditor, it should say plainly that this environment does not contain it.
  If the Auditor is ever resumed, keep it **outside** the product tree but note that files outside the
  repository root are not preserved by the sandbox's snapshot mechanism — that is the operational
  lesson of this loss.

---

## 6. Latest product completion audit (read-only, 2026-09-18) — conclusions

**Question asked:** *what prevents us from reasonably freezing the frontend and moving to Laravel?*
(Not a code-quality audit; not a new architecture phase.)

**Verdict: the frontend is structurally close to freeze.** 13 of 13 navigation destinations render
real surfaces; 12 domains carry the full `repository / demoRepository / apiRepository / hook /
registry` seam; the fixture era is closed and gated; demo-backed persistence is legitimate (§3.1).
No score or severity rating was assigned, and none is implied below.

**Verification limit, recorded so it is not mistaken for coverage:** the audit was **static** —
source, tests, routes, navigation, repositories, governance documents and the session diff. That
sandbox had **no `node_modules`** and installs were forbidden, so **no test, build or browser run was
possible**; every statement is a `file:line`. Browser QA remains `NOT VERIFIED` for the whole project
(§10).

**🔴 Must fix before backend — six items, all cheap, all local.** Reproduced in full in the appendix
(§A.2) with evidence; the short form:

| ID | One-line statement |
|---|---|
| **M-1** | Quick actions are inert and hardcoded: `ActionSheet.tsx` offers creation forms that cannot save, seeded with literal option arrays, and they are the primary CTA of the Dashboard, the palette, Scheduling and the student profile |
| **M-2** | Teacher profile has **no profile-image UI at all**, while `Teacher.photoMediaId` and the media path exist |
| **M-3** | Student photo is **captured and stored but never displayed** (list and profile show initials) |
| **M-4** | **I15**: 14 read consumers discard `error` and render a failed read as an empty one — the shape this session's diff just eliminated on the dashboard |
| **M-5** | **I16**: the `per_page: 200` ceiling can make a live, deep-linked record report «هنرجو یافت نشد», and headings count `items.length` instead of `meta.total` |
| **M-6** | Settings panels expose controls whose values honour nothing in the product; the save button discloses non-persistence but not non-effect |

**Classification discipline used, and required of the continuation:** demo-backed ≠ incomplete;
explicitly-deferred-by-a-recorded-decision ≠ broken; a control that *says* it cannot work ≠ a
misleading UI; a control that *silently* does nothing ≠ honest. Nothing was classified 🔴 merely
because code exists, and nothing was invented as a requirement.

---

## 7. What can wait for Laravel (do not turn these into frontend blockers)

Backend-boundary conclusions, each already disclosed on screen and/or pinned by a test, so freezing
the frontend today does not encode a lie — it hands the backend a seam:

* **Finance / Reports real domains** (I2, D6) — deferral surfaces today, gated by `m10Boundary.test.ts`; money precision, idempotency, gateway, ledger semantics are server work.
* **Compensation API repository / server** — the domain has `repository` + `demoRepository` + `derive` but **no `apiRepository.ts`**; its verbs are "pinned for a backend to satisfy" (`src/domains/registry.ts` note). The UI half (P1 private one-to-one) is shipped; lineage/attempt-ledger persistence, authorization enforcement and concurrency are server work.
* **Server-side authorization** — view access and per-action write gating become real only server-side; `settings.read`/`users.*`/`schedule.write` enforcement.
* **Media storage, signed URLs, sniffing, scanning, per-object authorization** (`src/domains/media/types.ts` header, §3.10).
* **Library upload/edit/delete** — the contract exists (`src/domains/library/repository.ts:22-25` `create`/`update`/`delete`) and the view's own note says the upload form is a later phase; upload semantics ride the media/storage contract, so this is backend-shaped (note: the *form* is frontend-doable if the owner wants it before freeze — that is a decision, not a blocker).
* **Student/teacher notes** — no domain at all; the profile says «نیازمند سرور است». Needs a table.
* **CSV/XLSX/PDF export** — server generation («تولید فایل در سرور انجام می‌شود و در دمو فعال نیست»), and no xlsx/PDF dependency should be added before the phase that needs it.
* **Telegram / Bale providers** (I7) — a bot token must never sit in the browser.
* **`national_id` DB uniqueness** — `NOT NULL` + `UNIQUE(organization_id, national_id)` + index; the frontend checksum/masking work is done (`src/lib/nationalId.ts`, `students/types.ts:47-50`).
* **Server-side pagination** — the *pager component* can wait; only "not found" correctness cannot (M-5).
* **Backup / versioning** — including I8 (the demo-labelled envelope, `src/domains/demo/backup.ts:96-106`): a versioned-format change with migration, and backups become server-side anyway.
* **Settings persistence / a settings domain** — the inert controls' *contract* is backend work; only their labelling is frontend work (M-6).
* **Provider transports, notification delivery, retry queues, webhook ingestion** — all backend.

---

## 8. Deferred / DO NOT SCOPE CREEP

Explicitly out of scope for the pre-freeze pass; do not "helpfully" implement any of these:

* **Group compensation** (outside the current contract; private one-to-one only).
* **Free-slot search** (M10 removed the fixture answer on purpose; the palette question stays a typed no-data result).
* **SMS / push / e-mail notifications, notification delivery of any kind** (no invented behaviour, §3.15).
* **A new design system, new frameworks, new dependencies** — including an a11y library, a data-fetching library, a router, or a date library. M11's D7 is *dependency-free* by decision.
* **Performance expansion** beyond what a current product defect exposes (the bundle budget exists; do not chase new numbers).
* **Teacher workspace** beyond the existing roster/detail tabs (I4 — product-phase scope, authorization is backend).
* **Student / parent app or role** (I5) — **blocked on a product decision that has not been made**; `OPEN_ITEMS.md` §I5 forbids implementing before it is recorded in `DECISIONS.md`.
* **I17** level-content link-order UI; **a pagination component**; **I10/H5** further lifecycle-recovery work beyond what M1 landed; I8's envelope versioning; I13's remaining three hand-rolled readers (in progress — finish-or-park explicitly, do not silently extend).
* **Reopening settled domains**: compensation design (P1), attendance append-only model, scheduling materialization, D5 ownership, CSP, the M10 boundary.
* **The Arena AI Auditor** (§5) — frozen, external, not to be reconstructed here.
* **An invented M12** or a new governance architecture (§3.19).

---

## 9. Exact next work order (the continuation starts at 1)

Recommended order, chosen by dependency — the two profile items share one primitive change, the read
errors are what the backend will exercise first, and documentation reconciliation is last so it can
describe the settled state:

1. **M-1 Quick actions.** Reroute the four sheet actions to their real dialogs/views (`student` → `StudentFormDialog`; `class` → `ClassFormDialog` / `EnrollmentDialog`; `message` → the Messages composer with the record preselected; `payment` → the honest Finance deferral, or nothing). Delete the hardcoded option arrays in `src/components/overlays/ActionSheet.tsx` in favour of the domain reads. **Also in this step:** decide the fate of the uncommitted palette focus-return work (§4b) and fix the palette→sheet focus handoff once, with one owner.
2. **Shared `Avatar` image support** — one change, two consumers: accept an optional media reference, resolve it through `useMediaObjectUrl`, fall back to initials, and render a distinct "asset could not be read" state that is *not* the same as "no photo".
3. **M-2 Teacher profile + photo** — mount `ProfilePhotoField` in `TeacherFormDialog`, render the photo in `TeacherDetail` and the roster rows, with the initials fallback.
4. **M-3 Student profile + photo display** — same primitive, `Students.tsx` header + list rows; extend `src/views/__tests__/studentProfileRegression.test.tsx` so the "photo/media path" it already names covers *display*, not only capture.
5. **M-4 / I15 read-error sweep** — propagate `error` + a retry affordance at the 14 consumer sites, reusing the dashboard's one-wording-many-sites pattern, and add a boundary test in the style of `src/__tests__/writeFeedbackHonesty.test.ts` so a new consumer cannot destructure `items` alone without a stated reason.
6. **M-5 / I16 detail-by-id + count correctness** — fetch the deep-linked record by id (the repositories already have `get`), distinguish loading/error from "not found", derive visible counts from `meta.total`, and label truncation where a pager is not built. A full pager may wait.
7. **M-6 Settings honesty** — one line per affected panel («این گزینه هنوز در هیچ بخشی اعمال نمی‌شود») or hide the control, and record the intended settings contract as one OPEN item for the backend.
8. **Documentation reconciliation / handoff refresh** — update `docs/gap-matrix.md` (it still claims 11 domains are "NOT IMPLEMENTED" while twelve `repository.ts` files exist, `national_id` has "0 occurrences" while 24 files use it, `useAsyncView` fakes loading "in 9 views" while its only remaining mention is the test that enforces its absence, and "fabricated analytics in dashboard/reports/finance" predates M9/this diff) and re-read `docs/production-handoff.md` against the code, so the Laravel session does not implement against an obsolete claim. Then refresh `PROJECT_STATE.md` / `OPEN_ITEMS.md` for whatever 1–7 changed.
9. **Final frontend QA** — `npm test`, `npm run typecheck`, `npm run build`, plus the browser checklist the project has never been able to run (§10): RTL, mobile (BottomNav, sheet slide-in, table→card switch), keyboard-only walks through the palette and every dialog, and a manual pass over the six 🔴 areas.
10. **Frontend freeze.**
11. **Begin the Laravel backend**, taking the seams as they are: `repository.ts` per domain + the "BACKEND REQUIRED" notes in `media/types.ts`, `students/types.ts`, `docs/production-handoff.md`.

**The next session MUST start from item 1 unless new evidence changes the order.** Re-derive that
order from the code, not from this table, if the code has moved on.

---

## 10. Known QA limitations (honest, and not to be overstated)

* **Browser QA was not available in the sandbox that produced most of this state.** No browser tooling
  exists there or was installed; `PROJECT_STATE.md` §5 records `NOT VERIFIED` for M11 and for every
  milestone before it, and the L4 browser-QA checklist that M11 scoped was **not** run.
* **Independent browser work was done by the owner on Windows with Playwright driving installed
  Chrome** (not by the sandbox): RTL, mobile and desktop checks were performed there, and the
  palette **focus-return defect was actually reproduced** — trigger → Ctrl/Enter → Escape → focus on
  `document.body` instead of the original trigger. That reproduction is what makes §4b a defect rather
  than a hypothesis.
* During some of those runs, **intermittent canvas errors** appeared page-side but did **not**
  reproduce across repeated runs; they are recorded as unresolved noise, not as a defect with a cause.
* **No claim of full browser QA completion is permitted** unless it was verified in the environment
  making the claim. The audit in §6 is static-only (§6's verification limit), and the jsdom suites,
  while extensive (the M-series added hundreds of cases, including 15 for dashboard disclosure, 14 for
  the a11y gate, 4 for focus return *in the uncommitted file*), do not prove real-browser behaviour.

---

## 11. Git / history safety invariants (binding on every session)

* **No force push. Ever.** No `--force`, no `--force-with-lease`, no lease tricks.
* **No history rewrite** of any kind: no rebase, no amend of existing commits, no squash, no filter,
  no branch or tag deletion.
* **`main` must remain untouched** at `a6469759fea743b9332702bb9a20e69fc4abc1be` — the true merge
  commit of PR #3. Nothing in this handoff merges into it, and this branch must **not** be merged into it.
* **The existing M11 commits are immutable**: `3ed0bfe` (D7/D8/D9 decision record — M11's safe
  rollback boundary), `3eed4f19`, `24998d83`, `53794d57`, `f7eb867` (implementation), and `d31cbe9`
  (the M11 closure record and canonical closure SHA).
* **The malformed M11 commit `2ce10d638287950d766adf913f7b1954b41172af` is accepted as-is and must
  not be rewritten.** Verified on 2026-09-18: it exists on the remote, and its first message line is
  the trailer `Co-authored-by: arena-agent <297053741+arena-agent@users.noreply.github.com>` — the
  subject line was lost. That is a known, accepted wart; correct it in no way.
* **The current Arena work branch (`arena/01a0b059-parsian-music-dashboard-opus`, remote tip `d6430df`)
  must remain intact** — the working-tree changes in the sandbox are the owner's in-progress state and
  must not be committed, stashed, reverted or cleaned by a documentation pass.
* **PR #2** was superseded/closed (do not revive it); **PR #3** is merged; **PR #1** is merged.
* `main`-side rule for tooling: this repository's `.git/hooks/commit-msg` **appends** the
  `Co-authored-by: arena-agent` trailer to any message lacking it, so a commit message will arrive on
  the remote with that trailer added. Deliberate, and not to be worked around.
* This handoff commit was made **without** touching the index, the working tree or `HEAD`: a temporary
  index copy, `git write-tree` / `git commit-tree`, and a guarded `git update-ref` that could only
  create the new branch ref. No checkout, no branch switch.

---

## 12. Source of truth — what the next session must read first

1. **This file** — `docs/engineering/SESSION_HANDOFF.md` (scope, the six must-fix items, the not-landed warning in §4b).
2. `docs/engineering/PROJECT_STATE.md` — the recovery document: current checkpoint, phase status rows, §4 validation blocks per milestone, §5 (browser-QA disposition), §7 item list. **Watch for superseded blockquotes** (M10's "M11 NOT STARTED" line) that the file itself marks as history.
3. `docs/engineering/DECISIONS.md` — §1–§19, the authoritative decision register (D1–D20 in §19).
4. `docs/engineering/OPEN_ITEMS.md` — the backlog with per-item status; **the closure prose is long and some items carry "closed but not fully done" clauses** (H1's five unexposed verbs; I13's "not all of its readers are fixed"; I16 "still OPEN after M4's and M5's mitigations").
5. `docs/engineering/PHASES.md` — milestone records with their checkpoint SHAs, including the Compensation P1 workstream (`a21311d`).
6. `docs/engineering/PRODUCT_PHASE_SPECIFICATION.md` — the M0 specification of the product phase (defines **no** milestone past M11).
7. `docs/gap-matrix.md` and `docs/production-handoff.md` — the Phase-0 audit and the handoff doc. **Both have drifted** (§9 item 8): treat them as as-of-`082a3be` history plus correction notes, verify against code before repeating any claim from them.
8. The domain READMEs, in particular `src/domains/scheduling/README.md` (which verbs the UI must not call, and why) and `src/domains/compensation/README.md`, plus `src/domains/*/types.ts` "BACKEND REQUIRED" comments.
9. The gates: `src/__tests__/m10Boundary.test.ts`, `src/__tests__/architectureBoundaries.test.ts`, `src/__tests__/writeFeedbackHonesty.test.ts`, `src/__tests__/a11yGate.test.tsx`, `src/__tests__/bundleBudget.test.ts`, `src/__tests__/routeProtection.test.tsx`, `src/__tests__/privacyPosture.test.ts`, `src/__tests__/projectState.test.ts`.
10. Then: `git status`, `git log --oneline -5`, `git rev-parse HEAD`, `git remote -v`, and a fetch/compare against the remote tip — **before** implementing anything, and specifically to re-establish whether §4b's focus-return work was landed by hand since this file was written.

---

## APPENDIX A — Preserved appendix: the Product Completion Audit (2026-09-18)

Kept at length on purpose: the next session needs the *why* and the evidence, not just the labels.

### A.1 Route / surface matrix (13 destinations, all real; class = freeze disposition)

Routes are hash-based with a charset-validated `#/view/id` form (`src/lib/hashRoute.ts:32-44`);
a view the session may not access renders a real "no access" state with a redirect to the role's
default view (`src/App.tsx:70-79`, `domains/auth/permissions.ts:146-169`).

| Area | State found | Evidence | Class | Backend dependency |
|---|---|---|---|---|
| Dashboard (+ hero, metrics, signals, attention, today's flow, intelligence) | Real; one read set owned by the view; `NO_DATA` for unread; disclosure with a working retry; empty/demo behaviour honest in both modes | `views/Dashboard.tsx`, `components/hero/Hero.tsx:110-113`, `panels/AttentionAndFlow.tsx:81,110-133`, `panels/Intelligence.tsx:106`, `domains/shared/dashboardInsights.ts:83-91,160-186,398-463` | 🟢 (see §4a; the palette verb is M-1) | none |
| Command palette | Real: navigation across all 13 views, verbs, entity search, recents, keyboard flow | `components/overlays/CommandPalette.tsx:116-161,183` | 🔴 M-1 (+ §4b not landed) | none |
| Students | Real 7-tab profile (overview/learning/schedule/attendance/finance/notes/activity), CRUD dialogs, photo capture, derived relations, national-ID masking | `views/Students.tsx:241-901,902-1155,307-311,390,915-919,1005-1013` | 🔴 M-2/M-3/M-4/M-5 | DB paging, notes, export |
| Teachers | Real roster + detail (today's classes, weekly schedule, their students, availability grid, workload analysis), status write with failure path, **`error` + `reload` on its primary read** | `views/Teachers.tsx:232-692,906-910,910,120-138,255,431,495,577-601,858-883` | 🔴 M-2 | availability authorization |
| Classes | Real; capacity/waitlist/occupancy derived from enrollment rows; kind/room from `useRooms`; enroll dialog; private/group semantics from the class record | `views/Classes.tsx:44-59,71-96`; `domains/enrollments/EnrollmentDialog.tsx` | 🟡 (I15 at `ClassFormDialog.tsx:104-105`, `EnrollmentDialog.tsx:35`) | server capacity enforcement |
| Scheduling | Real calendar over a bounded window; reschedule/cancel/generate awaited with conflict checks; the five unexposed verbs are decisions; roster and conflict badges deliberately not rendered; the `filter=conflict` deep link says plainly what is not wired | `views/Scheduling.tsx:48-72,353,532`; `views/scheduling/SessionWriteDialogs.tsx`, `GenerateSessionsDialog.tsx`; `domains/scheduling/README.md §3` | 🟢/🟡 | server transactions (D11) |
| Attendance | Real register derived from active Enrollment at the session's date; `record` / `bulkRecord` / `correct(reason)`; 8 retry paths; correction trail never fetched whole | `views/Attendance.tsx:12-56,199-219`; `domains/attendance/roster.ts` | 🟢 (I15 at `useAttendance.ts:60`) | auditable server writes (D12) |
| Compensation | Real UI: lineage, affected student frozen at registration, cancellation/retry, authorization disclosure; 40 error paths | `views/Compensation.tsx` (1 112 ln), `views/compensation/CompensationDialogs.tsx`, `domains/compensation/derive.ts:327` | 🟡 | **no server at all** (I20) |
| Finance | **Explicit deferral surface**, not a fake ledger | `views/Finance.tsx:1-40`; `lib/financeReportsDeferral.ts`; `m10Boundary.test.ts` | 🟡 I2 | whole domain |
| Reports | Same deferral shape | `views/Reports.tsx:1-66` | 🟡 I2 | aggregation/PDF |
| Messages | Real: send, create thread, rename/topic/pin/archive/restore, attachment upload, per-conversation export, per-thread draft isolation | `views/Messages.tsx:4-54,289-345,385`; `views/messages/useComposer.ts`, `composerTemplates.ts` | 🟢 | provider tokens (I7) |
| Library | Real read / play / download; **no** add/edit/delete UI | `views/Library.tsx:4,116,290,343-351`; `domains/library/repository.ts:22-25` | 🟡 | object storage |
| Settings | 7 sections; branding, users+roles, rooms, instruments, repertoire, learning, gallery, import/export, lifecycle are real writes; notifications/localization/session-rule inputs are inert (with a persistence disclosure at the save button only) | `views/Settings.tsx:26-32,51,76,135,300-390`; `components/settings/UsersPanel.tsx:18-58`; `components/settings/DemoDataPanel.tsx:70` | 🔴 M-6 | settings domain |
| Design system | Internal surface, not a product promise | `views/DesignSystemView.tsx` | ⚪ | — |

Mobile/RTL: `index.html:2` is `lang="fa" dir="rtl"`; the rail collapses to `BottomNav`
(`components/layout/TopBar.tsx:112`); sheets slide from the side (`ActionSheet.tsx:98`); both people
views switch card/table. Only `views/Dashboard.tsx` uses `useMediaQuery`; the rest is CSS-breakpoint
based — workable, and **not** browser-verified here.

### A.2 The six must-fix items, with the reasoning that produced them

**M-1 · Quick actions: an inert form layer carrying hardcoded seed data.**
`src/components/overlays/ActionSheet.tsx` defines four creation forms — `student` (`:19`), `class`
(`:30`), `payment` (`:41`), `message` (`:51`) — whose `<select>` options are **literal seed values**:
instruments `["پیانو","گیتار","ویولن","آواز","درامز"]`, teachers `["سارا احمدی","محمد رضایی","علی موسوی","نرگس حسینی"]`,
rooms `["اتاق ۱"…"اتاق ۴"]`, recipient groups `["هنرجویان در معرض ریزش","مدرسین","همهٔ هنرجویان پیانو","والدین کلاس کودکان"]`.
The same data is *live and editable* elsewhere: `useInstrumentCatalog()` drives the students filter
(`Students.tsx:906-908`) and `InstrumentsPanel` / `RoomsPanel` persist changes, so a room an academy
creates is unselectable here and a room it retires is still offered. Submit discards the input:
`notify({ tone:"info", title:"این فرم هنوز به سرور متصل نیست", detail:"داده‌های واردشده ذخیره نشدند." })`
(`ActionSheet.tsx:85`) with a demo line at `:147`. These forms are wired as **primary** actions:
Scheduling's header «+» (`Scheduling.tsx:532` → `class`), five «برنامه‌ریزی کلاس» empty states on the
student profile (`Students.tsx:509,515,589,644,676`), «ثبت پرداخت» (`Students.tsx:425,850`), the
Dashboard's quick-action row (`panels/AttentionAndFlow.tsx:197`) and the palette's verbs
(`CommandPalette.tsx:183`). Why it blocks freeze: it is the front door of the landing screen, and it is
the one place where "demo" means *fake* rather than §3.1's first-class demo environment — a student
with no classes is pointed at a class form that cannot create a class, while `ClassFormDialog` and
`EnrollmentDialog` do exactly that for real. Fix direction: reroute, delete the literal arrays, and
make the palette→sheet handoff have one focus owner (§4b).

**M-2 · Teacher profile has no profile-image surface.** `Teacher.photoMediaId` exists
(`src/domains/teachers/types.ts:22-23`, pointing at `Student.photoMediaId`); the media path works
end to end in this same build (`media/ProfilePhotoField.tsx:38-80` — `useMediaObjectUrl` for preview,
`getMediaRepository().create` for upload, `.delete` for removal); yet **`TeacherFormDialog.tsx` never
mounts `ProfilePhotoField`** (zero `photo`/`Photo`/`avatar` matches in the file) and `Teachers.tsx`
renders only initials (`Avatar` at `:194` list card, `:601` in the student relation, `:883` roster row).
The blocker is one prop deep: `Avatar`'s signature is `{name,size,ring,className}`
(`components/ds/patterns.tsx:314-324`) and it composes initials from `name.split(" ")` — **the
primitive cannot display an image at all**. The owner's stated MVP requirement is that a teacher must
have a profile surface where a profile image can be placed and displayed, so this is a gap regardless
of storage. Fix direction (shared with M-3): optional media reference on `Avatar`, initials fallback
when absent, and a *third*, distinguishable state when the asset exists but could not be read; mount
the field in the teacher dialog; render it in the detail header and roster.

**M-3 · Student photo is captured and stored but never displayed.** The write exists
(`domains/students/StudentFormDialog.tsx:192-196` mounts `ProfilePhotoField`, `:47` seeds the draft
from `student?.photoMediaId`, `:120` sends it on save) and the field is on the model
(`students/types.ts:53-56` — "`MediaAsset.id` … Never a data URL"). But `photoMediaId` appears in
**no** view or component (`grep -rn photoMediaId src/views src/components` → 0 matches): the list card
and the profile show `Avatar name=…` (`Students.tsx:192,1041`). The image is invisible outside its own
edit dialog. Notably `src/views/__tests__/studentProfileRegression.test.tsx:8-12` already claims to
pin "the photo/media path" of the profile — so the test name promises display the code does not have.

**M-4 · I15: a failed read is rendered as an empty one (14 consumers).** `useResourceList` keeps
`error` beside `items` and *preserves the previous page* when a refetch fails
(`domains/shared/useResource.ts:55,113`), so a consumer destructuring only `items` (or `items` +
`loading`) cannot distinguish "nothing found" from "the read failed". Verified at the cited lines:
`domains/learning/LearningPanel.tsx:84` (`const { items: instruments } = useInstruments({ per_page: 200 })`)
and `:104` (levels, with `loading` but no `error`), `domains/learning/StudentLearningPanel.tsx:28,36,205`,
`domains/classes/ClassFormDialog.tsx:104,105`, `domains/enrollments/EnrollmentDialog.tsx:35`,
`domains/gallery/GalleryPanel.tsx:68`, `domains/progress/AssignPieceDialog.tsx:77`,
`domains/progress/PieceFormDialog.tsx:75`, `domains/progress/StudentProgressPanel.tsx:78`. Each of
those files handles **write** errors (`err=4`-ish, `retry=1`) — the gap is specifically reads; a
failed levels read prints «این دوره هنوز سطحی ندارد» for a program that has twelve, and a failed
instrument read empties the assignment picker. Why now: after Laravel, reads fail routinely (401,
timeout, 5xx), and freezing this shape means the backend inherits a UI that reports an outage as an
empty academy. Fix shape is already in this repository twice — `views/Teachers.tsx:910`
(`const { items: teachers, loading, error, reload } = useTeachers(...)`) and the dashboard's new
disclosure+retry with one shared sentence (`CALENDAR_UNAVAILABLE`, `dashboardInsights.ts:83-91`),
pinned by `domains/shared/__tests__/metricsFailureDisclosure.test.tsx:243,333`. I15's own record
notes only one of its fifteen sites was fixed so far (`3bec881`, with a reversion check).

**M-5 · I16: the 200-row ceiling makes valid records look nonexistent.** The house convention for
"load everything" is `{ per_page: 200 }` with no pager (19 sites), and `paginate` applies **no upper
clamp** (`domains/shared/demoCollection.ts:23`) — so 200 is honoured exactly and record #201 is
silently absent. That is benign for a heading count until a **detail route** resolves its id against
that page: `Students.tsx:919` reads `useStudentList({ per_page: 200 })`, `:990` finds
`detail = students.find(s => s.id === detailId)`, and `:1005-1013` renders
«هنرجو یافت نشد — این پیوند به هنرجویی اشاره دارد که دیگر وجود ندارد» for a student who exists. The
file's own comment names the two-part cure ("server-side paging plus a `get(id)` fetch for the detail
route replaces this ceiling"); the `get(id)` half is available through the repository contract today,
and `Scheduling.tsx:66-72` is the precedent for deriving selection from the loaded page without
stale-frame risk. Second half: visible counts come from `items.length` rather than `Page.meta.total`
(~48 sites), so a truncated list reports its own truncation as the population size; the Scheduling
view already shows the honest alternative ("says so when the answer was truncated instead of looking
complete", `Scheduling.tsx:59-62`). The teacher relation reads carry the same constant
(`Teachers.tsx:72,300-303`).

**M-6 · Settings controls that honour nothing.** `views/Settings.tsx` keeps a local
`useState` toggle map (`:51`) and `defaultValue`-only selects/inputs for Friday-off
(`:135), the four notification events and three channels (`:300-324`), localization
(`:336-366`) and the four session rules «مدت پیش‌فرض جلسه / فاصلهٔ بین جلسات / مهلت لغو بدون جریمه /
سقف جلسات جبرانی» (`:387-390`). The single save button is honest — «ذخیرهٔ تنظیمات نیازمند سرور
است · این تغییرات ماندگار نیستند. تنظیمات ظاهر جداگانه ذخیره می‌شود.» (`:76`) — but the disclosure is
about **persistence**, not **effect**: `grep friday src` matches only `Settings.tsx`;
`gracePeriod`, `defaultSessionDuration`, `betweenSessions` match nothing outside it, and the
cancellation-grace figure is not consulted by `cancelSession` or the compensation flow. Meanwhile the
sections that *do* persist prove the contrast: branding writes through `BrandingRepository`, users
through `useUsers()` (`components/settings/UsersPanel.tsx:17,26-58`, gated by
`can("users.write")`), theme/accent/density/motion through `useApp`/`lib/theme.ts`. Fix direction is a
label («این گزینه هنوز در هیچ بخشی اعمال نمی‌شود») or removal, plus one OPEN item recording the
intended settings contract so Laravel inherits a request rather than an assumption. Per-action
permission gating appears in exactly **two** files in the whole app (`UsersPanel.tsx:18`,
`DemoDataPanel.tsx:70`); no routed view gates a write button by permission — consistent with
"server enforces, client offers", but worth a deliberate decision rather than drift.

### A.3 Student profile — what was found, in the order it was checked

1. **The remembered "profile does not load" defect is a fixed, pinned regression — do not re-diagnose
   it.** `views/__tests__/studentProfileRegression.test.tsx:1-14` records that on a payload persisted
   by an older build the header rendered while the learning and progress panels failed with
   «بارگذاری مسیر یادگیری ناموفق بود / Cannot read properties of undefined (reading 'find')» and
   «بارگذاری پیشرفت ناموفق بود … ('filter')», because `placements`, `pieces`, `pieceAssignments` and
   `progressEvents` were absent from that payload; the test installs a legacy payload (`:47-53`) and
   pins overview, derived learning path, derived progress mapping, the photo/media path and deep-link
   navigation, with the persistence side owned by `services/__tests__/demoStoreMigration.test.ts`.
2. **Stable identity, preserved:** the profile keeps the student id as the identity used by the route
   (`#/students/<id>`, validated charset) and never renders a full national ID in chrome (`:52`).
3. **Relations are real reads, not fixtures:** enrollments, classes, rooms, a bounded session window and
   attendance marks, each with its own `per_page` and window (`:307-311`), all awaited before the
   profile draws a conclusion — the file states the reason explicitly: a profile drawn from half-read
   relations would print «—» where a teacher's name exists, so it withholds instead (`:41`, `:357`).
4. **Persistence works where the domain exists:** status change is awaited with an honest failure path
   (`:270-273`, `apiErrorFromThrown(cause).message`), and the edit dialog's confirmation derives its
   wording from the environment instead of hardcoding "demo" (`:953-965`).
5. **What is missing is display + failure shape + the ceiling:** M-3 (photo never displayed), M-4
   (learning/progress relation reads discard `error`), M-5 (a record past row 200 is "not found").
6. **Model sufficiency for Laravel:** `nationalId`, `photoMediaId`, `payment: PaymentStatus`,
   `balance: number` (`students/types.ts:47-73`) with `PaymentStatus` deliberately shared (`:12`); the
   finance tab prints those **stored fields** (`:806-815`), which is the right shape to map — it is not
   a computed ledger and must not be relabelled as one. Docs: `docs/architecture/students.md`.
7. **Navigation:** list→detail and back via breadcrumbs (`:390`, `:1137`, `:1142`); jump-to-attendance
   (`:757`) and jump-to-schedule (`:504,613`) work; the «مشاهده در بخش مالی» action (`:808`) lands on a
   deferral card — honest, but a dead end, and «برنامه‌ریزی کلاس» is the M-1 dead end.

### A.4 Teacher profile — what was found

* A proper detail surface exists (`Teachers.tsx:232` `TeacherDetail`, breadcrumb + back at `:431`,
  `Tabs` at `:495`): today's classes with its own empty state (`:511-513`), weekly grid (`:544`),
  that teacher's students with a jump to the students view (`:577-601`), availability grid
  (`:120-138`, `:628`) and workload analysis (`:636`); a status write with a real failure path (`:255`).
* List, search, filter are real, and a partial read is labelled (`:99 partialNote`, `:858` reset).
* **Its primary read is the best-shaped in the app:** `const { items: teachers, loading, error, reload }
  = useTeachers({ per_page: RELATIONS_PER_PAGE })` (`:910`) — loading, error **and** retry.
* **Image readiness, precisely:** the field is in the type (`teachers/types.ts:22-23`), the media
  domain can store/read/delete a `MediaAsset`, `ProfilePhotoField` exists and works — and the teacher
  UI exposes **none** of it, because the form omits the field and `Avatar` cannot take an image. So:
  *frontend contract for the image = ready; frontend UI for setting or displaying it = absent.* No
  storage decision is required to close that gap, and no fake URL may be introduced to fake it (§3.10).
* **No hardcoded teacher identities in the teacher surface** (everything comes from `useTeachers` /
  `useAcademyMetrics`); the seeded names live in `ActionSheet.tsx:24,37,55` (M-1) and the demo seed
  (`domains/demo/academySeed.ts`), the latter being legitimate demo data.
* "Which of a teacher's own data the teacher role may see" is recorded as **I4** and is a
  backend-authorization question; it needs no frontend change before freeze.

### A.5 Cross-page / navigation gaps (beyond M-1's dead ends)

`#/students/:id` and `#/teachers/:id` share M-5's ceiling; `filter=conflict` on Scheduling is
self-labelled as not wired; the palette's verbs inherit M-1; `key={view-filter-detailId}` remount
(`App.tsx:145`) is what keeps I13's stale-frame window from surfacing a wrong record, so any refactor
that removes the remount must re-check I13; learning / progress / gallery / media / instruments /
rooms are reached from the student profile tabs and from Settings — usable, though gallery and
repertoire management under «تنظیمات ← عملیات آموزشگاه» is a discoverability question for the owner,
not a breakage.

### A.6 Data / repository gaps (concrete list, demo-valid items excluded on purpose)

`library` view issues zero repository calls though the contract defines `create`/`update`/`delete`;
`notifications`, `messaging`, `finance`, `reports` are README stubs (consistent with their deferral
records) while Settings renders controls aimed at them; 14 read-error discards (M-4); 48
`items.length` counts vs `meta.total` (M-5); I13's three remaining hand-rolled readers; no student-note
domain at all (labelled honestly at `Students.tsx:688,875`); `sessionRoster` reachable only through
compensation's derivation (`compensation/demoRepository.ts:281,814`, `derive.ts:327`) and its own test,
by decision (`Scheduling.tsx:56-57`), while attendance derives its own register (`Attendance.tsx:19-20`).

### A.7 What was verified **clean** (so the next session does not re-audit it)

Zero `console.*`, zero `TODO`/`FIXME`, zero `dangerouslySetInnerHTML`/`eval`, zero `any` in `src`
(as of the Phase-0 audit, and the M-series gates keep those shapes fenced); no secrets, tokens or
real personal data in the repository; the demo clock is gated (`domains/shared/clock.ts:42-48` —
frozen only under the deterministic-clock flag); `useAsyncView`'s simulated-loading helper is dead and
enforced as such (`architectureBoundaries.test.ts:67-69`); national-ID masking and checksum validation
are present; the hard-coded "demo" label on real writes is gone app-wide and fenced by
`writeFeedbackHonesty.test.ts`; scheduling/attendance/compensation/chat writes are all awaited with
disclosed failure paths.

*End of appendix.*
