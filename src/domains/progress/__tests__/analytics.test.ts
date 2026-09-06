/**
 * Analytics and plateau detection.
 *
 * These are the numbers a teacher will act on, so the tests pin exact
 * definitions rather than asserting "roughly increases". Boundary cases get
 * particular attention: an off-by-one in a plateau threshold means either
 * crying wolf or missing a stuck student.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  analyzePiece,
  analyzePlacementHistory,
  classifyProgress,
  daysBetween,
  describeRange,
  sortByTime,
  trailingSameRangeCount,
} from "../analytics";
import type { ProgressEvent } from "../types";

const DAY = 86_400_000;
const BASE = Date.parse("2026-01-01T10:00:00.000Z");

/** Builds an event `dayOffset` days after the base instant. */
function ev(dayOffset: number, fields: Partial<ProgressEvent> = {}): ProgressEvent {
  return {
    id: `pe_${dayOffset}_${fields.mastery ?? 0}_${fields.rangeStart ?? 0}`,
    studentId: "st1",
    pieceId: "pc1",
    assignmentId: "as1",
    recordedAt: new Date(BASE + dayOffset * DAY).toISOString(),
    mastery: 50,
    source: "teacher",
    ...fields,
  };
}

const NOW = new Date(BASE + 100 * DAY);

describe("helpers", () => {
  it("sorts chronologically regardless of input order", () => {
    const sorted = sortByTime([ev(5), ev(1), ev(3)]);
    expect(sorted.map((e) => e.recordedAt)).toEqual([...sorted].map((e) => e.recordedAt).sort());
  });

  it("counts whole days and never returns a negative", () => {
    expect(daysBetween("2026-01-01T00:00:00Z", "2026-01-11T00:00:00Z")).toBe(10);
    expect(daysBetween("2026-01-11T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(0);
  });

  it("returns 0 days for an unparseable timestamp rather than NaN", () => {
    expect(daysBetween("not-a-date", "2026-01-01T00:00:00Z")).toBe(0);
  });

  it("describes numeric and free-form ranges", () => {
    expect(describeRange(ev(0, { rangeStart: 37, rangeEnd: 42 }))).toBe("37–42");
    expect(describeRange(ev(0, { rangeLabel: "بخش ب" }))).toBe("بخش ب");
    expect(describeRange(ev(0))).toBeNull();
  });
});

describe("empty and single-event histories", () => {
  it("reports nulls, not zeros, when there is no data", () => {
    const stats = analyzePiece([], NOW);
    expect(stats.events).toBe(0);
    // A null mastery means "unknown"; 0 would mean "measured as zero".
    expect(stats.masteryLatest).toBeNull();
    expect(stats.masteryPerWeek).toBeNull();
    expect(stats.daysSinceLastEvent).toBeNull();
  });

  it("cannot compute a rate from one event", () => {
    const stats = analyzePiece([ev(0, { mastery: 40 })], NOW);
    expect(stats.events).toBe(1);
    expect(stats.masteryChange).toBe(0);
    expect(stats.masteryPerWeek).toBeNull();
  });

  it("does not divide by a zero span", () => {
    // Two events on the same day.
    const stats = analyzePiece([ev(0, { mastery: 40 }), ev(0, { mastery: 60 })], NOW);
    expect(stats.masteryPerWeek).toBeNull();
    expect(Number.isFinite(stats.masteryChange ?? 0)).toBe(true);
  });
});

describe("learning velocity", () => {
  it("computes mastery points per week", () => {
    // +14 points over 14 days = 7 points/week.
    const stats = analyzePiece([ev(0, { mastery: 40 }), ev(14, { mastery: 54 })], NOW);
    expect(stats.masteryChange).toBe(14);
    expect(stats.masteryPerWeek).toBe(7);
  });

  it("reports a negative velocity when mastery falls", () => {
    const stats = analyzePiece([ev(0, { mastery: 60 }), ev(7, { mastery: 53 })], NOW);
    expect(stats.masteryPerWeek).toBe(-7);
  });
});

describe("tempo", () => {
  it("tracks change and progress toward the target", () => {
    const stats = analyzePiece(
      [ev(0, { tempoBpm: 60, targetTempoBpm: 120 }), ev(10, { tempoBpm: 90, targetTempoBpm: 120 })],
      NOW,
    );
    expect(stats.tempoChange).toBe(30);
    expect(stats.tempoTargetPercent).toBe(75);
  });

  it("leaves tempo null when no event carries one", () => {
    const stats = analyzePiece([ev(0), ev(5)], NOW);
    expect(stats.tempoChange).toBeNull();
    expect(stats.tempoTargetPercent).toBeNull();
  });

  it("caps the target percentage at 100 when the student exceeds the target", () => {
    const stats = analyzePiece([ev(0, { tempoBpm: 130, targetTempoBpm: 120 })], NOW);
    expect(stats.tempoTargetPercent).toBe(100);
  });
});

describe("practice consistency", () => {
  it("counts distinct days, not events", () => {
    const stats = analyzePiece(
      [ev(0, { practiceMinutes: 30 }), ev(0, { practiceMinutes: 20 }), ev(7, { practiceMinutes: 40 })],
      NOW,
    );
    expect(stats.distinctPracticeDays).toBe(2);
    expect(stats.totalPracticeMinutes).toBe(90);
    expect(stats.averagePracticeMinutes).toBe(30);
  });

  it("does not report a weekly rate for a span under one week", () => {
    const stats = analyzePiece([ev(0), ev(2)], NOW);
    expect(stats.sessionsPerWeek).toBeNull();
  });
});

describe("plateau detection", () => {
  /** Three events on the same range, flat mastery, spread over 20 days. */
  const plateauEvents = [
    ev(0, { mastery: 65, tempoBpm: 80, rangeStart: 37, rangeEnd: 42 }),
    ev(10, { mastery: 66, tempoBpm: 80, rangeStart: 37, rangeEnd: 42 }),
    ev(20, { mastery: 66, tempoBpm: 81, rangeStart: 37, rangeEnd: 42 }),
  ];

  it("flags a possible plateau with supporting evidence", () => {
    const insight = classifyProgress("as1", "pc1", plateauEvents, DEFAULT_THRESHOLDS, NOW);
    expect(insight.status).toBe("possible_plateau");
    expect(insight.evidence.rangeRepeats).toBe(3);
    expect(insight.evidence.rangeLabel).toBe("37–42");
    expect(insight.evidence.masteryChange).toBe(1);
  });

  it("hedges rather than asserting the student is stuck", () => {
    // The status name itself must stay non-committal.
    const insight = classifyProgress("as1", "pc1", plateauEvents, DEFAULT_THRESHOLDS, NOW);
    expect(insight.status).toBe("possible_plateau");
    expect(insight.status).not.toBe("stuck");
  });

  it("does NOT flag a plateau when too little time has passed", () => {
    const quick = [
      ev(0, { mastery: 65, rangeStart: 37, rangeEnd: 42 }),
      ev(1, { mastery: 65, rangeStart: 37, rangeEnd: 42 }),
      ev(2, { mastery: 66, rangeStart: 37, rangeEnd: 42 }),
    ];
    expect(classifyProgress("as1", "pc1", quick, DEFAULT_THRESHOLDS, NOW).status).not.toBe("possible_plateau");
  });

  it("does NOT flag a plateau when the range keeps moving", () => {
    const moving = [
      ev(0, { mastery: 65, rangeStart: 1, rangeEnd: 8 }),
      ev(10, { mastery: 65, rangeStart: 9, rangeEnd: 16 }),
      ev(20, { mastery: 66, rangeStart: 17, rangeEnd: 24 }),
    ];
    expect(classifyProgress("as1", "pc1", moving, DEFAULT_THRESHOLDS, NOW).status).not.toBe("possible_plateau");
  });

  it("does NOT flag a plateau when tempo is climbing", () => {
    const tempoRising = [
      ev(0, { mastery: 65, tempoBpm: 60, rangeStart: 37, rangeEnd: 42 }),
      ev(10, { mastery: 65, tempoBpm: 75, rangeStart: 37, rangeEnd: 42 }),
      ev(20, { mastery: 66, tempoBpm: 90, rangeStart: 37, rangeEnd: 42 }),
    ];
    expect(classifyProgress("as1", "pc1", tempoRising, DEFAULT_THRESHOLDS, NOW).status).not.toBe(
      "possible_plateau",
    );
  });

  it("honours configurable thresholds", () => {
    const strict = { ...DEFAULT_THRESHOLDS, plateauMinEvents: 10 };
    expect(classifyProgress("as1", "pc1", plateauEvents, strict, NOW).status).not.toBe("possible_plateau");
  });

  it("counts only trailing events on the same range", () => {
    const events = [
      ev(0, { rangeStart: 1, rangeEnd: 8 }),
      ev(5, { rangeStart: 37, rangeEnd: 42 }),
      ev(10, { rangeStart: 37, rangeEnd: 42 }),
    ];
    expect(trailingSameRangeCount(events)).toBe(2);
  });
});

describe("trend classification", () => {
  it("reports insufficient_data below the minimum event count", () => {
    expect(classifyProgress("as1", "pc1", [], DEFAULT_THRESHOLDS, NOW).status).toBe("insufficient_data");
    expect(classifyProgress("as1", "pc1", [ev(0)], DEFAULT_THRESHOLDS, NOW).status).toBe("insufficient_data");
  });

  it("reports improving on a clear mastery gain", () => {
    const events = [ev(0, { mastery: 40 }), ev(10, { mastery: 60 })];
    expect(classifyProgress("as1", "pc1", events, DEFAULT_THRESHOLDS, NOW).status).toBe("improving");
  });

  it("reports regression on a clear mastery loss", () => {
    const events = [ev(0, { mastery: 70 }), ev(10, { mastery: 60 })];
    expect(classifyProgress("as1", "pc1", events, DEFAULT_THRESHOLDS, NOW).status).toBe("regression");
  });

  it("prioritises regression over a plateau", () => {
    // Same range repeatedly AND falling mastery: the fall is the headline.
    const events = [
      ev(0, { mastery: 70, rangeStart: 1, rangeEnd: 4 }),
      ev(10, { mastery: 65, rangeStart: 1, rangeEnd: 4 }),
      ev(20, { mastery: 60, rangeStart: 1, rangeEnd: 4 }),
    ];
    expect(classifyProgress("as1", "pc1", events, DEFAULT_THRESHOLDS, NOW).status).toBe("regression");
  });

  it("reports stable for small movement in a short window", () => {
    const events = [ev(0, { mastery: 50 }), ev(3, { mastery: 51 })];
    expect(classifyProgress("as1", "pc1", events, DEFAULT_THRESHOLDS, NOW).status).toBe("stable");
  });

  it("reports slowing for modest gains over a long window", () => {
    const events = [ev(0, { mastery: 50 }), ev(45, { mastery: 54 })];
    expect(classifyProgress("as1", "pc1", events, DEFAULT_THRESHOLDS, NOW).status).toBe("slowing");
  });
});

describe("placement analytics", () => {
  it("computes days at the current level and the average pace", () => {
    const changes = [
      { levelId: "lv1", changedAt: new Date(BASE).toISOString() },
      { levelId: "lv2", changedAt: new Date(BASE + 30 * DAY).toISOString() },
      { levelId: "lv3", changedAt: new Date(BASE + 90 * DAY).toISOString() },
    ];
    const stats = analyzePlacementHistory(changes, new Date(BASE + 90 * DAY).toISOString(), NOW);
    expect(stats.levelChanges).toBe(3);
    // Gaps of 30 and 60 days → mean 45.
    expect(stats.averageDaysPerLevel).toBe(45);
    expect(stats.daysAtCurrentLevel).toBe(10);
  });

  it("cannot average a pace from a single change", () => {
    const changes = [{ levelId: "lv1", changedAt: new Date(BASE).toISOString() }];
    expect(analyzePlacementHistory(changes, new Date(BASE).toISOString(), NOW).averageDaysPerLevel).toBeNull();
  });
});
