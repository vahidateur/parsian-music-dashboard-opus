import { ChevronLeft } from "lucide-react";
import hall from "@/assets/images/hall.jpg";
import type { HeroStat } from "@/domains/shared/useAcademyMetrics";
import { useAcademyNow } from "@/domains/shared/clock";
import { useDayPulse } from "@/domains/shared/useDayPulse";
import { useAuth } from "@/domains/auth/AuthContext";
import { useBranding } from "@/domains/branding/useBranding";
import { academyIsoDate } from "@/views/relations/academyDay";
import { faNum, faTime, faToday, greetingFor, NO_DATA } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { PulseWaveform } from "./PulseWaveform";
import { cn } from "@/utils/cn";

export function Hero({
  compact = false,
  stats: heroStats,
}: {
  compact?: boolean;
  /**
   * The four figures, read once by the view.
   *
   * The Hero used to call `useAcademyMetrics` itself. It no longer does: a second
   * instance of the same read inside one view can disagree with the first — the
   * alert clearing while the tiles stayed withheld — and `Dashboard` is the place
   * that owns the read set (see `useDashboardInsights`' header for the rule).
   * A `null` figure is an unavailable read, not a zero.
   */
  stats: readonly HeroStat[];
}) {
  const { navigate, accent } = useApp();
  const now = useAcademyNow();
  // Identity (M10/D3): the academy name/tagline come from the M8 branding
  // read; the greeting is the signed-in operator, not a fixture manager.
  const { branding } = useBranding();
  const { user } = useAuth();
  const firstName = user?.name.trim().split(/\s+/)[0] ?? null;
  // Live/attention (M10/F3): derived from the scheduling seam, not a fixture.
  const pulse = useDayPulse(academyIsoDate(), now);

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-900",
        compact ? "min-h-[168px]" : "min-h-[360px]",
      )}
      aria-labelledby="hero-title"
    >
      {/* Environment */}
      <img
        src={hall}
        alt=""
        aria-hidden
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-left opacity-90",
          compact && "object-[30%_center]",
        )}
        style={{ filter: "saturate(0.9) contrast(1.02)" }}
      />
      {/* Light control: keep the data legible, let the hall breathe on the far side */}
      <div className="absolute inset-0 bg-gradient-to-l from-ink-950 via-ink-950/88 to-ink-950/20" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-ink-950/60 to-transparent" />

      <div className={cn("relative z-10 flex h-full flex-col", compact ? "p-5" : "p-6 sm:p-8 lg:p-9")}>
        {/* kicker */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-300">
          <span className="inline-flex items-center gap-2 text-gold-400">
            <span className="relative flex size-1.5">
              <span className="ring-live absolute inline-flex size-1.5 rounded-full bg-gold-500" />
              <span className="relative inline-flex size-1.5 rounded-full bg-gold-400" />
            </span>
            نبض آموزشگاه
          </span>
          <span className="text-ink-500">·</span>
          <span>{faToday()}</span>
          <span className="hidden text-ink-500 sm:inline">·</span>
          <span className="hidden sm:inline">{branding.academyName}</span>
        </div>

        {/* greeting */}
        <div className="mt-4 sm:mt-5">
          <h1 id="hero-title" className={cn("font-bold tracking-tight text-ink-50", compact ? "text-2xl" : "text-3xl sm:text-4xl")}>
            {greetingFor(now)}{firstName ? `، ${firstName}` : ""}{" "}
            <span className="inline-block origin-bottom-right" aria-hidden>
              👋
            </span>
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-200 sm:text-[15px]">
            {branding.tagline}
          </p>
        </div>

        {!compact && (
          <>
            {/* today's operational numbers */}
            <div className="mt-7 flex flex-wrap items-stretch gap-y-4" role="list" aria-label="اعداد امروز">
              {heroStats.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  role="listitem"
                  onClick={() => navigate(s.target)}
                  className={cn(
                    "group flex flex-col items-start text-right transition-colors",
                    i > 0 && "border-r border-white/[0.09] pr-6 sm:pr-8",
                    "pl-6 sm:pl-8",
                  )}
                >
                  <span className="nums text-2xl font-semibold leading-none text-ink-50 transition-colors group-hover:text-gold-300 sm:text-[28px]">
                    {/* `null` is the read saying it has no figure; the unit only
                        belongs to a number, so it goes silent with the value. */}
                    {s.value === null ? NO_DATA : faNum(s.value)}
                    {s.value !== null && s.suffix && <span className="text-lg text-ink-300">{s.suffix}</span>}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1 text-xs text-ink-300">
                    {s.label}
                    <ChevronLeft className="size-3 opacity-0 transition-all duration-[var(--eighth)] group-hover:-translate-x-0.5 group-hover:opacity-100" />
                  </span>
                </button>
              ))}
            </div>

            {/* pulse */}
            <div className="mt-auto pt-8">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-300">
                <span className="flex items-center gap-2">
                  <span className="text-ink-200">ریتم امروز</span>
                  <span className="text-ink-500">·</span>
                  <span>
                    {pulse.live > 0 ? `${faNum(pulse.live)} کلاس در حال برگزاری` : "بدون کلاس فعال"}
                  </span>
                  {pulse.conflicts > 0 && pulse.firstConflictStart && (
                    <>
                      <span className="text-ink-500">·</span>
                      <button type="button" onClick={() => navigate({ view: "schedule", filter: "conflict" })} className="text-warn-400 hover:underline">
                        {faNum(pulse.conflicts)} نقطهٔ توجه در {faTime(pulse.firstConflictStart)}
                      </button>
                    </>
                  )}
                </span>
                <span className="hidden items-center gap-3 sm:flex">
                  <span className="flex items-center gap-1.5">
                    <i className="block h-px w-4 bg-gold-400" /> فعالیت
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="block h-px w-4 bg-violet-400/70" /> رزونانس
                  </span>
                </span>
              </div>
              <PulseWaveform height={92} accent={accent} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
