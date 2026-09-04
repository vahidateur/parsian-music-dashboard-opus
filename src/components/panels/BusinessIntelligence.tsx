import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpLeft, Smartphone, UserRound, UsersRound } from "lucide-react";
import { growthSeries, instruments, occupancy, revenueSeries, revenueTarget } from "@/data/academy";
import { faNum, faPercent } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { ChartCard, PeriodSelect } from "@/components/ds/blocks";
import { Delta, Surface } from "@/components/ds/primitives";
import { ErrorState, LoadingState } from "@/components/ds/states";
import { cn } from "@/utils/cn";

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

const GOLD = "#d4a853";
const MUTED_BAR = "#3a322a";

/* ------------------------------------------------------------------ */
/* Revenue — bars, RTL timeline                                        */
/* ------------------------------------------------------------------ */
function RevenueChart() {
  const [period, setPeriod] = useState("۶ ماه اخیر");
  const [state, setState] = useState<"ok" | "loading" | "error">("ok");
  const [hover, setHover] = useState<number | null>(null);
  const { ref, width } = useSize<HTMLDivElement>();

  const changePeriod = (p: string) => {
    setPeriod(p);
    setState("loading");
    window.setTimeout(() => setState(p === "سال گذشته" ? "error" : "ok"), 700);
  };
  const retry = () => {
    setState("loading");
    window.setTimeout(() => {
      setPeriod("۶ ماه اخیر");
      setState("ok");
    }, 900);
  };

  const H = 172;
  const padT = 24;
  const padB = 22;
  const padX = 6;
  const n = revenueSeries.length;
  const max = Math.max(revenueTarget, ...revenueSeries.map((d) => d.value)) * 1.06;
  const step = (width - padX * 2) / n;
  const bw = Math.min(38, step * 0.5);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const baseline = H - padB;
  const last = revenueSeries[n - 1];
  const prev = revenueSeries[n - 2];
  const delta = ((last.value - prev.value) / prev.value) * 100;

  return (
    <ChartCard
      title="درآمد"
      headline={
        <>
          {faNum(last.value, { decimals: 1 })} <span className="text-sm font-medium text-ink-300">میلیون تومان · {last.label}</span>
        </>
      }
      insight={
        <span className="flex flex-wrap items-center gap-2">
          <Delta value={Number(delta.toFixed(1))} />
          <span>{faPercent(Math.round((last.value / revenueTarget) * 100))} از هدف ماهانه محقق شده · ۱۰ روز تا پایان ماه</span>
        </span>
      }
      toolbar={<PeriodSelect value={period} options={["۶ ماه اخیر", "۱۲ ماه اخیر", "سال گذشته"]} onChange={changePeriod} />}
      footer={state === "ok" ? "بیشترین رشد از شهریهٔ کلاس‌های گروهی · پرداخت آنلاین ۶۴٪ تراکنش‌ها" : undefined}
    >
      <div ref={ref} className="relative w-full" style={{ height: H }}>
        {state === "loading" && <LoadingState className="absolute inset-0 py-0" label="در حال دریافت داده‌های مالی…" />}
        {state === "error" && <ErrorState className="absolute inset-0 py-0" onRetry={retry} />}
        {state === "ok" && width > 0 && (
          <svg key={period} width={width} height={H} className="overflow-visible" role="img" aria-label="نمودار درآمد ماهانه">
            <defs>
              <linearGradient id="rev-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e4c57a" />
                <stop offset="100%" stopColor="#b98c3e" />
              </linearGradient>
            </defs>
            {/* target */}
            <line x1={padX} x2={width - padX} y1={y(revenueTarget)} y2={y(revenueTarget)} stroke="rgba(212,168,83,0.35)" strokeDasharray="3 4" />
            <text x={width - padX} y={y(revenueTarget) - 5} textAnchor="end" className="nums fill-gold-500/80 text-[10px]">
              هدف {faNum(revenueTarget)}
            </text>
            <line x1={padX} x2={width - padX} y1={baseline + 0.5} y2={baseline + 0.5} stroke="rgba(255,255,255,0.07)" />
            {revenueSeries.map((d, i) => {
              const cx = width - padX - step * (i + 0.5);
              const top = y(d.value);
              const isLast = i === n - 1;
              const active = hover === i;
              return (
                <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={cx - step / 2} y={padT - 10} width={step} height={H - padT} fill="transparent" />
                  <rect
                    x={cx - bw / 2}
                    y={top}
                    width={bw}
                    height={baseline - top}
                    rx={4}
                    fill={isLast ? "url(#rev-gold)" : active ? "#4a4036" : MUTED_BAR}
                    style={{ transformOrigin: `${cx}px ${baseline}px`, animation: `grow-y 500ms var(--ease-phrase) ${i * 70}ms both`, transition: "fill var(--sixteenth)" }}
                  />
                  <text
                    x={cx}
                    y={top - 7}
                    textAnchor="middle"
                    className={cn("nums text-[10.5px]", isLast ? "fill-gold-300 font-semibold" : active ? "fill-ink-100" : "fill-ink-400")}
                    style={{ animation: `fade-in 400ms var(--ease-legato) ${300 + i * 70}ms both` }}
                  >
                    {faNum(d.value, { decimals: 1 })}
                  </text>
                  <text x={cx} y={H - 6} textAnchor="middle" className={cn("text-[10.5px]", isLast ? "fill-ink-100" : "fill-ink-400")}>
                    {d.label}
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
/* Student growth — line + area                                        */
/* ------------------------------------------------------------------ */
function GrowthChart() {
  const { ref, width } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 172;
  const padT = 26;
  const padB = 22;
  const padX = 18;
  const n = growthSeries.length;
  const vals = growthSeries.map((d) => d.value);
  const min = Math.min(...vals) * 0.985;
  const max = Math.max(...vals) * 1.01;
  const step = (width - padX * 2) / (n - 1);
  const pts = useMemo(
    () => growthSeries.map((d, i) => ({ x: width - padX - i * step, y: padT + (1 - (d.value - min) / (max - min)) * (H - padT - padB), ...d })),
    [width, step, min, max],
  );
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const area = `${path} L${pts[n - 1]?.x ?? 0} ${H - padB} L${pts[0]?.x ?? 0} ${H - padB} Z`;
  const length = useMemo(() => pts.reduce((acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)), 0), [pts]);
  const last = growthSeries[n - 1];
  const first = growthSeries[0];
  const added = last.value - growthSeries[n - 2].value;

  return (
    <ChartCard
      title="رشد هنرجویان"
      headline={
        <>
          {faNum(last.value)} <span className="text-sm font-medium text-ink-300">هنرجوی فعال</span>
        </>
      }
      insight={
        <span className="flex flex-wrap items-center gap-2">
          <Delta value={Number((((last.value - first.value) / first.value) * 100).toFixed(1))} label="در ۶ ماه" />
          <span>
            {faNum(added)} هنرجوی جدید این ماه · ریزش {faPercent(2.1, 1)} (کمتر از میانگین)
          </span>
        </span>
      }
      footer="روند صعودی پایدار — سه ماه متوالی بالاتر از پیش‌بینی"
    >
      <div ref={ref} className="relative w-full" style={{ height: H }}>
        {width > 0 && (
          <svg width={width} height={H} className="overflow-visible" role="img" aria-label="نمودار رشد هنرجویان">
            <defs>
              <linearGradient id="growth-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity="0.22" />
                <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={padX} x2={width - padX} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="rgba(255,255,255,0.05)" />
            ))}
            <line x1={padX} x2={width - padX} y1={H - padB + 0.5} y2={H - padB + 0.5} stroke="rgba(255,255,255,0.07)" />
            <path d={area} fill="url(#growth-area)" style={{ animation: "fade-in 900ms var(--ease-legato) 500ms both" }} />
            <path
              d={path}
              fill="none"
              stroke={GOLD}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: length, strokeDashoffset: length, animation: "draw 1300ms var(--ease-legato) both" }}
            />
            {pts.map((p, i) => {
              const isLast = i === n - 1;
              const active = hover === i;
              return (
                <g key={p.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={p.x - step / 2} y={0} width={step} height={H} fill="transparent" />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isLast ? 4 : active ? 3.5 : 2.5}
                    fill={isLast || active ? "#e4c57a" : "#1a1714"}
                    stroke={GOLD}
                    strokeWidth={1.5}
                    style={{ animation: `fade-in 300ms var(--ease-legato) ${200 + i * 160}ms both`, transition: "r var(--sixteenth)" }}
                  />
                  {(isLast || active) && (
                    <text x={p.x} y={p.y - 11} textAnchor="middle" className="nums fill-ink-50 text-[11px] font-semibold" style={{ animation: "fade-in 300ms both" }}>
                      {faNum(p.value)}
                    </text>
                  )}
                  <text x={p.x} y={H - 6} textAnchor="middle" className={cn("text-[10.5px]", isLast ? "fill-ink-100" : "fill-ink-400")}>
                    {p.label}
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
/* Occupancy — ring + rooms + weekday strip                            */
/* ------------------------------------------------------------------ */
function OccupancyChart() {
  const { navigate } = useApp();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(id);
  }, []);
  const r = 50;
  const c = 2 * Math.PI * r;
  const freeRoom = [...occupancy.rooms].sort((a, b) => a.value - b.value)[0];
  const peakDay = [...occupancy.week].sort((a, b) => b.value - a.value)[0];

  return (
    <ChartCard
      title="اشغال کلاس‌ها"
      headline={
        <>
          {faPercent(occupancy.overall)} <span className="text-sm font-medium text-ink-300">میانگین این هفته</span>
        </>
      }
      insight={`${freeRoom.label} با ${faPercent(freeRoom.value)} اشغال، ظرفیت آزاد دارد — مناسب بازهٔ جدید پیانو`}
      footer={
        <button type="button" onClick={() => navigate({ view: "schedule", filter: "new-slot" })} className="text-gold-400 hover:text-gold-300">
          پیشنهاد: انتقال تقاضای {peakDay.full} به {freeRoom.label} ←
        </button>
      }
    >
      <div className="flex items-center gap-6">
        <div className="relative size-[124px] shrink-0">
          <svg viewBox="0 0 124 124" className="size-full -rotate-90">
            <circle cx="62" cy="62" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="62"
              cy="62"
              r={r}
              fill="none"
              stroke={GOLD}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={mounted ? c * (1 - occupancy.overall / 100) : c}
              style={{ transition: "stroke-dashoffset 1400ms var(--ease-phrase)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="nums text-2xl font-semibold leading-none text-ink-50">{faPercent(occupancy.overall)}</span>
            <span className="mt-1 text-[10px] text-ink-400">اشغال</span>
          </div>
        </div>
        <ul className="flex-1 space-y-2.5">
          {occupancy.rooms.map((room, i) => (
            <li key={room.label} className="flex items-center gap-3 text-xs">
              <span className="w-10 shrink-0 text-ink-300">{room.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className={cn("block h-full origin-right rounded-full", room.value < 65 ? "bg-violet-400/80" : "bg-gold-500/80")}
                  style={{ width: `${room.value}%`, animation: `grow-x 700ms var(--ease-phrase) ${i * 90}ms both` }}
                />
              </span>
              <span className="nums w-9 text-left text-ink-100">{faPercent(room.value)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-ink-400">
          <span>روزهای هفته</span>
          <span>
            اوج: {peakDay.full} {faPercent(peakDay.value)}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {occupancy.week.map((d, i) => (
            <div
              key={d.label}
              title={`${d.full} · ${faPercent(d.value)}`}
              className={cn(
                "flex h-9 flex-col items-center justify-center rounded-lg border text-[11px] transition-colors",
                i === 3 ? "border-gold-500/50" : "border-transparent",
              )}
              style={{ background: `rgba(212,168,83,${(d.value / 100) * 0.42})`, animation: `phrase-in 400ms var(--ease-phrase) ${i * 50}ms both` }}
            >
              <span className={cn("font-medium", d.value > 60 ? "text-ink-50" : "text-ink-300")}>{d.label}</span>
              <span className="nums text-[9px] text-ink-200/80">{faNum(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* Popular instruments                                                 */
/* ------------------------------------------------------------------ */
function InstrumentsChart() {
  const total = instruments.reduce((a, b) => a + b.count, 0);
  return (
    <ChartCard
      title="سازهای محبوب"
      headline={
        <>
          پیانو <span className="text-sm font-medium text-ink-300">{faPercent(instruments[0].share)} از {faNum(total)} هنرجو</span>
        </>
      }
      insight="تقاضای پیانو ۳ ماه متوالی بالاتر از ظرفیت است · لیست انتظار: ۱۴ نفر"
      footer="آواز سریع‌ترین رشد فصل را دارد (+۲ واحد سهم) · درامز بدون تغییر"
    >
      <ul className="space-y-3.5">
        {instruments.map((ins, i) => (
          <li key={ins.key} className="flex items-center gap-3 text-xs">
            <span className="w-11 shrink-0 font-medium text-ink-100">{ins.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <span
                className={cn("block h-full origin-right rounded-full", i === 0 ? "bg-gradient-to-l from-gold-400 to-gold-600" : i === 1 ? "bg-violet-500/70" : "bg-ink-300/40")}
                style={{ width: `${ins.share}%`, animation: `grow-x 700ms var(--ease-phrase) ${i * 80}ms both` }}
              />
            </span>
            <span className="nums w-9 shrink-0 text-left font-semibold text-ink-50">{faPercent(ins.share)}</span>
            <span className="nums w-12 shrink-0 text-left text-ink-400">{faNum(ins.count)} نفر</span>
            <span
              className={cn(
                "nums flex w-9 shrink-0 items-center justify-end gap-0.5 text-[10px]",
                ins.delta > 0 ? "text-ok-400" : ins.delta < 0 ? "text-danger-400" : "text-ink-500",
              )}
              dir="ltr"
              title="تغییر سهم نسبت به فصل قبل"
            >
              {ins.delta > 0 ? <ArrowUpLeft className="size-3" /> : ins.delta < 0 ? <ArrowDownLeft className="size-3" /> : null}
              {ins.delta === 0 ? "—" : faNum(Math.abs(ins.delta))}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */
export function BusinessIntelligence({ className }: { className?: string }) {
  return (
    <section className={cn("", className)} aria-labelledby="bi-title">
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
          <h2 id="bi-title" className="text-[15px] font-semibold text-ink-50">
            تحلیل کسب‌وکار
          </h2>
          <p className="mt-1 text-xs text-ink-300">چهار نمودار که تصمیم می‌سازند — نه بیشتر.</p>
        </div>
        <span className="hidden text-[11px] text-ink-400 sm:inline">داده‌ها تا امروز ۰۶:۰۰ · منبع: سامانهٔ یکپارچه</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueChart />
        <GrowthChart />
        <OccupancyChart />
        <InstrumentsChart />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Ecosystem — this dashboard is one surface of a unified system       */
/* ------------------------------------------------------------------ */
export function EcosystemStrip({ className }: { className?: string }) {
  const surfaces = [
    { icon: UserRound, label: "پنل مدیریت", meta: "شما · فعال", active: true },
    { icon: UsersRound, label: "پنل مدرس", meta: "۱۸ مدرس · ۷ آنلاین", active: false },
    { icon: Smartphone, label: "اپلیکیشن هنرجو", meta: "۹۸۷ نصب فعال", active: false },
  ];
  return (
    <Surface className={cn("flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between", className)}>
      <div className="max-w-md">
        <h3 className="text-sm font-semibold text-ink-50">سامانهٔ یکپارچهٔ آوا</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-300">
          یک منبع داده برای مدیریت، مدرسین و هنرجویان. هر تغییری اینجا — لغو کلاس، جلسهٔ جبرانی، وضعیت شهریه — همان لحظه در اپلیکیشن هنرجو دیده می‌شود.
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
        همگام‌سازی: ۲ دقیقه پیش
      </div>
    </Surface>
  );
}
