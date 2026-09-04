import { useEffect, useState } from "react";
import { Check, ChevronDown, Info, TriangleAlert, X } from "lucide-react";
import { quickActions } from "@/data/academy";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ds/primitives";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/* Action sheet — quick actions open a focused, minimal form            */
/* ------------------------------------------------------------------ */
export function ActionSheet() {
  const { sheet, closeSheet, notify } = useApp();
  const def = quickActions.find((a) => a.id === sheet);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, closeSheet]);

  if (!def) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      closeSheet();
      notify({ tone: "success", title: def.success, detail: "تغییرات همان لحظه در همهٔ سطوح سامانه اعمال شد." });
    }, 650);
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button type="button" aria-label="بستن" onClick={closeSheet} className="absolute inset-0 animate-fade-in bg-ink-950/60 backdrop-blur-[2px]" />
      <form
        onSubmit={submit}
        className={cn(
          "absolute flex flex-col border-white/[0.08] bg-ink-900 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7)]",
          // mobile: bottom sheet · desktop: end-side (left) panel
          "inset-x-0 bottom-0 max-h-[88vh] animate-sheet-up rounded-t-3xl border-t",
          "sm:inset-y-0 sm:left-0 sm:right-auto sm:max-h-none sm:w-[420px] sm:animate-sheet-in sm:rounded-none sm:border-r sm:border-t-0",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px hairline-gold sm:hidden" />
        <header className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <div className="text-[10.5px] font-medium text-gold-400">اقدام سریع</div>
            <h2 id="sheet-title" className="mt-1 text-lg font-semibold text-ink-50">
              {def.label}
            </h2>
            <p className="mt-1 text-xs text-ink-400">{def.hint}</p>
          </div>
          <button type="button" onClick={closeSheet} aria-label="بستن" className="flex size-9 items-center justify-center rounded-xl border border-white/[0.07] text-ink-300 hover:bg-white/[0.05]">
            <X className="size-4" />
          </button>
        </header>

        <div className="stagger flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {def.fields.map((f, i) => (
            <label key={f.label} className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-200">{f.label}</span>
              {f.type === "select" ? (
                <span className="relative block">
                  <select
                    defaultValue=""
                    className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-ink-850 pl-9 pr-3.5 text-sm text-ink-50 outline-none transition-colors focus:border-gold-500/50"
                  >
                    <option value="" disabled>
                      {f.placeholder}
                    </option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                </span>
              ) : (
                <input
                  autoFocus={i === 0}
                  placeholder={f.placeholder}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-ink-850 px-3.5 text-sm text-ink-50 outline-none transition-colors placeholder:text-ink-500 focus:border-gold-500/50"
                />
              )}
            </label>
          ))}
          <p className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-ink-400">
            <Info className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
            این اقدام در سامانهٔ یکپارچه ثبت می‌شود و در پنل مدرس و اپلیکیشن هنرجو نیز منعکس خواهد شد.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <Button variant="ghost" onClick={closeSheet}>
            انصراف
          </Button>
          <Button variant="primary" type="submit" disabled={busy} className="min-w-28">
            {busy ? "در حال ثبت…" : "ثبت"}
          </Button>
        </footer>
      </form>
    </div>
  );
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
              )}
            >
              {t.tone === "success" ? <Check className="size-4" strokeWidth={2.5} /> : t.tone === "warning" ? <TriangleAlert className="size-4" /> : <Info className="size-4" />}
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
