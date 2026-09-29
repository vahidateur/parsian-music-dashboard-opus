# PHASE 2A — OWNER DECISION / LANDING ANALYSIS (READ-ONLY)

Date: 2026-09-28 · Mode: read-only (no source file created, edited or deleted; no commit, push, merge, rebase, reset, clean, stash or branch switch)
Method: every claim below was measured in this session against the actual working tree, the local Git object store, or the GitHub API (read-only queries). Prior reports were not trusted.

---

# 1. LINEAGE

**Commands and results (local):**

| Command | Result |
|---|---|
| `cat .git/shallow` | `eb5b5598774bdadd0a7aabab01d88e564dcb867d` and `eb973eb2758447eff16b60ab4fd4c267f9d85061` — **both tips are grafted roots** |
| `git merge-base --is-ancestor eb973eb eb5b559` | NO |
| `git merge-base --is-ancestor eb5b559 eb973eb` | NO |
| `git merge-base eb973eb eb5b559` | empty — no answer locally |
| `git rev-list --count <ref>` | `1` for HEAD, `eb973eb`, `eb5b559`, `main` |
| `git cat-file -t ece060de / 0184e011 / 455fc1f5` | all “Not a valid object name” (parents absent) |

**Commands and results (read-only API — no fetch, no ref writes):**

```
gh api repos/vahidateur/parsian-music-dashboard-opus/compare/eb5b559...eb973eb
  → {"status":"diverged","ahead_by":1,"behind_by":39,
     "merge_base_commit": "ece060de2ed57ade11d608dda9c99d91717fa9c8", "total_commits":1}
gh api .../compare/eb973eb...eb5b559
  → {"status":"diverged","ahead_by":39,"behind_by":1, "merge_base_commit":"ece060de…"}
```

**Answers**

1. **Is `eb973eb` an ancestor of `eb5b559`?** No.
2. **Is `eb5b559` an ancestor of `eb973eb`?** No.
3. **Merge base:** `ece060de2ed57ade11d608dda9c99d91717fa9c8` — which is `eb973eb`'s own parent (the commit object records `parent ece060de…`). It is **not present locally**.
4. **Commits on each side:** this line = **1** commit (`eb973eb`, 2026-09-23); main = **39** commits (2026-09-24 → 2026-09-27). Main's 39 include: role-aware teacher dashboard, dashboard polish, export lazy-loading + export permission/truncation fixes, media ownership/cleanup fixes, the governance state-gate fix, **A-lite + the D9 re-baseline**, the **S5 typecheck chores**, **F1 (G-1…G-7)**, library/gallery frontend gaps, the login-portal UI work, and merges of PRs #15/#16/#17/#18/#19.
5. **Which differences are unrelated pre-existing WIP?** Two groups:
   * In *our* tree: the **base-repair hunks** — the working tree fixes **25 TypeScript errors that the base commit itself has** (proved below in §2/B). These hunks are the same class of work main landed as S5.
   * In *main*: the 39 commits above — a parallel product line that has no counterpart in this worktree (teacher dashboard, D9 re-baseline, G-7, login UI…). They are not “our WIP”, and they are not in this checkout.
6. **Which differences are specifically required by Phase 2A?** The 28 new files + the seam-migration and wiring hunks (§2/A, §2/C, §2/E, §2/F). Note that Phase 2A does **not** touch `docs/` at all — no governance record of this phase exists in the tree.
7. **Safe preservation path?** Yes, and it needs no Git history surgery: the WIP is (a) tracked modifications and (b) untracked new files. Both can be captured outside Git (`git diff` patch + tarball of untracked paths, stored **inside the workspace root** so it persists) and later re-applied with `git apply --3way` on a fresh landing checkout. No reset, clean, stash, rebase or branch switch is required at any point.

**Conflict surface:** WIP touches **109 files**; main's 39 commits touch **108**; the intersection is **18 files**:
`package.json`, `src/App.tsx`, `src/api/__tests__/mobileContract.test.ts`, `src/components/ds/states.tsx`, `src/domains/auth/AuthContext.tsx`, `src/domains/export/EntityExportButton.tsx`, `src/domains/export/definitions.ts`, `src/domains/export/exportService.ts`, `src/domains/gallery/GalleryPanel.tsx`, `src/domains/gallery/__tests__/GalleryAlbumSwitch.test.tsx`, `src/domains/import/ImportExportCenter.tsx`, `src/views/Classes.tsx`, `src/views/Dashboard.tsx`, `src/views/Gallery.tsx`, `src/views/Login.tsx`, `src/views/Scheduling.tsx`, `src/views/Teachers.tsx`, `src/views/__tests__/studentsScopeLeak.p1.test.tsx`.

---

# 2. PHASE 2A FILE INVENTORY

Measured from `git status --short` (78 modified, 31 untracked) with per-file diff inspection, a “changed line matches a Phase-2A pattern” classifier, a byte-compare against main's tree, and an empirical base-tree typecheck.

### A. Required Phase 2A implementation — 28 NEW files

| Group | Files |
|---|---|
| Lock / delivery | `src/api/deploymentLock.ts`, `src/domains/demo/delivery.ts`, `src/components/settings/ProductionDeliveryGate.tsx` |
| Composition roots | `src/domains/registryCore.ts`, `src/domains/registry.client.ts` |
| Explicit unavailable | `src/domains/shared/unavailableDomains.ts`, `src/domains/shared/unavailableRepository.ts` |
| Target seams (6 seams × 2) | `src/targets/{environment,libraryProvisioning,galleryProvisioning,targetCopy,targetFeatures,commandShowcase}(.client).{ts,tsx}` |
| Demo-class splits (bundle boundary) | `src/domains/auth/demoUserRepository.ts`, `src/domains/auth/demoRoleRepository.ts`, `src/domains/auth/passphrase.ts`, `src/domains/auth/session.ts` |

### B. Pre-existing / base repair — NOT Phase 2A (proved, not assumed)

`git archive HEAD` extracted to `/tmp`, then `tsc --noEmit` on that untouched base tree: **exit 2, 25 errors**. The working tree fixes them. Files and error counts:

| File | Base errors | Class |
|---|---|---|
| `src/domains/export/definitions.ts` | 9 × TS6196 (dead type imports) | repair — **this file is byte-identical to main** |
| `src/api/__tests__/mobileContract.test.ts` | 4 (TS2339 ×3, TS6133) | repair **+ Phase 2A** (ApiClient scan extended) |
| `src/domains/gallery/__tests__/GalleryAlbumSwitch.test.tsx` | 3 (TS7006 ×2, TS6133) | repair |
| `src/domains/export/exportService.ts` | 2 × TS6133 (dead imports) | repair |
| `src/views/Classes.tsx` | 1 × TS6133 (`canWriteClasses` unused) | repair **+ Phase 2A import swap** |
| `src/views/Teachers.tsx` | 1 × TS6133 (`canWriteTeachers` unused) | repair **+ Phase 2A import swap** |
| `src/views/Scheduling.tsx` | 1 × TS6133 (`academyNow` unused) | repair **+ Phase 2A clock pin** |
| `src/domains/export/EntityExportButton.tsx` | 1 × TS2322 (`"warn"` ≠ `"warning"`) | repair — **main already has `"warning"` (line 80)** |
| `src/domains/import/ImportExportCenter.tsx` | 1 × TS2322 | repair — **byte-identical to main** |
| `src/domains/gallery/GalleryPanel.tsx` | 1 × TS6133 (unused `Search`) | repair |
| `src/views/__tests__/studentsScopeLeak.p1.test.tsx` | 1 × TS2345 (literal widened) | repair |

(Also `src/domains/demo/gallerySeed.ts` carries a `/* @__PURE__ */` annotation — a tree-shaking aid that belongs with the bundle work, not the seam work.)

**Conclusion: the base commit `eb973eb` does not typecheck. Phase 2A cannot be applied to that base and be green without carrying, or dropping, this repair set.**

### C. Shared files modified by both (Phase 2A + other)

The largest group: ~46 files whose Phase 2A change is an **import-path seam migration** plus, for some, a repair hunk:

* `@/domains/demo/useDataLifecycle` → `@/targets/environment` — `InstrumentsPanel`, `RoomsPanel`, `WorkingHoursPanel`, `SessionRulesPanel`, `RepertoirePanel`, `BrandingPanel`, `Students.tsx`, `Reports.tsx`, `Teachers.tsx`, `Classes.tsx`, `ActionSheet.tsx`, `Finance.tsx`, `Dashboard.tsx`, `DesignSystemView.tsx`, `Gallery.tsx`, `UsersPanel.tsx`, …;
* `DemoNote` removed from `components/ds/states.tsx` and re-exported from the demo target seam;
* `../registry` → `@/domains/registry` (required so the Vite alias can swap the composition root) — `useClasses`, `useTeachers`, `useRooms`, `useEnrollments`, `useCompensations`, `domains/index.ts`;
* demo-state hooks and provisioning moved out of shared code — `useGallery`, `useLibrary`, `gallery/demoContent`, `library/demoContent`, `overlays/commands.ts` (NL showcase → `@/targets/commandShowcase`);
* demo-class split consumers — `AuthContext`, `UsersPanel`, `metricsFailureDisclosure`, `authIntegration`, `userRepository.test`, `rolePolicy.test`, `useLibrary.test`, `demoCredentials`;
* core wiring — `registry.ts`, `demoStore.ts`, `lifecycle.ts`, `demoDataManager.ts`, `backup.ts`, `dataVersion.ts`, `api/config.ts`, `App.tsx`, `Login.tsx`, `Settings.tsx`, `DemoDataPanel.tsx`, `FirstRunChooser.tsx`, `env.d.ts`, `src/test/setup.ts`.

### D. Documentation / governance changes

**None.** No file under `docs/` is modified. The only new documents are this analysis and the earlier audit report (both untracked, written by the audit, not by the implementation). **Phase 2A currently has no governance record in the tree** — that is a gap in its own right (see §5).

### E. Tests created specifically for Phase 2A — 4 new suites

`src/__tests__/bundleBoundary.test.ts`, `src/api/__tests__/deploymentLock.test.ts`, `src/domains/demo/__tests__/delivery.test.ts`, `src/domains/__tests__/registryClient.test.ts`.
Modified gates that Phase 2A itself changed: `src/__tests__/architectureBoundaries.test.ts`, `src/api/__tests__/mobileContract.test.ts`, `src/__tests__/routeProtection.test.tsx`, plus the view/domain tests whose mock paths followed the seam.

### F. Build / configuration changes — 6 files

`package.json` (`build:client`, `build:demo`), `vite.config.ts` (`APP_TARGET`, six target aliases, the registry alias, production CSP, mode selection), `tsconfig.client.json`, `tsconfig.demo.json` (new), `src/env.d.ts` (`__APP_TARGET__`), `src/test/setup.ts` (test-side dataVersion bridge).

---

# 3. ARCHITECTURE ACCEPTANCE

Re-verified this session; nothing changed by this analysis.

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | One shared App | ✅ | one entry (`main.tsx`) → one `App.tsx` |
| 2 | One route tree | ✅ | routes live in the shared shell only |
| 3 | One Login | ✅ | `src/views/Login.tsx`, seams inject only the assist slots |
| 4 | Shared domain/workflow implementation | ✅ | no duplicated domain; Api*/Demo* selection only |
| 5 | Demo = composition/data injection | ✅ | `registry.ts` + `src/targets/*`, no second app |
| 6 | Client registry imports no Demo | ✅ | `registry.client.ts` grep: only doc comments mention demo |
| 7 | Client API-backed set = 8 | ✅ | auth, users, roles, students, teachers, rooms, classes, enrollments |
| 8 | Unsupported client domains → `DOMAIN_UNAVAILABLE` | ✅ | 12 ids, `createUnavailableRepository` |
| 9 | No invented endpoints | ✅ | no speculative REST paths; unavailable is explicit |
| 10 | No Demo fallback in client | ✅ | composition swap; asserted by source + bundle tests |
| 11 | Demo lifecycle exists | ✅ | `domains/demo/lifecycle.ts` (uninitialized/empty/demo) |
| 12 | Removal ownership-safe + fail-closed | ✅ | 7 typed pending reasons; nothing deleted on doubt |
| 13 | Production lock at service level | ✅ | `assertDemoOperationAllowed` → `DemoDisabledError` |
| 14 | Client bundle Demo-free | ✅ | verified against a real `dist/client` |
| 15 | Demo bundle carries Demo capability | ✅ | verified against a real `dist/demo` |
| 16 | Provenance inside the dataset payload | ✅ | `stampDatasetProvenance`; no third key exists |
| 17 | No blanket storage/DB wipe | ✅ | production code contains none (tests only) |
| 18 | Unknown ownership preserved | ✅ | blob removal limited to seed ids; unknown kept |
| 19 | Delivery idempotent | ✅ | re-run: `changed:false`, no destructive step |
| 20 | Re-running cannot delete customer data | ✅ | customer verdict → lock only, bytes untouched |

**Two caveats to this table** (both pre-existing, neither a Phase-2A defect): the *demo* composition's disclosure under-reports one domain (§4/§5), and the base commit itself does not typecheck (§2/B).

---

# 4. REAL BUGS

**BUG-1 — the demo-served disclosure omits `organization` (real, pre-existing since M11).**
`registry.ts` states its rule in its own header: “The domains above that resolve to the demo implementation in **BOTH** modes are listed ONCE, here.” `getOrganizationRepository()` resolves `DemoOrganizationRepository` in both modes (its comment says “Demo-backed even in API mode, exactly like branding”), and `branding` **is** listed — `organization` is not. The sets prove it exactly: `DEMO_SERVED_DOMAINS` (11) ⊂ `UNAVAILABLE_DOMAINS` (12), and the single difference is `organization`.
Consequence: in the demo composition running against a real backend (`api` mode, the customer-facing configuration), an academy's session rules, working hours and make-up ceiling are read from the local demo store **without** the D8 notice naming them — the precise dishonesty D8 exists to prevent.
Searches show this is **not** catalogued: `OPEN_ITEMS.md` I20 is about *compensation*, not organization; no I-item or limitation names organization. It is a live, undocumented gap on **both** lines (main's `DEMO_SERVED_DOMAINS` is byte-identical in shape: the same 11 ids, and main's test still pins `toHaveLength(11)`).

**BUG-2 (base, not Phase 2A) — the base commit does not typecheck.** 25 errors across 11 files (§2/B). Main repaired this class of error in S5; this line never received those commits, and the working tree carries the repair.

**No other implementation defect was found** in the delivery path, the lock, provenance, the key inventory, the boundary or the registries.

---

# 5. GOVERNANCE DECISIONS REQUIRED

The organization discrepancy is **not** an implementation bug in Phase 2A's scope and **not** a slip in the new code: it is a pre-existing **contract conflict** between three governance artifacts and the registry's behaviour —
(i) `DEMO_SERVED_DOMAINS`' own definition (“resolves demo in BOTH modes”), (ii) the D8 record (“the **eleven** getters that resolve Demo in both modes”, DECISIONS.md), and (iii) the pinned count `expect(DEMO_SERVED_DOMAINS).toHaveLength(11)` plus the banner's own docstring (“eleven domains still read the demo store”).

**Files/tests/docs that pin or depend on the 11-entry contract**

| Kind | Artifact |
|---|---|
| Code | `src/domains/registry.ts` (the enumeration + its header rule), `src/components/shell/DemoBackedNotice.tsx` (docstring “eleven domains”) |
| Test | `src/components/shell/__tests__/DemoBackedNotice.test.tsx` — `toHaveLength(11)` (line 85), the 11-class array and the 11-getter array (lines ~104–130), the comment “All eleven, in one enumeration (the D8 count)” |
| Governance | `docs/engineering/DECISIONS.md` D8 (§ “the **eleven** getters that resolve Demo in both modes”; the Status record), `docs/engineering/PROJECT_STATE.md` (lines ~117, ~225, 1048, 1076, 2287), `docs/engineering/PHASES.md` (M11 row, line ~1745), `docs/engineering/F2_REPORT.md` (line 29, “11 domains”), `docs/frontend-completion/01-audit-reconstruction.md` (line 9, “11 DEMO_SERVED_DOMAINS”) |

---

### OPTION A — add `organization` to the disclosure contract

**Change:** one entry in `DEMO_SERVED_DOMAINS` (`{ id: "organization", label: "قواعد آموزشگاه" }`), the D8 pin’s count and arrays, and the D8 wording in the docs listed above.

* **Files affected:** `src/domains/registry.ts`; `src/components/shell/__tests__/DemoBackedNotice.test.tsx` (11 → 12: count, class list, getter list); the five governance documents above (wording “eleven” → “twelve” where it describes the enumeration).
* **Tests affected:** `DemoBackedNotice.test.tsx` (the pinned count and the two arrays — a **deliberate, reviewable** test change that follows the contract, not a weakening); `architectureBoundaries`/`bundleBoundary` unaffected (organization remains unavailable in the client, `UNAVAILABLE_DOMAINS` unchanged at 12).
* **Architectural consequences:** the two enumerations become the **same 12-member set** — the client shows organization as unavailable, the demo composition shows it as demo-backed *and* disclosed. No new module, no new seam, no second app.
* **Migration/data consequences:** none. `organization` is already a demo dataset citizen with no storage key of its own; nothing is written, deleted or moved.
* **Governance consequence:** the D8 record is amended under owner authority (it is a recorded decision, so amending it — not silently editing a test — is the correct form). The gap closes and cannot silently reopen, because the tripwire test already walks every listed getter.

### OPTION B — remove/disable `organization` from Demo serving

Narrow, defensible form: keep the demo implementation in **demo** mode, make the getter mode-aware so `api` mode returns the explicit unavailable repository (mirroring the client matrix exactly).

* **Files affected:** `src/domains/registry.ts` (getter + imports of `createUnavailableRepository`/`UNAVAILABLE_DOMAINS`); the organization surfaces’ callers are untouched; the D8 enumeration stays at **11**.
* **Tests affected:** the organization-domain and settings tests that exercise rules/working-hours in `api` mode would need to expect the unavailable result; **`src/__tests__/bundleBoundary.test.ts` (new in Phase 2A) currently asserts the demo bundle does *not* contain “هنوز به سامانهٔ سرور متصل نیست”** — Option B pulls that copy into the demo bundle through `unavailableRepository.ts`, so that assertion would have to be revisited (it is our own new test, not governance-pinned, but the *claim* it protects — “the demo build never claims a missing backend” — would become false for this domain).
* **Architectural consequences:** the demo composition gains a second, mode-dependent answer for one domain; the demo build’s honest story changes from “these domains are local” to “this one is local in demo, unavailable against a server”; the client and demo compositions stay consistent with each other.
* **Migration/data consequences:** none — the dataset row and the demo repository stay where they are; only the api-mode selection changes.
* **Governance consequence:** D8’s eleven-entry record stays literally true, but its stated rule (“resolves demo in **both** modes”) now has an exception that must be documented in the same breath; the *product* loses working session-rules/hours configuration whenever a real backend is configured, which is a product-visible behaviour change, not a disclosure fix.

**Do nothing (status quo)** remains available: record the gap as an open item (an I-number in `OPEN_ITEMS.md`) with the same rigour I20 got for compensation. That is a decision too, and it is the only option that requires no code or test change.

**Owner surface sizes:** OPTION A = 1 source file + 1 test file + 5 governance documents. OPTION B = 1 source file + 1 new-test assertion + the organization/settings tests + 1–2 governance documents.

---

# 6. D9 BUDGET

**Do not modify the budget. Numbers, all measured today with the test's own methodology (`gzip -6 -n`, CLI, one invocation per file):**

| Measurement | Value |
|---|---|
| Current cap asserted in **this checkout's** test | **305,805** (baseline 291,243 × 1.05; baseline recorded at `c16890f`) |
| clean base `eb973eb` (no WIP; built in a throwaway `/tmp` worktree) | **347,609** |
| current WIP tree (default demo build) | **352,410** |
| WIP delta over clean base | **+4,801 gzip (+1.38%)** |

**The cap is already violated by the clean base — by 41,804 gzip (≈13.7%).** The anchor is stale, not the code.

**Where the governance is defined, and where the baseline is recorded**

* The gate: `src/__tests__/bundleBudget.test.ts`, whose header records D9's shape (entry must strictly decrease from the `c16890f` anchor 273,791; total may grow ≤5% over the recorded total; no chunk ≥400,000; vazirmatn 300/800 must not return; raising `chunkSizeWarningLimit` is a failure).
* The decision: `docs/engineering/DECISIONS.md` → **D9** (“The bundle budget is measured before it is set”), landed with M11 at `3eed4f1`/`24998d8`.
* **The re-baseline already exists on the other line:** DECISIONS.md **§22** — “The performance budget is re-baselined on the measurement taken after the D9-A-lite reduction”: baseline **343,947**, cap **361,144**, *“In force 2026-09-25. A governance-document decision… the owner selected this direction explicitly on 2026-09-25”*. Main's `bundleBudget.test.ts` asserts exactly `GZIP_TOTAL_BASELINE = 343947`, `GZIP_TOTAL_CAP = 361144`.

**What this means:** under the landing line's own recorded anchor, today's WIP (**352,410 ≤ 361,144**) **passes**. The failure exists only because this branch predates the §22 re-baseline.

**Owner approval required:**
1. To adopt §22/D9-B on the landing line — this is *already an owner-recorded decision* (2026-09-25), so approval is procedural (carry the re-baseline commit / merge main), not a new threshold negotiation;
2. Only if a *different* anchor is wanted: a new written decision record, re-measured with the same method — never a silent edit of the test, and never a relaxed shape clause.

---

# 7. PROJECT STATE / HISTORY

`src/__tests__/projectState.test.ts` reads four SHAs out of `PROJECT_STATE.md` (`Phase checkpoint (application)`, `Previous phase checkpoint`, `Documentation checkpoint (pushed)`, `Previous documentation checkpoint`), then asserts, against Git: each is a commit in this clone; each precedes the next; HEAD equals or descends from them; the docs checkpoint really touches `docs/engineering/`; **no document quotes a 40-hex SHA that is not a commit reachable from HEAD**; and **the recorded “Working branch” equals the branch actually checked out**.

**A. Missing Git objects — because the clone is shallow.** Failing values: `33b10311…` (CURRENT), `aca40c5d…` (PREVIOUS), `6ca25be6…` (DOCS), `3ed0bfe4…` (PREVIOUS_DOCS), plus `a3867a60…` quoted inside PROJECT_STATE.md. `.git/shallow` grafts **both** tips, so no history exists behind `eb973eb`. 8 of the 10 failures are this class.

**B. Actual branch mismatch.** `PROJECT_STATE.md` records `| Working branch | `main` — canonical since 2026-09-20 (PR #5 merged)…`, and the test asserts the checkout branch equals it. The checkout is `arena/01a0e8ec-parsian-music-dashboard-opus`, so the test fails **by construction** — 1–2 of the 10 failures.

**C. Actual application failure.** **None.** This suite tests documents and Git; it says nothing about Phase 2A's code.

**Correct remedy (a combination, in this order):**
1. **Full history** for the objects (a full clone, or `git fetch --unshallow` — network, and therefore owner-authorized; never fabricating SHAs);
2. **Lineage reconciliation** for the branch clause: the docs record `main` as canonical, so the honest resolutions are “run the suite on `main` after Phase 2A lands there” (recommended — see §9) or “record the session branch in the governance docs, verified by `git rev-parse`” (a governance change, and it also has to satisfy the SHA rules);
3. **Never** relax, skip or delete the suite, and never update the recorded SHAs by hand.

---

# 8. G-7

**Expected artifact (found on main, absent here):** G-7 is an **F1 library/gallery audit gap** — “**Library ‘teacher’ search**”: the spec promised search by title/composer/**teacher**, but `LibraryItem` had no teacher field, so the view used `composer` as a proxy while the placeholder («جستجوی عنوان، آهنگساز یا مدرس…») claimed otherwise. It was closed by an **owner data-model decision** (register a real `teacherId` on `LibraryItem`; the composer is no longer a teacher proxy), recorded as **DECISIONS.md §24**, reported in **`docs/engineering/F1_REPORT.md`** §4 (“G-7 — Library ‘teacher’ search — **CLOSED** (data-model decision, owner)”) and reconciled with **`docs/frontend-completion/06-library-gallery-spec.md`**.

**References:** `eb5b559:docs/engineering/F1_REPORT.md` (§4, §5 table, §6), `DECISIONS.md` (§24 + the F1 records), `06-library-gallery-spec.md`, `docs/session-handoffs/PR18_*`; commits `7c9b199` (G-7 back to OPEN), `8e6bce9` (PR #17: G-1…G-6 closed, G-7 OPEN), `096723b` (G-7 closed with a real teacher relationship), `ef4eb84`/`38605cf` (spec + handoff).
**Current absence in this checkout:** a case-insensitive search for `G-7`/`G7` over `src/`, `docs/`, `package.json`, `README.md` returns no G-7 artifact (only legacy fixture ids `g7`–`g15` and a GHSA id). Independently: our `src/domains/library/types.ts` contains **0** occurrences of `teacherId`; main's contains **7**.
**Does it block Phase 2A acceptance?** **No** — it is an F1 acceptance item, land-marked on main's line; it does not measure Phase 2A, and no Phase 2A gate references it. **But:** G-7 changed library files that Phase 2A *also* changes (`useLibrary`, library demo content, the library tests, the domain types + seed), so whichever line Phase 2A lands on must be reconciled with G-7 to avoid regressing it.

---

# 9. SAFE LANDING PLAN

Nothing below is executed. Every step preserves the current WIP, uses no history surgery, and keeps the architecture intact (one app + API data + demo injection + safe removal + production lock + strict client boundary).

**Step 0 — preserve the WIP outside Git (do this before anything else).**
Create `/home/user/phase2a-wip-backup/` — **inside the workspace root, because `/tmp` is not persisted** — containing: `phase2a.patch` (`git diff HEAD`), `untracked.tar` (the 31 untracked paths, excluding the two report files if desired), `status.txt` (`git status --porcelain`), `sha256sums.txt`. Deliberately **not** `git stash` (forbidden, and a stash is invisible to the owner’s review).

**Step 1 — decide the landing line (DECISION 1).** Recommended: **main**, because main already carries the base repair (S5), the D9-B re-baseline (§22) and G-7 — i.e. landing on main resolves BUG-2, the D9 failure and the G-7 absence by construction, leaving only the organization decision. Landing on this line instead means carrying the repair set and (to clear D9) importing main's §22 re-baseline.

**Step 2 — prepare a clean landing checkout (owner-authorized network operations; never force-push, never rewrite).**
Fresh `git clone` of the repository (best: gives full history, which also satisfies §7/A) → new branch from `origin/main`, e.g. `arena/phase2a-landing`. Do this in a *separate directory* so the current checkout is never disturbed; the current worktree stays exactly as it is.

**Step 3 — apply the WIP in three reviewable commits, by explicit path (never `git add -A`).**
1. **`chore(types): base repair (S5 parity)`** — the 11 files / 25 errors of §2/B. On main most of these hunks already exist: apply with `git apply --3way` and **verify each hunk is genuinely absent upstream** before keeping it (e.g. `EntityExportButton.tsx` already reads `"warning"` on main; `export/definitions.ts` and `ImportExportCenter.tsx` are byte-identical on main). Anything already upstream is dropped, not re-committed.
2. **`feat(phase-2a): shared app — composition seams, explicit unavailable, production lock`** — the 28 new files (§2/A) + the seam-migration hunks (§2/C) + the six build/config files (§2/F). Hunks only, via `git add -p` for the 18-file conflict surface.
3. **`test(phase-2a): lock, delivery, composition and bundle-boundary gates`** — the 4 new suites + the modified gate suites (§2/E).
   If the owner wants the phase recorded, a fourth **docs** commit (PHASES/PROJECT_STATE/DECISIONS entries describing Phase 2A, plus the organization decision) — governance text authored with the owner, not by the implementer.

**Step 4 — validate on the landing branch (full ritual; `dist/` and `node_modules` are not persisted here).**
`npm ci` → `npm run typecheck` → `npm run build:client` → `npm run build:demo` → `npx vitest run src/__tests__/bundleBoundary.test.ts` → `rm -rf dist && npm run build` → full `npx vitest run` → `git diff --check`.
Expected on main's line: **0 failures** — `bundleBudget` 352,410 ≤ 361,144; `projectState` satisfied by main's branch + full history; G-7 present. Any remaining failure is a stop-and-report, not a test edit.

**Step 5 — integration (only after Steps 1–4 and the organization decision).**
Open a PR from the landing branch into `main`; the owner reviews the three commits; merge only on explicit instruction. Do not touch the preserved historical branches; do not rewrite anything; the current session checkout remains untouched throughout.

**Step 6 — rollback path.** The Step-0 backup plus `git status --porcelain` re-verification; a failed landing is abandoned by deleting the separate clone — the original worktree, its WIP and its branch are never modified.

---

# 10. OWNER DECISIONS REQUIRED

| # | Decision | Blocks | Recommended (not decided) |
|---|---|---|---|
| 1 | **Landing lineage:** land Phase 2A on **main's line** (39 commits ahead) or on **this line** (`eb973eb` + WIP)? | Everything downstream: conflict surface, D9 outcome, G-7 presence, projectState | main's line |
| 2 | **Organization disclosure:** OPTION A (add to the enumeration; 12/12 sets, amend D8 record) vs OPTION B (make it mode-aware; unavailable in api mode) vs record as an open item (status quo) | The only open Phase-2A-adjacent honesty gap | A (matches the enumeration's own rule; no behaviour loss) |
| 3 | **D9 budget:** adopt the already-recorded §22 re-baseline (cap 361,144) on the landing line — or commission a new measurement/decision | The single code-gate failure | Adopt §22 (it is already an owner decision, 2026-09-25) |
| 4 | **Historical projectState:** authorize full-history access (fresh clone / unshallow) and the branch reconciliation (run on `main`, or record this branch in the docs) | The 10 document/Git failures | Full clone on `main` after landing |
| 5 | **G-7:** accept that G-7 (F1 library teacher search) arrives with main's line rather than being re-created here — and require the landing to reconcile the library files it touched | Library/gallery non-regression at landing | Accept + reconcile |

---

## Compact decision list

```
DECISION 1 — Landing lineage:        main's line (39 commits ahead) vs this line (eb973eb + WIP)
DECISION 2 — Organization disclosure: OPTION A (add, 12/12) vs OPTION B (mode-aware, 11) vs open item
DECISION 3 — D9 budget:              adopt recorded §22 re-baseline (cap 361144) vs new decision
DECISION 4 — Historical projectState: authorize full history + branch reconciliation; never edit the test
DECISION 5 — G-7:                    accept it with main's line; reconcile library files at landing
```

None of these is decided here. No source file was touched; no commit, push, merge, rebase, reset, clean, stash or branch switch was performed; the working tree still holds **78 modified + 31 untracked** files exactly as found (plus this analysis document).
