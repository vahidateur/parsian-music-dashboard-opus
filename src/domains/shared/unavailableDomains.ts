/**
 * The client composition's explicit-unavailable enumeration.
 *
 * Lives in `shared/` (not in `registry.client.ts`) so that BOTH typecheck
 * profiles can reach it: `targetFeatures.client.tsx` must not import from
 * `@/domains/registry`, which resolves to the DEMO composition under the
 * default tsconfig. `registry.client.ts` re-exports it, so the registry module
 * remains the composition root consumers know — this file is only the
 * specifier-neutral home of the list itself.
 *
 * Single source of truth: the shell's unavailable-domains disclosure derives
 * its wording from `UNAVAILABLE_DOMAINS` and keeps no list of its own (Phase
 * 2A §J: explicit unavailable reporting, one enumeration per composition —
 * the mirror of `DEMO_SERVED_DOMAINS` for the demo composition).
 */
export interface UnavailableDomain {
  id: string;
  label: string;
}

export const UNAVAILABLE_DOMAINS: readonly UnavailableDomain[] = [
  { id: "instruments", label: "سازها" },
  { id: "learning", label: "مسیرهای یادگیری" },
  { id: "chat", label: "پیام‌ها" },
  { id: "media", label: "رسانه" },
  { id: "library", label: "کتابخانه" },
  { id: "branding", label: "هویت آموزشگاه" },
  { id: "gallery", label: "گالری" },
  { id: "scheduling", label: "برنامه‌ریزی" },
  { id: "attendance", label: "حضور و غیاب" },
  { id: "compensation", label: "جبرانی" },
] as const;
