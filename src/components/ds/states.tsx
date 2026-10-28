import type { ReactNode } from "react";
import { CircleOff, Inbox, RotateCcw } from "lucide-react";
import type { ApiError } from "@/api/errors";
import { POLICY_TITLE, UNAVAILABLE_DESCRIPTION, UNAVAILABLE_TITLE, classifyError } from "@/domains/shared/errorAvailability";
import { cn } from "@/utils/cn";
import { Button } from "./primitives";

/* ------------------------------------------------------------------ */
/* LoadingState — a breathing waveform, not a skeleton                 */
/* ------------------------------------------------------------------ */
export function BreathingWave({ className, bars = 9, tone = "gold" }: { className?: string; bars?: number; tone?: "gold" | "violet" | "neutral" }) {
  const color = tone === "gold" ? "bg-gold-500" : tone === "violet" ? "bg-violet-400" : "bg-ink-300";
  // Amplitude envelope like a breath: low at edges, full in the middle
  return (
    <div className={cn("flex h-8 items-center justify-center gap-[3px]", className)} role="status" aria-label="در حال بارگذاری">
      {Array.from({ length: bars }).map((_, i) => {
        const center = (bars - 1) / 2;
        const env = 1 - Math.abs(i - center) / (center + 1);
        const h = 8 + env * 20;
        return (
          <span
            key={i}
            className={cn("block w-[2px] rounded-full", color)}
            style={{
              height: h,
              animation: `breathe 2.4s var(--ease-legato) ${i * 90}ms infinite`,
              opacity: 0.6,
            }}
          />
        );
      })}
    </div>
  );
}

export function LoadingState({ label = "در حال گوش دادن به داده‌ها…", className, tone }: { label?: string; className?: string; tone?: "gold" | "violet" | "neutral" }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-10 text-center", className)}>
      <BreathingWave tone={tone} />
      <p className="text-xs text-ink-300">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */
export function EmptyState({
  title,
  description,
  action,
  onAction,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-gold-500/20 bg-white/[0.015] px-6 py-12 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-gold-500/25 bg-gradient-to-b from-gold-500/10 to-transparent text-gold-300/80">
        {icon ?? <Inbox className="size-5" strokeWidth={1.6} />}
      </div>
      <h3 className="text-[14px] font-semibold tracking-tight text-ink-100">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-ink-300">{description}</p>}
      {action && (
        <Button variant="subtle" size="sm" className="mt-5" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ErrorState                                                          */
/* ------------------------------------------------------------------ */
export function ErrorState({
  title = "داده‌ها در دسترس نیستند",
  description,
  onRetry,
  error,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  /**
   * The failure being presented. An unavailable capability or a policy refusal
   * is NOT a failed load: it gets its own title, says what is actually true, and
   * offers no retry (which could not succeed). Any other failure keeps the
   * caller's title and retry, and defaults its description to the error message.
   */
  error?: ApiError | null;
  className?: string;
}) {
  const kind = classifyError(error);
  const notRetryable = error != null && kind !== "failure";
  const shownTitle = kind === "unavailable" ? UNAVAILABLE_TITLE : kind === "policy" ? POLICY_TITLE : title;
  const shownDescription =
    kind === "unavailable"
      ? UNAVAILABLE_DESCRIPTION
      : kind === "policy"
        ? (error?.message ?? "")
        : (description ?? error?.message ?? "ارتباط با سرویس تحلیل برقرار نشد. اطلاعات قبلی همچنان معتبرند.");
  const retry = notRetryable ? undefined : onRetry;
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center rounded-2xl border border-danger-500/20 bg-danger-500/[0.04] px-6 py-10 text-center", className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-danger-500/25 bg-danger-500/10 text-danger-400">
        <CircleOff className="size-5" strokeWidth={1.7} />
      </div>
      <h3 className="text-sm font-semibold text-ink-50">{shownTitle}</h3>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-ink-300">{shownDescription}</p>
      {retry && (
        <Button variant="subtle" size="sm" className="mt-4" onClick={retry}>
          <RotateCcw className="size-3.5" />
          تلاش دوباره
        </Button>
      )}
    </div>
  );
}