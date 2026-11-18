import { Button } from "@/components/ds/primitives";
import { useAuth } from "./AuthContext";
import { requestRolePolicyRefresh } from "./permissions";
import { useRolePolicyState } from "./useRoles";

/**
 * Persistent shell disclosure for the role-policy projection.
 *
 * One source of truth: `useRolePolicyState` (the single synchronization owner)
 * for Fresh/Stale/Unavailable, plus the Stage 13.1 session-level `policyError`
 * for a restore whose local policy could not be read at all. It deliberately
 * reads `policyError`, not `error`: login errors belong to the login screen and
 * must never leak into the authenticated shell.
 *
 * Fresh and Loading render nothing — initialization must not flash a warning.
 */
export function PolicyUnavailableBanner() {
  const { policyError, policyRetrying, retryPolicy, session } = useAuth();
  const state = useRolePolicyState();

  if (policyError) {
    const invalid = policyError.code === "ROLE_POLICY_INVALID";
    const unavailable = policyError.code === "ROLE_POLICY_UNAVAILABLE";
    const title = invalid
      ? "پیکربندی دسترسی معتبر نیست"
      : unavailable
        ? "دسترسی موقتاً محدود است"
        : "قواعد دسترسی در دسترس نیست";
    const detail = invalid
      ? "قواعد دسترسی محلی معتبر نیست؛ تا اصلاح پیکربندی، دسترسی‌ها خالی می‌مانند. بررسی دوباره به‌تنهایی ممکن است مشکل را برطرف نکند."
      : "قواعد دسترسی محلی خوانده نشد؛ تا تأیید مجدد، دسترسی‌ها خالی می‌مانند. این وضعیت با خطای ورود یا شبکه یکی نیست.";

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="mb-4 rounded-xl border border-warn-500/30 bg-warn-500/10 px-4 py-3 text-[12px] leading-relaxed text-warn-200"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{title}</p>
            <p className="mt-1 text-warn-300/90">{detail}</p>
          </div>
          <Button
            variant="subtle"
            size="sm"
            disabled={policyRetrying}
            onClick={() => void retryPolicy()}
          >
            {policyRetrying ? "در حال بررسی…" : "بررسی دوباره"}
          </Button>
        </div>
      </div>
    );
  }

  // The projection belongs to the signed-in session; a transition frame must
  // not show the previous session's state under the new identity.
  if (!session || state.sessionKey !== session.token) return null;
  if (state.status !== "stale" && state.status !== "unavailable") return null;

  const stale = state.status === "stale";
  const title = stale ? "قواعد دسترسی به‌روزرسانی نشد" : "قواعد دسترسی در دسترس نیست";
  const detail = stale
    ? "آخرین نسخهٔ تأییدشده نمایش داده می‌شود، اما به‌روزرسانی آن ناموفق بود؛ ممکن است با تنظیمات فعلی متفاوت باشد."
    : "سیاست دسترسی این نشست خوانده یا تأیید نشد؛ تا بررسی دوباره، دسترسی‌ها خالی می‌مانند.";

  return (
    <div
      role="alert"
      aria-live={stale ? "polite" : "assertive"}
      className={
        stale
          ? "mb-4 rounded-xl border border-warn-500/30 bg-warn-500/10 px-4 py-3 text-[12px] leading-relaxed text-warn-200"
          : "mb-4 rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-[12px] leading-relaxed text-danger-200"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className={stale ? "mt-1 text-warn-300/90" : "mt-1 text-danger-300/90"}>{detail}</p>
        </div>
        <Button
          variant="subtle"
          size="sm"
          disabled={state.refreshing}
          onClick={() => requestRolePolicyRefresh()}
        >
          {state.refreshing ? "در حال بررسی…" : "بررسی دوباره"}
        </Button>
      </div>
    </div>
  );
}
