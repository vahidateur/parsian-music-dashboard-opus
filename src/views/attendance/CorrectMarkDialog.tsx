/**
 * The attendance view's one write form: correcting a mark.
 *
 * It lives beside the view rather than inside it for the same reason the
 * scheduling write forms do (`src/views/scheduling/SessionWriteDialogs.tsx`): a
 * form is a draft, a validation pass, an in-flight state and an error surface,
 * and folding four of those into a register makes both harder to read.
 *
 * WHY A CORRECTION IS A FORM AND NOT A BUTTON
 *
 * The domain offers no way to erase a mark. `AttendanceRepository` has `record`,
 * `bulkRecord` and `correct` and deliberately no `update` and no `delete`
 * (`src/domains/attendance/repository.ts`; the REST contract in
 * `apiRepository.ts` mirrors the absence, because a bare update endpoint would
 * let a disputed absence be rewritten with no trace). Changing a mark therefore
 * means appending an immutable correction, and a correction requires a reason —
 * attendance about a minor gets disputed, and an unauditable change is the
 * failure this domain exists to prevent.
 *
 * WHAT THIS FORM DOES NOT DO
 *
 *   - **It owns no invariant.** The required reason, the status vocabulary and
 *     the append-only history are the repository's. The local check here is
 *     presence only, so an empty reason is refused before a write is attempted;
 *     when the repository refuses for its own reasons, its `ApiError.fields`
 *     render on the same field through `useEntityForm`, verbatim.
 *   - **It claims nothing that did not happen.** No notification to a teacher, a
 *     student or a guardian, no SMS, no server. The success copy is written by
 *     the caller from the record the repository actually returned (H2, E-3).
 *   - **It offers no un-record.** There is no control here that removes a mark,
 *     restores a previous one or edits a correction: the domain has no verb for
 *     any of them, and a control whose operation cannot run is removed rather
 *     than disabled (M2).
 */
import { useId } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, inputCls } from "@/components/ds/patterns";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUSES,
  type AttendanceRecord,
  type AttendanceStatus,
  type CorrectionInput,
} from "@/domains/attendance/types";
import { isoToJalaliDisplay } from "@/domains/scheduling/dateBridge";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { NO_DATA } from "@/lib/format";
import { cn } from "@/utils/cn";

interface CorrectionDraft {
  status: AttendanceStatus;
  reason: string;
}

/**
 * Presence only.
 *
 * The domain's own rule is a non-empty trimmed reason (`REASON_REQUIRED`); this
 * check exists so an empty one never reaches the repository at all, which is
 * what "refused before the write" means. It is not a second copy of a domain
 * rule: it is the same rule, applied early, and the repository still decides.
 */
function validate(draft: CorrectionDraft): FieldErrors<CorrectionDraft> {
  return draft.reason.trim().length === 0 ? { reason: "دلیل اصلاح الزامی است." } : {};
}

/**
 * The date part of an ISO-8601 timestamp, as the user reads it.
 *
 * `recordedAt` / `changedAt` are server-generated stamps (the demo adapter
 * generates them too); only their calendar day is a fact this form may state, so
 * only the day is rendered, through the domain's own Jalali formatter.
 */
function dayOf(stamp: string): string {
  const display = isoToJalaliDisplay(stamp.slice(0, 10));
  return display.length > 0 ? display : NO_DATA;
}

export function CorrectMarkDialog({
  open,
  record,
  studentName,
  onSubmit,
  onRejected,
  onWritten,
  onClose,
}: {
  open: boolean;
  /** The real record being corrected, read from the register. */
  record: AttendanceRecord;
  studentName: string;
  /**
   * The verb, supplied by the view.
   *
   * `changedByUserId` is deliberately NOT part of this form's contract: the
   * authenticated principal belongs to the caller, which reads it from
   * `useAuth()`. A form that typed its own provenance would be a form that could
   * attribute a correction to whoever it felt like.
   */
  onSubmit: (id: string, input: Omit<CorrectionInput, "changedByUserId">) => Promise<AttendanceRecord>;
  /** The repository refused. The caller announces it; the dialog stays open. */
  onRejected: (cause: unknown) => void;
  onWritten: (corrected: AttendanceRecord) => void;
  onClose: () => void;
}) {
  const statusHeadingId = useId();
  const form = useEntityForm<CorrectionDraft, AttendanceRecord>({
    initial: { status: record.status, reason: "" },
    open,
    validate,
    submit: async (draft) => {
      try {
        return await onSubmit(record.id, { status: draft.status, reason: draft.reason.trim() });
      } catch (cause) {
        onRejected(cause);
        throw cause;
      }
    },
    onSuccess: (corrected) => {
      onWritten(corrected);
      onClose();
    },
  });

  if (!open) return null;
  const busy = form.submitting;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="اصلاح حضور و غیاب"
      description={`${studentName} · ثبت‌شده در ${dayOf(record.recordedAt)} · وضعیت کنونی: ${
        ATTENDANCE_STATUS_LABEL[record.status]
      }`}
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ثبت اصلاح…" : "ثبت اصلاح"}
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

        {/*
          NOT a <Field>: Field wraps plain children in a <label>, and a label's
          labeled control is its first labelable descendant — which for a group of
          buttons is the first button. The browser then computes that button's
          accessible name from the whole label («وضعیت تازه یکی از چهار وضعیت
          دامنه») instead of «حاضر», so a screen-reader user hears the heading for
          one option and the option's own name for the other three. A choice among
          four statuses is a group, not a labeled control: the heading ids it, and
          each button keeps its own name.
        */}
        <div>
          <span id={statusHeadingId} className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-200">
              وضعیت تازه
              <span className="ms-1 text-danger-400" aria-hidden>
                *
              </span>
            </span>
            <span className="text-[10.5px] text-ink-500">یکی از چهار وضعیت دامنه</span>
          </span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={statusHeadingId}>
            {ATTENDANCE_STATUSES.map((status) => {
              const active = form.draft.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  disabled={busy}
                  aria-pressed={active}
                  onClick={() => form.set("status", status)}
                  className={cn(
                    "h-8 rounded-lg border px-3 text-[11.5px] transition-colors",
                    active
                      ? "border-gold-500/45 bg-gold-500/15 text-gold-200"
                      : "border-white/[0.07] bg-white/[0.02] text-ink-400 hover:border-white/[0.16] hover:text-ink-100",
                  )}
                >
                  {ATTENDANCE_STATUS_LABEL[status]}
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label="دلیل اصلاح"
          hint="در تاریخچهٔ تغییرناپذیر این رکورد نگه داشته می‌شود."
          error={form.errors.reason}
          required
        >
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.reason}
              disabled={busy}
              placeholder="مثلاً: هنرجو حاضر بود و به اشتباه غایب ثبت شد"
              onChange={(event) => form.set("reason", event.target.value)}
            />
          )}
        </Field>

        <p className="text-[11px] leading-relaxed text-ink-500">
          یک سابقهٔ اصلاح به تاریخچه اضافه می‌شود و وضعیت رکورد تغییر می‌کند.
          رکورد حذف نمی‌شود، وضعیت پیشین بازگردانده نمی‌شود و سابقهٔ اصلاح‌های
          پیشین ویرایش‌پذیر نیست. اطلاع‌رسانی به مدرس، هنرجو یا سرپرست انجام
          نمی‌شود.
        </p>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
