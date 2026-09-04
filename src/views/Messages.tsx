import { useMemo, useState } from "react";
import { ArrowRight, Megaphone, Paperclip, Pin, Send, Sparkles } from "lucide-react";
import { conversations, messageTemplates, type Conversation } from "@/data/records";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { Avatar, Chip, PageHeader, Panel, SearchInput, useAsyncView } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";

const roleMeta: Record<Conversation["role"], { label: string; tone: "gold" | "violet" | "info" | "neutral" }> = {
  teacher: { label: "مدرس", tone: "gold" },
  student: { label: "هنرجو", tone: "info" },
  guardian: { label: "ولی", tone: "neutral" },
  group: { label: "گروهی", tone: "violet" },
};

export function MessagesView() {
  const { filter, notify } = useApp();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Conversation["role"] | "all">("all");
  const [activeId, setActiveId] = useState<string | null>(filter === "unused-sessions" ? "m2" : "m1");
  const [draft, setDraft] = useState("");
  const [sentThreads, setSentThreads] = useState<Record<string, { text: string; when: string }[]>>({});
  const [mobileThread, setMobileThread] = useState(false);
  const state = useAsyncView([filter]);

  const list = useMemo(
    () => conversations.filter((c) => (role === "all" || c.role === role) && (query === "" || c.name.includes(query) || c.topic.includes(query))),
    [role, query],
  );
  const active = conversations.find((c) => c.id === activeId);
  const unread = conversations.reduce((a, b) => a + b.unread, 0);

  const send = () => {
    if (!draft.trim() || !activeId) return;
    setSentThreads((p) => ({ ...p, [activeId]: [...(p[activeId] ?? []), { text: draft, when: "هم‌اکنون" }] }));
    setDraft("");
    notify({ tone: "success", title: "پیام ارسال شد", detail: "در پنل گیرنده و اپلیکیشن او نمایش داده می‌شود." });
  };

  if (state === "loading") return <LoadingState className="py-32" label="در حال باز کردن گفتگوها…" />;

  return (
    <div>
      <PageHeader
        kicker="ارتباط"
        title="پیام‌ها"
        description="گفتگوی مدیریت با مدرسین، هنرجویان و اولیا — همه در یک جریان."
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "اعلان عمومی", detail: "پیش‌نویس اطلاعیه برای همهٔ هنرجویان ساخته شد." })}>
              <Megaphone className="size-3.5" /> اطلاعیهٔ عمومی
            </Button>
            <Button size="sm" variant="primary" onClick={() => notify({ tone: "success", title: "گفتگوی جدید", detail: "گیرنده را انتخاب کنید." })}>
              گفتگوی جدید
            </Button>
          </>
        }
        meta={
          <>
            <span className="nums">{faNum(unread)} پیام خوانده‌نشده</span>
            <span>{faNum(conversations.length)} گفتگوی فعال</span>
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
              {(Object.keys(roleMeta) as Conversation["role"][]).map((r) => (
                <Chip key={r} label={roleMeta[r].label} active={role === r} onClick={() => setRole(role === r ? "all" : r)} />
              ))}
            </div>
          </div>
          <ul className="stagger max-h-[520px] flex-1 space-y-1 overflow-y-auto p-2">
            {list.length === 0 && <EmptyState className="m-2" title="گفتگویی پیدا نشد" description="فیلتر یا عبارت جستجو را تغییر دهید." />}
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => { setActiveId(c.id); setMobileThread(true); }}
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
                      <span className="mr-auto shrink-0 text-[10px] text-ink-500">{c.when}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-400">{c.topic}</span>
                    <span className="mt-1 block truncate text-[11.5px] text-ink-300">{c.last}</span>
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
                <button type="button" onClick={() => setMobileThread(false)} aria-label="بازگشت" className="flex size-8 items-center justify-center rounded-lg border border-white/[0.07] text-ink-300 lg:hidden">
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
                {[...active.messages, ...(sentThreads[active.id] ?? []).map((m) => ({ from: "me" as const, ...m }))].map((m, i) => (
                  <div key={i} className={cn("flex", m.from === "me" ? "justify-start" : "justify-end")} style={{ animation: `phrase-in 350ms var(--ease-phrase) ${i * 60}ms both` }}>
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl border px-3.5 py-2.5",
                        m.from === "me" ? "border-gold-500/25 bg-gold-500/[0.08] text-ink-50" : "border-white/[0.07] bg-white/[0.03] text-ink-100",
                      )}
                    >
                      <p className="text-[13px] leading-relaxed">{m.text}</p>
                      <div className={cn("mt-1 text-[10px]", m.from === "me" ? "text-gold-400/70" : "text-ink-500")}>{m.when}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/[0.06] p-3">
                <div className="flex items-end gap-2">
                  <button type="button" aria-label="پیوست" className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] text-ink-400 hover:text-ink-100">
                    <Paperclip className="size-4" />
                  </button>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={1}
                    placeholder="پیام خود را بنویسید…"
                    className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border border-white/[0.08] bg-ink-850 px-3 py-2 text-[13px] text-ink-50 outline-none placeholder:text-ink-500 focus:border-gold-500/50"
                  />
                  <Button variant="primary" size="sm" className="h-9 shrink-0" onClick={send} disabled={!draft.trim()}>
                    <Send className="size-3.5" /> ارسال
                  </Button>
                </div>
                <p className="mt-2 text-[10.5px] text-ink-500">Enter برای ارسال · Shift + Enter برای خط جدید</p>
              </div>
            </>
          ) : (
            <EmptyState className="m-4 flex-1" title="گفتگویی انتخاب نشده" description="از فهرست، یک گفتگو را برای مشاهده انتخاب کنید." />
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
          <Panel title="پیشنهاد ارتباطی" kicker="بر پایهٔ وضعیت امروز">
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3.5">
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-violet-300">
                <Sparkles className="size-3" /> پیشنهاد
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-100">
                ۵ هنرجو بیش از دو هفته غایب بوده‌اند. یک پیام کوتاه بازگشت می‌تواند پیش از پایان دوره اثر بگذارد.
              </p>
              <Button size="sm" variant="subtle" className="mt-3 w-full" onClick={() => { setActiveId("m2"); setMobileThread(true); }}>
                باز کردن کمپین بازگشت
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
