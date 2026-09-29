# PHASE 2A — SAFE LANDING REPORT (RECREATED)

**Verdict: LANDING COMPLETE — NOT PUSHED, NOT MERGED. Awaiting explicit owner approval.**

> **Recreation note.** The first landing (branch `arena/phase2a-landing`, commits
> `c8734a0`/`c2bd2f9`/`c675047`) was lost when the sandbox wiped `/home/user/phase2a-landing`; its
> report was lost with it. This document is the recreated record of the **second** landing, built
> from the preserved backup by the identical method and verified against the same expectations.
> The recreated commit SHAs are `1b96db7` / `1c8b832` / `2df607e`. Evidence that the recreation is
> faithful: identical change set (103 files, +3453/−685), identical built chunk hashes
> (`index-BMhVg0_F.js` / `index-DU355MkG.js` / `index-ClGxcDcZ.js`), identical D9 figure (361,037),
> and identical per-file conflict-resolution outcomes.

---

## 1. Landing workspace, branch, base

| Item | Value |
|---|---|
| Landing workspace | `/home/user/phase2a-landing` (clone, outside the repo) |
| Landing branch | `arena/phase2a-landing` |
| Base SHA (== `main`) | `eb5b5598774bdadd0a7aabab01d88e564dcb867d` |
| Base tree | `c70bebef7899c18c1ab1a9ade49f44a15ea581e0` (== `main^{tree}`, verified) |
| Commits added | **3** (see §3) |
| Final SHA / tree | `2df607eff5f1ea1fe85e86381b9b0398fec81d18` / `6eb78338ec19880adf5f97735f61de32e11cbf20` |
| Diff vs base | 103 files changed, +3453 / −685 |
| Working tree | clean (`git status --porcelain` empty) |
| `git diff --check` | clean (0) |

**Deviation (disclosed):** the session's repository branch is locked to
`arena/01a0e8ec-parsian-music-dashboard-opus`, so the landing branch was created in the separate
clone; the original checkout received no commits, branches, or index changes.

**History note:** this clone carries **full history** (fetched from GitHub read-only), so
`projectState.test.ts`'s git-object suite evaluates natively: **52/52**, no test modified.

## 2. Conflicts resolved (7)

`git apply --3way --binary` applied 68 files cleanly and conflicted on the same 7 files as before.
Resolution rule: **keep main's newer implementation; port the Phase 2A seam around it; never replace
main with the old WIP; never import demo credentials into a shared view.**

| File | Resolution |
|---|---|
| `src/views/Login.tsx` | Kept **main's 736-line login** (corner toggle `KeyRound`, `DemoPanel(open)`, `data-demo-panel`, two-column account grid). Its demo affordances swapped to the seam: `DemoBackedNotice` → `LoginSourceNotice`, `lifecycleRecovery` → `LoginAssist`; corner block + `DemoPanel` moved **verbatim** into `src/targets/targetFeatures.tsx` (214 lines). Shared login: 0 occurrences of `DEMO_PASSPHRASE`/`listDemoAccounts`/`DemoPanel`/`useIsDemoEnvironment`/`DemoBackedNotice`; 736 → **634 lines** (same as the lost landing). |
| `src/views/Dashboard.tsx` | Main's structure kept; `DemoNote` from `@/targets/environment`; `ErrorState`/`LoadingState`/`useAuthSafe` untouched. |
| `src/domains/export/exportService.ts` | **Main's version** (main deliberately replaced the `Permission`/`EXPORT_PERMISSIONS` guard) — byte-identical to main, not committed. |
| `src/domains/gallery/GalleryPanel.tsx` | **Main's version** — byte-identical to main, not committed. |
| `src/domains/gallery/__tests__/GalleryAlbumSwitch.test.tsx` | **Main's version** — byte-identical to main, not committed. |
| `src/views/__tests__/studentsScopeLeak.p1.test.tsx` | **Main's version** — byte-identical to main, not committed. |
| `src/api/__tests__/mobileContract.test.ts` | Main's newer `authorizationOf()` helper **preserved** (3 uses); closure-captured headers typed as a ref; registry scan retargeted to the split root (`registry.ts` + `registryCore.ts`) — assertion unchanged (`expect(matches.length).toBe(1)`). |

Moved-symbol fallout cleared: `DemoNote` → seam wherever main used it (`TeacherDashboard.tsx`
additionally), `DemoUserRepository`/`DemoRoleRepository` import paths (`exportTruncationTone`,
`classesWriteAffordance`), `MIN_PASSPHRASE_LENGTH`, `SESSION_TTL_MS`, `useDataLifecycle`. Two
main-code imports restored: `Classes.tsx`'s `canWriteClasses` writer gate (main uses it for
`mayWrite`) and `Scheduling.tsx`'s `academyNow` (the Phase 2A anchor initializer). Typecheck
residue reproduced exactly as documented (2 errors) → fixed → **0**.

## 3. Commits (explicit paths, reviewed before each; no `git add -A`)

| # | Commit | Scope |
|---|---|---|
| 1 | `1b96db7` `chore(build): Phase 2A build profiles` | 5 files: `package.json`, `vite.config.ts`, `tsconfig.client.json`, `tsconfig.demo.json`, `src/env.d.ts` |
| 2 | `1c8b832` `feat(phase-2a): composition seams and production delivery lock` | 72 files: registry split, seams, lifecycle/delivery lock, provenance, demo-only modules |
| 3 | `2df607e` `test(phase-2a): boundary, delivery, lock and registry tests` | 26 files: 4 new suites + seam/registry retargets + `src/test/setup.ts` |

Commit subjects follow the owner's naming from the recreate instruction; bodies carry the
documented descriptions and the `Co-authored-by: arena-agent` trailer.

**The `chore(types): base repair` commit is EMPTY — a finding, not an omission.** Every repair of
the §2/B set is already upstream on main: (a) main's tree typechecks with **0 errors** in
isolation, and (b) the four repair-only files resolve to main's content and are therefore
byte-identical to main. Re-committing them would duplicate main's work; nothing was mislabelled.

## 4. Classification (A–F, from the verified backup — not filenames)

| Class | Count | Note |
|---|---|---|
| A — Phase 2A implementation | 28 new files + core edits | `src/targets/*` (12), `registryCore/client.ts`, `deploymentLock.ts`, `delivery.ts`, `unavailableDomains/Repository.ts`, `demoUserRepository`, `demoRoleRepository`, `passphrase`, `session`, `ProductionDeliveryGate`, `demoStore` provenance, lifecycle removal |
| B — tests | 26 files | 4 new suites + retargets |
| C — config/build | 5 | Commit 1 |
| D — base repairs | **0 remaining** | all upstream on main (§3) |
| E — main conflicts | 7 | §2 |
| F — reports | excluded | `PHASE_2A_*.md` are audit artifacts; not landed, not committed |

## 5. Step 6 — Organization / D8 (resolved by main's own record; nothing silently changed)

Main carries the owner decision **D8 — "api mode must disclose which domains are still local"**
(recorded 2026-09-16, landed at `53794d5`). On the landing:

* `DEMO_SERVED_DOMAINS` is **byte-identical to main** (11 entries); the organization getter is
  **byte-identical to main**; `DemoBackedNotice.test.tsx` is **unchanged from main** and passes.
* **No 11→12 flip, no governance doc touched** (`git diff --base..HEAD -- docs/` is empty).
* Organization appears only in the **client** composition's `UNAVAILABLE_DOMAINS` (12 entries) —
  never demo data in the client build.

**Recorded observation (owner decision pending; NOT changed):** the organization domain was added
on 2026-09-22 (`606e95cb`) as a 12th demo-in-both getter without updating D8 or the list. The
enforced test iterates the list itself and pins its length to 11, so the omission is undetectable.
See `PHASE_2A_DECISION_AUDIT.md` (read-only audit, classification C).

## 6. Preserved main-line work

* **G-7 intact:** `TeacherDashboard.tsx` changes by 1 line only (the `DemoNote` seam import).
* **D9 intact (main's §22):** no budget edit. Landing measurement (canonical `gzip -6 -n`, bare
  build): total **361,037 ≤ cap 361,144**; entry 135,153 < 273,791; largest 135,153 < 400,000.
  ⚠️ **Headroom 107 bytes** (main alone was 356,039 — 70.3% of the allowance consumed before this
  work) — risk information only; no documented warning band exists.
* **No unrelated reverts:** no docs/governance file changed; no second app or route tree.

## 7. Evidence — commands and results (post-commit, on the committed tree)

| Step | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | **0 errors** |
| `npm run build:client` | PASS — `index-BMhVg0_F.js` 261.83 kB (gzip 78.08) |
| `npm run build:demo` | PASS — `index-DU355MkG.js` 477.50 kB (gzip 135.86) |
| `npm run build` (bare) | PASS — `index-ClGxcDcZ.js` 477.50 kB; D9 total **361,037** |
| `bundleBoundary.test.ts` | PASS — **both real scans RAN** (15 ms / 16 ms); 2 by-design placeholders skipped |
| Focused Phase 2A (5 suites) | **37/37** |
| `mobileContract.test.ts` | 24/24 |
| `projectState.test.ts` | **52/52** |
| Full suite | **195 files / 2563 passed / 2 skipped / 0 failures** |
| `git diff --check` | clean |
| `git status --porcelain` | empty |

**Boundary hand-check:** `ava:demo:dataset`, `ava:demo:credentials`, `@demo.local`, `arena-demo`,
`بدون امنیت واقعی` → 0 in `dist/client`, ≥1 in `dist/demo`; client unavailable-notice copy present
in `dist/client`, absent in `dist/demo`.

## 8. Production safety (service-level, verified by the suites)

Confirmation + ownership proof before removal; unknown/unreadable ownership preserved; no
`localStorage.clear` / `sessionStorage.clear` / `indexedDB.deleteDatabase`; idempotent and
interruption-safe; fail-closed; demo credentials/session removed after cleanup; post-`LOCKED` demo
operations refused at the **service** layer (`DemoDisabledError`).

## 9. WIP preservation

Original checkout `/home/user/parsian-music-dashboard-opus`: branch
`arena/01a0e8ec-parsian-music-dashboard-opus`, HEAD `eb973eb` (**no new commits, 0 staged**),
`phase2a-wip-backup/phase2a-tracked.patch` sha256 **`aed92770…`** (unchanged), no `dist/`, no
`node_modules/`. No reset/clean/checkout/rebase/merge/stash was performed.

## 10. Persistence

`phase2a-landing-artifacts/phase2a-landing.bundle` — self-contained bundle (complete history),
sha256 `6e7e51731b96448ab20f59dcdcc246d851fa3274d6acfdff4e5639991f095842`, verified by cloning from
the bundle alone: history present, final commit/tree hashes match, base is an ancestor, working tree
clean, `diff -r` vs the landing source = **0 differences**. See
`PHASE_2A_LANDING_FINAL_MANIFEST.txt` for the recovery procedure.

## 11. STOP

Nothing was pushed. No PR. No merge. No amend. Awaiting explicit approval for the push/PR step.
