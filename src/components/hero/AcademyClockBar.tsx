/**
 * The instrument row directly under the hero: clock · calendar · the working day
 * measured.
 *
 * WHY IT IS ITS OWN COMPONENT
 *
 * The time used to be a label inside the hero's waveform, frozen at the demo
 * instant (10:47) because the demo clock never moved. Two separate complaints,
 * one fix: the clock reads the wall clock and ticks every second, and it lives
 * BELOW the hero rather than inside it, so the second hand is not competing with
 * the day's picture.
 *
 * It is isolated for performance as much as for layout: a seconds display
 * re-renders once a second, and that re-render must not drag the dashboard's
 * derived state (filters, aggregates, panels) with it. So this component owns
 * its own clock subscription (`useAcademyClock`) and reads nothing else.
 *
 * WHAT EACH PLATE CLAIMS — AND WHAT IT REFUSES TO
 *
 *   · the clock    — the device's own local time, ticking;
 *   · the calendar — the academy day, plus the working window the pulse is
 *                    drawn on (same `DAY_START`/`DAY_END` constants);
 *   · the meter    — how far through that SAME window the day now is.
 *
 * There is deliberately no "monthly goal" plate: the reference design shows one,
 * but this product has no goal record to measure, and a percentage nobody
 * recorded is exactly the kind of number these panels may not invent.
 *
 * TIME RUNS LEFT → RIGHT. Digits, the working-day meter and the axis are laid
 * out `dir="ltr"`: the interface is Persian and right-to-left, but a clock face
 * and a timeline are not prose, and mirroring them makes ۱۰:۴۷ read as ۴۷:۱۰.
 */
import { Clock, Sunrise, Sunset } from "lucide-react";
import { useAcademyClock } from "@/domains/shared/clock";
import { academyIsoDate } from "@/views/relations/academyDay";
import { faNum, faToday, minutesToFaTime, toFa } from "@/lib/format";
import { DAY_END, DAY_START } from "./PulseWaveform";
import { cn } from "@/utils/cn";

/** `HH:MM:SS`, Persian digits, left-to-right order. */
function clockFace(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return toFa(`${hh}:${mm}:${ss}`);
}

export function AcademyClockBar({ className }: { className?: string }) {
  const clock = useAcademyClock();
  const minutes = clock.getHours() * 60 + clock.getMinutes();
  const todayIso = academyIsoDate(clock);

  // How far the working day has run — the same window the pulse is drawn on, so
  // the meter and the wave above it describe one day.
  const span = Math.max(1, DAY_END - DAY_START);
  const pct = Math.min(100, Math.max(0, ((minutes - DAY_START) / span) * 100));
  const beforeOpen = minutes < DAY_START;
  const afterClose = minutes >= DAY_END;
  const minutesLeft = DAY_END - minutes;
  const state = beforeOpen
    ? `روز کاری از ${minutesToFaTime(DAY_START)} آغاز می‌شود`
    : afterClose
      ? "روز کاری پایان یافته است"
      : `${toFa(Math.floor(minutesLeft / 60))} ساعت و ${toFa(minutesLeft % 60)} دقیقه تا پایان روز کاری`;

  return (
    <section className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr]", className)} aria-label="ساعت و تقویم آموزشگاه">
      {/* the working day, measured — not a decoration */}
      <div className="surface flex flex-col justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="numeral text-[15px] font-semibold text-ink-50">
            {beforeOpen ? "پیش از آغاز" : afterClose ? "پایان‌یافته" : `${faNum(Math.round(pct))}٪ از روز کاری`}
          </span>
          <span className="text-[10.5px] text-ink-400">به‌اندازه‌گیری پنجرهٔ کاری امروز</span>
        </div>
        <div className="w-full" dir="ltr">
          <div className="relative h-1.5 w-full rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-300 transition-[width] duration-500 ease-linear"
              style={{ width: `${beforeOpen ? 0 : pct}%` }}
            />
            {/* the now-pin: where inside the window this instant is */}
            <span
              className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border border-gold-300/70 bg-gold-400 shadow-[0_0_12px_-2px_var(--accent-500)] transition-[left] duration-500 ease-linear"
              style={{ left: `calc(${beforeOpen ? 0 : pct}% - 5px)` }}
              aria-hidden
            />
          </div>
          <div className="mt-2 text-[10.5px] text-ink-400" dir="rtl">
            {state}
          </div>
        </div>
      </div>

      {/* the day it belongs to */}
      <div className="surface flex flex-col justify-between gap-3 px-4 py-3.5 sm:px-5">
        <span className="truncate text-[12.5px] font-medium text-ink-100">{faToday(todayIso)}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
          <Sunrise className="size-3 text-gold-400/80" strokeWidth={1.8} />
          <span className="numeral" dir="ltr">
            {minutesToFaTime(DAY_START)}
          </span>
          <span className="text-ink-500">·</span>
          <Sunset className="size-3 text-violet-400/80" strokeWidth={1.8} />
          <span className="numeral" dir="ltr">
            {minutesToFaTime(DAY_END)}
          </span>
          <span className="text-ink-500">·</span>
          <span>پنجرهٔ کاری</span>
        </span>
      </div>

      {/* the clock itself — left-to-right, tabular, ticking */}
      <div className="surface flex items-center gap-3 px-4 py-3.5 sm:px-5" dir="ltr">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold-500/30 bg-gradient-to-br from-gold-500/15 to-transparent text-gold-300">
          <Clock className="size-[18px]" strokeWidth={1.8} />
        </span>
        <span className="flex min-w-0 flex-col leading-none">
          <span className="numeral text-[22px] font-semibold text-ink-50 sm:text-[24px]">{clockFace(clock)}</span>
          <span className="mt-1.5 text-[10.5px] text-ink-400" dir="rtl">
            زمان محلی دستگاه · هر ثانیه
          </span>
        </span>
      </div>
    </section>
  );
}
