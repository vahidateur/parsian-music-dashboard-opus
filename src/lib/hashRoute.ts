import { viewTitles, type Target, type ViewId } from "@/data/academy";

/**
 * Hash routing: `#/students`, `#/students?filter=at-risk`, `#/students/st1`.
 *
 * Kept deliberately tiny — the app has a flat view model, so a router library
 * would add weight without adding capability. All values are validated because
 * the hash is untrusted user input.
 */

const VIEW_IDS = Object.keys(viewTitles) as ViewId[];

export function isViewId(value: string): value is ViewId {
  return (VIEW_IDS as readonly string[]).includes(value);
}

/** Safe id/filter charset — prevents junk from the URL reaching the domain. */
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

export function parseHash(hash: string): Target | null {
  const raw = hash.replace(/^#/, "").replace(/^\/+/, "");
  if (!raw) return null;

  const [pathPart, queryPart] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean).map(decodeSafe);
  const view = segments[0];
  if (!view || !isViewId(view)) return null;

  const target: Target = { view };

  const id = segments[1];
  if (id && SAFE_SEGMENT.test(id)) target.id = id;

  if (queryPart) {
    const filter = new URLSearchParams(queryPart).get("filter");
    if (filter && SAFE_SEGMENT.test(filter)) target.filter = filter;
  }
  return target;
}

export function formatHash(target: Target): string {
  const parts = [`#/${target.view}`];
  if (target.id && SAFE_SEGMENT.test(target.id)) parts.push(`/${encodeURIComponent(target.id)}`);
  const suffix = target.filter && SAFE_SEGMENT.test(target.filter) ? `?filter=${encodeURIComponent(target.filter)}` : "";
  return parts.join("") + suffix;
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
