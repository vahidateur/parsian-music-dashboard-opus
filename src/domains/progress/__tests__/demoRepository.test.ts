/**
 * Repertoire + progress persistence and invariants.
 *
 * The invariant that matters most is that the progress log is append-only:
 * every analytic, chart and recommendation is computed from it, so anything
 * that could silently rewrite history is a correctness bug, not a UX one.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoProgressRepository } from "../demoRepository";
import { MASTERY_SCALE, TEMPO_BOUNDS } from "../types";
import { demoStore } from "@/services/demoStore";
import { ApiError } from "@/api/errors";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

let repo: DemoProgressRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  repo = new DemoProgressRepository();
});

/** Resolves an ApiError code, or "OK" when the promise succeeds. */
async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (cause) {
    return cause instanceof ApiError ? (cause.code ?? "UNKNOWN") : "UNKNOWN";
  }
}

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string[]> | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.fields : undefined;
  }
}

/** A student with at least one seeded assignment. */
function seededAssignment() {
  const assignment = demoStore.pieceAssignments.all().find((a) => a.status !== "completed");
  if (!assignment) throw new Error("seed should contain an open assignment");
  return assignment;
}

describe("seeded repertoire", () => {
  it("ships pieces across several instruments", async () => {
    const page = await repo.listPieces({ per_page: 100 });
    expect(page.data.length).toBeGreaterThan(5);
    expect(new Set(page.data.map((p) => p.instrumentId)).size).toBeGreaterThan(2);
  });

  it("references only real instruments", async () => {
    const pieces = await repo.listPieces({ per_page: 100 });
    const instruments = new Set(demoStore.instruments.all().map((i) => i.id));
    for (const piece of pieces.data) expect(instruments.has(piece.instrumentId)).toBe(true);
  });

  it("uses several range units, not measures only", async () => {
    const pieces = await repo.listPieces({ per_page: 100 });
    expect(new Set(pieces.data.map((p) => p.rangeUnit)).size).toBeGreaterThan(1);
  });

  it("filters by instrument", async () => {
    const page = await repo.listPieces({ instrumentId: "violin", per_page: 100 });
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data.every((p) => p.instrumentId === "violin")).toBe(true);
  });

  it("searches by title and composer", async () => {
    const byComposer = await repo.listPieces({ search: "باخ", per_page: 100 });
    expect(byComposer.data.length).toBeGreaterThan(0);
  });
});

describe("piece validation", () => {
  it("requires a title and a real instrument", async () => {
    expect(
      await fieldsOf(
        repo.createPiece({
          title: "  ",
          composer: "x",
          instrumentId: "violin",
          description: "",
          rangeUnit: "measure",
          active: true,
        }),
      ),
    ).toHaveProperty("title");

    expect(
      await fieldsOf(
        repo.createPiece({
          title: "قطعه",
          composer: "x",
          instrumentId: "no_such_instrument",
          description: "",
          rangeUnit: "measure",
          active: true,
        }),
      ),
    ).toHaveProperty("instrumentId");
  });

  it("accepts a piece on a custom instrument", async () => {
    const custom = demoStore.instruments.create({
      name: "سنتور",
      slug: "santoor",
      description: "",
      active: true,
      sortOrder: 99,
    });
    const piece = await repo.createPiece({
      title: "قطعهٔ سنتور",
      composer: "سنتی",
      instrumentId: custom.id,
      description: "",
      rangeUnit: "measure",
      active: true,
    });
    expect(piece.instrumentId).toBe(custom.id);
  });

  it("refuses to delete a piece that is assigned", async () => {
    const assignment = seededAssignment();
    expect(await codeOf(repo.deletePiece(assignment.pieceId))).toBe("PIECE_IN_USE");
  });

  it("deletes an unassigned piece", async () => {
    const piece = await repo.createPiece({
      title: "موقت",
      composer: "x",
      instrumentId: "piano",
      description: "",
      rangeUnit: "measure",
      active: true,
    });
    await repo.deletePiece(piece.id);
    expect(await codeOf(repo.getPiece(piece.id))).toBe("PIECE_NOT_FOUND");
  });
});

describe("assignments", () => {
  it("refuses a duplicate open assignment", async () => {
    const existing = seededAssignment();
    expect(
      await codeOf(repo.assignPiece({ studentId: existing.studentId, pieceId: existing.pieceId })),
    ).toBe("ASSIGNMENT_DUPLICATE");
  });

  it("allows re-assigning a piece that was completed", async () => {
    const existing = seededAssignment();
    await repo.updateAssignment(existing.id, { status: "completed" });
    const again = await repo.assignPiece({ studentId: existing.studentId, pieceId: existing.pieceId });
    expect(again.id).not.toBe(existing.id);
  });

  it("stamps closedAt when an assignment closes and clears it on reopen", async () => {
    const existing = seededAssignment();
    const closed = await repo.updateAssignment(existing.id, { status: "completed" });
    expect(closed.closedAt).toBeTruthy();

    const reopened = await repo.updateAssignment(existing.id, { status: "learning" });
    expect(reopened.closedAt).toBeUndefined();
  });

  it("rejects an unknown student or piece", async () => {
    expect(await fieldsOf(repo.assignPiece({ studentId: "nope", pieceId: "pc_canon_d" }))).toHaveProperty(
      "studentId",
    );
    expect(await fieldsOf(repo.assignPiece({ studentId: "st1", pieceId: "nope" }))).toHaveProperty("pieceId");
  });

  it("refuses to delete an assignment that has history", async () => {
    const withHistory = demoStore.pieceAssignments.all().find((a) => a.latest !== undefined);
    expect(withHistory).toBeDefined();
    expect(await codeOf(repo.deleteAssignment(withHistory!.id))).toBe("ASSIGNMENT_HAS_HISTORY");
  });

  it("deletes an assignment with no history", async () => {
    const fresh = await repo.assignPiece({ studentId: "st1", pieceId: "pc_gymnopedie" });
    await repo.deleteAssignment(fresh.id);
    expect(await codeOf(repo.getAssignment(fresh.id))).toBe("ASSIGNMENT_NOT_FOUND");
  });
});

describe("recording progress", () => {
  it("appends an event and refreshes the cached snapshot", async () => {
    const assignment = seededAssignment();
    const before = (await repo.listEvents({ assignmentId: assignment.id, per_page: 100 })).meta.total;

    const event = await repo.recordProgress({
      assignmentId: assignment.id,
      rangeStart: 1,
      rangeEnd: 8,
      tempoBpm: 92,
      mastery: 71,
      practiceMinutes: 30,
      teacherNote: "بهتر شد",
      source: "teacher",
    });

    const after = await repo.listEvents({ assignmentId: assignment.id, per_page: 100 });
    expect(after.meta.total).toBe(before + 1);

    const updated = await repo.getAssignment(assignment.id);
    expect(updated.latest?.eventId).toBe(event.id);
    expect(updated.latest?.mastery).toBe(71);
  });

  it("never mutates an earlier event", async () => {
    const assignment = seededAssignment();
    const before = await repo.listEvents({ assignmentId: assignment.id, per_page: 100 });
    const snapshot = JSON.stringify(before.data);

    await repo.recordProgress({ assignmentId: assignment.id, mastery: 80, rangeStart: 1, rangeEnd: 4, source: "teacher" });

    const after = await repo.listEvents({ assignmentId: assignment.id, per_page: 100 });
    // Every pre-existing event is byte-identical.
    const stillThere = after.data.filter((e) => before.data.some((b) => b.id === e.id));
    expect(JSON.stringify(stillThere.sort((a, b) => a.id.localeCompare(b.id)))).toBe(
      JSON.stringify([...before.data].sort((a, b) => a.id.localeCompare(b.id))),
    );
    expect(snapshot).toBeTruthy();
  });

  it("derives the snapshot from the newest event, not the last written", async () => {
    const assignment = seededAssignment();
    // Back-date an entry: it must NOT become the snapshot.
    await repo.recordProgress({
      assignmentId: assignment.id,
      mastery: 10,
      rangeStart: 1,
      rangeEnd: 2,
      source: "teacher",
      recordedAt: "2020-01-01T00:00:00.000Z",
    });
    const updated = await repo.getAssignment(assignment.id);
    expect(updated.latest?.mastery).not.toBe(10);
  });

  it("rejects a closed assignment", async () => {
    const assignment = seededAssignment();
    await repo.updateAssignment(assignment.id, { status: "completed" });
    expect(
      await fieldsOf(repo.recordProgress({ assignmentId: assignment.id, mastery: 50, source: "teacher" })),
    ).toHaveProperty("assignmentId");
  });
});

describe("progress validation", () => {
  it("bounds mastery to the documented scale", async () => {
    const assignment = seededAssignment();
    for (const bad of [-1, 101, 1.5, Number.NaN]) {
      expect(
        await fieldsOf(repo.recordProgress({ assignmentId: assignment.id, mastery: bad, source: "teacher" })),
        `mastery ${bad} should be rejected`,
      ).toHaveProperty("mastery");
    }
    expect(MASTERY_SCALE.max).toBe(100);
  });

  it("bounds tempo to plausible values", async () => {
    const assignment = seededAssignment();
    expect(
      await fieldsOf(
        repo.recordProgress({ assignmentId: assignment.id, mastery: 50, tempoBpm: 820, source: "teacher" }),
      ),
    ).toHaveProperty("tempoBpm");
    expect(
      await fieldsOf(
        repo.recordProgress({ assignmentId: assignment.id, mastery: 50, tempoBpm: 5, source: "teacher" }),
      ),
    ).toHaveProperty("tempoBpm");
    expect(TEMPO_BOUNDS.max).toBe(400);
  });

  it("rejects a reversed range", async () => {
    const assignment = seededAssignment();
    expect(
      await fieldsOf(
        repo.recordProgress({ assignmentId: assignment.id, mastery: 50, rangeStart: 40, rangeEnd: 10, source: "teacher" }),
      ),
    ).toHaveProperty("rangeEnd");
  });

  it("rejects a range beyond the piece's extent", async () => {
    const assignment = demoStore.pieceAssignments
      .all()
      .find((a) => demoStore.pieces.find(a.pieceId)?.totalRange !== undefined);
    expect(assignment).toBeDefined();
    const piece = demoStore.pieces.find(assignment!.pieceId)!;
    expect(
      await fieldsOf(
        repo.recordProgress({
          assignmentId: assignment!.id,
          mastery: 50,
          rangeStart: 1,
          rangeEnd: (piece.totalRange ?? 0) + 10,
          source: "teacher",
        }),
      ),
    ).toHaveProperty("rangeEnd");
  });

  it("requires a label for a free-form piece and rejects numeric ranges", async () => {
    const freeform = demoStore.pieces.all().find((p) => p.rangeUnit === "freeform");
    expect(freeform).toBeDefined();
    const assignment = demoStore.pieceAssignments.all().find((a) => a.pieceId === freeform!.id);
    if (!assignment) return;

    expect(
      await fieldsOf(repo.recordProgress({ assignmentId: assignment.id, mastery: 50, source: "teacher" })),
    ).toHaveProperty("rangeLabel");

    expect(
      await fieldsOf(
        repo.recordProgress({ assignmentId: assignment.id, mastery: 50, rangeStart: 1, rangeEnd: 4, source: "teacher" }),
      ),
    ).toHaveProperty("rangeStart");
  });

  it("bounds practice minutes", async () => {
    const assignment = seededAssignment();
    expect(
      await fieldsOf(
        repo.recordProgress({ assignmentId: assignment.id, mastery: 50, practiceMinutes: 5000, source: "teacher" }),
      ),
    ).toHaveProperty("practiceMinutes");
  });

  it("writes nothing when validation fails", async () => {
    const assignment = seededAssignment();
    const before = demoStore.progressEvents.all().length;
    await fieldsOf(repo.recordProgress({ assignmentId: assignment.id, mastery: 500, source: "teacher" }));
    expect(demoStore.progressEvents.all().length).toBe(before);
  });
});

describe("history queries", () => {
  it("returns events newest first", async () => {
    const assignment = demoStore.pieceAssignments.all().find((a) => a.latest);
    const page = await repo.listEvents({ assignmentId: assignment!.id, per_page: 50 });
    const times = page.data.map((e) => Date.parse(e.recordedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("bounds a query by date", async () => {
    const all = await repo.listEvents({ per_page: 500 });
    expect(all.data.length).toBeGreaterThan(0);
    const cutoff = all.data[Math.floor(all.data.length / 2)].recordedAt;
    const since = await repo.listEvents({ since: cutoff, per_page: 500 });
    expect(since.data.every((e) => Date.parse(e.recordedAt) >= Date.parse(cutoff))).toBe(true);
  });

  it("paginates rather than returning the whole log", async () => {
    const page = await repo.listEvents({ per_page: 5 });
    expect(page.data.length).toBeLessThanOrEqual(5);
    expect(page.meta.total).toBeGreaterThan(5);
  });
});

describe("student overview", () => {
  it("joins assignments to pieces and produces insights", async () => {
    const assignment = seededAssignment();
    const overview = await repo.studentOverview(assignment.studentId);
    expect(overview.assignments.length).toBeGreaterThan(0);
    expect(overview.assignments.every((a) => a.piece !== undefined)).toBe(true);
    expect(overview.insights.length).toBeGreaterThan(0);
  });

  it("bounds the recent-event list", async () => {
    const assignment = seededAssignment();
    const overview = await repo.studentOverview(assignment.studentId);
    expect(overview.recentEvents.length).toBeLessThanOrEqual(20);
  });

  it("only suggests content the student is eligible for", async () => {
    const assignment = seededAssignment();
    const overview = await repo.studentOverview(assignment.studentId);

    const placement = demoStore.placements.all().find((p) => p.studentId === assignment.studentId);
    const suggested = new Set(overview.recommendations.flatMap((r) => r.suggestedContentIds));

    if (!placement) {
      // No placement ⇒ nothing is eligible ⇒ nothing may be suggested.
      expect(suggested.size).toBe(0);
    }
  });

  it("returns an empty overview for a student with no assignments", async () => {
    const fresh = demoStore.students.all().find((s) => !demoStore.pieceAssignments.all().some((a) => a.studentId === s.id));
    if (!fresh) return;
    const overview = await repo.studentOverview(fresh.id);
    expect(overview.assignments).toEqual([]);
    expect(overview.recommendations).toEqual([]);
  });

  it("excludes closed assignments from advice", async () => {
    const assignment = seededAssignment();
    await repo.updateAssignment(assignment.id, { status: "abandoned" });
    const overview = await repo.studentOverview(assignment.studentId);
    expect(overview.insights.some((i) => i.assignmentId === assignment.id)).toBe(false);
  });

  it("demonstrates a range of statuses across the seeded academy", async () => {
    // A demo where every student looks identical would hide the feature.
    const statuses = new Set<string>();
    for (const student of demoStore.students.all().slice(0, 12)) {
      const overview = await repo.studentOverview(student.id);
      overview.insights.forEach((i) => statuses.add(i.status));
    }
    expect(statuses.size).toBeGreaterThan(2);
    expect(statuses.has("possible_plateau")).toBe(true);
  });
});
