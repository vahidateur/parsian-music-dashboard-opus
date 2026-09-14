/**
 * Conversation export — one transcript, read from the repositories at call time.
 *
 * WHY THERE IS NO NEW DOMAIN VERB
 *
 * The export was checked against the existing contract before anything was
 * built. `ChatRepository` exposes `getConversation(id)` and
 * `listMessages({ conversationId, page, per_page })`, and those two reads are
 * everything a single-conversation transcript needs: the thread by its stable
 * id, and its messages as a page (with `meta.total`, so a ceiling can be
 * disclosed rather than hidden). A second verb would have duplicated reads the
 * domain already serves.
 *
 * The export *service* (`@/domains/export/exportService`) is a table pipeline —
 * `ExportTable { headers, rows }` through CSV or XLSX — and a transcript is not
 * a table: a message body is multi-line prose, and a sender line is not a
 * column. What IS reused from it is the part that fits: `downloadBlob`, the one
 * sanctioned place a file is handed to the browser, and `safeFilename`. Nothing
 * else is invented — no CSV/XLSX layer for chat, no generalized framework.
 *
 * TWO HALVES, SO THE CONTENT IS PROVABLE WITHOUT A BROWSER
 *
 * `buildChatTranscript` is a pure function of data that was already read, and
 * `readChatExport` is the repository read plus that serialization. Nothing in
 * either touches the DOM. `saveChatExport` is the only part that downloads, and
 * it is the only caller of `downloadBlob` here — which is what makes "the
 * artifact is verified before the download" structural instead of a convention.
 *
 * WHAT THE TRANSCRIPT CLAIMS
 *
 * Only what the contract holds: the thread's name/topic/id, each message's
 * `sentAt`, direction and body, and the attachment *metadata* behind a
 * `mediaId`. The chat contract carries `from: "me" | "them"` — a direction, not
 * a person — so the counterpart's display name is the conversation's own and
 * the operator side is labelled as such; the legend says so instead of inventing
 * a sender. ATTACHMENT BYTES ARE NOT IN THE FILE and the header says that
 * plainly: the media domain keeps binaries in the browser's blob store, the
 * export never reads them, and no wording here suggests otherwise. Ownership and
 * access control remain server-side concerns, exactly as CP3 established.
 *
 * WHAT IS NOT LOGGED
 *
 * Nothing. No message body, no attachment content and no exception detail is
 * written to the console or to analytics anywhere in this file — a transcript is
 * user correspondence, and the only place it belongs is the file the operator
 * asked for.
 */
import { getChatRepository, getMediaRepository } from "@/domains/registry";
import { downloadBlob } from "@/domains/export/exportService";
import type { ChatConversation, ChatMessage } from "@/domains/chat/types";
import type { MediaAsset } from "@/domains/media/types";
import { safeFilename } from "@/domains/import/spreadsheet";
import { faNum } from "@/lib/format";
import { KIND_LABEL, formatBytes } from "./attachmentRules";

/**
 * How many messages one export reads.
 *
 * The demo store has no server-side paging, but the contract does — so the
 * ceiling is passed explicitly and any remainder is DISCLOSED in the file and in
 * the result, never silently dropped (I16's rule: a page size that is not stated
 * is how a truncated read gets reported as complete).
 */
export const EXPORT_MESSAGE_CEILING = 1000;

/** The label for the operator's own side, for the same reason the chat types give: `me` is a direction. */
const SENDER_SELF = "مدیر";
const SENDER_LEGEND = "راهنما: «مدیر» یعنی پیام از این دستگاه فرستاده شده است؛ «مقابل» نام همان گفتگوست.";
const NO_MESSAGES = "— هیچ پیامی در این گفتگو ثبت نشده است —";

/** Attachment metadata as the transcript shows it — never the bytes. */
export interface ChatExportAttachment {
  mediaId: string;
  /** Absent when the media metadata no longer resolves. */
  asset?: MediaAsset;
}

export interface ChatExportInput {
  conversation: ChatConversation;
  messages: ChatMessage[];
  attachments: ChatExportAttachment[];
  /** Injected, never read from the clock here — that is what makes the output testable. */
  exportedAt: Date;
  /** `meta.total` from the message read, so a ceiling can be disclosed. */
  totalInRepository: number;
}

export interface ChatExportArtifact {
  conversationId: string;
  conversationName: string;
  /** The transcript itself: plain text, UTF-8, BOM-prefixed. */
  text: string;
  /** Already sanitized, and the exact name `downloadBlob` will use. */
  fileName: string;
  /** Messages actually written to the transcript. */
  messageCount: number;
  totalInRepository: number;
  /** True when the read hit `EXPORT_MESSAGE_CEILING` and messages remain unread. */
  truncated: boolean;
  attachmentCount: number;
  /** Attachments whose metadata no longer resolves — stated, not hidden. */
  unresolvedAttachments: number;
}

/**
 * UTF-8 BOM, for the same reason `toCsv` carries one: Persian text opened in
 * Windows tools without it renders as mojibake. Every consumer of a `.txt`
 * here (Notepad, VS Code, Word, browsers) tolerates it.
 */
const BOM = "\uFEFF";

/** `2026-09-14T10:47:00.000Z` → `2026-09-14 10:47`. ISO, no locale, no invented format. */
function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 16).replace("T", " ");
}

/** One attachment line, or the honest reason there is no metadata to show. */
function attachmentLine(entry: ChatExportAttachment): string {
  if (!entry.asset) {
    return `پیوست: شناسهٔ ${entry.mediaId} — اطلاعات این پیوست در دسترس نیست (فقط ارجاع ثبت شده است).`;
  }
  const { filename, mimeType, sizeBytes, kind } = entry.asset;
  return `پیوست: ${filename} (${KIND_LABEL[kind]} · ${mimeType} · ${formatBytes(sizeBytes)} · شناسه: ${entry.mediaId})`;
}

/**
 * The transcript. Pure: same input, same bytes, no clock and no DOM.
 */
export function buildChatTranscript(input: ChatExportInput): string {
  const { conversation, messages, attachments, exportedAt, totalInRepository } = input;
  const byId = new Map(attachments.map((entry) => [entry.mediaId, entry]));
  const truncated = totalInRepository > messages.length;

  const lines: string[] = [
    `گفتگو: ${conversation.name}`,
    `موضوع: ${conversation.topic}`,
    `شناسهٔ گفتگو: ${conversation.id}`,
    `خروجی‌گیری (ISO): ${exportedAt.toISOString().slice(0, 16).replace("T", " ")}`,
    `تعداد پیام‌ها: ${messages.length}${truncated ? ` از ${totalInRepository}` : ""}`,
    conversation.archived ? "وضعیت گفتگو: بایگانی‌شده" : "وضعیت گفتگو: فعال",
    "",
    "این فایل متن است. پیوست‌ها فقط با اطلاعاتشان (نام، نوع، حجم، شناسه) آمده‌اند؛ خودِ فایل پیوست در خروجی نیست و",
    "فایل‌های پیوست روی سرور نگهداری نمی‌شوند.",
    SENDER_LEGEND,
    "",
    "======================================================================",
    "",
  ];

  if (messages.length === 0) {
    lines.push(NO_MESSAGES, "");
  }

  for (const message of messages) {
    const sender = message.from === "me" ? SENDER_SELF : conversation.name;
    lines.push(`[${stamp(message.sentAt)}] ${sender}:`);
    lines.push(message.body);
    if (message.status !== "sent") {
      // Delivery state is part of what the repository recorded: claiming a
      // message was delivered when its status says otherwise would be the
      // export's own version of a false success toast.
      lines.push(`وضعیت ارسال: ${message.status}${message.statusReason ? ` — ${message.statusReason}` : ""}`);
    }
    if (message.mediaId) {
      const entry = byId.get(message.mediaId);
      lines.push(entry ? attachmentLine(entry) : `پیوست: شناسهٔ ${message.mediaId} — اطلاعات این پیوست در دسترس نیست.`);
    }
    lines.push("");
  }

  if (truncated) {
    lines.push(
      `توجه: فقط ${faNum(messages.length)} پیام نخست از ${faNum(totalInRepository)} پیام این گفتگو در خروجی آمده است`,
      "(سقف خروجی تک‌گفتگو).",
      "",
    );
  }

  return BOM + lines.join("\n");
}

/**
 * Reads one conversation and its messages through the repositories and returns
 * the finished artifact. Resolves the repositories at CALL time, like every
 * other write and read path in this view, so a swapped repository is the one
 * read from.
 *
 * The conversation is read by its stable id — the id captured when the operator
 * asked for the export — and the messages are read by that same id. Nothing here
 * consults the current list, its order, or a selection: an export cannot be
 * retargeted by the list changing underneath it.
 */
export async function readChatExport(conversationId: string, exportedAt: Date): Promise<ChatExportArtifact> {
  const chat = getChatRepository();
  const conversation = await chat.getConversation(conversationId);
  const page = await chat.listMessages({ conversationId, page: 1, per_page: EXPORT_MESSAGE_CEILING });

  // Attachment metadata, read one id at a time and never fatally: a reference
  // whose metadata is gone is a state the file must be able to describe.
  const media = getMediaRepository();
  const ids = [...new Set(page.data.map((message) => message.mediaId).filter((id): id is string => Boolean(id)))];
  const attachments: ChatExportAttachment[] = await Promise.all(
    ids.map(async (mediaId) => {
      try {
        return { mediaId, asset: await media.get(mediaId) };
      } catch {
        return { mediaId };
      }
    }),
  );

  const text = buildChatTranscript({
    conversation,
    messages: page.data,
    attachments,
    exportedAt,
    totalInRepository: page.meta.total,
  });

  const date = exportedAt.toISOString().slice(0, 10);
  return {
    conversationId: conversation.id,
    conversationName: conversation.name,
    text,
    fileName: safeFilename(`گفتگو-${conversation.name}-${date}`, "گفتگو") + ".txt",
    messageCount: page.data.length,
    totalInRepository: page.meta.total,
    truncated: page.meta.total > page.data.length,
    attachmentCount: attachments.length,
    unresolvedAttachments: attachments.filter((entry) => !entry.asset).length,
  };
}

/**
 * Hands the finished artifact to the browser. Called only after the read
 * resolved, and only by the view's export action — so a failure to read can
 * never reach this function, and no download can precede the artifact.
 *
 * `text/plain` is the whole of the safety story for user-controlled content:
 * the file is not markup, the browser does not render it, and no HTML export
 * path exists (there is no `innerHTML` anywhere in this surface).
 */
export function saveChatExport(artifact: ChatExportArtifact): void {
  downloadBlob(new Blob([artifact.text], { type: "text/plain;charset=utf-8" }), artifact.fileName);
}
