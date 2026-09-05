import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Clock3, CornerDownLeft, DoorOpen, GraduationCap, Plus, Receipt, Search, Sparkles, UserRound } from "lucide-react";
import { commandVerbs, navItems, nlCommands, quickActions, searchIndex, viewTitles, type NLCommand, type QuickActionDef, type SearchEntry, type Target } from "@/data/academy";
import { useApp } from "@/context/AppContext";
import { isViewId } from "@/lib/hashRoute";
import { navIcons } from "@/components/layout/Sidebar";
import { Kbd, StatusBadge } from "@/components/ds/primitives";
import { cn } from "@/utils/cn";

type Item =
  | { type: "nl"; id: string; title: string; subtitle?: string; cmd: NLCommand }
  | { type: "verb"; id: string; title: string; subtitle?: string; target: Target }
  | { type: "nav"; id: string; title: string; subtitle?: string; target: Target }
  | { type: "action"; id: string; title: string; subtitle?: string; action: QuickActionDef["id"] }
  | { type: "entry"; id: string; title: string; subtitle?: string; entry: SearchEntry }
  | { type: "recent"; id: string; title: string; subtitle?: string; target: Target };

type Group = { label: string; items: Item[] };

const RECENT_KEY = "ava:palette-recents";
const RECENT_MAX = 5;

type Recent = { id: string; title: string; subtitle?: string; view: Target["view"]; filter?: string; recordId?: string };

/** Ids/filters that may be placed into a route, mirroring `hashRoute` rules. */
const SAFE_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Recents come from localStorage, which the user can edit. They are turned
 * straight into navigation targets, so every field is validated instead of
 * cast — an unknown `view` would otherwise navigate the app to a bogus route.
 */
function isRecent(value: unknown): value is Recent {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.title !== "string") return false;
  if (typeof r.view !== "string" || !isViewId(r.view)) return false;
  if (r.subtitle !== undefined && typeof r.subtitle !== "string") return false;
  if (r.filter !== undefined && (typeof r.filter !== "string" || !SAFE_TOKEN.test(r.filter))) return false;
  if (r.recordId !== undefined && (typeof r.recordId !== "string" || !SAFE_TOKEN.test(r.recordId))) return false;
  return true;
}

function loadRecents(): Recent[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecent).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function saveRecents(list: Recent[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

const kindLabel: Record<SearchEntry["kind"], string> = { student: "هنرجو", teacher: "مدرس", class: "کلاس", invoice: "فاکتور" };
const kindIcon: Record<SearchEntry["kind"], ReactNode> = {
  student: <UserRound className="size-4" strokeWidth={1.8} />,
  teacher: <GraduationCap className="size-4" strokeWidth={1.8} />,
  class: <DoorOpen className="size-4" strokeWidth={1.8} />,
  invoice: <Receipt className="size-4" strokeWidth={1.8} />,
};

const normalize = (s: string) => s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").trim().toLowerCase();

export function CommandPalette() {
  const { paletteOpen, closePalette, navigate, openSheet } = useApp();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<NLCommand | null>(null);
  const [recents, setRecents] = useState<Recent[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Recent actions — the palette gets smarter the more you use it */
  useEffect(() => {
    if (paletteOpen) setRecents(loadRecents());
  }, [paletteOpen]);

  const pushRecent = (target: Target, title: string, subtitle?: string) => {
    setRecents((prev) => {
      const next: Recent[] = [
        { id: `${target.view}:${target.filter ?? ""}:${target.id ?? ""}`, title, subtitle, view: target.view, filter: target.filter, recordId: target.id },
        ...prev.filter((r) => r.id !== `${target.view}:${target.filter ?? ""}:${target.id ?? ""}`),
      ].slice(0, RECENT_MAX);
      saveRecents(next);
      return next;
    });
  };

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setActive(0);
      setResult(null);
      document.body.style.overflow = "hidden";
      window.setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [paletteOpen]);

  const groups = useMemo<Group[]>(() => {
    const q = normalize(query);
    if (!q) {
      const out: Group[] = [];
      if (recents.length)
        out.push({
          label: "اخیراً",
          items: recents.map((r) => ({ type: "recent", id: `recent-${r.id}`, title: r.title, subtitle: r.subtitle, target: { view: r.view, filter: r.filter, id: r.recordId } })),
        });
      out.push(
        { label: "چه کاری می‌خواهید انجام دهید؟", items: commandVerbs.map((c) => ({ type: "verb", id: c.id, title: c.label, subtitle: c.hint, target: c.target })) },
        { label: "فرمان‌های طبیعی", items: nlCommands.map((c) => ({ type: "nl", id: c.id, title: c.phrase, subtitle: "Enter برای اجرا", cmd: c })) },
        { label: "ایجاد", items: quickActions.map((a) => ({ type: "action", id: a.id, title: a.label, subtitle: a.hint, action: a.id })) },
        {
          label: "پرش سریع",
          items: navItems
            .filter((n) => n.id !== "dashboard")
            .slice(0, 6)
            .map((n) => ({ type: "nav", id: n.id, title: n.label, target: { view: n.id } })),
        },
      );
      return out;
    }
    const out: Group[] = [];
    const nl = nlCommands.filter((c) => normalize(c.phrase).includes(q) || c.keywords.some((k) => q.includes(normalize(k))));
    if (nl.length) out.push({ label: "اجرای فرمان", items: nl.map((c) => ({ type: "nl", id: c.id, title: c.phrase, subtitle: "Enter برای اجرا", cmd: c })) });
    const entries = searchIndex.filter((e) => normalize(e.title).includes(q) || normalize(e.subtitle).includes(q));
    (["student", "teacher", "class", "invoice"] as const).forEach((k) => {
      const list = entries.filter((e) => e.kind === k);
      if (list.length)
        out.push({
          label: { student: "هنرجویان", teacher: "مدرسین", class: "کلاس‌ها", invoice: "فاکتورها" }[k],
          items: list.map((e) => ({ type: "entry", id: e.id, title: e.title, subtitle: e.subtitle, entry: e })),
        });
    });
    const verbs = commandVerbs.filter((c) => normalize(c.label).includes(q) || normalize(c.hint).includes(q));
    if (verbs.length) out.push({ label: "اقدام‌ها", items: verbs.map((c) => ({ type: "verb", id: c.id, title: c.label, subtitle: c.hint, target: c.target })) });
    const nav = navItems.filter((n) => normalize(n.label).includes(q));
    if (nav.length) out.push({ label: "بخش‌ها", items: nav.map((n) => ({ type: "nav", id: n.id, title: n.label, target: { view: n.id } })) });
    const acts = quickActions.filter((a) => normalize(a.label).includes(q) || normalize(a.hint).includes(q));
    if (acts.length) out.push({ label: "اقدامات", items: acts.map((a) => ({ type: "action", id: a.id, title: a.label, subtitle: a.hint, action: a.id })) });
    return out;
  }, [query, recents]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => setActive(0), [query]);

  const run = (item: Item) => {
    if (item.type === "nl") {
      setResult(item.cmd);
      setQuery(item.cmd.phrase);
      return;
    }
    if (item.type === "nav" || item.type === "verb" || item.type === "recent") {
      pushRecent(item.target, item.title, item.subtitle);
      return navigate(item.target);
    }
    if (item.type === "entry") {
      pushRecent(item.entry.target, item.title, item.subtitle);
      return navigate(item.entry.target);
    }
    if (item.type === "action") {
      closePalette();
      openSheet(item.action);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return closePalette();
    if (result) {
      if (e.key === "Enter") {
        e.preventDefault();
        navigate(result.target);
      }
      if (e.key === "Backspace" && (e.target as HTMLInputElement).selectionStart === 0) {
        setResult(null);
        setQuery("");
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      run(flat[active]);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!paletteOpen) return null;

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center px-0 pb-0 sm:items-start sm:px-4 sm:pt-[14vh]"
      role="dialog"
      aria-modal="true"
      aria-label="جستجو و فرمان"
    >
      <button type="button" aria-label="بستن" onClick={closePalette} className="absolute inset-0 animate-fade-in bg-ink-950/70 backdrop-blur-sm" />
      {/* Mobile: action-sheet from the bottom · Desktop: centered command surface */}
      <div
        className="relative w-full max-w-2xl animate-sheet-up overflow-hidden rounded-t-3xl border border-white/[0.1] bg-ink-900 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] sm:rounded-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-white/15 sm:hidden"
          aria-hidden
        />
        <div className="absolute inset-x-0 top-0 h-px hairline-gold" />
        {/* input */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
          {result ? <Sparkles className="size-[18px] shrink-0 text-violet-300" /> : <Search className="size-[18px] shrink-0 text-gold-400" strokeWidth={1.9} />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (result) setResult(null);
            }}
            onKeyDown={onKey}
            placeholder="چه کاری می‌خواهید انجام دهید؟ جستجو یا فرمان…"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink-50 placeholder:text-ink-500 focus:outline-none"
            aria-autocomplete="list"
            aria-activedescendant={flat[active] ? `cmd-${flat[active].id}` : undefined}
          />
          <Kbd>Esc</Kbd>
        </div>

        {/* body */}
        <div ref={listRef} className="max-h-[62vh] overflow-y-auto p-2 sm:max-h-[56vh]" role={result ? undefined : "listbox"} aria-label="نتایج">
          {result ? (
            <ResultView cmd={result} onOpen={() => navigate(result.target)} onBack={() => { setResult(null); setQuery(""); inputRef.current?.focus(); }} />
          ) : flat.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-ink-200">چیزی پیدا نشد</p>
              <p className="mt-1.5 text-xs text-ink-400">می‌توانید فرمان بنویسید؛ مثلاً «کلاس‌های خالی سه‌شنبه را پیدا کن»</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mb-1">
                <div className="px-3 pb-1 pt-2 text-[10.5px] font-medium text-ink-500">{g.label}</div>
                {g.items.map((item) => {
                  runningIndex += 1;
                  const idx = runningIndex;
                  const isActive = idx === active;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      id={`cmd-${item.id}`}
                      data-index={idx}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => run(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors duration-[var(--sixteenth)]",
                        isActive ? "bg-white/[0.05]" : "hover:bg-white/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                          item.type === "nl"
                            ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                            : item.type === "verb" || item.type === "action"
                              ? "border-gold-500/20 bg-gold-500/[0.07] text-gold-400"
                              : item.type === "recent"
                                ? "border-white/[0.08] bg-white/[0.03] text-ink-300"
                                : "border-white/[0.07] bg-white/[0.03] text-ink-300",
                        )}
                      >
                        {item.type === "nl" && <Sparkles className="size-4" strokeWidth={1.8} />}
                        {item.type === "action" && <Plus className="size-4" strokeWidth={2.2} />}
                        {item.type === "recent" && <Clock3 className="size-4" strokeWidth={1.8} />}
                        {(item.type === "nav" || item.type === "verb") && (() => { const I = navIcons[item.target.view]; return <I className="size-4" strokeWidth={1.8} />; })()}
                        {item.type === "entry" && kindIcon[item.entry.kind]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink-50">{item.title}</span>
                        {item.subtitle && <span className="block truncate text-xs text-ink-400">{item.subtitle}</span>}
                      </span>
                      {item.type === "entry" && <span className="text-[10px] text-ink-500">{kindLabel[item.entry.kind]}</span>}
                      {isActive && (
                        <span className="flex items-center gap-1 text-[10px] text-ink-400">
                          <Kbd>
                            <CornerDownLeft className="size-3" />
                          </Kbd>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] text-ink-400">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Kbd>↵</Kbd> انتخاب</span>
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> حرکت</span>
            <span className="flex items-center gap-1"><Kbd>Esc</Kbd> بستن</span>
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Sparkles className="size-3 text-violet-300" /> فرمان‌های طبیعی پشتیبانی می‌شوند
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultView({ cmd, onOpen, onBack }: { cmd: NLCommand; onOpen: () => void; onBack: () => void }) {
  const toneOf = (t?: "critical" | "warning" | "info") => (t === "critical" ? "danger" : t === "warning" ? "warn" : "info");
  return (
    <div className="animate-phrase-in p-2">
      <div className="flex items-start justify-between gap-3 px-2">
        <div>
          <div className="text-[10.5px] font-medium text-violet-300">نتیجهٔ فرمان</div>
          <h3 className="mt-1 text-sm font-semibold text-ink-50">{cmd.resultTitle}</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-300">{cmd.summary}</p>
        </div>
        <button type="button" onClick={onBack} className="shrink-0 text-xs text-ink-400 hover:text-ink-100">
          بازگشت
        </button>
      </div>
      <ul className="stagger mt-3 space-y-1">
        {cmd.rows.map((r, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
            <span className="nums w-5 text-[10px] text-ink-500">{String(i + 1).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink-50">{r.title}</span>
              <span className="block truncate text-xs text-ink-400">{r.meta}</span>
            </span>
            <StatusBadge tone={toneOf(r.tone)} label={r.tone === "critical" ? "فوری" : r.tone === "warning" ? "پیگیری" : "آزاد"} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between px-2">
        <span className="text-[10.5px] text-ink-500">Enter برای باز کردن در بخش مربوطه</span>
        <button type="button" onClick={onOpen} className="group inline-flex h-9 items-center gap-1.5 rounded-xl bg-gold-500 px-3.5 text-xs font-semibold text-ink-950 hover:bg-gold-400">
          باز کردن در {viewTitles[cmd.target.view]}
          <ChevronLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Test-only seam. Exposes the localStorage-recents parsing so its validation
 * can be covered directly; not part of the component's public API.
 */
export const __testing = { RECENT_KEY, loadRecents, isRecent };
