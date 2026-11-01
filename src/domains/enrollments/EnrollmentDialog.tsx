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
import { Dialog, Field, SearchInput, inputCls } from "@/components/ds/patterns";
import { getEnrollmentRepository } from "@/domains/registry";
import { useClasses } from "@/domains/classes/useClasses";
import { useStudentList } from "@/domains/students/useStudents";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import type { Enrollment } from "./types";
import type { AcademyClass } from "@/domains/classes/types";
import { faNum } from "@/lib/format";
import { cn } from "@/utils/cn";

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
  /*
    I16 — both pickers are SERVER-SIDE searches.

    They asked for 200 classes and 500 students in one page and rendered them as
    if complete, so a record past the page could not be enrolled at all, with no
    hint the list was short. Both contracts carry `search`, so each picker now
    queries 50 rows and lets the operator narrow. A chosen row survives a new
    query (it would otherwise vanish from the `<select>` and the form would keep
    an id no visible option carries), and `total` says when the page is a slice.
  */
  const [studentQuery, setStudentQuery] = useState("");
  const [classQuery, setClassQuery] = useState("");
  const studentSearch = studentQuery.trim();
  const classSearch = classQuery.trim();
  const {
    items: classItems,
    total: classesTotal,
    loading: classesLoading,
    error: classesError,
    reload: reloadClasses,
  } = useClasses({ ...(classSearch ? { search: classSearch } : {}), per_page: 50 });
  const {
    students,
    total: studentsTotal,
    loading: studentsLoading,
    error: studentsError,
    reload: reloadStudents,
  } = useStudentList({ ...(studentSearch ? { search: studentSearch } : {}), per_page: 50 });

  const [selectedStudent, setSelectedStudent] = useState(studentId ?? "");
  const [selectedClass, setSelectedClass] = useState(classId ?? "");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedStudentRow, setSelectedStudentRow] = useState<{ id: string; name: string } | null>(null);
  const [selectedClassRow, setSelectedClassRow] = useState<AcademyClass | null>(null);
  const studentOptions = useMemo(() => {
    if (!selectedStudentRow || students.some((student) => student.id === selectedStudentRow.id)) return students;
    return [selectedStudentRow, ...students];
  }, [students, selectedStudentRow]);
  const classOptions = useMemo(() => {
    if (!selectedClassRow || classItems.some((cls) => cls.id === selectedClassRow.id)) return classItems;
    return [selectedClassRow, ...classItems];
  }, [classItems, selectedClassRow]);
  const target = classOptions.find((c) => c.id === selectedClass);
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

        {classesError && (
          <p role="alert" className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            بارگذاری کلاس‌ها ناموفق بود: {classesError.message}{" "}
            <button type="button" className="underline" onClick={reloadClasses}>
              تلاش دوباره
            </button>
          </p>
        )}
        {studentsError && (
          <p role="alert" className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            بارگذاری هنرجویان ناموفق بود: {studentsError.message}{" "}
            <button type="button" className="underline" onClick={reloadStudents}>
              تلاش دوباره
            </button>
          </p>
        )}

        <Field label="هنرجو" required>
          {(control) => (
            <div>
              <SearchInput value={studentQuery} onChange={setStudentQuery} placeholder="جست‌وجوی نام یا تلفن هنرجو…" />
              <select
                {...control}
                className={cn(inputCls, "mt-2")}
                value={selectedStudent}
                disabled={busy || studentsLoading || Boolean(studentsError)}
                onChange={(e) => {
                  const chosen = studentOptions.find((student) => student.id === e.target.value);
                  setSelectedStudent(e.target.value);
                  setSelectedStudentRow(chosen ? { id: chosen.id, name: chosen.name } : null);
                }}
              >
                <option value="">{studentsLoading ? "در حال بارگذاری هنرجویان…" : studentsError ? "بارگذاری هنرجویان ناموفق بود" : "— انتخاب کنید —"}</option>
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              {!studentsLoading && !studentsError && studentsTotal > students.length ? (
                <p className="mt-1.5 text-[11px] text-ink-500">
                  {faNum(students.length)} از {faNum(studentsTotal)} — برای دیدن بقیه، جست‌وجو را محدود کنید.
                </p>
              ) : null}
            </div>
          )}
        </Field>

        <Field label="کلاس" required>
          {(control) => (
            <div>
              <SearchInput value={classQuery} onChange={setClassQuery} placeholder="جست‌وجوی نام کلاس…" />
              <select
                {...control}
                className={cn(inputCls, "mt-2")}
                value={selectedClass}
                disabled={busy || classesLoading || Boolean(classesError)}
                onChange={(e) => {
                  const chosen = classOptions.find((cls) => cls.id === e.target.value);
                  setSelectedClass(e.target.value);
                  setSelectedClassRow(chosen ?? null);
                }}
              >
                <option value="">{classesLoading ? "در حال بارگذاری کلاس‌ها…" : classesError ? "بارگذاری کلاس‌ها ناموفق بود" : "— انتخاب کنید —"}</option>
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.title}
                  </option>
                ))}
              </select>
              {!classesLoading && !classesError && classesTotal > classItems.length ? (
                <p className="mt-1.5 text-[11px] text-ink-500">
                  {faNum(classItems.length)} از {faNum(classesTotal)} — برای دیدن بقیه، جست‌وجو را محدود کنید.
                </p>
              ) : null}
            </div>
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
