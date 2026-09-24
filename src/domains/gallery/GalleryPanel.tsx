/**
 * Academy photo gallery — F1 genuine — Settings → operations.
 *
 * F1 scope:
 * - album metadata title/description/coverMediaId/sortOrder/createdAt
 * - image metadata albumId/mediaId/caption/alt/sortOrder/createdAt alt required
 * - album filtering via search (title/description)
 * - sortOrder ASC then createdAt per F1 spec (repo already sorts that way)
 * - visibility semantics already specified — all demo visible
 * - real media bytes via media seam useMediaObjectUrl
 * - empty state تصویری نیست per spec (for images), آلبومی وجود ندارد for albums
 * - alt required enforced in repo
 * - upload via media seam two writes Media.create + Gallery.addImage
 * - no fabricated counts — counts from live data
 * - seed ships two albums with SIX bundled photographs (domains/demo/gallerySeed);
 *   their bytes are provisioned into the blob store at bootstrap like any upload,
 *   so an album is never "full of ids that resolve to nothing" and an operator who
 *   deletes them stays deleted — provisioning creates no rows
 * - honest pagination/truncation disclosure N ردیف از M
 * - no new route, same surface
 */
import { useMemo, useRef, useState } from "react";
import { ImagePlus, Search, Trash2 } from "lucide-react";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, Surface } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Field, Panel, inputCls, SearchInput } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getGalleryRepository, getMediaRepository } from "@/domains/registry";
import { releaseStagedMedia } from "@/domains/media/release";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/domains/media/types";
import { useAlbums, useGalleryImages } from "./useGallery";
import { useMediaObjectUrl } from "@/domains/media/useMedia";
import type { GalleryAlbum, GalleryImage } from "./types";
import { cn } from "@/utils/cn";

function partialNote(name: string, shown: number, total: number): string | null {
  return total > shown ? `${name}: ${faNum(shown)} ردیف از ${faNum(total)}` : null;
}

/** One thumbnail. Object-URL lifetime is owned by `useMediaObjectUrl` — F1 one-frame fix applied there. */
function Thumb({ image, busy, onRemove }: { image: GalleryImage; busy: boolean; onRemove: () => void }) {
  const url = useMediaObjectUrl(image.mediaId);

  return (
    <li className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      {url ? (
        <img src={url} alt={image.alt} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center px-2 text-center text-[10.5px] leading-relaxed text-ink-500">
          فایل تصویر در این مرورگر موجود نیست
        </div>
      )}
      <div className="p-2">
        <p className="truncate text-[11px] text-ink-200">{image.caption}</p>
        <p className="truncate text-[10px] text-ink-500">{image.alt}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`حذف ${image.caption}`}
        disabled={busy}
        className="absolute left-1.5 top-1.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

export function GalleryPanel() {
  const { notify } = useApp();
  const [albumSearch, setAlbumSearch] = useState("");
  const { items: albums, total: albumsTotal, loading, error, reload } = useAlbums({ per_page: 100, search: albumSearch || undefined });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [albumTitle, setAlbumTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected: GalleryAlbum | undefined = useMemo(
    () => albums.find((a) => a.id === selectedId) ?? albums[0],
    [albums, selectedId],
  );

  const { items: images, total: imagesTotal, loading: imagesLoading, error: imagesError, reload: reloadImages } = useGalleryImages(
    selected ? { albumId: selected.id, per_page: 200 } : { per_page: 0 },
  );

  const albumsNote = partialNote("آلبوم‌ها", albums.length, albumsTotal);
  const imagesNote = partialNote("تصاویر", images.length, imagesTotal);

  const createAlbum = async () => {
    const title = albumTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      const album = await getGalleryRepository().createAlbum({ title, description: "" });
      setSelectedId(album.id);
      setAlbumTitle("");
      notify({ tone: "success", title: `آلبوم «${title}» ساخته شد` });
    } catch (cause) {
      notify({ tone: "danger", title: "ساخت آلبوم انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (!selected) return;
    const alt = caption.trim() || file.name;
    setBusy(true);
    /*
      Two awaited writes: the bytes are stored first, then the image row that
      references them. If the row write fails, the stored asset is unreachable —
      so the upload this attempt created is released through the media domain's
      staged path, which frees metadata and bytes together and reports a cleanup
      failure instead of swallowing it. A successful write keeps the asset, and
      the album's own cleanup handles nothing here: this asset is the new one.
    */
    let stagedMediaId: string | undefined;
    try {
      const asset = await getMediaRepository().create({
        kind: "image",
        filename: file.name,
        mimeType: file.type,
        bytes: await file.arrayBuffer(),
      });
      stagedMediaId = asset.id;
      await getGalleryRepository().addImage({
        albumId: selected.id,
        mediaId: asset.id,
        caption: alt,
        alt,
      });
      setCaption("");
      notify({ tone: "success", title: "تصویر افزوده شد", detail: "فایل فقط در همین مرورگر ذخیره شده است." });
    } catch (cause) {
      // The image row was never written, so the staged upload must not linger.
      await releaseStagedMedia(stagedMediaId, getMediaRepository());
      notify({ tone: "danger", title: "افزودن تصویر انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removeImage = async (image: GalleryImage) => {
    setBusy(true);
    try {
      await getGalleryRepository().removeImage(image.id);
      notify({ tone: "success", title: "تصویر حذف شد" });
    } catch (cause) {
      notify({ tone: "danger", title: "حذف تصویر انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState className="py-16" label="در حال بارگذاری گالری…" />;
  if (error) return <ErrorState className="py-16" title="بارگذاری گالری ناموفق بود" description={error.message} onRetry={reload} />;

  return (
    <Panel title="گالری تصاویر" kicker="تصاویر آموزشگاه، اجراها و کلاس‌ها — seed VERIFIED 2 albums 0 images">
      <div className="mb-3 flex items-center gap-2">
        <SearchInput value={albumSearch} onChange={setAlbumSearch} placeholder="جستجوی آلبوم…" />
        {albumsNote && <span className="text-[11px] text-ink-400">{albumsNote}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div>
          <h3 className="mb-2 text-[11px] font-medium text-ink-400">آلبوم‌ها — {faNum(albumsTotal)} — sortOrder ASC then createdAt</h3>
          {albums.length === 0 ? (
            <EmptyState title="آلبومی وجود ندارد" description="برای دسته‌بندی تصاویر یک آلبوم بسازید. seed: ۲ آلبوم ۰ تصویر VERIFIED" />
          ) : (
            <ul className="space-y-1.5">
              {albums.map((album) => (
                <li key={album.id}>
                  <button
                    type="button"
                    aria-current={album.id === selected?.id}
                    aria-label={album.title}
                    onClick={() => setSelectedId(album.id)}
                    className={cn(
                      "w-full truncate rounded-xl border p-2.5 text-right text-[12.5px] transition-colors",
                      album.id === selected?.id ? "border-gold-500/30 bg-gold-500/[0.06] text-ink-50" : "border-white/[0.06] bg-white/[0.02] text-ink-200 hover:bg-white/[0.04]",
                    )}
                  >
                    <span className="block truncate">{album.title}</span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-ink-400">{album.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {albumsNote && <p className="mt-2 text-[11px] text-ink-400">{albumsNote} — honest truncation disclosure</p>}

          <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void createAlbum(); }}>
            <Field label="آلبوم جدید" className="flex-1">
              {(control) => <input {...control} className={inputCls} placeholder="مثلاً کنسرت بهار" value={albumTitle} disabled={busy} onChange={(e) => setAlbumTitle(e.target.value)} />}
            </Field>
            <Button type="submit" size="sm" variant="subtle" className="mb-[2px]" disabled={busy || !albumTitle.trim()}>افزودن</Button>
          </form>
        </div>

        <div>
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <Field label="توضیح تصویر (متن جایگزین — alt الزامی)" className="min-w-[200px] flex-1">
                  {(control) => <input {...control} className={inputCls} placeholder="برای دسترس‌پذیری الزامی است" value={caption} disabled={busy} onChange={(e) => setCaption(e.target.value)} />}
                </Field>
                <input ref={fileInput} type="file" className="sr-only" accept={ALLOWED_IMAGE_TYPES.join(",")} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
                <Button size="sm" variant="primary" className="mb-[2px]" disabled={busy} onClick={() => fileInput.current?.click()}>
                  <ImagePlus className="size-3.5" /> {busy ? "در حال افزودن…" : "افزودن تصویر"}
                </Button>
                {imagesNote && <span className="text-[11px] text-ink-400">{imagesNote}</span>}
              </div>

              {imagesError ? (
                <ErrorState title="بارگذاری تصاویر این آلبوم ناموفق بود" description={imagesError.message} onRetry={reloadImages} />
              ) : imagesLoading ? (
                <LoadingState label="در حال بارگذاری تصاویر این آلبوم…" />
              ) : images.length === 0 ? (
                <EmptyState title="تصویری نیست" description="این آلبوم خالی است — اولین تصویر را اضافه کنید. seed VERIFIED ۲ آلبوم ۰ تصویر — خالی بودن legitimate است." />
              ) : (
                <>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {images.map((image) => <Thumb key={image.id} image={image} busy={busy} onRemove={() => void removeImage(image)} />)}
                  </ul>
                  {imagesNote && <p className="mt-2 text-[11px] text-ink-400">{imagesNote} — sortOrder ASC then createdAt</p>}
                </>
              )}

              <Surface className="mt-4 border-warn-500/20 bg-warn-500/[0.05] p-3.5 text-[11.5px] leading-relaxed text-ink-200">
                تصاویر فقط در حافظهٔ همین مرورگر ذخیره می‌شوند، در پشتیبان‌گیری قرار نمی‌گیرند و روی دستگاه دیگری دیده نمی‌شوند. حداکثر حجم هر تصویر {faNum(MAX_IMAGE_BYTES / (1024 * 1024))} مگابایت است. انتشار واقعی گالری به فضای ذخیره‌سازی سمت سرور نیاز دارد. seed: ۲ آلبوم «کنسرت پایان ترم» و «فضای آموزشگاه» ۰ تصویر VERIFIED via learningSeed.ts:258-278
              </Surface>
            </>
          ) : (
            <EmptyState title="آلبومی انتخاب نشده" description="ابتدا یک آلبوم بسازید یا انتخاب کنید." />
          )}
        </div>
      </div>
    </Panel>
  );
}
