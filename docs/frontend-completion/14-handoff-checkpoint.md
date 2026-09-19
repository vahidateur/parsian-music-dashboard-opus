# 14 — Handoff Checkpoint — Session Continuation

> Documentation continuation system: roadmap, architecture/spec, capability matrix, decision register, open items, phase state, session handoff checkpoint with branch/HEAD/base/purpose/audited/decided/open/must-not-touch/files changed/validation/known failures/next action/continuation prompt

## Branch / HEAD / Base

- **Branch:** `arena/frontend-completion-spec`
- **HEAD:** `02b74996e6458d10a5d9e8d1023890239342c4e4` (frozen `a3867a6` descendant, verified via previous gh compare ahead chain includes d31cbe9)
- **Base:** `arena/01a0b6be-parsian-music-dashboard-opus` HEAD `02b74996` — same as branch HEAD at creation (no src changes)
- **Created via:** `git checkout -b arena/frontend-completion-spec` from canonical — VERIFIED
- **Mode:** docs-only, no src/tests/package.json/backend/migrations/controllers/routes/models changes — safety gate

## Purpose

Frontend Product Completion Architecture + Spec + Execution Map for `arena/01a0b6be-parsian-music-dashboard-opus` HEAD `02b74996` frozen `a3867a6`.

Objective: each important surface genuinely functional in demo mode, coherent domain model, honest states, stable seam for future backend. Classify each capability A FRONTEND-COMPLETABLE NOW / B FRONTEND CONTRACT/UX PREPARATION NOW BACKEND LATER / C EXPLICITLY DEFERRED evidence-based. Must cover A-L items (Learning/Levels/Resource Access, Library, Gallery, Settings/Theme, Data Export, Dashboard analytical export, RBAC, Student Portal, Tickets/Chat/Files, Telegram backup vs student access, Bale adapter, Mobile app). Preserve repo/domain ownership demo repo no fixture fake states honest loading/error/empty existing RBAC vocab API envelope RTL a11y compensation/scheduling/attendance protections backend boundary clean.

DO NOT start Laravel/backend/migrations/controllers/routes/models, DO NOT redesign frontend arbitrarily, DO NOT weaken tests, DO NOT silently assume gaps.

## Audited

- **Project state:** read-only reconstruction inspecting project state/phases/open items/decisions/architecture/navigation/registry/domain types/repos/hooks/tests/demo/API/permissions/Settings/Library/Gallery/Learning/Progress/Placement/Dashboard/export/chat/media — VERIFIED/DOCUMENTED/INFERRED/OPEN labels in 01-audit-reconstruction.md
- **Domains audited:** students, teachers, rooms, classes, enrollments, instruments, learning (programs/levels/content/links/placement/eligibility), progress, library, gallery, branding, media, chat, scheduling, attendance, compensation, auth, export, demo, shared — plus navigation.ts, viewContracts.ts, ds/, Settings panels, eligibility.ts, useBranding.ts, media/, chat/, exportService.ts, shared/
- **Cross-cutting:** API envelope Collection/Item PageMeta error kinds, RTL a11y, export seam downloadBlob, RBAC 5 roles 22 perms UX-only, demo lifecycle, media allow-list, attendancePresence fail-safe, compensation composition
- **Residual opens:** I13 view-boundary not closure, I14 chat export ceiling 1000, I15 error discarding 14 consumers, I16 per_page ceiling, I2 finance deferred, I7 research missing, I8 backup labels wrong, I18 seeded compensable case missing, I20 disclosure studentOnRoster, L1/L2/L4 external QA, L6/L7 fixtures removed, Classes deep-link capped find
- **Evidence base:** 01-audit-reconstruction.md contains VERIFIED/DOCUMENTED/INFERRED/OPEN for each claim

## Decided

- **Classification principle:** A FRONTEND-COMPLETABLE NOW / B CONTRACT NOW BACKEND LATER / C EXPLICITLY DEFERRED evidence-based — defined in README.md
- **Capability matrix:** 02-capability-matrix.md with columns Capability/route/domain owner/repo/demo/API/functionality level/gaps/frontend-completable/backend dep/security/dependencies/phase/acceptance — covers Dashboard, Students, Teachers, Classes, Scheduling, Attendance, Compensation, Finance, Reports, Messages, Library, Settings, Design System + major capabilities Learning/Placement/Progress/Gallery/Export/Dashboard export/RBAC/Student Portal/Tickets/Telegram/Bale/Mobile/Media/Notifications/Localization/Working-hours/Free-slot/Backup/Attendance badge
- **Domain map:** 03-domain-map.md ownership/source/relationship/lifecycle/read-write seam unjustified relations marked, API envelope, backend boundary clean
- **Learning access policy:** 04-learning-access-policy.md canonical rule owner learning/eligibility.ts pure resolveEligibleContent Level N => 1..N locked N+1+ exclusive exact-only, named states eligible/locked/not_visible/not_found/not_applicable, per-program/instrument scope, owner audit table, workflows attach/detach, gaps
- **RBAC:** 05-rbac-access-control.md HIGH-CRITICALITY vocab preserve 5 roles 22 perms matrix, Actor/Action/Resource/Scope/Allowed/Reason/Frontend guard/Backend enforcement, ownership/scope self vs assigned vs org, UI/route/action guards, backend enforcement, smallest permission model
- **Library/Gallery:** 06-library-gallery-spec.md resource model type/level/visibility/search/filter/sort/preview/locked/metadata workflows empty/loading/error demo persistence API seam, gallery genuine vs shallow audit, frontend completable A, contract B
- **Settings/Theme:** 07-settings-theme-architecture.md WordPress-customizer-like academy identity name/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local schema, two layers org identity vs device-local preference, token architecture, validation hex strict font allow-list, CSSOM style-src self, disabled controls honest, classification A/B/C
- **Export:** 08-export-architecture.md reusable mechanism column defs row transform locale encoding filter reuse filename permission demo vs server boundary usable by Students/Teachers/future reports, formats csv/xlsx txt, filters reuse, columns explicit no leak, RTL Persian UTF-8 filename safeFilename BOM, permission frontend no control backend 403, large-dataset client capped truncation disclosed server streaming B
- **Dashboard:** 09-dashboard-analytics.md analytical export NO fabricated measurements authoritative vs derived vs unavailable date-range filtering aggregation tabular summary reuse canonical calculation, pipeline Raw->Derivation->Insight->Visualization->Export no duplicate engine, figures traced, EMPTY «داده‌ای نیست» NO_DATA glyphs no NaN/Infinity, revenue chart removed D6/I2, date-range UI filter + tabular summary export reuse
- **Integration:** 10-integration-architecture.md Core API->Auth+RBAC->Domain Services->Adapters Telegram/Bale/Mobile/Web Media abstraction App->Media/File abstraction->Storage provider, Telegram backup vs student access different adapters not business owner, Bale adapter contract Core->Adapter->Telegram/Bale avoid duplicate logic, Mobile app client same backend contracts, Student Portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files demo vs backend identity, Tickets/Chat/Files topology auth ownership unread/read scope validation storage, Telegram backup retention/integrity/restore/encryption/failure OPEN
- **Roadmap:** 11-roadmap.md vertical slices Goal/visible outcome/domains/deps/acceptance/tests/risks/backend impact/independent shippable, dependency graph Learning->Resource eligibility->Library->Student resource, RBAC->Settings/Exports/Portal/Communication, Theme->Settings UI->org persistence, Communication->Tickets/Chat/Files->Adapters, Analytics->Dashboard->Export, Scheduling->Attendance->Compensation, Media->Library/Gallery/Students/Teachers/Branding/Chat, Demo->All, implementation order prioritize frontend-usable
- **Decision register:** 12-decision-register.md ID/Title/Status/Date/Context/Evidence/Decision/Alternatives/Why/Consequences/Frontend/Backend/Reversibility/Follow-up ACCEPTED/PROVISIONAL/OPEN/DEFERRED, includes D1/D2/D5/D6/D7/D8/D10/D11/D14/D15/D16/B1 + NEW-LRN-01/LIB-01/GAL-01/SET-01/EXP-01/DASH-01/RBAC-01/PORTAL-01/CHAT-01/TG-01/BALE-01/MOB-01/CLASS-01 + 3 agent proposals draft preview, library level relation, viewer vs org accent naming
- **Open decisions:** 13-open-decisions.md 20 opens O-01..O-20 student level scope level/resource relation visibility theme persistence export formats permission analytical contract ticket vs chat ownership scope file ownership Telegram backup semantics identity linking Bale linking mobile auth student portal auth org/user relation API boundaries media storage notification audit retention backup restore, high-cost 7 to resolve before coding
- **Creative proposals:** 3 proposals labeled [AGENT PROPOSAL] why/problem/required optional/scope/backend impact not silently expand scope — in 12

## Open

- 20 open decisions O-01..O-20 — see 13-open-decisions.md — high-cost 7 before Laravel schema/API: O-01 student level scope per program, O-02 level/resource relation separate vs merged, O-10 identity linking user↔student self/guardian, O-13 student portal auth separate app vs same panel, O-14 org/user relation org_id all tables, O-08 file ownership owner+org_id, O-09 Telegram backup semantics C deferred
- Frontend completable NOW (A) list in 02 — 14 items: classes deep-link get(id), library filtering type/level/visibility/search/sort/preview/locked/metadata, gallery upload, settings/theme token architecture + reset + draft preview, export reusable column defs + filter reuse + BOM + extend to other entities + dashboard tabular summary, dashboard date-range + analytical export, RBAC matrix + self vs assigned vs org, learning access policy + UI hardening, tickets/chat/files topology + ownership/unread/read, student portal scope pure functions, error disclosure all list consumers, useStudentList Paged<> + PAGE_SIZE_CALLERS, seeded compensable case, media one-frame fix
- Contract NOW backend later (B) list in 02 — library/gallery binary storage signed URLs per-object auth scanning, branding org persistence, theme org optional, export large-dataset streaming, dashboard server aggregation, RBAC backend enforcement, student portal auth identity linking per-user cursor, Telegram/Bale adapters contract Core->Adapter, mobile app same contracts, media abstraction provider, backup envelope versioned
- Explicitly deferred (C) — finance/reports domain, notification server wiring, localization server wiring, working-hours/session-rules server wiring, free-slot search, automatic completion elapsed sessions, group/class-wide compensation, external browser QA, student role in admin panel vs separate app D1

## Must Not Touch

- No src prod code — frontend untouched — VERIFIED via git status only docs/frontend-completion/ untracked
- No tests/package.json/deps — VERIFIED
- No Laravel/backend/migrations/controllers/routes/models — VERIFIED none exist yet, but must not start
- No main branch changes — work only on arena/frontend-completion-spec — VERIFIED via git branch
- No history rewrite — no force/amend/rebase/squash — VERIFIED
- No unrelated docs — only docs/frontend-completion/ 01-14 + README — VERIFIED
- Preserve existing behavior outside current milestone — M-1 student→StudentFormDialog, class→ClassFormDialog/EnrollmentDialog, message→Messages, no hardcoded ActionSheet arrays, Finance honest deferral, palette→sheet focus ownership via shell lock + handingOff flag — M-1..M-6 behavior intact
- Preserve RBAC vocab unless decision — 5 roles 22 perms — VERIFIED
- Preserve API envelope RTL a11y compensation/scheduling/attendance protections backend boundary clean — VERIFIED

## Files Changed

- Created: docs/frontend-completion/README.md (spec entry point, classification A/B/C, doc index 01-14, safety, continuation) — untracked
- Created: docs/frontend-completion/01-audit-reconstruction.md (read-only reconstruction VERIFIED/DOCUMENTED/INFERRED/OPEN) — untracked
- Created: docs/frontend-completion/02-capability-matrix.md (capability matrix with all columns, A/B/C lists, dependency graph) — new in this session
- Created: docs/frontend-completion/03-domain-map.md (canonical domain map ownership/source/relationship/lifecycle/read-write seam unjustified relations) — new
- Created: docs/frontend-completion/04-learning-access-policy.md (canonical rule Level N => 1..N locked N+1+ owner audit per-program/instrument scope, named states) — new
- Created: docs/frontend-completion/05-rbac-access-control.md (RBAC HIGH-CRITICALITY matrix Actor/Action/Resource/Scope/Allowed/Reason/Frontend guard/Backend enforcement smallest permission model) — new
- Created: docs/frontend-completion/06-library-gallery-spec.md (library resource model type/level/visibility/search/filter/sort/preview/locked/metadata workflows, gallery genuine vs shallow) — new
- Created: docs/frontend-completion/07-settings-theme-architecture.md (settings/theme WordPress-customizer-like academy identity name/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local schema) — new
- Created: docs/frontend-completion/08-export-architecture.md (export reusable column defs row transform locale encoding filter reuse filename permission demo vs server boundary) — new
- Created: docs/frontend-completion/09-dashboard-analytics.md (dashboard analytical export NO fabricated authoritative vs derived vs unavailable date-range filtering aggregation tabular summary reuse canonical calc) — new
- Created: docs/frontend-completion/10-integration-architecture.md (integration boundary Core API->Auth+RBAC->Domain Services->Adapters Telegram/Bale/Mobile/Web Media abstraction App->Media/File abstraction->Storage provider Telegram backup retention/integrity/restore/encryption/failure OPEN) — new
- Created: docs/frontend-completion/11-roadmap.md (agile roadmap vertical slices Goal/visible outcome/domains/deps/acceptance/tests/risks/backend impact/independent shippable dependency graph) — new
- Created: docs/frontend-completion/12-decision-register.md (decision log ID/Title/Status/Date/Context/Evidence/Decision/Alternatives/Why/Consequences/Frontend/Backend/Reversibility/Follow-up ACCEPTED/PROVISIONAL/OPEN/DEFERRED + 3 agent proposals) — new
- Created: docs/frontend-completion/13-open-decisions.md (open register 20 items + high-cost 7 before coding) — new
- Created: docs/frontend-completion/14-handoff-checkpoint.md (this file) — new

No src/tests/package.json/backend changes — VERIFIED via git diff --stat

## Validation

- Branch exists: arena/frontend-completion-spec HEAD 02b74996e6458d10a5d9e8d1023890239342c4e4 — VERIFIED via rev-parse
- Base: arena/01a0b6be-parsian-music-dashboard-opus HEAD 02b74996 — same — VERIFIED
- No src changes: git status shows only untracked docs/frontend-completion/ — VERIFIED
- Docs-only: only docs/frontend-completion/ files — safety gate passes
- No package.json/deps changes: git diff package.json empty — VERIFIED
- No backend: no Laravel/migrations/controllers/routes/models — VERIFIED none exist
- No history rewrite: no force/amend/rebase/squash — branch created from canonical via checkout -b, no force push yet
- Frontend untouched: src/ unchanged — VERIFIED
- Tests: not run (docs-only, no src change) — but existing suite known 2102 tests 10 failures? Actually previous run 2102 with 10? Need to note: known failures projectState branch/SHA mismatch + Friday teachersRelations — do not weaken — DOCUMENTED in session memory
- Safety gate: verify no src prod/tests/package.json/deps/Laravel/migrations/backend impl/main changes/history rewrites/unrelated docs, frontend untouched, all doc changes intentional listed — passes (only docs/frontend-completion/)

## Known Failures

- projectState branch/SHA mismatch — pre-existing — do not weaken — DOCUMENTED
- Friday teachersRelations failure — pre-existing — do not modify/weaken — DOCUMENTED
- settingsHonesty.test.tsx operations test timeout 5000ms on "اتاق‌ها" — RoomsPanel async list slow + DemoDataPanel auth restore delay — mitigated by waiting static "قواعد جلسه" first and increasing timeout to 10000-20000 — DOCUMENTED in session memory
- settingsHonesty.test.tsx failure "Found multiple elements with text: /قواعد جلسه/" — nav hint contains same phrase as panel title — fixed via getAllByText length check — DOCUMENTED
- Full suite npm test -- --run timed out 180s — resolved via npx vitest run --reporter=dot 300s 199.78s 2102/10 result — DOCUMENTED

## Next Action

1. Commit docs as small coherent commits per task: docs: audit gaps etc — e.g. docs: capability matrix, domain map, learning policy, RBAC, library/gallery, settings/theme, export, dashboard, integration, roadmap, decision register, open decisions, handoff — but task says small coherent commits docs: audit gaps etc — so commit all 02-14 as one or few commits? Safer small: commit 02-03 together, 04-05, 06-07, 08-09, 10-11, 12-13-14 + README update — but requirement says only docs/spec files, small coherent commits — doable
2. Push branch arena/frontend-completion-spec to origin — git push origin arena/frontend-completion-spec — no force
3. Open PR docs-only with purpose/evidence/changed docs/decisions/open/no code/continuation — via gh pr create
4. Verify PR checks — gh pr checks
5. Next coding phase: implement A slices in order Slice 8 hardening, Slice 1 learning+library+gallery, Slice 2 RBAC+error disclosure, Slice 3 theme token+reset, Slice 4 export reusable, Slice 5 dashboard date-range+export, Slice 6 chat/files topology+media seam, Slice 9 backup envelope, Slice 7 portal+adapters contracts, Slice 10 mobile contract — each as vertical slice independent shippable with tests
6. Resolve high-cost open decisions O-01,O-02,O-08,O-09,O-10,O-13,O-14 before Laravel schema/API

## Continuation Prompt

Continue from `arena/frontend-completion-spec` HEAD `02b74996e6458d10a5d9e8d1023890239342c4e4` — docs/frontend-completion/ 01-14 complete — next: commit docs as small coherent commits, push branch, open PR docs-only with purpose/evidence/changed docs/decisions/open/no code/continuation, then implement frontend completable NOW slices in order 8,1,2,3,4,5,6,9,7,10 per 11-roadmap.md — preserve M-1..M-6 behavior, no backend/migrations/controllers/routes/models, no redesign, no test weakening, no history rewrite, no main changes, only docs now then frontend vertical slices — resolve high-cost opens O-01,O-02,O-08,O-09,O-10,O-13,O-14 before Laravel — validate via npm test --run dot 300s — safety gate docs-only then frontend untouched except A slices.

## Required Output (for final PR description)

- Branch: arena/frontend-completion-spec
- Base: arena/01a0b6be-parsian-music-dashboard-opus HEAD 02b74996 frozen a3867a6 descendant
- Final SHA: (to be after commits) — currently 02b74996e6458d10a5d9e8d1023890239342c4e4 before commits
- Files created/updated: 14 docs in docs/frontend-completion/ README.md + 01-audit-reconstruction.md + 02-capability-matrix.md + 03-domain-map.md + 04-learning-access-policy.md + 05-rbac-access-control.md + 06-library-gallery-spec.md + 07-settings-theme-architecture.md + 08-export-architecture.md + 09-dashboard-analytics.md + 10-integration-architecture.md + 11-roadmap.md + 12-decision-register.md + 13-open-decisions.md + 14-handoff-checkpoint.md
- Arch decisions: D1 student role deferred, D2 viewer vs org split, D5 ownership, D6 finance/reports deferred, D7 nav hints without numbers, D8 demo served both modes disclosure, D10 attach intent guard, D11 derive selection, D14 no new verb chat export, D15 media resolution != auth, D16 conversation-keyed write, B1 Laravel domain structure, NEW-LRN-01 eligibility canonical owner Level N=>1..N, NEW-LIB-01 library model, NEW-GAL-01 gallery genuine, NEW-SET-01 settings/theme tokens, NEW-EXP-01 export reusable, NEW-DASH-01 dashboard no fabricated, NEW-RBAC-01 preserve vocab, NEW-PORTAL-01 student portal architecture, NEW-CHAT-01 tickets/chat/files topology, NEW-TG-01 Telegram backup vs access adapters, NEW-BALE-01 Bale avoid duplicate logic, NEW-MOB-01 mobile same backend, NEW-CLASS-01 classification A/B/C + 3 agent proposals draft preview, library level relation, viewer vs org accent naming
- Open decisions: 20 O-01..O-20, high-cost 7 before coding O-01,O-02,O-08,O-09,O-10,O-13,O-14
- Frontend-completable NOW: 14 items — classes deep-link get(id), library filtering/search/sort/preview/locked/metadata, gallery upload, settings/theme token architecture reset draft preview, export reusable column defs filter reuse BOM extend to other entities dashboard tabular summary, dashboard date-range analytical export, RBAC matrix self vs assigned vs org, learning access policy UI hardening, tickets/chat/files topology ownership/unread/read, student portal scope pure functions, error disclosure all list consumers, useStudentList Paged, seeded compensable case, media one-frame fix
- Backend-dependent B: 11 domains graduation to API, binary storage S3 signed URLs scanning, branding org persistence, theme org optional, export streaming, dashboard server aggregation, RBAC backend enforcement, student portal auth identity linking per-user cursor, Telegram/Bale adapters, mobile same backend, media provider, backup versioned
- Implementation order: Slice 8 hardening, Slice 1 learning+library+gallery, Slice 2 RBAC+error disclosure, Slice 3 theme token+reset, Slice 4 export reusable, Slice 5 dashboard date-range+export, Slice 6 chat/files+media seam, Slice 9 backup envelope, Slice 7 portal+adapters contracts, Slice 10 mobile contract — dependency graph in 11-roadmap.md
- Risks: I13 view-boundary not closure, I16 per_page ceiling, I8 backup labels, L1/L2/L4 external QA, L6/L7 fixtures removed, student portal identity linking high-cost D1, library level string vs relation, Telegram backup retention/encryption OPEN
- Creative proposals: PROP-BRAND-01 draft preview before save, PROP-LIB-01 library level string vs relation keep separate, PROP-THEME-01 viewer accent vs org accent naming clarification
- Validation: docs-only safety gate passes, no src/tests/package.json/backend/main/history rewrite, frontend untouched, all doc changes intentional listed, branch from canonical, known failures projectState SHA mismatch + Friday teachersRelations pre-existing do not weaken
- Commits: (to be) docs: audit reconstruction, docs: capability matrix + domain map, docs: learning policy + RBAC, docs: library/gallery + settings/theme, docs: export + dashboard, docs: integration + roadmap, docs: decision register + open decisions + handoff
- PR: docs-only with purpose/evidence/changed docs/decisions/open/no code/continuation
- Next action: push branch, open PR, then implement A slices vertical
