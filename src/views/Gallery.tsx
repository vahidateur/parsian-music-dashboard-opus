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
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarRange, ChevronLeft, ClipboardList, ImageOff, Images, Pencil, Plus, Trash2, Archive } from "lucide-react";
import recitalBackdrop from "@/assets/images/recital-violin.jpg";
import { ModuleRail, type ModuleRailGroup } from "@/components/navigation/ModuleRail";
import { GalleryLightbox, galleryDate } from "@/components/gallery/GalleryLightbox";
import { GalleryUploader } from "@/components/gallery/GalleryUploader";
import { GalleryAlbumManager } from "@/components/gallery/GalleryAlbumManager";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Button } from "@/components/ds/primitives";
import { SearchInput, Segmented, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { useCan } from "@/domains/auth/AuthContext";
import { useApp } from "@/context/AppContext";
import { useAlbums, useGalleryImages } from "@/domains/gallery/useGallery";
import { useDemoGalleryBytes } from "@/targets/galleryProvisioning";
import type { GalleryAlbum, GalleryImage } from "@/domains/gallery/types";
import { useGalleryViewMode } from "@/domains/gallery/useGalleryViewMode";
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

function filedOn(image: GalleryImage): string { return image.createdAt.slice(0, 10); }
function sectionCopy(section: string, albums: GalleryAlbum[]): [string, string] {
  if (section === UNSUPPORTED_TRASH) return ["حذف‌شده‌ها", "سطل بازیافت در GalleryRepository فعلی وجود ندارد؛ حذف، قطعی و صریح است."];
  const album = albums.find((item) => `${ALBUM_PREFIX}${item.id}` === section);
  if (album) return [album.title, album.description || `تصویرهای آلبوم «${album.title}».`];
  return ["گالری آموزشگاه", "خاطرات، اجراها و لحظه‌های موسیقایی آموزشگاه پارسیان"];
}

export function GalleryView() {
  // Gallery curation is its own permission since §36 (before that the view
  // borrowed library.write). Reading the showcase needs no gate beyond the
  // view's own `gallery.read` requirement.
  const { notify } = useApp();
  const canWrite = useCan("gallery.write");
  const canSeeDetails = useCan("gallery.details");
  const imagesState = useGalleryImages({ per_page: 200 });
  const albumsState = useAlbums({ per_page: 200 });
  const bytes = useDemoGalleryBytes();
  const [section, setSection] = useState(ALL);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [mode, setMode] = useGalleryViewMode();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [albumManagerOpen, setAlbumManagerOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const images = imagesState.items ?? [];
  const albums = albumsState.items ?? [];
  const albumCounts = useMemo(() => new Map(albums.map((album) => [album.id, images.filter((image) => image.albumId === album.id).length])), [albums, images]);
  const [heading, subtitle] = sectionCopy(section, albums);
  /*
   * A persisted write anywhere bumps the shared data version, so these lists
   * refetch in the background — including once per photo of a batch upload.
   * The hook keeps the rendered page across a same-params refetch, so only
   * the very first load takes the full loading state; afterwards the grid
   * stays on screen instead of flashing it once per photo.
   */
  const [settledOnce, setSettledOnce] = useState(false);
  useEffect(() => {
    if (!imagesState.loading && !albumsState.loading) setSettledOnce(true);
  }, [imagesState.loading, albumsState.loading]);

  /*
   * Batch work: the operator picks tiles, then moves or deletes them as one
   * job. There is no server batch verb, so the view awaits one existing
   * write per image and reports the honest per-item tally — a partial
   * failure names its count instead of claiming everything landed.
   */
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchTarget, setBatchTarget] = useState("");
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const toggleSelect = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
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
  const columnCount = useMasonryColumns();
  const masonryColumns = useMemo(() => distributeIntoColumns(visible, columnCount), [visible, columnCount]);
  const selectedVisible = useMemo(() => visible.filter((image) => selected.has(image.id)), [visible, selected]);
  const railGroups: ModuleRailGroup[] = useMemo(() => [
    { id: "collection", items: [{ id: ALL, label: "همه تصاویر", count: images.length, icon: Images }, ...UNSUPPORTED_GALLERY_SECTIONS.map(([id, label]) => ({ id, label, icon: ClipboardList, disabled: true, hint: "این رابطه در GalleryRepository فعلی پشتیبانی نمی‌شود" })), { id: UNSUPPORTED_TRASH, label: "حذف‌شده‌ها", icon: Trash2, disabled: true, hint: "soft delete و restore پشتیبانی نمی‌شود" }] },
    { id: "albums", label: "آلبوم‌های موجود", items: albums.map((album) => ({ id: `${ALBUM_PREFIX}${album.id}`, label: album.title, count: albumCounts.get(album.id) ?? 0, icon: Archive })) },
  ], [albums, albumCounts, images.length]);

  if (!bytes.settled || !settledOnce) return <LoadingState label="در حال باز کردن تالار گالری…" />;
  if (imagesState.error) return <ErrorState error={imagesState.error} onRetry={imagesState.reload} />;
  const reload = () => { imagesState.reload(); albumsState.reload(); };

  const runBatch = async (verb: "move" | "delete", targetAlbumId?: string) => {
    const ids = selectedVisible.map((image) => image.id);
    if (ids.length === 0) return;
    setBatchBusy(true);
    let done = 0;
    const failed: string[] = [];
    let lastError: unknown = null;
    for (const id of ids) {
      const image = visible.find((item) => item.id === id);
      if (!image) continue;
      try {
        if (verb === "move" && targetAlbumId && image.albumId !== targetAlbumId) {
          await getGalleryRepository().addImage({
            albumId: targetAlbumId,
            mediaId: image.mediaId,
            caption: image.caption,
            alt: image.alt,
          });
          await getGalleryRepository().removeImage(image.id);
        } else if (verb === "delete") {
          await getGalleryRepository().removeImage(image.id);
        } else {
          continue;
        }
        done += 1;
      } catch (cause) {
        lastError = cause;
        failed.push(image.caption);
      }
    }
    setBatchBusy(false);
    setConfirmBatchDelete(false);
    setSelected(new Set());
    setSelectionMode(false);
    reload();
    if (failed.length === 0) {
      notify({
        tone: "success",
        title: verb === "move" ? `${faNum(done)} تصویر منتقل شد` : `${faNum(done)} تصویر حذف شد`,
      });
    } else if (done === 0) {
      notify({ tone: "danger", title: verb === "move" ? "انتقال انجام نشد" : "حذف انجام نشد", detail: apiErrorFromThrown(lastError).message });
    } else {
      notify({ tone: "warning", title: `${faNum(done)} انجام شد، ${faNum(failed.length)} ناموفق ماند`, detail: failed.slice(0, 3).join("، ") });
    }
  };

  return <div className="flex flex-col-reverse gap-5 lg:flex-row">
    <main className="min-w-0 flex-1 space-y-5">
      <header className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-ink-900"><img src={recitalBackdrop} alt="" aria-hidden className="kenburns absolute inset-0 size-full object-cover opacity-30" /><div className="absolute inset-0 bg-gradient-to-l from-ink-950 via-ink-950/85 to-ink-950/35" aria-hidden /><div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-950 to-transparent" aria-hidden /><div className="relative px-6 py-8 sm:px-8 sm:py-10"><p className="text-[10px] tracking-[0.3em] text-gold-300/90">تالار نمایشگاه</p><h1 className="mt-3 font-display text-2xl font-bold text-photo-fg sm:text-[32px]">{heading}</h1><p className="mt-2.5 max-w-xl text-[12.5px] leading-relaxed text-photo-muted">{subtitle}</p><dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">{[["تصویر", images.length], ["آلبوم", albums.length], ["نمای فعلی", pool.length]].map(([label, value]) => <div key={label as string}><dt className="text-[10px] text-photo-faint">{label}</dt><dd className="nums mt-0.5 text-[17px] font-semibold text-gold-200">{faNum(value as number)}</dd></div>)}</dl><p className="mt-3 text-[11px] text-photo-muted">{faNum(images.length)} تصویر در {faNum(albums.length)} آلبوم</p></div></header>
      {bytes.unavailable ? (
        <p className={cn("rounded-xl border px-4 py-3 text-[11.5px] leading-relaxed", "border-warn-500/30 bg-warn-500/10 text-warn-200")}>فضای ذخیره‌سازی تصویر در این مرورگر در دسترس نیست؛ قاب‌ها شناسنامهٔ واقعی دارند اما بایت‌ها خوانده نمی‌شوند.</p>
      ) : !canWrite ? (
        <p className={cn("rounded-xl border px-4 py-3 text-[11.5px] leading-relaxed", "border-white/[0.07] bg-white/[0.02] text-ink-400")}>حساب شما حق تغییر در گالری ندارد؛ تصویرها را می‌بینید اما نمی‌توانید تصویری بیفزایید، ویرایش یا حذف کنید.</p>
      ) : null}
      <section className="surface p-3"><div className="flex flex-wrap items-center gap-2"><div className="min-w-[200px] flex-1"><SearchInput value={query} onChange={setQuery} placeholder="جستجوی عنوان یا متن جایگزین…" /></div><Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "grid", label: "شبکه‌ای" }, { value: "compact", label: "فشرده" }, { value: "masonry", label: "ستونی" }, { value: "list", label: "فهرست" }]} />{canWrite && <Button size="sm" variant={selectionMode ? "primary" : "subtle"} onClick={() => { setSelectionMode((open) => !open); setSelected(new Set()); setConfirmBatchDelete(false); }} disabled={batchBusy}>{selectionMode ? "پایان انتخاب" : "انتخاب چندتایی"}</Button>}<select className={cn(inputCls, "h-8 w-auto text-xs")} value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="ترتیب نمایش"><option value="order">ترتیب آلبوم</option><option value="newest">جدیدترین</option><option value="oldest">قدیمی‌ترین</option><option value="title">عنوان</option></select><Button size="sm" variant="primary" onClick={() => setUploadOpen(true)} disabled={!canWrite}><Plus className="size-3.5" /> افزودن تصویر</Button></div><div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-2"><span className="flex items-center gap-1.5 text-[11px] text-ink-400"><CalendarRange className="size-3.5" /> بازهٔ ثبت</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="از تاریخ" className={cn(inputCls, "h-8 w-auto text-[11px]")} /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="تا تاریخ" className={cn(inputCls, "h-8 w-auto text-[11px]")} />{(from || to) && <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>پاک کردن</Button>}</div></section>
{canWrite && selectionMode && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gold-500/25 bg-gold-500/[0.05] p-3" role="region" aria-label="عملیات دسته‌جمعی">
          <span className="text-[12px] font-medium text-ink-100">{faNum(selectedVisible.length)} انتخاب شده</span>
          <select aria-label="آلبوم مقصد" className={cn(inputCls, "h-8 w-auto text-xs")} value={batchTarget} disabled={batchBusy} onChange={(event) => setBatchTarget(event.target.value)}>
            <option value="">آلبوم مقصد…</option>
            {albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
          </select>
          <Button size="sm" variant="subtle" disabled={batchBusy || !batchTarget || selectedVisible.length === 0} onClick={() => void runBatch("move", batchTarget || undefined)}>انتقال</Button>
          {confirmBatchDelete ? (
            <>
              <span className="text-[11.5px] text-danger-300">حذف {faNum(selectedVisible.length)} تصویر قطعی است؟</span>
              <Button size="sm" variant="ghost" disabled={batchBusy} onClick={() => setConfirmBatchDelete(false)}>انصراف</Button>
              <Button size="sm" variant="subtle" className="border-danger-500/40 bg-danger-500/10 text-danger-200" disabled={batchBusy} onClick={() => void runBatch("delete")}>تأیید حذف</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={batchBusy || selectedVisible.length === 0} onClick={() => setConfirmBatchDelete(true)}><Trash2 className="size-3.5" /> حذف {faNum(selectedVisible.length)} مورد</Button>
          )}
          <Button size="sm" variant="ghost" disabled={batchBusy} onClick={() => { setSelectionMode(false); setSelected(new Set()); setConfirmBatchDelete(false); }}>لغو انتخاب</Button>
        </div>
      )}
      {visible.length === 0 ? <EmptyState className="py-20" icon={<ImageOff className="size-6 opacity-70" />} title={images.length ? "تصویری در این نما پیدا نشد" : "هنوز تصویری بایگانی نشده است"} description={images.length ? "عبارت جستجو، آلبوم یا بازهٔ ثبت را تغییر دهید." : "تصویرها را چندتایی و با درگ‌اند‌دراپ به یک آلبوم واقعی اضافه کنید."} action={canWrite ? "افزودن تصویر" : undefined} onAction={() => setUploadOpen(true)} /> : mode === "list" ? <ul className="space-y-2">{visible.map((image, index) => <GalleryRow key={image.id} image={image} albumTitle={albums.find((album) => album.id === image.albumId)?.title} onOpen={() => setOpen(index)} selectionMode={selectionMode} selected={selected.has(image.id)} onToggleSelect={() => toggleSelect(image.id)} canReorder={canWrite && section.startsWith(ALBUM_PREFIX) && sort === "order" && !query && !from && !to} onMove={async (direction) => { const target = index + direction; if (target < 0 || target >= visible.length) return; await getGalleryRepository().reorderImage(image.id, target); reload(); }} />)}</ul> : mode === "masonry" ? <div className="flex items-start gap-2.5" data-masonry-columns={columnCount}>{masonryColumns.map((column, columnIndex) => <div key={columnIndex} className="min-w-0 flex-1 space-y-2.5">{column.map((image) => <MasonryTile key={image.id} image={image} albumTitle={albums.find((album) => album.id === image.albumId)?.title} onOpen={() => setOpen(visible.indexOf(image))} selectionMode={selectionMode} selected={selected.has(image.id)} onToggleSelect={() => toggleSelect(image.id)} />)}</div>)}</div> : <div className={cn("grid gap-2.5", mode === "compact" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "grid-flow-dense grid-cols-2 auto-rows-[150px] md:grid-cols-3 md:auto-rows-[180px] xl:grid-cols-4")}>{visible.map((image, index) => <GalleryTile key={image.id} image={image} albumTitle={albums.find((album) => album.id === image.albumId)?.title} canWrite={canWrite} className={mode === "grid" ? spanClass(index) : "aspect-square"} onOpen={() => setOpen(index)} selectionMode={selectionMode} selected={selected.has(image.id)} onToggleSelect={() => toggleSelect(image.id)} />)}</div>}
      {imagesState.total > images.length && <p className="text-[11px] text-ink-500">{faNum(images.length)} ردیف از {faNum(imagesState.total)} · برای مرور کامل‌تر، صفحهٔ بعدی از backend لازم است.</p>}
    </main>
    <ModuleRail kicker="تالار نمایشگاه" title="گالری" groups={railGroups} activeId={section} onSelect={setSection} action={canWrite ? <div className="space-y-2"><Button size="sm" variant="primary" className="w-full" onClick={() => setUploadOpen(true)}><Plus className="size-3.5" /> افزودن تصویر</Button><Button size="sm" variant="subtle" className="w-full" onClick={() => setAlbumManagerOpen(true)}><Archive className="size-3.5" /> مدیریت آلبوم‌ها</Button></div> : undefined} footer={<p className="px-3 text-[10.5px] leading-relaxed text-ink-500">{faNum(images.length)} تصویر · {faNum(albums.length)} آلبوم</p>} />
    {uploadOpen && <GalleryUploader albums={albums} onUploaded={() => reload()} onClose={() => setUploadOpen(false)} />}
    {albumManagerOpen && <GalleryAlbumManager albums={albums} counts={albumCounts} selectedAlbumId={section.startsWith(ALBUM_PREFIX) ? section.slice(ALBUM_PREFIX.length) : undefined} onSelect={(albumId) => setSection(`${ALBUM_PREFIX}${albumId}`)} onChanged={reload} onClose={() => setAlbumManagerOpen(false)} />}
    {open !== null && visible[open] && <GalleryLightbox images={visible} index={open} albumTitle={(image) => albums.find((album) => album.id === image.albumId)?.title} canWrite={canWrite} canSeeDetails={canSeeDetails} onIndex={setOpen} onClose={() => setOpen(null)} onChanged={reload} />}
  </div>;
}

function spanClass(index: number): string { const beat = index % 7; if (beat === 0) return "col-span-2 row-span-2"; if (beat === 3) return "row-span-2"; if (beat === 5) return "col-span-2"; return ""; }

/**
 * Round-robin distribution into explicit columns.
 *
 * CSS multi-column fills newspaper-style (column by column), which stacks
 * uneven heights into a staircase. Dealing pre-dealt hands round-robin keeps
 * every column to the same item count, so varied photo heights stay balanced
 * on any viewport — with percentage widths (`flex-1`) that scale with it.
 * Pure for tests: no layout measurement involved.
 */
export function distributeIntoColumns<T>(items: readonly T[], count: number): T[][] {
  const lanes = Math.max(1, count);
  const columns: T[][] = Array.from({ length: lanes }, () => []);
  items.forEach((item, index) => {
    columns[index % lanes].push(item);
  });
  return columns;
}

/** Responsive masonry lane count: 2 by default, 3 from md, 4 from xl. */
export function useMasonryColumns(): number {
  const query = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return 2;
    if (window.matchMedia("(min-width: 1280px)").matches) return 4;
    if (window.matchMedia("(min-width: 768px)").matches) return 3;
    return 2;
  }, []);
  const [count, setCount] = useState<number>(query);
  useEffect(() => {
    const onChange = (): void => setCount(query());
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
  }, [query]);
  return count;
}

/**
 * Masonry tile — the full frame, never cropped. Grid and compact modes crop
 * every tile to a fixed ratio (`aspect-square`, row spans); the mosaic
 * column layout below lets portrait and landscape photographs keep their
 * own shape, so nothing the operator framed is cut by the layout.
 */
function MasonryTile({ image, albumTitle, onOpen, selectionMode, selected, onToggleSelect }: { image: GalleryImage; albumTitle?: string; onOpen: () => void; selectionMode: boolean; selected: boolean; onToggleSelect: () => void }) {
  const url = useMediaObjectUrl(image.mediaId);
  return <figure className={cn("relative overflow-hidden rounded-2xl border bg-ink-900/60 transition-colors", selected ? "border-gold-400/60" : "border-white/[0.07]")}><button type="button" onClick={selectionMode ? onToggleSelect : onOpen} aria-label={`دیدن تصویر: ${image.caption}`} className="block w-full text-right">{url ? <img src={url} alt={image.alt} loading="lazy" className="h-auto w-full" /> : <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 px-3 text-center text-[10.5px] text-ink-500"><ImageOff className="size-5" /> فایل تصویر در این مرورگر موجود نیست</span>}<figcaption className="p-2.5"><p className="truncate text-[12px] font-medium text-ink-100">{image.caption}</p><p className="mt-0.5 truncate text-[10.5px] text-ink-500">{albumTitle ?? "بدون آلبوم"}</p></figcaption></button>{selectionMode && <label className="absolute left-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-black/60 backdrop-blur-sm"><input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`انتخاب تصویر: ${image.caption}`} className="size-4 accent-gold-400" /></label>}</figure>;
}

function GalleryTile({ image, albumTitle, canWrite, className, onOpen, selectionMode, selected, onToggleSelect }: { image: GalleryImage; albumTitle?: string; canWrite: boolean; className?: string; onOpen: () => void; selectionMode?: boolean; selected?: boolean; onToggleSelect?: () => void }) {
  const url = useMediaObjectUrl(image.mediaId);
  return <article className={cn("group relative overflow-hidden rounded-2xl border bg-ink-900/60 transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-0.5 hover:border-gold-400/40 hover:shadow-[0_22px_45px_-22px_rgba(0,0,0,0.9)]", selected ? "border-gold-400/60" : "border-white/[0.06]", className)}><button type="button" onClick={selectionMode ? onToggleSelect : onOpen} aria-label={`دیدن تصویر: ${image.caption}`} className="absolute inset-0 z-0 size-full focus-visible:outline-2 focus-visible:outline-gold-400/70" />{url ? <img src={url} alt={image.alt} loading="lazy" className="pointer-events-none absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" /> : <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-[10.5px] text-ink-500"><ImageOff className="size-5" /> فایل تصویر در این مرورگر موجود نیست</span>}<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-3 pt-10 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"><p className="truncate text-[12.5px] font-medium text-photo-fg">{image.caption}</p><p className="mt-0.5 truncate text-[10.5px] text-photo-muted">{albumTitle || "بدون آلبوم"} · {galleryDate(filedOn(image))}</p></div>{selectionMode && <label className="absolute right-2 top-2 z-10 flex size-7 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-black/60 backdrop-blur-sm" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={!!selected} onChange={onToggleSelect} onClick={(event) => event.stopPropagation()} aria-label={`انتخاب تصویر: ${image.caption}`} className="size-4 accent-gold-400" /></label>}{canWrite && !selectionMode && <div className="absolute left-2.5 top-2.5 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"><TileAction label="ویرایش شناسنامه" onClick={onOpen}><Pencil className="size-3.5" /></TileAction><TileAction label="حذف تصویر" onClick={onOpen}><Trash2 className="size-3.5" /></TileAction></div>}</article>;
}
function TileAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-label={label} title={label} onClick={(event) => { event.stopPropagation(); onClick(); }} className="ms-1 flex size-7 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-photo-muted backdrop-blur-sm hover:border-gold-400/50 hover:text-gold-100">{children}</button>; }
function GalleryRow({ image, albumTitle, onOpen, canReorder = false, onMove, selectionMode, selected, onToggleSelect }: { image: GalleryImage; albumTitle?: string; onOpen: () => void; canReorder?: boolean; onMove?: (direction: -1 | 1) => Promise<void>; selectionMode?: boolean; selected?: boolean; onToggleSelect?: () => void }) { const url = useMediaObjectUrl(image.mediaId); return <li className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-gold-400/30">{selectionMode ? <label className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-black/40"><input type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label={`انتخاب تصویر: ${image.caption}`} className="size-4 accent-gold-400" /></label> : <button type="button" onClick={onOpen} aria-label={`دیدن تصویر: ${image.caption}`} className="relative flex size-16 shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-ink-900">{url ? <img src={url} alt={image.alt} className="size-full object-cover" /> : <ImageOff className="m-auto size-4 text-ink-500" />}</button>}<button type="button" onClick={selectionMode ? onToggleSelect : onOpen} className="min-w-0 flex-1 text-right"><p className="truncate text-[13px] font-medium text-ink-50">{image.caption}</p><p className="mt-0.5 truncate text-[11px] text-ink-400">{albumTitle || "بدون آلبوم"} · {galleryDate(filedOn(image))}</p></button>{canReorder && onMove ? <span className="flex shrink-0 gap-1"><button type="button" aria-label="بالا بردن تصویر" onClick={() => void onMove(-1)} className="rounded-lg border border-white/[0.08] p-1.5 text-ink-400 hover:border-gold-400/40 hover:text-gold-200"><ArrowUp className="size-3.5" /></button><button type="button" aria-label="پایین بردن تصویر" onClick={() => void onMove(1)} className="rounded-lg border border-white/[0.08] p-1.5 text-ink-400 hover:border-gold-400/40 hover:text-gold-200"><ArrowDown className="size-3.5" /></button></span> : <ChevronLeft className="size-4 text-ink-600" />}</li>; }
