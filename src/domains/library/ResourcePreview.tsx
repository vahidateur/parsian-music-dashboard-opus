/**
 * ResourcePreview — the Library drawer's document preview surface.
 *
 * WHY THIS EXISTS
 *
 * The media contract stores real bytes for exactly two document types
 * (`ALLOWED_DOCUMENT_TYPES`: a PDF and a plain-text note), but the drawer used
 * to offer only «دریافت». For a file already held in this browser, download is
 * the honest floor, not the ceiling — so the drawer now also opens what it
 * actually has. `ALLOWED_DOCUMENT_TYPES` is consulted rather than a private
 * list of MIME strings: preview availability is derived from the storage
 * contract, so the two cannot drift apart.
 *
 * DELIBERATELY NARROW
 *
 *  - No `<iframe>` / `<embed>` of the blob. The production CSP ships
 *    `object-src 'none'` and `default-src 'self'`, so an embedded `blob:` frame
 *    is blocked at runtime: it would LOOK like a preview and render nothing. A
 *    link is a navigation, which the policy permits, and the browser's own PDF
 *    viewer renders the real bytes. `MessageAttachment` already opens files this
 *    way for the same reason.
 *  - No second object-URL owner. `useMediaObjectUrl` is the only place blob URLs
 *    are created and revoked, so the URL arrives as a prop and this component
 *    never calls `URL.createObjectURL` itself.
 *  - No fabricated preview. Everything here reads `file.status`/`file.asset` and
 *    says «در حال آماده‌سازی» when the read has not landed yet, exactly as the
 *    drawer's own status block does.
 *  - `video` cannot be previewed, and says so: no video container is in the
 *    media allow-list, so there are never bytes here to play. An audio element
 *    over a missing file would be a lie with controls.
 *  - `audio` is not handled at all — `AudioMessagePlayer` owns it.
 */
import { useEffect, useState } from "react";
import { ExternalLink, FileText, Info } from "lucide-react";
import { ALLOWED_DOCUMENT_TYPES } from "@/domains/media/types";
import { cn } from "@/utils/cn";
import type { LibraryFileState, ResourceKind } from "./types";

const PDF_TYPE = "application/pdf";
const TEXT_TYPE = "text/plain";

/**
 * The states a text read can be in, kept distinct on purpose.
 *
 * `idle` means "this asset is not a text file, or has no bytes" and renders
 * nothing; `reading` means "a read is outstanding"; `failed` means the read
 * itself broke. The last two must not share a state: a spinner that never ends
 * is a claim about work that is no longer happening.
 */
type TextRead = { status: "idle" } | { status: "reading" } | { status: "failed" } | { status: "ready"; text: string };

const IDLE: TextRead = { status: "idle" };

export interface ResourcePreviewProps {
  /** The same file state the drawer already resolved — no second read here. */
  file: LibraryFileState;
  /** Object URL for a stored PDF, from `useMediaObjectUrl`. Undefined until it lands. */
  previewUrl?: string;
  /** Resource kind, only to be honest about the one case that can never preview. */
  kind: ResourceKind;
}

/** True when the media contract could have stored bytes this surface can show. */
export function isPreviewableMimeType(mimeType: string | undefined): boolean {
  return mimeType !== undefined && (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Only the PDF case needs an object URL — plain text is rendered from bytes the
 * drawer already holds. Exported so the view asks for a URL in exactly the
 * situations this component can use one, and no blob URL is created for nothing.
 */
export function needsPreviewObjectUrl(mimeType: string | undefined): boolean {
  return mimeType === PDF_TYPE;
}

export function ResourcePreview({ file, previewUrl, kind }: ResourcePreviewProps) {
  const mimeType = file.asset?.mimeType;

  // Plain text is rendered from the bytes the drawer already holds, so no
  // object URL is involved and nothing has to be revoked here.
  const [read, setRead] = useState<TextRead>(IDLE);
  useEffect(() => {
    if (mimeType !== TEXT_TYPE || !file.blob) {
      setRead(IDLE);
      return;
    }
    let live = true;
    setRead({ status: "reading" });
    void file.blob
      .text()
      .then(
        (value) => {
          if (live) setRead({ status: "ready", text: value });
        },
        () => {
          // A broken decode is reported as a failure. It is not an empty document,
          // and it is not a read to keep waiting on.
          if (live) setRead({ status: "failed" });
        },
      );
    return () => {
      live = false;
    };
  }, [mimeType, file.blob]);

  if (kind === "video") {
    return (
      <p className="flex items-start gap-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-3.5 text-[11px] leading-relaxed text-ink-400">
        <Info className="mt-px size-3.5 shrink-0 text-gold-300/70" aria-hidden />
        پیش‌نمایش ویدیو در این معماری وجود ندارد: هیچ قالب ویدیویی در فهرست مجاز media نیست، بنابراین فایل
        ویدیویی هرگز ذخیره نمی‌شود. نمایش این پیام بهتر از یک پخش‌کنندهٔ بی‌فایل است.
      </p>
    );
  }

  // The drawer's own status block already explains why a file is missing or
  // still loading; duplicating that here would put two explanations side by side.
  if (file.status !== "ready" || !file.asset) return null;
  if (!isPreviewableMimeType(mimeType)) return null;

  if (mimeType === PDF_TYPE) {
    if (!previewUrl) {
      return (
        <p className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5 text-[11.5px] text-ink-400">
          در حال آماده‌سازی پیش‌نمایش…
        </p>
      );
    }
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-3.5">
        <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-ink-300">
          <FileText className="me-1 inline size-3.5 text-gold-300/70" aria-hidden />
          پی‌دی‌اف این منبع با همان بایت‌های ذخیره‌شده باز می‌شود — در viewer خود مرورگر، نه در یک پیش‌نمایش
          ساختگی.
        </p>
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-gold-400/30 bg-gold-500/10 px-3 py-2 text-[11px] text-gold-100 hover:bg-gold-500/20"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          باز کردن پیش‌نمایش
        </a>
      </div>
    );
  }

  if (mimeType === TEXT_TYPE) {
    if (read.status === "failed") {
      return (
        <p className="rounded-xl border border-danger-500/25 bg-danger-500/[0.06] p-3.5 text-[11.5px] leading-relaxed text-danger-400">
          متن این فایل خوانده نشد، بنابراین پیش‌نمایشی وجود ندارد. خود فایل دست‌نخورده ذخیره است و
          «دریافت» همان بایت‌ها را برمی‌گرداند.
        </p>
      );
    }
    // `reading` and `idle` both mean "nothing has been read yet" — neither may
    // render as an empty document, which is a claim about the file's content.
    if (read.status !== "ready") {
      return (
        <p className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5 text-[11.5px] text-ink-400">
          در حال خواندن متن فایل…
        </p>
      );
    }
    return (
      <pre
        // The scroll region is focusable on purpose. `Drawer` traps focus while it
        // is open, so without a tab stop of its own the clipped remainder of a
        // long note is unreachable for a keyboard-only user. `index.css` supplies the
        // `:focus-visible` outline, and `role="region"` is what lets the label be
        // announced at all — `aria-label` on an unnamed generic element is ignored.
        role="region"
        tabIndex={0}
        aria-label={`پیش‌نمایش متن ${file.asset.filename}`}
        className={cn(
          "max-h-[360px] overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.08] bg-black/30 p-3.5",
          "text-right text-[11.5px] leading-6 text-ink-200",
        )}
      >
        {read.text === "" ? "متن فایل خالی است." : read.text}
      </pre>
    );
  }

  // An allowed document type with no renderer above. The allow-list holds
  // exactly PDF and plain text today, so this only fires if that list grows —
  // and staying silent is the right answer then: a new document format is not
  // previewable until something can actually render it.
  return null;
}
