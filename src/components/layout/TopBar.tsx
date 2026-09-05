import { useEffect, useState } from "react";
import { Bell, CalendarDays, LayoutGrid, Menu, Search, Users, Wallet } from "lucide-react";
import { schedule, statusOf, viewTitles } from "@/data/academy";
import { faNum, faToday } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/domains/auth/AuthContext";
import { Kbd } from "@/components/ds/primitives";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/* Command search trigger — a door to the command palette              */
/* ------------------------------------------------------------------ */
export function CommandSearchTrigger({ className, compact }: { className?: string; compact?: boolean }) {
  const { openPalette } = useApp();
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  if (compact) {
    return (
      <button
        type="button"
        onClick={openPalette}
        aria-label="جستجو و فرمان"
        className={cn("flex size-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-ink-200 hover:bg-white/[0.06]", className)}
      >
        <Search className="size-[18px]" strokeWidth={1.8} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        "group flex h-10 w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-ink-900/70 px-3.5 text-right text-sm text-ink-400 transition-all duration-[var(--eighth)] ease-[var(--ease-resonance)] hover:border-gold-500/30 hover:bg-ink-900 focus-visible:border-gold-500/50",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-ink-400 transition-colors group-hover:text-gold-400" strokeWidth={1.9} />
      <span className="flex-1 truncate">جستجو در هنرجویان، مدرسین، کلاس‌ها، فاکتورها… یا یک فرمان بنویسید</span>
      <span className="flex items-center gap-1">
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */
export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { view, notify } = useApp();
  const live = schedule.filter((s) => statusOf(s) === "live").length;
  const [notified, setNotified] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.05] bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onMenu} aria-label="باز کردن منو" className="flex size-10 items-center justify-center rounded-xl border border-white/[0.07] text-ink-200 lg:hidden">
          <Menu className="size-5" strokeWidth={1.8} />
        </button>

        <div className="min-w-0 shrink-0">
          <div className="text-sm font-semibold text-ink-50">{viewTitles[view]}</div>
          <div className="hidden truncate text-[11px] text-ink-400 sm:block">{faToday()}</div>
        </div>

        <div className="mx-auto hidden w-full max-w-xl md:block">
          <CommandSearchTrigger />
        </div>

        <div className="mr-auto flex items-center gap-2 md:mr-0">
          <CommandSearchTrigger compact className="md:hidden" />
          {live > 0 && (
            <span className="hidden h-10 items-center gap-2 rounded-xl border border-ok-500/20 bg-ok-500/[0.06] px-3 text-xs text-ok-400 lg:flex">
              <span className="relative flex size-1.5">
                <span className="ring-live absolute inline-flex size-1.5 rounded-full bg-ok-500" />
                <span className="relative inline-flex size-1.5 rounded-full bg-ok-400" />
              </span>
              {faNum(live)} کلاس در حال برگزاری
            </span>
          )}
          <button
            type="button"
            aria-label="اعلان‌ها — ۳ اعلان جدید"
            onClick={() => {
              setNotified(true);
              notify({ tone: "info", title: "۳ اعلان جدید", detail: "۲ پرداخت موفق · ۱ درخواست جلسهٔ جبرانی" });
            }}
            className="relative flex size-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-ink-200 transition-colors hover:bg-white/[0.06]"
          >
            <Bell className="size-[18px]" strokeWidth={1.8} />
            {!notified && <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-gold-400 ring-2 ring-ink-950" />}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile bottom navigation                                            */
/* ------------------------------------------------------------------ */
export function BottomNav() {
  const { view, navigate, openPalette } = useApp();
  const { canAccess } = useAuth();
  const items = [
    { id: "dashboard" as const, label: "داشبورد", icon: LayoutGrid },
    { id: "schedule" as const, label: "برنامه", icon: CalendarDays },
    { id: "students" as const, label: "هنرجویان", icon: Users },
    { id: "finance" as const, label: "مالی", icon: Wallet },
  ].filter((it) => canAccess(it.id));
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-ink-950/85 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="ناوبری موبایل"
    >
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const active = view === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => navigate({ view: it.id })}
              aria-current={active ? "page" : undefined}
              className={cn("flex flex-col items-center justify-center gap-1 text-[10.5px]", active ? "text-gold-300" : "text-ink-400")}
            >
              <it.icon className="size-5" strokeWidth={active ? 2 : 1.7} />
              {it.label}
              {active && <span className="absolute bottom-1.5 h-0.5 w-5 rounded-full bg-gold-500" />}
            </button>
          );
        })}
        <button type="button" onClick={openPalette} className="flex flex-col items-center justify-center gap-1 text-[10.5px] text-ink-400">
          <Search className="size-5" strokeWidth={1.7} />
          فرمان
        </button>
      </div>
    </nav>
  );
}
