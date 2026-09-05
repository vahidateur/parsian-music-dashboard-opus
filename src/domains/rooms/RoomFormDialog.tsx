/**
 * Room create/edit dialog, persisting through `RoomRepository`.
 *
 * `occupancy` is derived from scheduling rather than typed in, so it is not
 * an editable field.
 */
import { useMemo } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, Toggle, inputCls } from "@/components/ds/patterns";
import { getRoomRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { cn } from "@/utils/cn";
import type { CreateRoomInput, Room } from "./types";

interface RoomDraft {
  name: string;
  kind: string;
  capacity: string;
  active: boolean;
}

/** Room types the academy uses; free text stays possible via the input. */
const KIND_SUGGESTIONS = ["پیانو", "گروهی", "انفرادی", "تئوری", "درامز", "استودیو"];

function toDraft(room?: Room): RoomDraft {
  return {
    name: room?.name ?? "",
    kind: room?.kind ?? KIND_SUGGESTIONS[0],
    capacity: room ? String(room.capacity) : "6",
    active: room ? room.active !== false : true,
  };
}

function validate(draft: RoomDraft): FieldErrors<RoomDraft> {
  const errors: FieldErrors<RoomDraft> = {};
  if (draft.name.trim().length < 1) errors.name = "نام اتاق الزامی است.";
  if (draft.kind.trim().length < 1) errors.kind = "نوع اتاق الزامی است.";
  const capacity = Number(draft.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    errors.capacity = "ظرفیت باید عددی بین ۱ تا ۵۰۰ باشد.";
  }
  return errors;
}

export function RoomFormDialog({
  open,
  room,
  onClose,
  onSaved,
}: {
  open: boolean;
  room?: Room;
  onClose: () => void;
  onSaved: (room: Room, mode: "create" | "edit") => void;
}) {
  const editing = room !== undefined;
  const repository = useMemo(() => getRoomRepository(), []);

  const form = useEntityForm<RoomDraft, Room>({
    initial: toDraft(room),
    validate,
    submit: async (draft) => {
      const payload = {
        name: draft.name.trim(),
        kind: draft.kind.trim(),
        capacity: Number(draft.capacity),
        active: draft.active,
      };
      if (editing) return repository.update(room.id, payload);
      const created: CreateRoomInput = { ...payload, occupancy: 0 };
      return repository.create(created);
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
      title={editing ? `ویرایش ${room.name}` : "اتاق جدید"}
      description="اتاق غیرفعال از تخصیص کلاس‌های جدید کنار گذاشته می‌شود، اما کلاس‌های موجود دست‌نخورده می‌مانند."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ تغییرات" : "افزودن اتاق"}
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
          <p role="alert" className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            {form.formError.message}
          </p>
        )}

        <Field label="نام اتاق" error={form.errors.name} required className="sm:col-span-2">
          {(control) => (
            <input {...control} className={inputCls} value={form.draft.name} disabled={busy} onChange={(e) => form.set("name", e.target.value)} />
          )}
        </Field>

        <Field label="نوع" error={form.errors.kind} required>
          {(control) => (
            <>
              <input
                {...control}
                className={inputCls}
                list="room-kind-suggestions"
                value={form.draft.kind}
                disabled={busy}
                onChange={(e) => form.set("kind", e.target.value)}
              />
              <datalist id="room-kind-suggestions">
                {KIND_SUGGESTIONS.map((kind) => (
                  <option key={kind} value={kind} />
                ))}
              </datalist>
            </>
          )}
        </Field>

        <Field label="ظرفیت" error={form.errors.capacity} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              value={form.draft.capacity}
              disabled={busy}
              onChange={(e) => form.set("capacity", e.target.value)}
            />
          )}
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] px-3.5 py-3 sm:col-span-2">
          <span className="text-xs font-medium text-ink-200">قابل تخصیص برای کلاس‌های جدید</span>
          <Toggle checked={form.draft.active} onChange={(v) => form.set("active", v)} label="وضعیت فعال بودن اتاق" />
        </div>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
