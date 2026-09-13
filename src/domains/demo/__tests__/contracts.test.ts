import { describe, expect, it } from "vitest";
import { DemoStudentRepository } from "@/domains/students/demoRepository";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { createSeedDataset } from "@/domains/demo/seed";
import { DemoStoreImpl, memoryStorage } from "@/services/demoStore";

const CONFIRM = { confirm: true } as const;

/** The demo lifecycle must not change how repositories behave. */
describe("repository contract stability", () => {
  function ctx() {
    const store = new DemoStoreImpl(memoryStorage());
    return { store, repo: new DemoStudentRepository(store), manager: new DemoDataManager(store) };
  }

  it("exposes the unchanged StudentRepository surface", () => {
    const { repo } = ctx();
    for (const method of ["list", "get", "create", "update", "delete"] as const) {
      expect(typeof repo[method]).toBe("function");
    }
  });

  it("repositories observe lifecycle operations through the same store", async () => {
    const { repo, manager } = ctx();
    manager.initialize();
    expect((await repo.list({ per_page: 500 })).meta.total).toBe(createSeedDataset().students.length);

    manager.clear(CONFIRM);
    expect((await repo.list()).meta.total).toBe(0);

    manager.resetToSeed(CONFIRM);
    expect((await repo.list({ per_page: 500 })).meta.total).toBe(createSeedDataset().students.length);
  });

  it("repository writes are captured by an exported backup", async () => {
    const { repo, manager } = ctx();
    manager.initialize();
    // Distinct nationalId: the repository enforces academy-wide uniqueness.
    const created = await repo.create({
      ...createSeedDataset().students[0],
      name: "هنرجوی جدید",
      nationalId: "2000535658",
    });
    const backup = manager.exportBackup();
    expect(backup.data.students.some((s) => s.id === created.id)).toBe(true);
  });
});
