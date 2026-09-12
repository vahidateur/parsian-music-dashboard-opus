import { describe, expect, it } from "vitest";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { ROLES } from "@/domains/auth/permissions";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { createBackup } from "@/domains/demo/backup";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { createSeedDataset } from "@/domains/demo/seed";
import { DemoStoreImpl, memoryStorage } from "@/services/demoStore";

const CONFIRM = { confirm: true } as const;

function ctx() {
  const store = new DemoStoreImpl(memoryStorage());
  const sessionStore = memoryStorage();
  return {
    store,
    sessionStore,
    manager: new DemoDataManager(store),
    auth: new DemoAuthRepository(store, sessionStore),
    users: new DemoUserRepository(store),
  };
}

describe("demo lifecycle × auth", () => {
  it("reset restores the canonical users and roles", async () => {
    const c = ctx();
    c.manager.initialize();
    const seededUsers = createSeedDataset().users.length;

    await c.users.create({ name: "کاربر موقت", email: "temp@demo.local", role: "staff" });
    expect((await c.users.list()).data.length).toBe(seededUsers + 1);

    c.manager.resetToSeed(CONFIRM);
    const after = await c.users.list();
    expect(after.data.length).toBe(seededUsers);
    expect(after.data.some((u) => u.email === "temp@demo.local")).toBe(false);
    expect(c.store.snapshot().roles.map((r) => r.id).sort()).toEqual([...ROLES].sort());
  });

  it("reset makes the canonical accounts signable again", async () => {
    const c = ctx();
    c.manager.initialize();
    const admin = c.store.snapshot().users.find((u) => u.role === "administrator")!;
    c.store.users.remove(admin.id);
    await expect(c.auth.login({ email: admin.email, password: DEMO_PASSPHRASE })).rejects.toBeTruthy();

    c.manager.resetToSeed(CONFIRM);
    await expect(c.auth.login({ email: admin.email, password: DEMO_PASSPHRASE })).resolves.toBeTruthy();
  });

  it("clear removes every account — nobody can sign in", async () => {
    const c = ctx();
    c.manager.initialize();
    c.manager.clear(CONFIRM);
    expect((await c.users.list()).data).toEqual([]);
    await expect(c.auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE })).rejects.toBeTruthy();
  });

  it("clear invalidates the active session of a now-missing user", async () => {
    const c = ctx();
    c.manager.initialize();
    await c.auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
    expect(await c.auth.restore()).not.toBeNull();

    c.manager.clear(CONFIRM);
    expect(await c.auth.restore()).toBeNull();
  });

  it("restore brings users and roles back consistently", async () => {
    const c = ctx();
    c.manager.initialize();
    const created = await c.users.create({ name: "پایدار", email: "keep@demo.local", role: "accountant" });
    const backup = c.manager.exportBackupJson();

    c.manager.clear(CONFIRM);
    expect((await c.users.list()).data).toEqual([]);

    expect(c.manager.restoreBackup(backup, CONFIRM).ok).toBe(true);
    const restored = await c.users.list();
    expect(restored.data.some((u) => u.id === created.id && u.role === "accountant")).toBe(true);
    await expect(c.auth.login({ email: "keep@demo.local", password: DEMO_PASSPHRASE })).resolves.toBeTruthy();
  });

  it("an invalid restore leaves users untouched", async () => {
    const c = ctx();
    c.manager.initialize();
    const before = JSON.stringify(c.store.snapshot().users);

    const dataset = createSeedDataset();
    dataset.users[0].role = "root" as never;
    const result = c.manager.restoreBackup(JSON.stringify(createBackup(dataset)), CONFIRM);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.code === "INVALID_REFERENCE")).toBe(true);
    expect(JSON.stringify(c.store.snapshot().users)).toBe(before);
  });

  it("backups never carry credentials", () => {
    const c = ctx();
    c.manager.initialize();
    const serialized = JSON.stringify(c.manager.exportBackup()).toLowerCase();
    for (const bad of ["password", "passwordhash", "token", "secret", DEMO_PASSPHRASE]) {
      expect(serialized).not.toContain(bad);
    }
  });

  it("a user whose teacher link is broken fails validation", () => {
    const dataset = createSeedDataset();
    const teacherUser = dataset.users.find((u) => u.teacherId)!;
    teacherUser.teacherId = "t_ghost";
    const c = ctx();
    c.manager.initialize();
    const result = c.manager.restoreBackup(JSON.stringify(createBackup(dataset)), CONFIRM);
    expect(result.ok).toBe(false);
  });
});
