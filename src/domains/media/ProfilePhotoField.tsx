/**
 * Profile-photo upload, preview, replace and remove.
 *
 * Reuses the existing media abstraction end to end — `MediaRepository` for
 * validation and metadata, the IndexedDB blob store for bytes. No second
 * storage system, no data URLs on the record (§24, §28).
 *
 * Object-URL lifetime is owned by `useMediaObjectUrl`, which revokes on
 * unmount and on every id change; a leak here would accumulate across a long
 * admin session.
 *
 * The component does not persist the id itself: it reports the new
 * `MediaAsset.id` (or `undefined`) upward so the owning form saves it through
 * the student/teacher repository in the same write as the rest of the record.
 */
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ds/primitives";
import { apiErrorFromThrown } from "@/api/errors";
import { getMediaRepository } from "@/domains/registry";
import { useMediaObjectUrl } from "@/domains/gallery/useGallery";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "./types";
import { faNum } from "@/lib/format";
import { cn } from "@/utils/cn";

export function ProfilePhotoField({
  mediaId,
  personName,
  disabled,
  onChange,
}: {
  mediaId: string | undefined;
  /** Used for the alt text and the fallback initials. */
  personName: string;
  disabled?: boolean;
  onChange: (nextMediaId: string | undefined) => void;
}) {
  const url = useMediaObjectUrl(mediaId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const initials = personName.trim().split(" ").slice(0, 2).map((part) => part[0]).join("");

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      // Validation (allow-list, magic bytes, size cap) lives in the repository.
      const asset = await getMediaRepository().create({
        kind: "image",
        filename: file.name,
        mimeType: file.type,
        bytes: await file.arrayBuffer(),
      });

      // Free the previous photo's bytes; a replaced avatar is unreachable.
      if (mediaId) {
        await getMediaRepository()
          .delete(mediaId)
          .catch(() => {
            /* an orphaned blob must not block the replacement */
          });
      }
      onChange(asset.id);
    } catch (cause) {
      setError(apiErrorFromThrown(cause).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    if (!mediaId) return;
    setBusy(true);
    setError(null);
    try {
      await getMediaRepository().delete(mediaId);
      onChange(undefined);
    } catch (cause) {
      setError(apiErrorFromThrown(cause).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-3.5">
      <div
        className={cn(
          "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]",
        )}
      >
        {url ? (
          <img src={url} alt={`تصویر ${personName}`} className="size-full object-cover" />
        ) : mediaId ? (
          // Metadata exists but the bytes do not — normal after a backup
          // restore, since backups carry no binaries. Say so rather than
          // showing a broken image.
          <span className="px-1.5 text-center text-[9.5px] leading-tight text-ink-500">
            تصویر در این مرورگر موجود نیست
          </span>
        ) : initials ? (
          <span className="text-lg font-semibold text-ink-400">{initials}</span>
        ) : (
          <UserRound className="size-7 text-ink-500" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <input
          ref={input}
          type="file"
          className="sr-only"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="subtle"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            {busy ? "در حال بارگذاری…" : mediaId ? "تغییر تصویر" : "افزودن تصویر"}
          </Button>
          {mediaId && (
            <Button size="sm" variant="ghost" disabled={disabled || busy} onClick={() => void remove()}>
              <Trash2 className="size-3.5" /> حذف
            </Button>
          )}
        </div>

        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
          JPEG، PNG یا WebP تا {faNum(MAX_IMAGE_BYTES / (1024 * 1024))} مگابایت. در نسخهٔ دمو تصویر فقط در همین
          مرورگر ذخیره می‌شود و در پشتیبان قرار نمی‌گیرد.
        </p>

        {error && (
          <p role="alert" className="mt-1.5 text-[11px] text-danger-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
