# F5 — Dashboard Analytics + Export — READ-ONLY INVENTORY

> Branch `arena/frontend-completion-spec` HEAD `77757b1` F4 VERIFIED, PR #4 OPEN UNMERGED. No file modifications during inventory.

## 1. F5 Goal (canonical from 11-roadmap.md)

Analytical export NO fabricated measurements authoritative vs derived vs unavailable date-range filtering aggregation tabular summary reuse canonical calculation.

## 2. Domains / Slices

- dashboardInsights, scheduling dateBridge, export, shared/stats, lib/format, ds primitives Sparkline Delta StatStrip Panel
- Dashboard view `src/views/Dashboard.tsx`, hooks `useDashboardInsights.ts` + `useAcademyMetrics.ts`, pure derivation `dashboardInsights.ts`
- Export: `exportService.ts` dashboard entity already via F4, `definitions.ts` dashboardColumns, `EntityExportButton.tsx`
- Tests: `dashboardInsightsLive.test.tsx`, `panelsEmpty.test.tsx`, `seriesGuards.test.ts`, `dashboardInsights.test.ts`

Slices per 09-dashboard-analytics.md:
- A NOW: date-range UI filter (client-side over 500 rows), tabular summary export reuse canonical calc, NO_DATA honesty already, no fabricated
- B CONTRACT NOW BACKEND LATER: server aggregation for large date-range, revenue seam when finance domain exists
- C DEFERRED: Finance/Reports domain (D6/I2), revenue chart until seam exists (already removed honest)

## 3. Current Implementation State — Partial

**Already complete (VERIFIED M9):**
- DashboardView reads useAcademyMetrics (hero metrics) + useDashboardInsights (panels) — VERIFIED
- useDashboardInsights: 5 list reads each per_page 500 (students/classes/rooms/teachers + bounded useSessions window 13 weeks from windowStart to todayIso) — VERIFIED, counts from total, truncation disclosed pattern
- Derivation pure module dashboardInsights.ts via meanOf/ratioPct/topBy from lib/stats.ts — empty set returns null, never NaN — VERIFIED D14, guards Sparkline readonly number[]|null Delta number|null per-chart empty guard before index I9
- Figures traced (M9 validation):
  - at-risk count + mean attendance from student rows sessionsTotal>0 (not attendanceRatePct hero metric which P1 caps)
  - sessions/cancellations + weekly series from bounded useSessions window
  - overdue payments + waitlists from students/classes
  - today's rows, class/room/teacher labels, seeded room clash from sessions/classes/rooms/teachers reads via conflictPairs
  - receivables from Student.balance
  - roster growth from Student.since via sinceBucket + rosterSeries
  - occupancy from class seats + stored weekdays via deriveOccupancy
  - instrument mix from Student.instrument via deriveInstrumentMix
  - record counts from entity totals via dashboardCounts
- Fixture sources removed: signals, growthSeries, revenueSeries, occupancy, instruments, quickActions, todayFlowIds, attentionItems, attentionQueue, intelligenceCards no longer reach surfaces — VERIFIED via dashboardInsightsLive.test + panelsEmpty.test + mutation with absurd fixture values still green
- EMPTY: every panel renders structure and states «داده‌ای نیست», two measures with no history render NO_DATA glyphs «—», no NaN/Infinity in text or SVG attrs, none of 24 retired fixture sentences or 5 retired fixture figures survive — VERIFIED
- Revenue chart removed because Finance/Reports README-only, invoices/payments no repository — no fabricated revenue — VERIFIED D6/I2
- Tabular summary export: implemented in F4 as entity="dashboard" via exportService buildExportTable dashboard case reuse canonical calc deriveSignals/deriveOccupancy/deriveReceivables/dashboardCounts — no duplicate engine — VERIFIED A NOW, plus EntityExportButton in Dashboard.tsx
- Export pattern: CSV BOM via toCsv UTF8_BOM, XLSX bytes copy via bytes.slice(), Persian filename safeFilename, permission guard students.read, truncation disclosure — VERIFIED via F4

**Gaps (F5 scope):**
- Date-range filter bar Jalali input presets today/week/month bounded window same as scheduling — GAP A NOW: currently Dashboard uses fixed 13-week window from windowStart to todayIso, no UI filter bar, no from/to Jalali input, no presets. Scheduling uses dateBridge jalaliToIso/isoToJalaliDisplay with bounded from/to — reusable.
- Date-range filtering reuse bounded window counts from total truncation disclosed — GAP: useDashboardInsights windowStart is fixed 13 weeks, not user-controlled, no date-range param passed to sessions read.
- Tabular summary export reuse canonical calc via same functions not second math — already done in F4 but needs to respect date-range filtered derivations (currently uses same 13-week window, not filtered by user date-range).
- EMPTY «داده‌ای نیست» not number — VERIFIED, but needs verification after date-range filter (empty filtered range should still show «داده‌ای نیست» not 0).
- No NaN/Infinity in text or SVG — VERIFIED, needs to stay after date-range.
- Unavailable measures NO_DATA «—» not 0 not fabricated — VERIFIED revenue removed.

## 4. Dependencies / Blockers

- F4 export pattern already implemented — dependency for dashboard export — DONE, no blocker.
- scheduling dateBridge: jalaliToIso, isoToJalaliDisplay, addDays, isoDayNumber, isoFromDayNumber — exists, tested via dateBridge.test.ts — no blocker.
- dashboardInsights.ts pure — meanOf/ratioPct/topBy handle empty null — no blocker.
- lib/format faNum, NO_DATA — exists — no blocker.
- ds primitives Sparkline, Delta, StatStrip, Panel — exist, guards already.
- useAcademyMetrics hero metrics — exists, per_page 500.
- No blocker for F5-1 date-range filter bar (frontend-only leaf) — can implement Jalali inputs with presets today/week/month, bounded window same as scheduling, reuse existing dateBridge.
- No blocker for F5-2 EMPTY/NO_DATA guards — already implemented.
- No blocker for F5-3 tabular summary export reuse — already in F4 but needs date-range param wiring.
- O-05 Export formats OPEN A csv/xlsx/txt C pdf deferred — no blocker.
- O-06 Permission analytical OPEN A same as view students.read — no blocker.
- T-02, O-01 remain OPEN — F5 does NOT own — preserved.

## 5. Exact Files Likely to Change

- `src/views/Dashboard.tsx` — add date-range filter bar with Jalali inputs (from/to) via dateBridge, presets today/week/month, bounded window same as scheduling, pass from/to to useDashboardInsights, add EntityExportButton with filters from date-range.
- `src/domains/shared/useDashboardInsights.ts` — accept optional {from, to} params, compute windowStart from from or fallback to 13 weeks, pass from/to to useSessions, keep per_page 500, keep truncation disclosure, keep hasRecords logic, keep pure derivations.
- `src/domains/shared/dashboardInsights.ts` — no change needed unless date-range filtering requires new helper, but pure functions already handle filtered input — single source for visualization and export.
- `src/domains/export/exportService.ts` — dashboard case already reuses canonical calc, needs to accept optional date-range filters {from, to} and pass to derivation (or reuse same window logic), ensure no duplicate engine.
- `src/domains/export/definitions.ts` — dashboardColumns already Metric/Value/Derivation, may add date-range column if needed.
- `src/domains/scheduling/dateBridge.ts` — reuse jalaliToIso/isoToJalaliDisplay, no change.
- `src/components/panels/Signals.tsx`, `BusinessIntelligence.tsx`, `AttentionAndFlow.tsx`, `Intelligence.tsx` — already handle EMPTY «داده‌ای نیست» and NO_DATA «—», no change unless date-range empty guard.
- `src/lib/format.ts` — faNum, NO_DATA already.
- Tests: `src/views/__tests__/dashboardInsightsLive.test.tsx`, `panelsEmpty.test.tsx`, `seriesGuards.test.ts`, `src/domains/shared/__tests__/dashboardInsights.test.ts` — add date-range filter bounded test, export reuses same functions test.
- Docs: `docs/frontend-completion/09-dashboard-analytics.md` — update current VERIFIED after F5 slices.

## 6. Implementation Order

- F5-1 leaf: date-range filter bar Jalali input presets today/week/month bounded window same as scheduling — add UI in Dashboard.tsx with two inputs (Jalali YYYY/MM/DD) using dateBridge, presets buttons today (from=today to=today), week (from=today-6 to=today), month (from=today-29 to=today), bounded window same as scheduling, pass from/to to useDashboardInsights, counts from total truncation disclosed «N ردیف از M» pattern preserved.
- F5-2: ensure EMPTY «داده‌ای نیست» not number, NO_DATA «—» not 0 not fabricated, no NaN/Infinity guards — verify existing guards Sparkline readonly number[]|null Delta number|null per-chart empty guard before index I9 still hold after date-range filtering.
- F5-3: tabular summary export reuse canonical calc via same functions not second math — ensure exportService dashboard case uses same from/to filters as Dashboard view, calls same deriveSignals/deriveOccupancy etc, no duplicate engine, filename Persian داشبورد-YYYY-MM-DD.csv with BOM, permission students.read.
- F5-4: verification — dashboardInsightsLive.test asserts no NaN/Infinity in SVG attrs, panelsEmpty.test asserts EMPTY «داده‌ای نیست», seriesGuards.test, date-range filter bounded test, export reuses same functions test, mutation with absurd fixture values still green.
- Final: full Vitest regression, no F1-F4 regression, docs update.

No blocker exists for F5-1 — begin first vertical slice: date-range filter bar with Jalali inputs + presets + bounded window.
