/**
 * Recently visited targets — a small UI preference, not domain data.
 *
 * It lives behind this module for the same reason the demo dataset does: views
 * must not talk to a storage API directly (§27). Keeping it separate from
 * `DemoStore` is deliberate — recents are a per-browser convenience that
 * should survive a demo reset and must never end up in a data backup.
 *
 * The stored value is fully untrusted: a user can edit localStorage, and these
 * entries become navigation targets, so every field is validated rather than
 * cast.
 */
import { isViewId } from "@/lib/hashRoute";
import type { Target } from "@/data/academy";

const RECENT_KEY = "ava:palette-recents";
const RECENT_MAX = 5;

/** Ids/filters that may be placed into a route, mirroring `hashRoute` rules. */
const SAFE_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

export interface RecentTarget {
  id: string;
  title: string;
  subtitle?: string;
  view: Target["view"];
  filter?: string;
  recordId?: string;
}

export function isRecentTarget(value: unknown): value is RecentTarget {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.title !== "string") return false;
  if (typeof r.view !== "string" || !isViewId(r.view)) return false;
  if (r.subtitle !== undefined && typeof r.subtitle !== "string") return false;
  if (r.filter !== undefined && (typeof r.filter !== "string" || !SAFE_TOKEN.test(r.filter))) return false;
  if (r.recordId !== undefined && (typeof r.recordId !== "string" || !SAFE_TOKEN.test(r.recordId))) return false;
  return true;
}

export function loadRecentTargets(): RecentTarget[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentTarget).slice(0, RECENT_MAX);
  } catch {
    // Unavailable or corrupted storage must never break the palette.
    return [];
  }
}

export function saveRecentTargets(list: RecentTarget[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* private mode or quota exceeded — recents are expendable */
  }
}

/** Adds an entry, de-duplicating by id and keeping the newest first. */
export function pushRecentTarget(entry: RecentTarget): RecentTarget[] {
  const next = [entry, ...loadRecentTargets().filter((r) => r.id !== entry.id)].slice(0, RECENT_MAX);
  saveRecentTargets(next);
  return next;
}

export { RECENT_MAX };
