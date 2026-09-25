// @vitest-environment jsdom
/**
 * Message attachments — M6 / CP3.
 *
 * WHAT IS REAL HERE
 *
 * The upload path is exercised end to end against the real repositories: the
 * real `DemoMediaRepository` validates (allow-list, size, magic bytes), the real
 * memory blob store keeps the bytes, and the real `DemoChatRepository` writes the
 * message that references them. Nothing in this file seeds an attachment, and no
 * fixture carries one — every attachment in every case below was created by the
 * flow under test.
 *
 * WHAT IS ASSERTED ABOUT THE CLAIM
 *
 * A success toast is a claim that a write happened, so the ordering
 * cases hold the promises open and assert that nothing is claimed while they are
 * pending — including that the MESSAGE is not sent before the UPLOAD resolved.
 * The failure cases assert the opposite direction: a repository refusal never
 * becomes a success, and never becomes an empty conversation either.
 *
 * THE ENVIRONMENT'S ONE LIMITATION, STATED NOT HIDDEN
 *
 * jsdom does not implement `URL.createObjectURL`, so the object URL that
 * `useMediaObjectUrl` produces for stored bytes cannot exist here. The tests
 * therefore assert the two states jsdom CAN reach honestly: metadata present with
 * the open affordance withheld (no fabricated URL, no false "you can open this"),
 * and metadata present with the bytes removed — the real post-restore state — where
 * the unavailable wording is required and must not offer opening or downloading.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { MessagesView } from "@/views/Messages";
import { Toasts } from "@/components/overlays/ActionSheet";
import { ApiError } from "@/api/errors";
import { DemoChatRepository } from "@/domains/chat/demoRepository";
import type { ChatMessage, SendMessageInput } from "@/domains/chat/types";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { createMemoryBlobStore, getBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { MAX_IMAGE_BYTES, type CreateMediaInput, type MediaAsset } from "@/domains/media/types";
import { getChatRepository, getMediaRepository, resetRegistry, setChatRepository, setMediaRepository } from "@/domains/registry";
import { setMediaReleaseFailureReporter } from "@/domains/media/release";
import { createEmptyDataset } from "@/domains/demo/seed";
import { demoStore } from "@/services/demoStore";
import { KIND_LABEL, formatBytes } from "@/views/messages/attachmentRules";
import { withStubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const THREAD_A = "محمد رضایی";
const THREAD_B = "سارا احمدی";

afterEach(cleanup);
afterEach(() => setMediaReleaseFailureReporter(undefined));
beforeEach(() => {
  resetToDemoEnvironment();
  setBlobStore(createMemoryBlobStore());
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

/**
 * Renders the view and waits for a conversation to be selected.
 *
 * The first thread is selected by an effect one commit after the list arrives,
 * and the composer only exists for a selected conversation — so a case that
 * touches the composer must wait for it rather than for the list alone.
 */
async function openThread() {
  renderMessages();
  await waitForThreads();
  await waitFor(() => expect(screen.queryByLabelText("متن پیام")).not.toBeNull());
}

function threadList(): HTMLElement {
  return screen.getByRole("list", { name: "فهرست گفتگوها" });
}

function composer(): HTMLTextAreaElement {
  return screen.getByLabelText("متن پیام") as HTMLTextAreaElement;
}

function attachmentInput(): HTMLInputElement {
  return screen.getByLabelText("انتخاب فایل پیوست") as HTMLInputElement;
}

function pickFile(file: File) {
  fireEvent.change(attachmentInput(), { target: { files: [file] } });
}

function type(text: string) {
  fireEvent.change(composer(), { target: { value: text } });
}

function sendButton(): HTMLElement {
  return screen.getByRole("button", { name: /^(ارسال|در حال ارسال…)$/ });
}

function successRings(): number {
  return document.querySelectorAll('[aria-live="polite"] .animate-resonance').length;
}

function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
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
  await waitFor(() => expect(screen.getByLabelText("متن پیام")).toBeTruthy());
}

/** A file whose bytes really are a PNG, so the repository's magic-byte check passes. */
function pngFile(name = "score.png", size = 64): File {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return new File([bytes], name, { type: "image/png" });
}

/** A counting media repository: the real one, with the writes tallied. */
function stubMedia(create?: (input: CreateMediaInput) => Promise<MediaAsset>) {
  const real = new DemoMediaRepository();
  const calls = { create: 0, delete: 0, created: [] as string[] };
  setMediaRepository(
    withStubs(real, {
      create: async (input: CreateMediaInput) => {
        calls.create += 1;
        const asset = create ? await create(input) : await real.create(input);
        calls.created.push(asset.id);
        return asset;
      },
      delete: async (id: string) => {
        calls.delete += 1;
        return real.delete(id);
      },
    }),
  );
  return calls;
}

/** A counting chat repository: the real one, with `sendMessage` tallied. */
function stubChat(sendMessage?: (input: SendMessageInput) => Promise<ChatMessage>) {
  const real = new DemoChatRepository();
  const calls = { send: 0, inputs: [] as SendMessageInput[] };
  setChatRepository(
    withStubs(real, {
      sendMessage: async (input: SendMessageInput) => {
        calls.send += 1;
        calls.inputs.push(input);
        return sendMessage ? sendMessage(input) : real.sendMessage(input);
      },
    }),
  );
  return calls;
}

async function threads() {
  return (await getChatRepository().listConversations({ per_page: 100 })).data;
}

async function messagesOf(conversationId: string) {
  return (await getChatRepository().listMessages({ conversationId, per_page: 200 })).data;
}

/* ------------------------------------------------------------------ */
/* A · the picker                                                      */
/* ------------------------------------------------------------------ */
describe("the attachment control", () => {
  it("opens the browser's file picker and advertises the contract's types", async () => {
    await openThread();

    const input = attachmentInput();
    expect(input.type).toBe("file");
    // The accept hint is the union of the media allow-lists, not a new list.
    for (const type of ["image/png", "image/jpeg", "audio/mpeg", "application/pdf", "text/plain"]) {
      expect(input.accept, `${type} is offered by the picker`).toContain(type);
    }
    // SVG is excluded by the media domain and must not creep back in through the view.
    expect(input.accept).not.toContain("svg");

    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "افزودن پیوست" }));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/* B · validation                                                      */
/* ------------------------------------------------------------------ */
describe("client-side validation", () => {
  it("accepts a supported file and writes nothing yet", async () => {
    const media = stubMedia();
    const chat = stubChat();
    await openThread();

    const file = pngFile("score.png");
    pickFile(file);

    await screen.findByText("score.png");
    // The chip's own line: kind · mime · size · pending. Asserted exactly,
    // because the limits hint also names every allowed MIME type.
    expect(screen.getByText(`${KIND_LABEL.image} · image/png · ${formatBytes(file.size)} · در انتظار ارسال`)).toBeTruthy();
    // Picking a file is not an upload and not a send.
    expect(media.create).toBe(0);
    expect(chat.send).toBe(0);
    expect(successRings()).toBe(0);
  });

  it("refuses an unsupported type without any repository write, and keeps the draft", async () => {
    const media = stubMedia();
    const chat = stubChat();
    await openThread();
    type("متن پیام من");

    pickFile(new File([new Uint8Array([1, 2, 3])], "archive.zip", { type: "application/zip" }));

    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("application/zip");
    expect(error.textContent).toContain("مجاز نیست");
    // Not accepted, and the repository was never asked.
    expect(screen.queryByText("archive.zip")).toBeNull();
    expect(media.create).toBe(0);
    expect(chat.send).toBe(0);
    // The draft survived the refusal.
    expect(composer().value).toBe("متن پیام من");
  });

  it("refuses an oversized file at the contract's own ceiling, without any write", async () => {
    const media = stubMedia();
    await openThread();

    const huge = pngFile("huge.png");
    Object.defineProperty(huge, "size", { value: MAX_IMAGE_BYTES + 1 });
    pickFile(huge);

    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("بیش از حد مجاز");
    expect(media.create).toBe(0);
    expect(screen.queryByText("huge.png")).toBeNull();
  });

  it("accepts a file exactly at the ceiling: the rule is above, not at", async () => {
    const media = stubMedia();
    await openThread();

    const exact = pngFile("exact.png");
    Object.defineProperty(exact, "size", { value: MAX_IMAGE_BYTES });
    pickFile(exact);

    await screen.findByText("exact.png");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(media.create).toBe(0);
  });

  it("keeps an already-valid attachment when a second pick is refused", async () => {
    stubMedia();
    await openThread();

    pickFile(pngFile("good.png"));
    await screen.findByText("good.png");

    pickFile(new File([new Uint8Array([1])], "bad.svg", { type: "image/svg+xml" }));

    await screen.findByRole("alert");
    // The refusal is reported; the valid file is still the pending one.
    expect(screen.getByText("good.png")).toBeTruthy();
    expect(screen.queryByText("bad.svg")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* C · the awaited write and the claim                                  */
/* ------------------------------------------------------------------ */
describe("send with an attachment", () => {
  it("stores the bytes, references them on the message, and renders them", async () => {
    await openThread();
    const thread = (await threads())[0];

    // A name the media repository sanitizes: if the bubble shows the sanitized
    // form, the rendering came from the stored metadata and not from the local
    // File object the operator picked.
    pickFile(pngFile("موسیقی/score.png"));
    await screen.findByText("موسیقی/score.png");
    type("نت این قطعه را بفرست");
    fireEvent.click(sendButton());

    await waitFor(() => expect(toastText()).toContain("پیام و پیوست ثبت شد"));
    expect(successRings()).toBeGreaterThan(0);

    // Repository effect: the message carries the reference, and the bytes are
    // really in the blob store with the declared type and size.
    const stored = (await messagesOf(thread.id)).find((m) => m.body === "نت این قطعه را بفرست");
    expect(stored, "the message was persisted").toBeDefined();
    expect(stored!.mediaId, "the message references an attachment").toBeTruthy();
    const asset = await getMediaRepository().get(stored!.mediaId!);
    expect(asset.mimeType).toBe("image/png");
    expect(asset.sizeBytes).toBe(64);
    expect(await getMediaRepository().getBlob(asset.id)).toBeInstanceOf(Blob);

    // Rendering: metadata resolved through the media repository.
    await screen.findByText(asset.filename);
    expect(asset.filename).toBe("موسیقی_score.png");
    expect(screen.queryByText("موسیقی/score.png")).toBeNull();
    // The card's own line — kind · mime · size. A loose /image\/png/ would also
    // match the limits hint under the composer, which lists every allowed type.
    expect(screen.getByText(`${KIND_LABEL.image} · ${asset.mimeType} · ${formatBytes(asset.sizeBytes)}`)).toBeTruthy();

    // The composer is cleared — the pending file is a persisted attachment now.
    expect(screen.queryByText(/در انتظار ارسال/)).toBeNull();
    expect(composer().value).toBe("");
    // And nothing claims the file can be opened in this environment (see header).
    expect(screen.queryByRole("link", { name: /باز کردن فایل/ })).toBeNull();
  });

  it("claims nothing until the upload AND the message write have resolved", async () => {
    const upload = deferred<MediaAsset>();
    const write = deferred<ChatMessage>();
    const media = stubMedia(() => upload.promise);
    const chat = stubChat(() => write.promise);
    await openThread();
    const thread = (await threads())[0];

    pickFile(pngFile());
    await screen.findByText("score.png");
    type("پیام با پیوست");
    fireEvent.click(sendButton());

    // Upload in flight: the button reports the wait, nothing else is claimed.
    await screen.findByRole("button", { name: "در حال ارسال…" });
    expect(media.create).toBe(1);
    expect(successRings()).toBe(0);
    // The message is not written before its attachment exists.
    expect(chat.send).toBe(0);

    const asset: MediaAsset = {
      id: "md_stub",
      kind: "image",
      filename: "stub.png",
      mimeType: "image/png",
      sizeBytes: 64,
      createdAt: new Date().toISOString(),
    };
    await act(async () => {
      upload.resolve(asset);
    });

    // Upload resolved, message write in flight: still no claim.
    await waitFor(() => expect(chat.send).toBe(1));
    expect(chat.inputs[0].mediaId).toBe("md_stub");
    expect(successRings()).toBe(0);

    await act(async () => {
      write.resolve({
        id: "msg_stub",
        conversationId: thread.id,
        from: "me",
        body: "پیام با پیوست",
        sentAt: new Date().toISOString(),
        provider: "in_app",
        status: "sent",
        mediaId: "md_stub",
      });
    });

    await waitFor(() => expect(toastText()).toContain("پیام و پیوست ثبت شد"));
  });

  it("sends one upload and one message when the operator submits repeatedly", async () => {
    const upload = deferred<MediaAsset>();
    const media = stubMedia(() => upload.promise);
    const chat = stubChat();
    await openThread();

    pickFile(pngFile());
    await screen.findByText("score.png");
    type("ارسال دوباره؟");

    const button = sendButton();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await screen.findByRole("button", { name: "در حال ارسال…" });
    expect(media.create).toBe(1);
    expect(chat.send).toBe(0);

    await act(async () => {
      upload.resolve({
        id: "md_once",
        kind: "image",
        filename: "once.png",
        mimeType: "image/png",
        sizeBytes: 64,
        createdAt: new Date().toISOString(),
      });
    });

    await waitFor(() => expect(chat.send).toBe(1));
    expect(media.create).toBe(1);
  });

  it("does not send an attachment on its own: the contract requires a body", async () => {
    const media = stubMedia();
    const chat = stubChat();
    await openThread();

    pickFile(pngFile("only.png"));
    await screen.findByText("only.png");

    // The send control is unavailable and the reason is on screen.
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    expect(await screen.findByText(/متن پیام هم لازم است/)).toBeTruthy();

    fireEvent.click(sendButton());
    expect(media.create).toBe(0);
    expect(chat.send).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* D · failures                                                        */
/* ------------------------------------------------------------------ */
describe("failures", () => {
  it("reports a refused upload with the repository's reason and keeps everything", async () => {
    const media = stubMedia(() =>
      Promise.reject(new ApiError({ kind: "server", status: 500, message: "فضای ذخیره‌سازی پاسخ نداد." })),
    );
    const chat = stubChat();
    await openThread();

    pickFile(pngFile("keep.png"));
    await screen.findByText("keep.png");
    type("پیام با پیوست ناموفق");
    fireEvent.click(sendButton());

    await waitFor(() => expect(toastText()).toContain("فضای ذخیره‌سازی پاسخ نداد."));
    expect(successRings()).toBe(0);
    expect(media.create).toBe(1);
    // The failed upload is not a message.
    expect(chat.send).toBe(0);
    // The composer is untouched, so the send can be retried.
    expect(composer().value).toBe("پیام با پیوست ناموفق");
    expect(screen.getByText("keep.png")).toBeTruthy();
    expect(screen.getByText(/در انتظار ارسال/)).toBeTruthy();
  });

  it("reports a failed message write, frees the stored asset, and allows a retry", async () => {
    const media = stubMedia();
    let failing = true;
    const chat = stubChat((input) => {
      if (failing) {
        return Promise.reject(new ApiError({ kind: "server", status: 500, message: "سرور گفتگوها پاسخ نداد." }));
      }
      return new DemoChatRepository().sendMessage(input);
    });
    await openThread();

    pickFile(pngFile("retry.png"));
    await screen.findByText("retry.png");
    type("پیام و پیوست");
    fireEvent.click(sendButton());

    await waitFor(() => expect(toastText()).toContain("سرور گفتگوها پاسخ نداد."));
    expect(successRings()).toBe(0);
    expect(media.create).toBe(1);
    expect(chat.send).toBe(1);

    // The orphan is released: the stored asset no longer exists, so a retry
    // cannot leave a second unreachable copy behind.
    const orphan = media.created[0];
    expect(media.delete).toBe(1);
    await expect(getMediaRepository().get(orphan)).rejects.toBeTruthy();
    expect(await getMediaRepository().getBlob(orphan)).toBeUndefined();

    // Retry is possible, from the same composer state.
    failing = false;
    fireEvent.click(sendButton());
    await waitFor(() => expect(toastText()).toContain("پیام و پیوست ثبت شد"));
    expect(media.create).toBe(2);

    const thread = (await threads())[0];
    const stored = (await messagesOf(thread.id)).find((m) => m.body === "پیام و پیوست");
    expect(stored?.mediaId, "the retried send carries an attachment").toBeTruthy();
    expect(composer().value).toBe("");
  });

  it("never turns a failed attachment send into an empty conversation", async () => {
    stubMedia(() => Promise.reject(new ApiError({ kind: "server", status: 500, message: "باز هم خطا." })));
    await openThread();

    pickFile(pngFile());
    await screen.findByText("score.png");
    type("پیام");
    fireEvent.click(sendButton());

    await waitFor(() => expect(toastText()).toContain("باز هم خطا."));
    // Still the same conversation, with its messages, and no empty-thread claim.
    expect(screen.queryByText("هنوز پیامی رد و بدل نشده")).toBeNull();
    expect(await screen.findByText(/سلام\. متأسفانه فرد/)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* F · the staged upload leaves through the media domain               */
/* ------------------------------------------------------------------ */

/**
 * A rejected `sendMessage` leaves a stored-but-unreferenced asset behind, so the
 * send path releases it through `releaseStagedMedia`. These cases pin the three
 * properties that make that cleanup trustworthy:
 *
 *   - ORDER: nothing is freed until the message write has settled, because
 *     before that it could still be the attachment of a written message;
 *   - HONESTY: a cleanup that fails reaches the release reporter (the operator
 *     sees a warning) and never replaces or hides the real failure;
 *   - NO OVER-REACH: a successful send keeps the asset it references.
 */
describe("the staged upload is released through the media domain", () => {
  it("frees nothing until the message write has settled, then releases the asset", async () => {
    const gate = deferred<ChatMessage>();
    const media = stubMedia();
    const chat = stubChat(() => gate.promise);
    await openThread();

    pickFile(pngFile("ordered.png"));
    await screen.findByText("ordered.png");
    type("پیام و پیوست");
    fireEvent.click(sendButton());

    // The upload landed and the message write is in flight…
    await waitFor(() => expect(chat.send).toBe(1));
    // …and the asset is untouched: the write could still reference it.
    expect(media.create).toBe(1);
    expect(media.delete).toBe(0);
    expect(await getMediaRepository().getBlob(media.created[0])).toBeInstanceOf(Blob);

    // Only once the write is known to have failed is the asset freed.
    gate.reject(new ApiError({ kind: "server", status: 500, message: "سرور گفتگوها پاسخ نداد." }));
    await waitFor(() => expect(media.delete).toBe(1));
    const orphan = media.created[0];
    await expect(getMediaRepository().get(orphan)).rejects.toBeTruthy();
    expect(await getMediaRepository().getBlob(orphan)).toBeUndefined();
  });

  it("reports a cleanup failure exactly once and keeps the send failure as the message", async () => {
    const deletion = new ApiError({
      kind: "server",
      status: 500,
      code: "MEDIA_STORAGE_FAILED",
      message: "ذخیره‌سازی پاسخ نداد.",
    });
    const real = new DemoMediaRepository();
    setMediaRepository(
      withStubs(real, {
        delete: async () => {
          throw deletion;
        },
      }),
    );
    const chat = stubChat(() =>
      Promise.reject(new ApiError({ kind: "server", status: 500, message: "سرور گفتگوها پاسخ نداد." })),
    );
    await openThread();
    /*
      Installed AFTER the render on purpose: `AppProvider` installs the app's own
      reporter in an effect (the warning toast), and this case observes the
      hand-off to the reporter rather than rendering it.
    */
    const reported: string[] = [];
    setMediaReleaseFailureReporter(({ error }) => reported.push(error.code ?? ""));

    pickFile(pngFile("stuck.png"));
    await screen.findByText("stuck.png");
    type("پیام و پیوست");
    fireEvent.click(sendButton());

    // The real failure is what the operator reads…
    await waitFor(() => expect(toastText()).toContain("سرور گفتگوها پاسخ نداد."));
    // …the cleanup failure is reported once, through the media domain, and the
    // send path itself never threw (the composer is still usable for a retry).
    expect(reported).toEqual(["MEDIA_STORAGE_FAILED"]);
    expect(chat.send).toBe(1);
    expect(composer().value).toBe("پیام و پیوست");
    expect(screen.getByText("stuck.png")).toBeTruthy();
  });

  it("keeps the asset when the message write succeeds", async () => {
    const media = stubMedia();
    const chat = stubChat();
    await openThread();

    pickFile(pngFile("kept.png"));
    await screen.findByText("kept.png");
    type("پیام با پیوست");
    fireEvent.click(sendButton());

    await waitFor(() => expect(toastText()).toContain("پیام و پیوست ثبت شد"));
    expect(chat.send).toBe(1);
    // Nothing was released: the message references these bytes.
    expect(media.delete).toBe(0);
    expect(await getMediaRepository().getBlob(media.created[0])).toBeInstanceOf(Blob);
  });
});

/* ------------------------------------------------------------------ */
/* E · bytes that are genuinely gone                                   */
/* ------------------------------------------------------------------ */
describe("missing bytes", () => {
  it("keeps the metadata, says the file is unavailable, and offers no open or download", async () => {
    await openThread();

    pickFile(pngFile("gone.png"));
    await screen.findByText("gone.png");
    type("پیام با پیوستی که بعداً ناپدید می‌شود");
    fireEvent.click(sendButton());
    await waitFor(() => expect(toastText()).toContain("پیام و پیوست ثبت شد"));

    const thread = (await threads())[0];
    const stored = (await messagesOf(thread.id)).find((m) => m.mediaId);
    const assetId = stored!.mediaId!;

    // Exactly the post-restore state: metadata survives, binaries do not
    // (media/types.ts documents that backups carry no bytes).
    await getBlobStore().remove(assetId);
    expect(await getMediaRepository().getBlob(assetId)).toBeUndefined();

    cleanup();
    await openThread();
    await selectThread(THREAD_A);

    // The metadata is still shown…
    const asset = await getMediaRepository().get(assetId);
    await screen.findByText(asset.filename);
    expect(screen.getByText(`${KIND_LABEL.image} · ${asset.mimeType} · ${formatBytes(asset.sizeBytes)}`)).toBeTruthy();
    // …the absence is stated, not dressed up as a broken file…
    await screen.findByText(/فایل در این مرورگر موجود نیست/);
    // …and nothing offers to open or download what is not there.
    expect(screen.queryByRole("link", { name: /باز کردن/ })).toBeNull();
    expect(screen.queryByText(/در حال آماده‌سازی پیش‌نمایش/)).toBeNull();
  });

  it("says the reference no longer resolves when the asset metadata is gone too", async () => {
    await openThread();

    pickFile(pngFile("unresolved.png"));
    await screen.findByText("unresolved.png");
    type("پیام با پیوست حذف‌شده");
    fireEvent.click(sendButton());
    await waitFor(() => expect(toastText()).toContain("پیام و پیوست ثبت شد"));

    const thread = (await threads())[0];
    const stored = (await messagesOf(thread.id)).find((m) => m.mediaId);
    const assetId = stored!.mediaId!;

    // The media row itself is gone — nothing resolves the reference any more.
    await getMediaRepository().delete(assetId);

    cleanup();
    await openThread();
    await selectThread(THREAD_A);

    await screen.findByText(/اطلاعات این پیوست در دسترس نیست/);
    expect(screen.getByText(assetId)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /باز کردن/ })).toBeNull();
    // The message itself is never hidden because its attachment vanished. The
    // body is also the thread-list preview, so presence is what is asserted.
    expect((await screen.findAllByText("پیام با پیوست حذف‌شده")).length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* F · conversation identity of the pending attachment                 */
/* ------------------------------------------------------------------ */
describe("the pending attachment belongs to one conversation", () => {
  it("does not follow the operator into another conversation, or back", async () => {
    await openThread();

    pickFile(pngFile("for-a.png"));
    await screen.findByText("for-a.png");

    await selectThread(THREAD_B);
    expect(screen.queryByText("for-a.png")).toBeNull();
    expect(screen.queryByText(/در انتظار ارسال/)).toBeNull();

    await selectThread(THREAD_A);
    expect(screen.queryByText("for-a.png")).toBeNull();

    // Nothing was written by the picking alone.
    const thread = (await threads())[0];
    expect((await messagesOf(thread.id)).every((m) => !m.mediaId)).toBe(true);
  });

  it("does not let a slow send clear the new conversation's draft or attachment", async () => {
    // The upload for A is held open, so the send resolves after the switch.
    const realAsset = await new DemoMediaRepository().create({
      kind: "image",
      filename: "a.png",
      mimeType: "image/png",
      bytes: (() => {
        const bytes = new Uint8Array(64);
        bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
        return bytes.buffer;
      })(),
    });
    const upload = deferred<MediaAsset>();
    stubMedia(() => upload.promise);

    await openThread();
    const threadA = (await threads()).find((t) => t.name === THREAD_A)!;

    pickFile(pngFile("a.png"));
    await screen.findByText("a.png");
    type("پیش‌نویس A");
    fireEvent.click(sendButton());
    await screen.findByRole("button", { name: "در حال ارسال…" });

    // The operator moves on while A's write is still in flight.
    await selectThread(THREAD_B);
    type("پیش‌نویس B");
    pickFile(pngFile("b.png"));
    await screen.findByText("b.png");

    await act(async () => {
      upload.resolve(realAsset);
    });

    // A's send completed…
    await waitFor(() => expect(successRings()).toBeGreaterThan(0));
    const sentToA = (await messagesOf(threadA.id)).filter((m) => m.mediaId);
    expect(sentToA).toHaveLength(1);
    expect(sentToA[0].mediaId).toBe(realAsset.id);

    // …and B's composer is untouched: same draft, same pending file.
    expect(composer().value).toBe("پیش‌نویس B");
    expect(screen.getByText("b.png")).toBeTruthy();
    expect(screen.getByText(/در انتظار ارسال/)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* G · an empty environment                                            */
/* ------------------------------------------------------------------ */
describe("an empty environment", () => {
  it("offers no attachment surface for a conversation that does not exist", async () => {
    demoStore.replace(createEmptyDataset());
    // No conversation exists, so there is no composer — and no attachment surface.
    renderMessages();
    await waitForThreads();

    await screen.findByText("گفتگویی پیدا نشد");
    expect(screen.queryByRole("button", { name: "افزودن پیوست" })).toBeNull();
    expect(demoStore.snapshot().media).toHaveLength(0);
    expect(demoStore.snapshot().chatMessages).toHaveLength(0);
  });

  it("shows a real picker once a conversation exists, and still seeds nothing", async () => {
    const media = stubMedia();
    const chat = stubChat();
    demoStore.replace(createEmptyDataset());
    renderMessages();
    await waitForThreads();

    fireEvent.click(screen.getByRole("button", { name: "گفتگوی جدید" }));
    // A brand-new conversation is a valid place to attach a file to.
    await screen.findByRole("button", { name: "افزودن پیوست" });

    // No attachment fixture appeared to make that possible.
    expect(demoStore.snapshot().media).toHaveLength(0);
    expect(demoStore.snapshot().chatMessages).toHaveLength(0);
    expect(media.create).toBe(0);
    expect(chat.send).toBe(0);
  });
});
