# 09 — Dashboard Analytics — No Fabricated Data

> Analytical export NO fabricated measurements authoritative vs derived vs unavailable date-range filtering aggregation tabular summary reuse canonical calculation

## Current (VERIFIED M9)

- DashboardView reads useAcademyMetrics (hero metrics) + useDashboardInsights (panels) — VERIFIED
- useDashboardInsights: 5 list reads each per_page 500 (students/classes/rooms/teachers + bounded useSessions window) — VERIFIED
- Derivation pure module dashboardInsights.ts via meanOf/ratioPct/topBy from lib/stats.ts — empty set returns null, never NaN — VERIFIED D14
- Figures traced (from PROJECT_STATE.md M9 validation):
  - at-risk count + mean attendance from student rows sessionsTotal>0 (not attendanceRatePct hero metric which P1 caps)
  - sessions/cancellations + weekly series from bounded useSessions window
  - overdue payments + waitlists from students/classes
  - today's rows, class/room/teacher labels, seeded room clash from sessions/classes/rooms/teachers reads
  - receivables from Student.balance
  - roster growth from Student.since
  - occupancy from class seats + stored weekdays
  - instrument mix from Student.instrument
  - record counts from entity totals
- Fixture sources removed: signals, growthSeries, revenueSeries, occupancy, instruments, quickActions, todayFlowIds, attentionItems, attentionQueue, intelligenceCards no longer reach surfaces — VERIFIED
- EMPTY: every panel renders structure and states «داده‌ای نیست», two measures with no history render NO_DATA glyphs, no NaN/Infinity in text or SVG attrs, none of 24 retired fixture sentences or 5 retired fixture figures survive — VERIFIED via dashboardInsightsLive.test + panelsEmpty.test + mutation with absurd fixture values still green
- Revenue chart removed because Finance/Reports README-only, invoices/payments no repository — no fabricated revenue — VERIFIED D6/I2
- Guards: Sparkline readonly number[]|null, Delta number|null, per-chart empty guard before index — VERIFIED I9

## Desired: Raw → Derivation → Insight → Visualization → Export

### Pipeline

1. **Raw:** DemoStore collections or API responses — authoritative source
2. **Derivation:** pure functions in dashboardInsights.ts + useDashboardInsights.ts hooks — no side effects, unit testable without environment
3. **Insight:** BusinessIntelligence, Signals, AttentionAndFlow, Intelligence panels — each insight computed from derived model, states NO_DATA when input empty
4. **Visualization:** Sparkline, Delta, StatStrip, Panel — render derived numbers, never compute, guard empty via NO_DATA
5. **Export:** tabular summary reuse canonical calculation (same derivation module), no duplicate engine

**No duplicate engine:** dashboardInsights.ts is single source for both visualization and export — export's tabular summary calls same functions, not second implementation.

### Authoritative vs Derived vs Unavailable

| Measure | Authoritative? | Derived? | Unavailable? | Reason |
|---|---|---|---|---|
| Student count, teacher count, class count, room count | authoritative (entity totals) | — | — | Repo list total |
| Sessions in window, cancellations | authoritative (session rows) | — | — | Bounded useSessions |
| At-risk students | — | derived (student rows sessionsTotal>0 + attendance? Actually from student rows) | — | Pure derivation |
| Mean attendance | — | derived (student rows) | — | meanOf |
| Overdue balances | authoritative? Student.balance is authoritative? Actually balance is field on student — but finance domain deferred — so balance is authoritative as student field, not finance aggregation | — | — | Student.balance |
| Receivables | authoritative (Student.balance) | — | — | Same |
| Collected revenue | — | — | unavailable | No finance repo, no invoices/payments repo — must be NO_DATA, not 0, not fabricated |
| Roster growth | — | derived from Student.since | — | Pure |
| Occupancy | — | derived from class seats + weekdays | — | Pure |
| Instrument mix | — | derived from Student.instrument | — | topBy |
| Today's rows labels | authoritative (sessions) + derived labels from classes/rooms/teachers | — | — | Join |
| Room clash | — | derived from sessions overlap | — | conflicts.ts? Actually seeded clash detected from stored sessions |
| Revenue chart | — | — | unavailable | No seam — removed per D6/I2 — must stay removed until finance domain exists |

**Rule:** unavailable renders NO_DATA «—» not 0, not fabricated sentence — VERIFIED §14 + M9.

### Date-Range Filtering

- Current: scheduling uses bounded from/to window derived from mode (day/week) — VERIFIED
- Dashboard uses bounded useSessions window — VERIFIED but not date-range UI filter — gap A NOW
- Desired: dashboard filter bar with from/to (Jalali input via jalaliInput.ts shared boundary), presets today/week/month, bounded window same as scheduling, counts from total, truncation disclosed — A NOW frontend (client-side filter over already-loaded 500 rows), B server aggregation for large range
- Aggregation: meanOf/ratioPct/topBy already handle empty, but date-range aggregation should reuse same pure functions with filtered input — no duplicate engine

### Tabular Summary Reuse Canonical Calculation

- Export definition for dashboard: columns Metric/Value/Derivation, rows from same dashboardInsights derivation — A NOW
- Example: buildExportTable for dashboard could call dashboardInsights derivations and shape into table — reuse, not second math
- Filename: داشبورد-YYYY-MM-DD.csv with BOM — same as export architecture

### NO_DATA If Unavailable

- When input set empty → null → NO_DATA glyph — VERIFIED
- When measure has no authoritative seam (collected revenue) → NO_DATA, not 0, not fabricated — VERIFIED removal
- Test: dashboardInsightsLive.test asserts no NaN/Infinity in SVG attrs — VERIFIED
- Future: when finance domain exists, revenue becomes authoritative — then chart returns — B

### Dashboard Analytical Export (A NOW)

- Format csv/xlsx same as exportService
- Columns: metric Persian, value, derivation source, date-range
- Data: same as panels, via dashboardInsights.ts
- No fabricated: reads repos only
- Permission: reports.read? Or students.read? Currently dashboard view permission is students.read — keep same for export — needs decision
- Large-dataset: client capped 500, truncation disclosed, server aggregation B

## Classification

- A NOW: date-range UI filter (client-side over 500 rows), tabular summary export reuse canonical calc, NO_DATA honesty already, no fabricated
- B CONTRACT NOW BACKEND LATER: server aggregation for large date-range, revenue seam when finance domain exists, per-org scoping
- C DEFERRED: Finance/Reports domain (D6/I2), revenue chart until seam exists (already removed honest)

## Acceptance

- Every figure traced to record — map in M9 validation
- EMPTY renders «داده‌ای نیست» not number
- No NaN/Infinity in text or SVG
- No retired fixture sentence/figure survives — pinned by mutation with absurd values
- Unavailable measures render NO_DATA, not 0
- Date-range filtering reuses bounded window pattern, counts from total, truncation disclosed
- Tabular summary export reuses canonical calculation, no duplicate engine
- No fabricated measurements — enforced by dashboardInsightsLive.test + noSuccessWithoutWrite? Actually dashboard has no success toast — but privacyPosture checks fixture shown as real measurement removed

## Security / Honesty

- No fake success, no fabricated metric presented as measurement — D15
- No-data explicit typed value null → NO_DATA — D14
- No blanket || [] patches — stats.ts returns null — VERIFIED
