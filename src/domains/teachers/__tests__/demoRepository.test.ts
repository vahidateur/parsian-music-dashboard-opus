/** §10 teacher domain invariants. */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { teachers as seedTeachers } from "@/data/records";
import { demoStore } from "@/services/demoStore";
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

describe("DemoTeacherRepository", () => {
  let repo: DemoTeacherRepository;
  beforeEach(() => {
    demoStore.reset();
    repo = new DemoTeacherRepository();
  });

  it("lists seeded teachers", async () => {
    const page = await repo.list({ per_page: 100 });
    expect(page.meta.total).toBe(seedTeachers.length);
  });

  it("filters to assignable teachers only", async () => {
    const target = seedTeachers[0];
    await repo.deactivate(target.id);
    const page = await repo.list({ assignableOnly: true, per_page: 100 });
    expect(page.data.some((t) => t.id === target.id)).toBe(false);
  });

  it("rejects a duplicate phone number", async () => {
    const existing = seedTeachers[0];
    expect(await codeOf(repo.update(seedTeachers[1].id, { phone: existing.phone }))).toBe(
      "TEACHER_PHONE_TAKEN",
    );
  });

  it("reports a missing teacher rather than returning undefined", async () => {
    expect(await codeOf(repo.get("nope"))).toBe("TEACHER_NOT_FOUND");
  });

  it("refuses to delete a teacher that still owns classes", async () => {
    // t1 teaches cl1 and cl2 in the seed dataset.
    expect(await codeOf(repo.delete("t1"))).toBe("TEACHER_HAS_CLASSES");
  });

  it("deactivate is reversible and preserves the record", async () => {
    const deactivated = await repo.deactivate("t1");
    expect(deactivated.status).toBe("inactive");
    const reactivated = await repo.update("t1", { status: "active" });
    expect(reactivated.status).toBe("active");
  });
});
