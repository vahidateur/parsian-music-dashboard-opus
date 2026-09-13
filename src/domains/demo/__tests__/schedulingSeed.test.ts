/**
 * Dated session seed.
 *
 * Two properties carry the weight. Determinism, because a dataset that shifts
 * between runs makes backups, exports and every downstream test irreproducible
 * — and the obvious way to get that wrong is to anchor on the current date.
 * And coverage of the awkward states, because a demo where every session is
 * tidy never exercises the conflict, cancellation or override UI.
 */
import { describe, expect, it } from "vitest";
import {
  SEEDED_CONFLICT,
  SEED_DATE,
  SEED_WINDOW_DAYS,
  deriveScheduledSessions,
  seedWindow,
} from "../schedulingSeed";
import { createSeedDataset } from "../seed";
import { classes } from "@/data/records";
import { addDays, addMinutes, durationMinutes, weekdayIndex } from "@/domains/scheduling/dateBridge";
import { deterministicSessionId } from "@/domains/scheduling/generation";

const sessions = deriveScheduledSessions();

describe("determinism", () => {
  it("produces byte-identical output on every call", () => {
    expect(JSON.stringify(deriveScheduledSessions())).toBe(JSON.stringify(deriveScheduledSessions()));
  });

  it("is anchored to a fixed date, not the current one", () => {
    /*
     * `academyNow()` freezes the time of day but keeps the REAL calendar date,
     * so seeding from it would move the whole dataset every day. The window
     * must therefore sit around 2026-09-01 regardless of when this runs.
     */
    const { from, to } = seedWindow();
    expect(SEED_DATE).toBe("2026-09-01");
    expect(from).toBe("2026-08-04");
    expect(to).toBe("2026-09-29");

    const today = new Date().toISOString().slice(0, 10);
    expect(from).not.toBe(today);
  });

  it("spans ±28 days", () => {
    const { from, to } = seedWindow();
    expect(from).toBe(addDays(SEED_DATE, -SEED_WINDOW_DAYS));
    expect(to).toBe(addDays(SEED_DATE, SEED_WINDOW_DAYS));
  });

  it("uses fixed timestamps rather than the wall clock", () => {
    expect(new Set(sessions.map((s) => s.createdAt))).toEqual(new Set(["2026-09-01T00:00:00.000Z"]));
  });
});

describe("identity", () => {
  it("assigns every session a unique id", () => {
    const ids = sessions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses deterministic slot ids", () => {
    for (const session of sessions) {
      expect(session.id).toBe(deterministicSessionId(session.classId, session.date, session.startTime));
    }
  });

  it("is sorted stably so the serialized dataset does not churn", () => {
    const keys = sessions.map((s) => `${s.date} ${s.startTime} ${s.id}`);
    expect(keys).toEqual([...keys].sort());
  });
});

describe("derived from the real class recurrence", () => {
  it("places every session on one of its class's days", () => {
    const byId = new Map(classes.map((c) => [c.id, c]));
    for (const session of sessions) {
      const klass = byId.get(session.classId);
      expect(klass, session.classId).toBeDefined();
      expect(klass!.days).toContain(weekdayIndex(session.date));
    }
  });

  it("honours each class's start time and duration", () => {
    const byId = new Map(classes.map((c) => [c.id, c]));
    for (const session of sessions) {
      const klass = byId.get(session.classId)!;
      expect(session.startTime).toBe(klass.time);
      expect(session.endTime).toBe(addMinutes(klass.time, klass.duration));
      expect(durationMinutes(session.startTime, session.endTime)).toBe(klass.duration);
    }
  });

  it("stays inside the window", () => {
    const { from, to } = seedWindow();
    for (const session of sessions) {
      expect(session.date >= from && session.date <= to).toBe(true);
    }
  });

  it("covers several classes rather than one", () => {
    expect(new Set(sessions.map((s) => s.classId)).size).toBeGreaterThan(5);
  });

  it("references only real teachers and rooms", () => {
    const dataset = createSeedDataset();
    const teachers = new Set(dataset.teachers.map((t) => t.id));
    const rooms = new Set(dataset.rooms.map((r) => r.id));
    for (const session of dataset.scheduledSessions) {
      expect(teachers.has(session.teacherId), session.id).toBe(true);
      expect(rooms.has(session.roomId), session.id).toBe(true);
    }
  });
});

describe("past and future", () => {
  it("marks sessions before the seed date completed", () => {
    const past = sessions.filter((s) => s.date < SEED_DATE);
    expect(past.length).toBeGreaterThan(0);
    // Cancellations are planted in the future, so every past row is completed.
    expect(past.every((s) => s.status === "completed")).toBe(true);
  });

  it("leaves the seed date and later scheduled", () => {
    const future = sessions.filter((s) => s.date >= SEED_DATE && s.status !== "cancelled");
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((s) => s.status === "scheduled")).toBe(true);
  });

  it("has history on both sides so the demo opens mid-term", () => {
    expect(sessions.some((s) => s.date < SEED_DATE)).toBe(true);
    expect(sessions.some((s) => s.date > SEED_DATE)).toBe(true);
  });
});

describe("planted situations", () => {
  it("includes a room conflict for the conflict UI to show", () => {
    // Two active sessions sharing a room, date and start time.
    const byKey = new Map<string, string[]>();
    for (const session of sessions) {
      if (session.status === "cancelled") continue;
      const key = `${session.date}|${session.roomId}|${session.startTime}`;
      byKey.set(key, [...(byKey.get(key) ?? []), session.classId]);
    }
    const clashes = [...byKey.entries()].filter(([, ids]) => ids.length > 1);

    expect(clashes.length).toBeGreaterThan(0);
    const [, classIds] = clashes[0];
    // Arises naturally: cl2 and cl7 both meet in r1 at 14:00 on day 3.
    expect(classIds.sort()).toEqual([...SEEDED_CONFLICT.classIds].sort());
  });

  it("includes exactly one cancelled session, with a reason", () => {
    const cancelled = sessions.filter((s) => s.status === "cancelled");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].cancelReason).toBeTruthy();
    expect(cancelled[0].classId).toBe("cl10");
  });

  it("includes exactly one manual override", () => {
    const manual = sessions.filter((s) => s.origin === "manual");
    expect(manual).toHaveLength(1);
    expect(manual[0].classId).toBe("cl3");
  });

  it("gives the manual override a room differing from its class", () => {
    // Otherwise the override is invisible and proves nothing.
    const manual = sessions.find((s) => s.origin === "manual")!;
    const klass = classes.find((c) => c.id === manual.classId)!;
    expect(manual.roomId).not.toBe(klass.roomId);
  });

  it("marks everything else as generated", () => {
    expect(sessions.filter((s) => s.origin === "generated").length).toBe(sessions.length - 1);
  });
});

describe("dataset integration", () => {
  it("ships the sessions in the seeded dataset", () => {
    const dataset = createSeedDataset();
    expect(dataset.scheduledSessions.length).toBe(sessions.length);
    expect(dataset.scheduledSessions.length).toBeGreaterThan(50);
  });

  it("leaves the legacy weekly template untouched", () => {
    // The GridSession collection stays as-is until task H5 rewires the views.
    const dataset = createSeedDataset();
    expect(dataset.sessions.length).toBeGreaterThan(0);
    expect(dataset.sessions[0]).toHaveProperty("day");
    expect(dataset.sessions[0]).not.toHaveProperty("date");
  });

  it("keeps the two collections independent", () => {
    const dataset = createSeedDataset();
    const legacyIds = new Set(dataset.sessions.map((s) => s.id));
    for (const session of dataset.scheduledSessions) {
      expect(legacyIds.has(session.id)).toBe(false);
    }
  });

  it("never stores a roster on a session", () => {
    for (const session of sessions) {
      expect(session).not.toHaveProperty("students");
      expect(session).not.toHaveProperty("studentIds");
    }
  });

  it("never stores a conflict flag", () => {
    // Conflicts are derived; a stored flag goes stale the moment anything moves.
    for (const session of sessions) {
      expect(session).not.toHaveProperty("conflictWith");
    }
  });
});
