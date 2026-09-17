// @vitest-environment jsdom
/**
 * Composer state safety and the read-failure honesty rule — M6 / CP2.
 *
 * TWO DEFECT CLASSES, ONE ROOT
 *
 * Both cases in this file are about a value outliving the thing it describes:
 *
 *   1. The composer. Text typed for conversation A used to live in the page
 *      component, which stays mounted across a switch — so A's sentence sat in
 *      the box under B's header, one Enter away from being sent to B. The
 *      send path cannot catch this: by the time the repository is called, the
 *      send the operator intended and the send that happens are identical.
 *
 *   2. The message read. `Messages.tsx` discarded the read's `error`
 *      (OPEN_ITEMS I15), so a FAILED read and an EMPTY thread rendered the same
 *      sentence — «هنوز پیامی رد و بدل نشده» — a claim about the conversation
 *      made from a failure to read it.
 *
 * The attachment half of (1) is tested at the hook, because CP2 ships the state
 * and its reset rule while CP3 ships the control that populates it; asserting
 * it through a control that is deliberately still disabled would be a fiction.
 */
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { MessagesView } from "@/views/Messages";
import { Toasts } from "@/components/overlays/ActionSheet";
import { useComposer } from "@/views/messages/useComposer";
import { DemoChatRepository } from "@/domains/chat/demoRepository";
import type { ChatMessage } from "@/domains/chat/types";
import { getChatRepository, resetRegistry, setChatRepository } from "@/domains/registry";
import { withStubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { ApiError } from "@/api/errors";

const A = "محمد رضایی";
const B = "سارا احمدی";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function renderMessages() {
  return render(
    <AppProvider>
      <MessagesView />
      <Toasts />
    </AppProvider>,
  );
}

async function waitForThreads() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());
}

function threadList(): HTMLElement {
  return screen.getByRole("list", { name: "فهرست گفتگوها" });
}

function composer(): HTMLTextAreaElement {
  return screen.getByLabelText("متن پیام") as HTMLTextAreaElement;
}

async function selectThread(name: string) {
  const row = await waitFor(() => within(threadList()).getByText(name));
  fireEvent.click(row);
  await waitFor(() => expect(screen.getByLabelText("متن پیام")).toBeTruthy());
}

function type(text: string) {
  fireEvent.change(composer(), { target: { value: text } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function messagesOf(conversationId: string) {
  return (await new DemoChatRepository().listMessages({ conversationId, per_page: 200 })).data;
}

describe("draft isolation across a conversation switch", () => {
  it("never shows the previous conversation's draft under the new header", async () => {
    renderMessages();
    await waitForThreads();
    await selectThread(A);
    type("سلام استاد، دربارهٔ غیبت فردا");

    await selectThread(B);

    // The frame that switched already has an empty composer — no leak.
    expect(composer().value).toBe("");
    expect(screen.queryByDisplayValue("سلام استاد، دربارهٔ غیبت فردا")).toBeNull();
  });

  it("discards the draft rather than caching it for the way back", async () => {
    renderMessages();
    await waitForThreads();
    await selectThread(A);
    type("پیش‌نویس برای A");

    await selectThread(B);
    await selectThread(A);

    // Switching back does NOT resurrect it: leaving a conversation ends the
    // draft for it, so nothing can be sent to the wrong thread later.
    expect(composer().value).toBe("");
  });

  it("keeps each conversation's own typing while both are visited", async () => {
    renderMessages();
    await waitForThreads();
    await selectThread(B);
    type("پیش‌نویس B");

    await selectThread(A);
    expect(composer().value).toBe("");
    type("پیش‌نویس A");

    await selectThread(B);
    expect(composer().value).toBe("");
  });

  it("does not wipe the new conversation's draft when a send for the old one resolves late", async () => {
    renderMessages();
    await waitForThreads();
    const threads = (await getChatRepository().listConversations({ per_page: 100 })).data;
    const threadA = threads.find((t) => t.name === A)!;
    const threadB = threads.find((t) => t.name === B)!;
    const messagesInBBefore = (await messagesOf(threadB.id)).length;

    const held = deferred<ChatMessage>();
    let sentTo: string | null = null;
    setChatRepository(
      withStubs(new DemoChatRepository(), {
        sendMessage: (input) => {
          sentTo = input.conversationId;
          return held.promise;
        },
      }),
    );

    await selectThread(A);
    type("پیام در حال ارسال");
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));
    await screen.findByRole("button", { name: "در حال ارسال…" });

    // The operator moves on while the write is still in flight.
    await selectThread(B);
    type("پیش‌نویس B");

    // …and the send resolves.
    await act(async () => {
      held.resolve({
        id: "msg_late",
        conversationId: threadA.id,
        from: "me",
        body: "پیام در حال ارسال",
        sentAt: new Date().toISOString(),
        status: "sent",
        provider: "in_app",
      });
    });

    // The write targeted the conversation it was composed for…
    expect(sentTo).toBe(threadA.id);
    // …and the draft typed in the OTHER conversation survived it.
    await waitFor(() => expect(composer().value).toBe("پیش‌نویس B"));
    // A's send wrote nothing into B: the switch did not retarget the write.
    expect((await messagesOf(threadB.id)).length).toBe(messagesInBBefore);

    // The send is reported only after it resolved.
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')?.textContent ?? "").toContain("پیام ارسال شد"),
    );
  });
});

describe("pending attachment belongs to one conversation", () => {
  const file = () => new File([new Uint8Array([1, 2, 3])], "score.png", { type: "image/png" });

  it("is dropped the moment the conversation changes", () => {
    const { result, rerender } = renderHook(({ id }) => useComposer(id), { initialProps: { id: "cv_a" } });

    act(() => result.current.setPendingAttachment(file()));
    expect(result.current.pendingAttachment?.name).toBe("score.png");

    rerender({ id: "cv_b" });
    expect(result.current.pendingAttachment).toBeNull();
    expect(result.current.draft).toBe("");
  });

  it("is not resurrected by returning to the conversation", () => {
    const { result, rerender } = renderHook(({ id }) => useComposer(id), { initialProps: { id: "cv_a" } });

    act(() => result.current.setPendingAttachment(file()));
    rerender({ id: "cv_b" });
    rerender({ id: "cv_a" });

    expect(result.current.pendingAttachment).toBeNull();
  });

  it("survives a clearFor aimed at another conversation, and is cleared by its own", () => {
    const { result, rerender } = renderHook(({ id }) => useComposer(id), { initialProps: { id: "cv_a" } });

    rerender({ id: "cv_b" });
    act(() => result.current.setPendingAttachment(file()));
    act(() => result.current.setDraft("پیش‌نویس B"));

    // A late send for cv_a resolves: cv_b must be untouched.
    act(() => result.current.clearFor("cv_a"));
    expect(result.current.pendingAttachment?.name).toBe("score.png");
    expect(result.current.draft).toBe("پیش‌نویس B");

    act(() => result.current.clearFor("cv_b"));
    expect(result.current.pendingAttachment).toBeNull();
    expect(result.current.draft).toBe("");
  });
});

describe("a failed message read is never an empty conversation", () => {
  it("renders a failure with the reason, and no empty-thread claim", async () => {
    const real = new DemoChatRepository();
    setChatRepository(
      withStubs(real, {
        // Every read fails, so the failure state cannot be cleared by the
        // re-read that opening a thread triggers (markRead bumps the data
        // version) — what is asserted is the failure, not a lucky race.
        listMessages: () =>
          Promise.reject(new ApiError({ kind: "network", message: "ارتباط با سرویس پیام‌ها برقرار نشد." })),
      }),
    );

    renderMessages();
    await waitForThreads();

    await screen.findByText("بارگذاری پیام‌های این گفتگو ناموفق بود");
    // The reason is the repository's own sentence, and the pane makes no claim
    // about the conversation it failed to read.
    expect(screen.getByText("ارتباط با سرویس پیام‌ها برقرار نشد.")).toBeTruthy();
    expect(screen.queryByText("هنوز پیامی رد و بدل نشده")).toBeNull();
    // And it is not a transient frame: the read is still the failing one.
    await waitFor(() => expect(screen.getByText("بارگذاری پیام‌های این گفتگو ناموفق بود")).toBeTruthy());
    // Composing is not what failed, so the composer stays available.
    expect(screen.getByLabelText("متن پیام")).toBeTruthy();
  });

  it("retries the read and then shows what the repository returns", async () => {
    const real = new DemoChatRepository();
    let failing = true;
    let calls = 0;
    setChatRepository(
      withStubs(real, {
        listMessages: (params) => {
          calls += 1;
          if (failing) {
            return Promise.reject(new ApiError({ kind: "timeout", message: "پاسخ سرویس دیر رسید." }));
          }
          return real.listMessages(params);
        },
      }),
    );

    renderMessages();
    await waitForThreads();
    await screen.findByText("بارگذاری پیام‌های این گفتگو ناموفق بود");
    const callsBeforeRetry = calls;

    // The read still fails; the operator explicitly asks again.
    failing = false;
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(screen.queryByText("بارگذاری پیام‌های این گفتگو ناموفق بود")).toBeNull());
    expect(calls).toBeGreaterThan(callsBeforeRetry);
    // The messages rendered are the repository's, not a placeholder.
    await waitFor(() => expect(screen.queryByText("هنوز پیامی رد و بدل نشده")).toBeNull());
    expect(await screen.findByText(/سلام\. متأسفانه فرد/)).toBeTruthy();
  });
});
