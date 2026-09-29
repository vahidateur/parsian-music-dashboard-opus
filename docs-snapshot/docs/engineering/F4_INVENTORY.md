# F4 — Export Engine — READ-ONLY INVENTORY

> Branch `arena/frontend-completion-spec` HEAD `938a5e5` F3 VERIFIED, PR #4 OPEN UNMERGED. No file modifications during inventory.

## 1. F4 Goal (canonical from 11-roadmap.md)

Reusable export mechanism column defs row transform locale encoding filter reuse filename permission demo vs server boundary usable by Students/Teachers/future reports.

Visible outcome:
- Students/Teachers/Classes/Enrollments already via buildExportTable explicit columns no leak + serializeTable csv/xlsx + downloadBlob seam EXPORT_LABELS Persian safeFilename + sensitive-field policy no credentials + formats csv/xlsx + txt for chat already
- Plus library/gallery/attendance/scheduling/compensation/dashboard tabular summary via same ExportDefinition pattern filter reuse from list view BOM for CSV Persian filename permission guard large-dataset disclosure

## 2. Domains / Slices

- export/exportService.ts — buildExportTable, serializeTable, downloadBlob, EXPORT_LABELS, exportEntity, downloadTable
- import/spreadsheet.ts — toCsv, toXlsx, safeFilename, UTF8_BOM, escapeForSpreadsheet, parseCsv/parseXlsx
- import/ImportExportCenter.tsx — UI for Students/Teachers/Classes/Enrollments exports
- lib/download.ts? Actually downloadBlob inside exportService, lib/format.ts faNum
- students/teachers/classes/enrollments — repos list reads per_page 1000
- library/gallery — metadata dataset + blobStore, not yet exportable
- scheduling/attendance/compensation — bounded window reads, not yet exportable
- dashboardInsights — pure derivation, not yet tabular summary export
- chat export — txt single-conversation via conversationExport.ts — already separate per D14 no new verb

Slices per 08-export-architecture.md:
- A NOW: BOM, filter reuse, column defs pattern doc, permission frontend guard, extend to library/gallery/attendance/scheduling/compensation/dashboard tabular summary (client-side)
- B CONTRACT NOW BACKEND LATER: server streaming endpoint GET /exports/{entity}?filters&format, large-dataset handling
- C DEFERRED: PDF export for reports, bulk chat PDF/ZIP/CSV pipeline

## 3. Current Implementation State — Partial

**Already complete (verified):**
- buildExportTable(entity) reads current repo state per_page 1000 for students/teachers/classes/enrollments, explicit column lists (no Object.entries leak), studentExportRows via studentImport — VERIFIED
- serializeTable: csv via toCsv, xlsx via toXlsx bytes copy into fresh ArrayBuffer via bytes.slice() — VERIFIED spreadsheet bytes copy fresh ArrayBuffer not SharedArrayBuffer
- downloadBlob: URL.createObjectURL, anchor download safeFilename, revoke after 1000ms — VERIFIED single seam
- exportEntity: label from EXPORT_LABELS Persian, stamp YYYY-MM-DD, downloadBlob serialize, return row count — VERIFIED
- downloadTable exposed for import template/error report — VERIFIED
- Sensitive-field policy: explicit columns, credentials/tokens/hashes never part of domain record — VERIFIED via sensitive data test
- Formats: csv, xlsx — VERIFIED
- CSV BOM: toCsv returns UTF8_BOM + lines.join CRLF — VERIFIED via exportService.test encoding round-trip, chat export also has BOM
- Filename: `${label}-${stamp}.${format}` with safeFilename sanitizes path separators/control chars, 120 char limit — VERIFIED
- TXT for chat: conversationExport.ts single-conversation txt metadata only ceiling 1000 disclosed D14 no new verb no bytes — VERIFIED M6
- Tests: exportService.test.ts 5 cases — live state includes created after startup, drops removed, exports every entity with header row, BOM round-trip Persian, XLSX national ID 10-digit preserved, sensitive data never exports password/token/secret

**Gaps (F4 scope):**
- Filter reuse: reads all with per_page 1000, no filter reuse from list view search/instrument/status etc — GAP per 08-export-architecture.md
- Column defs reusable pattern: explicit but not reusable ExportColumn/ExportDefinition — GAP, need ExportColumn<T> {key, header, accessor} + ExportDefinition<T>
- Permission: no permission check in exportEntity — gap, should check can() for students.read etc — A NOW frontend guard (no control if no permission, M2 rule)
- Large-dataset: per_page 1000 ceiling, no disclosure, no truncation disclosed «N ردیف از M» not silent — GAP I16
- Extend to library/gallery/attendance/scheduling/compensation/dashboard: not yet via same ExportDefinition pattern — GAP
- RTL Persian headers Excel handles — VERIFIED but locale transform faNum? Currently teachers uses String() not faNum — decision open but digits for machine kept
- Demo vs server boundary doc exists but not enforced in code for future entities — GAP for B contract doc

## 4. Dependencies / Blockers

- Repos list reads per_page 1000 — dependency for large-dataset disclosure: need total from PageMeta to disclose truncation
- Filter state from views: Students list search/instrument/status/level, Teachers search/instrument/status, Classes search/instrument/kind/status/includeArchived, Enrollments studentId/classId/status, Library kind/instrument/level/search, Gallery albumId/search, Attendance sessionId/studentId/status/from/to, Scheduling from/to/classId/roomId/teacherId/status, Compensation studentId/status/search, Dashboard date-range from/to — all exist in view state, need to pass ListParams into buildExportTable
- dashboardInsights.ts pure derivation — dependency for dashboard tabular summary export reuse canonical calc no duplicate engine
- scheduling dateBridge — dependency for date-range filtering bounded window
- lib/format.ts faNum — optional for locale numbers but decision to keep digits for Excel
- No blocker for F4-1 (permission guard + truncation disclosure + BOM verification) — frontend-only leaf
- No blocker for F4-2 (column defs pattern) — frontend-only
- Filter reuse requires view wiring but still frontend-only, no backend
- O-05 Export formats OPEN: A csv/xlsx/txt, C pdf deferred — no blocker, keep current
- O-06 Permission analytical contract OPEN: A same as view — use students.read for dashboard — no blocker

## 5. Exact Files Likely to Change

- `src/domains/export/exportService.ts` — add ExportColumn, ExportDefinition, filter-aware buildExportTable with ListParams, permission check via can(), truncation disclosure via PageMeta total, extend entity union to library/gallery/attendance/scheduling/compensation/dashboard, safeFilename + BOM already, bytes copy already
- `src/domains/export/definitions.ts` NEW — optional central column defs for all entities, reusable by Students/Teachers/future reports
- `src/domains/export/libraryExport.ts` NEW or inside definitions — library ExportDefinition
- `src/domains/export/galleryExport.ts` NEW — gallery ExportDefinition
- `src/domains/export/schedulingExport.ts` NEW — scheduling/sessions ExportDefinition
- `src/domains/export/attendanceExport.ts` NEW — attendance records ExportDefinition
- `src/domains/export/compensationExport.ts` NEW — compensation ExportDefinition
- `src/domains/export/dashboardExport.ts` NEW — dashboard tabular summary ExportDefinition reuse dashboardInsights
- `src/domains/import/spreadsheet.ts` — BOM already verified, no change needed unless safeFilename improvement
- `src/domains/import/ImportExportCenter.tsx` — add permission guard (no control if no perm), add truncation disclosure «N ردیف از M», add filter reuse UI? Or keep simple for now and add ExportButtons in list views
- `src/views/Students.tsx`, `Teachers.tsx`, `Classes.tsx`, `Enrollments.tsx`, `Library.tsx`, `Gallery.tsx`, `Scheduling.tsx`, `Attendance.tsx`, `Compensation.tsx`, `Dashboard.tsx` — optional add ExportButton that calls exportEntity with current filters
- `src/domains/export/__tests__/exportService.test.ts` — add tests csv bom (already), safeFilename, explicit columns no leak (already), filter reuse, permission hidden, truncation disclosed, spreadsheet bytes copy fresh ArrayBuffer not SharedArrayBuffer
- `docs/frontend-completion/08-export-architecture.md` — update current VERIFIED after F4 slices
- No backend/Laravel/migrations — per hard boundary

## 6. Implementation Order

- F4-1 leaf: permission frontend guard + large-dataset truncation disclosure + BOM verification + bytes copy verification — add can() check in exportEntity (no control if no perm M2), read total from PageMeta, if total > rows.length disclose via return value or toast, add safeFilename test, explicit columns no leak test already, add truncation test
- F4-2: column defs reusable pattern ExportColumn<T> {key, header, accessor} + ExportDefinition<T> {entity, label, columns, fetch} — refactor buildExportTable to use definitions, single owner per entity, no duplicate column lists
- F4-3: filter reuse from list view — buildExportTable accepts ListParams & Filters, fetch uses same filters as view, e.g. Students filters search/instrument/status/level, reuse via ExportDefinition fetch
- F4-4: extend to library/gallery — client-side metadata only, explicit columns, Persian headers, filename Persian, permission library.read, demo both modes disclosure, no binary included
- F4-5: extend to attendance/scheduling/compensation — bounded window reads per_page 500, columns explicit, permission schedule.read/attendance.read, truncation disclosed, no fabricated data reads repo only
- F4-6: dashboard tabular summary reuse canonical calc — export csv/xlsx reuse dashboardInsights derivations no duplicate engine, date-range filter bar Jalali input presets today/week/month bounded window same as scheduling, permission students.read per O-06 same as view, tabular summary Metric/Value/Derivation
- Final: full Vitest regression, no F1/F2/F3 regression, docs update

No blocker exists for F4-1 — begin first vertical slice: permission guard + truncation disclosure + BOM already verified.
