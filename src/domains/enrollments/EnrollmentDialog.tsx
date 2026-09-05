/**
 * Enroll a student into a class.
 *
 * All rules (capacity, duplicate enrollment, archived class) are enforced by
 * `EnrollmentRepository`. This dialog only *previews* remaining seats so the
 * user can choose between a seat and the waitlist; it never decides. If the
 * repository rejects the write, the reason is shown and nothing claims to
 * have succeeded.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, inputCls } from "@/components/ds/patterns";
import { getEnrollmentRepository } from "@/domains/registry";
import { useClasses } from "@/domains/classes/useClasses";
import { useStudentList } from "@/domains/students/useStudents";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import type { Enrollment } from "./types";

export function EnrollmentDialog({
  open,
  /** Pre-selected class when opened from a class detail. */
  classId,
  /** Pre-selected student when opened from a student detail. */
  studentId,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  classId?: string;
  studentId?: string;
  onClose: () => void;
  onEnrolled: (enrollment: Enrollment) => void;
}) {
  const repository = useMemo(() => getEnrollmentRepository(), []);
  const { items: classes } = useClasses({ per_page: 200 });
  const { students } = useStudentList({ per_page: 500 });

  const [selectedStudent, setSelectedStudent] = useState(studentId ?? "");
  const [selectedClass, setSelectedClass] = useState(classId ?? "");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const target = classes.find((c) => c.id === selectedClass);
  const seatsLeft = target ? target.capacity - target.enrolled : undefined;
  const full = seatsLeft !== undefined && seatsLeft <= 0;

  const submit = async (status: "active" | "waitlist") => {
    if (!selectedStudent || !selectedClass) {
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const enrollment = await repository.enroll({
        studentId: selectedStudent,
        classId: selectedClass,
        status,
      });
      onEnrolled(enrollment);
      onClose();
    } catch (cause) {
      setError(apiErrorFromThrown(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="ثبت‌نام هنرجو در کلاس"
      description="ظرفیت و ثبت‌نام تکراری توسط دامنه بررسی می‌شود."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          {full && (
            <Button variant="subtle" onClick={() => void submit("waitlist")} disabled={busy || !selectedStudent || !selectedClass}>
              {busy ? "…" : "افزودن به لیست انتظار"}
            </Button>
          )}
          <Button variant="primary" onClick={() => void submit("active")} disabled={busy || full || !selectedStudent || !selectedClass}>
            {busy ? "در حال ثبت…" : "ثبت‌نام"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        {error && (
          <p role="alert" className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            {error.message}
          </p>
        )}

        <Field label="هنرجو" required>
          {(control) => (
            <select {...control} className={inputCls} value={selectedStudent} disabled={busy} onChange={(e) => setSelectedStudent(e.target.value)}>
              <option value="">— انتخاب کنید —</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="کلاس" required>
          {(control) => (
            <select {...control} className={inputCls} value={selectedClass} disabled={busy} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">— انتخاب کنید —</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.title}
                </option>
              ))}
            </select>
          )}
        </Field>

        {target && (
          <p className={full ? "text-[12px] text-warn-400" : "text-[12px] text-ink-300"}>
            {full
              ? "این کلاس ظرفیت خالی ندارد؛ فقط افزودن به لیست انتظار ممکن است."
              : `ظرفیت باقی‌مانده: ${seatsLeft} از ${target.capacity}`}
          </p>
        )}
      </div>
    </Dialog>
  );
}
