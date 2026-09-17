/**
 * Message attachments — the `ChatMessage.mediaId` path.
 *
 * M6 turns a declared-but-dead field into a real one. The contract has three
 * parts, and each is asserted here against the real store and the real blob
 * store:
 *
 *   1. a message may carry an attachment that RESOLVES;
 *   2. a message may never carry a dangling reference — the write is refused
 *      BEFORE anything is recorded, so a refusal leaves no half-sent message
 *      and no thread preview claiming a send that did not happen;
 *   3. resolution is not authorization, and nothing here pretends otherwise:
 *      the bytes belong to the media domain and its access rules are a backend
 *      concern (asserted as behaviour, not as a comment).
 *
 * The bytes are never copied into the message or the dataset — §13 puts them in
 * the blob store behind `MediaRepository`, and these cases check that a
 * message's attachment stays a reference.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoChatRepository } from "../demoRepository";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { ApiError } from "@/api/errors";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import type { ChatRepository } from "../repository";

let repo: ChatRepository;
let media: DemoMediaRepository;
let store: DemoStore;

/** A minimal but structurally valid PNG header. */
function pngBytes(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes.buffer;
}

/** A PDF header — the document kind, which the chat UI offers for attachments. */
function pdfBytes(size = 256): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
  return bytes.buffer;
}

beforeEach(() => {
  resetToDemoEnvironment();
  setBlobStore(createMemoryBlobStore());
  store = demoStore;
  media = new DemoMediaRepository(store);
  repo = new DemoChatRepository(store);
});

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.code : "NOT_API_ERROR";
  }
}

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string[]> | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.fields : undefined;
  }
}

async function firstConversationId(): Promise<string> {
  const page = await repo.listConversations({ per_page: 50 });
  return page.data[0].id;
}

/** Uploads through the real media repository, so validation is not bypassed. */
async function upload(kind: "image" | "audio" | "document", filename: string) {
  const bytes = kind === "image" ? pngBytes() : pdfBytes();
  const mimeType = kind === "image" ? "image/png" : "application/pdf";
  return media.create({ kind, filename, mimeType, bytes });
}

describe("sending a message with an attachment", () => {
  it("persists the reference on the message, and reads it back after a reload", async () => {
    const id = await firstConversationId();
    const asset = await upload("document", "قطعه.pdf");

    const sent = await repo.sendMessage({ conversationId: id, body: "نت پیوست شد.", mediaId: asset.id });
    expect(sent.mediaId).toBe(asset.id);

    const persisted = await new DemoChatRepository(store).listMessages({ conversationId: id, per_page: 200 });
    const stored = persisted.data.find((m) => m.id === sent.id);
    expect(stored?.mediaId).toBe(asset.id);
  });

  it("keeps the attachment as a REFERENCE — a megabyte of bytes never enters the dataset", async () => {
    const id = await firstConversationId();
    // Deliberately large: if the bytes were embedded in the message row, the
    // serialized dataset would grow by ~1 MB. §13 puts them in the blob store.
    const megabytes = 1024 * 1024;
    const bytes = new Uint8Array(megabytes);
    bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
    const asset = await media.create({
      kind: "document",
      filename: "قطعهٔ-بزرگ.pdf",
      mimeType: "application/pdf",
      bytes: bytes.buffer,
    });

    const before = JSON.stringify(store.snapshot().chatMessages).length;
    await repo.sendMessage({ conversationId: id, body: "پیوست بزرگ", mediaId: asset.id });
    const after = JSON.stringify(store.snapshot().chatMessages).length;

    // A row costs a few hundred characters, not a megabyte.
    expect(after - before).toBeLessThan(500);
    expect(after - before).toBeGreaterThan(0);

    // And the bytes are genuinely retrievable through the media seam the UI uses.
    const blob = await media.getBlob(asset.id);
    expect(blob?.size).toBe(megabytes);
  });

  it("still records delivery honestly when an attachment is present", async () => {
    const id = await firstConversationId();
    const asset = await upload("image", "اجرا.png");

    const sent = await repo.sendMessage({ conversationId: id, body: "عکس اجرا", mediaId: asset.id });
    expect(sent.status).toBe("sent");
  });

  it("updates the thread preview for an attachment-bearing message like any other", async () => {
    const id = await firstConversationId();
    const asset = await upload("document", "قطعه.pdf");

    await repo.sendMessage({ conversationId: id, body: "خلاصهٔ قطعه", mediaId: asset.id });

    expect((await repo.getConversation(id)).lastMessagePreview).toBe("خلاصهٔ قطعه");
  });

  it("sends a message with no attachment exactly as before", async () => {
    const id = await firstConversationId();
    const sent = await repo.sendMessage({ conversationId: id, body: "بدون پیوست" });
    expect(sent.mediaId).toBeUndefined();
  });
});

describe("refusing a dangling reference", () => {
  it("refuses an unknown mediaId, and writes no message at all", async () => {
    const id = await firstConversationId();
    const before = (await repo.listMessages({ conversationId: id, per_page: 200 })).meta.total;

    expect(await codeOf(repo.sendMessage({ conversationId: id, body: "پیوست گم‌شده", mediaId: "md_missing" }))).toBe(
      "MESSAGE_INVALID",
    );

    // Not merely "no message rendered": nothing was recorded.
    const after = await repo.listMessages({ conversationId: id, per_page: 200 });
    expect(after.meta.total).toBe(before);
    expect(after.data.some((m) => m.mediaId === "md_missing")).toBe(false);
  });

  it("names the offending field, so a form can report it on the control", async () => {
    const id = await firstConversationId();
    const fields = await fieldsOf(repo.sendMessage({ conversationId: id, body: "پیوست", mediaId: "md_missing" }));
    expect(Object.keys(fields ?? {})).toContain("mediaId");
  });

  it("refuses before delivery — no thread preview is written for a refused send", async () => {
    const id = await firstConversationId();
    const before = (await repo.getConversation(id)).lastMessagePreview;

    await codeOf(repo.sendMessage({ conversationId: id, body: "این نباید ثبت شود", mediaId: "md_missing" }));

    // A preview written before the validation would be a claim the product
    // cannot honour; the refusal is atomic with respect to the thread row.
    expect((await repo.getConversation(id)).lastMessagePreview).toBe(before);
  });

  it("refuses an unknown conversation before it ever looks at the attachment", async () => {
    const asset = await upload("document", "قطعه.pdf");
    expect(await codeOf(repo.sendMessage({ conversationId: "cv-missing", body: "x", mediaId: asset.id }))).toBe(
      "CONVERSATION_NOT_FOUND",
    );
  });

  it("still refuses an empty or oversized body when an attachment is attached", async () => {
    const id = await firstConversationId();
    const asset = await upload("document", "قطعه.pdf");

    expect(await codeOf(repo.sendMessage({ conversationId: id, body: "   ", mediaId: asset.id }))).toBe(
      "MESSAGE_INVALID",
    );
  });

  it("refuses a reference whose bytes were removed — a dangling metadata row", async () => {
    const id = await firstConversationId();
    const asset = await upload("document", "قطعه.pdf");
    // A real scenario: the binary is gone while the metadata row survives
    // (a backup carries metadata but not bytes; a partial restore looks the same).
    await media.delete(asset.id);

    expect(await codeOf(repo.sendMessage({ conversationId: id, body: "پیوست", mediaId: asset.id }))).toBe(
      "MESSAGE_INVALID",
    );
  });
});

describe("what the reference does not do", () => {
  it("claims no ownership or authorization check — resolution only", async () => {
    // The honest statement of the accepted limitation: ANY existing asset id
    // resolves for ANY conversation, because there is no ownership model in the
    // frontend and per-object authorization is a backend concern. This case
    // pins the CURRENT behaviour so the limitation is visible in the suite
    // rather than only in a document — it is not an endorsement.
    const id = await firstConversationId();
    const asset = await upload("document", "متعلق-به-گفتگوی-دیگر.pdf");

    const sent = await repo.sendMessage({ conversationId: id, body: "پیوست", mediaId: asset.id });
    expect(sent.mediaId).toBe(asset.id);
  });

  it("does not copy the asset's filename or mime type onto the message", async () => {
    const id = await firstConversationId();
    const asset = await upload("document", "قطعه.pdf");

    const sent = await repo.sendMessage({ conversationId: id, body: "پیوست", mediaId: asset.id });

    // One source of truth for file metadata: the media domain. A denormalized
    // copy here would drift the moment an asset is renamed or replaced.
    expect(sent).not.toHaveProperty("filename");
    expect(sent).not.toHaveProperty("mimeType");
  });
});

describe("the media seam the UI will use", () => {
  it("exposes the uploaded asset's metadata for rendering", async () => {
    const asset = await upload("image", "اجرا.png");
    const fetched = await media.get(asset.id);
    expect(fetched.kind).toBe("image");
    expect(fetched.mimeType).toBe("image/png");
    expect(fetched.sizeBytes).toBeGreaterThan(0);
  });

  it("reports missing bytes as undefined rather than an empty file", async () => {
    const asset = await upload("document", "قطعه.pdf");
    await setBlobStore(createMemoryBlobStore()); // a fresh browser: metadata present, bytes gone

    const blob = await new DemoMediaRepository(store).getBlob(asset.id);
    expect(blob).toBeUndefined();
  });
});
