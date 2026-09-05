import { useEffect, useState } from "react";
import { getRuntimeConfig } from "@/api/config";
import { AppProvider, useApp } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import { defaultViewFor } from "@/domains/auth/permissions";
import { LoginView } from "@/views/Login";
import { EmptyState, LoadingState } from "@/components/ds/states";
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

/** Renders the requested view only when the session carries the permission. */
function ViewOutlet() {
  const { view, navigate } = useApp();
  const { canAccess, permissions } = useAuth();

  if (!canAccess(view)) {
    return (
      <EmptyState
        title="دسترسی ندارید"
        description="برای مشاهدهٔ این بخش، دسترسی لازم به حساب شما داده نشده است. با مدیر آموزشگاه تماس بگیرید."
        action="بازگشت به بخش مجاز"
        onAction={() => navigate({ view: defaultViewFor({ permissions }) })}
      />
    );
  }
  const Current = VIEWS[view] ?? Dashboard;
  return <Current />;
}

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
            <ViewOutlet />
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

/** Auth gate: restoring → spinner, unauthenticated → login, else the app shell. */
function AuthGate() {
  const { status } = useAuth();

  if (status === "restoring") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <LoadingState label="در حال بررسی نشست…" />
      </div>
    );
  }
  if (status === "unauthenticated") return <LoginView />;

  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

/**
 * Boot guard. If the data source is misconfigured we render nothing but the
 * error: continuing would mean serving DemoStore fixtures to someone who
 * believes they configured a production backend. Failing loudly is the whole
 * point — see docs/architecture/environments.md.
 */
function ConfigGate({ children }: { children: React.ReactNode }) {
  const { error } = getRuntimeConfig();
  if (!error) return <>{children}</>;
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-ink-950 px-4 text-ink-50"
      role="alert"
    >
      <div className="max-w-lg rounded-2xl border border-danger-500/30 bg-danger-500/[0.06] p-6 text-center">
        <h1 className="text-[17px] font-semibold text-danger-400">پیکربندی محیط نامعتبر است</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-200">
          برنامه اجرا نشد تا از نمایش دادهٔ نمایشی به‌جای دادهٔ واقعی جلوگیری شود.
        </p>
        <p dir="ltr" className="mt-4 rounded-xl bg-ink-900/80 p-3 text-left text-[11.5px] leading-relaxed text-ink-300">
          {error}
        </p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <ConfigGate>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ConfigGate>
  );
}
