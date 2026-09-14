/**
 * The attachment control for the composer: picker, pending state, honest limits.
 *
 * TWO PIECES, ONE FILE
 *
 * `AttachmentPicker` is the trigger and lives in the composer row where the
 * disabled paperclip used to be, so the layout is unchanged. `AttachmentStatus`
 * is the block under that row: the chosen file, the validation reason, the limits
 * the contract actually enforces. They are separate because they sit in different
 * places in the layout, not because the state is split — the state lives in
 * `useComposer`, keyed to the conversation, exactly like the draft.
 *
 * A PICKED FILE IS NOT AN UPLOAD
 *
 * Selecting a file here writes nothing anywhere. The copy says so («در انتظار
 * ارسال»), and the file is handed upward for the send path to validate, store and
 * reference. There is no progress bar, no spinner and no «آپلود شد» until the
 * awaited repository write has actually resolved — the only place that can claim
 * that is `Messages.tsx`, after the promise settled.
 *
 * NO DRAG-AND-DROP, NO MEDIA LIBRARY
 *
 * Neither is required by the contract, and both would be a second way to reach
 * the same write. The file input plus a real button is the whole control: the
 * button is a `<button>` (keyboard reachable, Enter/Space activate it) and it
 * opens the picker the browser owns.
 */
import { useRef } from "react";
import { FileText, Image as ImageIcon, Music, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ds/primitives";
import type { MediaKind } from "@/domains/media/types";
import { cn } from "@/utils/cn";
import { ATTACHMENT_ACCEPT, ATTACHMENT_SIZE_LIMITS, ATTACHMENT_TYPE_LIMITS, KIND_LABEL, attachmentKindFor, formatBytes } from "./attachmentRules";

const KIND_ICON: Record<MediaKind, typeof ImageIcon> = {
  image: ImageIcon,
  audio: Music,
  document: FileText,
};

/**
 * The trigger: a hidden `<input type="file">` opened by a real button.
 *
 * The input keeps an accessible label of its own rather than relying on the
 * button, because a screen reader that reaches it directly must know what it is.
 */
export function AttachmentPicker({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        aria-label="انتخاب فایل پیوست"
        accept={ATTACHMENT_ACCEPT}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          // Allow re-picking the same file after a validation error or a removal.
          event.target.value = "";
          if (picked) onSelect(picked);
        }}
      />
      <Button
        size="sm"
        variant="subtle"
        className="h-9 shrink-0"
        aria-label="افزودن پیوست"
        title={`افزودن پیوست — ${ATTACHMENT_SIZE_LIMITS}`}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Paperclip className="size-3.5" />
      </Button>
    </>
  );
}

/**
 * The block under the composer row: what is pending, what was refused, and what
 * the limits are.
 *
 * `error` and `file` can both be present at once, and that is deliberate: a
 * refused file must not quietly remove a valid one the operator already chose.
 */
export function AttachmentStatus({
  file,
  error,
  needsBody,
  disabled,
  onClear,
}: {
  file: File | null;
  error: string | null;
  /** True when an attachment is waiting on a message body, which the contract requires. */
  needsBody?: boolean;
  disabled?: boolean;
  onClear: () => void;
}) {
  const kind = file ? attachmentKindFor(file.type) : undefined;
  const Icon = kind ? KIND_ICON[kind] : Paperclip;

  return (
    <div className="mt-2">
      {file && (
        <div className="flex items-center gap-2 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-2.5 py-1.5">
          <Icon className="size-3.5 shrink-0 text-gold-300" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] text-ink-100">{file.name}</span>
            <span className="block text-[10px] text-ink-400">
              {kind ? `${KIND_LABEL[kind]} · ` : ""}
              {file.type || "بدون قالب اعلام‌شده"} · {formatBytes(file.size)} · در انتظار ارسال
            </span>
          </span>
          <button
            type="button"
            aria-label="حذف پیوست"
            disabled={disabled}
            onClick={onClear}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lg text-ink-400",
              "transition-colors hover:bg-white/[0.06] hover:text-ink-100 disabled:opacity-50",
            )}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {file && needsBody && (
        <p role="status" className="mt-1.5 text-[10.5px] leading-relaxed text-warn-400">
          پیوست به‌تنهایی ارسال نمی‌شود: متن پیام هم لازم است.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-[10.5px] leading-relaxed text-danger-400">
          {error}
        </p>
      )}

      <p className="mt-1.5 text-[10px] leading-relaxed text-ink-500">
        پیوست: {ATTACHMENT_SIZE_LIMITS}. قالب‌های مجاز: {ATTACHMENT_TYPE_LIMITS}. در این نسخه فایل پیوست در همین
        مرورگر ذخیره می‌شود، روی سرور نگهداری نمی‌شود و اسکن ویروس ندارد.
      </p>
    </div>
  );
}
