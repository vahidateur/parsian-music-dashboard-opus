# 12 — Decision Register — CORRECTED 2026-09-19

> ## ⚠️ ID NAMESPACE — this file's `D1` / `D2` are **NOT** `docs/engineering/DECISIONS.md` `D1` / `D2`
>
> **This register uses its own identifier namespace**, which is **separate** from the canonical
> engineering register [`docs/engineering/DECISIONS.md`](../engineering/DECISIONS.md) **D1–D20**.
> The two are not linked, not aliases, and must not be cross-cited as if they were.
>
> | ID here (frontend-completion namespace) | ID there (canonical engineering namespace) |
> |---|---|
> | **`D1`** — *Student Role Not In Admin Panel* (this file, and `docs/engineering/DECISIONS.md`-style shorthand in the F-series docs) | **`D1`** — *Student role — deferred, not designed* ([DECISIONS.md](../engineering/DECISIONS.md) §19). **Same subject, different register and different recorded reasoning — not the same entry.** |
> | **`D2`** — branding / identity in the frontend-completion sense | **`D2`** — *Branding is the source of truth for the academy identity* ([DECISIONS.md](../engineering/DECISIONS.md) §19), recorded 2026-09-16, shipped default name **«آموزشگاه موسیقی پارسیان»**. **The canonical `D2` governs**; this register's entry does not override it. |
>
> **Rule.** Where the two disagree, **`docs/engineering/DECISIONS.md` wins** — it is the durable
> architecture record. The substantive decisions in *both* registers are **unaltered**: this note
> clarifies naming only.
>
> **Same collision class the governance checkpoint already fixed for `T-02` / `O-*`:**
> `D7` (accessibility) ≠ `O-07` (tickets) and `D15` (attachment reference) ≠ `O-15` (API envelope).
> See [`docs/engineering/GOVERNANCE_CHECKPOINT.md`](../engineering/GOVERNANCE_CHECKPOINT.md) and
> [`docs/engineering/DECISIONS.md`](../engineering/DECISIONS.md) §20.
>
> **Live `O-*` / `T-02` status is governed by `GOVERNANCE_CHECKPOINT.md` (2026-09-20)** — the
> `O-01..O-20` wording carried inside this register's sibling
> [`13-open-decisions.md`](13-open-decisions.md) is a **historical F0 / 2026-09-19 snapshot**.

> ID/Title/Status/Date/Context/Evidence/Decision/Alternatives/Why/Consequences/Frontend/Backend/Reversibility/Follow-up ACCEPTED/PROVISIONAL/OPEN/DEFERRED + 3 agent proposals — unique IDs — canonical engineering docs point same active branch/SHA/spec PR #4 F0 complete F1 next — classification correction Telegram backup/student access/Bale/Mobile = REQUIRED PRODUCT CAPABILITY IMPLEMENTATION deferred until backend/integration layer exists

> **CORRECTION 2026-09-19 — Classification + SHA SEMANTICS CORRECTION 2026-09-19:** Telegram backup = REQUIRED PRODUCT CAPABILITY, Telegram student access = REQUIRED, Bale student access = REQUIRED, Mobile student client = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile, no business logic in bots — previous wording "C DEFERRED (or B if product needs)" corrected to REQUIRED — see 10-integration-architecture.md, 13-open-decisions.md, docs/engineering/ OPEN_ITEMS.md PROJECT_STATE.md PHASES.md SESSION_HANDOFF.md — canonical engineering docs updated same CURRENT_BRANCH `arena/frontend-completion-spec` CURRENT_HEAD `a251e6942b2a645987286de6e822607554e84df9` PLANNING_CHECKPOINT `e57bf1922e4ca3b80796715028445cfe8a077c9c` PREVIOUS_PLANNING_CHECKPOINT `c244fec142fcc35faff8e8548c8ebbc05cb53bf5` PREVIOUS_CORRECTION_COMMITS `a251e6942b2a645987286de6e822607554e84df9` spec `docs/frontend-completion/` v14 @ `e57bf19` planning checkpoint + corrections + SHA semantics correction PR #4 F0 COMPLETE + corrections + SHA semantics correction F1 NEXT — SHA semantics no longer ambiguous: CURRENT_HEAD = actual Git HEAD (9695097 before this correction), PLANNING_CHECKPOINT = last planning checkpoint (e57bf19), PREVIOUS_PLANNING_CHECKPOINT = historical only (c244fec), PREVIOUS_CORRECTION_COMMITS = documentation-only NOT planning milestone (9695097) — decision IDs unique D1..D20 B1 NEW-LRN-01/LIB-01/GAL-01/SET-01/EXP-01/DASH-01/RBAC-01/PORTAL-01/CHAT-01/TG-01/BALE-01/MOB-01/CLASS-01 + PROP-BRAND-01/PROP-LIB-01/PROP-THEME-01 O-01..O-20 — RBAC T-02 OPEN CURRENT OBSERVED DENIED PRODUCT DECISION OPEN — NEXT ACTION exactly ONE F1 — do NOT change product decisions

> **CURRENT_BRANCH:** `arena/frontend-completion-spec` CURRENT_HEAD `a251e6942b2a645987286de6e822607554e84df9` = `a251e69` (actual Git HEAD before this F1-KICKOFF correction, frozen `a3867a6` descendant, 10 ahead of `02b7499`) PLANNING_CHECKPOINT `e57bf1922e4ca3b80796715028445cfe8a077c9c` = `e57bf19` PREVIOUS_PLANNING_CHECKPOINT `c244fec142fcc35faff8e8548c8ebbc05cb53bf5` = `c244fec` historical only PREVIOUS_CORRECTION_COMMITS `a251e6942b2a645987286de6e822607554e84df9` = `9695097` documentation-only NOT planning milestone base `arena/01a0b6be-parsian-music-dashboard-opus` HEAD `02b7499` frozen `a3867a6` descendant PR #4 https://github.com/vahidateur/parsian-music-dashboard-opus/pull/4 docs-only OPEN not merged current phase FRONTEND_COMPLETION F0 COMPLETE + REVIEW CORRECTIONS DONE + FINAL CHECKPOINT CORRECTION stale SHA fix DONE + SHA SEMANTICS CORRECTION DONE next F1 NEXT ACTION exactly ONE F1 — Learning + Level Access + Library + Gallery — SHA semantics no longer ambiguous: CURRENT_HEAD = actual Git HEAD (9695097 before this correction), PLANNING_CHECKPOINT = e57bf19 last planning checkpoint, PREVIOUS_PLANNING_CHECKPOINT = c244fec historical only, PREVIOUS_CORRECTION_COMMITS = 9695097 documentation-only NOT planning milestone — do not implement during correction pass — docs-only — do NOT change product decisions

## D1 — Student Role Not In Admin Panel

- **ID:** D1
- **Title:** Student role deferred, no student in this panel
- **Status:** ACCEPTED
- **Date:** 2025-10-13 (from PROJECT_STATE.md) — re-affirmed 2026-09-19
- **Context:** Task H student portal architecture — whether student role exists in admin panel or separate app
- **Evidence:** No student role in ROLES 5, viewPermissions no portal, financeReportsDeferral, settingsHonesty — VERIFIED
- **Decision:** Student role not in admin panel, student portal is separate app or separate view with self scope, contract now backend later
- **Alternatives:** Add student role to same panel (complicates RBAC, mixes concerns), keep no portal (degrades value)
- **Why:** Smallest permission model, org vs self separation, preserves admin RBAC vocab
- **Consequences:** Student portal needs identity linking table, self scope pure functions, separate auth — B
- **Frontend:** No student role UI in admin, portal contract doc B
- **Backend:** Identity linking + self scope enforcement
- **Reversibility:** reversible — can add student role later with scope
- **Follow-up:** Resolve before schema — open decision 13

## D2 — Viewer Preference vs Org Data Split

- **ID:** D2
- **Title:** Appearance device-local, branding org
- **Status:** ACCEPTED
- **Date:** M8 — VERIFIED branding/types.ts + Settings.tsx
- **Context:** Settings/theme editor — which data is org vs device-local
- **Evidence:** BrandingRepository demo both modes single record travels in backups, appearance via savePref localStorage — VERIFIED
- **Decision:** Branding org data, appearance theme/accent/density/motion device-local per-browser
- **Alternatives:** All localStorage (breaks org identity), all org (breaks personal preference)
- **Why:** Org identity must be identical for all viewers, preference personal
- **Consequences:** Two persistence layers, org table future, localStorage stays
- **Frontend:** BrandingPanel writes repo, appearance writes localStorage — VERIFIED
- **Backend:** organizations table + branding_settings, appearance stays localStorage
- **Reversibility:** reversible — can add org theme optional later with decision
- **Follow-up:** Viewer accent vs org accent naming clarification

## D5 — Domain/Entity Type Ownership

- **ID:** D5
- **Title:** One owner per rule/source per concept
- **Status:** ACCEPTED
- **Date:** M10
- **Context:** Canonical domain map
- **Evidence:** registry.ts composition root, Category A domain/entity types live with domain, B canonical DEMO seed, C fabricated UI data removed, D static vocabulary single owners navigation.ts viewContracts.ts etc — VERIFIED
- **Decision:** Enforce D5 ownership, no duplicate types, no scattered theme keys, no fixture imports in views
- **Alternatives:** Allow duplicate types (drift), allow fixture imports (fake states)
- **Why:** Prevents drift, makes backend seam clean
- **Consequences:** All cross-domain reads via hooks, not store imports — VERIFIED gates relationsNoFixtures etc
- **Frontend:** All views use owning repo/hook
- **Backend:** Same domain structure Laravel — B1
- **Reversibility:** irreversible principle — keep
- **Follow-up:** None

## D6 — Finance/Reports Explicitly Deferred

- **ID:** D6
- **Title:** Finance/Reports README-only, no fabricated figures
- **Status:** ACCEPTED
- **Date:** M9
- **Context:** Dashboard analytical export no fabricated measurements, finance vocabulary
- **Evidence:** financeVocabulary.ts, FinancePanel states «نیازمند سرور», revenue chart removed, dashboardInsightsLive.test — VERIFIED
- **Decision:** Finance/Reports domain deferred, no repository, no figures fabricated, dashboard revenue chart removed until seam exists
- **Alternatives:** Fabricate revenue from Student.balance (would be lie), keep chart with fake data (violates honesty)
- **Why:** Honest states, no fake backend
- **Consequences:** Finance view shows explicit deferral Surface, dashboard shows NO_DATA for collected revenue
- **Frontend:** Deferral Surfaces with data-ui surfaces
- **Backend:** Whole finance domain needs money precision idempotency gateway — B large
- **Reversibility:** reversible when finance domain implemented — chart returns
- **Follow-up:** None until backend

## D7 — Nav Hints Without Numbers

- **ID:** D7
- **Title:** Nav badge removal, hints without numbers
- **Status:** ACCEPTED
- **Date:** M7
- **Context:** Navigation counts caused fabricated occupancy
- **Evidence:** navigation.ts no badge field, navGroups hints without numbers, dashboard metrics authoritative — VERIFIED
- **Decision:** Remove nav badges, hints describe destination not counts, dashboard is source for metrics
- **Alternatives:** Keep badges with total (misleading), keep fabricated occupancy (lie)
- **Why:** Prevent fabricated measurements in nav
- **Consequences:** Nav is stable, no counts, dashboard is analytical source
- **Frontend:** NavDef no badge — VERIFIED
- **Backend:** None
- **Reversibility:** reversible if scoped unread badge with per-user cursor — but needs decision
- **Follow-up:** Chat unread badge is exception — single-viewer demo summed while complete — M7 kept but documented

## D8 — Demo Served Both Modes Disclosure

- **ID:** D8
- **Title:** 11 domains demo in both modes with persistent non-dismissable disclosure
- **Status:** ACCEPTED
- **Date:** M-6? Actually M-6 + demo mode
- **Context:** API mode but demo-served domains
- **Evidence:** DEMO_SERVED_DOMAINS 11, DemoBackedNotice component persistent non-dismissable api-mode-only health-claim-free — VERIFIED
- **Decision:** 11 domains (instruments/learning/progress/library/gallery/branding/media/chat/scheduling/attendance/compensation) served demo both modes with disclosure, 7 API-backed (students/teachers/rooms/classes/enrollments/auth/users)
- **Alternatives:** Fake API for 11 (would need binary client), hide disclosure (dishonest)
- **Why:** Honest about backend boundary, demo behaves like real API
- **Consequences:** DemoBackedNotice in api mode for those domains, no fake health claim
- **Frontend:** DemoBackedNotice — VERIFIED
- **Backend:** Need to graduate 11 to API eventually — B
- **Reversibility:** reversible as each domain graduates
- **Follow-up:** Library apiRepository exists but unregistered due to binary client need — B

## D10 — Attach Content Intent Guard

- **ID:** D10
- **Title:** AttachContentIntent programId independent
- **Status:** ACCEPTED
- **Date:** M? from learning domain
- **Context:** Learning/Levels/Resource Access rule Level N => access 1..N
- **Evidence:** LevelContentPanel programs query independent + levels query, attachContent(levelId, contentId, {programId}) programId from selected program not level.programId, repo refuses LINK_INVALID, contentAssignmentFlow test — VERIFIED
- **Decision:** Attach intent carries programId independently, repository validates, prevents cross-program leakage
- **Alternatives:** Derive programId from level (would allow stale context leak), no guard (would leak eligibility)
- **Why:** Prevents placed student's eligible set changed for wrong program
- **Consequences:** Detach needs same guard (gap) — I13 mitigation view-boundary not closure
- **Frontend:** LevelContentPanel derives selection, attach with intent
- **Backend:** Server must validate programId same as level.programId + content program? Actually content has no programId, only instrument — but level's programId must match intent
- **Reversibility:** irreversible — keep
- **Follow-up:** Detach intent guard — open decision

## D11 — Independent Intent vs Derived Selection

- **ID:** D11
- **Title:** Derive selection vs intent guard distinction
- **Status:** ACCEPTED
- **Date:** Same as D10
- **Context:** Learning assignment surface
- **Evidence:** attachContent uses intent guard, detach uses derived selection (rows on screen) — D11 derive selection, D10 independent intent — VERIFIED
- **Decision:** Attach uses intent guard (programId param), detach currently derives from rows (view-boundary mitigation) — should use intent too
- **Alternatives:** Both intent (better), both derived (worse, stale context)
- **Why:** Attach high-risk (eligibility leak), detach lower but still needs guard
- **Consequences:** Detach gap recorded I13
- **Frontend:** LevelContentPanel
- **Backend:** Same validation
- **Reversibility:** reversible to add intent to detach
- **Follow-up:** Add detach intent — A/B

## D14 — No New Verb (Chat Export)

- **ID:** D14
- **Title:** Chat export single-conversation txt metadata only ceiling 1000, no new verb, no bytes
- **Status:** ACCEPTED
- **Date:** M6
- **Context:** Export architecture
- **Evidence:** conversationExport returns .txt with BOM, metadata only, ceiling 1000 disclosed, no media bytes, no PDF/ZIP/CSV pipeline — VERIFIED
- **Decision:** Export stays single-conversation txt, no new verb, no bytes, ceiling disclosed
- **Alternatives:** Bulk export PDF/ZIP with bytes (needs backend, scanning, per-object auth, large-dataset)
- **Why:** No backend, no scanning, no signed URLs, honest about missing bytes
- **Consequences:** Bulk export deferred B, single export stays
- **Frontend:** downloadBlob seam same as exportService
- **Backend:** Bulk export needs server streaming + scanning — B
- **Reversibility:** reversible when backend ready
- **Follow-up:** None

## D15 — Media Resolution != Authorization

- **ID:** D15
- **Title:** MediaId ref resolution is not authorization
- **Status:** ACCEPTED
- **Date:** M6
- **Context:** Media abstraction
- **Evidence:** useLibraryFile resolves asset+blob, but no auth check, D15 ref not auth documented, backend required scanning etc — VERIFIED
- **Decision:** Frontend resolution != auth, backend must enforce per-object auth, signed expiring URLs, scanning
- **Alternatives:** Frontend claims auth (lie)
- **Why:** Security, honest about gap
- **Consequences:** Demo honest missing bytes, no fabricated URL, backend must implement
- **Frontend:** useMediaObjectUrl creates object URL from blobStore, not signed URL
- **Backend:** S3/MinIO + signed URLs + scanning + per-object owner check — B
- **Reversibility:** irreversible principle
- **Follow-up:** None

## D16 — Conversation-Keyed Write State

- **ID:** D16
- **Title:** Composer state keyed by conversationId
- **Status:** ACCEPTED
- **Date:** M6
- **Context:** Chat
- **Evidence:** Messages.tsx composer keyed, D16 keyed write state — VERIFIED
- **Decision:** Composer state keyed by conversationId, not global, prevents cross-conversation leak
- **Alternatives:** Global composer (leaks)
- **Why:** Prevents message sent to wrong conversation
- **Consequences:** Attachments two writes Media.create+Chat.sendMessage same conversation
- **Frontend:** Messages.tsx
- **Backend:** Same keyed
- **Reversibility:** irreversible
- **Follow-up:** None

## B1 — Laravel Domain Structure

- **ID:** B1
- **Title:** Laravel domain structure mirrors frontend domains, Sanctum cookie primary + bearer fallback
- **Status:** PROVISIONAL (from PROJECT_STATE.md)
- **Date:** 2025-10-13
- **Context:** Integration boundary Core API->Auth+RBAC->Domain Services
- **Evidence:** ApiClient Bearer, isApiMode, OrganizationScope, apiErrorFromThrown — VERIFIED
- **Decision:** Backend Laravel domain structure same as frontend domains, Sanctum cookie primary + bearer fallback for mobile, org_id scoping, rolePermissions matrix server-side
- **Alternatives:** Second API for mobile (duplicate), no org scoping (insecure)
- **Why:** One backend, clean seam, same contracts
- **Consequences:** Mobile app client of same backend, no second API
- **Frontend:** ApiClient already bearer, needs cookie support later
- **Backend:** Laravel with Sanctum, OrganizationScope, per-object auth
- **Reversibility:** provisional — can adjust auth method
- **Follow-up:** Resolve before backend start — open decision

## NEW — Learning Eligibility Canonical Owner

- **ID:** NEW-LRN-01
- **Title:** Eligibility owner learning/eligibility.ts pure, Level N => 1..N cumulative exclusive exact-only
- **Status:** ACCEPTED
- **Date:** 2026-09-19
- **Context:** Task A Learning/Levels/Resource Access
- **Evidence:** resolveEligibleContent pure, tests, placement per (student,program), level order per program, visibility students vs teachers — VERIFIED
- **Decision:** Canonical rule in eligibility.ts, states eligible/locked/not_visible/not_found/not_applicable named, per-program/instrument scope, one content linked to several levels emitted once lowest
- **Alternatives:** Global level order (breaks per-program), all levels eligible if unplaced (leaks), teacher-only visible to students (breaks visibility)
- **Why:** Correct learning model, audit passed
- **Consequences:** Frontend can harden locked UI, backend must enforce same
- **Frontend:** StudentLearningPanel uses resolveEligibleContent
- **Backend:** Must enforce same rule server-side
- **Reversibility:** reversible with decision if exclusive semantics changes
- **Follow-up:** Detach guard, sortOrder UI

## NEW — Library Resource Model Type/Level/Visibility/Search/Filter/Sort/Preview/Locked/Metadata

- **ID:** NEW-LIB-01
- **Title:** Library resource model spec
- **Status:** PROVISIONAL
- **Date:** 2026-09-19
- **Context:** Task B Library
- **Evidence:** types.ts Resource + LibraryItem mediaId createdAt authoritative, demo persistence resources + blobStore, shelves presentation-owned, search placeholder — VERIFIED
- **Decision:** Library model as spec'd in 06, filter kind/instrument/level/visibility, sort added/uses/title, preview objectUrl, locked honest, metadata all fields, workflows empty/loading/error/demo persistence API seam
- **Alternatives:** Keep string level only (gap), no visibility (keep public), no filter (degrades)
- **Why:** Genuinely functional demo, honest states, reusable export
- **Consequences:** Frontend completable now A, backend storage provider B
- **Frontend:** FilterBar + sort + preview + locked + metadata
- **Backend:** S3/MinIO + signed URLs + scanning + uses increment transaction — B
- **Reversibility:** provisional — level relation decision pending
- **Follow-up:** Open decision library level relation, visibility field

## NEW — Gallery Genuine vs Shallow

- **ID:** NEW-GAL-01
- **Title:** Gallery audit genuine vs shallow
- **Status:** PROVISIONAL
- **Date:** 2026-09-19
- **Context:** Task C Gallery
- **Evidence:** gallery types album/image mediaId alt required, GalleryPanel reads via useGallery no fixture thumbnails M10 — VERIFIED
- **Decision:** Genuine criteria images>0 backed by media, metadata complete, filtering by album, ordering sortOrder, visibility all demo, storage seam metadata dataset blobStore, upload UI via media seam A
- **Alternatives:** Keep no upload (degrades), fabricate thumbnails (lie M10 removed)
- **Why:** Genuine functional, no shallow
- **Consequences:** Upload UI two writes same as library/chat, backend storage B
- **Frontend:** Upload UI A
- **Backend:** Same as media
- **Reversibility:** provisional
- **Follow-up:** Verify seed albums exist, visibility permission decision

## NEW — Settings/Theme Token Architecture

- **ID:** NEW-SET-01
- **Title:** Settings/theme tokens WordPress-customizer-like
- **Status:** PROVISIONAL
- **Date:** 2026-09-19
- **Context:** Task D Settings/Theme
- **Evidence:** BrandingPanel, appearance prefs localStorage, CSS vars --brand-*, validation hex strict font allow-list, application below lifecycle gate above AuthProvider, disabled controls honest — VERIFIED
- **Decision:** Two layers org identity vs device-local preference, token architecture CSS vars with fallback, editable defaults validation preview reset persistence org vs device-local schema, WordPress-customizer-like live preview draft before save + reset
- **Alternatives:** All localStorage (breaks org), all org (breaks personal), no reset (degrades), no draft preview (saves live immediately)
- **Why:** Correct separation, UX like customizer, honest persistence
- **Consequences:** Branding org table future, appearance stays localStorage per D2, reset + draft preview A
- **Frontend:** Branding reset button + draft preview container A, token spec doc
- **Backend:** organizations table + branding_settings + mediaId FK + signed URLs — B
- **Reversibility:** provisional — light theme deferred, viewer vs org accent naming pending
- **Follow-up:** Open decision viewer accent vs org accent, light theme, draft preview

## NEW — Export Reusable Mechanism

- **ID:** NEW-EXP-01
- **Title:** Export reusable column defs row transform locale encoding filter reuse
- **Status:** PROVISIONAL
- **Date:** 2026-09-19
- **Context:** Task E Data Export
- **Evidence:** exportService.ts buildExportTable explicit columns, serializeTable csv/xlsx, downloadBlob seam, EXPORT_LABELS Persian, safeFilename, BOM in chat export but maybe not csv — VERIFIED
- **Decision:** ExportDefinition pattern column defs explicit no leak, row transform locale, encoding UTF-8 BOM, filter reuse, filename Persian UTF-8 safeFilename, permission frontend no control backend 403, large-dataset client capped truncation disclosed server streaming B, usable by future reports
- **Alternatives:** Object.entries leak (insecure), no BOM (Excel Persian broken), no filter reuse (degrades), no permission (insecure), silent truncation (dishonest)
- **Why:** Reusable, secure, honest, RTL correct
- **Consequences:** Extend to library/gallery/attendance/scheduling/compensation/dashboard tabular summary A, server streaming B
- **Frontend:** BOM fix + filter reuse + column defs + permission guard + truncation disclosure A
- **Backend:** Streaming endpoint + per-object auth — B
- **Reversibility:** provisional
- **Follow-up:** Open decision export formats permission analytical contract

## NEW — Dashboard Analytics No Fabricated

- **ID:** NEW-DASH-01
- **Title:** Dashboard Raw->Derivation->Insight->Visualization->Export no duplicate engine NO_DATA if unavailable
- **Status:** ACCEPTED (M9 already)
- **Date:** M9 + re-affirmed 2026-09-19
- **Context:** Task F Dashboard analytical export
- **Evidence:** dashboardInsights.ts pure meanOf/ratioPct/topBy, useDashboardInsights 5 reads per_page 500 bounded window, figures traced, EMPTY «داده‌ای نیست» NO_DATA glyphs no NaN/Infinity, revenue chart removed — VERIFIED
- **Decision:** Pipeline Raw->Derivation->Insight->Visualization->Export single source dashboardInsights.ts, authoritative vs derived vs unavailable classification, date-range filtering bounded window, aggregation tabular summary reuse canonical calc, NO_DATA if unavailable
- **Alternatives:** Duplicate engine for export (drift), fabricated revenue (lie), 0 for unavailable (lie)
- **Why:** Honest analytics, no fabricated measurements
- **Consequences:** Date-range filter UI + export reuse A, server aggregation B, revenue chart stays removed until finance seam
- **Frontend:** Date-range filter bar + export tabular summary A
- **Backend:** Server aggregation for large range, finance domain for revenue — B/C
- **Reversibility:** accepted — keep until finance domain
- **Follow-up:** Permission for dashboard export

## NEW — RBAC High Criticality Preserve Vocab

- **ID:** NEW-RBAC-01
- **Title:** RBAC vocab preserve unless decision, users/roles/permissions/ownership/scope
- **Status:** ACCEPTED
- **Date:** 2026-09-19
- **Context:** Task G RBAC HIGH-CRITICALITY
- **Evidence:** permissions.ts 5 roles 22 perms rolePermissions matrix viewPermissions UX-only can/canAny/canAll defaultViewFor — VERIFIED
- **Decision:** Preserve vocab, smallest permission model, matrix Actor/Action/Resource/Scope/Allowed/Reason/Frontend guard/Backend enforcement, users/roles/permissions/ownership/scope self vs assigned vs org read/write, UI/route/action guards backend enforcement UX-only
- **Alternatives:** New permissions without gap (expands), role id direct checks (fragile)
- **Why:** Security, smallest model, honest about frontend UX-only
- **Consequences:** Teacher org-wide read currently — assigned scope decision needed, compensation client-side permission server must re-derive, media resolution != auth
- **Frontend:** Matrix doc + guards via can() + scope pure functions A
- **Backend:** Must enforce org_id + permission + scope + per-object auth — B
- **Reversibility:** accepted — vocab preserved
- **Follow-up:** Open decision self vs assigned vs org, ownership field, per-user read cursor

## NEW — Student Portal Architecture

- **ID:** NEW-PORTAL-01
- **Title:** Student portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files
- **Status:** PROVISIONAL
- **Date:** 2026-09-19
- **Context:** Task H Student Portal
- **Evidence:** D1 deferred, no student role, enrollment canonical, placement, eligibility pure, progress types, attendance roster, chat subjectId — VERIFIED
- **Decision:** Portal separate app or separate view with self scope, identity linking table user_id student_id relation self/guardian, scope self = linked studentId, assigned = teacher's classes' students via enrollment, org = manager/admin all in org, demo vs backend identity doc, communication demo single-viewer vs backend per-user cursor
- **Alternatives:** Student role in same panel (mixes concerns), no portal (degrades)
- **Why:** Clean separation, same backend contracts, smallest scope
- **Consequences:** Contract now backend later B, scope pure functions A, auth separate
- **Frontend:** Contract doc + scope pure functions A
- **Backend:** Linking tables + self scope enforcement + per-user cursor + media signed URLs — B
- **Reversibility:** provisional — D1 decision before schema
- **Follow-up:** Open decision student level scope, identity linking, portal auth, org/user relation

## NEW — Tickets/Chat/Files Topology

- **ID:** NEW-CHAT-01
- **Title:** Tickets/chat/files topology auth ownership unread/read scope validation storage
- **Status:** PROVISIONAL
- **Date:** 2026-09-19
- **Context:** Task I Tickets/Chat/Files
- **Evidence:** chat types provider in_app/telegram/bale/sms/email status, demoRepository flat collections normalized thread order lastMessageAt, Messages.tsx composer keyed D16 attachments two writes D15 export txt metadata only ceiling 1000 D14 — VERIFIED
- **Decision:** Topology flat normalized, auth messages.read/write, ownership userId+org_id future B, unread per conversation demo single-viewer + per-user cursor contract B, validation body max 4000 mediaId resolves, storage metadata dataset blobStore demo + S3 backend B, ticket vs chat distinction open decision
- **Alternatives:** Nested collections (drift), global composer (leaks), bulk export with bytes without scanning (insecure)
- **Why:** Genuine functional, honest about missing bytes, secure backend needed
- **Consequences:** Doc now A, ownership + cursor + storage provider B, bulk export deferred
- **Frontend:** Topology doc + one-frame fix + error disclosure A
- **Backend:** Owner field + per-user cursor table + S3 + signed URLs + scanning — B
- **Reversibility:** provisional — ticket vs chat distinction pending
- **Follow-up:** Open decision ticket vs chat ownership scope file ownership

## NEW — Telegram Backup vs Student Access Different Adapters

- **ID:** NEW-TG-01
- **Title:** Telegram bot backup vs student access different adapters not business owner
- **Status:** PROVISIONAL
- **Date:** 2026-09-19
- **Context:** Task J Telegram
- **Evidence:** chat provider enum, no bot integration, backup.ts JSON file environment always demo I8 — VERIFIED
- **Decision:** Two adapters BackupAdapter vs StudentAccessAdapter not business owner, backup retention/integrity/restore/encryption/failure OPEN, student access via bot commands calls domain services with self scope
- **Alternatives:** Single adapter (mixes concerns), business owner is Telegram (wrong)
- **Why:** Separation of concerns, backup contains PII needs encryption retention integrity
- **Consequences:** Contract spec B, backup via Telegram C deferred unless product needs, student access B
- **Frontend:** Contract doc B
- **Backend:** Bot API webhook, credential handling backend-only, encryption org key, queue retry — B
- **Reversibility:** provisional
- **Follow-up:** Open decision Telegram backup semantics identity linking

## NEW — Bale Adapter Contract Avoid Duplicate Logic

- **ID:** NEW-BALE-01
- **Title:** Bale adapter contract Core->Adapter->Telegram/Bale avoid duplicate logic
- **Status:** PROVISIONAL
- **Date:** 2026-09-19
- **Context:** Task K Bale
- **Evidence:** provider enum includes bale, status unavailable when no backend — VERIFIED
- **Decision:** Common MessagingAdapter interface sendMessage, domain services own RBAC scope eligibility file resolution persistence, adapters only transmit, no duplicate logic
- **Alternatives:** Duplicate logic per adapter (drift)
- **Why:** One owner per rule, D5
- **Consequences:** Contract spec B, implementation B
- **Frontend:** Contract doc B
- **Backend:** Bale API integration — B
- **Reversibility:** provisional
- **Follow-up:** Open decision Bale linking

## NEW — Mobile App Client Same Backend Contracts

- **ID:** NEW-MOB-01
- **Title:** Mobile app client of same backend contracts
- **Status:** PROVISIONAL
- **Date:** 2026-09-19
- **Context:** Task L Mobile app
- **Evidence:** registry.ts mode-switched, ApiClient envelope Collection/Item PageMeta, isApiMode, media abstraction two-part — VERIFIED
- **Decision:** Mobile app uses same backend contracts, same envelope, same domain repos, same RBAC, media/file abstraction -> storage provider, auth bearer secure storage not localStorage, offline C deferred
- **Alternatives:** Second API for mobile (duplicate)
- **Why:** One backend, clean seam, B1 decision Laravel domain structure
- **Consequences:** Contract spec B, same Laravel structure
- **Frontend:** Contract doc B
- **Backend:** Same as web + bearer secure storage — B
- **Reversibility:** provisional
- **Follow-up:** Open decision mobile auth

## NEW — Classification A/B/C Evidence-Based

- **ID:** NEW-CLASS-01
- **Title:** Classify each capability A FRONTEND-COMPLETABLE NOW / B CONTRACT NOW BACKEND LATER / C EXPLICITLY DEFERRED evidence-based
- **Status:** ACCEPTED
- **Date:** 2026-09-19
- **Context:** Task objective each important surface genuinely functional in demo mode
- **Evidence:** Audit reconstruction VERIFIED/DOCUMENTED/INFERRED/OPEN, capability matrix with columns — VERIFIED docs 01-02
- **Decision:** Classification as in 02-capability-matrix.md, prioritize frontend-usable, no fake backend, demo behaves like real API seams mirror real contracts
- **Alternatives:** Fabricate backend (lie), defer all (shell menus)
- **Why:** Task requires genuinely functional demo, honest states, stable seam for future backend
- **Consequences:** Roadmap vertical slices ordered A first
- **Frontend:** A slices implemented demo only
- **Backend:** B slices contract now backend later, C explicitly deferred with Surfaces
- **Reversibility:** accepted
- **Follow-up:** None

## [AGENT PROPOSAL] — Draft Preview Before Save for Branding

- **ID:** PROP-BRAND-01
- **Title:** Branding draft preview before save
- **Status:** OPEN (proposal)
- **Date:** 2026-09-19
- **Context:** Settings/theme WordPress-customizer-like
- **Evidence:** Currently Sidebar reads branding live, preview is live after save not before — gap
- **Decision (proposal):** Add local draft preview that writes CSS vars to preview container only, not document, until save — like WordPress customizer
- **Alternatives:** Keep live after save (current, degrades UX but simpler)
- **Why:** Better UX, prevents accidental org-wide change without preview
- **Required?** Optional — nice to have, not blocking first usable
- **Scope:** Frontend only — BrandingPanel local state draft, preview Surface with draft vars, save writes repo
- **Backend impact:** None — same repo update
- **Follow-up:** Decide if needed for first product — if not, keep current live-after-save with dirty check

## [AGENT PROPOSAL] — Library Level Relation vs String Vocabulary

- **ID:** PROP-LIB-01
- **Title:** Library.level string vs relation to LearningLevel
- **Status:** OPEN (proposal)
- **Date:** 2026-09-19
- **Context:** Library resource model level field
- **Evidence:** LibraryItem level is string display label, LearningLevel is entity with order per program — two concepts
- **Decision (proposal):** Keep string as vocabulary D (static) for now, add levelId optional relation later if needed — string is display, levelId is eligibility link (but eligibility already via LearningContent not Library Resource)
- **Alternatives:** Link LibraryItem to LearningLevel (would tie catalogue to curriculum, maybe not desired — library is catalogue, learning content is curriculum)
- **Why:** Library is catalogue public, learning content is curriculum gated — different owners
- **Required?** Optional — needs product decision
- **Scope:** Frontend + backend — if relation added, needs migration
- **Backend impact:** Add level_id FK nullable to library_items table
- **Follow-up:** Open decision

## [AGENT PROPOSAL] — Viewer Accent vs Org Accent Naming

- **ID:** PROP-THEME-01
- **Title:** Clarify viewer accent vs org brand colors
- **Status:** OPEN (proposal)
- **Date:** 2026-09-19
- **Context:** Settings has "تم" dark/glass and "لهجهٔ برند" gold/violet etc, branding has primary/accent hex
- **Evidence:** Two accents — org brand hex vs viewer semantic token choice — naming confusion
- **Decision (proposal):** Rename viewer accent to "viewerAccent" or "themeAccent" (gold/violet/amber) and org accent to "brandAccent" hex — clarify in types and UI labels
- **Alternatives:** Keep both named accent (confusing)
- **Why:** Prevents confusion, D5 one source per concept
- **Required?** Optional — docs can clarify without rename
- **Scope:** Frontend types + UI labels + localStorage key
- **Backend impact:** None for viewer accent (device-local), org accent is branding table
- **Follow-up:** Open decision
