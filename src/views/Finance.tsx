import { useEffect, useMemo, useState } from "react";
import { Download, Info, Plus, Wallet2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useCan } from "@/domains/auth/AuthContext";
import { Button } from "@/components/ds/primitives";
import { DemoNote } from "@/targets/environment";
import { deferredReadTail, financeDeferredNote, notServedClause, unavailableActions } from "@/targets/targetCopy";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Field, PageHeader, Panel, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getFinanceRepository } from "@/domains/registry";
import { useInvoices } from "@/domains/finance/useInvoices";
import type { Invoice, InvoiceStatus, PayMethod } from "@/domains/finance/types";
import { useStudentList } from "@/domains/students/useStudents";
import { PAY_METHOD_LABEL } from "@/domains/finance/types";
import { paymentLabel } from "@/lib/financeVocabulary";
import { faNum, parseTypedNumber } from "@/lib/format";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/* Finance — deferred in demo (D6 / I2), served by the API in client   */
/*                                                                      */
/* The fixture-era Finance view rendered a financial narrative nobody   */
/* measured. Those are gone, by decision (see the deferral ledger      */
/* `src/lib/financeReportsDeferral.ts`). v1 serves invoices under the   */
/* existing finance.read / finance.write ids (DECISIONS §40): issue due, */
/* discharge by one accepted payment. No partials, no balance sync.     */
/* ------------------------------------------------------------------ */

/** The pre-v1 surface, kept verbatim for the demo composition: no repository
 *  serves finance there (every verb rejects DOMAIN_UNAVAILABLE), so the view
 *  keeps naming its deferral instead of rendering an empty table. */
function FinanceDeferred() {
  const { notify } = useApp();
  const canRecordPayment = useCan("finance.write");

  return (
    <div>
      <PageHeader
        kicker="کسب‌وکار"
        title="مالی"
        description="فاکتورها، درآمد و اشتراک‌ها به سامانهٔ مالی سرور نیاز دارند (I2)."
        actions={
          <>
            {!unavailableActions.has("finance-export") && (
              <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "گزارش مالی نیازمند سرور است", detail: `تولید PDF/Excel در سرور انجام می‌شود و ${notServedClause}` })}>
                <Download className="size-3.5" /> خروجی
              </Button>
            )}
            {canRecordPayment && !unavailableActions.has("payment") && (
              <Button size="sm" variant="primary" onClick={() => notify({ tone: "info", title: "ثبت پرداخت نیازمند سرور است", detail: "قرارداد پرداخت هنوز به سرور متصل نیست." })}>
                <Plus className="size-3.5" /> ثبت پرداخت
              </Button>
            )}
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
              تراکنش‌ها و اشتراک‌ها به قرارداد مالی سمت سرور وابسته است که هنوز طراحی نشده — {deferredReadTail}
            </p>
            <p className="flex items-start gap-2 text-[12px] text-ink-400">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
              نسخه‌های پیشین این بخش اعداد نمایشی ثابت رندر می‌کردند؛ آن اعداد حذف شدند چون هیچ‌کس آن‌ها را
              اندازه نگرفته بود. آمار مالی که بتوان توضیحش داد با طراحی I2 بازمی‌گردد.
            </p>
          </div>
        </div>
      </Panel>

      <DemoNote className="mt-6" text={financeDeferredNote} />
    </div>
  );
}

type StatusFilter = "all" | InvoiceStatus;

function statusTone(status: InvoiceStatus): string {
  return status === "paid" ? "text-ok-300 border-ok-500/25 bg-ok-500/10" : "text-gold-300 border-gold-500/25 bg-gold-500/10";
}

export function FinanceView() {
  const { notify } = useApp();
  const canRecordPayment = useCan("finance.write");
  const canConfirmPayment = useCan("finance.pay");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [formStudentId, setFormStudentId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDueAt, setFormDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>("pos");
  const [payReference, setPayReference] = useState("");
  const [payingBusy, setPayingBusy] = useState(false);

  // The view resolves its own repository (the gate pins this reach) and
  // hands it to the hook — the same seam the student hook offers.
  const repository = useMemo(() => getFinanceRepository(), []);
  const invoices = useInvoices(statusFilter === "all" ? { per_page: 100 } : { per_page: 100, status: statusFilter }, repository);
  const students = useStudentList({ per_page: 200 });

  // A background refetch after any accepted write keeps the rendered page
  // (see useResourceList), so only the very first load takes the full
  // loading state — the same rule as the gallery view.
  const [settledOnce, setSettledOnce] = useState(false);
  useEffect(() => {
    if (!invoices.loading) setSettledOnce(true);
  }, [invoices.loading]);

  // Demo has no finance repository: every verb rejects DOMAIN_UNAVAILABLE,
  // and the view keeps its honest deferral instead of an empty table.
  if (invoices.error?.code === "DOMAIN_UNAVAILABLE") return <FinanceDeferred />;
  if (invoices.error) {
    return (
      <ErrorState
        className="py-16"
        title="بارگذاری فاکتورها ناموفق بود"
        error={invoices.error}
        onRetry={invoices.reload}
      />
    );
  }
  if (invoices.loading && !settledOnce) return <LoadingState className="py-16" label="در حال بارگذاری فاکتورها…" />;

  const create = async () => {
    const amount = parseTypedNumber(formAmount);
    const input = {
      studentId: formStudentId,
      title: formTitle.trim(),
      amount: amount ?? -1,
      ...(formDueAt ? { dueAt: formDueAt } : {}),
    };
    if (!input.studentId || input.title.length < 2 || amount === null || amount < 1) {
      notify({ tone: "danger", title: "فاکتور ثبت نشد", detail: "هنرجو، عنوان (حداقل ۲ حرف) و مبلغ مثبت الزامی است." });
      return;
    }
    setBusy(true);
    try {
      const created = await invoices.create(input);
      notify({ tone: "success", title: `فاکتور «${created.title}» ثبت شد`, detail: `${faNum(created.amount)} تومان برای ${created.studentName ?? "هنرجو"}.` });
      setCreateOpen(false);
      setFormStudentId("");
      setFormTitle("");
      setFormAmount("");
      setFormDueAt("");
    } catch (cause) {
      notify({ tone: "danger", title: "فاکتور ثبت نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusy(false);
    }
  };

  const pay = async (invoice: Invoice) => {
    setPayingBusy(true);
    try {
      const paid = await invoices.pay(invoice.id, {
        method: payMethod,
        ...(payReference.trim() ? { reference: payReference.trim() } : {}),
      });
      notify({ tone: "success", title: `فاکتور «${paid.title}» تسویه شد`, detail: `${faNum(paid.amount)} تومان — ${PAY_METHOD_LABEL[payMethod]}${paid.paidReference ? ` · پیگیری ${paid.paidReference}` : ""}.` });
      setPaying(null);
      setPayReference("");
    } catch (cause) {
      notify({ tone: "danger", title: "پرداخت ثبت نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setPayingBusy(false);
    }
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const isOverdue = (invoice: Invoice): boolean =>
    invoice.status === "due" && invoice.dueAt !== null && invoice.dueAt.slice(0, 10) < todayIso;

  return (
    <div>
      <PageHeader
        kicker="کسب‌وکار"
        title="مالی"
        description="فاکتورهای شهریه و تسویهٔ آن‌ها — هر فاکتور با یک پرداخت کامل تسویه می‌شود."
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "خروجی فایل پشتیبانی نمی‌شود", detail: "تولید PDF/Excel قرارداد سرور ندارد و در این نسخه فعال نیست." })}>
              <Download className="size-3.5" /> خروجی
            </Button>
            {canRecordPayment && (
              <Button size="sm" variant="primary" onClick={() => setCreateOpen((open) => !open)} disabled={busy}>
                <Plus className="size-3.5" /> فاکتور جدید
              </Button>
            )}
          </>
        }
      />

      <div className="mb-3 mt-6 flex flex-wrap items-center gap-2">
        {(["all", "due", "paid"] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? "primary" : "ghost"}
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "همه" : paymentLabel[status]}
          </Button>
        ))}
      </div>

      {createOpen && canRecordPayment && (
        <Panel title="فاکتور جدید" className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="هنرجو" required>
              {(control) => (
                <select {...control} className={inputCls} value={formStudentId} disabled={busy} onChange={(e) => setFormStudentId(e.target.value)}>
                  <option value="">انتخاب کنید…</option>
                  {(students.students ?? []).map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="عنوان" required>
              {(control) => <input {...control} className={inputCls} value={formTitle} disabled={busy} onChange={(e) => setFormTitle(e.target.value)} placeholder="مثلاً شهریهٔ ترم پاییز" />}
            </Field>
            <Field label="مبلغ (تومان)" required>
              {(control) => <input {...control} className={cn(inputCls, "nums")} inputMode="numeric" value={formAmount} disabled={busy} onChange={(e) => setFormAmount(e.target.value.replace(/[^0-9۰-۹]/g, ""))} placeholder="مثلاً ۳۰۰۰۰۰۰" />}
            </Field>
            <Field label="سررسید (اختیاری)">
              {(control) => <input {...control} type="date" className={inputCls} value={formDueAt} disabled={busy} onChange={(e) => setFormDueAt(e.target.value)} />}
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void create()}>
              {busy ? "در حال ثبت…" : "ثبت فاکتور"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCreateOpen(false)}>انصراف</Button>
          </div>
        </Panel>
      )}

      {invoices.items.length === 0 ? (
        <EmptyState
          title="فاکتوری نیست"
          description={statusFilter === "all" ? "هنوز فاکتوری صادر نشده است." : "در این وضعیت فاکتوری نیست."}
          action={canRecordPayment ? "فاکتور جدید" : undefined}
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table aria-label="فهرست فاکتورها" className="w-full min-w-[640px] text-right text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] text-ink-400">
                <th className="px-3 py-2.5 font-medium">عنوان</th>
                <th className="px-3 py-2.5 font-medium">هنرجو</th>
                <th className="px-3 py-2.5 font-medium">مبلغ</th>
                <th className="px-3 py-2.5 font-medium">وضعیت</th>
                <th className="px-3 py-2.5 font-medium">سررسید</th>
                <th className="px-3 py-2.5 font-medium">تسویه</th>
                <th className="px-3 py-2.5 font-medium"><span className="sr-only">عملیات</span></th>
              </tr>
            </thead>
            <tbody>
              {invoices.items.map((invoice) => (
                <tr key={invoice.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-medium text-ink-50">{invoice.title}</td>
                  <td className="px-3 py-2.5 text-ink-200">{invoice.studentName ?? "—"}</td>
                  <td className="nums px-3 py-2.5 text-ink-100">{faNum(invoice.amount)} تومان</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px]", statusTone(invoice.status))}>
                      {isOverdue(invoice) ? paymentLabel.overdue : paymentLabel[invoice.status]}
                    </span>
                  </td>
                  <td className="nums px-3 py-2.5 text-ink-400">{invoice.dueAt ?? "—"}</td>
                  <td className="nums px-3 py-2.5 text-ink-400">
                    {invoice.paidAt ?? "—"}
                    {invoice.paidAt && (
                      <span className="mt-0.5 block text-[10.5px] text-ink-500">
                        {invoice.paidMethod ? PAY_METHOD_LABEL[invoice.paidMethod] : ""}
                        {invoice.paidMethod && invoice.paidReference ? " · " : ""}
                        {invoice.paidReference ? `پیگیری ${invoice.paidReference}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {invoice.status === "due" && canConfirmPayment && (
                      <Button size="sm" variant="subtle" disabled={payingBusy} onClick={() => { setPaying(invoice); setPayMethod("pos"); setPayReference(""); }}>
                        ثبت پرداخت
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paying && canConfirmPayment && (
        <Panel title={`ثبت پرداخت «${paying.title}»`} className="mt-4">
          <p className="mb-3 text-[12px] text-ink-400">
            مبلغ <span className="nums text-ink-100">{faNum(paying.amount)} تومان</span> برای {paying.studentName ?? "هنرجو"} —
            تسویه قطعی است و برگشت ندارد.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="روش پرداخت" required>
              {(control) => (
                <select {...control} className={inputCls} value={payMethod} disabled={payingBusy} onChange={(e) => setPayMethod(e.target.value as PayMethod)}>
                  <option value="pos">کارت‌خوان آموزشگاه</option>
                  <option value="transfer">کارت‌به‌کارت</option>
                </select>
              )}
            </Field>
            <Field label="شماره پیگیری (برای کارت‌به‌کارت)">
              {(control) => <input {...control} className={cn(inputCls, "nums")} value={payReference} disabled={payingBusy} onChange={(e) => setPayReference(e.target.value)} placeholder="مثلاً ۱۲۳۴۵۶" />}
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" disabled={payingBusy} onClick={() => void pay(paying)}>
              {payingBusy ? "در حال ثبت…" : "تأیید و تسویه"}
            </Button>
            <Button size="sm" variant="ghost" disabled={payingBusy} onClick={() => setPaying(null)}>انصراف</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
