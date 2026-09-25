import { AlertItem } from "@/components/ds/blocks";
import { SectionHeader, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import { EmptyState, LoadingState } from "@/components/ds/states";
import type { DeskStudent, TeachingSignal, TeachingSignalKind } from "@/domains/shared/teacherDesk";
import { TEACHING_SIGNAL_LABEL } from "@/domains/shared/teacherDesk";
import { instrumentName } from "@/domains/instruments/catalog";
import { faNum } from "@/lib/format";
import type { AttentionItem } from "@/lib/viewContracts";
import { cn } from "@/utils/cn";

/** How many pieces one roster row names before it starts counting. */
const PIECES_SHOWN = 3;
/** How many signals the attention list names before the footer counts them. */
const SIGNALS_SHOWN = 6;

const SIGNAL_SEVERITY: Record<TeachingSignalKind, AttentionItem["severity"]> = {
  regression: "critical",
  target_passed: "warning",
  possible_plateau: "warning",
  absence: "warning",
  no_assignment: "warning",
  slowing: "info",
  no_evidence: "info",
};

/** The teaching-equivalent of a progress chip: label, and the measure behind it. */
function pieceChip(student: DeskStudent, index: number) {
  const piece = student.pieces[index];
  return (
    <span
      key={piece.assignmentId}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] leading-5",
        piece.overdue ? "border-warn-500/25 bg-warn-500/[0.07] text-warn-400" : "border-white/[0.07] bg-white/[0.02] text-ink-300",
      )}
    >
      <span className="max-w-[9rem] truncate">{piece.pieceTitle}</span>
      <span className="text-ink-500">·</span>
      <span>{piece.progressLabel}</span>
      <span className="text-ink-500">·</span>
      {/* Mastery is a recorded measurement or nothing — never a default of zero. */}
      <span className="nums">{piece.mastery === null ? "—" : `${faNum(piece.mastery)}٪`}</span>
    </span>
  );
}

/**
 * The students this teacher actually teaches.
 *
 * The list is the assigned set and nothing else — the scope functions own the
 * rule, and when the account has no linked teacher record the panel renders a
 * blocked state rather than the organization's roster. `Student.payment`,
 * `Student.balance` and `Student.status` are not rendered here: what a teacher
 * needs about a student is what the student is working on and when it was last
 * measured.
 */
export function MyStudentsRoster({
  students,
  loading,
  resolved,
  onOpenStudent,
  onOpenStudents,
  className,
}: {
  students: DeskStudent[];
  loading: boolean;
  resolved: boolean;
  onOpenStudent: (studentId: string) => void;
  onOpenStudents: () => void;
  className?: string;
}) {
  const withPieces = students.filter((row) => row.pieces.length > 0).length;
  const kicker = !resolved
    ? "پروندهٔ استاد به این حساب متصل نیست"
    : loading
      ? "در حال خواندن هنرجویان…"
      : students.length === 0
        ? "هنرجویی به شما سپرده نشده"
        : `${faNum(students.length)} هنرجو · ${faNum(withPieces)} با تکلیف فعال`;

  return (
    <Surface className={cn("flex h-full flex-col p-5", className)}>
      <SectionHeader title="هنرجویان من" kicker={kicker} action="همهٔ هنرجویان" onAction={onOpenStudents} />
      {!resolved ? (
        <EmptyState
          className="mt-2"
          title="فهرست هنرجویان در دسترس نیست"
          description="حساب شما به پروندهٔ استاد متصل نیست، و فهرست سراسری آموزشگاه جای این فهرست نیست."
        />
      ) : loading ? (
        <LoadingState label="در حال خواندن هنرجویان…" />
      ) : students.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="هنرجویی به شما سپرده نشده"
          description="هنرجو از راه ثبت‌نام فعال در کلاس‌های شما به شما سپرده می‌شود."
        />
      ) : (
        <ul className="mt-2 flex max-h-[26rem] flex-col divide-y divide-white/[0.05] overflow-y-auto">
          {students.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => onOpenStudent(student.id)}
                className="group flex w-full items-start gap-3 py-3 text-right transition-colors hover:bg-white/[0.02]"
              >
                <span
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/[0.07] text-sm font-semibold text-gold-300"
                  aria-hidden
                >
                  {student.name.trim().charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-50 group-hover:text-gold-200">
                      {student.name}
                    </span>
                    {student.absences > 0 && (
                      <StatusBadge tone="warn" label={`${faNum(student.absences)} غیبت`} />
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-300">
                    {instrumentName(student.instrument)} · {student.level}
                  </span>
                  {student.pieces.length > 0 ? (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {student.pieces.slice(0, PIECES_SHOWN).map((_, index) => pieceChip(student, index))}
                      {student.pieces.length > PIECES_SHOWN && (
                        <span className="text-[10.5px] leading-5 text-ink-400">
                          +{faNum(student.pieces.length - PIECES_SHOWN)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="mt-1.5 block text-[11px] text-ink-400">
                      تکلیف فعالی برای این هنرجو ثبت نشده
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

/**
 * What deserves the teacher's attention — educational evidence only.
 *
 * Every row comes from the progress log, an assignment's own target date, or
 * this teacher's registers. The student's billing state is deliberately absent:
 * in the seeded academy «در معرض ریزش» travels beside «بدهی», so a list built on
 * `Student.status`/`payment`/`balance` would be a collections list wearing a
 * teaching label. When the evidence reads are incomplete the panel says the list
 * is withheld rather than showing a short one as if it were the whole truth.
 */
export function TeacherAttentionList({
  signals,
  loading,
  progressEvidence,
  onOpenStudent,
  className,
}: {
  signals: TeachingSignal[];
  loading: boolean;
  progressEvidence: boolean;
  onOpenStudent: (studentId: string) => void;
  className?: string;
}) {
  const items: AttentionItem[] = signals.slice(0, SIGNALS_SHOWN).map((signal) => ({
    id: signal.id,
    severity: SIGNAL_SEVERITY[signal.kind],
    title: signal.studentName,
    context: [TEACHING_SIGNAL_LABEL[signal.kind], signal.pieceTitle, signal.detail]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    action: "پروندهٔ هنرجو",
    target: { view: "students", id: signal.studentId },
  }));

  const kicker = loading
    ? "در حال خواندن شواهد آموزشی…"
    : !progressEvidence
      ? "شواهد پیشرفت کامل خوانده نشد"
      : signals.length === 0
        ? "با شواهد کنونی نشانه‌ای برای پیگیری نیست"
        : `${faNum(signals.length)} نشانهٔ آموزشی`;

  return (
    <Surface className={cn("flex h-full flex-col p-5", className)}>
      <SectionHeader title="پیگیری آموزشی" kicker={kicker} />
      {loading ? (
        <LoadingState label="در حال خواندن شواهد…" />
      ) : !progressEvidence ? (
        <EmptyState
          className="mt-2"
          title="فهرست پیگیری ناقص است"
          description="شواهد پیشرفت کامل خوانده نشد؛ فهرست کوتاه را به‌جای حقیقت کامل نشان نمی‌دهیم."
        />
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="نشانه‌ای برای پیگیری نیست"
          description="تکلیف‌ها یا در حال پیشرفت‌اند یا شاهد تازه دارند."
        />
      ) : (
        <>
          <ul className="-mx-2 mt-2">
            {items.map((item, index) => (
              <li key={item.id}>
                <AlertItem item={item} onOpen={() => onOpenStudent(signals[index].studentId)} />
              </li>
            ))}
          </ul>
          {signals.length > items.length && (
            <p className="mt-2 text-[11px] text-ink-400">
              و {faNum(signals.length - items.length)} نشانهٔ دیگر.
            </p>
          )}
        </>
      )}
      {!loading && progressEvidence && items.length > 0 && (
        <p className="mt-auto pt-4 text-[11px] leading-relaxed text-ink-400">
          این فهرست فقط از شواهد آموزشی ساخته می‌شود — پیشرفت ثبت‌شده، تاریخ هدف تکلیف و صورت‌جلسه‌های شما؛ وضعیت مالی جایی در آن
          ندارد.
        </p>
      )}
    </Surface>
  );
}

/** Re-exported so the desk's view can label a signal without a second import. */
export { TEACHING_SIGNAL_LABEL as SIGNAL_LABEL };
export type { Tone };
