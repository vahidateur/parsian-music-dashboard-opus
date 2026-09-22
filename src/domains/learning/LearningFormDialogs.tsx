/**
 * The edit dialogs the learning ladder was missing.
 *
 * A level could be added, reordered and deleted — but never described. The
 * academy's goals for a rung of the ladder lived in nobody's software: the row
 * showed a name and a count, and the description and objectives a level was
 * created with (empty) stayed empty forever. Same for a program: its instrument
 * was whichever one happened to be first when it was created, and the dialog
 * that could have corrected it did not exist.
 *
 * Both dialogs write through the learning repository only; `order` is never
 * touched here (reordering is the ladder's own verb, `reorderLevel`), and a
 * level's notes are a free-text field the academy fills with what a description
 * is too structured to hold.
 */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, inputCls } from "@/components/ds/patterns";
import { getLearningRepository } from "@/domains/registry";
import { apiErrorFromThrown } from "@/api/errors";
import { useApp } from "@/context/AppContext";
import { instrumentName, useInstrumentCatalog } from "@/domains/instruments/catalog";
import type { LearningLevel, LearningProgram } from "./types";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/* Level                                                               */
/* ------------------------------------------------------------------ */

export function LevelFormDialog({
  level,
  onClose,
  onSaved,
}: {
  level: LearningLevel;
  onClose: () => void;
  onSaved: (level: LearningLevel) => void;
}) {
  const { notify } = useApp();
  const [name, setName] = useState(level.name);
  const [description, setDescription] = useState(level.description);
  const [notes, setNotes] = useState(level.notes ?? "");
  const [objectives, setObjectives] = useState<string[]>([...level.objectives]);
  const [objectiveDraft, setObjectiveDraft] = useState("");
  const [active, setActive] = useState(level.active);
  const [busy, setBusy] = useState(false);

  const addObjective = () => {
    const text = objectiveDraft.trim();
    if (!text) return;
    setObjectives((prev) => [...prev, text]);
    setObjectiveDraft("");
  };

  const submit = async () => {
    if (name.trim().length < 1) {
      notify({ tone: "danger", title: "نام سطح الزامی است" });
      return;
    }
    setBusy(true);
    try {
      const saved = await getLearningRepository().updateLevel(level.id, {
        name: name.trim(),
        description: description.trim(),
        notes: notes.trim() || undefined,
        objectives,
        active,
      });
      onSaved(saved);
      onClose();
    } catch (cause) {
      notify({ tone: "danger", title: "ذخیرهٔ سطح انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={busy ? () => undefined : onClose}
      title={`ویرایش سطح «${level.name}»`}
      description="توضیح، اهداف و یادداشت این سطح؛ ترتیب آن با جابه‌جایی در فهرست عوض می‌شود، نه اینجا."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy || name.trim().length < 1}>
            {busy ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Field label="نام سطح">
          {(c) => <input {...c} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="توضیح">
          {(c) => (
            <textarea
              {...c}
              rows={2}
              className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>

        <fieldset className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <legend className="px-1 text-[10.5px] text-ink-400">اهداف یادگیری</legend>
          <ul className="space-y-1.5">
            {objectives.map((objective, index) => (
              <li key={`${objective}-${index}`} className="flex items-center gap-2 text-[12px] text-ink-200">
                <span className="min-w-0 flex-1 truncate">{objective}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`حذف هدف: ${objective}`}
                  disabled={busy}
                  onClick={() => setObjectives((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X className="size-3" />
                </Button>
              </li>
            ))}
            {objectives.length === 0 && <li className="text-[11px] text-ink-500">هدفی ثبت نشده است.</li>}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <input
              className={inputCls}
              value={objectiveDraft}
              placeholder="هدف تازه، مثلاً «سلطه بر آرپژ می‌ماژور»"
              onChange={(e) => setObjectiveDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addObjective();
                }
              }}
            />
            <Button size="sm" variant="subtle" onClick={addObjective} disabled={objectiveDraft.trim().length === 0}>
              <Plus className="size-3.5" /> افزودن
            </Button>
          </div>
        </fieldset>

        <Field label="یادداشت" hint="آنچه در توضیح جا نمی‌شود: توصیهٔ مدرس، هشدار، منبع پیشنهادی.">
          {(c) => (
            <textarea
              {...c}
              rows={2}
              className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>

        <Field label="وضعیت">
          {(c) => (
            <select {...c} className={inputCls} value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          )}
        </Field>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Program                                                             */
/* ------------------------------------------------------------------ */

export function ProgramFormDialog({
  program,
  onClose,
  onSaved,
}: {
  program: LearningProgram;
  onClose: () => void;
  onSaved: (program: LearningProgram) => void;
}) {
  const { notify } = useApp();
  const instruments = useInstrumentCatalog();
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description);
  const [instrumentId, setInstrumentId] = useState(program.instrumentId);
  const [active, setActive] = useState(program.active);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      notify({ tone: "danger", title: "نام دوره الزامی است" });
      return;
    }
    setBusy(true);
    try {
      const saved = await getLearningRepository().updateProgram(program.id, {
        name: name.trim(),
        description: description.trim(),
        instrumentId,
        active,
      });
      onSaved(saved);
      onClose();
    } catch (cause) {
      notify({ tone: "danger", title: "ذخیرهٔ دوره انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={busy ? () => undefined : onClose}
      title={`ویرایش دورهٔ «${program.name}»`}
      description="نام دوره همان نامی است که در همهٔ سطح داشبورد دیده می‌شود؛ تغییر آن، همه‌جا همان نام تازه است."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy || name.trim().length < 2}>
            {busy ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Field label="نام دوره">
          {(c) => <input {...c} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="ساز">
          {(c) => (
            <select {...c} className={inputCls} value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
              {instruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.name}
                  {instrument.active ? "" : " (غیرفعال)"}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="توضیح">
          {(c) => (
            <textarea
              {...c}
              rows={2}
              className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <Field label="وضعیت">
          {(c) => (
            <select {...c} className={inputCls} value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          )}
        </Field>
        <p className="text-[10.5px] leading-relaxed text-ink-500">
          سازِ دوره اکنون {instrumentName(program.instrumentId)} است؛ تغییر آن، دوره را در فهرست ساز جدید می‌برد ولی
          سطوح و placements آن دست‌نخورده می‌مانند.
        </p>
      </div>
    </Dialog>
  );
}
