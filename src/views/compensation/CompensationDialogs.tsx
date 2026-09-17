/**
 * The compensation surface's three write dialogs: register, book, discharge.
 *
 * They live beside the view for the same reason every entity dialog in this
 * codebase does (`SessionWriteDialogs`, `ClassFormDialog`, …): a form is a draft,
 * a validation pass, an in-flight state and an error surface, and folding three of
 * those into a list surface makes both harder to read.
 *
 * WHAT THESE DIALOGS DO NOT DO
 *
 *   - **They own no compensation rule.** Private eligibility, the frozen student,
 *     the derived status, the one-live-make-up refusal, the terminal refusal, the
 *     duplicate rule, the lineage walk and the roster question all belong to
 *     `src/domains/compensation/` and are stated there. Nothing here re-derives one
 *     of them and nothing works around one: a refusal arrives as an `ApiError`, is
 *     shown verbatim, and is reported upward so the surface can announce it.
 *   - **They never re-point an action at the ledger's own row.** The booking is the
 *     domain's; the session a later action targets is `currentAttempt.sessionId` —
 *     the EFFECTIVE session, resolved through the booking's reschedule lineage
 *     (C-1.1). `bookedSessionId` is shown as history and is never an action target.
 *   - **They copy no attendance.** A mark on the cancelled original is ASKED about,
 *     because the owner's rule refuses to assume it: the checkbox below is the
 *     acknowledgement the domain demands, never a value computed here.
 *   - **They claim nothing that did not happen.** No «هماهنگی انجام شد», no
 *     notification, no SMS. The success copy is written by the caller from the
 *     record the repository actually returned.
 *
 * THE C-2 DISCLOSURE IS SHOWN WHERE IT CAN BE TRUE
 *
 * The domain derives `studentOnRoster` for the EFFECTIVE session's date, and that
 * session does not exist until the domain creates it. So the booking dialog asks
 * the question it is about to put to the domain, and the answer is reported from
 * the record the domain returned — as INFORMATION, never as a gate, with
 * `undefined` rendered as «نامشخص» rather than as a «no».
 */
import { useMemo } from "react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, Toggle, inputCls } from "@/components/ds/patterns";
import { compensationDefaultFor } from "@/domains/compensation/derive";
import type { SessionCompensation } from "@/domains/compensation/types";
import type { AcademyClass } from "@/domains/classes/types";
import type { Room } from "@/domains/rooms/types";
import { jalaliToIso, toMinutes } from "@/domains/scheduling/dateBridge";
import type { Session } from "@/domains/scheduling/types";
import { useSessionRoster } from "@/domains/scheduling/useScheduling";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import type { Teacher } from "@/domains/teachers/types";
import { NO_DATA, faNum, faTime } from "@/lib/format";
// The same Jalali boundary and the same field vocabulary the scheduling dialogs
// use, from ONE place — see views/shared/jalaliInput (audit S-7).
import { FIELD_MESSAGES, jalaliInputValue } from "@/views/shared/jalaliInput";

/** One shared empty draft: a fieldless dialog has nothing else to reset. */
const NO_DRAFT: Record<string, never> = {};

/**
 * The ONE place a refused write is announced and re-thrown (audit S-9).
 *
 * `useEntityForm.submit` never rejects: it catches what the callback throws, turns
 * it into `formError` and returns `undefined`. A refusal must therefore be BOTH
 * recorded on the form and announced to the surface — announced before the throw,
 * because the surface's toast is the copy the operator keeps after the dialog is
 * closed. All three dialogs need exactly that, so the wrapper lives once; the
 * in-flight state, the thrown error and `onSuccess` stay `useEntityForm`'s.
 */
async function announceRefusal<TResult>(
  run: () => Promise<TResult>,
  onRejected: (cause: unknown) => void,
): Promise<TResult> {
  try {
    return await run();
  } catch (cause) {
    onRejected(cause);
    throw cause;
  }
}

/** What the register dialog hands back. The actor is added by the surface. */
export interface RegisterValues {
  originalSessionId: string;
  studentId: string;
  reason: string;
  acknowledgedOriginalAttendance?: boolean;
}

/** What the booking dialog hands back. The actor is added by the surface. */
export interface ScheduleValues {
  date: string;
  startTime: string;
  endTime: string;
  roomId: string;
  teacherId: string;
  acknowledgeWarnings?: boolean;
}

/**
 * A cancelled private session the operator may register.
 *
 * Both parts are VALUES the surface read from a domain: a scheduling session with
 * `status: "cancelled"` and the class it belongs to. The surface selects these with
 * the domain's exported predicates (`isCompensableOriginal`, `isCompensableClass`)
 * — it decides no eligibility itself, and the repository re-decides all of it on
 * the write.
 *
 * The affected student is deliberately NOT part of this candidate: it is derived by
 * the scheduling domain's own roster read, for the selected session's date, inside
 * the dialog below — the same read the repository will require, never a value the
 * surface computed ahead of time.
 */
export interface CompensationCandidate {
  session: Session;
  klass: AcademyClass;
}

/* ================================================================== */
/* Register                                                            */
/* ================================================================== */

interface RegisterDraft {
  originalSessionId: string;
  reason: string;
  /**
   * The owner's rule, made explicit: an attendance mark on the cancelled original
   * is a fact the operator must have seen, not one this form may assume away.
   */
  acknowledged: boolean;
}

/**
 * Presence only.
 *
 * The session's eligibility, the exactly-one-student rule, the duplicate rule and
 * the acknowledgement requirement are NOT checked here: they are the repository's,
 * in its own words, and a form that guesses them ends up telling the user one thing
 * while the write fails on another.
 */
function validateRegister(draft: RegisterDraft): FieldErrors<RegisterDraft> {
  const errors: FieldErrors<RegisterDraft> = {};
  if (draft.originalSessionId.trim().length === 0) errors.originalSessionId = "جلسهٔ لغوشده را انتخاب کنید.";
  if (draft.reason.trim().length === 0) errors.reason = "دلیل نیاز به جبرانی الزامی است.";
  return errors;
}

export function RegisterCompensationDialog({
  open,
  candidates,
  candidatesLoading,
  candidatesUnavailable,
  candidatesWindow,
  candidatesTruncated,
  alreadyRegisteredIsPartial,
  onSubmit,
  onRejected,
  onClose,
  onWritten,
}: {
  open: boolean;
  candidates: readonly CompensationCandidate[];
  candidatesLoading: boolean;
  /** A failed candidate read is REPORTED, never rendered as "nothing to register" (D12). */
  candidatesUnavailable: string | null;
  /**
   * The bounded search behind the list, so the dialog can STATE it (audit S-4):
   * a list whose limits cannot be read looks like the whole world.
   */
  candidatesWindow: {
    from: string;
    to: string;
    daysBack: number;
    daysForward: number;
    perPage: number;
  };
  /** The read reached the page cap: there may be more in the window than is shown. */
  candidatesTruncated: boolean;
  /** The ledger page behind the "already registered" exclusion was itself partial. */
  alreadyRegisteredIsPartial: boolean;
  onSubmit: (values: RegisterValues) => Promise<SessionCompensation>;
  /** The repository refused. The surface announces it; the dialog stays open. */
  onRejected: (cause: unknown) => void;
  onClose: () => void;
  onWritten: (record: SessionCompensation) => void;
}) {
  const initial: RegisterDraft = { originalSessionId: "", reason: "", acknowledged: false };
  const form = useEntityForm<RegisterDraft, SessionCompensation>({
    open,
    initial,
    validate: validateRegister,
    submit: async (draft) => {
      const candidate = candidates.find((c) => c.session.id === draft.originalSessionId);
      // The exactly-one-student rule is the repository's; this only refuses to
      // BUILD a payload that has no student to name. The domain re-decides, and a
      // payload that names the wrong person is refused by it, not here.
      if (!candidate || !roster || roster.length !== 1) {
        // Local impossibility, not a domain refusal: the button is disabled in every
        // state that could produce it. The sentence is Persian because it is shown.
        throw new Error("هنرجوی این جلسه هنوز خوانده نشده است؛ یک لحظه بعد دوباره تلاش کنید.");
      }
      // Announced by the surface AND recorded by the form: a refusal must be heard
      // even when the operator is looking at the list behind the dialog.
      return announceRefusal(
        () =>
          onSubmit({
            originalSessionId: candidate.session.id,
            // The student is the roster row the scheduling domain derived for that
            // date and the one the operator can see on screen — never a typed value.
            studentId: roster[0].studentId,
            reason: draft.reason.trim(),
            ...(draft.acknowledged ? { acknowledgedOriginalAttendance: true } : {}),
          }),
        onRejected,
      );
    },
    onSuccess: onWritten,
  });

  /**
   * THE ROSTER OF THE SELECTED SESSION, read through the scheduling domain's own
   * derived read — the same call the repository will make before it freezes the
   * student. It is what the operator SEES, and the single row it yields is the id
   * this form sends; nothing is decided from it here (no eligibility rule, no
   * counting rule of our own). The hook answers for the id it was given (I13), so
   * a selection change cannot leave the previous session's roster on screen.
   */
  const selectedId = form.draft.originalSessionId;
  const rosterRead = useSessionRoster(selectedId.length > 0 ? selectedId : undefined);
  const roster = rosterRead.data;
  const rosterLoading = rosterRead.loading;
  const rosterUnavailable = rosterRead.error?.message ?? null;

  const selected = candidates.find((c) => c.session.id === form.draft.originalSessionId);
  /*
   * The student this form will name is not known until the roster read answers, so
   * the submit is refused while it is still in flight — never "submitted with a
   * guess". `undefined` is NOT `false`: a read in progress and a read that failed
   * are both "not determinable yet", and neither is treated as "no student".
   */
  const studentNotResolved = selected !== undefined && (rosterLoading || roster === undefined);
  const rosterProblem =
    selected === undefined
      ? null
      : rosterUnavailable
        ? `فهرست هنرجویان این جلسه خوانده نشد: ${rosterUnavailable}`
        : rosterLoading || roster === undefined
          ? null
          : roster.length === 0
            ? "برای این جلسه هنرجویی در فهرست ثبت‌نام فعال نیست؛ ثبت جبرانی ممکن نیست."
            : roster.length > 1
              ? "این جلسه بیش از یک هنرجو دارد؛ جبرانی فقط برای کلاس خصوصی ثبت می‌شود."
              : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="ثبت جبرانی"
      description="جبرانی فقط برای جلسهٔ لغوشدهٔ کلاس خصوصی (یک‌به‌یک) ثبت می‌شود و ثبت آن یک تصمیم انسانی است؛ لغو جلسه به‌تنهایی جبرانی نمی‌سازد."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button
            variant="primary"
            disabled={
              form.submitting ||
              candidates.length === 0 ||
              selected === undefined ||
              studentNotResolved ||
              rosterProblem !== null
            }
            onClick={() => void form.submit()}
          >
            {form.submitting ? "در حال ثبت…" : "ثبت جبرانی"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Always shown: the window is the operator's policy and is readable whether
            the read answered, is in flight, or failed. */}
        <p className="text-[11px] leading-relaxed text-ink-400">
          جستجوی این فهرست محدود است: جلسه‌های لغوشدهٔ{" "}
          <span className="nums">{jalaliInputValue(candidatesWindow.from)}</span> تا{" "}
          <span className="nums">{jalaliInputValue(candidatesWindow.to)}</span> — یعنی{" "}
          {faNum(candidatesWindow.daysBack)} روز پیش تا {faNum(candidatesWindow.daysForward)} روز بعد — و حداکثر{" "}
          {faNum(candidatesWindow.perPage)} ردیف.
          {alreadyRegisteredIsPartial && (
            <> حذف جلسه‌هایی که پیش‌تر جبرانی برایشان ثبت شده از روی فهرست جبرانی‌های خوانده‌شده انجام می‌شود و آن فهرست کامل نیست؛ ثبت تکراری همان جلسه را سامانه در زمان نوشتن رد می‌کند.</>
          )}
        </p>

        {candidatesUnavailable ? (
          <p className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-200">
            فهرست جلسه‌های لغوشده خوانده نشد: {candidatesUnavailable}
          </p>
        ) : candidatesLoading ? (
          <p className="text-[12px] text-ink-400">در حال خواندن جلسه‌های لغوشده…</p>
        ) : candidates.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12px] text-ink-300">
            در همین جستجوی محدود جلسهٔ لغوشدهٔ واجد شرطی پیدا نشد. فقط جلسه‌های لغوشدهٔ کلاس خصوصی که پیش‌تر
            جبرانی برایشان ثبت نشده باشد اینجا دیده می‌شوند؛ ممکن است جلسهٔ موردنظر بیرون از بازهٔ بالا باشد.
          </p>
        ) : null}

        {candidatesTruncated && (
          <p className="rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-warn-200">
            این خواندن به سقف {faNum(candidatesWindow.perPage)} ردیف رسید؛ ممکن است جلسهٔ لغوشدهٔ واجد شرطی در
            همین بازه بیرون از این ردیف‌ها باشد.
          </p>
        )}

        <Field label="جلسهٔ لغوشده" required error={form.errors.originalSessionId}>
          {(a) => (
            <select
              {...a}
              className={inputCls}
              value={form.draft.originalSessionId}
              onChange={(e) => form.set("originalSessionId", e.target.value)}
            >
              <option value="">انتخاب جلسه…</option>
              {candidates.map((c) => (
                <option key={c.session.id} value={c.session.id}>
                  {c.klass.title} · {jalaliInputValue(c.session.date)} · {faTime(c.session.startTime)}
                </option>
              ))}
            </select>
          )}
        </Field>

        {selected && (
          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[12px]">
            <dt className="text-ink-400">هنرجوی این جلسه</dt>
            <dd className="text-ink-100">
              {rosterLoading || roster === undefined
                ? "در حال خواندن…"
                : roster.length === 1
                  ? roster[0].studentName
                  : NO_DATA}
            </dd>
            <dt className="text-ink-400">کلاس</dt>
            <dd className="text-ink-100">{selected.klass.title}</dd>
            <dt className="text-ink-400">دلیل لغو</dt>
            <dd className="text-ink-100">{selected.session.cancelReason ?? NO_DATA}</dd>
          </dl>
        )}

        {rosterProblem && (
          <p className="rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-[12px] text-warn-200">
            {rosterProblem}
          </p>
        )}

        <Field label="دلیل نیاز به جبرانی" required error={form.errors.reason}>
          {(a) => (
            <textarea
              {...a}
              rows={3}
              className={inputCls}
              placeholder="مثلاً: جلسه از سوی مدرس لغو شد و به‌جای آن یک جلسهٔ خصوصی دیگر لازم است."
              value={form.draft.reason}
              onChange={(e) => form.set("reason", e.target.value)}
            />
          )}
        </Field>

        <Toggle
          checked={form.draft.acknowledged}
          onChange={(v) => form.set("acknowledged", v)}
          label="اگر برای این هنرجو در جلسهٔ لغوشده حضور و غیاب ثبت شده است، آن را دیدم و ثبت جبرانی را تأیید می‌کنم."
        />

        {form.formError && (
          <p className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-200">
            {form.formError.message}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/* ================================================================== */
/* Book the make-up                                                    */
/* ================================================================== */

interface ScheduleDraft {
  /** Jalali as typed; converted to ISO only at the boundary. */
  date: string;
  startTime: string;
  endTime: string;
  roomId: string;
  teacherId: string;
  acknowledgeWarnings: boolean;
}

/**
 * Format and presence only — the same division `SessionWriteDialogs` keeps.
 *
 * The duration bounds, the room/teacher clash rules, the off-schedule warning and
 * the "date is not a real Jalali date" refusal are the scheduling domain's, and
 * they are reported by it. A form that guesses them would disagree with the write.
 */
function validateSchedule(draft: ScheduleDraft): FieldErrors<ScheduleDraft> {
  const errors: FieldErrors<ScheduleDraft> = {};
  if (jalaliToIso(draft.date) === null) errors.date = FIELD_MESSAGES.date;
  if (toMinutes(draft.startTime) === null) errors.startTime = FIELD_MESSAGES.startTime;
  if (toMinutes(draft.endTime) === null) errors.endTime = FIELD_MESSAGES.endTime;
  if (draft.roomId.trim().length === 0) errors.roomId = "اتاق را انتخاب کنید.";
  if (draft.teacherId.trim().length === 0) errors.teacherId = "مدرس را انتخاب کنید.";
  return errors;
}

export function ScheduleCompensationDialog({
  open,
  compensation,
  original,
  frozenStudentName,
  classTitle,
  rooms,
  teachers,
  roomsUnavailable,
  teachersUnavailable,
  onSubmit,
  onRejected,
  onClose,
  onWritten,
}: {
  open: boolean;
  /** The read model of the obligation being booked. */
  compensation: SessionCompensation;
  /** The cancelled original, when its row still exists (else `undefined`). */
  original: Session | undefined;
  frozenStudentName: string;
  classTitle: string;
  rooms: readonly Room[];
  teachers: readonly Teacher[];
  /** A failed read offers no picker (D12); the form keeps what the default gave it. */
  roomsUnavailable: boolean;
  teachersUnavailable: boolean;
  onSubmit: (values: ScheduleValues) => Promise<SessionCompensation>;
  onRejected: (cause: unknown) => void;
  onClose: () => void;
  onWritten: (record: SessionCompensation) => void;
}) {
  /*
   * The default is the domain's own `compensationDefaultFor` — the original's date,
   * room and teacher, one hour long — a PREFILL, not a booking and not a search.
   * `null` (the original is gone, or its time is unreadable) simply leaves the
   * fields empty rather than inventing a slot.
   */
  const initial = useMemo<ScheduleDraft>(() => {
    const fallback = compensationDefaultFor(original);
    return {
      date: fallback ? jalaliInputValue(fallback.date) : "",
      startTime: fallback?.startTime ?? "",
      endTime: fallback?.endTime ?? "",
      roomId: fallback?.roomId ?? "",
      teacherId: fallback?.teacherId ?? "",
      acknowledgeWarnings: false,
    };
  }, [original]);

  const form = useEntityForm<ScheduleDraft, SessionCompensation>({
    open,
    initial,
    validate: validateSchedule,
    submit: async (draft) => {
      const date = jalaliToIso(draft.date);
      if (date === null) throw new Error("invalid date");
      return announceRefusal(
        () =>
          onSubmit({
            date,
            startTime: draft.startTime,
            endTime: draft.endTime,
            roomId: draft.roomId,
            teacherId: draft.teacherId,
            ...(draft.acknowledgeWarnings ? { acknowledgeWarnings: true } : {}),
          }),
        onRejected,
      );
    },
    onSuccess: onWritten,
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="ثبت جلسهٔ جبرانی"
      description="جبرانی یک جلسهٔ معمولی از همان کلاس است و با همان قواعد برنامه‌ریزی ساخته می‌شود؛ زمان پیشنهادی همان روز و ساعت جلسهٔ لغوشده است و می‌توانید آن را تغییر دهید."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button variant="primary" disabled={form.submitting} onClick={() => void form.submit()}>
            {form.submitting ? "در حال ثبت…" : "ثبت جلسه"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <dl className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[12px]">
          <dt className="text-ink-400">هنرجوی ثابت‌شده</dt>
          <dd className="text-ink-100">{frozenStudentName}</dd>
          <dt className="text-ink-400">کلاس</dt>
          <dd className="text-ink-100">{classTitle}</dd>
          <dt className="text-ink-400">جلسهٔ لغوشده</dt>
          <dd className="text-ink-100">
            {compensation.originalMissing
              ? "این جلسه حذف شده است؛ زمان پیشنهادی در دسترس نیست."
              : original
                ? `${jalaliInputValue(original.date)} · ${faTime(original.startTime)}`
                : NO_DATA}
          </dd>
        </dl>

        <div className="grid grid-cols-2 gap-3">
          <Field label="تاریخ (شمسی)" required error={form.errors.date}>
            {(a) => (
              <input
                {...a}
                className={inputCls}
                placeholder="۱۴۰۴/۰۷/۰۱"
                value={form.draft.date}
                onChange={(e) => form.set("date", e.target.value)}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="از" required error={form.errors.startTime}>
              {(a) => (
                <input
                  {...a}
                  className={inputCls}
                  placeholder="۱۶:۰۰"
                  value={form.draft.startTime}
                  onChange={(e) => form.set("startTime", e.target.value)}
                />
              )}
            </Field>
            <Field label="تا" required error={form.errors.endTime}>
              {(a) => (
                <input
                  {...a}
                  className={inputCls}
                  placeholder="۱۷:۰۰"
                  value={form.draft.endTime}
                  onChange={(e) => form.set("endTime", e.target.value)}
                />
              )}
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="اتاق" required error={form.errors.roomId} hint={roomsUnavailable ? "فهرست اتاق‌ها خوانده نشد." : undefined}>
            {(a) => (
              <select
                {...a}
                className={inputCls}
                disabled={roomsUnavailable}
                value={form.draft.roomId}
                onChange={(e) => form.set("roomId", e.target.value)}
              >
                <option value="">{roomsUnavailable ? "نامشخص" : "انتخاب اتاق…"}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="مدرس" required error={form.errors.teacherId} hint={teachersUnavailable ? "فهرست مدرسین خوانده نشد." : undefined}>
            {(a) => (
              <select
                {...a}
                className={inputCls}
                disabled={teachersUnavailable}
                value={form.draft.teacherId}
                onChange={(e) => form.set("teacherId", e.target.value)}
              >
                <option value="">{teachersUnavailable ? "نامشخص" : "انتخاب مدرس…"}</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {/*
          The consent is GENERALISED because the rule it satisfies is (audit S-2):
          the scheduling domain refuses while ANY warning is unacknowledged, and the
          old label named only the off-schedule one — an operator could tick it and
          still meet a refusal they were never told about. The kinds are listed; what
          makes each one a warning, and what is refused regardless, is the domain's
          and is not restated here.
        */}
        <Toggle
          checked={form.draft.acknowledgeWarnings}
          onChange={(v) => form.set("acknowledgeWarnings", v)}
          label="هشدارهای برنامه‌ریزی این ثبت را می‌پذیرم."
        />

        <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-ink-400">
          این پذیرش همهٔ هشدارهایی را پوشش می‌دهد که سامانه برای این تاریخ و ساعت می‌دهد: روز خارج از روزهای
          معمول کلاس، هم‌زمانی با جلسهٔ دیگری که هنرجوهایش با این کلاس مشترک‌اند، و غیرفعال بودن مدرس یا اتاق در
          آن بازه.
        </p>

        <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-ink-400">
          وضعیت «هنرجو در فهرست این روز» پس از ثبت جلسه از خود سامانه خوانده می‌شود و فقط برای اطلاع شماست؛
          پایان یا تغییر ثبت‌نام، ثبت جبرانی را متوقف نمی‌کند.
        </p>

        {form.formError && (
          <p className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-200">
            {form.formError.message}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/* ================================================================== */
/* Discharge                                                           */
/* ================================================================== */

export function CompleteCompensationDialog({
  open,
  compensation,
  frozenStudentName,
  effectiveLabel,
  onSubmit,
  onRejected,
  onClose,
  onWritten,
}: {
  open: boolean;
  compensation: SessionCompensation;
  frozenStudentName: string;
  /** The EFFECTIVE session, already rendered by the surface for display. */
  effectiveLabel: string;
  onSubmit: () => Promise<SessionCompensation>;
  onRejected: (cause: unknown) => void;
  onClose: () => void;
  onWritten: (record: SessionCompensation) => void;
}) {
  /*
   * This dialog has NO fields: the decision is the whole form. `useEntityForm` is
   * still the right holder for it, because the parts that matter — the in-flight
   * state that stops a double discharge, and the single place a refusal is turned
   * into a message — are exactly what it provides. A draft of `{}` (one shared,
   * never-mutated object) keeps `initial` stable; there is no record to rebuild.
   */
  const form = useEntityForm<Record<string, never>, SessionCompensation>({
    open,
    initial: NO_DRAFT,
    submit: () => announceRefusal(() => onSubmit(), onRejected),
    onSuccess: onWritten,
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="ثبت انجام جبرانی"
      description="این ثبت، تصمیم نهایی دربارهٔ این جبرانی است و پس از آن جبرانی دیگری برای همین جلسه و هنرجو ثبت نمی‌شود."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button variant="primary" disabled={form.submitting} onClick={() => void form.submit()}>
            {form.submitting ? "در حال ثبت…" : "ثبت انجام"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <dl className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[12px]">
          <dt className="text-ink-400">هنرجو</dt>
          <dd className="text-ink-100">{frozenStudentName}</dd>
          <dt className="text-ink-400">جلسهٔ جبرانی</dt>
          <dd className="text-ink-100">{effectiveLabel}</dd>
          {compensation.currentAttempt && compensation.currentAttempt.rescheduleCount > 0 && (
            <>
              <dt className="text-ink-400">جابه‌جایی‌ها</dt>
              <dd className="text-ink-100">{faNum(compensation.currentAttempt.rescheduleCount)} بار</dd>
              <dt className="text-ink-400">جلسهٔ نخستین ثبت</dt>
              <dd className="text-ink-400">{compensation.currentAttempt.bookedSessionId}</dd>
            </>
          )}
        </dl>

        <p className="rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-[11px] leading-relaxed text-warn-200">
          حضور و غیاب جلسهٔ جبرانی شرط ثبت انجام نیست؛ این ثبت، تصمیم شما دربارهٔ انجام‌شدن جبرانی است.
        </p>

        {form.formError && (
          <p className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-200">
            {form.formError.message}
          </p>
        )}
      </div>
    </Dialog>
  );
}
