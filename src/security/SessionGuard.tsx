/**
 * Session guard for the authenticated app.
 *
 * Two jobs:
 *   1. warn before an idle sign-out, so nobody loses half-typed work;
 *   2. sign the user out when idle or when the absolute lifetime expires.
 *
 * This is a browser-side convenience. The server must expire the session on
 * its own schedule and reject the token afterwards — otherwise an attacker who
 * copied a token is unaffected by anything that happens in this component.
 */
import { useCallback, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/domains/auth/AuthContext";
import { Button } from "@/components/ds/primitives";
import { useIdleTimeout } from "./useIdleTimeout";

export function SessionGuard() {
  const { status, logout } = useAuth();
  const [reason, setReason] = useState<"idle" | "absolute" | null>(null);

  const handleTimeout = useCallback(
    (cause: "idle" | "absolute") => {
      setReason(cause);
      void logout();
    },
    [logout],
  );

  const { warning, remainingMs, stayActive } = useIdleTimeout({
    enabled: status === "authenticated",
    onTimeout: handleTimeout,
  });

  // After sign-out the login screen replaces this tree; the reason is kept
  // only so a warning does not flash during the transition.
  if (status !== "authenticated") {
    if (reason !== null) return null;
    return null;
  }

  if (!warning) return null;

  const seconds = Math.max(0, Math.ceil((remainingMs ?? 0) / 1000));

  return (
    <div
      role="alertdialog"
      aria-labelledby="idle-title"
      aria-describedby="idle-body"
      className="fixed inset-x-0 bottom-4 z-[80] mx-auto w-[min(440px,calc(100%-2rem))] rounded-2xl border border-warn-500/30 bg-ink-900/95 p-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div id="idle-title" className="text-[13px] font-semibold text-ink-50">
            به‌زودی از حساب خارج می‌شوید
          </div>
          <p id="idle-body" className="mt-1 text-[11.5px] leading-relaxed text-ink-300">
            به دلیل نبود فعالیت، نشست شما تا{" "}
            <span className="nums text-ink-100">{seconds}</span> ثانیهٔ دیگر بسته می‌شود.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={stayActive}>
              ادامهٔ کار
            </Button>
            <Button size="sm" variant="subtle" onClick={() => void logout()}>
              خروج
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
