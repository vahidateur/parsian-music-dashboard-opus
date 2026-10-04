import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import type { LibraryRepository } from "./repository";
import type { CreateLibraryItemInput, LibraryItem, LibraryListParams, UpdateLibraryItemInput } from "./types";

const RESOURCE = "resources";

/**
 * Implementation #2 — REST backend.
 *
 * Endpoints (declared contract, see `domains/library/README.md`):
 *   GET    /api/v1/resources
 *   POST   /api/v1/resources
 *   GET    /api/v1/resources/{id}
 *   PATCH  /api/v1/resources/{id}
 *   DELETE /api/v1/resources/{id}
 *
 * FILES. The contract puts binaries on their own endpoints — `POST /uploads`
 * and `GET /resources/{id}/download` — so storage stays out of this domain.
 * `ApiClient` is a JSON boundary and cannot carry a binary body, which is why
 * the download half is NOT implemented here: inventing a base64-in-JSON
 * workaround, or returning a fabricated URL, would present a broken path as a
 * working one (§37). In the demo the bytes come from `MediaRepository.getBlob`,
 * the same abstraction profile photos and gallery images use; in production
 * they come from the media/upload adapter once the client grows a binary verb.
 *
 * SERVED since 2026-10-04. The historical note below is retained because it
 * explains why this class was built before its server existed; the "no server
 * serves these endpoints" clause no longer describes the present:
 *
 * > NOT REGISTERED. Like `ApiSchedulingRepository`, this adapter compiles and
 * > is covered by a contract test, but `registry.ts` resolves Library to the
 * > demo implementation in both modes: no server serves these endpoints.
 *
 * All five endpoints below now have routes, and `registry.client.ts` (the
 * production composition) resolves this domain to this class. `registry.ts` —
 * the DEMO composition — still selects the local repository and discloses that
 * through `DEMO_SERVED_DOMAINS`; a deliberate, separately-tested choice.
 *
 * `ResourceResource` emits exactly the eighteen fields of `LibraryItem`
 * (`Resource` plus the five `LibraryItem` additions), with no gaps either way.
 *
 * FILES ARE STILL NOT SERVED. The server slice is metadata-only: it holds no
 * bytes, and `POST /uploads` and `GET /resources/{id}/download` do not exist.
 * `mediaId` therefore names a file the server does not hold, and the download
 * half remains deliberately unimplemented here — inventing a base64-in-JSON
 * workaround or a fabricated URL would present a broken path as a working one
 * (§37).
 *
 * F1: added level + visibility to query per publication status disposition.
 *
 * G-7: `Resource.teacherId` is part of the payload. `search` is passed through
 * untouched, so the server is the one that must resolve it: a server that
 * matches `search` against title/composer alone would be the same proxy this
 * frontend just removed, in the one place it would matter. Resolving it is a
 * join against the teachers the org holds, inside the query (T-02/O-08: the
 * attribution is provenance and must not become a filter on what a caller may
 * see). No backend implementation ships in F1.
 */
export class ApiLibraryRepository implements LibraryRepository {
  constructor(private readonly client: ApiClient) {}

  list(params: LibraryListParams = {}, signal?: AbortSignal): Promise<Page<LibraryItem>> {
    return this.client.getPage<LibraryItem>(RESOURCE, { query: toQuery(params), signal });
  }

  get(id: string, signal?: AbortSignal): Promise<LibraryItem> {
    return this.client.get<LibraryItem>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }

  create(input: CreateLibraryItemInput): Promise<LibraryItem> {
    return this.client.post<LibraryItem>(RESOURCE, input);
  }

  update(id: string, input: UpdateLibraryItemInput): Promise<LibraryItem> {
    return this.client.patch<LibraryItem>(`${RESOURCE}/${encodeURIComponent(id)}`, input);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/${encodeURIComponent(id)}`);
  }
}

/** Domain params -> wire query params (snake_case, as per the API contract). */
export function toQuery(params: LibraryListParams): QueryParams {
  return {
    search: params.search,
    kind: params.kind,
    instrument: params.instrument,
    level: params.level,
    visibility: params.visibility,
    sort: params.sort,
    page: params.page,
    per_page: params.per_page,
  };
}
