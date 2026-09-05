/**
 * Teacher create/edit dialog, persisting through `TeacherRepository`.
 *
 * Workload figures (`students`, `utilization`, `weeklyHours`) are derived
 * operational data, not user input, so they are not editable here — a new
 * teacher starts at zero and the numbers move as classes are assigned.
 */
import { useMemo } from "react";
import { instrumentLabel, type Instrument } from "@/data/academy";
import type { Teacher } from "@/data/records";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, inputCls } from "@/components/ds/patterns";
import { getTeacherRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { cn } from "@/utils/cn";
import type { CreateTeacherInput, TeacherStatus } from "./types";

interface TeacherDraft {
  name: string;
  instrument: Instrument;
  title: string;
  phone: string;
  status: TeacherStatus;
  contractHours: string;
  bio: string;
}

const INSTRUMENTS = Object.keys(instrumentLabel) as Instrument[];

const STATUS_LABELS: Record<TeacherStatus, string> = {
  active: "فعال",
  "absent-tomorrow": "غیبت فردا",
  "light-load": "بار کاری سبک",
  inactive: "غیرفعال",
};

/** An empty 7×4 availability grid (all blocks free) for a new teacher. */
const emptyAvailability = (): number[][] => Array.from({ length: 7 }, () => [0, 0, 0, 0]);

function toDraft(teacher?: Teacher): TeacherDraft {
  return {
    name: teacher?.name ?? "",
    instrument: teacher?.instrument ?? "piano",
    title: teacher?.title ?? "",
    phone: teacher?.phone ?? "",
    status: teacher?.status ?? "active",
    contractHours: teacher ? String(teacher.contractHours) : "20",
    bio: teacher?.bio ?? "",
  };
}

function validate(draft: TeacherDraft): FieldErrors<TeacherDraft> {
  const errors: FieldErrors<TeacherDraft> = {};
  if (draft.name.trim().length < 2) errors.name = "نام مدرس الزامی است.";
  if (draft.title.trim().length < 2) errors.title = "عنوان تخصص الزامی است.";
  if (!/^[0-9۰-۹\s+·-]{6,}$/.test(draft.phone.trim())) errors.phone = "شمارهٔ تماس معتبر نیست.";
  const hours = Number(draft.contractHours);
  if (!Number.isFinite(hours) || hours < 0 || hours > 80) {
    errors.contractHours = "ساعت قرارداد باید بین ۰ تا ۸۰ باشد.";
  }
  return errors;
}

export function TeacherFormDialog({
  open,
  teacher,
  onClose,
  onSaved,
}: {
  open: boolean;
  teacher?: Teacher;
  onClose: () => void;
  onSaved: (teacher: Teacher, mode: "create" | "edit") => void;
}) {
  const editing = teacher !== undefined;
  const repository = useMemo(() => getTeacherRepository(), []);

  const form = useEntityForm<TeacherDraft, Teacher>({
    initial: toDraft(teacher),
    validate,
    submit: async (draft) => {
      const payload = {
        name: draft.name.trim(),
        instrument: draft.instrument,
        title: draft.title.trim(),
        phone: draft.phone.trim(),
        status: draft.status,
        contractHours: Number(draft.contractHours),
        bio: draft.bio.trim(),
      };
      if (editing) return repository.update(teacher.id, payload);

      const created: CreateTeacherInput = {
        ...payload,
        students: 0,
        utilization: 0,
        weeklyHours: 0,
        attendanceRate: 100,
        retention: 100,
        since: "امسال",
        todayClasses: [],
        availability: emptyAvailability(),
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

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={editing ? `ویرایش ${teacher.name}` : "مدرس جدید"}
      description={
        editing
          ? "تغییرات بلافاصله در انتخاب مدرس کلاس‌ها اعمال می‌شود."
          : "مدرس فعال بلافاصله برای تخصیص به کلاس در دسترس قرار می‌گیرد."
      }
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ تغییرات" : "افزودن مدرس"}
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

        <Field label="نام و نام خانوادگی" error={form.errors.name} required className="sm:col-span-2">
          {(control) => (
            <input {...control} className={inputCls} value={form.draft.name} disabled={busy} onChange={(e) => form.set("name", e.target.value)} />
          )}
        </Field>

        <Field label="ساز تخصصی" required>
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

        <Field label="وضعیت" required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.status}
              disabled={busy}
              onChange={(e) => form.set("status", e.target.value as TeacherStatus)}
            >
              {(Object.keys(STATUS_LABELS) as TeacherStatus[]).map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="عنوان / تخصص" error={form.errors.title} required className="sm:col-span-2">
          {(control) => (
            <input {...control} className={inputCls} value={form.draft.title} disabled={busy} onChange={(e) => form.set("title", e.target.value)} />
          )}
        </Field>

        <Field label="شمارهٔ تماس" error={form.errors.phone} required>
          {(control) => (
            <input {...control} className={cn(inputCls, "nums")} dir="ltr" value={form.draft.phone} disabled={busy} onChange={(e) => form.set("phone", e.target.value)} />
          )}
        </Field>

        <Field label="ساعت قرارداد (هفتگی)" error={form.errors.contractHours} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              value={form.draft.contractHours}
              disabled={busy}
              onChange={(e) => form.set("contractHours", e.target.value)}
            />
          )}
        </Field>

        <Field label="یادداشت / معرفی" hint="اختیاری" className="sm:col-span-2">
          {(control) => (
            <textarea
              {...control}
              rows={3}
              className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
              value={form.draft.bio}
              disabled={busy}
              onChange={(e) => form.set("bio", e.target.value)}
            />
          )}
        </Field>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
