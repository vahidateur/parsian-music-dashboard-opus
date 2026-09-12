/**
 * Messages — repository-backed chat.
 *
 * Previously this view read a static fixture and answered every send with a
 * toast saying the message was "recorded in the demo". It now writes through
 * `ChatRepository`, so a sent message genuinely persists, appears immediately,
 * and survives a reload.
 *
 * Delivery honesty (§37): in-app messages are really delivered (the recipient
 * reads the same store) and are shown as sent. Any other transport needs a
 * server, so those messages are stored with an `unavailable` status and the
 * row says so — nothing claims a send that did not happen.
 *
 * The layout, spacing and design tokens are unchanged from the original view.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Megaphone, Paperclip, Pin, Send, Sparkles } from "lucide-react";
import { messageTemplates } from "@/data/records";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Avatar, Chip, PageHeader, Panel, SearchInput } from "@/components/ds/patterns";
import { getChatRepository } from "@/domains/registry";
import { useConversations, useMessages } from "@/domains/chat/useChat";
import { apiErrorFromThrown } from "@/api/errors";
import type { ChatMessage, ChatParticipantRole } from "@/domains/chat/types";
import { cn } from "@/utils/cn";

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);

  const listParams = useMemo(
    () => ({ per_page: 100, ...(role !== "all" ? { role } : {}), ...(query ? { search: query } : {}) }),
    [role, query],
  );
  const { items: threads, loading, error, reload } = useConversations(listParams);
  const { items: messages } = useMessages(activeId ?? undefined);

  // Select the first thread once the list arrives, without clobbering a manual
  // choice or re-selecting after the user filters it away.
  useEffect(() => {
    if (!activeId && threads.length > 0) setActiveId(threads[0].id);
  }, [activeId, threads]);

  const active = threads.find((t) => t.id === activeId);
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

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    try {
      const message = await getChatRepository().sendMessage({ conversationId: activeId, body });
      setDraft("");
      // The toast reports what actually happened, per message status.
      if (message.status === "sent") {
        notify({ tone: "success", title: "پیام ارسال شد", detail: "پیام در گفتگوی داخلی ثبت و ذخیره شد." });
      } else {
        notify({
          tone: "danger",
          title: "پیام ارسال نشد",
          detail: message.statusReason ?? "این مسیر ارسال در دسترس نیست.",
        });
      }
    } catch (cause) {
      notify({ tone: "danger", title: "ارسال پیام ناموفق بود", detail: apiErrorFromThrown(cause).message });
    } finally {
      setSending(false);
    }
  }, [draft, activeId, sending, notify]);

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
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                try {
                  const created = await getChatRepository().createConversation({
                    name: "گفتگوی جدید",
                    role: "staff",
                    topic: "بدون موضوع",
                  });
                  setActiveId(created.id);
                  setMobileThread(true);
                  notify({ tone: "success", title: "گفتگو ساخته شد", detail: "نام و موضوع را می‌توانید ویرایش کنید." });
                } catch (cause) {
                  notify({
                    tone: "danger",
                    title: "ساخت گفتگو ناموفق بود",
                    detail: apiErrorFromThrown(cause).message,
                  });
                }
              }}
            >
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
            </div>
          </div>
          <ul className="stagger max-h-[520px] flex-1 space-y-1 overflow-y-auto p-2">
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
                  <div className="truncate text-[14px] font-semibold text-ink-50">{active.name}</div>
                  <div className="truncate text-[11.5px] text-ink-400">{active.topic}</div>
                </div>
                <StatusBadge tone={roleMeta[active.role].tone} label={roleMeta[active.role].label} glyph={false} />
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
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
                    Attachments need object storage plus a messaging gateway.
                    The control is disabled and explains itself rather than
                    pretending to upload.
                  */}
                  <button
                    type="button"
                    disabled
                    aria-label="پیوست فایل — نیازمند سرور"
                    title="ارسال پیوست به فضای ذخیره‌سازی سرور نیاز دارد و در نسخهٔ دمو فعال نیست."
                    className="flex size-9 shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-white/[0.07] text-ink-600 opacity-50"
                  >
                    <Paperclip className="size-4" />
                  </button>
                  <label htmlFor="chat-draft" className="sr-only">
                    متن پیام
                  </label>
                  <textarea
                    id="chat-draft"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
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
                <p className="mt-2 text-[10.5px] text-ink-500">Enter برای ارسال · Shift + Enter برای خط جدید</p>
              </div>
            </>
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
                    onClick={() => setDraft(t.text)}
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
    </div>
  );
}
