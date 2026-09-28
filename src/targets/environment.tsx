/**
 * Target seam — environment affordances (DEMO composition target).
 *
 * ONE application, two composition roots. Shared views/panels ask this module
 * whether demo-only affordances apply; the demo target answers from the real
 * persisted lifecycle, and `environment.client.ts` answers `false` for every
 * question without importing the demo store, the seed or the lifecycle — so
 * none of that payload can reach the client bundle.
 *
 * `DemoNote` lives here for exactly the same reason: it is demo labelling, and
 * its wording belongs to the demo target, not to the shared design system.
 *
 * The data-version bridge is installed here too (module side effect below):
 * `dataVersion` itself no longer subscribes to the demo store, so a client
 * build — which has no local dataset — cannot depend on demo data versioning
 * (docs/architecture: the bridge exists only where the demo lifecycle exists).
 */
import { FlaskConical } from "lucide-react";
import { demoStore } from "@/services/demoStore";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { cn } from "@/utils/cn";

export { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";

/*
  One subscription, installed as soon as the demo target module loads: every
  demo-store write bumps the shared data version, so list hooks re-read. A
  throwing listener cannot break persistence (demoStore isolates listeners).
*/
demoStore.subscribe(bumpDataVersion);

/* ------------------------------------------------------------------ */
/* DemoNote — prototype discipline: never pass demo figures off as     */
/* production values.                                                  */
/* ------------------------------------------------------------------ */
export function DemoNote({ text, className }: { text?: string; className?: string }) {
  /*
    A claim about where the data came from, so it is only made where it is true.

    In an EMPTY environment the records on screen are the customer's own, and in
    `api` mode they come from a real backend: rendering "this section is filled
    with demo data" there would mislabel real data — the same dishonesty in the
    opposite direction. Gated centrally, on the persisted lifecycle state, so no
    view has to branch on the environment kind.
  */
  if (!useIsDemoEnvironment()) return null;

  return (
    <div role="note" className={cn("flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3", className)}>
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-ink-400" strokeWidth={1.8} aria-hidden />
      <p className="text-[11.5px] leading-relaxed text-ink-400">
        {text ?? "این بخش با دادهٔ نمایشی برای پیش‌نمایش پر شده است؛ پس از اتصال به سامانهٔ اصلی، همین ساختار با دادهٔ واقعی تغذیه می‌شود."}
      </p>
    </div>
  );
}
