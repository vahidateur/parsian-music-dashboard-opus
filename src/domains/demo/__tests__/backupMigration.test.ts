/**
 * F8 — Backup envelope versioned migration + integrity + WRONG_ENVIRONMENT honest.
 *
 * Acceptance:
 * - Backup envelope versioned format migration retention/integrity/restore/encryption/failure OPEN marked
 * - Version field, migration accepts old envelopes, integrity hash optional, environment label fixed always demo I8 + validation, filename Persian UTF-8 safe
 * - Tests: backup restore versioned migration old->new WRONG_ENVIRONMENT honest
 */

import { describe, it, expect } from "vitest";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_LEGACY_VERSION,
  BACKUP_ENVIRONMENT,
  BACKUP_KIND,
  createBackup,
  parseBackup,
  parseBackupWithMigration,
  migrateBackupIfNeeded,
  verifyBackupIntegrity,
  validateBackup,
} from "../backup";
import { createSeedDataset } from "../seed";

const seed = () => createSeedDataset();

describe("backup migration old->new", () => {
  it("migrates legacy 1.0 to current 1.1", () => {
    const backup = createBackup(seed(), new Date("2026-09-05T10:00:00.000Z"));
    // Simulate old envelope 1.0
    const old = { ...backup, schemaVersion: BACKUP_LEGACY_VERSION };
    const migration = migrateBackupIfNeeded(old);
    expect(migration).not.toBeNull();
    expect(migration?.migrated).toBe(true);
    expect(migration?.fromVersion).toBe(BACKUP_LEGACY_VERSION);
    expect(migration?.toVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(migration?.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(migration?.backup.environment).toBe(BACKUP_ENVIRONMENT);
    expect(migration?.backup.kind).toBe(BACKUP_KIND);
  });

  it("does not migrate current version", () => {
    const backup = createBackup(seed());
    const migration = migrateBackupIfNeeded(backup);
    expect(migration).not.toBeNull();
    expect(migration?.migrated).toBe(false);
    expect(migration?.toVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it("returns null for unsupported version", () => {
    const backup = { ...createBackup(seed()), schemaVersion: "99.0" };
    const migration = migrateBackupIfNeeded(backup);
    expect(migration).toBeNull();
  });

  it("parseBackupWithMigration accepts legacy 1.0 and returns migrated", () => {
    const backup = createBackup(seed(), new Date("2026-09-05T10:00:00.000Z"));
    const old = { ...backup, schemaVersion: BACKUP_LEGACY_VERSION };
    const text = JSON.stringify(old);
    const result = parseBackupWithMigration(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migrated).toBe(true);
      expect(result.fromVersion).toBe(BACKUP_LEGACY_VERSION);
      expect(result.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    }
  });

  it("parseBackupWithMigration accepts current version without migration", () => {
    const backup = createBackup(seed());
    const text = JSON.stringify(backup);
    const result = parseBackupWithMigration(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migrated).toBe(false);
    }
  });

  it("parseBackup strict rejects legacy without migration", () => {
    const backup = createBackup(seed());
    const old = { ...backup, schemaVersion: BACKUP_LEGACY_VERSION };
    const text = JSON.stringify(old);
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "UNSUPPORTED_SCHEMA_VERSION")).toBe(true);
    }
  });

  it("WRONG_ENVIRONMENT honest Persian", () => {
    const backup = { ...createBackup(seed()), environment: "production" } as unknown as Record<string, unknown>;
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((i) => i.code === "WRONG_ENVIRONMENT");
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("دمو");
    }
  });

  it("UNSUPPORTED_SCHEMA_VERSION honest with expected and received", () => {
    const backup = { ...createBackup(seed()), schemaVersion: "99.0" };
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((i) => i.code === "UNSUPPORTED_SCHEMA_VERSION");
      expect(issue).toBeDefined();
      expect(issue?.message).toContain(BACKUP_SCHEMA_VERSION);
      expect(issue?.message).toContain("99.0");
    }
  });
});

describe("backup integrity hash optional", () => {
  it("no integrity field is ok (optional for demo)", () => {
    const backup = createBackup(seed());
    const result = verifyBackupIntegrity(backup);
    expect(result.ok).toBe(true);
  });

  it("valid sha256 hash is ok", () => {
    const backup = createBackup(seed());
    const hash = "a".repeat(64); // 64 hex chars
    const withIntegrity = { ...backup, integrity: { algo: "sha256" as const, hash } };
    const result = verifyBackupIntegrity(withIntegrity);
    expect(result.ok).toBe(true);
  });

  it("invalid algo is not ok", () => {
    const backup = createBackup(seed());
    const withIntegrity = {
      ...backup,
      integrity: { algo: "md5" as unknown as "sha256", hash: "abc" },
    };
    const result = verifyBackupIntegrity(withIntegrity);
    expect(result.ok).toBe(false);
  });

  it("empty hash is not ok", () => {
    const backup = createBackup(seed());
    const withIntegrity = { ...backup, integrity: { algo: "sha256" as const, hash: "" } };
    const result = verifyBackupIntegrity(withIntegrity);
    expect(result.ok).toBe(false);
  });

  it("short hash is not ok", () => {
    const backup = createBackup(seed());
    const withIntegrity = { ...backup, integrity: { algo: "sha256" as const, hash: "abc" } };
    const result = verifyBackupIntegrity(withIntegrity);
    expect(result.ok).toBe(false);
  });
});

describe("backup security — no business logic in backup envelope", () => {
  it("backup.ts does not contain Telegram/Bale token", () => {
    const backup = createBackup(seed());
    const serialized = JSON.stringify(backup);
    expect(serialized.toLowerCase()).not.toContain("telegram");
    expect(serialized.toLowerCase()).not.toContain("bale");
    expect(serialized.toLowerCase()).not.toContain("token");
  });

  it("backup envelope is demo only, environment fixed always demo I8", () => {
    const backup = createBackup(seed());
    expect(backup.environment).toBe("demo");
    expect(backup.kind).toBe("arena.demo.backup");
  });
});
