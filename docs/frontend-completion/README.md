# Frontend Product Completion — Architecture + Spec + Execution Map

> Branch: `arena/frontend-completion-spec`
> Base: `02b74996e6458d10a5d9e8d1023890239342c4e4` docs-only descendant of frozen product `a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb`
> Mode: READ-MOSTLY / DOCS-FIRST / GIT-PERSISTED
> Status: SPEC PASS — no src changes, no backend

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

## Safety

- No src changes in this phase
- No tests changed
- No package.json
- No Laravel
- No migrations
- Freeze `a3867a6` preserved, reopen documented as explicit decision

## Continuation

Read `14-handoff-checkpoint.md` for exact next action.
