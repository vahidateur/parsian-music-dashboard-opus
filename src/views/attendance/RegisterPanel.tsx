/**
 * The attendance register: one derived session, one derived roster, and the only
 * place this view offers a write.
 *
 * It lives beside the view rather than inside it for the same reason the
 * scheduling write forms do (`src/views/scheduling/SessionWriteDialogs.tsx`): the
 * register is a row state machine — unmarked, marked, busy, locked, read-only —
 * and folding five of those into a page that also owns a window, three tabs and
 * three more reads makes both harder to read.
 *
 * WHAT THIS PANEL DOES NOT DO
 *
 *   - **It derives nothing.** `attendance` arrives already joined: the roster
 *     derived from active Enrollment at the session's date, plus whatever marks
 *     exist (`AttendanceRepository.sessionAttendance`). "Unmarked" is the absence
 *     of a record, never a placeholder row and never a `null` status, because
 *     "not taken yet" and "marked absent" are different facts and a disputed
 *     absence turns on exactly that distinction.
 *   - **It computes no rate.** The counts it shows are the register's own
 *     (`recorded` of `expected`). A percentage over one session, a trend across
 *     sessions or a per-student rate would all be arithmetic this panel has no
 *     honest basis for: one session is a sample of one, and the longitudinal read
 *     would need a window the domain does not expose (E-1).
 *   - **It offers no un-record.** There is no control that removes a mark,
 *     restores a previous one or edits a correction, because the repository has
 *     no verb for any of them — `record`, `bulkRecord`, `correct` and no `update`,
 *     no `delete`. A control whose operation cannot run is removed rather than
 *     disabled (M2): a disabled button still advertises a capability the product
 *     does not have.
 *   - **It claims nothing.** Every write is the caller's; this panel calls
 *     `onRecord` / `onBulkPresent` / `onCorrect` and shows the busy state until
 *     the caller's promise settles. The confirmation is announced by the caller
 *     from the record the repository actually returned (H2, E-3).
 *
 * WHO MAY WRITE
 *
 * `canWrite` is the caller's answer from the RBAC matrix plus an authenticated
 * principal. When it is false the controls are absent, not greyed out, and the
 * panel says plainly that it is read-only for this session — read access to the
 * register is `attendance.read`, which staff hold.
 */
import { Button, StatusBadge, type Tone } from "@/components/ds/primitives";
import { Avatar, Panel } from "@/components/ds/patterns";
import { EmptyState } from "@/components/ds/states";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABEL,
  type AttendanceRecord,
  type AttendanceStatus,
  type SessionAttendance,
} from "@/domains/attendance/types";
import { isoToJalaliDisplay } from "@/domains/scheduling/dateBridge";
import type { Session } from "@/domains/scheduling/types";
import { NO_DATA, faNum, faTime } from "@/lib/format";
import { cn } from "@/utils/cn";

/** The same four glyphs the fixture register used; now they label real writes. */
const GLYPH: Record<AttendanceStatus, string> = {
  present: "✓",
  absent: "✕",
  late: "◷",
  excused: "◇",
};

const TONE: Record<AttendanceStatus, Tone> = {
  present: "ok",
  absent: "danger",
  late: "warn",
  excused: "info",
};

const MARK_CLS: Record<AttendanceStatus, string> = {
  present: "border-ok-500/45 bg-ok-500/15 text-ok-400",
  absent: "border-danger-500/45 bg-danger-500/15 text-danger-400",
  late: "border-warn-500/45 bg-warn-500/15 text-warn-400",
  excused: "border-info-400/40 bg-info-400/12 text-info-400",
};

/** The day of an ISO timestamp, as the user reads it. Only the day is a fact. */
function dayOf(iso: string): string {
  const display = isoToJalaliDisplay(iso.slice(0, 10), { day: "numeric", month: "long" });
  return display.length > 0 ? display : NO_DATA;
}

export function RegisterPanel({
  session,
  attendance,
  classTitle,
  teacherName,
  canWrite,
  recorderName,
  busyStudentId,
  bulkBusy,
  onRecord,
  onBulkPresent,
  onCorrect,
  onOpenStudent,
  onOpenSchedule,
}: {
  /** The selected session, from the scheduling window read. */
  session: Session;
  /** The derived register for exactly this session. */
  attendance: SessionAttendance;
  /** Resolved from the class read; `NO_DATA` when the lookup has no answer. */
  classTitle: string;
  teacherName: string;
  /** RBAC plus an authenticated principal, decided by the caller. */
  canWrite: boolean;
  /** Who a mark would be attributed to, shown before the act rather than after. */
  recorderName: string;
  busyStudentId: string | null;
  bulkBusy: boolean;
  onRecord: (studentId: string, studentName: string, status: AttendanceStatus) => void;
  /** One atomic `bulkRecord`; resolves when the repository has answered. */
  onBulkPresent: () => Promise<void>;
  onCorrect: (record: AttendanceRecord, studentName: string) => void;
  onOpenStudent: (studentId: string) => void;
  onOpenSchedule: () => void;
}) {
  /**
   * Locked is the register's own answer OR the session's status. The domain
   * refuses marks for a cancelled session (`SESSION_CANCELLED`); saying so before
   * the user presses anything is the difference between a withdrawn control and a
   * refused one.
   */
  const locked = attendance.locked || session.status === "cancelled";
  const unmarked = attendance.roster.filter((row) => row.record === undefined);
  const complete = attendance.roster.length > 0 && unmarked.length === 0;

  return (
    <Panel
      title={`فهرست حاضران · ${classTitle}`}
      kicker={`${dayOf(session.date)} · ${faTime(session.startTime)}–${faTime(session.endTime)} · ${teacherName}`}
      aside={
        locked ? (
          <StatusBadge tone="neutral" label="لغو شده" cancelled />
        ) : complete ? (
          <StatusBadge tone="ok" label="فهرست کامل" />
        ) : (
          <StatusBadge
            tone="warn"
            label={`${faNum(attendance.recorded)} از ${faNum(attendance.expected)} ثبت شده`}
          />
        )
      }
    >
      {locked ? (
        /*
          A cancelled session takes no marks, so there is nothing to write against
          and no control is rendered. The way out is a real one: the scheduling
          view writes for real (M4), so rescheduling or replacing this session is
          an act the product can actually perform.
        */
        <div className="flex flex-col items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink-50">این جلسه لغو شده است</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
              {session.cancelReason?.trim()
                ? `دلیل لغو: ${session.cancelReason.trim()}. `
                : ""}
              جلسهٔ لغوشده حضور و غیاب نمی‌پذیرد و هیچ رکوردی برای آن نوشته نمی‌شود.
            </p>
          </div>
          <Button size="sm" variant="subtle" onClick={onOpenSchedule}>
            رفتن به برنامه‌ریزی
          </Button>
        </div>
      ) : attendance.roster.length === 0 ? (
        /*
          Zero expected is a real answer from the derived roster — nobody was
          enrolled on this date — and is deliberately not rendered as an unmarked
          register, which would invite a bulk write against nobody.
        */
        <EmptyState
          title="در این جلسه هنرجویی انتظار نمی‌رود"
          description="فهرست حاضران این جلسه از ثبت‌نام‌های فعال همان تاریخ استخراج می‌شود و در این تاریخ خالی است. چیزی برای ثبت وجود ندارد و هیچ رکوردی نوشته نمی‌شود."
        />
      ) : (
        <>
          {!canWrite && (
            <p className="mb-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[11.5px] leading-relaxed text-ink-300">
              این پنل برای شما خواندنی است: نقش شما دسترسی ثبت حضور و غیاب ندارد،
              بنابراین هیچ کنترل ثبتی نمایش داده نمی‌شود. فهرست حاضران و وضعیت
              ثبت هر هنرجو از دامنه خوانده شده است.
            </p>
          )}

          {canWrite && unmarked.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-gold-500/20 bg-gold-500/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-[11.5px] leading-relaxed text-ink-300">
                {faNum(unmarked.length)} هنرجوی ثبت‌نشده در این فهرست است. ثبت گروهی
                همهٔ آن‌ها را در یک عملیات اتمی «حاضر» ثبت می‌کند؛ هنرجویانی که
                رکورد دارند دوباره نوشته نمی‌شوند.
                {recorderName.trim().length > 0 && (
                  <> ثبت‌کننده: {recorderName.trim()}.</>
                )}
              </div>
              <Button
                size="sm"
                variant="primary"
                className="shrink-0"
                disabled={bulkBusy}
                onClick={() => void onBulkPresent()}
              >
                {bulkBusy ? "در حال ثبت گروهی…" : `همه حاضر (${faNum(unmarked.length)})`}
              </Button>
            </div>
          )}

          <ul className="stagger space-y-2">
            {attendance.roster.map(({ student, record }) => {
              const busy = busyStudentId === student.studentId;
              return (
                <li
                  key={student.studentId}
                  className="flex flex-col gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={student.studentName} size="sm" ring={record ? TONE[record.status] : undefined} />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenStudent(student.studentId)}
                        className="block truncate text-[13.5px] font-medium text-ink-50 hover:text-gold-300"
                      >
                        {student.studentName}
                      </button>
                      <div className="truncate text-[11px] text-ink-400">
                        {record
                          ? `${ATTENDANCE_STATUS_LABEL[record.status]} · ثبت‌شده در ${dayOf(record.recordedAt)}`
                          : "ثبت‌نشده — برای این هنرجو رکوردی نوشته نشده است"}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {record ? (
                      <>
                        <StatusBadge tone={TONE[record.status]} label={ATTENDANCE_STATUS_LABEL[record.status]} />
                        {canWrite && !locked && (
                          /*
                            Changing a mark is a correction with a stated reason,
                            never an in-place edit: the dialog appends one immutable
                            entry to the trail and the repository keeps the record.
                          */
                          <Button
                            size="sm"
                            variant="subtle"
                            disabled={busy}
                            onClick={() => onCorrect(record, student.studentName)}
                          >
                            اصلاح
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <StatusBadge tone="warn" label="ثبت‌نشده" />
                        {canWrite &&
                          !locked &&
                          ATTENDANCE_STATUSES.map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={busy}
                              /*
                                The label names the student, not just the status: in
                                a register of twenty rows, «حاضر» announced on its own
                                is a mark whose subject a screen-reader user has to
                                reconstruct from row order.
                              */
                              aria-label={`${ATTENDANCE_STATUS_LABEL[status]} — ${student.studentName}`}
                              title={`${ATTENDANCE_STATUS_LABEL[status]} — ${student.studentName}`}
                              onClick={() => onRecord(student.studentId, student.studentName, status)}
                              className={cn(
                                "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-all duration-[var(--sixteenth)] active:scale-95 disabled:opacity-50",
                                // Tinted by the outcome each one writes: these are
                                // four different facts, not one toggle's states.
                                busy ? "border-white/[0.07] bg-white/[0.02] text-ink-500" : MARK_CLS[status],
                              )}
                            >
                              <span aria-hidden>{GLYPH[status]}</span>
                              {ATTENDANCE_STATUS_LABEL[status]}
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            هر ثبت یک رکورد در انبار دامنه می‌نویسد و ثبت‌کنندهٔ آن کاربرِ واردشده
            است. رکوردی حذف نمی‌شود، وضعیت پیشین بازگردانده نمی‌شود و هیچ
            اطلاع‌رسانی به مدرس، هنرجو یا سرپرست انجام نمی‌شود؛ این آموزشگاه هنوز
            هیچ کانال پیامی ندارد. نرخ بلندمدت حضور هر هنرجو نیز نمایش داده
            نمی‌شود، چون از یک جلسه قابل استخراج نیست.
          </p>
        </>
      )}
    </Panel>
  );
}
