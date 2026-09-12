/**
 * Demo branding repository.
 *
 * Validates every field before persisting. Colours and fonts end up in CSS
 * custom properties, so an unvalidated string here would be injected into the
 * page's style layer — hence the strict hex test and the font allow-list (§24).
 */
import { validationError } from "@/domains/shared/demoCollection";
import { demoStore, type DemoStore } from "@/services/demoStore";
import type { BrandingRepository } from "./repository";
import { isHexColor, isPersianFont, type BrandingSettings, type UpdateBrandingInput } from "./types";

const MAX_NAME = 80;
const MAX_TAGLINE = 120;

export class DemoBrandingRepository implements BrandingRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async get(): Promise<BrandingSettings> {
    return this.store.branding.get();
  }

  async update(input: UpdateBrandingInput): Promise<BrandingSettings> {
    const fields: Record<string, string[]> = {};

    if (input.academyName !== undefined) {
      const name = input.academyName.trim();
      if (name.length < 2) fields.academyName = ["نام آموزشگاه الزامی است."];
      else if (name.length > MAX_NAME) fields.academyName = [`حداکثر ${MAX_NAME} نویسه مجاز است.`];
    }
    if (input.tagline !== undefined && input.tagline.trim().length > MAX_TAGLINE) {
      fields.tagline = [`حداکثر ${MAX_TAGLINE} نویسه مجاز است.`];
    }

    // Colours are written into CSS variables — only strict #RRGGBB is accepted.
    for (const key of ["primaryColor", "accentColor", "textColor"] as const) {
      const value = input[key];
      if (value !== undefined && !isHexColor(value)) {
        fields[key] = ["رنگ باید به شکل #RRGGBB باشد."];
      }
    }

    if (input.persianFont !== undefined && !isPersianFont(input.persianFont)) {
      fields.persianFont = ["فونت انتخاب‌شده پشتیبانی نمی‌شود."];
    }

    // Media references must resolve, otherwise the UI renders a broken logo.
    for (const key of ["logoMediaId", "faviconMediaId"] as const) {
      const value = input[key];
      if (value !== undefined && value !== "" && !this.store.media.find(value)) {
        fields[key] = ["فایل انتخاب‌شده یافت نشد."];
      }
    }

    if (Object.keys(fields).length) {
      throw validationError("BRANDING_INVALID", "اطلاعات برند معتبر نیست.", fields);
    }

    return this.store.branding.update({
      ...input,
      ...(input.academyName !== undefined ? { academyName: input.academyName.trim() } : {}),
      ...(input.tagline !== undefined ? { tagline: input.tagline.trim() } : {}),
    });
  }
}
