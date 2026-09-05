/**
 * Shared demo-repository plumbing.
 *
 * Every demo repository needs the same four things: paging, not-found errors,
 * conflict errors and validation errors. Implementing that once keeps the five
 * domain repositories to their actual business rules.
 *
 * This owns no persistence — the DemoStore is still the only writer.
 */
import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";

export const DEFAULT_PER_PAGE = 25;

export interface PageRequest {
  page?: number;
  per_page?: number;
}

/** Slices an already-filtered list into the `Page` envelope the API also returns. */
export function paginate<T>(rows: readonly T[], params: PageRequest = {}): Page<T> {
  const page = Math.max(1, Math.trunc(params.page ?? 1));
  const perPage = Math.max(1, Math.trunc(params.per_page ?? DEFAULT_PER_PAGE));
  const start = (page - 1) * perPage;
  return {
    data: rows.slice(start, start + perPage) as T[],
    meta: { page, per_page: perPage, total: rows.length },
  };
}

export function notFound(code: string, message: string): ApiError {
  return new ApiError({ kind: "not_found", code, message });
}

export function conflict(code: string, message: string, fields?: Record<string, string[]>): ApiError {
  return new ApiError({ kind: "conflict", code, message, ...(fields ? { fields } : {}) });
}

export function validationError(code: string, message: string, fields: Record<string, string[]>): ApiError {
  return new ApiError({ kind: "validation", code, message, fields });
}

/** Case/space-insensitive contains, used by every demo `search` param. */
export function matchesQuery(haystack: readonly (string | undefined)[], query?: string): boolean {
  const q = query?.trim();
  if (!q) return true;
  return haystack.some((field) => (field ?? "").includes(q));
}

/**
 * Sorts a copy by a comparable key. Demo-only convenience: a real backend sorts
 * in SQL, so the contract exposes `sort`/`dir` rather than a comparator.
 */
export function sortRows<T>(rows: readonly T[], key: ((row: T) => string | number) | undefined, dir: "asc" | "desc" = "asc"): T[] {
  if (!key) return [...rows];
  const factor = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = key(a);
    const bv = key(b);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv), "fa") * factor;
  });
}
