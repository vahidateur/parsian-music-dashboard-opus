import type { ReactNode } from "react";
import { LayoutGrid, MessageSquare, Music2, Users } from "lucide-react";
import { useState } from "react";
import { attentionItems, insights, instrumentLabel, schedule, signals, type ClassStatus } from "@/data/academy";
import { intelligenceCards, students } from "@/data/records";
import { AlertItem, InsightItem, IntelligenceCardView, NavItem, QuickAction, SignalBlock, TimelineEvent } from "@/components/ds/blocks";
import { Avatar, Chip, DataTable, Dialog, Drawer, Field, FilterBar, ListRow, Meter, PageHeader, ProgressRing, SearchInput, Segmented, StatStrip, Tabs, Toggle, inputCls } from "@/components/ds/patterns";
import { Button, Delta, InstrumentGlyph, Kbd, Sparkline, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import { BreathingWave, DemoNote, EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { CommandSearchTrigger } from "@/components/layout/TopBar";
import { useApp } from "@/context/AppContext";
import { cn } from "@/utils/cn";

function Spec({ title, note, children, className }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-white/[0.06] p-5", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-dashed border-white/[0.08] pb-3">
        <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
        {note && <span className="text-[11px] text-ink-400">{note}</span>}
      </div>
      {children}
    </section>
  );
}

const palette: { name: string; swatches: { label: string; cls: string }[] }[] = [
  { name: "Ink — پایه", swatches: ["950", "900", "850", "800", "700", "600", "500", "400", "300", "200", "100", "50"].map((s) => ({ label: s, cls: `bg-ink-${s}` })) },
  { name: "Gold — نور صحنه", swatches: ["200", "300", "400", "500", "600", "700"].map((s) => ({ label: s, cls: `bg-gold-${s}` })) },
  { name: "Wood — دیوار آکوستیک", swatches: ["400", "500", "700"].map((s) => ({ label: s, cls: `bg-wood-${s}` })) },
  { name: "Violet — رزونانس", swatches: ["300", "400", "500", "600"].map((s) => ({ label: s, cls: `bg-violet-${s}` })) },
  {
    name: "Semantic",
    swatches: [
      { label: "ok", cls: "bg-ok-500" },
      { label: "warn", cls: "bg-warn-500" },
      { label: "danger", cls: "bg-danger-500" },
      { label: "info", cls: "bg-info-400" },
    ],
  },
];

export function DesignSystemView() {
  const { notify } = useApp();
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<"cards" | "table">("cards");
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tog, setTog] = useState(true);
  const statuses: ClassStatus[] = ["live", "next", "scheduled", "attention", "cancelled", "done"];
  const tones: Tone[] = ["ok", "warn", "danger", "info", "neutral", "gold", "violet"];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <div className="text-[11px] font-medium text-gold-400">Design System · v۱</div>
        <h1 className="mt-1 text-2xl font-bold text-ink-50">سیستم طراحی آوا</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-300">
          توکن‌ها و اجزای قابل استفادهٔ مجدد برای همهٔ سطوح سامانه — پنل مدیریت، پنل مدرس و اپلیکیشن هنرجو. اجزا با Auto Layout و متغیرها طراحی شده‌اند و
          یک‌به‌یک با پیاده‌سازی مطابقت دارند.
        </p>
      </header>

      {/* Tokens */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Spec title="رنگ" note="variables/color" className="lg:col-span-2">
          <div className="space-y-4">
            {palette.map((p) => (
              <div key={p.name}>
                <div className="mb-1.5 text-[11px] text-ink-400">{p.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {p.swatches.map((s) => (
                    <div key={s.label} className="flex flex-col items-center gap-1">
                      <span className={cn("size-9 rounded-lg border border-white/[0.08]", s.cls)} />
                      <span className="nums text-[9px] text-ink-500" dir="ltr">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Spec>
        <div className="space-y-4">
          <Spec title="ریتم حرکت" note="♩ = ۱۲۰ bpm">
            <ul className="space-y-2 text-xs">
              {[
                ["--beat", "۵۰۰ms", "ورود عبارت‌ها، آشکار شدن نمودار"],
                ["--eighth", "۲۵۰ms", "تغییر حالت، پنل‌ها"],
                ["--sixteenth", "۱۲۵ms", "hover و focus"],
                ["stagger", "۶۰ms", "فاصلهٔ نت‌ها در یک فراز"],
              ].map(([k, v, d]) => (
                <li key={k} className="flex items-center gap-3">
                  <code className="nums w-24 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] text-gold-300" dir="ltr">
                    {k}
                  </code>
                  <span className="nums w-14 text-ink-100">{v}</span>
                  <span className="text-ink-400">{d}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] text-ink-400">
              easing: <code className="text-ink-200">resonance</code> · <code className="text-ink-200">phrase</code> · <code className="text-ink-200">legato</code>
            </div>
          </Spec>
          <Spec title="تایپوگرافی" note="Vazirmatn">
            <div className="space-y-1.5">
              <div className="text-3xl font-bold text-ink-50">صبح بخیر، آرمان</div>
              <div className="text-lg font-semibold text-ink-50">عنوان بخش</div>
              <div className="text-sm text-ink-100">متن بدنه با ارقام فارسی <span className="nums">۱٬۲۴۸</span></div>
              <div className="text-xs text-ink-300">توضیح ثانویه · ۱۲px</div>
              <div className="text-[11px] text-ink-400">برچسب · ۱۱px</div>
            </div>
          </Spec>
        </div>
      </div>

      {/* Components */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Spec title="Signal / KPI" note="مقدار · تغییر · «خب که چی؟» · روند">
          <Surface className="overflow-hidden">
            <SignalBlock signal={signals[0]} />
          </Surface>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Delta value={8.4} label="مثبت" />
            <Delta value={-2.3} label="منفی" />
            <Delta value={0} label="بدون تغییر" />
          </div>
        </Spec>

        <Spec title="Alert — نیازمند توجه" note="severity: critical / warning / info">
          <div className="space-y-1">
            <AlertItem item={attentionItems[0]} />
            <AlertItem item={attentionItems[1]} />
            <AlertItem item={{ id: "x", severity: "info", title: "۳ درخواست جلسهٔ جبرانی", context: "منتظر تأیید مدرس", action: "بررسی", target: { view: "schedule" } }} />
          </div>
        </Spec>

        <Spec title="Intelligence Insight" note="kind: trend / risk / idea">
          <div className="space-y-2">
            {insights.map((i, idx) => (
              <InsightItem key={i.id} insight={i} index={idx} />
            ))}
          </div>
        </Spec>

        <Spec title="Timeline Event" note="status × ۶">
          <ol>
            {statuses.map((st, i) => (
              <TimelineEvent key={st} session={schedule[i + 1]} status={st} isLast={i === statuses.length - 1} />
            ))}
          </ol>
        </Spec>

        <Spec title="Status Badge" note="هرگز فقط رنگ — نماد + متن">
          <div className="flex flex-wrap gap-2">
            {tones.map((t) => (
              <StatusBadge key={t} tone={t} label={t} />
            ))}
            <StatusBadge tone="ok" label="در حال برگزاری" live />
            <StatusBadge tone="neutral" label="لغو شده" cancelled />
          </div>
        </Spec>

        <Spec title="Chart — sparkline & patterns" note="RTL: جدیدترین در چپ">
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-1.5"><Sparkline data={signals[0].series} width={140} height={40} /><span className="text-[10.5px] text-ink-400">line · gold</span></div>
            <div className="flex flex-col gap-1.5"><Sparkline data={signals[1].series} kind="bars" width={140} height={40} /><span className="text-[10.5px] text-ink-400">bars · current emphasised</span></div>
            <div className="flex flex-col gap-1.5"><Sparkline data={signals[3].series} tone="warn" width={140} height={40} /><span className="text-[10.5px] text-ink-400">line · warn</span></div>
            <div className="flex flex-col gap-1.5"><Sparkline data={signals[2].series} tone="violet" width={140} height={40} /><span className="text-[10.5px] text-ink-400">line · violet</span></div>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-400">ورود داده مثل یک فراز موسیقی: ستون‌ها با فاصلهٔ ۶۰ms، خط با draw ۱٫۳ ثانیه، حلقه با legato.</p>
        </Spec>

        <Spec title="Quick Action" note="pill · ثانویه اما در دسترس">
          <div className="flex flex-wrap gap-2">
            <QuickAction label="افزودن هنرجو" onClick={() => notify({ tone: "success", title: "رزونانس موفقیت", detail: "نمونهٔ بازخورد موفق" })} />
            <QuickAction label="برنامه‌ریزی کلاس" />
            <QuickAction label="ثبت پرداخت" />
            <QuickAction label="ارسال پیام" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" size="sm">اصلی</Button>
            <Button size="sm">ثانویه</Button>
            <Button variant="ghost" size="sm">شبح</Button>
          </div>
        </Spec>

        <Spec title="Navigation Item" note="default · active · badge · collapsed">
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-0.5 rounded-xl border border-white/[0.06] p-2">
              <NavItem icon={LayoutGrid} label="داشبورد" active />
              <NavItem icon={Users} label="هنرجویان" />
              <NavItem icon={MessageSquare} label="پیام‌ها" badge={5} />
            </div>
            <div className="w-14 space-y-0.5 rounded-xl border border-white/[0.06] p-2">
              <NavItem icon={LayoutGrid} label="داشبورد" active collapsed />
              <NavItem icon={Users} label="هنرجویان" collapsed />
              <NavItem icon={MessageSquare} label="پیام‌ها" badge={5} collapsed />
            </div>
          </div>
        </Spec>

        <Spec title="Command Search" note="Ctrl/⌘ + K · فرمان طبیعی">
          <CommandSearchTrigger />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
            <span>باز کردن</span>
            <span className="text-ink-600">·</span>
            <Kbd>↵</Kbd>
            <span>اجرا</span>
            <span className="text-ink-600">·</span>
            <Kbd>Esc</Kbd>
            <span>بستن</span>
          </div>
        </Spec>

        <Spec title="Instrument Glyphs" note="خطی، بی‌ادعا، بدون نت‌های پراکنده">
          <div className="flex flex-wrap gap-4 text-gold-400">
            {(["piano", "guitar", "violin", "voice", "drums", "theory"] as const).map((k) => (
              <div key={k} className="flex flex-col items-center gap-1.5">
                <span className="flex size-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02]"><InstrumentGlyph kind={k} className="size-5" /></span>
                <span className="text-[10px] text-ink-400" dir="ltr">{k}</span>
              </div>
            ))}
          </div>
        </Spec>
      </div>

      {/* Page-level patterns added for the full product */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Spec title="Page Header" note="یک ریتم برای همهٔ صفحه‌ها">
          <PageHeader
            className="mb-0"
            breadcrumb={[{ label: "هنرجویان" }, { label: "سارا محمدی" }]}
            kicker="افراد"
            title="عنوان صفحه"
            description="توضیح کوتاه که هدف صفحه را روشن می‌کند."
            meta={<><span>متادیتا</span><span className="nums">۱۲ مورد</span></>}
            actions={<><Button size="sm">ثانویه</Button><Button size="sm" variant="primary">اقدام اصلی</Button></>}
          />
        </Spec>

        <Spec title="Stat Strip" note="KPI فشرده روی یک سطح">
          <StatStrip
            columns="lg:grid-cols-2"
            stats={[
              { label: "هنرجوی فعال", value: "۱٬۱۸۶", delta: 8.4, hint: "روند صعودی" },
              { label: "در معرض ریزش", value: "۵", tone: "warn", hint: "بیش از ۲ هفته غیبت" },
            ]}
          />
        </Spec>

        <Spec title="Filters · Search · Segmented · Chips" note="کنترل‌های یکسان در همهٔ فهرست‌ها">
          <FilterBar
            search={<SearchInput value={q} onChange={setQ} placeholder="جستجو…" />}
            trailing={<Segmented value={seg} onChange={setSeg} options={[{ value: "cards", label: "کارت" }, { value: "table", label: "جدول" }]} />}
            chips={<><Chip label="همه" active count={12} /><Chip label="فعال" count={8} /><Chip label="پیانو" tone="violet" count={5} /></>}
          />
          <div className="mt-4"><Tabs value="a" onChange={() => {}} options={[{ value: "a", label: "نمای کلی" }, { value: "b", label: "جزئیات", count: 3 }]} /></div>
        </Spec>

        <Spec title="Data Table" note="فقط جایی که جدول واقعاً درست است">
          <DataTable
            rows={students.slice(0, 3)}
            columns={[
              { key: "n", header: "هنرجو", cell: (s) => <div className="flex items-center gap-2"><Avatar name={s.name} size="xs" />{s.name}</div> },
              { key: "i", header: "ساز", cell: (s) => instrumentLabel[s.instrument] },
              { key: "a", header: "حضور", cell: (s) => <Meter value={s.attendance} tone="ok" size="sm" label={`${s.attendance}٪`} className="w-20" />, align: "end" },
            ]}
          />
        </Spec>

        <Spec title="List Row · Avatar · Meter · Ring" note="جایگزین‌های جدول">
          <div className="space-y-2">
            <ListRow lead={<Avatar name="سارا احمدی" size="sm" />} title="سارا احمدی" meta="پیانو · ۳۲ هنرجو" end={<StatusBadge tone="ok" label="فعال" />} />
            <ListRow lead={<Avatar name="کاوه کاظمی" size="sm" ring="violet" />} title="کاوه کاظمی" meta="درامز · ظرفیت آزاد" end={<StatusBadge tone="violet" label="۴۸٪" glyph={false} />} active />
          </div>
          <div className="mt-4 flex items-center gap-5">
            <ProgressRing value={82} size={56}><span className="nums text-[11px] text-ink-50">۸۲٪</span></ProgressRing>
            <ProgressRing value={48} size={56} tone="violet"><span className="nums text-[11px] text-ink-50">۴۸٪</span></ProgressRing>
            <div className="flex-1 space-y-2">
              <Meter value={94} tone="gold" label="۹۴٪" />
              <Meter value={58} tone="violet" label="۵۸٪" />
              <Meter value={62} tone="warn" label="۶۲٪" />
            </div>
          </div>
        </Spec>

        <Spec title="Dialog · Drawer · Form" note="لایه‌های تعامل">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setDialog(true)}>باز کردن Dialog</Button>
            <Button size="sm" onClick={() => setDrawer(true)}>باز کردن Drawer</Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="نام"><input className={inputCls} placeholder="مثلاً: نیلوفر" /></Field>
            <Field label="فعال بودن" hint="سوییچ">
              <div className="flex h-10 items-center"><Toggle checked={tog} onChange={setTog} label="نمونه" /></div>
            </Field>
          </div>
          <Dialog
            open={dialog}
            onClose={() => setDialog(false)}
            title="حذف این مورد؟"
            description="این عمل قابل بازگشت نیست. نمونهٔ الگوی دیالوگ تأیید."
            footer={<><Button size="sm" variant="ghost" onClick={() => setDialog(false)}>انصراف</Button><Button size="sm" variant="primary" onClick={() => setDialog(false)}>تأیید</Button></>}
          />
          <Drawer open={drawer} onClose={() => setDrawer(false)} kicker="نمونه" title="کشوی جزئیات" footer={<Button size="sm" variant="primary" onClick={() => setDrawer(false)}>بستن</Button>}>
            <p className="text-[13px] leading-relaxed text-ink-300">
              کشو برای جزئیات یک رکورد بدون ترک صفحه استفاده می‌شود؛ در موبایل از پایین و در دسکتاپ از سمت چپ (انتهای مسیر خواندن RTL) باز می‌شود.
            </p>
          </Drawer>
        </Spec>

        <Spec title="Intelligence Card" note="Signal → Evidence → Insight → Action" className="lg:col-span-2">
          <div className="grid gap-3 lg:grid-cols-3">
            {intelligenceCards.map((c, i) => (
              <IntelligenceCardView key={c.id} card={c} index={i} />
            ))}
          </div>
        </Spec>

        <Spec title="Calendar Cell" note="سلول تقویم · حالت‌ها" className="lg:col-span-2">
          <div className="flex flex-wrap gap-3">
            {[
              { label: "عادی · اتاق ۱", cls: "border-gold-500/35 bg-gold-500/[0.10] text-gold-200" },
              { label: "اتاق ۲", cls: "border-violet-500/35 bg-violet-500/[0.10] text-violet-200" },
              { label: "تعارض", cls: "border-warn-500/60 bg-warn-500/[0.12] text-warn-400 ring-1 ring-warn-500/25" },
              { label: "لغو شده", cls: "border-dashed border-white/20 bg-white/[0.03] text-ink-400 line-through" },
            ].map((c) => (
              <div key={c.label} className={cn("w-32 rounded-lg border px-2 py-1.5", c.cls)}>
                <div className="truncate text-[10.5px] font-medium">{c.label}</div>
                <div className="nums mt-0.5 text-[9.5px] opacity-80">۱۴:۰۰–۱۵:۰۰</div>
              </div>
            ))}
          </div>
        </Spec>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Spec title="فاصله · گوشه · مرز · سایه" note="ریتم آزاد، مرزهای نرم">
          <div className="flex flex-wrap items-end gap-2">
            {[4, 8, 12, 16, 20, 24].map((s) => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <span className="block bg-gold-500/25" style={{ width: s === 4 ? 1 : s * 2, height: 14 }} aria-hidden />
                <span className="nums text-[9.5px] text-ink-500">{s}</span>
              </div>
            ))}
            <span className="text-[10.5px] text-ink-400">فضا بر پایهٔ چهارگامِ ریتم</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
            {[
              { cls: "rounded-lg", label: "lg" },
              { cls: "rounded-xl", label: "xl" },
              { cls: "rounded-2xl", label: "2xl" },
              { cls: "rounded-3xl", label: "3xl" },
              { cls: "rounded-full", label: "full" },
            ].map((r) => (
              <div key={r.label} className="flex flex-col items-center gap-1.5">
                <span className={cn("block size-10 border border-white/[0.12] bg-white/[0.03]", r.cls)} aria-hidden />
                <span className="nums text-[9.5px] text-ink-500">{r.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="h-9 w-28 rounded-xl border border-white/[0.06] bg-white/[0.02]" title="مرز ۶٪" />
            <span className="h-9 w-28 rounded-xl border border-white/[0.12] bg-white/[0.03]" title="مرز ۱۲٪" />
            <span className="h-9 w-28 rounded-xl border border-gold-500/40 bg-gold-500/[0.05]" title="مرز برند" />
            <span className="h-9 w-28 rounded-xl bg-ink-900 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.6)]" title="سایهٔ سطح" />
          </div>
        </Spec>

        <Spec title="Inputs · Selects · Toggle" note="کنترل‌های فرم — یک زبان">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام هنرجو" hint="مثال">
              <input className={inputCls} placeholder="مثلاً: نیلوفر رستمی" />
            </Field>
            <Field label="ساز">
              <select className={inputCls} defaultValue="piano" aria-label="انتخاب ساز">
                <option value="piano">پیانو</option>
                <option value="guitar">گیتار</option>
                <option value="violin">ویولن</option>
              </select>
            </Field>
            <Field label="جستجو" className="sm:col-span-2">
              <SearchInput value={q} onChange={setQ} placeholder="جستجوی هنرجو یا مدرس…" />
            </Field>
          </div>
          <div className="mt-4 space-y-2.5 border-t border-white/[0.06] pt-4">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="text-[12.5px] text-ink-100">اعلان فاکتور سررسید</span>
              <Toggle checked={tog} onChange={setTog} label="نمونهٔ سوییچ" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary">اصلی</Button>
              <Button size="sm">ثانویه</Button>
              <Button size="sm" variant="ghost">شبح</Button>
              <Button size="sm" disabled>غیرفعال</Button>
            </div>
          </div>
        </Spec>

        <Spec title="Surface — Card" note="سطح، نه «کارت»">
          <Surface className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-400" aria-hidden>
                <Music2 className="size-4" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink-50">پیانو گروهی · میانی</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-300">سطح پیش‌فرض؛ یک خط روشنایی از بالا، مرز ۶٪، هیچ سایهٔ پر سر و صدایی.</p>
              </div>
              <StatusBadge tone="gold" label="نزدیک اشباع" />
            </div>
          </Surface>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] text-ink-400">
            <span>مشتق‌ها: Panel · ChartCard · StatStrip · ListRow — همه از همین زبان</span>
          </div>
        </Spec>

        <Spec title="نمونه‌های وضعیت داده" note="loading · empty · error · demo">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] p-4">
              <BreathingWave bars={7} />
              <span className="text-[10.5px] text-ink-400">loading</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] p-4">
              <EmptyState className="border-0 py-6" title="خالی" description="با اقدام همراه است" />
            </div>
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] p-4 sm:col-span-2">
              <DemoNote className="w-full" />
            </div>
          </div>
        </Spec>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Spec title="Loading State" note="تنفس، نه اسکلت">
          <LoadingState />
          <div className="flex justify-center gap-8 border-t border-white/[0.06] pt-4">
            <BreathingWave tone="violet" bars={7} />
            <BreathingWave tone="neutral" bars={7} />
          </div>
        </Spec>
        <Spec title="Empty State" note="راهنما + اقدام">
          <EmptyState title="هنوز پیامی ندارید" description="اولین پیام را برای هنرجویان در معرض ریزش بفرستید." action="ارسال پیام" />
        </Spec>
        <Spec title="Error State" note="با امکان تلاش دوباره">
          <ErrorState onRetry={() => notify({ tone: "info", title: "تلاش دوباره", detail: "اتصال برقرار شد." })} />
        </Spec>
      </div>
    </div>
  );
}
