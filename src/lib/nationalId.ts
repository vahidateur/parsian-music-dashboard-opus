/**
 * Iranian national ID (کد ملی) — the single source of truth for normalisation
 * and validation. §5 requires exactly one implementation: never re-implement
 * this check inside a component, repository or import mapper.
 *
 * Format: 10 digits with a checksum over the first 9.
 *   sum = Σ digit[i] × (10 - i)   for i in 0..8
 *   r   = sum mod 11
 *   valid ⇔ (r < 2 && check === r) || (r >= 2 && check === 11 - r)
 *
 * Codes consisting of a single repeated digit ("0000000000", "1111111111", …)
 * pass the arithmetic but are not issued, so they are rejected explicitly.
 *
 * PRIVACY (§30): a national ID is sensitive personal data. Never log it, put it
 * in a URL, or include it in telemetry. Demo values are synthetic.
 */

/** Arabic-Indic and Persian digits → ASCII, so pasted input normalises cleanly. */
const DIGIT_MAP: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/**
 * Canonical storage form: ASCII digits only, zero-padded to 10.
 *
 * Padding is deliberately limited to values of 8–9 digits. Spreadsheets strip
 * leading zeros ("0076543218" → "76543218"), so restoring them is correct — but
 * padding an obviously-truncated value like "123" would manufacture a
 * plausible-looking ID out of a typo, so short input is left alone and fails
 * validation as a length error.
 */
export function normalizeNationalId(input: string): string {
  const ascii = [...(input ?? "").trim()]
    .map((ch) => DIGIT_MAP[ch] ?? ch)
    .filter((ch) => ch >= "0" && ch <= "9")
    .join("");
  return ascii.length >= 8 && ascii.length < 10 ? ascii.padStart(10, "0") : ascii;
}

export type NationalIdError = "required" | "length" | "repeated" | "checksum";

/** Persian messages, kept beside the codes so callers never invent their own. */
export const NATIONAL_ID_MESSAGES: Record<NationalIdError, string> = {
  required: "کد ملی الزامی است.",
  length: "کد ملی باید ۱۰ رقم باشد.",
  repeated: "کد ملی معتبر نیست.",
  checksum: "کد ملی معتبر نیست.",
};

/** Returns the failure reason, or null when the (normalised) value is valid. */
export function validateNationalId(input: string): NationalIdError | null {
  const value = normalizeNationalId(input);
  if (value.length === 0) return "required";
  if (value.length !== 10) return "length";
  if (/^(\d)\1{9}$/.test(value)) return "repeated";

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(value[i]) * (10 - i);
  const remainder = sum % 11;
  const check = Number(value[9]);
  const ok = remainder < 2 ? check === remainder : check === 11 - remainder;
  return ok ? null : "checksum";
}

export const isValidNationalId = (input: string): boolean => validateNationalId(input) === null;

/** Convenience for form layers: the message, or null when valid. */
export function nationalIdError(input: string): string | null {
  const code = validateNationalId(input);
  return code ? NATIONAL_ID_MESSAGES[code] : null;
}

/**
 * Display form for the UI: `123-456789-0`. Sensitive, so callers should still
 * gate this behind a permission check rather than showing it by default.
 */
export function formatNationalId(input: string): string {
  const v = normalizeNationalId(input);
  return v.length === 10 ? `${v.slice(0, 3)}-${v.slice(3, 9)}-${v.slice(9)}` : v;
}
