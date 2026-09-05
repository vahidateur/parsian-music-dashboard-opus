import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Delta, Sparkline, Surface, type Tone } from "./primitives";

/* ================================================================== */
/* PAGE HEADER — same rhythm on every screen                           */
/* ================================================================== */
export function PageHeader({
  title,
  kicker,
  description,
  breadcrumb,
  actions,
  meta,
  tabs,
  className,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  description?: ReactNode;
  breadcrumb?: { label: string; onClick?: () => void }[];
  actions?: ReactNode;
  meta?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="مسیر" className="mb-3 flex items-center gap-1.5 text-xs text-ink-400">
          {breadcrumb.map((b, i) => (
            <span key={b.label} className="flex items-center gap-1.5">
              {i > 0 && <ChevronLeft className="size-3 text-ink-600" />}
              {b.onClick ? (
                <button type="button" onClick={b.onClick} className="transition-colors hover:text-gold-400">
                  {b.label}
                </button>
              ) : (
                <span className="text-ink-300">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {kicker && <div className="mb-1.5 text-[11px] font-medium text-gold-400">{kicker}</div>}
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink-50 sm:text-2xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-300">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-400">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-5">{tabs}</div>}
    </header>
  );
}

/* ================================================================== */
/* STAT STRIP — compact KPI row on one plane                           */
/* ================================================================== */
export interface StatDef {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  hint?: string;
  tone?: Tone;
  series?: number[];
  onClick?: () => void;
}

export function StatStrip({ stats, className, columns }: { stats: StatDef[]; className?: string; columns?: string }) {
  return (
    <Surface className={cn("overflow-hidden", className)}>
      <div className={cn("grid grid-cols-2", columns ?? "lg:grid-cols-4")}>
        {stats.map((s, i) => {
          const Comp: "button" | "div" = s.onClick ? "button" : "div";
          return (
            <Comp
              key={s.label}
              {...(s.onClick ? { type: "button" as const, onClick: s.onClick } : {})}
              className={cn(
                "group flex flex-col items-start gap-2.5 p-4 text-right animate-phrase-in border-white/[0.06] sm:p-5",
                i % 2 === 1 && "border-s",
                i >= 2 && "border-t lg:border-t-0",
                i > 0 && "lg:border-s",
                s.onClick && "transition-colors hover:bg-white/[0.02]",
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[11.5px] font-medium text-ink-300">{s.label}</span>
                {s.onClick && <ChevronLeft className="size-3.5 text-ink-500 opacity-0 transition-all group-hover:-translate-x-0.5 group-hover:opacity-100" />}
              </span>
              <span className="flex w-full items-end justify-between gap-3">
                <span className="nums flex items-baseline gap-1 text-[22px] font-semibold leading-none tracking-tight text-ink-50">
                  {s.value}
                  {s.unit && <span className="text-xs font-medium text-ink-300">{s.unit}</span>}
                </span>
                {s.series && <Sparkline data={s.series} width={64} height={24} tone={s.tone === "warn" ? "warn" : s.tone === "violet" ? "violet" : "gold"} className="shrink-0 opacity-80" />}
              </span>
              <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
                {s.delta !== undefined && <Delta value={s.delta} />}
                {s.hint && <span className="truncate text-[11px] text-ink-400">{s.hint}</span>}
              </span>
            </Comp>
          );
        })}
      </div>
    </Surface>
  );
}

/* ================================================================== */
/* SEARCH · CHIPS · SEGMENTED · FILTER BAR                             */
/* ================================================================== */
export function SearchInput({
  value,
  onChange,
  placeholder = "جستجو…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative flex h-9 min-w-0 flex-1 items-center", className)}>
      <Search className="pointer-events-none absolute right-3 size-4 text-ink-400" strokeWidth={1.9} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-xl border border-white/[0.08] bg-ink-900/70 pr-9 pl-8 text-[13px] text-ink-50 outline-none transition-colors placeholder:text-ink-500 hover:border-white/[0.14] focus:border-gold-500/50"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="پاک کردن" className="absolute left-2 flex size-5 items-center justify-center rounded-md text-ink-400 hover:bg-white/[0.06] hover:text-ink-100">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Chip({
  label,
  active,
  count,
  tone = "gold",
  onClick,
}: {
  label: string;
  active?: boolean;
  count?: number;
  tone?: "gold" | "violet";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-all duration-[var(--sixteenth)] active:scale-[0.98]",
        active
          ? tone === "violet"
            ? "border-violet-400/40 bg-violet-500/12 font-medium text-violet-200"
            : "border-gold-500/45 bg-gold-500/12 font-medium text-gold-300"
          : "border-white/[0.08] bg-white/[0.02] text-ink-300 hover:border-white/[0.16] hover:text-ink-100",
      )}
    >
      {label}
      {count !== undefined && <span className={cn("nums text-[10px]", active ? "opacity-80" : "text-ink-500")}>{faNum(count)}</span>}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-white/[0.07] bg-ink-900/60 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-[10px] px-3 font-medium transition-all duration-[var(--sixteenth)] ease-[var(--ease-resonance)]",
              size === "sm" ? "h-7 text-[11.5px]" : "h-8 text-xs",
              active ? "bg-white/[0.07] text-ink-50 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]" : "text-ink-400 hover:text-ink-100",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterBar({
  search,
  chips,
  trailing,
  className,
}: {
  search?: ReactNode;
  chips?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const [openMobile, setOpenMobile] = useState(false);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        {search}
        {chips && (
          <button
            type="button"
            onClick={() => setOpenMobile((v) => !v)}
            aria-expanded={openMobile}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 text-xs text-ink-300 md:hidden"
          >
            <SlidersHorizontal className="size-3.5" />
            فیلتر
          </button>
        )}
        {trailing && <div className="hidden shrink-0 items-center gap-2 md:flex">{trailing}</div>}
      </div>
      {chips && (
        <div className={cn("no-scrollbar -mx-1 flex-wrap gap-2 overflow-x-auto px-1 pb-0.5 md:flex", openMobile ? "flex" : "hidden")}>{chips}</div>
      )}
      {trailing && <div className="flex items-center gap-2 md:hidden">{trailing}</div>}
    </div>
  );
}

/* ================================================================== */
/* TABS                                                                */
/* ================================================================== */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-white/[0.07]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative shrink-0 px-3.5 pb-2.5 pt-1 text-[13px] transition-colors duration-[var(--sixteenth)]",
              active ? "font-medium text-ink-50" : "text-ink-400 hover:text-ink-200",
            )}
          >
            <span className="flex items-center gap-1.5">
              {o.label}
              {o.count !== undefined && (
                <span className={cn("nums rounded-md px-1.5 py-px text-[10px]", active ? "bg-gold-500/15 text-gold-300" : "bg-white/[0.05] text-ink-400")}>{faNum(o.count)}</span>
              )}
            </span>
            {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gold-500 animate-grow-x" />}
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/* AVATAR                                                              */
/* ================================================================== */
const avatarTones = [
  "from-wood-400 to-wood-700",
  "from-violet-500 to-violet-600",
  "from-gold-600 to-wood-700",
  "from-ok-500 to-wood-700",
  "from-info-400 to-violet-600",
];

export function Avatar({
  name,
  size = "md",
  ring,
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  ring?: Tone;
  className?: string;
}) {
  const initials = name.trim().split(" ").slice(0, 2).map((p) => p[0]).join("");
  const tone = avatarTones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarTones.length];
  const dims = { xs: "size-6 text-[10px]", sm: "size-8 text-[11px]", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" }[size];
  const ringCls = ring
    ? { ok: "ring-ok-500/40", warn: "ring-warn-500/45", danger: "ring-danger-500/45", info: "ring-info-400/40", gold: "ring-gold-500/40", violet: "ring-violet-500/40", neutral: "ring-white/10" }[ring]
    : "ring-white/[0.08]";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-ink-50 ring-2", tone, dims, ringCls, className)}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/* ================================================================== */
/* METERS                                                              */
/* ================================================================== */
export function Meter({
  value,
  max = 100,
  tone = "gold",
  size = "md",
  label,
  className,
  delay = 0,
}: {
  value: number;
  max?: number;
  tone?: "gold" | "ok" | "warn" | "danger" | "violet" | "neutral";
  size?: "sm" | "md";
  label?: ReactNode;
  className?: string;
  delay?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bar = {
    gold: "bg-gold-500/85",
    ok: "bg-ok-500/85",
    warn: "bg-warn-500/85",
    danger: "bg-danger-500/85",
    violet: "bg-violet-500/80",
    neutral: "bg-ink-300/40",
  }[tone];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("flex-1 overflow-hidden rounded-full bg-white/[0.06]", size === "sm" ? "h-1" : "h-1.5")}>
        <div className={cn("h-full origin-right rounded-full", bar)} style={{ width: `${pct}%`, animation: `grow-x 700ms var(--ease-phrase) ${delay}ms both` }} />
      </div>
      {label !== undefined && <span className="nums shrink-0 text-[11px] text-ink-300">{label}</span>}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  tone = "gold",
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "gold" | "ok" | "warn" | "danger" | "violet";
  children?: ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 40);
    return () => window.clearTimeout(t);
  }, []);
  const toneText = { gold: "text-gold-500", ok: "text-ok-500", warn: "text-warn-500", danger: "text-danger-500", violet: "text-violet-500" }[tone];
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative shrink-0", toneText, className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={mounted ? c * (1 - Math.max(0, Math.min(100, value)) / 100) : c}
          style={{ transition: "stroke-dashoffset 1100ms var(--ease-phrase)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ================================================================== */
/* DATA TABLE — used only where a table is genuinely right             */
/* ================================================================== */
export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "start" | "end";
  hideBelow?: "sm" | "md" | "lg";
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  empty,
  caption,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  caption?: string;
  className?: string;
}) {
  const { density } = useApp();
  const hideCls = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };
  const padY = density === "compact" ? "py-2" : "py-3";
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-full border-collapse text-right">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-white/[0.07]">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-3 pb-2.5 text-[11px] font-medium text-ink-400",
                  c.align === "end" ? "text-left" : "text-right",
                  c.hideBelow && hideCls[c.hideBelow],
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="stagger">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
              className={cn(
                "border-b border-white/[0.04] transition-colors duration-[var(--sixteenth)] last:border-0",
                onRowClick && "cursor-pointer hover:bg-white/[0.025]",
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn("px-3 text-[13px] text-ink-100", padY, c.align === "end" ? "text-left" : "text-right", c.hideBelow && hideCls[c.hideBelow], c.className)}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================== */
/* LIST ROW — the non-table alternative                                */
/* ================================================================== */
export function ListRow({
  lead,
  title,
  meta,
  end,
  onClick,
  active,
  className,
}: {
  lead?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  end?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  const { density } = useApp();
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3.5 text-right transition-all duration-[var(--sixteenth)]",
        density === "compact" ? "py-2.5" : "py-3",
        active ? "border-gold-500/35 bg-gold-500/[0.06]" : "border-white/[0.05] bg-white/[0.02]",
        onClick && !active && "hover:border-white/[0.12] hover:bg-white/[0.04]",
        className,
      )}
    >
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-ink-50">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-[11.5px] text-ink-300">{meta}</span>}
      </span>
      {end && <span className="flex shrink-0 items-center gap-2">{end}</span>}
    </Comp>
  );
}

/* ================================================================== */
/* DRAWER + DIALOG                                                     */
/* ================================================================== */
/* ================================================================== */
/* FOCUS TRAP — shared by Drawer and Dialog                            */
/* ================================================================== */
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside an open overlay and restores it on close.
 *
 * Without this, Tab walks out of a modal into the page behind it, which leaves
 * screen-reader and keyboard users stranded (§20).
 */
function useFocusTrap(open: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const container = ref.current;
    const previous = document.activeElement as HTMLElement | null;

    // Focus the first control so typing starts in the form, not the document.
    const first = container?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? container)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, ref]);
}

export function Drawer({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  width = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg" | "xl";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(open, panelRef);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { md: "sm:w-[420px]", lg: "sm:w-[560px]", xl: "sm:w-[720px]" }[width];
  return (
    <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="بستن" onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink-950/65 backdrop-blur-[2px]" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col border-white/[0.08] bg-ink-900 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7)]",
          "inset-x-0 bottom-0 max-h-[90vh] animate-sheet-up rounded-t-3xl border-t",
          "sm:inset-y-0 sm:left-0 sm:right-auto sm:max-h-none sm:animate-sheet-in sm:rounded-none sm:border-e sm:border-t-0",
          w,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            {kicker && <div className="text-[10.5px] font-medium text-gold-400">{kicker}</div>}
            <h2 id={titleId} className="mt-0.5 truncate text-base font-semibold text-ink-50">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن" className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] text-ink-300 hover:bg-white/[0.05]">
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5" style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(open, panelRef);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="بستن" onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink-950/70 backdrop-blur-sm" />
      <div ref={panelRef} tabIndex={-1} className="relative w-full max-w-md animate-sheet-up overflow-hidden rounded-2xl border border-white/[0.1] bg-ink-900 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="absolute inset-x-0 top-0 h-px hairline-gold" />
        <div className="p-5">
          <h2 id={titleId} className="text-base font-semibold text-ink-50">{title}</h2>
          {description && <p className="mt-2 text-[13px] leading-relaxed text-ink-300">{description}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ================================================================== */
/* FORM FIELD                                                          */
/* ================================================================== */
/**
 * Labelled form field.
 *
 * `children` may be a render function, which receives the wiring a control
 * needs to be accessible: a stable id, `aria-invalid`, and `aria-describedby`
 * pointing at the error or hint. The error is rendered in an assertive live
 * region so a screen reader announces it when validation fails (§20).
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode | ((props: FieldControlProps) => ReactNode);
  className?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const control: FieldControlProps = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
  };
  const heading = (
    <span className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-xs font-medium text-ink-200">
        {label}
        {required && (
          <span className="ms-1 text-danger-400" aria-hidden>
            *
          </span>
        )}
      </span>
      {hint && !error && (
        <span id={hintId} className="text-[10.5px] text-ink-500">
          {hint}
        </span>
      )}
    </span>
  );

  // Render-prop children wire themselves up by id, so the label is explicit.
  // Plain children keep the original implicit association by nesting inside
  // the label — that is what every existing caller relies on.
  if (typeof children !== "function") {
    return (
      <label className={cn("block", className)}>
        {heading}
        {children}
        {error && (
          <span id={errorId} role="alert" className="mt-1.5 block text-[11px] leading-relaxed text-danger-400">
            {error}
          </span>
        )}
      </label>
    );
  }

  return (
    <div className={cn("block", className)}>
      <label htmlFor={id} className="block">
        {heading}
      </label>
      {children(control)}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[11px] leading-relaxed text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}

export interface FieldControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
}

export const inputCls =
  "h-10 w-full rounded-xl border border-white/[0.08] bg-ink-850 px-3.5 text-[13px] text-ink-50 outline-none transition-colors placeholder:text-ink-500 hover:border-white/[0.14] focus:border-gold-500/50";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-[var(--eighth)]",
        checked ? "border-gold-500/40 bg-gold-500/25" : "border-white/[0.08] bg-white/[0.05]",
      )}
    >
      <span
        className={cn(
          "absolute size-4 rounded-full transition-all duration-[var(--eighth)] ease-[var(--ease-resonance)]",
          checked ? "right-1 bg-gold-400" : "right-[22px] bg-ink-400",
        )}
      />
    </button>
  );
}

/* ================================================================== */
/* SECTION — a titled block inside a page                              */
/* ================================================================== */
export function Panel({
  title,
  kicker,
  aside,
  action,
  onAction,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: ReactNode;
  kicker?: ReactNode;
  aside?: ReactNode;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}) {
  return (
    <Surface className={cn("flex flex-col", flush ? "" : "p-5", className)}>
      {title && (
        <div className={cn("flex items-start justify-between gap-3", flush && "px-5 pt-5")}>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[14.5px] font-semibold leading-none text-ink-50">{title}</h2>
              {aside}
            </div>
            {kicker && <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-300">{kicker}</p>}
          </div>
          {action && (
            <button type="button" onClick={onAction} className="group inline-flex shrink-0 items-center gap-1 text-[11.5px] text-ink-300 transition-colors hover:text-gold-400">
              {action}
              <ChevronLeft className="size-3.5 transition-transform duration-[var(--eighth)] group-hover:-translate-x-0.5" />
            </button>
          )}
        </div>
      )}
      <div className={cn(title && !flush && "mt-4", flush && "mt-4", bodyClassName, "flex-1")}>{children}</div>
    </Surface>
  );
}
