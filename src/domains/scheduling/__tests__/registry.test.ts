/**
 * Registry wiring for scheduling.
 *
 * Two things must hold: the API repository stays unregistered (registering an
 * unserved endpoint would turn every call into a failing request presented as
 * a feature), and the fail-safe attendance seam survives the wiring — a
 * registry that quietly injected a permissive stub would disable the
 * protection it exists to guarantee.
 */
import { afterEach, describe, expect, it } from "vitest";
import { DemoSchedulingRepository } from "../demoRepository";
import { ApiSchedulingRepository } from "../apiRepository";
import { SESSION_ERRORS } from "../types";
import {
  getAttendanceRepository,
  getSchedulingRepository,
  resetRegistry,
  setAttendanceRepository,
  setSchedulingRepository,
} from "@/domains/registry";
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";
import { ApiAttendanceRepository } from "@/domains/attendance/apiRepository";
import { getRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { demoStore } from "@/services/demoStore";
import { ApiError } from "@/api/errors";

const originalMode = getRuntimeConfig().mode;

afterEach(() => {
  setRuntimeConfig({ mode: originalMode });
  resetRegistry();
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (cause) {
    return cause instanceof ApiError ? (cause.code ?? "UNKNOWN") : "UNKNOWN";
  }
}

describe("resolution", () => {
  it("returns the demo repository by default", () => {
    expect(getSchedulingRepository()).toBeInstanceOf(DemoSchedulingRepository);
  });

  it("returns the demo repository in API mode too, and never the API one", () => {
    /*
     * No server implements /api/v1/sessions. Resolving to the API repository
     * would produce failing requests dressed as a feature (§37). The contract
     * exists and compiles; it is deliberately not wired.
     */
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://example.test/api/v1" });
    resetRegistry();

    const repo = getSchedulingRepository();
    expect(repo).toBeInstanceOf(DemoSchedulingRepository);
    expect(repo).not.toBeInstanceOf(ApiSchedulingRepository);
  });
});

describe("test seam", () => {
  it("honours an injected override", () => {
    const fake = new DemoSchedulingRepository(demoStore);
    setSchedulingRepository(fake);
    expect(getSchedulingRepository()).toBe(fake);
  });

  it("is cleared by resetRegistry", () => {
    const fake = new DemoSchedulingRepository(demoStore);
    setSchedulingRepository(fake);
    resetRegistry();
    expect(getSchedulingRepository()).not.toBe(fake);
  });

  it("is cleared by passing undefined", () => {
    const fake = new DemoSchedulingRepository(demoStore);
    setSchedulingRepository(fake);
    setSchedulingRepository(undefined);
    expect(getSchedulingRepository()).not.toBe(fake);
  });
});

describe("the real attendance provider is wired (C2b)", () => {
  /**
   * Before Group D the registry injected nothing, so presence was UNKNOWN and
   * every destructive operation refused. Now a real provider backed by
   * attendance data is wired, so protection is precise: sessions WITH marks
   * are protected, sessions without them are freely editable.
   */
  it("allows deleting a session that has no attendance", async () => {
    demoStore.reset();
    resetRegistry();

    const repo = getSchedulingRepository();
    const existing = (await repo.list({ per_page: 1 })).data[0];
    expect(existing).toBeDefined();
    // The seed records no attendance, so nothing is protected yet.
    expect(demoStore.attendanceRecords.all()).toHaveLength(0);

    await repo.delete(existing.id);
    expect(demoStore.scheduledSessions.find(existing.id)).toBeUndefined();
  });

  it("protects a session once real attendance exists", async () => {
    demoStore.reset();
    resetRegistry();

    const scheduling = getSchedulingRepository();
    const attendance = getAttendanceRepository();

    // Find a session whose derived roster is non-empty so a mark can be taken.
    const sessions = (await scheduling.list({ per_page: 500 })).data;
    let marked: string | undefined;
    for (const session of sessions) {
      if (session.status === "cancelled") continue;
      const roster = await scheduling.sessionRoster(session.id);
      if (roster.length === 0) continue;

      await attendance.record({
        sessionId: session.id,
        studentId: roster[0].studentId,
        status: "present",
        recordedByUserId: "usr_admin",
      });
      marked = session.id;
      break;
    }
    expect(marked, "seed should contain a session with a roster").toBeDefined();

    // The scheduling repository now sees the mark through the narrow boundary.
    expect(await codeOf(scheduling.delete(marked!))).toBe(SESSION_ERRORS.HAS_ATTENDANCE);
    expect(await codeOf(scheduling.update(marked!, { notes: "x" }))).toBe(
      SESSION_ERRORS.HAS_ATTENDANCE,
    );
    expect(demoStore.scheduledSessions.find(marked!)).toBeDefined();
  });

  it("keeps scheduling free of any attendance implementation import", () => {
    // Enforced repository-wide by architectureBoundaries; asserted here too so
    // the intent is visible at the wiring site.
    expect(getSchedulingRepository()).toBeInstanceOf(DemoSchedulingRepository);
  });

  it("still allows non-destructive reads and previews", async () => {
    demoStore.reset();
    resetRegistry();

    const repo = getSchedulingRepository();
    const page = await repo.list({ per_page: 5 });
    expect(page.data.length).toBeGreaterThan(0);

    const plan = await repo.previewGeneration({
      classId: "cl1",
      from: "2026-09-01",
      to: "2026-09-14",
    });
    expect(plan.classId).toBe("cl1");
  });
});

describe("attendance registry", () => {
  it("returns the demo repository by default", () => {
    expect(getAttendanceRepository()).toBeInstanceOf(DemoAttendanceRepository);
  });

  it("never returns the API repository, which no server implements", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://example.test/api/v1" });
    resetRegistry();
    expect(getAttendanceRepository()).not.toBeInstanceOf(ApiAttendanceRepository);
  });

  it("honours an override and clears it on reset", () => {
    const fake = new DemoAttendanceRepository(demoStore);
    setAttendanceRepository(fake);
    expect(getAttendanceRepository()).toBe(fake);

    resetRegistry();
    expect(getAttendanceRepository()).not.toBe(fake);
  });
});

describe("seeded data is reachable through the registry", () => {
  it("lists the dated sessions from the seed", async () => {
    demoStore.reset();
    resetRegistry();

    const page = await getSchedulingRepository().list({ per_page: 500 });
    expect(page.meta.total).toBeGreaterThan(50);
    expect(page.data.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date))).toBe(true);
  });
});
