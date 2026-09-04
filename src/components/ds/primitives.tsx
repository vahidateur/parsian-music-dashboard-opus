import { forwardRef, useMemo, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpLeft, Check, ChevronLeft, CircleAlert, Info, Minus, TriangleAlert, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { faDelta } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Surface — a quiet elevated plane                                    */
/* ------------------------------------------------------------------ */
export const Surface = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { glass?: boolean }>(
  ({ className, glass, ...rest }, ref) => (
    <div ref={ref} className={cn(glass ? "surface-glass" : "surface", className)} {...rest} />
  ),
);
Surface.displayName = "Surface";

/* ------------------------------------------------------------------ */
/* SectionHeader                                                       */
/* ------------------------------------------------------------------ */
export function SectionHeader({
  title,
  kicker,
  aside,
  action,
  onAction,
  className,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  aside?: ReactNode;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-ink-50 leading-none">{title}</h2>
          {aside}
        </div>
        {kicker && <p className="mt-1.5 text-xs text-ink-300 leading-relaxed">{kicker}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="group inline-flex shrink-0 items-center gap-1 text-xs text-ink-300 transition-colors duration-[var(--sixteenth)] hover:text-gold-400"
        >
          {action}
          <ChevronLeft className="size-3.5 transition-transform duration-[var(--eighth)] ease-[var(--ease-resonance)] group-hover:-translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StatusBadge — never colour alone: glyph + label                     */
/* ------------------------------------------------------------------ */
export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "gold" | "violet";

const toneClass: Record<Tone, string> = {
  ok: "text-ok-400 bg-ok-500/10 border-ok-500/20",
  warn: "text-warn-400 bg-warn-500/10 border-warn-500/20",
  danger: "text-danger-400 bg-danger-500/10 border-danger-500/25",
  info: "text-info-400 bg-info-400/10 border-info-400/20",
  neutral: "text-ink-300 bg-white/[0.04] border-white/[0.07]",
  gold: "text-gold-400 bg-gold-500/10 border-gold-500/25",
  violet: "text-violet-300 bg-violet-500/12 border-violet-500/25",
};

const toneGlyph: Record<Tone, ReactNode> = {
  ok: <Check className="size-3" strokeWidth={2.5} />,
  warn: <TriangleAlert className="size-3" strokeWidth={2.4} />,
  danger: <CircleAlert className="size-3" strokeWidth={2.4} />,
  info: <Info className="size-3" strokeWidth={2.4} />,
  neutral: <Minus className="size-3" strokeWidth={2.4} />,
  gold: <ChevronLeft className="size-3" strokeWidth={2.4} />,
  violet: <Check className="size-3" strokeWidth={2.4} />,
};

export function StatusBadge({
  tone = "neutral",
  label,
  live,
  cancelled,
  glyph,
  className,
}: {
  tone?: Tone;
  label: string;
  live?: boolean;
  cancelled?: boolean;
  glyph?: ReactNode | false;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium leading-none whitespace-nowrap",
        toneClass[tone],
        cancelled && "line-through decoration-ink-400/70",
        className,
      )}
    >
      {live ? (
        <span className="relative flex size-2 items-center justify-center">
          <span className="ring-live absolute inline-flex size-2 rounded-full bg-ok-500" />
          <span className="relative inline-flex size-1.5 rounded-full bg-ok-400" />
        </span>
      ) : glyph === false ? null : cancelled ? (
        <X className="size-3" strokeWidth={2.4} />
      ) : (
        (glyph ?? toneGlyph[tone])
      )}
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Delta — signed change with direction glyph + sentence               */
/* ------------------------------------------------------------------ */
export function Delta({
  value,
  label,
  invert,
  className,
}: {
  value: number;
  label?: string;
  invert?: boolean;
  className?: string;
}) {
  const positive = invert ? value < 0 : value > 0;
  const neutral = value === 0;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span
        className={cn(
          "nums inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold",
          neutral
            ? "text-ink-300 bg-white/[0.04]"
            : positive
              ? "text-ok-400 bg-ok-500/10"
              : "text-danger-400 bg-danger-500/10",
        )}
        dir="ltr"
      >
        {neutral ? null : value > 0 ? (
          <ArrowUpLeft className="size-3" strokeWidth={2.5} />
        ) : (
          <ArrowDownLeft className="size-3" strokeWidth={2.5} />
        )}
        {faDelta(value)}
      </span>
      {label && <span className="text-ink-400">{label}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline — RTL: newest at the left                                 */
/* ------------------------------------------------------------------ */
export function Sparkline({
  data,
  kind = "line",
  tone = "gold",
  width = 96,
  height = 30,
  className,
  animate = true,
}: {
  data: number[];
  kind?: "line" | "bars";
  tone?: "gold" | "ok" | "warn" | "violet";
  width?: number;
  height?: number;
  className?: string;
  animate?: boolean;
}) {
  const color = { gold: "#d4a853", ok: "#5fb57a", warn: "#e0a030", violet: "#8b75dc" }[tone];
  const { path, area, length, bars } = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const n = data.length;
    const pad = 2;
    const step = (width - pad * 2) / Math.max(n - 1, 1);
    // RTL: index 0 (oldest) on the right, newest on the left
    const pts = data.map((v, i) => ({
      x: width - pad - i * step,
      y: pad + (1 - (v - min) / span) * (height - pad * 2),
    }));
    let length = 0;
    for (let i = 1; i < pts.length; i++) {
      length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const area = `${d} L${pts[pts.length - 1].x.toFixed(1)} ${height} L${pts[0].x.toFixed(1)} ${height} Z`;
    const bw = Math.max(2, step * 0.55);
    const bars = data.map((v, i) => ({
      x: width - pad - i * step - bw / 2,
      h: Math.max(2, ((v - min) / span) * (height - 4) + 2),
    }));
    return { path: d, area, length, bars, bw };
  }, [data, width, height]);

  if (kind === "bars") {
    const bw = Math.max(2, ((width - 4) / Math.max(data.length - 1, 1)) * 0.55);
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} aria-hidden>
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={height - b.h}
            width={bw}
            height={b.h}
            rx={1}
            fill={color}
            opacity={i === data.length - 1 ? 1 : 0.38}
            style={
              animate
                ? { transformOrigin: `${b.x + bw / 2}px ${height}px`, animation: `grow-y 500ms var(--ease-phrase) ${i * 45}ms both` }
                : undefined
            }
          />
        ))}
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${tone})`} style={animate ? { animation: "fade-in 900ms var(--ease-legato) 300ms both" } : undefined} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animate
            ? { strokeDasharray: length, strokeDashoffset: length, animation: "draw 1100ms var(--ease-legato) both" }
            : undefined
        }
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Kbd                                                                 */
/* ------------------------------------------------------------------ */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 font-sans text-[10px] font-medium text-ink-300",
        className,
      )}
      dir="ltr"
    >
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "subtle"; size?: "sm" | "md" };

export function Button({ variant = "subtle", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-[var(--sixteenth)] ease-[var(--ease-resonance)] active:scale-[0.985] disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-gold-500 text-ink-950 hover:bg-gold-400 shadow-[0_8px_24px_-12px_rgba(212,168,83,0.6)]",
        variant === "subtle" && "border border-white/[0.08] bg-white/[0.03] text-ink-100 hover:bg-white/[0.06] hover:border-white/[0.14]",
        variant === "ghost" && "text-ink-200 hover:bg-white/[0.05] hover:text-ink-50",
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({ className, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-ink-200 transition-all duration-[var(--sixteenth)] hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-ink-50 active:scale-95",
        className,
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Instrument glyphs — minimal line marks, not cartoon icons           */
/* ------------------------------------------------------------------ */
export function InstrumentGlyph({ kind, className }: { kind: "piano" | "guitar" | "voice" | "violin" | "drums" | "theory"; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden {...common}>
      {kind === "piano" && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M8 5v9M12 5v9M16 5v9" />
          <path d="M6.5 5v6h3V5M10.5 5v6h3V5M14.5 5v6h3V5" strokeWidth={0} fill="currentColor" opacity={0.55} />
        </>
      )}
      {kind === "guitar" && (
        <>
          <path d="M14.5 9.5 20 4" />
          <path d="M11.8 12.2c2.2 2.2 2.6 5.1 0.8 6.9s-4.7 1.4-6.9-.8-2.6-5.1-.8-6.9 4.7-1.4 6.9.8Z" />
          <circle cx="9.2" cy="14.8" r="1.6" />
        </>
      )}
      {kind === "voice" && (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
        </>
      )}
      {kind === "violin" && (
        <>
          <path d="M12 3v7" />
          <path d="M9.5 10.5c-2.5 0-4 1.6-4 3.6 0 1.4.7 2.2.7 3.2 0 2.3 2.3 3.7 5.8 3.7s5.8-1.4 5.8-3.7c0-1 .7-1.8.7-3.2 0-2-1.5-3.6-4-3.6" />
          <path d="M10.5 15.5v2M13.5 15.5v2" />
        </>
      )}
      {kind === "drums" && (
        <>
          <ellipse cx="12" cy="8" rx="8" ry="3" />
          <path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8" />
          <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
        </>
      )}
      {kind === "theory" && (
        <>
          <path d="M3 7h18M3 10.5h18M3 14h18M3 17.5h18" opacity={0.6} />
          <circle cx="9" cy="14" r="1.8" fill="currentColor" stroke="none" />
          <path d="M10.8 14V6.5" />
        </>
      )}
    </svg>
  );
}
