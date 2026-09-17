import { useState } from "react";
import { Clock3 } from "lucide-react";
import type { AttentionItem, QuickActionDef } from "@/lib/viewContracts";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { AlertItem, QuickAction, TimelineEvent } from "@/components/ds/blocks";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { SectionHeader, Surface } from "@/components/ds/primitives";
import type { DashboardCounts, FlowRow, FlowSummary } from "@/domains/shared/dashboardInsights";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/* نیازمند توجه                                                         */
/* ------------------------------------------------------------------ */
/**
 * M9/H4: the queue is derived from stored rows by `useDashboardInsights` — an
 * overdue payment, a waitlist, an at-risk student, a cancellation in the last
 * seven days. The header count and the footer source line are the same rows.
 *
 * The footer used to read «به‌روزرسانی ۲ دقیقه پیش · اولویت‌بندی خودکار»: a
 * refresh instant nothing recorded and a priority engine that does not exist.
 */
export function Attention({
  items,
  counts,
  hasRecords,
  loading,
  className,
}: {
  items: AttentionItem[];
  counts: DashboardCounts;
  hasRecords: boolean;
  loading?: boolean;
  className?: string;
}) {
  const { navigate } = useApp();
  const [showAll, setShowAll] = useState(false);
  const critical = items.filter((item) => item.severity === "critical").length;
  const visible = showAll ? items : items.slice(0, 4);

  return (
    <Surface className={cn("flex flex-col p-5", className)} aria-labelledby="attention-title">
      <SectionHeader
        title={<span id="attention-title">نیازمند توجه</span>}
        aside={
          <span className="nums inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-danger-500/30 bg-danger-500/10 px-1.5 text-[11px] font-semibold text-danger-400">
            {faNum(items.length)}
          </span>
        }
        kicker={
          items.length > 0
            ? `${faNum(critical)} مورد فوری · هر مورد یک اقدام مشخص دارد`
            : `${faNum(counts.records)} رکورد بررسی شد`
        }
        action={items.length > 4 ? (showAll ? "نمایش کمتر" : "مشاهده همه") : undefined}
        onAction={items.length > 4 ? () => setShowAll((v) => !v) : undefined}
      />
      {loading ? (
        <LoadingState label="در حال خواندن رکوردها…" className="py-10" />
      ) : visible.length > 0 ? (
        <ul className="stagger mt-4 -mx-1 flex flex-1 flex-col gap-0.5">
          {visible.map((item) => (
            <li key={item.id}>
              <AlertItem item={item} onOpen={() => navigate(item.target)} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="mt-4 px-0 py-8"
          title={hasRecords ? "موردی برای توجه نیست" : "داده‌ای نیست"}
          description={
            hasRecords
              ? "رکوردهای فعلی هیچ موردی از چهار قاعدهٔ این پنل را فعال نکرده‌اند."
              : "هنوز رکوردی در این محیط ثبت نشده است؛ این فهرست از پرداخت‌ها، لیست‌های انتظار و تقویم ساخته می‌شود."
          }
        />
      )}
      <p className="nums mt-4 flex items-center gap-1.5 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">
        <Clock3 className="size-3" />
        منبع: {faNum(counts.students)} رکورد هنرجو · {faNum(counts.classes)} کلاس · {faNum(counts.sessions)} جلسهٔ خوانده‌شده
      </p>
    </Surface>
  );
}

/* ------------------------------------------------------------------ */
/* برنامه امروز — Today's flow                                          */
/* ------------------------------------------------------------------ */
/**
 * M9/H4: today's rows are stored sessions, labelled from the class, room and
 * teacher they point at, and the status of each one is derived (`deriveFlowRows`)
 * rather than read from a fixture flag.
 */
export function TodayFlow({
  rows,
  summary,
  hasRecords,
  loading,
  className,
}: {
  rows: FlowRow[];
  summary: FlowSummary;
  hasRecords: boolean;
  loading?: boolean;
  className?: string;
}) {
  const { navigate } = useApp();
  const rest = summary.total - summary.shown;

  return (
    <Surface className={cn("flex flex-col p-5", className)} aria-labelledby="flow-title">
      <SectionHeader
        title={<span id="flow-title">برنامه امروز</span>}
        kicker={
          summary.total > 0
            ? `${faNum(summary.total)} جلسه · ${faNum(summary.remaining)} باقی‌مانده · ${faNum(summary.cancelled)} لغو`
            : "امروز"
        }
        action="مشاهده تقویم کامل"
        onAction={() => navigate({ view: "schedule" })}
      />
      {loading ? (
        <LoadingState label="در حال خواندن تقویم…" className="py-10" />
      ) : rows.length > 0 ? (
        <ol className="stagger mt-5 flex-1">
          {rows.map((row, i) => (
            <TimelineEvent
              key={row.session.id}
              session={row.session}
              status={row.status}
              isLast={i === rows.length - 1}
              onOpen={() => navigate({ view: "classes" })}
              onResolve={() => navigate({ view: "schedule", filter: "conflict" })}
            />
          ))}
        </ol>
      ) : (
        <EmptyState
          className="mt-4 py-8"
          title={hasRecords ? "امروز جلسه‌ای ثبت نشده" : "داده‌ای نیست"}
          description={
            hasRecords
              ? "برای امروز در تقویم جلسه‌ای ذخیره نشده است."
              : "هنوز جلسه‌ای در این محیط برنامه‌ریزی نشده است."
          }
        />
      )}
      {rest > 0 && (
        <button
          type="button"
          onClick={() => navigate({ view: "schedule" })}
          className="nums mt-4 w-full rounded-xl border border-white/[0.06] bg-white/[0.02] py-2 text-xs text-ink-300 transition-colors hover:border-white/[0.12] hover:text-ink-50"
        >
          و {faNum(rest)} جلسهٔ دیگر در تقویم امروز
        </button>
      )}
    </Surface>
  );
}

/* ------------------------------------------------------------------ */
/* اقدامات سریع                                                          */
/* ------------------------------------------------------------------ */
/**
 * Quick actions are UI affordances, not measurements: the ids open the action
 * sheets `AppContext` renders, and the labels name what those sheets do.
 *
 * M9 moved them here from `@/data/academy`'s `quickActions` fixture, which also
 * carried each sheet's form fields and a hardcoded list of instrument and teacher
 * names — the field definitions stay in `ActionSheet.tsx` where the sheet is
 * built, and this list carries no figure at all.
 */
const QUICK_ACTIONS: { id: QuickActionDef["id"]; label: string; hint: string }[] = [
  { id: "student", label: "افزودن هنرجو", hint: "ثبت‌نام جدید" },
  { id: "class", label: "برنامه‌ریزی کلاس", hint: "بازهٔ زمانی جدید" },
  { id: "payment", label: "ثبت پرداخت", hint: "شهریه یا جلسه" },
  { id: "message", label: "ارسال پیام", hint: "به هنرجو یا مدرس" },
];

export function QuickActions({ className }: { className?: string }) {
  const { openSheet } = useApp();
  return (
    <div className={cn("flex items-center gap-3", className)} aria-label="اقدامات سریع">
      <span className="hidden shrink-0 text-xs text-ink-400 sm:inline">اقدامات سریع</span>
      <div className="no-scrollbar -mx-1 flex flex-1 gap-2 overflow-x-auto px-1 py-1">
        {QUICK_ACTIONS.map((action) => (
          <QuickAction key={action.id} label={action.label} hint={action.hint} onClick={() => openSheet(action.id)} />
        ))}
      </div>
    </div>
  );
}
