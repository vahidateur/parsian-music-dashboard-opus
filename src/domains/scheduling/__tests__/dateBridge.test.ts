/**
 * Calendar helpers for scheduling.
 *
 * These are load-bearing: a weekday off by one puts every generated session on
 * the wrong day, and a timezone-sensitive date shifts the whole schedule for
 * anyone west of Greenwich. The tests therefore pin real calendar facts rather
 * than round-tripping the implementation against itself.
 */
import { describe, expect, it } from "vitest";
import { WEEKDAYS } from "@/data/records";
import {
  addDays,
  addMinutes,
  compareIsoDate,
  datesInRange,
  daysBetween,
  durationMinutes,
  fromMinutes,
  isHhMm,
  isIsoDate,
  isoToJalaliDisplay,
  jalaliToIso,
  normalizeDigits,
  toMinutes,
  weekdayIndex,
} from "../dateBridge";

describe("date validation", () => {
  it("accepts real calendar dates", () => {
    expect(isIsoDate("2026-09-15")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true); // leap year
  });

  it("rejects dates that do not exist", () => {
    // The regex alone would pass these; only a round-trip catches them.
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-04-31")).toBe(false);
    expect(isIsoDate("2025-02-29")).toBe(false); // not a leap year
  });

  it("rejects malformed strings", () => {
    for (const bad of ["", "2026-9-15", "15-09-2026", "2026/09/15", "not-a-date"]) {
      expect(isIsoDate(bad), `"${bad}"`).toBe(false);
    }
  });

  it("validates 24-hour times", () => {
    expect(isHhMm("00:00")).toBe(true);
    expect(isHhMm("23:59")).toBe(true);
    expect(isHhMm("24:00")).toBe(false);
    expect(isHhMm("9:30")).toBe(false);
    expect(isHhMm("12:60")).toBe(false);
  });
});

describe("date arithmetic", () => {
  it("adds and subtracts days across month boundaries", () => {
    expect(addDays("2026-09-15", 1)).toBe("2026-09-16");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap days", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
  });

  it("is unaffected by daylight-saving transitions", () => {
    // A midnight-anchored implementation can lose or gain a day here; the
    // UTC-noon anchor makes every step exactly 24h.
    for (const start of ["2026-03-28", "2026-10-24", "2026-03-20"]) {
      let cursor = start;
      for (let i = 0; i < 5; i += 1) cursor = addDays(cursor, 1)!;
      expect(daysBetween(start, cursor)).toBe(5);
    }
  });

  it("measures signed distance between dates", () => {
    expect(daysBetween("2026-09-01", "2026-09-29")).toBe(28);
    expect(daysBetween("2026-09-29", "2026-09-01")).toBe(-28);
    expect(daysBetween("2026-09-01", "2026-09-01")).toBe(0);
  });

  it("returns null rather than NaN for bad input", () => {
    expect(addDays("nope", 1)).toBeNull();
    expect(addDays("2026-09-15", 1.5)).toBeNull();
    expect(daysBetween("2026-09-15", "nope")).toBeNull();
  });
});

describe("weekday indexing", () => {
  /**
   * 2026-09-12 is a Saturday. In the product's Saturday-first convention that
   * is index 0 (شنبه), which is what `class.days` stores.
   */
  it("maps Saturday to 0, matching WEEKDAYS", () => {
    expect(weekdayIndex("2026-09-12")).toBe(0);
    expect(WEEKDAYS[0]).toBe("شنبه");
  });

  it("maps a full week in order", () => {
    const expected = [
      ["2026-09-12", 0, "شنبه"],
      ["2026-09-13", 1, "یکشنبه"],
      ["2026-09-14", 2, "دوشنبه"],
      ["2026-09-15", 3, "سه‌شنبه"],
      ["2026-09-16", 4, "چهارشنبه"],
      ["2026-09-17", 5, "پنجشنبه"],
      ["2026-09-18", 6, "جمعه"],
    ] as const;

    for (const [iso, index, label] of expected) {
      expect(weekdayIndex(iso), iso).toBe(index);
      expect(WEEKDAYS[index]).toBe(label);
    }
  });

  it("stays stable across a year", () => {
    // Same weekday 364 days later (52 weeks exactly).
    expect(weekdayIndex("2026-09-15")).toBe(weekdayIndex(addDays("2026-09-15", 364)!));
  });

  it("returns null for an invalid date", () => {
    expect(weekdayIndex("2026-02-30")).toBeNull();
  });
});

describe("datesInRange", () => {
  it("is inclusive of both bounds", () => {
    const range = datesInRange("2026-09-14", "2026-09-16");
    expect(range).toEqual(["2026-09-14", "2026-09-15", "2026-09-16"]);
  });

  it("returns a single date when from equals to", () => {
    expect(datesInRange("2026-09-15", "2026-09-15")).toEqual(["2026-09-15"]);
  });

  it("returns empty for an inverted range instead of looping forever", () => {
    expect(datesInRange("2026-09-16", "2026-09-14")).toEqual([]);
  });

  it("returns empty for malformed input", () => {
    expect(datesInRange("nope", "2026-09-14")).toEqual([]);
  });

  it("spans a 56-day window (the demo seed width)", () => {
    expect(datesInRange("2026-08-04", "2026-09-29")).toHaveLength(57);
  });

  it("sorts chronologically by plain string comparison", () => {
    const range = datesInRange("2026-09-25", "2026-10-05");
    expect([...range].sort(compareIsoDate)).toEqual(range);
  });
});

describe("clock times", () => {
  it("converts to and from minutes", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("17:00")).toBe(1020);
    expect(toMinutes("23:59")).toBe(1439);
    expect(fromMinutes(1020)).toBe("17:00");
    expect(fromMinutes(90)).toBe("01:30");
  });

  it("adds minutes within the day", () => {
    expect(addMinutes("17:00", 90)).toBe("18:30");
    expect(addMinutes("09:45", 45)).toBe("10:30");
  });

  it("refuses to wrap past midnight", () => {
    // Wrapping would silently produce an end time before the start.
    expect(addMinutes("23:30", 60)).toBeNull();
    expect(fromMinutes(1440)).toBeNull();
    expect(fromMinutes(-1)).toBeNull();
  });

  it("computes duration", () => {
    expect(durationMinutes("17:00", "18:30")).toBe(90);
    expect(durationMinutes("09:00", "09:45")).toBe(45);
  });

  it("returns a negative duration for a reversed range rather than hiding it", () => {
    // The conflict engine relies on seeing this, not on a thrown error.
    expect(durationMinutes("18:00", "17:00")).toBe(-60);
  });

  it("returns null for malformed times", () => {
    expect(toMinutes("9:00")).toBeNull();
    expect(durationMinutes("17:00", "nope")).toBeNull();
    expect(addMinutes("nope", 30)).toBeNull();
  });
});

describe("digit normalisation", () => {
  it("converts Persian digits to ASCII", () => {
    expect(normalizeDigits("۱۴۰۴/۰۷/۰۱")).toBe("1404/07/01");
  });

  it("converts Arabic-Indic digits", () => {
    expect(normalizeDigits("٢٠٢٦")).toBe("2026");
  });

  it("leaves ASCII and separators untouched", () => {
    expect(normalizeDigits("1404-07-01")).toBe("1404-07-01");
  });
});

describe("Jalali bridge", () => {
  /**
   * Anchor facts, verifiable independently: 1 Farvardin 1404 is the Persian
   * new year falling on 21 March 2025.
   */
  it("converts known anchor dates", () => {
    expect(jalaliToIso("1404/01/01")).toBe("2025-03-21");
    expect(jalaliToIso("1403/01/01")).toBe("2024-03-20");
    expect(jalaliToIso("1405/01/01")).toBe("2026-03-21");
  });

  it("reads the exact format Enrollment.startDate uses", () => {
    // Persian digits, slash separated — the seeded value.
    expect(jalaliToIso("۱۴۰۴/۰۷/۰۱")).toBe("2025-09-23");
  });

  it("accepts ASCII digits and alternative separators", () => {
    expect(jalaliToIso("1404/07/01")).toBe("2025-09-23");
    expect(jalaliToIso("1404-07-01")).toBe("2025-09-23");
    expect(jalaliToIso("1404-7-1")).toBe("2025-09-23");
  });

  it("agrees with the platform's own Persian calendar", () => {
    // Cross-check the hand-rolled conversion against Intl for a spread of
    // dates, so a subtle cycle bug cannot pass unnoticed.
    for (const jalali of ["1404/01/01", "1404/06/31", "1404/07/01", "1404/12/29", "1405/05/15"]) {
      const iso = jalaliToIso(jalali)!;
      expect(iso, jalali).not.toBeNull();

      const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        timeZone: "UTC",
      }).formatToParts(new Date(`${iso}T12:00:00Z`));

      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
      const [jy, jm, jd] = jalali.split("/").map(Number);
      expect(get("year"), `${jalali} year`).toBe(jy);
      expect(get("month"), `${jalali} month`).toBe(jm);
      expect(get("day"), `${jalali} day`).toBe(jd);
    }
  });

  it("advances one day at a time consistently", () => {
    const a = jalaliToIso("1404/07/01")!;
    const b = jalaliToIso("1404/07/02")!;
    expect(daysBetween(a, b)).toBe(1);
  });

  it("agrees with Intl across a decade, not just at anchors", () => {
    /**
     * The first implementation used textbook 33-year-cycle arithmetic and
     * disagreed with Intl by one day in roughly half of these years, because
     * Iran's civil calendar follows the astronomical equinox rather than a
     * fixed leap cycle. This sweep is what caught it.
     */
    const fmt = new Intl.DateTimeFormat("en-US-u-ca-persian", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });

    let checked = 0;
    for (let jy = 1400; jy <= 1410; jy += 1) {
      for (let jm = 1; jm <= 12; jm += 1) {
        for (const jd of [1, 15, 29]) {
          const iso = jalaliToIso(`${jy}/${jm}/${jd}`);
          expect(iso, `${jy}/${jm}/${jd} should convert`).not.toBeNull();

          const parts = fmt.formatToParts(new Date(`${iso}T12:00:00Z`));
          const pick = (t: string) => Number(parts.find((p) => p.type === t)?.value);
          expect(pick("year"), `${jy}/${jm}/${jd} year`).toBe(jy);
          expect(pick("month"), `${jy}/${jm}/${jd} month`).toBe(jm);
          expect(pick("day"), `${jy}/${jm}/${jd} day`).toBe(jd);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(396);
  });

  it("rejects dates that do not exist in the Jalali calendar", () => {
    // Months 7-12 have at most 30 days.
    expect(jalaliToIso("1404/07/31")).toBeNull();
    expect(jalaliToIso("1404/12/31")).toBeNull();
    // 30 Esfand exists only in a leap year; 1404 is not one.
    expect(jalaliToIso("1404/12/30")).toBeNull();
  });

  it("accepts 30 Esfand in a Jalali leap year", () => {
    // 1403 is a leap year, so 1403/12/30 is a real date.
    expect(jalaliToIso("1403/12/30")).toBe("2025-03-20");
  });

  it("fails closed on unparseable input", () => {
    // A roster must never silently include a student because a date could not
    // be read, so every one of these returns null rather than a guess.
    for (const bad of ["", "nope", "1404", "1404/07", "1404/13/01", "1404/00/01", "1404/07/00", "1404/07/32"]) {
      expect(jalaliToIso(bad), `"${bad}"`).toBeNull();
    }
  });

  it("does not throw on a non-string", () => {
    expect(jalaliToIso(undefined as unknown as string)).toBeNull();
  });
});

describe("Jalali display", () => {
  it("formats an ISO date in Persian", () => {
    const display = isoToJalaliDisplay("2025-09-23");
    // Persian digits present, and the year reads 1404.
    expect(/[\u06F0-\u06F9]/.test(display)).toBe(true);
    expect(normalizeDigits(display)).toContain("1404");
  });

  it("returns an empty string for an invalid date rather than throwing", () => {
    expect(isoToJalaliDisplay("2026-02-30")).toBe("");
  });
});
