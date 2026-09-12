import { useState } from "react";
import { ArrowLeft, Download, FileBarChart } from "lucide-react";
import { growthSeries, instruments, occupancy } from "@/data/academy";
import { attendanceByDay, attentionQueue, reportCatalog, teachers, type ReportDef } from "@/data/records";
import { faNum, faPercent } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, Delta, Sparkline, StatusBadge, Surface } from "@/components/ds/primitives";
import { DemoNote } from "@/components/ds/states";
import { Meter, PageHeader, Panel, Segmented } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
function ReportCard({ r, onOpen }: { r: ReportDef; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="surface group flex flex-col gap-3.5 p-5 text-right transition-all hover:border-white/[0.14] hover:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-ink-50">{r.title}</h3>
          <p className="mt-1 text-[11.5px] text-ink-400">{r.period}</p>
        </div>
        <ArrowLeft className="size-4 shrink-0 text-ink-500 transition-transform duration-[var(--eighth)] group-hover:-translate-x-0.5 group-hover:text-gold-400" />
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-300">{r.question}</p>
      <div className="flex items-end justify-between gap-3 border-t border-white/[0.05] pt-3">
        <div className="nums text-[17px] font-semibold text-ink-50">{r.headline}</div>
        <Delta value={r.delta} />
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
function ReportDetail({ r, onBack }: { r: ReportDef; onBack: () => void }) {
  const { navigate, notify } = useApp();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        breadcrumb={[{ label: "گزارش‌ها", onClick: onBack }, { label: r.title }]}
        kicker={r.period}
        title={r.title}
        description={r.question}
        actions={
          <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "خروجی گزارش نیازمند سرور است", detail: "تولید PDF در سرور انجام می‌شود و در دمو فعال نیست." })}>
            <Download className="size-3.5" /> دریافت گزارش
          </Button>
        }
      />

      {/* Signal → Evidence → Insight */}
      <Surface className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] text-ink-400">نتیجهٔ کلیدی</div>
            <div className="nums mt-1.5 text-3xl font-bold tracking-tight text-ink-50">{r.headline}</div>
          </div>
          <Delta value={r.delta} label="نسبت به دورهٔ قبل" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {r.evidence.map((e, i) => (
            <div key={e.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4" style={{ animation: `phrase-in 400ms var(--ease-phrase) ${i * 70}ms both` }}>
              <div className="text-[11px] text-ink-400">{e.label}</div>
              <div className="nums mt-1.5 text-lg font-semibold text-ink-50">{e.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
          <div className="text-[10.5px] font-medium text-violet-300">تفسیر</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-100">{r.finding}</p>
        </div>
      </Surface>

      {/* A single, relevant visualization per report */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(r.id === "rp1" || r.id === "rp2") && (
          <Panel title="روند هنرجویان" kicker="۶ ماه گذشته — جدیدترین در چپ" className="lg:col-span-2">
            <div className="flex items-end gap-3">
              {growthSeries.map((g, i) => (
                <div key={g.label} className="flex flex-1 flex-col items-center gap-2">
                  <span className="nums text-[10.5px] text-ink-300">{faNum(g.value)}</span>
                  <div
                    className={cn("w-full rounded-t-lg", i === growthSeries.length - 1 ? "bg-gradient-to-t from-gold-600 to-gold-400" : "bg-ink-600")}
                    style={{ height: (g.value - 1000) * 0.5, animation: `grow-y 500ms var(--ease-phrase) ${i * 70}ms both`, transformOrigin: "bottom" }}
                  />
                  <span className="text-[10.5px] text-ink-400">{g.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {r.id === "rp3" && (
          <Panel title="بهره‌وری مدرسین" className="lg:col-span-2" kicker="مرتب‌شده از کمترین ظرفیت استفاده‌شده">
            <ul className="space-y-3">
              {[...teachers].sort((a, b) => a.utilization - b.utilization).map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 text-[12.5px]">
                  <button type="button" onClick={() => navigate({ view: "teachers", id: t.id })} className="w-28 shrink-0 truncate text-right text-ink-200 hover:text-gold-300">
                    {t.name}
                  </button>
                  <Meter value={t.utilization} tone={t.utilization < 60 ? "violet" : "gold"} className="flex-1" delay={i * 60} />
                  <span className="nums w-9 shrink-0 text-left text-ink-100">{faPercent(t.utilization)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {r.id === "rp4" && (
          <Panel title="اشغال بر حسب روز" className="lg:col-span-2">
            <div className="grid grid-cols-7 gap-2">
              {occupancy.week.map((d, i) => (
                <div
                  key={d.label}
                  className="flex h-20 flex-col items-center justify-end rounded-xl border border-white/[0.06] p-2"
                  style={{ background: `linear-gradient(to top, rgba(212,168,83,${(d.value / 100) * 0.35}) ${d.value}%, transparent ${d.value}%)`, animation: `phrase-in 400ms var(--ease-phrase) ${i * 50}ms both` }}
                >
                  <span className="nums text-[11px] font-semibold text-ink-50">{faNum(d.value)}</span>
                  <span className="mt-1 text-[10px] text-ink-400">{d.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {r.id === "rp5" && (
          <Panel title="روند درآمد" className="lg:col-span-2" kicker="۱۳ نقطهٔ اخیر">
            <Sparkline data={[72, 64, 88, 91, 78, 96, 84, 102, 95, 110, 98, 118, 125]} kind="bars" width={560} height={120} className="w-full" />
          </Panel>
        )}
        {r.id === "rp6" && (
          <Panel title="سهم سازها" className="lg:col-span-2">
            <ul className="space-y-3">
              {instruments.map((ins, i) => (
                <li key={ins.key} className="flex items-center gap-3 text-[12.5px]">
                  <span className="w-14 shrink-0 text-ink-200">{ins.label}</span>
                  <Meter value={ins.share} tone={i === 0 ? "gold" : i === 1 ? "violet" : "neutral"} className="flex-1" delay={i * 70} />
                  <span className="nums w-9 shrink-0 text-left text-ink-50">{faPercent(ins.share)}</span>
                  <span className="nums w-14 shrink-0 text-left text-ink-400">{faNum(ins.count)} نفر</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {r.id === "rp7" && (
          <Panel title="حضور بر حسب روز" className="lg:col-span-2" kicker="حاضر · تأخیر · غایب — از راست به چپ">
            <div className="flex h-44 items-end gap-3">
              {attendanceByDay.map((d, i) => {
                const total = d.present + d.absent + d.late;
                return (
                  <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex h-36 w-full max-w-16 flex-col-reverse">
                      <div className="w-full rounded-b-md bg-ok-500/70" style={{ height: `${(d.present / total) * 100}%`, animation: `grow-y 500ms var(--ease-phrase) ${i * 60}ms both`, transformOrigin: "bottom" }} title={`حاضر: ${faNum(d.present)}`} />
                      <div className="w-full bg-warn-500/70" style={{ height: `${(d.late / total) * 100}%`, animation: `grow-y 500ms var(--ease-phrase) ${i * 60 + 80}ms both`, transformOrigin: "bottom" }} title={`تأخیر: ${faNum(d.late)}`} />
                      <div className="w-full rounded-t-md bg-danger-500/60" style={{ height: `${(d.absent / total) * 100}%`, animation: `grow-y 500ms var(--ease-phrase) ${i * 60 + 160}ms both`, transformOrigin: "bottom" }} title={`غایب: ${faNum(d.absent)}`} />
                    </div>
                    <span className={cn("nums text-[10.5px]", d.day === "چهارشنبه" ? "font-semibold text-warn-400" : "text-ink-400")}>{d.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-ok-500/70" /> حاضر</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-warn-500/70" /> تأخیر</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-danger-500/60" /> غایب</span>
            </div>
          </Panel>
        )}
      </div>

      <Surface className="mt-4 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[13.5px] font-semibold text-ink-50">اقدام پیشنهادی</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
            این گزارش «چرا» را توضیح می‌دهد. برای اقدام عملیاتی به بخش مربوطه بروید.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="subtle" onClick={onBack}>بازگشت به گزارش‌ها</Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              navigate({
                view: r.id === "rp5" ? "finance" : r.id === "rp3" ? "teachers" : r.id === "rp4" ? "schedule" : r.id === "rp7" ? "attendance" : "students",
              })
            }
          >
            رفتن به بخش عملیاتی
          </Button>
        </div>
      </Surface>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function ReportsView() {
  const { detailId, navigate } = useApp();
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("quarter");

  const detail = detailId ? reportCatalog.find((r) => r.id === detailId) : undefined;
  if (detail) return <ReportDetail r={detail} onBack={() => navigate({ view: "reports" })} />;

  return (
    <div>
      <PageHeader
        kicker="کسب‌وکار"
        title="گزارش‌ها"
        description="داشبورد می‌گوید امروز چه چیزی نیاز به توجه دارد؛ گزارش‌ها توضیح می‌دهند چرا این اتفاق می‌افتد."
        meta={
          <>
            <span>پشتیبانی از ۶ ماه داده</span>
            <span className="text-ink-500">·</span>
            <span>به‌روز تا امروز ۰۶:۰۰</span>
          </>
        }
        actions={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: "month", label: "ماه" },
              { value: "quarter", label: "فصل" },
              { value: "year", label: "سال" },
            ]}
          />
        }
      />

      {/* Executive summary — one narrative line, not a wall of charts */}
      <Surface className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-400">
            <FileBarChart className="size-4" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[14.5px] font-semibold text-ink-50">خلاصهٔ مدیریتی فصل</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-200">
              آموزشگاه در مسیر رشد پایدار است: ثبت‌نام <span className="nums text-gold-300">+۱۸٫۶٪</span> و ماندگاری{" "}
              <span className="nums text-gold-300">+۴٫۲٪</span> بهبود یافته‌اند. گلوگاه اصلی ظرفیت نیست، بلکه{" "}
              <span className="text-ink-50">توزیع ظرفیت</span> است — اتاق ۱ اشباع شده در حالی که اتاق ۴ نیمی از هفته خالی است و{" "}
              <span className="nums text-ink-50">۲۶ ساعت</span> ظرفیت آزاد مدرسین بدون استفاده مانده است.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone="ok" label="رشد پایدار" />
              <StatusBadge tone="warn" label="توزیع نامتوازن ظرفیت" />
              <StatusBadge tone="violet" label="۹ نفر لیست انتظار" />
            </div>
          </div>
        </div>
      </Surface>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="stagger contents">
          {reportCatalog.map((r) => (
            <ReportCard key={r.id} r={r} onOpen={() => navigate({ view: "reports", id: r.id })} />
          ))}
        </div>
      </div>

      <Panel className="mt-5" title="ریشهٔ موارد نیازمند توجه" kicker="گزارش‌ها الگوی تکرارشوندهٔ هشدارهای داشبورد را نشان می‌دهند">
        <ul className="space-y-2">
          {attentionQueue.slice(0, 4).map((a) => (
            <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warn" : "info"} label={a.category} glyph={false} />
                  <span className="truncate text-[13px] font-medium text-ink-50">{a.what}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-ink-300">{a.why}</p>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => navigate(a.target)}>
                {a.action}
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <DemoNote className="mt-6" text="همهٔ گزارش‌ها با دادهٔ نمایشی برای پیش‌نمایش طراحی شده‌اند؛ اتصال به دادهٔ واقعی از همین ساختار استفاده می‌کند." />
    </div>
  );
}
