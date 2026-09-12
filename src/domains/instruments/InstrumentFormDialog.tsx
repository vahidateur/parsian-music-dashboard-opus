/**
 * Instrument create/edit dialog, persisting through `InstrumentRepository`.
 *
 * The slug is the record's id and is immutable after creation, because
 * existing students, classes and resources reference it. The dialog reflects
 * that by locking the field in edit mode rather than silently ignoring edits.
 */
import { useMemo } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, Toggle, inputCls } from "@/components/ds/patterns";
import { getInstrumentRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { cn } from "@/utils/cn";
import type { InstrumentRecord } from "./types";

interface InstrumentDraft {
  name: string;
  slug: string;
  description: string;
  active: boolean;
}

function toDraft(instrument?: InstrumentRecord): InstrumentDraft {
  return {
    name: instrument?.name ?? "",
    slug: instrument?.slug ?? "",
    description: instrument?.description ?? "",
    active: instrument ? instrument.active : true,
  };
}

function validate(draft: InstrumentDraft, editing: boolean): FieldErrors<InstrumentDraft> {
  const errors: FieldErrors<InstrumentDraft> = {};
  if (draft.name.trim().length < 1) errors.name = "نام ساز الزامی است.";
  if (!editing) {
    const slug = draft.slug.trim();
    if (slug.length < 2) errors.slug = "شناسه باید حداقل ۲ نویسه باشد.";
    else if (!/^[a-z][a-z0-9_-]*$/.test(slug)) {
      errors.slug = "شناسه فقط می‌تواند شامل حروف کوچک انگلیسی، عدد، خط تیره و زیرخط باشد و با حرف شروع شود.";
    }
  }
  return errors;
}

export function InstrumentFormDialog({
  open,
  instrument,
  onClose,
  onSaved,
}: {
  open: boolean;
  instrument?: InstrumentRecord;
  onClose: () => void;
  onSaved: (instrument: InstrumentRecord, mode: "create" | "edit") => void;
}) {
  const editing = instrument !== undefined;
  const repository = useMemo(() => getInstrumentRepository(), []);

  const form = useEntityForm<InstrumentDraft, InstrumentRecord>({
    initial: toDraft(instrument),
    open, // H6: rebuild the draft from this record whenever the dialog opens
    validate: (draft) => validate(draft, editing),
    submit: async (draft) => {
      if (editing) {
        // Slug intentionally omitted: it is the immutable identity.
        return repository.update(instrument.id, {
          name: draft.name.trim(),
          description: draft.description.trim(),
          active: draft.active,
        });
      }
      return repository.create({
        name: draft.name.trim(),
        slug: draft.slug.trim(),
        description: draft.description.trim(),
        active: draft.active,
      });
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
      title={editing ? `ویرایش ${instrument.name}` : "ساز جدید"}
      description="سازِ غیرفعال از فهرست انتخاب هنرجویان و کلاس‌های جدید کنار می‌رود، اما روی رکوردهای موجود باقی می‌ماند."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ تغییرات" : "افزودن ساز"}
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

        <Field label="نام ساز" error={form.errors.name} required>
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
          label="شناسه (انگلیسی)"
          error={form.errors.slug}
          required={!editing}
          hint={editing ? "شناسه پس از ساخت قابل تغییر نیست." : "مثال: santoor"}
        >
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "font-mono")}
              dir="ltr"
              value={form.draft.slug}
              disabled={busy || editing}
              readOnly={editing}
              onChange={(e) => form.set("slug", e.target.value.toLowerCase())}
            />
          )}
        </Field>

        <Field label="توضیح کوتاه" error={form.errors.description} className="sm:col-span-2">
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
            <div className="text-[13px] text-ink-50">ساز فعال است</div>
            <div className="mt-0.5 text-[11px] text-ink-400">سازهای فعال در فهرست انتخاب نمایش داده می‌شوند</div>
          </div>
          <Toggle
            checked={form.draft.active}
            onChange={(next) => form.set("active", next)}
            label="وضعیت ساز"
          />
        </div>
      </form>
    </Dialog>
  );
}
