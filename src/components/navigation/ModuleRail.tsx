/**
 * A contextual rail belonging to one module, not the application's navigation.
 * The global shell remains untouched; callers render this after their content so
 * it appears on the LEFT in the RTL document.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, LockKeyhole, type LucideIcon } from "lucide-react";
import { faNum } from "@/lib/format";
import { cn } from "@/utils/cn";

export interface ModuleRailItem {
  id: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
  /** A capability gap: visible in the information architecture, never faked. */
  disabled?: boolean;
  hint?: string;
}
export interface ModuleRailGroup { id: string; label?: string; items: ModuleRailItem[]; }

export function ModuleRail({
  kicker, title, groups, activeId, onSelect, action, footer,
}: {
  kicker?: string;
  title: string;
  groups: ModuleRailGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  action?: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <aside aria-label={title} className="shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:w-[232px] lg:self-start lg:overflow-y-auto lg:pl-1">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="mb-3 flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-[12.5px] text-ink-200 transition hover:border-white/[0.14] lg:hidden">
        <span className="text-gold-300">{title}</span>
        <ChevronDown className={cn("size-4 text-ink-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div className={cn("space-y-4", !open && "hidden lg:block")}>
        {(kicker || action) && <div className="space-y-3">{kicker && <p className="px-3 text-[10px] font-medium tracking-[0.22em] text-gold-300/80">{kicker}</p>}{action}</div>}
        {groups.map((group) => (
          <div key={group.id}>
            {group.label && <p className="mb-1.5 px-3 text-[10.5px] text-ink-500">{group.label}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.id === activeId;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={item.disabled}
                      onClick={() => !item.disabled && onSelect(item.id)}
                      aria-current={active ? "true" : undefined}
                      title={item.hint}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-right text-[12.5px] transition-colors",
                        item.disabled ? "cursor-not-allowed text-ink-600" : active ? "bg-gold-500/[0.10] text-gold-100" : "text-ink-300 hover:bg-white/[0.03] hover:text-ink-100",
                      )}
                    >
                      <span aria-hidden className={cn("absolute inset-y-1.5 right-0 w-px rounded-full bg-gold-400/70", active ? "opacity-100" : "opacity-0")} />
                      {Icon && <Icon className={cn("size-4 shrink-0", item.disabled ? "text-ink-700" : active ? "text-gold-300" : "text-ink-500 group-hover:text-ink-300")} strokeWidth={1.7} aria-hidden />}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.disabled ? <LockKeyhole className="size-3 shrink-0 text-ink-700" aria-label="نیازمند پشتیبانی سرور" /> : item.count !== undefined ? <span className={cn("nums shrink-0 text-[10.5px]", active ? "text-gold-200/80" : "text-ink-500")}>{faNum(item.count)}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {footer && <div className="px-1 pb-2">{footer}</div>}
      </div>
    </aside>
  );
}
