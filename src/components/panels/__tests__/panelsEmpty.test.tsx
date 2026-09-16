// @vitest-environment jsdom
/**
 * The four insight panels over an input set that produced nothing.
 *
 * WHY THIS FILE EXISTS
 *
 * M9's done-when asks for a test that renders the dashboard in EMPTY and asserts
 * that no fabricated figure or sentence survives. The end-to-end half of that is
 * `src/views/__tests__/dashboardInsightsLive.test.tsx`, which walks the real
 * shell. This file covers the other direction — the panels handed the *results*
 * of an empty read, with no environment behind them at all:
 *
 *   - `BusinessIntelligence` with `[]` behind every one of its four charts (the
 *     second half of **I9**: the old `RevenueChart` read
 *     `revenueSeries[n - 1].value` and threw on an empty series);
 *   - `Signals`, `Attention`, `TodayFlow` and `Intelligence` with zero rows.
 *
 * Two different empty states are asserted throughout, because they are different
 * facts: «داده‌ای نیست» when the academy has no records, and a specific message
 * when it has records but nothing to report. Collapsing them would hide the
 * second behind the first.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { Attention, QuickActions, TodayFlow } from "@/components/panels/AttentionAndFlow";
import { BusinessIntelligence, EcosystemStrip } from "@/components/panels/BusinessIntelligence";
import { Intelligence } from "@/components/panels/Intelligence";
import { Signals } from "@/components/panels/Signals";
import {
  dashboardCounts,
  deriveOccupancy,
  deriveReceivables,
  deriveSignals,
  rosterSeries,
  type InsightInput,
} from "@/domains/shared/dashboardInsights";
import type { AcademyMetrics } from "@/domains/shared/useAcademyMetrics";
import { NO_DATA } from "@/lib/format";

/** Text that can only reach the DOM through an arithmetic or lookup mistake. */
const ARTEFACTS = ["NaN", "Infinity", "undefined", "[object Object]"] as const;

/** Sentences the panels used to print from fixtures, none of them derived. */
const RETIRED_SENTENCES = [
  "الگوی مفهومی با دادهٔ نمایشی",
  "دادهٔ نمایشی",
  "پایهٔ تحلیل: ۳۰ روز گذشته",
  "به‌روزرسانی ۲ دقیقه پیش",
  "اولویت‌بندی خودکار",
  "هم‌زمان با «پیانو پیشرفته»",
  "۹۸۷ نصب فعال",
  "۱۸ مدرس · ۷ آنلاین",
  "همگام‌سازی: ۲ دقیقه پیش",
] as const;

/** Numbers that only the retired fixtures carried. */
const RETIRED_FIGURES = ["۱٬۲۴۸", "۱۲۵٫۴", "۱۲۵٬۴۳۰٬۰۰۰", "۹۸۷", "۱۴۲"] as const;

const EMPTY_METRICS: AcademyMetrics = {
  students: 0,
  activeStudents: 0,
  atRiskStudents: 0,
  teachers: 0,
  activeTeachers: 0,
  classes: 0,
  rooms: 0,
  activeEnrollments: 0,
  waitlisted: 0,
  capacityUsedPct: 0,
  totalSeats: 0,
  takenSeats: 0,
  attendanceRatePct: null,
  attendanceSampleSize: 0,
};

const EMPTY_INPUT: InsightInput = {
  metrics: EMPTY_METRICS,
  students: [],
  classes: [],
  rooms: [],
  teachers: [],
  sessions: [],
  todayIso: "2026-09-01",
  nowMinutes: 10 * 60 + 47,
};

function panel(ui: ReactElement) {
  return render(<AppProvider>{ui}</AppProvider>);
}

function expectClean(container: HTMLElement, surface: string): void {
  const text = container.textContent ?? "";
  for (const artefact of ARTEFACTS) {
    expect(text, `${surface} rendered "${artefact}"`).not.toContain(artefact);
  }
  for (const sentence of RETIRED_SENTENCES) {
    expect(text, `${surface} printed the retired sentence "${sentence}"`).not.toContain(sentence);
  }
  for (const figure of RETIRED_FIGURES) {
    expect(text, `${surface} printed the retired figure "${figure}"`).not.toContain(figure);
  }
}

afterEach(cleanup);

describe("BusinessIntelligence over an empty record set", () => {
  function renderEmpty() {
    return panel(
      <BusinessIntelligence
        roster={rosterSeries([])}
        occupancy={deriveOccupancy([], [])}
        instruments={[]}
        receivables={deriveReceivables([])}
        students={0}
      />,
    );
  }

  it("renders NO_DATA for every chart instead of throwing on an empty series", () => {
    const { container } = renderEmpty();

    // I9: the old revenue chart read `revenueSeries[n - 1]` and threw here.
    expect(screen.getAllByText(NO_DATA).length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText("داده‌ای نیست").length).toBeGreaterThanOrEqual(4);
    expectClean(container, "business intelligence");
  });

  it("keeps all four chart titles, so an empty academy still shows its structure", () => {
    renderEmpty();
    for (const title of ["مانده بدهی", "رشد هنرجویان", "اشغال کلاس‌ها", "سازهای محبوب"]) {
      expect(screen.getByText(title), `${title} must render`).toBeTruthy();
    }
  });

  it("does not render the retired revenue chart at all", () => {
    const { container } = renderEmpty();
    // Collected revenue has no authoritative source in this phase (D6), so the
    // chart was removed rather than recomputed client-side.
    expect(container.textContent).not.toContain("درآمد");
    expect(container.textContent).not.toContain("هدف");
  });
});

describe("Signals over an empty record set", () => {
  it("shows NO_DATA for every ratio and never a zero it did not measure", () => {
    const { container } = panel(<Signals signals={deriveSignals(EMPTY_INPUT)} />);

    expect(screen.getAllByText(NO_DATA).length).toBeGreaterThanOrEqual(3);
    // The count tiles are real zeros; the ratio tabs are absent values.
    expect(screen.getByText("هنرجویان نیازمند توجه")).toBeTruthy();
    expectClean(container, "signals");
  });

  it("draws no trend where no history exists", () => {
    const { container } = panel(<Signals signals={deriveSignals(EMPTY_INPUT)} />);

    // A measure with no history carries `series: null`, and the chart slot says
    // so. The weekly session counts are the exception and correctly so: thirteen
    // measured weeks of zero sessions is a measurement, not a fabricated shape.
    const seriesStates = deriveSignals(EMPTY_INPUT).map((signal) => signal.series === null);
    expect(seriesStates.filter(Boolean).length).toBeGreaterThanOrEqual(2);

    const sparklineGlyphs = [...container.querySelectorAll("svg text")].filter((node) => node.textContent === NO_DATA);
    expect(sparklineGlyphs.length).toBe(seriesStates.filter(Boolean).length);
  });
});

describe("the attention queue and today's flow over an empty academy", () => {
  const counts = dashboardCounts({ students: [], classes: [], rooms: [], teachers: 0, sessions: [] });

  it("says «داده‌ای نیست» rather than listing alerts nobody raised", () => {
    const { container } = panel(
      <Attention items={[]} counts={counts} hasRecords={false} />,
    );

    expect(screen.getByText("داده‌ای نیست")).toBeTruthy();
    expectClean(container, "attention");
  });

  it("distinguishes 'no records' from 'records and nothing to report'", () => {
    cleanup();
    panel(<Attention items={[]} counts={{ ...counts, records: 12, students: 4 }} hasRecords />);
    expect(screen.getByText("موردی برای توجه نیست")).toBeTruthy();
  });

  it("says today has no sessions when the academy has records but no calendar", () => {
    const { container } = panel(
      <TodayFlow rows={[]} summary={{ total: 0, remaining: 0, cancelled: 0, shown: 0 }} hasRecords />,
    );

    expect(screen.getByText("امروز جلسه‌ای ثبت نشده")).toBeTruthy();
    expectClean(container, "today flow");
  });
});

describe("Intelligence over an empty academy", () => {
  const counts = dashboardCounts({ students: [], classes: [], rooms: [], teachers: 0, sessions: [] });

  it("does not count cards it did not derive", () => {
    const { container } = panel(<Intelligence cards={[]} counts={counts} hasRecords={false} />);

    // Twice on purpose: the header count line and the empty state both say it.
    expect(screen.getAllByText("داده‌ای نیست").length).toBeGreaterThan(0);
    // The old header promised «۳ نکته …» before any data existed.
    expect(container.textContent).not.toContain("۳ نکته");
    expectClean(container, "intelligence");
  });

  it("keeps its navigation, which does not depend on having records", () => {
    panel(<Intelligence cards={[]} counts={counts} hasRecords={false} />);
    expect(screen.getByRole("button", { name: "همهٔ تحلیل‌ها" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "بازخوانی تحلیل" })).toBeTruthy();
  });
});

describe("quick actions and the ecosystem strip", () => {
  it("offers the same four actions without carrying a figure", () => {
    const { container } = panel(<QuickActions />);
    for (const label of ["افزودن هنرجو", "برنامه‌ریزی کلاس", "ثبت پرداخت", "ارسال پیام"]) {
      expect(screen.getByText(label), `${label} must render`).toBeTruthy();
    }
    expectClean(container, "quick actions");
  });

  it("states the environment's own totals instead of install counts and sync times", () => {
    const { container } = panel(<EcosystemStrip counts={{ students: 0, classes: 0, rooms: 0, teachers: 0, sessions: 0, records: 0 }} />);

    expect(container.textContent).toContain("۰ رکورد در همین محیط");
    expectClean(container, "ecosystem strip");
  });
});
