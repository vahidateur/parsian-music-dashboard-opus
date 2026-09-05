/**
 * Regression tests for the prototype-pollution hardening.
 *
 * `JSON.parse` preserves `__proto__` as a real *own* property, and it survives
 * object spread. A later `Object.assign(target, row)` then re-points the
 * target's prototype. Backups and the demo snapshot both come from
 * user-controlled sources (a chosen file / localStorage), so both are stripped.
 */
import { describe, expect, it } from "vitest";
import { createBackup, parseBackup, stripPrototypeKeys } from "@/domains/demo/backup";
import { createSeedDataset } from "@/domains/demo/seed";
import { DemoStoreImpl, DEMO_STORAGE_KEY, memoryStorage } from "@/services/demoStore";

const backupText = (mutate: (json: string) => string): string =>
  mutate(JSON.stringify(createBackup(createSeedDataset())));

describe("stripPrototypeKeys", () => {
  it("removes an own __proto__ property produced by JSON.parse", () => {
    const parsed = JSON.parse('{"id":"a","__proto__":{"polluted":"yes"}}') as object;
    expect(Object.prototype.hasOwnProperty.call(parsed, "__proto__")).toBe(true);

    const clean = stripPrototypeKeys(parsed);
    expect(Object.prototype.hasOwnProperty.call(clean, "__proto__")).toBe(false);

    const target: Record<string, unknown> = {};
    Object.assign(target, clean);
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
    expect((target as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it("removes constructor and prototype keys at any depth", () => {
    const clean = stripPrototypeKeys(
      JSON.parse('{"a":{"b":[{"constructor":"x","prototype":"y","keep":1}]}}') as object,
    ) as { a: { b: Array<Record<string, unknown>> } };
    const row = clean.a.b[0];
    expect(row.keep).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(row, "constructor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(row, "prototype")).toBe(false);
  });

  it("leaves ordinary data untouched", () => {
    const dataset = createSeedDataset();
    expect(stripPrototypeKeys(dataset)).toEqual(dataset);
  });

  it("never mutates Object.prototype", () => {
    stripPrototypeKeys(JSON.parse('{"__proto__":{"pwned":true}}') as object);
    expect(({} as { pwned?: unknown }).pwned).toBeUndefined();
  });
});

describe("parseBackup hardening", () => {
  it("strips __proto__ smuggled into a record", () => {
    const result = parseBackup(
      backupText((j) => j.replace('"students":[', '"students":[{"id":"zz","__proto__":{"polluted":"yes"}},')),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.backup.data.students.find((s) => s.id === "zz");
    expect(row).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(row, "__proto__")).toBe(false);

    const target: Record<string, unknown> = {};
    Object.assign(target, row);
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
  });

  it("still rejects credential-like fields", () => {
    const result = parseBackup(
      backupText((j) => j.replace('"students":[', '"students":[{"id":"zz","password":"hunter2"},')),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "FORBIDDEN_FIELD")).toBe(true);
  });

  it("rejects malformed JSON without throwing", () => {
    const result = parseBackup("{ not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].code).toBe("MALFORMED_JSON");
  });
});

describe("DemoStore snapshot hardening", () => {
  it("strips prototype keys from a tampered localStorage snapshot", () => {
    const storage = memoryStorage();
    const dataset = createSeedDataset();
    const poisoned = JSON.stringify(dataset).replace(
      '"students":[',
      '"students":[{"id":"zz","name":"tampered","__proto__":{"polluted":"yes"}},',
    );
    storage.setItem(DEMO_STORAGE_KEY, poisoned);

    const store = new DemoStoreImpl(storage);
    const row = store.students.all().find((s) => s.id === "zz");
    expect(row).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(row, "__proto__")).toBe(false);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it("reseeds instead of throwing when the snapshot is corrupt", () => {
    const storage = memoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, "{{{not-json");
    const store = new DemoStoreImpl(storage);
    expect(store.students.all().length).toBeGreaterThan(0);
  });
});
