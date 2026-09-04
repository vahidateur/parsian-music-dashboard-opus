import { BarChart3, CalendarDays, ChevronDown, ClipboardCheck, DoorOpen, GraduationCap, LayoutGrid, Library, MessageSquare, PanelLeftClose, PanelLeftOpen, Palette, Settings, Users, Wallet, X, type LucideIcon } from "lucide-react";
import { academy, manager, navGroups, type ViewId } from "@/data/academy";
import { useApp } from "@/context/AppContext";
import { NavItem } from "@/components/ds/blocks";
import { cn } from "@/utils/cn";

export const navIcons: Record<ViewId, LucideIcon> = {
  dashboard: LayoutGrid,
  students: Users,
  teachers: GraduationCap,
  classes: DoorOpen,
  schedule: CalendarDays,
  attendance: ClipboardCheck,
  finance: Wallet,
  reports: BarChart3,
  messages: MessageSquare,
  library: Library,
  settings: Settings,
  "design-system": Palette,
};

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold-500/30 bg-gradient-to-br from-gold-500/15 to-transparent", className)} aria-hidden>
      <svg viewBox="0 0 32 32" className="size-6 text-gold-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 16h3l2-6 3 12 3-14 3 16 3-10 2 4h3" />
      </svg>
    </span>
  );
}

function Roles() {
  const { notify } = useApp();
  const roles = ["مدیریت", "مدرس", "هنرجو"];
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div className="mb-2 flex items-center justify-between text-[10.5px] text-ink-400">
        <span>سامانهٔ یکپارچه</span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-ok-500" /> همگام
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {roles.map((r, i) => (
          <button
            key={r}
            type="button"
            onClick={() => i > 0 && notify({ tone: "info", title: `پیش‌نمایش پنل ${r}`, detail: "این سطح از همین منبع داده تغذیه می‌شود." })}
            className={cn(
              "h-7 rounded-lg text-[11px] transition-colors",
              i === 0 ? "bg-gold-500/15 font-medium text-gold-300" : "text-ink-400 hover:bg-white/[0.04] hover:text-ink-100",
            )}
            aria-pressed={i === 0}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SidebarContent({ collapsed = false, onClose, onToggleRail }: { collapsed?: boolean; onClose?: () => void; onToggleRail?: () => void }) {
  const { view, navigate } = useApp();

  return (
    <div className="flex h-full flex-col">
      {/* brand */}
      <div className={cn("flex items-center gap-3 px-4 pt-5 pb-4", collapsed && "justify-center px-0")}>
        <BrandMark />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink-50">{academy.name}</div>
            <div className="truncate text-[11px] text-ink-400">{academy.tagline} · پنل مدیریت</div>
          </div>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="بستن منو" className="flex size-8 items-center justify-center rounded-lg text-ink-300 hover:bg-white/[0.05]">
            <X className="size-4" />
          </button>
        )}
      </div>

      <nav className={cn("flex-1 overflow-y-auto px-3", collapsed && "px-2")} aria-label="ناوبری اصلی">
        {navGroups.map((group, gi) => (
          <div key={group.id} className={cn(gi > 0 && (collapsed ? "mt-2" : "mt-4"))}>
            {group.label &&
              (collapsed ? (
                <div className="mx-2 mb-2 h-px bg-white/[0.06]" aria-hidden />
              ) : (
                <div className="mb-1.5 px-3 text-[10px] font-medium tracking-wide text-ink-500">{group.label}</div>
              ))}
            <div className="space-y-0.5">
              {group.items.map((n) => (
                <NavItem
                  key={n.id}
                  icon={navIcons[n.id]}
                  label={n.label}
                  badge={n.badge}
                  active={view === n.id}
                  collapsed={collapsed}
                  onClick={() => {
                    navigate({ view: n.id });
                    onClose?.();
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("space-y-3 p-3", collapsed && "p-2")}>
        {!collapsed && <Roles />}
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-right transition-colors hover:border-white/[0.12]",
            collapsed && "justify-center border-0 bg-transparent p-1",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-wood-400 to-wood-700 text-sm font-bold text-ink-50 ring-2 ring-gold-500/30">
            {manager.initials}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-50">{manager.name}</span>
                <span className="block truncate text-[11px] text-ink-400">{manager.role}</span>
              </span>
              <ChevronDown className="size-4 text-ink-400" />
            </>
          )}
        </button>
        {onToggleRail && (
          <button
            type="button"
            onClick={onToggleRail}
            aria-label={collapsed ? "باز کردن نوار کناری" : "فشرده کردن نوار کناری"}
            title={collapsed ? "باز کردن نوار کناری" : "فشرده کردن نوار کناری"}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border border-white/[0.06] text-ink-400 transition-colors hover:border-white/[0.12] hover:text-ink-100",
              collapsed ? "justify-center p-1.5" : "p-2",
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" strokeWidth={1.8} /> : <><PanelLeftClose className="size-4 shrink-0" strokeWidth={1.8} /><span className="text-xs">فشرده‌سازی نوار</span></>}
          </button>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { railCollapsed, toggleRail } = useApp();
  return (
    <>
      {/* Desktop: full sidebar at xl, icon rail at lg; collapse state is user-controlled & remembered */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-30 hidden border-l border-white/[0.06] bg-ink-900/80 backdrop-blur-xl transition-[width] duration-[var(--eighth)] ease-[var(--ease-resonance)] lg:block",
          "lg:w-[var(--rail-w)]",
          railCollapsed ? "xl:w-[var(--rail-w)]" : "xl:w-[var(--sidebar-w)]",
        )}
      >
        <div className="hidden h-full xl:block">
          <SidebarContent collapsed={railCollapsed} onToggleRail={toggleRail} />
        </div>
        <div className="h-full xl:hidden">
          <SidebarContent collapsed />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="منو">
          <button type="button" aria-label="بستن" onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink-950/70 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 right-0 w-[86vw] max-w-[320px] animate-sheet-in border-l border-white/[0.06] bg-ink-900 shadow-2xl" style={{ animationName: "sheet-in-rtl" }}>
            <SidebarContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
