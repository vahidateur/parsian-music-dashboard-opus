/**
 * Cross-domain consistency (§27).
 *
 * These are the failure modes that only appear when domains interact:
 * deactivating an instrument, reordering levels, deleting content. The rule
 * throughout is that HISTORY MUST REMAIN INTERPRETABLE — a past observation
 * may not become meaningless because the curriculum changed afterwards.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoProgressRepository } from "../demoRepository";
import { DemoLearningRepository } from "@/domains/learning/demoRepository";
import { DemoInstrumentRepository } from "@/domains/instruments/demoRepository";
import { demoStore } from "@/services/demoStore";
import { ApiError } from "@/api/errors";

let progress: DemoProgressRepository;
let learning: DemoLearningRepository;
let instruments: DemoInstrumentRepository;

beforeEach(() => {
  demoStore.reset();
  progress = new DemoProgressRepository();
  learning = new DemoLearningRepository();
  instruments = new DemoInstrumentRepository();
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (cause) {
    return cause instanceof ApiError ? (cause.code ?? "UNKNOWN") : "UNKNOWN";
  }
}

describe("instruments", () => {
  it("cannot be deleted while a learning program references them", async () => {
    // `piano` has both students and a program in the seed.
    expect(await codeOf(instruments.delete("piano"))).toBe("INSTRUMENT_IN_USE");
  });

  it("deactivating one leaves its programs and pieces intact", async () => {
    await instruments.setActive("violin", false);

    const programs = await learning.listPrograms({ instrumentId: "violin", per_page: 50 });
    expect(programs.data.length).toBeGreaterThan(0);

    const pieces = await progress.listPieces({ instrumentId: "violin", per_page: 50 });
    expect(pieces.data.length).toBeGreaterThan(0);
  });

  it("keeps existing progress readable after its instrument is deactivated", async () => {
    const assignment = demoStore.pieceAssignments.all().find((a) => a.latest)!;
    const piece = demoStore.pieces.find(assignment.pieceId)!;
    await instruments.setActive(piece.instrumentId, false);

    const overview = await progress.studentOverview(assignment.studentId);
    expect(overview.assignments.some((a) => a.assignment.id === assignment.id)).toBe(true);
  });
});

describe("levels", () => {
  it("reordering keeps the ordering contiguous and unique", async () => {
    const programId = demoStore.programs.all()[0].id;
    const levels = await learning.listLevels({ programId, per_page: 100 });
    expect(levels.data.length).toBeGreaterThan(2);

    await learning.reorderLevel(levels.data[2].id, 1);

    const after = await learning.listLevels({ programId, per_page: 100 });
    const orders = after.data.map((l) => l.order);
    expect(orders).toEqual(after.data.map((_, i) => i + 1));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("reordering does not rewrite placement history", async () => {
    const placement = demoStore.placements.all().find((p) => p.history.length > 0)!;
    const before = JSON.stringify(placement.history);

    const levels = await learning.listLevels({ programId: placement.programId, per_page: 100 });
    if (levels.data.length > 2) await learning.reorderLevel(levels.data[2].id, 1);

    const after = demoStore.placements.find(placement.id)!;
    expect(JSON.stringify(after.history)).toBe(before);
  });

  it("reordering does not touch the progress log", async () => {
    const before = JSON.stringify(demoStore.progressEvents.all());
    const programId = demoStore.programs.all()[0].id;
    const levels = await learning.listLevels({ programId, per_page: 100 });
    if (levels.data.length > 1) await learning.reorderLevel(levels.data[1].id, 1);
    expect(JSON.stringify(demoStore.progressEvents.all())).toBe(before);
  });

  it("refuses to delete a level that still has students placed on it", async () => {
    const placement = demoStore.placements.all()[0];
    expect(await codeOf(learning.deleteLevel(placement.levelId))).toBe("LEVEL_HAS_STUDENTS");
  });
});

describe("student level changes", () => {
  it("immediately changes content eligibility", async () => {
    const placement = demoStore.placements.all()[0];
    const levels = await learning.listLevels({ programId: placement.programId, per_page: 100 });
    const current = levels.data.find((l) => l.id === placement.levelId)!;

    const before = (await learning.eligibleContent(placement.studentId)).length;

    // Move to the highest active, non-exclusive level.
    const highest = [...levels.data].filter((l) => l.active && !l.exclusive).sort((a, b) => b.order - a.order)[0];
    if (!highest || highest.id === current.id) return;

    await learning.assignPlacement({
      studentId: placement.studentId,
      programId: placement.programId,
      levelId: highest.id,
    });

    const after = (await learning.eligibleContent(placement.studentId)).length;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("appends to history rather than overwriting the level", async () => {
    const placement = demoStore.placements.all()[0];
    const historyBefore = placement.history.length;

    const levels = await learning.listLevels({ programId: placement.programId, per_page: 100 });
    const other = levels.data.find((l) => l.id !== placement.levelId && l.active);
    if (!other) return;

    await learning.assignPlacement({
      studentId: placement.studentId,
      programId: placement.programId,
      levelId: other.id,
      note: "ارتقا پس از آزمون",
    });

    const updated = demoStore.placements.find(placement.id)!;
    expect(updated.history.length).toBe(historyBefore + 1);

    const newest = updated.history[updated.history.length - 1];
    // Both ends of the move are recorded, so the timeline is unambiguous.
    expect(newest.levelId).toBe(placement.levelId);
    expect(newest.toLevelId).toBe(other.id);
    expect(newest.note).toBe("ارتقا پس از آزمون");
  });

  it("honours an explicit effective date", async () => {
    const placement = demoStore.placements.all()[0];
    const levels = await learning.listLevels({ programId: placement.programId, per_page: 100 });
    const other = levels.data.find((l) => l.id !== placement.levelId && l.active);
    if (!other) return;

    await learning.assignPlacement({
      studentId: placement.studentId,
      programId: placement.programId,
      levelId: other.id,
      effectiveDate: "2026-03-01T00:00:00.000Z",
    });

    const updated = demoStore.placements.find(placement.id)!;
    expect(updated.assignedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(updated.history[updated.history.length - 1].effectiveDate).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("content", () => {
  it("deleting content does not destroy progress history", async () => {
    const eventsBefore = demoStore.progressEvents.all().length;
    const content = demoStore.learningContent.all()[0];

    await learning.deleteContent(content.id).catch(() => {
      /* refusal is also acceptable; what matters is history survives */
    });

    expect(demoStore.progressEvents.all().length).toBe(eventsBefore);
  });

  it("teacher-only content is never eligible for a student", async () => {
    const placement = demoStore.placements.all()[0];
    const levels = await learning.listLevels({ programId: placement.programId, per_page: 100 });
    const current = levels.data.find((l) => l.id === placement.levelId)!;

    const secret = demoStore.learningContent.create({
      title: "کلید تصحیح آزمون",
      description: "",
      type: "document",
      visibility: "teachers",
      createdAt: new Date().toISOString(),
      active: true,
    });
    demoStore.levelContent.create({ levelId: current.id, contentId: secret.id, sortOrder: 999 });

    const eligible = await learning.eligibleContent(placement.studentId);
    expect(eligible.some((e) => e.content.id === secret.id)).toBe(false);
  });

  it("never suggests ineligible content in a recommendation", async () => {
    const assignment = demoStore.pieceAssignments.all().find((a) => a.latest)!;
    const overview = await progress.studentOverview(assignment.studentId);

    const eligibleIds = new Set(
      (await learning.eligibleContent(assignment.studentId)).map((e) => e.content.id),
    );
    for (const rec of overview.recommendations) {
      for (const id of rec.suggestedContentIds) {
        expect(eligibleIds.has(id)).toBe(true);
      }
    }
  });
});

describe("pieces and assignments", () => {
  it("deactivating a piece keeps existing assignments and their history", async () => {
    const assignment = demoStore.pieceAssignments.all().find((a) => a.latest)!;
    await progress.updatePiece(assignment.pieceId, { active: false });

    const events = await progress.listEvents({ assignmentId: assignment.id, per_page: 50 });
    expect(events.data.length).toBeGreaterThan(0);

    const still = await progress.getAssignment(assignment.id);
    expect(still.latest).toBeDefined();
  });

  it("refuses to assign a deactivated piece to someone new", async () => {
    const piece = demoStore.pieces.all()[0];
    await progress.updatePiece(piece.id, { active: false });

    const student = demoStore.students
      .all()
      .find((s) => !demoStore.pieceAssignments.all().some((a) => a.studentId === s.id && a.pieceId === piece.id));
    if (!student) return;

    expect(await codeOf(progress.assignPiece({ studentId: student.id, pieceId: piece.id }))).toBe(
      "ASSIGNMENT_INVALID",
    );
  });

  it("closing an assignment preserves its events", async () => {
    const assignment = demoStore.pieceAssignments.all().find((a) => a.latest)!;
    const before = (await progress.listEvents({ assignmentId: assignment.id, per_page: 50 })).meta.total;

    await progress.updateAssignment(assignment.id, { status: "completed" });

    const after = await progress.listEvents({ assignmentId: assignment.id, per_page: 50 });
    expect(after.meta.total).toBe(before);
  });
});

describe("backup and restore", () => {
  it("round-trips repertoire, assignments and history", async () => {
    const before = {
      pieces: demoStore.pieces.all().length,
      assignments: demoStore.pieceAssignments.all().length,
      events: demoStore.progressEvents.all().length,
    };
    expect(before.events).toBeGreaterThan(0);

    const snapshot = demoStore.snapshot();
    demoStore.replace(snapshot);

    expect(demoStore.pieces.all().length).toBe(before.pieces);
    expect(demoStore.pieceAssignments.all().length).toBe(before.assignments);
    expect(demoStore.progressEvents.all().length).toBe(before.events);
  });

  it("every seeded event points at a real assignment and student", () => {
    const assignments = new Set(demoStore.pieceAssignments.all().map((a) => a.id));
    const students = new Set(demoStore.students.all().map((s) => s.id));
    for (const event of demoStore.progressEvents.all()) {
      expect(assignments.has(event.assignmentId)).toBe(true);
      expect(students.has(event.studentId)).toBe(true);
    }
  });
});
