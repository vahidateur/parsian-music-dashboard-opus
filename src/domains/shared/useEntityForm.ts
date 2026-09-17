/**
 * Shared CRUD form state.
 *
 * Every entity dialog needs the same behaviour: hold a draft, run local
 * validation, submit to a repository, surface field errors returned by the
 * repository, and stay disabled while in flight. Implementing it once means a
 * new form cannot accidentally omit the error path — which is how "fake
 * success" states appear (§37).
 *
 * Field errors coming back from a repository (`ApiError.fields`) are merged
 * into the same map as local validation errors, so a rule enforced only by the
 * server (uniqueness, capacity) renders exactly like a local one.
 *
 * A draft is a draft: it describes the record the form is *currently* showing,
 * so it has to be rebuilt whenever that changes. See `open` below — getting
 * this wrong does not merely look odd, it writes one record's values onto
 * another (OPEN_ITEMS H6).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

export interface EntityFormOptions<TDraft, TResult> {
  initial: TDraft;
  /**
   * Whether the surface holding this form is open right now.
   *
   * Entity dialogs stay mounted while closed — `if (!open) return null` runs
   * *after* the hooks — so a draft seeded by `useState(initial)` survives every
   * open/close cycle and every record change. Opening the form for record B
   * then shows whatever was typed for record A, and submitting writes A's
   * values onto B's id. Passing `open` rebuilds the draft from `initial` on
   * each opening, which also restores a clean create form after a cancel.
   *
   * Optional: a form mounted *conditionally* (`{editing && <Dialog …/>}`) is
   * remounted by React and therefore already starts fresh, and a create-only
   * form whose `initial` is a constant has nothing to rebuild.
   */
  open?: boolean;
  /** Pure local validation. Return an empty object when the draft is valid. */
  validate?: (draft: TDraft) => FieldErrors<TDraft>;
  submit: (draft: TDraft) => Promise<TResult>;
  onSuccess?: (result: TResult) => void;
}

export interface EntityFormState<TDraft, TResult> {
  draft: TDraft;
  /** Updates one field and clears its error so the message tracks the edit. */
  set: <K extends keyof TDraft>(key: K, value: TDraft[K]) => void;
  patch: (values: Partial<TDraft>) => void;
  reset: (next?: TDraft) => void;
  errors: FieldErrors<TDraft>;
  /** Error that is not attributable to a single field (network, conflict). */
  formError: ApiError | null;
  submitting: boolean;
  submit: () => Promise<TResult | undefined>;
}

export function useEntityForm<TDraft extends object, TResult>(
  options: EntityFormOptions<TDraft, TResult>,
): EntityFormState<TDraft, TResult> {
  const { initial, open, validate, submit: submitFn, onSuccess } = options;
  const [draft, setDraft] = useState<TDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors<TDraft>>({});
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /*
    The newest `initial`, read at the moment the draft is rebuilt.

    `initial` itself cannot be an effect dependency. Callers build it inline
    from the record they were handed (`initial: toDraft(student)`), so it is a
    fresh object on every render, and depending on it would rebuild the draft
    on each keystroke — wiping what the user is typing, which is the same defect
    wearing the opposite mask. Depending on `open` alone means "rebuild when the
    surface opens", and that is the only moment the record behind the form can
    have changed.
  */
  const latestInitial = useRef(initial);
  latestInitial.current = initial;

  const set = useCallback(<K extends keyof TDraft>(key: K, value: TDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as keyof TDraft & string];
      return next;
    });
  }, []);

  const patch = useCallback((values: Partial<TDraft>) => {
    setDraft((current) => ({ ...current, ...values }));
  }, []);

  // Stable identity (it reads `initial` through the ref), so the effect below
  // can depend on it without re-running on every render.
  const reset = useCallback((next?: TDraft) => {
    setDraft(next ?? latestInitial.current);
    setErrors({});
    setFormError(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (open !== true) return;
    reset();
  }, [open, reset]);

  const submit = useCallback(async (): Promise<TResult | undefined> => {
    if (submitting) return undefined;
    setFormError(null);

    const localErrors = validate?.(draft) ?? {};
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return undefined;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await submitFn(draft);
      onSuccess?.(result);
      return result;
    } catch (cause) {
      // Never swallow: the caller shows a real failure, not a success toast.
      const error = apiErrorFromThrown(cause);
      const mapped: FieldErrors<TDraft> = {};
      for (const [field, messages] of Object.entries(error.fields ?? {})) {
        if (messages.length > 0) mapped[field as keyof TDraft & string] = messages[0];
      }
      if (Object.keys(mapped).length > 0) setErrors(mapped);
      setFormError(error);
      return undefined;
    } finally {
      setSubmitting(false);
    }
  }, [draft, onSuccess, submitFn, submitting, validate]);

  return { draft, set, patch, reset, errors, formError, submitting, submit };
}
