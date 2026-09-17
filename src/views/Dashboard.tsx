import { useHeroStats, type HeroStat } from "@/domains/shared/useAcademyMetrics";
import { useDashboardInsights } from "@/domains/shared/useDashboardInsights";
import { useAcademyNow } from "@/domains/shared/clock";
import { academyIsoDate } from "@/views/relations/academyDay";
import { faNum, NO_DATA } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useApp } from "@/context/AppContext";
import { Hero } from "@/components/hero/Hero";
import { PulseWaveform } from "@/components/hero/PulseWaveform";
import { Signals } from "@/components/panels/Signals";
import { Attention, QuickActions, TodayFlow } from "@/components/panels/AttentionAndFlow";
import { Intelligence } from "@/components/panels/Intelligence";
import { BusinessIntelligence, EcosystemStrip } from "@/components/panels/BusinessIntelligence";
import { SectionHeader, Surface } from "@/components/ds/primitives";
import { DemoNote, ErrorState } from "@/components/ds/states";

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
}: {
  sessionsToday: number;
  attentionCount: number;
  hasRecords: boolean;
  loading: boolean;
  /** The same four figures the desktop hero renders, from the same one read. */
  stats: readonly HeroStat[];
}) {
  /*
   * No banner here and no read here: a failed read yields `null`, so these tiles
   * go silent on their own, and the single disclosure lives above the panels —
   * which is also why the figures arrive as a prop rather than as a second read.
   */
  const { navigate, accent } = useApp();
  const kicker = loading
    ? "فعالیت امروز · در حال خواندن رکوردها…"
    : !hasRecords
      ? "فعالیت امروز · هنوز رکوردی ثبت نشده"
      : `فعالیت امروز · ${faNum(sessionsToday)} جلسه روی تقویم · ${faNum(attentionCount)} مورد نیازمند پیگیری`;
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
        <PulseWaveform height={72} accent={accent} />
      </div>
    </Surface>
  );
}

export function Dashboard() {
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
  const insights = useDashboardInsights({ todayIso, nowMinutes: now });
  // The hero's four figures are read by the VIEW, once, and handed to both the
  // desktop hero and the mobile pulse card. Each surface calling the hook itself
  // would give each its own idea of whether the read succeeded — and a retry that
  // cleared one while the other still showed dashes.
  const hero = useHeroStats();
  const heroError = hero.error ?? insights.error;

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:gap-5">
      {/* 1 · Hero / academy context */}
      <div className="order-1 lg:order-none lg:col-span-12">
        <Hero compact={!isDesktop} stats={hero.stats} />
      </div>

      {/* 2 · Today's key metrics — derived from the record set read above */}
      <div className="order-2 lg:order-none lg:col-span-12 flex flex-col gap-5">
        {heroError !== null && (
          /*
            One disclosure for the whole page, naming the failure the read set
            already knew about instead of leaving it as a screenful of dashes:
            an unreadable academy and an empty one are different facts, and this
            product says which (D12). Retry re-reads both halves of what is on
            screen, the aggregate read included.
          */
          <ErrorState
            title="خواندن رکوردها کامل نشد"
            description="هیچ عددی روی این صفحه تا خواندنِ موفق نشان داده نمی‌شود؛ صفر، اندازه‌گیری نیست."
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
              sessionsToday={insights.flowSummary.total}
              attentionCount={insights.attention.length}
              hasRecords={insights.hasRecords}
              loading={insights.loading}
              stats={hero.stats}
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
