import { useMemo, useState } from "react";
import { CalendarClock, Download, Plus, Receipt, Send } from "lucide-react";
import { revenueSeries } from "@/data/academy";
import { financeKpis, invoices, payments, paymentLabel, revenueByStream, studentById, subscriptionStatusLabel, subscriptions, type Invoice, type PaymentStatus, type Subscription, type SubscriptionStatus } from "@/data/records";
import { faNum, faPercent, faToman } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, Delta, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import { DemoNote, EmptyState } from "@/components/ds/states";
import { Avatar, Chip, DataTable, FilterBar, ListRow, Meter, PageHeader, Panel, ProgressRing, SearchInput, StatStrip, Tabs, type Column } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";

const tone: Record<PaymentStatus, Tone> = { paid: "ok", due: "warn", overdue: "danger" };
const subTone: Record<SubscriptionStatus, Tone> = { active: "ok", paused: "neutral", expiring: "warn" };

/* ------------------------------------------------------------------ */
function RevenueBars() {
  const max = Math.max(...revenueSeries.map((r) => r.value)) * 1.15;
  return (
    <div className="flex h-40 items-end gap-2.5">
      {revenueSeries.map((r, i) => {
        const last = i === revenueSeries.length - 1;
        return (
          <div key={r.label} className="flex flex-1 flex-col items-center gap-2">
            <span className={cn("nums text-[10.5px]", last ? "font-semibold text-gold-300" : "text-ink-400")}>{faNum(r.value, { decimals: 1 })}</span>
            <div
              className={cn("w-full rounded-t-lg", last ? "bg-gradient-to-t from-gold-600 to-gold-400" : "bg-ink-600")}
              style={{ height: `${(r.value / max) * 100}%`, animation: `grow-y 500ms var(--ease-phrase) ${i * 70}ms both`, transformOrigin: "bottom" }}
            />
            <span className={cn("text-[10.5px]", last ? "text-ink-100" : "text-ink-400")}>{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function FinanceView() {
  const { filter, navigate, notify, openSheet } = useApp();
  const [tab, setTab] = useState<"overview" | "invoices" | "payments" | "subscriptions">(filter === "overdue" ? "invoices" : "overview");
  const [status, setStatus] = useState<PaymentStatus | "all">(filter === "overdue" ? "overdue" : "all");
  const [subFocus, setSubFocus] = useState<SubscriptionStatus | "all">("all");
  const [query, setQuery] = useState("");

  const list = useMemo(
    () =>
      invoices.filter((i) => {
        const st = studentById(i.studentId);
        return (status === "all" || i.status === status) && (query === "" || i.id.includes(query) || (st?.name.includes(query) ?? false));
      }),
    [status, query],
  );

  const subsList = useMemo(
    () => (subFocus === "all" ? subscriptions : subscriptions.filter((s) => s.status === subFocus)),
    [subFocus],
  );

  const columns: Column<Invoice>[] = [
    {
      key: "student",
      header: "هنرجو",
      cell: (i) => {
        const st = studentById(i.studentId);
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={st?.name ?? "—"} size="sm" ring={tone[i.status]} />
            <div className="min-w-0">
              <div className="truncate font-medium text-ink-50">{st?.name}</div>
              <div className="nums truncate text-[11px] text-ink-400" dir="ltr">{i.id}</div>
            </div>
          </div>
        );
      },
    },
    { key: "term", header: "بابت", cell: (i) => <span className="text-ink-300">{i.term}</span>, hideBelow: "md" },
    { key: "amount", header: "مبلغ", cell: (i) => <span className="nums font-medium text-ink-50">{faToman(i.amount)}</span> },
    { key: "due", header: "سررسید", cell: (i) => <span className="nums text-ink-300">{i.due}</span>, hideBelow: "sm" },
    {
      key: "status",
      header: "وضعیت",
      cell: (i) => (
        <div className="flex items-center gap-2">
          <StatusBadge tone={tone[i.status]} label={paymentLabel[i.status]} />
          {i.overdueDays && <span className="nums text-[10.5px] text-danger-400">{faNum(i.overdueDays)} روز</span>}
        </div>
      ),
    },
    {
      key: "action",
      header: "",
      align: "end",
      cell: (i) =>
        i.status === "paid" ? (
          <span className="text-[11px] text-ink-500">{i.method}</span>
        ) : (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); notify({ tone: "success", title: "یادآوری ارسال شد", detail: `پیامک برای ${studentById(i.studentId)?.name}` }); }}>
              <Send className="size-3.5" />
            </Button>
            <Button size="sm" variant="subtle" onClick={(e) => { e.stopPropagation(); openSheet("payment"); }}>
              ثبت پرداخت
            </Button>
          </div>
        ),
      hideBelow: "sm",
    },
  ];

  const subColumns: Column<Subscription>[] = [
    {
      key: "student",
      header: "هنرجو",
      cell: (s) => {
        const st = studentById(s.studentId);
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={st?.name ?? "—"} size="sm" ring={subTone[s.status]} />
            <div className="min-w-0">
              <div className="truncate font-medium text-ink-50">{st?.name}</div>
              <div className="truncate text-[11px] text-ink-400">{s.plan}</div>
            </div>
          </div>
        );
      },
    },
    { key: "term", header: "دوره", cell: (s) => <span className="text-ink-300">{s.term}</span>, hideBelow: "md" },
    { key: "amount", header: "مبلغ دوره", cell: (s) => <span className="nums font-medium text-ink-50">{faToman(s.amount)}</span> },
    {
      key: "next",
      header: "تمدید بعدی",
      cell: (s) => (
        <span className={cn("nums text-ink-300", s.status === "expiring" && "text-warn-400")}>
          {s.status === "paused" ? "—" : s.nextBilling}
        </span>
      ),
      hideBelow: "sm",
    },
    {
      key: "status",
      header: "وضعیت",
      align: "end",
      cell: (s) => (
        <span className="flex items-center justify-end gap-2">
          {s.status === "expiring" && <CalendarClock className="size-3.5 text-warn-400" aria-hidden />}
          <StatusBadge tone={subTone[s.status]} label={subscriptionStatusLabel[s.status]} />
        </span>
      ),
    },
  ];

  const overdueTotal = invoices.filter((i) => i.status === "overdue").reduce((a, b) => a + b.amount, 0);
  const dueTotal = invoices.filter((i) => i.status === "due").reduce((a, b) => a + b.amount, 0);

  return (
    <div>
      <PageHeader
        kicker="کسب‌وکار"
        title="مالی"
        description="تصویر سلامت مالی آموزشگاه — درآمد، وصول و آنچه هنوز پرداخت نشده است."
        meta={
          <>
            <span>به‌روز تا امروز ۰۶:۰۰</span>
            <span className="text-ink-500">·</span>
            <span>منبع: سامانهٔ یکپارچهٔ آوا</span>
          </>
        }
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "گزارش مالی نیازمند سرور است", detail: "تولید PDF/Excel در سرور انجام می‌شود و در دمو فعال نیست." })}>
              <Download className="size-3.5" /> خروجی
            </Button>
            <Button size="sm" variant="primary" onClick={() => openSheet("payment")}>
              <Plus className="size-3.5" /> ثبت پرداخت
            </Button>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: "درآمد این ماه", value: faNum(financeKpis.monthRevenue / 1_000_000, { decimals: 1 }), unit: "میلیون تومان", delta: 6.2, hint: `${faPercent(financeKpis.collected)} وصول‌شده` },
          { label: "معوق (سررسید گذشته)", value: faNum(overdueTotal / 1_000_000, { decimals: 2 }), unit: "میلیون", tone: "warn", hint: `${faNum(invoices.filter((i) => i.status === "overdue").length)} فاکتور`, onClick: () => { setTab("invoices"); setStatus("overdue"); } },
          { label: "در انتظار پرداخت", value: faNum(dueTotal / 1_000_000, { decimals: 2 }), unit: "میلیون", hint: `${faNum(invoices.filter((i) => i.status === "due").length)} فاکتور`, onClick: () => { setTab("invoices"); setStatus("due"); } },
          { label: "میانگین شهریه", value: faNum(financeKpis.avgTuition / 1_000_000, { decimals: 2 }), unit: "میلیون", hint: `${faNum(financeKpis.activeSubscriptions)} دورهٔ فعال` },
        ]}
      />

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "نمای کلی" },
          { value: "invoices", label: "فاکتورها", count: invoices.length },
          { value: "payments", label: "تراکنش‌ها", count: payments.length },
          { value: "subscriptions", label: "اشتراک‌ها", count: subscriptions.length },
        ]}
      />

      <div key={tab} className="mt-5 animate-phrase-in">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="روند درآمد"
              className="lg:col-span-2"
              kicker="۶ ماه گذشته · میلیون تومان — از راست به چپ"
              aside={<Delta value={6.2} />}
            >
              <RevenueBars />
            </Panel>

            <Panel title="پیشرفت هدف ماهانه">
              <div className="flex flex-col items-center gap-4 py-2">
                <ProgressRing value={financeKpis.collected} size={124} stroke={8} tone="gold">
                  <span className="nums text-2xl font-semibold text-ink-50">{faPercent(financeKpis.collected)}</span>
                  <span className="mt-1 text-[10px] text-ink-400">وصول‌شده</span>
                </ProgressRing>
                <div className="w-full space-y-2 text-[12px]">
                  <div className="flex justify-between"><span className="text-ink-300">هدف ماه</span><span className="nums text-ink-100">{faToman(financeKpis.monthTarget, true)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-300">محقق‌شده</span><span className="nums text-ink-100">{faToman(financeKpis.monthRevenue, true)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-300">باقی‌مانده</span><span className="nums text-gold-300">{faToman(financeKpis.monthTarget - financeKpis.monthRevenue, true)}</span></div>
                </div>
              </div>
            </Panel>

            <Panel title="ترکیب درآمد" kicker="سهم هر منبع از درآمد ماه" className="lg:col-span-2">
              <ul className="space-y-3.5">
                {revenueByStream.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-3 text-[12.5px]">
                    <span className="w-32 shrink-0 truncate text-ink-200">{s.label}</span>
                    <Meter value={s.value} tone={i === 0 ? "gold" : i === 1 ? "violet" : "neutral"} className="flex-1" delay={i * 80} />
                    <span className="nums w-9 shrink-0 text-left font-medium text-ink-50">{faPercent(s.value)}</span>
                    <span className="nums hidden w-24 shrink-0 text-left text-ink-400 sm:block">{faToman(s.amount, true)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="آخرین پرداخت‌ها" action="همه" onAction={() => setTab("payments")}>
              <ul className="space-y-2">
                {payments.slice(0, 4).map((p) => {
                  const st = studentById(p.studentId);
                  return (
                    <ListRow
                      key={p.id}
                      lead={<Avatar name={st?.name ?? ""} size="sm" ring="ok" />}
                      title={st?.name ?? ""}
                      meta={`${p.when} · ${p.method}`}
                      end={<span className="nums text-[12px] font-medium text-ok-400">{faToman(p.amount, true)}</span>}
                    />
                  );
                })}
              </ul>
            </Panel>
          </div>
        )}

        {tab === "invoices" && (
          <>
            <FilterBar
              search={<SearchInput value={query} onChange={setQuery} placeholder="جستجوی شمارهٔ فاکتور یا نام هنرجو…" />}
              chips={
                <>
                  <Chip label="همه" active={status === "all"} count={invoices.length} onClick={() => setStatus("all")} />
                  {(["overdue", "due", "paid"] as PaymentStatus[]).map((s) => (
                    <Chip key={s} label={paymentLabel[s]} active={status === s} count={invoices.filter((i) => i.status === s).length} onClick={() => setStatus(s)} />
                  ))}
                </>
              }
            />
            {status === "overdue" && list.length > 0 && (
              <Surface className="mt-4 flex flex-col gap-3 border-danger-500/25 bg-danger-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-danger-500/30 bg-danger-500/10 text-danger-400">
                    <Receipt className="size-4" />
                  </span>
                  <div>
                    <div className="text-[13.5px] font-medium text-ink-50">
                      {faNum(list.length)} فاکتور معوق · مجموع {faToman(overdueTotal)}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-ink-300">قدیمی‌ترین فاکتور ۱۲ روز از سررسید گذشته است.</p>
                  </div>
                </div>
                <Button size="sm" variant="primary" onClick={() => notify({ tone: "success", title: "یادآوری گروهی ارسال شد", detail: `${faNum(list.length)} پیام در صف ارسال قرار گرفت.` })}>
                  <Send className="size-3.5" /> یادآوری گروهی
                </Button>
              </Surface>
            )}
            <Surface className="mt-4 p-2 sm:p-4">
              <DataTable
                rows={list}
                columns={columns}
                caption="فهرست فاکتورها"
                onRowClick={(i) => navigate({ view: "students", id: i.studentId })}
                empty={<EmptyState title="فاکتوری با این فیلتر نیست" description="وضعیت دیگری را انتخاب کنید." action="نمایش همه" onAction={() => setStatus("all")} />}
              />
            </Surface>
          </>
        )}

        {tab === "payments" && (
          <Panel title="تراکنش‌های اخیر" kicker="۵ پرداخت آخر ثبت‌شده در سامانه">
            <ul className="space-y-2">
              {payments.map((p) => {
                const st = studentById(p.studentId);
                return (
                  <ListRow
                    key={p.id}
                    lead={<Avatar name={st?.name ?? ""} size="sm" ring="ok" />}
                    title={st?.name ?? ""}
                    meta={`${p.when} · ${p.method}`}
                    end={
                      <>
                        <span className="nums text-[12.5px] font-medium text-ok-400">{faToman(p.amount)}</span>
                        <StatusBadge tone="ok" label="موفق" />
                      </>
                    }
                    onClick={() => navigate({ view: "students", id: p.studentId })}
                  />
                );
              })}
            </ul>
          </Panel>
        )}

        {tab === "subscriptions" && (
          <>
            <StatStrip
              stats={[
                { label: "اشتراک فعال", value: faNum(subscriptions.filter((s) => s.status === "active").length), tone: "ok", hint: "از کل دوره‌ها" },
                { label: "در حال اتمام", value: faNum(subscriptions.filter((s) => s.status === "expiring").length), tone: "warn", hint: "نیازمند تماس تمدید", onClick: () => setSubFocus("expiring") },
                { label: "متوقف", value: faNum(subscriptions.filter((s) => s.status === "paused").length), tone: "neutral", hint: "قابل فعال‌سازی مجدد" },
                { label: "درآمد ماهانهٔ اشتراک‌ها", value: faNum(subscriptions.filter((s) => s.status !== "paused").reduce((a, b) => a + b.amount, 0) / 1_000_000, { decimals: 1 }), unit: "میلیون", hint: "بر پایهٔ دوره‌های جاری" },
              ]}
            />
            <div className="mt-4">
              <Panel title="دوره‌ها و اشتراک‌ها" kicker="برنامهٔ پرداخت دوره‌ای و زمان تمدید — فقط پیش‌نمایش">
                <DataTable
                  rows={subsList}
                  columns={subColumns}
                  caption="فهرست اشتراک‌ها"
                  onRowClick={(s) => navigate({ view: "students", id: s.studentId })}
                  empty={<EmptyState title="اشتراکی با این وضعیت نیست" description="فیلتر وضعیت را تغییر دهید." action="نمایش همه" onAction={() => setSubFocus("all")} />}
                />
              </Panel>
            </div>
          </>
        )}
      </div>

      <DemoNote className="mt-6" text="اعداد و فاکتورهای این بخش، دادهٔ نمایشی برای پیش‌نمایش محصول هستند و قرارداد مالی واقعی نیستند." />
    </div>
  );
}
