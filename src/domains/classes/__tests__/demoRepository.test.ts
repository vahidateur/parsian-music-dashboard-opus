/** §11 class invariants: capacity is bounded by the room, archive is non-destructive. */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { demoStore } from "@/services/demoStore";
import { DemoClassRepository } from "@/domains/classes/demoRepository";
import { DemoTeacherRepository } from "@/domains/teachers/demoRepository";

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return (error as ApiError).code ?? "";
  }
  throw new Error("expected the promise to reject");
}

describe("DemoClassRepository", () => {
  let repo: DemoClassRepository;
  beforeEach(() => {
    demoStore.reset();
    repo = new DemoClassRepository();
  });

  it("rejects an unknown teacher or room", async () => {
    const valid = await repo.get("cl1");
    expect(await codeOf(repo.update("cl1", { teacherId: "nope" }))).toBe("CLASS_INVALID");
    expect(await codeOf(repo.update("cl1", { roomId: "nope" }))).toBe("CLASS_INVALID");
    expect(valid.id).toBe("cl1");
  });

  it("refuses a class capacity larger than the room capacity", async () => {
    expect(await codeOf(repo.update("cl1", { capacity: 999 }))).toBe("CLASS_INVALID");
  });

  it("refuses to shrink capacity below the currently enrolled count", async () => {
    const cls = await repo.get("cl1");
    expect(cls.enrolled).toBeGreaterThan(1);
    expect(await codeOf(repo.update("cl1", { capacity: 1 }))).toBe("CLASS_CAPACITY_BELOW_ENROLLED");
  });

  it("refuses to assign an inactive teacher", async () => {
    await new DemoTeacherRepository().deactivate("t5");
    expect(await codeOf(repo.update("cl1", { teacherId: "t5" }))).toBe("CLASS_INVALID");
  });

  it("archives without destroying the record and hides it from the default list", async () => {
    const archived = await repo.archive("cl10");
    expect(archived.status).toBe("archived");

    const visible = await repo.list({ per_page: 100 });
    expect(visible.data.some((c) => c.id === "cl10")).toBe(false);

    // Still retrievable by id — archive is not a delete.
    expect((await repo.get("cl10")).id).toBe("cl10");
  });

  it("refuses to hard-delete a class that still has enrollments", async () => {
    expect(await codeOf(repo.delete("cl1"))).toBe("CLASS_HAS_ENROLLMENTS");
  });
});
