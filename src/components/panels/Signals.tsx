import type { Signal } from "@/lib/viewContracts";
import { useApp } from "@/context/AppContext";
import { SignalBlock } from "@/components/ds/blocks";
import { Surface } from "@/components/ds/primitives";
import { LoadingState } from "@/components/ds/states";
import { cn } from "@/utils/cn";

/**
 * The four signals.
 *
 * REVISED FOR THE STAGE LANGUAGE. This row used to be one plane cut into four
 * cells by hairlines — an explicit reaction to four separate boxes that read as
 * unrelated cards. The reference design the product now follows makes the
 * opposite call: the KPI row is four floating slabs with the stage showing
 * between them, each carrying its own label, figure, chart and delta. What the
 * old comment was protecting against is preserved by the CONTENT and the
 * spacing rather than by the shared border: all four read from one read set, so
 * they cannot disagree, and they sit on a common grid with one rhythm.
 *
 * M9/H4: the signals are passed in, derived from stored records by
 * `useDashboardInsights`. This component renders them and nothing else — it has
 * no fixture to fall back on, and a signal whose records carry no history gets
 * `series: null`, which `SignalBlock` renders as `NO_DATA` instead of a trend.
 */
export function Signals({ signals, loading, className }: { signals: Signal[]; loading?: boolean; className?: string }) {
  const { navigate } = useApp();

  if (loading) {
    return (
      <Surface className={cn("overflow-hidden", className)} aria-label="سیگنال‌های اصلی" aria-busy>
        <LoadingState label="در حال خواندن رکوردهای آموزشگاه…" className="py-10" />
      </Surface>
    );
  }

  return (
    <div
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}
      aria-label="سیگنال‌های اصلی"
    >
      {signals.map((s, i) => (
        <Surface
          key={s.id}
          className="animate-phrase-in overflow-hidden transition-colors hover:border-gold-500/25"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <SignalBlock signal={s} onOpen={() => navigate(s.target)} />
        </Surface>
      ))}
    </div>
  );
}
