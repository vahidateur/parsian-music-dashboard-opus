import { useEffect, useMemo, useRef } from "react";
import { ACADEMY_NOW, DAY_END, DAY_START, schedule } from "@/data/academy";
import { minutesToFaTime, parseTime, toFa } from "@/lib/format";
import { accentHex, hexA, type Accent } from "@/lib/theme";
import { cn } from "@/utils/cn";

const SAMPLES = 260;
const RANGE = DAY_END - DAY_START;

/** Build the smoothed activity envelope for the day (0..1) + attention envelope. */
function buildEnvelopes() {
  const raw = new Float32Array(SAMPLES);
  const att = new Float32Array(SAMPLES);
  for (let i = 0; i < SAMPLES; i++) {
    const t = DAY_START + (i / (SAMPLES - 1)) * RANGE;
    let count = 0;
    let attention = 0;
    for (const s of schedule) {
      const a = parseTime(s.start);
      const b = parseTime(s.end);
      if (t >= a && t < b) {
        if (!s.cancelled) count += 1;
        if (s.conflict) attention = 1;
      }
    }
    raw[i] = count;
    att[i] = attention;
  }
  // Gaussian smoothing so the pulse feels organic, not stepped
  const sigma = 5;
  const k: number[] = [];
  for (let j = -sigma * 3; j <= sigma * 3; j++) k.push(Math.exp(-(j * j) / (2 * sigma * sigma)));
  const ksum = k.reduce((a, b) => a + b, 0);
  const smooth = (src: Float32Array) => {
    const out = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      let acc = 0;
      for (let j = 0; j < k.length; j++) {
        const idx = Math.min(SAMPLES - 1, Math.max(0, i + j - sigma * 3));
        acc += src[idx] * k[j];
      }
      out[i] = acc / ksum;
    }
    return out;
  };
  const density = smooth(raw);
  const attention = smooth(att);
  const max = Math.max(...Array.from(density), 1);
  for (let i = 0; i < SAMPLES; i++) density[i] = density[i] / max;
  return { density, attention };
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
  now = ACADEMY_NOW,
  accent = "gold",
}: {
  className?: string;
  height?: number;
  showAxis?: boolean;
  now?: number;
  accent?: Accent;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const env = useMemo(buildEnvelopes, []);
  const nowPct = ((now - DAY_START) / RANGE) * 100; // from the right edge (RTL)
  const gold = accentHex[accent];

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = wrap.clientWidth;
    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
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
    const xNow = width - ((now - DAY_START) / RANGE) * width;

    const buildLine = (t: number, harmonic: number, ampScale: number, phaseShift: number) => {
      const breath = 0.92 + 0.08 * Math.sin((t / 4200) * Math.PI * 2);
      ctx.beginPath();
      const step = 2;
      for (let x = 0; x <= width; x += step) {
        const pos = 1 - x / width; // 0 at right (day start) → 1 at left (day end)
        const d = sampleAt(env.density, pos);
        const a = sampleAt(env.attention, pos);
        const amp = (3 + d * (height * 0.36)) * breath * ampScale;
        // Base phrase + a denser inner rhythm that only appears where activity is high
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

      // gradient: past (right of playhead) is present, future (left) is quieter,
      // attention window gets a warmer amber tint
      const nowStop = Math.min(0.999, Math.max(0.001, xNow / width));
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, hexA(gold[500], 0.3));
      // conflict at 14:00–15:00 → convert to x fractions (left-based)
      const cA = 1 - (15 * 60 - DAY_START) / RANGE;
      const cB = 1 - (14 * 60 - DAY_START) / RANGE;
      grad.addColorStop(Math.max(0, cA - 0.03), hexA(gold[500], 0.3));
      grad.addColorStop((cA + cB) / 2, hexA("#e0a030", 0.82));
      grad.addColorStop(Math.min(nowStop - 0.001, cB + 0.03), hexA(gold[500], 0.32));
      grad.addColorStop(nowStop, hexA(gold[400], 0.95));
      grad.addColorStop(1, hexA(gold[500], 0.85));

      // harmonic (violet, quiet)
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
  }, [env, height, now, gold]);

  const hours = [8, 10, 12, 14, 16, 18, 20];

  return (
    <div className={cn("relative w-full select-none", className)} aria-label="نبض آموزشگاه — نمودار فعالیت امروز" role="img">
      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        <canvas ref={canvasRef} className="block" />
        {/* now label */}
        <div
          className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
          style={{ right: `calc(${nowPct}% - 0px)`, transform: "translateX(50%)" }}
        >
          <span className="nums rounded-md border border-gold-500/25 bg-ink-950/70 px-1.5 py-0.5 text-[10px] font-medium text-gold-300 backdrop-blur-sm">
            اکنون {minutesToFaTime(now)}
          </span>
        </div>
      </div>
      {showAxis && (
        <div className="relative mt-1 h-4 text-[10px] text-ink-400">
          {hours.map((h) => (
            <span
              key={h}
              className="nums absolute top-0 translate-x-1/2"
              style={{ right: `${((h * 60 - DAY_START) / RANGE) * 100}%` }}
            >
              {toFa(h)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
