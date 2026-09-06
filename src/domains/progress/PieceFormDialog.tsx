/**
 * Piece create/edit dialog.
 *
 * `rangeUnit` is chosen per piece rather than assumed, because a sonata is
 * measured in bars and an aural-training track in seconds. Changing it on an
 * existing piece is allowed but warned about: past events were recorded in the
 * old unit and their numbers will not mean the same thing.
 */
import { useMemo } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, Toggle, inputCls } from "@/components/ds/patterns";
import { getProgressRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { useInstrumentCatalog } from "@/domains/instruments/catalog";
import { usePrograms } from "@/domains/learning/useLearning";
import { MAX_RANGE_VALUE, RANGE_UNIT_LABEL, type Piece, type ProgressRangeUnit } from "./types";
import { cn } from "@/utils/cn";

interface PieceDraft {
  title: string;
  composer: string;
  instrumentId: string;
  programId: string;
  description: string;
  rangeUnit: ProgressRangeUnit;
  totalRange: string;
  active: boolean;
}

const RANGE_UNITS = Object.keys(RANGE_UNIT_LABEL) as ProgressRangeUnit[];

function toDraft(piece: Piece | undefined, fallbackInstrument: string): PieceDraft {
  return {
    title: piece?.title ?? "",
    composer: piece?.composer ?? "",
    instrumentId: piece?.instrumentId ?? fallbackInstrument,
    programId: piece?.programId ?? "",
    description: piece?.description ?? "",
    rangeUnit: piece?.rangeUnit ?? "measure",
    totalRange: piece?.totalRange !== undefined ? String(piece.totalRange) : "",
    active: piece ? piece.active : true,
  };
}

function validate(draft: PieceDraft): FieldErrors<PieceDraft> {
  const errors: FieldErrors<PieceDraft> = {};
  if (draft.title.trim().length < 2) errors.title = "عنوان قطعه الزامی است.";
  if (!draft.instrumentId) errors.instrumentId = "انتخاب ساز الزامی است.";

  if (draft.rangeUnit === "freeform") {
    // A free-form piece has no numeric extent by definition.
    if (draft.totalRange.trim() !== "") errors.totalRange = "برای محدودهٔ آزاد، مقدار عددی معنا ندارد.";
  } else if (draft.totalRange.trim() !== "") {
    const total = Number(draft.totalRange);
    if (!Number.isFinite(total) || total <= 0 || total > MAX_RANGE_VALUE) {
      errors.totalRange = "عدد معتبر وارد کنید.";
    }
  }
  return errors;
}

export function PieceFormDialog({
  open,
  piece,
  onClose,
  onSaved,
}: {
  open: boolean;
  piece?: Piece;
  onClose: () => void;
  onSaved: (piece: Piece, mode: "create" | "edit") => void;
}) {
  const editing = piece !== undefined;
  const catalog = useInstrumentCatalog();
  const { items: programs } = usePrograms({ per_page: 200 });
  const repository = useMemo(() => getProgressRepository(), []);
  const activeInstruments = catalog.filter((i) => i.active || i.id === piece?.instrumentId);

  const form = useEntityForm<PieceDraft, Piece>({
    initial: toDraft(piece, activeInstruments[0]?.id ?? ""),
    validate,
    submit: async (draft) => {
      const payload = {
        title: draft.title.trim(),
        composer: draft.composer.trim(),
        instrumentId: draft.instrumentId,
        programId: draft.programId || undefined,
        description: draft.description.trim(),
        rangeUnit: draft.rangeUnit,
        totalRange:
          draft.rangeUnit === "freeform" || draft.totalRange.trim() === ""
            ? undefined
            : Number(draft.totalRange),
        active: draft.active,
      };
      if (editing) return repository.updatePiece(piece.id, payload);
      return repository.createPiece(payload);
    },
    onSuccess: (saved) => {
      onSaved(saved, editing ? "edit" : "create");
      onClose();
    },
  });

  if (!open) return null;
  const busy = form.submitting;
  const unitChanged = editing && form.draft.rangeUnit !== piece.rangeUnit;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={editing ? `ویرایش ${piece.title}` : "قطعهٔ جدید"}
      description="قطعه یک اثر موسیقایی است؛ با «محتوای آموزشی» (نت، فایل صوتی) یکسان نیست."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ تغییرات" : "افزودن قطعه"}
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

        <Field label="عنوان" error={form.errors.title} required>
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.title}
              disabled={busy}
              onChange={(e) => form.set("title", e.target.value)}
            />
          )}
        </Field>

        <Field label="آهنگساز" error={form.errors.composer}>
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.composer}
              disabled={busy}
              onChange={(e) => form.set("composer", e.target.value)}
            />
          )}
        </Field>

        <Field label="ساز" error={form.errors.instrumentId} required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.instrumentId}
              disabled={busy}
              onChange={(e) => form.set("instrumentId", e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
              {activeInstruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="دوره" error={form.errors.programId} hint="اختیاری">
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.programId}
              disabled={busy}
              onChange={(e) => form.set("programId", e.target.value)}
            >
              <option value="">— بدون دوره —</option>
              {programs
                .filter((p) => !form.draft.instrumentId || p.instrumentId === form.draft.instrumentId)
                .map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
            </select>
          )}
        </Field>

        <Field label="واحد پیشرفت" error={form.errors.rangeUnit} required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.rangeUnit}
              disabled={busy}
              onChange={(e) => form.set("rangeUnit", e.target.value as ProgressRangeUnit)}
            >
              {RANGE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {RANGE_UNIT_LABEL[unit]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          label="مقدار کل"
          error={form.errors.totalRange}
          hint={form.draft.rangeUnit === "freeform" ? "برای محدودهٔ آزاد کاربرد ندارد" : "اختیاری"}
        >
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              dir="ltr"
              value={form.draft.totalRange}
              disabled={busy || form.draft.rangeUnit === "freeform"}
              onChange={(e) => form.set("totalRange", e.target.value)}
            />
          )}
        </Field>

        {unitChanged && (
          <p className="sm:col-span-2 rounded-xl border border-warn-500/25 bg-warn-500/[0.06] px-3 py-2 text-[11.5px] leading-relaxed text-warn-400">
            تغییر واحد پیشرفت، رکوردهای قبلی را بازنویسی نمی‌کند؛ اعداد ثبت‌شدهٔ گذشته همچنان بر پایهٔ واحد قبلی
            تفسیر می‌شوند.
          </p>
        )}

        <Field label="توضیح" error={form.errors.description} className="sm:col-span-2">
          {(control) => (
            <textarea
              {...control}
              rows={2}
              className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
              value={form.draft.description}
              disabled={busy}
              onChange={(e) => form.set("description", e.target.value)}
            />
          )}
        </Field>

        <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <div>
            <div className="text-[13px] text-ink-50">قطعه فعال است</div>
            <div className="mt-0.5 text-[11px] text-ink-400">قطعات فعال در فهرست تخصیص نمایش داده می‌شوند</div>
          </div>
          <Toggle checked={form.draft.active} onChange={(next) => form.set("active", next)} label="وضعیت قطعه" />
        </div>
      </form>
    </Dialog>
  );
}
