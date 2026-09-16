import { PlugZap } from "lucide-react";
import { getRuntimeConfig } from "@/api/config";
import { DEMO_SERVED_DOMAINS } from "@/domains/registry";
import { cn } from "@/utils/cn";

/**
 * D8 — the api-mode "served by local data" disclosure.
 *
 * The panel runs against a real backend in `api` mode, yet eleven domains
 * still resolve to the demo repository on purpose: their REST contracts exist
 * but no server answers them (`src/domains/registry.ts`, §37 of the data-layer
 * doc). A quietly-demo dashboard in api mode would read as "half the academy
 * has no data", which is exactly the dishonest fallback §37 forbids — so the
 * affected areas are declared, plainly, everywhere the operator looks.
 *
 * CONTRACT
 *   - rendered ONLY in `api` mode (`getRuntimeConfig().mode === "api"`);
 *     in demo mode the DemoNote family already labels prototype data, and
 *     doubling the signage would teach people to ignore both;
 *   - persistent and non-dismissable: no close button, no session flag —
 *     the statement stays true for the whole session;
 *   - the domain list derives from `DEMO_SERVED_DOMAINS`, the single
 *     enumeration at the composition root. This component adds NO list of
 *     its own (D8: wording derives from the registry seam);
 *   - wording states what IS true — these sections read local/demo data —
 *     and nothing else: no "backend health", no "server responded", no
 *     fabricated connectivity claims.
 *
 * Surfaces: the app shell (above the routed view, under the top bar) and the
 * login screen, so the operator sees it before and after authenticating.
 */
export function DemoBackedNotice({ className }: { className?: string }) {
  if (getRuntimeConfig().mode !== "api") return null;

  const names = DEMO_SERVED_DOMAINS.map((d) => d.label).join("، ");

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
      <p className="text-[11.5px] leading-relaxed text-gold-100/90">
        این بخش‌ها فعلاً با دادهٔ محلی ذخیره‌شده روی همین دستگاه نمایش داده می‌شوند، نه از سامانهٔ مرکزی:
        {" "}
        {names}.
      </p>
    </div>
  );
}
