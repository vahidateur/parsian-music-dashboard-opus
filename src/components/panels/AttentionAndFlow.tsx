import { useState } from "react";
import { Clock3 } from "lucide-react";
import { attentionQueue } from "@/data/records";
import { quickActions, schedule, statusOf, todayFlowIds } from "@/data/academy";
import { useAcademyNow } from "@/domains/shared/clock";
import { faNum, parseTime } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { AlertItem, QuickAction, TimelineEvent } from "@/components/ds/blocks";
import { SectionHeader, Surface } from "@/components/ds/primitives";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/* نیازمند توجه                                                         */
/* ------------------------------------------------------------------ */
export function Attention({ className }: { className?: string }) {
  const { navigate } = useApp();
  const [showAll, setShowAll] = useState(false);
  const critical = attentionQueue.filter((a) => a.severity === "critical").length;
  const visible = showAll ? attentionQueue : attentionQueue.slice(0, 4);
  return (
    <Surface className={cn("flex flex-col p-5", className)} aria-labelledby="attention-title">
      <SectionHeader
        title={<span id="attention-title">نیازمند توجه</span>}
        aside={
          <span className="nums inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-danger-500/30 bg-danger-500/10 px-1.5 text-[11px] font-semibold text-danger-400">
            {faNum(attentionQueue.length)}
          </span>
        }
        kicker={`${faNum(critical)} مورد فوری · هر مورد یک اقدام مشخص دارد`}
        action={showAll ? "نمایش کمتر" : "مشاهده همه"}
        onAction={() => setShowAll((v) => !v)}
      />
      <ul className="stagger mt-4 -mx-1 flex flex-1 flex-col gap-0.5">
        {visible.map((item) => (
          <li key={item.id}>
            <AlertItem
              item={{ id: item.id, severity: item.severity, title: item.what, context: item.why, action: item.action, target: item.target }}
              onOpen={() => navigate(item.target)}
            />
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">
        <Clock3 className="size-3" />
        به‌روزرسانی ۲ دقیقه پیش · اولویت‌بندی خودکار
      </p>
    </Surface>
  );
}

/* ------------------------------------------------------------------ */
/* برنامه امروز — Today's flow                                          */
/* ------------------------------------------------------------------ */
export function TodayFlow({ className }: { className?: string }) {
  const { navigate } = useApp();
  const now = useAcademyNow();
  const flow = todayFlowIds.map((id) => schedule.find((s) => s.id === id)!).filter(Boolean);
  const nextId = schedule
    .filter((s) => !s.cancelled && !s.conflict && parseTime(s.start) > now)
    .sort((a, b) => parseTime(a.start) - parseTime(b.start))[0]?.id;
  const total = schedule.filter((s) => !s.cancelled).length;
  const remaining = schedule.filter((s) => !s.cancelled && parseTime(s.start) > now).length;
  const cancelled = schedule.filter((s) => s.cancelled).length;

  return (
    <Surface className={cn("flex flex-col p-5", className)} aria-labelledby="flow-title">
      <SectionHeader
        title={<span id="flow-title">برنامه امروز</span>}
        kicker={`${faNum(total)} کلاس · ${faNum(remaining)} کلاس باقی‌مانده · ${faNum(cancelled)} لغو`}
        action="مشاهده تقویم کامل"
        onAction={() => navigate({ view: "schedule" })}
      />
      <ol className="stagger mt-5 flex-1">
        {flow.map((s, i) => {
          const base = statusOf(s);
          const status = base === "scheduled" && s.id === nextId ? "next" : base;
          return (
            <TimelineEvent
              key={s.id}
              session={s}
              status={status}
              isLast={i === flow.length - 1}
              onOpen={() => navigate({ view: "classes" })}
              onResolve={() => navigate({ view: "schedule", filter: "conflict" })}
            />
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => navigate({ view: "schedule" })}
        className="mt-4 w-full rounded-xl border border-white/[0.06] bg-white/[0.02] py-2 text-xs text-ink-300 transition-colors hover:border-white/[0.12] hover:text-ink-50"
      >
        و {faNum(total - flow.filter((f) => !f.cancelled).length)} کلاس دیگر تا پایان روز
      </button>
    </Surface>
  );
}

/* ------------------------------------------------------------------ */
/* اقدامات سریع                                                          */
/* ------------------------------------------------------------------ */
export function QuickActions({ className }: { className?: string }) {
  const { openSheet } = useApp();
  return (
    <div className={cn("flex items-center gap-3", className)} aria-label="اقدامات سریع">
      <span className="hidden shrink-0 text-xs text-ink-400 sm:inline">اقدامات سریع</span>
      <div className="no-scrollbar -mx-1 flex flex-1 gap-2 overflow-x-auto px-1 py-1">
        {quickActions.map((a) => (
          <QuickAction key={a.id} label={a.label} hint={a.hint} onClick={() => openSheet(a.id)} />
        ))}
      </div>
    </div>
  );
}
