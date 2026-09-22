import { viewTitles } from "@/lib/navigation";
import type { Target, ViewId } from "@/lib/viewContracts";

/**
 * LEGACY fragment routing: `#/students`, `#/students?filter=at-risk`,
 * `#/students/st1`.
 *
 * The app's address bar is a path now (`/students/st1`) — see `src/lib/route.ts`
 * for why. This reader stays because a fragment link is still a link somebody
 * holds: a bookmark saved before the change, a URL copied out of an old chat. It
 * is never WRITTEN, and the shell migrates one to its path form on first paint.
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

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
