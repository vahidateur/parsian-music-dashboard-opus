/**
 * Target copy — CLIENT composition target.
 *
 * Same slots as `targetCopy.ts`, truthfully different words: nothing here may
 * mention demo material, because in the client build nothing on screen is demo
 * material. Asserted by `src/targets/__tests__/targetCopy.test.ts`.
 */

/** The Finance section's deferred-state note (client target wording). */
export const financeDeferredNote =
  "ثبت پرداخت فعلاً در دسترس نیست؛ نمایش فاکتورها و اشتراک‌ها به قرارداد سرور نیاز دارد.";

/**
 * The data-source disclosure paragraph. `names` is the domain enumeration the
 * caller already holds — this module adds no domain list of its own.
 */
export function dataSourceNotice(names: string): string {
  return `این بخش‌ها هنوز به سامانهٔ سرور متصل نیستند و داده‌ای نشان نمی‌دهند: ${names}.`;
}
