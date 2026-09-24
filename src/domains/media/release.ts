/**
 * OWNERSHIP TRANSITION — the one place that decides whether a stored binary may
 * be physically freed.
 *
 * THE INVARIANT
 *
 *   An asset is freed only when BOTH hold:
 *
 *     1. the write that stopped referencing it has already succeeded. Freeing
 *        first is what produced the real defects this module closes: replacing a
 *        photo freed the previous one BEFORE the form saved, so a cancel left a
 *        persisted record pointing at bytes that no longer existed;
 *     2. no remaining record references it. A shared asset — one photo on two
 *        records, one file in two catalogue rows, one image in two albums —
 *        survives the owner that happened to let go of it first.
 *
 * WHAT THIS IS NOT
 *
 *   It is NOT the global media-parent gate. `isStillReferenced` is supplied by
 *   the owner and covers exactly the records that owner can name (see
 *   `demoReferences.ts`, which also states what is deliberately outside the
 *   slice). A general parent index would change the media contract for every
 *   caller; this helper is the seam it would replace, so call sites would not
 *   move on that day.
 *
 * WHY IT RETURNS INSTEAD OF THROWING
 *
 *   A failed cleanup cannot throw back into the caller: the owner write has
 *   already committed, and failing the whole operation would report a write that
 *   happened as one that did not — a rollback the store cannot perform. So the
 *   failure is RETURNED as an outcome and handed to the reporter the app
 *   installs (`AppProvider` turns it into an operator-visible warning). Nothing
 *   is swallowed: a caller may ignore the returned value only because the
 *   reporter has already been given the failure.
 *
 *   `MEDIA_NOT_FOUND` is not a failure: the bytes the caller wanted gone are
 *   already gone, which is the outcome that was asked for.
 */
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import type { MediaRepository } from "./repository";

/** What actually happened to the asset — data, not a boolean. */
export type MediaReleaseOutcome =
  /** Metadata and bytes are gone. */
  | { status: "released" }
  /** A remaining record still references it; nothing was touched. */
  | { status: "retained" }
  /** Nothing to free: no id, or the asset was already gone. */
  | { status: "skipped" }
  /** The attempt failed and the asset remains. Reported, never swallowed. */
  | { status: "failed"; error: ApiError };

export interface MediaReleaseFailure {
  mediaId: string;
  error: ApiError;
}

export type MediaReleaseFailureReporter = (failure: MediaReleaseFailure) => void;

let reporter: MediaReleaseFailureReporter | undefined;

/**
 * Installs the app's reporter for cleanup failures — the same seam shape as
 * `setBlobStore`: one place, replaceable in tests, `undefined` means none.
 */
export function setMediaReleaseFailureReporter(next: MediaReleaseFailureReporter | undefined): void {
  reporter = next;
}

/**
 * Frees `mediaId` when the owner has already performed the write that stopped
 * referencing it AND no remaining record still points at it.
 */
export async function releaseUnreferencedMedia(
  mediaId: string | undefined,
  isStillReferenced: (mediaId: string) => boolean,
  media: MediaRepository,
): Promise<MediaReleaseOutcome> {
  const id = normalizedId(mediaId);
  if (!id) return { status: "skipped" };
  if (isStillReferenced(id)) return { status: "retained" };
  return attemptRelease(id, media);
}

/**
 * Frees an asset the CALLER staged itself and is now abandoning — an upload the
 * operator cancelled before any record was written to reference it.
 *
 * There is no reference check here BY CONSTRUCTION, and that is the whole
 * difference from `releaseUnreferencedMedia`: the id came from this session's
 * own upload, and no owner write naming it has happened. Calling this for an
 * asset that any record could reference is the mistake this module exists to
 * prevent — use `releaseUnreferencedMedia` there.
 */
export async function releaseStagedMedia(
  mediaId: string | undefined,
  media: MediaRepository,
): Promise<MediaReleaseOutcome> {
  const id = normalizedId(mediaId);
  if (!id) return { status: "skipped" };
  return attemptRelease(id, media);
}

/**
 * An empty id is not an asset: a cleared field, or a row written by an earlier
 * build that stored `mediaId: ""`, must never be turned into a store call.
 */
function normalizedId(mediaId: string | undefined): string | undefined {
  const id = mediaId?.trim();
  return id ? id : undefined;
}

async function attemptRelease(mediaId: string, media: MediaRepository): Promise<MediaReleaseOutcome> {
  try {
    await media.delete(mediaId);
    return { status: "released" };
  } catch (cause) {
    const error = apiErrorFromThrown(cause);
    if (error.code === "MEDIA_NOT_FOUND") return { status: "skipped" };
    reporter?.({ mediaId, error });
    return { status: "failed", error };
  }
}
