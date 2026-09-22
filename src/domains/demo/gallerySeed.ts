/**
 * The showcase photographs the demo environment ships with.
 *
 * WHY THE BYTES ARE NOT HERE
 *
 * Exactly the library file's reasoning (`./librarySeed` + `library/demoContent`):
 * `createSeedDataset()` is synchronous and pure, and binaries live in the blob
 * store, never in the dataset. So this module carries the METADATA — media rows,
 * gallery rows, captions and alternative text — plus the bundled asset URLs, and
 * `@/domains/gallery/demoContent` writes the bytes at bootstrap. A row whose bytes
 * have not landed yet is a documented, honest state: the gallery shows it as
 * unavailable instead of rendering a broken thumbnail.
 *
 * WHY THERE ARE PHOTOS AT ALL
 *
 * A gallery the operator has to imagine is not a gallery. The demo previously
 * seeded two albums with zero images "because the demo ships no binaries" — true,
 * and it made the one surface whose entire purpose is to be looked at look broken.
 * These six photographs ship in the bundle like the login artwork does, are
 * provisioned into the blob store like any upload, and can be deleted, replaced or
 * added to through the real flows. They are demo content: an EMPTY environment
 * seeds none of them.
 */
import audienceUrl from "@/assets/images/audience-warm.jpg";
import hallUrl from "@/assets/images/hall.jpg";
import practiceUrl from "@/assets/images/practice-room.jpg";
import recitalUrl from "@/assets/images/recital-violin.jpg";
import stringsUrl from "@/assets/images/strings.jpg";
import tarUrl from "@/assets/images/tar-persian.jpg";
import type { MediaAsset } from "@/domains/media/types";
import type { GalleryImage } from "@/domains/gallery/types";

/** Fixed timestamp: the demo dataset is deterministic by construction. */
const CREATED_AT = "2026-09-01T00:00:00.000Z";

export interface DemoGalleryPhoto {
  /** Stable media id, so a reset/restore re-provisions the same asset. */
  mediaId: string;
  /** Stable gallery row id, for the same reason. */
  imageId: string;
  albumId: string;
  filename: string;
  /** The bundled asset the bytes are provisioned FROM. */
  url: string;
  caption: string;
  /** Alternative text. Required on every gallery image (§20). */
  alt: string;
  sizeBytes: number;
  sortOrder: number;
}

/**
 * Sizes as shipped. Informational here (unlike the library file, whose bytes are
 * embedded and therefore exactly knowable at build time): provisioning repairs a
 * missing blob, and a media row whose stated size disagrees with reality is a
 * cosmetic lie at worst, never a broken read.
 */
export const DEMO_GALLERY_PHOTOS: readonly DemoGalleryPhoto[] = [
  {
    mediaId: "md_gal_hall",
    imageId: "gal_hall",
    albumId: "alb_recital",
    filename: "hall-stage.jpg",
    url: hallUrl,
    caption: "تالار اصلی، دقیقه‌های پیش از شروع اجرا",
    alt: "صحنهٔ تاریک تالار کنسرت با پیانوی گراند زیر نور طلایی و جای‌نت‌های خالی",
    sizeBytes: 176_547,
    sortOrder: 1,
  },
  {
    mediaId: "md_gal_violin",
    imageId: "gal_violin",
    albumId: "alb_recital",
    filename: "recital-violin.jpg",
    url: recitalUrl,
    caption: "اجرای ویولن، بخش دوم برنامه",
    alt: "ویولن‌نواز در نور لبه‌ای گرم روی صحنهٔ تاریک، کمانه در حرکت",
    sizeBytes: 107_765,
    sortOrder: 2,
  },
  {
    mediaId: "md_gal_strings",
    imageId: "gal_strings",
    albumId: "alb_recital",
    filename: "piano-strings.jpg",
    url: stringsUrl,
    caption: "سیم‌ها و چکش‌های پیانوی صحنه",
    alt: "نمای نزدیک از سیم‌ها و چکش‌های نمدی داخل پیانو با بازتاب‌های گرم",
    sizeBytes: 178_688,
    sortOrder: 3,
  },
  {
    mediaId: "md_gal_audience",
    imageId: "gal_audience",
    albumId: "alb_recital",
    filename: "audience-warm.jpg",
    url: audienceUrl,
    caption: "تشویق پایان اجرا",
    alt: "سیلوئت تماشاگران در تاریکی رو به نور گرم صحنه و دست‌های در حال تشویق",
    sizeBytes: 164_242,
    sortOrder: 4,
  },
  {
    mediaId: "md_gal_practice",
    imageId: "gal_practice",
    albumId: "alb_rooms",
    filename: "practice-room.jpg",
    url: practiceUrl,
    caption: "اتاق تمرین شمارهٔ دو، عصر",
    alt: "اتاق تمرین خالی با جای‌نت چوبی و پیانو دیواری در نور گرم پنجره",
    sizeBytes: 118_225,
    sortOrder: 1,
  },
  {
    mediaId: "md_gal_tar",
    imageId: "gal_tar",
    albumId: "alb_rooms",
    filename: "tar-persian.jpg",
    url: tarUrl,
    caption: "تار، از مجموعهٔ سازهای آموزشگاه",
    alt: "نمای نزدیک از بدنهٔ کنده‌کاری‌شدهٔ تار ایرانی روی مخمل تیره در نور گرم",
    sizeBytes: 150_254,
    sortOrder: 2,
  },
];

/** The metadata rows for the bundle's photographs — dataset-sized, backup-safe. */
export const DEMO_GALLERY_MEDIA: MediaAsset[] = DEMO_GALLERY_PHOTOS.map((photo) => ({
  id: photo.mediaId,
  kind: "image",
  filename: photo.filename,
  mimeType: "image/jpeg",
  sizeBytes: photo.sizeBytes,
  createdAt: CREATED_AT,
}));

/** The gallery rows: which album each photograph belongs to, and how it reads. */
export function deriveGalleryImages(): GalleryImage[] {
  return DEMO_GALLERY_PHOTOS.map((photo) => ({
    id: photo.imageId,
    albumId: photo.albumId,
    mediaId: photo.mediaId,
    caption: photo.caption,
    alt: photo.alt,
    sortOrder: photo.sortOrder,
    createdAt: CREATED_AT,
  }));
}
