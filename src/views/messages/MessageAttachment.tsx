/**
 * One message's attachment, rendered from what the repositories actually hold.
 *
 * THERE IS NO PENDING FILE HERE, ON PURPOSE
 *
 * A `File` the operator picked is not a message attachment. It becomes one only
 * after `MediaRepository.create` has stored the bytes and recorded the metadata,
 * and the message referencing it has been written. So this component takes a
 * `mediaId` — a reference that came back out of a stored message — and never a
 * `File`, and it never invents an object URL from one. The only object URL it can
 * show is the one created by `useMediaObjectUrl`, the single sanctioned seam for
 * stored binaries (it also owns revocation).
 *
 * WHAT IS CLAIMED ABOUT STORAGE
 *
 * Nothing about a server. The metadata read (`MediaRepository.get`) and the byte
 * read (`getBlob`) are the two facts available, and each is shown for what it is:
 *
 *   - metadata present, bytes present  → the file can be opened here
 *   - metadata present, bytes ABSENT   → shown as unavailable, with no open or
 *     download affordance at all. This is a real state, not a hypothetical one:
 *     a backup carries metadata and no binaries (media/types.ts documents it),
 *     and the same is true after clearing browser storage.
 *   - metadata ABSENT                  → the reference no longer resolves. Said
 *     plainly, with the reference itself shown so it can be traced; the message
 *     is not hidden, because it did happen.
 *
 * In the current build the bytes live in this browser's blob store (IndexedDB, or
 * an in-memory store where IndexedDB is unavailable). That is what the copy says
 * — «در همین مرورگر» — and it does not claim server storage, delivery or scanning,
 * none of which the media or chat contracts provide today.
 */
import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Music, TriangleAlert } from "lucide-react";
import { getMediaRepository } from "@/domains/registry";
import { useMediaObjectUrl } from "@/domains/media/useMedia";
import type { MediaAsset, MediaKind } from "@/domains/media/types";
import { cn } from "@/utils/cn";
import { KIND_LABEL, formatBytes } from "./attachmentRules";

const KIND_ICON: Record<MediaKind, typeof ImageIcon> = {
  image: ImageIcon,
  audio: Music,
  document: FileText,
};

export function MessageAttachment({ mediaId }: { mediaId: string }) {
  const url = useMediaObjectUrl(mediaId);
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [metadataMissing, setMetadataMissing] = useState(false);
  const [bytes, setBytes] = useState<"checking" | "present" | "absent">("checking");

  useEffect(() => {
    let alive = true;
    setAsset(null);
    setMetadataMissing(false);
    setBytes("checking");

    // Both reads go through the repositories, resolved at call time — the same
    // rule the write paths follow, so a swapped repository is the one read from.
    void getMediaRepository()
      .get(mediaId)
      .then((found) => {
        if (alive) setAsset(found);
      })
      .catch(() => {
        if (alive) setMetadataMissing(true);
      });

    // Asked separately from the object URL because the URL hook cannot tell
    // "the bytes are still being read" from "the bytes are not there", and the
    // difference between those two is the difference between a wait and a claim.
    void getMediaRepository()
      .getBlob(mediaId)
      .then((blob) => {
        if (alive) setBytes(blob ? "present" : "absent");
      })
      .catch(() => {
        if (alive) setBytes("absent");
      });

    return () => {
      alive = false;
    };
  }, [mediaId]);

  if (metadataMissing) {
    return (
      <div className="mt-2 rounded-xl border border-warn-500/30 bg-warn-500/[0.07] px-3 py-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-warn-400">
          <TriangleAlert className="size-3 shrink-0" aria-hidden />
          اطلاعات این پیوست در دسترس نیست
        </p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
          پیام ثبت شده است، اما دارایی رسانه‌ای آن پیدا نشد. شناسهٔ پیوست:{" "}
          <span className="font-mono text-[10px]">{mediaId}</span>
        </p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="mt-2 rounded-xl border border-white/[0.07] bg-black/10 px-3 py-2">
        <p className="text-[10.5px] text-ink-500">در حال خواندن اطلاعات پیوست…</p>
      </div>
    );
  }

  const Icon = KIND_ICON[asset.kind];
  const openable = bytes === "present" && url !== undefined;

  return (
    <div className="mt-2 rounded-xl border border-white/[0.08] bg-black/10 p-2.5">
      {asset.kind === "image" && url && (
        <img
          src={url}
          alt={`پیش‌نمایش پیوست ${asset.filename}`}
          className="mb-2 max-h-40 w-full rounded-lg object-cover"
        />
      )}

      <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-100">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{asset.filename}</span>
      </p>

      {/* Metadata is shown whenever it exists, bytes or no bytes. */}
      <p className="mt-0.5 text-[10.5px] text-ink-400">
        {KIND_LABEL[asset.kind]} · {asset.mimeType} · {formatBytes(asset.sizeBytes)}
      </p>

      {openable ? (
        <>
          <a
            href={url}
            download={asset.filename}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 text-[11px] text-gold-300",
              "underline decoration-gold-500/40 underline-offset-2 hover:text-gold-200",
            )}
          >
            باز کردن فایل
          </a>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-500">
            در این نسخه فایل فقط در همین مرورگر ذخیره شده است؛ روی سرور نگهداری نمی‌شود.
          </p>
        </>
      ) : bytes === "absent" ? (
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-warn-400">
          فایل در این مرورگر موجود نیست؛ فقط اطلاعات پیوست ذخیره شده است و اینجا باز یا دانلود نمی‌شود.
        </p>
      ) : (
        <p className="mt-1.5 text-[10.5px] text-ink-500">در حال آماده‌سازی پیش‌نمایش…</p>
      )}
    </div>
  );
}
