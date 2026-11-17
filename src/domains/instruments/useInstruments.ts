import { useCallback, useEffect } from "react";
import { apiErrorFromThrown } from "@/api/errors";
import { getInstrumentRepository } from "@/domains/registry";
import { invalidatesOnAuthorization } from "@/domains/shared/authorizationInvalidation";
import { useDataVersion } from "@/domains/shared/dataVersion";
import { useResourceList, type ListState } from "@/domains/shared/useResource";
import { clearInstrumentCatalog, setInstrumentCatalog } from "./catalog";
import type { InstrumentListParams, InstrumentRecord } from "./types";

/** Instrument list, refreshed automatically after any persisted write. */
export function useInstruments(params: InstrumentListParams = {}): ListState<InstrumentRecord> {
  const loader = useCallback(
    (p: InstrumentListParams, signal?: AbortSignal) => getInstrumentRepository().list(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

/**
 * Keeps the synchronous instrument catalogue in step with the repository.
 *
 * Mounted once, near the app root. The ~60 render-time and service-layer call
 * sites that need a Persian label cannot await a repository read, so this hook
 * primes `catalog.ts` and refreshes it whenever data changes — including after
 * a demo reset, backup restore or import, all of which bump `dataVersion`.
 *
 * The repository stays the only writer; this merely projects one collection
 * into a synchronously readable form.
 */
export function useInstrumentCatalogSync(): void {
  const dataVersion = useDataVersion();

  useEffect(() => {
    const controller = new AbortController();
    getInstrumentRepository()
      // A high page size: this is a lookup table, not a paginated view. The
      // academy realistically defines tens of instruments, not thousands.
      .list({ per_page: 500 }, controller.signal)
      .then((page) => setInstrumentCatalog(page.data))
      .catch((cause: unknown) => {
        // A denied catalogue read must not leave the previous names on screen;
        // an empty cache falls back to ids. Other failures keep the snapshot:
        // labels going stale is better than every table falling back to raw ids.
        if (invalidatesOnAuthorization(apiErrorFromThrown(cause))) {
          clearInstrumentCatalog();
        }
      });
    return () => controller.abort();
  }, [dataVersion]);
}
