/**
 * A confirmation the product can stand behind.
 *
 * Destructive writes used to fire on the first click (a user deleted from a list
 * row, a piece removed from the repertoire) with the only undo being "restore a
 * backup". `window.confirm` was not an option either: it is unstyled, it drops
 * the panel's type and direction, and it blocks the thread.
 *
 * So this is the one confirmation surface: it names the record, states what
 * follows from the delete in plain language, keeps its button disabled while the
 * write is in flight, and surfaces the repository's own refusal (a teacher who
 * still has classes, a piece still assigned) rather than swallowing it.
 */
import { useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "./primitives";
import { Dialog } from "./patterns";
import { cn } from "@/utils/cn";

export function ConfirmDialog({
  open,
  title,
  description,
  consequences,
  confirmLabel = "حذف",
  cancelLabel = "انصراف",
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** What the operator loses by confirming — rendered as a list, not prose. */
  consequences?: readonly string[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** Disables both buttons while the write is in flight. */
  busy?: boolean;
  /** The repository's own refusal, shown instead of a silent failure. */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [touched, setTouched] = useState(false);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-danger-500/30 bg-danger-500/10 text-danger-400">
            <TriangleAlert className="size-4" strokeWidth={1.9} />
          </span>
          {title}
        </span>
      }
      description={description}
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            className={cn("bg-danger-500/90 text-ink-50 hover:bg-danger-500")}
            disabled={busy}
            onClick={() => {
              setTouched(true);
              onConfirm();
            }}
          >
            {busy ? "در حال انجام…" : confirmLabel}
          </Button>
        </>
      }
    >
      {consequences && consequences.length > 0 && (
        <ul className="space-y-1.5 text-[12px] leading-relaxed text-ink-200">
          {consequences.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-danger-400/70" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {error && touched && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] leading-relaxed text-danger-400"
        >
          {error}
        </p>
      )}
    </Dialog>
  );
}
