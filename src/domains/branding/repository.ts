import type { BrandingSettings, UpdateBrandingInput } from "./types";

export interface BrandingRepository {
  get(signal?: AbortSignal): Promise<BrandingSettings>;
  update(input: UpdateBrandingInput): Promise<BrandingSettings>;
}
