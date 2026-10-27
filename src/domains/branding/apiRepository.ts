import type { ApiClient } from "@/api/client";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import type { BrandingRepository } from "./repository";
import type { BrandingSettings, UpdateBrandingInput } from "./types";

const RESOURCE = "branding";

/**
 * REST implementation of the branding domain.
 *
 * Endpoints served by the server (DECISIONS.md §38):
 *   GET   /api/v1/branding   the persisted identity, or the shipped defaults
 *   PATCH /api/v1/branding   validated partial patch (upsert)
 *
 * Reads require `branding.read` (every authenticated role — identity renders
 * app-wide); writes require `branding.write` (administrator only, mirroring
 * `settings.write`).
 *
 * A successful write bumps the shared data version, the same invalidation
 * every other list hook listens to, so the sidebar, top bar, hero and panel
 * refresh without knowing who wrote. A write the server refused changes
 * nothing, so the version is bumped only after the write has actually
 * happened. Reads bump nothing.
 */
export class ApiBrandingRepository implements BrandingRepository {
  constructor(private readonly client: ApiClient) {}

  get(signal?: AbortSignal): Promise<BrandingSettings> {
    return this.client.get<BrandingSettings>(RESOURCE, { signal });
  }

  async update(input: UpdateBrandingInput): Promise<BrandingSettings> {
    const updated = await this.client.patch<BrandingSettings>(RESOURCE, input);
    bumpDataVersion();
    return updated;
  }
}
