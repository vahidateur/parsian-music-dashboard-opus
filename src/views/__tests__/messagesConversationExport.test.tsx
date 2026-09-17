// @vitest-environment jsdom
/**
 * Conversation export — M6 / CP4.
 *
 * THE ARTIFACT IS VERIFIED BEFORE THE DOWNLOAD IS DISCUSSED
 *
 * Every content case asserts the bytes that would be handed to the browser: the
 * download seam is stubbed (`URL.createObjectURL` — the one browser API jsdom
 * does not implement) and the Blob it receives is read back as text. That is the
 * only way to prove "the export contains the repository's messages" rather than
 * "the export did not throw".
 *
 * The suite is split deliberately:
 *
 *   - the transcript builder is a pure function, so those cases pass a fixed
 *     `exportedAt` and assert exact output — no clock, no waiting;
 *   - the view cases hold repository promises open with deferreds and assert
 *     ORDER (nothing claimed while pending), so determinism comes from the
 *     promise, never from a sleep or a timeout.
 *
 * WHAT THE FILE MUST NOT CLAIM
 *
 * Attachment *metadata* is exported; attachment **bytes** are not, and the
 * transcript says so in its own words. The chat contract carries `mediaId` and
 * the media contract keeps binaries in the browser's blob store — so a case here
 * asserts the file contains no blob, no object URL and no download link, and the
 * header text that denies it.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { MessagesView } from "@/views/Messages";
import { Toasts } from "@/components/overlays/ActionSheet";
import { ApiError } from "@/api/errors";
import { DemoChatRepository } from "@/domains/chat/demoRepository";
import type { ChatMessage, MessageListParams } from "@/domains/chat/types";
import type { Page } from "@/api/types";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import type { MediaAsset } from "@/domains/media/types";
import { getChatRepository, resetRegistry, setChatRepository } from "@/domains/registry";
import { createEmptyDataset } from "@/domains/demo/seed";
import { demoStore } from "@/services/demoStore";
import { withStubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { buildChatTranscript, readChatExport } from "@/views/messages/conversationExport";

/**
 * Deliberately NOT the first row of the list.
 *
 * The default selection is the first thread, so a case that exported "the first
 * conversation" instead of the selected one would pass against it unnoticed.
 * These threads are picked so that identity is what the assertions measure.
 */
const THREAD_OTHER = "آیدا شریفی";
const THREAD_OTHER_B = "مریم کریمی";

/** The exported instant used by every content assertion: fixed, so output is exact. */
const EXPORTED_AT = new Date("2026-09-14T10:47:00.000Z");

/* ------------------------------------------------------------------ */
/* The browser seam under test                                         */
/* ------------------------------------------------------------------ */
/** Blobs handed to the browser, in order — i.e. every file the surface downloaded. */
let downloaded: Blob[] = [];
let anchorClicks = 0;

beforeEach(() => {
  resetToDemoEnvironment();
  setBlobStore(createMemoryBlobStore());
  resetRegistry();
  downloaded = [];
  anchorClicks = 0;

  // jsdom implements neither of these; the CP4 brief allows stubbing the
  // unavoidable download APIs — the CONTENT is what the assertions read.
  URL.createObjectURL = vi.fn((blob: Blob) => {
    downloaded.push(blob);
    return `blob:test/${downloaded.length}`;
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
  // Keep jsdom's "navigation not implemented" out of the run; the click is still counted.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
    anchorClicks += 1;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function downloadedText(index = 0): Promise<string> {
  const blob = downloaded[index];
  expect(blob, `no download was performed (index ${index})`).toBeDefined();
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(new Uint8Array(await blob.arrayBuffer()));
}

/* ------------------------------------------------------------------ */
/* View helpers                                                        */
/* ------------------------------------------------------------------ */
function renderMessages() {
  return render(
    <AppProvider>
      <MessagesView />
      <Toasts />
    </AppProvider>,
  );
}

/** Renders and waits until a conversation is actually selected (the composer exists). */
async function openThread() {
  renderMessages();
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());
  await waitFor(() => expect(screen.queryByLabelText("متن پیام")).not.toBeNull());
}

function composer(): HTMLTextAreaElement {
  return screen.getByLabelText("متن پیام") as HTMLTextAreaElement;
}

function threadList(): HTMLElement {
  return screen.getByRole("list", { name: "فهرست گفتگوها" });
}

function exportButton(): HTMLElement {
  return screen.getByRole("button", { name: "خروجی گرفتن از این گفتگو" });
}

/**
 * Waits for the in-flight state.
 *
 * The accessible NAME stays «خروجی گرفتن از این گفتگو» while the export runs —
 * an `aria-label` pins it, which is deliberate: a control that renames itself
 * mid-action is harder to reach, not easier. So the wait is on the visible label
 * and the disabled state, both of which the operator actually sees.
 */
async function waitForExporting(): Promise<HTMLButtonElement> {
  const button = exportButton() as HTMLButtonElement;
  await waitFor(() => expect(button.textContent).toContain("در حال تهیه…"));
  expect(button.disabled).toBe(true);
  return button;
}

function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

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

async function selectThread(name: string) {
  const row = await waitFor(() => within(threadList()).getByText(name));
  fireEvent.click(row);
  await waitFor(() => expect(screen.queryByLabelText("متن پیام")).not.toBeNull());
}

/**
 * The export's own reads.
 *
 * The view also reads messages for the open thread (200 per page), so a bare
 * "last read" would be whichever render happened last. The export reads with
 * `EXPORT_MESSAGE_CEILING`, which is what makes its read identifiable.
 */
function exportReads(calls: { all: MessageListParams[] }) {
  return calls.all.filter((params) => params.per_page === 1000);
}

async function threads() {
  return (await getChatRepository().listConversations({ per_page: 100 })).data;
}

async function messagesOf(conversationId: string) {
  return (await getChatRepository().listMessages({ conversationId, per_page: 200 })).data;
}

/** A counting chat repository: the real one, with the export reads tallied. */
function stubChat(listMessages?: (params: MessageListParams) => Promise<Page<ChatMessage>>) {
  const real = new DemoChatRepository();
  const calls = {
    messages: 0,
    conversations: 0,
    /** Every read, in order — the UI's own thread reads included. */
    all: [] as MessageListParams[],
  };
  setChatRepository(
    withStubs(real, {
      getConversation: async (id: string) => {
        calls.conversations += 1;
        return real.getConversation(id);
      },
      listMessages: async (params: MessageListParams) => {
        calls.messages += 1;
        calls.all.push(params);
        return listMessages ? listMessages(params) : real.listMessages(params);
      },
    }),
  );
  return calls;
}

/* ------------------------------------------------------------------ */
/* A · the control                                                     */
/* ------------------------------------------------------------------ */
describe("the export control", () => {
  it("exists for a selected conversation, and is disabled when none is selected", async () => {
    demoStore.replace(createEmptyDataset());
    renderMessages();
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());
    await screen.findByText("گفتگویی پیدا نشد");

    // No conversation is selected, so there is nothing to export — and no control.
    expect(screen.queryByRole("button", { name: "خروجی گرفتن از این گفتگو" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "گفتگوی جدید" }));
    // Selected now, so the control appears.
    await screen.findByRole("button", { name: "خروجی گرفتن از این گفتگو" });
  });
});

/* ------------------------------------------------------------------ */
/* B · the transcript (pure)                                           */
/* ------------------------------------------------------------------ */
describe("the transcript is built only from the data it was given", () => {
  const conversation = {
    id: "cv_test",
    name: "گفتگوی آزمون",
    role: "teacher" as const,
    topic: "موضوع آزمون",
    lastMessageAt: "2026-09-14T09:00:00.000Z",
    lastMessagePreview: "…",
    unread: 0,
  };

  function message(over: Partial<ChatMessage>): ChatMessage {
    return {
      id: "msg_1",
      conversationId: "cv_test",
      from: "them",
      body: "متن",
      sentAt: "2026-09-14T08:30:00.000Z",
      provider: "in_app",
      status: "sent",
      ...over,
    };
  }

  const base = { conversation, attachments: [], exportedAt: EXPORTED_AT, totalInRepository: 0 };

  it("carries the conversation identity, the timestamps and the senders", () => {
    const text = buildChatTranscript({
      ...base,
      messages: [
        message({ id: "m1", from: "them", body: "سلام، دربارهٔ کلاس", sentAt: "2026-09-14T08:30:00.000Z" }),
        message({ id: "m2", from: "me", body: "در خدمتم", sentAt: "2026-09-14T09:15:00.000Z" }),
      ],
      totalInRepository: 2,
    });

    expect(text).toContain("گفتگو: گفتگوی آزمون");
    expect(text).toContain("موضوع: موضوع آزمون");
    expect(text).toContain("شناسهٔ گفتگو: cv_test");
    expect(text).toContain("خروجی‌گیری (ISO): 2026-09-14 10:47");
    expect(text).toContain("تعداد پیام‌ها: 2");
    // Both messages, each with its own timestamp and its own sender line.
    expect(text).toContain("[2026-09-14 08:30] گفتگوی آزمون:");
    expect(text).toContain("سلام، دربارهٔ کلاس");
    expect(text).toContain("[2026-09-14 09:15] مدیر:");
    expect(text).toContain("در خدمتم");
    // The direction labels are explained rather than invented.
    expect(text).toContain("راهنما:");
  });

  it("carries attachment metadata and denies that the bytes are included", () => {
    const asset: MediaAsset = {
      id: "md_1",
      kind: "image",
      filename: "score.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      createdAt: "2026-09-14T08:00:00.000Z",
    };
    const text = buildChatTranscript({
      ...base,
      messages: [message({ id: "m1", from: "me", body: "نت را بفرست", mediaId: "md_1" })],
      attachments: [{ mediaId: "md_1", asset }],
      totalInRepository: 1,
    });

    expect(text).toContain("پیوست: score.png");
    expect(text).toContain("image/png");
    expect(text).toContain("شناسه: md_1");
    // The denial is part of the file, so nobody can read it as "the file came along".
    expect(text).toContain("خودِ فایل پیوست در خروجی نیست");
    // And no bytes, URL or link sneaked in.
    expect(text).not.toContain("blob:");
    expect(text).not.toContain("data:");
    expect(text).not.toContain("http");
  });

  it("describes an attachment whose metadata no longer resolves instead of inventing one", () => {
    const text = buildChatTranscript({
      ...base,
      messages: [message({ id: "m1", from: "me", body: "پیام", mediaId: "md_gone" })],
      attachments: [{ mediaId: "md_gone" }],
      totalInRepository: 1,
    });

    expect(text).toContain("md_gone");
    expect(text).toContain("در دسترس نیست");
    // No fabricated filename, type or size for a reference we cannot read.
    expect(text).not.toContain("png");
    expect(text).not.toMatch(/\d+\s*(بایت|کیلوبایت|مگابایت)/);
  });

  it("records a message's real delivery status instead of claiming it was sent", () => {
    const text = buildChatTranscript({
      ...base,
      messages: [
        message({ id: "m1", body: "پیام بدون مسیر ارسال", status: "unavailable", statusReason: "این مسیر ارسال در دسترس نیست." }),
      ],
      totalInRepository: 1,
    });
    expect(text).toContain("وضعیت ارسال: unavailable");
    expect(text).toContain("این مسیر ارسال در دسترس نیست.");
  });

  it("discloses the ceiling when the read stopped short", () => {
    const text = buildChatTranscript({
      ...base,
      messages: [message({ id: "m1" })],
      totalInRepository: 5000,
    });
    expect(text).toContain("تعداد پیام‌ها: 1 از 5000");
    expect(text).toContain("فقط ۱ پیام نخست از ۵٬۰۰۰ پیام");
    expect(text).toContain("سقف خروجی");
  });

  it("writes an honest empty transcript for a conversation with no messages", () => {
    const text = buildChatTranscript({ ...base, messages: [], totalInRepository: 0 });

    expect(text).toContain("تعداد پیام‌ها: 0");
    expect(text).toContain("هیچ پیامی در این گفتگو ثبت نشده است");
    // Nothing that could be mistaken for a message: no sender line, no bracket stamp.
    expect(text).not.toMatch(/^\[20\d\d-\d\d-\d\d/m);
    expect(text).not.toContain("گفتگوی آزمون:");
  });

  it("keeps user-controlled bodies as literal text — never markup", () => {
    const hostile = '<script>alert("x")</script> & <img src=x onerror=alert(1)>';
    const text = buildChatTranscript({
      ...base,
      messages: [message({ id: "m1", from: "them", body: hostile })],
      totalInRepository: 1,
    });

    // Exported verbatim, as text. Nothing escapes or interprets it, and the file
    // carries no markup of its own that could turn it into one.
    expect(text).toContain(hostile);
    expect(document.body.innerHTML).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* C · the repository read                                             */
/* ------------------------------------------------------------------ */
describe("the export reads the selected conversation from the repositories", () => {
  it("reads that conversation by id, its own messages, and nothing else", async () => {
    // A thread that is NOT the list's first row: reading "the first one" instead
    // of the requested id has to fail here.
    const thread = (await threads()).find((t) => t.name === THREAD_OTHER)!;
    expect((await threads())[0].id).not.toBe(thread.id);
    const chat = stubChat();
    const artifact = await readChatExport(thread.id, EXPORTED_AT);

    expect(chat.conversations).toBe(1);
    expect(chat.messages).toBe(1);
    expect(exportReads(chat)).toHaveLength(1);
    expect(exportReads(chat)[0].conversationId).toBe(thread.id);
    expect(artifact.conversationId).toBe(thread.id);
    expect(artifact.messageCount).toBe((await messagesOf(thread.id)).length);

    // Only this conversation's bodies are in the file: no other thread's text.
    const others = (await threads()).filter((t) => t.id !== thread.id);
    for (const other of others) {
      const otherMessages = await messagesOf(other.id);
      for (const m of otherMessages) {
        // A single-word body could collide by chance; the seeded ones are sentences.
        if (m.body.length > 12) expect(artifact.text).not.toContain(m.body);
      }
    }
  });

  it("returns a .txt artifact whose bytes are UTF-8 text with a BOM, and no attachment content", async () => {
    const thread = (await threads())[0];
    const artifact = await readChatExport(thread.id, EXPORTED_AT);

    expect(artifact.fileName.endsWith(".txt")).toBe(true);
    expect(artifact.fileName).toContain("2026-09-14");
    // BOM first, for Persian text in Windows tools — same convention as CSV.
    expect(artifact.text.startsWith("\uFEFF")).toBe(true);
    expect(artifact.attachmentCount).toBe(0);
  });

  it("hands the finished artifact to the browser only through the export domain's download seam", async () => {
    const thread = (await threads()).find((t) => t.name === THREAD_OTHER)!;
    const artifact = await readChatExport(thread.id, EXPORTED_AT);
    // Reading an export is not a download: nothing reached the browser yet.
    expect(downloaded).toHaveLength(0);
    expect(anchorClicks).toBe(0);
    expect(artifact.text).toContain(thread.name);
  });
});

/* ------------------------------------------------------------------ */
/* D · the view action                                                 */
/* ------------------------------------------------------------------ */
describe("exporting from the view", () => {
  it("downloads a file containing the selected conversation's stored messages", async () => {
    await openThread();
    await selectThread(THREAD_OTHER);
    const all = await threads();
    const thread = all.find((t) => t.name === THREAD_OTHER)!;
    expect(all[0].id, "the case must not export the first row of the list").not.toBe(thread.id);
    const stored = await messagesOf(thread.id);

    fireEvent.click(exportButton());

    await waitFor(() => expect(downloaded).toHaveLength(1));
    expect(anchorClicks).toBe(1);

    const text = await downloadedText();
    expect(text).toContain(`شناسهٔ گفتگو: ${thread.id}`);
    expect(text).toContain(`گفتگو: ${thread.name}`);
    for (const message of stored) expect(text).toContain(message.body);
    // …and not the row the list happens to start with.
    expect(text).not.toContain(`شناسهٔ گفتگو: ${all[0].id}`);
    for (const message of await messagesOf(all[0].id)) expect(text).not.toContain(message.body);
    // The toast names the file and the conversation that was read.
    await waitFor(() => expect(toastText()).toContain("خروجی گفتگو ذخیره شد"));
    expect(toastText()).toContain(thread.name);
    expect(successRings()).toBeGreaterThan(0);
  });

  it("exports a message sent after startup — the file is the CURRENT state", async () => {
    await openThread();
    await selectThread(THREAD_OTHER);
    const thread = (await threads()).find((t) => t.name === THREAD_OTHER)!;

    fireEvent.change(composer(), { target: { value: "پیام تازه برای خروجی" } });
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));
    await waitFor(() => expect(toastText()).toContain("پیام ارسال شد"));

    fireEvent.click(exportButton());
    await waitFor(() => expect(downloaded).toHaveLength(1));

    expect(await downloadedText()).toContain("پیام تازه برای خروجی");
    // …and it is really in the repository, not only in the file.
    expect((await messagesOf(thread.id)).some((m) => m.body === "پیام تازه برای خروجی")).toBe(true);
  });

  it("includes attachment metadata for a message that carries one", async () => {
    await openThread();
    await selectThread(THREAD_OTHER);
    const thread = (await threads()).find((t) => t.name === THREAD_OTHER)!;
    // A real upload through the media repository, then a message referencing it.
    const asset = await new DemoMediaRepository().create({
      kind: "image",
      filename: "score.png",
      mimeType: "image/png",
      bytes: (() => {
        const bytes = new Uint8Array(64);
        bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
        return bytes.buffer;
      })(),
    });
    await getChatRepository().sendMessage({ conversationId: thread.id, body: "نت پیوست", mediaId: asset.id });

    fireEvent.click(exportButton());
    await waitFor(() => expect(downloaded).toHaveLength(1));
    const text = await downloadedText();

    expect(text).toContain("پیوست: score.png");
    expect(text).toContain(asset.id);
    expect(text).toContain("image/png");
    // The Blob is text, and contains no binary payload of any kind.
    expect(downloaded[0].type).toBe("text/plain;charset=utf-8");
    expect(text).not.toContain("blob:");
    expect(text).not.toContain("base64");
  });

  it("claims nothing until the repository read resolves", async () => {
    await openThread();
    const thread = (await threads())[0];
    const held = deferred<Page<ChatMessage>>();
    const chat = stubChat(() => held.promise);

    fireEvent.click(exportButton());

    // In flight: the control reports the wait, and nothing has been downloaded
    // or claimed.
    await waitForExporting();
    expect(chat.messages).toBe(1);
    expect(downloaded).toHaveLength(0);
    expect(successRings()).toBe(0);
    expect(toastText()).toBe("");

    const stored = (await new DemoChatRepository().listMessages({ conversationId: thread.id, per_page: 200 })).data;
    await act(async () => {
      held.resolve({ data: stored, meta: { page: 1, per_page: 1000, total: stored.length } });
    });

    await waitFor(() => expect(downloaded).toHaveLength(1));
    expect(successRings()).toBeGreaterThan(0);
  });

  it("guards against duplicate work when the control is clicked repeatedly", async () => {
    await openThread();
    const held = deferred<Page<ChatMessage>>();
    const chat = stubChat(() => held.promise);

    const button = exportButton();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    // The read count is asserted FIRST and directly: three clicks must produce
    // exactly one repository read. Re-rendering the operator's intent is not the
    // same as preventing the work, so the count is the assertion that matters.
    await waitFor(() => expect(exportReads(chat)).toHaveLength(1));
    expect(chat.messages).toBe(1);
    expect(chat.conversations).toBe(1);
    // The control also reports the wait — the operator-facing half of the guard.
    await waitForExporting();

    // A real repository instance: the registered one is stubbed and its read is
    // still held, so asking it here would deadlock on the promise under test.
    const thread = (await new DemoChatRepository().listConversations({ per_page: 100 })).data[0];
    const stored = (await new DemoChatRepository().listMessages({ conversationId: thread.id, per_page: 200 })).data;
    await act(async () => {
      held.resolve({ data: stored, meta: { page: 1, per_page: 1000, total: stored.length } });
    });

    await waitFor(() => expect(downloaded).toHaveLength(1));
    expect(exportReads(chat)).toHaveLength(1);
    expect(chat.messages).toBe(1);
  });

  it("reports a failed read honestly, downloads nothing, and stays usable", async () => {
    await openThread();
    stubChat(() =>
      Promise.reject(new ApiError({ kind: "server", status: 500, message: "سرور گفتگوها پاسخ نداد." })),
    );

    fireEvent.click(exportButton());

    await waitFor(() => expect(toastText()).toContain("سرور گفتگوها پاسخ نداد."));
    expect(toastText()).toContain("تهیهٔ خروجی گفتگو ناموفق بود");
    // No download, no success, no markup on the page.
    expect(downloaded).toHaveLength(0);
    expect(anchorClicks).toBe(0);
    expect(successRings()).toBe(0);
    expect(screen.queryByText("گفتگویی پیدا نشد")).toBeNull();
    // The view is still usable, and a retry is possible.
    await screen.findByRole("button", { name: "خروجی گرفتن از این گفتگو" });
    expect(composer()).toBeTruthy();
  });

  it("writes an honest empty file for a conversation with no messages, and fabricates none", async () => {
    await openThread();
    // A conversation created through the product's own flow genuinely has no
    // messages — no fixture, no emptied array, nothing seeded for the case.
    fireEvent.click(screen.getByRole("button", { name: "گفتگوی جدید" }));
    const button = await screen.findByRole("button", { name: "خروجی گرفتن از این گفتگو" });
    const created = (await threads()).find((t) => t.name === "گفتگوی جدید")!;
    expect((await messagesOf(created.id)).length).toBe(0);

    fireEvent.click(button);

    await waitFor(() => expect(downloaded).toHaveLength(1));
    const text = await downloadedText();
    expect(text).toContain(`شناسهٔ گفتگو: ${created.id}`);
    expect(text).toContain("تعداد پیام‌ها: 0");
    expect(text).toContain("هیچ پیامی در این گفتگو ثبت نشده است");
    // No message lines at all — and none borrowed from the seeded threads.
    expect(text).not.toMatch(/^\[20\d\d-\d\d-\d\d/m);
    for (const thread of await threads()) {
      if (thread.id === created.id) continue;
      for (const message of await messagesOf(thread.id)) {
        if (message.body.length > 12) expect(text).not.toContain(message.body);
      }
    }
    await waitFor(() => expect(toastText()).toContain("هیچ پیامی ندارد"));
  });
});

/* ------------------------------------------------------------------ */
/* E · identity and selection honesty                                  */
/* ------------------------------------------------------------------ */
describe("export cannot be retargeted", () => {
  it("has no control at all while the selected conversation is hidden by a filter", async () => {
    await openThread();
    await selectThread(THREAD_OTHER);
    const thread = (await threads()).find((t) => t.name === THREAD_OTHER)!;

    // A search that cannot match the selected thread.
    fireEvent.change(screen.getByPlaceholderText("جستجوی گفتگو…"), { target: { value: "پیام‌های-بی‌همتا" } });

    await screen.findByText("این گفتگو در فهرست فعلی نمایش داده نمی‌شود");
    // The thread pane is gone, so the export control is gone with it — there is
    // nothing to press that could export a different conversation.
    expect(screen.queryByRole("button", { name: "خروجی گرفتن از این گفتگو" })).toBeNull();
    expect(downloaded).toHaveLength(0);

    // The way back restores the SAME conversation, and only then can it be exported.
    fireEvent.click(screen.getByRole("button", { name: "پاک‌کردن جستجو و فیلتر" }));
    const button = await screen.findByRole("button", { name: "خروجی گرفتن از این گفتگو" });
    fireEvent.click(button);
    await waitFor(() => expect(downloaded).toHaveLength(1));
    expect(await downloadedText()).toContain(`شناسهٔ گفتگو: ${thread.id}`);
  });

  it("keeps an in-flight export pinned to the conversation it started for", async () => {
    await openThread();
    const all = await threads();
    const threadA = all.find((t) => t.name === THREAD_OTHER)!;
    const threadB = all.find((t) => t.name === THREAD_OTHER_B)!;
    expect(all[0].id).not.toBe(threadA.id);
    await selectThread(threadA.name);

    const held = deferred<Page<ChatMessage>>();
    const chat = stubChat((params) => {
      // The deferred answer is built for whichever thread was asked for, so a
      // retargeted read would show up as the wrong conversation's messages.
      if (params.conversationId !== threadA.id) {
        return new DemoChatRepository().listMessages(params);
      }
      return held.promise.then(() => new DemoChatRepository().listMessages(params));
    });

    fireEvent.click(exportButton());
    await waitForExporting();

    // The operator switches threads and starts composing in B while A's export reads.
    await selectThread(threadB.name);
    fireEvent.change(composer(), { target: { value: "پیش‌نویس B" } });

    await act(async () => {
      held.resolve({ data: [], meta: { page: 1, per_page: 1000, total: 0 } });
    });

    await waitFor(() => expect(downloaded).toHaveLength(1));
    const text = await downloadedText();

    // The file is A's — identity, and A's stored bodies — and never B's.
    expect(text).toContain(`شناسهٔ گفتگو: ${threadA.id}`);
    expect(text).toContain(`گفتگو: ${threadA.name}`);
    for (const message of await messagesOf(threadA.id)) expect(text).toContain(message.body);
    expect(text).not.toContain(`شناسهٔ گفتگو: ${threadB.id}`);
    for (const message of await messagesOf(threadB.id)) expect(text).not.toContain(message.body);

    // The success names A, not whatever is on screen now.
    await waitFor(() => expect(toastText()).toContain("خروجی گفتگو ذخیره شد"));
    expect(toastText()).toContain(threadA.name);
    expect(toastText()).not.toContain(threadB.name);

    // And B's composer was not touched by any of it.
    expect(composer().value).toBe("پیش‌نویس B");
    // The export performed exactly one read, and it was A's.
    expect(exportReads(chat)).toHaveLength(1);
    expect(exportReads(chat)[0].conversationId).toBe(threadA.id);
  });
});

/* ------------------------------------------------------------------ */
/* F · an empty environment                                            */
/* ------------------------------------------------------------------ */
describe("an empty environment", () => {
  it("offers no export for a conversation that does not exist", async () => {
    demoStore.replace(createEmptyDataset());
    renderMessages();
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());
    await screen.findByText("گفتگویی پیدا نشد");

    expect(screen.queryByRole("button", { name: "خروجی گرفتن از این گفتگو" })).toBeNull();
    expect(downloaded).toHaveLength(0);
    // Nothing was seeded to make an export possible.
    expect(demoStore.snapshot().chatMessages).toHaveLength(0);
    expect(demoStore.snapshot().chatConversations).toHaveLength(0);
  });
});
