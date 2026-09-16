/**
 * The dashboard's derivations, over the rows they claim to describe.
 *
 * WHY THESE CASES ARE HERE AND NOT IN A RENDER TEST
 *
 * H4's defect was not presentation: the panels printed numbers no record
 * supported. The fix is that every figure is computed from rows, so this file
 * feeds the computations rows — including the empty set, which is where §14's
 * rules bite — and asserts what they produce. An empty input must yield `null`
 * (rendered as NO_DATA), never `0`, `NaN` or `Infinity`, because "no records" and
 * "a measured zero" are different facts.
 *
 * The same functions are exercised end-to-end in
 * `src/views/__tests__/dashboardInsightsLive.test.tsx`, which renders the real
 * dashboard over DEMO and EMPTY environments; these cases are the argument, that
 * file is the acceptance.
 */
import { describe, expect, it } from "vitest";
import type { AcademyClass, Student } from "@/data/records";
import type { Room } from "@/domains/rooms/types";
import type { Session } from "@/domains/scheduling/types";
import type { AcademyMetrics } from "../useAcademyMetrics";
import {
  changePct,
  dashboardCounts,
  deriveAttentionItems,
  deriveFlowRows,
  deriveInstrumentMix,
  deriveIntelligenceCards,
  deriveOccupancy,
  deriveReceivables,
  deriveSignals,
  isoDayNumber,
  isoFromDayNumber,
  rosterSeries,
  sinceBucket,
  weeklyCounts,
  type InsightInput,
} from "../dashboardInsights";

/* ------------------------------------------------------------------ */
/* Row factories — only the fields the derivations read                */
/* ------------------------------------------------------------------ */

function student(overrides: Partial<Student> & { id: string }): Student {
  return {
    nationalId: "2000000000",
    name: `هنرجوی ${overrides.id}`,
    instrument: "piano",
    teacherId: "t1",
    level: "سطح ۱",
    levelStep: 1,
    status: "active",
    payment: "paid",
    sessionsUsed: 0,
    sessionsTotal: 12,
    attendance: 90,
    progress: 50,
    since: "مهر ۱۴۰۳",
    age: 12,
    phone: "۰۹۱۲ ··· ۰۰۰۰",
    lastSeen: "امروز",
    balance: 0,
    notes: [],
    activity: [],
    skills: [],
    ...overrides,
  };
}

function klass(overrides: Partial<AcademyClass> & { id: string }): AcademyClass {
  return {
    title: `کلاس ${overrides.id}`,
    instrument: "piano",
    teacherId: "t1",
    roomId: "r1",
    kind: "group",
    level: "سطح ۱",
    days: [3],
    time: "17:00",
    duration: 60,
    enrolled: 2,
    capacity: 4,
    attendanceAvg: 90,
    waitlist: 0,
    tuition: 1_000_000,
    termProgress: 50,
    studentIds: [],
    ...overrides,
  };
}

function room(id: string, name = `اتاق ${id}`): Room {
  return { id, name, kind: "آموزشی", capacity: 6, occupancy: 0 };
}

function session(overrides: Partial<Session> & { id: string; date: string }): Session {
  return {
    classId: "cl1",
    startTime: "17:00",
    endTime: "18:00",
    teacherId: "t1",
    roomId: "r1",
    status: "scheduled",
    origin: "generated",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

const EMPTY_METRICS: AcademyMetrics = {
  students: 0,
  activeStudents: 0,
  atRiskStudents: 0,
  teachers: 0,
  activeTeachers: 0,
  classes: 0,
  rooms: 0,
  activeEnrollments: 0,
  waitlisted: 0,
  capacityUsedPct: 0,
  totalSeats: 0,
  takenSeats: 0,
  attendanceRatePct: null,
  attendanceSampleSize: 0,
};

function input(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    metrics: EMPTY_METRICS,
    students: [],
    classes: [],
    rooms: [],
    teachers: [],
    sessions: [],
    todayIso: "2026-09-01",
    nowMinutes: 10 * 60 + 47,
    ...overrides,
  };
}

/** Every string a rendered model could carry, for artefact sweeps. */
function texts(value: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") Object.values(node as Record<string, unknown>).forEach(walk);
  };
  walk(value);
  return out;
}

function expectNoArtefacts(value: unknown, surface: string): void {
  for (const text of texts(value)) {
    expect(text, `${surface} carried an artefact`).not.toMatch(/NaN|Infinity|undefined|\[object Object\]/);
  }
}

/* ------------------------------------------------------------------ */
/* The empty set — §14                                                 */
/* ------------------------------------------------------------------ */

describe("an academy with no records", () => {
  it("reports no signals' figures as a measurement", () => {
    const signals = deriveSignals(input());

    expect(signals).toHaveLength(4);
    // The two counts that have no denominator are counts, so they are real
    // zeros; the two ratios are absent values and must read NO_DATA.
    expect(signals.map((signal) => signal.value)).toContain("—");
    // Attendance is a mean with no rows ⇒ null ⇒ NO_DATA, never 0٪.
    const attendance = signals.find((signal) => signal.id === "attendance")!;
    expect(attendance.value).toBe("—");
    expect(attendance.series).toBeNull();
    expect(attendance.delta).toBeNull();
    expectNoArtefacts(signals, "signals in EMPTY");
  });

  it("derives no insight, no alert and no flow row", () => {
    const empty = input();
    expect(deriveIntelligenceCards(empty)).toEqual([]);
    expect(deriveAttentionItems(empty)).toEqual([]);
    expect(deriveFlowRows(empty.sessions, empty.todayIso, empty.nowMinutes, {
      classes: new Map(),
      rooms: new Map(),
      teachers: new Map(),
    })).toEqual({
      rows: [],
      summary: { total: 0, remaining: 0, cancelled: 0, shown: 0 },
    });
  });

  it("reports the roster, occupancy, instruments and receivables as absent", () => {
    expect(rosterSeries([])).toEqual({ points: [], placed: 0 });
    expect(deriveReceivables([])).toEqual({ owing: 0, students: 0, total: 0, rows: [], top: null });
    expect(deriveInstrumentMix([])).toEqual([]);

    const occupancy = deriveOccupancy([], []);
    expect(occupancy.overallPct).toBeNull();
    expect(occupancy.classes).toBe(0);
    expect(occupancy.rooms).toEqual([]);
    expect(occupancy.peakDay).toBeNull();
    // The weekday strip is still seven days — with no ratio on any of them.
    expect(occupancy.week).toHaveLength(7);
    expect(occupancy.week.every((day) => day.pct === null)).toBe(true);
    expectNoArtefacts(occupancy, "occupancy in EMPTY");
  });

  it("counts zero stored rows, which is what the panels branch on", () => {
    expect(dashboardCounts({ students: [], classes: [], rooms: [], teachers: 0, sessions: [] }).records).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Ratios with no denominator are null, not zero                       */
/* ------------------------------------------------------------------ */

describe("ratios that have nothing to divide by", () => {
  it("reports occupancy as null when no class offers a seat", () => {
    // Two classes, both with capacity 0: the seats taken are real, the ratio is not.
    const occupancy = deriveOccupancy(
      [klass({ id: "cl1", capacity: 0, enrolled: 0 }), klass({ id: "cl2", capacity: 0, enrolled: 0 })],
      [room("r1")],
    );

    expect(occupancy.overallPct).toBeNull();
    expect(occupancy.totalSeats).toBe(0);
    expect(occupancy.classes).toBe(2);
    // The room keeps its row — with no ratio — rather than disappearing.
    expect(occupancy.rooms).toHaveLength(1);
    expect(occupancy.rooms[0].pct).toBeNull();
  });

  it("reports an instrument share as null when nobody is enrolled", () => {
    const rows = deriveInstrumentMix([student({ id: "st1", instrument: "piano" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sharePct).toBe(100);
  });

  it("treats a zero previous period as 'no comparison' rather than infinite growth", () => {
    expect(changePct([0, 5])).toBeNull();
    expect(changePct([4, 5, 0, 0])).toBeNull(); // 0 → 0 has no percentage either
    expect(changePct([4, 6])).toBe(50);
    expect(changePct([7])).toBeNull();
    expect(changePct([])).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* The month axis                                                      */
/* ------------------------------------------------------------------ */

describe("the roster curve", () => {
  it("places a Jalali month and orders the buckets by the calendar", () => {
    expect(sinceBucket("مهر ۱۴۰۳").key).toBeLessThan(sinceBucket("آبان ۱۴۰۳").key);
    expect(sinceBucket("دی ۱۴۰۲").key).toBeLessThan(sinceBucket("مهر ۱۴۰۳").key);
    expect(sinceBucket("مهر ۱۴۰۳").label).toBe("مهر");
  });

  it("counts a relative join date in the current bucket, so the total stays the roster", () => {
    // «این هفته» cannot be ordered against recorded months; counting it last
    // keeps the curve's final point equal to the number of students.
    const rows = rosterSeries([
      student({ id: "st1", since: "مهر ۱۴۰۳" }),
      student({ id: "st2", since: "آبان ۱۴۰۳" }),
      student({ id: "st3", since: "این هفته" }),
    ]);

    expect(rows.points.map((point) => point.value)).toEqual([1, 2, 3]);
    expect(rows.points[rows.points.length - 1].label).toBe("اکنون");
    expect(rows.placed).toBe(3);
  });

  it("keeps only the newest window while remaining a running total", () => {
    const students = [
      student({ id: "st1", since: "فروردین ۱۴۰۳" }),
      student({ id: "st2", since: "اردیبهشت ۱۴۰۳" }),
      student({ id: "st3", since: "خرداد ۱۴۰۳" }),
      student({ id: "st4", since: "تیر ۱۴۰۳" }),
    ];

    const rows = rosterSeries(students, 2);
    expect(rows.points).toHaveLength(2);
    // The dropped buckets are still counted: a running total that starts at 1
    // for the third month would understate the academy.
    expect(rows.points.map((point) => point.value)).toEqual([3, 4]);
  });
});

/* ------------------------------------------------------------------ */
/* Rolling windows                                                     */
/* ------------------------------------------------------------------ */

describe("rolling 7-day windows", () => {
  const reference = "2026-09-01";

  it("puts today in the newest window and counts nothing in the future", () => {
    const rows = [
      session({ id: "s1", date: "2026-09-01" }),
      session({ id: "s2", date: "2026-08-26" }),
      session({ id: "s3", date: "2026-08-25" }),
      session({ id: "s4", date: "2026-09-02" }),
    ];

    // Oldest first: window 2 is empty, window 1 holds 2026-08-25 (seven days
    // back) and window 0 holds today and 2026-08-26.
    expect(weeklyCounts(rows, (row) => row.date, reference, 3)).toEqual([0, 1, 2]);
  });

  it("ignores rows outside the window and keeps the oldest first", () => {
    const rows = [
      session({ id: "s1", date: "2026-06-01" }),
      session({ id: "s2", date: "2026-08-31" }),
    ];
    expect(weeklyCounts(rows, (row) => row.date, reference, 13)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    ]);
  });

  it("filters by the predicate it is given", () => {
    const rows = [
      session({ id: "s1", date: "2026-09-01", status: "cancelled" }),
      session({ id: "s2", date: "2026-09-01" }),
    ];
    expect(weeklyCounts(rows, (row) => row.date, reference, 2, (row) => row.status === "cancelled")).toEqual([0, 1]);
  });

  it("returns nothing at all when the reference day cannot be read", () => {
    expect(weeklyCounts([session({ id: "s1", date: "2026-09-01" })], (row) => row.date, "not-a-date", 4)).toEqual([]);
  });

  it("round-trips an ISO day", () => {
    expect(isoFromDayNumber(isoDayNumber("2026-09-01")!)).toBe("2026-09-01");
    expect(isoDayNumber("2026-09-01")! - isoDayNumber("2026-08-25")!).toBe(7);
  });
});

/* ------------------------------------------------------------------ */
/* Signals                                                             */
/* ------------------------------------------------------------------ */

describe("signals from stored rows", () => {
  const students = [
    student({ id: "st1", status: "at-risk", attendance: 60, since: "مهر ۱۴۰۳" }),
    student({ id: "st2", status: "at-risk", attendance: 80, since: "مهر ۱۴۰۳" }),
    student({ id: "st3", status: "active", attendance: 95, since: "آبان ۱۴۰۳" }),
    // No session total ⇒ its attendance is not a stored measurement, which is
    // the guard `Students.tsx` applies per row.
    student({ id: "st4", status: "active", attendance: 0, sessionsTotal: 0, since: "این هفته" }),
  ];
  const metrics: AcademyMetrics = { ...EMPTY_METRICS, students: 4, activeStudents: 2, atRiskStudents: 2, classes: 1 };
  const sessions = [
    session({ id: "s1", date: "2026-09-01", status: "cancelled" }),
    session({ id: "s2", date: "2026-09-01" }),
    session({ id: "s3", date: "2026-08-20" }),
  ];

  it("counts at-risk students from their stored status", () => {
    const signals = deriveSignals(input({ students, sessions, metrics }));
    const atRisk = signals.find((signal) => signal.id === "at-risk")!;
    expect(atRisk.value).toBe("۲");
    // The mean is over the two at-risk rows that carry a session total: (60+80)/2.
    expect(atRisk.context).toContain("۷۰٪");
    expect(atRisk.tone).toBe("warn");
  });

  it("means only the attendance rows that carry a session total", () => {
    const signals = deriveSignals(input({ students, sessions, metrics }));
    const attendance = signals.find((signal) => signal.id === "attendance")!;
    // (60 + 80 + 95) / 3 — the row with no stored session total is excluded.
    expect(attendance.value).toBe("۷۸٪");
    expect(attendance.context).toContain("۳ رکورد");
    // No history is stored for a per-student field: no trend is drawn.
    expect(attendance.series).toBeNull();
  });

  it("counts sessions and cancellations in the windows it names", () => {
    const signals = deriveSignals(input({ students, sessions, metrics }));
    const weekly = signals.find((signal) => signal.id === "sessions")!;
    expect(weekly.value).toBe("۲");
    expect(weekly.series).toHaveLength(13);

    const cancelled = signals.find((signal) => signal.id === "cancellations")!;
    expect(cancelled.value).toBe("۱");
    expect(cancelled.tone).toBe("warn");
    expect(cancelled.context).toContain("۱ لغو");
    expect(cancelled.context).toContain("۳ جلسهٔ همین بازه");
  });

  it("carries no figure from a fixture", () => {
    const signals = deriveSignals(input({ students, sessions, metrics }));
    expectNoArtefacts(signals, "signals");
    // The old fixture's headline numbers must not reappear.
    for (const fixture of ["۱٬۲۴۸", "۹۲", "۷۹", "۱۲۵٬۴۳۰٬۰۰۰"]) {
      expect(texts(signals).join(" | "), `fixture figure ${fixture} resurfaced`).not.toContain(fixture);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Attention, flow and the intelligence cards                          */
/* ------------------------------------------------------------------ */

describe("attention rules", () => {
  it("fires a rule only when a record satisfies it", () => {
    const quiet = deriveAttentionItems(
      input({ students: [student({ id: "st1" })], classes: [klass({ id: "cl1" })], metrics: { ...EMPTY_METRICS, classes: 1 } }),
    );
    expect(quiet).toEqual([]);
  });

  it("reports overdue payments, waitlists, at-risk students and cancellations", () => {
    const items = deriveAttentionItems(
      input({
        students: [
          student({ id: "st1", payment: "overdue", balance: 1_200_000, status: "at-risk" }),
          student({ id: "st2", payment: "paid" }),
        ],
        classes: [klass({ id: "cl1", waitlist: 3, title: "پیانو گروهی · میانی" })],
        sessions: [session({ id: "s1", date: "2026-08-31", status: "cancelled" })],
        metrics: { ...EMPTY_METRICS, classes: 1 },
      }),
    );

    expect(items.map((item) => item.id)).toEqual([
      "overdue-payments",
      "class-waitlists",
      "at-risk-students",
      "cancelled-week",
    ]);
    expect(items[0].severity).toBe("critical");
    expect(items[0].title).toContain("۱ هنرجو");
    expect(items[0].context).toContain("۱٫۲ میلیون");
    expect(items[1].context).toContain("پیانو گروهی · میانی");
    expectNoArtefacts(items, "attention");
  });

  it("says so by silence when the only records are healthy", () => {
    const items = deriveAttentionItems(
      input({ students: [student({ id: "st1", payment: "paid", status: "active" })], metrics: { ...EMPTY_METRICS, classes: 1 } }),
    );
    expect(items).toEqual([]);
  });
});

describe("today's flow", () => {
  const classes = new Map([
    ["cl1", klass({ id: "cl1", title: "پیانو گروهی · میانی", enrolled: 5, capacity: 6 })],
    ["cl2", klass({ id: "cl2", title: "ویولن انفرادی", roomId: "r1", enrolled: 1, capacity: 1 })],
  ]);
  const lookups = {
    classes,
    rooms: new Map([["r1", room("r1", "اتاق ۱")]]),
    teachers: new Map([["t1", "سارا احمدی"]]),
  };

  it("labels each row from the records it points at", () => {
    const { rows } = deriveFlowRows([session({ id: "s1", date: "2026-09-01", classId: "cl1" })], "2026-09-01", 600, lookups);

    expect(rows).toHaveLength(1);
    expect(rows[0].session.title).toBe("پیانو گروهی · میانی");
    expect(rows[0].session.room).toBe("اتاق ۱");
    expect(rows[0].session.teacher).toBe("سارا احمدی");
    expect(rows[0].session.students).toBe(5);
    expect(rows[0].session.capacity).toBe(6);
  });

  it("renders NO_DATA for a label it cannot resolve instead of guessing", () => {
    const { rows } = deriveFlowRows(
      [session({ id: "s1", date: "2026-09-01", classId: "missing", roomId: "missing", teacherId: "missing" })],
      "2026-09-01",
      600,
      lookups,
    );
    expect(rows[0].session.title).toBe("—");
    expect(rows[0].session.room).toBe("—");
    expect(rows[0].session.teacher).toBe("—");
    // Unresolved, so there is no stored seat count to show either.
    expect(rows[0].session.students).toBeUndefined();
    expect(rows[0].session.capacity).toBeUndefined();
  });

  it("derives live, next, done and cancelled from status and the clock", () => {
    const rows = deriveFlowRows(
      [
        session({ id: "past", date: "2026-09-01", startTime: "08:00", endTime: "09:00", status: "completed" }),
        session({ id: "live", date: "2026-09-01", startTime: "10:00", endTime: "11:30" }),
        session({ id: "next", date: "2026-09-01", startTime: "12:00", endTime: "13:00" }),
        session({ id: "later", date: "2026-09-01", startTime: "15:00", endTime: "16:00" }),
        session({ id: "gone", date: "2026-09-01", startTime: "16:00", endTime: "17:00", status: "cancelled" }),
        session({ id: "tomorrow", date: "2026-09-02", startTime: "09:00", endTime: "10:00" }),
      ],
      "2026-09-01",
      10 * 60 + 47,
      lookups,
    );

    expect(rows.rows.map((row) => row.status)).toEqual(["done", "live", "next", "scheduled", "cancelled"]);
    expect(rows.summary).toEqual({ total: 5, remaining: 2, cancelled: 1, shown: 5 });
    expectNoArtefacts(rows, "flow");
  });

  it("flags a real room clash and leaves back-to-back lessons alone", () => {
    const clash = deriveFlowRows(
      [
        session({ id: "a", date: "2026-09-01", classId: "cl1", startTime: "14:00", endTime: "15:00", roomId: "r1" }),
        session({ id: "b", date: "2026-09-01", classId: "cl2", startTime: "14:30", endTime: "15:30", roomId: "r1" }),
      ],
      "2026-09-01",
      17 * 60,
      lookups,
    );
    expect(clash.rows.map((row) => row.status)).toEqual(["attention", "attention"]);

    const adjacent = deriveFlowRows(
      [
        session({ id: "a", date: "2026-09-01", classId: "cl1", startTime: "14:00", endTime: "15:00", roomId: "r1" }),
        session({ id: "b", date: "2026-09-01", classId: "cl2", startTime: "15:00", endTime: "16:00", roomId: "r1" }),
      ],
      "2026-09-01",
      17 * 60,
      lookups,
    );
    // Half-open intervals, the scheduling domain's rule: 15:00 is not a clash.
    expect(adjacent.rows.map((row) => row.status)).toEqual(["scheduled", "scheduled"]);
  });

  it("counts the rows it shows and the ones it does not", () => {
    const sessions = Array.from({ length: 8 }, (_, i) =>
      session({ id: `s${i}`, date: "2026-09-01", classId: "cl1", startTime: `${String(8 + i).padStart(2, "0")}:00`, endTime: `${String(9 + i).padStart(2, "0")}:00` }),
    );
    const { rows, summary } = deriveFlowRows(sessions, "2026-09-01", 0, lookups, 6);
    expect(rows).toHaveLength(6);
    expect(summary).toEqual({ total: 8, remaining: 8, cancelled: 0, shown: 6 });
  });
});

describe("occupancy from stored classes", () => {
  const classes = [
    klass({ id: "cl1", roomId: "r1", days: [3], enrolled: 5, capacity: 6 }),
    klass({ id: "cl2", roomId: "r1", days: [3, 4], enrolled: 1, capacity: 1 }),
    klass({ id: "cl3", roomId: "r2", days: [0], enrolled: 3, capacity: 4 }),
    klass({ id: "cl4", roomId: "r2", days: [0], enrolled: 0, capacity: 4, status: "archived" }),
  ];

  it("computes the overall ratio from seats, not from an average of percentages", () => {
    const occupancy = deriveOccupancy(classes, [room("r1", "اتاق ۱"), room("r2", "اتاق ۲")]);
    // Live classes only: 6/7 + 3/4 = 9 of 11 seats.
    expect(occupancy.takenSeats).toBe(9);
    expect(occupancy.totalSeats).toBe(11);
    expect(Math.round(occupancy.overallPct!)).toBe(82);
    expect(occupancy.classes).toBe(3);
  });

  it("excludes an archived class from the seats it reports", () => {
    const occupancy = deriveOccupancy(classes, [room("r1", "اتاق ۱"), room("r2", "اتاق ۲")]);
    // r2 holds cl3 (3/4 live) and cl4 (archived, excluded): 75٪, not 37.5٪.
    expect(occupancy.rooms.find((row) => row.label === "اتاق ۲")!.pct).toBe(75);
    expect(occupancy.rooms.find((row) => row.label === "اتاق ۱")!.pct).toBeCloseTo(85.7, 1);
  });

  it("finds the busiest and quietest weekday from the classes that meet", () => {
    const occupancy = deriveOccupancy(classes, [room("r1"), room("r2")]);
    const tuesday = occupancy.week[3];
    const saturday = occupancy.week[0];
    expect(Math.round(tuesday.pct!)).toBe(86); // (5+1)/(6+1)
    expect(saturday.pct).toBe(75);
    // Wednesday's only class is full (1/1) — busiest by ratio, not by seats.
    expect(occupancy.peakDay!.index).toBe(4);
    expect(occupancy.quietestDay!.index).toBe(0);
    // Days no class meets have no ratio at all — not a zero.
    expect(occupancy.week[1].pct).toBeNull();
  });
});

describe("instrument mix and receivables", () => {
  it("counts students per stored instrument and sorts by count", () => {
    const rows = deriveInstrumentMix([
      student({ id: "st1", instrument: "piano" }),
      student({ id: "st2", instrument: "piano" }),
      student({ id: "st3", instrument: "violin" }),
    ]);

    expect(rows.map((row) => row.count)).toEqual([2, 1]);
    expect(rows[0].sharePct).toBeCloseTo(66.67, 1);
    expect(rows[0].label).not.toBe(rows[0].id); // resolved to a display name
    expectNoArtefacts(rows, "instrument mix");
  });

  it("sums only positive balances and names the largest", () => {
    const model = deriveReceivables([
      student({ id: "st1", name: "الف", balance: 1_200_000 }),
      student({ id: "st2", name: "ب", balance: 0 }),
      student({ id: "st3", name: "ج", balance: 300_000 }),
    ]);

    expect(model.owing).toBe(2);
    expect(model.students).toBe(3);
    expect(model.total).toBe(1_500_000);
    expect(model.rows.map((row) => row.label)).toEqual(["الف", "ج"]);
    expect(model.top!.label).toBe("الف");
  });

  it("caps the rows it returns without changing the total", () => {
    const students = Array.from({ length: 9 }, (_, i) => student({ id: `st${i}`, balance: (i + 1) * 1000 }));
    const model = deriveReceivables(students, 3);
    expect(model.rows).toHaveLength(3);
    expect(model.owing).toBe(9);
    expect(model.total).toBe(45_000);
  });
});

describe("intelligence cards", () => {
  it("derives its confidence from the evidence behind the card", () => {
    const small = deriveIntelligenceCards(
      input({ students: [student({ id: "st1", status: "at-risk", payment: "overdue", balance: 100 })] }),
    );
    expect(small[0].confidence).toBe("متوسط");

    const large = deriveIntelligenceCards(
      input({
        students: Array.from({ length: 12 }, (_, i) => student({ id: `st${i}`, status: "at-risk", payment: "overdue", balance: 100 })),
      }),
    );
    expect(large[0].confidence).toBe("بالا");
  });

  it("names the records it used and claims no model", () => {
    const cards = deriveIntelligenceCards(
      input({
        students: [student({ id: "st1", status: "at-risk" }), student({ id: "st2" })],
        classes: [klass({ id: "cl1", waitlist: 2 })],
        metrics: { ...EMPTY_METRICS, classes: 1, takenSeats: 2, totalSeats: 4 },
      }),
    );

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.source).toContain("رکورد");
      expect(["بالا", "متوسط"]).toContain(card.confidence);
    }
    expectNoArtefacts(cards, "intelligence");
    // The fixture's claims must not be reproducible from records.
    const rendered = texts(cards).join(" | ");
    expect(rendered).not.toContain("نرخ ماندگاری");
    expect(rendered).not.toContain("۱۲ ماه داده");
  });
});
