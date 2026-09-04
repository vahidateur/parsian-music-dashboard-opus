import { useEffect, useState } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { cn } from "@/utils/cn";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav, TopBar } from "@/components/layout/TopBar";
import { CommandPalette } from "@/components/overlays/CommandPalette";
import { ActionSheet, Toasts } from "@/components/overlays/ActionSheet";
import { Dashboard } from "@/views/Dashboard";
import { DesignSystemView } from "@/views/DesignSystemView";
import { StudentsView } from "@/views/Students";
import { TeachersView } from "@/views/Teachers";
import { ClassesView } from "@/views/Classes";
import { SchedulingView } from "@/views/Scheduling";
import { AttendanceView } from "@/views/Attendance";
import { FinanceView } from "@/views/Finance";
import { ReportsView } from "@/views/Reports";
import { MessagesView } from "@/views/Messages";
import { LibraryView } from "@/views/Library";
import { SettingsView } from "@/views/Settings";

const VIEWS = {
  dashboard: Dashboard,
  students: StudentsView,
  teachers: TeachersView,
  classes: ClassesView,
  schedule: SchedulingView,
  attendance: AttendanceView,
  finance: FinanceView,
  reports: ReportsView,
  messages: MessagesView,
  library: LibraryView,
  settings: SettingsView,
  "design-system": DesignSystemView,
} as const;

function Shell() {
  const { view, filter, detailId, openPalette, closePalette, paletteOpen, railCollapsed } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  // Global command shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (paletteOpen) closePalette();
        else openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette, closePalette, paletteOpen]);

  useEffect(() => setMenuOpen(false), [view]);

  return (
    <div className="min-h-screen bg-ink-950 text-ink-50">
      {/* stage light — a single, quiet warm glow from the top-right like a spotlight over the hall */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 480px at 88% -10%, rgba(138,90,52,0.16), transparent 60%), radial-gradient(700px 400px at 10% 110%, rgba(110,91,184,0.08), transparent 60%)",
        }}
      />

      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className={cn("relative z-10 lg:mr-[var(--rail-w)]", !railCollapsed && "xl:mr-[var(--sidebar-w)]")}>
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
          <div key={`${view}-${filter ?? ""}-${detailId ?? ""}`} className="animate-phrase-in">
            {(() => {
              const Current = VIEWS[view] ?? Dashboard;
              return <Current />;
            })()}
          </div>
        </main>
      </div>

      <BottomNav />
      <CommandPalette />
      <ActionSheet />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
