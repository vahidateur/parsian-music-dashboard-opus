/**
 * Instruments management panel (Settings → operations).
 *
 * Instruments are academy configuration, so they live alongside rooms rather
 * than getting their own route. Every write goes through
 * `InstrumentRepository`; deletion is refused by the repository when the
 * instrument is still referenced (`INSTRUMENT_IN_USE`), and that refusal is
 * surfaced verbatim rather than swallowed.
 */
import { useState } from "react";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { ListRow, Panel } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getInstrumentRepository } from "@/domains/registry";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { InstrumentFormDialog } from "./InstrumentFormDialog";
import { useInstruments } from "./useInstruments";
import type { InstrumentRecord } from "./types";

export function InstrumentsPanel() {
  const { notify } = useApp();
  const demoEnvironment = useIsDemoEnvironment();
  // Inactive instruments are included: this is where they are managed.
  const { items, loading, error, reload } = useInstruments({ per_page: 200 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InstrumentRecord | undefined>(
    undefined,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleActive = async (instrument: InstrumentRecord) => {
    setBusyId(instrument.id);
    try {
      await getInstrumentRepository().setActive(
        instrument.id,
        !instrument.active,
      );
      notify({
        tone: "success",
        title: instrument.active
          ? `${instrument.name} غیرفعال شد`
          : `${instrument.name} فعال شد`,
        detail: instrument.active
          ? "از فهرست انتخاب‌های جدید کنار گذاشته شد؛ رکوردهای موجود تغییری نمی‌کنند."
          : "اکنون برای هنرجویان و کلاس‌های جدید قابل انتخاب است.",
      });
    } catch (cause) {
      notify({
        tone: "danger",
        title: "تغییر وضعیت انجام نشد",
        detail: apiErrorFromThrown(cause).message,
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (instrument: InstrumentRecord) => {
    setBusyId(instrument.id);
    try {
      await getInstrumentRepository().delete(instrument.id);
      notify({
        tone: "success",
        title: `${instrument.name} حذف شد`,
        detail: "این ساز به هیچ رکوردی متصل نبود.",
      });
    } catch (cause) {
      // Typically INSTRUMENT_IN_USE — the reason is shown, not hidden.
      notify({
        tone: "danger",
        title: "حذف انجام نشد",
        detail: apiErrorFromThrown(cause).message,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      title="سازها و رشته‌ها"
      kicker="فهرست سازهایی که آموزشگاه ارائه می‌دهد"
      action="افزودن ساز"
      onAction={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      {loading ? (
        <LoadingState label="در حال بارگذاری سازها…" />
      ) : error ? (
        <ErrorState
          title="بارگذاری سازها ناموفق بود"
          description={error.message}
          onRetry={reload}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="هنوز سازی تعریف نشده"
          description="برای ثبت هنرجو و تعریف دوره، حداقل یک ساز لازم است."
          action="افزودن ساز"
          onAction={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((instrument) => (
            <li key={instrument.id}>
              <ListRow
                title={instrument.name}
                meta={instrument.description || instrument.slug}
                end={
                  <span className="flex items-center gap-2">
                    <StatusBadge
                      tone={instrument.active ? "ok" : "neutral"}
                      label={instrument.active ? "فعال" : "غیرفعال"}
                    />
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => {
                        setEditing(instrument);
                        setFormOpen(true);
                      }}
                    >
                      ویرایش
                    </Button>
                    <Button
                      size="sm"
                      variant="subtle"
                      disabled={busyId === instrument.id}
                      onClick={() => void toggleActive(instrument)}
                    >
                      {instrument.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === instrument.id}
                      onClick={() => void remove(instrument)}
                    >
                      حذف
                    </Button>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        {faNum(items.filter((i) => i.active).length)} ساز فعال از{" "}
        {faNum(items.length)} ساز تعریف‌شده. سازی که به هنرجو، کلاس یا دوره متصل
        باشد حذف نمی‌شود؛ به‌جای حذف آن را غیرفعال کنید.
      </p>

      <InstrumentFormDialog
        open={formOpen}
        instrument={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, mode) =>
          notify({
            tone: "success",
            title:
              mode === "create"
                ? `${saved.name} افزوده شد`
                : `${saved.name} به‌روزرسانی شد`,
            // The dialog awaited a real repository write, so the confirmation
            // may only call it demo data where it is demo data: in an EMPTY
            // environment this is the academy's own instrument catalogue (H7 —
            // the defect M2 fixed in the five domain views, in Settings too).
            detail: demoEnvironment ? "تغییرات در دادهٔ دمو ذخیره شد." : "تغییرات در داده‌ها ذخیره شد.",
          })
        }
      />
    </Panel>
  );
}
