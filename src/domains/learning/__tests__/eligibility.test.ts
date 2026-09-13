/**
 * Eligibility rules — the core of the learning domain.
 *
 * These are pure-function tests with hand-built rows: no store, no repository.
 * The rule is what the product promises ("a level-3 student sees level-3
 * material"), so it is tested independently of how the rows are persisted.
 */
import { describe, expect, it } from "vitest";
import { resolveEligibleContent, resolveEligibleStudentIds } from "../eligibility";
import type { LearningContent, LearningLevel, LevelContentLink, StudentPlacement } from "../types";

function level(order: number, over: Partial<LearningLevel> = {}): LearningLevel {
  return {
    id: `lv${order}`,
    programId: "pg1",
    order,
    name: `سطح ${order}`,
    description: "",
    objectives: [],
    active: true,
    ...over,
  };
}

function content(id: string, over: Partial<LearningContent> = {}): LearningContent {
  return {
    id,
    title: `محتوا ${id}`,
    description: "",
    type: "pdf",
    visibility: "students",
    createdAt: "2026-01-01T00:00:00.000Z",
    active: true,
    ...over,
  };
}

function link(levelId: string, contentId: string, sortOrder = 0): LevelContentLink {
  return { id: `${levelId}-${contentId}`, levelId, contentId, sortOrder };
}

function placement(levelId: string, over: Partial<StudentPlacement> = {}): StudentPlacement {
  return {
    id: "pl1",
    studentId: "st1",
    programId: "pg1",
    levelId,
    assignedAt: "2026-01-01T00:00:00.000Z",
    history: [],
    ...over,
  };
}

const levels = [level(1), level(2), level(3), level(4)];
const contents = [content("c1"), content("c2"), content("c3"), content("c4")];
const links = [link("lv1", "c1"), link("lv2", "c2"), link("lv3", "c3"), link("lv4", "c4")];

describe("resolveEligibleContent", () => {
  it("grants a level-3 student everything up to and including level 3", () => {
    const result = resolveEligibleContent({ placement: placement("lv3"), levels, links, content: contents });
    expect(result.map((r) => r.content.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("does not leak content from a level above the student", () => {
    const result = resolveEligibleContent({ placement: placement("lv2"), levels, links, content: contents });
    expect(result.map((r) => r.content.id)).not.toContain("c3");
    expect(result.map((r) => r.content.id)).not.toContain("c4");
  });

  it("changing the student's level immediately changes the eligible set", () => {
    const at1 = resolveEligibleContent({ placement: placement("lv1"), levels, links, content: contents });
    const at4 = resolveEligibleContent({ placement: placement("lv4"), levels, links, content: contents });
    expect(at1).toHaveLength(1);
    expect(at4).toHaveLength(4);
  });

  it("linking content to a low level immediately reaches an advanced student", () => {
    const extra = [...links, link("lv1", "c4")];
    const result = resolveEligibleContent({ placement: placement("lv2"), levels, links: extra, content: contents });
    expect(result.map((r) => r.content.id)).toContain("c4");
  });

  it("returns nothing for a student with no placement", () => {
    expect(resolveEligibleContent({ placement: undefined, levels, links, content: contents })).toEqual([]);
  });

  it("returns nothing when the placement points outside its program", () => {
    const bad = placement("lv3", { programId: "pg-other" });
    expect(resolveEligibleContent({ placement: bad, levels, links, content: contents })).toEqual([]);
  });

  it("ignores inactive content and inactive levels", () => {
    const withInactive = [content("c1"), content("c2", { active: false }), content("c3")];
    const lv = [level(1), level(2), level(3, { active: false })];
    const result = resolveEligibleContent({ placement: placement("lv2"), levels: lv, links, content: withInactive });
    expect(result.map((r) => r.content.id)).toEqual(["c1"]);
  });

  it("honours an exclusive level: only the exact level sees it", () => {
    const lv = [level(1), level(2, { exclusive: true }), level(3)];
    const atTwo = resolveEligibleContent({ placement: placement("lv2"), levels: lv, links, content: contents });
    const atThree = resolveEligibleContent({ placement: placement("lv3"), levels: lv, links, content: contents });
    expect(atTwo.map((r) => r.content.id)).toContain("c2");
    expect(atThree.map((r) => r.content.id)).not.toContain("c2");
  });

  it("emits shared content once, attributed to the lowest unlocking level", () => {
    const shared = [link("lv1", "c1"), link("lv3", "c1")];
    const result = resolveEligibleContent({ placement: placement("lv3"), levels, links: shared, content: contents });
    expect(result).toHaveLength(1);
    expect(result[0].levelOrder).toBe(1);
  });

  it("orders by level then by the link's sort order", () => {
    const ordered = [link("lv1", "c2", 2), link("lv1", "c1", 1), link("lv2", "c3", 0)];
    const result = resolveEligibleContent({ placement: placement("lv2"), levels, links: ordered, content: contents });
    expect(result.map((r) => r.content.id)).toEqual(["c1", "c2", "c3"]);
  });
});

describe("resolveEligibleStudentIds", () => {
  const placements = [
    placement("lv1", { id: "p1", studentId: "st1" }),
    placement("lv3", { id: "p2", studentId: "st2" }),
    placement("lv4", { id: "p3", studentId: "st3" }),
  ];

  it("finds every student at or above the content's lowest level", () => {
    const ids = resolveEligibleStudentIds("c3", levels, links, placements);
    expect(ids.sort()).toEqual(["st2", "st3"]);
  });

  it("returns nobody for content attached to no level", () => {
    expect(resolveEligibleStudentIds("c-unlinked", levels, links, placements)).toEqual([]);
  });

  it("restricts exclusive content to students placed exactly there", () => {
    const lv = [level(1), level(2), level(3, { exclusive: true }), level(4)];
    const ids = resolveEligibleStudentIds("c3", lv, links, placements);
    expect(ids).toEqual(["st2"]);
  });
});
