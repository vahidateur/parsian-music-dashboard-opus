import { useHeroStats } from "@/domains/shared/useAcademyMetrics";
import { faNum } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useApp } from "@/context/AppContext";
import { Hero } from "@/components/hero/Hero";
import { PulseWaveform } from "@/components/hero/PulseWaveform";
import { Signals } from "@/components/panels/Signals";
import { Attention, QuickActions, TodayFlow } from "@/components/panels/AttentionAndFlow";
import { Intelligence } from "@/components/panels/Intelligence";
import { BusinessIntelligence, EcosystemStrip } from "@/components/panels/BusinessIntelligence";
import { SectionHeader, Surface } from "@/components/ds/primitives";
import { DemoNote } from "@/components/ds/states";

/** Mobile-only: the pulse + today's numbers as a compact card (desktop shows them inside the hero). */
function PulseCard() {
  const { navigate, accent } = useApp();
  const { stats: heroStats } = useHeroStats();
  return (
    <Surface className="p-5">
      <SectionHeader title="نبض آموزشگاه" kicker="فعالیت امروز · اوج ۱۴:۰۰ تا ۱۵:۰۰ · ۱ نقطهٔ توجه" />
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        {heroStats.map((s) => (
          <button key={s.label} type="button" onClick={() => navigate(s.target)} className="text-right">
            <div className="nums text-2xl font-semibold leading-none text-ink-50">
              {faNum(s.value)}
              {s.suffix && <span className="text-base text-ink-300">{s.suffix}</span>}
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

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:gap-5">
      {/* 1 · Hero / academy context */}
      <div className="order-1 lg:order-none lg:col-span-12">
        <Hero compact={!isDesktop} />
      </div>

      {/* 2 · Today's key metrics */}
      <div className="order-2 lg:order-none lg:col-span-12">
        <Signals />
      </div>

      {/* 3 · Needs attention */}
      <div className="order-3 lg:order-none lg:col-span-6 xl:col-span-4">
        <Attention className="h-full" />
      </div>

      {/* 4 · Today's schedule */}
      <div className="order-4 lg:order-none lg:col-span-6 xl:col-span-4">
        <TodayFlow className="h-full" />
      </div>

      {/* Pulse (mobile only) */}
      {!isDesktop && (
        <div className="order-5">
          <PulseCard />
        </div>
      )}

      {/* 5 · Academy intelligence */}
      <div className="order-6 lg:order-none lg:col-span-12 xl:col-span-4">
        <Intelligence className="h-full" />
      </div>

      {/*
        6 · Selective analytics.
        CURATED DEMO PRESENTATION: 30-day trends, revenue and retention cohorts
        need server-side aggregation over historical data the client does not
        hold. The figures below are illustrative, and the note says so rather
        than letting them pass as live metrics (§8/§37).
      */}
      <div className="order-7 lg:order-none lg:col-span-12 lg:mt-4">
        <BusinessIntelligence />
        <DemoNote
          className="mt-3"
          text="نمودارهای تحلیلی این بخش نمایشی‌اند و برای محاسبهٔ واقعی به جمع‌بندی سمت سرور روی دادهٔ تاریخی نیاز دارند. شمارنده‌های بالای صفحه اما از دادهٔ واقعی همین محیط محاسبه می‌شوند."
        />
      </div>
      <div className="order-8 lg:order-none lg:col-span-12">
        <QuickActions />
      </div>
      <div className="order-9 lg:order-none lg:col-span-12">
        <EcosystemStrip />
      </div>
    </div>
  );
}
