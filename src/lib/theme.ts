/* ------------------------------------------------------------------ */
/* Theme knowledge shared by DOM components (CSS vars) and canvas/SVG  */
/* renderers that need concrete colors.                                */
/* ------------------------------------------------------------------ */

export type Accent = "gold" | "wood" | "violet";
/**
 * The named stage presets. Each one is a set of CSS custom properties in
 * `src/index.css` (`[data-theme="…"]`) — nothing here paints anything, this is
 * the vocabulary the settings surface and the DOM applier share.
 */
export type ThemeMode = "dark" | "glass" | "light" | "contrast";
export type Density = "comfortable" | "compact";

export const THEMES: readonly ThemeMode[] = ["dark", "glass", "light", "contrast"];

export const themeLabels: Record<ThemeMode, string> = {
  dark: "تیرهٔ کنسرواتوار",
  glass: "شیشه‌ای",
  light: "روشنِ روزن",
  contrast: "کنتراست بالا",
};

export const themeNotes: Record<ThemeMode, string> = {
  dark: "سالن تاریک و نور صحنهٔ طلایی — تجربهٔ اصلی محصول.",
  glass: "سطوح نیمه‌شفاف با عمق از تاری پشت؛ همان صحنه، از پشت شیشه.",
  light: "زمینهٔ روشن برای کار در daylight و چاپ؛ جهت نور سطوح برعکس می‌شود.",
  contrast: "سیاه و سفید خالص با حاشیه‌های دیدنی — برای ویدئوپروژکتور یا کم‌بینایی.",
};

/**
 * Colours a viewer types in by hand.
 *
 * These are *viewer* overrides, deliberately separate from the academy's
 * branding record: branding is organisation data everybody sees (and travels in
 * a backup), while "I want this panel lighter on my screen" is a preference of
 * one device. Both end up as custom properties on `<html>`; the viewer's are
 * inline, so they win — which is the only precedence a person can verify by
 * looking at their own screen.
 */
export interface ViewerPalette {
  /** Page background behind everything. */
  background?: string;
  /** Panels, cards and popovers. */
  surface?: string;
  /** Primary text colour. */
  text?: string;
}

export type PaletteSlot = keyof ViewerPalette;

export const PALETTE_SLOTS: ReadonlyArray<{
  key: PaletteSlot;
  label: string;
  hint: string;
  /** The custom property the value is written to. */
  property: string;
}> = [
  { key: "background", label: "رنگ زمینه", hint: "پس‌زمینهٔ صفحه و مبنای تمام سطوح", property: "--viewer-bg" },
  { key: "surface", label: "رنگ سطح", hint: "کارت‌ها، پنل‌ها و منوهای بازشو", property: "--viewer-surface" },
  { key: "text", label: "رنگ متن", hint: "متن اصلی؛ بقیهٔ متن‌ها از آن مشتق می‌شوند", property: "--viewer-text" },
];

/**
 * Accepts `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa` — the alpha form included,
 * because a translucent panel is exactly what somebody typing `#9f9f9f9f` wants
 * and rejecting it would send them back to guessing. Named colours and shorthand
 * without `#` stay rejected: the value lands in a CSS custom property, so only
 * something this module can fully parse is allowed through (§24).
 */
export function isHexColorInput(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());
}

/** Expands 3/4-digit shorthand to 6/8 so every consumer sees one shape. */
export function normalizeHex(value: string): string {
  const hex = value.trim().replace("#", "");
  if (hex.length === 3 || hex.length === 4) {
    return `#${hex
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  return `#${hex.toLowerCase()}`;
}

/** Strips `#` and the alpha channel — `<input type="color">` accepts neither. */
export function toPickerHex(value: string | undefined): string {
  if (!value || !isHexColorInput(value)) return "#888888";
  const hex = normalizeHex(value).replace("#", "");
  return `#${hex.slice(0, 6)}`;
}

/** Relative luminance (WCAG). Used to decide which way surfaces should lift. */
export function relativeLuminance(value: string): number {
  const hex = normalizeHex(value).replace("#", "");
  const channel = (offset: number) => {
    const raw = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * The colour surfaces are mixed *toward*: white on a dark stage, black on a
 * light one. Getting this backwards is what makes a hand-typed light background
 * produce invisible panels — every step of the ramp would lift toward white.
 */
export function liftDirection(background: string): "#ffffff" | "#000000" {
  return relativeLuminance(background) > 0.45 ? "#000000" : "#ffffff";
}

export const accentLabels: Record<Accent, string> = {
  gold: "طلایی صحنه",
  wood: "کهربای ساز",
  violet: "بنفش رزونانس",
};

export const accentHex: Record<Accent, Record<"200" | "300" | "400" | "500" | "600" | "700", string>> = {
  gold: { 200: "#f6e6b8", 300: "#efd89a", 400: "#e4c57a", 500: "#d4a853", 600: "#b98c3e", 700: "#8f6a2c" },
  wood: { 200: "#f4e3c2", 300: "#eacf9a", 400: "#ddb574", 500: "#c68f4e", 600: "#a56e35", 700: "#7a5126" },
  violet: { 200: "#ded3fa", 300: "#c9bdf6", 400: "#ab98ee", 500: "#8b75dc", 600: "#6e5bb8", 700: "#53418c" },
};

export function hexA(hex: string, alpha: number): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function loadPref<T extends string>(key: string, fallback: T, valid: readonly T[]): T {
  try {
    const v = localStorage.getItem(key);
    if (v && (valid as readonly string[]).includes(v)) return v as T;
  } catch {
    /* storage unavailable — fall back silently */
  }
  return fallback;
}

export function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const PALETTE_KEY = "ava:palette";

/** Reads the typed palette, dropping anything that is not a valid hex colour. */
export function loadPalette(): ViewerPalette {
  try {
    const raw = localStorage.getItem(PALETTE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const palette: ViewerPalette = {};
    for (const slot of PALETTE_SLOTS) {
      const value = (parsed as Record<string, unknown>)[slot.key];
      if (typeof value === "string" && isHexColorInput(value)) {
        palette[slot.key] = normalizeHex(value);
      }
    }
    return palette;
  } catch {
    /* unreadable or absent — the presets stand on their own */
    return {};
  }
}

export function savePalette(palette: ViewerPalette): void {
  try {
    if (PALETTE_SLOTS.every((slot) => !palette[slot.key])) {
      localStorage.removeItem(PALETTE_KEY);
      return;
    }
    localStorage.setItem(PALETTE_KEY, JSON.stringify(palette));
  } catch {
    /* ignore */
  }
}

/**
 * Writes the typed palette to `<html>`, and clears what is not set.
 *
 * Clearing matters as much as setting: a stale inline property would keep
 * overruling a theme preset the viewer chose afterwards, which is precisely the
 * "I clicked and nothing happened" failure this layer exists to end.
 */
export function applyPalette(palette: ViewerPalette): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const slot of PALETTE_SLOTS) {
    const value = palette[slot.key];
    /*
      Re-validated here, at the last step before a value enters the document.
      The UI checks what is typed and `loadPalette` checks what is stored, but
      this is the function that actually writes to the DOM, and a custom property
      is a stylesheet fragment: whatever reaches it must be a colour this module
      can fully parse (§24). An unparseable value is dropped, not escaped.
    */
    if (value && isHexColorInput(value)) root.style.setProperty(slot.property, normalizeHex(value));
    else root.style.removeProperty(slot.property);
  }
  /*
    The lift direction is only overridden when the viewer typed a *background*.
    A preset already states its own direction (`--theme-mix`), and re-stating it
    here would put a viewer-level property in charge of a preset-level decision —
    which is how a theme switch later appears to do nothing. What this line
    prevents is the one genuinely broken combination: a hand-typed light
    background under a dark preset, where every step of the ramp would otherwise
    keep mixing toward white and the panels would vanish into the page.
  */
  const typedBackground = palette.background;
  if (typedBackground && isHexColorInput(typedBackground)) {
    root.style.setProperty("--viewer-mix", liftDirection(typedBackground));
  } else {
    root.style.removeProperty("--viewer-mix");
  }
}

/**
 * The presets' stage colours.
 *
 * `index.css` remains the authority for how a preset looks — this table exists
 * for the two places that need a concrete value in JavaScript: the Settings
 * preview cards, which paint a miniature of each preset, and anything that has
 * to reason about a colour without a stylesheet to read back.
 */
export const themeStage: Record<ThemeMode, { background: string; foreground: string }> = {
  dark: { background: "#0a0908", foreground: "#f5f0e8" },
  glass: { background: "#0b0a09", foreground: "#f5f0e8" },
  light: { background: "#f4f1ea", foreground: "#191512" },
  contrast: { background: "#000000", foreground: "#ffffff" },
};
