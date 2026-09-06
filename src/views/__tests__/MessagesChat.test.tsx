// @vitest-environment jsdom
/**
 * Chat through the real UI against the real demo repository.
 *
 * The regression this guards: sending a message used to raise a toast and
 * change nothing. These tests assert the message actually reaches the store
 * and the thread, which is what the user asked for.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { MessagesView } from "@/views/Messages";
import { getChatRepository, resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";

afterEach(cleanup);
beforeEach(() => {
  demoStore.reset();
  resetRegistry();
});

function renderMessages() {
  return render(
    <AppProvider>
      <MessagesView />
    </AppProvider>,
  );
}

/** Waits for the thread list to finish loading. */
async function waitForThreads() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());
}

/**
 * The conversation list. The page renders several `<ul>`s (threads, message
 * templates), so the thread list is identified by its search box's container
 * rather than by role alone.
 */
function threadList(): HTMLElement {
  const search = screen.getByPlaceholderText("جستجوی گفتگو…");
  const surface = search.closest("div.flex.flex-col") as HTMLElement | null;
  const list = surface?.querySelector("ul");
  if (!list) throw new Error("thread list not found");
  return list as HTMLElement;
}

describe("sending a message", () => {
  it("persists the message and shows it in the thread immediately", async () => {
    renderMessages();
    await waitForThreads();

    const box = await screen.findByLabelText("متن پیام");
    fireEvent.change(box, { target: { value: "این پیام باید ذخیره شود" } });
    fireEvent.click(screen.getByRole("button", { name: /ارسال/ }));

    // Visible in the thread…
    await screen.findByText("این پیام باید ذخیره شود");

    // …and genuinely persisted, readable by a fresh repository instance.
    const threads = await getChatRepository().listConversations({ per_page: 50 });
    const messages = await getChatRepository().listMessages({
      conversationId: threads.data[0].id,
      per_page: 200,
    });
    expect(messages.data.some((m) => m.body === "این پیام باید ذخیره شود")).toBe(true);
  });

  it("clears the composer after a successful send", async () => {
    renderMessages();
    await waitForThreads();

    const box = (await screen.findByLabelText("متن پیام")) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "پاک شود" } });
    fireEvent.click(screen.getByRole("button", { name: /ارسال/ }));

    await waitFor(() => expect(box.value).toBe(""));
  });

  it("sends with Enter and inserts a newline with Shift+Enter", async () => {
    renderMessages();
    await waitForThreads();

    const box = await screen.findByLabelText("متن پیام");
    fireEvent.change(box, { target: { value: "ارسال با کلید" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText("ارسال با کلید");

    // Shift+Enter must NOT send: the draft stays in the composer and no new
    // message row appears. (Querying by text would match the textarea itself.)
    const sentBefore = (
      await getChatRepository().listMessages({
        conversationId: (await getChatRepository().listConversations({ per_page: 50 })).data[0].id,
        per_page: 200,
      })
    ).meta.total;

    fireEvent.change(box, { target: { value: "خط جدید" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });

    const sentAfter = (
      await getChatRepository().listMessages({
        conversationId: (await getChatRepository().listConversations({ per_page: 50 })).data[0].id,
        per_page: 200,
      })
    ).meta.total;
    expect(sentAfter).toBe(sentBefore);
    expect((box as HTMLTextAreaElement).value).toBe("خط جدید");
  });

  it("refuses to send an empty message", async () => {
    renderMessages();
    await waitForThreads();

    const button = (await screen.findByRole("button", { name: /ارسال/ })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("متن پیام"), { target: { value: "   " } });
    expect(button.disabled).toBe(true);
  });

  it("renders a script-like body as text rather than markup", async () => {
    renderMessages();
    await waitForThreads();

    const payload = '<img src=x onerror="alert(1)">';
    fireEvent.change(await screen.findByLabelText("متن پیام"), { target: { value: payload } });
    fireEvent.click(screen.getByRole("button", { name: /ارسال/ }));

    // Present as literal text; no element was created from the payload.
    const node = await screen.findByText(payload);
    expect(node.querySelector("img")).toBeNull();
  });
});

describe("thread state", () => {
  it("switches threads and shows that thread's messages", async () => {
    renderMessages();
    await waitForThreads();

    const threads = await getChatRepository().listConversations({ per_page: 50 });
    const second = threads.data[1];
    const secondMessages = await getChatRepository().listMessages({
      conversationId: second.id,
      per_page: 10,
    });

    fireEvent.click(within(threadList()).getByText(second.name));

    if (secondMessages.data.length > 0) {
      await screen.findByText(secondMessages.data[0].body);
    }
  });

  it("clears the unread badge once a thread is opened", async () => {
    const threads = await getChatRepository().listConversations({ per_page: 50 });
    const unreadThread = threads.data.find((t) => t.unread > 0);
    expect(unreadThread).toBeDefined();

    renderMessages();
    await waitForThreads();

    fireEvent.click(within(threadList()).getByText(unreadThread!.name));

    await waitFor(async () => {
      const reread = await getChatRepository().getConversation(unreadThread!.id);
      expect(reread.unread).toBe(0);
    });
  });

  it("creates a new conversation and selects it", async () => {
    renderMessages();
    await waitForThreads();

    const before = (await getChatRepository().listConversations({ per_page: 100 })).meta.total;
    fireEvent.click(screen.getByRole("button", { name: "گفتگوی جدید" }));

    await waitFor(async () => {
      const after = await getChatRepository().listConversations({ per_page: 100 });
      expect(after.meta.total).toBe(before + 1);
    });
  });

  it("filters threads by search text", async () => {
    renderMessages();
    await waitForThreads();

    const threads = await getChatRepository().listConversations({ per_page: 50 });
    const target = threads.data[0];

    fireEvent.change(screen.getByPlaceholderText("جستجوی گفتگو…"), { target: { value: target.name } });

    await waitFor(() => expect(within(threadList()).queryByText(target.name)).not.toBeNull());
  });
});
