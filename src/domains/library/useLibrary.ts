/**
 * Library hooks — the only integration point `Library.tsx` uses.
 *
 *   View → useLibraryList / useLibraryFile → LibraryRepository + MediaRepository
 *
 * The view never sees the store, the blob store or IndexedDB: rows come from
 * `LibraryRepository`, bytes come from `MediaRepository`, and this file is where
 * the two are composed into something a UI can render honestly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { downloadBlobFile } from "@/lib/download";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { getLibraryRepository, getMediaRepository } from "@/domains/registry";
import { useResourceList, type ListState, type Paged } from "@/domains/shared/useResource";
import { ensureDemoLibraryFile } from "./demoContent";
import type { LibraryFileState, LibraryItem, LibraryListParams } from "./types";

/**
 * Provisions the demo library file — in a DEMO environment only.
 *
 * The dataset can carry the file's metadata but not its bytes (a pure,
 * synchronous seed cannot write to a blob store), so the bytes are written here,
 * at bootstrap, by the one function that owns that job.
 *
 * THIS IS THE SINGLE DEMO-CONTENT CALL SITE. It is deliberately a hook of its
 * own rather than a line buried in the view, so the lifecycle boundary decides
 * *whether* demo content is provisioned at all — the Library domain, the
 * repository and `Library.tsx` know nothing about environment modes.
 *
 * GATED ON THE PERSISTED LIFECYCLE STATE, not on how many rows exist:
 *  - EMPTY (a real customer environment) never receives `res1`, `md_demo_res1`
 *    or the demo blob — no demo bytes are written into a customer's browser;
 *  - `api` mode never receives them either (`isDemoEnvironment()` is false
 *    whenever the data source is a real backend);
 *  - DEMO provisions them, and re-provisions if the environment is later reset
 *    to the canonical dataset, because the hook subscribes to persistence.
 *
 * Failures are not thrown and not swallowed silently either: if the blob store
 * cannot hold the bytes, `useLibraryFile` reports the record as `missing` and
 * the UI says the file is unavailable, which is the honest outcome.
 */
export function useDemoLibraryFile(): void {
  const demo = useIsDemoEnvironment();

  useEffect(() => {
    if (!demo) return;
    void ensureDemoLibraryFile();
  }, [demo]);
}

/** The catalogue list. `per_page` is required at the type level (see `Paged`). */
export function useLibraryList(params: Paged<LibraryListParams>): ListState<LibraryItem> {
  const loader = useCallback(
    (p: LibraryListParams, signal?: AbortSignal) => getLibraryRepository().list(p, signal),
    [],
  );
  return useResourceList<LibraryItem, LibraryListParams>(loader, params);
}

const REASON_NO_FILE = "این منبع فایل ذخیره‌شده ندارد؛ تنها فرادادهٔ آن در کتابخانه ثبت شده است.";
const REASON_NO_METADATA = "فایل این منبع در فضای ذخیره‌سازی یافت نشد.";
const REASON_NO_BYTES =
  "فایل این منبع در این مرورگر موجود نیست — برای مثال پس از بازگردانی پشتیبان، که فقط فراداده را بازمی‌گرداند.";

/**
 * Resolves one record's file to a downloadable state.
 *
 * Metadata and bytes are fetched together when the record changes (the drawer
 * opens on one item at a time), so a download uses the bytes already in hand
 * instead of re-reading storage — and no object URL is invented for a document.
 *
 * A record whose metadata exists but whose bytes do not is `missing`, not an
 * error: backups carry metadata only, and the UI says so instead of offering a
 * download that produces an empty file.
 */
export function useLibraryFile(item: Pick<LibraryItem, "mediaId"> | null | undefined): LibraryFileState {
  const mediaId = item?.mediaId;
  const [asset, setAsset] = useState<LibraryFileState["asset"]>(undefined);
  const [blob, setBlob] = useState<Blob | undefined>(undefined);
  const [loading, setLoading] = useState(Boolean(mediaId));
  const [error, setError] = useState<ApiError | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!mediaId) {
      setAsset(undefined);
      setBlob(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const media = getMediaRepository();

    void Promise.all([
      // A record can outlive its asset (a deleted upload, a partial restore),
      // so a not-found here is a state to report, not a crash to propagate.
      media.get(mediaId).then(
        (found) => found,
        () => undefined,
      ),
      media.getBlob(mediaId).then(
        (found) => found,
        () => undefined,
      ),
    ]).then(([metadata, bytes]) => {
      if (cancelled) return;
      setAsset(metadata);
      setBlob(bytes);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  const status = useMemo<LibraryFileState["status"]>(() => {
    if (!mediaId) return "none";
    if (loading) return "loading";
    return blob ? "ready" : "missing";
  }, [mediaId, loading, blob]);

  const reason = useMemo(() => {
    if (status === "none") return REASON_NO_FILE;
    if (status !== "missing") return undefined;
    return asset ? REASON_NO_BYTES : REASON_NO_METADATA;
  }, [status, asset]);

  /** Kept in a ref so the callback identity does not churn the drawer. */
  const latest = useRef({ blob, asset });
  latest.current = { blob, asset };

  const download = useCallback(() => {
    const { blob: bytes, asset: meta } = latest.current;
    // Nothing to download: the button is disabled and says why. Not an error.
    if (!bytes || !meta) return;
    setDownloading(true);
    try {
      downloadBlobFile(meta.filename, bytes);
      setError(null);
    } catch (cause) {
      setError(apiErrorFromThrown(cause));
    } finally {
      setDownloading(false);
    }
  }, []);

  return {
    status,
    ...(asset ? { asset } : {}),
    ...(blob ? { blob } : {}),
    ...(reason ? { reason } : {}),
    downloading,
    error: error?.message ?? null,
    download,
  };
}
