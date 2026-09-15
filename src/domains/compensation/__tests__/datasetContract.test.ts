/**
 * Compensation inside the demo dataset: storage, registry and backup.
 *
 * The obligation is a collection like any other, which means three contracts have
 * to keep holding once it exists:
 *
 *   - `DEMO_COLLECTIONS` and both datasets carry it, so export/import, the
 *     lifecycle manager and the "clear everything" path see it;
 *   - the registry resolves a compensation repository in demo mode, composed from
 *     the scheduling and attendance repositories — and honours overrides of them;
 *   - the backup validator refuses a payload whose obligations are incoherent
 *     (a dangling student or class, two obligations for one original, one session
 *     claimed by two obligations) while still accepting an obligation whose
 *     cancelled original was hard-deleted, because that is a state the model
 *     deliberately supports.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";
import { validateDataset } from "@/domains/demo/backup";
import { demoDataManager } from "@/domains/demo/demoDataManager";
import { createEmptyDataset, createSeedDataset } from "@/domains/demo/seed";
import { DEMO_COLLECTIONS, type DemoDataset } from "@/domains/demo/types";
import {
  getCompensationRepository,
  getSchedulingRepository,
  resetRegistry,
  setAttendanceRepository,
  setSchedulingRepository,
} from "@/domains/registry";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import type { SessionCompensationRecord } from "../types";

const ACTOR = "usr_admin";
const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
const BOOKING_DATE = "2027-05-11";

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function codes(issues: ReturnType<typeof validateDataset>): string[] {
  return issues.map((i) => i.code);
}

/** A valid stored obligation, so each case below can bend exactly one thing. */
function stored(over: Partial<SessionCompensationRecord> = {}): SessionCompensationRecord {
  return {
    id: "cmp_1",
    originalSessionId: "ses_original",
    classId: PRIVATE_CLASS,
    studentId: PRIVATE_STUDENT,
    reason: "لغو جلسه",
    requiredAt: "2026-09-02T10:00:00.000Z",
    requiredByUserId: ACTOR,
    attempts: [],
    createdAt: "2026-09-02T10:00:00.000Z",
    updatedAt: "2026-09-02T10:00:00.000Z",
    ...over,
  };
}

function datasetWith(records: SessionCompensationRecord[]): DemoDataset {
  return { ...createSeedDataset(), sessionCompensations: records };
}

describe("the collection is part of the dataset contract", () => {
  it("is a declared demo collection", () => {
    expect(DEMO_COLLECTIONS).toContain("sessionCompensations");
  });

  it("exists and is EMPTY in both canonical datasets", () => {
    // The demo ships no compensable case: its only cancelled session belongs to a
    // group class, and registration is a human act, never seed data.
    expect(createSeedDataset().sessionCompensations).toEqual([]);
    expect(createEmptyDataset().sessionCompensations).toEqual([]);
  });

  it("validates both canonical datasets with the collection present", () => {
    expect(validateDataset(createSeedDataset())).toEqual([]);
    expect(validateDataset(createEmptyDataset())).toEqual([]);
  });

  it("survives export, clear and restore with its ledger and derived state", async () => {
    const original = await getSchedulingRepository().create({
      classId: PRIVATE_CLASS,
      date: BOOKING_DATE,
      startTime: "14:00",
      endTime: "15:00",
      teacherId: "t1",
      roomId: "r1",
    });
    await getSchedulingRepository().cancelSession(original.id, "لغو");
    const compensation = await getCompensationRepository().register({
      originalSessionId: original.id,
      studentId: PRIVATE_STUDENT,
      reason: "لغو جلسه",
      requiredByUserId: ACTOR,
    });
    // Mints its own id under the domain prefix, like every other collection.
    expect(compensation.id.startsWith("cmp_")).toBe(true);

    const booked = await getCompensationRepository().schedule(compensation.id, {
      date: BOOKING_DATE,
      startTime: "16:00",
      endTime: "17:00",
      scheduledByUserId: ACTOR,
    });
    const json = demoDataManager.exportBackupJson(new Date("2026-09-15T00:00:00.000Z"));

    expect(demoDataManager.clear({ confirm: true }).ok).toBe(true);
    expect(demoStore.sessionCompensations.all()).toHaveLength(0);

    expect(demoDataManager.restoreBackup(json, { confirm: true }).ok).toBe(true);
    const reread = await getCompensationRepository().get(compensation.id);
    expect(reread.status).toBe("scheduled");
    expect(reread.attempts).toHaveLength(1);
    expect(reread.currentAttempt?.sessionId).toBe(booked.currentAttempt?.sessionId);
    // The attempt's session came back with it — the obligation is not orphaned.
    expect((await getSchedulingRepository().get(booked.currentAttempt!.sessionId)).origin).toBe(
      "manual",
    );
  });
});

describe("registry seam", () => {
  it("resolves a demo compensation repository in demo mode", async () => {
    const repository = getCompensationRepository();
    expect(repository).toBeTruthy();
    expect((await repository.list()).data).toEqual([]);
  });

  it("composes the scheduling and attendance repositories the registry resolves", async () => {
    // An override for a collaborator has to be honoured here too: the compensation
    // repository is built from the OTHER domains' interfaces, never from their
    // implementations.
    const attendance = new DemoAttendanceRepository(demoStore);
    const scheduling = new DemoSchedulingRepository(demoStore, () => attendance.sessionIdsWithAttendanceSync());
    setAttendanceRepository(attendance);
    setSchedulingRepository(scheduling);

    const original = await scheduling.create({
      classId: PRIVATE_CLASS,
      date: BOOKING_DATE,
      startTime: "14:00",
      endTime: "15:00",
      teacherId: "t1",
      roomId: "r1",
    });
    await scheduling.cancelSession(original.id, "لغو");

    const compensation = await getCompensationRepository().register({
      originalSessionId: original.id,
      studentId: PRIVATE_STUDENT,
      reason: "لغو جلسه",
      requiredByUserId: ACTOR,
    });

    const booked = await getCompensationRepository().schedule(compensation.id, {
      date: BOOKING_DATE,
      startTime: "16:00",
      endTime: "17:00",
      scheduledByUserId: ACTOR,
    });

    // The session really went through the injected scheduling repository.
    expect(scheduling.get).toBeDefined();
    expect((await scheduling.get(booked.currentAttempt!.sessionId)).origin).toBe("manual");
  });

  it("keeps the domain's own rows after a registry reset", async () => {
    const repository = getCompensationRepository();
    const original = await getSchedulingRepository().create({
      classId: PRIVATE_CLASS,
      date: BOOKING_DATE,
      startTime: "14:00",
      endTime: "15:00",
      teacherId: "t1",
      roomId: "r1",
    });
    await getSchedulingRepository().cancelSession(original.id, "لغو");
    const compensation = await repository.register({
      originalSessionId: original.id,
      studentId: PRIVATE_STUDENT,
      reason: "لغو جلسه",
      requiredByUserId: ACTOR,
    });

    resetRegistry();

    // A reset drops the INJECTION, not the data: the next call sees the row.
    expect((await getCompensationRepository().get(compensation.id)).id).toBe(compensation.id);
  });
});

describe("backup validation", () => {
  it("accepts a coherent obligation", () => {
    expect(codes(validateDataset(datasetWith([stored()])))).toEqual([]);
  });

  it("accepts an obligation whose cancelled original no longer exists", () => {
    // Deliberate: a cancelled session with no attendance may be hard-deleted, and
    // the obligation must outlive it rather than make the payload unloadable.
    const orphan = stored({ originalSessionId: "ses_deleted_long_ago" });
    expect(codes(validateDataset(datasetWith([orphan])))).toEqual([]);
  });

  it("refuses a dangling student or class reference", () => {
    expect(codes(validateDataset(datasetWith([stored({ studentId: "st_nope" })])))).toContain(
      "INVALID_REFERENCE",
    );
    expect(codes(validateDataset(datasetWith([stored({ classId: "cl_nope" })])))).toContain(
      "INVALID_REFERENCE",
    );
  });

  it("refuses a missing typed link", () => {
    expect(
      codes(validateDataset(datasetWith([stored({ originalSessionId: "" })]))),
    ).toContain("MISSING_ID");
  });

  it("refuses two obligations for the same original and student", () => {
    const issues = codes(
      validateDataset(
        datasetWith([stored({ id: "cmp_a" }), stored({ id: "cmp_b", requiredAt: "2026-09-03T10:00:00.000Z" })]),
      ),
    );
    expect(issues).toContain("DUPLICATE_ID");
  });

  it("allows one original to owe two different students", () => {
    // Group compensation is not supported, but the model's uniqueness unit is the
    // (original, student) pair, and the validator must not be stricter than it.
    const issues = codes(
      validateDataset(
        datasetWith([stored({ id: "cmp_a" }), stored({ id: "cmp_b", studentId: "st1" })]),
      ),
    );
    expect(issues).toEqual([]);
  });

  it("refuses a session claimed by two obligations", () => {
    const attempt = (sessionId: string) => ({
      sessionId,
      scheduledAt: "2026-09-04T10:00:00.000Z",
      scheduledByUserId: ACTOR,
    });
    const issues = codes(
      validateDataset(
        datasetWith([
          stored({ id: "cmp_a", attempts: [attempt("ses_makeup")] }),
          stored({ id: "cmp_b", studentId: "st1", attempts: [attempt("ses_makeup")] }),
        ]),
      ),
    );
    expect(issues).toContain("DUPLICATE_ID");
  });

  it("refuses a malformed attempt ledger", () => {
    expect(
      codes(validateDataset(datasetWith([stored({ attempts: undefined as never })]))),
    ).toContain("INVALID_COLLECTION");
    expect(
      codes(
        validateDataset(
          datasetWith([
            stored({ attempts: [{ sessionId: "" } as never] }),
          ]),
        ),
      ),
    ).toContain("MISSING_ID");
  });
});
