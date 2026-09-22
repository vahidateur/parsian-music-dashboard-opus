/**
 * The academy day, drawn.
 *
 * WHAT THE WAVE IS
 *
 * A single day of the calendar, left (opening) to right (closing). At every
 * instant the height of the line is the number of classes running at once — a
 * peak is a busy hour, a flat stretch is an empty room. The amber band marks a
 * window where two classes share a room, and the vertical hairline is *now*.
 * Nothing here is decorative content: the shape is computed from the same
 * session rows the dashboard's flow list and the top bar's live count read
 * (`domains/shared/useDayPulse`), so an academy with an empty calendar draws an
 * empty day and says so instead of breathing a fake pulse.
 *
 * It replaced a curated demo envelope (thirteen hardcoded slots labelled
 * «فعالیت» and «رزونانس») that looked identical in every environment — a
 * pretty picture of nothing.
 *
 * TIME RUNS LEFT → RIGHT. The rest of the interface is right-to-left, but a
 * timeline is not prose: a day that starts on the right and ends on the left
 * reads as a countdown. The axis, the playhead and the hover readout are all
 * laid out in that direction, and the container is marked `dir="ltr"` so the
 * browser does not mirror them.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { academyNowMinutes } from "@/domains/shared/clock";
import type { Session } from "@/domains/scheduling/types";
import { minutesToFaTime, parseTime, toFa } from "@/lib/format";
import { accentHex, hexA, type Accent } from "@/lib/theme";
import { cn } from "@/utils/cn";

/** Default day axis — the academy's working day. */
export const DAY_START = 8 * 60;
export const DAY_END = 21 * 60;

const SAMPLES = 260;

/** One row the wave needs: a session's span and what happened to it. */
export interface PulseSession {
  id: string;
  start: string;
  end: string;
  cancelled?: boolean;
  clash?: boolean;
}

/** Adapts the scheduling domain's rows to the wave's minimal shape. */
export function toPulseSessions(sessions: readonly Session[], clashIds?: ReadonlySet<string>): PulseSession[] {
  return sessions.map((session) => ({
    id: session.id,
    start: session.startTime,
    end: session.endTime,
    cancelled: session.status === "cancelled",
    clash: clashIds?.has(session.id) ?? false,
  }));
}

interface Envelopes {
  /** Concurrent, non-cancelled classes at each sample, normalized 0..1. */
  density: Float32Array;
  /** 1 where a room clash is running. */
  attention: Float32Array;
  /** Raw concurrency, for the hover readout. */
  count: Float32Array;
  /** The widest hour of the day (peak concurrency), or null on an empty day. */
  peak: { start: number; end: number; count: number } | null;
}

function buildEnvelopes(sessions: readonly PulseSession[], dayStart: number, dayEnd: number): Envelopes {
  const range = Math.max(1, dayEnd - dayStart);
  const raw = new Float32Array(SAMPLES);
  const att = new Float32Array(SAMPLES);
  const spans = sessions
    .filter((s) => !s.cancelled)
    .map((s) => ({ start: parseTime(s.start), end: parseTime(s.end), clash: s.clash }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);

  for (let i = 0; i < SAMPLES; i += 1) {
    const t = dayStart + (i / (SAMPLES - 1)) * range;
    let count = 0;
    let attention = 0;
    for (const span of spans) {
      if (t >= span.start && t < span.end) {
        count += 1;
        if (span.clash) attention = 1;
      }
    }
    raw[i] = count;
    att[i] = attention;
  }

  // Gaussian smoothing, so the pulse reads as a phrase rather than a staircase.
  const sigma = 5;
  const kernel: number[] = [];
  for (let j = -sigma * 3; j <= sigma * 3; j += 1) kernel.push(Math.exp(-(j * j) / (2 * sigma * sigma)));
  const kernelSum = kernel.reduce((a, b) => a + b, 0);
  const smooth = (source: Float32Array) => {
    const out = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i += 1) {
      let acc = 0;
      for (let j = 0; j < kernel.length; j += 1) {
        const idx = Math.min(SAMPLES - 1, Math.max(0, i + j - sigma * 3));
        acc += source[idx] * kernel[j];
      }
      out[i] = acc / kernelSum;
    }
    return out;
  };

  const density = smooth(raw);
  const attention = smooth(att);
  const maxCount = Math.max(...Array.from(raw), 1);
  for (let i = 0; i < SAMPLES; i += 1) density[i] = density[i] / maxCount;

  // The busiest hour: the widest window at peak concurrency, reported whole
  // hours so the caption can say something a person can act on.
  let peak: Envelopes["peak"] = null;
  if (spans.length > 0) {
    let best = 0;
    for (let hour = Math.floor(dayStart / 60); hour < Math.ceil(dayEnd / 60); hour += 1) {
      const at = Math.min(SAMPLES - 1, Math.max(0, Math.round(((hour * 60 + 30 - dayStart) / range) * (SAMPLES - 1))));
      best = Math.max(best, Math.round(raw[at]));
    }
    if (best > 0) {
      const firstHour = (() => {
        for (let hour = Math.floor(dayStart / 60); hour < Math.ceil(dayEnd / 60); hour += 1) {
          const at = Math.min(SAMPLES - 1, Math.max(0, Math.round(((hour * 60 + 30 - dayStart) / range) * (SAMPLES - 1))));
          if (Math.round(raw[at]) === best) return hour;
        }
        return Math.floor(dayStart / 60);
      })();
      peak = { start: firstHour * 60, end: firstHour * 60 + 60, count: best };
    }
  }

  return { density, attention, count: raw, peak };
}

const sampleAt = (arr: Float32Array, pos: number) => {
  const f = Math.min(SAMPLES - 1, Math.max(0, pos * (SAMPLES - 1)));
  const i = Math.floor(f);
  const j = Math.min(SAMPLES - 1, i + 1);
  const r = f - i;
  return arr[i] * (1 - r) + arr[j] * r;
};

export function PulseWaveform({
  className,
  height = 96,
  showAxis = true,
  now = academyNowMinutes(),
  accent = "gold",
  sessions = [],
  dayStart = DAY_START,
  dayEnd = DAY_END,
  loading = false,
}: {
  className?: string;
  height?: number;
  showAxis?: boolean;
  now?: number;
  accent?: Accent;
  /** Today's rows. Absent rows mean an empty day, which is drawn as one. */
  sessions?: readonly PulseSession[];
  dayStart?: number;
  dayEnd?: number;
  /** While the calendar read is in flight the wave draws nothing at all. */
  loading?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const range = Math.max(1, dayEnd - dayStart);
  const env = useMemo(() => buildEnvelopes(sessions, dayStart, dayEnd), [sessions, dayStart, dayEnd]);
  const hasDay = sessions.some((s) => !s.cancelled);
  const nowPct = Math.min(100, Math.max(0, ((now - dayStart) / range) * 100));
  const gold = accentHex[accent];
  const [hover, setHover] = useState<{ pct: number; minutes: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !hasDay) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = wrap.clientWidth;
    let raf = 0;
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.motion === "off";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = wrap.clientWidth;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(wrap);

    const cy = height / 2;
    // Time runs left → right: the playhead sits at its fraction of the day.
    const xNow = ((now - dayStart) / range) * width;

    const buildLine = (t: number, harmonic: number, ampScale: number, phaseShift: number) => {
      const breath = 0.92 + 0.08 * Math.sin((t / 4200) * Math.PI * 2);
      ctx.beginPath();
      const step = 2;
      for (let x = 0; x <= width; x += step) {
        const pos = x / width; // 0 at day start (left) → 1 at day end (right)
        const d = sampleAt(env.density, pos);
        const a = sampleAt(env.attention, pos);
        const amp = (3 + d * (height * 0.36)) * breath * ampScale;
        // Base phrase + a denser inner rhythm that only appears where classes overlap
        const s1 = Math.sin(x / 34 + t / 1600 + phaseShift);
        const s2 = Math.sin(x / 13 - t / 1100 + phaseShift * 2) * (0.25 + d * 0.55);
        const s3 = Math.sin(x / 6.5 + t / 800) * d * 0.22 * harmonic;
        const jitter = a > 0.05 ? Math.sin(x / 3.2 + t / 260) * a * 0.14 : 0;
        const y = cy + amp * (s1 * 0.62 + s2 + s3 + jitter);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);

      // baseline
      ctx.strokeStyle = "rgba(245,240,232,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy + 0.5);
      ctx.lineTo(width, cy + 0.5);
      ctx.stroke();

      // The clash window: an amber band across the hours two classes share a room.
      const clashes = sessions.filter((s) => s.clash && !s.cancelled);
      if (clashes.length > 0) {
        const from = Math.min(...clashes.map((s) => parseTime(s.start)));
        const to = Math.max(...clashes.map((s) => parseTime(s.end)));
        const x0 = ((from - dayStart) / range) * width;
        const x1 = ((to - dayStart) / range) * width;
        ctx.fillStyle = hexA("#e0a030", 0.09);
        ctx.fillRect(x0, 4, Math.max(2, x1 - x0), height - 8);
        ctx.strokeStyle = hexA("#e0a030", 0.28);
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, 4);
        ctx.lineTo(x0 + 0.5, height - 4);
        ctx.moveTo(x1 - 0.5, 4);
        ctx.lineTo(x1 - 0.5, height - 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Every class start as a tick on the baseline — the day's own rhythm.
      ctx.strokeStyle = "rgba(245,240,232,0.16)";
      ctx.lineWidth = 1;
      for (const session of sessions) {
        if (session.cancelled) continue;
        const x = ((parseTime(session.start) - dayStart) / range) * width;
        if (x < 0 || x > width) continue;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, cy + 3);
        ctx.lineTo(Math.round(x) + 0.5, cy + 9);
        ctx.stroke();
      }

      // past (left of the playhead) is bright, the rest of the day is quieter
      const nowStop = Math.min(0.999, Math.max(0.001, xNow / width));
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, hexA(gold[500], 0.34));
      grad.addColorStop(Math.max(0.001, nowStop - 0.001), hexA(gold[400], 0.95));
      grad.addColorStop(Math.min(0.999, nowStop + 0.001), hexA(gold[500], 0.4));
      grad.addColorStop(1, hexA(gold[500], 0.22));

      // harmonic (violet, quiet) — the same day one octave up
      buildLine(t, 1, 0.55, 1.4);
      ctx.strokeStyle = "rgba(139,117,220,0.26)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // main pulse
      buildLine(t, 1, 1, 0);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // playhead
      ctx.strokeStyle = hexA(gold[400], 0.5);
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(xNow + 0.5, 6);
      ctx.lineTo(xNow + 0.5, height - 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = gold[400];
      ctx.beginPath();
      ctx.arc(xNow, cy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    if (reduced) draw(0);
    else raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduced) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [env, height, now, gold, hasDay, sessions, dayStart, dayEnd, range]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = Math.ceil(dayStart / 60); h <= Math.floor(dayEnd / 60); h += 2) out.push(h);
    return out;
  }, [dayStart, dayEnd]);

  const hoverCount = hover ? Math.round(sampleAt(env.count, hover.pct)) : 0;
  const allCancelled = sessions.length > 0 && sessions.every((s) => s.cancelled);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    if (!wrap || !hasDay) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0) return;
    const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover({ pct, minutes: Math.round(dayStart + pct * range) });
  };

  return (
    <div
      className={cn("relative w-full select-none", className)}
      dir="ltr"
      aria-label="ریتم روز — تعداد کلاس‌های همزمان از آغاز تا پایان روز کاری"
      role="img"
    >
      <div
        ref={wrapRef}
        className="relative w-full"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {hasDay ? (
          <canvas ref={canvasRef} className="block" />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] px-4 text-center">
            <p className="text-[11.5px] leading-relaxed text-ink-400" dir="rtl">
              {loading
                ? "در حال خواندن تقویم امروز…"
                : allCancelled
                  ? "همهٔ جلسات امروز لغو شده‌اند — موجی برای رسم نمانده است."
                  : "امروز جلسه‌ای روی تقویم نیست — موجی برای رسم وجود ندارد."}
            </p>
          </div>
        )}

        {/* now label — anchored to the playhead, time digits left-to-right */}
        {hasDay && (
          <div
            className="pointer-events-none absolute top-0 flex flex-col items-center"
            style={{ left: `${nowPct}%`, transform: "translateX(-50%)" }}
          >
            <span className="nums rounded-md border border-gold-500/25 bg-ink-950/70 px-1.5 py-0.5 text-[10px] font-medium text-gold-300 backdrop-blur-sm">
              اکنون {minutesToFaTime(now)}
            </span>
          </div>
        )}

        {/* hover readout: what the wave is measuring at that instant */}
        {hover && hasDay && (
          <div
            className="pointer-events-none absolute bottom-1 z-10 w-max max-w-[220px] rounded-lg border border-white/[0.09] bg-ink-950/92 px-2.5 py-1.5 text-[10.5px] leading-relaxed text-ink-200 shadow-xl backdrop-blur-sm"
            style={{
              left: `${hover.pct * 100}%`,
              transform: hover.pct > 0.6 ? "translateX(-100%)" : "translateX(0)",
            }}
            dir="rtl"
          >
            <span className="nums text-gold-300">{minutesToFaTime(hover.minutes)}</span>
            {" · "}
            {hoverCount > 0 ? `${toFa(hoverCount)} کلاس همزمان` : "بدون کلاس"}
          </div>
        )}
      </div>

      {showAxis && (
        <div className="relative mt-1 h-4 text-[10px] text-ink-400" dir="ltr">
          {hours.map((h) => (
            <span
              key={h}
              className="nums absolute top-0 -translate-x-1/2"
              style={{ left: `${((h * 60 - dayStart) / range) * 100}%` }}
            >
              {toFa(h)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
