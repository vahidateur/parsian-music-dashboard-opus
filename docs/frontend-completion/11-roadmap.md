# 11 — Agile Roadmap — Vertical Slices

> Goal/visible outcome/domains/deps/acceptance/tests/risks/backend impact/independent shippable dependency graph

## Dependency Graph

```
Learning (programs/levels/content/links/placement/eligibility)
  → Resource eligibility (resolveEligibleContent)
    → Library (catalogue + media)
      → Student resource (student portal profile/classes/schedule/level/resources/progress/attendance)

RBAC (roles 5 perms 22 viewPermissions can() smallest)
  → Settings/Exports/Portal/Communication (guards, permission checks, scope self vs assigned vs org)

Theme (CSS vars --brand-* tokens + appearance device-local)
  → Settings UI (BrandingPanel + appearance)
    → org persistence (Laravel organizations table) + device-local (localStorage)

Communication (chat types/provider/status)
  → Tickets/Chat/Files (topology, ownership, unread/read, validation, storage)
    → Adapters (TelegramAdapter/BaleAdapter common MessagingAdapter interface)

Analytics (Raw demo collections / API)
  → Dashboard (Derivation pure dashboardInsights.ts + visualization)
    → Export (tabular summary reuse canonical calc, no duplicate engine)

Scheduling (sessions bounded from/to, conflicts, generation, roster)
  → Attendance (presence provider, roster, provenance, correction trail)
    → Compensation (scheduling+attendance composition, lineage, disclosure)

Media (metadata dataset + blobStore)
  → Library/Gallery/Students/Teachers/Branding/Chat (mediaId ref)

Demo (academySeed + lifecycle + backup envelope)
  → All demo-served domains (11) + DemoBackedNotice
```

## Slice 1 — Learning Eligibility + Library Hardening + Gallery Audit

- **Goal:** canonical learning rule enforced, library genuinely functional, gallery genuine vs shallow audited
- **Visible outcome:** Student Level 3 sees 1..3 locked 4+, library filter chips + sort + preview real bytes + locked reason, gallery upload via media seam
- **Domains:** learning/eligibility, library, gallery, media, instruments
- **Dependencies:** none (leaf)
- **Acceptance:** Level N => 1..N eligible, exclusive exact-only, not_visible hidden from students, not_found honest, not_applicable empty; library search title/composer/teacher, filter kind/instrument/level, sort added/uses/title, preview objectUrl, locked honest, metadata all fields; gallery albums genuine if images>0 backed by media, metadata title/description/cover/sortOrder/createdAt, filtering by album, ordering sortOrder, storage seam metadata+blobStore
- **Tests:** eligibility.test pure, library filter/sort/preview tests, gallery genuine tests, no fixture counts
- **Risks:** Library.level string vs relation decision — resolve before coding (keep string vocabulary D for now)
- **Backend impact:** none — demo only, but contract for future link table levelId vs string documented
- **Independent shippable:** yes — demo data only, no API change
- **Classification:** A FRONTEND-COMPLETABLE NOW

## Slice 2 — RBAC Hardening + Settings Guards + Export Permission + Error Disclosure

- **Goal:** RBAC matrix documented, smallest permission model, UI guards no control if forbidden, export permission, error states owned
- **Visible outcome:** Teacher without schedule.write sees no reschedule/cancel/generate/compensation writes; accountant sees finance not library; export buttons hidden if no read perm; every list consumer shows ErrorState with retry not silent empty
- **Domains:** auth/permissions, settings/branding, export/exportService, all list hooks
- **Dependencies:** RBAC vocab preserved
- **Acceptance:** Matrix Actor/Action/Resource/Scope/Allowed/Reason/Frontend guard/Backend enforcement exists, 5 roles 22 perms unchanged unless decision, self vs assigned vs org scope documented, users/roles/permissions/ownership/scope clarified, UI/route/action guards via can() canAccessView no role id direct, backend enforcement UX-only stated, export checks can()
- **Tests:** routeProtection.test, can() unit, error disclosure for 14 remaining consumers (useRooms etc), export permission hidden
- **Risks:** Teacher sees all students org-wide — assigned scope decision needed, not silently implemented
- **Backend impact:** server must enforce org_id + permission + scope on every endpoint — B
- **Independent shippable:** yes
- **Classification:** A doc + UI guards NOW, B backend enforcement LATER

## Slice 3 — Theme Token Architecture + Settings Branding Reset

- **Goal:** WordPress-customizer-like academy identity, tokens editable defaults validation preview reset persistence org vs device-local schema
- **Visible outcome:** BrandingPanel has reset to DEFAULT_BRANDING, draft preview before save (local preview container writes CSS vars to preview only), appearance device-local stays, org vs device schema doc
- **Domains:** branding, settings, appearance prefs, media
- **Dependencies:** branding types already
- **Acceptance:** academyName/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local schema doc (07), hex strict font allow-list, CSSOM only style-src self, no data URL, branding application below lifecycle gate above AuthProvider, Sidebar/Login branded, preview live, reset works
- **Tests:** branding validation hex + font allow-list, CSS vars fallback, appearance localStorage
- **Risks:** viewer accent vs org accent naming confusion — decision needed, keep both clarified
- **Backend impact:** org table organizations + branding_settings + mediaId FK, signed URLs — B
- **Independent shippable:** yes
- **Classification:** A spec + reset + draft preview NOW, B org persistence LATER

## Slice 4 — Export Reusable Mechanism

- **Goal:** reusable export column defs row transform locale encoding filter reuse filename permission demo vs server boundary usable by Students/Teachers/future reports
- **Visible outcome:** Students/Teachers/Classes/Enrollments already, plus library/gallery/attendance/scheduling/compensation/dashboard tabular summary export via same ExportDefinition pattern, filter reuse from list view, BOM for CSV, Persian filename, permission guard, large-dataset disclosure
- **Domains:** export/exportService, students/teachers/classes/enrollments/library/gallery/scheduling/attendance/compensation/dashboardInsights
- **Dependencies:** repos list reads
- **Acceptance:** column defs explicit no credentials, row transform locale encoding, filter reuse, filename Persian UTF-8 safeFilename, permission frontend no control if no perm backend 403, large-dataset client capped with truncation «N از M» disclosed not silent, demo vs server boundary doc (client blob vs server streaming), usable by future reports via pattern
- **Tests:** exportService tests csv bom, safeFilename, explicit columns no leak, filter reuse, permission hidden, truncation disclosed
- **Risks:** XLSX bytes copy fresh ArrayBuffer — ensure not SharedArrayBuffer leak — VERIFIED
- **Backend impact:** server streaming endpoint GET /exports/{entity}?filters&format with Content-Disposition — B
- **Independent shippable:** yes — client exports work without backend
- **Classification:** A client NOW, B server streaming LATER

## Slice 5 — Dashboard Analytics Export + Date-Range Filtering

- **Goal:** analytical export NO fabricated measurements authoritative vs derived vs unavailable date-range filtering aggregation tabular summary reuse canonical calculation
- **Visible outcome:** Dashboard has date-range filter bar (Jalali input presets today/week/month) bounded window same as scheduling, tabular summary export csv/xlsx reuse dashboardInsights derivations, NO_DATA where unavailable, no revenue chart until seam
- **Domains:** dashboardInsights, scheduling dateBridge, export, shared/stats
- **Dependencies:** Slice 4 export pattern
- **Acceptance:** Raw->Derivation->Insight->Visualization->Export no duplicate engine, figures traced to records, empty «داده‌ای نیست», no NaN/Infinity, unavailable measures NO_DATA not 0 not fabricated, date-range filtering reuse bounded window counts from total truncation disclosed, tabular summary reuse canonical calc
- **Tests:** dashboardInsightsLive.test, panelsEmpty.test, date-range filter bounded, export reuses same functions not second math
- **Risks:** Finance/Reports still README-only — revenue chart stays removed honest — D6/I2
- **Backend impact:** server aggregation for large date-range — B
- **Independent shippable:** yes
- **Classification:** A NOW, B server aggregation LATER

## Slice 6 — Tickets/Chat/Files Topology + Media Abstraction Provider Seam

- **Goal:** tickets/chat/files topology auth ownership unread/read scope validation storage, media abstraction App->Media/File abstraction->Storage provider
- **Visible outcome:** Topology doc, conversation list order by lastMessageAt, composer conversation-keyed D16, attachments two writes Media.create+Chat.sendMessage D15, export single-conversation txt metadata only ceiling 1000 disclosed D14, media one-frame fix A, provider seam spec
- **Domains:** chat, media, export
- **Dependencies:** media types allow-list size ceilings
- **Acceptance:** auth messages.read/write, ownership userId+org_id future, unread per conversation demo single-viewer + per-user cursor contract B, validation body max 4000 mediaId resolves, storage metadata dataset blobStore demo + S3/MinIO backend B signed expiring URLs content sniffing virus scanning, no fabricated URL, D14 no new verb D15 ref not auth D16 keyed write
- **Tests:** chat composer keyed, attachment two writes, export txt BOM, media one-frame, no fixture
- **Risks:** Media resolution != auth — backend must enforce — D15
- **Backend impact:** media table + object storage + signed URLs + scanning + per-user read cursor table — B
- **Independent shippable:** yes doc + frontend fixes A, backend B
- **Classification:** A topology + fixes NOW, B provider + cursor LATER

## Slice 7 — Student Portal + Telegram/Bale/Mobile Contracts

- **Goal:** student portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity, Telegram backup vs student access different adapters not business owner, Bale adapter contract avoid duplicate logic Core->Adapter->Telegram/Bale, Mobile app client of same backend contracts
- **Visible outcome:** Spec docs for portal, adapters, mobile — no UI yet but contract/UX preparation, identity linking table spec, scope pure functions
- **Domains:** students, classes, scheduling, learning, progress, attendance, chat, media, auth, export
- **Dependencies:** RBAC scope self vs assigned vs org, learning eligibility, library
- **Acceptance:** Student portal architecture doc profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files demo vs backend identity exists; Telegram backup vs student access different adapters documented; Bale adapter contract Core->Adapter->Telegram/Bale avoids duplicate logic via common MessagingAdapter; Mobile app client of same backend contracts; integration boundary Core API->Auth+RBAC->Domain Services->Adapters + Media abstraction + Telegram backup retention/integrity/restore/encryption/failure OPEN marked
- **Tests:** scope pure functions unit, identity linking validation, adapter interface mock
- **Risks:** Student role in admin panel vs separate app D1 — decision needed before schema
- **Backend impact:** student↔user linking, telegram_links, per-user cursor, org_id, Sanctum cookie + bearer, media signed URLs — B
- **Independent shippable:** yes as spec — no code
- **Classification:** B CONTRACT NOW BACKEND LATER (A for scope pure functions)

## Slice 8 — Frontend Completeness Hardening (Classes Deep-Link + Paged + Compensable Seed + Media One-Frame)

- **Goal:** genuinely functional now — no capped find, no silent ceiling, seeded compensable case, media one-frame fix
- **Visible outcome:** Classes deep-link get(id) authoritative same as students/teachers; useStudentList Paged<> + PAGE_SIZE_CALLERS inclusion + per_page explicit I16 mitigation; seeded compensable case in demo seed (demo data only); useLibraryFile/useMediaObjectUrl one-frame exposure fix
- **Domains:** classes, students, scheduling, attendance, compensation, media, library
- **Dependencies:** none
- **Acceptance:** Deep-link beyond 200 works via get(id), counts from total, truncation disclosed «N از M», seeded case has originalSession cancelled + student on roster + attendance exists? Actually compensable requires session exists + student on roster via enrollment + attendance present? For demo, seed a case where session cancelled but roster still? Or session present + attendance? For compensation register, need eligible obligation? The seeded case should be an obligation in register? Or at least a scenario where register returns eligible? Simpler: seed an obligation already registered with status registered and studentOnRoster true — via demo seed — no prod logic
- **Tests:** deep-link tests for classes, per_page explicit tests, compensable seed exists, media one-frame no sync revoke
- **Risks:** per_page 200 ceiling still — mitigation disclosure not removal — keeps stable
- **Backend impact:** none — demo seed only
- **Independent shippable:** yes
- **Classification:** A NOW

## Slice 9 — Backup Envelope Versioned Format

- **Goal:** backup envelope versioned, migration, retention/integrity spec
- **Visible outcome:** Backup format has version field, migration accepts old envelopes, integrity hash optional, environment label fixed (always demo I8) + validation, filename Persian UTF-8 safe
- **Domains:** demo/backup
- **Dependencies:** demo lifecycle
- **Acceptance:** Versioned format doc, migration path, retention/integrity/restore/encryption/failure OPEN marked, no fabricated environment
- **Tests:** backup restore versioned, migration old -> new, WRONG_ENVIRONMENT honest
- **Risks:** Backup contains PII minors — encryption needed if sent externally — OPEN
- **Backend impact:** server backup endpoint + encryption + retention — B
- **Independent shippable:** yes
- **Classification:** B CONTRACT NOW (versioned format) — implementation A for versioned change demo only

## Slice 10 — Mobile App Client Contract

- **Goal:** mobile app client of same backend contracts, media/file abstraction -> storage provider
- **Visible outcome:** Contract doc for mobile auth (bearer secure storage), same API envelope Collection/Item PageMeta, same domain repos, media upload same endpoint
- **Domains:** all
- **Dependencies:** auth B1, media abstraction
- **Acceptance:** Mobile app uses same backend, no second API, same RBAC, same media seam, offline C deferred
- **Tests:** contract tests for envelope, auth bearer, media upload seam
- **Risks:** Offline queue C deferred — no fake
- **Backend impact:** same Laravel domain structure — B1 decision
- **Independent shippable:** yes as spec
- **Classification:** B CONTRACT NOW

## Implementation Order (Priority Frontend-Usable)

1. Slice 8 hardening (quick wins, no decisions)
2. Slice 1 learning+library+gallery (core functional)
3. Slice 2 RBAC+error disclosure (security UX)
4. Slice 3 theme token + reset (UX)
5. Slice 4 export reusable (value)
6. Slice 5 dashboard date-range + export (analytics)
7. Slice 6 chat/files topology + media seam (communication)
8. Slice 9 backup envelope (data integrity)
9. Slice 7 portal + adapters contracts (integration)
10. Slice 10 mobile contract (client)

## Principles Applied

- One owner per rule/source per concept — D5
- Vertical slices reversible — each slice demo-only or contract doc, no giant framework
- Resolve high-cost decisions before coding — D1 student role, library level relation, viewer vs org accent, ticket vs chat distinction, Telegram backup semantics
- No fake backend — demo behaves like real API seams mirror real contracts
- Server security independent — frontend UX-only
- Avoid premature abstraction/giant frameworks/deps — no new dependency
- Preserve a11y RTL protections explicit no-data — VERIFIED

## Risks Overall

- I13 view-boundary not closure — Slice 2 fixes remaining consumers
- I16 per_page ceiling — Slice 8 mitigation disclosure
- I8 backup labels wrong — Slice 9 fixes versioned format
- L1/L2/L4 external QA — C deferred, but internal tests guard
- L6/L7 fixtures — removed, gates prevent regression
- Student portal identity linking — high-cost decision D1 before schema — Slice 7 resolves
- Library level string vs relation — decision needed before backend schema — Slice 1 resolves
- Telegram backup retention/encryption — OPEN, C deferred unless product needs
