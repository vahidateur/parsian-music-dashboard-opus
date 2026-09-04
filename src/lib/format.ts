const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Convert any Latin digits in a string/number to Persian digits. */
export const toFa = (input: string | number): string =>
  String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);

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

export const faPercent = (n: number, decimals = 0) => `${faNum(n, { decimals })}٪`;

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

/** Today's date in the Persian (Solar Hijri) calendar. */
export const faToday = (): string => {
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return "سه‌شنبه، ۱۹ اسفند ۱۴۰۴";
  }
};

export const greetingFor = (minutes: number) => {
  const h = minutes / 60;
  if (h < 12) return "صبح بخیر";
  if (h < 16) return "ظهر بخیر";
  if (h < 20) return "عصر بخیر";
  return "شب بخیر";
};
