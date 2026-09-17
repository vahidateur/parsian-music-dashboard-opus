/**
 * Attachment rules for the message composer — DERIVED from the media contract.
 *
 * WHY THERE IS NO NEW POLICY HERE
 *
 * The chat contract carries an attachment as a single `mediaId` reference
 * (`SendMessageInput.mediaId`, `ChatMessage.mediaId`). It deliberately does not
 * restate which files a message may carry: the media domain already owns that
 * policy, and a second allow-list in the view is how two layers start
 * disagreeing about what "allowed" means.
 *
 * So every value used to accept or reject a file comes from
 * `@/domains/media/types` — `allowedTypesFor`, `maxBytesFor`, and therefore the
 * exported `MAX_*_BYTES` ceilings and `ALLOWED_*_TYPES` lists. Nothing is
 * re-typed, and no new limit is invented.
 *
 * THE KIND IS DERIVED, NOT INVENTED
 *
 * `MediaRepository.create` requires a `MediaKind`. The chat contract has no
 * kind field, so the kind is inferred from the declared MIME type against the
 * media allow-lists — the same resolution order a reader would use. A type that
 * belongs to no list has no kind and is refused, which is exactly the media
 * domain's own verdict.
 *
 * THIS IS A PRE-FILTER, NOT A SECURITY BOUNDARY
 *
 * `DemoMediaRepository.create` re-validates everything: allow-list, size
 * ceiling, empty bytes, and a magic-byte cross-check against the declared type.
 * This module exists so an obviously invalid file never reaches the repository
 * (and so the operator gets the reason immediately, in the same words), NOT to
 * replace that validation. Nothing here is claimed to be authorization: the
 * media domain states that per-object ownership and access control are
 * server-side concerns, and this file does not pretend otherwise.
 */
import { allowedTypesFor, maxBytesFor, type MediaKind } from "@/domains/media/types";
import { faNum } from "@/lib/format";

/** Every kind the media domain can store, and therefore every kind a message may carry. */
export const ATTACHMENT_KINDS: readonly MediaKind[] = ["image", "audio", "document"];

export const KIND_LABEL: Record<MediaKind, string> = {
  image: "تصویر",
  audio: "صدا",
  document: "سند",
};

/** Ceiling in whole megabytes, as the media domain defines it. */
const megabytes = (kind: MediaKind): number => Math.floor(maxBytesFor(kind) / (1024 * 1024));

/**
 * `accept` for the file input: the union of the media allow-lists.
 *
 * A hint for the picker only — never the check. A browser that ignores it, or a
 * user who picks "all files", changes nothing: `checkAttachment` and then the
 * repository both still refuse.
 */
export const ATTACHMENT_ACCEPT = ATTACHMENT_KINDS.flatMap((kind) => [...allowedTypesFor(kind)]).join(",");

/** e.g. «تصویر تا ۵ مگابایت · صدا تا ۲۵ مگابایت · سند تا ۲۰ مگابایت». */
export const ATTACHMENT_SIZE_LIMITS = ATTACHMENT_KINDS.map(
  (kind) => `${KIND_LABEL[kind]} تا ${faNum(megabytes(kind))} مگابایت`,
).join(" · ");

/** The allow-lists themselves, in the same shape the repository quotes them. */
export const ATTACHMENT_TYPE_LIMITS = ATTACHMENT_KINDS.map(
  (kind) => `${KIND_LABEL[kind]} (${allowedTypesFor(kind).join("، ")})`,
).join(" · ");

/** The media kind a declared MIME type belongs to, or `undefined` if none does. */
export function attachmentKindFor(mimeType: string): MediaKind | undefined {
  const declared = mimeType.trim().toLowerCase();
  if (!declared) return undefined;
  return ATTACHMENT_KINDS.find((kind) => (allowedTypesFor(kind) as readonly string[]).includes(declared));
}

export type AttachmentCheck = { ok: true; kind: MediaKind } | { ok: false; reason: string };

/**
 * The client-side verdict on a picked file, with the reason the operator sees.
 *
 * The rejections mirror `DemoMediaRepository.create`'s own wording and order
 * (type, then empty, then size) so the two layers cannot tell a user two
 * different stories about the same file.
 */
export function checkAttachment(file: File): AttachmentCheck {
  const kind = attachmentKindFor(file.type);
  if (!kind) {
    const declared = file.type.trim();
    return {
      ok: false,
      reason: `${declared ? `قالب «${declared}»` : "قالب این فایل"} مجاز نیست. قالب‌های مجاز: ${ATTACHMENT_TYPE_LIMITS}`,
    };
  }
  if (file.size === 0) {
    return { ok: false, reason: "فایل خالی است." };
  }
  if (file.size > maxBytesFor(kind)) {
    return {
      ok: false,
      reason: `حجم فایل بیش از حد مجاز است (حداکثر ${faNum(megabytes(kind))} مگابایت برای ${KIND_LABEL[kind]}).`,
    };
  }
  return { ok: true, kind };
}

/** Human-readable byte size with Persian digits; `—` for a value that cannot be one. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${faNum(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${faNum(bytes / 1024, { decimals: 1 })} کیلوبایت`;
  return `${faNum(bytes / (1024 * 1024), { decimals: 1 })} مگابایت`;
}
