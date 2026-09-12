/**
 * Assign a repertoire piece to a student.
 *
 * The piece list is filtered to the student's own instrument, because
 * assigning a violin sonata to a drummer is always a mistake rather than a
 * choice. The repository still re-checks everything it can.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, inputCls } from "@/components/ds/patterns";
import { getProgressRepository, getStudentRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { usePieces } from "./useProgress";
import { ASSIGNMENT_STATUS_LABEL, type AssignmentStatus, type Piece, type PieceAssignment } from "./types";
import { cn } from "@/utils/cn";

interface AssignDraft {
  pieceId: string;
  status: AssignmentStatus;
  targetDate: string;
  notes: string;
}

/** Statuses that make sense when first assigning a piece. */
const INITIAL_STATUSES: AssignmentStatus[] = ["planned", "learning"];

export function AssignPieceDialog({
  open,
  studentId,
  studentName,
  onClose,
  onAssigned,
}: {
  open: boolean;
  studentId: string;
  studentName: string;
  onClose: () => void;
  onAssigned: (piece: Piece, assignment: PieceAssignment) => void;
}) {
  const [instrumentId, setInstrumentId] = useState<string | undefined>(undefined);
  /**
   * Whether the student's instrument is known yet — resolved, or the lookup
   * failed and the documented fallback (show every piece) applies.
   *
   * Until then the query is *unfiltered*, so the picker is in flight rather
   * than offering every piece in the academy under the dialog's own claim that
   * «قطعه‌ها بر اساس ساز هنرجو فیلتر شده‌اند». `assignPiece` re-checks what it
   * can, but instrument is not one of the things it can check.
   */
  const [instrumentResolved, setInstrumentResolved] = useState(false);

  // Resolve the student's instrument so the picker is relevant.
  useEffect(() => {
    let cancelled = false;
    setInstrumentResolved(false);
    void getStudentRepository()
      .get(studentId)
      .then((student) => {
        if (cancelled) return;
        setInstrumentId(student.instrument);
        setInstrumentResolved(true);
      })
      .catch(() => {
        // Fall back to showing every piece rather than an empty picker.
        if (cancelled) return;
        setInstrumentId(undefined);
        setInstrumentResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // `piecesLoading` is read, not ignored: the params change the moment the
  // student's instrument resolves, and the rows rendered before that belong to
  // the unfiltered query (I13).
  const { items: pieces, loading: piecesLoading } = usePieces({ per_page: 200, activeOnly: true, instrumentId });

  /** In flight until the filter is known AND that filter's page has arrived. */
  const pickerLoading = !instrumentResolved || piecesLoading;

  // An empty `options` while loading is not a false empty: the control below is
  // disabled and says it is loading, which is the explicit in-flight state the
  // invariant asks for instead of another query's rows.
  const options = useMemo(
    () => (pickerLoading ? [] : [...pieces].sort((a, b) => a.title.localeCompare(b.title, "fa"))),
    [pieces, pickerLoading],
  );

  const form = useEntityForm<AssignDraft, PieceAssignment>({
    initial: { pieceId: "", status: "learning", targetDate: "", notes: "" },
    validate,
    submit: async (draft) =>
      getProgressRepository().assignPiece({
        studentId,
        pieceId: draft.pieceId,
        status: draft.status,
        targetDate: draft.targetDate.trim() || undefined,
        notes: draft.notes.trim() || undefined,
      }),
    onSuccess: (assignment) => {
      const piece = options.find((p) => p.id === assignment.pieceId);
      if (piece) onAssigned(piece, assignment);
      onClose();
    },
  });

  if (!open) return null;
  const busy = form.submitting;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={`افزودن قطعه برای ${studentName}`}
      description="قطعه‌ها بر اساس ساز هنرجو فیلتر شده‌اند."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ثبت…" : "تخصیص قطعه"}
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

        <Field label="قطعه" error={form.errors.pieceId} required className="sm:col-span-2">
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.pieceId}
              disabled={busy || pickerLoading}
              onChange={(e) => form.set("pieceId", e.target.value)}
            >
              <option value="">{pickerLoading ? "در حال بارگذاری قطعه‌های این ساز…" : "— انتخاب کنید —"}</option>
              {options.map((piece) => (
                <option key={piece.id} value={piece.id}>
                  {`${piece.title} — ${piece.composer}`}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="وضعیت" error={form.errors.status}>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.status}
              disabled={busy}
              onChange={(e) => form.set("status", e.target.value as AssignmentStatus)}
            >
              {INITIAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ASSIGNMENT_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="تاریخ هدف" error={form.errors.targetDate} hint="اختیاری">
          {(control) => (
            <input
              {...control}
              type="date"
              className={cn(inputCls, "nums")}
              dir="ltr"
              value={form.draft.targetDate}
              disabled={busy}
              onChange={(e) => form.set("targetDate", e.target.value)}
            />
          )}
        </Field>

        <Field label="یادداشت" error={form.errors.notes} className="sm:col-span-2">
          {(control) => (
            <textarea
              {...control}
              rows={2}
              className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
              value={form.draft.notes}
              disabled={busy}
              onChange={(e) => form.set("notes", e.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

function validate(draft: AssignDraft): FieldErrors<AssignDraft> {
  const errors: FieldErrors<AssignDraft> = {};
  if (!draft.pieceId) errors.pieceId = "انتخاب قطعه الزامی است.";
  if (draft.targetDate && Number.isNaN(Date.parse(draft.targetDate))) {
    errors.targetDate = "تاریخ معتبر نیست.";
  }
  return errors;
}
