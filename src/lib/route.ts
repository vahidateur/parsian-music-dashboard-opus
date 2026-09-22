import { viewTitles } from "@/lib/navigation";
import type { Target, ViewId } from "@/lib/viewContracts";
import { parseHash } from "./hashRoute";

/**
 * Path routing: `/students`, `/students/st1`, `/students?filter=at-risk`.
 *
 * WHY THE `#` IS GONE
 *
 * The app used to keep its state in the URL fragment (`#/dashboard`), which is
 * the trick a static host needs when it cannot be told to serve `index.html` for
 * a path. It costs the operator a strange-looking address bar for a panel they
 * show to other people, and it puts the route somewhere no server, no analytics
 * and no `Referer` can see. Both reference deployments already rewrite unknown
 * paths to `index.html` (deploy/nginx.conf, deploy/Caddyfile), so real paths are
 * available — this module uses them.
 *
 * The fragment form is still READ (`parseHash` via `readTarget`) so a bookmark, a
 * shared link or a test written against the old contract keeps working; it is
 * never WRITTEN. The first navigation after an old-style link migrates the
 * address bar to the path form.
 *
 * Everything is validated: a URL is untrusted input, so an unknown view or an
 * id outside `[A-Za-z0-9_-]{1,64}` is dropped rather than passed to a domain.
 */

const VIEW_IDS = Object.keys(viewTitles) as ViewId[];

export function isViewId(value: string): value is ViewId {
  return (VIEW_IDS as readonly string[]).includes(value);
}

/** Safe id/filter charset — the same rule the fragment parser applies. */
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Strips a deployment's base path (the secret access slug) from a pathname. */
function stripBase(pathname: string, base: string): string {
  if (!base) return pathname;
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  if (pathname === normalized) return "/";
  return pathname.startsWith(`${normalized}/`) ? pathname.slice(normalized.length) : pathname;
}

/**
 * Parses a pathname + search pair into a navigation target.
 *
 * `base` is the deployment prefix (`accessBasePath()`): under a secret access
 * path the panel lives at `/<slug>/students`, and the slug is not part of the
 * route.
 */
export function parsePath(pathname: string, search = "", base = ""): Target | null {
  // A caller may hand over a whole URL-shaped string; split it rather than
  // failing to see the filter that is plainly there.
  const [pathPart, queryPart] = pathname.split("?");
  const query = queryPart !== undefined ? `?${queryPart}` : search;
  const relative = stripBase(pathPart, base).replace(/^\/+/, "");
  if (!relative) return null;

  const segments = relative.split("/").filter(Boolean).map(decodeSafe);
  const view = segments[0];
  if (!view || !isViewId(view)) return null;

  const target: Target = { view };
  const id = segments[1];
  if (id && SAFE_SEGMENT.test(id)) target.id = id;

  if (query) {
    const filter = new URLSearchParams(query.replace(/^\?/, "")).get("filter");
    if (filter && SAFE_SEGMENT.test(filter)) target.filter = filter;
  }
  return target;
}

/** Renders a target as an absolute path, base included. */
export function formatPath(target: Target, base = ""): string {
  const parts = [`${base}/${target.view}`];
  if (target.id && SAFE_SEGMENT.test(target.id)) parts.push(`/${encodeURIComponent(target.id)}`);
  const suffix = target.filter && SAFE_SEGMENT.test(target.filter) ? `?filter=${encodeURIComponent(target.filter)}` : "";
  return parts.join("") + suffix;
}

/** Everything the address bar reader needs; a subset of `Location` for testability. */
export interface RouteLocation {
  pathname: string;
  search?: string;
  hash?: string;
}

/**
 * The target the address bar is asking for.
 *
 * The fragment wins when it carries a route, because that is the form an old
 * bookmark or an in-flight test uses, and ignoring it would send that visitor to
 * the dashboard instead of where they pointed. Otherwise the path answers.
 */
export function readTarget(location: RouteLocation, base = ""): Target | null {
  const fromHash = location.hash ? parseHash(location.hash) : null;
  if (fromHash) return fromHash;
  return parsePath(location.pathname, location.search ?? "", base);
}

/** True when the address bar still carries a legacy fragment route. */
export function hasLegacyHash(location: RouteLocation): boolean {
  return Boolean(location.hash && parseHash(location.hash));
}
