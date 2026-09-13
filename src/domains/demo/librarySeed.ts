/**
 * Demo library seed — the deterministic file that ships with the demo dataset.
 *
 * Pure data and pure functions only: this module is imported by `seed.ts`, so
 * it must not touch the store, the blob store or React. Writing the file's
 * bytes is a separate, explicit step owned by
 * `@/domains/library/demoContent.ts` (`ensureDemoLibraryFile`).
 *
 * WHY THE BYTES ARE NOT HERE
 *
 * `createSeedDataset()` is synchronous and pure, and binaries never live in the
 * dataset (see `domains/media/types.ts`). So the seed carries the file's
 * METADATA and the link from the catalogue row, while the bytes are provisioned
 * into the blob store at bootstrap. A record whose bytes have not landed yet is
 * a legitimate, documented state — the same one a backup restore produces — and
 * the Library UI reports it honestly instead of offering a dead download.
 */
import type { MediaAsset } from "@/domains/media/types";
import type { LibraryItem } from "@/domains/library/types";

/** The catalogue row the demo file belongs to. */
export const DEMO_LIBRARY_RESOURCE_ID = "res1";

/** Stable media id, so a reset/restore re-provisions the same asset. */
export const DEMO_LIBRARY_ASSET_ID = "md_demo_res1";

export const DEMO_LIBRARY_FILENAME = "nocturne-op9-no2.txt";

export const DEMO_LIBRARY_MIME_TYPE = "text/plain";

/** Fixed timestamp: the demo dataset is deterministic by construction. */
export const DEMO_LIBRARY_CREATED_AT = "2026-09-01T00:00:00.000Z";

/**
 * The file's real content — a plain-text study sheet for the seeded score.
 * Genuine bytes a user can open, not a placeholder pretending to be a file.
 */
export const DEMO_LIBRARY_TEXT = [
  "نوکتورن اپوس ۹ شمارهٔ ۲ — فردریک شوپن",
  "پروندهٔ همراه: راهنمای مطالعه برای مدرس و هنرجوی پیشرفتهٔ پیانو",
  "",
  "۱) ساختار",
  "   قالب: سه‌بخشی (A–B–A′) با کودا. میزان‌نما: ۱۲/۸. گام: می‌بمل ماژور.",
  "   بخش A با ملودی اصلی و باس آرپژدار؛ بخش B به فا مینور می‌رود و تنش را",
  "   با آرپژهای دست راست بالا می‌برد؛ بازگشت A′ با فیوریتور و تزئینات آزاد.",
  "",
  "۲) پدال",
  "   پدال دامینانت هر میزان را نگه دارید، اما در گذرهای آرپژدار بخش B",
  "   پدال را زودتر عوض کنید تا باس شفاف بماند. نیم‌پدال در کودا.",
  "",
  "۳) انگشت‌گذاری و تمرین",
  "   - ملودی دست راست را جدا و بدون پدال تمرین کنید تا تزئینات یکدست شود.",
  "   - باس دست چپ را با مترونوم آرام (نصف سرعت) روی ضرب‌های ۱ و ۴ بنشانید.",
  "   - ریتم آزاد ملودی (rubato) را تنها پس از تسلط بر زمان‌بندی دقیق اضافه کنید.",
  "",
  "۴) نشانه‌های اجرایی",
  "   dolce و leggiero در بخش A؛ appassionato در اوج بخش B؛ sempre legato در کودا.",
  "",
  "این پرونده نمونهٔ دمو است: محتوای آن برای نمایش گردش کار دریافت فایل تولید شده",
  "و به هیچ منبع بیرونی ارجاع نمی‌دهد.",
  "",
].join("\n");

/** Encoded once; `Blob` copies the bytes, so the buffer can be shared safely. */
const ENCODED = new TextEncoder().encode(DEMO_LIBRARY_TEXT);

/** The demo file's actual bytes. */
export function demoLibraryFileBytes(): ArrayBuffer {
  return ENCODED.buffer.slice(ENCODED.byteOffset, ENCODED.byteOffset + ENCODED.byteLength) as ArrayBuffer;
}

/** Metadata row for the demo file: small, serializable, backup-safe. */
export const DEMO_LIBRARY_ASSET: MediaAsset = {
  id: DEMO_LIBRARY_ASSET_ID,
  kind: "document",
  filename: DEMO_LIBRARY_FILENAME,
  mimeType: DEMO_LIBRARY_MIME_TYPE,
  sizeBytes: ENCODED.byteLength,
  createdAt: DEMO_LIBRARY_CREATED_AT,
};

/**
 * Attaches the demo file to its catalogue row.
 *
 * The row and the asset are derived from one module so the shipped dataset is
 * self-consistent by construction; every other row passes through untouched.
 */
export function withDemoLibraryFile(rows: readonly LibraryItem[]): LibraryItem[] {
  return rows.map((row) =>
    row.id === DEMO_LIBRARY_RESOURCE_ID ? { ...row, mediaId: DEMO_LIBRARY_ASSET_ID } : { ...row },
  );
}
