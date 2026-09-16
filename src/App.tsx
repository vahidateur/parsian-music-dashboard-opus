import { Suspense, lazy, useEffect, useState } from "react";
import { getRuntimeConfig } from "@/api/config";
import { AppProvider, useApp } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import { defaultViewFor } from "@/domains/auth/permissions";
import { LoginView } from "@/views/Login";
import { SessionGuard } from "@/security/SessionGuard";
import { DataLifecycleGate } from "@/components/lifecycle/DataLifecycleGate";
import { useApplyBranding, useBranding } from "@/domains/branding/useBranding";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { cn } from "@/utils/cn";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav, TopBar } from "@/components/layout/TopBar";
import { CommandPalette } from "@/components/overlays/CommandPalette";
import { useInstrumentCatalogSync } from "@/domains/instruments/useInstruments";
import { useDemoLibraryFile } from "@/domains/library/useLibrary";
import { ActionSheet, Toasts } from "@/components/overlays/ActionSheet";
import { Dashboard } from "@/views/Dashboard";

/*
  Route-level code splitting (M11/I6).

  Every routed view except the two first-paint surfaces (Login, kept static in
  `AuthGate`, and Dashboard, the landing view for most roles) is a lazy chunk:
  Vite emits each as a hashed `assets/[name]-[hash].js` file loaded from the
  same origin, which the enforced CSP (`script-src 'self'`) already permits.
  `Suspense` suspends inside `ViewOutlet` itself so the shell — rails, top
  bar, palette — never unmounts while a view chunk is in flight.

  Views load in two workspace groups, not one chunk per route: the academic
  day (students → classes → attendance …) chains visits, so one fetch serves
  the whole chain, while the low-frequency operations surfaces share another.
  The group modules are re-export barrels (`src/views/lazy/`); the views
  themselves are untouched.
*/
const DesignSystemView = lazy(() => import("@/views/DesignSystemView").then((m) => ({ default: m.DesignSystemView })));
const academicViews = () => import("@/views/lazy/academicViews");
const operationsViews = () => import("@/views/lazy/operationsViews");
const StudentsView = lazy(() => academicViews().then((m) => ({ default: m.StudentsView })));
const TeachersView = lazy(() => academicViews().then((m) => ({ default: m.TeachersView })));
const ClassesView = lazy(() => academicViews().then((m) => ({ default: m.ClassesView })));
const SchedulingView = lazy(() => academicViews().then((m) => ({ default: m.SchedulingView })));
const AttendanceView = lazy(() => academicViews().then((m) => ({ default: m.AttendanceView })));
const CompensationView = lazy(() => academicViews().then((m) => ({ default: m.CompensationView })));
const FinanceView = lazy(() => operationsViews().then((m) => ({ default: m.FinanceView })));
const ReportsView = lazy(() => operationsViews().then((m) => ({ default: m.ReportsView })));
const MessagesView = lazy(() => operationsViews().then((m) => ({ default: m.MessagesView })));
const LibraryView = lazy(() => operationsViews().then((m) => ({ default: m.LibraryView })));
const SettingsView = lazy(() => operationsViews().then((m) => ({ default: m.SettingsView })));

const VIEWS = {
  dashboard: Dashboard,
  students: StudentsView,
  teachers: TeachersView,
  classes: ClassesView,
  schedule: SchedulingView,
  attendance: AttendanceView,
  compensation: CompensationView,
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
  return (
    <Suspense fallback={<LoadingState label="در حال باز شدن بخش…" />}>
      <Current />
    </Suspense>
  );
}

function Shell() {
  const { view, filter, detailId, openPalette, closePalette, paletteOpen, railCollapsed } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  // Instruments are runtime data, but ~60 call sites need a synchronous
  // Persian label while rendering. This keeps that lookup in step with the
  // repository for the whole session. See domains/instruments/catalog.ts.
  useInstrumentCatalogSync();

  /*
    Demo content provisioning — the bytes behind the seeded library file.

    Runs inside the shell, i.e. after the access gate and after authentication,
    so a visitor who never gets in never touches storage. Idempotent, and the
    ONE call site for demo file provisioning: the lifecycle phase gates this
    call by environment mode rather than changing the Library domain.
  */
  useDemoLibraryFile();

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
      {/* Idle + absolute session expiry for the authenticated app. */}
      <SessionGuard />
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

/**
 * Applies the persisted academy identity to the document root.
 *
 * Placement is the point: it sits BELOW `DataLifecycleGate` (branding is a
 * domain read, so the environment has to be decided first) and ABOVE
 * `AuthProvider` and every surface, because the login screen carries the same
 * identity as the shell. The read is the branding domain's own hook and the
 * write is its existing tested seam, `useApplyBranding` — the app never touches
 * the CSS layer itself (docs/engineering/DECISIONS.md, D2).
 */
function BrandingApplication() {
  const { branding } = useBranding();
  useApplyBranding(branding);
  return null;
}

/**
 * Boot order matters:
 *
 * 1. `ConfigGate` — refuse to run on a misconfigured data source.
 * 2. `DataLifecycleGate` — decide what KIND of local environment this is
 *    (EMPTY vs DEMO) before anything reads it. Above `AuthProvider`, because
 *    authentication resolves the signed-in user against the environment.
 * 3. `AuthProvider` / `AuthGate` — session, then the shell and the views.
 *
 * No view below this point branches on demo/empty: the decision is made once,
 * here, and demo-only side effects consult the lifecycle state rather than
 * guessing from row counts.
 */
export default function App() {
  return (
    <ConfigGate>
      <DataLifecycleGate>
        <BrandingApplication />
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </DataLifecycleGate>
    </ConfigGate>
  );
}
