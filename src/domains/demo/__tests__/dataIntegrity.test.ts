/**
 * Data-integrity guarantees for the canonical seed.
 *
 * These assert the *relationships*, not the counts, so adding demo records is
 * fine but introducing an orphan or a duplicate id fails the build.
 */
import { describe, expect, it } from "vitest";
import { createSeedDataset } from "@/domains/demo/seed";
import { validateDataset } from "@/domains/demo/backup";
import { DEMO_COLLECTIONS } from "@/domains/demo/types";

const dataset = createSeedDataset();
const idsOf = (rows: ReadonlyArray<{ id: string }>) => new Set(rows.map((r) => r.id));

describe("seed data integrity", () => {
  it("passes the dataset validator with no issues", () => {
    expect(validateDataset(dataset)).toEqual([]);
  });

  it("has unique ids within every collection", () => {
    for (const name of DEMO_COLLECTIONS) {
      const rows = dataset[name] as ReadonlyArray<{ id?: string }>;
      const ids = rows.map((r) => r.id).filter((id): id is string => typeof id === "string");
      expect(new Set(ids).size, `duplicate id in ${name}`).toBe(ids.length);
    }
  });

  it("has no orphaned references between entities", () => {
    const students = idsOf(dataset.students);
    const teachers = idsOf(dataset.teachers);
    const classes = idsOf(dataset.classes);
    const rooms = idsOf(dataset.rooms);
    const sessions = idsOf(dataset.sessions);
    const roles = new Set(dataset.roles.map((r) => r.id));

    for (const c of dataset.classes) {
      expect(teachers.has(c.teacherId), `class ${c.id} teacher`).toBe(true);
      expect(rooms.has(c.roomId), `class ${c.id} room`).toBe(true);
      for (const sid of c.studentIds) expect(students.has(sid), `class ${c.id} student ${sid}`).toBe(true);
    }
    for (const e of dataset.enrollments) {
      expect(students.has(e.studentId), `enrollment ${e.id} student`).toBe(true);
      expect(classes.has(e.classId), `enrollment ${e.id} class`).toBe(true);
    }
    for (const s of dataset.sessions) {
      expect(classes.has(s.classId), `session ${s.id} class`).toBe(true);
      expect(teachers.has(s.teacherId), `session ${s.id} teacher`).toBe(true);
      expect(rooms.has(s.roomId), `session ${s.id} room`).toBe(true);
    }
    for (const a of dataset.attendance) {
      expect(sessions.has(a.sessionId), `attendance session ${a.sessionId}`).toBe(true);
      for (const entry of a.entries) expect(students.has(entry.studentId)).toBe(true);
    }
    for (const i of dataset.invoices) expect(students.has(i.studentId), `invoice ${i.id}`).toBe(true);
    for (const p of dataset.payments) expect(students.has(p.studentId), `payment ${p.id}`).toBe(true);
    for (const u of dataset.users) {
      expect(roles.has(u.role), `user ${u.id} role`).toBe(true);
      if (u.teacherId !== undefined) expect(teachers.has(u.teacherId), `user ${u.id} teacher`).toBe(true);
    }
  });

  it("has unique, lowercase user emails", () => {
    const emails = dataset.users.map((u) => u.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) expect(email).toBe(email.toLowerCase().trim());
  });

  it("stores no credential material on any user record", () => {
    for (const user of dataset.users) {
      const keys = Object.keys(user).map((k) => k.toLowerCase());
      for (const banned of ["password", "passwordhash", "hash", "salt", "token", "secret"]) {
        expect(keys, `user ${user.id} exposes ${banned}`).not.toContain(banned);
      }
    }
  });

  it("keeps every class within its room capacity", () => {
    const capacity = new Map(dataset.rooms.map((r) => [r.id, r.capacity]));
    for (const c of dataset.classes) {
      const seats = capacity.get(c.roomId);
      expect(seats, `room ${c.roomId} missing`).toBeDefined();
      expect(c.studentIds.length, `class ${c.id} exceeds room ${c.roomId}`).toBeLessThanOrEqual(seats ?? 0);
    }
  });

  it("is deterministic across invocations", () => {
    expect(createSeedDataset()).toEqual(createSeedDataset());
  });
});
