import { lazy, Suspense, useMemo, useState } from "react";
import { useHeroStats, type HeroStat } from "@/domains/shared/useAcademyMetrics";
import { useDashboardInsights } from "@/domains/shared/useDashboardInsights";
import { useAcademyNow } from "@/domains/shared/clock";
import { useDayPulse } from "@/domains/shared/useDayPulse";
import { academyIsoDate } from "@/views/relations/academyDay";
import { faNum, NO_DATA } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { DayPulse } from "@/domains/shared/useDayPulse";
import { useApp } from "@/context/AppContext";
import { Hero } from "@/components/hero/Hero";
import { AcademyClockBar } from "@/components/hero/AcademyClockBar";
import { PulseWaveform, toPulseSessions } from "@/components/hero/PulseWaveform";
import { Signals } from "@/components/panels/Signals";
import { Attention, QuickActions, TodayFlow } from "@/components/panels/AttentionAndFlow";
import { Intelligence } from "@/components/panels/Intelligence";
import { BusinessIntelligence, EcosystemStrip } from "@/components/panels/BusinessIntelligence";
import { SectionHeader, Surface } from "@/components/ds/primitives";
import { DemoNote, ErrorState, LoadingState } from "@/components/ds/states";
import { useAuthSafe } from "@/domains/auth/AuthContext";
import { EntityExportButton } from "@/domains/export/EntityExportButton";
import { Button } from "@/components/ds/primitives";
import { Panel, Field, inputCls } from "@/components/ds/patterns";
import { addDays, isoToJalaliDisplay, jalaliToIso } from "@/domains/scheduling/dateBridge";

/** Mobile-only: the pulse + today's numbers as a compact card (desktop shows them inside the hero). */
/**
 * The mobile pulse card.
 *
 * M9/H4: its kicker read «فعالیت امروز · اوج ۱۴:۰۰ تا ۱۵:۰۰ · ۱ نقطهٔ توجه» —
 * a peak window and an attention count nobody computed, printed identically in an
 * academy with no records at all. Both figures now come from the same read set as
 * the panels below (`useDashboardInsights`), and an environment with no records
 * says so instead of claiming a quiet day.
 */
function PulseCard({
  sessionsToday,
  attentionCount,
  hasRecords,
  loading,
  stats: heroStats,
  pulse,
}: {
  /** `null` while the calendar read is unavailable; never a zero for it. */
  sessionsToday: number | null;
  attentionCount: number;
  hasRecords: boolean;
  loading: boolean;
  /** The same four figures the desktop hero renders, from the same one read. */
  stats: readonly HeroStat[];
  /** The same day-pulse read the desktop hero draws, so the two cannot differ. */
  pulse: DayPulse;
}) {
  /*
   * No banner here and no read here: a failed read yields `null`, so these tiles
   * go silent on their own, and the single disclosure lives above the panels —
   * which is also why the figures arrive as a prop rather than as a second read.
   */
  const { navigate, accent } = useApp();
  const pulseNow = useAcademyNow();
  const kicker = loading
    ? "فعالیت امروز · در حال خواندن رکوردها…"
    : !hasRecords
      ? "فعالیت امروز · هنوز رکوردی ثبت نشده"
      : [
          "فعالیت امروز",
          sessionsToday === null ? null : `${faNum(sessionsToday)} جلسه روی تقویم`,
          `${faNum(attentionCount)} مورد نیازمند پیگیری`,
        ]
          .filter((part): part is string => part !== null)
          .join(" · ");
  return (
    <Surface className="p-5">
      <SectionHeader title="نبض آموزشگاه" kicker={kicker} />
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        {heroStats.map((s) => (
          <button key={s.label} type="button" onClick={() => navigate(s.target)} className="text-right">
            <div className="nums text-2xl font-semibold leading-none text-ink-50">
              {/* Same rule as the desktop hero: no figure, no number. */}
              {s.value === null ? NO_DATA : faNum(s.value)}
              {s.value !== null && s.suffix && <span className="text-base text-ink-300">{s.suffix}</span>}
            </div>
            <div className="mt-1 text-xs text-ink-300">{s.label}</div>
          </button>
        ))}
      </div>
      <div className="mt-5">
        <PulseWaveform
          height={72}
          accent={accent}
          now={pulseNow}
          sessions={toPulseSessions(pulse.sessions, pulse.clashIds)}
          loading={pulse.loading}
        />
      </div>
    </Surface>
  );
}

/**
 * The teaching desk, pulled from the academic-workspace group.
 *
 * `Dashboard` is the landing view, so it is part of the entry chunk; the whole
 * teacher rendition therefore arrives through the lazy group the academic
 * surfaces already share, and the entry bundle carries none of it. Only a
 * teacher ever triggers the fetch — the management body below is untouched.
 */
const TeacherDesk = lazy(() =>
  import("@/views/lazy/academicViews").then((module) => ({ default: module.TeacherDashboard })),
);

export function Dashboard() {
  const { user } = useAuthSafe();
  if (user?.role === "teacher") {
    return (
      <Suspense fallback={<LoadingState label="در حال آماده‌سازی میز کار…" className="py-16" />}>
        <TeacherDesk />
      </Suspense>
    );
  }
  return <ManagementDashboard />;
}

function ManagementDashboard() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  /*
    The academy clock is read ONCE, in the view: `academyIsoDate()` is the
    product's one calendar conversion and `useAcademyNow()` its one clock, so the
    window, the "today" filter and every status on this page describe one instant
    (views/relations/academyDay.ts). The read set behind them is one hook, so the
    panels cannot disagree with each other mid-write.
  */
  const now = useAcademyNow();
  const todayIso = academyIsoDate();

  // F5 date-range filtering — Jalali inputs with presets today/week/month, bounded window same as scheduling
  const [fromJalali, setFromJalali] = useState("");
  const [toJalali, setToJalali] = useState("");
  const [rangePreset, setRangePreset] = useState<"13w" | "today" | "week" | "month">("13w");

  const fromIso = useMemo(() => {
    if (!fromJalali) return undefined;
    return jalaliToIso(fromJalali) ?? undefined;
  }, [fromJalali]);
  const toIso = useMemo(() => {
    if (!toJalali) return undefined;
    return jalaliToIso(toJalali) ?? undefined;
  }, [toJalali]);

  const applyPreset = (preset: "today" | "week" | "month" | "13w") => {
    setRangePreset(preset);
    if (preset === "13w") {
      setFromJalali("");
      setToJalali("");
      return;
    }
    if (preset === "today") {
      const jalali = isoToJalaliDisplay(todayIso);
      setFromJalali(jalali);
      setToJalali(jalali);
      return;
    }
    if (preset === "week") {
      const from = addDays(todayIso, -6) ?? todayIso;
      setFromJalali(isoToJalaliDisplay(from));
      setToJalali(isoToJalaliDisplay(todayIso));
      return;
    }
    if (preset === "month") {
      const from = addDays(todayIso, -29) ?? todayIso;
      setFromJalali(isoToJalaliDisplay(from));
      setToJalali(isoToJalaliDisplay(todayIso));
      return;
    }
  };

  /*
    The day's pulse — live count, room clashes and the session rows behind the
    hero's wave. Read here, in the view, and handed to both the desktop hero and
    the mobile pulse card so one calendar read owns every projection of it.
  */
  const pulse = useDayPulse(todayIso, now);

  const insights = useDashboardInsights({
    todayIso,
    nowMinutes: now,
    from: fromIso,
    to: toIso,
  });
  // The hero's four figures are read by the VIEW, once, and handed to both the
  // desktop hero and the mobile pulse card. Each surface calling the hook itself
  // would give each its own idea of whether the read succeeded — and a retry that
  // cleared one while the other still showed dashes.
  const hero = useHeroStats();
  const heroError = hero.error ?? insights.error;

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:gap-5">
      {/* 1 · Hero / academy context */}
      <div className="order-1 lg:order-none lg:col-span-12 flex flex-col gap-3">
        {/* The hero's period control and the filter panel below are ONE state:
            switching «هفته» on the plate moves the same range the panel shows. */}
        <Hero compact={!isDesktop} stats={hero.stats} pulse={pulse} period={rangePreset} onPeriod={applyPreset} />
        {/* The live clock sits under the hero: seconds-precision time is a
            display concern, and keeping it out of the hero stops a once-a-second
            tick from re-rendering the day's picture. */}
        <AcademyClockBar />
      </div>

      {/* 2 · Today's key metrics — derived from the record set read above */}
      <div className="order-2 lg:order-none lg:col-span-12 flex flex-col gap-5">
        <Panel title="بازهٔ زمانی" kicker="فیلتر تاریخ شمسی — از همان مرزی که برنامه‌ریزی استفاده می‌کند — پیش‌فرض ۱۳ هفته">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="از تاریخ (شمسی YYYY/MM/DD)">
              {(control) => (
                <input
                  {...control}
                  className={inputCls}
                  dir="ltr"
                  placeholder="۱۴۰۴/۰۷/۰۱"
                  value={fromJalali}
                  onChange={(e) => {
                    setFromJalali(e.target.value);
                    setRangePreset("13w");
                  }}
                />
              )}
            </Field>
            <Field label="تا تاریخ (شمسی)">
              {(control) => (
                <input
                  {...control}
                  className={inputCls}
                  dir="ltr"
                  placeholder="۱۴۰۴/۰۷/۳۰"
                  value={toJalali}
                  onChange={(e) => {
                    setToJalali(e.target.value);
                    setRangePreset("13w");
                  }}
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant={rangePreset === "13w" ? "primary" : "subtle"} onClick={() => applyPreset("13w")}>
                ۱۳ هفته
              </Button>
              <Button size="sm" variant={rangePreset === "today" ? "primary" : "subtle"} onClick={() => applyPreset("today")}>
                امروز
              </Button>
              <Button size="sm" variant={rangePreset === "week" ? "primary" : "subtle"} onClick={() => applyPreset("week")}>
                هفته
              </Button>
              <Button size="sm" variant={rangePreset === "month" ? "primary" : "subtle"} onClick={() => applyPreset("month")}>
                ماه
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <EntityExportButton entity="dashboard" label="خروجی تحلیلی داشبورد" filters={{ ...(fromIso ? { from: fromIso } : {}), ...(toIso ? { to: toIso } : {}) }} />
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
            بازهٔ پیش‌فرض ۱۳ هفتهٔ اخیر تا امروز است — همان پنجره‌ای که نمودار هفتگی رسم می‌کند. فیلتر روی همین ۵۰۰ ردیفِ خوانده‌شده اعمال می‌شود
            (سمت کلاینت) و برای مجموعه‌های بزرگ سرور باید تجمیع کند. خروجی تحلیلی همین محاسبهٔ یکتا را دوباره استفاده می‌کند، نه موتور دوم.
            {(fromIso || toIso) && (
              <span className="ms-1">
                فیلتر فعال: {fromJalali || "—"} تا {toJalali || "—"} → {fromIso ?? "—"} تا {toIso ?? "—"}.
              </span>
            )}
          </p>
          {(fromJalali && !fromIso) || (toJalali && !toIso) ? (
            <p className="mt-2 text-[11px] text-warn-400">تاریخ شمسی نامعتبر است — قالب YYYY/MM/DD مثل ۱۴۰۴/۰۷/۰۱.</p>
          ) : null}
        </Panel>

        {heroError !== null && (
          /*
            One disclosure for the whole page, naming the failure the read set
            already knew about instead of leaving it as a screenful of dashes:
            an unreadable academy and an empty one are different facts, and this
            product says which (D12). A partial failure is the ordinary case —
            the aggregate read answers for its own tiles only — so the copy
            claims exactly what this disclosure owns: a tile keeps the figure its
            own read measured and shows NO_DATA otherwise. Retry re-reads both
            halves of what is on screen, the aggregate read included.
          */
          <ErrorState
            title="خواندن رکوردها کامل نشد"
            description="خواندن بعضی از رکوردها ناموفق بود؛ هر شاخص روی این صفحه فقط وقتی عدد دارد که خواندنش موفق بوده باشد، وگرنه «—» می‌ماند؛ صفر، اندازه‌گیری نیست."
            onRetry={() => {
              // Both halves at once, because both are on screen: the retry the
              // tiles answer to, and the one the read set answers to.
              hero.reload();
              insights.reload();
            }}
          />
        )}
        <Signals signals={insights.signals} loading={insights.loading} />
      </div>

      {/* 3 · Needs attention */}
      <div className="order-3 lg:order-none lg:col-span-6 xl:col-span-4">
        <Attention
          items={insights.attention}
          counts={insights.counts}
          hasRecords={insights.hasRecords}
          loading={insights.loading}
          className="h-full"
        />
      </div>

      {/* 4 · Today's schedule */}
      <div className="order-4 lg:order-none lg:col-span-6 xl:col-span-4">
        <TodayFlow
          rows={insights.flow}
          summary={insights.flowSummary}
          hasRecords={insights.hasRecords}
          loading={insights.loading}
          className="h-full"
        />
      </div>

      {/* Pulse (mobile only) */}
      {!isDesktop && (
        <div className="order-5">
          <PulseCard
              sessionsToday={insights.flowSummary?.total ?? null}
              attentionCount={insights.attention.length}
              hasRecords={insights.hasRecords}
              loading={insights.loading}
              stats={hero.stats}
              pulse={pulse}
            />
        </div>
      )}

      {/* 5 · Academy intelligence */}
      <div className="order-6 lg:order-none lg:col-span-12 xl:col-span-4">
        <Intelligence
          cards={insights.intelligence}
          counts={insights.counts}
          hasRecords={insights.hasRecords}
          loading={insights.loading}
          onRefresh={insights.reload}
          className="h-full"
        />
      </div>

      {/*
        6 · Selective analytics.

        M9/H4: these four charts are derived from the same record set as the rest
        of the page (see `domains/shared/dashboardInsights.ts`), so the note below
        no longer has to explain away illustrative figures — it only says what the
        demo environment *is*. Collected revenue is the one figure that is gone
        rather than recomputed: it needs the Finance/Reports domains, which are
        still planned (D6), and a client-side substitute would be a fabricated
        measurement (§15).
      */}
      <div className="order-7 lg:order-none lg:col-span-12 lg:mt-4">
        <BusinessIntelligence
          roster={insights.roster}
          occupancy={insights.occupancy}
          instruments={insights.instruments}
          receivables={insights.receivables}
          students={insights.counts.students}
          loading={insights.loading}
        />
        <DemoNote
          className="mt-3"
          text="همهٔ اعداد این بخش از رکوردهای همین محیط محاسبه می‌شوند؛ در حالت نمایشی این رکوردها همان دادهٔ نمونهٔ آوا هستند و پس از اتصال به سامانهٔ اصلی، همان محاسبه روی دادهٔ خود آموزشگاه انجام می‌شود."
        />
      </div>
      <div className="order-8 lg:order-none lg:col-span-12">
        <QuickActions />
      </div>
      <div className="order-9 lg:order-none lg:col-span-12">
        <EcosystemStrip counts={insights.counts} />
      </div>
    </div>
  );
}
