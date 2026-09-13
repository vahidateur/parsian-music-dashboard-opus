import { RotateCcw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button, Surface } from "@/components/ds/primitives";
import { faNum } from "@/lib/format";
import { DESTRUCTIVE_LABELS } from "@/domains/demo/useDemoData";
import type { LifecycleRecoveryController } from "./LifecycleRecoveryContext";

/**
 * Recovery surface for an initialized local environment.
 *
 * The controller is owned by DataLifecycleGate, while this surface is mounted
 * only from the unauthenticated branch. That keeps the way back available when
 * clear() removed every account without placing recovery controls inside Shell.
 */
export function LifecycleRecoveryPanel({ controller }: { controller: LifecycleRecoveryController }) {
  if (controller.state !== "empty" && controller.state !== "demo") return null;

  const pending = controller.pending?.action === "uninitialize";
  const failure =
    controller.lastResult?.operation === "uninitialize" && !controller.lastResult.ok
      ? controller.lastResult.message
      : null;
  const environmentLabel = controller.state === "demo" ? "محیط دمو" : "محیط دادهٔ واقعی";

  return (
    <section dir="rtl" aria-labelledby="lifecycle-recovery-title" className="mx-auto mt-5 w-full max-w-[430px]">
      {!pending ? (
        <Surface className="border-warn-500/[0.22] bg-warn-500/[0.045] p-4">
          <div className="flex items-start gap-2.5">
            <RotateCcw className="mt-0.5 size-4 shrink-0 text-warn-400" aria-hidden />
            <div className="min-w-0">
              <h2 id="lifecycle-recovery-title" className="text-[13px] font-semibold text-ink-50">
                بازیابی محیط داده
              </h2>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-300">
                این {environmentLabel} از قبل ساخته شده است. اگر حساب دسترسی در دسترس نیست، محیط را حذف کنید تا
                دوباره نوع محیط را انتخاب کنید.
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-3 text-warn-400 hover:text-warn-300"
                onClick={() => controller.request("uninitialize")}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                شروع دوباره و انتخاب محیط
              </Button>
            </div>
          </div>
          {failure && (
            <p role="alert" className="mt-3 rounded-xl border border-danger-500/25 bg-danger-500/[0.07] p-3 text-[11.5px] leading-relaxed text-danger-300">
              {failure}
            </p>
          )}
        </Surface>
      ) : (
        <Surface className="border-danger-500/30 bg-danger-500/[0.07] p-4" aria-live="polite">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger-400" aria-hidden />
            <div className="min-w-0">
              <h2 id="lifecycle-recovery-title" className="text-[13.5px] font-semibold text-ink-50">
                {DESTRUCTIVE_LABELS.uninitialize.title}
              </h2>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-200">
                {DESTRUCTIVE_LABELS.uninitialize.warning}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
              <dt className="text-ink-400">مجموع رکوردها</dt>
              <dd className="nums mt-0.5 text-[13px] font-semibold text-ink-50">{faNum(controller.stats.total)}</dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
              <dt className="text-ink-400">حساب‌های دسترسی</dt>
              <dd className="nums mt-0.5 text-[13px] font-semibold text-ink-50">
                {faNum(controller.stats.counts.users)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
              <dt className="text-ink-400">هنرجویان</dt>
              <dd className="nums mt-0.5 text-[13px] font-semibold text-ink-50">
                {faNum(controller.stats.counts.students)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
              <dt className="text-ink-400">فایل‌های رسانه</dt>
              <dd className="nums mt-0.5 text-[13px] font-semibold text-ink-50">
                {faNum(controller.stats.counts.media)}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger-500/25 bg-danger-500/[0.08] p-3 text-[11.5px] leading-relaxed text-danger-200">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              با تأیید، حساب‌های دسترسی حذف و ورود قفل می‌شود؛ داده، نشانگر محیط و باینری‌های ذخیره‌شده پاک
              می‌شوند. پیش از ادامه، اگر داده‌ای لازم است پشتیبان بگیرید.
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={controller.busy} onClick={() => void controller.confirm()}>
              {controller.busy ? "در حال حذف…" : "تأیید و حذف محیط"}
            </Button>
            <Button size="sm" variant="ghost" disabled={controller.busy} onClick={controller.cancel}>
              انصراف
            </Button>
          </div>
        </Surface>
      )}
    </section>
  );
}
