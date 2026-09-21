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
> **Live `O-*` / `T-02` status is governed by `GOVERNANCE_CHECKPOINT.md` (2026-09-21)** — the
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
- **Status:** **DECIDED** (2026-09-21 pre-start decision pass — resolved from PROVISIONAL; historical status text preserved: “PROVISIONAL (from PROJECT_STATE.md)”)
- **Date:** 2025-10-13
- **Context:** Integration boundary Core API->Auth+RBAC->Domain Services
- **Evidence:** ApiClient Bearer, isApiMode, OrganizationScope, apiErrorFromThrown — VERIFIED
- **Decision:** Backend Laravel domain structure same as frontend domains, Sanctum cookie primary + bearer fallback for mobile, org_id scoping, rolePermissions matrix server-side
- **Alternatives:** Second API for mobile (duplicate), no org scoping (insecure)
- **Why:** One backend, clean seam, same contracts
- **Consequences:** Mobile app client of same backend, no second API
- **Frontend:** ApiClient already bearer, needs cookie support later
- **Backend:** Laravel with Sanctum, OrganizationScope, per-object auth
- **Reversibility:** decided — the architecture is fixed for Laravel v1; changing the transport or the tenancy model requires a new decision, it is no longer an open provisional choice (historical wording preserved: “provisional — can adjust auth method”)
- **Follow-up:** RESOLVED 2026-09-21 — see “Pre-start resolution pass — 2026-09-21” at the end of this file (historical wording preserved: “Resolve before backend start — open decision”). Resolution is an **architecture** decision only and is **not** implementation authorization.

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

---

## Pre-start resolution pass — 2026-09-21 — documents only

> **What this section is.** A single dated pass that closes the *documentation* items a read-only
> backend-architecture gate found open before any Laravel work. It adds **no new register**, no new
> D-number, and no new product decision. `O-07`…`O-20`, `T-02`, `PERF` and `HELP` keep their statuses in
> [`GOVERNANCE_CHECKPOINT.md`](../engineering/GOVERNANCE_CHECKPOINT.md) (reached from
> [`DECISIONS.md`](../engineering/DECISIONS.md) **§20**), which this pass does **not** modify.
> `O-01`…`O-06` are supplied here because that checkpoint’s index does not carry them and their only
> previous status lines lived in the superseded F0 snapshot [`13-open-decisions.md`](13-open-decisions.md).
>
> **What this section is not.** It is **not** implementation authorization (see §“Implementation
> authorization gate” below), and it is **not** a commitment that any of these decisions can be *acted on*
> yet.
>
> **Identifier caution.** `B1` below means **this register’s `B1` — Laravel Domain Structure**. The
> `B1` / `B2` recorded in [`PROJECT_STATE.md`](../engineering/PROJECT_STATE.md) and
> [`PHASES.md`](../engineering/PHASES.md) are an **unrelated M4 audit’s acceptance-coverage findings**
> (`df70148…`) and must not be conflated with this entry.
>
> **Historical reports keep their historical wording.** `F7_REPORT.md`, `F8_REPORT.md`,
> `F10_INVENTORY.md` and the superseded F0 snapshot state `B1 PROVISIONAL` and `O-01 OPEN` as they stood
> when written. They record the past accurately and are **not** updated by this pass.

### 1. B1 — Laravel Domain Structure — RESOLVED (DECIDED)

**Status:** DECIDED (2026-09-21). Recorded from PROVISIONAL, with the original evidence fields above left intact.

**The decided architecture (unchanged in substance from B1’s own `Decision` field; this restates it as
current law, it does not extend it):**

- Laravel backend domain structure **mirrors the established frontend domain boundaries where appropriate**.
- **One `/api/v1` API.** No second API for mobile, no parallel web API.
- **Sanctum cookie is the web transport**; **Bearer** authentication supports the mobile client
  (token in OS secure storage — never `localStorage`). One user identity across both.
- **Organization / tenant scope derives from the authenticated principal** (never from the request).
- **The server-side role/permission matrix is authoritative**; frontend guards stay UX-only.
- **Authorization is enforced server-side through policy/query boundaries** — never by loading rows and
  filtering in application code.
- **No generic CRUD architecture** (aligns with `O-15`: no universal CRUD, no GraphQL).
- **No microservices and no speculative infrastructure** (aligns with `PERF`: no Redis, Elasticsearch,
  WebSocket, CDN).

**What this resolution is not:** it is not authorization to begin implementation, and it is not a licence
to invent detail beyond the list above. The transport caveat in §3 below stays live until the client is
reconciled.

### 2. O-01…O-06 — current status (narrowest lawful clarification)

Each row states what the **existing** authority already fixes, and what — if anything — still needs a
decision. Nothing here is copied from the superseded snapshot; each status is derived from a named
authority. **“Prerequisite”** means: do not create the affected table/relation until this is closed.

| ID | Topic | Current status | Authority / basis | Backend prerequisite |
|---|---|---|---|---|
| `O-01` | Student level scope (per-program / per-instrument) | **DECIDED 2026-09-21 — PER-PROGRAM (per-instrument/program independent).** Product-owner final decision: educational level is determined independently for each instrument/program; one student may hold different levels in different programs/instruments simultaneously (e.g. piano L3, vocals L1, violin L2). Per-program is the chosen model; global per-student and per-instrument options are formally excluded. The implemented form is per-program and is now ratified. Teacher manual override: a teacher may grant exceptional access to a specific resource for a specific student without changing the student’s level or program placement — resource-level exception only, not a level change. **Resolved before backend.** | Owner decision recorded 2026-09-21 (this document); `04-learning-access-policy.md` §“Per-Program / Instrument Scope — DECIDED O-01”; `NEW-LRN-01` ACCEPTED fixes the canonical rule (“per-program/instrument scope”, placement per `(student,program)` VERIFIED) | **Yes** — determines the key of `student_placements`: key is `(student_id, program_id)`; one active placement per `(student, program)`. Do **not** use `production-handoff.md:155`’s `UNIQUE(student_id)` sketch: it predates the model and is superseded by this decision (marked NOT AUTHORITATIVE inline). Teacher exception access is a backend authorization concern (policy-level), not a placement/schema change — exact persistence model is a future decision, not part of O-01. |
| `O-02` | Library resource level: string vocabulary vs relation to `LearningLevel` | **DECIDED 2026-09-21 — DESCRIPTIVE STRING VOCABULARY.** Product-owner final decision: `library_items.level` is a descriptive catalogue string vocabulary. It is **NOT** an authorization field and has **NO** direct FK to `learning_levels`. Student learning eligibility remains strictly governed by O-01 and the Learning domain. Exact database column type/length remains an implementation detail for the Laravel migration phase (no SQL length/type such as `VARCHAR(100)` is a product or architecture requirement). No `library_item_levels` or bridge table for v1; no merging of Library and Learning domains. **Resolved before backend.** | Owner decision recorded 2026-09-21 (this document); `PROP-LIB-01`; `06-library-gallery-spec.md` (two concepts, VERIFIED); `GOVERNANCE_CHECKPOINT.md` | **Yes** — determines the library table’s level column: string vocabulary, no FK to `learning_levels`. |
| `O-03` | Visibility field for Library / Gallery | **Library: DISCHARGED** — decided *and already implemented*: publication status uses the existing `active` + `visibility` (students/teachers) semantics, no new workflow. **Gallery: OPEN** — no visibility field exists; “public demo” is the current placeholder. | F1 publication-status disposition (`06-library-gallery-spec.md`, VERIFIED) + shipped `src/domains/library/types.ts` (`visibility?`, `active?`); gallery: `NEW-GAL-01` PROVISIONAL follow-up “visibility permission decision”, `06` “OPEN — for now public demo” | **Yes for the Library** — the client already models and filters `visibility`, so the server must persist `active` + `visibility` (and filter them in SQL) or its own contract is unimplementable. **Yes for Gallery** before a gallery visibility column/filter exists. |
| `O-04` | Theme persistence: org vs device-local | **DISCHARGED for v1 — device-local.** Branding is org data; appearance/theme/accent/density/motion is device-local per browser. An *org default theme* is explicitly a **later, optional** change requiring a decision — not a v1 item. | Canonical `D2` (`DECISIONS.md` §19: branding is the source of truth for academy identity) + this register’s `D2` ACCEPTED (“organizations table + branding_settings, appearance stays localStorage”; “reversible — can add org theme optional later with decision”) | No — v1 carries no `default_theme`. (`PROP-THEME-01`’s viewer-vs-org accent *naming* clarification stays an open proposal and does not affect persistence.) |
| `O-05` | Export formats | **DISCHARGED for v1 — the implemented set stands** (CSV/XLSX tabular; chat export stays single-conversation TXT per `D14`). PDF requires the Finance/Reports domain and stays **deferred** with `D6`/`I2`. Any *additional* format is a new decision, not an implementation choice. | Canonical `D6` (Finance/Reports deferred), `D14` (no new verb, chat TXT, metadata only), `08-export-architecture.md` (format table + “Future: PDF? Deferred C”), `O-15` (downloads raw/signed, never JSON-wrapped) | No — but large exports are async jobs and must not stream bytes through the Laravel request path (`PERF`). |
| `O-06` | Permission for dashboard / analytical export | **DISCHARGED for v1 — the view’s own permission, no new permission.** Analytical/dashboard export requires the same permission as the view it exports (`students.read` today, as `viewPermissions` already maps). Introducing `reports.read` or a new `dashboard.export` would be a **new decision** and needs a proven gap. | `NEW-RBAC-01` ACCEPTED (“smallest permission model”, “new permissions without gap (expands)” rejected); `05-rbac-access-control.md` / `viewPermissions` mapping dashboard → `students.read` VERIFIED | No (no schema change) — but the permission must be enforced **server-side** on the export endpoint, not only in the client guard. |

**Net effect:** `O-04`, `O-05`, `O-06` are closed for v1; the Library half of `O-03` is closed; `O-01` was
resolved to DECIDED per-program; `O-02` was resolved to DECIDED descriptive string vocabulary (see
§“O-02 closure — 2026-09-21” below); **the Gallery half of `O-03` stays genuinely open**; the remaining
high-cost open decisions before backend schema are reduced to five (`O-08`, `O-09`, `O-10`, `O-13`,
`O-14`). No product decision was invented in reaching any of these statuses.

### 3. O-12 — web transport: recorded pre-start integration requirement (decision unchanged)

**Governance is unchanged and is not reinterpreted here.** `O-12` = one identity, one `/api/v1`;
**web = Sanctum cookie + CSRF**; **mobile = Bearer** in OS secure storage.

**The actual state of the client today (read-only evidence):** `src/api/client.ts` is a Bearer-oriented
JSON boundary — it attaches `Authorization: Bearer …` from an injectable token provider, sends **no**
`credentials: "include"`, performs **no** CSRF/XSRF token exchange, and has no cookie awareness anywhere;
`deploy/` carries no CORS configuration (same-origin only) and already proxies `/api/*` to
`127.0.0.1:8080` with login rate limiting.

**Requirement recorded:** the first authenticated **web** implementation must **not** claim full `O-12`
compliance until that client transport is reconciled. Either the server is built to the governed
cookie + CSRF half (and the client gains cookie/CSRF support), or the web half temporarily ships
Bearer-only as an **explicitly recorded deviation**. Choosing between those two is **not** decided by this
pass: it is a known integration requirement to be closed before the first authenticated web release.

**Freeze policy is untouched.** No reopening of the frontend freeze is decided here, and none is implied;
if the chosen path requires a client change, the existing freeze rule applies unchanged (an explicit
decision is required first). This pass writes no `src/` file.

### 4. Tenant enforcement — one authoritative seam (implementation-level decision)

**Decision.** Before the first organisation-scoped domain query is written, the backend establishes
**one** authoritative tenant-enforcement seam — a deliberately documented **combination** of a
query-layer scope and the policy layer, with the following invariants preserved:

- **Organisation from the authenticated principal only.** The acting org is resolved from the session /
  token. Never from a request body, header, query parameter, or route segment — a client may not select
  its own tenant.
- **Fail-closed.** Absence of a resolvable organisation (unauthenticated, suspended org, unknown
  principal) **denies**; it never broadens. A scoped query that reaches an organisation-owned model
  without the seam applied is a **defect**, not a default-allow.
- **Owner-per-rule preserved (D5).** Row visibility (which org's rows may be seen) belongs to the query
  seam; object-level, role and scope authorization belongs to policy/query boundaries. Neither layer
  re-derives the other's decision from request input.
- **T-02 assigned-only is part of the seam, not a caller's responsibility.** Teacher student-read =
  *active enrolment ∩ `class.teacherId`*, enforced in query/policy, fail-closed. `Student.teacherId` is
  **not** authorization. It must not be ported from any frontend convenience path that fails open.
- **No second tenancy model.** v1 keeps many users : one org via `users.organization_id` (`O-14`); no
  membership pivot; no super-admin switcher; no "load-then-filter" anywhere; no `owner_id` as a
  substitute for tenant scope (`O-08`).

**Status.** Recorded 2026-09-21 as an architecture decision — **no code is part of it.** Naming,
framework mechanics and file layout are implementation detail and are deliberately not fixed here.

### 5. Implementation authorization gate — unchanged and CLOSED

**Architecture decisions ≠ implementation authorization.**

- Laravel / backend implementation is **NOT STARTED and NOT AUTHORIZED**.
- This pass **grants no authorization**; it removes documentation ambiguity only.
- B1 resolved to DECIDED does **not** start the backend, and no item above is a green light.
- The next phase still requires an **explicit owner authorization**, as
  [`DECISIONS.md`](../engineering/DECISIONS.md) §20 and
  [`SESSION_HANDOFF.md`](../engineering/SESSION_HANDOFF.md) §4 already require.
- This pass changed documentation only: **no** `src/`, test, package/dependency, deployment or backend
  file; **no** commit was made by it.

---

## O-01 closure — 2026-09-21 — outcome: DECIDED (per-program, product-owner final)

> **Why this section exists.** `O-01` (student level scope) directly determines the backend schema for
> student placements. The 2026-09-21 closure audit (kept below in its historical wording as it stood
> before the product decision) found the evidence **insufficient** from the repository alone and
> explicitly required the academy's product answer. **That product answer was delivered on
> 2026-09-21** and is recorded here. Nothing here authorizes implementation; no code, migration or
> schema was written and no historical record was rewritten.

### Final decision — recorded 2026-09-21 (owner decision, documentation only)

**Decision:** Educational level is independent per instrument/program. One student may hold
**different levels in different programs/instruments simultaneously**:

- Piano → Level 3
- Vocals → Level 1
- Violin → Level 2

Therefore the relation is **Student → Program/Instrument → Level** (per-program model).

**Consequences for placement:** Placement is keyed `(student_id, program_id)` — one active placement
per (student, program). This ratifies the already-implemented per-program model; global per-student
and per-instrument scope are formally excluded. Placement for each (student, program) pair is
independent.

**Consequences for class assignment:** When a class is defined for a student, it must be tied to a
specific program/instrument and its corresponding level; the class level must be consistent with the
learning path for that program/instrument.

**Consequences for library/resource access:** Learning resources are offered to the student according
to the program/instrument and the level for **that** program/instrument, ensuring a controlled
learning path so that higher-level resources are not accessible without authorization. Eligibility
already enforces this per-program in `resolveEligibleContent` (`learning/eligibility.ts`, Level N ⇒
1..N cumulative/exclusive within `placement.programId`).

**Teacher exceptional access (resource grant):** A teacher may manually authorize a specific
resource/file for a specific student, even if that resource falls outside the student's normal
level access. This exception:

- Does **not** change the student's primary level.
- Does **not** change the student's program/instrument level.
- Only grants access to that **one specific resource**.
- Must be enforceable in backend authorization (policy-level) in the future.
- The exact persistence model / table for this exception is **not** decided here — only the
  product behaviour is recorded. No schema is invented.

**Contradiction ruled on (unchanged from 2026-09-21 audit):** `production-handoff.md:155`'s
`UNIQUE(student_id)` sketch is NOT AUTHORITATIVE — it predates the placement model and is superseded
by this decision (marked inline in that file). It was not deleted or rewritten.

**What this decision does NOT do:**

- It does **not** create any migration, model, controller, route, policy or frontend change.
- It does **not** invent a schema for teacher exceptional access.
- It does **not** authorize backend implementation (the implementation authorization gate in §5
  stands unchanged: Laravel is NOT STARTED and NOT AUTHORIZED).
- It does **not** close the Gallery half of `O-03` (which remains genuinely open); `O-02` was decided
  on 2026-09-21 (see §“O-02 closure — 2026-09-21” below).

### Historical audit — 2026-09-21 (kept verbatim, records the state BEFORE the product decision)

> The text below is the 2026-09-21 closure audit as written when O-01 was still OPEN. It is kept
> verbatim as historical record and is **superseded** by the “Final decision” subsection above.

### 6.1 What the record says (compared, not summarised from memory)

| Source | What it establishes about scope |
|---|---|
| [`04-learning-access-policy.md`](04-learning-access-policy.md) §“Per-Program / Instrument Scope — OPEN Decision O-01” (:39–:63) | “**Scope decision remains OPEN** where evidence is insufficient: global vs per-program vs per-instrument — **do not invent this decision — O-01**.” Current implementation is per-program and labelled **“OPEN — provisional current, needs product confirmation per O-01”**; global and per-instrument are both **“OPEN — not chosen”**. Backend impact: *“if global chosen, would need migration to `student_id level_id` only — high-cost decision before Laravel schema — **must resolve O-01 before backend**”*. |
| [`13-open-decisions.md`](13-open-decisions.md) (:36–:45, :243, :268) — **historical F0 snapshot, superseded** | `O-01` **OPEN — needs product confirmation**; listed first under *“High-Cost Decisions to Resolve Before Coding”*: *“affects placement table”*. |
| [`11-roadmap.md`](11-roadmap.md):246 | “Learning access scope decision **remains OPEN** … where evidence insufficient **do not invent** — O-01”. |
| [`14-handoff-checkpoint.md`](14-handoff-checkpoint.md):70, :165, :191 | Scope OPEN, current per-program provisional, *“do **NOT** change”*; among the high-cost items before Laravel schema/API. |
| [`15-student-portal-architecture.md`](15-student-portal-architecture.md):187, :228, :247 | “**remains OPEN** … scope functions operate per-program where placement exists, not global — provisional per-program”; *“do not resolve by assumption”*. |
| [`F1_INVENTORY.md`](../engineering/F1_INVENTORY.md):19, :188 · [`F2_INVENTORY.md`](../engineering/F2_INVENTORY.md):178 | *“scope O-01 OPEN … **do NOT decide** — current per-program provisional via `placement.programId` — keep OPEN”*; `F2`: *“**MUST NOT resolve** … do not invent — must keep per-program provisional”*. |
| `F3`–`F6` reports/inventories | “`O-01` remains OPEN … does **NOT** own” — four consecutive passes explicitly refused to resolve it. |
| [`F7_REPORT.md`](../engineering/F7_REPORT.md):80, :88, :159, :166 · [`F8_REPORT.md`](../engineering/F8_REPORT.md):87, :96 | “Placement per `(student,program)` … **per-program provisional `O-01` OPEN** — keep, not resolved by assumption”. |
| [`F10_REPORT.md`](../engineering/F10_REPORT.md):242 · [`F10_INVENTORY.md`](../engineering/F10_INVENTORY.md):47, :83 | “`O-01` … **OPEN** — per-program provisional — **do not invent** — preserved”; *“remain OPEN per F10 requirement — no resolution by assumption”*. |
| [`NEW-LRN-01`](#new--learning-eligibility-canonical-owner) (this file, ACCEPTED 2026-09-19, :237–:252) | Accepts the **canonical rule and its owner** (`learning/eligibility.ts`, Level N ⇒ 1..N, cumulative/exclusive, the five named states), with *Evidence:* “placement per `(student,program)`, **level order per program** — VERIFIED” and *Alternatives:* “Global level order (breaks per-program)”. It records the **implemented** scope inside the rule it accepts; its *Follow-up* names only “Detach guard, sortOrder UI”. **It is not a product confirmation of the scope question**, and the policy document it is drawn from keeps that question explicitly OPEN. |
| Frontend source comments | `src/domains/learning/types.ts`:39 “**O-01 remains OPEN**”; `eligibility.ts`:26 “**O-01 remains OPEN** (locked semantics preserved)”; `src/domains/auth/scope.ts`:22 “remains OPEN, not resolved”; `StudentLearningPanel.tsx`:14 “O-01 remains OPEN”. |

**What is verified about the current model (constraints, not a decision):**

- `StudentPlacement = { id, studentId, programId, levelId, assignedAt, history }`, documented in
  `src/domains/learning/types.ts`:227–:240 as *“One active placement per **(student, program)**”*;
  `history` records past levels.
- Level **definitions** are per program: `learning_levels … UNIQUE(program_id, order)` and
  “order unique within program — VERIFIED” (`04`; `production-handoff.md`:152).
- Eligibility is resolved **within `placement.programId`**: `resolveEligibleContent`
  (`eligibility.ts`:63–:75) indexes only the levels of that program, so a placement pointing at a level
  outside its program is treated as inconsistent data.
- **The access surface is student-singular today**: `getStudentPlacement(studentId)` and
  `removePlacement(studentId)` are keyed by student alone, and the demo resolves the **first** row for
  that student (`demoRepository.ts`:287–:289), while `AssignPlacementInput` and `PlacementListParams`
  carry `programId` (`types.ts`:268–:281). A per-program scope therefore implies a **contract change**
  (a student-keyed accessor cannot address several placements) — which is itself a decision, not
  something a backend may settle by adapting silently.

### 6.2 Why the evidence is insufficient (and what exactly is missing)

**The missing decision.** The academy’s product answer to one question: **may one student hold different
levels in different programs at the same time?** Concretely, is a level *scope*:

| Option | Meaning | Schema consequence (from the record) |
|---|---|---|
| **per-program** *(implemented)* | A student has a separate level in each program (violin classic L3 ≠ violin irani L1). | Key `(student_id, program_id)`; row carries `program_id`; server eligibility joins on `program_id`. |
| **per-instrument** | One level spans all programs of one instrument. | Key `(student_id, instrument_id)`; row carries `instrument_id`; level definitions per program must be reconciled. |
| **global per student** | One level across all programs/instruments. | Key `(student_id)` alone; row carries neither; **documented leak**: “violin classic L3 would grant piano L3 incorrectly”; `04`:63 records the migration this would force. |

**Why that is not answerable from this repository.** (1) No document records a product/academy statement
on the question — every source above either *records the implementation* or *asks the question*. (2) The
record explicitly **forbids** resolving it by assumption (“do not invent”, “MUST NOT resolve”, “do not
resolve by assumption”), across the policy document, the F0 snapshot, the F-series inventories/reports and
the source comments. (3) `NEW-LRN-01`’s ACCEPTED status governs the **rule, its owner and its semantics**;
its own Evidence line describes the *existing* placement model, and the policy doc it derives from keeps
scope OPEN — so treating it as the missing product confirmation would be exactly the invention the record
prohibits. (4) The three options require *different* keys, columns and join paths, so no single schema can
safely serve all three and none is reachable from another by configuration. Per the closure rule, the
audit therefore **keeps `O-01` OPEN and invents nothing**.

### 6.3 Contradiction ruled on — `production-handoff.md`:155

`| student_placements | UNIQUE(student_id) — one active placement per student; keep an append-only history table. |`

**Ruling: NOT AUTHORITATIVE — provisional planning sketch, contradicted by the verified model.** Evidence:
the file is a **checklist** (“Status of this build: demo-complete, not production-deployable”; labels
`IMPLEMENTED / BACKEND REQUIRED / FUTURE`), its table is headed “### Schema” with a `Table | Notes` sketch
layout, and it was written for the earlier phase (“Added this phase: `instruments`, `learning`, …”), i.e.
**before** the placement model landed. It is cited by **no** decision; `NEW-LRN-01` and
`04-learning-access-policy.md` (with `types.ts` as code evidence) supersede it in substance; and the same
table’s `learning_levels … UNIQUE(program_id, order)` already contradicts a global reading. It was **not
deleted or rewritten** — it now carries an inline marker so it cannot be mistaken for current law.

**Identifier caution (pre-existing record noise).** [`05-rbac-access-control.md`](05-rbac-access-control.md):165
and [`11-roadmap.md`](11-roadmap.md):115 say “assigned scope decision **O-01**” about **teacher student-read
scope** — that is **`T-02`**, not `O-01` (level scope). Those are historical spec texts and are left
untouched; do not read their `O-01` as this item.

### 6.4 What must NOT be implemented while `O-01` is open

- **No** `student_placements` table, migration, model or schema — in any of the three forms.
- **No** `UNIQUE(student_id)` (the `production-handoff.md`:155 sketch), and equally **no**
  `UNIQUE(student_id, program_id)` chosen silently: both are decisions the record has not taken.
- **No** reinterpretation of `NEW-LRN-01` as a scope confirmation, and no change to
  `resolveEligibleContent`’s program-scoped behaviour, its five named states, or the Level N ⇒ 1..N rule.
- **No** change to the student-keyed placement accessors to “make the backend fit” — that is a contract
  decision.
- **No** freezing of the placement key by any other route (view, index, or convenience endpoint).

---

## O-02 closure — 2026-09-21 — outcome: DECIDED (descriptive catalogue string vocabulary, product-owner final)

> **Why this section exists.** `O-02` (Library resource level: string vocabulary vs relation to
> `LearningLevel`) governs the database schema for the library catalogue (`library_items`) and its
> structural relationship to the curriculum domain (`learning_levels` / `learning_content`).
> Following the 2026-09-21 closure audit and the product owner's final ruling on 2026-09-21, this section
> records the canonical decision. The historical audit as conducted prior to closure is preserved
> below. Nothing here authorizes implementation; no code, migration, or schema was written and no
> historical record was rewritten.

### Final decision — recorded 2026-09-21 (owner decision, documentation only)

**Decision:** `library_items.level` is a **descriptive catalogue string vocabulary**.

- **Not an authorization field:** `library_items.level` is a human-readable difficulty/category label
  for catalogue browsing, searching, and filtering. It is **NOT** an authorization field and does
  **NOT** control student learning eligibility.
- **No foreign key:** `library_items.level` has **NO direct FK** to `learning_levels`.
- **Implementation detail for Laravel:** Exact database column type and length (e.g. `VARCHAR` or
  nullable string column) remains an implementation detail for the Laravel migration phase. No
  specific SQL length/type (such as `VARCHAR(100)`) is a product or architecture requirement.
- **No bridge table:** Do **not** create `library_item_levels` or any other bridge table for v1.
- **No domain merge:** Do **not** merge the Library and Learning domains. They remain separate domains
  with distinct owners (Library owns catalogue metadata; Learning owns pedagogical progression and
  eligibility; Media owns file assets in object storage).
- **Student learning eligibility:** Remains strictly governed by **`O-01`** and the Learning domain.
  Student access to curriculum materials is governed exclusively by `resolveEligibleContent` over the
  active `StudentPlacement` and `level_content_links` (`(student_id, program_id)` model).
- **O-01, T-02, and O-03 statuses remain unchanged.**

**What this decision does NOT do:**

- It does **not** create any migration, model, controller, route, policy, or frontend change.
- It does **not** authorize backend implementation (the implementation authorization gate in §5
  stands unchanged: Laravel is NOT STARTED and NOT AUTHORIZED).
- It does **not** close the Gallery half of `O-03` (which remains genuinely open), or the remaining
  open decisions (`O-08`, `O-09`, `O-10`, `O-13`, `O-14`).

---

### Historical audit — 2026-09-21 (kept verbatim, records the state BEFORE the product decision)

> The text below is the 2026-09-21 closure audit as written before the product decision was ruled on.
> It is kept verbatim as historical record and is **superseded** by the “Final decision” subsection above.

### 7.1 What the record says (compared across all sources)

| Source | What it establishes about O-02 |
|---|---|
| [`06-library-gallery-spec.md`](06-library-gallery-spec.md) (:15–:26) | `LibraryItem` extends `Resource` (`id, title, composer, kind, instrument, level, size, duration, pages, added, uses, peaks, mediaId, createdAt, visibility, active`). Level is currently a string display label: *“level: string — currently string label, not relation — gap, needs decision: keep as vocabulary D (static) or link to LearningLevel? For now filter by level string — A NOW”*. Formally separates catalogue from curriculum: *“two concepts: LearningContent (curriculum resource linked to levels) vs Library Resource (catalogue)”*. |
| [`12-decision-register.md`](12-decision-register.md) §2 (:563) | *“OPEN — narrowed to the storage question. The separation of Library Resource (catalogue) from Learning Content (curriculum) is settled and verified in the shipped model: two types, two owners, different visibility/eligibility. Whether LibraryItem.level stays a display string or gains a level_id FK is not decided.”* Marked as prerequisite for the library table's level column shape. |
| [`12-decision-register.md`](12-decision-register.md) → `PROP-LIB-01` (:474–:492) | Agent proposal: *“Keep string as vocabulary D (static) for now, add levelId optional relation later if needed — string is display, levelId is eligibility link (but eligibility already via LearningContent not Library Resource). Why: Library is catalogue public, learning content is curriculum gated — different owners.”* |
| [`13-open-decisions.md`](13-open-decisions.md) (:48–:60) — historical F0 snapshot | *“Question: Library Resource vs Learning Content — are they same or different? Library.level string vs relation to LearningLevel? Evidence: Resource is catalogue item with mediaId, LearningContent is curriculum resource linked to levels via LevelContentLink — two types — VERIFIED. Recommendation: Keep separate — different owners, different visibility — Library public if library.read, LearningContent gated via eligibility — proposal PROP-LIB-01.”* |
| [`F1_INVENTORY.md`](../engineering/F1_INVENTORY.md):19 · [`F2_INVENTORY.md`](../engineering/F2_INVENTORY.md):179 · [`F10_INVENTORY.md`](../engineering/F10_INVENTORY.md):83 | *“Library.level string vs relation to LearningLevel — O-02 — keep string vocabulary D for now provisional per decision register — do NOT link to LearningLevel relation unless evidence requires documented change”*; F2: *“MUST NOT resolve … keep separate per PROP-LIB-01”*; F10: *“preserved”*. |
| Ratified `O-01` decision (2026-09-21, PR #8) | Educational level is strictly **per-program** (`UNIQUE(program_id, order)`). Levels do not exist globally or by instrument alone; they are rungs of a specific `LearningProgram`. Consequence for resources: *“Resources must be categorizable by program/instrument and level so that they are offered only to students who meet the per-program level eligibility — enforcing the controlled learning path. Higher-level resources must not be offered without authorization. Teacher exceptional access: A teacher may manually authorize a specific resource/file for a specific student outside that student's normal per-program level access (resource-grant only, no level change; persistence model future decision).”* |
| Shipped frontend source code | `src/domains/library/types.ts`: `Resource.level: string`, `CreateLibraryItemInput.level?: string`, `LibraryListParams.level?: string`. `src/views/Library.tsx`: level input is `<input placeholder="مثلاً متوسطه" />`, dynamic filter chips derived from live values (`set.add(r.level)`), search matches `r.level.includes(q)`. `src/domains/learning/types.ts`: `LearningContent` has no direct `levelId` — it uses `LevelContentLink` (M:N) to attach to `LearningLevel`, which belongs to `LearningProgram`. |
| Seed implementation (`src/domains/demo/learningSeed.ts`:130–:195) | Derives `LearningContent` from library `resources` (`deriveLearningContent`) to avoid disconnected catalogues, and maps free-text Persian labels (`مقدماتی`, `سطح ۱`, `سطح ۲`, `متوسط`, `متوسط رو به بالا`, `پیشرفته`) to numeric level bands (`LEVEL_BAND`) clamped to each program's depth. |

### 7.2 Architectural & Structural Analysis

The audit establishes three fundamental structural findings:

1. **Separation of Concerns is Already Settled (D5 Compliance):**
   - **`library` domain (`LibraryItem`):** Owns the academy's broad educational media catalogue (sheet music, recordings, video masterclasses, handouts). Its primary audience is teachers and staff browsing and discovering materials (`library.read`). Catalogue metadata includes: `title`, `composer`, `kind` (`sheet`, `audio`, `video`, `doc`), `instrument`, `size`, `duration`, `pages`, `added`, `uses`, `peaks`, `visibility` (`students` \| `teachers`), and `active`.
   - **`learning` domain (`LearningContent`):** Owns structured pedagogical curriculum pathways (programs, sequential levels 1..N, student progression, and access gating via `resolveEligibleContent`).
   - **`media` domain (`MediaAsset`):** Owns binary assets in object storage and their metadata (`media_assets`). Both `LibraryItem` and `LearningContent` reference `mediaId`. A single binary (e.g. a sheet music PDF) can be indexed in the library catalogue and simultaneously linked into a curriculum level without duplicating bytes.

2. **Structural Mismatch between `LibraryItem` and `LearningLevel` (Impact of O-01):**
   - Under `O-01`, levels are strictly **per-program** (`UNIQUE(program_id, order)`). A level row cannot exist without a `program_id`.
   - A `LibraryItem` belongs to an `instrument` (e.g. `violin`), NOT to a `program`. An instrument often has multiple programs (e.g. "ویولن کلاسیک" and "ویولن ایرانی").
   - If `library_items` were to carry a direct `level_id FK REFERENCES learning_levels(id)`:
     - Every catalogue item would be forced to bind to one specific program's level, preventing it from serving students in other programs of that instrument or across programs.
     - General reference materials (e.g. "تئوری موسیقی بنیادی", "تمرین‌های سلفژ", "کنسرت پاییز") that apply across multiple levels or programs could not be cleanly represented.
     - In the curriculum domain, `LearningContent` uses a many-to-many join table (`LevelContentLink`) so that one piece of content can be linked to multiple levels and programs. A single `level_id` column on `library_items` would be a rigid 1:N anti-pattern.

3. **Student Access & Controlled Learning Path:**
   - In the Student Portal (`15-student-portal-architecture.md`), student access to instructional materials is governed by **`resolveEligibleContent`** over their active `StudentPlacement` and `level_content_links`.
   - If an academy resource is part of a student's formal progression ladder, it is attached to a `LearningLevel` via `LevelContentLink`.
   - If students browse the general library, access is governed by `visibility = "students"` and the pedagogical difficulty label, preventing unauthorized access to advanced material while allowing open discovery of reference works.

### 7.3 Options for O-02 Resolution

| Option | Description | Schema / Persistence | Pros | Cons / Risks |
|---|---|---|---|---|
| **Option 1: Decoupled Catalogue with String Vocabulary (Recommended)** | Keep `LibraryItem` and `LearningContent` separate. `LibraryItem.level` remains a descriptive string/vocabulary (`VARCHAR(100) NULL` or enum) representing broad difficulty (e.g. "مقدماتی", "متوسط", "پیشرفته", "عمومی"). Controlled curriculum progression remains exclusively in `learning_content` + `level_content_links`. | `library_items`: `level VARCHAR(100) NULL` (no FK to `learning_levels`). `learning_content`: unchanged. | 1. 100% compliant with existing frozen frontend, tests, and API contracts.<br>2. Respects D5 (one owner per concept: Library owns catalogue, Learning owns curriculum).<br>3. Allows general reference items not tied to a single program rung.<br>4. Clean, uncoupled database schema. | A resource present in both catalogue and curriculum has two metadata records (sharing same `media_id` binary). |
| **Option 2: Unified Resource Entity (Merged Model)** | Merge `LibraryItem` and `LearningContent` into a single unified table `resources` (or `educational_resources`). All level associations happen through a join table `resource_level_links`. Items with no level links are general catalogue items. | Single `resources` table. Join table `resource_level_links(resource_id, level_id, sort_order)`. Drop `learning_content` table. | Single source of truth for all educational assets.<br>No parallel metadata entities. | Breaks existing frozen frontend contracts (`Resource` vs `LearningContent`), requires extensive refactoring of repositories and API boundaries, contradicts settled separation in `12-decision-register.md`. |
| **Option 3: Decoupled Catalogue with Optional Curriculum Link (Hybrid)** | `LibraryItem` retains its descriptive `level` string, but gains an optional join table `library_item_levels(library_item_id, program_id, level_id)` or an optional `learning_content_id` FK, allowing library items to be optionally linked to curriculum levels. | `library_items`: `level VARCHAR(100) NULL`. Optional link table: `library_level_links(library_item_id, level_id)`. | Provides both broad catalogue search and optional curriculum association without breaking existing code. | Premature schema complexity before production requirements prove the need. |

### 7.4 Recommendation & Analysis

**Recommendation: Adopt Option 1 (Decoupled Catalogue with String Vocabulary).**
- **Authority & Precedent:** Both `PROP-LIB-01` and `12-decision-register.md` §2 explicitly record that the separation of *Library Resource* (catalogue) from *Learning Content* (curriculum) is settled and verified in the shipped model.
- **Harmony with O-01:** Since O-01 established that levels are strictly per-program, binding a general library catalogue row to a single `level_id` FK is structurally mismatched. `LibraryItem.level` serves as a human-readable pedagogical difficulty label, while formal progression gating belongs to `learning_levels` and `level_content_links`.
- **Zero frontend breaking changes:** Keeps the existing working implementations in `src/domains/library/` and `src/views/Library.tsx` intact without reopening the freeze.

### 7.5 What must NOT be implemented while O-02 awaits final ruling

- **No** `level_id` foreign key column added to the `library_items` table or migrations.
- **No** merging of `LibraryItem` and `LearningContent` into a single entity.
- **No** modification of `src/domains/library/types.ts` or `src/domains/learning/types.ts`.
- **No** backend Laravel migrations or models written.
