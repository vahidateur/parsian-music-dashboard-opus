import { Download, FileBarChart, Info } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ds/primitives";
import { DemoNote } from "@/components/ds/states";
import { PageHeader, Panel } from "@/components/ds/patterns";

/* ------------------------------------------------------------------ */
/* Reports — an explicitly DEFERRED surface (M10, D6 / I2)              */
/*                                                                      */
/* The fixture-era Reports view rendered six narrative "reports" with   */
/* invented headline numbers, an executive summary with fabricated       */
/* growth claims and a hand-written attention queue. Those are gone by  */
/* decision (the same M9 H4/I9 rule that removed the revenue chart: a   */
/* number the records do not support must not render).                   */
/*                                                                      */
/* D6 / I2 keep the reports domain *planned* — M10 builds no repository, */
/* no read seam and no fixture-backed replacement. The dashboard's      */
/* insight panels remain the live analysis surface: they are derived    */
/* from stored records (M9). Every retired export is classified in the  */
/* deferral ledger `src/lib/financeReportsDeferral.ts`, consumed by     */
/* `src/__tests__/m10Boundary.test.ts`.                                 */
/* ------------------------------------------------------------------ */
export function ReportsView() {
  const { notify } = useApp();

  return (
    <div>
      <PageHeader
        kicker="کسب‌وکار"
        title="گزارش‌ها"
        description="گزارش‌های تحلیلی به سامانهٔ گزارش‌گیری سرور نیاز دارند (I2)."
        actions={
          <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "خروجی گزارش نیازمند سرور است", detail: "تولید PDF در سرور انجام می‌شود و در دمو فعال نیست." })}>
            <Download className="size-3.5" /> خروجی
          </Button>
        }
      />

      <Panel title="وضعیت این بخش" kicker="به‌تأخیر انداخته‌شده — D6 / I2" className="mt-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-400">
            <FileBarChart className="size-4" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 space-y-3 text-[13px] leading-relaxed text-ink-200">
            <p>
              تولید گزارش تحلیلی <span className="text-ink-50">نیازمند سرور است</span> (I2). پاسخ به «چرا»
              به تاريخچهٔ طولانی و پردازش سمت سرور وابسته است که هنوز طراحی نشده — در دمو و محیط خالی
              چیزی برای نمایش صادقانه وجود ندارد.
            </p>
            <p>
              تحلیل زندهٔ دادهٔ ثبت‌شده را همین حالا پنل‌های بینش داشبورد ارائه می‌دهند؛ آن‌جا هر عدد از
              رکوردهای همین محیط استخراج می‌شود.
            </p>
            <p className="flex items-start gap-2 text-[12px] text-ink-400">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
              نسخه‌های پیشین این بخش شش گزارش روایی با اعداد ثابت نمایش می‌دادند؛ آن‌ها حذف شدند چون
              هیچ‌کس آن‌ها را اندازه نگرفته بود.
            </p>
          </div>
        </div>
      </Panel>

      <DemoNote className="mt-6" text="گزارش‌های تحلیلی در این نسخه وجود ندارند؛ برای تحلیل زندهٔ دادهٔ ثبت‌شده به پنل‌های بینش داشبورد مراجعه کنید." />
    </div>
  );
}
