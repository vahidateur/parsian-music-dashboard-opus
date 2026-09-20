import { useEffect } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { QuickActionDef } from "@/lib/viewContracts";
import { Button } from "@/components/ds/primitives";
import { Dialog } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";
import { StudentFormDialog } from "@/domains/students/StudentFormDialog";
import { ClassFormDialog } from "@/domains/classes/ClassFormDialog";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";

/* ------------------------------------------------------------------ */
/* Quick-action definitions (M-1)                                       */
/*                                                                      */
/* M10 had the sheet build fake forms from hardcoded option arrays      */
/* (instrument names, teacher names, room names) — category D content   */
/* that claimed a closed world. M-1 removes those arrays entirely: each */
/* action now routes to a real dialog or view that reads its options    */
/* from the repositories. The definitions carry only id/label/hint,     */
/* no fields, no options, no counts.                                    */
/* ------------------------------------------------------------------ */
export const quickActions: QuickActionDef[] = [
  {
    id: "student",
    label: "افزودن هنرجو",
    hint: "ثبت‌نام جدید",
  },
  {
    id: "class",
    label: "برنامه‌ریزی کلاس",
    hint: "بازهٔ زمانی جدید",
  },
  {
    id: "payment",
    label: "ثبت پرداخت",
    hint: "شهریه یا جلسه",
  },
  {
    id: "message",
    label: "ارسال پیام",
    hint: "به هنرجو یا مدرس",
  },
];

/* ------------------------------------------------------------------ */
/* Action sheet — M-1 routes to real dialogs/views                      */
/*                                                                      */
/* - student → StudentFormDialog (real repository write)                */
/* - class   → ClassFormDialog   (real repository write)                */
/*   EnrollmentDialog is the other real class-related dialog; it is     */
/*   reached from the class detail view where a classId exists, not     */
/*   from the global quick-action list which has no class context.      */
/*   The quick-action for class therefore opens ClassFormDialog;        */
/*   enrollment stays honest by requiring a class scope.                */
/* - payment → honest Finance deferral (D6/I2) — no invented repo       */
/* - message → navigate to Messages composer/view                       */
/*                                                                      */
/* Focus ownership: AppContext.openSheet closes the palette in the same */
/* render, and the shell effect keeps body overflow hidden across the   */
/* handoff. Each real Dialog owns its own focus trap (useFocusTrap), so */
/* Tab stays inside and Escape closes only the top overlay.             */
/* ------------------------------------------------------------------ */
export function ActionSheet() {
  const { sheet, closeSheet, navigate, notify } = useApp();
  const demoEnvironment = useIsDemoEnvironment();

  // Message quick action: navigate to messages and close the sheet.
  // This is a view navigation, not a dialog, so it must not render a Dialog.
  useEffect(() => {
    if (sheet !== "message") return;
    // Defer navigation to after render so the sheet's close animation (if any)
    // does not fight with the view transition. The palette is already closed
    // by AppContext.openSheet.
    const id = window.setTimeout(() => {
      closeSheet();
      navigate({ view: "messages" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [sheet, closeSheet, navigate]);

  // Payment quick action: honest Finance deferral per D6/I2.
  // No repository exists, so we show an info dialog and offer to go to Finance.
  if (sheet === "payment") {
    return (
      <Dialog
        open={true}
        onClose={closeSheet}
        title="ثبت پرداخت"
        description="گزارش مالی نیازمند سرور است — این بخش در M10 به‌عنوان D6/I2 موکول شد و هیچ مخزن مالی ساخته نشده است."
        footer={
          <>
            <Button variant="subtle" onClick={closeSheet}>
              بستن
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                closeSheet();
                navigate({ view: "finance" });
                notify({
                  tone: "info",
                  title: "گزارش مالی نیازمند سرور است",
                  detail: "بخش مالی و گزارش‌ها در این نسخه تنها وضعیت موکول‌شده را نمایش می‌دهد.",
                });
              }}
            >
              رفتن به مالی
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-ink-400">
            <Info className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
            نسخهٔ دمو: ثبت پرداخت به سرویس مالی سمت سرور نیاز دارد. در این نسخه، داده‌های مالی از طریق مخزن خوانده نمی‌شوند و هیچ مبلغی ذخیره نمی‌شود. برای مشاهدهٔ وضعیت فعلی، به بخش مالی بروید.
          </p>
          <p className="text-[11px] leading-relaxed text-ink-500">
            تصمیم D6 و کار I2 (DECISIONS §۱۹) صراحتاً می‌گویند: هیچ مخزن مالی، هیچ خوانش مالی و هیچ دامنهٔ مالی در M10 ساخته نشده است. این دیالوگ به‌جای ساختن یک مخزن جعلی، وضعیت موکول‌شده را صادقانه بیان می‌کند.
          </p>
        </div>
      </Dialog>
    );
  }

  // Student quick action → real StudentFormDialog
  if (sheet === "student") {
    return (
      <StudentFormDialog
        open={true}
        onClose={closeSheet}
        onSaved={(saved, mode) =>
          notify({
            tone: "success",
            title: mode === "create" ? `${saved.name} افزوده شد` : `${saved.name} به‌روزرسانی شد`,
            detail: demoEnvironment ? "تغییرات در دادهٔ دمو ذخیره شد." : "تغییرات در داده‌ها ذخیره شد.",
          })
        }
      />
    );
  }

  // Class quick action → real ClassFormDialog
  // EnrollmentDialog is reachable from class detail (needs classId), so the
  // global quick action opens the class creation dialog.
  if (sheet === "class") {
    return (
      <ClassFormDialog
        open={true}
        onClose={closeSheet}
        onSaved={(saved, mode) =>
          notify({
            tone: "success",
            title: mode === "create" ? `${saved.title} ساخته شد` : `${saved.title} به‌روزرسانی شد`,
            detail: demoEnvironment ? "تغییرات در دادهٔ دمو ذخیره شد." : "تغییرات در داده‌ها ذخیره شد.",
          })
        }
      />
    );
  }

  // Message is handled by the effect above (navigates away). While the timeout
  // is pending, render nothing to avoid a flash of the old fake form.
  if (sheet === "message") {
    return null;
  }

  // No sheet open
  return null;
}

/* ------------------------------------------------------------------ */
/* Toasts — success resonates, briefly                                 */
/* ------------------------------------------------------------------ */
export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-20 left-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:left-6 lg:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="surface-glass pointer-events-auto flex animate-sheet-up items-start gap-3 p-3.5 shadow-2xl">
          <span className="relative flex size-9 shrink-0 items-center justify-center">
            {t.tone === "success" && (
              <>
                <span className="absolute inset-0 animate-resonance rounded-full border border-gold-400/60" />
                <span className="absolute inset-0 animate-resonance rounded-full border border-gold-400/40" style={{ animationDelay: "260ms" }} />
              </>
            )}
            <span
              className={cn(
                "relative flex size-9 items-center justify-center rounded-full border",
                t.tone === "success" && "border-gold-500/40 bg-gold-500/15 text-gold-300",
                t.tone === "info" && "border-white/[0.1] bg-white/[0.05] text-ink-200",
                t.tone === "warning" && "border-warn-500/30 bg-warn-500/10 text-warn-400",
                t.tone === "danger" && "border-danger-500/40 bg-danger-500/15 text-danger-400",
              )}
            >
              {t.tone === "success" ? (
                <Check className="size-4" strokeWidth={2.5} />
              ) : t.tone === "warning" || t.tone === "danger" ? (
                <TriangleAlert className="size-4" />
              ) : (
                <Info className="size-4" />
              )}
            </span>
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-sm font-medium text-ink-50">{t.title}</div>
            {t.detail && <div className="mt-0.5 text-xs leading-relaxed text-ink-300">{t.detail}</div>}
          </div>
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="بستن" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-white/[0.05] hover:text-ink-100">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
