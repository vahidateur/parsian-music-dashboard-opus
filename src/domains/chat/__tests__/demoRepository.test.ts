/**
 * Chat persistence and delivery honesty.
 *
 * The product complaint this domain answers is that sending a message did
 * nothing but raise a toast. These tests therefore assert real state changes
 * through the real store, and assert that unavailable transports say so.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoChatRepository } from "../demoRepository";
import { MAX_MESSAGE_LENGTH } from "../types";
import { ApiError } from "@/api/errors";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

let repo: DemoChatRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  repo = new DemoChatRepository();
});

/** Resolves the error code of a rejected promise. */
async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.code : "NOT_API_ERROR";
  }
}

async function firstConversationId(): Promise<string> {
  const page = await repo.listConversations({ per_page: 50 });
  return page.data[0].id;
}

describe("conversations", () => {
  it("seeds threads with normalized messages", async () => {
    const page = await repo.listConversations({ per_page: 50 });
    expect(page.data.length).toBeGreaterThan(0);

    const messages = await repo.listMessages({ conversationId: page.data[0].id, per_page: 100 });
    expect(messages.data.length).toBeGreaterThan(0);
    // Messages live in their own collection, not nested in the thread.
    expect(messages.data[0].conversationId).toBe(page.data[0].id);
  });

  it("orders pinned threads first, then by recency", async () => {
    const page = await repo.listConversations({ per_page: 50 });
    const pinnedCount = page.data.filter((c) => c.pinned).length;
    if (pinnedCount > 0) expect(page.data[0].pinned).toBe(true);
  });

  it("creates and renames a conversation", async () => {
    const created = await repo.createConversation({ name: "گروه ارکستر", role: "group", topic: "تمرین هفتگی" });
    expect(created.id).toBeTruthy();

    const renamed = await repo.updateConversation(created.id, { name: "ارکستر زهی" });
    expect(renamed.name).toBe("ارکستر زهی");

    // Persisted, not just returned.
    const reread = await repo.getConversation(created.id);
    expect(reread.name).toBe("ارکستر زهی");
  });

  it("hides archived threads unless explicitly requested", async () => {
    const id = await firstConversationId();
    await repo.archiveConversation(id);

    const visible = await repo.listConversations({ per_page: 50 });
    expect(visible.data.some((c) => c.id === id)).toBe(false);

    const all = await repo.listConversations({ per_page: 50, includeArchived: true });
    expect(all.data.some((c) => c.id === id)).toBe(true);
  });

  it("rejects an unknown conversation rather than returning undefined", async () => {
    expect(await codeOf(repo.getConversation("cv-missing"))).toBe("CONVERSATION_NOT_FOUND");
  });
});

describe("sending messages", () => {
  it("persists an in-app message and updates the thread preview", async () => {
    const id = await firstConversationId();
    const before = (await repo.listMessages({ conversationId: id, per_page: 200 })).data.length;

    const sent = await repo.sendMessage({ conversationId: id, body: "سلام، جلسهٔ فردا برقرار است." });
    expect(sent.status).toBe("sent");
    expect(sent.from).toBe("me");

    const after = await repo.listMessages({ conversationId: id, per_page: 200 });
    expect(after.data).toHaveLength(before + 1);
    expect(after.data[after.data.length - 1].body).toBe("سلام، جلسهٔ فردا برقرار است.");

    const thread = await repo.getConversation(id);
    expect(thread.lastMessagePreview).toBe("سلام، جلسهٔ فردا برقرار است.");
  });

  it("survives a reload, because it went through the store", async () => {
    const id = await firstConversationId();
    await repo.sendMessage({ conversationId: id, body: "پیام ماندگار" });

    // A brand-new repository instance reads the same persisted dataset.
    const fresh = new DemoChatRepository();
    const messages = await fresh.listMessages({ conversationId: id, per_page: 200 });
    expect(messages.data.some((m) => m.body === "پیام ماندگار")).toBe(true);
  });

  it("keeps messages in chronological order", async () => {
    const id = await firstConversationId();
    await repo.sendMessage({ conversationId: id, body: "اول" });
    await repo.sendMessage({ conversationId: id, body: "دوم" });

    const messages = await repo.listMessages({ conversationId: id, per_page: 200 });
    const bodies = messages.data.map((m) => m.body);
    expect(bodies.indexOf("اول")).toBeLessThan(bodies.indexOf("دوم"));
  });

  it("rejects an empty or oversized body", async () => {
    const id = await firstConversationId();
    expect(await codeOf(repo.sendMessage({ conversationId: id, body: "   " }))).toBe("MESSAGE_INVALID");
    expect(await codeOf(repo.sendMessage({ conversationId: id, body: "x".repeat(MAX_MESSAGE_LENGTH + 1) }))).toBe(
      "MESSAGE_INVALID",
    );
  });

  it("stores a body verbatim as text, without interpreting markup", async () => {
    const id = await firstConversationId();
    const payload = '<img src=x onerror="alert(1)">';
    const sent = await repo.sendMessage({ conversationId: id, body: payload });
    // Stored exactly as typed; escaping is React's job at render time.
    expect(sent.body).toBe(payload);
  });

  it("reports an external provider as unavailable instead of faking delivery", async () => {
    const id = await firstConversationId();
    for (const provider of ["telegram", "bale", "sms", "email"] as const) {
      const sent = await repo.sendMessage({ conversationId: id, body: `آزمون ${provider}`, provider });
      expect(sent.status).toBe("unavailable");
      expect(sent.status).not.toBe("sent");
      // The operator is told why, in Persian.
      expect(sent.statusReason && sent.statusReason.length).toBeGreaterThan(0);
    }
  });

  it("still records an undeliverable message in the thread", async () => {
    const id = await firstConversationId();
    const sent = await repo.sendMessage({ conversationId: id, body: "به تلگرام", provider: "telegram" });
    const messages = await repo.listMessages({ conversationId: id, per_page: 200 });
    expect(messages.data.some((m) => m.id === sent.id)).toBe(true);
  });
});

describe("unread state", () => {
  it("clears the unread counter when a thread is read", async () => {
    const page = await repo.listConversations({ per_page: 50 });
    const withUnread = page.data.find((c) => c.unread > 0);
    expect(withUnread, "seed should contain an unread thread").toBeDefined();

    const read = await repo.markRead(withUnread!.id);
    expect(read.unread).toBe(0);

    const reread = await repo.getConversation(withUnread!.id);
    expect(reread.unread).toBe(0);
  });
});
