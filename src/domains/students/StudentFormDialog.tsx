/**
 * Student create/edit dialog.
 *
 * Persistence goes through `StudentRepository` only — the form has no idea
 * whether a demo store or an HTTP API answered. Validation is deliberately
 * duplicated in two places with different jobs: this component gives fast,
 * field-level feedback, while the repository owns the real invariants
 * (national-ID checksum and uniqueness). Repository field errors are merged
 * into the same error map, so a rule the UI cannot check locally still lands
 * on the right input.
 */
import { useMemo } from "react";
import { instrumentLabel, type Instrument } from "@/data/academy";
import { studentStatusLabel, type PaymentStatus, type Student, type StudentStatus } from "@/data/records";
import { nationalIdError, normalizeNationalId } from "@/lib/nationalId";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, inputCls } from "@/components/ds/patterns";
import { getStudentRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { cn } from "@/utils/cn";
import type { CreateStudentInput } from "./types";

interface StudentDraft {
  name: string;
  nationalId: string;
  instrument: Instrument;
  teacherId: string;
  status: StudentStatus;
  phone: string;
  guardian: string;
  age: string;
  level: string;
  sessionsTotal: string;
}

const INSTRUMENTS = Object.keys(instrumentLabel) as Instrument[];
const STATUSES = Object.keys(studentStatusLabel) as StudentStatus[];

function toDraft(student?: Student): StudentDraft {
  return {
    name: student?.name ?? "",
    nationalId: student?.nationalId ?? "",
    instrument: student?.instrument ?? "piano",
    teacherId: student?.teacherId ?? "",
    status: student?.status ?? "active",
    phone: student?.phone ?? "",
    guardian: student?.guardian ?? "",
    age: student ? String(student.age) : "",
    level: student?.level ?? "سطح ۱ · پایه",
    sessionsTotal: student ? String(student.sessionsTotal) : "12",
  };
}

function validate(draft: StudentDraft): FieldErrors<StudentDraft> {
  const errors: FieldErrors<StudentDraft> = {};
  if (draft.name.trim().length < 2) errors.name = "نام هنرجو الزامی است.";

  // The checksum is validated locally so the user is not forced into a
  // round-trip for a typo. Uniqueness is not checkable here — the repository
  // owns it.
  const idError = nationalIdError(draft.nationalId);
  if (idError) errors.nationalId = idError;

  if (!draft.teacherId) errors.teacherId = "انتخاب مدرس الزامی است.";
  if (!/^[0-9۰-۹\s+·-]{6,}$/.test(draft.phone.trim())) errors.phone = "شمارهٔ تماس معتبر نیست.";

  const age = Number(draft.age);
  if (!Number.isInteger(age) || age < 3 || age > 99) errors.age = "سن باید بین ۳ تا ۹۹ باشد.";

  const sessions = Number(draft.sessionsTotal);
  if (!Number.isInteger(sessions) || sessions < 1 || sessions > 200) {
    errors.sessionsTotal = "تعداد جلسات باید بین ۱ تا ۲۰۰ باشد.";
  }
  return errors;
}

export function StudentFormDialog({
  open,
  student,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Present for edit, absent for create. */
  student?: Student;
  onClose: () => void;
  onSaved: (student: Student, mode: "create" | "edit") => void;
}) {
  const editing = student !== undefined;
  const repository = useMemo(() => getStudentRepository(), []);
  // Only active teachers can be assigned to a new student.
  const { items: teachers } = useTeachers({ assignableOnly: true, per_page: 200 });

  const form = useEntityForm<StudentDraft, Student>({
    initial: toDraft(student),
    validate,
    submit: async (draft) => {
      const payload = {
        nationalId: normalizeNationalId(draft.nationalId),
        name: draft.name.trim(),
        instrument: draft.instrument,
        teacherId: draft.teacherId,
        status: draft.status,
        phone: draft.phone.trim(),
        guardian: draft.guardian.trim() || undefined,
        age: Number(draft.age),
        level: draft.level.trim(),
        sessionsTotal: Number(draft.sessionsTotal),
      };
      if (editing) return repository.update(student.id, payload);

      // Fields a new student cannot meaningfully have yet.
      const created: CreateStudentInput = {
        ...payload,
        levelStep: 1,
        payment: "paid" as PaymentStatus,
        sessionsUsed: 0,
        attendance: 100,
        progress: 0,
        since: "امروز",
        lastSeen: "امروز",
        balance: 0,
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
      title={editing ? `ویرایش ${student.name}` : "هنرجوی جدید"}
      description={
        editing
          ? "تغییرات پس از ذخیره در همهٔ بخش‌های مرتبط اعمال می‌شود."
          : "کد ملی الزامی است و باید یکتا و معتبر باشد."
      }
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ تغییرات" : "افزودن هنرجو"}
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
        {/* A persistence failure is stated plainly; the dialog stays open. */}
        {form.formError && !Object.keys(form.errors).length && (
          <p role="alert" className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            {form.formError.message}
          </p>
        )}

        <Field label="نام و نام خانوادگی" error={form.errors.name} required className="sm:col-span-2">
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.name}
              disabled={busy}
              onChange={(e) => form.set("name", e.target.value)}
            />
          )}
        </Field>

        <Field
          label="کد ملی"
          hint="۱۰ رقم"
          error={form.errors.nationalId}
          required
          className="sm:col-span-2"
        >
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              value={form.draft.nationalId}
              disabled={busy}
              onChange={(e) => form.set("nationalId", e.target.value)}
            />
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

        <Field label="مدرس" error={form.errors.teacherId} required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.teacherId}
              disabled={busy}
              onChange={(e) => form.set("teacherId", e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
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
              onChange={(e) => form.set("status", e.target.value as StudentStatus)}
            >
              {STATUSES.map((key) => (
                <option key={key} value={key}>
                  {studentStatusLabel[key]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="سن" error={form.errors.age} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              value={form.draft.age}
              disabled={busy}
              onChange={(e) => form.set("age", e.target.value)}
            />
          )}
        </Field>

        <Field label="شمارهٔ تماس" error={form.errors.phone} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              dir="ltr"
              value={form.draft.phone}
              disabled={busy}
              onChange={(e) => form.set("phone", e.target.value)}
            />
          )}
        </Field>

        <Field label="ولی / سرپرست" hint="اختیاری">
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.guardian}
              disabled={busy}
              onChange={(e) => form.set("guardian", e.target.value)}
            />
          )}
        </Field>

        <Field label="سطح">
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.level}
              disabled={busy}
              onChange={(e) => form.set("level", e.target.value)}
            />
          )}
        </Field>

        <Field label="کل جلسات دوره" error={form.errors.sessionsTotal} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              value={form.draft.sessionsTotal}
              disabled={busy}
              onChange={(e) => form.set("sessionsTotal", e.target.value)}
            />
          )}
        </Field>

        {/* Enter submits, matching the primary button. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
