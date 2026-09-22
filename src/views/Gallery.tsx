/**
 * THE GALLERY — the academy's visual story, on the dashboard at last.
 *
 * Until now the gallery lived only inside Settings, as a management panel: the
 * one surface whose entire purpose is to be LOOKED AT had no place to be looked
 * at. This view is that place. It is read-only on purpose — albums and images are
 * created, uploaded and removed in Settings → گالری, exactly like students are
 * enrolled in their own surfaces; a showcase that also edits is a workshop with
 * pictures on the wall.
 *
 * What "showcase" means here, concretely:
 *   • a cinematic header that wears the current album's first photograph, slowly
 *     breathing (Ken Burns) under a dark gradient — disabled for reduced motion;
 *   • a dense mosaic where a few photographs take two columns or two rows, chosen
 *     by position so the rhythm is stable rather than random per render;
 *   • captions that arrive on hover/focus from a bottom gradient, never covering
 *     the photograph at rest;
 *   • a lightbox with keyboard navigation (Escape, and the arrows — mirrored for
 *     right-to-left, where "next" is to the left) and a counter in Persian digits;
 *   • honest absence: a photograph whose bytes have not landed (or could not, in a
 *     browser without storage) is a framed note, not a broken thumbnail and not a
 *     shimmer that spins forever.
 *
 * The bytes come from the media seam (`useMediaObjectUrl`), which owns object-URL
 * lifetime for every stored file in the product. In the demo environment the view
 * waits for `ensureDemoGalleryBytes` — the one bootstrap step that writes the
 * bundled photographs into the blob store — before painting tiles, so no tile ever
 * mounts against bytes that are still in flight.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { useDemoGalleryBytes, useAlbums, useGalleryImages } from "@/domains/gallery/useGallery";
import type { GalleryAlbum, GalleryImage } from "@/domains/gallery/types";
import { useMediaObjectUrl } from "@/domains/media/useMedia";
import { faNum } from "@/lib/format";
import { cn } from "@/utils/cn";

/** "همه" is a filter value, not an album id; album ids never collide with it. */
const ALL_ALBUMS = "all";

export function GalleryView() {
  const albumsState = useAlbums();
  const imagesState = useGalleryImages();
  const bytes = useDemoGalleryBytes();
  const [albumId, setAlbumId] = useState<string>(ALL_ALBUMS);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const albums = albumsState.items;
  const images = imagesState.items;

  const visible = useMemo(
    () => (albumId === ALL_ALBUMS ? images : images.filter((image) => image.albumId === albumId)),
    [images, albumId],
  );

  const albumById = useMemo(() => new Map(albums.map((album) => [album.id, album])), [albums]);
  const selectedAlbum = albumId === ALL_ALBUMS ? undefined : albumById.get(albumId);

  if (albumsState.loading || imagesState.loading || !bytes.settled) {
    return <LoadingState label="در حال باز کردن گالری…" />;
  }
  if (albumsState.error) {
    return <ErrorState description={albumsState.error.message} onRetry={albumsState.reload} />;
  }
  if (imagesState.error) {
    return <ErrorState description={imagesState.error.message} onRetry={imagesState.reload} />;
  }

  return (
    <div className="space-y-5">
      <GalleryHeader album={selectedAlbum} images={visible} albums={albums} />

      {/* Album filter — pills with LIVE counts, not decorative tabs. */}
      {albums.length > 0 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="فیلتر آلبوم">
          <AlbumPill
            label="همهٔ تصاویر"
            count={images.length}
            active={albumId === ALL_ALBUMS}
            onSelect={() => setAlbumId(ALL_ALBUMS)}
          />
          {albums.map((album) => (
            <AlbumPill
              key={album.id}
              label={album.title}
              count={images.filter((image) => image.albumId === album.id).length}
              active={albumId === album.id}
              onSelect={() => setAlbumId(album.id)}
            />
          ))}
        </div>
      )}

      {bytes.unavailable && (
        <p className="rounded-xl border border-warn-500/30 bg-warn-500/10 px-4 py-3 text-xs leading-relaxed text-warn-200">
          فضای ذخیره‌سازی تصویر در این مرورگر در دسترس نیست؛ قاب‌ها فرادادهٔ واقعی هر عکس را نشان می‌دهند اما بایت‌ها
          خوانده نمی‌شوند.
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<ImageOff className="size-6 opacity-70" aria-hidden />}
          title={albums.length === 0 ? "هنوز آلبومی ساخته نشده است" : "این آلبوم هنوز تصویری ندارد"}
          description="آلبوم‌ها و تصویرها در تنظیمات → گالری ساخته و بارگذاری می‌شوند؛ اینجا همان‌ها نمایش داده می‌شوند."
        />
      ) : (
        <div className="grid grid-flow-dense grid-cols-2 gap-2.5 auto-rows-[150px] md:grid-cols-4 md:gap-3 md:auto-rows-[190px]">
          {visible.map((image, index) => (
            <Tile
              key={image.id}
              image={image}
              albumTitle={albumById.get(image.albumId)?.title}
              bytesUnavailable={bytes.unavailable}
              className={spanClass(index)}
              onOpen={() => setLightbox(index)}
            />
          ))}
        </div>
      )}

      {lightbox !== null && visible[lightbox] && (
        <Lightbox
          images={visible}
          albumTitle={(index: number) => albumById.get(visible[index].albumId)?.title}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/** The header wears the first photograph of what it is describing. */
function GalleryHeader({
  album,
  images,
  albums,
}: {
  album?: GalleryAlbum;
  images: GalleryImage[];
  albums: GalleryAlbum[];
}) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.02]">
      <HeroBackdrop image={images[0]} />
      <div className="absolute inset-0 bg-gradient-to-l from-black/85 via-black/60 to-black/25" aria-hidden />
      <div className="relative px-6 py-8 md:px-10 md:py-12">
        <p className="text-[11px] font-medium tracking-[0.3em] text-gold-300/90">گالری آموزشگاه</p>
        <h1 className="mt-3 text-2xl font-bold text-photo-fg md:text-4xl">
          {album ? album.title : "روایت تصویری آموزشگاه"}
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-photo-muted md:text-sm">
          {album
            ? album.description
            : "صحنه‌ها، سازها و اتاق‌های تمرین — آنچه در یک ترم در آموزشگاه گذشته است، در یک نگاه."}
        </p>
        <p className="mt-5 text-[11px] text-photo-faint">
          {faNum(images.length)} تصویر
          {album ? "" : ` در ${faNum(albums.length)} آلبوم`}
        </p>
      </div>
    </header>
  );
}

/** Slow-breathing backdrop. Decorative: hidden from assistive tech, still under reduced motion. */
function HeroBackdrop({ image }: { image?: GalleryImage }) {
  const url = useMediaObjectUrl(image?.mediaId);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      aria-hidden
      className="kenburns absolute inset-0 size-full object-cover opacity-45"
    />
  );
}

function AlbumPill({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs transition-colors",
        active
          ? "border-gold-400/50 bg-gold-500/15 text-gold-100"
          : "border-white/[0.08] bg-white/[0.02] text-ink-300 hover:border-white/20 hover:text-ink-100",
      )}
    >
      <span>{label}</span>
      <span className={cn("text-[10px]", active ? "text-gold-200/80" : "text-ink-500")}>{faNum(count)}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Mosaic                                                              */
/* ------------------------------------------------------------------ */

/**
 * A stable rhythm: a few photographs take two columns or two rows by POSITION,
 * so the mosaic reads as designed rather than shuffled on every render or filter.
 */
function spanClass(index: number): string {
  const beat = index % 7;
  if (beat === 0) return "col-span-2 row-span-2";
  if (beat === 3) return "row-span-2";
  if (beat === 5) return "col-span-2";
  return "";
}

function Tile({
  image,
  albumTitle,
  bytesUnavailable,
  className,
  onOpen,
}: {
  image: GalleryImage;
  albumTitle?: string;
  bytesUnavailable: boolean;
  className?: string;
  onOpen: () => void;
}) {
  const url = useMediaObjectUrl(image.mediaId);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`دیدن تصویر: ${image.caption}`}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-right",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400/70",
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt={image.alt}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : bytesUnavailable ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-[10.5px] leading-relaxed text-ink-500">
          <ImageOff className="size-5 opacity-70" aria-hidden />
          فایل تصویر در این مرورگر موجود نیست
        </span>
      ) : (
        <span
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] to-transparent motion-reduce:animate-none"
          aria-hidden
        />
      )}

      {/* Caption rises from a bottom gradient on hover/focus; at rest the photograph is uncovered. */}
      <span
        className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-3 pt-10 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
        aria-hidden
      >
        <span className="block truncate text-[12.5px] font-medium text-photo-fg">{image.caption}</span>
        {albumTitle && <span className="block truncate text-[10.5px] text-photo-muted">{albumTitle}</span>}
      </span>

      <span
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/0 transition group-hover:ring-gold-400/40 group-focus-visible:ring-gold-400/60"
        aria-hidden
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Lightbox                                                            */
/* ------------------------------------------------------------------ */

function Lightbox({
  images,
  albumTitle,
  index,
  onIndex,
  onClose,
}: {
  images: GalleryImage[];
  albumTitle: (index: number) => string | undefined;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const image = images[index];
  const url = useMediaObjectUrl(image.mediaId);
  const total = images.length;

  /* Right-to-left keyboard travel: the NEXT photograph lives to the left. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onIndex((index + 1) % total);
      else if (event.key === "ArrowRight") onIndex((index - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, onClose, onIndex]);

  /* The page behind a lightbox does not scroll (same pattern as the sheets). */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تصویر ${faNum(index + 1)} از ${faNum(total)}: ${image.caption}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4 backdrop-blur-md md:p-10"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        autoFocus
        aria-label="بستن نمایش بزرگ"
        className="absolute left-4 top-4 rounded-full border border-photo-fg/25 bg-photo-fg/10 p-2 text-photo-muted transition hover:bg-photo-fg/20 hover:text-photo-fg focus-visible:outline-2 focus-visible:outline-gold-400/70"
      >
        <X className="size-5" aria-hidden />
      </button>

      {total > 1 && (
        <>
          <LightboxNav side="next" onClick={() => onIndex((index + 1) % total)} />
          <LightboxNav side="previous" onClick={() => onIndex((index - 1 + total) % total)} />
        </>
      )}

      <figure
        className="flex max-h-full max-w-5xl flex-col items-center gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        {url ? (
          <img
            src={url}
            alt={image.alt}
            className="max-h-[74vh] rounded-2xl object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          />
        ) : (
          <span className="flex h-[50vh] w-[70vw] items-center justify-center rounded-2xl border border-photo-fg/20 text-xs text-photo-muted">
            فایل تصویر در این مرورگر موجود نیست
          </span>
        )}
        <figcaption className="text-center">
          <p className="text-sm font-medium text-photo-fg">{image.caption}</p>
          <p className="mt-1 text-[11px] text-photo-muted">
            {albumTitle(index) ? `${albumTitle(index)} · ` : ""}
            {faNum(index + 1)} از {faNum(total)}
          </p>
        </figcaption>
      </figure>
    </div>
  );
}

/** In right-to-left, "next" sits on the LEFT edge and points left. */
function LightboxNav({ side, onClick }: { side: "next" | "previous"; onClick: () => void }) {
  const next = side === "next";
  const Icon = next ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={next ? "تصویر بعدی" : "تصویر قبلی"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 rounded-full border border-photo-fg/25 bg-photo-fg/10 p-2.5 text-photo-muted transition hover:bg-photo-fg/20 hover:text-photo-fg focus-visible:outline-2 focus-visible:outline-gold-400/70",
        next ? "left-3 md:left-6" : "right-3 md:right-6",
      )}
    >
      <Icon className="size-6" aria-hidden />
    </button>
  );
}
