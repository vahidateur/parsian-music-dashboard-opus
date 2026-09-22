import { ChevronLeft } from "lucide-react";
import hall from "@/assets/images/hall.jpg";
import type { HeroStat } from "@/domains/shared/useAcademyMetrics";
import { useAcademyNow } from "@/domains/shared/clock";
import type { DayPulse } from "@/domains/shared/useDayPulse";
import { useAuth } from "@/domains/auth/AuthContext";
import { useBranding } from "@/domains/branding/useBranding";
import { academyIsoDate } from "@/views/relations/academyDay";
import { faNum, faTime, faToday, greetingFor, NO_DATA } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { PulseWaveform, toPulseSessions } from "./PulseWaveform";
import { cn } from "@/utils/cn";

export function Hero({
  compact = false,
  stats: heroStats,
  pulse,
}: {
  compact?: boolean;
  /**
   * The day's own pulse — live count, conflicts and the session rows the wave is
   * drawn from. Read ONCE by the view (`Dashboard`) and handed down, because the
   * mobile pulse card renders the same wave: two reads of the same day could
   * disagree mid-write, and the wave must not contradict the numbers beside it.
   */
  pulse: DayPulse;
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
  const todayIso = academyIsoDate();
  // Identity (M10/D3): the academy name/tagline come from the M8 branding
  // read; the greeting is the signed-in operator, not a fixture manager.
  const { branding } = useBranding();
  const { user } = useAuth();
  const firstName = user?.name.trim().split(/\s+/)[0] ?? null;
  // The wave is a picture of THESE rows — the same read the live count and the
  // conflict note come from, so the drawing can never disagree with the numbers.
  const waveSessions = toPulseSessions(pulse.sessions, pulse.clashIds);
  const scheduledToday = pulse.sessions.filter((s) => s.status !== "cancelled").length;

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
          <span>{faToday(todayIso)}</span>
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

            {/* pulse — one day of the calendar, drawn left (opening) to right (closing) */}
            <div className="mt-auto pt-8">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[11px] text-ink-300">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-200">ریتم امروز</span>
                  <span className="text-ink-500">·</span>
                  <span>
                    {pulse.loading
                      ? "در حال خواندن تقویم…"
                      : scheduledToday === 0
                        ? "جلسه‌ای روی تقویم نیست"
                        : `${faNum(scheduledToday)} جلسه — ${
                            pulse.live > 0 ? `${faNum(pulse.live)} در حال برگزاری` : "اکنون کلاسی در جریان نیست"
                          }`}
                  </span>
                  {pulse.conflicts > 0 && pulse.firstConflictStart && (
                    <>
                      <span className="text-ink-500">·</span>
                      <button type="button" onClick={() => navigate({ view: "schedule", filter: "conflict" })} className="text-warn-400 hover:underline">
                        {faNum(pulse.conflicts)} تعارض اتاق از {faTime(pulse.firstConflictStart)}
                      </button>
                    </>
                  )}
                </span>
                {/* The legend names what is drawn, so the picture is a statement
                    about the calendar rather than decoration. */}
                <span className="hidden items-center gap-3 sm:flex" dir="rtl">
                  <span className="flex items-center gap-1.5" title="بلندی موج در هر لحظه برابر است با تعداد کلاس‌هایی که همزمان برگزار می‌شوند">
                    <i className="block h-px w-4 bg-gold-400" /> کلاس همزمان
                  </span>
                  <span className="flex items-center gap-1.5" title="بازهٔ زمانی که دو کلاس یک اتاق را اشغال کرده‌اند">
                    <i className="block h-2.5 w-4 rounded-[2px] bg-warn-500/25 ring-1 ring-warn-500/40" /> تعارض اتاق
                  </span>
                  <span className="flex items-center gap-1.5" title="خط عمودی، لحظهٔ اکنون روی روز کاری">
                    <i className="block h-3 w-px bg-gold-400/70" /> اکنون
                  </span>
                </span>
              </div>
              <PulseWaveform height={92} accent={accent} sessions={waveSessions} now={now} loading={pulse.loading} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
