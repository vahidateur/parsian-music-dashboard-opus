# SESSION HANDOFF

> **LIVE POINTER — 2026-10-05, CANONICAL-LINE CONSOLIDATION (authoritative handoff point).**
> This supersedes the Progress slice 2 pointer immediately below it as the work order. It deletes
> nothing below it, deletes no SHA, and merges nothing to `main`.
>
> ```text
> BRANCH (canonical):
> arena/01a10b63-parsian-music-dashboard-opus
>
> PARENT OF THIS CHECKPOINT:  bc1ef0ce935fa3c8ab6771a16c6de7ceb75a76b5
> OTHER LINE, PRESERVED:      arena/01a0f73f-parsian-music-dashboard-opus @ 717533624e00fe574e57ee3764a9fc7978d04a48
> COMMON BASE:                7eba988a44ffd4ac38c40cc56b9f6717bc3787a7   (main 15775ea is an ancestor of both)
> TIP:                        read with `git log -1 --format=%H` — a document cannot carry its own SHA
>
> WHY THIS POINTER EXISTS
>   Two continuation lines were both pushed and neither was an ancestor of the other. They are
>   reconciled, not competing: this line is the superset for every product artifact (25-permission
>   RBAC including progress.read/progress.write with a non-vacuous parity guard, the demo
>   de-production, the duplicate-work conversation-export race fix, the dev-only Vite proxy), and the
>   other line's two unique documents were merged onto it — its checkpoint is Appendix A of
>   docs/engineering/CONSOLIDATION_CHECKPOINT.md, and this pointer. The other line's branch and
>   commits are NOT deleted, rewritten or force-pushed. Decision record: DECISIONS.md §32.
>
> MEASURED AT THIS CHECKPOINT (artifact-free; dist/ removed afterwards)
>   frontend suite : 206 files passed · 2666 passed · 0 failed · 18 skipped (2684)
>   typecheck      : `npx tsc --noEmit` exit 0
>   builds         : bare + client + demo all succeed; 125 files in dist/
>   proxy leakage  : 0 files in dist/ contain 127.0.0.1:8080 (and 0 contain `changeOrigin`)
>   git status     : clean; local branch level with its remote
>   RBAC           : 25 == 25, order-identical to the backend; demo.manage = administrator only
>   backend        : byte-identical to 7eba988 (tree 4d3c1db…) — CI run 37240671916 success;
>                    NO local run (no PHP/Composer/MySQL in the sandbox); no CI run exists for
>                    either tip, because the workflow triggers on backend/** only
>
> ENVIRONMENT NOTE (recovery, non-destructive)
>   The sandbox again reverted the local HEAD pointer (to 86dab3f) while the working tree held
>   bc1ef0c content — proved by blob-hash comparison before acting (933 identical, 0 differ,
>   0 missing, 0 extra). Recovered with: manifest -> stash --include-untracked -> merge --ff-only
>   -> verify. No reset, no clean, no rebase, no cherry-pick, no force-push. The stash is kept and
>   holds zero unique content. A tag-less clone also fails projectState.test.ts's preserved-branch
>   gate — fetch tags and all heads, as section 17 of the checkpoint records.
>
> STILL OPEN — carried forward, NOT resolved here
>   O-03 gallery/library visibility | O-07 Tickets vs Chat | I19 (frontend scheduling analogue)
>   Finance & Reports backend (I2) | gallery backend | frontend CI (no workflow covers src/)
>   Browser QA NOT VERIFIED | backend suite not run here
>
> NEXT ACTION
>   Owner decision, then — only if explicitly authorized — merge to `main` by FAST-FORWARD
>   (`main` is an ancestor: no merge commit is needed). Do not start a new feature. Local sync
>   commands: docs/engineering/CONSOLIDATION_CHECKPOINT.md, section 17.
> ```
>

> **LIVE POINTER — 2026-10-03, Progress slice 2 (append-only event log, history guard, overview).**
> This supersedes the Progress slice 1 pointer immediately below it as the work order. It
> deletes nothing below it, deletes no SHA, and merges nothing to `main`.
>
> ```text
> BRANCH:
> arena/01a0f73f-parsian-music-dashboard-opus
>
> PARENT:        6f74f6067cea86a81230450340480472d6b260aa
> RESULTING SHA: 57dbfc2  (commits 7cd8c97, 57dbfc2)
>
> GOVERNANCE — unchanged from DECISIONS.md §29, NO new decision taken:
>   Reuses the SAME two permission ids: progress.read, progress.write.
>   Vocabulary is STILL EXACTLY 25. Nothing was added.
>   PB-3 REMAINS OPTION A for instruments and learning.
>   PB-5 REMAINS OPTION A for notifications and Telegram/Bale/Push.
>   TenantContext was NOT modified. No client organization_id is accepted.
>
> COMMITS, in order:
>   7cd8c97  feat(progress): append-only event log, history deletion guard, student overview
>   57dbfc2  fix(progress): import the ProgressEvent model in AssignmentService
>     (Category C defect: AssignmentService is in App\Domain\Progress, so the bare
>      ProgressEvent in the history guard resolved to a non-existent domain class
>      instead of App\Models\ProgressEvent, and every delete returned 500)
>
> IMPLEMENTED (3 more endpoints; 13 total in Progress):
>   GET    /api/v1/progress-events               progress.read
>   POST   /api/v1/progress-events               progress.write   (APPEND-ONLY)
>   GET    /api/v1/students/{id}/progress-overview  progress.read
>
> APPEND-ONLY IS A ROUTING FACT:
>   No PUT / PATCH / DELETE route for an event is registered anywhere. Correcting a
>   mistake appends a new event rather than rewriting the past. Asserted explicitly.
>
> ASSIGNMENT HISTORY GUARD — the gap slice 1 recorded as vacuous is now CLOSED:
>   DELETE /piece-assignments/{id} with events -> 409 ASSIGNMENT_HAS_HISTORY
>   DELETE /piece-assignments/{id} with none  -> 204
>
> SERVER-AUTHORITATIVE:
>   student_id and piece_id come from the assignment, NEVER from the client.
>   `latest` is recomputed from the log on every append, newest by recorded_at then id.
>
> DEFERRED, asserted not invented:
>   suggestedContentIds is always [] (learning has no server tables; PB-3 Option A).
>   No standalone analytics/plateau endpoint — the contract defines no path.
>   No workflow automation.
>
> TESTS / CI  (remote tip 57dbfc2, verified by git ls-remote):
>   Backend  305 passed, 1 failed (306 executed). This slice added 44 tests
>   (34 plain + a 10-case provider); 262 pre-existing + 44 = 306. ALL 44 PASS.
>   The 1 failure is a PRE-EXISTING test, not one this slice added.
>   I23 PROVEN BY OBSERVATION: from 2d768c2 onward the five deciding files are
>   byte-identical (e6a079 8504f5 0affa3 79e572 03e334), and across six CI runs
>   on that identical code the test PASSED 5x and FAILED 1x. Faker is unseeded.
>   The 1 failure is PROVEN PRE-EXISTING and FLAKY, not a regression:
>     SchedulingTest > reschedule links original and replacement
>   => I23. Proven by exhaustive enumeration of the factory's random space:
>      330 equiprobable draws, exactly 2 fail (addDays=10 at hour 08 or 09)
>      = 0.606%, ~1 run in 165. Control (candidate carries its own id): 0 of 330.
>      Plus: the six deciding files are byte-identical at 6f74f60 and 57dbfc2,
>      SchedulingTest was last touched in 2d768c2, and the same code was GREEN at
>      999f9d7 (262 passed, 0 failed) and RED at 57dbfc2 — the draw is the only
>      difference. NOT edited to go green; not re-rolled via a no-op push either.
>   HTTP smoke GREEN on both commits.
>   Frontend 14 failed | 2638 passed | 18 skipped (2670) == accepted baseline;
>   tsc exits 0; no frontend file touched.
>
> *** I23 WAS RED AT 57dbfc2 — NOW FIXED AND GREEN AT deb7f0c. ***
>   A re-run could NOT be requested at the time: gh workflow run -> HTTP 403 (the App token has
>   read-only Actions access) and gh run rerun is refused for that run.
>   [RESOLVED 2026-10-03] Owner authorized repairing I23. SessionService::reschedule() now passes
>   'id' => $original->id on its conflict-check candidate, so the replaced session is no longer
>   counted as its own clash. CI run 37154399272: Tests: 307 passed, 0 failed; all 4 checks green.
>   The flaky test's fixture was pinned to the collision case (deterministic, and it now fails
>   without the fix), and a companion test proves a genuinely different overlapping session is
>   still refused. See OPEN_ITEMS I23.
>   The historical reasoning below is retained: it was correct not to game CI for a green run
>   while the fix still needed authorization — Scheduling is outside the Progress scope.
>
> ENVIRONMENT CAVEAT for whoever picks this up: the backend suite CANNOT be run
>   locally here — no PHP runtime is installable (packagist.org, getcomposer.org and
>   the Debian mirrors are unreachable), so CI is the only execution evidence.
>
> RECURRING HAZARD: this sandbox has rolled local HEAD back to 7215633 five times
>   (#7-#11), each time with a shallow clone and a dirty tree whose files are NEWER
>   than HEAD. Do NOT trust HEAD; do NOT "fix" the tree by resetting. Recovery that
>   has worked every time, losslessly:
>     1. git stash push -u            (PRESERVE — never skip this)
>     2. git fetch origin --unshallow ; git fetch origin '+refs/heads/*:refs/remotes/origin/*'
>     3. git merge --ff-only origin/arena/01a0f73f-parsian-music-dashboard-opus
>     4. prove it: compare stash@{0}^3 blobs against the new HEAD (0 lost, 0 differing)
>   Never: reset --hard, force push, rebase, clean -fd, checkout -- .
>   On #11 the tree turned out to be an exact mirror of 9b00863 (91 untracked +
>   16 tracked, 0 differing), so nothing newer was ever at risk — but that is only
>   knowable AFTER the comparison, never assumed before it.
>
> PROVENANCE: this slice's docs were first committed locally as b185751, which failed
>   to push (credential error). A sandbox regression then recreated the branch at
>   7215633 and b185751 ceased to exist as an object; the work was recovered
>   LOSSLESSLY from git stash (91 untracked files, 0 lost, 0 differing; of 16 tracked
>   modifications exactly 3 carried extra work — these docs).
> ```
>
> ---
>
> **SUPERSEDED 2026-10-03 by the slice 2 pointer above — Progress slice 1 (pieces + piece-assignments).**
> This supersedes the Library / resources pointer below as the work order. It deletes
> nothing below it, deletes no SHA, and merges nothing to `main`.
>
> ```text
> BRANCH:
> arena/01a0f73f-parsian-music-dashboard-opus
>
> PARENT:        e0cb46078fc6eed4078fff5d009673d99534925f
> RESULTING SHA: 999f9d7  (commits 13ae50a, 999f9d7)
>
> GOVERNANCE — OWNER DECISION 2026-10-03 (DECISIONS.md §29):
>   Progress is AUTHORIZED for v1. PB-3 is lifted for Progress ONLY.
>   ADDED EXACTLY TWO permission ids: progress.read, progress.write.
>   Vocabulary 23 -> 25. No other id was added.
>   PB-3 REMAINS OPTION A for instruments and learning.
>   PB-5 REMAINS OPTION A for notifications and Telegram/Bale/Push.
>   TenantContext was NOT modified.
>
> COMMITS, in order:
>   13ae50a  feat(backend): implement Progress slice 1, pieces and piece-assignments
>   999f9d7  fix(backend): keep the closedAt test inside the Sanctum token lifetime
>     (test-only: travel(2 days) expired the 720-minute Sanctum token, so the
>      request returned 401 and never reached the service)
>
> IMPLEMENTED (10 endpoints, contract from apiRepository.ts):
>   GET    /api/v1/pieces                  progress.read
>   POST   /api/v1/pieces                  progress.write
>   GET    /api/v1/pieces/{id}             progress.read
>   PATCH  /api/v1/pieces/{id}             progress.write
>   DELETE /api/v1/pieces/{id}             progress.write
>   GET    /api/v1/piece-assignments       progress.read
>   POST   /api/v1/piece-assignments       progress.write
>   GET    /api/v1/piece-assignments/{id}  progress.read
>   PATCH  /api/v1/piece-assignments/{id}  progress.write
>   DELETE /api/v1/piece-assignments/{id}  progress.write
>
> DEFERRED — NO placeholder routes exist, all asserted 404:
>   progress-events, students/{id}/progress-overview,
>   students/{id}/assignments, analytics, plateau detection, recommendations,
>   workflow automation.
>   THE PROGRESS DOMAIN IS NOT COMPLETE. `latest` is always null; the
>   delete-refuses-with-history guard does not fire because no event table
>   exists, so deletion is MORE permissive today than the contract intends.
>
>   [SUPERSEDED 2026-10-03 — retained as the slice-1 snapshot, not current state.]
>   Slice 2 (`7cd8c97`, `57dbfc2`) delivered progress-events, progress-overview,
>   `latest` recomputation and the history guard. Slice 3 (`e605dbc`) delivered
>   `students/{id}/assignments` as the 14th endpoint (DECISIONS.md §30). Every
>   Progress endpoint in the contract is now implemented; analytics, plateau,
>   recommendations and workflow automation remain deferred by contract, with no
>   placeholder routes. Backend CI green: 316 passed / 0 failed.
>
> ROLE MATRIX (asserted, not assumed):
>   administrator read+write | manager read+write | teacher read+write
>   staff read only (403 progress.write) | accountant neither (403 progress.read)
>   NOTHING authorizes on `role === "teacher"` despite the client panel doing so.
>
> TENANCY: TenantContext + BelongsToOrganization. Rule::exists deliberately NOT
> used (it bypasses Eloquent scopes). New TenantRules::assignablePiece().
>
> TESTS: 33 methods, 45 cases. CI run 37126691491 — PHP 8.3 suite SUCCESS,
>   HTTP smoke SUCCESS. Backend tally 262 passed / 1788 assertions / 0 failed
>   (was 217 / 1475). Frontend 14 failed | 2638 passed | 18 skipped (2670) —
>   identical to the accepted baseline (10 schedulingGeneration + m10Boundary,
>   honestWriteCopy x2, emptyEnvironmentPanels). Typecheck exit 0.
>   No frontend file was changed.
>
> MAIN: 15775ea9486cb57fbfb8fefa3268658cbe7eb669 — UNTOUCHED. Do not merge.
> PROTECTED REFS unchanged: main 15775ea9…, docs/demo-migration-plan 1b233362…,
>   backup/pre-f2-2026-09-29 62deb84d…. Fast-forward only: no force, no rebase,
>   no reset, no history rewrite.
>
> EXACT NEXT UNFINISHED TASK: Progress slice 2 — progress-events (append-only)
> and students/{id}/progress-overview, the event-existence guard on assignment
> deletion, and `latest` recomputation. Already authorized under the SAME two
> permission ids; no new governance decision needed. STOP after it.
> ```

> **LIVE POINTER — 2026-10-03, Library / resources slice (metadata only).**
> This supersedes the Organization settings pointer below as the work order. It deletes
> nothing below it, deletes no SHA, and merges nothing to `main`.
>
> ```text
> BRANCH:
> arena/01a0f73f-parsian-music-dashboard-opus
>
> PARENT:        adf5c0674d979fe7df871a55698f728bf53fe335
> RESULTING SHA: d422a8f  (commits cb5adf3, d422a8f)
>
> AUTHORIZED: the Library / resources backend slice only. PB-1..PB-5 were NOT
> reopened and were not reinterpreted. Nothing was started for Organization
> settings (already built), working hours, progress, instruments, learning, rooms,
> notifications, Telegram, Bale, push, the student portal, finance or reports.
> NO new permission id was created — the vocabulary is still exactly the 23 ids in
> backend/config/permissions.php. No unrelated frontend change was made.
>
> COMMITS, in order:
>   cb5adf3  feat(backend): implement Library resources slice
>   d422a8f  fix(backend): generate resource ids and refuse unknown sort keys
>
> ENDPOINTS (read from src/domains/library/apiRepository.ts, not invented):
>   GET    /api/v1/resources           library.read
>   POST   /api/v1/resources           library.write
>   GET    /api/v1/resources/{id}      library.read
>   PATCH  /api/v1/resources/{id}      library.write
>   DELETE /api/v1/resources/{id}      library.write
>   query: search, kind, instrument, level, visibility, sort, page, per_page
>   errors: RESOURCE_NOT_FOUND (404), RESOURCE_INVALID (422 with error.fields)
>
> NOT BUILT, deliberately — see DECISIONS.md §28:
>   POST /uploads and GET /resources/{id}/download are NOT routed. The slice is
>   metadata-only and mediaId is an opaque reference into the media domain; the
>   spec classifies storage, signed URLs, per-object auth and scanning as
>   back-end-later. `size` is therefore always the catalogue's unknown marker
>   (نامشخص) — the server holds no bytes, and no figure is fabricated. `uses`
>   stays 0 for the same reason: it only grows on a download.
>   Do NOT report upload or download as implemented.
>
> TENANCY: TenantContext via the shared BelongsToOrganization global scope. No
> request-supplied organization_id. Cross-tenant references are refused —
> Rule::exists was deliberately NOT used because it bypasses Eloquent scopes;
> TenantRules::teacherExists() / studentExists() scope to the caller's org.
>
> TESTS: backend/tests/Feature/ResourceTest.php — 23 methods, 33 cases with the
> data provider. Authorized + unauthorized read and write, tenant isolation on
> list/get/patch/delete (404, not 403, for a fully privileged foreign actor),
> cross-tenant references, validation (11-case provider), update, delete, exact
> response shape, error shapes, filters, search, sort, pagination, and the binary
> boundary (both file paths asserted 404).
>
> CI: run 37122492289 — PHP 8.3 test suite SUCCESS, HTTP smoke SUCCESS.
>   Backend tally: 217 passed / 1475 assertions / 0 failed (was 184 / 1241).
>   PHP lint clean. Frontend: 14 failed | 2638 passed | 18 skipped (2670) —
>   identical to the accepted baseline (10 proven-pre-existing
>   schedulingGeneration + the 4 recorded: m10Boundary, honestWriteCopy x2,
>   emptyEnvironmentPanels). Typecheck exit 0. No frontend file was changed.
>
> MAIN: 15775ea9486cb57fbfb8fefa3268658cbe7eb669 — UNTOUCHED. Do not merge.
> PROTECTED REFS unchanged: main 15775ea9…, docs/demo-migration-plan 1b233362…,
>   backup/pre-f2-2026-09-29 62deb84d…. Pushed fast-forward only: no force, no
>   rebase, no reset, no history rewrite.
>
> EXACT NEXT UNFINISHED TASK: none authorized — stop after Library. The next
> unbuilt slice is progress, which is BLOCKED: its apiRepository.ts exists but
> progress.read / progress.write are not in the vocabulary, so it needs a
> governance decision first. The same is true of instruments.* and learning.*.
> ```

> **LIVE POINTER — 2026-10-03, Organization settings + working-hours slice.**
> This supersedes the 2026-10-02 Phase B pointer below as the work order. It deletes
> nothing below it, deletes no SHA, and merges nothing to `main`.
>
> ```text
> BRANCH:
> arena/01a0f73f-parsian-music-dashboard-opus
>
> PARENT:        83b177fe5577ce3f646e62bdc6c0e61e3ff58324
> RESULTING SHA: f7ca27981d31dc6348a8ac4bb523ef29bf6767ca
>
> AUTHORIZED: the Organization settings slice only. PB-1..PB-5 were NOT reopened
> and were not reinterpreted; nothing was started for Telegram, Push, the student
> portal, notifications, finance or reports.
>
> COMMITS, in order:
>   2d768c2  feat(backend): Organization settings slice, GET/PATCH /organization
>   f7ca279  fix(backend): complete the organization factory; correct three test expectations
>
> WHAT WAS BUILT — the server counterpart of the existing frontend architecture:
>   GET  /organization   settings.read    -> { data: OrganizationSettings }
>   PATCH /organization  settings.write   -> { data: OrganizationSettings }
>   Storage: the settings columns live ON `organizations`, not beside it. One
>            academy, one rule set, one row — so `organizations.name` is the
>            single source of `OrganizationSettings.name`, and the row is always
>            loaded by whereKey(TenantContext). Isolation is structural: another
>            tenant's settings are never queried, not merely filtered out.
>   Rules:   OrganizationRules is the server copy of rules.ts (workingWindow,
>            isInsideWorkingHours, closedWeekdays, gapMinutes, schedulingRules).
>            Same arithmetic, same fields, same "unreadable rule answers null".
>   Conflicts: SESSION_OUTSIDE_WORKING_HOURS and SESSION_TIGHT_TURNAROUND — the
>            two kinds this file's limitation 1 recorded as unevaluated — are now
>            emitted as WARNINGS, per conflicts.ts, appended last so no existing
>            caller's first warning moves.
>
> PERMISSIONS — only ids already in the shipped 23-id vocabulary:
>   settings.read, settings.write. No organization.*, no working_hours.*, and no
>   neighbouring permission borrowed. The administrator alone holds settings.write;
>   the manager holds settings.read. That asymmetry is asserted, not assumed.
>   TENANCY — TenantContext + BelongsToOrganization, unchanged. No new seam.
>
> EXECUTED, NOT ASSUMED — CI run 37119421685 on f7ca279:
>   php artisan test  ->  Tests: 184 passed (1241 assertions), 0 failed
>                         (was 160 passed / 1114 assertions)
>   HTTP smoke        ->  T-02 OK, PB-1 OK, PB-3 OK, Scheduling + Attendance OK,
>                         no-token 401 OK. backend-test-tally + backend-http-smoke
>                         both success.
>   PHP syntax lint   ->  177 PHP files, 0 syntax errors
>   npm run typecheck ->  exit 0
>   npm test          ->  2638 passed / 14 failed / 18 skipped (2670), 4 of 204
>                         files failing. See the FRONTEND note below for why the
>                         extra 10 are not this slice's.
>
>   WARNING: 2d768c2 alone is RED (4 failed). f7ca279 is the fix and is green.
>            Do not stop at 2d768c2.
>
> MAIN: 15775ea9486cb57fbfb8fefa3268658cbe7eb669 — UNTOUCHED. Do not merge.
> PROTECTED REFS unchanged: main 15775ea9…, docs/demo-migration-plan 1b233362…,
>   backup/pre-f2-2026-09-29 62deb84d…. Pushed fast-forward only: no force, no
>   rebase, no reset, no history rewrite, no amended pushed commit.
>
> EXACT NEXT UNFINISHED TASK (still NOT authorized):
>   Library / resources — library.read and library.write already exist in the
>   vocabulary and src/domains/library/apiRepository.ts is written, so it needs
>   no governance decision to begin. After that, progress / instruments / learning
>   remain blocked: their permissions are not in the vocabulary.
> ```
>
> ### FRONTEND — read this before reporting a frontend regression
>
> The frontend suite does NOT match the recorded 2648/4/18 baseline. It is
> **2638 passed / 14 failed / 18 skipped** (2670 tests, 204 files):
>
>     10  src/views/__tests__/schedulingGeneration.test.tsx  <- NOT this slice
>      2  src/views/__tests__/honestWriteCopy.test.tsx       <- recorded pre-existing
>      1  src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx  <- recorded
>      1  src/__tests__/m10Boundary.test.ts                  <- recorded pre-existing
>
> The 4 recorded ones are untouched. This slice did not cause the remaining 10:
> `git diff 83b177f..f7ca279` touches **backend/ only** — not one frontend source
> file, test or config.
>
> Two things move the number:
>
> 1. **A SHALLOW CLONE** adds 9 failures in `projectState.test.ts`, which asserts
>    that checkpoint and preserved-branch SHAs are real objects. Fix, in order:
>      git fetch --unshallow
>      git fetch origin '+refs/heads/*:refs/remotes/origin/*'
>      git fetch origin --tags
>    After that the file is 52/52. A shallow-clone run is NOT a regression.
>
> 2. **`src/views/__tests__/schedulingGeneration.test.tsx` fails 10 of 15** in this
>    environment. **Proven not to be this slice's doing:** the file is byte-identical
>    at 83b177f and at f7ca279, and running it in a clean worktree at the PRE-SLICE
>    commit 83b177f reproduces the identical 10 failed / 5 passed. It is also
>    stable across clocks (verified at UTC+14, UTC-11, UTC-5 and UTC+3:30), so it
>    is not a weekday or time-of-day flake — it is an environment-dependent
>    failure that appeared between the 2026-10-02 baseline run and now. Not fixed
>    here: it is a frontend test outside this slice's authorization.
>
> The four recorded pre-existing failures (m10Boundary/Finance.tsx, honestWriteCopy
> x2, emptyEnvironmentPanels) were NOT touched.

> **LIVE POINTER — 2026-10-02, Phase B governance resolution (PB-1..PB-5) and PB-1 enforcement.**
> This supersedes the 2026-10-01 Scheduling + Attendance pointer below as the work order. It deletes
> nothing below it, deletes no SHA, and merges nothing to `main`.
>
> ```text
> BRANCH:
> arena/01a0f73f-parsian-music-dashboard-opus
>
> PARENT:        66a5e148cef1f1c97ec7608187c47d8f5dd4e79f
> RESULTING SHA: 86610cf299e6a0484e8ce6907f0722546287024b
>
> OWNER DECISION — 2026-10-02 — PB-1..PB-5 ALL RESOLVED, ALL OPTION A
> (keep the existing restrictive behaviour):
>   PB-1 = A  A teacher with no teacherId fails closed — never org-wide. Applied
>             consistently to students, scheduling sessions, attendance, attendance
>             corrections, related attendance reads and with-attendance.
>   PB-2 = A  Keep all four privileged-identity restrictions (self-edit, admin->admin,
>             assigning administrator, privileged email change). The server is NOT
>             relaxed to match the more permissive frontend panel.
>   PB-3 = A  rooms/instruments/learning/progress stay blocked. NO rooms.*,
>             instruments.*, learning.* or progress.* permission is invented;
>             settings.write and library.write are NOT reinterpreted, and nothing
>             authorizes on role === "teacher".
>   PB-4 = A  Keep useCan(...) || !user as the documented test seam. Backend auth is
>             NOT weakened: 401 without a token is still asserted by the smoke job.
>   PB-5 = A  No notifications domain, inbox, table, permission or delivery in v1.
>             Telegram/Bale/SMS/email stay later adapter capabilities only. This
>             reconciles the O-17 vs integration-architecture conflict: both are read
>             as "required later capability, not in v1"; neither is rewritten.
>   Register: docs/engineering/DECISIONS.md §26 (5 records: id, decision, rationale and
>   evidence, affected scope, implementation consequence, date, owner decision).
>   Sheets:   docs/engineering/OPEN_ITEMS.md §PB-1..PB-5 (originals preserved verbatim).
>
> COMMITS, in order:
>   a43ac33  fix(backend): enforce PB-1 on every session endpoint; correct stale PB wording
>   86610cf  fix(scheduling): answer PB-1 before the permission check on session delete
>
> WHAT CHANGED — one real gap, closed. The rest is governance documentation.
>   SessionPolicy::assertTeacherLinked() now runs in all seven scheduling Form
>   Requests BEFORE the permission check, in SessionGenerator (preview and apply) and
>   in all five SessionService write methods. Before this, POST sessions/generate
>   returned a plan to a PB-1 teacher through schedule.read, and the write verbs
>   answered a bare 403 FORBIDDEN instead of OWNER_DECISION_REQUIRED_PB1.
>   Destroy is the one session verb with no FormRequest, so its guard order in
>   SessionService is load-bearing — that is what a43ac33 got wrong and 86610cf fixed.
>   No schema, contract, permission or TenantContext change. Vocabulary still 23 ids.
>
> EXECUTED, NOT ASSUMED — CI run 36929494095 on 86610cf:
>   php artisan test  ->  Tests: 160 passed (1114 assertions), 0 failed
>                         (was 158 passed / 1090 assertions at d6098c5)
>   HTTP smoke        ->  T-02 OK, PB-1 OK, PB-3 OK, Scheduling + Attendance OK,
>                         no-token 401 OK. backend-test-tally + backend-http-smoke:
>                         both success.
>   PHP syntax lint   ->  169 PHP files, 0 syntax errors
>   npm run typecheck ->  exit 0, clean
>   npm test          ->  2648 passed / 4 failed / 18 skipped (2670), 3 of 204 files
>                         failing — EXACTLY the recorded baseline (2648/4/18) and
>                         exactly the recorded pre-existing set: m10Boundary
>                         (Finance.tsx imports AuthContext), honestWriteCopy (2),
>                         emptyEnvironmentPanels (1). No regression, none hidden.
>                         No frontend source was changed by these two commits
>                         (git diff 66a5e14..86610cf touches backend/ only).
>   SHALLOW-CLONE TRAP (cost a full re-run here — read before trusting `npm test`):
>                         the first run of this session reported 14 failures. Nine of
>                         the extra ten are projectState.test.ts, which asserts that
>                         checkpoint and preserved-branch SHAs are real objects and
>                         therefore fails on an incomplete clone. Fix, in order:
>                           git fetch --unshallow
>                           git fetch origin '+refs/heads/*:refs/remotes/origin/*'
>                           git fetch origin --tags
>                         After that projectState is 52/52 and the suite returns to 4.
>                         A shallow-clone run is NOT a regression; do not report one.
>   WARNING: a43ac33 alone is RED (1 failed: the delete assertion). Do not stop there.
>            86610cf is the fix and is green.
>
> MAIN: 15775ea9486cb57fbfb8fefa3268658cbe7eb669 — UNTOUCHED. Do not merge.
> PROTECTED REFS unchanged: main 15775ea9…, docs/demo-migration-plan 1b233362…,
>   backup/pre-f2-2026-09-29 62deb84d…. Pushed fast-forward only: no force, no rebase,
>   no reset, no history rewrite.
>
> **[SUPERSEDED 2026-10-03 — Organization settings is BUILT; see the live pointer above.**
> The line below is the 2026-10-02 record and is kept as history.]**
> EXACT NEXT UNFINISHED TASK (still NOT authorized):
>   Organization settings — GET /organization and PATCH /organization under
>   settings.read / settings.write. Unchanged from the pointer below; it still
>   unblocks limitation 1.
> ```

> **LIVE POINTER — 2026-10-01, Scheduling + Attendance continuation.** This supersedes the
> backend first-slice pointer below as the work order. It deletes nothing below it, deletes no
> SHA, and merges nothing to `main`.
>
> ```text
> BRANCH:
> arena/01a0f73f-parsian-music-dashboard-opus
>
> STARTING SHA:
> 7215633c18550c9faf053e8b2bde5ea2e8da08e8  (base both lineages branched from)
> Branch tips at handoff: 897ca39 (arena/01a0f73f-…) and 86dab3f (cleanup/demo-migration-lineage).
> The Kiro plan was recovered from the 86dab3f diff and merged into this branch as a
> two-parent merge (edb21f1) rather than by deleting either lineage.
> Do not rewind past 7215633c18550c9faf053e8b2bde5ea2e8da08e8.
>
> RESULTING SHA: d6098c5  (read the true tip with:
>   git ls-remote origin refs/heads/arena/01a0f73f-parsian-music-dashboard-opus)
>
> SLICE COMMITS, in order:
>   edb21f1  docs(backend): merge the Kiro session handoff and next-slice plan
>   4bbbdc4  feat(backend): Scheduling + Attendance slices
>   c083187  ci: publish failure digests as check runs
>   23ba401  fix(backend): name the table class_sessions; rename the test session() helper
>   7605a4c  fix(backend): attendance id assignment, PB-1 on check-conflicts, preview path
>   d6098c5  fix(backend): deterministic correction ordering
>
> WHAT WAS BUILT — the first unfinished planned item, both halves, in the plan's order:
>   Scheduling: class_sessions table; SessionPolicy; ConflictDetector; SessionService;
>               SessionGenerator (bounded: 180 days / 500 sessions, ?preview=1 read-only)
>   Attendance: attendance_records + attendance_corrections tables; AttendancePolicy;
>               AttendanceService (UNIQUE(session,student); append-only corrections)
>   36 new tests: tests/Feature/SchedulingTest.php, tests/Feature/AttendanceTest.php
>
> PERMISSIONS — only ids already in the shipped vocabulary, nothing invented:
>   schedule.read, schedule.write, attendance.read, attendance.write
>   The vocabulary's own asymmetry is honoured and asserted: a teacher has
>   schedule.read but NOT schedule.write, and has BOTH attendance permissions.
>
> TENANCY — TenantContext + BelongsToOrganization, unchanged. No new seam.
>   T-02 extension: sessions -> class_sessions.teacher_id = actor.teacher_id;
>   attendance -> through the session.
>   A teacher with no teacherId is PB-1 and fails closed: 403
>   OWNER_DECISION_REQUIRED_PB1 on EVERY session and attendance endpoint.
>
> EXECUTED, NOT ASSUMED — CI run 36885088076 on d6098c5:
>   php artisan test  ->  Tests: 158 passed (1090 assertions)
>                         (was 122 passed / 915 assertions before this slice)
>   HTTP smoke        ->  T-02 OK, PB-1 OK, PB-3 OK,
>                         Scheduling + Attendance OK, no-token 401 OK
>   PHP syntax lint   ->  clean (real php -l in CI)
> There is no local PHP/Composer toolchain here; the suite runs in GitHub Actions.
>
> FRONTEND GATES — no frontend source was changed by this slice:
>   npm run typecheck -> clean, exit 0
>   npm test          -> 2648 passed / 4 failed / 18 skipped (2670), 3 of 204 files
>                        failing. Same four pre-existing failures as the previous
>                        continuation; no regression, none hidden.
>
> **[SUPERSEDED 2026-10-02 — PB-1..PB-5 are resolved by the owner, all option A.**
> See the live pointer at the top of this file. The original line below is kept
> as the historical record of what was true when it was written.]**
> PB-1..PB-5: UNCHANGED. OWNER DECISION REQUIRED.
> Nothing in this slice resolves one. Where a behavior depends on one the server
> fails closed. PB-3 rooms stay blocked exactly as implemented; no room permission
> was invented.
>
> KNOWN LIMITATIONS (full list in BACKEND_STATUS.md §Slice 3 §14):
>   1. SESSION_OUTSIDE_WORKING_HOURS and SESSION_TIGHT_TURNAROUND are not
>      evaluated. The rules exist in src/domains/organization/rules.ts but there
>      is no server-side store of them yet — ApiOrganizationRepository is marked
>      BACKEND REQUIRED for GET/PATCH /organization and no endpoint serves it.
>      Building the Organization settings slice unblocks both.
>   2. Room/teacher double-booking is enforced transactionally, not by a DB
>      constraint — an exclusive-end time range cannot be a UNIQUE index.
>      UNIQUE(session_id, student_id) IS a real constraint.
>   3. The roster is not date-scoped: Enrollment.startDate is a Jalali display
>      string in the dataset and is stored verbatim, so it is not a queryable
>      ISO date. Needs an owner decision on the enrollment date format.
>   4. SKIP_CLOSED_DAY is never emitted (generation walks class.days only).
>   5. sessions.json and attendance.json are the legacy demo format and are NOT
>      seeded; attendanceRecords.json / attendanceCorrections.json are empty
>      arrays, so attendance test data comes from factories.
>
> NOT SEEDED, NOT BUILT, NOT TOUCHED:
>   tickets, chat, files/media, notifications (PB-5), Telegram/Bale/push,
>   student portal, finance, reports, library, progress, instruments, learning,
>   audit events (O-18), MFA, cookie transport (O-12).
>
> EXACT NEXT UNFINISHED TASK (not authorized by this commit):
>   Organization settings — GET /organization and PATCH /organization under
>   settings.read / settings.write, against the contract already written in
>   src/domains/organization/apiRepository.ts (marked BACKEND REQUIRED, not yet
>   selected by the registry). It is first on the plan's own "After" list and it
>   unblocks limitation 1.
>   AFTER THAT, AND BLOCKED ON AN OWNER DECISION: progress — its apiRepository
>   exists but progress.read / progress.write are NOT in the permission
>   vocabulary. The same is true of instruments.* and learning.*. Library is
>   unblocked (both permissions exist and its apiRepository is written).
>
> MAIN: 15775ea9486cb57fbfb8fefa3268658cbe7eb669 — UNTOUCHED. Do not merge.
> Ahead-by is not merge authorization.
>
> DO NOT MERGE: docs/demo-migration-plan @ 1b233362ef391e4b8f31df9e48c56b3687e36222
>
> PROTECTED: backup/pre-f2-2026-09-29 @ 62deb84dfbbd9d7ad27002196569d0c7ef4c87f6,
> archive tags, local WIP arena/01a0e8ec-… @ eb973eb2758447eff16b60ab4fd4c267f9d85061.
> Do not push, reset or clean the WIP. Do not delete any branch or tag.
>
> VERIFY WITH:
>   git ls-remote origin refs/heads/arena/01a0f73f-parsian-music-dashboard-opus
>   gh run list --workflow=backend-tests.yml --limit 1
>   gh api repos/vahidateur/parsian-music-dashboard-opus/commits/<sha>/check-runs \
>     --jq '.check_runs[] | select(.name | startswith("backend-")) | .name + " [" + .conclusion + "]"'
>   cd backend && composer install && cp .env.example .env && php artisan key:generate
>   php artisan test
>   npm ci && npm run typecheck && npm test
> ```
>
> Continuation and evidence only. It does not close GAP, UNKNOWN, BACKEND-ONLY, OWNER DECISION
> REQUIRED, or PRE-EXISTING FAILURE. Full record: `docs/engineering/BACKEND_STATUS.md` §
> "Slice 3 — Scheduling + Attendance (BUILT AND VERIFIED)".
>

> **LIVE POINTER — 2026-10-01, backend first-slice continuation (build-loop + finalize).** This supersedes the lineage-synchronization pointer below as the work order. It does not delete that pointer, it does not delete any SHA in this file, and it does not merge anything to `main`.
>
> ```text
> ACCEPTED BASELINE (unchanged):
> 7ff23379bb846798cdabd96be1ba9344792c0e24
> Not the current HEAD. Do not reset to it. Do not rewrite history to make it the tip.
>
> BACKEND SLICE BASELINE — where this continuation started:
> 7215633c18550c9faf053e8b2bde5ea2e8da08e8
> subject: feat(backend): add classes and enrollments
> parent: b38ff258f607ddcef3493b049da34a6f1d1f2007
> Tip of cleanup/demo-migration-lineage at both the local and the remote
> at the start of this continuation. Verified with git ls-remote; they matched.
>
> CONTINUATION BRANCH (this session's own branch, created by this work):
> arena/01a0f73f-parsian-music-dashboard-opus
> Parent commit of the continuation commits: 7215633c18550c9faf053e8b2bde5ea2e8da08e8
> Continuation commits, in order:
>   f953f090a8e6bb9864d53c5894ebdd51a2800615  ci(backend): add re-runnable execution gate for the Laravel suite
>   2aca43e913cf913c4f73d1bae4c5c87e4776b286  ci(backend): republish the PHPUnit tally as a check run
>   baf195c8540cd119bb2fd2fba17cf0b32cb71341  ci(backend): verify T-02, PB-1 and PB-3 over HTTP
>   038b15c05cafa77218f49a0173c1f8432c303dc4  ci(backend): publish the HTTP smoke report as a check run
> The documentation commit that carries this paragraph is the child of
> 038b15c05cafa77218f49a0173c1f8432c303dc4. It does not contain its own SHA.
> Read the tip with: git ls-remote origin refs/heads/arena/01a0f73f-parsian-music-dashboard-opus
>
> CURRENT HEAD:
> the commit that contains this paragraph
> parent: 038b15c05cafa77218f49a0173c1f8432c303dc4
> subject: docs(engineering): record the backend first-slice continuation
> Do not rewind past 7215633c18550c9faf053e8b2bde5ea2e8da08e8.
>
> WHY THIS POINTER EXISTS:
> The backend first slice was interrupted mid-verification. Its test result
> (122 tests green) and its HTTP smoke result (T-02: teacher1 sees exactly
> 5 students) were real but lived only in a chat transcript. Both have now
> been re-executed and made re-runnable in CI. Neither required changing a
> line of backend source.
>
> BACKEND FIRST SLICE: CONTRACT-COMPLETE, NOT MERGED
> authentication, users, roles, teachers, rooms, students, classes, enrollments
> 122 backend tests pass — re-verified, not assumed (CI run, PHP 8.3)
> T-02, PB-1 fail-closed, PB-3 fail-closed — re-verified OVER HTTP (CI job)
> Full record: docs/engineering/BACKEND_STATUS.md
> Final report: docs/engineering/backend-slice/FINAL_REPORT.md
>
> **[SUPERSEDED 2026-10-02 — PB-1..PB-5 are resolved by the owner, all option A.**
> See the live pointer at the top of this file. The original line below is kept
> as the historical record of what was true when it was written.]**
> PB-1..PB-5: UNCHANGED. OWNER DECISION REQUIRED.
> This continuation implemented nothing that resolves one.
> Where a behavior depends on one, the server fails closed with
> 403 OWNER_DECISION_REQUIRED_PB<n>. That is verified over HTTP for PB-1 and PB-3.
>
> MAIN:
> 15775ea9486cb57fbfb8fefa3268658cbe7eb669
> UNTOUCHED. Do not merge. Ahead-by is not merge authorization.
>
> DO NOT MERGE:
> docs/demo-migration-plan
> 1b233362ef391e4b8f31df9e48c56b3687e36222
>
> PROTECTED:
> backup/pre-f2-2026-09-29 @ 62deb84dfbbd9d7ad27002196569d0c7ef4c87f6
> archive tags
> local WIP arena/01a0e8ec-parsian-music-dashboard-opus @ eb973eb2758447eff16b60ab4fd4c267f9d85061
> Do not push, reset, or clean the WIP.
> Do not delete any branch or tag.
>
> KNOWN FRONTEND FAILURES — pre-existing, untouched, not hidden:
> m10Boundary (Finance.tsx imports AuthContext), honestWriteCopy (2),
> emptyEnvironmentPanels (1). Three full runs gave 13, 14 and 4 failures;
> the spread is projectState.test.ts failing on a SHALLOW CLONE, which is
> environmental — after `git fetch --unshallow` that file is 52/52 green.
> I19 (schedulingWrites.test.tsx:1234) did NOT reproduce in any run here.
> Not rerun is neither pass nor fail; not reproducing is not fixed.
>
> NEXT ACTION, not authorized by this commit:
> **[SUPERSEDED 2026-10-02 — PB-1..PB-5 are resolved by the owner, all option A.**
> See the live pointer at the top of this file. The original line below is kept
> as the historical record of what was true when it was written.]**
> PB-1..PB-5 remain with the owner. Do not implement them.
> Do not start scheduling, attendance, finance, reports, library,
> organization settings, progress, instruments, learning, tickets, chat,
> files/media, notifications, audit events, MFA, cookie transport,
> Telegram/Bale/push or the student portal from this pointer.
> Do not merge to main.
> ```
>
> Continuation and evidence only. It does not close GAP, UNKNOWN, BACKEND-ONLY, OWNER DECISION REQUIRED, or PRE-EXISTING FAILURE.

>
> **The block below is the Kiro session's own handoff (`86dab3f`), merged in from
> `cleanup/demo-migration-lineage`.** Its "NEXT PLANNED SLICE — Scheduling + Attendance" is
> adopted as the work order for the slice that follows. The pointer above supersedes its
> CURRENT HEAD / branch lines, which describe the state before this continuation.
>
> **BACKEND IMPLEMENTATION HANDOFF — 2026-10-01**
>
> ```text
> CURRENT BRANCH:  cleanup/demo-migration-lineage
> CURRENT HEAD:    7215633  (feat(backend): add classes and enrollments)
> PARENT:          b38ff25  (feat(backend): teachers, rooms (PB-3 blocked) and students with T-02 scope)
> PARENT^2:        dec2016  (feat(backend): Laravel foundation, auth, users and roles)
>
> BACKEND: PARTIAL — first slice complete, pushed to origin
> Stack: Laravel 12.69.3 + Sanctum 4.3.3, SQLite (dev/test), PHPUnit
> Backend location: backend/   (within the repo root)
> Tests: 122 passed, 915 assertions (php artisan test from backend/)
>
> WHAT WAS BUILT (this session):
>   dec2016 — Laravel foundation, Sanctum bearer auth (login/logout/me), users CRUD,
>             roles CRUD/reset, server permission matrix (23-id vocabulary only),
>             consistent {data}/{error} envelope (O-15), tenant seam (org_id from token,
>             never from body/wire), PermissionGate, DemoDatasetSeeder
>   b38ff25 — teachers API (CRUD + deactivate), rooms API persistence + service
>             (all endpoints BLOCKED PB-3), students API with T-02 SQL scope +
>             PB-1 fail-closed, classes/enrollments migrations + models
>   7215633 — classes API (CRUD + archive), enrollments API (transactional
>             capacity + duplicate + withdraw), BACKEND_STATUS.md written
>
> SMOKE TEST (19/19 pass verified with running server):
>   login 200, me 200 (token=""), unauth 401, students×15 200, classes×10 200,
>   enrollments×18 200, teachers×8 200, rooms 403 OWNER_DECISION_REQUIRED_PB3
>
> TypeScript typecheck: clean (exit 0)
> vitest: hangs in this Windows sandbox — pre-existing environmental issue (CRLF/workers)
>
> **[SUPERSEDED 2026-10-02 — PB-1..PB-5 are resolved by the owner, all option A.**
> See the live pointer at the top of this file. The original line below is kept
> as the historical record of what was true when it was written.]**
> PB-1..PB-5: ALL remain OWNER DECISION REQUIRED — not resolved.
>   PB-1: teacher without teacherId → 403 OWNER_DECISION_REQUIRED_PB1 (fail-closed)
>         teacher WITH teacherId → T-02 SQL scope enforced (active enrollment ∩ class.teacher_id)
>   PB-2: privileged identity cases a-d → 403 OWNER_DECISION_REQUIRED_PB2
>   PB-3: all room endpoints → 403 OWNER_DECISION_REQUIRED_PB3
>   PB-4/PB-5: untouched
>
> NEXT PLANNED SLICE (NOT YET STARTED — aborted to hand off):
>   Scheduling (sessions CRUD, cancel, reschedule, generate+preview, check-conflicts, roster)
>   Attendance (records, bulk, correct, corrections, session attendance, with-attendance)
>   Authorization: schedule.read/write, attendance.read/write (already exist in vocabulary)
>   Wire contracts: src/domains/scheduling/apiRepository.ts + types.ts
>                   src/domains/attendance/apiRepository.ts + types.ts
>   Seed data:  data/dataset/scheduledSessions.json
>               data/dataset/attendance.json
>               data/dataset/attendanceCorrections.json
>   Original Kiro plan artifact: .agents/tasks/backend-slice/plan.md (§4 slices 7–8 equivalent,
>     §8 test checklist SchedulingTest + AttendanceTest, §9 BACKEND_STATUS.md extension)
>   Key constraints:
>     - PB-1 teacher scope: sessions.teacher_id = actor.teacher_id (T-02 extension)
>     - recorded_by_user_id / changed_by_user_id from auth session, never from body
>     - attendance_corrections: INSERT only (append-only table)
>     - UNIQUE(session_id, student_id) must be a DB constraint on attendance_records
>     - POST /attendance/bulk: one DB::transaction
>     - POST /sessions/generate: MAX_GENERATION_DAYS=180, MAX_GENERATION_SESSIONS=500
>     - Static routes (/bulk, /corrections, /with-attendance) BEFORE {id} parameterized routes
>
> HOW TO RESUME:
>   cd backend
>   composer install
>   copy .env.example .env  (if no .env)
>   php artisan key:generate
>   set DEMO_SEED_PASSWORD=<any>
>   php artisan migrate:fresh --seed
>   php artisan test --no-ansi  (should show 122 passed)
>   php artisan serve --port=8080
>
> GOVERNANCE FILES:
>   docs/engineering/BACKEND_STATUS.md     — full endpoint table, PB-isolation map
>   .agents/tasks/backend-slice/plan.md    — original Kiro plan (slices 1–8 + test checklist)
>
> MAIN: 15775ea9486cb57fbfb8fefa3268658cbe7eb669 — UNTOUCHED. Do not merge.
> Protected refs: see LIVE POINTER block below. Do not alter.
> ```


> **LIVE POINTER — 2026-09-30, lineage pointer synchronization.** This supersedes the Decision A pointer below as the work order. It does not delete that pointer, and it does not delete any SHA in this file.
>
> ```text
> ACCEPTED BASELINE:
> 7ff23379bb846798cdabd96be1ba9344792c0e24
> Not the current HEAD. Do not reset to it. Do not rewrite history to make it the tip.
>
> DECISION A RECORD:
> c4e60d1475a90ca0fd93cf88d18c3053d42191f6
> parent: 7ff23379bb846798cdabd96be1ba9344792c0e24
> subject: docs(engineering): record owner decision A
> Ancestor of this commit. Not the current HEAD.
>
> CURRENT BRANCH:
> cleanup/demo-migration-lineage
>
> CURRENT HEAD:
> the commit that contains this paragraph
> parent: c4e60d1475a90ca0fd93cf88d18c3053d42191f6
> subject: docs(engineering): synchronize Phase B lineage pointers
> This commit does not contain its own SHA.
> Read the tip with: git ls-remote origin refs/heads/cleanup/demo-migration-lineage
> Match parent and subject. Do not rewind to c4e60d1 or to 7ff2337.
>
> PHASE B:
> PARTIAL, not complete
> **[SUPERSEDED 2026-10-02 — PB-1..PB-5 are resolved by the owner, all option A.**
> See the live pointer at the top of this file. The original line below is kept
> as the historical record of what was true when it was written.]**
> PB-1..PB-5 remain OWNER DECISION REQUIRED in OPEN_ITEMS.md.
> This pass investigated them and did not choose them.
> Current product behavior was preserved.
> Live governance did not silently override a recorded conflict.
>
> BACKEND: NOT STARTED
> TELEGRAM: NOT STARTED
> PUSH: NOT STARTED
> STUDENT PORTAL: NOT STARTED
>
> MAIN:
> 15775ea9486cb57fbfb8fefa3268658cbe7eb669
> UNTOUCHED. Do not merge. Ahead-by is not merge authorization.
>
> DO NOT MERGE:
> docs/demo-migration-plan
> 1b233362ef391e4b8f31df9e48c56b3687e36222
>
> PROTECTED:
> backup/pre-f2-2026-09-29 @ 62deb84dfbbd9d7ad27002196569d0c7ef4c87f6
> archive tags
> local WIP arena/01a0e8ec-parsian-music-dashboard-opus @ eb973eb2758447eff16b60ab4fd4c267f9d85061
> Do not push, reset, or clean the WIP.
> Do not delete any branch or tag.
> I19 remains unresolved. Not rerun is neither pass nor fail.
> ```
>
> Pointer synchronization only. It does not close GAP, UNKNOWN, BACKEND-ONLY, OWNER DECISION REQUIRED, or PRE-EXISTING FAILURE.

> **DECISION A POINTER — 2026-09-30, owner decision A. Retained. Not the live work order.** Its predicate still names `c4e60d1475a90ca0fd93cf88d18c3053d42191f6`: parent `7ff23379bb846798cdabd96be1ba9344792c0e24`, subject `docs(engineering): record owner decision A`. The sentence below that `OPEN_ITEMS.md` and the gap matrix do not name `7ff2337` was true at that commit. This later pointer names those SHAs. It does not delete the Phase B stamp pointer, and it does not delete any SHA in this file.
>
> ```text
> OWNER DECISION: A — ACCEPTED
> 7ff23379bb846798cdabd96be1ba9344792c0e24 is the canonical current baseline.
> It is the authoritative starting point for work after the history-cleanup stamp.
> Do not rewind to 33fc21443e0c11a83f2039dd5152130fa1dbcab2.
> Do not rewrite history. Do not squash W7A–W10. Do not re-run W7A, W7B, W8, W9, or W10.
> Do not merge to main. Ahead-by is not merge authorization.
> Do not use docs/demo-migration-plan as a merge source.
>
> THIS ACCEPTANCE DOES NOT MEAN PHASE B IS COMPLETE.
> It only confirms that the four commits after 33fc214 are retained as intentional work:
>   5e5fa35af30070fa08b1ad6004f2ab29dffc27b0  access guards
>   88fee2665434647f81b05b0f1560270ab56b86e3  tests
>   b0f969e38644d3c596d9b592afa25c71f0395700  documentation / owner decisions
>   7ff23379bb846798cdabd96be1ba9344792c0e24  Phase B tip stamp
> Those four commits do not close GAP, UNKNOWN, BACKEND-ONLY, OWNER DECISION REQUIRED, or PRE-EXISTING FAILURE.
>
> CURRENT BRANCH:
> cleanup/demo-migration-lineage
> This is the baseline branch. Do not move this work onto arena/01a0e8ec-parsian-music-dashboard-opus.
>
> CURRENT HEAD:
> the commit that contains this paragraph
> parent: 7ff23379bb846798cdabd96be1ba9344792c0e24
> subject: docs(engineering): record owner decision A
> This commit does not contain its own SHA.
> Read the tip with: git ls-remote origin refs/heads/cleanup/demo-migration-lineage
> Match parent and subject.
> 7ff2337 remains the accepted baseline and an ancestor. Do not reset the branch to it after this commit is the tip. Do not rewind past it.
>
> MAIN:
> 15775ea9486cb57fbfb8fefa3268658cbe7eb669
> UNTOUCHED. Do not merge.
>
> OLD MIGRATION BRANCH:
> docs/demo-migration-plan
> 1b233362ef391e4b8f31df9e48c56b3687e36222
> DO NOT MERGE
>
> PROTECTED WIP:
> arena/01a0e8ec-parsian-music-dashboard-opus
> local only, HEAD eb973eb2758447eff16b60ab4fd4c267f9d85061
> Do not push, reset, or clean it.
>
> BACKUP:
> backup/pre-f2-2026-09-29 @ 62deb84dfbbd9d7ad27002196569d0c7ef4c87f6
> UNTOUCHED.
>
> ARCHIVE TAG:
> archive/gallery-library-storage-eb973eb @ eb973eb2758447eff16b60ab4fd4c267f9d85061
> UNTOUCHED.
>
> BACKEND: NOT STARTED
> TELEGRAM: NOT STARTED
> PUSH: NOT STARTED
> STUDENT PORTAL UI: NOT STARTED. D1: no student role in this panel.
> SEPARATE MANAGEMENT APP: NOT STARTED. This repository remains the current panel.
>
> CURRENT PHASE:
> Phase B — PARTIAL, not complete
> Canonical working baseline: 7ff23379bb846798cdabd96be1ba9344792c0e24
>
> DOCUMENTATION STATE at acceptance. Recorded here. Not repaired in other files:
> - This file is the only live recovery pointer. Do not create a second handoff.
> - OPEN_ITEMS.md is the canonical location of PB-1..PB-5. It names 5e5fa35 and 88fee26 on I22. It does not name 7ff2337. GAP. Not rewritten.
> - PHASE_B_FRONTEND_GAP_MATRIX.md is the gap record, not the handoff. It names 5e5fa35 and 88fee26, not 7ff2337. GAP. Not rewritten.
> - PROJECT_STATE.md and PHASES.md still describe older tips, including main at f63ebaab37096fcb25063aca51c713e26d3b3da7. HISTORICAL. Not rewritten. This pointer is authoritative for the current tip.
> - DECISIONS.md has no Phase B baseline row. Do not add decision A there. D1–D20 stay unchanged.
> - GOVERNANCE_CHECKPOINT.md remains live law for T-02 / O-*. T-02 stays ACCEPTED / ASSIGNED-ONLY. Not amended.
> - docs/frontend-completion/13-open-decisions.md remains a historical snapshot. Do not rewrite its O-01..O-20 rows.
> - docs/frontend-completion/15-student-portal-architecture.md still calls the missing-teacherId fallback honest. That conflict is PB-1, not a decision.
> - docs/gap-matrix.md remains the Phase 0 snapshot. Not rewritten.
> - docs/frontend-completion/10-integration-architecture.md Phase B boundary names no new HTTP path. Telegram and Push are not started.
>
> Known failure, not touched: I19 src/views/__tests__/schedulingWrites.test.tsx:1234, extra id ses_cl2_20260929_1400.
> The full suite was not rerun for this record. Not rerun is neither pass nor fail.
> Two compositions only. Registry paths remain src/domains/registry.ts, src/domains/registry.client.ts, and src/domains/registryCore.ts.
>
> NEXT, NOT AUTHORIZED BY THIS COMMIT:
> **[SUPERSEDED 2026-10-02 — PB-1..PB-5 are resolved by the owner, all option A.**
> See the live pointer at the top of this file. The original line below is kept
> as the historical record of what was true when it was written.]**
> PB-1 through PB-5 remain OWNER DECISION REQUIRED in OPEN_ITEMS.md.
> Do not implement those decisions.
> Do not invent permissions, endpoints, tenancy, or policy.
> Do not start backend, Telegram, Push, the student app, or the management app.
> Do not merge to main. Do not delete any branch.
> Intended order after later, separate authorization — not a start order:
>   owner decisions PB-1..PB-5
>   frontend completion
>   final frontend audit
>   backend/API
>   student + management app
>   Telegram
>   Push
>   integration / E2E
>   final Git cleanup
>   merge to main
> None of those steps is authorized by decision A or by this commit.
> ```
>
> Decision A retains the four Phase B commits. It does not close them into a finished phase.

> **PHASE B STAMP POINTER — 2026-09-30, Phase B frontend completion, partial. Retained. Not the live work order.** Its predicate still names `7ff23379bb846798cdabd96be1ba9344792c0e24`: parent `b0f969e38644d3c596d9b592afa25c71f0395700`, subject `docs(engineering): stamp the Phase B tip`. Owner decision A accepts that commit as the baseline. It does not delete the history-cleanup pointer, and it does not delete any SHA in this file.
>
> ```text
> CURRENT CLEAN BRANCH:
> cleanup/demo-migration-lineage
>
> CURRENT HEAD:
> the commit that contains this paragraph
> parent: b0f969e38644d3c596d9b592afa25c71f0395700
> subject: docs(engineering): stamp the Phase B tip
> This commit does not contain its own SHA.
> Read the tip with: git ls-remote origin refs/heads/cleanup/demo-migration-lineage
> Match parent and subject. Do not rewind to 33fc214 or to 689de032.
>
> PARENT OF THE STAMP:
> b0f969e38644d3c596d9b592afa25c71f0395700
>
> MAIN:
> 15775ea9486cb57fbfb8fefa3268658cbe7eb669
> UNTOUCHED. Do not merge.
>
> OLD MIGRATION BRANCH:
> docs/demo-migration-plan
> 1b233362ef391e4b8f31df9e48c56b3687e36222
> DO NOT MERGE
>
> PROTECTED WIP:
> arena/01a0e8ec-parsian-music-dashboard-opus
> local only, HEAD eb973eb2758447eff16b60ab4fd4c267f9d85061
> Do not push, reset, or clean it.
>
> BACKEND:
> NOT STARTED
>
> TELEGRAM:
> NOT STARTED
>
> PUSH:
> NOT STARTED
>
> CURRENT PHASE:
> Phase B — PARTIAL, not complete
>
> NEXT PHASE:
> Owner decisions PB-1 through PB-5 in OPEN_ITEMS.md.
> Do not implement those decisions.
> Do not start backend, Telegram, or push.
> Do not merge to main.
> ```
>
> Phase B commits already on this branch, before this stamp:
> - `5e5fa35af30070fa08b1ad6004f2ab29dffc27b0` — gate writes the matrix already names
> - `88fee2665434647f81b05b0f1560270ab56b86e3` — tests for those gates
>
> Completed in those commits, and only that:
> - `finance.write` hides «ثبت پرداخت» on the deferred finance view
> - `messages.write` hides send, create, templates, and conversation management
> - `settings.write` hides branding edit and save
> - `library.write` hides gallery panel writes
> - settings export uses the session permission holder (I22 frontend half)
> - student import is hidden without `students.write`
> - T-02 comment in `src/domains/auth/scope.ts` now says ACCEPTED / ASSIGNED-ONLY
>
> Not completed, and not chosen:
> - PB-1 teacher with no `teacherId`
> - PB-2 privileged account identity, including current-password proof
> - PB-3 room, instrument, learning, and progress write permission
> - PB-4 `useCan(...) || !user`
> - PB-5 notifications domain versus later delivery
> - student portal UI (D1: no student role in this panel)
> - `organization_id` on the session (not added)
>
> Known failure, not touched: I19 `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra id `ses_cl2_20260929_1400`.
>
> Gap matrix: [PHASE_B_FRONTEND_GAP_MATRIX.md](PHASE_B_FRONTEND_GAP_MATRIX.md).
> Owner decisions: [OPEN_ITEMS.md](OPEN_ITEMS.md) PB-1..PB-5.
> Chat / Telegram / notifications / push boundary, no new paths: [../frontend-completion/10-integration-architecture.md](../frontend-completion/10-integration-architecture.md) Phase B boundary.
>
> Protected refs must remain `main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`, `backup/pre-f2-2026-09-29` `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`, archive tag `eb973eb2758447eff16b60ab4fd4c267f9d85061`.
> Two compositions only. Registry paths remain `src/domains/registry.ts`, `src/domains/registry.client.ts`, and `src/domains/registryCore.ts`.
> `PROJECT_STATE.md` was not rewritten. Its tests pin an older checkpoint. This pointer is the live Phase B record.
>
> History-cleanup tip before Phase B: `33fc21443e0c11a83f2039dd5152130fa1dbcab2`, parent `0b5b38f771cc3f82afe9c46883ef5372dcd701ce`, subject `docs(engineering): stamp the cleaned tip SHA`. That commit remains an ancestor. Do not reset to it.

> **HISTORY-CLEANUP POINTER — 2026-09-30, choice B executed on this branch.** Kept verbatim below this heading. It is not the live work order.
> Owner decision B is done **only** on `cleanup/demo-migration-lineage`. `main` has **not** moved.
> `docs/demo-migration-plan` remains the uncleaned lineage and must not be force-updated.
> W7A, W7B, W8, W9, and W10 are **closed**. Do **not** re-run them. Do **not** start backend, Telegram, or push work from this file.
> Do **not** merge this branch to `main` until a separate owner authorization.
>
> **Cleanup checklist**
> 1. Current cleaned tip is the commit that contains this checklist and whose parent is `0b5b38f771cc3f82afe9c46883ef5372dcd701ce`. Subject: `docs(engineering): stamp the cleaned tip SHA`. That parent is the handoff correction. Its own SHA cannot be stored inside itself.
> 2. Previous tip: `1b233362ef391e4b8f31df9e48c56b3687e36222` on `docs/demo-migration-plan`. That ref was not force-updated.
> 3. Old→new mapping is §4. No squash.
> 4. Removed from this lineage only: `1eb6366d0482c55845e5239ed20a9b44a4e6f68b`, `10c815412f4e951b8f05323de4e50927f116ab05`, `22cbd26f17009bdd695cf6900d07f743806f2030`. No other lineage was removed.
> 5. Protected refs must remain `main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`, `backup/pre-f2-2026-09-29` `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`, archive tag `eb973eb2758447eff16b60ab4fd4c267f9d85061`. WIP was not touched.
> 6. W7A–W10 evidence remains reachable. See §7.
> 7. Two compositions only. Registry paths are `src/domains/registry.ts`, `src/domains/registry.client.ts`, and `src/domains/registryCore.ts`. Not `src/app/`.
> 8. Frontend/API readiness is §10. No server exists in this repository.
> 9. Backend implementation has NOT started.
> 10. The next authorized phase is separate from this history cleanup. Do not merge to `main`. Do not start backend. Migration and product completion are NOT proven.
>
> Sibling historical records, still present and not deleted:
> [PROJECT_STATE.md](PROJECT_STATE.md) · [PHASES.md](PHASES.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md) · [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) ·
> [PRE_CLEANUP_HANDOFF.md](PRE_CLEANUP_HANDOFF.md) ·
> [../session-handoffs/DEMO_MIGRATION_CONTINUATION_HANDOFF.md](../session-handoffs/DEMO_MIGRATION_CONTINUATION_HANDOFF.md) ·
> [../migration/W10_ERADICATION_AUDIT.md](../migration/W10_ERADICATION_AUDIT.md)
>
> The body below this live pointer, beginning at “HISTORICAL BODY”, is the previous text of this file.
> Its SHAs are preserved on purpose. None of that body is a live work order. In particular, do **not**
> merge PR #16 or PR #18, do **not** treat `6ca25be` as HEAD, and do **not** start F2 from that body.

**Recorded:** 2026-09-30 · **Nature:** documentation-only recovery checkpoint. Choice B replayed
the migration lineage onto `039b9c82` and dropped only the net-zero dead-end. It does not merge
to `main` and does not authorize backend implementation.

**Rule this file exists to enforce:** Git cleanup without this handoff is unsafe. A later rewrite
must update this same file with the complete old-SHA → new-SHA mapping before anyone may declare
cleanup complete. Old SHAs in this file must not be deleted.

---

## SESSION RECOVERY

```text
Current branch:     cleanup/demo-migration-lineage
Pre-cleanup tip:    1b233362ef391e4b8f31df9e48c56b3687e36222 on docs/demo-migration-plan
                    that ref is preserved and was not force-updated
Replay base:        039b9c827d54aabbec9e90557c3efb49eb37678a
                    tree 4afa9351d3b797e8a4444609c9ab50bd37051ec3
                    identical to 22cbd26f17009bdd695cf6900d07f743806f2030^{tree}
Pre-handoff tree:   a89fa7324a9fcab7f8c8477db05abfea11698663
                    tree afba3b8e48f4668459b2b0930522590dcc23a756
                    old equivalent 13599bbfc4fdce42de975ef28d104a8264bf88bf
Rewritten handoff:  98842129c75e5f8e5ecd128f8276e6c8e1f5e1b5
                    old ca8afba365e375a9c150fef5441f200f3e9f9dc4
                    same tree f5198ed4655af85b8ac4884bda4d491ef0c8743f
SHA-record replay:  f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8
                    old 1b233362ef391e4b8f31df9e48c56b3687e36222
                    same tree d15d1ce02a1472e88664ba98eca5ece22b4fbb3e
Mapping tip:        689de032b658a2eebf50a2b54d184d855336f54d
                    parent f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8
                    subject: docs(engineering): record the cleaned-history mapping
Handoff correction: 0b5b38f771cc3f82afe9c46883ef5372dcd701ce
                    parent 689de032b658a2eebf50a2b54d184d855336f54d
                    subject: docs(engineering): record the cleaned tip SHA
Current cleaned tip: this stamp commit
                    parent must be 0b5b38f771cc3f82afe9c46883ef5372dcd701ce
                    subject: docs(engineering): stamp the cleaned tip SHA
Remote check:       git ls-remote origin refs/heads/cleanup/demo-migration-lineage
Main:               15775ea9486cb57fbfb8fefa3268658cbe7eb669
                    UNTOUCHED. Do not merge yet.
Backup:             backup/pre-f2-2026-09-29 @ 62deb84dfbbd9d7ad27002196569d0c7ef4c87f6
Archive:            archive/gallery-library-storage-eb973eb @ eb973eb2758447eff16b60ab4fd4c267f9d85061
                    archive/frontend-session-handoff-94d32de @ 94d32de3220cee314606c0c4705e20e0fdcfb2af
                    archive/palette-focus-251af96 @ 251af96f405df5935ee17ddc9ba6b490f7989c2d
                    archive/mountain-sanctuary-bb275d6 @ bb275d6c8063a3ca34eb3a24c0539e43ea991182
                    archive/premium-academy-login-afe6b02 @ afe6b0278c7aed447552eec76ee2caf0f6a7e616
                    archive/project-state-gate-7180082 @ 7180082fac85f4451ac8e7d2ed1312a26bcfb486

Last completed operation:
  Owner decision B. Rebase --onto 039b9c82 22cbd26 on a new branch only.
  Eleven commits replayed. Each replayed tree SHA equals the old commit's tree SHA.
  The three rejected commits are not ancestors of this branch.

Last verified operation:
  039b9c82^{tree} == 22cbd26^{tree} == 4afa9351d3b797e8a4444609c9ab50bd37051ec3
  a89fa732^{tree} == 13599bb^{tree} == afba3b8e48f4668459b2b0930522590dcc23a756
  git diff 13599bb a89fa732 is empty.
  Dead-end SHAs are not ancestors of this HEAD.
  They remain ancestors of local docs/demo-migration-plan at 1b23336.

Pending operation:
  None on this branch. Do not merge to main. Do not start backend.

Safe to continue from:
  cleanup/demo-migration-lineage after ls-remote matches the tip predicate above.
  Do not continue from docs/demo-migration-plan if the task is the cleaned lineage.
  Do not continue from the historical body below.

Do NOT repeat:
  W7A, W7B, W8, W9, W10.
  The rejected three-artifact attempt or its revert.
  This rebase.

Do NOT modify:
  main, backup/pre-f2-2026-09-29, any archive tag, docs/demo-migration-plan.
  The protected dirty WIP at /home/user/parsian-music-dashboard-opus
    branch arena/01a0e8ec-parsian-music-dashboard-opus
    HEAD eb973eb2758447eff16b60ab4fd4c267f9d85061
  APP_TARGET, vite.config.ts, the two registries, the D9 cap, SEED_DATE,
  SEED_VERSION, ava:demo: keys, schedulingWrites.test.tsx.

Next exact step:
  Stop. Do not merge to main. Wait for a separate owner authorization before any merge.
```

The pre-cleanup handoff content remains `ca8afba365e375a9c150fef5441f200f3e9f9dc4` on `docs/demo-migration-plan`, rewritten here as `98842129c75e5f8e5ecd128f8276e6c8e1f5e1b5` with the same tree `f5198ed4655af85b8ac4884bda4d491ef0c8743f`. Its SHA-record child is rewritten as `f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8`. Neither text was dropped. The mapping commit is `689de032b658a2eebf50a2b54d184d855336f54d`. The current cleaned tip is its child.

---

## 1. Current remote refs

The table below is the pre-cleanup verification. After this commit is pushed, the cleaned ref is `cleanup/demo-migration-lineage`. `main`, backup, archive tags, and `docs/demo-migration-plan` must still match the protected values below. Re-verify with `git ls-remote` before any later action.

| Ref | SHA at verification | Role |
| --- | --- | --- |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` | Untouched. Tree `6eb78338ec19880adf5f97735f61de32e11cbf20`. |
| `docs/demo-migration-plan` | `13599bbfc4fdce42de975ef28d104a8264bf88bf` | Pre-handoff tip. This commit's parent. |
| `backup/pre-f2-2026-09-29` | `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` | Backup. Do not move. |
| `archive/gallery-library-storage-eb973eb` | `eb973eb2758447eff16b60ab4fd4c267f9d85061` | Archive tag. Do not move. |
| `archive/frontend-session-handoff-94d32de` | `94d32de3220cee314606c0c4705e20e0fdcfb2af` | Archive tag. Do not move. |
| `archive/palette-focus-251af96` | `251af96f405df5935ee17ddc9ba6b490f7989c2d` | Archive tag. Also an `arena/` branch tip. Do not move. |
| `archive/mountain-sanctuary-bb275d6` | `bb275d6c8063a3ca34eb3a24c0539e43ea991182` | Archive tag. Do not move. |
| `archive/premium-academy-login-afe6b02` | `afe6b0278c7aed447552eec76ee2caf0f6a7e616` | Archive tag. Do not move. |
| `archive/project-state-gate-7180082` | `7180082fac85f4451ac8e7d2ed1312a26bcfb486` | Archive tag. Do not move. |

Other `arena/*` branches exist on the remote. They are not the migration line and are not backup.
The protected WIP branch `arena/01a0e8ec-parsian-music-dashboard-opus` was local-only at verification
and must not be pushed, reset, or cleaned.

`docs/demo-migration-plan` at `13599bb` was 32 commits ahead of `main` and 0 behind. A fast-forward
of `main` was possible and was **not** performed.

## 2. Exact pre-cleanup HEAD

`13599bbfc4fdce42de975ef28d104a8264bf88bf`

| Field | Value |
| --- | --- |
| Subject | `docs(migration): W10 eradication audit` |
| Parent | `c783bec7ae334e30e9b557f6b331ac5a1d9ed556` |
| Tree | `afba3b8e48f4668459b2b0930522590dcc23a756` |

This is the pre-cleanup tip. Any later cleaned history must preserve this tree, then add this
handoff. The tree that must be preserved through a rewrite of the 32 commits is `afba3b8e`. The
tree of the branch after this handoff commit is that tree plus this documentation change only.

## 3. Exact post-cleanup HEAD

Choice B is executed on `cleanup/demo-migration-lineage` only.

| Role | SHA |
| --- | --- |
| Pre-handoff cleaned commit | `a89fa7324a9fcab7f8c8477db05abfea11698663` |
| Pre-handoff tree | `afba3b8e48f4668459b2b0930522590dcc23a756` |
| Rewritten handoff content | `98842129c75e5f8e5ecd128f8276e6c8e1f5e1b5` |
| Rewritten SHA-record | `f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8` |
| Mapping tip | `689de032b658a2eebf50a2b54d184d855336f54d` |
| Handoff correction | `0b5b38f771cc3f82afe9c46883ef5372dcd701ce` |
| Current cleaned tip | this stamp commit; parent `0b5b38f771cc3f82afe9c46883ef5372dcd701ce`; subject `docs(engineering): stamp the cleaned tip SHA` |

`main` is not the post-cleanup HEAD. It is still `15775ea9486cb57fbfb8fefa3268658cbe7eb669`.
`docs/demo-migration-plan` is not the post-cleanup HEAD. It remains the uncleaned lineage.

## 4. Complete commit mapping

Executed on `cleanup/demo-migration-lineage` by `git rebase --onto 039b9c827d54aabbec9e90557c3efb49eb37678a 22cbd26f17009bdd695cf6900d07f743806f2030`. No squash was performed. Unchanged commits keep the same SHA. Rewritten commits keep the same tree SHA as the old commit. Old SHAs below are not deleted from this file, and the three removed commits remain reachable from `docs/demo-migration-plan` at `1b233362ef391e4b8f31df9e48c56b3687e36222`.

| Old SHA | Purpose | Fate on this branch | New SHA |
| --- | --- | --- | --- |
| `85345c932c4ac510b1e74c9e16fa329c4c7f82cd` | W1 discovery plan | unchanged ancestor | `85345c932c4ac510b1e74c9e16fa329c4c7f82cd` |
| `379076f63915e46f34e73236041bd95725ffefa8` | W1 decision boundary | unchanged ancestor | `379076f63915e46f34e73236041bd95725ffefa8` |
| `c5ba4a96e554bf59d8d7fde2695f6cede350efa2` | W1 handoff and document-reference fix | unchanged ancestor | `c5ba4a96e554bf59d8d7fde2695f6cede350efa2` |
| `bab9e460b603f9499a9b0735050e1cb729384602` | W1 remote-verification note | unchanged ancestor; not squashed | `bab9e460b603f9499a9b0735050e1cb729384602` |
| `25b432a4f3ed5c7cb924878477fceaf93b54fa85` | W2 dataset extraction | unchanged ancestor | `25b432a4f3ed5c7cb924878477fceaf93b54fa85` |
| `d954ba95c4299d5df852cfd398a2c0cb1f805987` | W2 evidence | unchanged ancestor | `d954ba95c4299d5df852cfd398a2c0cb1f805987` |
| `713d9b3a43d825fb9f3cca01a05878f813ba60bd` | W2 remote-verification note | unchanged ancestor; not squashed | `713d9b3a43d825fb9f3cca01a05878f813ba60bd` |
| `5fadf0769273178bd07c770f907871753f541768` | W3 local store canonical | unchanged ancestor | `5fadf0769273178bd07c770f907871753f541768` |
| `2cb4b1e29a83350ca17fa02ddf4786d2546b09ae` | W3 evidence | unchanged ancestor | `2cb4b1e29a83350ca17fa02ddf4786d2546b09ae` |
| `6fed2a34b979384a2b94870559391d3a7d304315` | W3 remote-verification note | unchanged ancestor; not squashed | `6fed2a34b979384a2b94870559391d3a7d304315` |
| `59929196888410483b320c6ee883eb8e8316c43a` | W4 local repositories canonical | unchanged ancestor | `59929196888410483b320c6ee883eb8e8316c43a` |
| `8bd4981c0472d766d3196e1f354368a8413d6d0e` | W4 evidence | unchanged ancestor | `8bd4981c0472d766d3196e1f354368a8413d6d0e` |
| `500d30f151a637ddfd41e60d454210ef406ef908` | W5 organization in the locally-served enumeration | unchanged ancestor | `500d30f151a637ddfd41e60d454210ef406ef908` |
| `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac` | W5 evidence | unchanged ancestor | `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac` |
| `bfddc30bce1288f25135f313758bf5fa3bb26949` | W6 lifecycle marker | unchanged ancestor | `bfddc30bce1288f25135f313758bf5fa3bb26949` |
| `934a6d62f2d6edc4b06ccb29de118679dc9b038a` | W6 lifecycle evidence | unchanged ancestor | `934a6d62f2d6edc4b06ccb29de118679dc9b038a` |
| `896fddd2531d7d72dc9c23f63b3a7657a5035ad7` | W6 `demo` env alias to local | unchanged ancestor | `896fddd2531d7d72dc9c23f63b3a7657a5035ad7` |
| `b3d417e287afda009c12d03ee88e9bfa078f224f` | W6 alias evidence | unchanged ancestor | `b3d417e287afda009c12d03ee88e9bfa078f224f` |
| `b8f62877cf50815394e9f1ae26c86fb7da060c7e` | W7A client refuses local and demo sources | unchanged ancestor | `b8f62877cf50815394e9f1ae26c86fb7da060c7e` |
| `039b9c827d54aabbec9e90557c3efb49eb37678a` | W7A evidence | unchanged ancestor; replay base | `039b9c827d54aabbec9e90557c3efb49eb37678a` |
| `1eb6366d0482c55845e5239ed20a9b44a4e6f68b` | rejected three-artifact build | removed from this lineage only | removed from this lineage |
| `10c815412f4e951b8f05323de4e50927f116ab05` | rejected three-artifact evidence | removed from this lineage only | removed from this lineage |
| `22cbd26f17009bdd695cf6900d07f743806f2030` | revert of that rejected attempt | removed from this lineage only | removed from this lineage |
| `9357704a62b3c8b0d341c77a7d0390c7d28358d3` | W7B Import and Reset | rewritten; same tree `73855a6d9efe8a761b93c7e8c439f6553c12c6a7` | `f3e96a32f5b81151e5aa5475d20cfd6f88d9b524` |
| `619c2bb3efc07308568c0c646e683a0e3a1182d4` | W7B first evidence | rewritten; same tree `ab2784a8fc823247fea5a08e24b907e287c1b2b0` | `b25e025fb6a239e606b9e6cd9ab67d24235d8562` |
| `f791f90c6e1d7956bf0c9bfd46cf02ebc3cb9f53` | W7B contract close | rewritten; same tree `d855475b258eb3ffd6b8c871390a859c85191aea` | `a97235fda962d7ba753789ebffa3b51bf3b395e9` |
| `186f3b7b14f6283834fb391c7cd6dcd8d254b432` | W7B contract evidence | rewritten; same tree `99ac9f95930effc6e9e08725a2e60526e84e4ae5` | `b9fd0d17a329fa96e80d2009c45dce9d3196e6b9` |
| `318c0f2ea2d68a62f2273797c547a584546a3a5d` | W8 two-composition gates | rewritten; same tree `35deaae8e0f8f8c2ed4a64847665a6e23a9ad2f3` | `63cd034164bc0c4cbd7c420b16ef9900a16faacf` |
| `bc5f1cfa67170ff106f8811cee476ea241d140d4` | W8 evidence | rewritten; same tree `72c869963529c180581fb35005cb8c44c16e4aec` | `7477349e5debf140fda55636ad7d2d1356daa31d` |
| `14a62fd720878a3bdf5f40cf2d7cbb8c52415a16` | W9 two Class-H renames | rewritten; same tree `6e8dc6b78430821fab03bcf06403c92b648ff655` | `7efa032c450fd180d7158ff217162c24fe2454ff` |
| `c783bec7ae334e30e9b557f6b331ac5a1d9ed556` | W9 evidence | rewritten; same tree `05b0e72c0ecb254760990398c3ac3029ba335c94` | `7894a9a4a5ec8dd601b5a41a2ccd3fa27f1d5bb3` |
| `13599bbfc4fdce42de975ef28d104a8264bf88bf` | W10 eradication audit | rewritten; same tree `afba3b8e48f4668459b2b0930522590dcc23a756` | `a89fa7324a9fcab7f8c8477db05abfea11698663` |
| `ca8afba365e375a9c150fef5441f200f3e9f9dc4` | pre-cleanup handoff content | rewritten; same tree `f5198ed4655af85b8ac4884bda4d491ef0c8743f` | `98842129c75e5f8e5ecd128f8276e6c8e1f5e1b5` |
| `1b233362ef391e4b8f31df9e48c56b3687e36222` | handoff SHA-record | rewritten; same tree `d15d1ce02a1472e88664ba98eca5ece22b4fbb3e` | `f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8` |

The mapping commit is `689de032b658a2eebf50a2b54d184d855336f54d`. Its parent is `f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8`. It is not a product commit. The current cleaned tip is the following documentation commit.

No implementation commit has been squashed. The three remote-verification commits are content-bearing documentation and were not squashed.

## 5. Commits intentionally removed

Removed from `cleanup/demo-migration-lineage` only. Not deleted from the repository. Still reachable from `docs/demo-migration-plan` at `1b233362ef391e4b8f31df9e48c56b3687e36222`. Not reachable from this branch.

| Old SHA | Parent | Tree | Class | Why it left this lineage |
| --- | --- | --- | --- | --- |
| `1eb6366d0482c55845e5239ed20a9b44a4e6f68b` | `039b9c827d54aabbec9e90557c3efb49eb37678a` | `ad250ca5a50a27789f197c389e8b9705574fb362` | rejected architecture attempt | Built customer, client, and operator as three artifacts. Owner rejected it. |
| `10c815412f4e951b8f05323de4e50927f116ab05` | `1eb6366d0482c55845e5239ed20a9b44a4e6f68b` | `281f5b7e24927d67d39511eaad30d535d9d84996` | evidence of that rejected attempt | Added `docs/migration/W7_THREE_TARGET_EVIDENCE.md`. That file is not in the required tree. |
| `22cbd26f17009bdd695cf6900d07f743806f2030` | `10c815412f4e951b8f05323de4e50927f116ab05` | `4afa9351d3b797e8a4444609c9ab50bd37051ec3` | revert of that experiment | Restored the W7A tree. Its tree equals `039b9c82`. |

The replay was run. `a89fa7324a9fcab7f8c8477db05abfea11698663` has tree `afba3b8e48f4668459b2b0930522590dcc23a756`, identical to old `13599bb`. Evidence commits, verification notes, and both W7B batches were kept. No other commit was removed.

## 6. Final tree contract

Required tree of the pre-handoff tip: `afba3b8e48f4668459b2b0930522590dcc23a756`.

What remains, relative to `main`:

- Versioned dataset extraction and local store as the persistence authority.
- Local repositories as the canonical demo/local implementation.
- The 12-id locally-served enumeration, including `organization`, in both lists.
- Lifecycle marker and the `demo` env alias to local.
- Client composition refusal of local and demo sources.
- Fixture-only Import and Reset.
- W8 boundary gates.
- W9 renames: `demoReferences.ts` → `mediaReferences.ts`; `demoCollection.ts` removed and importers pointed at `repositoryPlumbing.ts`.
- W10 audit at `docs/migration/W10_ERADICATION_AUDIT.md`.
- This handoff, after this commit.

What was removed from the tip tree and must stay removed:

- A third composition.
- `dist/customer` and `dist/operator` as build outputs.
- `docs/migration/W7_THREE_TARGET_EVIDENCE.md`.

What was renamed and must stay renamed:

- `src` reference module `demoReferences.ts` → `mediaReferences.ts`.
- Class-H collection import path away from `demoCollection.ts` onto `repositoryPlumbing.ts`.

What must not be touched:

- `main`, the backup branch, archive tags, and the dirty WIP.
- `vite.config.ts` and `APP_TARGET` selection.
- Registry split: `registry.ts`, `registry.client.ts`, `registryCore.ts`. No merge. No third composition.
- D9 subject `dist/client`, cap exactly `361144`, recorded size `306416`. Fixture `362149` is not under that cap.
- `SEED_DATE`, `SEED_VERSION`, `ava:demo:` storage keys, Import/Reset credentials, dataset schema.
- `src/views/__tests__/schedulingWrites.test.tsx`.
- `src/__tests__/projectState.test.ts`. Do not weaken it to hide clone-only failures.

## 7. Demo migration state

| Wave | Closure | Old SHA | SHA on this branch |
| --- | --- | --- | --- |
| W7A implementation | closed | `b8f62877cf50815394e9f1ae26c86fb7da060c7e` | same |
| W7A evidence | closed | `039b9c827d54aabbec9e90557c3efb49eb37678a` | same |
| W7B Import/Reset | closed | `9357704a62b3c8b0d341c77a7d0390c7d28358d3` | `f3e96a32f5b81151e5aa5475d20cfd6f88d9b524` |
| W7B first evidence | closed | `619c2bb3efc07308568c0c646e683a0e3a1182d4` | `b25e025fb6a239e606b9e6cd9ab67d24235d8562` |
| W7B contract close | closed | `f791f90c6e1d7956bf0c9bfd46cf02ebc3cb9f53` | `a97235fda962d7ba753789ebffa3b51bf3b395e9` |
| W7B contract evidence | closed | `186f3b7b14f6283834fb391c7cd6dcd8d254b432` | `b9fd0d17a329fa96e80d2009c45dce9d3196e6b9` |
| W8 gates | closed | `318c0f2ea2d68a62f2273797c547a584546a3a5d` | `63cd034164bc0c4cbd7c420b16ef9900a16faacf` |
| W8 evidence | closed | `bc5f1cfa67170ff106f8811cee476ea241d140d4` | `7477349e5debf140fda55636ad7d2d1356daa31d` |
| W9 rename | closed | `14a62fd720878a3bdf5f40cf2d7cbb8c52415a16` | `7efa032c450fd180d7158ff217162c24fe2454ff` |
| W9 evidence | closed | `c783bec7ae334e30e9b557f6b331ac5a1d9ed556` | `7894a9a4a5ec8dd601b5a41a2ccd3fa27f1d5bb3` |
| W10 audit | closed as a read-only audit, not an implementation | `13599bbfc4fdce42de975ef28d104a8264bf88bf` | `a89fa7324a9fcab7f8c8477db05abfea11698663` |

W10 records `Migration Complete = NOT PROVEN`. That sentence is still true. Closed waves are not a license to repeat them. The rejected three-artifact line is not a closure state. It is absent from this branch and still present on `docs/demo-migration-plan`.

W1 still records the membership decision as pending in `docs/migration/W1_DECISION_BOUNDARY.md`. W5 code put `organization` in the 12-id lists. Do not “resolve” that record in a cleanup. Do not confuse it with `DECISIONS.md` D8. Those are different namespaces.

## 8. Current known failures

Not re-run in the handoff turn. Do not mark them fixed.

| Failure | State |
| --- | --- |
| I19 | `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra id `ses_cl2_20260929_1400`. Pre-existing frontend seed-date failure. Not a backend contract. Do not edit the test to make it pass. |
| `projectState` on a shallow or single-branch clone | Missing historical objects, including tip `251af96f405df5935ee17ddc9ba6b490f7989c2d`, and missing `origin/main` in a clone that only has the migration branch. Environmental. Do not edit `src/__tests__/projectState.test.ts` or the engineering docs to hide them. |
| Newly discovered in this handoff turn | None. Tests and builds were not run. |

## 9. Current architecture

Two compositions only.

| Fact | Contract |
| --- | --- |
| Client build | `build:client` → `dist/client` |
| Demo build | `build:demo` → `dist/demo` |
| Registries | `src/domains/registry.ts`, `src/domains/registry.client.ts`, `src/domains/registryCore.ts`. Do not merge them. |
| `APP_TARGET=client` | Selects the client composition. |
| `APP_TARGET=demo`, empty, or any unknown value, including `operator` and `customer` | Selects demo. This is recorded behavior, not a defect to fix in cleanup. |
| Client isolation | The client graph does not import the demo store, seed, credentials, or local repositories. Twelve domains are `DOMAIN_UNAVAILABLE` in the client composition. |
| D9 | Subject is `dist/client` only. Cap is exactly `361144`. Recorded gzip size is `306416`. Do not quote a new measurement. No rebuild was run for this handoff. |
| Migration membership list | Two mirrored 12-id lists, both including `organization`. The W1 owner decision record is still pending. |
| Remaining demo compatibility surface | `demoStore.ts`, four `demoRepository.ts` shims, `demoCredentials.ts`, `DemoDataPanel`, `DemoBackedNotice`, `DemoNote`, `DemoServedDomain`, and `ava:demo:` keys. Do not rename or remove them in cleanup. |

“One application” means the client composition is the application boundary. It does not authorize merging compositions.

## 10. Backend readiness

No Laravel, PHP, `composer.json`, or `artisan` exists in this repository. An `apiRepository.ts` is a frontend client contract, not a running server.

Client base is `/api/v1`. `ApiClient` is JSON-only (`get`, `post`, `patch`, `delete`, `getPage`), unwraps `{ data }` or `{ data, meta }`, and sends `Authorization: Bearer`. It cannot carry a binary body. Timeout is `15000`.

### Wired client contracts — server absent

The client composition can call these. Building them does not require inventing paths.

| Domain | Contract present in source |
| --- | --- |
| Authentication | `POST auth/login` body `{ email, password }` → `{ data: { user, permissions, token, expires_at } }`; `POST auth/logout`; `GET auth/me`. Server is the identity and authorization authority. |
| Users | `GET/POST users`, `GET/PATCH/DELETE users/{id}`, `POST users/{id}/password` `{ password }`, `GET users/{id}/password` → `{ has_password }`. |
| Roles | `GET roles`, `GET/PATCH roles/{id}`, `POST roles/{id}/reset`. |
| Students | `students` CRUD. Query: `search`, `status`, `instrument`, `payment`, `teacher_id`, `sort`, `page`, `per_page`. Wire DTO mapping is explicitly deferred in the client file. |
| Teachers | `teachers` CRUD plus `POST teachers/{id}/deactivate`. Query also has `assignable` and `dir`. |
| Rooms | `rooms` CRUD plus `POST rooms/{id}/deactivate`. |
| Classes | `classes` CRUD plus `POST classes/{id}/archive`. |
| Enrollments | `enrollments` CRUD plus `POST enrollments/{id}/withdraw`. Capacity and duplicates are server-side. |

### Contract present, not registered

The client composition returns `DOMAIN_UNAVAILABLE`. Do not wire these during cleanup.

| Domain | Named contract | Gap |
| --- | --- | --- |
| Library | `resources` CRUD. Query adds `kind`, `level`, `visibility`. | `POST /uploads` and `GET /resources/{id}/download` are named and not called. Download is not implemented. |
| Organization | `GET /organization`, `PATCH /organization` | Not selected. Writes name `settings.read` / `settings.write` and require server validation. |
| Progress | pieces and piece-assignments CRUD; `GET/POST progress-events`; `GET students/{id}/progress-overview` | Events are append-only. No PATCH or DELETE on events. |
| Scheduling | sessions CRUD, `cancel`, `reschedule`, `POST sessions/generate?preview=1`, `POST sessions/check-conflicts`, `GET sessions/{id}/roster` | Conflicts must be rechecked in the write transaction. Preview is read-only. Roster is enrollment-backed and caller-scoped. |
| Attendance | listed GET/POST routes including `bulk`, `{id}/correct`, corrections, session attendance reads, `sessions/with-attendance` | No PATCH or DELETE. `UNIQUE(session_id, student_id)`. Bulk is one transaction. Corrections are append-only. Actor ids come from the session, not the body. |

### CONTRACT MISSING — OWNER DECISION REQUIRED

No HTTP class exists. Do not invent endpoints.

- Instruments
- Learning
- Chat
- Media (`getBlob` only; bytes are local blobs)
- Branding
- Gallery
- Compensation (`list`, `get`, `register`, `schedule`, `complete`; source says there is deliberately no API class)

Finance, reports, messaging, and notifications are not empty directories, but they have no API repository. Export and student import are frontend file tools.

### Security

`docs/security.md` §8 is identified and not implemented. Required before a production backend can be called ready: server password hashing, authorization on every endpoint, rate limiting, server session revocation, CSRF if cookies are used, tenant isolation, IDOR checks, an append-only progress log, audit logging, breached-password checks, admin MFA, the upload pipeline, and encrypted backups.

`organization_id` is a type comment on several domain types, not a field on the auth wire session. Do not assume the current JSON body carries it.

Frontend RBAC is UX only. Named permissions used by the client include `students`, `teachers`, `classes`, `schedule`, `attendance`, `finance`, `messages`, and `library` read/write, plus `reports.read`, `settings.read`, `settings.write`, and `demo.manage`. Do not invent a permission count. `demo.manage` is the fixture Import/Reset gate, not a production API contract. `T-02` remains the live governance decision in `GOVERNANCE_CHECKPOINT.md` (accepted, assigned-only). Do not reopen it. Server enforcement of that decision does not exist yet.

### Telegram, Bale, and push

Required product capabilities, contract now, backend later. Source: `docs/frontend-completion/16-telegram-bale-backup-integration.md`. No Telegram Bot API implementation in React. Current backup is the local JSON envelope in `src/domains/demo/backup.ts`. Chat provider labels include `telegram` and `bale` and report unavailable without a backend. No web-push or service-worker implementation was found in `src` at this tip. Do not start that work from this handoff.

### Required backend work, not authorized now

First slice the current client composition can call, after an explicit owner authorization that is separate from cleanup: authentication, then users and roles, then teachers, rooms, and students, then classes, then enrollments. Students stay field-incomplete until the deferred wire mapping is decided. The twelve unavailable domains are not in that slice.

## 11. Git cleanup decision

**Executed as owner decision B, on `cleanup/demo-migration-lineage` only. `main` is still untouched.**

What was done:

- New branch, not a force-update of `main`, backup, archive tags, or `docs/demo-migration-plan`.
- `git rebase --onto 039b9c827d54aabbec9e90557c3efb49eb37678a 22cbd26f17009bdd695cf6900d07f743806f2030`.
- Dropped only `1eb6366`, `10c8154`, and `22cbd26` from this lineage.
- Kept every other commit, including evidence and both handoff commits, with identical trees.
- Did not squash the remote-verification notes.
- Pre-handoff tree is `afba3b8e48f4668459b2b0930522590dcc23a756`.

Merge strategy now:

- Do not merge to `main` yet.
- Do not fast-forward `main`.
- Do not force-push `docs/demo-migration-plan`. The old SHAs must stay reachable there.
- A later merge requires a separate owner authorization and a PR from this branch. It has not been opened.

## 12. Exact next action

Stop. Do not merge to `main`.

Do not:

- rewrite this branch again
- force-push `main`, backup, archive tags, or `docs/demo-migration-plan`
- touch the protected WIP
- re-run W7A, W7B, W8, W9, or W10
- fix I19
- change D9, `APP_TARGET`, registries, seeds, or storage keys
- invent API endpoints
- start backend, Telegram, Bale, or push implementation

Cleanup of this branch is recorded here. Merge to `main` is not done and is not authorized by this commit.

---

## HISTORICAL BODY — preserved, not a live work order

> The following text is the previous contents of `docs/engineering/SESSION_HANDOFF.md` at
> `13599bbfc4fdce42de975ef28d104a8264bf88bf`. It is preserved so its SHAs are not deleted.
> Do not execute its next-action lines. The live pointer at the top of this file supersedes them.


# SESSION HANDOFF — post-consolidation

> This file is the recovery document for the next agent session. Conversation memory is not
> durable; this file, Git history, and the test suite are.
>
> Sibling: [PROJECT_STATE.md](PROJECT_STATE.md) · [PHASES.md](PHASES.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md) · [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) ·
> [PRE_CLEANUP_HANDOFF.md](PRE_CLEANUP_HANDOFF.md)

**Recorded:** 2026-09-21 · **Nature:** documentation-only. No product, test, dependency, backend or
Git-history change is authorized by this file.

> **⚠️ LIVE POINTER — added 2026-09-26.** The most recent session closed with **PR #16** (Library
> document preview + clearing the role-policy projection at session boundaries) open and **unmerged**
> on `arena/01a0daeb-parsian-music-dashboard-opus`, head `8fa81a1` on base `main` @ `6c9aa4c`. Its
> full durable record — decisions, verification numbers, mutation evidence, exclusions, the Browser QA
> checklist and the next-session start point — is
> [../session-handoffs/PR16_FINAL_SESSION_HANDOFF.md](../session-handoffs/PR16_FINAL_SESSION_HANDOFF.md).
> Everything below this blockquote remains valid **as the post-consolidation record of 2026-09-21**,
> but its §1 SHA and working-branch rows are historical: `6ca25be` was later pushed, `main` has since
> advanced past the PR #15 merge, and `arena/01a0cef8` is not the live branch. Read §1 as provenance,
> and take current values from `git ls-remote`, never from this table.
>
> **⚠️ LIVE POINTER — 2026-09-27, supersedes the PR #16 pointer above.** The current session closed
> with **PR #18** (**G-7 CLOSED** — a real Library → Teacher relationship, so `composer` is no longer a
> teacher proxy) **open and intentionally unmerged** on
> `arena/01a0e006-parsian-music-dashboard-opus`, G-7 head `096723b` on base `main` @ `8e6bce9`.
> **F2 is NOT STARTED**; backend/Laravel is untouched; **Browser QA remains NOT VERIFIED**. Its full
> durable record — the approved decision, the seed migration, the LearningContent propagation fix,
> the verification numbers, the mutation evidence, the ref-integrity audit, the known
> documentation discrepancy, and the next-session start point — is
> [../session-handoffs/PR18_FINAL_SESSION_HANDOFF.md](../session-handoffs/PR18_FINAL_SESSION_HANDOFF.md),
> with the merge-time Git-object consequences in
> [../session-handoffs/PR18_PRE_MERGE_CONSERVATION.md](../session-handoffs/PR18_PRE_MERGE_CONSERVATION.md).
>
> **Next intended sequence: merge PR #18 → read-only post-merge integrity audit → record the merged
> `main` SHA → only then F2.** Do not begin F2 before that audit completes.
>
> **Do not trust this file's table for the current position — it is a historical record. Take current
> values from `gh pr view 18` and `git ls-remote`, never from §1.**

---

## 1. Canonical state — read this first

| Field | Value |
|---|---|
| Canonical branch | **`main`** |
| Canonical HEAD | **`6ca25be654b56579054c88cd498a42f57ea63582`** — the **D1 documentation checkpoint**, committed locally and **not yet pushed**; the **consolidation merge base** beneath it is `f63ebaab37096fcb25063aca51c713e26d3b3da7` (PR #5), which is still the remote `main` until the push happens. **D1 is not the consolidation merge.** |
| How to verify | `git rev-parse HEAD` and `git rev-parse --abbrev-ref HEAD`; verify the remote independently with `git ls-remote origin refs/heads/main`. **Do not trust a local clone's ancestry — measure whether it is shallow** (`git rev-parse --is-shallow-repository`). |
| F0–F10 frontend product completion | ✅ **COMPLETE / DELIVERED** on canonical history — `docs/frontend-completion/` 01–17 + README |
| Arena Frontend Freeze (M-1..M-6, D7, D9) | ✅ **COMPLETE** — frozen at `a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb`, preserved |
| M10 / M11 chains | ✅ preserved — M10 `e7a64b7777be36ddd97fc3337898fad794118e5b`; M11 `3ed0bfe4ac928451a4bddf9de3a34f7be681c33f` → … → `f7eb86762dc11f7d5dd3c7218e7c697fad29488e` |
| Consolidation | ✅ **COMPLETE** — PR #5 *Consolidate frontend F0–F10 + governance into main* **MERGED** 2026-09-20T21:11:18Z |
| Laravel / backend | ❌ **NOT STARTED and NOT AUTHORIZED** |
| Current gate | **Completion and verification of the documentation pass (D1/D2)** — **D1 committed (`6ca25be…`), D2 being recorded now**; the evidence for D1 is that this handoff's live state rows name it, and no entry may carry its own SHA |
| Working branch — D9 A-lite / B (row added 2026-09-25) | ✅ `arena/01a0cef8-parsian-music-dashboard-opus` @ `046771d` — A2 (`tailwind-merge` → in-repo `mergeClassNames`, `cn()` call sites unchanged) and the D9 re-baseline (**baseline 343 947 B → cap 361 144 B**), committed and pushed fast-forward (`bcacdcb..046771d`); `main` (`ece060d`) untouched. Records: [DECISIONS.md](DECISIONS.md) §22. |

### 1.1 Live vs historical — do not conflate these

| Document | Status |
|---|---|
| [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) (recorded 2026-09-20) | ✅ **LIVE LAW** for `T-02` / `O-*` / `PERF` / `HELP`. Reached from [DECISIONS.md](DECISIONS.md) **§20**, which is a *pointer* and amends no D-entry. |
| `docs/frontend-completion/13-open-decisions.md` (F0 / 2026-09-19) | ⛔ **HISTORICAL SNAPSHOT.** Its `O-01..O-20` **and** `T-02` statuses are superseded by the 2026-09-20 governance checkpoint. Do **not** treat it as current law and do **not** rewrite its rows. |
| [archive/SESSION_HANDOFF-2026-09-18-pre-M1.md](archive/SESSION_HANDOFF-2026-09-18-pre-M1.md) (64 KB, pre-M1) | ⛔ **HISTORICAL.** Preserved unedited — do not rewrite, delete or concatenate. Never a live work order. |
| [PRE_CLEANUP_HANDOFF.md](PRE_CLEANUP_HANDOFF.md) (2026-09-20) | Consolidation **provenance**. Its "not yet safe to consolidate" verdict is now **discharged**; its rationale is retained. |

**The single most important correction this handoff makes:** the earlier operational text in this
file (the F1-kickoff document) described the pre-consolidation world — branch
`arena/frontend-completion-spec`, `CURRENT_HEAD a251e69`, `PR #4 OPEN`, `NEXT ACTION F1`. **All of
that is historical.** PR #4 is **CLOSED and was never merged**; its line
`f00f85e6f817369a32b8921ffb64f58e17ea154e` reached canonical history through PR #5's merge commit
`112f1160104d375481b930517d08592bb67a0a72` instead.

### 1.2 Governance: T-02 and the O-* items

**`T-02` is NOT unresolved.** The live status is **ACCEPTED / ASSIGNED-ONLY** — teacher
student-read = active enrollment ∩ `class.teacherId`; `Student.teacherId` is not authorization;
fail-closed; do not revisit. Report it that way. The older text saying *"T-02 OPEN — EVIDENCE
CONFLICTING — do NOT change"* belongs to the superseded 2026-09-19 snapshot, not to current law.

Do **not** port the two registers into each other: the governance checkpoint's IDs are a separate
namespace from [DECISIONS.md](DECISIONS.md) D1–D20 (collisions: `D7 ≠ O-07`, `D15 ≠ O-15`).

---

## 2. Recovery path for a fresh session

1. Read **this file**, then [PROJECT_STATE.md](PROJECT_STATE.md) §1–§3.
2. Verify Git **before** trusting anything: `git status --porcelain`, `git rev-parse HEAD`,
   `git rev-parse --abbrev-ref HEAD`, `git rev-parse --is-shallow-repository`, and
   `git ls-remote origin refs/heads/main`.
3. Read [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) for the live decision register, and
   [PHASES.md](PHASES.md) → "Consolidation — 2026-09-20" for the ledger event.
4. Read [OPEN_ITEMS.md](OPEN_ITEMS.md) before starting any work.
5. **Never** reset, re-clone, delete, stash or discard uncommitted work without explicit owner
   authorization. If the tree is dirty, record `git status --porcelain` and `git diff --stat` and ask.
6. Re-establish a green baseline before changing anything — and **`npm ci`, never `npm install`**.

---

## 3. Known environmental condition: a shallow clone

The provisioned workspace has been observed **shallow** (`.git/shallow` present, history grafted).
Consequences, recorded rather than papered over:

- `src/__tests__/projectState.test.ts` contains a Git-object block
  (`describe.skipIf(!gitAvailable)("the recorded checkpoints are real Git objects")`). On a shallow
  clone **nine** of its ten assertions fail because recorded historical commits are simply absent
  locally — they are real commits on GitHub, they are just not in this object store. These are
  **environmental**, not documentation defects.
- **The tenth assertion — "the recorded working branch is the branch actually checked out" — was a
  genuine documentation defect** and has been corrected: [PROJECT_STATE.md](PROJECT_STATE.md) §2 now
  records `main`, so that assertion passes.
- **Do not** "fix" environmental failures by editing documents or the test.
  `src/__tests__/projectState.test.ts` must not be modified, skipped or weakened. Deepening the
  clone (`git fetch --unshallow origin`) is a read-only widening but is **not authorized** by this
  handoff — ask first.

---

## 4. Next gate — documentation D1/D2, then (and only then) backend planning

**Current gate: complete and verify the documentation pass (D1/D2).** That means:

- `PROJECT_STATE.md` / `PHASES.md` / `OPEN_ITEMS.md` / this file agree on the canonical branch,
  the canonical HEAD, the consolidation event, the governance source of truth and the Laravel
  status.
- The historical artifacts (`13-open-decisions.md`, the 64 KB archive) are clearly marked
  historical and are **not** presented as current law.
- The recovery quartet leads a fresh session to [DECISIONS.md](DECISIONS.md) §20 and
  [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) without telling it that `T-02` is unresolved.
- `src/__tests__/projectState.test.ts` has **no non-Git assertion red**. Remaining reds, if any, are
  the shallow-clone Git-object class and must be reported as such.

**After that gate, and only on an explicit owner authorization**, the next phase may be Laravel /
backend planning or implementation. **It is NOT started and NOT authorized now.** Neither this
handoff nor the consolidation ledger authorizes a milestone beyond M11, any F-series
implementation, or any `src/` change.

Standing boundary from the freeze, still in force: the frontend is frozen at
`a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb`; all future frontend fixes require an explicit decision
to reopen that freeze. **Browser QA remains NOT VERIFIED** — no browser tooling exists in this
environment, and no claim of browser verification may be made without external evidence.

---

## 4b. Machine-Readable CONTINUE HERE

```json
{
  "CURRENT_PHASE": "POST_CONSOLIDATION — documentation gate (D1/D2)",
  "CANONICAL_BRANCH": "main",
  "CANONICAL_HEAD": "6ca25be654b56579054c88cd498a42f57ea63582",
  "CONSOLIDATION_MERGE_BASE": "f63ebaab37096fcb25063aca51c713e26d3b3da7",
  "PUSH_STATE": "D1 committed locally, NOT pushed — remote main is still f63ebaab",
  "CONSOLIDATION": "COMPLETE — PR #5 merged 2026-09-20T21:11:18Z",
  "FRONTEND_PRODUCT_COMPLETION": "F0–F10 COMPLETE / DELIVERED",
  "FRONTEND_FREEZE": "COMPLETE — M-1..M-6, D7, D9 at a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb",
  "PR_4": "CLOSED — never merged",
  "PR_5": "MERGED into main",
  "GOVERNANCE_SOURCE_OF_TRUTH": "docs/engineering/GOVERNANCE_CHECKPOINT.md (@ DECISIONS.md §20)",
  "T_02_STATUS": "ACCEPTED / ASSIGNED-ONLY — do not revisit",
  "HISTORICAL_NOT_CURRENT_LAW": [
    "docs/frontend-completion/13-open-decisions.md",
    "docs/engineering/archive/SESSION_HANDOFF-2026-09-18-pre-M1.md"
  ],
  "LARAVEL_BACKEND": "NOT STARTED and NOT AUTHORIZED",
  "NEXT_GATE": "Completion and verification of the documentation pass (D1/D2) — D1 committed, D2 being recorded",
  "AFTER_GATE": "Laravel/backend planning or implementation — only on explicit owner authorization",
  "PRESERVED_SHAS": [
    "f00f85e6f817369a32b8921ffb64f58e17ea154e",
    "02b74996e6458d10a5d9e8d1023890239342c4e4",
    "112f1160104d375481b930517d08592bb67a0a72",
    "59fdacf9606fdc2ded3f060603405f94c7408d30"
  ],
  "HISTORY_REWRITTEN": false,
  "BROWSER_QA": "NOT VERIFIED",
  "DO_NOT_MODIFY": [
    "src/__tests__/projectState.test.ts",
    "any src/ file",
    "docs/engineering/archive/**",
    "DECISIONS.md D1–D20 body",
    "GOVERNANCE_CHECKPOINT.md statuses",
    "README and branding"
  ]
}
```

---

## 5. Historical records — preserved, clearly marked, NOT current state

> ⛔ **Everything in this section is historical.** It is kept for audit only. None of it is a live
> instruction, and none of its `CURRENT_BRANCH` / `CURRENT_HEAD` values are today's.

### 5.1 Frontend freeze closure — 2026-09-19 — historical

Frozen HEAD `a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb` on `arena/01a0b6be-parsian-music-dashboard-opus`.
**M-1 Quick Actions CLOSED, D7 Accessibility CLOSED, M-2 Teacher Photo CLOSED, M-3 Student Photo
CLOSED, M-4 I15 Failure Disclosure CLOSED, M-5 I16 Deep Links CLOSED, M-6 Settings Honesty CLOSED,
D9 Performance CLOSED.** Measured at `a3867a6`: entry CSS gzip 16.39 kB, vendor 60.29 kB, index
118.50 kB, operations 47.07 kB, academic 47.86 kB; total JS+CSS+HTML ~300 kB within the +5% cap
305 805 B; no chunk ≥400 kB; 2037 modules; `npx tsc --noEmit --skipLibCheck` 0 errors; focused 92
tests pass; full suite 2102 passed / 10 failed — the 10 being the known historical
`projectState.test.ts` SHA/branch expectations, test not altered. **Browser QA NOT VERIFIED** as the
formal final-audit disposition. **Deferred items do NOT modify the frozen frontend:** Classes
deep-link beyond the capped list, Finance/Reports backend/domain, notification server wiring,
localization/settings server wiring, working-hours/session-rules server wiring, free-slot search,
external browser QA. *Superseded status: the freeze was intentionally reopened for Frontend Product
Completion, which is itself now delivered — see §1.*

### 5.2 F1-KICKOFF correction — 2026-09-19 — historical

Branch `arena/frontend-completion-spec`, `CURRENT_HEAD a251e6942b2a645987286de6e822607554e84df9`,
`PLANNING_CHECKPOINT e57bf1922e4ca3b80796715028445cfe8a077c9c`, `PREVIOUS_PLANNING_CHECKPOINT
c244fec142fcc35faff8e8548c8ebbc05cb53bf5`, base `arena/01a0b6be-parsian-music-dashboard-opus` HEAD
`02b74996`. Previous correction commits `9695097` + `a251e69` were documentation-only and are **not**
planning milestones. Spec path `docs/frontend-completion/` v14 @ `e57bf19`. PR #4 was **OPEN** at that
date and is **now CLOSED, never merged**. `NEXT ACTION F1` was that pass's next slice; the F-series is
now delivered (§1). **No `src/`, test, package or backend change was made by that pass, and no branch
or history was rewritten by it.**

### 5.3 Consolidation — 2026-09-20 — historical provenance

PR #5 merged into `main`; merge commit `f63ebaab37096fcb25063aca51c713e26d3b3da7`; merge parents
`a6469759fea743b9332702bb9a20e69fc4abc1be` (previous `main` tip — **an ancestor, preserved**) and
`112f1160104d375481b930517d08592bb67a0a72` (PR #5 head). PR #4 **CLOSED, never merged**, head
`f00f85e6f817369a32b8921ffb64f58e17ea154e`. Four historical SHAs preserved:
`f00f85e6f817369a32b8921ffb64f58e17ea154e`, `02b74996e6458d10a5d9e8d1023890239342c4e4`,
`112f1160104d375481b930517d08592bb67a0a72`, `59fdacf9606fdc2ded3f060603405f94c7408d30` (the last in
`main`'s own first-parent history: `…7a44c6a → 59fdacf9 → 112f1160 → f63ebaab`). **No history was
rewritten:** `a646975…main` is ahead 49 / behind 0, so the advance was merge-only. Full record:
[PHASES.md](PHASES.md) → "Consolidation — 2026-09-20" and [PRE_CLEANUP_HANDOFF.md](PRE_CLEANUP_HANDOFF.md).
