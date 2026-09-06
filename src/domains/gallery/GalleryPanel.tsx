/**
 * Academy photo gallery (Settings → operations).
 *
 * Uploads are genuinely local: the file is validated (type allow-list, magic
 * bytes, size cap), its bytes go to IndexedDB and its metadata to the demo
 * dataset. Nothing is uploaded to a server, and the notice says so — the demo
 * never implies remote storage it does not have (§37).
 */
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, Surface } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Field, Panel, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getGalleryRepository, getMediaRepository } from "@/domains/registry";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/domains/media/types";
import { useAlbums, useGalleryImages, useMediaObjectUrl } from "./useGallery";
import type { GalleryAlbum, GalleryImage } from "./types";
import { cn } from "@/utils/cn";

/** One thumbnail. Object-URL lifetime is owned by `useMediaObjectUrl`. */
function Thumb({ image, busy, onRemove }: { image: GalleryImage; busy: boolean; onRemove: () => void }) {
  const url = useMediaObjectUrl(image.mediaId);

  return (
    <li className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      {url ? (
        // `alt` is required by the repository, so it is always meaningful.
        <img src={url} alt={image.alt} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center px-2 text-center text-[10.5px] leading-relaxed text-ink-500">
          فایل تصویر در این مرورگر موجود نیست
        </div>
      )}
      <div className="p-2">
        <p className="truncate text-[11px] text-ink-200">{image.caption}</p>
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
  const { items: albums, loading, error, reload } = useAlbums({ per_page: 100 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [albumTitle, setAlbumTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected: GalleryAlbum | undefined = albums.find((a) => a.id === selectedId) ?? albums[0];
  const { items: images } = useGalleryImages(selected ? { albumId: selected.id, per_page: 200 } : { per_page: 0 });

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
    try {
      // Validation (type, magic bytes, size) lives in the media repository.
      const asset = await getMediaRepository().create({
        kind: "image",
        filename: file.name,
        mimeType: file.type,
        bytes: await file.arrayBuffer(),
      });
      // `alt` is required by the repository for accessibility; the caption
      // doubles as the alt text when no separate one is supplied.
      await getGalleryRepository().addImage({
        albumId: selected.id,
        mediaId: asset.id,
        caption: alt,
        alt,
      });
      setCaption("");
      notify({ tone: "success", title: "تصویر افزوده شد", detail: "فایل فقط در همین مرورگر ذخیره شده است." });
    } catch (cause) {
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
  if (error)
    return <ErrorState className="py-16" title="بارگذاری گالری ناموفق بود" description={error.message} onRetry={reload} />;

  return (
    <Panel title="گالری تصاویر" kicker="تصاویر آموزشگاه، اجراها و کلاس‌ها">
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div>
          <h3 className="mb-2 text-[11px] font-medium text-ink-400">آلبوم‌ها</h3>
          {albums.length === 0 ? (
            <EmptyState title="آلبومی وجود ندارد" description="برای دسته‌بندی تصاویر یک آلبوم بسازید." />
          ) : (
            <ul className="space-y-1.5">
              {albums.map((album) => (
                <li key={album.id}>
                  <button
                    type="button"
                    aria-current={album.id === selected?.id}
                    onClick={() => setSelectedId(album.id)}
                    className={cn(
                      "w-full truncate rounded-xl border p-2.5 text-right text-[12.5px] transition-colors",
                      album.id === selected?.id
                        ? "border-gold-500/30 bg-gold-500/[0.06] text-ink-50"
                        : "border-white/[0.06] bg-white/[0.02] text-ink-200 hover:bg-white/[0.04]",
                    )}
                  >
                    {album.title}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void createAlbum();
            }}
          >
            <Field label="آلبوم جدید" className="flex-1">
              {(control) => (
                <input
                  {...control}
                  className={inputCls}
                  placeholder="مثلاً کنسرت بهار"
                  value={albumTitle}
                  disabled={busy}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" size="sm" variant="subtle" className="mb-[2px]" disabled={busy || !albumTitle.trim()}>
              افزودن
            </Button>
          </form>
        </div>

        <div>
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <Field label="توضیح تصویر (متن جایگزین)" className="min-w-[200px] flex-1">
                  {(control) => (
                    <input
                      {...control}
                      className={inputCls}
                      placeholder="برای دسترس‌پذیری الزامی است"
                      value={caption}
                      disabled={busy}
                      onChange={(e) => setCaption(e.target.value)}
                    />
                  )}
                </Field>
                <input
                  ref={fileInput}
                  type="file"
                  className="sr-only"
                  accept={ALLOWED_IMAGE_TYPES.join(",")}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
                <Button
                  size="sm"
                  variant="primary"
                  className="mb-[2px]"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <ImagePlus className="size-3.5" /> {busy ? "در حال افزودن…" : "افزودن تصویر"}
                </Button>
              </div>

              {images.length === 0 ? (
                <EmptyState title="این آلبوم خالی است" description="اولین تصویر را اضافه کنید." />
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((image) => (
                    <Thumb key={image.id} image={image} busy={busy} onRemove={() => void removeImage(image)} />
                  ))}
                </ul>
              )}

              <Surface className="mt-4 border-warn-500/20 bg-warn-500/[0.05] p-3.5 text-[11.5px] leading-relaxed text-ink-200">
                تصاویر فقط در حافظهٔ همین مرورگر ذخیره می‌شوند، در پشتیبان‌گیری قرار نمی‌گیرند و روی دستگاه دیگری دیده
                نمی‌شوند. حداکثر حجم هر تصویر {faNum(MAX_IMAGE_BYTES / (1024 * 1024))} مگابایت است. انتشار واقعی گالری
                به فضای ذخیره‌سازی سمت سرور نیاز دارد.
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
