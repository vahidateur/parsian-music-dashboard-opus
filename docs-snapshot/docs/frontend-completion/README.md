# Frontend Product Completion — Architecture + Spec + Execution Map — CORRECTED 2026-09-19

> **Governance status pointer — 2026-09-21 (documentation reconciliation).** The status banner below is the
> F0 / 2026-09-19 kickoff snapshot and is kept verbatim as history. Its `T-02 STATUS OPEN EVIDENCE CONFLICTING`,
> `scope decision OPEN` and “open decisions 20 items” wording is **not current law**. Live `T-02` / `O-*` / `PERF` /
> `HELP` status is [`docs/engineering/GOVERNANCE_CHECKPOINT.md`](../engineering/GOVERNANCE_CHECKPOINT.md):
> `T-02` ACCEPTED / ASSIGNED-ONLY; `O-01` / `O-02` DECIDED 2026-09-21; `O-08`, `O-09/O-20`, `O-14`, `O-16`, `O-18`,
> `O-15`, `PERF` ACCEPT WITH CONDITIONS; `O-12`, `O-13`, `O-10/O-11` ACCEPTED (explicit residues OPEN: `O-13`
> credential factor; `O-10/O-11` uniqueness details and linking UX); `O-07`, `O-17`, `O-19`, `HELP` KEEP OPEN.
> `13-open-decisions.md` is a historical snapshot, not current law.

> Branch: `arena/frontend-completion-spec`
> Base: `02b74996e6458d10a5d9e8d1023890239342c4e4` docs-only descendant of frozen product `a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb`
> Mode: READ-MOSTLY / DOCS-FIRST / GIT-PERSISTED
> Status: SPEC PASS F0 COMPLETE — 14 docs — no src changes, no backend — correction pass 2026-09-19 docs-only + SHA SEMANTICS CORRECTION 2026-09-19 docs-only
> CURRENT_BRANCH: `arena/frontend-completion-spec`
> CURRENT_HEAD: `a251e6942b2a645987286de6e822607554e84df9` = `a251e69` (actual Git HEAD before this F1-KICKOFF correction, frozen `a3867a6` descendant, 10 ahead of `02b7499`) — CURRENT_HEAD = actual Git HEAD before this correction — do NOT call e57bf19 the current Git HEAD
> PLANNING_CHECKPOINT: `e57bf1922e4ca3b80796715028445cfe8a077c9c` = `e57bf19` (last completed planning checkpoint before documentation-only correction commits) — PLANNING_CHECKPOINT = e57bf19 remains last completed planning checkpoint
> PREVIOUS_PLANNING_CHECKPOINT: `c244fec142fcc35faff8e8548c8ebbc05cb53bf5` = `c244fec` preserved as historical — PREVIOUS_PLANNING_CHECKPOINT = c244fec historical only
> PREVIOUS_CORRECTION_COMMITS: `969509783748b18b04eb17ca759127e420a3784c` = `9695097` + `a251e6942b2a645987286de6e822607554e84df9` = `a251e69` = `9695097` documentation-only NOT planning milestone — do NOT treat 9695097 as new planning milestone
> PR #4: https://github.com/vahidateur/parsian-music-dashboard-opus/pull/4 docs-only OPEN not merged — SHA semantics no longer ambiguous: CURRENT_HEAD = actual Git HEAD (9695097 before this correction), PLANNING_CHECKPOINT = last planning checkpoint (e57bf19), PREVIOUS_PLANNING_CHECKPOINT = historical only (c244fec), PREVIOUS_CORRECTION_COMMIT = documentation-only NOT planning milestone (9695097)
> Current phase: FRONTEND_COMPLETION — F0 Documentation/state closure COMPLETE + REVIEW CORRECTIONS DONE + FINAL CHECKPOINT CORRECTION stale SHA fix DONE + SHA SEMANTICS CORRECTION DONE, next F1 Learning + Level Access + Library + Gallery — exactly ONE canonical NEXT ACTION F1 — RBAC T-02 STATUS OPEN EVIDENCE CONFLICTING PRODUCT DECISION OPEN — CURRENT_PHASE: FRONTEND_COMPLETION
> Canonical engineering docs: docs/engineering/ PROJECT_STATE.md PHASES.md OPEN_ITEMS.md SESSION_HANDOFF.md point same CURRENT_BRANCH arena/frontend-completion-spec CURRENT_HEAD a251e6942b2a645987286de6e822607554e84df9 PLANNING_CHECKPOINT e57bf1922e4ca3b80796715028445cfe8a077c9c PREVIOUS_PLANNING_CHECKPOINT c244fec142fcc35faff8e8548c8ebbc05cb53bf5 spec `docs/frontend-completion/` v14 @ `e57bf19` planning checkpoint + corrections + SHA semantics correction PR #4 F0 complete F1 next — SHA semantics no longer ambiguous — SESSION_HANDOFF machine-readable CONTINUE HERE CURRENT_BRANCH CURRENT_HEAD PLANNING_CHECKPOINT PREVIOUS_PLANNING_CHECKPOINT NEXT_ACTION F1
> Classification correction: Telegram backup = REQUIRED PRODUCT CAPABILITY, Telegram student access = REQUIRED, Bale student access = REQUIRED, Mobile student client = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile, no business logic in bots — do NOT change product decisions
> RBAC correction: testable authorization contract Actor/Action/Resource/Scope/Allowed/DENIED/Reason/Frontend guard/Backend enforcement — 11 required cases explicitly covered — preserve 5-role/22-perm vocab — T-02 STATUS OPEN EVIDENCE CONFLICTING PRODUCT DECISION OPEN — do NOT change
> Learning access: canonical Level N=>1..N owner learning/eligibility.ts named states eligible/locked/not_visible/not_found/not_applicable scope decision OPEN global vs per-program vs per-instrument do not invent — do NOT change
> Roadmap canonical F0..F10: F0 Documentation/state closure COMPLETE + REVIEW CORRECTIONS DONE + FINAL CHECKPOINT CORRECTION stale SHA fix DONE + SHA SEMANTICS CORRECTION DONE, F1 Learning+Level Access+Library+Gallery NEXT — exactly ONE NEXT ACTION F1, F2 RBAC+Ownership/Scope+Error Disclosure, F3 Settings+Theme Editor, F4 Export Engine, F5 Dashboard Analytics+Export, F6 Chat+Tickets+Files, F7 Student Portal, F8 Telegram+Bale+Backup integration contracts, F9 Mobile client contract, F10 Cross-surface QA+final frontend freeze — minor hardening Classes deep-link get(id) authoritative pagination per_page mitigation media one-frame absorbed into F1/F2 not competing phase — do NOT change
> FINAL CHECKPOINT CORRECTION — F1-KICKOFF CORRECTION — CURRENT_BRANCH arena/frontend-completion-spec CURRENT_HEAD a251e6942b2a645987286de6e822607554e84df9 PLANNING_CHECKPOINT e57bf1922e4ca3b80796715028445cfe8a077c9c PREVIOUS_PLANNING_CHECKPOINT c244fec142fcc35faff8e8548c8ebbc05cb53bf5 — previous correction commit 9695097 documentation-only NOT planning milestone — PLANNING_CHECKPOINT = e57bf19 remains last completed planning checkpoint — CURRENT_HEAD = a251e69 actual Git HEAD before this F1-KICKOFF correction — SHA semantics no longer ambiguous — RBAC T-02 OPEN — NEXT ACTION exactly ONE F1

## Purpose

Reconstruct current product, identify genuine incompleteness, design smallest coherent architecture/spec to complete frontend before Laravel.

Target: each important product surface genuinely functional in demo mode, coherent domain model, honest states, stable seam for future backend.

Not: "all menus have a route".

## Classification Principle

Each capability classified as:

- **A. FRONTEND-COMPLETABLE NOW** — can be genuinely functional in React/demo architecture now
- **B. FRONTEND CONTRACT / UX PREPARATION NOW, BACKEND REQUIRED LATER** — UX/domain contract prepared now, persistence/auth/integration waits Laravel
- **C. EXPLICITLY DEFERRED** — not necessary first usable product

Evidence-based, no fake backend behavior.

## Documents in this folder

| File | Purpose | Status |
|------|---------|--------|
| 01-audit-reconstruction.md | Read-only reconstruction of current product VERIFIED/DOCUMENTED/INFERRED/OPEN | DONE |
| 02-capability-matrix.md | Capability matrix all nav destinations + major capabilities + A/B/C + deps | DONE |
| 03-domain-map.md | Canonical domain map ownership/source-of-truth/relationship/lifecycle/seam | DONE |
| 04-learning-access-policy.md | Canonical learning access policy Level N=>1..N eligible/locked/not_visible/not_found/not_applicable owner audit per-program/instrument | DONE |
| 05-rbac-access-control.md | RBAC HIGH-CRITICALITY matrix Actor/Action/Resource/Scope/Allowed/Reason/Frontend guard/Backend enforcement smallest | DONE |
| 06-library-gallery-spec.md | Library + Gallery spec type/level/visibility/search/filter/sort/preview/locked/metadata genuine vs shallow | DONE |
| 07-settings-theme-architecture.md | Settings / theme editor WordPress-customizer-like academy identity name/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local | DONE |
| 08-export-architecture.md | Export architecture reusable column defs row transform locale encoding filter reuse filename permission demo vs server boundary | DONE |
| 09-dashboard-analytics.md | Dashboard analytics Raw->Derivation->Insight->Visualization->Export no duplicate engine NO_DATA if unavailable authoritative vs derived vs unavailable date-range | DONE |
| 10-integration-architecture.md | Telegram / Bale / Mobile / Student Portal integration boundary Core API->Auth+RBAC->Domain Services->Adapters Media abstraction Telegram backup retention/integrity/restore/encryption/failure OPEN | DONE |
| 11-roadmap.md | Agile vertical slices roadmap Goal/visible outcome/domains/deps/acceptance/tests/risks/backend impact/independent shippable dependency graph | DONE |
| 12-decision-register.md | Decision log ID/Title/Status/Date/Context/Evidence/Decision/Alternatives/Why/Consequences/Frontend/Backend/Reversibility/Follow-up ACCEPTED/PROVISIONAL/OPEN/DEFERRED + 3 agent proposals | DONE |
| 13-open-decisions.md | Open decision register 20 items student level scope level/resource relation visibility theme persistence export formats permission analytical contract ticket vs chat ownership scope file ownership Telegram backup semantics identity linking Bale linking mobile auth student portal auth org/user relation API boundaries media storage notification audit retention backup restore | DONE |
| 14-handoff-checkpoint.md | Session continuation checkpoint branch/HEAD/base/purpose/audited/decided/open/must-not-touch/files changed/validation/known failures/next action/continuation prompt | DONE |
| 15-student-portal-architecture.md | Student Portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity scope self/assigned/org/device identity linking user_student_links telegram_links bale_links contract only no UI per D1 | DONE F7 |
| 16-telegram-bale-backup-integration.md | Telegram/Bale/Backup integration contracts — Telegram backup vs student access different adapters not business owner, Bale avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter, backup envelope versioned migration retention/integrity/restore/encryption/failure OPEN, no business logic in bots — B CONTRACT NOW BACKEND LATER REQUIRED | DONE F8 |
| 17-mobile-client-contract.md | Mobile Client Contract — Mobile student client = REQUIRED PRODUCT CAPABILITY — mobile app client of same backend contracts, media/file abstraction -> storage provider — contract doc for mobile auth bearer secure storage not localStorage, same API envelope Collection/Item PageMeta, same domain repos, same RBAC, media upload same endpoint, no second API — B CONTRACT NOW BACKEND LATER REQUIRED | DONE F9 |

## Classification Principle — CORRECTED

Each capability classified as:

- **A. FRONTEND-COMPLETABLE NOW** — can be genuinely functional in React/demo architecture now
- **B. FRONTEND CONTRACT / UX PREPARATION NOW, BACKEND REQUIRED LATER — but REQUIRED PRODUCT CAPABILITY** — UX/domain contract prepared now, persistence/auth/integration waits Laravel but REQUIRED not optional deferred unless product needs — applies to Telegram backup, Telegram student access, Bale student access, Mobile student client, Student portal architecture, Media storage provider, Chat tickets ownership/read cursor, Backup envelope versioned, Notifications via Telegram/Bale/SMS/email — all REQUIRED PRODUCT CAPABILITY — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core->Adapter->Telegram/Bale/Mobile no business logic in bots
- **C. EXPLICITLY DEFERRED** — not necessary first usable product — e.g. Finance/Reports domain implementation money precision idempotency gateway, free-slot search, working-hours/session-rules server wiring, localization/settings server wiring, offline queue, viewer light theme

Evidence-based, no fake backend behavior. Classification correction per 2026-09-19 review: Telegram backup/student access/Bale/Mobile = REQUIRED PRODUCT CAPABILITY not C deferred unless product needs.

## Documents in this folder — CORRECTED F0 COMPLETE

| File | Purpose | Status |
|------|---------|--------|
| 01-audit-reconstruction.md | Read-only reconstruction of current product VERIFIED/DOCUMENTED/INFERRED/OPEN — frozen a3867a6 descendant | DONE F0 |
| 02-capability-matrix.md | Capability matrix all nav destinations + major capabilities + A/B/C + deps — corrected REQUIRED for Telegram/Bale/Mobile/Backup | DONE F0 corrected |
| 03-domain-map.md | Canonical domain map ownership/source-of-truth/relationship/lifecycle/seam — learning scope OPEN | DONE F0 corrected |
| 04-learning-access-policy.md | Canonical learning access policy Level N=>1..N eligible/locked/not_visible/not_found/not_applicable owner learning/eligibility.ts scope OPEN global vs per-program vs per-instrument do not invent | DONE F0 corrected scope OPEN |
| 05-rbac-access-control.md | RBAC HIGH-CRITICALITY testable authorization contract Actor/Action/Resource/Scope/Allowed/DENIED/Reason/Frontend guard/Backend enforcement — 11 required cases S-01..S-04 T-01..T-04 ST-01 M-01 A-01 X-01..X-11 — preserve 5-role/22-perm vocab | DONE F0 corrected testable |
| 06-library-gallery-spec.md | Library + Gallery spec type/level/visibility/search/filter/sort/preview/locked/metadata genuine vs shallow + minor hardening Classes deep-link get(id) authoritative absorbed into F1 | DONE F0 |
| 07-settings-theme-architecture.md | Settings / theme editor WordPress-customizer-like academy identity name/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local D2 | DONE F0 |
| 08-export-architecture.md | Export architecture reusable column defs row transform locale encoding filter reuse filename permission demo vs server boundary | DONE F0 |
| 09-dashboard-analytics.md | Dashboard analytics Raw->Derivation->Insight->Visualization->Export no duplicate engine NO_DATA if unavailable authoritative vs derived vs unavailable date-range | DONE F0 |
| 10-integration-architecture.md | Telegram / Bale / Mobile / Student Portal integration boundary Core API->Auth+RBAC->Domain Services->Adapters Media abstraction Telegram backup REQUIRED PRODUCT CAPABILITY retention/integrity/restore/encryption/failure spec B REQUIRED — classification corrected per review | DONE F0 corrected REQUIRED |
| 11-roadmap.md | Agile vertical slices roadmap canonical F0..F10 F0 COMPLETE F1 NEXT F2..F10 — Goal/visible outcome/domains/deps/acceptance/tests/risks/backend impact/independent shippable dependency graph — minor hardening absorbed F1/F2 | DONE F0 corrected canonical F0..F10 |
| 12-decision-register.md | Decision log ID/Title/Status/Date/Context/Evidence/Decision/Alternatives/Why/Consequences/Frontend/Backend/Reversibility/Follow-up ACCEPTED/PROVISIONAL/OPEN/DEFERRED + 3 agent proposals — accepted D1/D2/D5/D6/D7/D8/D10/D11/D14/D15/D16/B1 + NEW-LRN-01/LIB-01/GAL-01/SET-01/EXP-01/DASH-01/RBAC-01/PORTAL-01/CHAT-01/TG-01/BALE-01/MOB-01/CLASS-01 + proposals | DONE F0 corrected unique IDs |
| 13-open-decisions.md | Open decision register 20 items O-01..O-20 student level scope global vs per-program vs per-instrument OPEN level/resource relation visibility theme persistence export formats permission analytical contract ticket vs chat ownership scope file ownership Telegram backup semantics identity linking Bale linking mobile auth student portal auth org/user relation API boundaries media storage notification audit retention backup restore — high-cost 7 O-01,O-02,O-08,O-09,O-10,O-13,O-14 before Laravel | DONE F0 corrected |
| 14-handoff-checkpoint.md | Session continuation checkpoint branch/HEAD/base/purpose/audited/decided/open/must-not-touch/files changed/validation/known failures/next action F1/continuation prompt machine-readable CONTINUE HERE — canonical engineering docs point same branch/SHA/spec PR #4 F0 complete F1 next | DONE F0 corrected |
| 15-student-portal-architecture.md | Student Portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity scope self/assigned/org/device identity linking user_student_links telegram_links bale_links contract only no UI per D1 — B CONTRACT NOW BACKEND LATER REQUIRED | DONE F7 |
| 16-telegram-bale-backup-integration.md | Telegram/Bale/Backup integration contracts — Telegram backup vs student access different adapters not business owner, Bale avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter, backup envelope versioned migration retention/integrity/restore/encryption/failure OPEN, no business logic in bots — B CONTRACT NOW BACKEND LATER REQUIRED | DONE F8 |

## Safety

- No src changes in this phase — VERIFIED git diff --stat HEAD only docs/
- No tests changed — same
- No package.json — same
- No Laravel — none exist none added
- No migrations — none
- No protected branch changes — work only arena/frontend-completion-spec
- No history rewrite — no amend/rebase/squash/force-push — new commits only
- Freeze `a3867a6` preserved, reopen documented as explicit decision — historical freeze preserved not deleted, freeze intentionally reopened for FRONTEND PRODUCT COMPLETION recorded in PROJECT_STATE.md PHASES.md OPEN_ITEMS.md SESSION_HANDOFF.md
- Decision IDs unique — D1..D20 B1 NEW-* PROP-* O-01..O-20 unique
- Canonical engineering docs point same active branch/SHA/spec — PROJECT_STATE.md PHASES.md OPEN_ITEMS.md SESSION_HANDOFF.md all active branch arena/frontend-completion-spec SHA e57bf19 = e57bf1922e4ca3b80796715028445cfe8a077c9c (previous c244fec preserved only as historical) spec docs/frontend-completion/ v14 @ e57bf19 PR #4 F0 complete F1 next — current_sha = e57bf19 exactly, c244fec preserved only as previous planning checkpoint — RBAC T-02 STATUS OPEN EVIDENCE CONFLICTING PRODUCT DECISION OPEN — NEXT ACTION exactly ONE F1
- SESSION_HANDOFF can reconstruct continuation without chat — machine-readable JSON + human-readable path
- Validation required per task

## Continuation — NEXT ACTION exactly ONE canonical

**Implement F1 — Learning + Level Access + Library + Gallery** — do not implement during this correction pass — this doc is F0 correction.

Read `14-handoff-checkpoint.md` for exact next action + docs/engineering/SESSION_HANDOFF.md machine-readable CONTINUE HERE section.
