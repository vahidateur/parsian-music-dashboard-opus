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
 */
import { useCallback, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

export interface EntityFormOptions<TDraft, TResult> {
  initial: TDraft;
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
  const { initial, validate, submit: submitFn, onSuccess } = options;
  const [draft, setDraft] = useState<TDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors<TDraft>>({});
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const reset = useCallback(
    (next?: TDraft) => {
      setDraft(next ?? initial);
      setErrors({});
      setFormError(null);
      setSubmitting(false);
    },
    [initial],
  );

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
