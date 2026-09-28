/**
 * Target copy — messages whose truth differs between composition targets.
 *
 * The rule this module exists for (§ target copy): views request wording
 * through the seam instead of branching `if (demo)` themselves. Two values with
 * the SAME slot, two targets, one import site — and because the client variant
 * lives in `targetCopy.client.ts`, none of the demo-target wording is even
 * present in the client bundle (not even as a dead string literal).
 *
 * Contract asserted by `src/targets/__tests__/targetCopy.test.ts`: both
 * variants export the same slot names, and the client variant carries no
 * demo-only wording.
 */

/** The Finance section's deferred-state note (demo target wording). */
export const financeDeferredNote =
  "ثبت پرداخت از اقدام‌های سریع دمو باز می‌شود و داده‌ای ذخیره نمی‌کند؛ نمایش فاکتورها و اشتراک‌ها به قرارداد سرور نیاز دارد.";

/**
 * The data-source disclosure paragraph. `names` is the domain enumeration the
 * caller already holds (the registry seam's single list) — this module adds no
 * domain list of its own.
 */
export function dataSourceNotice(names: string): string {
  return `این بخش‌ها فعلاً با دادهٔ محلی ذخیره‌شده روی همین دستگاه نمایش داده می‌شوند، نه از سامانهٔ مرکزی: ${names}.`;
}
