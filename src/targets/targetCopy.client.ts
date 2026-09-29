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

export function savedChangesDetail(showcase: boolean): string {
  return showcase ? "تغییرات در داده‌ها ذخیره شد." : "تغییرات در داده‌ها ذخیره شد.";
}

export function savedIdentityDetail(showcase: boolean): string {
  return showcase ? "تغییرات در داده‌ها ثبت شد." : "تغییرات در داده‌ها ثبت شد.";
}

export function suggestionResultTitle(showcase: boolean): string {
  return showcase ? "ارسال پیشنهاد انجام نشد" : "ارسال پیشنهاد انجام نشد";
}

export const settingsOperationsHint = "اتاق‌ها، قواعد جلسه، دادهٔ محلی";
export const notificationServerNote =
  "اعلان‌ها نیازمند سرور است — دامنهٔ اعلان‌ها هنوز پیاده‌سازی نشده و این تنظیمات ذخیره نمی‌شود. ارسال واقعی پیامک، ایمیل و اعلان درون‌برنامه‌ای به سرور نیاز دارد و در این نسخه فعال نیست. این کلیدها صرفاً محلی هستند و پس از بارگذاری مجدد بازنشانی می‌شوند.";
export const reportExportDetail = "تولید PDF در سرور انجام می‌شود و در این نسخه فعال نیست.";
export const reportDeferredClause = "در این نسخه چیزی برای نمایش صادقانه وجود ندارد.";
export const messageBroadcastDetail = "ارسال گروهی به سرویس پیام‌رسان سمت سرور نیاز دارد و در این نسخه فعال نیست.";
export const financeExportDetail = "تولید PDF/Excel در سرور انجام می‌شود و در این نسخه فعال نیست.";
export const financeDeferredClause = "در این نسخه چیزی برای نمایش صادقانه وجود ندارد.";
export const libraryShareDetail = "پیوند اشتراک واقعی با سرور ساخته می‌شود؛ در این نسخه انجام نشد.";
export const profilePhotoStorageNote = "در این نسخه تصویر فقط در همین مرورگر ذخیره می‌شود و در پشتیبان قرار نمی‌گیرد.";
export const brandingFileStorageNote =
  "در این نسخه فایل‌ها فقط در همین مرورگر نگهداری می‌شوند و در پشتیبان قرار نمی‌گیرند؛ استقرار عملیاتی به object storage سمت سرور نیاز دارد.";
export const paymentSheetNote =
  "ثبت پرداخت به سرویس مالی سمت سرور نیاز دارد. در این نسخه، داده‌های مالی از طریق مخزن خوانده نمی‌شوند و هیچ مبلغی ذخیره نمی‌شود. برای مشاهدهٔ وضعیت فعلی، به بخش مالی بروید.";
export const notificationBellDetail = "اعلان زندهٔ واقعی به سرور نیاز دارد و در این نسخه وجود ندارد.";
export const demoManageLabel = "مدیریت دادهٔ محلی";
