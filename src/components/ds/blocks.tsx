import type { ComponentType, ReactNode } from "react";
import { ChevronDown, ChevronLeft, CircleAlert, Info, Lightbulb, Plus, TrendingUp, TriangleAlert } from "lucide-react";
import { cn } from "@/utils/cn";
import { faNum, faTime, parseTime } from "@/lib/format";
import type { IntelligenceCard } from "@/data/records";
import { ACADEMY_NOW, instrumentLabel, type AttentionItem, type ClassSession, type ClassStatus, type Insight, type Severity, type Signal } from "@/data/academy";
import { Delta, InstrumentGlyph, Sparkline, StatusBadge, Surface } from "./primitives";

/* ------------------------------------------------------------------ */
/* Signal — a KPI that answers "so what?"                              */
/* ------------------------------------------------------------------ */
export function SignalBlock({ signal, onOpen, className }: { signal: Signal; onOpen?: () => void; className?: string }) {
  const toneDot = signal.tone === "ok" ? "bg-ok-500" : signal.tone === "warn" ? "bg-warn-500" : "bg-ink-400";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full flex-col gap-4 p-5 text-right transition-colors duration-[var(--sixteenth)] hover:bg-white/[0.02] focus-visible:bg-white/[0.02]",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-xs font-medium text-ink-300">{signal.label}</span>
        <ChevronLeft className="size-3.5 text-ink-500 opacity-0 transition-all duration-[var(--eighth)] group-hover:-translate-x-0.5 group-hover:opacity-100" />
      </div>
      <div className="flex w-full items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="nums flex items-baseline gap-1.5 text-[26px] font-semibold leading-none tracking-tight text-ink-50">
            {signal.value}
            {signal.unit && <span className="text-sm font-medium text-ink-300">{signal.unit}</span>}
          </div>
          <Delta value={signal.delta} label={signal.deltaLabel} className="mt-2.5" />
        </div>
        <Sparkline data={signal.series} kind={signal.kind} tone={signal.tone === "warn" ? "warn" : "gold"} width={92} height={34} className="shrink-0 opacity-90" />
      </div>
      <p className="flex w-full items-center gap-2 border-t border-white/[0.05] pt-3 text-xs text-ink-300">
        <span className={cn("size-1.5 shrink-0 rounded-full", toneDot)} aria-hidden />
        <span className="truncate">{signal.context}</span>
      </p>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Alert — an actionable attention item                                */
/* ------------------------------------------------------------------ */
const severityMeta: Record<Severity, { label: string; icon: ReactNode; mark: string; bar: string }> = {
  critical: {
    label: "فوری",
    icon: <CircleAlert className="size-4" strokeWidth={2} />,
    mark: "border-danger-500/30 bg-danger-500/10 text-danger-400",
    bar: "bg-danger-500",
  },
  warning: {
    label: "مهم",
    icon: <TriangleAlert className="size-4" strokeWidth={2} />,
    mark: "border-warn-500/30 bg-warn-500/10 text-warn-400",
    bar: "bg-warn-500",
  },
  info: {
    label: "اطلاع",
    icon: <Info className="size-4" strokeWidth={2} />,
    mark: "border-info-400/30 bg-info-400/10 text-info-400",
    bar: "bg-info-400",
  },
};

export function AlertItem({ item, onOpen, className }: { item: AttentionItem; onOpen?: () => void; className?: string }) {
  const meta = severityMeta[item.severity];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition-colors duration-[var(--sixteenth)] hover:bg-white/[0.03]",
        className,
      )}
    >
      <span className={cn("absolute inset-y-3 right-0 w-[2px] rounded-full opacity-70", meta.bar)} aria-hidden />
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", meta.mark)}>{meta.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink-50">{item.title}</span>
          <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px] font-semibold", meta.mark)}>{meta.label}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-300">{item.context}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap text-xs text-ink-400 transition-colors group-hover:text-gold-400 sm:flex lg:hidden wide:flex">
        {item.action}
        <ChevronLeft className="size-3.5 transition-transform duration-[var(--eighth)] group-hover:-translate-x-0.5" />
      </span>
      <ChevronLeft className="size-4 shrink-0 text-ink-500 transition-colors group-hover:text-gold-400 sm:hidden lg:block wide:hidden" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Intelligence insight                                                */
/* ------------------------------------------------------------------ */
const insightMeta = {
  trend: { icon: <TrendingUp className="size-4" strokeWidth={2} />, mark: "text-ok-400 border-ok-500/25 bg-ok-500/10", label: "روند مثبت" },
  risk: { icon: <TriangleAlert className="size-4" strokeWidth={2} />, mark: "text-warn-400 border-warn-500/25 bg-warn-500/10", label: "ریسک" },
  idea: { icon: <Lightbulb className="size-4" strokeWidth={2} />, mark: "text-violet-300 border-violet-500/30 bg-violet-500/10", label: "پیشنهاد" },
};

export function InsightItem({ insight, index, onAction, className }: { insight: Insight; index?: number; onAction?: () => void; className?: string }) {
  const meta = insightMeta[insight.kind];
  return (
    <article className={cn("relative flex gap-3.5 rounded-xl border border-white/[0.06] bg-ink-950/40 p-4", className)}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", meta.mark)} title={meta.label}>
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {typeof index === "number" && <span className="nums text-[10px] font-semibold text-ink-500">{faNum(index + 1).padStart(2, "۰")}</span>}
          <span className="text-[10px] font-medium text-ink-400">{meta.label}</span>
        </div>
        <p className="mt-1 text-[13.5px] font-medium leading-relaxed text-ink-50">{insight.text}</p>
        {insight.detail && <p className="mt-1 text-xs leading-relaxed text-ink-300">{insight.detail}</p>}
        {insight.action && (
          <button type="button" onClick={onAction} className="group mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-gold-400 hover:text-gold-300">
            {insight.action.label}
            <ChevronLeft className="size-3.5 transition-transform duration-[var(--eighth)] group-hover:-translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Intelligence card — Signal → Evidence → Insight → Action            */
/* ------------------------------------------------------------------ */
export function IntelligenceCardView({
  card,
  index,
  onAction,
  className,
}: {
  card: IntelligenceCard;
  index?: number;
  onAction?: () => void;
  className?: string;
}) {
  const meta = insightMeta[card.kind];
  return (
    <article className={cn("relative overflow-hidden rounded-xl border border-white/[0.06] bg-ink-950/45", className)}>
      {/* Signal */}
      <div className="flex gap-3.5 p-4">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", meta.mark)} title={meta.label}>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {typeof index === "number" && <span className="nums text-[10px] font-semibold text-ink-500">{faNum(index + 1)}</span>}
            <span className="text-[10px] font-medium text-ink-400">سیگنال · {meta.label}</span>
            <span className="mr-auto text-[10px] text-ink-500">اطمینان {card.confidence}</span>
          </div>
          <p className="mt-1 text-[13.5px] font-medium leading-relaxed text-ink-50">{card.signal}</p>
        </div>
      </div>

      {/* Evidence */}
      <div className="grid grid-cols-3 gap-px border-y border-white/[0.05] bg-white/[0.03]">
        {card.evidence.map((e, i) => (
          <div key={e.label} className="bg-ink-950/60 px-3 py-2.5 text-center" style={{ animation: `fade-in 400ms var(--ease-legato) ${i * 70}ms both` }}>
            <div className="nums text-[12.5px] font-semibold text-ink-100">{e.value}</div>
            <div className="mt-0.5 truncate text-[9.5px] text-ink-500">{e.label}</div>
          </div>
        ))}
      </div>

      {/* Insight + Action */}
      <div className="p-4">
        <p className="text-[12px] leading-relaxed text-ink-300">{card.insight}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button type="button" onClick={onAction} className="group inline-flex items-center gap-1 text-[12px] font-medium text-gold-400 hover:text-gold-300">
            {card.action.label}
            <ChevronLeft className="size-3.5 transition-transform duration-[var(--eighth)] group-hover:-translate-x-0.5" />
          </button>
          <span className="truncate text-[9.5px] text-ink-600">{card.source}</span>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline event                                                      */
/* ------------------------------------------------------------------ */
const statusBadge: Record<ClassStatus, { label: string; tone: "ok" | "gold" | "neutral" | "warn" | "danger"; live?: boolean; cancelled?: boolean }> = {
  live: { label: "در حال برگزاری", tone: "ok", live: true },
  next: { label: "بعدی", tone: "gold" },
  scheduled: { label: "برنامه‌ریزی‌شده", tone: "neutral" },
  done: { label: "برگزار شد", tone: "neutral" },
  cancelled: { label: "لغو شده", tone: "neutral", cancelled: true },
  attention: { label: "نیازمند توجه", tone: "warn" },
};

const nodeTone: Record<ClassStatus, string> = {
  live: "bg-ok-400 ring-4 ring-ok-500/20",
  next: "bg-gold-400",
  scheduled: "bg-ink-500",
  done: "bg-ink-600",
  cancelled: "bg-transparent border border-ink-500",
  attention: "bg-warn-400",
};

export function TimelineEvent({
  session,
  status,
  isLast,
  onOpen,
  onResolve,
  now = ACADEMY_NOW,
}: {
  session: ClassSession;
  status: ClassStatus;
  isLast?: boolean;
  onOpen?: () => void;
  onResolve?: () => void;
  now?: number;
}) {
  const badge = statusBadge[status];
  const muted = status === "done" || status === "cancelled";
  const progress =
    status === "live" ? Math.min(100, Math.max(0, ((now - parseTime(session.start)) / (parseTime(session.end) - parseTime(session.start))) * 100)) : 0;
  return (
    <li className="relative flex gap-3.5">
      <time className={cn("nums w-11 shrink-0 pt-0.5 text-sm font-medium", muted ? "text-ink-500" : "text-ink-100")}>{faTime(session.start)}</time>
      <div className="relative flex w-3 shrink-0 flex-col items-center">
        <span className={cn("mt-1.5 block size-2.5 rounded-full", nodeTone[status], status === "live" && "ring-live")} aria-hidden />
        {!isLast && <span className="mt-1.5 w-px flex-1 bg-white/[0.07]" aria-hidden />}
      </div>
      <div className={cn("min-w-0 flex-1", isLast ? "pb-1" : "pb-5")}>
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 text-right">
            <span className={cn("flex items-center gap-2 text-sm font-medium", muted ? "text-ink-300" : "text-ink-50", status === "cancelled" && "line-through decoration-ink-500")}>
              <InstrumentGlyph kind={session.instrument} className={cn("size-4", muted ? "text-ink-500" : "text-gold-400")} />
              {session.title}
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-300">
              {session.room} · {session.teacher}
              {session.students != null && session.capacity != null && (
                <span className="nums text-ink-500"> · {faNum(session.students)}/{faNum(session.capacity)}</span>
              )}
            </span>
          </button>
          <StatusBadge tone={badge.tone} label={badge.label} live={badge.live} cancelled={badge.cancelled} className="shrink-0" />
        </div>
        {status === "live" && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full origin-right rounded-full bg-ok-500/80" style={{ width: `${progress}%` }} />
            </div>
            <span className="nums text-[10px] text-ink-400">{faNum(Math.round(progress))}٪</span>
          </div>
        )}
        {status === "attention" && (
          <button type="button" onClick={onResolve} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-warn-400 hover:text-warn-500">
            هم‌زمان با «پیانو پیشرفته» در {session.room} — حل تعارض
            <ChevronLeft className="size-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Quick action                                                        */
/* ------------------------------------------------------------------ */
export function QuickAction({ label, hint, onClick, className }: { label: string; hint?: string; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        "group inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] pl-4 pr-3 text-xs font-medium text-ink-200 transition-all duration-[var(--sixteenth)] hover:border-gold-500/40 hover:bg-gold-500/[0.06] hover:text-gold-300 active:scale-[0.98]",
        className,
      )}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-gold-500/15 text-gold-400 transition-colors group-hover:bg-gold-500/25">
        <Plus className="size-3" strokeWidth={2.5} />
      </span>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation item                                                     */
/* ------------------------------------------------------------------ */
export function NavItem({
  icon: Icon,
  label,
  active,
  badge,
  collapsed,
  onClick,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  active?: boolean;
  badge?: number;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition-all duration-[var(--sixteenth)] ease-[var(--ease-resonance)]",
        active ? "bg-gold-500/[0.09] text-gold-300" : "text-ink-300 hover:bg-white/[0.04] hover:text-ink-50",
        collapsed && "justify-center px-0",
      )}
    >
      {active && <span className="absolute right-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-l-full bg-gold-500" aria-hidden />}
      <Icon className={cn("size-[18px] shrink-0", active ? "text-gold-400" : "text-ink-400 group-hover:text-ink-200")} strokeWidth={1.75} />
      {!collapsed && <span className="flex-1 text-right">{label}</span>}
      {badge ? (
        <span
          className={cn(
            "nums flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500/15 px-1.5 text-[10px] font-semibold text-gold-300",
            collapsed && "absolute -top-0.5 left-2",
          )}
        >
          {faNum(badge)}
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Chart card                                                          */
/* ------------------------------------------------------------------ */
export function PeriodSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="relative inline-flex h-8 shrink-0 items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 appearance-none rounded-lg border border-white/[0.08] bg-ink-900 pl-7 pr-3 text-xs text-ink-200 outline-none transition-colors hover:border-white/[0.16] focus-visible:border-gold-500/50"
        aria-label="بازهٔ زمانی"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute left-2 size-3.5 text-ink-400" />
    </label>
  );
}

export function ChartCard({
  title,
  insight,
  headline,
  toolbar,
  children,
  footer,
  className,
}: {
  title: string;
  headline?: ReactNode;
  insight?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Surface className={cn("flex flex-col p-5", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-medium text-ink-300">{title}</h3>
          {headline && <div className="nums mt-1 text-lg font-semibold leading-tight text-ink-50">{headline}</div>}
          {insight && <p className="mt-1 text-xs leading-relaxed text-ink-300">{insight}</p>}
        </div>
        {toolbar}
      </header>
      <div className="mt-5 flex-1">{children}</div>
      {footer && <div className="mt-4 border-t border-white/[0.05] pt-3 text-xs text-ink-300">{footer}</div>}
    </Surface>
  );
}

export const instrumentName = (k: ClassSession["instrument"]) => instrumentLabel[k];
