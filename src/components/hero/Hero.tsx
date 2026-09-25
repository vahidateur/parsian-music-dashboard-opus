import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import stage from "@/assets/images/stage-hall.jpg";
import type { HeroStat } from "@/domains/shared/useAcademyMetrics";
import { useAcademyNow } from "@/domains/shared/clock";
import type { DayPulse } from "@/domains/shared/useDayPulse";
import { useAuth } from "@/domains/auth/AuthContext";
import { useBranding } from "@/domains/branding/useBranding";
import { academyIsoDate } from "@/views/relations/academyDay";
import { faNum, faTime, faToday, greetingFor, minutesToFaTime, NO_DATA } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Segmented } from "@/components/ds/patterns";
import { PulseWaveform, toPulseSessions, DAY_START, DAY_END } from "./PulseWaveform";
import { cn } from "@/utils/cn";

/** The profile the hero's own period control switches. */
export type HeroPeriod = "today" | "week" | "month" | "13w";

/**
 * The academy's command plate — the reference design's hero.
 *
 * WHAT IT SAYS, AND WHAT IT REFUSES TO SAY
 *
 * Every figure on this plate is one the read set actually measured: the four
 * tiles arrive as `stats` (a `null` value renders as `NO_DATA`, never as a
 * zero), and the wave is drawn from the same session rows as the live count
 * (see `useDayPulse`). The period control is not decoration either — it is the
 * dashboard's own range filter, handed in as `period`/`onPeriod`, so switching
 * «هفته» here moves the same state the filter panel below shows. There is no
 * second source of truth for "which window is this page showing".
 *
 * The layout follows the reference: identity and date as a quiet kicker, the
 * greeting as the largest thing on the plate, the day's four figures in one row
 * behind hairline dividers, and the pulse — with its period control, its legend
 * and its hour axis — sitting along the bottom edge as the instrument panel.
 */
export function Hero({
  compact = false,
  stats: heroStats,
  pulse,
  period,
  onPeriod,
  headline,
  subline,
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
  /** The active range profile. Omitted → the control is not rendered at all. */
  period?: HeroPeriod;
  /** Switches the dashboard's range profile. Owned by the view, never mirrored here. */
  onPeriod?: (next: HeroPeriod) => void;
  /**
   * The plate's headline. Omitted means the signed-in operator's greeting —
   * the teacher desk passes its own («کلاس بعدی شما»), because for a teacher
   * the day's question is not who is at the desk but what is taught next.
   */
  headline?: string;
  /** Replaces the academy tagline under the headline. Inline content only. */
  subline?: ReactNode;
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
  // The playhead's place on the axis, in the same 0..100 space the hour labels
  // are laid out in — the marker is a measurement, not a bookmark.
  const nowPct = Math.min(100, Math.max(0, ((now - DAY_START) / Math.max(1, DAY_END - DAY_START)) * 100));

  return (
    <section
      className={cn("surface-ornate overflow-hidden", compact ? "min-h-[176px]" : "min-h-[372px]")}
      aria-labelledby="hero-title"
    >
      {/* Environment */}
      <img
        src={stage}
        alt=""
        aria-hidden
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-[36%_62%]",
          compact && "object-[42%_62%] opacity-90",
        )}
        style={{ filter: "saturate(1.02) contrast(1.06) brightness(1.02)" }}
      />
      {/*
        Light control, and nothing more than it: the hall has to stay visible or
        the plate is a black rectangle with a gradient on it. One wash anchored
        on the side the copy occupies, one short footing under the axis, and the
        spotlight in the photograph does the rest.
      */}
      <div className="absolute inset-0 bg-gradient-to-l from-ink-950 via-ink-950/72 to-ink-950/10" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 via-ink-950/45 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-[38%] bg-gradient-to-l from-ink-950/70 to-transparent" />

      {/*
        The gilt stem down the plate's start edge, with the academy's own mark at
        its head — the reference's hanging banner, rendered as our identity
        instead of somebody else's marketing line.
      */}
      {!compact && (
        <>
          <div
            className="pointer-events-none absolute inset-y-8 start-6 hidden w-px bg-gradient-to-b from-gold-500/40 via-gold-500/12 to-transparent lg:block"
            aria-hidden
          />
        </>
      )}

      <div className={cn("relative z-10 flex h-full flex-col", compact ? "p-5" : "p-6 sm:p-8 lg:p-10")}>
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

        {/* greeting — the largest thing on the plate, as in the reference */}
        <div className={cn("flex flex-col", compact ? "mt-4" : "mt-6 mx-auto w-full max-w-2xl items-center text-center")}>
          <h1
            id="hero-title"
            className={cn("font-bold tracking-tight text-ink-50", compact ? "text-2xl" : "text-3xl sm:text-[34px]")}
          >
            {headline ?? (
              <>
                <span className="inline-block origin-bottom-right" aria-hidden>
                  👋
                </span>{" "}
                {greetingFor(now)}
                {firstName ? `، ${firstName}` : ""}
              </>
            )}
          </h1>
          <p className={cn("flex flex-wrap items-center justify-center gap-2 text-ink-200", compact ? "mt-2 text-sm" : "mt-3 text-sm sm:text-[15px]")}>
            {subline ?? branding.tagline}
          </p>
        </div>

        {!compact && (
          <>
            {/* today's operational numbers — one row, hairline dividers, no cards */}
            <div
              className="mx-auto mt-7 flex flex-wrap items-stretch justify-center gap-y-4"
              role="list"
              aria-label="اعداد امروز"
            >
              {heroStats.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  role="listitem"
                  onClick={() => navigate(s.target)}
                  className={cn(
                    "group flex flex-col items-center text-center transition-colors",
                    i > 0 && "border-s border-white/[0.1]",
                    "px-6 sm:px-9",
                  )}
                >
                  <span className="numeral text-[30px] font-semibold leading-none text-ink-50 transition-colors group-hover:text-gold-300 sm:text-[34px]">
                    {/* `null` is the read saying it has no figure; the unit only
                        belongs to a number, so it goes silent with the value. */}
                    {s.value === null ? NO_DATA : faNum(s.value)}
                    {s.value !== null && s.suffix && <span className="text-lg text-ink-300">{s.suffix}</span>}
                  </span>
                  <span className="mt-2 flex items-center gap-1 text-[11.5px] text-ink-300">
                    {s.label}
                    <ChevronLeft className="size-3 opacity-0 transition-all duration-[var(--eighth)] group-hover:-translate-x-0.5 group-hover:opacity-100" />
                  </span>
                </button>
              ))}
            </div>

            {/* pulse — one day of the calendar, drawn left (opening) to right (closing) */}
            <div className="mt-auto pt-7">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[11px] text-ink-300">
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
                {/* The period control IS the dashboard's range filter — one state, two doors. */}
                {period && onPeriod && (
                  <Segmented
                    value={period}
                    onChange={onPeriod}
                    size="sm"
                    options={[
                      { value: "today", label: "امروز" },
                      { value: "week", label: "هفتگی" },
                      { value: "month", label: "ماهانه" },
                      { value: "13w", label: "۱۳ هفته" },
                    ]}
                  />
                )}
              </div>

              {/*
                The wave draws its own axis (hours positioned by the same
                percentage the line is drawn in, so they cannot drift apart).
                What is added here is the READOUT: the playhead's clock in a chip
                riding just above that axis, at the same fraction of the day.
              */}
              <div className="relative">
                <PulseWaveform height={104} accent={accent} sessions={waveSessions} now={now} loading={pulse.loading} />
                {now >= DAY_START && now <= DAY_END && !pulse.loading && (
                  <span
                    className="numeral pointer-events-none absolute bottom-[22px] -translate-x-1/2 rounded-md border border-gold-500/30 bg-ink-950/90 px-1.5 py-0.5 text-[10px] font-medium text-gold-300"
                    style={{ left: `${nowPct}%` }}
                    dir="ltr"
                    aria-hidden
                  >
                    {minutesToFaTime(now)}
                  </span>
                )}
              </div>

              {/* The legend names what is drawn, so the picture is a statement
                  about the calendar rather than decoration. */}
              <div className="mt-2 hidden flex-wrap items-center gap-3 text-[10.5px] text-ink-400 sm:flex" dir="rtl">
                <span className="flex items-center gap-1.5" title="بلندی موج در هر لحظه برابر است با تعداد کلاس‌هایی که همزمان برگزار می‌شوند">
                  <i className="block h-px w-4 bg-gold-400" /> کلاس همزمان
                </span>
                <span className="flex items-center gap-1.5" title="بازهٔ زمانی که دو کلاس یک اتاق را اشغال کرده‌اند">
                  <i className="block h-2.5 w-4 rounded-[2px] bg-warn-500/25 ring-1 ring-warn-500/40" /> تعارض اتاق
                </span>
                <span className="flex items-center gap-1.5" title="خط عمودی، لحظهٔ اکنون روی روز کاری">
                  <i className="block h-3 w-px bg-gold-400/70" /> اکنون
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
