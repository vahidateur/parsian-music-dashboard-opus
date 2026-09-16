/**
 * Messages — repository-backed chat with conversation management.
 *
 * The view reads through `ChatRepository` and writes through it, so a sent
 * message genuinely persists, appears immediately, and survives a reload.
 *
 * Delivery honesty (§37): in-app messages are really delivered (the recipient
 * reads the same store) and are shown as sent. Any other transport needs a
 * server, so those messages are stored with an `unavailable` status and the
 * row says so — nothing claims a send that did not happen.
 *
 * CONVERSATION MANAGEMENT (M6 / CP2)
 *
 * Rename, topic, pin, archive and restore call the verbs the domain has exposed
 * since Phase A with zero callers. Archive is reversible: `updateConversation`
 * takes `archived`, so the same surface archives and restores. Archived threads
 * are hidden by default and discoverable through an explicit filter chip.
 *
 * ATTACHMENTS (M6 / CP3)
 *
 * The paperclip is a real picker now. A picked file is validated against the
 * media domain's own allow-lists and ceilings (derived, never re-typed), then
 * stored through `MediaRepository.create` and referenced by the message through
 * `mediaId` — the only attachment field the chat contract has. Nothing is
 * claimed before the awaited writes resolve, no object URL is invented from the
 * local `File`, and a message whose bytes are missing says so instead of offering
 * an open/download that could not work. Ownership and access control remain
 * server-side concerns: this surface checks that a reference resolves, and claims
 * nothing more (see `docs/engineering/OPEN_ITEMS.md` and the media domain header).
 *
 * EXPORT (M6 / CP4)
 *
 * The export is a plain-text transcript of the SELECTED conversation, read at
 * call time through `getConversation(id)` and `listMessages({ conversationId })`
 * — see `readChatExport`. The id is captured when the operator asks, so a list
 * that changes underneath the export cannot retarget it, and the download
 * happens only after the read resolved (the artifact is built, then saved, then
 * reported). A selection hidden by a filter keeps CP2's explicit panel and
 * therefore has no export control at all: nothing here can export a different
 * conversation than the one on screen. Attachment metadata is in the file;
 * attachment BYTES are not, and the transcript says so.
 *
 * STATE SAFETY
 *
 * Composer state (text AND pending attachment) is keyed to the conversation it
 * was typed for — see `useComposer`. Switching threads cannot carry A's draft
 * into B, and a send that resolves after the operator has switched away cannot
 * wipe the draft they have since started typing.
 *
 * SELECTION IS EXPLICIT
 *
 * A filter, a search term or hiding archived threads can take the selected
 * conversation out of the list. The view then says exactly that, with the way
 * back, and never silently re-points the thread pane at another conversation:
 * a write must target what the operator believes is selected.
 *
 * The layout, spacing and design tokens are unchanged from the original view.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Download,
  Megaphone,
  Pin,
  Send,
  Settings2,
  Sparkles,
} from "lucide-react";
import { messageTemplates } from "./messages/composerTemplates";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Avatar, Chip, PageHeader, Panel, SearchInput } from "@/components/ds/patterns";
import { getChatRepository, getMediaRepository } from "@/domains/registry";
import { useConversations, useMessages } from "@/domains/chat/useChat";
import { apiErrorFromThrown } from "@/api/errors";
import type { ChatMessage, ChatParticipantRole } from "@/domains/chat/types";
import { cn } from "@/utils/cn";
import { useComposer } from "./messages/useComposer";
import { ConversationManagerDialog } from "./messages/ConversationManagerDialog";
import { AttachmentPicker, AttachmentStatus } from "./messages/AttachmentField";
import { MessageAttachment } from "./messages/MessageAttachment";
import { attachmentKindFor, checkAttachment } from "./messages/attachmentRules";
import { readChatExport, saveChatExport } from "./messages/conversationExport";
import { academyNow } from "@/domains/shared/clock";

const roleMeta: Record<ChatParticipantRole, { label: string; tone: "gold" | "violet" | "info" | "neutral" }> = {
  teacher: { label: "مدرس", tone: "gold" },
  student: { label: "هنرجو", tone: "info" },
  guardian: { label: "ولی", tone: "neutral" },
  group: { label: "گروهی", tone: "violet" },
  staff: { label: "همکار", tone: "neutral" },
};

/**
 * Renders an ISO timestamp as a Persian HH:MM clock.
 * `faNum` takes a number, so each part is localized then zero-padded with the
 * Persian zero rather than padded as ASCII first.
 */
function clock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => (value < 10 ? `۰${faNum(value)}` : faNum(value));
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** One message bubble, including its honest delivery state. */
function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
  const mine = message.from === "me";
  const undelivered = message.status === "unavailable" || message.status === "failed";

  return (
    <div
      className={cn("flex", mine ? "justify-start" : "justify-end")}
      style={{ animation: `phrase-in 350ms var(--ease-phrase) ${Math.min(index, 8) * 60}ms both` }}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-2xl border px-3.5 py-2.5",
          mine ? "border-gold-500/25 bg-gold-500/[0.08] text-ink-50" : "border-white/[0.07] bg-white/[0.03] text-ink-100",
          undelivered && "border-warn-500/35 bg-warn-500/[0.07]",
        )}
      >
        {/* Bodies are rendered as text; React escapes them. Never as HTML. */}
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{message.body}</p>
        {/*
          The attachment is rendered from the reference the STORED message
          carries, never from a pending local file: `MessageAttachment` resolves
          the metadata and the bytes through the media repository.
        */}
        {message.mediaId && <MessageAttachment mediaId={message.mediaId} />}
        <div className={cn("mt-1 flex items-center gap-1.5 text-[10px]", mine ? "text-gold-400/70" : "text-ink-500")}>
          <span className="nums">{clock(message.sentAt)}</span>
          {undelivered && (
            <span className="flex items-center gap-1 text-warn-400">
              <AlertTriangle className="size-3" aria-hidden /> ارسال نشد
            </span>
          )}
        </div>
        {undelivered && message.statusReason && (
          <p className="mt-1.5 border-t border-warn-500/20 pt-1.5 text-[10.5px] leading-relaxed text-warn-400">
            {message.statusReason}
          </p>
        )}
      </div>
    </div>
  );
}

export function MessagesView() {
  const { notify } = useApp();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<ChatParticipantRole | "all">("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const listParams = useMemo(
    () => ({
      per_page: 100,
      ...(role !== "all" ? { role } : {}),
      ...(query ? { search: query } : {}),
      ...(includeArchived ? { includeArchived: true } : {}),
    }),
    [role, query, includeArchived],
  );
  const { items: threads, loading, error, reload } = useConversations(listParams);
  // `messagesLoading` is read, not ignored: the params carry the active thread,
  // so switching threads would otherwise show the previous thread's messages
  // under this thread's header — with the composer below still writing to the
  // newly selected one (I13).
  //
  // `messagesError` is read for the same reason, one step further: a failed
  // read used to render as «هنوز پیامی رد و بدل نشده», which is a claim about
  // the conversation made from an error (I15). The read now has its own state.
  const {
    items: messages,
    loading: messagesLoading,
    error: messagesError,
    reload: reloadMessages,
  } = useMessages(activeId ?? undefined);

  // Composer state belongs to a conversation, not to the component. See the
  // hook: the exposed draft is empty the moment the selection changes.
  const composer = useComposer(activeId ?? undefined);
  const draft = composer.draft;

  // Select the first thread once the list arrives, without clobbering a manual
  // choice or re-selecting after the user filters it away.
  useEffect(() => {
    if (!activeId && threads.length > 0) setActiveId(threads[0].id);
  }, [activeId, threads]);

  const active = threads.find((t) => t.id === activeId);
  /**
   * A conversation IS selected, but the current query does not return it —
   * because of the search text, the role filter, or (most often) archived
   * threads being hidden. Distinguishing this from "nothing is selected" is the
   * whole of the selection-honesty rule: the pane must not answer a filtered-out
   * selection with either another conversation's messages or a blank "pick one".
   */
  const selectionHidden = activeId !== null && active === undefined;
  const filtersActive = query.trim().length > 0 || role !== "all";
  const unread = threads.reduce((sum, t) => sum + t.unread, 0);

  // Opening a thread clears its unread badge — a real persisted write.
  useEffect(() => {
    if (!active || active.unread === 0) return;
    void getChatRepository()
      .markRead(active.id)
      .catch(() => {
        /* a failed read-receipt must not break the thread view */
      });
  }, [active]);

  /**
   * Picks a file for the next message — locally, without writing anything.
   *
   * A refusal keeps the conversation's draft and any attachment that was already
   * valid: the operator's chosen file is not thrown away because a second pick
   * was wrong.
   */
  const pickAttachment = useCallback(
    (file: File) => {
      const check = checkAttachment(file);
      if (!check.ok) {
        composer.setAttachmentError(check.reason);
        return;
      }
      composer.setPendingAttachment(file);
      composer.setAttachmentError(null);
    },
    [composer],
  );

  /**
   * Sends the message, and the attachment if there is one.
   *
   * TWO AWAITED WRITES, ONE CLAIM
   *
   *  1. `MediaRepository.create` stores the bytes and records the metadata. The
   *     contract makes it the validator too (allow-list, cap, magic bytes).
   *  2. `ChatRepository.sendMessage` writes the message, with the asset id as its
   *     `mediaId`. The chat repository refuses a reference that does not resolve,
   *     which is why the order cannot be reversed: a message may never be written
   *     pointing at an asset that does not exist yet.
   *
   * The success toast fires only after both resolved. The upload is not reported
   * on its own, because a stored-but-unreferenced file is not a sent attachment.
   *
   * A message body is required — `sendMessage` refuses an empty one — so an
   * attachment alone is not sendable, and the composer says so rather than
   * silently dropping the file.
   *
   * IF THE MESSAGE WRITE FAILS after the asset was stored, the asset is removed
   * again (best effort, exactly as `ProfilePhotoField` frees a replaced photo):
   * leaving it would strand a file nothing can reach, and the retry would store a
   * second copy of the same bytes. The failure is reported with the repository's
   * own reason, and the draft and pending file stay put so the send can be retried.
   *
   * `sending` is the duplicate guard: it is set before the first await and checked
   * on entry, so a double Enter or a second click cannot start a second upload.
   */
  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    // Captured before the await: the write targets the conversation the
    // operator was composing in, and the draft is cleared only if that is still
    // the conversation on screen (`clearFor`).
    const target = activeId;
    const file = composer.pendingAttachment;
    setSending(true);
    let storedMediaId: string | undefined;
    try {
      if (file) {
        const kind = attachmentKindFor(file.type);
        if (!kind) {
          // Defensive: the rules ran at selection time. Saying the same thing
          // again is better than storing a file whose kind nobody knows.
          composer.setAttachmentError("قالب این فایل مجاز نیست.");
          return;
        }
        const asset = await getMediaRepository().create({
          kind,
          filename: file.name,
          mimeType: file.type,
          bytes: await file.arrayBuffer(),
        });
        storedMediaId = asset.id;
      }

      const message = await getChatRepository().sendMessage({
        conversationId: target,
        body,
        ...(storedMediaId ? { mediaId: storedMediaId } : {}),
      });
      composer.clearFor(target);
      // The toast reports what actually happened, per message status.
      if (message.status === "sent") {
        notify(
          storedMediaId
            ? {
                tone: "success",
                title: "پیام و پیوست ثبت شد",
                detail: "پیام ذخیره شد و فایل پیوست در همین مرورگر نگهداری می‌شود.",
              }
            : { tone: "success", title: "پیام ارسال شد", detail: "پیام در گفتگوی داخلی ثبت و ذخیره شد." },
        );
      } else {
        notify({
          tone: "danger",
          title: "پیام ارسال نشد",
          detail: message.statusReason ?? "این مسیر ارسال در دسترس نیست.",
        });
      }
    } catch (cause) {
      if (storedMediaId) {
        await getMediaRepository()
          .delete(storedMediaId)
          .catch(() => {
            /* an orphaned blob must not replace the real failure message */
          });
      }
      notify({
        tone: "danger",
        title: file ? "ارسال پیام و پیوست ناموفق بود" : "ارسال پیام ناموفق بود",
        detail: apiErrorFromThrown(cause).message,
      });
    } finally {
      setSending(false);
    }
  }, [draft, activeId, sending, notify, composer]);

  const createConversation = useCallback(async () => {
    try {
      const created = await getChatRepository().createConversation({
        name: "گفتگوی جدید",
        role: "staff",
        topic: "بدون موضوع",
      });
      setActiveId(created.id);
      setMobileThread(true);
      notify({
        tone: "success",
        title: "گفتگو ساخته شد",
        detail: "نام و موضوع را از «مدیریت گفتگو» می‌توانید ویرایش کنید.",
      });
    } catch (cause) {
      notify({
        tone: "danger",
        title: "ساخت گفتگو ناموفق بود",
        detail: apiErrorFromThrown(cause).message,
      });
    }
  }, [notify]);

  /**
   * Exports the conversation that is selected RIGHT NOW.
   *
   * `active` is captured before the await, and the read re-resolves the thread by
   * that id rather than trusting the list's order — so switching threads while an
   * export is in flight cannot make it export the other conversation, and the
   * success names the thread that was actually read (`artifact.conversationName`),
   * never whatever happens to be on screen when the promise settles.
   *
   * `exporting` is the duplicate guard, set before the first await and checked on
   * entry; the control is disabled while it is true, so repeated clicks cannot
   * start a second read. The composer is not touched by any of this.
   *
   * The download happens after `readChatExport` resolved, so a failed read cannot
   * reach `saveChatExport` — there is no path in this action that reports or
   * performs an export that did not happen.
   */
  const runExport = useCallback(async () => {
    if (!active || exporting) return;
    const target = active;
    setExporting(true);
    try {
      const artifact = await readChatExport(target.id, academyNow());
      saveChatExport(artifact);
      notify({
        tone: "success",
        title: "خروجی گفتگو ذخیره شد",
        detail:
          artifact.messageCount === 0
            ? `«${artifact.conversationName}» هیچ پیامی ندارد؛ فایل خروجی بدون پیام ذخیره شد.`
            : `«${artifact.conversationName}» · ${faNum(artifact.messageCount)}${
                artifact.truncated ? ` از ${faNum(artifact.totalInRepository)}` : ""
              } پیام در فایل «${artifact.fileName}» ذخیره شد.`,
      });
    } catch (cause) {
      notify({
        tone: "danger",
        title: "تهیهٔ خروجی گفتگو ناموفق بود",
        detail: apiErrorFromThrown(cause).message,
      });
    } finally {
      setExporting(false);
    }
  }, [active, exporting, notify]);

  if (loading) return <LoadingState className="py-32" label="در حال بارگذاری گفتگوها…" />;
  if (error)
    return (
      <ErrorState
        className="py-32"
        title="بارگذاری گفتگوها ناموفق بود"
        description={error.message}
        onRetry={reload}
      />
    );

  return (
    <div>
      <PageHeader
        kicker="ارتباط"
        title="پیام‌ها"
        description="گفتگوی مدیریت با مدرسین، هنرجویان و اولیا — همه در یک جریان."
        actions={
          <>
            <Button
              size="sm"
              variant="subtle"
              onClick={() =>
                notify({
                  tone: "info",
                  title: "اعلان عمومی",
                  detail: "ارسال گروهی به سرویس پیام‌رسان سمت سرور نیاز دارد و در دمو فعال نیست.",
                })
              }
            >
              <Megaphone className="size-3.5" /> اطلاعیهٔ عمومی
            </Button>
            <Button size="sm" variant="primary" onClick={() => void createConversation()}>
              گفتگوی جدید
            </Button>
          </>
        }
        meta={
          <>
            <span className="nums">{faNum(unread)} پیام خوانده‌نشده</span>
            <span>{faNum(threads.length)} گفتگوی فعال</span>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_260px]">
        {/* Conversation list */}
        <Surface className={cn("flex flex-col overflow-hidden", mobileThread && "hidden lg:flex")}>
          <div className="space-y-3 border-b border-white/[0.06] p-3">
            <SearchInput value={query} onChange={setQuery} placeholder="جستجوی گفتگو…" />
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              <Chip label="همه" active={role === "all"} onClick={() => setRole("all")} />
              {(Object.keys(roleMeta) as ChatParticipantRole[]).map((r) => (
                <Chip
                  key={r}
                  label={roleMeta[r].label}
                  active={role === r}
                  onClick={() => setRole(role === r ? "all" : r)}
                />
              ))}
              {/* The explicit way to discover archived threads — hidden by default. */}
              <Chip
                label="بایگانی‌شده‌ها"
                tone="violet"
                active={includeArchived}
                onClick={() => setIncludeArchived((v) => !v)}
              />
            </div>
          </div>
          <ul aria-label="فهرست گفتگوها" className="stagger max-h-[520px] flex-1 space-y-1 overflow-y-auto p-2">
            {threads.length === 0 && (
              <EmptyState className="m-2" title="گفتگویی پیدا نشد" description="فیلتر یا عبارت جستجو را تغییر دهید." />
            )}
            {threads.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(c.id);
                    setMobileThread(true);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-right transition-colors",
                    c.id === activeId ? "border-gold-500/30 bg-gold-500/[0.06]" : "border-transparent hover:bg-white/[0.03]",
                  )}
                >
                  <Avatar name={c.name} size="sm" ring={c.unread ? "gold" : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {c.pinned && <Pin className="size-3 shrink-0 text-gold-400" />}
                      <span className="truncate text-[13px] font-medium text-ink-50">{c.name}</span>
                      <span className="nums mr-auto shrink-0 text-[10px] text-ink-500">{clock(c.lastMessageAt)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-400">{c.topic}</span>
                    <span className="mt-1 block truncate text-[11.5px] text-ink-300">{c.lastMessagePreview}</span>
                    {c.archived && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/[0.08] px-1.5 py-0.5 text-[10px] text-violet-300">
                        <Archive className="size-2.5" aria-hidden /> بایگانی‌شده
                      </span>
                    )}
                  </span>
                  {c.unread > 0 && (
                    <span className="nums mt-1 flex size-4.5 min-w-[18px] items-center justify-center rounded-full bg-gold-500/20 px-1 text-[10px] font-semibold text-gold-300">
                      {faNum(c.unread)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Surface>

        {/* Thread */}
        <Surface className={cn("flex min-h-[520px] flex-col overflow-hidden", !mobileThread && "hidden lg:flex")}>
          {active ? (
            <>
              <header className="flex items-center gap-3 border-b border-white/[0.06] p-4">
                <button
                  type="button"
                  onClick={() => setMobileThread(false)}
                  aria-label="بازگشت"
                  className="flex size-8 items-center justify-center rounded-lg border border-white/[0.07] text-ink-300 lg:hidden"
                >
                  <ArrowRight className="size-4" />
                </button>
                <Avatar name={active.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {active.pinned && <Pin className="size-3.5 shrink-0 text-gold-400" aria-label="سنجاق‌شده" />}
                    <span className="truncate text-[14px] font-semibold text-ink-50">{active.name}</span>
                    {active.archived && (
                      <span className="shrink-0 rounded-full border border-violet-500/25 bg-violet-500/[0.08] px-1.5 py-0.5 text-[10px] text-violet-300">
                        بایگانی‌شده
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-400">{active.topic}</div>
                </div>
                <StatusBadge tone={roleMeta[active.role].tone} label={roleMeta[active.role].label} glyph={false} />
                <Button
                  size="sm"
                  variant="subtle"
                  className="shrink-0"
                  onClick={() => void runExport()}
                  disabled={exporting}
                  aria-label="خروجی گرفتن از این گفتگو"
                  title="خروجی متنی همین گفتگو، بر اساس داده‌های ذخیره‌شده"
                >
                  <Download className="size-3.5" /> {exporting ? "در حال تهیه…" : "خروجی"}
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  className="shrink-0"
                  onClick={() => setManagerOpen(true)}
                  aria-label="مدیریت گفتگو"
                >
                  <Settings2 className="size-3.5" /> مدیریت
                </Button>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messagesLoading ? (
                  // This thread exists and its messages are being read: in
                  // flight, not «هنوز پیامی رد و بدل نشده».
                  <LoadingState className="m-2" label="در حال بارگذاری این گفتگو…" />
                ) : messagesError ? (
                  // A read that failed is a failure, never an empty thread.
                  <ErrorState
                    className="m-2"
                    title="بارگذاری پیام‌های این گفتگو ناموفق بود"
                    description={messagesError.message}
                    onRetry={reloadMessages}
                  />
                ) : messages.length === 0 ? (
                  <EmptyState
                    className="m-2"
                    title="هنوز پیامی رد و بدل نشده"
                    description="اولین پیام این گفتگو را بنویسید."
                  />
                ) : (
                  messages.map((message, index) => (
                    <MessageBubble key={message.id} message={message} index={index} />
                  ))
                )}
              </div>

              <div className="border-t border-white/[0.06] p-3">
                <div className="flex items-end gap-2">
                  {/*
                    A real picker. Selecting a file writes nothing: the attachment
                    is stored and referenced by `send`, and only then reported.
                  */}
                  <AttachmentPicker disabled={sending} onSelect={pickAttachment} />
                  <label htmlFor="chat-draft" className="sr-only">
                    متن پیام
                  </label>
                  <textarea
                    id="chat-draft"
                    value={draft}
                    onChange={(e) => composer.setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={1}
                    disabled={sending}
                    placeholder="پیام خود را بنویسید…"
                    className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border border-white/[0.08] bg-ink-850 px-3 py-2 text-[13px] text-ink-50 outline-none placeholder:text-ink-500 focus:border-gold-500/50 disabled:opacity-60"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => void send()}
                    disabled={!draft.trim() || sending}
                  >
                    <Send className="size-3.5" /> {sending ? "در حال ارسال…" : "ارسال"}
                  </Button>
                </div>
                <AttachmentStatus
                  file={composer.pendingAttachment}
                  error={composer.attachmentError}
                  needsBody={composer.pendingAttachment !== null && draft.trim().length === 0}
                  disabled={sending}
                  onClear={() => composer.clearAttachment()}
                />
                <p className="mt-2 text-[10.5px] text-ink-500">Enter برای ارسال · Shift + Enter برای خط جدید</p>
              </div>
            </>
          ) : selectionHidden ? (
            /*
              The operator's conversation is still selected; the list query just
              does not return it. Saying so — with the way back — is the only
              honest answer. Auto-selecting another thread here would silently
              retarget the composer, and an empty "pick a conversation" would
              contradict the fact that one IS selected.
            */
            <div className="m-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.07] px-6 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 text-violet-300">
                <Archive className="size-5" strokeWidth={1.7} />
              </div>
              <h3 className="text-sm font-semibold text-ink-50">این گفتگو در فهرست فعلی نمایش داده نمی‌شود</h3>
              <p className="max-w-sm text-xs leading-relaxed text-ink-300">
                گفتگوی انتخاب‌شده حذف نشده است؛ یکی از حالت‌های زیر آن را از فهرست بیرون برده است. برای بازگشت به آن،
                فیلتر مناسب را بردارید.
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                {filtersActive && (
                  <Button
                    size="sm"
                    variant="subtle"
                    onClick={() => {
                      setQuery("");
                      setRole("all");
                    }}
                  >
                    پاک‌کردن جستجو و فیلتر
                  </Button>
                )}
                {!includeArchived && (
                  <Button size="sm" variant="primary" onClick={() => setIncludeArchived(true)}>
                    نمایش گفتگوهای بایگانی‌شده
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              className="m-4 flex-1"
              title="گفتگویی انتخاب نشده"
              description="از فهرست، یک گفتگو را برای مشاهده انتخاب کنید."
            />
          )}
        </Surface>

        {/* Context rail */}
        <div className="hidden space-y-4 lg:block">
          <Panel title="قالب‌های آماده" kicker="پیام‌های پرتکرار آموزشگاه">
            <ul className="space-y-2">
              {messageTemplates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => composer.setDraft(t.text)}
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-right transition-colors hover:border-gold-500/30 hover:bg-gold-500/[0.04]"
                  >
                    <div className="text-[12.5px] font-medium text-ink-50">{t.label}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-400">{t.text}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="مسیرهای ارسال" kicker="وضعیت واقعی هر کانال">
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3.5">
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-violet-300">
                <Sparkles className="size-3" /> وضعیت
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-100">
                پیام داخلی به‌صورت واقعی ذخیره و در گفتگو نمایش داده می‌شود. تلگرام، بله، پیامک و ایمیل به سرویس سمت
                سرور نیاز دارند و تا آن زمان غیرفعال‌اند — توکن ربات هرگز نباید در مرورگر قرار گیرد.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      {/*
        Mounted for the SELECTED conversation, so the draft it rebuilds on open
        is always the right record's (H6). Success is reported only from the
        callbacks, both of which run after the repository's promise resolved.
      */}
      {active && (
        <ConversationManagerDialog
          open={managerOpen}
          conversation={active}
          onClose={() => setManagerOpen(false)}
          onSaved={(updated) =>
            notify({
              tone: "success",
              title: "گفتگو به‌روزرسانی شد",
              detail: `نام «${updated.name}» و موضوع آن ذخیره شد.`,
            })
          }
          onArchived={(updated) =>
            notify({
              tone: "success",
              title: updated.archived ? "گفتگو بایگانی شد" : "گفتگو بازگردانی شد",
              detail: updated.archived
                ? "برای دیدن آن، فیلتر «بایگانی‌شده‌ها» را فعال کنید."
                : "گفتگو دوباره در فهرست پیش‌فرض دیده می‌شود.",
            })
          }
        />
      )}
    </div>
  );
}
