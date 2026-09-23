/**
 * LIBRARY — the academy's music archive.
 *
 * This view is a room INSIDE the immutable application shell. It introduces a
 * left contextual rail, not a second global navigation; the shell's rail,
 * header, theme and responsive navigation are not touched here.
 *
 * The visual stack is intentional:
 *   architectural atmosphere → smoked archive surface → quiet catalogue cards.
 *
 * The data stack is equally intentional:
 *   LibraryRepository for catalogue rows → MediaRepository for bytes.
 *
 * This page only exposes capabilities the current contracts can really support.
 * Folders, favourites, tags, attachments, restore, uploader identity and course
 * relations are shown as capability notes rather than fake buttons: adding them
 * requires persisted fields and server endpoints that do not exist in this
 * checkout. Upload, multi-upload, drag/drop, filtering, sorting, real download,
 * preview, metadata editing, visibility and the integrated audio control do
 * use the existing seams.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Archive,
  CalendarRange,
  BookOpen,
  Check,
  ChevronLeft,
  ClipboardList,
  Clock3,
  Download,
  FileAudio,
  FileText,
  FolderOpen,
  GraduationCap,
  Headphones,
  Info,
  LibraryBig,
  Loader2,
  Pencil,
  Play,
  Plus,
  SlidersHorizontal,
  Star,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import libraryBackdrop from "@/assets/images/hall.jpg";
import { ModuleRail, type ModuleRailGroup } from "@/components/navigation/ModuleRail";
import { LibraryAudioPlayer } from "@/components/library/LibraryAudioPlayer";
import { Button } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Field, inputCls, SearchInput } from "@/components/ds/patterns";
import { useCan } from "@/domains/auth/AuthContext";
import { useLibraryFile, useLibraryList } from "@/domains/library/useLibrary";
import {
  resourceKindLabel,
  type LibraryItem,
  type LibraryVisibility,
  type ResourceKind,
} from "@/domains/library/types";
import { getLibraryRepository, getMediaRepository } from "@/domains/registry";
import { useMediaObjectUrl } from "@/domains/media/useMedia";
import { instrumentName, useInstrumentCatalog } from "@/domains/instruments/catalog";
import type { InstrumentId } from "@/domains/instruments/types";
import { useStudentList } from "@/domains/students/useStudents";
import {
  ALLOWED_AUDIO_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  type MediaKind,
} from "@/domains/media/types";
import { apiErrorFromThrown } from "@/api/errors";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { cn } from "@/utils/cn";

const ALL = "all";
const RECENT = "recent";
const FREQUENT = "frequent";
const STARRED = "starred";
const FOLDER = "folder";
const KIND_PREFIX = "kind:";

type ViewMode = "grid" | "list";
type SortMode = "recent" | "popular" | "title";

const kindIcon: Record<ResourceKind, typeof FileText> = {
  sheet: BookOpen,
  audio: FileAudio,
  video: Video,
  doc: FileText,
};
const kindTone: Record<ResourceKind, string> = {
  sheet: "border-gold-400/30 bg-gold-500/[0.09] text-gold-200",
  audio: "border-bronze-400/30 bg-bronze-500/[0.10] text-bronze-200",
  video: "border-sky-400/25 bg-sky-500/[0.07] text-sky-200",
  doc: "border-white/[0.11] bg-white/[0.04] text-ink-200",
};

/** Presentation shelves backed by real kind + instrument filters, not fixture counts. */
const shelves: { id: string; label: string; kind: ResourceKind; instrument: InstrumentId }[] = [
  { id: "piano-sheets", label: "نت‌های پیانو", kind: "sheet", instrument: "piano" },
  { id: "theory-docs", label: "متدهای پایه", kind: "doc", instrument: "theory" },
  { id: "audio-examples", label: "نمونه‌های شنیداری", kind: "audio", instrument: "voice" },
  { id: "violin-video", label: "ویدیوهای آموزشی", kind: "video", instrument: "violin" },
];

function prettyKind(kind: ResourceKind): string {
  return resourceKindLabel[kind];
}

function acceptsFor(kind: ResourceKind): string {
  if (kind === "audio") return ALLOWED_AUDIO_TYPES.join(",");
  if (kind === "video") return "";
  return ALLOWED_DOCUMENT_TYPES.join(",");
}

function mediaKindFor(kind: ResourceKind): MediaKind | null {
  if (kind === "audio") return "audio";
  if (kind === "sheet" || kind === "doc") return "document";
  /* The media contract has no video kind yet; do not pretend it does. */
  return null;
}

function recentSort(items: LibraryItem[], sort: SortMode): LibraryItem[] {
  return [...items].sort((a, b) => {
    if (sort === "popular") return b.uses - a.uses;
    if (sort === "title") return a.title.localeCompare(b.title, "fa");
    const left = a.createdAt ? Date.parse(a.createdAt) : 0;
    const right = b.createdAt ? Date.parse(b.createdAt) : 0;
    return right - left;
  });
}

function ResourceMark({ kind, className }: { kind: ResourceKind; className?: string }) {
  const Icon = kindIcon[kind];
  return <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", kindTone[kind], className)}><Icon className="size-[18px]" strokeWidth={1.5} aria-hidden /></span>;
}

function WaveStrip({ item, active }: { item: LibraryItem; active: boolean }) {
  const peaks = item.peaks?.length ? item.peaks : Array.from({ length: 40 }, (_, i) => 0.25 + ((i * 17 + item.id.length * 9) % 60) / 100);
  return (
    <div className="flex h-9 items-center gap-[2px]" aria-hidden>
      {peaks.slice(0, 48).map((height, index) => <span key={index} className={cn("flex-1 rounded-full", active ? "bg-gold-300/70" : "bg-ink-400/45")} style={{ height: `${Math.max(22, Math.min(100, height * 100))}%` }} />)}
    </div>
  );
}

function ResourceCard({ item, active, onOpen, onPlay }: { item: LibraryItem; active: boolean; onOpen: () => void; onPlay: () => void }) {
  const hasFile = Boolean(item.mediaId);
  return (
    <article className={cn("group relative overflow-hidden rounded-2xl border bg-ink-950/55 p-4 transition-[transform,border-color,box-shadow] duration-300", active ? "border-gold-400/45 shadow-[0_0_0_1px_rgba(201,163,79,0.12)]" : "border-white/[0.08] hover:-translate-y-0.5 hover:border-gold-400/30 hover:shadow-[0_18px_45px_-28px_rgba(0,0,0,0.95)]")}>
      <button type="button" onClick={onOpen} className="w-full text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400">
        <div className="flex items-start gap-3">
          <ResourceMark kind={item.kind} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-ink-50"><span className="truncate">{item.title}</span>{item.active === false && <span className="shrink-0 rounded-full border border-warn-500/30 px-1.5 py-0.5 text-[9px] text-warn-300">غیرفعال</span>}</p>
            <p className="mt-1 truncate text-[11px] text-ink-400">{item.composer || "بدون نام پدیدآور"}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/[0.08] px-2 py-1 text-[9.5px] text-ink-400">{prettyKind(item.kind)}</span>
        </div>
      </button>

      <div className="mt-4 rounded-xl border border-white/[0.05] bg-black/15 px-3 py-2.5">
        {item.kind === "audio" ? <WaveStrip item={item} active={active} /> : <div className="flex h-9 items-center gap-2 text-[11px] text-ink-400"><span className="h-px flex-1 bg-gradient-to-l from-gold-400/40 to-transparent" /><span>{item.pages ? `${faNum(item.pages)} صفحه` : item.kind === "video" ? "پیش‌نمایش ویدیو" : "سند آرشیوی"}</span><span className="h-px flex-1 bg-gradient-to-r from-gold-400/40 to-transparent" /></div>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[10.5px] text-ink-500">
        <span className="truncate">{instrumentName(item.instrument)} · {item.level || "سطح ثبت نشده"}</span>
        <span className="nums shrink-0">{item.duration ?? item.size}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="flex items-center gap-1.5 text-[10px] text-ink-500"><Clock3 className="size-3" /> {faNum(item.uses)} استفاده</span>
        <div className="flex items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          {item.kind === "audio" && hasFile && <button type="button" onClick={(event) => { event.stopPropagation(); onPlay(); }} aria-label={`پخش ${item.title}`} className="flex size-7 items-center justify-center rounded-lg border border-gold-400/30 bg-gold-500/10 text-gold-200 hover:bg-gold-500/20"><Play className="size-3.5" fill="currentColor" /></button>}
          <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-label={`جزئیات ${item.title}`} className="flex size-7 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.03] text-ink-300 hover:text-ink-50"><ChevronLeft className="size-3.5" /></button>
        </div>
      </div>
    </article>
  );
}

function CapabilityNote() {
  return <div className="rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3 text-[11px] leading-relaxed text-ink-500"><Info className="me-1 inline size-3.5 text-gold-300/70" aria-hidden /> پوشه‌ها، ستاره‌دارها، برچسب، پیوست چندفایلی، بازیابی حذف، resource تصویری و رابطهٔ دوره/کلاس/مدرس/هنرجو در مدل فعلی منبع وجود ندارند؛ این رابط آن‌ها را شبیه‌سازی نمی‌کند. «موارد اخیر» در این نشست نگه داشته می‌شود و persistence دائمی ندارد. برای فعال‌شدن‌شان باید فیلدها و endpointهای پایدار به backend اضافه شود.</div>;
}

interface StagedResourceFile { id: string; file: File; status: "ready" | "uploading" | "success" | "error"; error?: string; }

function LibraryUploadDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { notify } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<StagedResourceFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [kind, setKind] = useState<ResourceKind>("sheet");
  const [instrument, setInstrument] = useState<InstrumentId>("piano");
  const [level, setLevel] = useState("");
  const [visibility, setVisibility] = useState<LibraryVisibility>("students");
  const [busy, setBusy] = useState(false);
  const instruments = useInstrumentCatalog().filter((instrument) => instrument.active);

  const addFiles = (incoming: FileList | File[]) => setFiles((current) => [...current, ...Array.from(incoming).map((file, index) => ({ id: `${file.name}-${file.size}-${Date.now()}-${index}`, file, status: "ready" as const }))]);
  const removeFile = (id: string) => setFiles((current) => current.filter((row) => row.id !== id));

  const submit = async () => {
    if (!title.trim() && files.length === 0) {
      notify({ tone: "danger", title: "عنوان یا فایل لازم است" });
      return;
    }
    const mediaKind = mediaKindFor(kind);
    if (files.length > 0 && !mediaKind) {
      notify({ tone: "danger", title: "بارگذاری ویدیو هنوز به media backend نیاز دارد", detail: "می‌توانید فرادادهٔ ویدیو را بدون فایل ثبت کنید." });
      return;
    }
    setBusy(true);
    try {
      if (files.length === 0) {
        await getLibraryRepository().create({ title: title.trim(), composer: composer.trim(), kind, instrument, level: level.trim(), visibility, active: true });
        notify({ tone: "success", title: `«${title.trim()}» به کتابخانه افزوده شد`, detail: "این منبع فعلاً فقط فراداده دارد." });
        onSaved();
        onClose();
        return;
      }
      let written = 0;
      let failed = 0;
      for (const staged of files) {
        if (staged.status === "success") continue;
        setFiles((current) => current.map((row) => row.id === staged.id ? { ...row, status: "uploading" as const, error: undefined } : row));
        let mediaId: string | undefined;
        try {
          const asset = await getMediaRepository().create({ kind: mediaKind!, filename: staged.file.name, mimeType: staged.file.type, bytes: await staged.file.arrayBuffer() });
          mediaId = asset.id;
          await getLibraryRepository().create({ title: title.trim() || staged.file.name.replace(/\.[^.]+$/, ""), composer: composer.trim(), kind, instrument, level: level.trim(), visibility, active: true, mediaId });
          setFiles((current) => current.map((row) => row.id === staged.id ? { ...row, status: "success" as const } : row));
          written += 1;
        } catch (cause) {
          if (mediaId) { try { await getMediaRepository().delete(mediaId); } catch { /* preserve the original upload error */ } }
          failed += 1;
          setFiles((current) => current.map((row) => row.id === staged.id ? { ...row, status: "error" as const, error: apiErrorFromThrown(cause).message } : row));
        }
      }
      if (written) notify({ tone: "success", title: `${faNum(written)} منبع به آرشیو افزوده شد`, detail: "هر فایل به‌عنوان یک رکورد واقعی کتابخانه ثبت شد." });
      if (failed) notify({ tone: "danger", title: `${faNum(failed)} فایل ثبت نشد`, detail: "فایل‌های ناموفق را اصلاح کنید و دوباره تلاش کنید." });
      onSaved();
      if (!failed) onClose();
    } catch (cause) {
      notify({ tone: "danger", title: "بارگذاری منبع کامل نشد", detail: apiErrorFromThrown(cause).message });
    } finally { setBusy(false); }
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files); };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label="افزودن منبع">
      <div className="surface w-full max-w-2xl p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4"><div><p className="text-[10px] tracking-[0.22em] text-gold-300/80">مخزن دانش</p><h2 className="mt-1.5 text-[17px] font-semibold text-ink-50">افزودن منبع به کتابخانه</h2><p className="mt-1 text-[11px] text-ink-500">چند فایل مستقل می‌توانند با یک شناسنامهٔ مشترک وارد آرشیو شوند.</p></div><Button size="sm" variant="ghost" onClick={onClose} disabled={busy} aria-label="بستن"><X className="size-4" /></Button></header>
        <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={cn("mt-5 rounded-2xl border border-dashed px-5 py-7 text-center", dragging ? "border-gold-300/70 bg-gold-500/[0.08]" : "border-white/[0.13] bg-white/[0.02]")}>
          <UploadCloud className="mx-auto size-7 text-gold-300/75" strokeWidth={1.4} /><p className="mt-2.5 text-[12.5px] text-ink-200">فایل‌ها را اینجا رها کنید</p><p className="mt-1 text-[10.5px] text-ink-500">آپلود چندتایی واقعی · درگ‌اند‌دراپ · فایل‌های مجازِ همین media seam</p>
          <input ref={inputRef} type="file" multiple accept={acceptsFor(kind)} className="sr-only" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
          <Button size="sm" variant="subtle" className="mt-3" onClick={() => inputRef.current?.click()}><Plus className="size-3.5" /> انتخاب فایل</Button>
          {kind === "video" && <p className="mt-2 text-[10.5px] text-warn-300">برای ویدیو، media kind و محدودیت‌های فایل در architecture فعلی تعریف نشده است.</p>}
        </div>
        {files.length > 0 && <ul className="mt-4 space-y-1.5">{files.map((row) => <li key={row.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-ink-300"><FileText className="size-3.5 text-gold-300/80" /><span className="min-w-0 flex-1 truncate">{row.file.name}</span><span className="nums text-ink-500">{faNum(Math.ceil(row.file.size / 1024))} KB</span>{row.status === "uploading" && <Loader2 className="size-3.5 animate-spin text-gold-300" aria-label="در حال بارگذاری" />}{row.status === "success" && <span className="text-[10px] text-ok-300">ثبت شد</span>}{row.status === "error" && <span className="max-w-[150px] truncate text-[10px] text-danger-300" title={row.error}>ناموفق · تلاش مجدد</span>}<button type="button" onClick={() => removeFile(row.id)} disabled={row.status === "uploading"} aria-label={`حذف ${row.file.name}`} className="text-ink-500 hover:text-ink-100"><X className="size-3.5" /></button></li>)}</ul>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="عنوان مشترک"><input className={inputCls} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً تمرین‌های هفتهٔ سوم" /></Field>
          <Field label="مدرس / آهنگساز"><input className={inputCls} value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="نام پدیدآور" /></Field>
          <Field label="نوع منبع"><select className={inputCls} value={kind} onChange={(event) => setKind(event.target.value as ResourceKind)}><option value="sheet">نت‌ها</option><option value="audio">فایل‌های صوتی</option><option value="video">ویدیوها</option><option value="doc">جزوه‌ها / فایل آموزشی</option></select></Field>
          <Field label="ساز"><select className={inputCls} value={instrument} onChange={(event) => setInstrument(event.target.value as InstrumentId)}>{instruments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="سطح"><input className={inputCls} value={level} onChange={(event) => setLevel(event.target.value)} placeholder="مثلاً متوسط" /></Field>
          <Field label="دسترسی"><select className={inputCls} value={visibility} onChange={(event) => setVisibility(event.target.value as LibraryVisibility)}><option value="students">هنرجویان</option><option value="teachers">مدرسین</option></select></Field>
        </div>
        <footer className="mt-5 flex justify-end gap-2 border-t border-white/[0.06] pt-4"><Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button><Button size="sm" variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} {busy ? "در حال بایگانی…" : files.some((row) => row.status === "error") ? "تلاش مجدد فایل‌های ناموفق" : "افزودن به آرشیو"}</Button></footer>
      </div>
    </div>
  );
}

function ResourcePreview({ file, pdfUrl }: { file: ReturnType<typeof useLibraryFile>; pdfUrl?: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (file.asset?.mimeType !== "text/plain" || !file.blob) { setText(""); return; }
    let live = true;
    void file.blob.text().then((value) => { if (live) setText(value); });
    return () => { live = false; };
  }, [file.asset?.mimeType, file.blob]);
  if (file.status !== "ready" || !file.asset) return null;
  if (file.asset.mimeType === "application/pdf") {
    return <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 text-[11px] text-ink-300"><span>PDF واقعی آمادهٔ نمایش در viewer مرورگر است.</span>{pdfUrl ? <a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-gold-400/30 bg-gold-500/10 px-3 py-2 text-gold-100 hover:bg-gold-500/20">باز کردن پیش‌نمایش</a> : <span className="text-ink-500">در حال آماده‌سازی…</span>}</div>;
  }
  if (file.asset.mimeType === "text/plain") {
    return <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/[0.08] bg-ink-950/80 p-4 text-right text-[11px] leading-7 text-ink-200">{text || "متن فایل خالی است."}</pre>;
  }
  return null;
}

function ResourceDetail({ item, canWrite, onClose, onEdit, onDeleted, onPlay }: { item: LibraryItem; canWrite: boolean; onClose: () => void; onEdit: () => void; onDeleted: () => void; onPlay: () => void }) {
  const { notify } = useApp();
  const file = useLibraryFile(item);
  const pdfUrl = useMediaObjectUrl(file.asset?.mimeType === "application/pdf" ? item.mediaId : undefined);
  const studentState = useStudentList({ per_page: 200 });
  const students = studentState.students;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAudio = item.kind === "audio";
  const deleteResource = async () => {
    setBusy(true);
    try { await getLibraryRepository().delete(item.id); notify({ tone: "success", title: "منبع از کتابخانه حذف شد" }); onDeleted(); }
    catch (cause) { notify({ tone: "danger", title: "حذف منبع انجام نشد", detail: apiErrorFromThrown(cause).message }); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`جزئیات ${item.title}`} onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/[0.1] bg-ink-950 shadow-[0_30px_100px_-28px_rgba(0,0,0,0.95)]" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex min-w-0 items-start gap-3"><ResourceMark kind={item.kind} className="size-12" /><div className="min-w-0"><p className="text-[10px] tracking-[0.22em] text-gold-300/80">{prettyKind(item.kind)} · شناسنامهٔ آرشیوی</p><h2 className="mt-1.5 truncate text-[18px] font-semibold text-ink-50">{item.title}</h2><p className="mt-1 truncate text-[11.5px] text-ink-400">{item.composer || "پدیدآور ثبت نشده"}</p></div></div><Button size="sm" variant="ghost" onClick={onClose} aria-label="بستن"><X className="size-4" /></Button></header>
        <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-black/25 p-6 text-center"><ResourceMark kind={item.kind} className="size-16 rounded-2xl" /><p className="mt-3 text-[12px] text-ink-300">{file.status === "ready" ? (item.kind === "audio" ? "فایل صوتی آمادهٔ پخش است." : "فایل این منبع ذخیره شده است؛ پیش‌نمایش/دریافت آماده است.") : file.status === "loading" ? "در حال آماده‌سازی فایل…" : item.kind === "audio" ? "فایل صوتی این منبع در این مرورگر ذخیره نشده است." : (file.reason ?? "فایل در دسترس نیست.")}</p>{file.asset?.filename && <p className="mt-2 text-[10.5px] text-ink-500">{file.asset.filename}</p>}{isAudio && file.status === "ready" && <Button size="sm" variant="primary" className="mt-4" onClick={onPlay}><Play className="size-3.5" fill="currentColor" /> پخش در پخش‌کننده</Button>}{item.kind === "video" && <p className="mt-2 text-[10.5px] text-warn-300">پیش‌نمایش ویدیو به media backend نیاز دارد؛ در architecture فعلی فایل ویدیو ذخیره نمی‌شود.</p>}</div>
            <ResourcePreview file={file} pdfUrl={pdfUrl} />
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="subtle" onClick={file.download} disabled={file.status !== "ready" || file.downloading}><Download className="size-3.5" /> {file.downloading ? "در حال دریافت…" : "دریافت فایل"}</Button>{isAudio && <Button size="sm" variant="subtle" onClick={onPlay} disabled={file.status !== "ready"}><Headphones className="size-3.5" /> پخش</Button>}{canWrite && <Button size="sm" variant="subtle" onClick={onEdit}><Pencil className="size-3.5" /> ویرایش فراداده</Button>}</div>
            {file.error && <p className="text-[11px] text-danger-300">{file.error}</p>}
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-ink-400"><Info className="me-1 inline size-3.5 text-gold-300/70" aria-hidden /> «مدرس / آهنگساز» تنها رابطه‌ای است که مدل فعلی نگه می‌دارد؛ uploader، دوره، کلاس، پیوند مدرس/هنرجو و توضیح/برچسب در entity موجود نیست.</p>
          </div>
          <aside className="border-t border-white/[0.07] bg-white/[0.018] p-5 lg:border-r lg:border-t-0 sm:p-6"><p className="text-[10px] tracking-[0.2em] text-gold-300/70">فراداده</p><dl className="mt-4 grid grid-cols-2 gap-2.5">{[["نوع", prettyKind(item.kind)], ["ساز", instrumentName(item.instrument)], ["سطح", item.level || "—"], ["حجم", item.size], ["مدت", item.duration || "—"], ["صفحات", item.pages ? faNum(item.pages) : "—"], ["افزوده‌شده", item.added], ["استفاده", faNum(item.uses)], ["وضعیت", item.active === false ? "غیرفعال" : "فعال"], ["دسترسی", item.visibility === "teachers" ? "مدرسین" : "هنرجویان"]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.06] bg-black/10 p-2.5"><dt className="text-[10px] text-ink-500">{label}</dt><dd className="mt-1 truncate text-[11.5px] text-ink-100">{value}</dd></div>)}</dl>{(item.restrictedToStudentIds?.length ?? 0) > 0 && !studentState.loading && <div className="mt-3 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] p-3 text-[10.5px] leading-relaxed text-gold-100">دسترسی این منبع محدود است به: {item.restrictedToStudentIds!.map((id) => students.find((student) => student.id === id)?.name ?? id).join("، ")}<span className="mt-1 block text-ink-500">studentCanAccess() همین قاعده را ارزیابی می‌کند؛ هنرجو حقِ تغییر ندارد.</span></div>}{canWrite && <div className="mt-5 border-t border-white/[0.07] pt-4">{confirmDelete ? <div className="rounded-xl border border-danger-500/30 bg-danger-500/[0.06] p-3"><p className="text-[11px] leading-relaxed text-danger-200">منبع و فایل متصل، اگر منبع دیگری به آن وصل نباشد، حذف می‌شود. بازیابی در مدل فعلی وجود ندارد.</p><div className="mt-3 flex gap-2"><Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>انصراف</Button><Button size="sm" variant="subtle" className="border-danger-500/40 bg-danger-500/10 text-danger-200" onClick={() => void deleteResource()} disabled={busy}><Trash2 className="size-3.5" /> حذف قطعی</Button></div></div> : <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 className="size-3.5" /> حذف منبع</Button>}</div>}</aside>
        </div>
      </div>
    </div>
  );
}

export function LibraryView() {
  const { items, total, loading, error, reload } = useLibraryList({ per_page: 200 });
  const canWrite = useCan("library.write");
  const [section, setSection] = useState(ALL);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [sort, setSort] = useState<SortMode>("recent");
  const [mode, setMode] = useState<ViewMode>("grid");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [open, setOpen] = useState<LibraryItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [playerItem, setPlayerItem] = useState<LibraryItem | null>(null);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const frequentIds = useMemo(() => [...items].filter((item) => item.uses > 0).sort((left, right) => right.uses - left.uses).slice(0, 8).map((item) => item.id), [items]);
  const markRecent = (item: LibraryItem) => setRecentIds((current) => [item.id, ...current.filter((id) => id !== item.id)].slice(0, 12));
  const counts = useMemo(() => ({ all: items.length, recent: recentIds.filter((id) => items.some((item) => item.id === id)).length, frequent: frequentIds.length, byKind: (Object.keys(resourceKindLabel) as ResourceKind[]).reduce<Record<string, number>>((acc, kind) => { acc[kind] = items.filter((item) => item.kind === kind).length; return acc; }, {}) }), [items, recentIds, frequentIds]);
  const visible = useMemo(() => {
    const scoped = items.filter((item) => {
      if (section === RECENT && !recentIds.includes(item.id)) return false;
      if (section === FREQUENT && !frequentIds.includes(item.id)) return false;
      if (section.startsWith(KIND_PREFIX) && item.kind !== section.slice(KIND_PREFIX.length)) return false;
      const date = item.createdAt?.slice(0, 10) ?? "";
      if (from && (!date || date < from)) return false;
      if (to && (!date || date > to)) return false;
      if (query.trim()) { const value = query.trim(); if (![item.title, item.composer, item.level, item.instrument].some((field) => field.includes(value))) return false; }
      return true;
    });
    const sorted = recentSort(scoped, sort);
    if (section === RECENT && sort === "recent") return sorted.sort((left, right) => recentIds.indexOf(left.id) - recentIds.indexOf(right.id));
    return sorted;
  }, [items, section, query, sort, from, to, recentIds, frequentIds]);
  const playable = useMemo(() => visible.filter((item) => item.kind === "audio" && Boolean(item.mediaId)), [visible]);
  const railGroups: ModuleRailGroup[] = useMemo(() => [
    { id: "collection", items: [{ id: ALL, label: "همه منابع", count: counts.all, icon: LibraryBig }, { id: RECENT, label: "موارد اخیر این نشست", count: counts.recent, icon: Clock3 }, { id: FREQUENT, label: "پراستفاده‌ترین", count: counts.frequent, icon: Headphones }, { id: STARRED, label: "موارد ستاره‌دار", icon: Star, disabled: true, hint: "favorites در entity فعلی پشتیبانی نمی‌شود" }] },
    { id: "types", label: "جنس منابع", items: [{ id: `${KIND_PREFIX}sheet`, label: "کتاب‌ها و نت‌ها", count: counts.byKind.sheet ?? 0, icon: BookOpen }, { id: `${KIND_PREFIX}audio`, label: "فایل‌های صوتی", count: counts.byKind.audio ?? 0, icon: Headphones }, { id: `${KIND_PREFIX}video`, label: "ویدیوها", count: counts.byKind.video ?? 0, icon: Video }, { id: `${KIND_PREFIX}doc`, label: "جزوه‌ها و فایل‌های آموزشی", count: counts.byKind.doc ?? 0, icon: FileText }, { id: "exercise", label: "تمرین‌ها", icon: ClipboardList, disabled: true, hint: "category در entity فعلی وجود ندارد" }] },
    { id: "workspace", label: "فضای شخصی", items: [{ id: FOLDER, label: "پوشه‌های من", icon: FolderOpen, disabled: true, hint: "folders نیازمند backend است" }] },
  ], [counts]);

  if (loading) return <LoadingState className="py-32" label="در حال باز کردن تالار منابع…" />;
  if (error) return <ErrorState className="py-32" title="بارگذاری کتابخانه ناموفق بود" description={error.message} onRetry={reload} />;

  return (
    <div className={cn("relative isolate -mx-1 overflow-hidden rounded-[2rem] border border-white/[0.05] bg-ink-950/40 px-3 py-3 sm:px-5 lg:-mx-2", playerItem ? "pb-24" : "pb-4")}>
      <div className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center opacity-[0.19]" style={{ backgroundImage: `url(${libraryBackdrop})`, filter: "saturate(0.62) contrast(1.04)" }} aria-hidden />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(193,145,72,0.14),transparent_42%),linear-gradient(180deg,rgba(9,12,15,0.34),rgba(9,12,15,0.9)_75%)]" aria-hidden />

      <div className="flex flex-col-reverse gap-5 lg:flex-row">
        <main className="min-w-0 flex-1 space-y-5">
          <header className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-950/68 px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-8 sm:py-10">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-gold-500/[0.08] to-transparent" aria-hidden />
            <div className="relative"><p className="text-[10px] tracking-[0.3em] text-gold-300/90">مخزن موسیقی و دانش</p><h1 className="mt-3 font-display text-2xl font-bold text-photo-fg sm:text-[32px]">کتابخانهٔ پارسیان</h1><p className="mt-2.5 max-w-xl text-[12.5px] leading-relaxed text-photo-muted">نت‌ها، صداها و دانشِ آموزشی در یک آرشیو آرام؛ هر منبع با شناسنامهٔ واقعی و دسترسی روشن.</p><p className="mt-3 text-[11.5px] text-gold-200">{faNum(total)} منبع در مخزن موسیقی و دانش</p><div className="mt-5 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2"><span className="block text-[10px] text-ink-500">کل منابع</span><b className="nums mt-1 block text-[16px] text-gold-200">{faNum(total)}</b></div><div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2"><span className="block text-[10px] text-ink-500">دارای فایل</span><b className="nums mt-1 block text-[16px] text-gold-200">{faNum(items.filter((item) => item.mediaId).length)}</b></div><div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2"><span className="block text-[10px] text-ink-500">فایل صوتی</span><b className="nums mt-1 block text-[16px] text-gold-200">{faNum(counts.byKind.audio ?? 0)}</b></div><div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2"><span className="block text-[10px] text-ink-500">اخیر این نشست</span><b className="nums mt-1 block text-[16px] text-gold-200">{faNum(counts.recent)}</b></div></div></div>
          </header>

          {!canWrite && <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-[11.5px] leading-relaxed text-ink-400"><GraduationCap className="me-1 inline size-4 text-gold-300/80" aria-hidden /> حساب شما دسترسی خواندن دارد؛ افزودن، ویرایش و حذف برای هنرجو مجاز نیست.</div>}
          <CapabilityNote />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shelves.map((shelf) => { const Icon = kindIcon[shelf.kind]; const count = items.filter((item) => item.kind === shelf.kind && item.instrument === shelf.instrument).length; return <button key={shelf.id} type="button" onClick={() => setSection(`${KIND_PREFIX}${shelf.kind}`)} className={cn("group rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:border-gold-400/35", kindTone[shelf.kind])}><span className="flex items-center justify-between"><Icon className="size-5" strokeWidth={1.5} /><span className="nums text-[11px] opacity-70">{faNum(count)}</span></span><span className="mt-5 block text-[12.5px] font-medium text-ink-50">{shelf.label}</span><span className="mt-2 block text-[10px] text-current opacity-70">{instrumentName(shelf.instrument)} · {prettyKind(shelf.kind)}</span></button>; })}</div>

          <section className="surface-glass p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center gap-3"><div className="min-w-[220px] flex-1"><SearchInput value={query} onChange={setQuery} placeholder="جستجوی عنوان، مدرس یا آهنگساز…" /></div><div className="flex rounded-xl border border-white/[0.08] bg-black/15 p-0.5"><button type="button" onClick={() => setMode("grid")} aria-pressed={mode === "grid"} className={cn("rounded-lg px-3 py-1.5 text-[11px]", mode === "grid" ? "bg-gold-500/15 text-gold-100" : "text-ink-500")}>شبکه</button><button type="button" onClick={() => setMode("list")} aria-pressed={mode === "list"} className={cn("rounded-lg px-3 py-1.5 text-[11px]", mode === "list" ? "bg-gold-500/15 text-gold-100" : "text-ink-500")}>فهرست</button></div><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className={cn(inputCls, "h-8 w-auto text-[11px]")} aria-label="ترتیب منابع"><option value="recent">جدیدترین</option><option value="popular">پراستفاده‌ترین</option><option value="title">عنوان</option></select>{canWrite && <Button size="sm" variant="primary" onClick={() => setUploadOpen(true)}><Plus className="size-3.5" /> افزودن منبع</Button>}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3"><span className="text-[10.5px] text-ink-500"><SlidersHorizontal className="me-1 inline size-3.5" /> فیلتر جاری</span>{(Object.keys(resourceKindLabel) as ResourceKind[]).map((kind) => <button key={kind} type="button" onClick={() => setSection(section === `${KIND_PREFIX}${kind}` ? ALL : `${KIND_PREFIX}${kind}`)} className={cn("rounded-full border px-3 py-1 text-[10.5px]", section === `${KIND_PREFIX}${kind}` ? "border-gold-400/50 bg-gold-500/15 text-gold-100" : "border-white/[0.08] text-ink-400 hover:text-ink-200")}>{prettyKind(kind)} · {faNum(counts.byKind[kind] ?? 0)}</button>)}{section !== ALL && <Button size="sm" variant="ghost" onClick={() => setSection(ALL)}>پاک کردن بخش</Button>}<span className="mx-1 hidden h-5 w-px bg-white/[0.08] sm:inline-block" /><span className="text-[10.5px] text-ink-500"><CalendarRange className="me-1 inline size-3.5" /> تاریخ ثبت</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="از تاریخ ثبت" className={cn(inputCls, "h-8 w-auto text-[10.5px]")} /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="تا تاریخ ثبت" className={cn(inputCls, "h-8 w-auto text-[10.5px]")} />{(from || to) && <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>پاک کردن تاریخ</Button>}</div>
          </section>

          {visible.length === 0 ? <EmptyState className="py-20" icon={<Archive className="size-6 opacity-70" />} title={items.length ? "منبعی در این بخش پیدا نشد" : "کتابخانه خالی است"} description={items.length ? "فیلتر یا عبارت جستجو را تغییر دهید." : "اولین منبع آرشیو را با فایل یا تنها با فراداده ثبت کنید."} action={canWrite ? "افزودن منبع" : undefined} onAction={() => setUploadOpen(true)} /> : mode === "grid" ? <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <ResourceCard key={item.id} item={item} active={playerItem?.id === item.id} onOpen={() => { markRecent(item); setOpen(item); }} onPlay={() => { markRecent(item); setPlayerItem(item); setPlayerExpanded(false); }} />)}</div>  : <div className="space-y-2">{visible.map((item) => <div key={item.id} role="button" tabIndex={0} onClick={() => { markRecent(item); setOpen(item); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); markRecent(item); setOpen(item); } }} className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.07] bg-ink-950/60 p-3 text-right transition hover:border-gold-400/30 focus-visible:outline-2 focus-visible:outline-gold-400"><ResourceMark kind={item.kind} className="size-11" /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] text-ink-50">{item.title}</span><span className="mt-1 block truncate text-[10.5px] text-ink-400">{prettyKind(item.kind)} · {item.composer || "بدون پدیدآور"} · {item.size}</span></span>{item.kind === "audio" && item.mediaId && <button type="button" aria-label={`پخش ${item.title}`} onClick={(event) => { event.stopPropagation(); markRecent(item); setPlayerItem(item); }} className="flex size-8 items-center justify-center rounded-lg border border-gold-400/25 text-gold-200"><Play className="size-3.5" fill="currentColor" /></button>}<ChevronLeft className="size-4 text-ink-600 transition group-hover:text-gold-300" /></div>)}</div>}
          {total > items.length && <p className="text-[11px] text-ink-500">{faNum(items.length)} ردیف از {faNum(total)} · فهرست فعلی صفحه‌بندی شده است.</p>}
        </main>

        <ModuleRail kicker="تالار منابع" title="کتابخانه" groups={railGroups} activeId={section} onSelect={setSection} action={canWrite ? <div className="space-y-2"><Button size="sm" variant="primary" className="w-full" onClick={() => setUploadOpen(true)}><Plus className="size-3.5" /> افزودن منبع</Button><Button size="sm" variant="subtle" className="w-full" onClick={() => setUploadOpen(true)}><UploadCloud className="size-3.5" /> آپلود فایل</Button></div> : undefined} footer={<p className="px-3 text-[10.5px] leading-relaxed text-ink-500">{faNum(items.length)} رکورد از {faNum(total)} · دسترسی هنرجو فقط خواندنی است.</p>} />
      </div>

      {uploadOpen && canWrite && <LibraryUploadDialog onClose={() => setUploadOpen(false)} onSaved={reload} />}
      {open && <ResourceDetail item={open} canWrite={canWrite} onClose={() => setOpen(null)} onEdit={() => setEditOpen(true)} onDeleted={() => { setOpen(null); reload(); }} onPlay={() => { setPlayerItem(open); setPlayerExpanded(true); }} />}
      <LibraryAudioPlayer item={playerItem} expanded={playerExpanded} onToggleExpanded={() => setPlayerExpanded((value) => !value)} onPrevious={() => { const index = playable.findIndex((item) => item.id === playerItem?.id); if (index > 0) setPlayerItem(playable[index - 1]); }} onNext={() => { const index = playable.findIndex((item) => item.id === playerItem?.id); if (index >= 0 && index < playable.length - 1) setPlayerItem(playable[index + 1]); }} onClose={() => { setPlayerItem(null); setPlayerExpanded(false); }} />
      {editOpen && open && canWrite && <LibraryEditDialog item={open} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); setOpen(null); reload(); }} />}
    </div>
  );
}

function LibraryEditDialog({ item, onClose, onSaved }: { item: LibraryItem; onClose: () => void; onSaved: () => void }) {
  const { notify } = useApp();
  const students = useStudentList({ per_page: 200 }).students;
  const [title, setTitle] = useState(item.title);
  const [composer, setComposer] = useState(item.composer);
  const [level, setLevel] = useState(item.level);
  const [visibility, setVisibility] = useState<LibraryVisibility>(item.visibility ?? "students");
  const [accessMode, setAccessMode] = useState<"all" | "some">(item.restrictedToStudentIds?.length ? "some" : "all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(item.restrictedToStudentIds ?? []);
  const [active, setActive] = useState(item.active !== false);
  const [busy, setBusy] = useState(false);
  const toggleStudent = (id: string) => setSelectedStudentIds((current) => current.includes(id) ? current.filter((studentId) => studentId !== id) : [...current, id]);
  const save = async () => {
    if (title.trim().length < 2) return;
    if (accessMode === "some" && selectedStudentIds.length === 0) {
      notify({ tone: "danger", title: "سطح دسترسی ذخیره نشد", detail: "برای دسترسی محدود، دست‌کم یک هنرجو را انتخاب کنید." });
      return;
    }
    setBusy(true);
    try {
      await getLibraryRepository().update(item.id, { title: title.trim(), composer: composer.trim(), level: level.trim(), visibility, active, restrictedToStudentIds: accessMode === "some" ? selectedStudentIds : [] });
      notify({ tone: "success", title: "فرادادهٔ منبع به‌روزرسانی شد" });
      onSaved();
    } catch (cause) { notify({ tone: "danger", title: "ویرایش ذخیره نشد", detail: apiErrorFromThrown(cause).message }); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ویرایش منبع"><div className="surface max-h-[90vh] w-full max-w-md overflow-y-auto p-5"><div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold text-ink-50">ویرایش فرادادهٔ {item.title}</h2><Button size="sm" variant="ghost" onClick={onClose} disabled={busy} aria-label="بستن"><X className="size-4" /></Button></div><div className="mt-5 space-y-3"><Field label="عنوان"><input className={inputCls} value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="مدرس / آهنگساز"><input className={inputCls} value={composer} onChange={(event) => setComposer(event.target.value)} /></Field><Field label="سطح"><input className={inputCls} value={level} onChange={(event) => setLevel(event.target.value)} /></Field><Field label="دسترسی"><select className={inputCls} value={visibility} onChange={(event) => setVisibility(event.target.value as LibraryVisibility)}><option value="students">هنرجویان</option><option value="teachers">مدرسین</option></select></Field><label className="block text-[11px] text-ink-400">سطح دسترسی هنرجویان<select className={`${inputCls} mt-1`} value={accessMode} onChange={(event) => setAccessMode(event.target.value as "all" | "some")}><option value="all">همهٔ هنرجویان</option><option value="some">هنرجویان انتخاب‌شده</option></select></label>{accessMode === "some" && <fieldset className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/15 p-3"><legend className="px-1 text-[10px] text-ink-500">انتخاب هنرجو</legend>{students.map((student) => <label key={student.id} className="flex items-center gap-2 py-1 text-[11px] text-ink-200"><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} aria-label={student.name} />{student.name}</label>)}</fieldset>}<Field label="انتشار"><select className={inputCls} value={active ? "active" : "inactive"} onChange={(event) => setActive(event.target.value === "active")}><option value="active">فعال</option><option value="inactive">غیرفعال</option></select></Field></div><div className="mt-5 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button><Button size="sm" variant="primary" onClick={() => void save()} disabled={busy || title.trim().length < 2}><Check className="size-3.5" /> ذخیرهٔ تغییرات</Button></div></div></div>;
}
