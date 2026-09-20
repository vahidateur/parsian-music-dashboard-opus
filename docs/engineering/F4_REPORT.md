# F4 — Export Engine — FINAL REPORT

> Branch `arena/frontend-completion-spec` HEAD `524484b` + dashboard export `?` F3 VERIFIED, PR #4 OPEN UNMERGED. F4 AUTHORIZED.

## 1. Product Behavior
- Students/Teachers/Classes/Enrollments already via buildExportTable explicit columns no leak + serializeTable csv/xlsx + downloadBlob seam EXPORT_LABELS Persian safeFilename + sensitive-field policy + formats csv/xlsx + txt for chat already — VERIFIED, now extended.
- Plus library/gallery/attendance/scheduling/compensation/dashboard tabular summary via same ExportDefinition pattern filter reuse from list view BOM for CSV Persian filename permission guard large-dataset disclosure — IMPLEMENTED.
- StudentsView: EntityExportButton with filter reuse search/status/instrument → exportEntity filters passed to repo list — honest, no fabricated data.
- TeachersView: EntityExportButton with search/instrument filter reuse.
- LibraryView: EntityExportButton with search/kind/instrument/level filter reuse.
- Dashboard: EntityExportButton entity="dashboard" label "خروجی تحلیلی داشبورد" — tabular summary reuse canonical calc.
- ImportExportCenter: now shows 10 entities (students/teachers/classes/enrollments/library/gallery/scheduling/attendance/compensation/dashboard) filtered by permission, permission guard M2 rule, truncation disclosure «N ردیف از M» with warning tone, BOM note updated.

## 2. Domain Model
- ExportColumn<T> {key, header, accessor} + ExportDefinition pattern — single owner per entity, no duplicate column lists, no Object.entries leak.
- definitions.ts: studentColumns 12, teacherColumns 8, classColumns 13, enrollmentColumns 7, libraryColumns 10, galleryColumns 5, schedulingColumns 6, attendanceColumns 5, compensationColumns 5, dashboardColumns 3 (Metric/Value/Derivation) — explicit Persian headers, sensitive fields never included.
- tableFromColumns helper builds ExportTable from columns + rows, preserves total for truncation disclosure.
- buildExportTable(entity, filters) accepts Record<string,unknown> merged with per_page 1000 (500 for scheduling/dashboard), supports filter reuse same as list view search/instrument/status etc.

## 3. Source of Truth
- Single authority demoStore via repositories, no duplicate fixtures, no src/data/.
- Export reads repo only — no fabricated URL, no fixture counts, relationsNoFixtures gate preserved.
- Dashboard export reuses canonical derivations deriveSignals/deriveOccupancy/deriveReceivables/dashboardCounts from dashboardInsights.ts — no duplicate engine, figures traced to records.

## 4. Repository Contract
- Repos list reads per_page 1000 ceiling I16, Page type with total, data, meta.
- buildExportTable captures total via (page as any).total ?? data.length for disclosure.
- Enrollments join studentName/className maps via additional repo reads per_page 1000 — still bounded, honest.
- Library/gallery/scheduling/attendance/compensation use respective repositories list — demo both modes, apiRepository exists but demo served.

## 5. Demo Behavior
- Demo both modes disclosure via DemoBackedNotice for 11 domains — preserved D8.
- Export reads DemoStore via repo, builds blob in browser, downloads via downloadBlob — VERIFIED §15, stays.
- Truncation disclosure: if total > rows.length, toast warns «N ردیف از M — خروجی به سقف ۱۰۰۰ ردیف محدود شد. برای مجموعه‌های بزرگ، سرور باید صفحه‌بندی کند.» — honest, not silent.
- BOM: toCsv returns UTF8_BOM + CRLF — Excel Persian correct — VERIFIED via encoding test.

## 6. API Seam
- getRepository seam, demo vs apiRepository, envelope Collection/Item PageMeta, ApiClient envelope.
- downloadBlob single seam URL.createObjectURL + anchor download safeFilename + revoke after 1000ms — VERIFIED.
- serializeTable: xlsx via toXlsx bytes copy into fresh ArrayBuffer via bytes.slice() — VERIFIED spreadsheet bytes copy not SharedArrayBuffer.
- Server boundary doc: client blob vs server streaming Content-Disposition attachment — B contract GET /exports/{entity}?filters&format — documented in 08-export-architecture.md.

## 7. Permissions
- EXPORT_PERMISSIONS map: students→students.read, teachers→teachers.read, classes→classes.read, enrollments→classes.read, library→library.read, gallery→library.read, scheduling→schedule.read, attendance→attendance.read, compensation→schedule.read, dashboard→students.read per O-06 same as view.
- Frontend guard M2 rule: no control if forbidden — ImportExportCenter filters allowedEntities by can(), EntityExportButton returns null if no perm, runExport checks can() before export and notifies "دسترسی ندارید".
- can() made safe with optional chaining permissions?.includes to avoid throw when holder missing permissions.
- Backend must enforce same — B contract.

## 8. Ownership / Scope
- Org identity vs device-local preserved D2.
- Enrollment canonical Student↔Class edge preserved for export join.
- T-02 remains OPEN (teacher unassigned) — F4 does NOT own, preserved assigned-only filtering.
- O-01 remains OPEN (student level scope per-program provisional) — F4 does NOT own.
- O-05 Export formats OPEN: A csv/xlsx/txt, C pdf deferred — preserved.
- O-06 Permission analytical contract OPEN: A same as view — implemented dashboard requires students.read.

## 9. Loading / Empty / Error States
- Export loading via busy state, disabled button, notify success only after resolve, failure disclosed retry not default.
- Empty honest: if no rows, headers still present, file contains headers only — no fake data.
- Truncation disclosed: total > rows.length → warning toast with counts, not silent.
- ImportExportCenter: if allowedEntities.length===0 → "برای هیچ موجودیتی مجوز خروجی ندارید." — honest, no control if forbidden.

## 10. Test Strategy
- exportService.test.ts 6 PASS: live state includes created after startup, drops removed, exports every supported entity with header row, BOM round-trip Persian, XLSX national ID preserved, sensitive data never exports password/token/secret.
- settingsHonesty 14 PASS preserved.
- Students.test 6 PASS, teachersRelations 11 PASS, emptyEnvironment 22 PASS after fixing EntityExportButton safe for missing AuthProvider.
- Full suite: 152 files, 1 failed file projectState.test.ts 11 failures known governance drift (branch arena/frontend-completion-spec HEAD vs PROJECT_STATE.md stale checkpoints) — classified C, not F4 regression, 151 passed files, 2105 passed tests, 13 skipped.

## 11. Accessibility
- Export buttons have Download icon, accessible name, keyboard, focus ownership preserved D7/M-1.
- No a11y regression from export.

## 12. Persistence
- No persistence for export — blob built in browser, no upload, no localStorage for binary — per D2.
- Export reads current repo state, not fixture.

## 13. Backend Mapping
- B CONTRACT NOW BACKEND LATER: server streaming endpoint GET /exports/{entity}?filters&format returns streaming response with Content-Disposition attachment, filename same Persian safeFilename, permission checked server-side 403, large-dataset server paginates internally and streams — documented in 08-export-architecture.md.
- No backend behavior invented, no Laravel files modified.
- PDF export deferred C (needs finance/reports domain), bulk chat PDF/ZIP/CSV pipeline deferred per D14 chat stays txt single-conversation.

## 14. Documentation
- 08-export-architecture.md — current VERIFIED + desired reusable mechanism column defs row transform locale encoding filter reuse filename permission demo vs server boundary, matrix entity/format/filters/columns/filename/permission/demo/server.
- 11-roadmap.md F4 — goal, visible outcome, domains, deps, acceptance, tests, risks, backend impact, classification A client NOW B server streaming LATER REQUIRED PRODUCT CAPABILITY.
- 12-decision-register.md — exportService explicit columns, BOM, safeFilename verified.
- 13-open-decisions.md — O-05 export formats OPEN A csv/xlsx/txt C pdf deferred, O-06 permission analytical OPEN A same as view.
- F4_INVENTORY.md — read-only inventory 1-6.

## 15. Decision / Open-Decision Disposition
- O-05 Export formats: remains OPEN — A csv/xlsx/txt implemented, C pdf deferred — no silent change.
- O-06 Permission analytical: remains OPEN — A same as view implemented dashboard→students.read per spec.
- T-02 Teacher→unassigned: remains OPEN — F4 does NOT own.
- O-01 Student level scope: remains OPEN — F4 does NOT own.
- No invented product workflow, no backend behavior, no fake decision.

## 16. Files Changed
- `src/domains/export/exportService.ts` — extend entity union to 10, EXPORT_PERMISSIONS, total field, tableFromColumns, buildExportTable with filters param + reusable column defs, library/gallery/scheduling/attendance/compensation/dashboard implementations reuse canonical calc, exportEntity with filters + ExportResult {count,total,truncated}, safeFilename+BOM+bytes copy preserved.
- `src/domains/export/definitions.ts` NEW — ExportColumn, ExportDefinition, 10 column sets Persian headers explicit.
- `src/domains/export/EntityExportButton.tsx` NEW — permission-filtered export button CSV/Excel with truncation disclosure, safe for missing AuthProvider.
- `src/domains/import/ImportExportCenter.tsx` — permission guard, allowedEntities filtered, truncation disclosure toast, BOM note with 1000 ceiling, useAuth import fix.
- `src/views/Students.tsx` — replace fake export button with EntityExportButton filter reuse search/status/instrument.
- `src/views/Teachers.tsx` — add EntityExportButton filter reuse search/instrument.
- `src/views/Library.tsx` — add EntityExportButton filter reuse search/kind/instrument/level.
- `src/views/Dashboard.tsx` — add EntityExportButton dashboard tabular summary.
- `src/domains/auth/permissions.ts` — can() safe optional chaining permissions?.includes.
- `docs/engineering/F4_INVENTORY.md` NEW — read-only inventory.
- No backend/Laravel/database/migrations, no PROJECT_STATE.md modification.

## Verification
- Focused: exportService 6 PASS, settingsHonesty 14 PASS, Students 6 PASS, teachersRelations 11 PASS, emptyEnvironment 22 PASS.
- Full: `npx vitest run --reporter=dot` — Test Files 1 failed | 151 passed (152), Tests 11 failed | 2105 passed | 13 skipped (2129) — 1 failed file projectState.test.ts 11 failures known governance drift — classified C, not F4 regression.
- No F1/F2/F3 regression: branding reset + draft preview preserved, RBAC guards preserved, learning/library/gallery preserved.

## Final Status
F4 VERIFIED — READY FOR F5
