import type { ReactNode } from "react";
import { CircleOff, FlaskConical, Inbox, RotateCcw } from "lucide-react";
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
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] px-6 py-12 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-ink-300">
        {icon ?? <Inbox className="size-5" strokeWidth={1.6} />}
      </div>
      <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
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
  description = "ارتباط با سرویس تحلیل برقرار نشد. اطلاعات قبلی همچنان معتبرند.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center rounded-2xl border border-danger-500/20 bg-danger-500/[0.04] px-6 py-10 text-center", className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-danger-500/25 bg-danger-500/10 text-danger-400">
        <CircleOff className="size-5" strokeWidth={1.7} />
      </div>
      <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-ink-300">{description}</p>
      {onRetry && (
        <Button variant="subtle" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCcw className="size-3.5" />
          تلاش دوباره
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DemoNote — prototype discipline: never pass demo figures off as     */
/* production values.                                                  */
/* ------------------------------------------------------------------ */
export function DemoNote({ text, className }: { text?: string; className?: string }) {
  return (
    <div role="note" className={cn("flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3", className)}>
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-ink-400" strokeWidth={1.8} />
      <p className="text-[11.5px] leading-relaxed text-ink-400">
        {text ?? "این بخش با دادهٔ نمایشی برای پیش‌نمایش پر شده است؛ پس از اتصال به سامانهٔ اصلی، همین ساختار با دادهٔ واقعی تغذیه می‌شود."}
      </p>
    </div>
  );
}
