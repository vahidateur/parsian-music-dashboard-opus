import { Database, FlaskConical, RotateCcw, TriangleAlert } from "lucide-react";
import { Button, Surface } from "@/components/ds/primitives";
import { useDataLifecycle } from "@/domains/demo/useDataLifecycle";
import { useLifecycleRecovery } from "./LifecycleRecoveryContext";

/**
 * First-run choice — the only place an environment's kind is decided.
 *
 * Rendered by `DataLifecycleGate` while the store is UNINITIALIZED, i.e. before
 * authentication, before the shell and before any domain view, so no screen ever
 * has to reason about whether demo data exists. Domain views stay free of
 * `isDemo` branching: by the time they mount, the environment is already either
 * EMPTY or DEMO.
 *
 * The same surface is also the destination after an uninitialize operation. The
 * gate-owned recovery controller keeps its awaited result alive while the store
 * reset transitions the boot chain back here.
 *
 * The two options are deliberately unequal in emphasis. Starting with the
 * customer's own (empty) data is the primary action, because that is what a real
 * academy needs; loading the showcase dataset is explicitly labelled as
 * development/QA/demo material.
 *
 * Copy contract: the labels below are the product's wording for the choice and
 * are asserted by `components/lifecycle/__tests__/FirstRunChooser.test.tsx`.
 */
export function FirstRunChooser() {
  const { notice, chooseEmpty, chooseDemo } = useDataLifecycle();
  const recovery = useLifecycleRecovery();
  const recovering = recovery?.busy && recovery.pending?.action === "uninitialize";
  const recoveryMessage =
    recovery?.lastResult?.operation === "uninitialize" ? recovery.lastResult.message : null;

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-10 text-ink-50"
    >
      <Surface className="w-full max-w-2xl p-6 sm:p-8">
        <p className="text-[11.5px] font-medium tracking-wide text-ink-400">نخستین اجرا</p>
        <h1 className="mt-2 text-[19px] font-semibold text-ink-50">
          محیط دادهٔ خود را انتخاب کنید
        </h1>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-300">
          این انتخاب یک‌بار انجام می‌شود و مشخص می‌کند محیط جاری با دادهٔ واقعی آموزشگاه شما شروع شود یا
          با دادهٔ نمونهٔ نمایشی. هیچ داده‌ای تا پیش از انتخاب شما نوشته نمی‌شود.
        </p>

        {recovering ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex items-start gap-2.5 rounded-2xl border border-warn-500/25 bg-warn-500/[0.07] p-4 text-[12px] leading-relaxed text-warn-300"
          >
            <RotateCcw className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
            <span>محیط حذف شد؛ پاک‌سازی فایل‌های ذخیره‌شده در حال تکمیل است. لطفاً صبر کنید…</span>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {/* Primary: the customer's own environment. */}
            <div className="flex flex-col rounded-2xl border border-gold-500/25 bg-gold-500/[0.05] p-4">
              <Database className="size-5 text-gold-400" strokeWidth={1.7} aria-hidden />
              <h2 className="mt-3 text-[14px] font-semibold text-ink-50">دادهٔ واقعی آموزشگاه</h2>
              <p className="mt-1.5 flex-1 text-[11.5px] leading-relaxed text-ink-300">
                محیطی خالی و کاملاً معتبر، بدون هیچ رکورد نمونه: هنرجو، کلاس، منبع، پیام یا فایلی وجود
                ندارد. دادهٔ خودتان را از صفر ثبت می‌کنید.
              </p>
              <Button variant="primary" className="mt-4 w-full" onClick={chooseEmpty}>
                شروع با دادهٔ خالی
              </Button>
            </div>

            {/* Secondary: showcase / QA material, labelled as such. */}
            <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <FlaskConical className="size-5 text-violet-300" strokeWidth={1.7} aria-hidden />
              <h2 className="mt-3 text-[14px] font-semibold text-ink-50">دادهٔ نمونهٔ نمایشی</h2>
              <p className="mt-1.5 flex-1 text-[11.5px] leading-relaxed text-ink-300">
                مخصوص توسعه، QA و نمایش محصول: مجموعهٔ کامل و معین آموزشگاه نمونه، شامل یک فایل کتابخانهٔ
                قابل دریافت. برای دادهٔ عملیاتی نیست.
              </p>
              <Button variant="subtle" className="mt-4 w-full" onClick={chooseDemo}>
                بارگذاری دادهٔ نمونه
              </Button>
            </div>
          </div>
        )}

        {recoveryMessage && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-warn-500/25 bg-warn-500/[0.06] p-3 text-[11.5px] leading-relaxed text-warn-300"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {recoveryMessage}
          </p>
        )}

        {notice && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-warn-500/25 bg-warn-500/[0.06] p-3 text-[11.5px] leading-relaxed text-warn-400"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {notice}
          </p>
        )}

        <p className="mt-5 text-[11px] leading-relaxed text-ink-400">
          این انتخاب جایگزین یا پاک‌کردن دادهٔ موجود نیست: اگر محیطی از قبل ساخته شده باشد، همان محیط
          بدون تغییر باقی می‌ماند. عملیات مخرب روی داده (بازنشانی، پاک‌کردن، بازگردانی پشتیبان) تنها به‌صورت
          صریح و با تأیید جداگانه انجام می‌شود.
        </p>
      </Surface>
    </main>
  );
}
