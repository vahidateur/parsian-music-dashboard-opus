import { useState } from "react";
import { Activity, ChevronLeft, RefreshCw } from "lucide-react";
import strings from "@/assets/images/strings.jpg";
import { intelligenceCards } from "@/data/records";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { IntelligenceCardView } from "@/components/ds/blocks";
import { LoadingState } from "@/components/ds/states";
import { cn } from "@/utils/cn";

export function Intelligence({ className }: { className?: string }) {
  const { navigate, notify } = useApp();
  const [loading, setLoading] = useState(false);
  const [round, setRound] = useState(0);

  const refresh = () => {
    if (loading) return;
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setRound((r) => r + 1);
      notify({ tone: "info", title: "تحلیل به‌روز شد", detail: "بر پایهٔ داده‌های ۳۰ روز گذشته" });
    }, 1400);
  };

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
                {faNum(intelligenceCards.length)} نکته که ارزش توجه شما را دارند · الگوی مفهومی با دادهٔ نمایشی
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            aria-label="بازسازی تحلیل"
            title="بازسازی تحلیل"
            className="flex size-8 items-center justify-center rounded-lg border border-white/[0.07] text-ink-300 transition-colors hover:border-violet-400/30 hover:text-violet-300"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin-slow")} />
          </button>
        </header>

        <div className="mt-5 flex-1" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <LoadingState tone="violet" label="در حال گوش دادن به داده‌های آموزشگاه…" className="py-14" />
          ) : (
            <div key={round} className="stagger grid gap-3 lg:grid-cols-3 xl:grid-cols-1">
              {intelligenceCards.map((card, i) => (
                <IntelligenceCardView key={card.id} card={card} index={i} onAction={() => navigate(card.action.target)} />
              ))}
            </div>
          )}
        </div>

        <footer className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-[11px] text-ink-400">
          <span>پایهٔ تحلیل: ۳۰ روز گذشته · امروز ۰۶:۰۰ · دادهٔ نمایشی</span>
          <button type="button" onClick={() => navigate({ view: "reports" })} className="group inline-flex items-center gap-1 text-violet-300 hover:text-violet-200">
            همهٔ تحلیل‌ها
            <ChevronLeft className="size-3.5 transition-transform duration-[var(--eighth)] group-hover:-translate-x-0.5" />
          </button>
        </footer>
      </div>
    </section>
  );
}
