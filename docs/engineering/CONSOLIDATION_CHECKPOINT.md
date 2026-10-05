# CONSOLIDATION CHECKPOINT — 2026-10-05

> **Purpose.** This is the evidence record for the consolidation checkpoint on
> `arena/01a0f73f-parsian-music-dashboard-opus`. It exists so that a reader who
> arrives fresh — including the owner, working from a local clone — can see what
> was verified, what was found, and what is still open, without re-deriving it
> from chat history.
>
> **Nothing in this file changes code.** It records state as observed.

---

## 1. Checkpoint identity

| Item | Value |
|---|---|
| Branch | `arena/01a0f73f-parsian-music-dashboard-opus` |
| Base of this branch | `7215633` (on `cleanup/demo-migration-lineage`) |
| Remote tip before this checkpoint | `7eba988` |
| Commits consolidated | 55 (`7215633..7eba988`) |
| Phase 5.6.2 delta | 2 files, +37 lines, 0 deletions |
| Protected refs left untouched | `main` (`15775ea`), `cleanup/demo-migration-lineage` (`86dab3f`), `backup/pre-f2-2026-09-29` (`62deb84`), `docs/demo-migration-plan` (`1b23336`) |

---

## 2. Working-tree recovery evidence

The sandbox repeatedly reverted the local HEAD pointer to `7215633` while the
working tree held the content of `7eba988`. This is an environment fault, not a
repository state — it was confirmed, not assumed:

| Check | Result |
|---|---|
| GitHub API `compare/7215633...7eba988` | `status: ahead`, **`behind_by: 0`**, `ahead_by: 55`, merge-base `7215633` |
| Local ancestry | `git merge-base --is-ancestor 7215633 7eba988` → true |
| Byte-compare of all 930 tracked files against `7eba988` | **928 identical, 2 differing, 0 missing** |
| The 2 differing files | exactly `vite.config.ts` and `.env.example` — the intended Phase 5.6.2 changes |
| The 93 apparently "untracked" files | an artefact of the stale git index; all 93 are tracked at `7eba988` |

**Recovery procedure used (non-destructive, no reset/rebase/cherry-pick/force-push):**

1. sha256 manifest of all 930 files → preserved outside the repo
2. byte-copy of the 2 modified files → preserved outside the repo
3. `git fetch --unshallow` + `git fetch origin '+refs/heads/*:refs/remotes/origin/*'` + `git fetch origin --tags`
4. `git stash push --include-untracked` (recoverable snapshot)
5. `git merge --ff-only origin/arena/01a0f73f-parsian-music-dashboard-opus`
6. byte-compare post-recovery against the pre-recovery manifest → identical except the 2 intended files

Result: `HEAD = 7eba988`, `ahead = 0`, `behind = 0`, working tree clean except
the two Phase 5.6.2 files.

---

## 3. Phase 5.6.2 — the committed delta

### `vite.config.ts` (+30)

Adds `server.proxy` mapping `/api` → `http://127.0.0.1:8080`.

- **Dev-only.** `server.*` is read by the Vite dev server; `vite build` never
  reads it. Verified: both production bundles contain **zero** occurrences of
  `127.0.0.1:8080`.
- **Same-origin**, so the shipped CSP `connect-src 'self'` still holds and **no
  CORS configuration is required** on the Laravel side.
- **No rewrite, no path stripping** — `/api/v1/...` is forwarded verbatim,
  which is exactly what `VITE_API_BASE_URL=/api/v1` already sends.
- Port 8080 is the port `deploy/nginx.conf` and `docs/engineering/BACKEND_STATUS.md`
  already agree on.
- Does **not** change which data source is selected; that remains
  `VITE_DATA_SOURCE`, whose demo default is untouched.

Why it matters: without it, `VITE_DATA_SOURCE=api` under `npm run dev` is a
trap — Vite has no `/api` route, so its SPA fallback answers `200` with
`Content-Type: text/html`. The client then fails parsing HTML as JSON, which
reads like a broken backend rather than a missing one.

### `.env.example` (+7)

Documentation comments only. **No value changed.** The three assignments remain
`VITE_DATA_SOURCE=demo`, `VITE_API_BASE_URL=/api/v1`, `VITE_ACCESS_PATH=`.

---

## 4. Verification gates (all re-run at this checkpoint)

| Gate | Result |
|---|---|
| Frontend test suite (with `dist/` removed) | **204 files, 2654 passed, 18 skipped, 0 failed** |
| `npm run typecheck` | **0 errors** |
| `npm run build:demo` | success, 43 files, **0** × `127.0.0.1:8080` |
| `npm run build:client` | success, 39 files, **0** × `127.0.0.1:8080` |
| `127.0.0.1` anywhere in `dist/` | **0 files** |
| `git diff --check` | clean |
| Backend CI at `7eba988` (5 checks) | all **success**, including *MySQL 8 — connection, migrations, P-2 indexes, test suite* and *HTTP smoke — T-02 / PB-1 / PB-3 / scheduling / attendance* |

Backend runtime verification is **environment-blocked** in Arena: no PHP, no
Composer, no MySQL. Per the phase rule this is marked blocked rather than
claimed, and relies on the established CI evidence above.

---

## 5. Repository-vs-requirements audit (read-only, audits e & f)

Performed against baseline `afa84d6`. No code was changed by either audit.

### 5.1 Gallery — **PARTIAL**

| Layer | State |
|---|---|
| Route (`App.tsx:64` `gallery: GalleryView`) | implemented |
| Route guard (`ViewOutlet`, `App.tsx:69`) | implemented, **frontend-only** |
| Action guard (`Gallery.tsx:55` `useCan("library.write")`) | implemented, **frontend-only** |
| Dedicated `gallery.*` permission | **missing** — borrows `library.read` |
| `gallery/apiRepository.ts` | **missing** |
| Backend route / policy / model / migration | **missing** |
| Tenant scoping in `localRepository.ts` | **missing** |
| Tests asserting Gallery authorization | **zero** |

Provenance: no Gallery API client, backend controller, policy, or migration
exists on **any** local commit, remote branch, or tag. This is therefore
**never implemented**, not "lost in history" — it needs new work, not recovery.

Computed role→view matrix: `gallery` requires `library.read` ⇒ accessible to
administrator, manager, teacher, staff; denied to accountant. Gallery mutations
require `library.write` ⇒ **administrator and manager only**. No `student` role
exists in the vocabulary at all (`ROLES = administrator, manager, teacher,
staff, accountant`).

### 5.2 Tickets — **deliberately unified with Chat, not missing**

An earlier reading classified Tickets as missing on the basis of zero files.
Closer inspection shows this is an intentional design decision, not an omission:

- The spec (`docs/frontend-completion/10-integration-architecture.md:110`) states
  *"No tickets vs chat distinction — chat is tickets currently — needs decision …
  OPEN."*
- The code implements it: `ChatConversation` carries `archived?: boolean` and
  `subjectId?: string`, and `archiveConversation()` is documented as reversible.
- Mapping: **conversation = ticket**, **archived = closed**.

Open item **O-07** (whether to separate tickets from chat) remains OPEN.

### 5.3 Previously-completed phases F1–F6

| Phase | Verdict | Evidence |
|---|---|---|
| F1 | implemented | Gallery panel present (see §5.1 for its limits) |
| F2 | **implemented** | `src/domains/auth/scope.ts` exists with 20 exported predicates, consumed by 5 production modules; `failureDisclosureI15.test.tsx` and `routeProtection.test.tsx` present |
| F3 | **implemented** | `src/domains/branding/`, `ManualColorsPanel.tsx`, `Settings.tsx` |
| F4 | **implemented** | `src/domains/export/`, `ImportExportCenter.tsx`, export tests |
| F5 | **implemented** | `dashboardInsights.ts`, `useDashboardInsights.ts` |
| F6 | **partial** | chat + `Messages.tsx` present; Tickets as described in §5.2 |

### 5.4 Feature inventory — 20 product areas

- **Frontend + backend:** Auth/RBAC, Students, Teachers, Scheduling, Files/Media, Settings, Admin-only
- **Frontend only:** Dashboard, Messages, Chat, Gallery, Branding/Theme, Export, Reports, Finance, Workflow/Compensation, Learning
- **Partial:** Calendar (unbacked `apiRepository`); org/tenant scoping (backend has `ResolveTenant` + `TenantContext`; several frontend domains lack it)
- **No backend at all:** Finance, Reports (both deferred, marked `I2`)

### 5.5 Documentation drift (docs left unedited — recorded, not fixed)

| Item | Docs say | Code does |
|---|---|---|
| **I22** | OPEN | fixed, with a regression guard at `src/views/__tests__/phaseBMutationGuards.test.tsx:123` |
| **I23** | OPEN | fixed, with a regression guard at `backend/tests/Feature/SchedulingTest.php:398`; `ConflictDetector::overlappingSessions()` excludes the candidate via `whereKeyNot()` |
| **Gallery permission** | O-03 OPEN, spec says "for now public demo" | code silently borrows `library.read` — an unrecorded decision |
| **Progress matrix** | documented complete | backend complete, frontend incomplete |

---

## 6. Invariants confirmed intact

| Invariant | Location | State |
|---|---|---|
| `if (!admin) throw` | `src/views/__tests__/honestWriteCopy.test.tsx:121` | intact |
| `SEED_DATE` | pinned `"2026-09-01"` | untouched |
| P-2 index limit (3060 ≤ 3072) | documented at `backend/phpunit.mysql.xml:15-16`; 18 migrations | untouched |
| StudentLearningPanel async-race fix | 7 × `findBy*` in the test | intact |
| DemoDataPanel | mounted at `src/targets/targetFeatures.tsx:81` | **0 modifications** |
| ConfigGate fail-closed | unknown `VITE_DATA_SOURCE` ⇒ `error` | intact |
| `useCan` call sites | 26 | unchanged |
| m10 / `AUTHORIZATION_MODULE` boundary | `src/__tests__/m10Boundary.test.ts:57` | intact |
| Backend/production code dirty at commit | `backend/` = 0, `src/` = 0, migrations = 0 | clean |

---

## 7. Secrets

No secrets. A pattern scan of the two committed files matched only the words
"secret" and "credential" inside **comments**. No `.env` file is tracked. The
only values in `.env.example` are the three documented assignments.

---

## 8. Still open — carried forward deliberately

These are recorded, not resolved. This checkpoint does not change any of them.

1. **O-03** — library/gallery visibility decision.
2. **O-07** — whether Tickets should be separated from Chat.
3. **Gallery** — needs a dedicated permission, tenant scoping, and a backend.
4. **Finance / Reports** — no backend (`I2`, deferred).
5. **I22 / I23** — fixed in code, still marked OPEN in `OPEN_ITEMS.md`.
6. **Progress frontend/backonend matrix** — mismatch not reconciled.

Recommended order, **not started**: close O-03 → add `gallery.read`/`gallery.write`
on both sides → backend migration + Policy + Controller → `GalleryApiRepository`
and registry wiring → tenant scoping → Gallery RBAC tests → frontend/backend
matrix-parity test → Tickets → Finance/Reports → close I22/I23 in docs.
