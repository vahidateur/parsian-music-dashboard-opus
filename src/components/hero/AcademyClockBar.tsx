/**
 * The academy clock — a live strip directly under the hero.
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
 * TIME RUNS LEFT → RIGHT. Digits, the working-day meter and the axis are laid
 * out `dir="ltr"`: the interface is Persian and right-to-left, but a clock face
 * and a timeline are not prose, and mirroring them makes ۱۰:۴۷ read as ۴۷:۱۰.
 */
import { Clock, Sunrise, Sunset } from "lucide-react";
import { useAcademyClock } from "@/domains/shared/clock";
import { academyIsoDate } from "@/views/relations/academyDay";
import { faToday, minutesToFaTime, toFa } from "@/lib/format";
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
    <section
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-2xl border border-white/[0.06] bg-ink-900/70 px-4 py-3 backdrop-blur-sm sm:px-5",
        className,
      )}
      aria-label="ساعت و تقویم آموزشگاه"
    >
      {/* the clock itself — left-to-right, tabular, ticking */}
      <div className="flex items-center gap-3" dir="ltr">
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
          <Clock className="size-4" strokeWidth={1.8} />
        </span>
        <span className="flex flex-col leading-none">
          <span className="nums text-[22px] font-semibold tracking-tight text-ink-50 sm:text-[26px]">
            {clockFace(clock)}
          </span>
          <span className="mt-1 text-[10.5px] text-ink-400" dir="rtl">
            زمان محلی دستگاه · به‌روزرسانی هر ثانیه
          </span>
        </span>
      </div>

      {/* the day it belongs to */}
      <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end" dir="rtl">
        <span className="truncate text-[12.5px] text-ink-100">{faToday(todayIso)}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
          <Sunrise className="size-3 text-gold-400/80" strokeWidth={1.8} />
          <span className="nums" dir="ltr">
            {minutesToFaTime(DAY_START)}
          </span>
          <Sunset className="size-3 text-violet-400/80" strokeWidth={1.8} />
          <span className="nums" dir="ltr">
            {minutesToFaTime(DAY_END)}
          </span>
        </span>
      </div>

      {/* the working day, measured — not a decoration */}
      <div className="w-full min-w-[180px] flex-1 sm:w-auto sm:max-w-[280px]" dir="ltr">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-300 transition-[width] duration-500 ease-linear"
            style={{ width: `${beforeOpen ? 0 : pct}%` }}
          />
        </div>
        <div className="mt-1.5 text-[10.5px] text-ink-400" dir="rtl">
          {state}
        </div>
      </div>
    </section>
  );
}
