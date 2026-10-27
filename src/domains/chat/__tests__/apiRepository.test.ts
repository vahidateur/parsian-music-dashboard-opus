// @vitest-environment jsdom
/**
 * ApiChatRepository — request construction against a stubbed fetch, and the
 * shared-invalidation contract: a write the server accepted bumps the data
 * version so the thread list and the open thread re-read; a refused write
 * changes nothing.
 *
 * The version bump is what keeps the client composition honest. The demo
 * composition refreshes through the store subscription; the API composition
 * has no store, so without the bump a panel would keep showing the list from
 * before the write. Every served domain follows this rule (§37 for chat).
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { getDataVersion } from "@/domains/shared/dataVersion";
import { ApiChatRepository, toConversationQuery, toMessageQuery } from "@/domains/chat/apiRepository";
import type { SendMessageInput } from "@/domains/chat/types";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiChatRepository(client) };
}

describe("ApiChatRepository request construction", () => {
  it("GET /chat/conversations with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 100, total: 0 } }));
    await repo.listConversations({ search: "پشتیبانی", role: "staff", includeArchived: true, page: 1, per_page: 100 });
    const req = requestOf(mock);
    expect(req.url).toBe(
      "https://example.test/api/v1/chat/conversations?search=%D9%BE%D8%B4%D8%AA%DB%8C%D8%A8%D8%A7%D9%86%DB%8C&role=staff&include_archived=1&page=1&per_page=100",
    );
    expect(req.init.method).toBe("GET");
  });

  it("GET /chat/conversations/{id} and encodes ids", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "co 1" } }));
    await repo.getConversation("co 1");
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/chat/conversations/co%201");
  });

  it("POST /chat/conversations", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "co_1" } }));
    await repo.createConversation({ name: "گفتگوی تازه", role: "group", topic: "t" });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/chat/conversations");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(JSON.stringify({ name: "گفتگوی تازه", role: "group", topic: "t" }));
  });

  it("PATCH /chat/conversations/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "co_1", pinned: true } }));
    const result = await repo.updateConversation("co_1", { pinned: true });
    expect(requestOf(mock).init.method).toBe("PATCH");
    expect(result.pinned).toBe(true);
  });

  it("POST /chat/conversations/{id}/archive", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "co_1", archived: true } }));
    const result = await repo.archiveConversation("co_1");
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/chat/conversations/co_1/archive");
    expect(req.init.method).toBe("POST");
    expect(result.archived).toBe(true);
  });

  it("POST /chat/conversations/{id}/read", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "co_1", unread: 0 } }));
    const result = await repo.markRead("co_1");
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/chat/conversations/co_1/read");
    expect(req.init.method).toBe("POST");
    expect(result.unread).toBe(0);
  });

  it("GET /chat/conversations/{id}/messages, oldest first", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 200, total: 0 } }));
    await repo.listMessages({ conversationId: "co_1", page: 1, per_page: 200 });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/chat/conversations/co_1/messages?page=1&per_page=200");
    expect(req.init.method).toBe("GET");
  });

  it("POST /chat/conversations/{id}/messages carries only the body and the reference", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "cm_1", from: "me" } }));
    const input = { conversationId: "co_1", body: "سلام", mediaId: "md_1" } as unknown as SendMessageInput;
    const result = await repo.sendMessage(input);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/chat/conversations/co_1/messages");
    expect(req.init.method).toBe("POST");
    // The wire carries no sender and no `from`: the server records the
    // authenticated user and derives the side per viewer. There is no field
    // for a client-supplied sender to arrive in.
    expect(req.init.body).toBe(JSON.stringify({ body: "سلام", mediaId: "md_1" }));
    expect(result.from).toBe("me");
  });

  it("surfaces an unknown thread as not_found", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "CONVERSATION_NOT_FOUND", message: "گفتگو یافت نشد." } }, 404),
    );
    const error = (await repo.getConversation("co_missing").catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("not_found");
    expect(error.code).toBe("CONVERSATION_NOT_FOUND");
  });

  it("omits unset query params", () => {
    expect(toConversationQuery({})).toMatchObject({ search: undefined, role: undefined, include_archived: undefined });
    expect(toMessageQuery({ conversationId: "co_1" })).toMatchObject({ page: undefined, per_page: undefined });
  });
});

describe("ApiChatRepository shared invalidation", () => {
  it("bumps the data version after a send the server accepted", async () => {
    const { repo } = harness(() => jsonResponse({ data: { id: "cm_9", from: "me" } }));
    const before = getDataVersion();
    await repo.sendMessage({ conversationId: "co_1", body: "سلام" });
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("bumps after markRead the server accepted", async () => {
    const { repo } = harness(() => jsonResponse({ data: { id: "co_1", unread: 0 } }));
    const before = getDataVersion();
    await repo.markRead("co_1");
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("bumps nothing when the server refused the write", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "MESSAGE_INVALID", message: "متن پیام خالی است." } }, 422),
    );
    const before = getDataVersion();
    await expect(repo.sendMessage({ conversationId: "co_1", body: "   " })).rejects.toBeInstanceOf(ApiError);
    expect(getDataVersion()).toBe(before);
  });
});
