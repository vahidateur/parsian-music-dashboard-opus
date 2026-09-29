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

export function savedChangesDetail(showcase: boolean): string {
  return showcase ? "تغییرات در دادهٔ دمو ذخیره شد." : "تغییرات در داده‌ها ذخیره شد.";
}

export function savedIdentityDetail(showcase: boolean): string {
  return showcase ? "تغییرات در دادهٔ دمو ثبت شد." : "تغییرات در داده‌ها ثبت شد.";
}

export function suggestionResultTitle(showcase: boolean): string {
  return showcase ? "پیشنهاد فقط در دمو نمایش داده شد" : "ارسال پیشنهاد انجام نشد";
}

export const settingsOperationsHint = "اتاق‌ها، قواعد جلسه، دادهٔ دمو";
export const notificationServerNote =
  "اعلان‌ها نیازمند سرور است — دامنهٔ اعلان‌ها هنوز پیاده‌سازی نشده و این تنظیمات ذخیره نمی‌شود. ارسال واقعی پیامک، ایمیل و اعلان درون‌برنامه‌ای به سرور نیاز دارد و در دمو فعال نیست. این کلیدها صرفاً نمایشی هستند و پس از بارگذاری مجدد بازنشانی می‌شوند.";
export const reportExportDetail = "تولید PDF در سرور انجام می‌شود و در دمو فعال نیست.";
export const reportDeferredClause = "در دمو و محیط خالی چیزی برای نمایش صادقانه وجود ندارد.";
export const messageBroadcastDetail = "ارسال گروهی به سرویس پیام‌رسان سمت سرور نیاز دارد و در دمو فعال نیست.";
export const financeExportDetail = "تولید PDF/Excel در سرور انجام می‌شود و در دمو فعال نیست.";
export const financeDeferredClause = "در دمو و محیط خالی چیزی برای نمایش صادقانه وجود ندارد.";
export const libraryShareDetail = "پیوند اشتراک واقعی با سرور ساخته می‌شود؛ در دمو انجام نشد.";
export const profilePhotoStorageNote = "در نسخهٔ دمو تصویر فقط در همین مرورگر ذخیره می‌شود و در پشتیبان قرار نمی‌گیرد.";
export const brandingFileStorageNote =
  "در نسخهٔ دمو فایل‌ها فقط در همین مرورگر نگهداری می‌شوند و در پشتیبان قرار نمی‌گیرند؛ استقرار عملیاتی به object storage سمت سرور نیاز دارد.";
export const paymentSheetNote =
  "نسخهٔ دمو: ثبت پرداخت به سرویس مالی سمت سرور نیاز دارد. در این نسخه، داده‌های مالی از طریق مخزن خوانده نمی‌شوند و هیچ مبلغی ذخیره نمی‌شود. برای مشاهدهٔ وضعیت فعلی، به بخش مالی بروید.";
export const notificationBellDetail = "اعلان زندهٔ واقعی به سرور نیاز دارد و در دمو وجود ندارد.";
export const demoManageLabel = "مدیریت دادهٔ نمایشی";
