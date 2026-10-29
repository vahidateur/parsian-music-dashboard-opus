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
/**
 * Actions whose backend contract does not exist in this composition. Views ask
 * the seam (`unavailableActions.has(id)`) instead of offering a control that can
 * only fail after it is used. Demo target: every action is backed locally.
 */
export const unavailableActions: ReadonlySet<string> = new Set<string>();

/**
 * The demo counterpart of the client's server-claim wording: the demo serves
 * every capability it offers from the local store, so it must never say a
 * server is missing. Same slot, honest words for this target.
 */
export const brandingUnavailableDescription =
  "هویت آموزشگاه در این نسخه در دسترس نیست و داده‌ای نمی‌خواند.";

export const unavailableCapabilityDescription =
  "این قابلیت در این نسخه پیاده‌سازی نشده است و تلاش دوباره نتیجه‌ای نمی‌دهد.";

/**
 * Where a member's photo ends up — the one sentence that differs between the
 * two compositions, because the two compositions store it in different
 * places.
 *
 * The demo target keeps the bytes in the BROWSER, so it says so. The client
 * target sends them to the server, where they are readable only by the people
 * who may see the record the photo belongs to — so it says THAT.
 *
 * The accepted formats and the size limit are the SAME in both compositions,
 * so they are not in this seam: only what differs belongs here.
 */
export function mediaStorageHint(): string {
  return "در نسخهٔ دمو تصویر فقط در همین مرورگر نگه داشته می‌شود و در پشتیبان قرار نمی‌گیرد.";
}

/**
 * The toast's detail line after a catalogue row was added WITH a file.
 *
 * The demo keeps the bytes in the browser, so it says so. The client sends
 * them to the server's media store — and the same sentence there would be a
 * false claim about where the file lives.
 */
export function fileStoredDetail(): string {
  return "فایل فقط در همین مرورگر ذخیره شد.";
}

/**
 * Where a chat attachment lives — the demo half of the seam.
 *
 * Nothing here may mention server storage, because in the demo build nothing
 * is on a server: the slot exists so the same sentence in the shared chat
 * surfaces stays true in both compositions. Asserted by
 * `src/targets/__tests__/targetCopy.test.ts` (slot parity) and by
 * `src/__tests__/bundleBoundary.test.ts` against the real build output.
 */
export const attachmentStorageNote =
  "در این نسخه فایل فقط در همین مرورگر ذخیره شده است؛ روی سرور نگهداری نمی‌شود.";

/**
 * Where gallery photographs live — the one sentence that differs between
 * the two compositions, because the two compositions store them in different
 * places.
 *
 * The demo target keeps the bytes in the BROWSER and says so (including the
 * consequence: no backup, no other device, and a server would still be
 * needed for a published gallery). The client target sends them to the
 * server's media store, where they are backed up with the dataset and
 * readable by whoever may open the showcase — so it says THAT.
 *
 * The size ceiling is the SAME in both compositions, so it stays at the call
 * site: only what differs belongs here.
 */
export const galleryStorageNote =
  "تصاویر فقط در حافظهٔ همین مرورگر ذخیره می‌شوند، در پشتیبان‌گیری قرار نمی‌گیرند و روی دستگاه دیگری دیده نمی‌شوند. انتشار واقعی گالری به فضای ذخیره‌سازی سمت سرور نیاز دارد.";

/**
 * The tail of the Reports / Finance deferral paragraph. The demo target names
 * itself; the client variant must never mention demo material (nothing on
 * screen is demo there), so the clause lives in the seam.
 */
export const deferredReadTail =
  "در دمو و محیط خالی چیزی برای نمایش صادقانه وجود ندارد.";
/**
 * The clause that closes a "needs a server" sentence (export toasts, the
 * announcement toast, the Settings alerts note). Same slot in both
 * targets, because the truth differs: here the capability is simply off.
 */
export const notServedClause = "در دمو فعال نیست.";
/** The Library share-link toast detail. */
export const shareLinkDetail =
  "پیوند اشتراک واقعی با سرور ساخته می‌شود؛ در دمو انجام نشد.";
/** The Settings "operations" section hint: this target also lists its demo data. */
export const settingsOperationsHint = "اتاق‌ها، قواعد جلسه، دادهٔ دمو";
/**
 * The logo / favicon note in the branding panel. The demo target keeps files in
 * the browser and says so.
 */
export const brandingFileStorageNote =
  "بارگذاری لوگو و favicon به فضای ذخیره‌سازی فایل نیاز دارد. در نسخهٔ دمو فایل‌ها فقط در همین مرورگر نگهداری می‌شوند و در پشتیبان قرار نمی‌گیرند؛ استقرار عملیاتی به object storage سمت سرور نیاز دارد.";
