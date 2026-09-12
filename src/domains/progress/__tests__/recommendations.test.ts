/**
 * Recommendation rules.
 *
 * Two properties matter more than the individual rules: every recommendation
 * must state a concrete reason (not boilerplate), and suggested content must
 * only ever come from what the student is actually allowed to open.
 */
import { describe, expect, it } from "vitest";
import { recommendForAssignment, sortRecommendations, type Recommendation } from "../recommendations";
import { classifyProgress, DEFAULT_THRESHOLDS } from "../analytics";
import type { Piece, PieceAssignment, ProgressEvent } from "../types";
import type { EligibleContent } from "@/domains/learning/types";

const DAY = 86_400_000;
const BASE = Date.parse("2026-01-01T10:00:00.000Z");
const NOW = new Date(BASE + 25 * DAY);

function ev(dayOffset: number, fields: Partial<ProgressEvent> = {}): ProgressEvent {
  return {
    id: `pe_${dayOffset}_${fields.mastery ?? 0}`,
    studentId: "st1",
    pieceId: "pc1",
    assignmentId: "as1",
    recordedAt: new Date(BASE + dayOffset * DAY).toISOString(),
    mastery: 50,
    source: "teacher",
    ...fields,
  };
}

const piece: Piece = {
  id: "pc1",
  title: "کانن در ر ماژور",
  composer: "پاخلبل",
  instrumentId: "violin",
  description: "",
  rangeUnit: "measure",
  totalRange: 60,
  contentIds: ["lc_attached"],
  active: true,
  createdAt: new Date(BASE).toISOString(),
};

function assignment(fields: Partial<PieceAssignment> = {}): PieceAssignment {
  return {
    id: "as1",
    studentId: "st1",
    pieceId: "pc1",
    status: "learning",
    assignedAt: new Date(BASE).toISOString(),
    notes: "",
    ...fields,
  };
}

function eligible(id: string, title = "تمرین", levelOrder = 3): EligibleContent {
  return {
    content: {
      id,
      title,
      description: "",
      type: "pdf",
      visibility: "students",
      createdAt: new Date(BASE).toISOString(),
      active: true,
    },
    levelId: `lv${levelOrder}`,
    levelOrder,
    levelName: `سطح ${levelOrder}`,
    sortOrder: 1,
  };
}

/** Convenience: run the whole pipeline for a set of events. */
function adviseFor(events: ProgressEvent[], content: EligibleContent[] = [], overrides: Partial<PieceAssignment> = {}) {
  const insight = classifyProgress("as1", "pc1", events, DEFAULT_THRESHOLDS, NOW);
  const latest = events.length
    ? {
        mastery: events[events.length - 1].mastery,
        tempoBpm: events[events.length - 1].tempoBpm,
        recordedAt: events[events.length - 1].recordedAt,
        eventId: events[events.length - 1].id,
      }
    : undefined;
  return recommendForAssignment({
    insight,
    assignment: assignment({ latest, ...overrides }),
    piece,
    eligibleContent: content,
    now: NOW,
  });
}

const kinds = (recs: Recommendation[]) => recs.map((r) => r.kind);

describe("plateau", () => {
  const plateau = [
    ev(0, { mastery: 65, tempoBpm: 80, rangeStart: 37, rangeEnd: 42 }),
    ev(8, { mastery: 66, tempoBpm: 80, rangeStart: 37, rangeEnd: 42 }),
    ev(16, { mastery: 66, tempoBpm: 81, rangeStart: 37, rangeEnd: 42 }),
  ];

  it("recommends slowing down, isolating the range, and revisiting prerequisites", () => {
    const recs = adviseFor(plateau);
    expect(kinds(recs)).toContain("reduce_tempo");
    expect(kinds(recs)).toContain("isolate_range");
    expect(kinds(recs)).toContain("revisit_prerequisite");
  });

  it("names the actual range and a concrete slower tempo", () => {
    const reason = adviseFor(plateau).find((r) => r.kind === "reduce_tempo")!.reason;
    expect(reason).toContain("37–42");
    // 85% of 81 BPM, rounded.
    expect(reason).toContain("69");
  });

  it("marks the plateau advice as needing attention", () => {
    expect(adviseFor(plateau).find((r) => r.kind === "isolate_range")!.priority).toBe("attention");
  });

  it("omits the tempo advice when no tempo was ever recorded", () => {
    const noTempo = plateau.map(({ tempoBpm: _tempo, ...rest }) => rest as ProgressEvent);
    expect(kinds(adviseFor(noTempo))).not.toContain("reduce_tempo");
  });
});

describe("regression", () => {
  const falling = [ev(0, { mastery: 70 }), ev(10, { mastery: 58 })];

  it("escalates to a teacher review with the size of the drop", () => {
    const recs = adviseFor(falling);
    const review = recs.find((r) => r.kind === "teacher_review")!;
    expect(review.priority).toBe("attention");
    expect(review.reason).toContain("12");
  });
});

describe("rapid improvement", () => {
  const improving = [ev(0, { mastery: 40, tempoBpm: 70 }), ev(10, { mastery: 62, tempoBpm: 90 })];

  it("suggests extending the range and raising the tempo target", () => {
    const recs = adviseFor(improving);
    expect(kinds(recs)).toContain("advance_range");
    expect(kinds(recs)).toContain("raise_tempo_target");
    expect(recs.find((r) => r.kind === "raise_tempo_target")!.reason).toContain("99");
  });
});

describe("insufficient data", () => {
  it("asks for a progress entry when nothing is recorded", () => {
    const recs = adviseFor([]);
    expect(kinds(recs)).toEqual(["record_progress"]);
    expect(recs[0].reason).toContain("هنوز پیشرفتی");
  });

  it("explains that two entries are needed when only one exists", () => {
    expect(adviseFor([ev(0)])[0].reason).toContain("دو ثبت");
  });
});

describe("stable progress", () => {
  it("says nothing rather than padding with filler advice", () => {
    // Recent events, so the staleness rule does not fire: genuinely nothing to
    // say. Silence is a valid output.
    expect(adviseFor([ev(22, { mastery: 50 }), ev(25, { mastery: 51 })])).toEqual([]);
  });
});

describe("independent rules", () => {
  it("flags a stale assignment", () => {
    // Last event 25 days before NOW.
    const stale = [ev(-5, { mastery: 50 }), ev(0, { mastery: 52 })];
    const recs = adviseFor(stale);
    expect(kinds(recs)).toContain("record_progress");
    expect(recs.find((r) => r.kind === "record_progress")!.reason).toContain("۲۵".replace("۲۵", "25"));
  });

  it("suggests reviewing a near-mastered piece for completion", () => {
    const recs = adviseFor([ev(0, { mastery: 88 }), ev(10, { mastery: 94 })]);
    expect(kinds(recs)).toContain("consider_completion");
  });

  it("does not suggest completion for a piece already being polished", () => {
    const recs = adviseFor([ev(0, { mastery: 88 }), ev(10, { mastery: 94 })], [], { status: "polishing" });
    expect(kinds(recs)).not.toContain("consider_completion");
  });
});

describe("library integration", () => {
  const plateau = [
    ev(0, { mastery: 65, tempoBpm: 80, rangeStart: 37, rangeEnd: 42 }),
    ev(8, { mastery: 66, tempoBpm: 80, rangeStart: 37, rangeEnd: 42 }),
    ev(16, { mastery: 66, tempoBpm: 81, rangeStart: 37, rangeEnd: 42 }),
  ];

  it("suggests only content the student is eligible for", () => {
    const recs = adviseFor(plateau, [eligible("lc_a"), eligible("lc_b")]);
    const suggested = new Set(recs.flatMap((r) => r.suggestedContentIds));
    // Never invents an id outside the eligible set.
    for (const id of suggested) expect(["lc_a", "lc_b", "lc_attached"]).toContain(id);
  });

  it("prefers content attached to the piece", () => {
    const recs = adviseFor(plateau, [eligible("lc_other"), eligible("lc_attached")]);
    expect(recs.find((r) => r.kind === "isolate_range")!.suggestedContentIds[0]).toBe("lc_attached");
  });

  it("suggests nothing when the student is eligible for nothing", () => {
    const recs = adviseFor(plateau, []);
    expect(recs.every((r) => r.suggestedContentIds.length === 0)).toBe(true);
  });

  it("caps the shortlist", () => {
    const many = Array.from({ length: 10 }, (_, i) => eligible(`lc_${i}`));
    const recs = adviseFor(plateau, many);
    expect(recs.every((r) => r.suggestedContentIds.length <= 3)).toBe(true);
  });
});

describe("ordering", () => {
  it("puts attention items first", () => {
    const recs = sortRecommendations([
      { ...base(), kind: "record_progress", priority: "info" },
      { ...base(), kind: "teacher_review", priority: "attention" },
      { ...base(), kind: "shorten_practice", priority: "suggested" },
    ]);
    expect(recs.map((r) => r.priority)).toEqual(["attention", "suggested", "info"]);
  });
});

function base(): Recommendation {
  return {
    kind: "record_progress",
    priority: "info",
    assignmentId: "as1",
    pieceId: "pc1",
    reason: "",
    evidence: {
      events: 0,
      windowDays: 0,
      masteryChange: null,
      tempoChange: null,
      rangeRepeats: 0,
      rangeLabel: null,
      daysSinceLastEvent: null,
    },
    suggestedContentIds: [],
  };
}
