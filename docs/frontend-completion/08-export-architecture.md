# 08 — Export Architecture — Reusable

> Students/teachers formats filters columns RTL Persian UTF-8 filename client vs backend permission large-dataset

## Current (VERIFIED)

- exportService.ts: buildExportTable(entity) reads current repo state (per_page 1000) for students/teachers/classes/enrollments, explicit column lists (no Object.entries leak), studentExportRows via studentImport, teachers explicit headers Name/Instrument/Title/Phone/Status/ContractHours/WeeklyHours/Students, classes explicit, enrollments joins studentName/className maps
- serializeTable: csv via toCsv, xlsx via toXlsx (bytes copy into fresh ArrayBuffer), Blob type text/csv;charset=utf-8 + application/vnd.openxmlformats-officed...
- downloadBlob: URL.createObjectURL, anchor download safeFilename(filename), revoke after 1000ms — VERIFIED single seam
- exportEntity: label from EXPORT_LABELS Persian, stamp YYYY-MM-DD, downloadBlob serialize, return row count
- downloadTable exposed for import template/error report
- Sensitive-field policy: explicit columns, credentials/tokens/hashes never part of domain record — VERIFIED
- Formats: csv, xlsx — VERIFIED
- Filters: none — reads all with per_page 1000, no filter reuse — GAP
- Columns: explicit but not reusable column defs — GAP
- RTL: Persian headers, filename Persian — VERIFIED but UTF-8 BOM? Check toCsv — need BOM for Excel RTL? Current csv is utf-8 without BOM? The chat export returns .txt with BOM — VERIFIED conversationExport has BOM — but exportService csv may lack BOM — needs check — OPEN
- Filename: `${label}-${stamp}.${format}` with safeFilename — VERIFIED
- Client vs backend: reads repos (demo now), blob built in browser, no upload — VERIFIED §15
- Permission: no permission check in exportEntity — gap, should check can() — A NOW
- Large-dataset: per_page 1000 ceiling, no disclosure, no streaming — GAP I16

## Desired Reusable Mechanism

### Column Defs

```ts
interface ExportColumn<T> {
  key: string;
  header: string; // Persian
  accessor: (row: T) => string;
  // optional transform, e.g. instrumentName, faNum, label map
}
interface ExportDefinition<T> {
  entity: ExportEntity;
  label: string; // Persian
  columns: ExportColumn<T>[];
  fetch: (params: ListParams & Filters) => Promise<Page<T>>;
  // row transform locale, encoding
}
```

- One definition per entity, single owner, no duplicate column lists
- Columns explicit, sensitive fields never included
- Reusable by Students/Teachers/future reports

### Row Transform / Locale / Encoding

- Locale: Persian headers, faNum for numbers? Currently teachers uses String() not faNum — should use faNum? But CSV numbers as digits for Excel? Decision: keep digits for machine, Persian for display? For RTL, headers Persian, values Persian where label (status) but numbers digits — needs decision — see open
- Encoding: UTF-8 with BOM for CSV so Excel opens Persian correctly — currently chat export has BOM, exportService csv may not — A NOW add BOM
- Filename: Persian label + stamp + format, safeFilename sanitizes — VERIFIED, keep
- RTL: CSV itself LTR but headers Persian, Excel handles — no special RTL in CSV — but filename Persian UTF-8 must be safe — VERIFIED safeFilename
- Filter reuse: export should reuse same filters as list view (search, instrument, status, etc) — pass ListParams from view into buildExportTable — A NOW
- Large-dataset: client reads capped at 1000, if total > 1000 disclose truncation «N ردیف از M» and withhold? Or paginate and concatenate? For demo, concatenation of pages could work frontend, but for large real dataset needs server streaming — B boundary: client capped with disclosure, server streaming via backend endpoint

### Permission

- exportEntity should check can() for entity's read permission — e.g. students.read for students export — A NOW frontend guard (no control if no permission, M2 rule)
- Backend must enforce same — B

### Demo vs Server Boundary

- Demo: reads DemoStore via repo, builds blob in browser, downloads via downloadBlob — VERIFIED, stays
- Server: backend endpoint GET /exports/{entity}?filters&format returns streaming response with Content-Disposition attachment; filename same; permission checked server-side; for large dataset, server paginates internally and streams — B
- Frontend in api mode: if entity's repo is demo-backed (DEMO_SERVED_DOMAINS), export still client-side demo data with disclosure via DemoBackedNotice — no fake server claim — VERIFIED D8
- If entity graduates to API (students etc), export could still be client-side reading API repos (per_page 1000) or server-side endpoint — decision: keep client-side for now for entities that are API-backed but small, server-side for large — B

### Usable By

- Students/Teachers/classes/enrollments already — VERIFIED
- Future: library, gallery, progress assignments, scheduling sessions, attendance records, compensation obligations, dashboard tabular summaries — each needs ExportDefinition — A NOW spec, B implementation for those that need server

## Formats

- CSV: toCsv with BOM, headers Persian, rows string[][]
- XLSX: toXlsx via spreadsheet util, same headers/rows, title param
- TXT: for chat conversation export — already exists, metadata only no bytes, ceiling 1000 disclosed — VERIFIED M6, keep separate from tabular exports (D14 no new verb)
- Future: PDF? Deferred C — Reports needs PDF server — D6/I2

## Filters / Columns / Filename / Permission / Demo vs Server Matrix

| Entity | Format | Filters | Columns | Filename | Permission | Demo | Server |
|---|---|---|---|---|---|---|---|
| students | csv/xlsx | search, instrument, status, level? Reuse list filters | explicit from studentExportRows | هنرجویان-YYYY-MM-DD.csv | students.read | client repo per_page 1000 | streaming endpoint |
| teachers | csv/xlsx | search, instrument, status | Name/Instrument/Title/Phone/Status/ContractHours/WeeklyHours/Students | مدرسین-... | teachers.read | same | same |
| classes | csv/xlsx | search, instrument, kind, status, includeArchived | Title/Instrument/Kind/Level/Teacher/Room/Time/Duration/Enrolled/Capacity/Waitlist/Tuition/Status | کلاس‌ها-... | classes.read | same | same |
| enrollments | csv/xlsx | studentId/classId/status | StudentName/ClassName/Status/Start/End/Plan/Amount | ثبت‌نام‌ها-... | classes.read? Actually enrollments no permission but classes.read? Need decision | same | same |
| library | csv/xlsx | kind/instrument/level/search | Title/Composer/Kind/Instrument/Level/Size/Duration/Pages/Added/Uses | کتابخانه-... | library.read | client demo both modes | binary not included, metadata only |
| gallery | csv/xlsx | albumId/search | AlbumTitle/ImageCaption/Alt/SortOrder/CreatedAt | گالری-... | library.read? Or gallery? No permission yet | same | same |
| attendance records | csv/xlsx | sessionId/studentId/status/from/to | SessionDate/StudentName/Status/Recorder/RecordedAt | حضور-... | attendance.read | client bounded window | server aggregation |
| scheduling sessions | csv/xlsx | from/to/classId/roomId/teacherId/status | Date/Time/Class/Room/Teacher/Status | برنامه-... | schedule.read | client bounded | server |
| compensation | csv/xlsx | studentId/status/search | OriginalSession/Student/Status/AttemptCount/StudentOnRoster | جبرانی-... | schedule.read | client | server |
| dashboard tabular summary | csv/xlsx | date-range (from/to) | Metric/Value/Derivation | داشبورد-... | reports.read? Actually dashboard needs students.read | client derived from dashboardInsights | server aggregation for large range |

## Acceptance

- Column defs explicit, no credential leakage
- Row transform locale encoding filter reuse filename permission demo vs server boundary doc exists
- CSV has BOM for Persian Excel
- Filename Persian UTF-8 safeFilename
- Permission checked frontend (no control if no perm) and backend (403)
- Large-dataset client reads capped with truncation disclosed «N ردیف از M», not silent
- Reusable by Students/Teachers/future reports (ExportDefinition pattern)
- No fabricated data in export — reads repo only

## Classification

- A NOW: BOM, filter reuse, column defs pattern doc, permission frontend guard, extend to library/gallery/attendance/scheduling/compensation/dashboard tabular summary (client-side)
- B CONTRACT NOW BACKEND LATER: server streaming endpoint, large-dataset handling, signed URLs not included, per-object auth
- C DEFERRED: PDF export for reports (needs finance/reports domain), bulk chat PDF/ZIP/CSV pipeline (chat export stays txt single-conversation per D14)
