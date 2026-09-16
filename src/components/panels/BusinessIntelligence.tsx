import { useEffect, useMemo, useRef, useState } from "react";
import { Smartphone, UserRound, UsersRound } from "lucide-react";
import { faNum, faPercent, faToman, NO_DATA } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { accentHex } from "@/lib/theme";
import { ratioPct } from "@/lib/stats";
import { ChartCard } from "@/components/ds/blocks";
import { Delta, Surface } from "@/components/ds/primitives";
import { LoadingState } from "@/components/ds/states";
import type {
  DashboardCounts,
  InstrumentRow,
  OccupancyModel,
  ReceivablesModel,
  RosterModel,
} from "@/domains/shared/dashboardInsights";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/* M9 / H4                                                             */
/*                                                                     */
/* These four charts used to plot `revenueSeries`, `growthSeries`,      */
/* `occupancy` and `instruments` from `@/data/academy` — figures nobody */
/* stored, shown identically in an EMPTY academy. Every number below    */
/* now comes from a record through `useDashboardInsights`, and a chart  */
/* whose input set is empty states «دادهٔای نیست» instead of plotting a */
/* shape it cannot support.                                            */
/*                                                                     */
/* The revenue chart is gone rather than recomputed: collected revenue  */
/* is a Finance/Reports figure, and both domains are recorded as        */
/* *planned, not implemented* (`docs/domains/finance/README.md` and `docs/domains/reports/README.md`, D6). The     */
/* money slot now shows the receivables the student records carry.      */
/* ------------------------------------------------------------------ */

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** The panel's one "there is nothing to plot" state. */
function NoData({ className }: { className?: string }) {
  return (
    <p className={cn("flex h-full min-h-24 items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-xs text-ink-400", className)}>
      داده‌ای نیست
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Receivables — the money the records actually carry                  */
/* ------------------------------------------------------------------ */
function ReceivablesChart({ model }: { model: ReceivablesModel }) {
  const max = model.top?.amount ?? 0;
  const shareOfStudents = ratioPct(model.owing, model.students);

  if (model.students === 0) {
    return (
      <ChartCard title="مانده بدهی" headline={<span className="text-ink-300">{NO_DATA}</span>} insight="هیچ رکورد هنرجویی خوانده نشده است.">
        <NoData />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="مانده بدهی"
      headline={
        <>
          {faToman(model.total, true)} <span className="text-sm font-medium text-ink-300">مانده · {faNum(model.owing)} رکورد</span>
        </>
      }
      insight={
        model.owing > 0 && shareOfStudents !== null ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="nums">{faPercent(shareOfStudents)} از رکوردهای هنرجو مانده دارند</span>
          </span>
        ) : (
          "هیچ رکورد هنرجویی ماندهٔ ثبت‌شده ندارد."
        )
      }
      footer={
        model.top
          ? `بیشترین مانده: ${model.top.label} · ${faToman(model.top.amount, true)}`
          : "همهٔ رکوردهای هنرجو بدون مانده‌اند."
      }
    >
      {model.rows.length > 0 ? (
        <ul className="space-y-3.5">
          {model.rows.map((row, i) => (
            <li key={row.id} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0 truncate font-medium text-ink-100" title={row.label}>
                {row.label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <span
                  className={cn("block h-full origin-right rounded-full", i === 0 ? "bg-gradient-to-l from-gold-400 to-gold-600" : "bg-ink-300/40")}
                  style={{ width: `${max > 0 ? (row.amount / max) * 100 : 0}%`, animation: `grow-x 700ms var(--ease-phrase) ${i * 70}ms both` }}
                />
              </span>
              <span className="nums w-24 shrink-0 text-left text-ink-100">{faToman(row.amount, true)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <NoData />
      )}
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* Roster growth — cumulative students per stored join month           */
/* ------------------------------------------------------------------ */
function GrowthChart({ model }: { model: RosterModel }) {
  const { accent } = useApp();
  const gold = accentHex[accent];
  const { ref, width } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 172;
  const padT = 26;
  const padB = 22;
  const padX = 18;
  const points = model.points;

  const geometry = useMemo(() => {
    if (width <= 0 || points.length < 2) return null;
    const n = points.length;
    const vals = points.map((point) => point.value);
    const min = Math.min(...vals) * 0.985;
    const max = Math.max(...vals) * 1.01;
    // A flat roster would divide by zero: keep the line on its own baseline.
    const span = max - min || 1;
    const step = (width - padX * 2) / (n - 1);
    const pts = points.map((point, i) => ({
      ...point,
      x: width - padX - i * step,
      y: padT + (1 - (point.value - min) / span) * (H - padT - padB),
    }));
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const area = `${path} L${pts[n - 1].x.toFixed(1)} ${H - padB} L${pts[0].x.toFixed(1)} ${H - padB} Z`;
    const length = pts.reduce((acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)), 0);
    return { pts, path, area, length, step };
  }, [points, width]);

  const last = points[points.length - 1] ?? null;
  const first = points[0] ?? null;
  const added = last && points.length > 1 ? last.value - points[points.length - 2].value : null;

  if (points.length === 0) {
    return (
      <ChartCard title="رشد هنرجویان" headline={<span className="text-ink-300">{NO_DATA}</span>} insight="هیچ رکورد هنرجویی خوانده نشده است.">
        <NoData />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="رشد هنرجویان"
      headline={
        <>
          {faNum(last!.value)} <span className="text-sm font-medium text-ink-300">هنرجو در رکوردها</span>
        </>
      }
      insight={
        <span className="flex flex-wrap items-center gap-2">
          {added !== null && <Delta value={added} label={`در ${last!.label}`} />}
          <span className="nums">
            {first ? `از ${first.label} تا ${last!.label}` : null} · {faNum(points.length)} ماه ثبت‌شده
          </span>
        </span>
      }
      footer={
        first && first.value !== last!.value
          ? `افزایش ${faNum(last!.value - first.value)} هنرجو در بازهٔ ${first.label} تا ${last!.label}`
          : "در این بازه هنرجویی به رکوردها افزوده نشده است."
      }
    >
      <div ref={ref} className="relative w-full" style={{ height: H }}>
        {points.length < 2 && <NoData className="h-full" />}
        {geometry && (
          <svg width={width} height={H} className="overflow-visible" role="img" aria-label="نمودار رشد هنرجویان بر پایهٔ ماه پیوستن ثبت‌شده">
            <defs>
              <linearGradient id="growth-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gold[500]} stopOpacity="0.22" />
                <stop offset="100%" stopColor={gold[500]} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={padX} x2={width - padX} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="rgba(255,255,255,0.05)" />
            ))}
            <line x1={padX} x2={width - padX} y1={H - padB + 0.5} y2={H - padB + 0.5} stroke="rgba(255,255,255,0.07)" />
            <path d={geometry.area} fill="url(#growth-area)" style={{ animation: "fade-in 900ms var(--ease-legato) 500ms both" }} />
            <path
              d={geometry.path}
              fill="none"
              stroke={gold[500]}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: geometry.length, strokeDashoffset: geometry.length, animation: "draw 1300ms var(--ease-legato) both" }}
            />
            {geometry.pts.map((point, i) => {
              const isLast = i === geometry.pts.length - 1;
              const active = hover === i;
              return (
                <g key={`${point.label}-${i}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={point.x - geometry.step / 2} y={0} width={geometry.step} height={H} fill="transparent" />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isLast ? 4 : active ? 3.5 : 2.5}
                    fill={isLast || active ? gold[400] : "#1a1714"}
                    stroke={gold[500]}
                    strokeWidth={1.5}
                    style={{ animation: `fade-in 300ms var(--ease-legato) ${200 + i * 160}ms both`, transition: "r var(--sixteenth)" }}
                  />
                  {(isLast || active) && (
                    <text x={point.x} y={point.y - 11} textAnchor="middle" className="nums fill-ink-50 text-[11px] font-semibold" style={{ animation: "fade-in 300ms both" }}>
                      {faNum(point.value)}
                    </text>
                  )}
                  <text x={point.x} y={H - 6} textAnchor="middle" className={cn("text-[10.5px]", isLast ? "fill-ink-100" : "fill-ink-400")}>
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* Occupancy — ring + rooms + weekday strip, from stored classes       */
/* ------------------------------------------------------------------ */
function OccupancyChart({ model }: { model: OccupancyModel }) {
  const { navigate, accent } = useApp();
  const gold = accentHex[accent];
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(id);
  }, []);
  const r = 50;
  const c = 2 * Math.PI * r;

  if (model.classes === 0) {
    return (
      <ChartCard title="اشغال کلاس‌ها" headline={<span className="text-ink-300">{NO_DATA}</span>} insight="هیچ رکورد کلاسی خوانده نشده است.">
        <NoData />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="اشغال کلاس‌ها"
      headline={
        <>
          {faPercent(model.overallPct)} <span className="text-sm font-medium text-ink-300">از {faNum(model.totalSeats)} صندلی</span>
        </>
      }
      insight={`${faNum(model.seatsFree)} از ${faNum(model.classes)} کلاس ظرفیت آزاد دارند · ${faNum(model.takenSeats)} صندلی پر شده است`}
      footer={
        <button type="button" onClick={() => navigate({ view: "schedule" })} className="text-gold-400 hover:text-gold-300">
          {model.peakDay && model.quietestDay
            ? `بیشترین اشغال: ${model.peakDay.full} ${faPercent(model.peakDay.pct)} · کمترین: ${model.quietestDay.full} ${faPercent(model.quietestDay.pct)} ←`
            : "مشاهدهٔ تقویم ←"}
        </button>
      }
    >
      <div className="flex items-center gap-6">
        <div className="relative size-[124px] shrink-0">
          <svg viewBox="0 0 124 124" className="size-full -rotate-90">
            <circle cx="62" cy="62" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            {model.overallPct !== null && (
              <circle
                cx="62"
                cy="62"
                r={r}
                fill="none"
                stroke={gold[500]}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={mounted ? c * (1 - model.overallPct / 100) : c}
                style={{ transition: "stroke-dashoffset 1400ms var(--ease-phrase)" }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="nums text-2xl font-semibold leading-none text-ink-50">{faPercent(model.overallPct)}</span>
            <span className="mt-1 text-[10px] text-ink-400">اشغال</span>
          </div>
        </div>
        <ul className="flex-1 space-y-2.5">
          {model.rooms.map((room, i) => (
            <li key={room.label} className="flex items-center gap-3 text-xs">
              <span className="w-10 shrink-0 truncate text-ink-300" title={room.label}>
                {room.label}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className={cn("block h-full origin-right rounded-full", (room.pct ?? 0) < 65 ? "bg-violet-400/80" : "bg-gold-500/80")}
                  style={{ width: `${room.pct ?? 0}%`, animation: `grow-x 700ms var(--ease-phrase) ${i * 90}ms both` }}
                />
              </span>
              <span className="nums w-9 text-left text-ink-100">{faPercent(room.pct)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-ink-400">
          <span>روزهای هفته</span>
          <span className="nums">{model.peakDay ? `اوج: ${model.peakDay.full} ${faPercent(model.peakDay.pct)}` : NO_DATA}</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {model.week.map((day, i) => (
            <div
              key={day.full}
              title={`${day.full} · ${faPercent(day.pct)}`}
              className={cn("flex h-9 flex-col items-center justify-center rounded-lg border text-[11px] transition-colors", model.peakDay?.index === day.index ? "border-gold-500/50" : "border-transparent")}
              style={{ background: day.pct === null ? "transparent" : `rgba(212,168,83,${(day.pct / 100) * 0.42})`, animation: `phrase-in 400ms var(--ease-phrase) ${i * 50}ms both` }}
            >
              <span className={cn("font-medium", (day.pct ?? 0) > 60 ? "text-ink-50" : "text-ink-300")}>{day.label}</span>
              <span className="nums text-[9px] text-ink-200/80">{day.pct === null ? NO_DATA : faNum(day.pct)}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* Instrument mix — from the instrument stored on each student row     */
/* ------------------------------------------------------------------ */
function InstrumentsChart({ rows, total }: { rows: InstrumentRow[]; total: number }) {
  if (rows.length === 0) {
    return (
      <ChartCard title="سازهای محبوب" headline={<span className="text-ink-300">{NO_DATA}</span>} insight="هیچ رکورد هنرجویی خوانده نشده است.">
        <NoData />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="سازهای محبوب"
      headline={
        <>
          {rows[0].label} <span className="text-sm font-medium text-ink-300">{faPercent(rows[0].sharePct)} از {faNum(total)} هنرجو</span>
        </>
      }
      insight={`${faNum(rows.length)} ساز روی رکوردهای هنرجو ثبت شده است`}
      footer="این توزیع از ساز ذخیره‌شده روی هر رکورد هنرجو محاسبه شده است؛ تغییر سهم نسبت به فصل قبل در رکوردها وجود ندارد."
    >
      <ul className="space-y-3.5">
        {rows.map((row, i) => (
          <li key={row.id} className="flex items-center gap-3 text-xs">
            <span className="w-11 shrink-0 truncate font-medium text-ink-100" title={row.label}>
              {row.label}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <span
                className={cn("block h-full origin-right rounded-full", i === 0 ? "bg-gradient-to-l from-gold-400 to-gold-600" : i === 1 ? "bg-violet-500/70" : "bg-ink-300/40")}
                style={{ width: `${row.sharePct ?? 0}%`, animation: `grow-x 700ms var(--ease-phrase) ${i * 80}ms both` }}
              />
            </span>
            <span className="nums w-9 shrink-0 text-left font-semibold text-ink-50">{faPercent(row.sharePct)}</span>
            <span className="nums w-12 shrink-0 text-left text-ink-400">{faNum(row.count)} نفر</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */
export function BusinessIntelligence({
  roster,
  occupancy,
  instruments,
  receivables,
  students,
  loading,
  className,
}: {
  roster: RosterModel;
  occupancy: OccupancyModel;
  instruments: InstrumentRow[];
  receivables: ReceivablesModel;
  /** Roster size, so the instrument mix states the denominator it used. */
  students: number;
  loading?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("", className)} aria-labelledby="bi-title">
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
          <h2 id="bi-title" className="text-[15px] font-semibold text-ink-50">
            تحلیل کسب‌وکار
          </h2>
          <p className="mt-1 text-xs text-ink-300">چهار نمودار که تصمیم می‌سازند — هر عدد از رکوردهای همین محیط.</p>
        </div>
        <span className="hidden text-[11px] text-ink-400 sm:inline">منبع: رکوردهای ذخیره‌شده · بدون برآورد</span>
      </div>
      {loading ? (
        <Surface className="p-5">
          <LoadingState label="در حال خواندن رکوردهای تحلیلی…" className="py-16" />
        </Surface>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReceivablesChart model={receivables} />
          <GrowthChart model={roster} />
          <OccupancyChart model={occupancy} />
          <InstrumentsChart rows={instruments} total={students} />
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Ecosystem — this dashboard is one surface of a unified system       */
/* ------------------------------------------------------------------ */
/**
 * M9/H4: the three tiles carried «۱۸ مدرس · ۷ آنلاین», «۹۸۷ نصب فعال» and
 * «همگام‌سازی: ۲ دقیقه پیش». None of those rows exist: the records hold no
 * online status, no app installs and no sync instant. Each tile now states what
 * the environment really contains.
 */
export function EcosystemStrip({ counts, className }: { counts: DashboardCounts; className?: string }) {
  const surfaces = [
    { icon: UserRound, label: "پنل مدیریت", meta: "شما · همین محیط", active: true },
    { icon: UsersRound, label: "پنل مدرس", meta: `${faNum(counts.teachers)} مدرس ثبت‌شده`, active: false },
    { icon: Smartphone, label: "نمای هنرجو", meta: `${faNum(counts.students)} هنرجو`, active: false },
  ];
  return (
    <Surface className={cn("flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between", className)}>
      <div className="max-w-md">
        <h3 className="text-sm font-semibold text-ink-50">سامانهٔ یکپارچهٔ آوا</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-300">
          یک منبع داده برای مدیریت، مدرسین و هنرجویان. هر تغییری اینجا — لغو کلاس، جلسهٔ جبرانی، وضعیت شهریه — همان لحظه در نمای هنرجو دیده می‌شود.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {surfaces.map((s) => (
          <div
            key={s.label}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3.5 py-2.5",
              s.active ? "border-gold-500/35 bg-gold-500/[0.06]" : "border-white/[0.07] bg-white/[0.02]",
            )}
          >
            <s.icon className={cn("size-4", s.active ? "text-gold-400" : "text-ink-400")} strokeWidth={1.75} />
            <div>
              <div className={cn("text-xs font-medium", s.active ? "text-gold-200" : "text-ink-100")}>{s.label}</div>
              <div className="nums text-[10.5px] text-ink-400">{s.meta}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-ink-400">
        <span className="relative flex size-1.5">
          <span className="ring-live absolute inline-flex size-1.5 rounded-full bg-ok-500" />
          <span className="relative inline-flex size-1.5 rounded-full bg-ok-400" />
        </span>
        <span className="nums">{faNum(counts.records)} رکورد در همین محیط</span>
      </div>
    </Surface>
  );
}
