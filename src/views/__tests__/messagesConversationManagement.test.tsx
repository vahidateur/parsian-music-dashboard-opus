// @vitest-environment jsdom
/**
 * Conversation management — M6 / CP2.
 *
 * WHAT THESE CASES PROVE
 *
 * The view's half of four verbs the chat domain has exposed since Phase A with
 * zero callers: rename, topic, pin and archive/restore. Each case asserts the
 * outcome a user would observe — the row on screen, the pane, the toast — and
 * then asserts PERSISTENCE through a brand-new repository instance, because a
 * value echoed back by `update` is not evidence that anything was stored.
 *
 * ARCHIVE IS REVERSIBLE, AND THIS IS WHERE THAT IS PINNED
 *
 * A one-way archive would put a conversation beyond every surface in the
 * product. So the cases go the whole way: archive → hidden from the default
 * list with a truthful reason → discovered through the explicit filter →
 * restored → visible in the DEFAULT list again (the archived filter is switched
 * back off, which is the assertion that `archived` was really cleared) → and
 * still restored after a fresh read.
 *
 * HONESTY
 *
 * Every success toast is asserted only after the repository promise settled,
 * and one case holds the write open with a deferred promise to prove that
 * nothing is claimed while it is in flight.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { MessagesView } from "@/views/Messages";
import { Toasts } from "@/components/overlays/ActionSheet";
import { DemoChatRepository } from "@/domains/chat/demoRepository";
import type { ChatConversation } from "@/domains/chat/types";
import { getChatRepository, resetRegistry, setChatRepository } from "@/domains/registry";
import { withStubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

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

/** Waits for the thread list to finish loading. */
async function waitForThreads() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());
}

/** The conversation list, by its accessible name rather than by CSS. */
function threadList(): HTMLElement {
  return screen.getByRole("list", { name: "فهرست گفتگوها" });
}

function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

/** A success toast is identifiable by its resonance rings; no other tone has them. */
function successRings(): number {
  return document.querySelectorAll('[aria-live="polite"] .animate-resonance').length;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Selects a thread by its exact name in the list. */
async function selectThread(name: string) {
  const row = await waitFor(() => {
    const found = within(threadList()).getByText(name);
    expect(found).toBeTruthy();
    return found;
  });
  fireEvent.click(row);
}

/** Opens the manager for the selected conversation. */
async function openManager() {
  const button = await screen.findByRole("button", { name: "مدیریت گفتگو" });
  fireEvent.click(button);
  return screen.findByRole("dialog");
}

async function save() {
  fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
}

/** The seeded threads, in list order, straight from the repository. */
async function listed() {
  return (await getChatRepository().listConversations({ per_page: 100 })).data;
}

describe("rename and topic", () => {
  it("renames a conversation and the new name survives a fresh repository read", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed())[0];
    await selectThread(target.name);

    await openManager();
    fireEvent.change(screen.getByLabelText(/^نام گفتگو/), { target: { value: "ارکستر زهی" } });
    await save();

    // The row on screen, and the panel header, both follow the write.
    await waitFor(() => expect(within(threadList()).getAllByText("ارکستر زهی").length).toBeGreaterThan(0));

    // Persisted: a brand-new repository instance reads the same dataset.
    const persisted = await new DemoChatRepository().getConversation(target.id);
    expect(persisted.name).toBe("ارکستر زهی");
  });

  it("edits the topic and persists it", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed())[0];
    await selectThread(target.name);

    await openManager();
    fireEvent.change(screen.getByLabelText(/^موضوع/), { target: { value: "تمرین شنبه‌ها" } });
    await save();

    await waitFor(async () => {
      expect((await new DemoChatRepository().getConversation(target.id)).topic).toBe("تمرین شنبه‌ها");
    });
  });

  it("refuses a one-character name in the dialog, and writes nothing", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed())[0];
    await selectThread(target.name);

    await openManager();
    fireEvent.change(screen.getByLabelText(/^نام گفتگو/), { target: { value: "ا" } });
    await save();

    await screen.findByText(/۲ نویسه باشد\./);
    expect((await new DemoChatRepository().getConversation(target.id)).name).toBe(target.name);
    expect(successRings()).toBe(0);
  });

  it("reports a refused write in the repository's own words, with no success", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed())[0];
    await selectThread(target.name);

    const real = new DemoChatRepository();
    setChatRepository(
      withStubs(real, {
        updateConversation: () => Promise.reject(new Error("سرور گفتگوها پاسخ نداد.")),
      }),
    );

    await openManager();
    fireEvent.change(screen.getByLabelText(/^نام گفتگو/), { target: { value: "نام تازه" } });
    await save();

    await screen.findByText("سرور گفتگوها پاسخ نداد.");
    expect(successRings()).toBe(0);
    expect((await real.getConversation(target.id)).name).toBe(target.name);
  });
});

describe("pin and unpin", () => {
  it("pins an unpinned conversation and persists it", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed()).find((c) => !c.pinned);
    expect(target, "seed should hold an unpinned thread").toBeDefined();
    await selectThread(target!.name);

    await openManager();
    fireEvent.click(screen.getByRole("switch", { name: "سنجاق کردن گفتگو" }));
    await save();

    await waitFor(async () => {
      expect((await new DemoChatRepository().getConversation(target!.id)).pinned).toBe(true);
    });
    // A pinned thread sorts to the top of the list.
    await waitFor(() => expect((within(threadList()).getAllByText(target!.name)[0])).toBeTruthy());
    expect((await listed())[0].id).toBe(target!.id);
  });

  it("unpins a pinned conversation, so the flag is not one-way", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed()).find((c) => c.pinned);
    expect(target, "seed should hold a pinned thread").toBeDefined();
    await selectThread(target!.name);

    await openManager();
    fireEvent.click(screen.getByRole("switch", { name: "سنجاق کردن گفتگو" }));
    await save();

    await waitFor(async () => {
      expect((await new DemoChatRepository().getConversation(target!.id)).pinned).toBe(false);
    });
  });
});

describe("archive, discovery and restore", () => {
  it("archives: the conversation leaves the default list and the pane says why", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed())[0];
    await selectThread(target.name);

    await openManager();
    fireEvent.click(screen.getByRole("button", { name: "بایگانی" }));

    await waitFor(() => expect(within(threadList()).queryByText(target.name)).toBeNull());
    // The selection is NOT silently moved to another conversation.
    await screen.findByText("این گفتگو در فهرست فعلی نمایش داده نمی‌شود");
    expect(screen.queryByLabelText("متن پیام")).toBeNull();
    // And it is persisted, not merely hidden locally.
    expect((await new DemoChatRepository().getConversation(target.id)).archived).toBe(true);
  });

  it("discovers an archived conversation through the explicit filter, marked as archived", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed())[0];
    await selectThread(target.name);

    await openManager();
    fireEvent.click(screen.getByRole("button", { name: "بایگانی" }));
    await screen.findByText("این گفتگو در فهرست فعلی نمایش داده نمی‌شود");

    fireEvent.click(screen.getByRole("button", { name: "نمایش گفتگوهای بایگانی‌شده" }));

    await waitFor(() => expect(within(threadList()).getAllByText(target.name).length).toBeGreaterThan(0));
    expect(within(threadList()).getAllByText("بایگانی‌شده").length).toBeGreaterThan(0);
  });

  it("restores: visible in the DEFAULT list again, and the restore persists", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed())[0];
    await selectThread(target.name);

    await openManager();
    fireEvent.click(screen.getByRole("button", { name: "بایگانی" }));
    await screen.findByText("این گفتگو در فهرست فعلی نمایش داده نمی‌شود");

    // Discover it, select it, and restore it from the same surface.
    fireEvent.click(screen.getByRole("button", { name: "نمایش گفتگوهای بایگانی‌شده" }));
    await waitFor(() => expect(within(threadList()).getAllByText(target.name).length).toBeGreaterThan(0));
    await selectThread(target.name);

    await openManager();
    fireEvent.click(screen.getByRole("button", { name: "بازگردانی" }));

    // Persisted…
    await waitFor(async () => {
      expect((await new DemoChatRepository().getConversation(target.id)).archived).toBe(false);
    });

    // …and genuinely restored: switching the archived filter back OFF must not
    // hide it again. This is the assertion a one-way archive cannot pass.
    fireEvent.click(screen.getByRole("button", { name: "بایگانی‌شده‌ها" }));
    await waitFor(() => expect(within(threadList()).getAllByText(target.name).length).toBeGreaterThan(0));
    expect(screen.queryByText("این گفتگو در فهرست فعلی نمایش داده نمی‌شود")).toBeNull();
  });

  it("keeps an archived conversation's messages", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed())[0];
    const before = (await getChatRepository().listMessages({ conversationId: target.id, per_page: 200 })).meta.total;

    await selectThread(target.name);
    await openManager();
    fireEvent.click(screen.getByRole("button", { name: "بایگانی" }));
    await waitFor(() => expect(within(threadList()).queryByText(target.name)).toBeNull());

    const after = await getChatRepository().listMessages({ conversationId: target.id, per_page: 200 });
    expect(after.meta.total).toBe(before);
  });
});

describe("write honesty", () => {
  it("claims nothing until the management write resolves", async () => {
    renderMessages();
    await waitForThreads();
    const target = (await listed())[0];
    await selectThread(target.name);

    const held = deferred<ChatConversation>();
    const real = new DemoChatRepository();
    setChatRepository(withStubs(real, { updateConversation: () => held.promise }));

    await openManager();
    fireEvent.change(screen.getByLabelText(/^نام گفتگو/), { target: { value: "در انتظار" } });
    await save();

    // In flight: the button reports the wait, and no success has been claimed.
    await screen.findByRole("button", { name: "در حال ذخیره…" });
    expect(successRings()).toBe(0);
    expect(toastText()).not.toContain("به‌روزرسانی شد");

    held.resolve({ ...target, name: "در انتظار" });

    await waitFor(() => expect(toastText()).toContain("به‌روزرسانی شد"));
  });
});

describe("selection is explicit when a filter hides it", () => {
  it("never retargets the thread pane at another conversation", async () => {
    renderMessages();
    await waitForThreads();
    const threads = await listed();
    const target = threads[0];
    const other = threads[1];
    await selectThread(target.name);

    // A search that cannot match the selected thread.
    fireEvent.change(screen.getByPlaceholderText("جستجوی گفتگو…"), { target: { value: "پیام‌های-بی‌همتا" } });

    await screen.findByText("این گفتگو در فهرست فعلی نمایش داده نمی‌شود");
    // Neither the other conversation's thread nor a composer is on screen.
    expect(screen.queryByLabelText("متن پیام")).toBeNull();
    expect(within(threadList()).queryByText(other.name)).toBeNull();

    // The way back restores the SAME conversation.
    fireEvent.click(screen.getByRole("button", { name: "پاک‌کردن جستجو و فیلتر" }));
    await waitFor(() => expect(screen.getByLabelText("متن پیام")).toBeTruthy());
  });

  it("keeps a conversation just created under an excluding role filter explicitly selected", async () => {
    renderMessages();
    await waitForThreads();

    // «پذیرش» is the role a new conversation is created with; filtering by
    // «مدرس» hides it, so the operator must be told rather than shown a blank.
    fireEvent.click(screen.getByRole("button", { name: "مدرس" }));
    await waitFor(() => expect(within(threadList()).queryByText("گفتگوی جدید")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "گفتگوی جدید" }));

    await screen.findByText("این گفتگو در فهرست فعلی نمایش داده نمی‌شود");
    // It really was created — the pane is honest about visibility, not about existence.
    const created = (await getChatRepository().listConversations({ per_page: 200, role: "staff" })).data;
    expect(created.some((c) => c.name === "گفتگوی جدید")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "پاک‌کردن جستجو و فیلتر" }));
    await waitFor(() => expect(within(threadList()).getAllByText("گفتگوی جدید").length).toBeGreaterThan(0));
  });
});
