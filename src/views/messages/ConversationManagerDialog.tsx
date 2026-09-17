/**
 * Conversation manager — rename, topic, pin, archive and restore.
 *
 * The first shipped UI for three verbs that already existed and were tested on
 * the domain side (`updateConversation`, `archiveConversation`) with zero
 * callers, which is what held Messaging/Chat at **B** in the requirements
 * reconciliation (PRODUCT_PHASE_SPECIFICATION.md row 1).
 *
 * ARCHIVE IS REVERSIBLE, AND THIS DIALOG IS WHERE THAT IS PROVEN
 *
 * `updateConversation(id, { archived: false })` IS the restore path — the M6
 * contract extension added `archived` to the patch precisely so no unarchive
 * verb had to be invented. The same button toggles both directions, so a user
 * who archives a thread can always get it back; shipping a one-way archive
 * would have put data out of reach of every surface in the product.
 *
 * WRITES ARE AWAITED; NOTHING IS CLAIMED BEFORE THEY RESOLVE
 *
 * Form submissions go through `useEntityForm`, which calls the repository and
 * reports the failure in the repository's own words (`ApiError.message` and
 * `ApiError.fields`) instead of a success toast. The archive/restore action is
 * a second, independent write with its own in-flight guard, so it cannot race
 * the form's save. `onSaved` / `onArchived` run only after the promise resolved,
 * which is what makes the parent's success toast truthful.
 *
 * `open` is passed to `useEntityForm` so the draft is rebuilt from the record on
 * every opening: the dialog is mounted once and reused across conversations, and
 * a draft that survived a switch would write A's name onto B's id (OPEN_ITEMS H6).
 */
import { useState } from "react";
import { Archive, ArchiveRestore, Pin } from "lucide-react";
import { Button } from "@/components/ds/primitives";
import { Dialog, Field, Toggle, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getChatRepository } from "@/domains/registry";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { cn } from "@/utils/cn";
import type { ChatConversation } from "@/domains/chat/types";

interface ConversationDraft {
  name: string;
  topic: string;
  pinned: boolean;
}

function toDraft(conversation: ChatConversation): ConversationDraft {
  return {
    name: conversation.name,
    topic: conversation.topic,
    pinned: Boolean(conversation.pinned),
  };
}

/**
 * Local validation mirrors the repository's rule rather than replacing it: the
 * repository still refuses a one-character name, and its refusal is rendered on
 * the same field.
 */
function validate(draft: ConversationDraft): FieldErrors<ConversationDraft> {
  const errors: FieldErrors<ConversationDraft> = {};
  if (draft.name.trim().length < 2) errors.name = "نام گفتگو باید دست‌کم ۲ نویسه باشد.";
  return errors;
}

export function ConversationManagerDialog({
  open,
  conversation,
  onClose,
  onSaved,
  onArchived,
}: {
  open: boolean;
  /** The thread being managed. Never `undefined`: the dialog follows the selection. */
  conversation: ChatConversation;
  onClose: () => void;
  /** Called after a successful rename/topic/pin write. */
  onSaved: (updated: ChatConversation) => void;
  /** Called after a successful archive or restore. */
  onArchived: (updated: ChatConversation) => void;
}) {
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const form = useEntityForm<ConversationDraft, ChatConversation>({
    initial: toDraft(conversation),
    open, // H6: rebuild from this conversation on every opening
    validate,
    // Resolved at submit time, not captured at mount: the dialog is mounted
    // with the page, so a captured repository would keep writing to the one
    // that was registered before a test harness (or a mode switch) swapped it.
    submit: (draft) =>
      getChatRepository().updateConversation(conversation.id, {
        name: draft.name.trim(),
        topic: draft.topic.trim(),
        pinned: draft.pinned,
      }),
    onSuccess: (saved) => {
      onSaved(saved);
      onClose();
    },
  });

  const busy = form.submitting || archiveBusy;
  const archived = Boolean(conversation.archived);

  const toggleArchive = async () => {
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      const updated = await getChatRepository().updateConversation(conversation.id, { archived: !archived });
      onArchived(updated);
      onClose();
    } catch (cause) {
      // The repository's own sentence, never a generic one and never a success.
      setArchiveError(apiErrorFromThrown(cause).message);
    } finally {
      setArchiveBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={`مدیریت گفتگو`}
      description={
        archived
          ? "این گفتگو بایگانی شده است: به‌صورت پیش‌فرض در فهرست دیده نمی‌شود و می‌توانید آن را بازگردانید."
          : "نام و موضوع گفتگو در فهرست و سرصفحه نمایش داده می‌شوند. گفتگوی سنجاق‌شده بالای فهرست می‌آید."
      }
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {form.submitting ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        {form.formError && !Object.keys(form.errors).length && (
          <p role="alert" className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            {form.formError.message}
          </p>
        )}

        <Field label="نام گفتگو" error={form.errors.name} required>
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.name}
              disabled={busy}
              onChange={(event) => form.set("name", event.target.value)}
            />
          )}
        </Field>

        <Field label="موضوع" hint="خط کوتاه زیر نام در فهرست">
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.topic}
              disabled={busy}
              onChange={(event) => form.set("topic", event.target.value)}
            />
          )}
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] px-3.5 py-3">
          <span className="flex items-center gap-2 text-xs font-medium text-ink-200">
            <Pin className="size-3.5 text-gold-400" aria-hidden />
            سنجاق در بالای فهرست
          </span>
          <Toggle
            checked={form.draft.pinned}
            onChange={(value) => form.set("pinned", value)}
            label="سنجاق کردن گفتگو"
          />
        </div>

        {/* Archive / restore — a separate awaited write, not part of the form. */}
        <div className="rounded-xl border border-white/[0.07] px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-200">
                {archived ? "بازگردانی به فهرست" : "بایگانی گفتگو"}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                {archived
                  ? "گفتگو و همهٔ پیام‌هایش دست‌نخورده‌اند؛ فقط دوباره در فهرست پیش‌فرض دیده می‌شود."
                  : "گفتگو از فهرست پیش‌فرض کنار می‌رود و پیام‌هایش پاک نمی‌شوند. هر زمان می‌توانید بازگردانید."}
              </p>
            </div>
            <Button
              size="sm"
              variant="subtle"
              className={cn("shrink-0", archived && "text-gold-300")}
              disabled={busy}
              onClick={() => void toggleArchive()}
            >
              {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
              {archiveBusy ? "در حال انجام…" : archived ? "بازگردانی" : "بایگانی"}
            </Button>
          </div>
          {archiveError && (
            <p role="alert" className="mt-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
              {archiveError}
            </p>
          )}
        </div>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
