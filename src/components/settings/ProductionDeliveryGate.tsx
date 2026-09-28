/**
 * ProductionDeliveryGate — the Settings surface for Remove Demo / Deliver
 * Production (Phase 2A).
 *
 * This panel is one HALF of the safety story; the other half lives at the
 * service layer (`domains/demo/delivery.ts` + `api/deploymentLock.ts`). The UI
 * here only: enumerates exactly what delivery will and will not touch, demands
 * an explicit confirmation, offers a safety backup BEFORE anything is
 * destroyed, and surfaces the pending/fail-closed state so a parked attempt
 * can be retried. Buttons disappearing is never the boundary — every action
 * re-validates at the service.
 *
 * Rendered ONLY by the demo composition (`targets/targetFeatures.tsx`), so
 * this component — like every demo capability — is absent from the client
 * bundle by construction.
 */
import { useState } from "react";
import { Download, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";
import { useAuth } from "@/domains/auth/AuthContext";
import { useApp } from "@/context/AppContext";
import { readDeliveryPending, readDeliveryState, readDeliveryStateInfo } from "@/api/deploymentLock";
import { deliverProduction, evaluateDeliveryOwnership } from "@/domains/demo/delivery";
import { demoDataManager } from "@/domains/demo/demoDataManager";
import { backupFileName } from "@/domains/demo";
import { downloadTextFile } from "@/lib/download";
import { faNum } from "@/lib/format";
import { Button, Surface } from "@/components/ds/primitives";
import { Panel } from "@/components/ds/patterns";

type Phase = "idle" | "confirming" | "done";

const OWNER_LABELS: Record<string, string> = {
  demo: "دیتاست از نوع دمو شناسایی شد (کاندیدای حذف)",
  customer: "دیتاست مشتری شناسایی شد (دست‌نخورده می‌ماند)",
  "no-environment": "داده‌ای برای حذف وجود ندارد",
  none: "پیش‌تر تحویل داده شده است",
};

const PENDING_LABELS: Record<string, string> = {
  "in-progress": "عملیات قبلی قطع شده است؛ هیچ حذف مخربی تکرار نمی‌شود.",
  "ownership-unproven": "مالکیت دادهٔ موجود قابل اثبات نبود؛ هیچ‌چیز حذف نشد.",
  "dataset-unreadable": "دیتاست خواندنی نبود؛ هیچ‌چیز حذف نشد.",
  "ownership-conflict": "نشانگر محیط با مالکیت دیتاست ناسازگار بود؛ هیچ‌چیز حذف نشد.",
  "provenance-unreadable": "اطلاعات هویت دیتاست خراب بود؛ هیچ‌چیز حذف نشد.",
  "blob-cleanup-incomplete": "پاک‌سازی فایل‌های دمو ناقص ماند؛ دیتاست دست‌نخورده است.",
  "credential-cleanup-incomplete": "حذف اطلاعات ورود دمو ناقص ماند؛ دیتاست دست‌نخورده است.",
};

export function ProductionDeliveryGate() {
  const { can, logout } = useAuth();
  const { notify } = useApp();
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [outcomeMessage, setOutcomeMessage] = useState<string | null>(null);

  const state = readDeliveryState();
  const stateInfo = readDeliveryStateInfo();
  const pending = readDeliveryPending();

  if (!can("demo.manage")) return null;

  const locked = state === "delivered" || state === "locked";
  const parked = state === "removing";

  const startDelivery = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await deliverProduction({ confirm: true });
      setOutcomeMessage(result.message);
      if (result.ok) {
        setPhase("done");
        notify({ tone: "success", title: "تحویل تولید انجام شد", detail: result.message });
      } else {
        setPhase("idle");
        notify({
          tone: "warning",
          title: result.pending ? "تحویل تکمیل نشد — داده‌ها حفظ شدند" : "عملیات لغو شد",
          detail: result.message,
        });
      }
    } catch (cause) {
      setPhase("idle");
      notify({
        tone: "danger",
        title: "خطا در تحویل تولید",
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  const downloadSafetyBackup = (): void => {
    try {
      const backup = demoDataManager.exportBackup();
      downloadTextFile(backupFileName(), JSON.stringify(backup, null, 2));
      notify({
        tone: "success",
        title: "پشتیبان ایمنی ساخته شد",
        detail: "پیش از حذف دمو، نسخه‌ای از داده‌های فعلی دانلود شد.",
      });
    } catch (cause) {
      notify({
        tone: "danger",
        title: "پشتیبان ساخته نشد",
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    }
  };

  const stats = demoDataManager.stats();

  /* ------------------------------ delivered / locked ------------------------------ */
  if (locked) {
    return (
      <Panel
        title="تحویل تولید انجام شده — قفل فعال است"
        kicker="دادهٔ نمایشی برای همیشه غیرفعال شد؛ این وضعیت در سطح سرویس اعمال می‌شود، نه فقط در رابط کاربری."
        aside={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-500/30 bg-ok-500/10 px-2.5 py-1 text-[11px] font-semibold text-ok-400">
            <LockKeyhole className="size-3.5" aria-hidden /> قفل تولید
          </span>
        }
      >
        <p className="text-[12px] leading-6 text-ink-200">
          ساختن، بازگردانی یا وارد کردن دادهٔ نمایشی ازاینپس در سطح سرویس رد می‌شود؛ رابط کاربری آن‌ها را اصلاً نشان نمی‌دهد.
          داده‌های محیط شما دست‌نخورده ماند و پشتیبان‌های محیط خالی همچنان قابل بازگردانی‌اند.
          {stateInfo.corrupt && (
            <span className="block text-[11px] text-warn-400 mt-1">
              نشانگر وضعیت تحویل نامعتبر خوانده شد و مطابق قفل رفتار می‌شود (ایمن‌سازی شکست-به-قفل).
            </span>
          )}
        </p>
        <Surface className="mt-3 border-ok-500/25 bg-ok-500/[0.06] p-3.5">
          <p className="text-[11.5px] leading-relaxed text-ink-200">
            برای ادامهٔ کار از حساب خارج شوید و دوباره وارد شوید؛ نشست دمو حذف شده است.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 text-ok-400 hover:text-ok-300"
            onClick={() => void logout()}
          >
            خروج از حساب
          </Button>
        </Surface>
      </Panel>
    );
  }

  /* ------------------------------ pending / recovering ------------------------------ */
  if (parked) {
    return (
      <Panel
        title="تحویل نیمه‌کاره — داده‌ها حفظ شده‌اند"
        kicker="عملیات حذف دمو برای ایمنی متوقف شده است؛ داده‌ای حذف نشده و تلاش مجدد از همان‌جا ادامه می‌یابد."
        aside={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-500/30 bg-warn-500/10 px-2.5 py-1 text-[11px] font-semibold text-warn-400">
            <TriangleAlert className="size-3.5" aria-hidden /> در انتظار تکمیل
          </span>
        }
      >
        <p className="text-[12px] leading-6 text-ink-200">
          {pending ? PENDING_LABELS[pending.reason] ?? "توقف ایمن برای بازبینی." : "توقف ایمن برای بازبینی."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void startDelivery()}>
            {busy ? "در حال تکمیل…" : "تکمیل تحویل (تلاش مجدد)"}
          </Button>
          <Button size="sm" disabled={busy} onClick={downloadSafetyBackup}>
            <Download className="size-3.5" aria-hidden /> دانلود پشتیبان از داده‌های موجود
          </Button>
        </div>
        {outcomeMessage && phase === "idle" && (
          <p className="mt-3 text-[11.5px] text-ink-400" role="status">
            {outcomeMessage}
          </p>
        )}
      </Panel>
    );
  }

  /* ------------------------------ demo_active: the delivery action ------------------------------ */
  const ownership = evaluateDeliveryOwnership();
  return (
    <Panel
      title="حذف دادهٔ دمو و تحویل نسخهٔ تولید"
      kicker="فقط داده‌ای حذف می‌شود که مالکیت دمویِ آن از روی نشانگرهای ذخیره‌سازی قابل اثبات باشد؛ هر چیز نامعلوم حفظ می‌شود."
      aside={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-danger-500/30 bg-danger-500/10 px-2.5 py-1 text-[11px] font-semibold text-danger-400">
          <ShieldCheck className="size-3.5" aria-hidden /> غیرقابل بازگشت
        </span>
      }
    >
      <p className="text-[12px] leading-6 text-ink-200">
        <span className="font-semibold text-ink-50">{OWNER_LABELS[ownership.verdict] ?? ownership.verdict}</span>
        {" — "}مجموع رکوردهای فعلی: <span className="nums">{faNum(stats.total)}</span>.
      </p>
      <ul className="mt-2 list-disc ps-5 space-y-1 text-[11.5px] leading-6 text-ink-200">
        <li>
          <span className="text-danger-400">حذف می‌شود:</span> دیتاست دمو (در صورت اثبات)، نشانگر محیط دمو، حساب‌های نمونه،
          نشست دمو و فایل‌های رسانهٔ دمویِ قابل‌ردیابی.
        </li>
        <li>
          <span className="text-ok-400">حذف نمی‌شود:</span> تنظیمات رابط کاربری، تلاش‌های ورود، فعالیت نشست، و هر داده‌ای
          که مالکیتش قابل اثبات نباشد.
        </li>
        <li>
          پس از تحویل: ساختن یا بازگردانی دمو برای همیشه در سطح سرویس غیرفعال می‌شود — بازگشتی ندارد.
        </li>
      </ul>

      {phase !== "confirming" && phase !== "done" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={downloadSafetyBackup}>
            <Download className="size-3.5" aria-hidden /> ۱. دانلود پشتیبان ایمنی
          </Button>
          <Button size="sm" variant="ghost" className="text-danger-400 hover:text-danger-300" onClick={() => setPhase("confirming")}>
            ۲. شروع حذف و تحویل
          </Button>
        </div>
      )}

      {phase === "confirming" && (
        <Surface className="mt-3 border-danger-500/25 bg-danger-500/[0.06] p-4 space-y-3">
          <p className="text-[12px] font-semibold leading-6 text-ink-50">این عملیات غیرقابل بازگشت است</p>
          <p className="text-[11.5px] leading-6 text-ink-200">
            دیتاست دمو، حساب‌های نمونه و نشست فعلی برای همیشه حذف می‌شوند و پس از تحویل هیچ مسیری — حتی فراخوانی مستقیم
            سرویس — دوباره دمو نمی‌سازد. داده‌هایی که مالکیتشان قابل اثبات نباشد حذف نمی‌شوند. پیش از ادامه، پشتیبان
            ایمنی دانلود کرده‌اید؟
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void startDelivery()}>
              {busy ? "در حال اجرا…" : "تأیید نهایی و اجرای تحویل"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPhase("idle")}>
              انصراف
            </Button>
          </div>
        </Surface>
      )}

      {phase === "done" && outcomeMessage && (
        <Surface className="mt-3 border-ok-500/25 bg-ok-500/[0.06] p-4 space-y-2">
          <p className="text-[12px] leading-6 text-ink-50" role="status">
            {outcomeMessage}
          </p>
          <p className="text-[11.5px] leading-6 text-ink-200">
            نشست دمو حذف شد. برای ادامه از حساب خارج شوید و با حساب خودتان وارد شوید.
          </p>
          <Button size="sm" variant="ghost" className="text-ok-400 hover:text-ok-300" onClick={() => void logout()}>
            خروج از حساب
          </Button>
        </Surface>
      )}
    </Panel>
  );
}
