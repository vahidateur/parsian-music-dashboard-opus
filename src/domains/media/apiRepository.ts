import type { ApiClient } from "@/api/client";
import { isApiError } from "@/api/errors";
import type { Page, QueryParams } from "@/api/types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import type { MediaRepository } from "./repository";
import type { CreateMediaInput, MediaAsset, MediaListParams } from "./types";

const RESOURCE = "media";

/**
 * The REST implementation of the media domain.
 *
 * Endpoints (the contract the server serves now):
 *   GET    /api/v1/media             the assets the caller may see
 *   POST   /api/v1/media             upload (multipart)
 *   GET    /api/v1/media/{id}        the metadata
 *   GET    /api/v1/media/{id}/bytes  the bytes — authenticated and authorized
 *   DELETE /api/v1/media/{id}        free it (refused while a record uses it)
 *
 * THE BYTES ARE NOT A PUBLIC URL. They are fetched with the bearer token and
 * authorized by the server against the record that shows them, so a teacher's
 * students' photos are not readable by a teacher who may not see those
 * students. The object URL the UI shows is created from the fetched Blob —
 * the file never becomes a link anybody could share.
 */
export class ApiMediaRepository implements MediaRepository {
  constructor(private readonly client: ApiClient) {}

  list(params: MediaListParams = {}): Promise<Page<MediaAsset>> {
    return this.client.getPage<MediaAsset>(RESOURCE, { query: toQuery(params) });
  }

  get(id: string): Promise<MediaAsset> {
    return this.client.get<MediaAsset>(`${RESOURCE}/${encodeURIComponent(id)}`);
  }

  async create(input: CreateMediaInput): Promise<MediaAsset> {
    const created = await this.client.postBinary<MediaAsset>(RESOURCE, {
      filename: input.filename,
      mimeType: input.mimeType,
      bytes: input.bytes,
      fields: {
        kind: input.kind,
        width: input.width,
        height: input.height,
        durationSeconds: input.durationSeconds,
        // The waveform peaks are a list; a form field carries them as JSON.
        peaks: input.peaks ? JSON.stringify(input.peaks) : undefined,
      },
    });
    bumpDataVersion();
    return created;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/${encodeURIComponent(id)}`);
    bumpDataVersion();
  }

  /**
   * The bytes, or `undefined` when the asset does not exist.
   *
   * A missing asset is a legitimate state (a record may point at a file that
   * was never uploaded, or one that was freed) and the UI renders it as "no
   * image". A REFUSED read is NOT that state: a 403 means the caller may not
   * see the file, and it travels on as an error rather than being turned into
   * a silent "no image" — a hidden refusal would look like a broken record.
   */
  async getBlob(id: string): Promise<Blob | undefined> {
    try {
      return await this.client.getBinary(`${RESOURCE}/${encodeURIComponent(id)}/bytes`);
    } catch (error) {
      if (isApiError(error) && error.kind === "not_found") return undefined;
      throw error;
    }
  }
}

/** Domain params → wire query params (snake_case, as per the API contract). */
export function toQuery(params: MediaListParams): QueryParams {
  return {
    kind: params.kind,
    search: params.search,
    page: params.page,
    per_page: params.per_page,
  };
}
