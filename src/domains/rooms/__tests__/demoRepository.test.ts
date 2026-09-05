/** §11 room domain invariants (rooms constrain class capacity and scheduling). */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { demoStore } from "@/services/demoStore";
import { DemoRoomRepository } from "@/domains/rooms/demoRepository";

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return (error as ApiError).code ?? "";
  }
  throw new Error("expected the promise to reject");
}

describe("DemoRoomRepository", () => {
  let repo: DemoRoomRepository;
  beforeEach(() => {
    demoStore.reset();
    repo = new DemoRoomRepository();
  });

  it("rejects a duplicate room name", async () => {
    const rooms = await repo.list({ per_page: 100 });
    const [first, second] = rooms.data;
    expect(await codeOf(repo.update(second.id, { name: first.name }))).toBe("ROOM_NAME_TAKEN");
  });

  it("rejects a non-positive or absurd capacity", async () => {
    const first = (await repo.list({ per_page: 1 })).data[0];
    expect(await codeOf(repo.update(first.id, { capacity: 0 }))).toBe("ROOM_INVALID");
    expect(await codeOf(repo.update(first.id, { capacity: 501 }))).toBe("ROOM_INVALID");
  });

  it("refuses to delete a room that classes still use", async () => {
    // r1 hosts cl1, cl2, cl6 and cl7 in the seed dataset.
    expect(await codeOf(repo.delete("r1"))).toBe("ROOM_IN_USE");
  });

  it("filters by minimum capacity", async () => {
    const page = await repo.list({ minCapacity: 6, per_page: 100 });
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data.every((room) => room.capacity >= 6)).toBe(true);
  });
});
