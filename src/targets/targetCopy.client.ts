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
/**
 * Actions whose backend contract does not exist in the client composition:
 * finance (deferred, D6/I2) and chat's out-of-app transports. Views ask the
 * seam instead of offering a control that can only fail after it is used.
 *
 * `message` left this set with §37: the in-app thread view is served, so its
 * navigation is offered. What stays out is anything that claims delivery
 * beyond the thread (providers the server does not implement).
 *
 * `payment` left this set with §40: invoices are issued and discharged
 * through the served API. What stays out is anything the server does not
 * implement: exports, portals, notifications.
 */
export const unavailableActions: ReadonlySet<string> = new Set([
  "finance-export",
  "reports-export",
  "portals",
  "notifications",
]);

/**
 * Why a capability the client composition does not serve is missing.
 *
 * The client build talks to a server, so "this is not connected yet" is a true
 * statement HERE and only here — the capability has no server implementation,
 * which is exactly what DOMAIN_UNAVAILABLE means.
 *
 * It lives in this variant because the DEMO composition serves every capability
 * it offers from the local store: the same sentence there would be a false
 * claim about a server that was never part of the demo. The demo variant
 * carries its own wording for the same slot.
 */
/**
 * Where a member's photo ends up — the client composition sends the bytes
 * to the server, where they are readable only by the people who may see the
 * record the photo belongs to. The demo variant says the opposite, because
 * the demo keeps them in the browser.
 */
export function mediaStorageHint(): string {
  return "تصویر روی سامانهٔ مرکزی نگه داشته می‌شود؛ تنها کسانی آن را می‌بینند که به پروندهٔ مربوط دسترسی دارند.";
}

/**
 * The toast's detail line after a catalogue row was added WITH a file.
 *
 * The client composition sends the bytes to the server's media store; the
 * demo variant keeps them in the browser and says so.
 */
export function fileStoredDetail(): string {
  return "فایل روی سامانهٔ مرکزی ذخیره شد.";
}

/**
 * Where a chat attachment lives — the one sentence that differs between the
 * two compositions, because the two compositions store it in different
 * places.
 *
 * The demo target keeps the bytes in the BROWSER and says so (including the
 * consequence: no server copy). The client target sends them to the server's
 * media store, where they are backed up with the dataset and readable by the
 * participants of the thread — so it says THAT.
 */
export const attachmentStorageNote =
  "فایل پیوست روی سامانهٔ مرکزی نگه داشته می‌شود.";

/**
 * Where gallery photographs live — the client half of the seam.
 *
 * Nothing here may mention browser-only storage, because in the client build
 * nothing on screen is browser-only storage. Asserted by
 * `src/targets/__tests__/targetCopy.test.ts` (slot parity) and by
 * `src/__tests__/bundleBoundary.test.ts` against the real build output.
 */
export const galleryStorageNote =
  "تصویرها روی سامانهٔ مرکزی نگه داشته می‌شوند و همراه پشتیبان‌گیری حفظ می‌شوند؛ تنها کسانی آن‌ها را می‌بینند که گالری را باز کنند.";

export const brandingUnavailableDescription =
  "هویت آموزشگاه هنوز به سامانهٔ سرور متصل نیست و در این نسخه داده‌ای نمی‌خواند.";

/**
 * The generic sibling of the branding one, for any capability the client
 * composition does not serve. Same truth, same slot, same seam.
 */
export const unavailableCapabilityDescription =
  "این قابلیت هنوز در سرور پیاده‌سازی نشده و تلاش دوباره نتیجه‌ای نمی‌دهد.";

/**
 * Closing clause of the Reports / Finance deferral paragraph: states only what
 * is true while the capability has no server contract.
 */
export const deferredReadTail = "تا آن زمان چیزی برای نمایش صادقانه وجود ندارد.";
/**
 * Closing clause of a "needs a server" sentence. The server has no route for
 * the capability yet; that is the whole claim.
 */
export const notServedClause = "هنوز در سرور پیاده‌سازی نشده است.";
/** The Library share-link toast detail: the server has no share route. */
export const shareLinkDetail = "ساخت پیوند اشتراک هنوز در سرور پیاده‌سازی نشده است.";
/** The Settings "operations" section hint: what the client section really holds. */
export const settingsOperationsHint = "اتاق‌ها، ساز‌ها، دوره‌ها و قواعد جلسه";
/** The branding panel offers no logo or favicon control; this says exactly that. */
export const brandingFileStorageNote = "بارگذاری لوگو و favicon هنوز در این پنل ارائه نشده است.";
