/**
 * The gallery's reading room: one photograph at exhibition scale, with the
 * catalogue fields the current GalleryRepository actually owns.
 *
 * The existing domain persists the image file, caption, alt text, album and
 * createdAt. It does not persist tags, featured state, arbitrary categories,
 * related people/events or a recycle bin; those are intentionally disclosed in
 * the panel instead of being painted as fake controls.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Loader2, Maximize2, Minimize2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ds/primitives";
import { Field, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getGalleryRepository } from "@/domains/registry";
import { useMediaObjectUrl } from "@/domains/media/useMedia";
import type { GalleryImage } from "@/domains/gallery/types";
import { isoToJalaliDisplay } from "@/domains/scheduling/dateBridge";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { cn } from "@/utils/cn";

export function galleryDate(iso?: string): string {
  if (!iso) return "—";
  return isoToJalaliDisplay(iso) || iso;
}

export function GalleryLightbox({
  images,
  index,
  albumTitle,
  canWrite,
  onIndex,
  onClose,
  onChanged,
}: {
  images: GalleryImage[];
  index: number;
  albumTitle: (image: GalleryImage) => string | undefined;
  canWrite: boolean;
  onIndex: (index: number) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { notify } = useApp();
  const image = images[index];
  const url = useMediaObjectUrl(image?.mediaId);
  const total = images.length;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [caption, setCaption] = useState(image?.caption ?? "");
  const [alt, setAlt] = useState(image?.alt ?? "");
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
    setCaption(image?.caption ?? "");
    setAlt(image?.alt ?? "");
    setFullscreen(false);
  }, [image?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editing) setEditing(false);
        else onClose();
      } else if (event.key === "ArrowLeft" && total > 1) onIndex((index + 1) % total);
      else if (event.key === "ArrowRight" && total > 1) onIndex((index - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, index, onClose, onIndex, total]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  if (!image) return null;

  const save = async () => {
    if (caption.trim().length < 2 || alt.trim().length < 2) {
      notify({ tone: "danger", title: "عنوان و متن جایگزین لازم است" });
      return;
    }
    setBusy(true);
    try {
      await getGalleryRepository().updateImage(image.id, { caption: caption.trim(), alt: alt.trim() });
      notify({ tone: "success", title: "شناسنامهٔ تصویر به‌روزرسانی شد" });
      setEditing(false);
      onChanged();
    } catch (cause) {
      notify({ tone: "danger", title: "ذخیرهٔ تغییرات انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally { setBusy(false); }
  };

  const setAlbumCover = async () => {
    setBusy(true);
    try {
      await getGalleryRepository().updateAlbum(image.albumId, { coverMediaId: image.mediaId });
      notify({ tone: "success", title: "تصویر به‌عنوان جلد آلبوم تنظیم شد" });
      onChanged();
    } catch (cause) {
      notify({ tone: "danger", title: "تنظیم جلد آلبوم انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally { setBusy(false); }
  };

  const toggleFullscreen = async () => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else if (frame.requestFullscreen) {
        await frame.requestFullscreen();
        setFullscreen(true);
      } else {
        notify({ tone: "info", title: "نمایش تمام‌صفحه در این مرورگر در دسترس نیست" });
      }
    } catch (cause) {
      notify({ tone: "info", title: "نمایش تمام‌صفحه انجام نشد", detail: apiErrorFromThrown(cause).message });
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await getGalleryRepository().removeImage(image.id);
      notify({ tone: "success", title: "تصویر از گالری حذف شد", detail: "حذف قابل‌بازگردانی در مدل فعلی پشتیبانی نمی‌شود." });
      onChanged();
      onClose();
    } catch (cause) {
      notify({ tone: "danger", title: "حذف تصویر انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally { setBusy(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`تصویر ${faNum(index + 1)} از ${faNum(total)}: ${image.caption}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-3 backdrop-blur-md sm:p-6" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="بستن نمایش بزرگ" className="absolute left-4 top-4 z-10 rounded-full border border-photo-fg/25 bg-photo-fg/10 p-2 text-photo-muted hover:bg-photo-fg/20 hover:text-photo-fg"><X className="size-5" /></button>
      {total > 1 && <><LightboxNav side="next" onClick={() => onIndex((index + 1) % total)} /><LightboxNav side="previous" onClick={() => onIndex((index - 1 + total) % total)} /></>}
      <div className="grid max-h-full w-full max-w-6xl gap-0 overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-900/95 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] lg:grid-cols-[minmax(0,1fr)_340px]" onClick={(event) => event.stopPropagation()}>
        <div ref={frameRef} className="relative flex min-h-[42vh] items-center justify-center bg-black/60 p-3 sm:min-h-[62vh] sm:p-6">
          {url ? <img src={url} alt={image.alt} className="max-h-[70vh] rounded-2xl object-contain shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)]" /> : <span className="flex h-[46vh] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-photo-fg/15 text-center text-[11.5px] text-photo-muted"><ImageOff className="size-7 opacity-70" /> فایل تصویر در این مرورگر در دسترس نیست<span className="text-[10.5px] text-photo-faint">شناسنامهٔ تصویر همچنان معتبر است.</span></span>}
          <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "خروج از تمام‌صفحه" : "نمایش تمام‌صفحه"} className="absolute bottom-4 left-4 rounded-xl border border-white/15 bg-black/55 p-2 text-photo-muted backdrop-blur-sm hover:border-gold-400/50 hover:text-gold-100">{fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
        </div>
        <aside className="flex max-h-[70vh] flex-col overflow-y-auto border-t border-white/[0.06] bg-white/[0.02] p-5 lg:max-h-none lg:border-r lg:border-t-0">
          {editing ? <div className="space-y-3"><Field label="عنوان"><input className={inputCls} value={caption} onChange={(event) => setCaption(event.target.value)} /></Field><Field label="متن جایگزین" hint="برای صفحه‌خوان؛ الزامی."><input className={inputCls} value={alt} onChange={(event) => setAlt(event.target.value)} /></Field><p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[10.5px] leading-relaxed text-ink-500">دسته، برچسب، منتخب و موجودیت‌های مرتبط در مدل فعلی GalleryRepository ذخیره نمی‌شوند؛ برای فعال‌شدن‌شان backend لازم است.</p><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>لغو</Button><Button size="sm" variant="primary" onClick={() => void save()} disabled={busy}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : null} ذخیرهٔ شناسنامه</Button></div></div> : <div className="space-y-4"><div><p className="text-[10px] tracking-[0.22em] text-gold-300/80">آرشیو تصویر</p><h2 className="mt-2 text-[17px] font-semibold leading-snug text-ink-50">{image.caption}</h2><p className="mt-1 text-[11px] text-ink-500">{albumTitle(image) ?? "بدون آلبوم"}</p></div><dl className="grid grid-cols-2 gap-2.5"><InfoCell label="تاریخ ثبت" value={galleryDate(image.createdAt.slice(0, 10))} /><InfoCell label="آلبوم" value={albumTitle(image) ?? "—"} /><InfoCell label="شماره" value={`${faNum(index + 1)} از ${faNum(total)}`} /></dl><p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-ink-400">این تصویر با فایل واقعی در لایهٔ رسانه پیوند دارد. دسته‌بندی موضوعی، برچسب، تصویر منتخب، تاریخ عکاسی و ارتباط با هنرجو/مدرس/کلاس/رویداد در architecture فعلی پشتیبانی نمی‌شوند.</p>{canWrite && <div className="space-y-2 border-t border-white/[0.06] pt-4"><div className="flex flex-wrap gap-2"><Button size="sm" variant="subtle" onClick={() => setEditing(true)}><Pencil className="size-3.5" /> ویرایش شناسنامه</Button><Button size="sm" variant="subtle" onClick={() => void setAlbumCover()} disabled={busy}><span className="text-[11px]" aria-hidden>◈</span> تنظیم جلد آلبوم</Button></div>{confirmDelete ? <div className="rounded-xl border border-danger-500/30 bg-danger-500/[0.07] p-3"><p className="text-[11px] leading-relaxed text-danger-300">تصویر و فایل متصل حذف می‌شود و بازگردانی در مدل فعلی وجود ندارد.</p><div className="mt-2.5 flex gap-2"><Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>انصراف</Button><Button size="sm" variant="subtle" className="border-danger-500/40 bg-danger-500/10 text-danger-200" onClick={() => void remove()} disabled={busy}><Trash2 className="size-3.5" /> حذف قطعی</Button></div></div> : <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 className="size-3.5" /> حذف تصویر</Button>}</div>}</div>}
        </aside>
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><dt className="text-[10px] text-ink-500">{label}</dt><dd className="mt-1 truncate text-[12px] text-ink-100">{value}</dd></div>;
}
function LightboxNav({ side, onClick }: { side: "next" | "previous"; onClick: () => void }) {
  const next = side === "next";
  const Icon = next ? ChevronLeft : ChevronRight;
  return <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} aria-label={next ? "تصویر بعدی" : "تصویر قبلی"} className={cn("absolute top-1/2 -translate-y-1/2 rounded-full border border-photo-fg/25 bg-photo-fg/10 p-2.5 text-photo-muted hover:bg-photo-fg/20 hover:text-photo-fg", next ? "left-2 sm:left-6" : "right-2 sm:right-6")}><Icon className="size-6" /></button>;
}
