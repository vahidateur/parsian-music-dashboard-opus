# 02 — Capability Matrix

> Columns: Capability / route / domain owner / repo / demo / API / functionality level / gaps / frontend-completable / backend dep / security / dependencies / phase / acceptance

## Navigation Destinations

| Capability | Route hash | Domain owner | Repo (demo/api) | Demo | API | Func level | Gaps | Frontend completable? | Backend dep | Security | Deps | Phase | Acceptance |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | #/dashboard | shared/dashboardInsights | demo only | ✅ seeded | ❌ | LIVE — derived from records M9, empty guards I9 | No analytical export, date-range filter missing, revenue chart removed (no seam) | A — export tabular summary reusable, date-range UI filter now | Large-range server aggregation | NO_DATA honesty, no fabricated | students/classes/rooms/teachers/scheduling | M9 COMPLETE, export follow-up A | Figures traced to records, EMPTY «داده‌ای نیست», no NaN |
| Students | #/students | students | demo+api | ✅ | ✅ | LIVE — list/get/create/update/archive, relations via enrollment, deep-link get(id) authoritative | per_page 200 ceiling I16, useStudentList not Paged<> nor in PAGE_SIZE_CALLERS, no self scope | A — per_page disclosure already, deep-link DONE M-5 | Org isolation, search server | RBAC students.read/write UX-only, no fake success | enrollments/classes/teachers/rooms/learning/progress | M7 COMPLETE | List no fixture, roster from enrollment, photo via media, deep-link beyond 200 |
| Teachers | #/teachers | teachers | demo+api | ✅ | ✅ | LIVE — list/get/create/update, relations, photo | Same ceiling | A — same | Org isolation | Same | classes/rooms/students | M7 COMPLETE | Same |
| Classes | #/classes | classes | demo+api | ✅ | ✅ | LIVE — list/get/create/update/archive, roster from enrollment, seat/waitlist from bounded read | Deep-link capped list find without get(id) — deferred at freeze (678), ceiling | A — deep-link get(id) same as students/teachers NOW | Org isolation | Same | teachers/rooms/enrollments/students | M7 COMPLETE, deep-link gap A | Roster from enrollment not studentIds, occupancy honest, deep-link authoritative |
| Scheduling | #/schedule | scheduling | demo both modes | ✅ | ❌ apiRepository exists but unregistered | LIVE — reads bounded from/to, writes reschedule/cancel/generation awaited, conflict guard | 5 verbs unconsumed (get/create/update/delete/sessionRoster), recurrence-scoped write missing, no free-slot search | A — create/edit surface could be added frontend (B? but create would bypass invariants) — CLASSIFY B CONTRACT NOW | Transactional conflict enforcement, presence provider fail-safe | D11 derive selection, D10 independent intent | rooms/teachers/classes/attendance presence | M4 COMPLETE | No fixture imports, bounded window, counts from total, truncation withheld day counts |
| Attendance | #/attendance | attendance | demo both modes | ✅ | ❌ | LIVE — reads 7 bounded, writes record/bulkRecord/correct awaited, provenance auth principal, RBAC gate, correction trail | No un-record/edit/delete (append-only by design), no academy-wide rate (removed honest), I13 mitigation view-boundary not closure, no per-student longitudinal | A — longitudinal history could be frontend table from records NOW (no server) | Backend aggregation, per-object auth | D13 derive selection + own register, D12 error own message, no notification | scheduling/students/classes/teachers | M5 COMPLETE | No fixture, 7 per_page explicit, truncated announced, forbidden retired narratives |
| Compensation | #/compensation | compensation | demo both modes, no apiRepo | ✅ no seeded case | ❌ | LIVE — domain 121 tests, surface secretary, lineage via currentAttempt.sessionId, disclosure studentOnRoster per booking | No seeded compensable case, no apiRepo, no free-slot, group/class-wide refused by design, needsAttention no consumer | A — seeded case in demo seed NOW (demo data only) | Server enforcement, uniqueness transaction, free-slot | schedule.write gate client-side, server must re-derive | scheduling/attendance/students/classes | P1+UI COMPLETE, I18 PARTLY | Eligibility private only, prefill not booking, disclosure not gate |
| Finance | #/finance | finance (README-only) | none | ❌ | ❌ | DEFERRED — explicit Panel D6/I2, no domain read | No domain, no repo, no figures | C — DEFERRED per decision | Whole finance domain, money precision, idempotency, gateway | No fabricated figures | — | DEFERRED D6/I2 | Surface states «نیازمند سرور» |
| Reports | #/reports | reports (README-only) | none | ❌ | ❌ | DEFERRED — explicit Panel, dashboard insights is live analysis | Same | C — DEFERRED | Server aggregation | No fabricated | dashboardInsights | DEFERRED, M9 did not implement | States «نیازمند سرور», points to dashboard |
| Messages | #/messages | chat | demo both modes | ✅ | ❌ | LIVE — list/get/create/update/archived, composer conversation-keyed, attachments via media two writes, export single-conversation txt metadata only ceiling 1000, unread badge summed while complete | I15 fixed only at Messages.tsx site, rest 14 consumers discard error; I13 useMediaObjectUrl one-frame; no bulk export; no server persistence; no signed URL | A — bulk export txt (multiple conversations) could be frontend NOW (concatenated existing reads), error disclosure for all reads NOW (B? but error handling frontend) — CLASSIFY A for error states, B for server | Per-object auth, signed URLs, scanning, provider delivery | D14 no new verb, D15 ref not auth, D16 keyed write state | media/export | M6 COMPLETE | No fixture, honest missing bytes, download via export seam, no fabricated URL |
| Library | #/library | library | demo both modes, api declared | ✅ res1 demo only | ❌ | LIVE — list/get/create/update/delete? Actually repository has list/get/create/update/delete, view reads via useLibraryList, file via useLibraryFile, preview, download real bytes, counts derived | Filtering by type/level/visibility search — partially exists but level is string not relation, visibility filter not in UI, sort not explicit, preview limited, locked metadata workflow? | A — search/filter/sort/preview/locked/metadata workflows honest states NOW (frontend) | Binary storage S3, signed URLs, per-object auth, virus scan | D15 media seam, no fabricated download | media/instruments/learning | Phase1+M10 COMPLETE, hardening A | No fixture shelves count, missing bytes honest, no invented URL |
| Settings | #/settings | branding + demo/lifecycle + appearance prefs | demo both + localStorage prefs | ✅ | ❌ | LIVE — branding via BrandingRepository writes through repo, appearance theme device-local via savePref, lifecycle via demoDataManager, demo data panel | Theme token architecture needs spec (WordPress-customizer-like), org vs device-local schema, preview/reset persistence; notification/localization/working-hours/session-rules disabled deferral Surfaces — already honest | A — theme token spec + editable defaults validation preview reset org vs device schema doc NOW, branding already | Org branding table, theme org persistence decision | Hex color strict, font allow-list, CSSOM only style-src self | branding/demo | M8 COMPLETE, M-6 honesty CLOSED | Branding applied via CSS vars fallback, appearance localStorage honest, disabled controls state non-disabled? Actually disabled prop |
| Design System | #/design-system | ds | — | — | — | LIVE — catalogue of primitives/patterns, samples plated config | Samples use fixture samples but as showcase — legitimate per D5 D | A — already | — | — | — | M10 COMPLETE | Samples owned by ds/samples.ts not data module |

## Major Capabilities Not Bound to One Route

| Capability | Owner | Repo | Func level | Gaps | Classification | Backend dep |
|---|---|---|---|---|---|---|
| Learning Programs/Levels assignment UI | learning | demo both | LIVE — LevelContentPanel attach/detach with intent | detach no stale guard, sortOrder invisible, per_page 200 | A — sortOrder UI + detach guard intent NOW | programId validation server |
| Student Placement + Eligibility | learning/eligibility.ts | pure | LIVE — resolveEligibleContent cumulative <= exclusive exact, active, visibility | exclusive UI? | A — policy doc + UI hardening NOW | Server enforcement same rule |
| Progress Pieces/Repertoire | progress | demo both | LIVE — Piece types, assignments, events | No API, ceiling | A — already | — |
| Gallery | gallery | demo both | LIVE — albums/images via media | Genuine vs shallow audit needed, no upload UI | A — upload UI via media seam NOW | Storage provider |
| Export students/teachers | export/exportService | demo reads | LIVE — CSV/XLSX explicit columns, safeFilename, BOM? | Library not in ExportEntity, no filters, no RTL filename? Actually Persian filename, UTF-8, large-dataset client vs backend, permission | A — extend to other entities + column defs + filter reuse NOW, large-dataset B | Server streaming for large |
| Dashboard analytical export | shared/dashboardInsights | demo | PARTIAL — derivation exists, export missing | No tabular summary reuse canonical calc, no date-range | A — tabular summary export reusable NOW | Server aggregation for large range |
| RBAC UI guards | auth/permissions | — | LIVE — canAccessView, rolePermissions | self vs assigned vs org scope missing, ownership not modeled | A — matrix doc + self vs assigned vs org clarification NOW | Backend enforcement |
| Student Portal architecture | — | — | DEFERRED — no student role D1 | Identity linking, auth, profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files | B — contract/UX preparation NOW, backend later | Student auth, linking, per-user read cursor |
| Tickets vs Chat ownership | chat | — | PARTIAL — chat is tickets | Ticket vs chat distinction, ownership scope | A — topology doc NOW | Server ownership |
| Telegram adapter | chat/provider | — | CONTRACT — provider enum, unavailable status | Research missing I7, backup vs access different adapters | B — adapter contract Core->Adapter->Telegram/Bale NOW, backend later | Bot API, webhook, credential handling |
| Bale adapter | same | — | Same | Same, avoid duplicate logic | B — same | Same |
| Mobile app | registry | — | CONTRACT — same backend contracts, mode-switched registry | Auth, media/file abstraction | B — contract NOW | Same backend |
| Media/File abstraction | media | demo both | LIVE — metadata dataset, bytes blobStore | No storage provider, no signed URLs, no scanning | B — abstraction + provider seam NOW, backend later | S3/MinIO, signed URLs |
| Notifications | notifications README | none | DEFERRED — toggles disabled honest | No domain, no provider | C — DEFERRED except honest UI already |
| Localization | — | localStorage? | DEFERRED — selects disabled honest | No server wiring | C — but UI already honest, contract B? |
| Working hours / session rules | scheduling? | — | DEFERRED — inputs disabled honest | No domain | C — DEFERRED |
| Free-slot search | — | — | DEFERRED — freeSlotsTuesday removed honest no-data | No backend | C — DEFERRED |
| Backup envelope | demo/backup.ts | demo | LIVE but labels wrong I8 | environment always demo, filename, validation | B — versioned format change, migration |
| Attendance badge removal | navigation | — | CLOSED M7 — removed because no scoped unrecorded-sessions read | — | A already closed |

## Functionality Level Definitions

- NONE: no implementation
- CONTRACT: types/interface exists, no UI
- DEMO: demo implementation works, both modes demo
- LIVE: wired view, honest states, tests, no fixture
- DEFERRED: explicit Panel stating D6/I2 or similar, no fake

## Frontend Completable NOW (A) List

1. Classes deep-link get(id) authoritative (same pattern as students/teachers) — fix capped find
2. Library filtering: type/level/visibility/search/sort/preview/locked/metadata workflows spec + UI hardening (filter chips, sort select, locked reason)
3. Gallery audit genuine vs shallow + upload UI via media seam
4. Settings/theme token architecture spec + editable defaults validation preview reset org vs device-local schema doc (branding org vs appearance device-local already, but token architecture doc)
5. Export reusable mechanism: column defs, row transform, locale encoding filter reuse, filename Persian UTF-8, permission, demo vs server boundary, extend to library/gallery/progress/scheduling/attendance/compensation (tabular summaries)
6. Dashboard analytical export: tabular summary reuse canonical calculation, date-range filtering aggregation reuse, NO fabricated data, NO_DATA if unavailable
7. RBAC matrix doc + self vs assigned vs org clarification, UI/route/action guards
8. Learning access policy canonical spec Level N => 1..N locked N+1+ with owner audit per-program/instrument scope
9. Tickets/chat/files topology doc + ownership/unread/read scope validation storage
10. Student portal architecture contract (profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files) demo vs backend identity
11. Error disclosure for all list consumers (I15 remaining 14) — each read owns its own error
12. useStudentList Paged<> + PAGE_SIZE_CALLERS inclusion + per_page explicit (I16 mitigation)
13. Seeded compensable case in demo seed (demo data only, no prod logic)
14. Library file one-frame exposure fix (useLibraryFile, useMediaObjectUrl) — frontend

## Contract Now Backend Later (B)

- Library create/update/delete with mediaId backend storage/signing
- Gallery upload backend
- Branding org persistence (Laravel organization table)
- Theme persistence decision (device-local stays per D2, org theme optional — decision needed)
- Export large-dataset server boundary (streaming, permission, columns)
- Dashboard date-range server aggregation
- RBAC backend enforcement
- Student portal auth, identity linking student↔user, per-user read cursor
- Telegram adapter: Core API → Auth+RBAC → Domain Services → Adapters → Telegram/Bale — contract
- Bale adapter contract avoid duplicate logic
- Mobile app client of same backend contracts, media/file abstraction → storage provider
- Media abstraction service → provider (S3/MinIO), signed expiring URLs, content sniffing, virus scanning
- Backup envelope versioned format fix (I8)
- Attendance presence provider sync vs async boundary

## Explicitly Deferred (C)

- Finance/Reports domain implementation (D6/I2) — no repository, no fabricated revenue
- Notification server wiring (Settings toggles disabled honest)
- Localization/settings server wiring (selects disabled)
- Working-hours/session-rules server wiring (inputs disabled)
- Free-slot search
- Automatic completion of elapsed sessions
- Group/class-wide compensation coordination flow
- External browser QA (L4)
- Student role in this panel vs separate app (D1)

## Dependencies Graph (simplified)

Learning → Resource eligibility → Library → Student resource
RBAC → Settings/Exports/Portal/Communication
Theme → Settings UI → org persistence (branding) + device-local (appearance)
Communication → Tickets/Chat/Files → Adapters (Telegram/Bale)
Analytics → Dashboard → Export (tabular summary reuse canonical)
Scheduling → Attendance (presence) → Compensation (scheduling+attendance composition)
Media → Library/Gallery/Students/Teachers/Branding/Chat

## Acceptance per Capability (examples)

- Learning: Level N => access 1..N locked N+1+, not_visible for teacher-only, eligible derivation pure, owner learning/eligibility.ts
- Library: search finds title/composer/teacher, filter kind/instrument/level/visibility, sort by added/uses/title, preview via objectUrl, locked reason when missing bytes, metadata title/composer/kind/instrument/level/size/duration/pages/added/uses, workflows empty/loading/error/demo persistence
- Gallery: albums genuine if images>0 backed by media, metadata title/description/coverMediaId/sortOrder/createdAt, filtering by album, ordering by sortOrder, visibility all demo, storage seam metadata dataset bytes blobStore
- Settings: academy identity name/tagline/logo/color system typography light/dark tokens CSS vars, preview live, reset to defaults, persistence org vs device-local schema (branding org, appearance device-local)
- Export: formats csv/xlsx, filters reuse list filters, columns explicit, RTL Persian UTF-8 filename with BOM, client vs backend permission check, large-dataset client reads capped with truncation disclosed, server streaming boundary
- Dashboard: Raw->Derivation->Insight->Visualization->Export no duplicate engine, NO_DATA if unavailable, no fabricated measurements, date-range filtering reuse bounded window
- RBAC: Actor/Action/Resource/Scope/Allowed/Reason/Frontend guard/Backend enforcement, smallest permission model, users/roles/permissions/ownership/scope self vs assigned vs org read/write
