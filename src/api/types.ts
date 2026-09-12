/**
 * Transport-level types shared by every domain.
 * These describe the *shape of the wire protocol*, never business rules.
 *
 * Envelope contract (backend, /api/v1):
 *   { "data": ..., "meta": {...}, "errors": [...] }
 */

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
}

/** A page of domain entities as returned by a collection endpoint. */
export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

/** Envelope for a single resource. */
export interface ItemEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
  errors?: ApiErrorPayload[];
}

/** Envelope for a collection resource. */
export interface CollectionEnvelope<T> {
  data: T[];
  meta?: Partial<PageMeta> & Record<string, unknown>;
  errors?: ApiErrorPayload[];
}

/**
 * Domain-level error body. Backend may return either
 * `{ "error": {...} }` or `{ "errors": [ ... ] }`.
 */
export interface ApiErrorPayload {
  /** Machine readable code, e.g. "SCHEDULE_VERSION_CONFLICT". */
  code?: string;
  message?: string;
  /** Field -> messages, for validation errors. */
  fields?: Record<string, string[]>;
  [key: string]: unknown;
}

/** Standard list query parameters understood by every collection endpoint. */
export interface ListParams {
  search?: string;
  page?: number;
  per_page?: number;
  sort?: string;
}

/** Value types accepted in a query string. */
export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;
export type QueryParams = Record<string, QueryValue>;

/** Options accepted by every ApiClient verb. */
export interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export function emptyPage<T>(perPage = 25): Page<T> {
  return { data: [], meta: { page: 1, per_page: perPage, total: 0 } };
}
