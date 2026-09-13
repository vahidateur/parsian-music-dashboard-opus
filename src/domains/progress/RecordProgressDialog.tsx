/**
 * Record a practice/lesson observation against an assignment.
 *
 * Every submission APPENDS to the immutable log — this dialog can never edit
 * or delete an earlier entry, which is why it is titled "ثبت" (record) rather
 * than "ویرایش". Correcting a mistake means recording the correct values now.
 *
 * Field-level validation mirrors the repository's bounds so a user gets an
 * instant answer, but the repository remains the authority: it re-validates
 * everything and its `fields` errors are merged back in.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, inputCls } from "@/components/ds/patterns";
import { getProgressRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import {
  MASTERY_SCALE,
  PRACTICE_MINUTES_BOUNDS,
  RANGE_UNIT_LABEL,
  TEMPO_BOUNDS,
  type Piece,
  type PieceAssignment,
  type ProgressEvent,
  type ProgressSource,
} from "./types";
import { cn } from "@/utils/cn";

interface ProgressDraft {
  rangeStart: string;
  rangeEnd: string;
  rangeLabel: string;
  tempoBpm: string;
  targetTempoBpm: string;
  mastery: string;
  practiceMinutes: string;
  teacherNote: string;
  studentNote: string;
}

/** Parses an optional numeric field; "" means "not recorded". */
function optionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function RecordProgressDialog({
  open,
  assignment,
  piece,
  source,
  onClose,
  onRecorded,
}: {
  open: boolean;
  assignment: PieceAssignment;
  piece: Piece | undefined;
  /**
   * Who is recording. Teacher-recorded entries may carry a teacher note;
   * students record their own practice. This is provenance for analytics, not
   * an authorization decision — the server must enforce that separately (§31).
   */
  source: ProgressSource;
  onClose: () => void;
  onRecorded: (event: ProgressEvent) => void;
}) {
  const freeform = piece?.rangeUnit === "freeform";
  const unitLabel = piece ? RANGE_UNIT_LABEL[piece.rangeUnit] : "محدوده";
  const [showNotes, setShowNotes] = useState(false);

  // Prefill from the last observation: a practice session usually continues
  // where the previous one stopped, and retyping invites transcription errors.
  const initial = useMemo<ProgressDraft>(
    () => ({
      rangeStart: assignment.latest?.rangeStart !== undefined ? String(assignment.latest.rangeStart) : "",
      rangeEnd: assignment.latest?.rangeEnd !== undefined ? String(assignment.latest.rangeEnd) : "",
      rangeLabel: assignment.latest?.rangeLabel ?? "",
      tempoBpm: assignment.latest?.tempoBpm !== undefined ? String(assignment.latest.tempoBpm) : "",
      targetTempoBpm:
        assignment.latest?.targetTempoBpm !== undefined ? String(assignment.latest.targetTempoBpm) : "",
      mastery: assignment.latest?.mastery !== undefined ? String(assignment.latest.mastery) : "",
      practiceMinutes: "",
      teacherNote: "",
      studentNote: "",
    }),
    [assignment.latest],
  );

  const form = useEntityForm<ProgressDraft, ProgressEvent>({
    initial,
    validate: (draft) => validate(draft, freeform),
    submit: async (draft) =>
      getProgressRepository().recordProgress({
        assignmentId: assignment.id,
        rangeStart: freeform ? undefined : optionalNumber(draft.rangeStart),
        rangeEnd: freeform ? undefined : optionalNumber(draft.rangeEnd),
        rangeLabel: freeform ? draft.rangeLabel.trim() : undefined,
        tempoBpm: optionalNumber(draft.tempoBpm),
        targetTempoBpm: optionalNumber(draft.targetTempoBpm),
        mastery: Number(draft.mastery),
        practiceMinutes: optionalNumber(draft.practiceMinutes),
        teacherNote: draft.teacherNote.trim() || undefined,
        studentNote: draft.studentNote.trim() || undefined,
        source,
      }),
    onSuccess: (event) => {
      onRecorded(event);
      onClose();
    },
  });

  if (!open) return null;
  const busy = form.submitting;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={`ثبت پیشرفت — ${piece?.title ?? "قطعه"}`}
      description="هر ثبت به سابقه اضافه می‌شود و رکوردهای قبلی را تغییر نمی‌دهد."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ثبت…" : "ثبت پیشرفت"}
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
          <p
            role="alert"
            className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400"
          >
            {form.formError.message}
          </p>
        )}

        {freeform ? (
          <Field label="محدودهٔ تمرین" error={form.errors.rangeLabel} required className="sm:col-span-2">
            {(control) => (
              <input
                {...control}
                className={inputCls}
                placeholder="مثلاً: پارادیدل دست چپ"
                value={form.draft.rangeLabel}
                disabled={busy}
                onChange={(e) => form.set("rangeLabel", e.target.value)}
              />
            )}
          </Field>
        ) : (
          <>
            <Field label={`${unitLabel} شروع`} error={form.errors.rangeStart}>
              {(control) => (
                <input
                  {...control}
                  className={cn(inputCls, "nums")}
                  inputMode="numeric"
                  dir="ltr"
                  value={form.draft.rangeStart}
                  disabled={busy}
                  onChange={(e) => form.set("rangeStart", e.target.value)}
                />
              )}
            </Field>
            <Field
              label={`${unitLabel} پایان`}
              error={form.errors.rangeEnd}
              hint={piece?.totalRange ? `مجموع: ${piece.totalRange}` : undefined}
            >
              {(control) => (
                <input
                  {...control}
                  className={cn(inputCls, "nums")}
                  inputMode="numeric"
                  dir="ltr"
                  value={form.draft.rangeEnd}
                  disabled={busy}
                  onChange={(e) => form.set("rangeEnd", e.target.value)}
                />
              )}
            </Field>
          </>
        )}

        <Field label="سرعت فعلی (BPM)" error={form.errors.tempoBpm}>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              dir="ltr"
              placeholder="اختیاری"
              value={form.draft.tempoBpm}
              disabled={busy}
              onChange={(e) => form.set("tempoBpm", e.target.value)}
            />
          )}
        </Field>

        <Field label="سرعت هدف (BPM)" error={form.errors.targetTempoBpm}>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              dir="ltr"
              placeholder="اختیاری"
              value={form.draft.targetTempoBpm}
              disabled={busy}
              onChange={(e) => form.set("targetTempoBpm", e.target.value)}
            />
          )}
        </Field>

        <Field
          label="تسلط"
          error={form.errors.mastery}
          required
          hint={`عددی بین ${MASTERY_SCALE.min} تا ${MASTERY_SCALE.max}`}
        >
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              dir="ltr"
              value={form.draft.mastery}
              disabled={busy}
              onChange={(e) => form.set("mastery", e.target.value)}
            />
          )}
        </Field>

        <Field label="مدت تمرین (دقیقه)" error={form.errors.practiceMinutes}>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              dir="ltr"
              placeholder="اختیاری"
              value={form.draft.practiceMinutes}
              disabled={busy}
              onChange={(e) => form.set("practiceMinutes", e.target.value)}
            />
          )}
        </Field>

        {!showNotes ? (
          <button
            type="button"
            className="sm:col-span-2 rounded-xl border border-dashed border-white/[0.10] px-3 py-2 text-[12px] text-ink-300 hover:border-gold-500/30 hover:text-ink-100"
            onClick={() => setShowNotes(true)}
          >
            افزودن یادداشت
          </button>
        ) : (
          <>
            {source === "teacher" && (
              <Field label="یادداشت مدرس" error={form.errors.teacherNote} className="sm:col-span-2">
                {(control) => (
                  <textarea
                    {...control}
                    rows={2}
                    className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
                    placeholder="مثلاً: ریتم بخش ب نیاز به کار دارد."
                    value={form.draft.teacherNote}
                    disabled={busy}
                    onChange={(e) => form.set("teacherNote", e.target.value)}
                  />
                )}
              </Field>
            )}
            <Field label="یادداشت هنرجو" error={form.errors.studentNote} className="sm:col-span-2">
              {(control) => (
                <textarea
                  {...control}
                  rows={2}
                  className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
                  value={form.draft.studentNote}
                  disabled={busy}
                  onChange={(e) => form.set("studentNote", e.target.value)}
                />
              )}
            </Field>
          </>
        )}
      </form>
    </Dialog>
  );
}

function validate(draft: ProgressDraft, freeform: boolean): FieldErrors<ProgressDraft> {
  const errors: FieldErrors<ProgressDraft> = {};

  const mastery = Number(draft.mastery.trim());
  if (draft.mastery.trim() === "") {
    errors.mastery = "ثبت تسلط الزامی است.";
  } else if (!Number.isInteger(mastery) || mastery < MASTERY_SCALE.min || mastery > MASTERY_SCALE.max) {
    errors.mastery = `عددی صحیح بین ${MASTERY_SCALE.min} تا ${MASTERY_SCALE.max} وارد کنید.`;
  }

  if (freeform) {
    if (draft.rangeLabel.trim().length === 0) errors.rangeLabel = "توضیح محدوده الزامی است.";
  } else {
    const start = optionalNumber(draft.rangeStart);
    const end = optionalNumber(draft.rangeEnd);
    if (Number.isNaN(start)) errors.rangeStart = "عدد معتبر وارد کنید.";
    if (Number.isNaN(end)) errors.rangeEnd = "عدد معتبر وارد کنید.";
    if (typeof start === "number" && typeof end === "number" && end < start) {
      errors.rangeEnd = "پایان محدوده نمی‌تواند کوچک‌تر از شروع باشد.";
    }
  }

  for (const key of ["tempoBpm", "targetTempoBpm"] as const) {
    const value = optionalNumber(draft[key]);
    if (value === undefined) continue;
    if (Number.isNaN(value) || value < TEMPO_BOUNDS.min || value > TEMPO_BOUNDS.max) {
      errors[key] = `بین ${TEMPO_BOUNDS.min} تا ${TEMPO_BOUNDS.max} وارد کنید.`;
    }
  }

  const minutes = optionalNumber(draft.practiceMinutes);
  if (minutes !== undefined) {
    if (Number.isNaN(minutes) || minutes < PRACTICE_MINUTES_BOUNDS.min || minutes > PRACTICE_MINUTES_BOUNDS.max) {
      errors.practiceMinutes = `بین ${PRACTICE_MINUTES_BOUNDS.min} تا ${PRACTICE_MINUTES_BOUNDS.max} دقیقه وارد کنید.`;
    }
  }

  return errors;
}
