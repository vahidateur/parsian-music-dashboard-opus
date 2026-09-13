/**
 * The scheduling view's generation dialog (M4 / CP3).
 *
 * Generation is the one scheduling write that produces many records at once, so
 * it is also the one that can do the most damage quietly. This form therefore
 * does almost nothing itself: it collects a class and a window, asks the domain
 * what that would mean, and hands the same window to the repository.
 *
 * WHAT THIS DIALOG DOES NOT DO
 *
 *   - **It does not plan.** Every number on screen — creates, updates, skips by
 *     reason, orphans, conflicts — comes from `useGenerationPreview`, which is
 *     `previewGeneration` on the repository. The pure planner
 *     (`domains/scheduling/generation.ts`) owns the recurrence expansion, the
 *     deterministic slot ids, the protections (past, cancelled, manual,
 *     attendance-bearing) and the orphan report. A second copy of any of that in
 *     a form would eventually disagree with the engine that enforces it.
 *   - **It does not label.** Skip reasons are rendered through the domain's own
 *     `SKIP_REASON_LABEL`, and the plan's summary through `summarizePlan`, so the
 *     words the user reads are the words the domain wrote.
 *   - **It does not decide what a preview means.** The preview is advisory and
 *     says so: `generateSessions` re-plans immediately before writing, so a plan
 *     that looked clean a minute ago can still be refused — and the refusal
 *     arrives verbatim.
 *   - **It does not invent consent.** Warnings are shown, not gated: the
 *     generation contract refuses hard conflicts and asks for `confirmUpdates`
 *     before touching an existing session, and those are the only two gates this
 *     form renders. Adding a third would be policy the domain never stated.
 *   - **It claims nothing.** No notification, no SMS, no server, no «تعارض برطرف
 *     شد». The success copy is written by the caller from the `GenerationResult`
 *     the repository actually returned, including the case where that result says
 *     nothing was written.
 *
 * Orphans are reported and never offered for deletion: this checkpoint exposes no
 * delete control at all (E-2), and the domain's own rule is that an orphaned
 * session is surfaced for an explicit decision rather than removed as a side
 * effect of regenerating.
 */
import { useMemo } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, Toggle, inputCls } from "@/components/ds/patterns";
import type { AcademyClass } from "@/domains/classes/types";
import { isoToJalaliDisplay, jalaliToIso } from "@/domains/scheduling/dateBridge";
import { isNoopPlan, summarizePlan } from "@/domains/scheduling/generation";
import {
  SKIP_REASON_LABEL,
  type GenerateInput,
  type GenerationResult,
  type SkipReason,
} from "@/domains/scheduling/types";
import { useGenerationPreview } from "@/domains/scheduling/useScheduling";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { NO_DATA, faNum, faTime } from "@/lib/format";
import { cn } from "@/utils/cn";
import { jalaliDayLabel } from "./SessionWriteDialogs";

/** Jalali, as the user reads it and as `jalaliToIso` reads it back. */
const DATE_INPUT_OPTIONS = { year: "numeric", month: "2-digit", day: "2-digit" } as const;

function jalaliInputValue(iso: string): string {
  const display = isoToJalaliDisplay(iso, DATE_INPUT_OPTIONS);
  return display.length > 0 ? display : "";
}

/** A short Jalali range, for the dialog's own description line. */
function jalaliRange(from: string, to: string): string {
  const start = isoToJalaliDisplay(from, { day: "numeric", month: "short" });
  const end = isoToJalaliDisplay(to, { day: "numeric", month: "short" });
  if (start.length === 0 || end.length === 0) return NO_DATA;
  return `${start} – ${end}`;
}

/** How many planned rows are spelled out before the list says «و N مورد دیگر». */
const LISTED_CREATES = 6;
const LISTED_UPDATES = 3;
const LISTED_ORPHANS = 3;

interface GenerateDraft {
  classId: string;
  /** Jalali as typed; converted to ISO only at the boundary. */
  from: string;
  to: string;
  /**
   * The domain applies planned updates only when this is true, and defaults to
   * false: regenerating must never rewrite an existing session as a side effect.
   */
  confirmUpdates: boolean;
}

/**
 * Format and presence only.
 *
 * The window's own rules — an end before a start, a span beyond
 * `MAX_GENERATION_DAYS`, an archived class, a class whose time is unusable — are
 * the planner's, and it reports them as hard conflicts that this form then shows
 * in the domain's words and refuses to submit past. Guessing them here would give
 * the user two answers and block nothing the repository would not block anyway.
 */
function validate(draft: GenerateDraft): FieldErrors<GenerateDraft> {
  const errors: FieldErrors<GenerateDraft> = {};
  if (draft.classId.trim().length === 0) errors.classId = "کلاس را انتخاب کنید.";
  if (jalaliToIso(draft.from) === null) errors.from = "تاریخ شروع را به شکل ۱۴۰۴/۰۷/۰۱ وارد کنید.";
  if (jalaliToIso(draft.to) === null) errors.to = "تاریخ پایان را به شکل ۱۴۰۴/۰۷/۰۱ وارد کنید.";
  return errors;
}

export function GenerateSessionsDialog({
  open,
  classes,
  classesUnavailable,
  defaultFrom,
  defaultTo,
  onSubmit,
  onRejected,
  onGenerated,
  onClose,
}: {
  open: boolean;
  /** The classes the view read. The picker has no other source. */
  classes: readonly AcademyClass[];
  /** A failed read offers no picker (D12) and no generation. */
  classesUnavailable: boolean;
  /** The window the calendar is showing, as the form's starting proposal. */
  defaultFrom: string;
  defaultTo: string;
  onSubmit: (input: GenerateInput) => Promise<GenerationResult>;
  /** The repository refused. The caller announces it; the dialog stays open. */
  onRejected: (cause: unknown) => void;
  /** The repository answered. Only then is anything claimed. */
  onGenerated: (result: GenerationResult) => void;
  onClose: () => void;
}) {
  const form = useEntityForm<GenerateDraft, GenerationResult>({
    initial: {
      // No class is ever preselected: the drawer that would carry one covers this
      // dialog's own entry point, and a generation the user did not aim is worse
      // than one extra click. The window, by contrast, is the calendar's own.
      classId: "",
      from: jalaliInputValue(defaultFrom),
      to: jalaliInputValue(defaultTo),
      confirmUpdates: false,
    },
    // The draft is rebuilt from the CURRENT window every time the dialog opens, so
    // a calendar the user has since moved cannot be generated for behind their
    // back — and nothing typed for one class follows to the next opening.
    open,
    validate,
    submit: async (draft) => {
      const from = jalaliToIso(draft.from.trim());
      const to = jalaliToIso(draft.to.trim());
      if (draft.classId.trim().length === 0 || from === null || to === null) {
        throw new Error("generation without a readable class and window");
      }
      try {
        return await onSubmit({ classId: draft.classId.trim(), from, to, confirmUpdates: draft.confirmUpdates });
      } catch (cause) {
        onRejected(cause);
        // Re-thrown so `useEntityForm` records the message and maps the
        // repository's own `fields` (a window refusal renders on the window).
        throw cause;
      }
    },
    onSuccess: (result) => {
      onGenerated(result);
      onClose();
    },
  });

  /*
    The window the domain is asked about. `undefined` while the class or a date is
    unreadable: there is no plan to request yet, and the hook reports
    not-in-flight rather than fetching a question nobody can answer.
  */
  const previewInput = useMemo<GenerateInput | undefined>(() => {
    if (!open) return undefined;
    if (form.draft.classId.trim().length === 0) return undefined;
    const from = jalaliToIso(form.draft.from.trim());
    const to = jalaliToIso(form.draft.to.trim());
    if (from === null || to === null) return undefined;
    return { classId: form.draft.classId.trim(), from, to, confirmUpdates: form.draft.confirmUpdates };
  }, [open, form.draft.classId, form.draft.from, form.draft.to, form.draft.confirmUpdates]);

  const preview = useGenerationPreview(previewInput);
  const plan = preview.data;
  const hard = plan?.conflicts.hard ?? [];
  const warnings = plan?.conflicts.warnings ?? [];
  const summary = plan === undefined ? undefined : summarizePlan(plan);
  const busy = form.submitting;

  const chosenClass = classes.find((candidate) => candidate.id === form.draft.classId);
  const noClassToPick = !classesUnavailable && classes.length === 0;
  /**
   * Blocked only by what the domain itself blocks on: an outstanding preview, a
   * hard conflict (which `generateSessions` would refuse), or no class to ask
   * about. A plan that writes nothing is NOT blocked — an idempotent re-run is a
   * real repository answer, and reporting it truthfully is more useful than
   * pretending the button cannot be pressed.
   */
  const blockedByPlan =
    classesUnavailable ||
    noClassToPick ||
    previewInput === undefined ||
    preview.loading ||
    plan === undefined ||
    hard.length > 0;
  const writesNothing = plan !== undefined && isNoopPlan(plan, form.draft.confirmUpdates);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="تولید جلسات"
      description={
        previewInput === undefined
          ? "جلسات از تکرار هفتگی خود کلاس ساخته می‌شوند، برای بازه‌ای که شما انتخاب می‌کنید."
          : `پیش‌نمایش برای ${chosenClass?.title ?? NO_DATA} در بازهٔ ${jalaliRange(previewInput.from, previewInput.to)}`
      }
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy || blockedByPlan}>
            {busy ? "در حال تولید…" : preview.loading ? "در حال محاسبهٔ پیش‌نمایش…" : "تولید جلسات"}
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

        {/* The class list is the view's own read. A read that failed offers no
            picker: generating for a class nobody could choose would be a guess. */}
        <Field label="کلاس" error={form.errors.classId} required className="sm:col-span-2">
          {(control) =>
            classesUnavailable ? (
              <p className="text-[11.5px] leading-relaxed text-ink-400">
                فهرست کلاس‌ها خوانده نشد؛ بدون کلاس نمی‌توان جلسه تولید کرد.
              </p>
            ) : noClassToPick ? (
              <p className="text-[11.5px] leading-relaxed text-ink-400">
                کلاسی در این محیط خوانده نشد؛ تولید بدون کلاس انجام نمی‌شود.
              </p>
            ) : (
              <select
                {...control}
                className={inputCls}
                value={form.draft.classId}
                disabled={busy}
                onChange={(event) => form.set("classId", event.target.value)}
              >
                {form.draft.classId === "" && <option value="">انتخاب کلاس…</option>}
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.title}
                    {klass.status === "archived" ? " (بایگانی‌شده)" : ""}
                  </option>
                ))}
              </select>
            )
          }
        </Field>

        <Field label="از تاریخ" error={form.errors.from} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              dir="rtl"
              value={form.draft.from}
              disabled={busy}
              onChange={(event) => form.set("from", event.target.value)}
            />
          )}
        </Field>

        <Field label="تا تاریخ" error={form.errors.to} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              dir="rtl"
              value={form.draft.to}
              disabled={busy}
              onChange={(event) => form.set("to", event.target.value)}
            />
          )}
        </Field>

        {/* The recurrence is stated, not derived here: these are the class's own
            fields as the read returned them. */}
        {chosenClass && (
          <p className="sm:col-span-2 text-[11.5px] leading-relaxed text-ink-300">
            تکرار کلاس: ساعت {faTime(chosenClass.time)} به مدت {faNum(chosenClass.duration)} دقیقه.
            جلسات در همین روزهای هفته و با همین ساعت ساخته می‌شوند.
          </p>
        )}

        {previewInput !== undefined && preview.loading && (
          <p className="sm:col-span-2 text-[11.5px] text-ink-400">در حال محاسبهٔ پیش‌نمایش این بازه…</p>
        )}

        {preview.error !== null && (
          <div
            role="alert"
            className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2.5"
          >
            <p className="text-[12px] leading-relaxed text-danger-400">
              پیش‌نمایش خوانده نشد: {preview.error.message}
            </p>
            <Button size="sm" variant="ghost" className="mt-1.5" onClick={preview.reload} disabled={busy}>
              تلاش دوباره
            </Button>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              بدون پیش‌نمایش چیزی دربارهٔ این بازه گفته نمی‌شود؛ انبار هنگام نوشتن دوباره برنامه‌ریزی
              می‌کند.
            </p>
          </div>
        )}

        {hard.length > 0 && (
          <div
            role="alert"
            className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2.5"
          >
            <p className="text-[12px] font-medium text-danger-400">تولید برای این بازه ممکن نیست</p>
            <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-ink-200">
              {hard.map((item, index) => (
                <li key={`${item.kind}-${index}`}>{item.message}</li>
              ))}
            </ul>
          </div>
        )}

        {summary !== undefined && hard.length === 0 && (
          <div className="sm:col-span-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-[12px] font-medium text-ink-100">
              {faNum(summary.creates)} ایجاد · {faNum(summary.updates)} به‌روزرسانی ·{" "}
              {faNum(plan?.skips.length ?? 0)} بدون نوشتن
            </p>

            {writesNothing && (
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-300">
                این بازه نوشتنی ندارد: یا پیش‌تر تولید شده یا همهٔ خانه‌های آن محافظت‌شده‌اند. تولید
                اجرا می‌شود و جلسه‌ای اضافه نمی‌کند.
              </p>
            )}

            {(plan?.creates.length ?? 0) > 0 && (
              <ul className="nums mt-2 space-y-1 text-[11.5px] leading-relaxed text-ink-200">
                {plan!.creates.slice(0, LISTED_CREATES).map((slot) => (
                  <li key={slot.id}>
                    {jalaliDayLabel(slot.date)} · {faTime(slot.startTime)}–{faTime(slot.endTime)}
                  </li>
                ))}
                {plan!.creates.length > LISTED_CREATES && (
                  <li className="text-ink-400">و {faNum(plan!.creates.length - LISTED_CREATES)} مورد دیگر</li>
                )}
              </ul>
            )}

            {Object.keys(summary.skipped).length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-white/[0.07] pt-2 text-[11px] leading-relaxed text-ink-300">
                {(Object.entries(summary.skipped) as [SkipReason, number][]).map(([reason, count]) => (
                  <li key={reason}>
                    {faNum(count)} × {SKIP_REASON_LABEL[reason] ?? reason}
                  </li>
                ))}
              </ul>
            )}

            {(plan?.updates.length ?? 0) > 0 && (
              <div className="mt-2.5 border-t border-white/[0.07] pt-2.5">
                <ul className="space-y-1 text-[11.5px] leading-relaxed text-ink-200">
                  {plan!.updates.slice(0, LISTED_UPDATES).map((change) => (
                    <li key={change.sessionId}>
                      {jalaliDayLabel(change.next.date)}: {faTime(change.current.startTime)}–
                      {faTime(change.current.endTime)} ← {faTime(change.next.startTime)}–
                      {faTime(change.next.endTime)}
                    </li>
                  ))}
                  {plan!.updates.length > LISTED_UPDATES && (
                    <li className="text-ink-400">و {faNum(plan!.updates.length - LISTED_UPDATES)} مورد دیگر</li>
                  )}
                </ul>
                <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-2.5">
                  <span className="text-[11.5px] leading-relaxed text-ink-200">
                    این {faNum(plan!.updates.length)} جلسهٔ موجود هم به‌روزرسانی شوند
                  </span>
                  <Toggle
                    checked={form.draft.confirmUpdates}
                    onChange={(value) => form.set("confirmUpdates", value)}
                    label="به‌روزرسانی جلسات موجود"
                  />
                </div>
                {!form.draft.confirmUpdates && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
                    بدون این تأیید، جلسات موجود دست‌نخورده می‌مانند و فقط خانه‌های خالی ساخته می‌شوند.
                  </p>
                )}
              </div>
            )}

            {(plan?.orphans.length ?? 0) > 0 && (
              <div className="mt-2.5 border-t border-white/[0.07] pt-2.5">
                <p className="text-[11.5px] font-medium text-warn-400">
                  {faNum(plan!.orphans.length)} جلسهٔ آینده با تکرار کنونی کلاس نمی‌خواند
                </p>
                <ul className="nums mt-1 space-y-1 text-[11px] leading-relaxed text-ink-300">
                  {plan!.orphans.slice(0, LISTED_ORPHANS).map((orphan) => (
                    <li key={orphan.sessionId}>
                      {jalaliDayLabel(orphan.date)} · {faTime(orphan.startTime)}
                    </li>
                  ))}
                  {plan!.orphans.length > LISTED_ORPHANS && (
                    <li className="text-ink-400">و {faNum(plan!.orphans.length - LISTED_ORPHANS)} مورد دیگر</li>
                  )}
                </ul>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
                  این جلسات حذف نمی‌شوند؛ تنها گزارش شده‌اند تا درباره‌شان جداگانه تصمیم بگیرید.
                </p>
              </div>
            )}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="sm:col-span-2 rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2.5">
            <p className="text-[12px] font-medium text-warn-400">هشدار</p>
            <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-ink-200">
              {warnings.slice(0, LISTED_CREATES).map((item, index) => (
                <li key={`${item.kind}-${index}`}>{item.message}</li>
              ))}
              {warnings.length > LISTED_CREATES && (
                <li className="text-ink-400">و {faNum(warnings.length - LISTED_CREATES)} مورد دیگر</li>
              )}
            </ul>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
              هشدارها نوشتن را متوقف نمی‌کنند؛ تعارض سخت متوقف می‌کند.
            </p>
          </div>
        )}

        {plan !== undefined && hard.length === 0 && (
          <p className="sm:col-span-2 text-[11.5px] leading-relaxed text-ink-400">
            این یک پیش‌نمایش است. انبار هنگام نوشتن دوباره برنامه‌ریزی می‌کند و همان لحظه تصمیم
            می‌گیرد؛ بنابراین ممکن است نتیجه با آنچه اینجا دیده‌اید تفاوت کند.
          </p>
        )}

        <p className="sm:col-span-2 text-[11px] leading-relaxed text-ink-500">
          جلسات گذشته، لغوشده، دستی و دارای حضور و غیاب تغییر نمی‌کنند و هیچ جلسه‌ای حذف
          نمی‌شود. اطلاع‌رسانی به مدرس یا هنرجو انجام نمی‌شود.
        </p>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
