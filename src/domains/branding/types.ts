/**
 * Branding domain — academy identity managed from Settings.
 *
 * ARCHITECTURE DECISION — one record, not scattered localStorage keys.
 *
 * Appearance preferences today live in individual keys (`ava:theme`,
 * `ava:accent`, …) written by `savePref`. Those are *per-browser viewer
 * preferences* and legitimately stay local. Branding is different: it is
 * *organization data* that every viewer must see identically and that a
 * backend will eventually own. It therefore lives as a single record inside
 * the DemoStore dataset, travels in backups, and is reachable through a
 * repository — exactly like any other domain entity.
 *
 * The brief's "do not scatter theme settings across localStorage keys" is
 * satisfied by that split: viewer preference stays a preference, academy
 * identity becomes domain data with one owner.
 */

/** A validated 6-digit hex colour, e.g. `#D5AF58`. */
export type HexColor = string;

export interface BrandingSettings {
  /** Academy display name; appears in the shell, login and exports. */
  academyName: string;
  /** Short tagline under the name. */
  tagline: string;
  /** `MediaAsset.id` of the logo. Never a raw data URL. */
  logoMediaId?: string;
  /** `MediaAsset.id` of the favicon. */
  faviconMediaId?: string;
  /** Primary brand colour used for accents and primary actions. */
  primaryColor: HexColor;
  /** Secondary/highlight colour. */
  accentColor: HexColor;
  /** Default body text colour. */
  textColor: HexColor;
  /** Persian UI font family name, chosen from `PERSIAN_FONTS`. */
  persianFont: string;
  /** ISO-8601 of the last change, so the UI can show when branding was saved. */
  updatedAt: string;
}

export type UpdateBrandingInput = Partial<Omit<BrandingSettings, "updatedAt">>;

/**
 * Fonts the app can actually render. Restricting to a known list keeps an
 * arbitrary string out of a CSS custom property, which is both a rendering
 * and an injection concern (§24).
 */
export const PERSIAN_FONTS = ["Vazirmatn", "Estedad", "IranYekan", "Sahel"] as const;
export type PersianFont = (typeof PERSIAN_FONTS)[number];

export const DEFAULT_BRANDING: BrandingSettings = {
  academyName: "آموزشگاه موسیقی پارسیان",
  tagline: "تالار هنر، جادو و موسیقی",
  primaryColor: "#D5AF58",
  accentColor: "#F4D28B",
  textColor: "#FFFFFF",
  persianFont: "Vazirmatn",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/** Strict `#RRGGBB` test. Deliberately rejects shorthand and named colours. */
export function isHexColor(value: string): value is HexColor {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isPersianFont(value: string): value is PersianFont {
  return (PERSIAN_FONTS as readonly string[]).includes(value);
}
