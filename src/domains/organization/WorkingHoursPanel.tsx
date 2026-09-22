/**
 * Working hours — Settings → پروفایل آموزشگاه → ساعات کاری.
 *
 * This panel was disabled, with a notice saying the values were not connected to
 * anything and would reset on reload. They are connected now, and each field says
 * what it governs:
 *
 *   the bookable window   a session that starts before it or ends after it is
 *                         warned about when it is written — never refused, because
 *                         a concert that runs late is a legitimate thing to
 *                         schedule and the rule exists to tell the operator, not
 *                         to police them.
 *   closed weekdays       generating sessions skips those days, and reports every
 *                         date it skipped as «روز تعطیل آموزشگاه» so nothing
 *                         disappears silently. Existing sessions are left alone:
 *                         closing a Friday is a decision about the future, while a
 *                         booked lesson is a commitment.
 *
 * As in the rules panel, the fields show the STORED record until somebody types;
 * only the typed overlay is local state.
 */
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useCan } from "@/domains/auth/AuthContext";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/domains/scheduling/weekdays";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { Field, Panel, inputCls } from "@/components/ds/patterns";
import { LoadingState, ErrorState } from "@/components/ds/states";
import { faTime } from "@/lib/format";
import { cn } from "@/utils/cn";
import { useOrganization } from "./useOrganization";
import { DEFAULT_ORGANIZATION_SETTINGS, isTimeOfDay, type WeekdayIndex } from "./types";

export function WorkingHoursPanel() {
  const { notify } = useApp();
  const mayWrite = useCan("settings.write");
  const demoEnvironment = useIsDemoEnvironment();
  const organization = useOrganization();
  const settings = organization.settings;

  const [edits, setEdits] = useState<{ start?: string; end?: string; closed?: WeekdayIndex[] }>({});
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setEdits({});
    setLocalErrors({});
  }, [settings.updatedAt]);

  const start = edits.start ?? settings.workingDayStart;
  const end = edits.end ?? settings.workingDayEnd;
  const closed = edits.closed ?? settings.closedWeekdays;

  const dirty =
    start !== settings.workingDayStart ||
    end !== settings.workingDayEnd ||
    closed.length !== settings.closedWeekdays.length ||
    closed.some((day) => !settings.closedWeekdays.includes(day));

  const toggleDay = (day: WeekdayIndex) => {
    setLocalErrors((prev) => ({ ...prev, closedWeekdays: "" }));
    setEdits((prev) => {
      const current = prev.closed ?? settings.closedWeekdays;
      const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
      return { ...prev, closed: next };
    });
  };

  const save = async () => {
    const errors: Record<string, string> = {};
    if (!isTimeOfDay(start)) errors.workingDayStart = "ساعت شروع باید به شکل HH:mm باشد.";
    if (!isTimeOfDay(end)) errors.workingDayEnd = "ساعت پایان باید به شکل HH:mm باشد.";
    if (closed.length > 6) errors.closedWeekdays = "حداقل یک روز هفته باید روز کاری باشد.";
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) {
      notify({ tone: "warning", title: "ساعات کاری ذخیره نشد", detail: "مقادیر نامعتبر است." });
      return;
    }

    const error = await organization.update({ workingDayStart: start, workingDayEnd: end, closedWeekdays: closed });
    if (error) {
      notify({
        tone: "danger",
        title: "ذخیرهٔ ساعات کاری ناموفق بود",
        detail: error.fields?.workingDayEnd?.[0] ?? error.message,
      });
      return;
    }
    notify({
      tone: "success",
      title: "ساعات کاری ذخیره شد",
      detail: "بازهٔ قابل رزرو و روزهای تعطیل از این لحظه در زمان‌بندی اعمال می‌شود.",
    });
  };

  const resetDefaults = async () => {
    const error = await organization.update({
      workingDayStart: DEFAULT_ORGANIZATION_SETTINGS.workingDayStart,
      workingDayEnd: DEFAULT_ORGANIZATION_SETTINGS.workingDayEnd,
      closedWeekdays: [...DEFAULT_ORGANIZATION_SETTINGS.closedWeekdays],
    });
    notify(
      error
        ? { tone: "danger", title: "بازنشانی ناموفق بود", detail: error.message }
        : { tone: "info", title: "ساعات کاری به پیش‌فرض بازگشت" },
    );
  };

  if (organization.loading) {
    return (
      <Panel title="ساعات کاری">
        <LoadingState label="در حال بارگذاری ساعات کاری…" />
      </Panel>
    );
  }

  return (
    <Panel
      title="ساعات کاری"
      kicker="بازهٔ قابل رزرو و روزهای تعطیل — مبنای هشدارهای زمان‌بندی و تولید جلسات"
      aside={dirty ? <StatusBadge tone="warn" label="ذخیره‌نشده" glyph={false} /> : undefined}
    >
      {organization.error && (
        <div className="mb-4">
          <ErrorState
            title="خواندن ساعات کاری ناموفق بود"
            description={organization.error.message}
            onRetry={organization.reload}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="شروع روز کاری"
          hint="HH:mm"
          error={localErrors.workingDayStart ?? organization.error?.fields?.workingDayStart?.[0]}
        >
          {(control) => (
            <input
              {...control}
              dir="ltr"
              type="time"
              className={cn(inputCls, "nums text-left")}
              value={start}
              disabled={!mayWrite || organization.saving}
              onChange={(event) => setEdits((prev) => ({ ...prev, start: event.target.value }))}
            />
          )}
        </Field>
        <Field
          label="پایان روز کاری"
          hint="HH:mm"
          error={localErrors.workingDayEnd ?? organization.error?.fields?.workingDayEnd?.[0]}
        >
          {(control) => (
            <input
              {...control}
              dir="ltr"
              type="time"
              className={cn(inputCls, "nums text-left")}
              value={end}
              disabled={!mayWrite || organization.saving}
              onChange={(event) => setEdits((prev) => ({ ...prev, end: event.target.value }))}
            />
          )}
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-ink-200">روزهای تعطیل</span>
          <span className="text-[10.5px] text-ink-500">
            {closed.length === 0 ? "همهٔ روزها روزهای کاری‌اند" : closed.map((day) => WEEKDAYS[day]).join("، ")}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((label, index) => {
            const day = index as WeekdayIndex;
            const off = closed.includes(day);
            return (
              <button
                key={label}
                type="button"
                disabled={!mayWrite || organization.saving}
                onClick={() => toggleDay(day)}
                aria-pressed={off}
                aria-label={`${label} — ${off ? "تعطیل" : "روز کاری"}`}
                className={cn(
                  "h-10 min-w-12 rounded-xl border px-2.5 transition-colors",
                  off
                    ? "border-danger-500/40 bg-danger-500/10 text-danger-300"
                    : "border-white/[0.08] bg-white/[0.02] text-ink-200 hover:border-white/[0.16]",
                )}
              >
                <span className="block text-[12px]">{WEEKDAYS_SHORT[index]}</span>
                <span className="block text-[9.5px] text-ink-500">{off ? "تعطیل" : "کاری"}</span>
              </button>
            );
          })}
        </div>
        {localErrors.closedWeekdays && <p className="mt-2 text-[11px] text-danger-400">{localErrors.closedWeekdays}</p>}
      </div>

      <div className="mt-4 space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-[11px] leading-relaxed text-ink-300">
        <p>
          بازهٔ قابل رزرو اکنون{" "}
          <span dir="ltr" className="nums text-ink-100">
            {faTime(settings.workingDayStart)}–{faTime(settings.workingDayEnd)}
          </span>{" "}
          است؛ جلسه‌ای که بیرون از آن ثبت شود، هنگام ذخیره هشدار می‌گیرد اما مسدود نمی‌شود.
        </p>
        <p>
          در «تولید جلسات»، روزهای تعطیل جلسهٔ تازه نمی‌سازند و هر تاریخِ رد شده با دلیل «روز تعطیل آموزشگاه» گزارش
          می‌شود. جلسات از قبل ثبت‌شده دست‌نخورده می‌مانند: لغوِ آنها تصمیمی است که با دلیل ثبت می‌شود، نه اثر جانبیِ یک
          تنظیم.
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" disabled={!mayWrite || organization.saving} onClick={() => void resetDefaults()}>
          <RotateCcw className="size-3.5" /> پیش‌فرض
        </Button>
        <Button variant="primary" disabled={!mayWrite || organization.saving || !dirty} onClick={() => void save()}>
          {organization.saving ? "در حال ذخیره…" : "ذخیرهٔ ساعات کاری"}
        </Button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
        {demoEnvironment
          ? "ساعات کاری بخشی از دادهٔ آموزشگاه است و در همین محیط ذخیره می‌شود."
          : "ذخیرهٔ سراسری ساعات کاری به سرور نیاز دارد؛ تا اتصال endpoint سازمان، این مقادیر روی دادهٔ همین دستگاه اعمال می‌شود."}
      </p>

      {!mayWrite && <p className="mt-2 text-[11px] text-warn-400">برای تغییر ساعات کاری به دسترسی «تنظیمات» نیاز دارید.</p>}
    </Panel>
  );
}
