import { signals } from "@/data/academy";
import { useApp } from "@/context/AppContext";
import { SignalBlock } from "@/components/ds/blocks";
import { Surface } from "@/components/ds/primitives";
import { cn } from "@/utils/cn";

/** Four intelligent signals on one plane, separated by hairlines — not four cards. */
export function Signals({ className }: { className?: string }) {
  const { navigate } = useApp();
  return (
    <Surface className={cn("overflow-hidden", className)} aria-label="سیگنال‌های اصلی">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {signals.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "animate-phrase-in border-white/[0.06]",
              // 1-col (mobile): stacked hairlines
              i > 0 && "max-sm:border-t",
              // 2-col (sm..xl): items 2 & 4 get a start hairline, items 3 & 4 a top hairline
              i % 2 === 1 && "sm:border-s",
              i >= 2 && "sm:border-t xl:border-t-0",
              // 4-col (xl+): every item after the first gets a start hairline
              i > 0 && "xl:border-s",
            )}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <SignalBlock signal={s} onOpen={() => navigate(s.target)} />
          </div>
        ))}
      </div>
    </Surface>
  );
}
