/**
 * The shared plumbing CP2–CP4 build on: the academy's own day, and the id index.
 *
 * WHAT THESE TESTS ARE FOR
 *
 * Both helpers are small, and both are load-bearing for every relation the M7
 * checkpoints rewire: a session window is built from the academy's calendar day,
 * and every relation display resolves a foreign key against repository rows. A
 * silent change in either would move every date and mis-resolve every relation
 * across three surfaces, so the behaviour is pinned here rather than observed in
 * the views.
 *
 * THE ONE TEST THAT MATTERS MOST is the cross-check against
 * `weekdayIndex` in `domains/scheduling/dateBridge`: it is the domain's own
 * implementation of the Saturday-first convention, and the M7 views read sessions
 * through that domain. Two implementations of one convention are only safe while
 * something compares them.
 *
 * Comments in the helpers and in this file are checked by the gate
 * (`views/__tests__/relationsNoFixtures.test.ts`), which scans the plumbing for
 * fixture imports, store access and a second clock. This file tests behaviour;
 * the gate enforces shape. Neither replaces the other.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { academyNow, academyNowMinutes } from "@/domains/shared/clock";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { weekdayIndex } from "@/domains/scheduling/dateBridge";
import { NO_DATA } from "@/lib/format";
import { academyIsoDate, academyWeekdayIndex } from "@/views/relations/academyDay";
import { indexById } from "@/views/relations/indexById";

/** A local-midday instant, the way `academyNow()` builds one. */
const day = (year: number, month: number, date: number, hours = 10, minutes = 47): Date =>
  new Date(year, month - 1, date, hours, minutes, 0, 0);

/* ------------------------------------------------------------------ */
/* The academy day                                                     */
/* ------------------------------------------------------------------ */

describe("the academy day comes from the clock, in the product's weekday convention", () => {
  /**
   * One full week, Saturday first — the convention `class.days`, the seeded
   * recurrence and `WEEKDAYS` are all written in. 2026-09-01 is the demo seed's
   * own anchor (`SEED_DATE`) and is a Tuesday, i.e. index 3.
   */
  const WEEK: readonly { iso: string; index: number; name: string }[] = [
    { iso: "2026-08-29", index: 0, name: "شنبه" },
    { iso: "2026-08-30", index: 1, name: "یکشنبه" },
    { iso: "2026-08-31", index: 2, name: "دوشنبه" },
    { iso: "2026-09-01", index: 3, name: "سه‌شنبه" },
    { iso: "2026-09-02", index: 4, name: "چهارشنبه" },
    { iso: "2026-09-03", index: 5, name: "پنجشنبه" },
    { iso: "2026-09-04", index: 6, name: "جمعه" },
  ];

  it("maps every day of the week Saturday-first", () => {
    for (const { iso, index, name } of WEEK) {
      const [y, m, d] = iso.split("-").map(Number);
      const date = day(y, m, d);
      expect(academyIsoDate(date), `ISO date for ${iso}`).toBe(iso);
      expect(academyWeekdayIndex(date), `${iso} is ${name} → ${index}`).toBe(index);
    }
  });

  it("agrees with the scheduling domain's own weekdayIndex, week and year boundaries included", () => {
    const samples: Date[] = [
      ...WEEK.map(({ iso }) => {
        const [y, m, d] = iso.split("-").map(Number);
        return day(y, m, d);
      }),
      day(2026, 1, 1),
      day(2026, 3, 21),
      day(2026, 6, 30),
      day(2026, 12, 31),
      day(2027, 1, 1),
      day(2028, 2, 29),
    ];

    const seen = new Set<number>();
    for (const date of samples) {
      const iso = academyIsoDate(date);
      const fromDomain = weekdayIndex(iso);
      expect(fromDomain, `${iso} must be a valid ISO date`).not.toBeNull();
      expect(academyWeekdayIndex(date), `${iso}: our index must equal weekdayIndex(${iso})`).toBe(
        fromDomain,
      );
      seen.add(academyWeekdayIndex(date));
    }

    // Non-vacuity: the cross-check has to cover all seven indexes, or it could
    // pass while comparing the same weekday to itself.
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("formats the calendar date from the academy's own local components", () => {
    expect(academyIsoDate(day(2026, 1, 5))).toBe("2026-01-05");
    expect(academyIsoDate(day(2026, 12, 31))).toBe("2026-12-31");
    expect(academyIsoDate(day(2026, 9, 1))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("ignores the time of day — 00:00 and 23:59 are the same academy day", () => {
    const midnight = day(2026, 9, 1, 0, 0);
    const lastMinute = day(2026, 9, 1, 23, 59);
    expect(academyIsoDate(midnight)).toBe(academyIsoDate(lastMinute));
    expect(academyWeekdayIndex(midnight)).toBe(academyWeekdayIndex(lastMinute));
  });

  describe("the default argument is the academy clock", () => {
    afterEach(() => {
      vi.useRealTimers();
      resetRuntimeConfig();
    });

    it("reads the day through academyNow() rather than the wall clock", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 1, 0, 0, 0));

      expect(academyIsoDate()).toBe("2026-09-01");
      expect(academyWeekdayIndex()).toBe(3);
      // The default is the sanctioned clock, not a second one.
      expect(academyIsoDate()).toBe(academyIsoDate(academyNow()));
      expect(academyWeekdayIndex()).toBe(academyWeekdayIndex(academyNow()));
    });

    it("derives the same day in demo and in production mode; only the time of day differs", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 1, 0, 0, 0));

      setRuntimeConfig({ mode: "demo" });
      const demoDay = academyIsoDate();
      const demoMinutes = academyNowMinutes();

      setRuntimeConfig({ mode: "api" });
      const liveDay = academyIsoDate();
      const liveMinutes = academyNowMinutes();

      expect(demoDay).toBe("2026-09-01");
      expect(liveDay).toBe(demoDay);
      expect(academyWeekdayIndex()).toBe(3);
      // The frozen demo instant is a time of day, never a date.
      expect(demoMinutes).not.toBe(liveMinutes);
    });
  });
});

/* ------------------------------------------------------------------ */
/* The relation index                                                  */
/* ------------------------------------------------------------------ */

describe("indexById resolves a foreign key against repository rows", () => {
  it("indexes each of the four M7 relations by id", () => {
    const teachers = [
      { id: "t1", name: "سارا احمدی" },
      { id: "t2", name: "محمد رضایی" },
    ];
    const rooms = [
      { id: "r1", name: "اتاق ۱" },
      { id: "r2", name: "اتاق ۲" },
    ];
    const classes = [
      { id: "cl1", title: "پیانو گروهی" },
      { id: "cl2", title: "گیتار مقدماتی" },
    ];
    const students = [
      { id: "st1", name: "نیلوفر رستمی" },
      { id: "st2", name: "پویا کریمی" },
    ];

    expect(indexById(teachers).get("t2")?.name).toBe("محمد رضایی");
    expect(indexById(rooms).get("r1")?.name).toBe("اتاق ۱");
    expect(indexById(classes).get("cl2")?.title).toBe("گیتار مقدماتی");
    expect(indexById(students).get("st1")?.name).toBe("نیلوفر رستمی");
  });

  it("answers undefined for an id the loaded page does not contain", () => {
    const students = [{ id: "st1", name: "نیلوفر رستمی" }];
    const byId = indexById(students);

    expect(byId.get("st404")).toBeUndefined();
    // The honest rendering for a relation that resolves to nothing: «—», never
    // an invented name and never the raw id.
    expect(byId.get("st404")?.name ?? NO_DATA).toBe(NO_DATA);
  });

  it("handles an empty page", () => {
    const byId = indexById([]);
    expect(byId.size).toBe(0);
    expect(byId.get("anything")).toBeUndefined();
  });

  it("keeps row identity, so a resolved row can be compared with ===", () => {
    const teachers = [{ id: "t1", name: "سارا احمدی" }];
    expect(indexById(teachers).get("t1")).toBe(teachers[0]);
  });

  it("lets the last row win when an id is duplicated", () => {
    // Repository pages have unique ids, so this is a contract for the impossible
    // case rather than a scenario to render: deterministic, not accidental.
    const duplicated = [
      { id: "t1", name: "قدیمی" },
      { id: "t1", name: "به‌روز" },
    ];
    expect(indexById(duplicated).get("t1")?.name).toBe("به‌روز");
    expect(indexById(duplicated).size).toBe(1);
  });

  it("does not modify the rows it indexes", () => {
    const teachers = [
      { id: "t1", name: "سارا احمدی" },
      { id: "t2", name: "محمد رضایی" },
    ];
    const before = teachers.map((row) => ({ ...row }));

    indexById(teachers);

    expect(teachers).toEqual(before);
    expect(teachers.map((row) => row.id)).toEqual(["t1", "t2"]);
  });
});
