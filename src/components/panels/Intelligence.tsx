import { Activity, ChevronLeft, RefreshCw } from "lucide-react";
import strings from "@/assets/images/strings.jpg";
import type { IntelligenceCard } from "@/data/records";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { IntelligenceCardView } from "@/components/ds/blocks";
import { EmptyState, LoadingState } from "@/components/ds/states";
import type { DashboardCounts } from "@/domains/shared/dashboardInsights";
import { cn } from "@/utils/cn";

/**
 * Academy intelligence.
 *
 * M9/H4: the cards are derived from stored records by `useDashboardInsights` and
 * passed in. The header used to promise «۳ نکته … الگوی مفهومی با دادهٔ نمایشی»
 * while the footer admitted «دادهٔ نمایشی» — a fabricated count of fabricated
 * cards. Now the count is the number of cards the records produced, the footer
 * names how many records that was, and an academy with nothing stored says
 * «داده‌ای نیست» instead of showing somebody else's academy.
 *
 * The refresh control re-reads the repositories through the same hook; the
 * spinner is the read's own state. It used to animate a 1400ms timer and then
 * announce «تحلیل به‌روز شد» — a success message for a delay, not for a read.
 */
export function Intelligence({
  cards,
  counts,
  hasRecords,
  loading,
  onRefresh,
  className,
}: {
  cards: IntelligenceCard[];
  counts: DashboardCounts;
  hasRecords: boolean;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}) {
  const { navigate } = useApp();

  return (
    <section
      className={cn("relative flex flex-col overflow-hidden rounded-2xl border border-violet-500/15 bg-ink-900", className)}
      aria-labelledby="intel-title"
    >
      {/* resonance texture — piano strings, kept far in the background */}
      <img src={strings} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-[0.16]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink-900/30 via-ink-900/88 to-ink-900" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-violet-400/60 to-transparent" />

      <div className="relative flex flex-1 flex-col p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 text-violet-300" aria-hidden>
              <Activity className="size-4" strokeWidth={1.8} />
            </span>
            <div>
              <h2 id="intel-title" className="text-[15px] font-semibold leading-none text-ink-50">
                هوش آموزشگاه
              </h2>
              <p className="mt-1.5 text-xs text-ink-300">
                {hasRecords
                  ? `${faNum(cards.length)} نکته از رکوردهای همین محیط`
                  : "داده‌ای نیست"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="بازخوانی تحلیل"
            title="بازخوانی از رکوردها"
            className="flex size-8 items-center justify-center rounded-lg border border-white/[0.07] text-ink-300 transition-colors hover:border-violet-400/30 hover:text-violet-300 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin-slow")} />
          </button>
        </header>

        <div className="mt-5 flex-1" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <LoadingState tone="violet" label="در حال خواندن رکوردهای آموزشگاه…" className="py-14" />
          ) : cards.length > 0 ? (
            <div className="stagger grid gap-3 lg:grid-cols-3 xl:grid-cols-1">
              {cards.map((card, i) => (
                <IntelligenceCardView key={card.id} card={card} index={i} onAction={() => navigate(card.action.target)} />
              ))}
            </div>
          ) : (
            <EmptyState
              className="py-9"
              title={hasRecords ? "نکته‌ای برای نمایش نیست" : "داده‌ای نیست"}
              description={
                hasRecords
                  ? "رکوردهای فعلی چیزی برای گزارش ندارند؛ هر نکته از یک قاعده روی همان رکوردها ساخته می‌شود."
                  : "هنوز رکوردی در این محیط ثبت نشده است؛ با ثبت اولین هنرجو، کلاس یا جلسه، تحلیل‌ها از همان داده ساخته می‌شوند."
              }
            />
          )}
        </div>

        <footer className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-[11px] text-ink-400">
          <span className="nums">
            منبع: {faNum(counts.records)} رکورد ذخیره‌شده · {faNum(counts.students)} هنرجو · {faNum(counts.classes)} کلاس ·{" "}
            {faNum(counts.sessions)} جلسه
          </span>
          <button type="button" onClick={() => navigate({ view: "reports" })} className="group inline-flex items-center gap-1 text-violet-300 hover:text-violet-200">
            همهٔ تحلیل‌ها
            <ChevronLeft className="size-3.5 transition-transform duration-[var(--eighth)] group-hover:-translate-x-0.5" />
          </button>
        </footer>
      </div>
    </section>
  );
}
