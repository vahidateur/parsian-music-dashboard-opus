/**
 * Target seam — demo-only feature slots (CLIENT composition target).
 *
 * Same slot contract as `targetFeatures.tsx`, zero demo content:
 *
 *   DataLifecycleFeature  — transparent; the client build has no local
 *                           environment to choose (the data source is the
 *                           configured API).
 *   ShellFeatures         — the honest disclosure for THIS target: the
 *                           domains that have no server implementation yet
 *                           report as unavailable instead of silently serving
 *                           demo data.
 *   LoginSourceNotice     — the same disclosure above the login form.
 *   LoginAssist           — empty: no demo credential panel, no demo accounts,
 *                           no local-lifecycle recovery.
 *   SettingsFeatures      — empty: no demo data panel, no delivery gate (there
 *                           is no demo capability to remove or deliver).
 *
 * Everything imported here is client-safe by construction: this module links
 * the client registry, the client copy and the design system — never the demo
 * store, seed, credentials or lifecycle.
 */
import type { ReactNode } from "react";
import { PlugZap } from "lucide-react";
import { UNAVAILABLE_DOMAINS } from "@/domains/shared/unavailableDomains";
import { dataSourceNotice } from "@/targets/targetCopy";
import { cn } from "@/utils/cn";

export function DataLifecycleFeature({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** The api-mode disclosure, client wording: no server, no fabricated data. */
function UnavailableDomainsNotice({ className }: { className?: string }) {
  // Every domain is served: there is nothing to disclose and no sentence to
  // render. Returning null (rather than a sentence with an empty list) keeps
  // the login page honest — a disclosure naming nothing would read as broken.
  if (UNAVAILABLE_DOMAINS.length === 0) return null;
  const names = UNAVAILABLE_DOMAINS.map((d) => d.label).join("، ");
  return (
    <div
      role="note"
      aria-label="اعلام منبع داده"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-3.5 py-2.5",
        className,
      )}
    >
      <PlugZap className="mt-0.5 size-3.5 shrink-0 text-gold-400" strokeWidth={1.8} />
      <p className="text-[11.5px] leading-relaxed text-gold-200/90">{dataSourceNotice(names)}</p>
    </div>
  );
}

/*
 * Deliberately empty: the authenticated pages whose capability is missing say so
 * themselves (ErrorState / disabled controls), and a banner on every screen told
 * pages that work that they were disconnected. The disclosure stays on the login.
 */
export function ShellFeatures() {
  return null;
}

export function SettingsFeatures() {
  return null;
}

export function LoginSourceNotice() {
  return <UnavailableDomainsNotice className="mb-6" />;
}

export function LoginAssist(_props: { onPick: (email: string, passphrase: string) => void }) {
  return null;
}
