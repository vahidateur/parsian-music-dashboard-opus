/**
 * Conversation lifecycle — management verbs, persistence, and the archive rule.
 *
 * M6's requirement is that every capability the domain already exposes is
 * either reachable or recorded as deliberately UI-less. These cases pin the
 * DOMAIN half of that contract, adversarially:
 *
 *   - rename / topic / pin survive a FRESH repository instance, because a value
 *     returned by `update` could otherwise be a return-value illusion;
 *   - archiving hides a thread by default and `includeArchived` reveals it;
 *   - archive is REVERSIBLE through the same `updateConversation` contract,
 *     which is why no unarchive verb exists;
 *   - nothing is written for an unknown thread, and a refusal leaves the record
 *     exactly as it was.
 *
 * A fresh instance is the point throughout: `DemoChatRepository` reads the same
 * persisted dataset, so "persisted" is asserted where a caller would actually
 * observe it, not where the write happened.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoChatRepository } from "../demoRepository";
import { ApiError } from "@/api/errors";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

let repo: DemoChatRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  repo = new DemoChatRepository();
});

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.code : "NOT_API_ERROR";
  }
}

/** Reads through a NEW repository, i.e. what survives a reload. */
async function reread(id: string) {
  return new DemoChatRepository().getConversation(id);
}

async function firstThread() {
  const page = await repo.listConversations({ per_page: 50 });
  return page.data[0];
}

describe("renaming", () => {
  it("persists a new name and topic across a fresh repository instance", async () => {
    const thread = await firstThread();

    await repo.updateConversation(thread.id, { name: "ارکستر زهی", topic: "تمرین شنبه‌ها" });

    const persisted = await reread(thread.id);
    expect(persisted.name).toBe("ارکستر زهی");
    expect(persisted.topic).toBe("تمرین شنبه‌ها");
  });

  it("trims what it stores instead of keeping the operator's padding", async () => {
    const thread = await firstThread();
    await repo.updateConversation(thread.id, { name: "  گروه کر  " });
    expect((await reread(thread.id)).name).toBe("گروه کر");
  });

  it("leaves fields the patch did not mention untouched", async () => {
    const thread = await firstThread();
    const before = thread.topic;

    await repo.updateConversation(thread.id, { name: "فقط نام" });

    const persisted = await reread(thread.id);
    expect(persisted.topic).toBe(before);
    expect(persisted.unread).toBe(thread.unread);
    expect(persisted.lastMessagePreview).toBe(thread.lastMessagePreview);
  });

  it("refuses a name shorter than two characters and writes nothing", async () => {
    const thread = await firstThread();

    expect(await codeOf(repo.updateConversation(thread.id, { name: " ا " }))).toBe("CONVERSATION_INVALID");
    // The refusal is not a partial write.
    expect((await reread(thread.id)).name).toBe(thread.name);
  });

  it("refuses an unknown thread rather than creating one", async () => {
    const before = (await repo.listConversations({ per_page: 100 })).meta.total;

    expect(await codeOf(repo.updateConversation("cv-missing", { name: "هرچه" }))).toBe("CONVERSATION_NOT_FOUND");
    expect((await repo.listConversations({ per_page: 100 })).meta.total).toBe(before);
  });
});

describe("pinning", () => {
  it("persists a pin and moves the thread to the top of the list", async () => {
    const page = await repo.listConversations({ per_page: 50 });
    // Deliberately a thread that is NOT first and NOT already pinned, so the
    // ordering assertion cannot pass because of the seed's own order.
    const candidate = page.data.find((c) => !c.pinned);
    expect(candidate, "seed should hold an unpinned thread").toBeDefined();

    await repo.updateConversation(candidate!.id, { pinned: true });

    expect((await reread(candidate!.id)).pinned).toBe(true);
    const after = await repo.listConversations({ per_page: 50 });
    expect(after.data[0].id).toBe(candidate!.id);
  });

  it("unpins again — the flag is not one-way", async () => {
    const page = await repo.listConversations({ per_page: 50 });
    const pinned = page.data.find((c) => c.pinned);
    expect(pinned, "seed should hold a pinned thread").toBeDefined();

    await repo.updateConversation(pinned!.id, { pinned: false });

    expect((await reread(pinned!.id)).pinned).toBe(false);
  });
});

describe("archive and restore", () => {
  it("hides an archived thread from the list by default", async () => {
    const thread = await firstThread();

    await repo.archiveConversation(thread.id);

    const visible = await repo.listConversations({ per_page: 100 });
    expect(visible.data.some((c) => c.id === thread.id)).toBe(false);
  });

  it("reveals an archived thread through the archived-inclusive filter", async () => {
    const thread = await firstThread();
    await repo.archiveConversation(thread.id);

    const all = await repo.listConversations({ per_page: 100, includeArchived: true });
    expect(all.data.some((c) => c.id === thread.id)).toBe(true);
    // The row is marked as archived, so a UI can tell the two apart.
    expect(all.data.find((c) => c.id === thread.id)?.archived).toBe(true);
  });

  it("keeps the archive after a reload, and keeps the thread's messages", async () => {
    const thread = await firstThread();
    const messagesBefore = (await repo.listMessages({ conversationId: thread.id, per_page: 200 })).meta.total;

    await repo.archiveConversation(thread.id);

    // Archiving is not deletion: the thread and its history are still there.
    expect((await reread(thread.id)).archived).toBe(true);
    expect((await repo.listMessages({ conversationId: thread.id, per_page: 200 })).meta.total).toBe(messagesBefore);
  });

  it("restores through updateConversation, because no unarchive verb exists", async () => {
    const thread = await firstThread();
    await repo.archiveConversation(thread.id);

    const restored = await repo.updateConversation(thread.id, { archived: false });
    expect(restored.archived).toBe(false);

    const visible = await repo.listConversations({ per_page: 100 });
    expect(visible.data.some((c) => c.id === thread.id)).toBe(true);
  });

  it("restores persistently — a fresh instance sees the thread again", async () => {
    const thread = await firstThread();
    await repo.archiveConversation(thread.id);
    await repo.updateConversation(thread.id, { archived: false });

    expect((await reread(thread.id)).archived).toBe(false);
    const visible = await new DemoChatRepository().listConversations({ per_page: 100 });
    expect(visible.data.some((c) => c.id === thread.id)).toBe(true);
  });

  it("round-trips archive → restore → archive without losing the thread", async () => {
    const thread = await firstThread();

    await repo.archiveConversation(thread.id);
    expect((await reread(thread.id)).archived).toBe(true);
    await repo.updateConversation(thread.id, { archived: false });
    expect((await reread(thread.id)).archived).toBe(false);
    await repo.archiveConversation(thread.id);
    expect((await reread(thread.id)).archived).toBe(true);
  });

  it("combines archive with a rename in one call, without dropping either", async () => {
    const thread = await firstThread();

    await repo.updateConversation(thread.id, { name: "بایگانی‌شده", archived: true });

    const persisted = await reread(thread.id);
    expect(persisted.name).toBe("بایگانی‌شده");
    expect(persisted.archived).toBe(true);
  });

  it("refuses to archive an unknown thread, and changes nothing", async () => {
    const before = (await repo.listConversations({ per_page: 100, includeArchived: true })).meta.total;

    expect(await codeOf(repo.archiveConversation("cv-missing"))).toBe("CONVERSATION_NOT_FOUND");

    const after = await repo.listConversations({ per_page: 100, includeArchived: true });
    expect(after.meta.total).toBe(before);
    expect(after.data.some((c) => c.archived)).toBe(false);
  });

  it("keeps archived threads out of the role filter too, unless asked", async () => {
    const thread = await firstThread();
    await repo.archiveConversation(thread.id);

    const filtered = await repo.listConversations({ per_page: 100, role: thread.role });
    expect(filtered.data.some((c) => c.id === thread.id)).toBe(false);

    const inclusive = await repo.listConversations({ per_page: 100, role: thread.role, includeArchived: true });
    expect(inclusive.data.some((c) => c.id === thread.id)).toBe(true);
  });
});
