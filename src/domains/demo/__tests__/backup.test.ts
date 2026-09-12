import { describe, expect, it } from "vitest";
import {
  BACKUP_SCHEMA_VERSION,
  createBackup,
  datasetStats,
  findForbiddenKeys,
  parseBackup,
  validateBackup,
  validateDataset,
} from "@/domains/demo/backup";
import { createSeedDataset } from "@/domains/demo/seed";
import type { DemoDataset } from "@/domains/demo/types";

const seed = () => createSeedDataset();

describe("backup envelope", () => {
  it("carries schema version, environment and stats", () => {
    const backup = createBackup(seed(), new Date("2026-09-05T10:00:00.000Z"));
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.environment).toBe("demo");
    expect(backup.kind).toBe("arena.demo.backup");
    expect(backup.exportedAt).toBe("2026-09-05T10:00:00.000Z");
    expect(backup.stats.total).toBe(datasetStats(seed()).total);
    expect(backup.app.name).toContain("DEMO");
  });

  it("is deterministic apart from the timestamp", () => {
    const at = new Date("2026-01-01T00:00:00.000Z");
    expect(JSON.stringify(createBackup(seed(), at))).toBe(JSON.stringify(createBackup(seed(), at)));
  });

  it("contains no secrets, tokens or session data", () => {
    const serialized = JSON.stringify(createBackup(seed()));
    for (const key of ["password", "token", "accessToken", "apiKey", "secret", "cookie"]) {
      expect(serialized.toLowerCase()).not.toContain(`"${key.toLowerCase()}"`);
    }
    expect(findForbiddenKeys(createBackup(seed()).data)).toEqual([]);
  });
});

describe("backup validation", () => {
  const validText = () => JSON.stringify(createBackup(seed()));

  it("accepts a well-formed backup", () => {
    const result = parseBackup(validText());
    expect(result.ok).toBe(true);
  });

  it("rejects malformed JSON", () => {
    const result = parseBackup("{ not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].code).toBe("MALFORMED_JSON");
  });

  it("rejects non-object payloads", () => {
    const result = parseBackup("[1,2,3]");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].code).toBe("NOT_AN_OBJECT");
  });

  it("rejects an unsupported schema version", () => {
    const backup = { ...createBackup(seed()), schemaVersion: "99.0" };
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.code === "UNSUPPORTED_SCHEMA_VERSION")).toBe(true);
  });

  it("rejects a non-demo environment", () => {
    const backup = { ...createBackup(seed()), environment: "production" };
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.code === "WRONG_ENVIRONMENT")).toBe(true);
  });

  it("rejects a missing collection", () => {
    const backup = createBackup(seed());
    delete (backup.data as Partial<DemoDataset>).invoices;
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.code === "MISSING_COLLECTION")).toBe(true);
  });

  it("rejects a collection with the wrong type", () => {
    const backup = createBackup(seed());
    (backup.data as unknown as Record<string, unknown>).students = { nope: true };
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.code === "INVALID_COLLECTION")).toBe(true);
  });

  it("rejects duplicate ids", () => {
    const dataset = seed();
    dataset.students.push({ ...dataset.students[0] });
    expect(validateDataset(dataset).some((i) => i.code === "DUPLICATE_ID")).toBe(true);
  });

  it("rejects records without an id", () => {
    const dataset = seed();
    dataset.rooms.push({ name: "بی‌شناسه", kind: "x", capacity: 1, occupancy: 0 } as never);
    expect(validateDataset(dataset).some((i) => i.code === "MISSING_ID")).toBe(true);
  });

  it("rejects invalid references between entities", () => {
    const dataset = seed();
    dataset.enrollments[0].studentId = "st_ghost";
    dataset.sessions[0].roomId = "room_ghost";
    dataset.invoices[0].studentId = "st_ghost";
    const issues = validateDataset(dataset);
    expect(issues.filter((i) => i.code === "INVALID_REFERENCE").length).toBeGreaterThanOrEqual(3);
  });

  it("rejects payloads carrying credential-like fields", () => {
    const dataset = seed();
    (dataset.users[0] as unknown as Record<string, unknown>).passwordHash = "x";
    expect(validateDataset(dataset).some((i) => i.code === "FORBIDDEN_FIELD")).toBe(true);
  });
});
