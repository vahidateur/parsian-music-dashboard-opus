/**
 * Target seam — demo-only feature slots (DEMO composition target).
 *
 * ONE application: the shared surfaces (`App`, `Shell`, `Login`, `Settings`)
 * render these slots and never branch on the target themselves. This file
 * assembles the demo composition — the lifecycle gate, the demo disclosures,
 * the demo data panel, the delivery gate, the local credential panel — while
 * `targetFeatures.client.tsx` provides empty (or unavailable-domain) versions
 * of the very same slots. That is what keeps demo UI, demo wording and demo
 * payload out of the client bundle without ever building a second app.
 *
 * Slot contract (asserted by the target tests):
 *   DataLifecycleFeature  — wraps the whole boot tree
 *   ShellFeatures         — in-shell notices + demo provisioning
 *   LoginSourceNotice     — pre-auth data-source disclosure
 *   LoginAssist           — credential panel + lifecycle recovery
 *   SettingsFeatures      — demo data panel + production delivery gate
 */
import { useState, type ReactNode } from "react";
import { KeyRound, TriangleAlert } from "lucide-react";
import { isDemoMode } from "@/api/config";
import { isDemoCapabilityAvailable } from "@/api/deploymentLock";
import { DataLifecycleGate } from "@/components/lifecycle/DataLifecycleGate";
import { LifecycleRecoveryPanel } from "@/components/lifecycle/LifecycleRecoveryPanel";
import { useLifecycleRecovery } from "@/components/lifecycle/LifecycleRecoveryContext";
import { DemoBackedNotice } from "@/components/shell/DemoBackedNotice";
import { DemoDataPanel } from "@/components/settings/DemoDataPanel";
import { ProductionDeliveryGate } from "@/components/settings/ProductionDeliveryGate";
import { DEMO_PASSPHRASE, listDemoAccounts } from "@/domains/auth/localAuthRepository";
import { roleLabel } from "@/domains/auth/permissions";
import { useIsDemoEnvironment } from "@/targets/environment";
import { useDemoLibraryFile } from "@/targets/libraryProvisioning";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

/**
 * The application's data-lifecycle boundary, above `AuthProvider`: nothing
 * reads the environment before its kind (EMPTY vs DEMO) is decided. In API
 * mode the gate is transparent (there is no local environment to choose).
 */
export function DataLifecycleFeature({ children }: { children: ReactNode }) {
  return <DataLifecycleGate>{children}</DataLifecycleGate>;
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

/**
 * In-shell demo features: the demo library file provisioning (the ONE demo
 * content call site) plus the D8 data-source disclosure. Mounted inside the
 * authenticated shell exactly where the disclosure used to be rendered.
 */
export function ShellFeatures() {
  useDemoLibraryFile();
  // After production delivery there is no demo data left for the D8 disclosure
  // to describe — rendering it would assert something false. (The hook above is
  // unconditional; `ensureDemoLibraryFile` itself refuses to write post-lock.)
  return isDemoCapabilityAvailable() ? <DemoBackedNotice className="mb-5" /> : null;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/**
 * Demo data tooling + the Remove Demo / Deliver Production gate.
 *
 * The data panel exists only while demo capability is live: after delivery
 * (or while a delivery attempt is parked) its buttons would be dead or blocked
 * by the service, and dead buttons are exactly the dishonesty the gate's
 * service-level rejection replaces. The gate itself renders in every lock
 * state — locked card, pending/retry card, or the delivery action.
 */
export function SettingsFeatures() {
  return (
    <>
      {isDemoCapabilityAvailable() && <DemoDataPanel />}
      <ProductionDeliveryGate />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

/** Pre-authentication data-source disclosure (same wording seam as the shell). */
export function LoginSourceNotice() {
  return <DemoBackedNotice className="mb-6" />;
}

/**
 * The login screen's demo affordances — the whole demo capability of that
 * surface, behind ONE slot: the local credential panel (main's corner toggle
 * and two-column account grid, moved here unchanged) and the lifecycle
 * recovery notice, which stays in flow where the shared login renders it.
 *
 * `onPick` hands back the account AND its passphrase, so the shared login
 * never imports the demo credential constants itself — that is what keeps the
 * demo credential module out of the client build.
 *
 * The corner block is `position: fixed`, so rendering it from this slot keeps
 * main's bottom-of-file placement without the shared login knowing about it.
 */
export function LoginAssist({ onPick }: { onPick: (email: string, passphrase: string) => void }) {
  const demoEnvironment = useIsDemoEnvironment();
  const lifecycleRecovery = useLifecycleRecovery();
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <>
      {lifecycleRecovery && <LifecycleRecoveryPanel controller={lifecycleRecovery} />}

      {/*
        Demo credentials — DEMO MODE ONLY, tucked into a screen corner behind a
        toggle so they never push or clutter the login action. SECURITY: this
        whole block is gated by `isDemoMode()`; in api/real mode it is false, so
        neither this button nor the passphrase/accounts exist in the DOM at all —
        no demo credential can leak into a production build. After delivery the
        lock (not this gate) is what refuses the operations.
      */}
      {isDemoMode() && (
        <div className="fixed right-4 top-4 z-30 flex w-[min(22rem,calc(100vw-2rem))] flex-col items-end gap-2">
          <div
            className={cn(
              "w-full transition-all duration-200",
              demoOpen
                ? "max-h-[80vh] opacity-100"
                : "pointer-events-none max-h-0 overflow-hidden opacity-0",
            )}
          >
            <DemoPanel
              open={demoOpen}
              demoEnvironment={demoEnvironment}
              onPick={(email) => onPick(email, DEMO_PASSPHRASE)}
            />
          </div>
          <button
            type="button"
            onClick={() => setDemoOpen((v) => !v)}
            aria-expanded={demoOpen}
            className="flex items-center gap-2 rounded-full border border-warn-500/30 bg-ink-900/90 px-3.5 py-2 text-[length:var(--p-text-xs)] font-semibold text-warn-300 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.85)] backdrop-blur transition-colors hover:border-warn-500/50 hover:text-warn-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warn-400/60"
          >
            <KeyRound className="size-3.5" aria-hidden />
            {demoOpen ? "بستن اطلاعات دمو" : "اطلاعات ورود دمو"}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Local credentials.
 *
 * Rendered only when the data source is demo; in api mode it is not in the DOM
 * at all. The wording states plainly that this login has no security — claiming
 * otherwise about localStorage auth would be dishonest.
 *
 * `demoEnvironment` chooses the LABELS only, never the capability: an EMPTY
 * environment still needs the passphrase on screen, because the bootstrap
 * account it created is the only way in. What it must not do is call that
 * customer environment a demo, or that account a sample one.
 *
 * (Moved verbatim from `views/Login.tsx` — the shared login holds only the
 * slot; this target holds the demo panel. See docs: target seams.)
 */
export function DemoPanel({ open, demoEnvironment, onPick }: { open: boolean; demoEnvironment: boolean; onPick: (email: string) => void }) {
  const accounts = listDemoAccounts();
  return (
    <div
      data-demo-panel
      className="rounded-2xl border border-warn-500/[0.18] bg-ink-950/95 p-[max(12px,calc(var(--form-u)*14))] text-right shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)] backdrop-blur"
    >
      <div className="flex items-center gap-1.5 text-[length:var(--p-text-xs)] font-semibold text-warn-400">
        <TriangleAlert className="size-3.5" aria-hidden />{" "}
        {demoEnvironment ? "دادهٔ نمونه — بدون امنیت واقعی" : "دادهٔ محلی — بدون امنیت واقعی"}
      </div>
      <p className="mt-[calc(var(--form-u)*6)] text-[length:var(--p-text-xs)] leading-relaxed text-ink-300">
        {demoEnvironment
          ? "این ورود صرفاً نمایشی است و هیچ محافظت امنیتی ندارد. گذرواژهٔ همهٔ حساب‌های نمونه"
          : "این ورود روی دادهٔ ذخیره‌شده در همین مرورگر است و هیچ محافظت امنیتی ندارد. گذرواژهٔ حساب دسترسیِ این محیط"}{" "}
        <code dir="ltr" className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[length:var(--p-text-xs)] text-ink-100">
          {DEMO_PASSPHRASE}
        </code>{" "}
        است.
      </p>
      {/* Two columns where there is width: five one-tap accounts are the tallest
          honest element on the screen, and pairing them is what keeps a desktop
          demo environment inside one viewport. */}
      <ul className="mt-[calc(var(--form-u)*8)] grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
        {accounts.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => onPick(account.email)}
              tabIndex={open ? undefined : -1}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-[max(4px,calc(var(--form-u)*6))] text-right text-[length:var(--p-text-xs)] text-ink-200 transition-colors hover:bg-white/[0.055] focus-visible:bg-white/[0.055] focus-visible:outline-none"
            >
              <span dir="ltr" className="truncate text-ink-300">
                {account.email}
              </span>
              <span className="shrink-0 text-ink-400">{roleLabel(account.role)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
