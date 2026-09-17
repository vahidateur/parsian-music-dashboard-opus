/**
 * The scheduling view's two write dialogs: reschedule and cancel.
 *
 * They live beside the view rather than inside it for the same reason every other
 * entity dialog in this codebase lives beside its surface (`RoomFormDialog`,
 * `ClassFormDialog`, …): a form is a draft, a validation pass, an in-flight state
 * and an error surface, and folding four of those into a 700-line calendar makes
 * both harder to read.
 *
 * WHAT THESE DIALOGS DO NOT DO
 *
 *   - **They own no invariants.** Attendance protection, the already-cancelled
 *     refusal, the required reason, the duration bounds and the conflict recheck
 *     at write time are the repository's (`src/domains/scheduling/repository.ts`
 *     states them as its reason for existing as verbs rather than field writes).
 *     Nothing here re-implements them, and nothing here works around them: a
 *     refusal arrives as an `ApiError`, is shown verbatim, and is reported upward
 *     so the view can announce the failure in `danger`.
 *   - **They do not derive conflicts.** The candidate is handed to
 *     `useConflictCheck`, which asks the domain's own `checkConflicts`. A second
 *     overlap rule in a form would eventually disagree with the engine that
 *     enforces it, and the user would be told one thing and refused for another.
 *   - **They claim nothing that did not happen.** No «تعارض برطرف شد», no teacher
 *     or student notification, no SMS, no server. The success copy is written by
 *     the caller from the record the repository actually returned.
 *
 * The preview is advisory and the dialog says so: a clean report does not promise
 * a successful write, because the repository recomputes conflicts against the
 * schedule as it stands when the write lands.
 */
import { useMemo } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, Toggle, inputCls } from "@/components/ds/patterns";
import type { Room } from "@/domains/rooms/types";
import { isoToJalaliDisplay, jalaliToIso, toMinutes } from "@/domains/scheduling/dateBridge";
import type { Teacher } from "@/domains/teachers/types";
import type { RescheduleInput, Session, SessionCandidate } from "@/domains/scheduling/types";
import { useConflictCheck } from "@/domains/scheduling/useScheduling";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { NO_DATA, faTime } from "@/lib/format";
import { cn } from "@/utils/cn";
// The Jalali input boundary and the field vocabulary are shared with the other
// scheduling-shaped forms — see views/shared/jalaliInput (audit S-7).
import { FIELD_MESSAGES, jalaliInputValue } from "@/views/shared/jalaliInput";

/* ================================================================== */
/* Reschedule                                                          */
/* ================================================================== */

interface RescheduleDraft {
  /** Jalali as typed; converted to ISO only at the boundary. */
  date: string;
  startTime: string;
  endTime: string;
  roomId: string;
  teacherId: string;
  reason: string;
  acknowledgeWarnings: boolean;
}

function toDraft(session: Session): RescheduleDraft {
  return {
    date: jalaliInputValue(session.date),
    startTime: session.startTime,
    endTime: session.endTime,
    roomId: session.roomId,
    teacherId: session.teacherId,
    reason: "",
    acknowledgeWarnings: false,
  };
}

/**
 * Format and presence only.
 *
 * Every rule that belongs to the domain is deliberately NOT checked here: an
 * end-before-start, a too-short session, a clash with another class or a session
 * that already has attendance are all reported by `checkConflicts` and by the
 * repository, in their own words. A form that guesses those rules ends up with
 * two answers, and the user sees the form's while the write fails on the real one.
 */
function validate(draft: RescheduleDraft): FieldErrors<RescheduleDraft> {
  const errors: FieldErrors<RescheduleDraft> = {};
  if (jalaliToIso(draft.date) === null) errors.date = FIELD_MESSAGES.date;
  if (toMinutes(draft.startTime) === null) errors.startTime = FIELD_MESSAGES.startTime;
  if (toMinutes(draft.endTime) === null) errors.endTime = FIELD_MESSAGES.endTime;
  if (draft.reason.trim().length === 0) errors.reason = "دلیل جابه‌جایی الزامی است.";
  return errors;
}

export function RescheduleSessionDialog({
  open,
  session,
  classTitle,
  rooms,
  teachers,
  roomsUnavailable,
  teachersUnavailable,
  onSubmit,
  onRejected,
  onWritten,
  onClose,
}: {
  open: boolean;
  /** The derived selected session. The caller never renders this without one. */
  session: Session;
  classTitle: string;
  rooms: readonly Room[];
  teachers: readonly Teacher[];
  /** A failed read offers no picker (D12); the session keeps what it has. */
  roomsUnavailable: boolean;
  teachersUnavailable: boolean;
  onSubmit: (id: string, input: RescheduleInput) => Promise<Session>;
  /** The repository refused. The caller announces it; the dialog stays open. */
  onRejected: (cause: unknown) => void;
  /** The repository returned the new session. Only then is anything claimed. */
  onWritten: (moved: Session) => void;
  onClose: () => void;
}) {
  const form = useEntityForm<RescheduleDraft, Session>({
    initial: toDraft(session),
    // H6: the draft is rebuilt from THIS session every time the dialog opens, so
    // opening it for another session can never carry the previous one's values.
    open,
    validate,
    submit: async (draft) => {
      const date = jalaliToIso(draft.date.trim());
      if (date === null) throw new Error("reschedule without a readable date");
      try {
        return await onSubmit(session.id, {
          date,
          startTime: draft.startTime.trim(),
          endTime: draft.endTime.trim(),
          roomId: draft.roomId,
          teacherId: draft.teacherId,
          reason: draft.reason.trim(),
          // Consent is explicit and defaults to false: a warning is a decision.
          acknowledgeWarnings: draft.acknowledgeWarnings,
        });
      } catch (cause) {
        onRejected(cause);
        // Re-thrown so `useEntityForm` records the message and maps the
        // repository's own `fields` (a `reason` refusal renders on the reason).
        throw cause;
      }
    },
    onSuccess: (moved) => {
      onWritten(moved);
      onClose();
    },
  });

  /*
    The candidate the domain checks. `id` is included so the session being moved
    does not conflict with itself — the same exclusion the repository applies when
    it rechecks at write time.

    While the date or a time is unparseable there is nothing to check, so the
    candidate is `undefined` and the hook reports not-in-flight rather than
    fetching a question nobody can answer yet.
  */
  const candidate = useMemo<SessionCandidate | undefined>(() => {
    if (!open) return undefined;
    const date = jalaliToIso(form.draft.date.trim());
    if (date === null) return undefined;
    if (toMinutes(form.draft.startTime) === null || toMinutes(form.draft.endTime) === null) return undefined;
    return {
      id: session.id,
      classId: session.classId,
      date,
      startTime: form.draft.startTime.trim(),
      endTime: form.draft.endTime.trim(),
      teacherId: form.draft.teacherId,
      roomId: form.draft.roomId,
    };
  }, [open, session.id, session.classId, form.draft]);

  const conflicts = useConflictCheck(candidate);
  const report = conflicts.data;
  const hard = report?.hard ?? [];
  const warnings = report?.warnings ?? [];
  const busy = form.submitting;

  /**
   * Editing anything the check depends on withdraws a previous acknowledgement:
   * consent was given to one specific report, not to whatever the form says next.
   */
  const editCandidate = <K extends keyof RescheduleDraft>(key: K, value: RescheduleDraft[K]) => {
    form.set(key, value);
    if (form.draft.acknowledgeWarnings) form.set("acknowledgeWarnings", false);
  };

  const blockedByConflict = conflicts.loading || hard.length > 0 || (warnings.length > 0 && !form.draft.acknowledgeWarnings);
  const roomKnown = rooms.some((room) => room.id === session.roomId);
  const teacherKnown = teachers.some((teacher) => teacher.id === session.teacherId);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="جابه‌جایی جلسه"
      description={`${classTitle} · ${jalaliDayLabel(session.date)} · ${faTime(session.startTime)}–${faTime(session.endTime)}`}
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy || blockedByConflict}>
            {busy ? "در حال جابه‌جایی…" : conflicts.loading ? "در حال بررسی تعارض…" : "جابه‌جایی جلسه"}
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
        {form.formError && (
          <p
            role="alert"
            className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] leading-relaxed text-danger-400"
          >
            {form.formError.message}
          </p>
        )}

        <Field label="روز" error={form.errors.date} required className="sm:col-span-2">
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              dir="rtl"
              value={form.draft.date}
              disabled={busy}
              onChange={(event) => editCandidate("date", event.target.value)}
            />
          )}
        </Field>

        <Field label="ساعت شروع" error={form.errors.startTime} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              dir="ltr"
              value={form.draft.startTime}
              disabled={busy}
              onChange={(event) => editCandidate("startTime", event.target.value)}
            />
          )}
        </Field>

        <Field label="ساعت پایان" error={form.errors.endTime} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              dir="ltr"
              value={form.draft.endTime}
              disabled={busy}
              onChange={(event) => editCandidate("endTime", event.target.value)}
            />
          )}
        </Field>

        {/* Rooms and teachers come from the view's own reads. A read that failed
            offers no picker: choosing from an empty list would silently move the
            session to whatever the form happened to hold. */}
        <Field label="اتاق" error={form.errors.roomId} required>
          {(control) =>
            roomsUnavailable ? (
              <p className="text-[11.5px] leading-relaxed text-ink-400">
                فهرست اتاق‌ها خوانده نشد؛ اتاق جلسه تغییر نمی‌کند.
              </p>
            ) : (
              <select
                {...control}
                className={inputCls}
                value={form.draft.roomId}
                disabled={busy}
                onChange={(event) => editCandidate("roomId", event.target.value)}
              >
                {!roomKnown && <option value={session.roomId}>اتاق کنونی (در فهرست نیست)</option>}
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            )
          }
        </Field>

        <Field label="مدرس" error={form.errors.teacherId} required>
          {(control) =>
            teachersUnavailable ? (
              <p className="text-[11.5px] leading-relaxed text-ink-400">
                فهرست مدرسین خوانده نشد؛ مدرس جلسه تغییر نمی‌کند.
              </p>
            ) : (
              <select
                {...control}
                className={inputCls}
                value={form.draft.teacherId}
                disabled={busy}
                onChange={(event) => editCandidate("teacherId", event.target.value)}
              >
                {!teacherKnown && <option value={session.teacherId}>مدرس کنونی (در فهرست نیست)</option>}
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            )
          }
        </Field>

        <Field
          label="دلیل جابه‌جایی"
          hint="روی جلسهٔ لغوشدهٔ اصلی نگه داشته می‌شود."
          error={form.errors.reason}
          required
          className="sm:col-span-2"
        >
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.reason}
              disabled={busy}
              placeholder="مثلاً: درخواست هنرجو برای تغییر ساعت"
              onChange={(event) => form.set("reason", event.target.value)}
            />
          )}
        </Field>

        {/* The domain's own report, in its own words. */}
        {conflicts.loading && (
          <p className="sm:col-span-2 text-[11.5px] text-ink-400">در حال بررسی تعارض این بازه…</p>
        )}

        {conflicts.error !== null && (
          <div
            role="alert"
            className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2.5"
          >
            <p className="text-[12px] leading-relaxed text-danger-400">
              بررسی تعارض انجام نشد: {conflicts.error.message}
            </p>
            <Button size="sm" variant="ghost" className="mt-1.5" onClick={conflicts.reload} disabled={busy}>
              تلاش دوباره
            </Button>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              ثبت بدون این پیش‌نمایش ممکن است؛ اعتبارسنجی نهایی هنگام ثبت انجام می‌شود.
            </p>
          </div>
        )}

        {hard.length > 0 && (
          <div
            role="alert"
            className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2.5"
          >
            <p className="text-[12px] font-medium text-danger-400">این جابه‌جایی ممکن نیست</p>
            <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-ink-200">
              {hard.map((item, index) => (
                <li key={`${item.kind}-${index}`}>{item.message}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="sm:col-span-2 rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2.5">
            <p className="text-[12px] font-medium text-warn-400">هشدار</p>
            <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-ink-200">
              {warnings.map((item, index) => (
                <li key={`${item.kind}-${index}`}>{item.message}</li>
              ))}
            </ul>
            <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-2.5">
              <span className="text-[11.5px] leading-relaxed text-ink-200">
                با آگاهی از این هشدارها ادامه می‌دهم
              </span>
              <Toggle
                checked={form.draft.acknowledgeWarnings}
                onChange={(value) => form.set("acknowledgeWarnings", value)}
                label="پذیرش هشدارهای تعارض"
              />
            </div>
          </div>
        )}

        {report !== undefined && report.ok && hard.length === 0 && warnings.length === 0 && (
          <p className="sm:col-span-2 text-[11.5px] leading-relaxed text-ink-400">
            تعارضی برای این بازه گزارش نشد. این یک پیش‌نمایش است؛ اعتبارسنجی نهایی هنگام ثبت انجام
            می‌شود.
          </p>
        )}

        <p className="sm:col-span-2 text-[11px] leading-relaxed text-ink-500">
          جلسهٔ کنونی لغو و با دلیل شما در تقویم نگه داشته می‌شود و جلسهٔ تازه جای آن را می‌گیرد.
          کلاس و تکرار هفتگی آن تغییر نمی‌کند و اطلاع‌رسانی به مدرس یا هنرجو انجام نمی‌شود.
        </p>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

/* ================================================================== */
/* Cancel                                                              */
/* ================================================================== */

interface CancelDraft {
  reason: string;
}

function validateCancel(draft: CancelDraft): FieldErrors<CancelDraft> {
  return draft.reason.trim().length === 0 ? { reason: "دلیل لغو الزامی است." } : {};
}

export function CancelSessionDialog({
  open,
  session,
  classTitle,
  onSubmit,
  onRejected,
  onWritten,
  onClose,
}: {
  open: boolean;
  session: Session;
  classTitle: string;
  onSubmit: (id: string, reason: string) => Promise<Session>;
  onRejected: (cause: unknown) => void;
  onWritten: (cancelled: Session) => void;
  onClose: () => void;
}) {
  const form = useEntityForm<CancelDraft, Session>({
    initial: { reason: "" },
    open,
    validate: validateCancel,
    submit: async (draft) => {
      try {
        return await onSubmit(session.id, draft.reason.trim());
      } catch (cause) {
        onRejected(cause);
        throw cause;
      }
    },
    onSuccess: (cancelled) => {
      onWritten(cancelled);
      onClose();
    },
  });

  if (!open) return null;
  const busy = form.submitting;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="لغو جلسه"
      description={`${classTitle} · ${jalaliDayLabel(session.date)} · ${faTime(session.startTime)}–${faTime(session.endTime)}`}
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button
            variant="subtle"
            className="border-danger-500/30 text-danger-400 hover:border-danger-500/45 hover:bg-danger-500/10"
            onClick={() => void form.submit()}
            disabled={busy}
          >
            {busy ? "در حال لغو…" : "لغو جلسه"}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        {form.formError && (
          <p
            role="alert"
            className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] leading-relaxed text-danger-400"
          >
            {form.formError.message}
          </p>
        )}

        <Field
          label="دلیل لغو"
          hint="برای سابقهٔ جلسه نگه داشته می‌شود."
          error={form.errors.reason}
          required
        >
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.reason}
              disabled={busy}
              placeholder="مثلاً: تعطیلی رسمی"
              onChange={(event) => form.set("reason", event.target.value)}
            />
          )}
        </Field>

        <p className="text-[11px] leading-relaxed text-ink-500">
          جلسه لغو می‌شود و با دلیل شما در تقویم می‌ماند؛ حذف نمی‌شود و جلسهٔ جایگزینی ساخته
          نمی‌شود. اطلاع‌رسانی به مدرس یا هنرجو انجام نمی‌شود.
        </p>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

/** Exported for the view's own copy: a day named the way the dialogs name it. */
export function jalaliDayLabel(iso: string): string {
  const display = isoToJalaliDisplay(iso, { weekday: "long", day: "numeric", month: "long" });
  return display.length > 0 ? display : NO_DATA;
}
