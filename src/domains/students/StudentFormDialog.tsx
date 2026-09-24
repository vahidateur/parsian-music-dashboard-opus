/**
 * Student create/edit dialog.
 *
 * Persistence goes through `StudentRepository` only — the form has no idea
 * whether a demo store or an HTTP API answered. Validation is deliberately
 * duplicated in two places with different jobs: this component gives fast,
 * field-level feedback, while the repository owns the real invariants
 * (national-ID checksum and uniqueness). Repository field errors are merged
 * into the same error map, so a rule the UI cannot check locally still lands
 * on the right input.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { InstrumentId } from "@/domains/instruments/types";
import { useInstrumentCatalog } from "@/domains/instruments/catalog";
import { studentStatusLabel, type Student, type StudentStatus } from "./types";
import type { PaymentStatus } from "@/lib/financeVocabulary";
import { nationalIdError, normalizeNationalId } from "@/lib/nationalId";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, inputCls } from "@/components/ds/patterns";
import { getMediaRepository, getStudentRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { ProfilePhotoField } from "@/domains/media/ProfilePhotoField";
import { releaseStagedMedia } from "@/domains/media/release";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { cn } from "@/utils/cn";
import type { CreateStudentInput } from "./types";

interface StudentDraft {
  name: string;
  /** `MediaAsset.id` of the profile photo; undefined when none. */
  photoMediaId?: string;
  nationalId: string;
  instrument: InstrumentId;
  teacherId: string;
  status: StudentStatus;
  phone: string;
  guardian: string;
  age: string;
  level: string;
  sessionsTotal: string;
}

const STATUSES = Object.keys(studentStatusLabel) as StudentStatus[];

function toDraft(student?: Student): StudentDraft {
  return {
    name: student?.name ?? "",
    photoMediaId: student?.photoMediaId,
    nationalId: student?.nationalId ?? "",
    instrument: student?.instrument ?? "piano",
    teacherId: student?.teacherId ?? "",
    status: student?.status ?? "active",
    phone: student?.phone ?? "",
    guardian: student?.guardian ?? "",
    age: student ? String(student.age) : "",
    level: student?.level ?? "سطح ۱ · پایه",
    sessionsTotal: student ? String(student.sessionsTotal) : "12",
  };
}

function validate(draft: StudentDraft): FieldErrors<StudentDraft> {
  const errors: FieldErrors<StudentDraft> = {};
  if (draft.name.trim().length < 2) errors.name = "نام هنرجو الزامی است.";

  // The checksum is validated locally so the user is not forced into a
  // round-trip for a typo. Uniqueness is not checkable here — the repository
  // owns it.
  const idError = nationalIdError(draft.nationalId);
  if (idError) errors.nationalId = idError;

  if (!draft.teacherId) errors.teacherId = "انتخاب مدرس الزامی است.";
  if (!/^[0-9۰-۹\s+·-]{6,}$/.test(draft.phone.trim())) errors.phone = "شمارهٔ تماس معتبر نیست.";

  const age = Number(draft.age);
  if (!Number.isInteger(age) || age < 3 || age > 99) errors.age = "سن باید بین ۳ تا ۹۹ باشد.";

  const sessions = Number(draft.sessionsTotal);
  if (!Number.isInteger(sessions) || sessions < 1 || sessions > 200) {
    errors.sessionsTotal = "تعداد جلسات باید بین ۱ تا ۲۰۰ باشد.";
  }
  return errors;
}

export function StudentFormDialog({
  open,
  student,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Present for edit, absent for create. */
  student?: Student;
  onClose: () => void;
  onSaved: (student: Student, mode: "create" | "edit") => void;
}) {
  const editing = student !== undefined;
  const catalog = useInstrumentCatalog();

  /*
    Offer active instruments, plus whichever one this record already uses so an
    existing assignment is never silently dropped from the picker just because
    the instrument was later deactivated.
  */
  const instrumentOptions = useMemo(() => {
    const current = student?.instrument;
    return catalog.filter((i) => i.active || i.id === current);
  }, [catalog, student]);

  const repository = useMemo(() => getStudentRepository(), []);
  // Only active teachers can be assigned to a new student.
  const { items: teachers, loading: teachersLoading, error: teachersError, reload: reloadTeachers } = useTeachers({ assignableOnly: true, per_page: 200 });

  /*
    UPLOADS THIS DIALOG CREATED AND NEVER PERSISTED.

    The photo field no longer deletes anything (see its header), so the two
    transitions are split by who can know about them: an upload that never
    reached a record — cancelled, or replaced before saving — is freed here,
    while the previously PERSISTED photo is freed by the repository once its
    write has stopped referencing it. This set is what makes the difference
    knowable: an id is in it only because this session's upload produced it.
  */
  const stagedPhotos = useRef<Set<string>>(new Set());

  const releaseStagedPhotos = useCallback((keep?: string) => {
    const abandoned = [...stagedPhotos.current].filter((id) => id !== keep);
    stagedPhotos.current.clear();
    for (const id of abandoned) {
      // No record has ever referenced these. A failure is returned and reported
      // by the media domain, not swallowed here (media/release.ts).
      void releaseStagedMedia(id, getMediaRepository());
    }
  }, []);

  /*
    Session boundary. Opening starts with nothing staged — the previous
    session's leftovers are settled as it closes — and closing abandons whatever
    never reached the record, whichever way it was closed: cancel, Escape, the
    backdrop, or the successful save below.
  */
  useEffect(() => {
    if (open) {
      stagedPhotos.current.clear();
      return;
    }
    releaseStagedPhotos();
  }, [open, releaseStagedPhotos]);

  const form = useEntityForm<StudentDraft, Student>({
    initial: toDraft(student),
    open, // H6: rebuild the draft from this record whenever the dialog opens
    validate,
    submit: async (draft) => {
      const payload = {
        nationalId: normalizeNationalId(draft.nationalId),
        name: draft.name.trim(),
        photoMediaId: draft.photoMediaId,
        instrument: draft.instrument,
        teacherId: draft.teacherId,
        status: draft.status,
        phone: draft.phone.trim(),
        guardian: draft.guardian.trim() || undefined,
        age: Number(draft.age),
        level: draft.level.trim(),
        sessionsTotal: Number(draft.sessionsTotal),
      };
      if (editing) return repository.update(student.id, payload);

      // Fields a new student cannot meaningfully have yet.
      const created: CreateStudentInput = {
        ...payload,
        levelStep: 1,
        payment: "paid" as PaymentStatus,
        sessionsUsed: 0,
        attendance: 100,
        progress: 0,
        since: "امروز",
        lastSeen: "امروز",
        balance: 0,
      };
      return repository.create(created);
    },
    onSuccess: (saved) => {
      /*
        The record now references the photo it was saved with, so that id is no
        longer a staged upload and must survive this dialog's closing cleanup.
        The photo it replaced was released by the repository — after this write,
        never before it.
      */
      if (saved.photoMediaId) stagedPhotos.current.delete(saved.photoMediaId);
      onSaved(saved, editing ? "edit" : "create");
      onClose();
    },
  });

  /**
   * The photo field hands over both ids: what the draft now points at, and the
   * asset it stopped pointing at. Only a staged one can be freed immediately —
   * it was never referenced by a record — and the rest is the repository's call
   * after a successful write.
   */
  const changePhoto = (next: string | undefined, released: string | undefined) => {
    if (next) stagedPhotos.current.add(next);
    if (released && stagedPhotos.current.has(released)) {
      stagedPhotos.current.delete(released);
      void releaseStagedMedia(released, getMediaRepository());
    }
    form.set("photoMediaId", next);
  };

  if (!open) return null;

  const busy = form.submitting;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={editing ? `ویرایش ${student.name}` : "هنرجوی جدید"}
      description={
        editing
          ? "تغییرات پس از ذخیره در همهٔ بخش‌های مرتبط اعمال می‌شود."
          : "کد ملی الزامی است و باید یکتا و معتبر باشد."
      }
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ تغییرات" : "افزودن هنرجو"}
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
        {/* A persistence failure is stated plainly; the dialog stays open. */}
        {form.formError && !Object.keys(form.errors).length && (
          <p role="alert" className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            {form.formError.message}
          </p>
        )}

        {teachersError && (
          <p role="alert" className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            بارگذاری مدرسان ناموفق بود: {teachersError.message}{" "}
            <button type="button" className="underline" onClick={reloadTeachers}>
              تلاش دوباره
            </button>
          </p>
        )}

        <div className="sm:col-span-2">
          <ProfilePhotoField
            mediaId={form.draft.photoMediaId}
            personName={form.draft.name || "هنرجو"}
            disabled={busy}
            onChange={changePhoto}
          />
        </div>

        <Field label="نام و نام خانوادگی" error={form.errors.name} required className="sm:col-span-2">
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
          label="کد ملی"
          hint="۱۰ رقم"
          error={form.errors.nationalId}
          required
          className="sm:col-span-2"
        >
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              value={form.draft.nationalId}
              disabled={busy}
              onChange={(e) => form.set("nationalId", e.target.value)}
            />
          )}
        </Field>

        <Field label="ساز" required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.instrument}
              disabled={busy}
              onChange={(e) => form.set("instrument", e.target.value as InstrumentId)}
            >
              {instrumentOptions.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="مدرس" error={form.errors.teacherId} required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.teacherId}
              disabled={busy || !!teachersLoading || !!teachersError}
              onChange={(e) => form.set("teacherId", e.target.value)}
            >
              <option value="">
                {teachersLoading ? "در حال بارگذاری…" : teachersError ? "خطا در بارگذاری" : "— انتخاب کنید —"}
              </option>
              {!teachersError &&
                teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
            </select>
          )}
        </Field>

        <Field label="وضعیت" required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.status}
              disabled={busy}
              onChange={(e) => form.set("status", e.target.value as StudentStatus)}
            >
              {STATUSES.map((key) => (
                <option key={key} value={key}>
                  {studentStatusLabel[key]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="سن" error={form.errors.age} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              value={form.draft.age}
              disabled={busy}
              onChange={(e) => form.set("age", e.target.value)}
            />
          )}
        </Field>

        <Field label="شمارهٔ تماس" error={form.errors.phone} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              dir="ltr"
              value={form.draft.phone}
              disabled={busy}
              onChange={(e) => form.set("phone", e.target.value)}
            />
          )}
        </Field>

        <Field label="ولی / سرپرست" hint="اختیاری">
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.guardian}
              disabled={busy}
              onChange={(e) => form.set("guardian", e.target.value)}
            />
          )}
        </Field>

        <Field label="سطح">
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.level}
              disabled={busy}
              onChange={(e) => form.set("level", e.target.value)}
            />
          )}
        </Field>

        <Field label="کل جلسات دوره" error={form.errors.sessionsTotal} required>
          {(control) => (
            <input
              {...control}
              className={cn(inputCls, "nums")}
              inputMode="numeric"
              value={form.draft.sessionsTotal}
              disabled={busy}
              onChange={(e) => form.set("sessionsTotal", e.target.value)}
            />
          )}
        </Field>

        {/* Enter submits, matching the primary button. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
