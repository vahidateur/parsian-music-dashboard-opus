/**
 * Class create/edit dialog, persisting through `ClassRepository`.
 *
 * Teacher and room options come from their own repositories filtered to
 * assignable records, so a teacher created moments ago is immediately
 * selectable and a deactivated one disappears. The repository re-checks both
 * on write — the filtered dropdown is a convenience, never the enforcement.
 *
 * `studentIds`/`enrolled`/`waitlist` are intentionally absent: enrollment is
 * the authoritative Student↔Class relationship and is managed separately.
 */
import { useMemo } from "react";
import { instrumentLabel, type Instrument } from "@/data/academy";
import { WEEKDAYS, type AcademyClass } from "@/data/records";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, inputCls } from "@/components/ds/patterns";
import { getClassRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { useRooms } from "@/domains/rooms/useRooms";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { cn } from "@/utils/cn";
import type { CreateClassInput } from "./types";

interface ClassDraft {
  title: string;
  instrument: Instrument;
  teacherId: string;
  roomId: string;
  kind: AcademyClass["kind"];
  level: string;
  days: number[];
  time: string;
  duration: string;
  capacity: string;
  tuition: string;
  archived: boolean;
}

const INSTRUMENTS = Object.keys(instrumentLabel) as Instrument[];

function toDraft(cls?: AcademyClass): ClassDraft {
  return {
    title: cls?.title ?? "",
    instrument: cls?.instrument ?? "piano",
    teacherId: cls?.teacherId ?? "",
    roomId: cls?.roomId ?? "",
    kind: cls?.kind ?? "group",
    level: cls?.level ?? "سطح ۱",
    days: cls?.days ?? [],
    time: cls?.time ?? "17:00",
    duration: cls ? String(cls.duration) : "60",
    capacity: cls ? String(cls.capacity) : "6",
    tuition: cls ? String(cls.tuition) : "3000000",
  archived: cls?.status === "archived",
  };
}

function validate(draft: ClassDraft): FieldErrors<ClassDraft> {
  const errors: FieldErrors<ClassDraft> = {};
  if (draft.title.trim().length < 2) errors.title = "عنوان کلاس الزامی است.";
  if (!draft.teacherId) errors.teacherId = "انتخاب مدرس الزامی است.";
  if (!draft.roomId) errors.roomId = "انتخاب اتاق الزامی است.";
  if (draft.days.length === 0) errors.days = "حداقل یک روز هفته را انتخاب کنید.";
  if (!/^\d{1,2}:\d{2}$/.test(draft.time)) errors.time = "ساعت باید به شکل ۱۷:۰۰ باشد.";

  const duration = Number(draft.duration);
  if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
    errors.duration = "مدت جلسه باید بین ۱۵ تا ۲۴۰ دقیقه باشد.";
  }
  const capacity = Number(draft.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    errors.capacity = "ظرفیت باید بین ۱ تا ۵۰۰ باشد.";
  }
  const tuition = Number(draft.tuition);
  if (!Number.isFinite(tuition) || tuition < 0) errors.tuition = "شهریه نمی‌تواند منفی باشد.";
  return errors;
}

export function ClassFormDialog({
  open,
  academyClass,
  onClose,
  onSaved,
}: {
  open: boolean;
  academyClass?: AcademyClass;
  onClose: () => void;
  onSaved: (cls: AcademyClass, mode: "create" | "edit") => void;
}) {
  const editing = academyClass !== undefined;
  const repository = useMemo(() => getClassRepository(), []);
  const { items: teachers } = useTeachers({ assignableOnly: true, per_page: 200 });
  const { items: rooms } = useRooms({ assignableOnly: true, per_page: 200 });

  const form = useEntityForm<ClassDraft, AcademyClass>({
    initial: toDraft(academyClass),
    validate,
    submit: async (draft) => {
      const payload = {
        title: draft.title.trim(),
        instrument: draft.instrument,
        teacherId: draft.teacherId,
        roomId: draft.roomId,
        kind: draft.kind,
        level: draft.level.trim(),
        days: [...draft.days].sort((a, b) => a - b),
        time: draft.time,
        duration: Number(draft.duration),
        capacity: Number(draft.capacity),
        tuition: Number(draft.tuition),
        status: draft.archived ? ("archived" as const) : ("active" as const),
      };
      if (editing) return repository.update(academyClass.id, payload);

      const created: CreateClassInput = {
        ...payload,
        attendanceAvg: 0,
        termProgress: 0,
      };
      return repository.create(created);
    },
    onSuccess: (saved) => {
      onSaved(saved, editing ? "edit" : "create");
      onClose();
    },
  });

  if (!open) return null;
  const busy = form.submitting;

  const toggleDay = (index: number) => {
    const next = form.draft.days.includes(index)
      ? form.draft.days.filter((d) => d !== index)
      : [...form.draft.days, index];
    form.set("days", next);
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={editing ? `ویرایش ${academyClass.title}` : "کلاس جدید"}
      description="فقط مدرسان و اتاق‌های فعال قابل انتخاب‌اند. ظرفیت کلاس نمی‌تواند از ظرفیت اتاق بیشتر باشد."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ تغییرات" : "افزودن کلاس"}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        {form.formError && !Object.keys(form.errors).length && (
          <p role="alert" className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            {form.formError.message}
          </p>
        )}

        <Field label="عنوان کلاس" error={form.errors.title} required className="sm:col-span-2">
          {(control) => (
            <input {...control} className={inputCls} value={form.draft.title} disabled={busy} onChange={(e) => form.set("title", e.target.value)} />
          )}
        </Field>

        <Field label="ساز" required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.instrument}
              disabled={busy}
              onChange={(e) => form.set("instrument", e.target.value as Instrument)}
            >
              {INSTRUMENTS.map((key) => (
                <option key={key} value={key}>
                  {instrumentLabel[key]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="نوع کلاس" required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.kind}
              disabled={busy}
              onChange={(e) => form.set("kind", e.target.value as AcademyClass["kind"])}
            >
              <option value="group">گروهی</option>
              <option value="private">انفرادی</option>
            </select>
          )}
        </Field>

        <Field label="مدرس" error={form.errors.teacherId} required>
          {(control) => (
            <select {...control} className={inputCls} value={form.draft.teacherId} disabled={busy} onChange={(e) => form.set("teacherId", e.target.value)}>
              <option value="">— انتخاب کنید —</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="اتاق" error={form.errors.roomId} required>
          {(control) => (
            <select {...control} className={inputCls} value={form.draft.roomId} disabled={busy} onChange={(e) => form.set("roomId", e.target.value)}>
              <option value="">— انتخاب کنید —</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} (ظرفیت {room.capacity})
                </option>
              ))}
            </select>
          )}
        </Field>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-xs font-medium text-ink-200">
            روزهای هفته
            <span className="ms-1 text-danger-400" aria-hidden>
              *
            </span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day, index) => {
              const selected = form.draft.days.includes(index);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => toggleDay(index)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors",
                    selected
                      ? "border-gold-500/40 bg-gold-500/15 text-gold-300"
                      : "border-white/[0.08] text-ink-300 hover:bg-white/[0.05]",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {form.errors.days && (
            <p role="alert" className="mt-1.5 text-[11px] text-danger-400">
              {form.errors.days}
            </p>
          )}
        </fieldset>

        <Field label="ساعت شروع" error={form.errors.time} required>
          {(control) => (
            <input {...control} className={cn(inputCls, "nums")} dir="ltr" value={form.draft.time} disabled={busy} onChange={(e) => form.set("time", e.target.value)} />
          )}
        </Field>

        <Field label="مدت (دقیقه)" error={form.errors.duration} required>
          {(control) => (
            <input {...control} className={cn(inputCls, "nums")} inputMode="numeric" value={form.draft.duration} disabled={busy} onChange={(e) => form.set("duration", e.target.value)} />
          )}
        </Field>

        <Field label="ظرفیت" error={form.errors.capacity} required>
          {(control) => (
            <input {...control} className={cn(inputCls, "nums")} inputMode="numeric" value={form.draft.capacity} disabled={busy} onChange={(e) => form.set("capacity", e.target.value)} />
          )}
        </Field>

        <Field label="شهریه (تومان)" error={form.errors.tuition} required>
          {(control) => (
            <input {...control} className={cn(inputCls, "nums")} inputMode="numeric" value={form.draft.tuition} disabled={busy} onChange={(e) => form.set("tuition", e.target.value)} />
          )}
        </Field>

        <Field label="سطح">
          {(control) => (
            <input {...control} className={inputCls} value={form.draft.level} disabled={busy} onChange={(e) => form.set("level", e.target.value)} />
          )}
        </Field>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
