# 11 — Roadmap — Canonical Sequence F0..F10

> Goal/visible outcome/domains/deps/acceptance/tests/risks/backend impact/independent shippable dependency graph — one canonical sequence, minor hardening absorbed, not competing phase.

## Dependency Graph

```
Learning (programs/levels/content/links/placement/eligibility)
  → Resource eligibility (resolveEligibleContent owner learning/eligibility.ts)
    → Library (catalogue + media)
      → Student resource (student portal profile/classes/schedule/level/resources/progress/attendance)

RBAC (roles 5 perms 22 viewPermissions can() smallest)
  → Settings/Exports/Portal/Communication (guards, permission checks, scope self vs assigned vs org)

Theme (CSS vars --brand-* tokens + appearance device-local D2)
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

## Reusable Agile Definition of Done — F1..F10 — 15 items — KICKOFF CORRECTION

> One DoD reusable for all vertical slices F1..F10 — same 15 criteria, no new terminology — wording preserved from specification.

1. **Product behavior** — visible outcome genuinely functional in demo mode, not shell menus, honest states, no fabricated measurements, no hardcoded ActionSheet arrays, Finance honest deferral, palette→sheet focus ownership via shell lock + handingOff flag preserved.
2. **Domain model** — one owner per rule, one source per concept, no unjustified relations, ownership/source/relationship/lifecycle/seam documented in domain-map.
3. **Source of truth** — single authoritative dataset `DemoDataset` + `blobStore`, single authority `demoStore`, no duplicate fixtures, dissolved `src/data/` directory.
4. **Repository contract** — repo interface `get/list/create/update/remove` with explicit error kinds (`LINK_INVALID`, `COMPENSATION_FORBIDDEN`, `ATTENDANCE_STUDENT_NOT_ON_ROSTER`), no fixture counts, `relationsNoFixtures` gate.
5. **Demo behavior** — demo both modes disclosure via `DemoBackedNotice` for 11 domains, demo lifecycle, backup envelope versioned, environment label honest.
6. **API seam** — `getRepository` seam, demo vs `apiRepository`, binary client where needed, envelope `Collection/Item` `PageMeta`, `ApiClient` envelope.
7. **Permissions** — 5 roles 22 perms vocabulary preserved unless documented evidence requires change, `viewPermissions` + `can()` + `canAccessView`, no role id direct in components, no control if forbidden (M2 rule, not disabled).
8. **Ownership / scope** — self vs assigned vs org vs device, enrollment canonical Student↔Class edge, placement per program, provenance `recorderId`, per-object auth for media `D15`, identity linking `user_student_links`.
9. **Loading / empty / error states** — `LoadingState` role=status, empty honest Persian «داده‌ای نیست» / «منبعی نیست» / «تصویری نیست», `ErrorState` with retry owns message success only after resolve, no silent empty, failure disclosure `I15`.
10. **Test strategy** — pure unit `eligibility.test` / `can()` / scope `canRead`, integration repository refusal, view `routeProtection.test`, `relationsNoFixtures` / `schedulingNoFixtures` / `attendanceNoFixtures` / `compensationNoFixtures`, `noSuccessWithoutWrite`, `honestWriteCopy`, `m10Boundary`, `a11yGate`, `bundleBudget`, no weakening.
11. **Accessibility** — a11y RTL, `alt` required for gallery images, keyboard, focus ownership via shell lock + `handingOff` flag, `commandPaletteFocusReturn.test`, no fabricated.
12. **Persistence** — `demoStore` single authority, IndexedDB `blobStore` for bytes, no `localStorage` for binary, org vs device-local schema (branding org single record travels backups demo both modes, appearance device-local `localStorage` honest).
13. **Backend mapping** — B CONTRACT NOW BACKEND LATER, Laravel domain structure Sanctum cookie primary + bearer fallback `B1`, `org_id` scoping, transaction `SELECT FOR UPDATE`, signed expiring URLs, content-type sniffing, virus scanning, per-user read cursor.
14. **Documentation** — capability matrix, domain map, learning access policy, RBAC testable contract, library/gallery spec, settings/theme architecture, export architecture, dashboard analytics, integration architecture, roadmap canonical F0..F10, decision register unique IDs, open decisions register (`13-open-decisions.md`, historical F0 snapshot of 20 items — live `T-02` / `O-*` status is `GOVERNANCE_CHECKPOINT.md`), handoff checkpoint, README index, `PROJECT_STATE.md` `PHASES.md` `OPEN_ITEMS.md` `SESSION_HANDOFF.md` updated same branch/SHA/spec PR #4.
15. **Decision / open-decision disposition** — accepted `D1..D20` `B1` `NEW-LRN-01/LIB-01/GAL-01/SET-01/EXP-01/DASH-01/RBAC-01/PORTAL-01/CHAT-01/TG-01/BALE-01/MOB-01/CLASS-01` + 3 proposals `PROP-BRAND-01` draft preview `PROP-LIB-01` level string vs relation `PROP-THEME-01` viewer vs org accent naming, open `O-03(gallery)` plus, per the live [`GOVERNANCE_CHECKPOINT.md`](../engineering/GOVERNANCE_CHECKPOINT.md), KEEP OPEN `O-07`, `O-17`, `O-19`, `HELP` and the explicit residues inside accepted items (`O-13` credential factor; `O-10/O-11` uniqueness details and linking UX) — `O-08`, `O-09/O-20`, `O-14`, `O-16`, `O-18`, `O-15`, `PERF` are ACCEPT WITH CONDITIONS and `O-12`, `O-13`, `O-10/O-11` ACCEPTED, none of them open decisions (**O-01 DECIDED 2026-09-21 per-program**, **O-02 DECIDED 2026-09-21 descriptive string vocabulary**, neither open), `T-02` ACCEPTED / ASSIGNED-ONLY (active enrollment ∩ `class.teacherId`; do not revisit), no fake decision. *(Reconciled 2026-09-21 — the earlier “high-cost 5 … before backend” and “T-02 OPEN EVIDENCE CONFLICTING” wording predated the checkpoint.)*

> **Canonical 15 names exact — for validation:** Product behavior, Domain model, Source of truth, Repository contract, Demo behavior, API seam, Permissions, Ownership/scope, Loading/empty/error states, Test strategy, Accessibility, Persistence, Backend mapping, Documentation, Decision/open-decision disposition — 15 items exact match required per spec — no new terminology — wording preserved where found — spaced variants above map to exact names.

## Canonical Sequence — F0..F10

### F0 — Documentation/state closure — ✅ COMPLETE

- **Goal:** close planning, freeze intentionally reopened for frontend product completion, canonical engineering docs point same active branch/SHA/spec
- **Visible outcome:** 14 docs in docs/frontend-completion/ v14 @ e57bf19 planning checkpoint + corrections + SHA semantics corrections + F1-KICKOFF CORRECTION — updated docs/engineering/ PROJECT_STATE.md PHASES.md OPEN_ITEMS.md SESSION_HANDOFF.md with machine-readable CONTINUE HERE section — BEFORE = a251e6942b2a645987286de6e822607554e84df9, AFTER = new correction commit (to be), PLANNING_CHECKPOINT = e57bf1922e4ca3b80796715028445cfe8a077c9c = e57bf19, PREVIOUS_PLANNING_CHECKPOINT = c244fec142fcc35faff8e8548c8ebbc05cb53bf5 = c244fec, CURRENT_BRANCH = arena/frontend-completion-spec, CURRENT_HEAD = a251e6942b2a645987286de6e822607554e84df9 before this correction (actual Git HEAD), PR #4 docs-only OPEN not merged — do NOT call e57bf19 the current Git HEAD — PLANNING_CHECKPOINT remains last planning checkpoint — SHA semantics no longer ambiguous after correction
- **Domains:** all — audit only
- **Dependencies:** none — read-only reconstruction
- **Acceptance:** 01-audit-reconstruction VERIFIED/DOCUMENTED/INFERRED/OPEN, 02-capability-matrix with A/B/C classification evidence-based, 03-domain-map ownership/source/relationship/lifecycle/seam, 04-learning-access-policy canonical Level N=>1..N owner learning/eligibility.ts scope OPEN global vs per-program vs per-instrument do not invent, 05-rbac-access-control testable authorization contract Actor/Action/Resource/Scope/Allowed/DENIED/Reason/Frontend guard/Backend enforcement covering 11 sensitive cases, 06-library-gallery-spec genuine vs shallow, 07-settings-theme-architecture org vs device-local, 08-export-architecture reusable, 09-dashboard-analytics no fabricated Raw->Derivation->Insight->Visualization->Export, 10-integration-architecture Core API->Auth+RBAC->Domain Services->Adapters Telegram/Bale/Mobile/Web Media abstraction Telegram backup REQUIRED not deferred unless product needs correction, 11-roadmap canonical F0..F10, 12-decision-register unique IDs, 13-open-decisions 20 items high-cost 7, 14-handoff-checkpoint, README index, PROJECT_STATE.md PHASES.md OPEN_ITEMS.md SESSION_HANDOFF.md updated same branch/SHA/spec PR #4 F0 complete F1 next, no src/tests/package/Laravel/backend/migration/protected branch/history rewrite
- **Tests:** no src/tests changes — docs-only — safety gate passes
- **Risks:** none — docs-only
- **Backend impact:** none — docs-only, backend intentionally deferred
- **Independent shippable:** yes — docs-only PR #4
- **Classification:** A docs-only — DONE
- **NEXT ACTION after F0:** F1 — not implemented during F0 correction pass

### F1 — Learning + Level Access + Library + Gallery — NEXT ACTION (exactly ONE canonical next slice)

- **Goal:** canonical learning rule enforced genuinely functional, library genuinely functional, gallery genuine vs shallow audited + upload
- **Visible outcome:** Student Level 3 sees levels 1..N eligible, N+1+ locked with reason «در سطح X باز می‌شود» + lock icon no preview no download, not_visible hidden from students, not_found honest, not_applicable empty «هنوز در برنامه‌ای قرار نگرفته»; library filter chips type/level/visibility/instrument + search title/composer/teacher + sort added/uses/title + preview real bytes via objectUrl + locked honest reason + metadata all fields + workflows empty/loading/error/demo persistence API seam; gallery albums genuine if images>0 backed by media metadata title/description/coverMediaId/sortOrder/createdAt filtering by album ordering sortOrder visibility all demo storage seam metadata dataset blobStore + upload UI via media seam two writes Media.create+GalleryImage.create
- **Domains:** learning/eligibility.ts (owner), learning/types + demoRepository + LevelContentPanel, library/types + useLibrary + Library view, gallery/types + useGallery + GalleryPanel, media/types + useMediaObjectUrl + blobStore, instruments/catalog
- **Dependencies:** none (leaf) — D5 ownership, D10 attach intent guard programId independent, D11 derive selection
- **Minor hardening absorbed (not competing phase):**
  - Classes deep-link get(id) authoritative beyond 200 — absorb into F1 as part of relation plumbing (same pattern as students/teachers) — fix capped find at src/views/Classes.tsx:678
  - pagination/per_page mitigation — state ceiling, counts from total, truncation disclosed «N ردیف از M» — absorb into F1 (library/gallery lists + learning lists) — I16 mitigation, not closure
  - media one-frame issue useLibraryFile/useMediaObjectUrl — absorb into F1/F2 — fix one-frame exposure where previous asset/blob/object URL shown for one frame
- **F1 Dispositions — KICKOFF CORRECTION — VERIFIED (4 items):**
  - **Library detail view:** resource detail must be in F1 as preview/detail in same surface (Library view) — preview via `useLibraryFile` + `useMediaObjectUrl` real bytes, metadata all fields, locked honest reason — route/deep-link independent NOT decided in this correction unless already decided in spec — keep same surface, no new route invented.
  - **Publication status:** use existing semantics `active` / `visibility` (`students` / `teachers`) from `LearningContent` — publication workflow independent currently to decision gate/deferred workflow — do NOT invent new workflow — keep `active` boolean + `visibility` enum, workflow gate OPEN.
  - **Inactive / archived student:** eligibility status for inactive/archived student explicitly recorded as OPEN — evidence insufficient for definitive decision — if student status inactive/archived, eligibility remains OPEN decision — do NOT fabricate fake decision — keep OPEN, to be resolved before backend schema — disposition OPEN.
  - **Gallery seed:** seed real `learningSeed.ts` read-only verified — `deriveGalleryAlbums()` returns 2 albums (`alb_recital` «کنسرت پایان ترم», `alb_rooms` «فضای آموزشگاه»), `deriveGalleryImages()` returns 0 images — expected **2 albums, 0 images** — VERIFIED via `src/domains/demo/learningSeed.ts:258-278` — not guess — documented as VERIFIED.
- **Acceptance:**
  - Learning: Level N => 1..N eligible, exclusive exact-only, not_visible hidden from students, not_found honest, not_applicable empty, one content linked to several reachable levels emitted once lowest, sort levelOrder asc sortOrder asc title fa locale, attach with mismatched programId refused LINK_INVALID writes nothing no eligibility change, detach guarded future or mitigated derived selection, sortOrder honored student-side and visible operator, scope **DECIDED 2026-09-21 per-program (O-01)** — per instrument/program independent, placement per (student, program), global and per-instrument rejected
  - Library: search title/composer/teacher, filter kind/instrument/level/visibility, sort added/uses/title, preview objectUrl, locked honest, metadata title/composer/kind/instrument/level/size/duration/pages/added/uses/peaks/createdAt authoritative added derived, workflows empty «منبعی نیست» loading LoadingState role=status error ErrorState with retry owns message success only after resolve, demo persistence resources collection + blobStore single authority demoStore, API seam getLibraryRepository demo both modes apiRepository exists but unregistered binary client needed, create upload via media first then library two writes, download real bytes genuine, no fabricated URL, per_page disclosure — **detail view in same surface per F1 disposition**
  - Gallery: albums genuine if images>0 backed by media, metadata complete title non-empty description coverMediaId fallback first image sortOrder contiguous createdAt ISO, filtering by album, ordering sortOrder asc then createdAt, visibility all demo (or permission if added), storage seam metadata dataset galleryAlbums galleryImages + bytes blobStore via media, alt required a11y, empty «تصویری نیست» honest, no fabricated figures M10, upload UI via media seam — **seed VERIFIED 2 albums 0 images per F1 disposition**
  - Minor hardening: Classes deep-link get(id) authoritative beyond 200 works, counts from total, truncation disclosed, pagination per_page explicit, media one-frame no sync revoke
  - **Publication status disposition:** use existing `active`/`visibility` semantics, workflow gate deferred — no new workflow invented per F1 disposition
  - **Inactive/archived student disposition:** eligibility for inactive/archived OPEN — evidence insufficient — no fake decision per F1 disposition
- **Tests:** eligibility.test pure 17 cases, LevelContentPanel.test 12 + contentAssignmentFlow.test 5 + attachContentIntent.test 15, library filter/sort/preview tests, gallery genuine tests + GalleryAlbumSwitch.test, classesRelations deep-link test, no fixture counts, relationsNoFixtures gate, noSuccessWithoutWrite, honestWriteCopy
- **Risks:** Library.level string vs relation decision O-02 DECIDED 2026-09-21 (descriptive string vocabulary, no FK to learning_levels); Gallery seed albums existence needs verification; Scope O-01 DECIDED per-program (ratified)
- **Backend impact:** none demo only for F1, but contracts documented for future — levelId vs string, visibility field, storage provider S3/MinIO signed URLs per-object auth scanning uses increment transaction — B contract now backend later but REQUIRED? Actually library/gallery storage REQUIRED but implementation deferred until backend/integration layer
- **Independent shippable:** yes — demo data only, no API change, no backend
- **Classification:** A FRONTEND-COMPLETABLE NOW — NEXT ACTION Implement F1
- **NEXT ACTION:** Implement F1 — Learning + Level Access + Library + Gallery — do NOT implement during this correction pass (this doc is F0)

### F2 — RBAC + Ownership/Scope + Error Disclosure

- **Goal:** RBAC matrix becomes testable authorization contract, smallest permission model, UI guards no control if forbidden, error states owned, ownership/scope self vs assigned vs org clarified
- **Visible outcome:** Teacher without schedule.write sees no reschedule/cancel/generate/compensation writes; accountant sees finance not library; export buttons hidden if no read perm; every list consumer shows ErrorState with retry not silent empty; student→own profile ALLOWED self, student→another DENIED, student→eligible ALLOWED, student→locked DENIED locked UI, teacher→assigned ALLOWED, teacher→unassigned ALLOWED currently DENIED desired (document both), teacher→attendance assigned ALLOWED, teacher→compensation DENIED, staff operational ALLOWED, manager org-wide ALLOWED, administrator org administration ALLOWED — 11 required cases covered
- **Domains:** auth/permissions.ts (5 roles 22 perms preserve vocab unless evidence requires documented change), auth/types, students/teachers/classes/enrollments/learning/placement/scheduling/attendance/compensation/chat/media/export, all list hooks useResource/useDerived
- **Dependencies:** RBAC vocab preserved, D1 deferred student role separate app but contract now testable, O-01 DECIDED per-program (per-program/instrument independent placement key (student, program)), O-08 file ownership, O-10 identity linking, O-14 org/user relation
- **Minor hardening absorbed:** pagination per_page mitigation remaining consumers + media one-frame remaining → F2 (I15 error discarding 14 consumers, I16 per_page ceiling remaining, I13 view-boundary 3 readers)
- **Acceptance:** Matrix Actor/Action/Resource/Scope/Allowed/DENIED/Reason/Frontend guard/Future backend enforcement exists testable, 5 roles 22 perms unchanged unless decision with evidence, self vs assigned vs org scope documented, users/roles/permissions/ownership/scope clarified, UI/route/action guards via can() canAccessView no role id direct, backend enforcement UX-only stated, export checks can(), scope pure functions canRead(actor,resource,scope) unit tested, test plan unit/integration/view/E2E future backend 403 with reason, 11 sensitive capabilities explicitly covered S-01..S-04 T-01..T-04 ST-01 M-01 A-01 + X-01..X-11 cross-cutting
- **Tests:** routeProtection.test real route #/compensation admin reaches no silent Dashboard fallback role without schedule.read refused, can() unit, scope pure functions, error disclosure for 14 remaining consumers useRooms etc (I15), export permission hidden, teacher assigned vs unassigned, student self vs other, attendance write assigned vs unassigned, compensation write teacher vs staff
- **Risks:** Teacher sees all students org-wide currently — T-02 is ACCEPTED / ASSIGNED-ONLY per `GOVERNANCE_CHECKPOINT.md` (teacher student-read = active enrollment ∩ `class.teacherId`; fail-closed; do not revisit) — enrollment-based filtering is required, historical ALLOWED org-wide evidence is preserved only as history; Compensation client-side permission server must re-derive D19; Media resolution != auth D15
- **Backend impact:** server must enforce org_id + permission + scope on every endpoint + per-object auth for media + transaction for scheduling/attendance/compensation + signed URLs + scanning + per-user read cursor + identity linking — B REQUIRED but implementation deferred until backend/integration layer
- **Independent shippable:** yes — doc + UI guards A, backend B
- **Classification:** A doc + UI guards NOW, B backend enforcement LATER — REQUIRED PRODUCT CAPABILITY for authz

### F3 — Settings + Theme Editor

- **Goal:** WordPress-customizer-like academy identity name/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local schema
- **Visible outcome:** BrandingPanel has reset to DEFAULT_BRANDING, draft preview before save (local preview container writes CSS vars to preview only not document until save) — proposal PROP-BRAND-01 optional, appearance device-local stays per D2, org vs device schema doc, academyName/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence
- **Domains:** branding/types + useBranding + BrandingPanel + BrandingApplication + index.css tokens, settings/Settings.tsx appearance prefs savePref localStorage ava:theme etc, media logo/favicon mediaId ref never data URL, ds primitives
- **Dependencies:** branding types already, D2 viewer vs org split
- **Acceptance:** academy identity name/tagline/logo/color system typography light/dark tokens CSS vars --brand-* fallback pre-branding, editable defaults validation hex strict #RRGGBB font allow-list PERSIAN_FONTS, preview live (draft preview container optional), reset to defaults, persistence org vs device-local schema (branding org single record travels backups demo both modes, appearance device-local localStorage honest), disabled controls notifications 7 toggles localization 6 selects session-rules 4 inputs working-hours expanded Friday toggle disabled — all disabled with explicit deferral Surfaces honest, Toggle disabled prop exists, application below lifecycle gate above AuthProvider so login outside shell branded too, Sidebar/Login read branding.academyName/tagline, Hero uses useBranding + useAuth M10 no BrandingSettings persistence/schema change
- **Tests:** branding validation hex + font allow-list, CSS vars fallback, appearance localStorage, settingsHonesty.test 14 cases
- **Risks:** viewer accent vs org accent naming confusion O-04 — decision needed keep both clarified PROP-THEME-01, light theme deferred C, branding draft preview before save optional
- **Backend impact:** org table organizations + branding_settings + mediaId FK + signed URLs per-object auth — B contract REQUIRED but implementation deferred until backend/integration layer
- **Independent shippable:** yes
- **Classification:** A spec + reset + draft preview NOW, B org persistence LATER — org identity REQUIRED

### F4 — Export Engine

- **Goal:** reusable export mechanism column defs row transform locale encoding filter reuse filename permission demo vs server boundary usable by Students/Teachers/future reports
- **Visible outcome:** Students/Teachers/Classes/Enrollments already via buildExportTable explicit columns no leak + serializeTable csv/xlsx + downloadBlob seam EXPORT_LABELS Persian safeFilename + sensitive-field policy no credentials + formats csv/xlsx + txt for chat already, plus library/gallery/attendance/scheduling/compensation/dashboard tabular summary via same ExportDefinition pattern filter reuse from list view BOM for CSV Persian filename permission guard large-dataset disclosure
- **Domains:** export/exportService.ts, students/teachers/classes/enrollments/library/gallery/scheduling/attendance/compensation/dashboardInsights, lib/download.ts, lib/format.ts faNum
- **Dependencies:** repos list reads per_page 1000, filter state from views
- **Acceptance:** column defs explicit ExportColumn key header accessor no credential leakage, row transform locale encoding, filter reuse same as list view search/instrument/status etc, filename Persian UTF-8 safeFilename label YYYY-MM-DD format, permission frontend no control if no perm M2 rule backend 403, large-dataset client capped truncation disclosed «N ردیف از M» not silent, demo vs server boundary doc client blob vs server streaming Content-Disposition attachment, usable by future reports via pattern, CSV BOM for Persian Excel (chat export already has BOM, exportService csv needs BOM fix), RTL Persian headers Excel handles, no fabricated data reads repo only
- **Tests:** exportService tests csv bom, safeFilename, explicit columns no leak, filter reuse, permission hidden, truncation disclosed, spreadsheet bytes copy fresh ArrayBuffer not SharedArrayBuffer
- **Risks:** XLSX bytes copy, BOM missing currently OPEN, per_page 1000 ceiling I16
- **Backend impact:** server streaming endpoint GET /exports/{entity}?filters&format — B REQUIRED but implementation deferred until backend/integration layer
- **Independent shippable:** yes client exports work without backend
- **Classification:** A client NOW, B server streaming LATER — REQUIRED PRODUCT CAPABILITY

### F5 — Dashboard Analytics + Export

- **Goal:** analytical export NO fabricated measurements authoritative vs derived vs unavailable date-range filtering aggregation tabular summary reuse canonical calculation
- **Visible outcome:** Dashboard reads useAcademyMetrics hero + useDashboardInsights panels 5 reads per_page 500 bounded useSessions window, derivation pure dashboardInsights.ts meanOf/ratioPct/topBy empty null never NaN, figures traced at-risk count + mean attendance from student rows sessionsTotal>0, sessions/cancellations + weekly series from bounded useSessions window, overdue payments + waitlists from students/classes, today's rows class/room/teacher labels seeded room clash from sessions/classes/rooms/teachers reads, receivables from Student.balance, roster growth from Student.since, occupancy from class seats + stored weekdays, instrument mix from Student.instrument, record counts from entity totals, fixture sources removed signals growthSeries revenueSeries occupancy instruments quickActions todayFlowIds attentionItems attentionQueue intelligenceCards no longer reach surfaces, EMPTY every panel «داده‌ای نیست» two measures no history NO_DATA glyphs no NaN/Infinity in text or SVG attrs none of 24 retired fixture sentences or 5 retired fixture figures survive pinned by mutation with absurd fixture values, revenue chart removed because Finance/Reports README-only no seam no fabricated revenue D6/I2, guards Sparkline readonly number[]|null Delta number|null per-chart empty guard before index I9, date-range filter bar Jalali input presets today/week/month bounded window same as scheduling, tabular summary export csv/xlsx reuse dashboardInsights derivations no duplicate engine
- **Domains:** dashboardInsights, scheduling dateBridge, export, shared/stats, lib/format, ds primitives Sparkline Delta StatStrip Panel
- **Dependencies:** F4 export pattern
- **Acceptance:** Raw->Derivation->Insight->Visualization->Export no duplicate engine single source dashboardInsights.ts, figures traced to records map in M9 validation, EMPTY «داده‌ای نیست» not number, no NaN/Infinity in text or SVG, unavailable measures NO_DATA «—» not 0 not fabricated, date-range filtering reuse bounded window counts from total truncation disclosed, tabular summary reuse canonical calc via same functions not second math, no fabricated measurements enforced by dashboardInsightsLive.test + panelsEmpty.test + mutation with absurd values
- **Tests:** dashboardInsightsLive.test, panelsEmpty.test, seriesGuards.test, date-range filter bounded, export reuses same functions
- **Risks:** Finance/Reports still README-only revenue chart stays removed honest D6/I2, per_page 500 ceiling truncation disclosed
- **Backend impact:** server aggregation for large date-range, revenue seam when finance domain exists — B REQUIRED but implementation deferred until backend/integration layer
- **Independent shippable:** yes
- **Classification:** A NOW, B server aggregation LATER — REQUIRED PRODUCT CAPABILITY for analytics

### F6 — Chat + Tickets + Files

- **Goal:** tickets/chat/files topology auth ownership unread/read scope validation storage, media abstraction App->Media/File abstraction->Storage provider
- **Visible outcome:** Topology doc flat collections normalized thread order lastMessageAt, conversation list, composer conversation-keyed D16, attachments two writes Media.create+Chat.sendMessage D15, export single-conversation txt metadata only ceiling 1000 disclosed D14 no new verb no bytes, media one-frame fix A, provider seam spec
- **Domains:** chat/types + demoRepository + useChat + Messages view + messages/ composerTemplates, media/types + useMedia + useMediaObjectUrl, export/downloadBlob
- **Dependencies:** media allow-list size ceilings image jpeg/png/webp/gif SVG excluded XSS audio mp3/mp4/ogg/wav/webm doc pdf/txt
- **Acceptance:** auth messages.read/write, ownership userId+org_id future B, unread per conversation demo single-viewer + per-user cursor contract B, validation body max 4000 mediaId resolves, storage metadata dataset blobStore demo + S3/MinIO backend B signed expiring URLs content sniffing virus scanning, no fabricated URL, D14 no new verb D15 ref not auth D16 keyed write, composer state keyed by conversationId prevents cross-conversation leak, attachment two writes same conversation, export txt BOM metadata only
- **Tests:** chat composer keyed stateSafety.test, attachment two writes messagesAttachments.test, export txt BOM messagesConversationExport.test, media one-frame, no fixture, relationsNoFixtures, messagesNoFixtures gate
- **Risks:** Media resolution != auth backend must enforce D15, per-user read cursor not implemented
- **Backend impact:** media table + object storage + signed URLs + scanning + per-user read cursor table user_id conversation_id last_read_message_id unread count — B REQUIRED but implementation deferred until backend/integration layer
- **Independent shippable:** yes doc + frontend fixes A, backend B
- **Classification:** A topology + fixes NOW, B provider + cursor LATER — REQUIRED PRODUCT CAPABILITY

### F7 — Student Portal

- **Goal:** student portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity
- **Visible outcome:** Spec doc for portal architecture, identity linking table spec, scope pure functions self vs assigned vs org, demo vs backend identity doc, contract/UX preparation no UI yet for first product per D1 but contract now
- **Domains:** students, classes, enrollments, scheduling, learning/eligibility, progress, attendance, chat, media, auth, export
- **Dependencies:** RBAC scope self vs assigned vs org T-02 O-10 O-13 O-14 (O-01 DECIDED per-program ratifies placement per (student, program)), learning eligibility, library, media abstraction
- **Acceptance:** Student portal architecture doc profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files exists; scope self = linked studentId via user_student_links relation self/guardian, assigned = teacher's classes' students via enrollment, org = manager/admin all in org; demo single-viewer no per-user vs backend per-user read cursor actor from token org_id scoping per-object auth for files; identity linking table user_student_links (user_id, student_id, relation self/guardian, verified_at) + telegram_links bale_links; auth student portal separate app or separate view with self scope per D1 deferred — for first product contract only no UI, then separate app later keeps admin RBAC clean; no student role in admin panel D1 preserved no fake boundary
- **Tests:** scope pure functions unit canRead(actor,resource,scope) with enrollment/placement fixtures, identity linking validation, self vs other student, eligible vs locked
- **Risks:** Student role in admin panel vs separate app D1 — O-13 ACCEPTED (separate guard, same `users`; residue OPEN: credential factor), O-14 ACCEPT WITH CONDITIONS, O-10/O-11 ACCEPTED (residue OPEN: uniqueness details and linking UX) per `GOVERNANCE_CHECKPOINT.md` — their conditions/residues bind the schema before backend
- **Backend impact:** linking tables + self scope enforcement + per-user cursor + media signed URLs + Sanctum cookie primary + bearer fallback B1 — B REQUIRED but implementation deferred until backend/integration layer
- **Independent shippable:** yes as spec — no code
- **Classification:** B CONTRACT NOW BACKEND LATER (A for scope pure functions) — REQUIRED PRODUCT CAPABILITY but implementation deferred

### F8 — Telegram + Bale + Backup Integration Contracts

- **Goal:** Telegram backup = REQUIRED PRODUCT CAPABILITY, Telegram student access = REQUIRED, Bale student access = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile, no business logic in bots
- **Visible outcome:** Spec docs for Telegram backup adapter vs student access adapter different adapters not business owner, Bale adapter contract avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter interface, backup envelope versioned format migration retention/integrity/restore/encryption/failure OPEN marked, no business logic in bots
- **Domains:** chat/provider, demo/backup.ts, media, scheduling, learning, attendance, compensation, export, auth
- **Dependencies:** RBAC, media abstraction, student portal identity linking O-10 O-11, backup envelope I8, research I7
- **Acceptance:**
  - Telegram backup REQUIRED: BackupService → TelegramBackupAdapter → Telegram Bot API sendDocument with encryption org key backend-only never in React, retention how long Telegram keeps file OPEN I7 research, integrity hash sha256 stored alongside verified on restore, restore decrypt validate envelope environment migration accepts old envelopes WRONG_ENVIRONMENT honest, encryption PII minors must encrypt before sending to external provider backend-only key, failure Telegram unavailable → queued retry backoff honest status unavailable/failed with reason
  - Telegram student access REQUIRED: StudentTelegramAdapter vs BackupAdapter different adapters not business owner, flow student links Telegram account via student portal auth → bot verifies via code → student can query via bot commands /schedule /level /resources /progress /attendance /tickets each calls domain service with actor scope self linked studentId, no business logic in adapter adapter calls domain services domain services enforce RBAC + scope, identity linking user↔student↔telegram_id table telegram_links (user_id, student_id, telegram_chat_id, verified_at), no PII in Telegram logs no credentials in client rate limiting
  - Bale student access REQUIRED: same as Telegram but Bale API, common MessagingAdapter interface sendMessage, domain services own RBAC scope eligibility file resolution persistence not adapter, adapter only transmits, avoid duplicate logic per D5, provider enum already includes bale VERIFIED chat/types.ts status unavailable when no backend
  - Backup envelope versioned format: version field, migration accepts old envelopes, integrity hash optional, environment label fixed always demo I8 + validation, filename Persian UTF-8 safe, PII encryption needed if sent externally OPEN
- **Tests:** adapter interface mock, identity linking validation, scope pure functions, backup restore versioned migration old->new WRONG_ENVIRONMENT honest, no business logic in bot asserted via architectureBoundaries
- **Risks:** Telegram backup retention/encryption PII minors — O-09/O-20 ACCEPT WITH CONDITIONS per `GOVERNANCE_CHECKPOINT.md` (Telegram/Bale = notify ± encrypted secondary, not source of truth; retention numbers stay OPEN under O-19), research I7 missing, backup contains PII must encrypt backend-only, credentials backend-only never VITE_* localStorage, rate limits verification requirements unknown
- **Backend impact:** Bot API webhook, credential handling backend-only, encryption org key, queue retry, S3/MinIO, signed URLs — B REQUIRED but implementation deferred until backend/integration layer exists
- **Independent shippable:** yes as spec — no code
- **Classification:** B CONTRACT NOW BACKEND LATER — but REQUIRED PRODUCT CAPABILITY, not optional deferred unless product needs — wording corrected per review: Telegram backup = REQUIRED, Telegram student access = REQUIRED, Bale student access = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists

### F9 — Mobile Client Contract

- **Goal:** Mobile student client = REQUIRED PRODUCT CAPABILITY — mobile app client of same backend contracts, media/file abstraction -> storage provider
- **Visible outcome:** Contract doc for mobile auth bearer secure storage not localStorage, same API envelope Collection/Item PageMeta, same domain repos, same RBAC, media upload same endpoint, no second API
- **Domains:** all — registry mode-switched, ApiClient envelope, auth B1 Sanctum cookie primary + bearer fallback, media abstraction
- **Dependencies:** auth B1, media abstraction O-16, identity linking O-10 O-12, student portal O-13
- **Acceptance:** Mobile app uses same backend contracts no second API same RBAC same media seam same envelope, auth bearer token stored securely not localStorage, offline C deferred no fake, features same as web or subset teacher/student portal B contract, no new backend same Laravel domain structure B1
- **Tests:** contract tests envelope, auth bearer, media upload seam, no second API
- **Risks:** Offline queue C deferred no fake, secure storage vs localStorage
- **Backend impact:** same Laravel structure B1 — same as web + bearer secure storage — B REQUIRED but implementation deferred until backend/integration layer
- **Independent shippable:** yes as spec
- **Classification:** B CONTRACT NOW BACKEND LATER — but REQUIRED PRODUCT CAPABILITY — IMPLEMENTATION deferred until backend/integration layer exists

### F10 — Cross-Surface QA + Final Frontend Freeze

- **Goal:** cross-surface QA, final frontend freeze, no fabricated measurements, honest states, stable seam for future backend
- **Visible outcome:** All surfaces genuinely functional in demo mode, coherent domain model, honest states, no fixture fake states, no hardcoded ActionSheet arrays, Finance honest deferral D6/I2, palette→sheet focus ownership via shell lock + handingOff flag preserved M-1..M-6 D7 D9 intact, entry CSS gzip <273791? Actually final D9 values entry 108207 vendor 60108 total 298249 largest 108207 dist raw 1964789 no chunk ≥400k 2037 modules, typecheck 0 errors, focused suites green, full suite 2102 passed / 10 failed known historical projectState.test.ts SHA/branch expectation failures not regressions, browser QA checklist L4 external QA disposition if authorized, final freeze closure docs-only with measurements
- **Domains:** all
- **Dependencies:** F1..F9 complete
- **Acceptance:** Each important surface genuinely functional in demo mode not shell menus, correct learning/level/resource model Level3 access 1..3 not 4+ canonical rule owner learning/eligibility.ts, Library/Gallery behavior search/filter/sort/preview/locked/metadata genuine vs shallow, Settings/theme academy identity name/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local schema, exports students/teachers formats filters columns RTL Persian UTF-8 filename client vs backend permission large-dataset, dashboard analytical export NO fabricated authoritative vs derived vs unavailable date-range filtering aggregation tabular summary reuse canonical calculation, RBAC role+perm+ownership+scope self vs assigned vs org read/write UI/route/action guards backend enforcement UX-only testable contract, student portal architecture, tickets/chat/files topology auth ownership unread/read scope validation storage, Telegram/Bale/Mobile attach adapter architecture Core->Adapter->Telegram/Bale/Mobile/Web no business logic in bots, frontend now vs Laravel later, decisions locked before schema/API, resume capability via SESSION_HANDOFF machine-readable CONTINUE HERE without chat
- **Tests:** full suite 2102 + new F1..F9 tests, settingsHonesty, deepLinkPagination, failureDisclosure, metricsFailureDisclosure, commandPaletteFocusReturn, teacherPhoto, studentPhotoDisplay, navigationCounts, relationsNoFixtures, schedulingNoFixtures, attendanceNoFixtures, compensationNoFixtures, m10Boundary, a11yGate, bundleBudget, cspCompatibility, privacyPosture, projectState, emptyEnvironment, emptyEnvironmentPanels, routeProtection, loginEmptyEnvironment, loginDemoIsolation, dashboardInsightsLive, panelsEmpty, seriesGuards, dashboardInsights, etc — no weakening
- **Risks:** L4 external browser QA NOT VERIFIED until external QA environment authorized, L1 command palette substring loose, L2 dead code TeacherNote, L6 attendance header comment false claims 9 vs 8 and since M1 vs Phase A, L7 docs/architecture/demo-data.md dissolved src/data/ directory contradiction — all recorded not fixed docs-only
- **Backend impact:** none — final frontend freeze precedes Laravel/backend, backend intentionally deferred — same as historical freeze but with F1..F9 landed
- **Independent shippable:** yes — final freeze closure docs-only
- **Classification:** A final freeze — docs-only closure — after F1..F9
- **Validation:** no src/tests/package/Laravel/backend/migration/protected branch/history rewrite, decision IDs unique, canonical engineering docs point same active branch/SHA/spec, SESSION_HANDOFF can reconstruct continuation without chat

## Implementation Order — One Canonical Sequence

**F0 Documentation/state closure COMPLETE** → **F1 Learning + Level Access + Library + Gallery NEXT** → F2 RBAC + Ownership/Scope + Error Disclosure → F3 Settings + Theme Editor → F4 Export Engine → F5 Dashboard Analytics + Export → F6 Chat + Tickets + Files → F7 Student Portal → F8 Telegram + Bale + Backup integration contracts → F9 Mobile client contract → F10 Cross-surface QA + final frontend freeze

Absorb minor hardening items such as Classes deep-link get(id) authoritative, pagination per_page mitigation disclosure, media one-frame issue useLibraryFile/useMediaObjectUrl into appropriate slices F1/F2 rather than treating them as competing product phase.

**Exactly ONE canonical next implementation slice:** **F1 — Learning + Level Access + Library + Gallery** — do not implement during F0 correction pass.

## Principles Applied

- One owner per rule/source per concept — D5
- Vertical slices reversible — each slice demo-only or contract doc, no giant framework, no history rewrite
- Resolve high-cost decisions before coding — file ownership O-08, Telegram backup semantics O-09/O-20, identity linking O-10/O-11, student portal auth O-13, org/user relation O-14 are resolved at the policy level in `GOVERNANCE_CHECKPOINT.md` (O-08, O-09/O-20, O-14 ACCEPT WITH CONDITIONS; O-10/O-11 and O-13 ACCEPTED with explicit open residues: uniqueness details and linking UX; portal credential factor) — honour those conditions and close the named residues before the affected schema/API slice (O-01 DECIDED 2026-09-21 per-program, O-02 DECIDED 2026-09-21 descriptive string vocabulary; both removed from open list) *(reconciled 2026-09-21; the earlier “5 high-cost … before backend” count predated the checkpoint)*
- No fake backend — demo behaves like real API seams mirror real contracts server security independent
- Avoid premature abstraction/giant frameworks/deps — no new dependency
- Preserve a11y RTL protections explicit no-data — VERIFIED
- Classification correction: Telegram backup = REQUIRED PRODUCT CAPABILITY, Telegram student access = REQUIRED, Bale student access = REQUIRED, Mobile student client = REQUIRED — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile, no business logic in bots — wording "deferred unless product needs" corrected to REQUIRED
- Learning access scope DECIDED 2026-09-21 per-program (per instrument/program independent) — O-01 CLOSED — ratifies existing per-program implementation; global and per-instrument rejected; teacher exceptional resource access recorded as product behaviour (persistence model future decision, no schema invented)

## Risks Overall — Updated

- I13 view-boundary not closure — F2 fixes remaining 3 readers + 2 further exposures useLibraryFile/useMediaObjectUrl
- I16 per_page ceiling — F1/F2 mitigation disclosure counts from total truncation disclosed not removal — keeps stable
- I8 backup labels wrong environment always demo — F8 versioned format migration + REQUIRED backup capability
- L1/L2/L4/L6/L7 — C deferred or recorded not fixed, but internal tests guard, L4 external QA for F10
- Student portal identity linking — D1 ACCEPTED; O-10/O-11 and O-13 ACCEPTED per `GOVERNANCE_CHECKPOINT.md` with explicit residues OPEN (uniqueness details and linking UX; credential factor) to close before the linking/login schema — F7 resolves contract, backend later
- Library level string vs relation — decision O-02 DECIDED 2026-09-21 (descriptive string vocabulary, no FK to learning_levels)
- Telegram backup retention/encryption — O-09/O-20 ACCEPT WITH CONDITIONS per `GOVERNANCE_CHECKPOINT.md` (retention numbers OPEN under O-19), REQUIRED PRODUCT CAPABILITY but implementation deferred until backend/integration layer — not optional
- RBAC testable — F2 expands to testable contract covering 11 sensitive cases — no new permission vocab casually
