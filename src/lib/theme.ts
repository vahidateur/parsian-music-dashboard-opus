/* ------------------------------------------------------------------ */
/* Theme knowledge shared by DOM components (CSS vars) and canvas/SVG  */
/* renderers that need concrete colors.                                */
/* ------------------------------------------------------------------ */

export type Accent = "gold" | "wood" | "violet";
export type ThemeMode = "dark" | "glass";
export type Density = "comfortable" | "compact";

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
