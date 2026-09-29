import { useEffect, useState } from "react";
import { Bell, CalendarDays, LayoutGrid, Menu, Search, Users, Wallet } from "lucide-react";
import { viewTitles } from "@/lib/navigation";
import { faNum, faToday } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/domains/auth/AuthContext";
import { roleLabel } from "@/domains/auth/permissions";
import { useAcademyNow } from "@/domains/shared/clock";
import { useDayPulse } from "@/domains/shared/useDayPulse";
import { useBranding } from "@/domains/branding/useBranding";
import { academyIsoDate } from "@/views/relations/academyDay";
import { Kbd } from "@/components/ds/primitives";
import { Avatar } from "@/components/ds/patterns";
import { BrandMark } from "@/components/layout/Sidebar";
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
        "group flex h-11 w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-ink-900/60 px-4 text-right text-[12.5px] text-ink-400 transition-all duration-[var(--eighth)] ease-[var(--ease-resonance)] hover:border-gold-500/35 hover:bg-ink-900 hover:text-ink-200 focus-visible:border-gold-500/50",
        className,
      )}
    >
      <span className="flex flex-1 items-center gap-3 truncate">
        <Search className="size-4 shrink-0 text-ink-400 transition-colors group-hover:text-gold-400" strokeWidth={1.9} />
        <span className="truncate">جستجو در هنرجویان، مدرسین، کلاس‌ها، فاکتورها… یا یک فرمان بنویسید</span>
      </span>
      {/* The shortcut is written with the modifier the visitor actually has. */}
      <span className="flex shrink-0 items-center gap-1">
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */
/**
 * The chrome row of the reference design.
 *
 * Right to left: the academy's identity (its own mark and name — the brand
 * block used to live only in the rail), the command field that spans the middle
 * as the one wide control on the row, then the day's live count, the bell, and
 * the operator card: avatar, the section currently open, and the role.
 *
 * The section name is not a second navigation — it is the same `viewTitles`
 * entry the rail reads, so the two can never disagree about where you are.
 */
export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { view, notify } = useApp();
  // Live count from the scheduling seam (M10) — it moves when sessions change.
  // GAP-010: use same academy date source as Dashboard/Hero for coherent display.
  const now = useAcademyNow();
  const todayIso = academyIsoDate();
  const pulse = useDayPulse(todayIso, now);
  const live = pulse.live;
  const [notified, setNotified] = useState(false);
  const { branding } = useBranding();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.05] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onMenu} aria-label="باز کردن منو" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] text-ink-200 lg:hidden">
          <Menu className="size-5" strokeWidth={1.8} />
        </button>

        {/* the academy's own identity, on the row that frames every section */}
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark className="hidden sm:flex" />
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-bold tracking-tight text-ink-50">{branding.academyName}</div>
            <div className="mt-0.5 hidden truncate text-[10px] tracking-wide text-gold-500/85 sm:block">{branding.tagline}</div>
          </div>
        </div>

        {/*
          The wide command field is the DESKTOP row's element, so it appears at
          the shell's own desktop threshold (`lg`), not at `md`. Below `lg` the
          rail is hidden and the bottom bar carries navigation — the compact
          shell — and this row has to fit the same width: the field's own
          min-content is ~481px and the operator card is `shrink-0` at ~206px,
          which together overflowed the 720px content box at 768px and pushed
          the whole row (and the page) sideways. At `lg` and up nothing changes.
        */}
        <div className="mx-auto hidden w-full max-w-xl lg:block">
          <CommandSearchTrigger />
        </div>

        <div className="mr-auto flex shrink-0 items-center gap-2 lg:mr-0">
          <CommandSearchTrigger compact className="lg:hidden" />
          {live > 0 && (
            <span className="hidden h-10 items-center gap-2 rounded-xl border border-ok-500/20 bg-ok-500/[0.07] px-3 text-xs text-ok-400 xl:flex">
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
              notify({ tone: "info", title: "اعلان‌ها نمونهٔ ثابت هستند", detail: "اعلان زندهٔ واقعی به سرور نیاز دارد و در دمو وجود ندارد." });
            }}
            className="relative flex size-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-ink-200 transition-colors hover:bg-white/[0.06]"
          >
            <Bell className="size-[18px]" strokeWidth={1.8} />
            {!notified && <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-gold-400 ring-2 ring-ink-950" />}
          </button>

          {/* the operator card: who is signed in, and which section they are in */}
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] py-1.5 pe-1.5 ps-3">
            <div className="hidden min-w-0 text-right sm:block">
              <div className="truncate text-[12px] font-semibold leading-tight text-ink-50">{viewTitles[view]}</div>
              <div className="truncate text-[10px] leading-tight text-ink-400">
                {user ? `${user.name} · ${roleLabel(user.role)}` : faToday(todayIso)}
              </div>
            </div>
            <Avatar name={user?.name ?? "؟"} size="sm" ring="gold" className="hidden sm:inline-flex" />
          </div>
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
  const { canAccess, user } = useAuth();
  /* The same presentation policy the rail applies: for a teacher the landing
     section is their own day, and it is named that way here too. Authorization
     is unchanged — `canAccess` still decides what the bar may show. */
  const items = [
    { id: "dashboard" as const, label: user?.role === "teacher" ? "امروز من" : "داشبورد", icon: LayoutGrid },
    { id: "schedule" as const, label: "برنامه", icon: CalendarDays },
    { id: "students" as const, label: "هنرجویان", icon: Users },
    { id: "finance" as const, label: "مالی", icon: Wallet },
  ].filter((it) => canAccess(it.id));
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-30 overflow-hidden rounded-2xl border border-gold-500/15 bg-ink-950/85 shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:hidden"
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
              className={cn("relative flex flex-col items-center justify-center gap-1 text-[10.5px]", active ? "text-gold-300" : "text-ink-400")}
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
