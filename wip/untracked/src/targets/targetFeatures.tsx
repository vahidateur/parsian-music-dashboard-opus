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
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { isDemoMode } from "@/api/config";
import { isDemoCapabilityAvailable } from "@/api/deploymentLock";
import { DataLifecycleGate } from "@/components/lifecycle/DataLifecycleGate";
import { LifecycleRecoveryPanel } from "@/components/lifecycle/LifecycleRecoveryPanel";
import { useLifecycleRecovery } from "@/components/lifecycle/LifecycleRecoveryContext";
import { DemoBackedNotice } from "@/components/shell/DemoBackedNotice";
import { DemoDataPanel } from "@/components/settings/DemoDataPanel";
import { ProductionDeliveryGate } from "@/components/settings/ProductionDeliveryGate";
import { DEMO_PASSPHRASE, listDemoAccounts } from "@/domains/auth/demoAuthRepository";
import { roleLabel } from "@/domains/auth/permissions";
import { useIsDemoEnvironment } from "@/targets/environment";
import { useDemoLibraryFile } from "@/targets/libraryProvisioning";

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
 * The login screen's demo affordances: the local credential panel and the
 * lifecycle recovery notice. `onPick` receives the account AND its passphrase,
 * so the shared login never imports the demo credential constants itself.
 */
export function LoginAssist({ onPick }: { onPick: (email: string, passphrase: string) => void }) {
  const demoEnvironment = useIsDemoEnvironment();
  const lifecycleRecovery = useLifecycleRecovery();
  return (
    <>
      {isDemoMode() && (
        <DemoPanel
          demoEnvironment={demoEnvironment}
          onPick={(email) => onPick(email, DEMO_PASSPHRASE)}
        />
      )}
      {lifecycleRecovery && <LifecycleRecoveryPanel controller={lifecycleRecovery} />}
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
export function DemoPanel({ demoEnvironment, onPick }: { demoEnvironment: boolean; onPick: (email: string) => void }) {
  const accounts = listDemoAccounts();
  return (
    <div className="mt-5 rounded-2xl border border-warn-500/[0.18] bg-warn-500/[0.045] p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-warn-400">
        <TriangleAlert className="size-3.5" aria-hidden />{" "}
        {demoEnvironment ? "محیط دمو — بدون امنیت واقعی" : "دادهٔ محلی — بدون امنیت واقعی"}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-300">
        {demoEnvironment
          ? "این ورود صرفاً نمایشی است و هیچ محافظت امنیتی ندارد. گذرواژهٔ همهٔ حساب‌های نمونه"
          : "این ورود روی دادهٔ ذخیره‌شده در همین مرورگر است و هیچ محافظت امنیتی ندارد. گذرواژهٔ حساب دسترسیِ این محیط"}{" "}
        <code dir="ltr" className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] text-ink-100">
          {DEMO_PASSPHRASE}
        </code>{" "}
        است.
      </p>
      <ul className="mt-3 space-y-0.5">
        {accounts.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => onPick(account.email)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-right text-[11px] text-ink-200 transition-colors hover:bg-white/[0.055] focus-visible:bg-white/[0.055] focus-visible:outline-none"
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
