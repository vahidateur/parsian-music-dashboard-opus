import { Download, Info, Plus, Wallet2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ds/primitives";
import { DemoNote } from "@/components/ds/states";
import { PageHeader, Panel } from "@/components/ds/patterns";

/* ------------------------------------------------------------------ */
/* Finance — an explicitly DEFERRED surface (M10, D6 / I2)              */
/*                                                                      */
/* The fixture-era Finance view rendered a financial narrative nobody   */
/* measured: a revenue series, target progress, stream composition,     */
/* subscriptions and invoice/payment tables read from a data module     */
/* nothing could write to. Those are gone, by decision:                  */
/*                                                                      */
/*   - the fabricated measurements were removed (they were never real); */
/*   - the demo invoice/payment RECORDS live in the demo dataset only — */
/*     no view may read them until I2 designs the read seam (D6/I2      */
/*     keep the finance domain *planned*; M10 builds no repository and  */
/*     no hidden fixture-backed replacement);                           */
/*                                                                      */
/* Every retired export is classified in the deferral ledger:           */
/* `src/lib/financeReportsDeferral.ts`, consumed by                     */
/* `src/__tests__/m10Boundary.test.ts` so nothing comes back quietly.   */
/* ------------------------------------------------------------------ */
export function FinanceView() {
  const { notify, openSheet } = useApp();

  return (
    <div>
      <PageHeader
        kicker="کسب‌وکار"
        title="مالی"
        description="فاکتورها، درآمد و اشتراک‌ها به سامانهٔ مالی سرور نیاز دارند (I2)."
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

      <Panel title="وضعیت این بخش" kicker="به‌تأخیر انداخته‌شده — D6 / I2" className="mt-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-400">
            <Wallet2 className="size-4" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 space-y-3 text-[13px] leading-relaxed text-ink-200">
            <p>
              نمایش دادهٔ مالی <span className="text-ink-50">نیازمند سرور است</span> (I2). خواندن فاکتورها،
              تراکنش‌ها و اشتراک‌ها به قرارداد مالی سمت سرور وابسته است که هنوز طراحی نشده — در دمو و محیط خالی
              چیزی برای نمایش صادقانه وجود ندارد.
            </p>
            <p className="flex items-start gap-2 text-[12px] text-ink-400">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
              نسخه‌های پیشین این بخش اعداد نمایشی ثابت رندر می‌کردند؛ آن اعداد حذف شدند چون هیچ‌کس آن‌ها را
              اندازه نگرفته بود. آمار مالی که بتوان توضیحش داد با طراحی I2 بازمی‌گردد.
            </p>
          </div>
        </div>
      </Panel>

      <DemoNote className="mt-6" text="ثبت پرداخت از اقدام‌های سریع دمو باز می‌شود و داده‌ای ذخیره نمی‌کند؛ نمایش فاکتورها و اشتراک‌ها به قرارداد سرور نیاز دارد." />
    </div>
  );
}
