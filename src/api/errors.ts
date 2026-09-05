import type { ApiErrorPayload } from "./types";

/**
 * Normalized error taxonomy. Every failure that crosses the API boundary is
 * converted into exactly one of these kinds so views/hooks never have to
 * inspect HTTP status codes.
 */
export type ApiErrorKind =
  | "network"
  | "timeout"
  | "cancelled"
  | "authentication"
  | "authorization"
  | "validation"
  | "not_found"
  | "conflict"
  | "server"
  | "unknown";

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  /** HTTP status when the failure came from a response. */
  status?: number;
  /** Domain code, e.g. "SCHEDULE_VERSION_CONFLICT". */
  code?: string;
  /** Field -> messages (validation). */
  fields?: Record<string, string[]>;
  /** Raw payload, for diagnostics only. */
  payload?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly cause?: unknown;
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly fields?: Record<string, string[]>;
  readonly payload?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    if (init.cause !== undefined) this.cause = init.cause;
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields;
    this.payload = init.payload;
  }

  /** True when retrying the same request could plausibly succeed. */
  get retryable(): boolean {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "server";
  }

  /** Narrow helper for optimistic-concurrency handling (409 + domain code). */
  isConflict(code?: string): boolean {
    return this.kind === "conflict" && (code === undefined || this.code === code);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return "authentication";
  if (status === 403) return "authorization";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422 || status === 400) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

const DEFAULT_MESSAGE: Record<ApiErrorKind, string> = {
  network: "ارتباط با سرور برقرار نشد.",
  timeout: "زمان پاسخ سرور به پایان رسید.",
  cancelled: "درخواست لغو شد.",
  authentication: "برای ادامه باید دوباره وارد شوید.",
  authorization: "دسترسی لازم برای این عملیات را ندارید.",
  validation: "اطلاعات ارسال‌شده معتبر نیست.",
  not_found: "مورد درخواستی یافت نشد.",
  conflict: "این رکورد توسط کاربر دیگری تغییر کرده است.",
  server: "خطای داخلی سرور.",
  unknown: "خطای ناشناخته.",
};

/** Extract `{ error: {...} }` or `{ errors: [...] }` from a parsed body. */
export function extractErrorPayload(body: unknown): ApiErrorPayload | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const record = body as Record<string, unknown>;
  const single = record.error;
  if (typeof single === "object" && single !== null) return single as ApiErrorPayload;
  const many = record.errors;
  if (Array.isArray(many) && many.length > 0 && typeof many[0] === "object" && many[0] !== null) {
    return many[0] as ApiErrorPayload;
  }
  return undefined;
}

/** Build an ApiError from an HTTP response body. */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const payload = extractErrorPayload(body);
  const kind = kindForStatus(status);
  return new ApiError({
    kind,
    status,
    code: typeof payload?.code === "string" ? payload.code : undefined,
    message: typeof payload?.message === "string" && payload.message ? payload.message : DEFAULT_MESSAGE[kind],
    fields: normalizeFields(payload),
    payload: body,
  });
}

/** Build an ApiError from a thrown transport-level failure. */
export function apiErrorFromThrown(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError({ kind: "cancelled", message: DEFAULT_MESSAGE.cancelled, cause: error });
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new ApiError({ kind: "timeout", message: DEFAULT_MESSAGE.timeout, cause: error });
  }
  return new ApiError({
    kind: "network",
    message: error instanceof Error && error.message ? error.message : DEFAULT_MESSAGE.network,
    cause: error,
  });
}

function normalizeFields(payload: ApiErrorPayload | undefined): Record<string, string[]> | undefined {
  const fields = payload?.fields;
  if (typeof fields !== "object" || fields === null) return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    if (Array.isArray(value)) out[key] = value.map(String);
    else if (typeof value === "string") out[key] = [value];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
