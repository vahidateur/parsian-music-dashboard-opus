/**
 * GALLERY — the academy's exhibition hall.
 *
 * The view adds only contextual furniture inside the existing shell. The global
 * right rail, header, theme and navigation remain outside this room and are not
 * modified. The catalogue is deliberately honest about its current contract:
 * albums, caption, alt text, real media bytes, search, date/created ordering,
 * upload, edit and hard delete are persisted. Tags, arbitrary categories,
 * featured images, relations and a recycle bin require backend/domain fields
 * that are not present, so their rail entries are disabled and labelled.
 */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarRange, ChevronLeft, ClipboardList, ImageOff, Images, Pencil, Plus, Trash2, Archive } from "lucide-react";
import recitalBackdrop from "@/assets/images/recital-violin.jpg";
import { ModuleRail, type ModuleRailGroup } from "@/components/navigation/ModuleRail";
import { GalleryLightbox, galleryDate } from "@/components/gallery/GalleryLightbox";
import { GalleryUploader } from "@/components/gallery/GalleryUploader";
import { GalleryAlbumManager } from "@/components/gallery/GalleryAlbumManager";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Button } from "@/components/ds/primitives";
import { SearchInput, Segmented, inputCls } from "@/components/ds/patterns";
import { useCan } from "@/domains/auth/AuthContext";
import { useAlbums, useDemoGalleryBytes, useGalleryImages } from "@/domains/gallery/useGallery";
import type { GalleryAlbum, GalleryImage } from "@/domains/gallery/types";
import { useMediaObjectUrl } from "@/domains/media/useMedia";
import { getGalleryRepository } from "@/domains/registry";
import { faNum } from "@/lib/format";
import { cn } from "@/utils/cn";

const ALL = "all";
const ALBUM_PREFIX = "album:";
const UNSUPPORTED_TRASH = "unsupported-trash";
const UNSUPPORTED_GALLERY_SECTIONS = [
  ["unsupported:students", "هنرجویان"],
  ["unsupported:teachers", "استادان"],
  ["unsupported:classes", "کلاس‌ها"],
  ["unsupported:performances", "اجراها"],
  ["unsupported:events", "رویدادها"],
  ["unsupported:academy", "آموزشگاه"],
  ["unsupported:featured", "گالری منتخب"],
] as const;
type SortKey = "order" | "newest" | "oldest" | "title";
type ViewMode = "grid" | "compact" | "list";

function filedOn(image: GalleryImage): string { return image.createdAt.slice(0, 10); }
function sectionCopy(section: string, albums: GalleryAlbum[]): [string, string] {
  if (section === UNSUPPORTED_TRASH) return ["حذف‌شده‌ها", "سطل بازیافت در GalleryRepository فعلی وجود ندارد؛ حذف، قطعی و صریح است."];
  const album = albums.find((item) => `${ALBUM_PREFIX}${item.id}` === section);
  if (album) return [album.title, album.description || `تصویرهای آلبوم «${album.title}».`];
  return ["گالری آموزشگاه", "خاطرات، اجراها و لحظه‌های موسیقایی آموزشگاه پارسیان"];
}

export function GalleryView() {
  const canWrite = useCan("library.write");
  const imagesState = useGalleryImages({ per_page: 200 });
  const albumsState = useAlbums({ per_page: 200 });
  const bytes = useDemoGalleryBytes();
  const [section, setSection] = useState(ALL);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [mode, setMode] = useState<ViewMode>("grid");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [albumManagerOpen, setAlbumManagerOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const images = imagesState.items ?? [];
  const albums = albumsState.items ?? [];
  const albumCounts = useMemo(() => new Map(albums.map((album) => [album.id, images.filter((image) => image.albumId === album.id).length])), [albums, images]);
  const [heading, subtitle] = sectionCopy(section, albums);
  const pool = useMemo(() => section.startsWith(ALBUM_PREFIX) ? images.filter((image) => image.albumId === section.slice(ALBUM_PREFIX.length)) : images, [images, section]);
  const visible = useMemo(() => {
    const filtered = pool.filter((image) => {
      const date = filedOn(image);
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (query.trim() && ![image.caption, image.alt].some((field) => field.includes(query.trim()))) return false;
      return true;
    });
    return [...filtered].sort((left, right) => sort === "order" ? left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt) : sort === "title" ? left.caption.localeCompare(right.caption, "fa") : sort === "oldest" ? left.createdAt.localeCompare(right.createdAt) : right.createdAt.localeCompare(left.createdAt));
  }, [pool, from, to, query, sort]);
  const railGroups: ModuleRailGroup[] = useMemo(() => [
    { id: "collection", items: [{ id: ALL, label: "همه تصاویر", count: images.length, icon: Images }, ...UNSUPPORTED_GALLERY_SECTIONS.map(([id, label]) => ({ id, label, icon: ClipboardList, disabled: true, hint: "این رابطه در GalleryRepository فعلی پشتیبانی نمی‌شود" })), { id: UNSUPPORTED_TRASH, label: "حذف‌شده‌ها", icon: Trash2, disabled: true, hint: "soft delete و restore پشتیبانی نمی‌شود" }] },
    { id: "albums", label: "آلبوم‌های موجود", items: albums.map((album) => ({ id: `${ALBUM_PREFIX}${album.id}`, label: album.title, count: albumCounts.get(album.id) ?? 0, icon: Archive })) },
  ], [albums, albumCounts, images.length]);

  if (imagesState.loading || albumsState.loading || !bytes.settled) return <LoadingState label="در حال باز کردن تالار گالری…" />;
  if (imagesState.error) return <ErrorState description={imagesState.error.message} onRetry={imagesState.reload} />;
  const reload = () => { imagesState.reload(); albumsState.reload(); };

  return <div className="flex flex-col-reverse gap-5 lg:flex-row">
    <main className="min-w-0 flex-1 space-y-5">
      <header className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-ink-900"><img src={recitalBackdrop} alt="" aria-hidden className="kenburns absolute inset-0 size-full object-cover opacity-30" /><div className="absolute inset-0 bg-gradient-to-l from-ink-950 via-ink-950/85 to-ink-950/35" aria-hidden /><div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-950 to-transparent" aria-hidden /><div className="relative px-6 py-8 sm:px-8 sm:py-10"><p className="text-[10px] tracking-[0.3em] text-gold-300/90">تالار نمایشگاه</p><h1 className="mt-3 font-display text-2xl font-bold text-photo-fg sm:text-[32px]">{heading}</h1><p className="mt-2.5 max-w-xl text-[12.5px] leading-relaxed text-photo-muted">{subtitle}</p><dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">{[["تصویر", images.length], ["آلبوم", albums.length], ["نمای فعلی", pool.length]].map(([label, value]) => <div key={label as string}><dt className="text-[10px] text-photo-faint">{label}</dt><dd className="nums mt-0.5 text-[17px] font-semibold text-gold-200">{faNum(value as number)}</dd></div>)}</dl><p className="mt-3 text-[11px] text-photo-muted">{faNum(images.length)} تصویر در {faNum(albums.length)} آلبوم</p></div></header>
      {!bytes.unavailable && !canWrite ? null : <p className={cn("rounded-xl border px-4 py-3 text-[11.5px] leading-relaxed", bytes.unavailable ? "border-warn-500/30 bg-warn-500/10 text-warn-200" : "border-white/[0.07] bg-white/[0.02] text-ink-400")}>{bytes.unavailable ? "فضای ذخیره‌سازی تصویر در این مرورگر در دسترس نیست؛ قاب‌ها شناسنامهٔ واقعی دارند اما بایت‌ها خوانده نمی‌شوند." : "حساب شما حق تغییر در گالری ندارد؛ تصویرها را می‌بینید اما نمی‌توانید تصویری بیفزایید، ویرایش یا حذف کنید."}</p>}
      <section className="surface p-3.5 sm:p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-[220px] flex-1"><SearchInput value={query} onChange={setQuery} placeholder="جستجوی عنوان یا متن جایگزین…" /></div><Segmented value={mode} onChange={setMode} options={[{ value: "grid", label: "شبکه‌ای" }, { value: "compact", label: "فشرده" }, { value: "list", label: "فهرست" }]} /><select className={cn(inputCls, "h-8 w-auto text-xs")} value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="ترتیب نمایش"><option value="order">ترتیب آلبوم</option><option value="newest">جدیدترین</option><option value="oldest">قدیمی‌ترین</option><option value="title">عنوان</option></select><Button size="sm" variant="primary" onClick={() => setUploadOpen(true)} disabled={!canWrite}><Plus className="size-3.5" /> افزودن تصویر</Button></div><div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3"><span className="flex items-center gap-1.5 text-[11px] text-ink-400"><CalendarRange className="size-3.5" /> بازهٔ ثبت</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="از تاریخ" className={cn(inputCls, "h-8 w-auto text-[11px]")} /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="تا تاریخ" className={cn(inputCls, "h-8 w-auto text-[11px]")} />{(from || to) && <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>پاک کردن</Button>}</div></section>
      {visible.length === 0 ? <EmptyState className="py-20" icon={<ImageOff className="size-6 opacity-70" />} title={images.length ? "تصویری در این نما پیدا نشد" : "هنوز تصویری بایگانی نشده است"} description={images.length ? "عبارت جستجو، آلبوم یا بازهٔ ثبت را تغییر دهید." : "تصویرها را چندتایی و با درگ‌اند‌دراپ به یک آلبوم واقعی اضافه کنید."} action={canWrite ? "افزودن تصویر" : undefined} onAction={() => setUploadOpen(true)} /> : mode === "list" ? <ul className="space-y-2">{visible.map((image, index) => <GalleryRow key={image.id} image={image} albumTitle={albums.find((album) => album.id === image.albumId)?.title} onOpen={() => setOpen(index)} canReorder={canWrite && section.startsWith(ALBUM_PREFIX) && sort === "order" && !query && !from && !to} onMove={async (direction) => { const target = index + direction; if (target < 0 || target >= visible.length) return; await getGalleryRepository().reorderImage(image.id, target); reload(); }} />)}</ul> : <div className={cn("grid gap-2.5", mode === "compact" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "grid-flow-dense grid-cols-2 auto-rows-[150px] md:grid-cols-3 md:auto-rows-[180px] xl:grid-cols-4")}>{visible.map((image, index) => <GalleryTile key={image.id} image={image} albumTitle={albums.find((album) => album.id === image.albumId)?.title} canWrite={canWrite} className={mode === "grid" ? spanClass(index) : "aspect-square"} onOpen={() => setOpen(index)} />)}</div>}
      {imagesState.total > images.length && <p className="text-[11px] text-ink-500">{faNum(images.length)} ردیف از {faNum(imagesState.total)} · برای مرور کامل‌تر، صفحهٔ بعدی از backend لازم است.</p>}
    </main>
    <ModuleRail kicker="تالار نمایشگاه" title="گالری" groups={railGroups} activeId={section} onSelect={setSection} action={canWrite ? <div className="space-y-2"><Button size="sm" variant="primary" className="w-full" onClick={() => setUploadOpen(true)}><Plus className="size-3.5" /> افزودن تصویر</Button><Button size="sm" variant="subtle" className="w-full" onClick={() => setAlbumManagerOpen(true)}><Archive className="size-3.5" /> مدیریت آلبوم‌ها</Button></div> : undefined} footer={<p className="px-3 text-[10.5px] leading-relaxed text-ink-500">{faNum(images.length)} تصویر در {faNum(albums.length)} آلبوم · categories و restore نیازمند backend هستند.</p>} />
    {uploadOpen && <GalleryUploader albums={albums} onUploaded={() => reload()} onClose={() => setUploadOpen(false)} />}
    {albumManagerOpen && <GalleryAlbumManager albums={albums} counts={albumCounts} selectedAlbumId={section.startsWith(ALBUM_PREFIX) ? section.slice(ALBUM_PREFIX.length) : undefined} onSelect={(albumId) => setSection(`${ALBUM_PREFIX}${albumId}`)} onChanged={reload} onClose={() => setAlbumManagerOpen(false)} />}
    {open !== null && visible[open] && <GalleryLightbox images={visible} index={open} albumTitle={(image) => albums.find((album) => album.id === image.albumId)?.title} canWrite={canWrite} onIndex={setOpen} onClose={() => setOpen(null)} onChanged={reload} />}
  </div>;
}

function spanClass(index: number): string { const beat = index % 7; if (beat === 0) return "col-span-2 row-span-2"; if (beat === 3) return "row-span-2"; if (beat === 5) return "col-span-2"; return ""; }

function GalleryTile({ image, albumTitle, canWrite, className, onOpen }: { image: GalleryImage; albumTitle?: string; canWrite: boolean; className?: string; onOpen: () => void }) {
  const url = useMediaObjectUrl(image.mediaId);
  return <article className={cn("group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/60 transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-0.5 hover:border-gold-400/40 hover:shadow-[0_22px_45px_-22px_rgba(0,0,0,0.9)]", className)}><button type="button" onClick={onOpen} aria-label={`دیدن تصویر: ${image.caption}`} className="absolute inset-0 z-0 size-full focus-visible:outline-2 focus-visible:outline-gold-400/70" />{url ? <img src={url} alt={image.alt} loading="lazy" className="pointer-events-none absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" /> : <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-[10.5px] text-ink-500"><ImageOff className="size-5" /> فایل تصویر در این مرورگر موجود نیست</span>}<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-3 pt-10 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"><p className="truncate text-[12.5px] font-medium text-photo-fg">{image.caption}</p><p className="mt-0.5 truncate text-[10.5px] text-photo-muted">{albumTitle || "بدون آلبوم"} · {galleryDate(filedOn(image))}</p></div>{canWrite && <div className="absolute left-2.5 top-2.5 z-10 opacity-0 transition-opacity group-hover:opacity-100"><TileAction label="ویرایش شناسنامه" onClick={onOpen}><Pencil className="size-3.5" /></TileAction><TileAction label="حذف تصویر" onClick={onOpen}><Trash2 className="size-3.5" /></TileAction></div>}</article>;
}
function TileAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-label={label} title={label} onClick={(event) => { event.stopPropagation(); onClick(); }} className="ms-1 flex size-7 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-photo-muted backdrop-blur-sm hover:border-gold-400/50 hover:text-gold-100">{children}</button>; }
function GalleryRow({ image, albumTitle, onOpen, canReorder = false, onMove }: { image: GalleryImage; albumTitle?: string; onOpen: () => void; canReorder?: boolean; onMove?: (direction: -1 | 1) => Promise<void> }) { const url = useMediaObjectUrl(image.mediaId); return <li className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-gold-400/30"><button type="button" onClick={onOpen} aria-label={`دیدن تصویر: ${image.caption}`} className="relative flex size-16 shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-ink-900">{url ? <img src={url} alt={image.alt} className="size-full object-cover" /> : <ImageOff className="m-auto size-4 text-ink-500" />}</button><button type="button" onClick={onOpen} className="min-w-0 flex-1 text-right"><p className="truncate text-[13px] font-medium text-ink-50">{image.caption}</p><p className="mt-0.5 truncate text-[11px] text-ink-400">{albumTitle || "بدون آلبوم"} · {galleryDate(filedOn(image))}</p></button>{canReorder && onMove ? <span className="flex shrink-0 gap-1"><button type="button" aria-label="بالا بردن تصویر" onClick={() => void onMove(-1)} className="rounded-lg border border-white/[0.08] p-1.5 text-ink-400 hover:border-gold-400/40 hover:text-gold-200"><ArrowUp className="size-3.5" /></button><button type="button" aria-label="پایین بردن تصویر" onClick={() => void onMove(1)} className="rounded-lg border border-white/[0.08] p-1.5 text-ink-400 hover:border-gold-400/40 hover:text-gold-200"><ArrowDown className="size-3.5" /></button></span> : <ChevronLeft className="size-4 text-ink-600" />}</li>; }
