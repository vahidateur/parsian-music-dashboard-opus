# F5 — Dashboard Analytics + Export — FINAL REPORT

> Branch `arena/frontend-completion-spec` HEAD `6d16105` F4 VERIFIED, PR #4 OPEN UNMERGED. F5 AUTHORIZED.

## 1. Product Behavior
- Dashboard reads useAcademyMetrics hero + useDashboardInsights panels 5 reads per_page 500 bounded useSessions window — VERIFIED, now with date-range filtering.
- Date-range filter bar: Panel "بازهٔ زمانی" kicker "فیلتر تاریخ شمسی — از همان مرزی که برنامه‌ریزی استفاده می‌کند — پیش‌فرض ۱۳ هفته", two Jalali inputs YYYY/MM/DD via dateBridge jalaliToIso/isoToJalaliDisplay, presets 13w/today/week/month via addDays, bounded window same as scheduling, counts from total truncation disclosed, client-side over 500 rows, server aggregation B.
- Derivation pure dashboardInsights.ts meanOf/ratioPct/topBy empty null never NaN — VERIFIED.
- Figures traced at-risk count + mean attendance from student rows sessionsTotal>0, sessions/cancellations + weekly series from bounded useSessions window, overdue payments + waitlists from students/classes, today's rows class/room/teacher labels seeded room clash from sessions/classes/rooms/teachers reads, receivables from Student.balance, roster growth from Student.since, occupancy from class seats + stored weekdays, instrument mix from Student.instrument, record counts from entity totals — VERIFIED M9.
- Fixture sources removed signals growthSeries revenueSeries occupancy instruments quickActions todayFlowIds attentionItems attentionQueue intelligenceCards no longer reach surfaces — VERIFIED via dashboardInsightsLive.test + mutation with absurd values.
- EMPTY every panel «داده‌ای نیست» two measures no history NO_DATA glyphs «—» no NaN/Infinity in text or SVG attrs none of 24 retired fixture sentences or 5 retired fixture figures survive — VERIFIED.
- Revenue chart removed because Finance/Reports README-only no seam no fabricated revenue D6/I2 — VERIFIED stays removed honest.
- Guards Sparkline readonly number[]|null Delta number|null per-chart empty guard before index I9 — VERIFIED.
- Tabular summary export csv/xlsx reuse dashboardInsights derivations no duplicate engine — IMPLEMENTED in F4 as dashboard entity + F5 date-range wiring: EntityExportButton in Dashboard with filters from/to, exportService dashboard case respects from/to and calls same deriveSignals/deriveOccupancy/deriveReceivables/dashboardCounts, filename Persian داشبورد-YYYY-MM-DD.csv with BOM, permission students.read, truncation disclosed.

## 2. Domain Model
- Single owner dashboardInsights.ts for all derivations — one owner per rule per D5.
- useDashboardInsights: one read set 5 lists per_page 500 + bounded sessions window from/to, pure derivations via useMemo, no side effects, unit testable.
- Raw→Derivation→Insight→Visualization→Export pipeline: Raw DemoStore collections, Derivation pure dashboardInsights.ts, Insight BusinessIntelligence/Signals/Attention/Intelligence panels, Visualization Sparkline/Delta/StatStrip/Panel, Export tabular summary reuse same derivation — no duplicate engine single source.
- Authoritative vs Derived vs Unavailable matrix preserved: student/teacher/class/room counts authoritative, sessions authoritative, at-risk/mean attendance derived, overdue/waitlists authoritative from student/class fields, receivables authoritative from Student.balance, collected revenue unavailable → NO_DATA not 0 not fabricated, roster growth derived from Student.since, occupancy derived, instrument mix derived, today's rows authoritative + derived labels, room clash derived, revenue chart unavailable removed.

## 3. Source of Truth
- Single authoritative dataset DemoDataset + blobStore, single authority demoStore, no duplicate fixtures, dissolved src/data/ directory — preserved.
- Dashboard reads repos only, no fixture, no hardcoded ActionSheet arrays.
- No fabricated measurements — enforced by dashboardInsightsLive.test + panelsEmpty.test + mutation with absurd values.

## 4. Repository Contract
- Repos list reads per_page 500 bounded, Page with total, data, meta — counts from total truncation disclosed pattern.
- useSessions with from/to bounded window same as scheduling — per_page 500, windowStart from param or 13w fallback, windowEnd to param or todayIso.
- No fixture counts, relationsNoFixtures gate preserved.

## 5. Demo Behavior
- Demo both modes disclosure via DemoBackedNotice for 11 domains — preserved D8.
- Dashboard over zero records: every panel «داده‌ای نیست», hero numbers real zeros not division by zero, no NaN, no fabricated figure — VERIFIED via emptyEnvironment.test.
- Date-range filter over zero records: still «داده‌ای نیست» not number, NO_DATA «—» not 0.

## 6. API Seam
- getRepository seam, demo vs apiRepository, envelope Collection/Item PageMeta, ApiClient envelope.
- Export seam downloadBlob + serializeTable csv BOM + xlsx bytes copy fresh ArrayBuffer — preserved from F4.
- Backend mapping B CONTRACT NOW BACKEND LATER: server aggregation for large date-range GET /dashboard/insights?from&to, revenue seam when finance domain exists — documented in 09-dashboard-analytics.md.

## 7. Permissions
- 5 roles 22 perms preserved, viewPermissions dashboard→students.read, can() safe optional chaining.
- Export permission dashboard→students.read per O-06 same as view — frontend guard M2 rule no control if forbidden, EntityExportButton checks can().
- No role id direct in components, no control if forbidden — preserved.

## 8. Ownership / Scope
- Enrollment canonical Student↔Class edge preserved, placement per program, provenance recorderId preserved.
- T-02 remains OPEN (teacher unassigned) — F5 does NOT own.
- O-01 remains OPEN (student level scope per-program provisional) — F5 does NOT own.
- O-05 Export formats OPEN A csv/xlsx/txt C pdf deferred — preserved.
- O-06 Permission analytical OPEN A same as view — implemented.

## 9. Loading / Empty / Error States
- LoadingState role=status for dashboard reads, ErrorState with retry owns message success only after resolve, failure disclosure I15 — preserved.
- Empty honest Persian «داده‌ای نیست» for every panel when no records, «منبعی نیست» for library, «تصویری نیست» for gallery — preserved.
- NO_DATA «—» for unavailable measures (revenue, two measures no history) not 0 not fabricated — preserved.
- Date-range invalid Jalali → warning "تاریخ شمسی نامعتبر است — قالب YYYY/MM/DD مثل ۱۴۰۴/۰۷/۰۱" — honest, no silent failure.
- No NaN/Infinity in text or SVG attrs — enforced by dashboardInsightsLive.test, guards Sparkline number[]|null Delta number|null.

## 10. Test Strategy
- dashboardInsights.test.ts 34 cases PASS: no records reports no signals, derives no insight, reports roster/occupancy/instruments/receivables absent, counts zero, ratios null, roster curve Jalali ordering, rolling 7-day windows, signals from stored rows, attention rules, today's flow labels NO_DATA, live/next/done/cancelled derivation, room clash, occupancy, instrument mix, receivables, intelligence confidence.
- dashboardInsightsLive.test.tsx 20 cases PASS: DEMO over seeded records hero + panels real data, EMPTY over zero records states «داده‌ای نیست» where figure would be invented, draws no trend names no class/room/teacher, survives empty without fabricated figure/sentence, follows write to store liveness, no NaN/Infinity in SVG.
- emptyEnvironment.test.tsx 22 PASS: live surfaces over zero records honest, student profile honest, artefact-only surfaces render without crashing, command palette over zero records, settings over zero records, real write in EMPTY confirms academy's own data.
- exportService.test.ts 6 PASS: BOM, sensitive data, live state.
- settingsHonesty 14 PASS, Students 6 PASS, teachersRelations 11 PASS.
- Full suite: 152 files, 1 failed file projectState.test.ts 11 failures known governance drift, 151 passed files, 2105 passed tests, 13 skipped — no F1-F4 regression.

## 11. Accessibility
- Date-range filter inputs have Field label, dir ltr for Jalali, keyboard accessible, focus ownership via shell lock + handingOff preserved D7/M-1.
- Sparkline/Delta guards prevent NaN in SVG attrs — a11yGate preserved.
- No a11y regression.

## 12. Persistence
- demoStore single authority, IndexedDB blobStore for bytes, no localStorage for binary, org vs device-local schema preserved.
- Dashboard filter state device-local (useState) — not persisted org, honest — no fake persistence.

## 13. Backend Mapping
- B CONTRACT NOW BACKEND LATER: server aggregation for large date-range, revenue seam when finance domain exists, per-org scoping org_id, transaction SELECT FOR UPDATE, signed expiring URLs — documented in 09-dashboard-analytics.md.
- No backend behavior invented, no Laravel files modified.
- Finance/Reports still README-only revenue chart stays removed honest D6/I2 — preserved.

## 14. Documentation
- 09-dashboard-analytics.md — current VERIFIED M9, desired pipeline Raw→Derivation→Insight→Visualization→Export, authoritative vs derived vs unavailable matrix, date-range filtering, tabular summary reuse canonical calc, NO_DATA honesty, classification A NOW B LATER C DEFERRED.
- 11-roadmap.md F5 — goal, visible outcome, domains, deps, acceptance, tests, risks, backend impact, classification A NOW B LATER REQUIRED PRODUCT CAPABILITY.
- 12-decision-register.md — DASH-01 dashboard analytical no fabricated, D6/I2 finance deferred.
- 13-open-decisions.md — O-05 export formats, O-06 permission analytical.
- F5_INVENTORY.md — read-only inventory 1-6.

## 15. Decision / Open-Decision Disposition
- O-05 Export formats: remains OPEN — A csv/xlsx/txt, C pdf deferred — no silent change.
- O-06 Permission analytical: remains OPEN — A same as view students.read — implemented.
- T-02 Teacher→unassigned: remains OPEN — F5 does NOT own.
- O-01 Student level scope: remains OPEN — F5 does NOT own.
- D6/I2 Finance/Reports deferred — revenue chart stays removed honest — no fabricated measurement.
- No invented product workflow, no backend behavior, no fake decision.

## 16. Files Changed
- `src/domains/shared/useDashboardInsights.ts` — accept optional from/to ISO, windowStart uses from if provided else 13w rolling, windowEnd uses to else todayIso, sessions read bounded from/to per_page 500.
- `src/views/Dashboard.tsx` — add date-range filter bar Panel with Jalali inputs via dateBridge jalaliToIso/isoToJalaliDisplay/addDays, presets 13w/today/week/month, fromIso/toIso memo, applyPreset, EntityExportButton with filters from/to for tabular summary reuse, invalid Jalali warning, note about client-side 500 rows server aggregation B.
- `src/domains/export/exportService.ts` — dashboard case respects from/to filters, todayIso = to ?? now, sessions list with from/to, reuse canonical derivations deriveSignals/deriveOccupancy/deriveReceivables/dashboardCounts no duplicate engine, rows include "جلسات در بازه" with from/to derivation.
- `docs/engineering/F5_INVENTORY.md` NEW — read-only inventory.
- No backend/Laravel/database/migrations, no PROJECT_STATE.md modification.

## Verification
- Focused: dashboardInsights 34 PASS, dashboardInsightsLive 20 PASS, emptyEnvironment 22 PASS, exportService 6 PASS, settingsHonesty 14 PASS.
- Full: `npx vitest run --reporter=dot` — Test Files 1 failed | 151 passed (152), Tests 11 failed | 2105 passed | 13 skipped (2129) — 1 failed file projectState.test.ts 11 failures known governance drift — classified C, not F5 regression.
- No F1-F4 regression: branding reset + draft preview preserved, export permission guard + truncation disclosure + reusable column defs + filter reuse preserved, RBAC guards preserved, learning/library/gallery preserved.

## Final Status
F5 VERIFIED — READY FOR F6
