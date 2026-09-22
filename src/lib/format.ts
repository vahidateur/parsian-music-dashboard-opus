import { isoToJalaliDisplay, isIsoDate } from "@/domains/scheduling/dateBridge";
import { academyIsoDate } from "@/views/relations/academyDay";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Convert any Latin digits in a string/number to Persian digits. */
export const toFa = (input: string | number): string =>
  String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);

/**
 * Convert Persian (and Arabic-Indic) digits back to Latin ones.
 *
 * The inverse of `toFa`, and the reason a numeric field in this product cannot
 * just call `Number(...)`: an operator typing into a Persian interface types ۶۰,
 * and `Number("۶۰")` is `NaN`. Without this, a rule field either rejects the
 * digits the rest of the product displays or silently stores nothing.
 */
export const toEnDigits = (input: string): string =>
  String(input)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** Parses a number typed in either digit set; `null` when it is not a number. */
export const parseTypedNumber = (input: string): number | null => {
  const value = Number(toEnDigits(input).trim());
  return input.trim() === "" || !Number.isFinite(value) ? null : value;
};

/** Format a number with Persian digits and Persian separators (٬ and ٫). */
export const faNum = (
  n: number,
  opts: { decimals?: number; compact?: boolean } = {},
): string => {
  const { decimals = 0, compact = false } = opts;
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000)
      return `${faNum(n / 1_000_000_000, { decimals: 1 })} میلیارد`;
    if (Math.abs(n) >= 1_000_000)
      return `${faNum(n / 1_000_000, { decimals: 1 })} میلیون`;
    if (Math.abs(n) >= 1_000) return `${faNum(n / 1_000, { decimals: 1 })} هزار`;
  }
  const fixed = n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return toFa(fixed).replace(/,/g, "٬").replace(/\./g, "٫");
};

/**
 * The glyph for "there is no value" — an absent measurement, not a zero one.
 *
 * Used wherever a derived number can legitimately be `null`: a ratio with no
 * denominator, a mean over no rows. Rendering «۰٪» there would claim a
 * measurement that never happened, and rendering «NaN٪» would leak the
 * arithmetic onto a customer's screen.
 */
export const NO_DATA = "—";

/**
 * Formats a percentage, or the honest «—» when there is nothing to report.
 *
 * Accepts `number | null` because the aggregations in `lib/stats.ts` answer
 * `null` for an empty collection. A non-finite number renders the same way: it
 * can only arrive from an unguarded computation, and no such value may be shown
 * as if it were a measurement.
 */
export const faPercent = (n: number | null, decimals = 0): string =>
  n === null || !Number.isFinite(n) ? NO_DATA : `${faNum(n, { decimals })}٪`;

export const faDelta = (n: number, decimals = 1) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${faNum(Math.abs(n), { decimals })}٪`;

export const faToman = (n: number, compact = false) =>
  `${faNum(n, { compact })} تومان`;

/** "10:30" → "۱۰:۳۰" */
export const faTime = (hhmm: string) => toFa(hhmm);

/** minutes since midnight → "۱۰:۴۷" */
export const minutesToFaTime = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return toFa(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
};

export const parseTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Today's date in the Persian (Solar Hijri) calendar — canonical path via dateBridge.
 *
 * GAP-010 fix: previously used `new Date()` directly, bypassing the academy's
 * single clock (`academyNow()`) and the canonical Jalali conversion
 * (`dateBridge.isoToJalaliDisplay`). Now derives from `academyIsoDate()` which
 * itself uses `academyNow()` — the one wall clock, in every mode — and
 * converts via `isoToJalaliDisplay` — the canonical bridge.
 *
 * Accepts an optional ISO date (`YYYY-MM-DD`) so callers like Hero/TopBar can
 * pass the same `academyIsoDate()` used by Dashboard, ensuring coherent source.
 * Falls back to a date-derived value, never a hardcoded calendar date.
 */
export const faToday = (isoDate?: string): string => {
  try {
    const iso = isoDate && isIsoDate(isoDate) ? isoDate : academyIsoDate();
    const formatted = isoToJalaliDisplay(iso, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (formatted) return formatted;
    return isoToJalaliDisplay(iso) || iso;
  } catch {
    try {
      const iso = isoDate && isIsoDate(isoDate) ? isoDate : academyIsoDate();
      return isoToJalaliDisplay(iso) || iso;
    } catch {
      try {
        return isoDate && isIsoDate(isoDate) ? isoDate : academyIsoDate();
      } catch {
        return "";
      }
    }
  }
};

export const greetingFor = (minutes: number) => {
  const h = minutes / 60;
  if (h < 12) return "صبح بخیر";
  if (h < 16) return "ظهر بخیر";
  if (h < 20) return "عصر بخیر";
  return "شب بخیر";
};
