/**
 * Multi-image intake for the existing gallery/media seams.
 *
 * Files are staged so every image gets a preview, caption and required alt
 * text before the two real writes: MediaRepository.create, then
 * GalleryRepository.addImage. Album is the only persisted grouping the current
 * GalleryRepository owns, so unsupported tags/categories/relations are not
 * simulated here.
 */
import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ds/primitives";
import { Field, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getGalleryRepository, getMediaRepository } from "@/domains/registry";
import type { GalleryAlbum } from "@/domains/gallery/types";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/domains/media/types";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { cn } from "@/utils/cn";

interface StagedFile { id: string; file: File; previewUrl: string; caption: string; alt: string; status: "ready" | "uploading" | "success" | "error"; error?: string; rejection?: string; }
function rejectionFor(file: File): string | undefined {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) return "قالب پشتیبانی نمی‌شود؛ JPEG، PNG، WebP یا GIF انتخاب کنید.";
  if (file.size > MAX_IMAGE_BYTES) return `حجم فایل از سقف ${faNum(Math.round(MAX_IMAGE_BYTES / 1024 / 1024))} مگابایت بیشتر است.`;
  if (!file.size) return "فایل خالی است.";
  return undefined;
}

export function GalleryUploader({ albums, onUploaded, onClose }: { albums: GalleryAlbum[]; onUploaded: (count: number) => void; onClose: () => void }) {
  const { notify } = useApp();
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [albumId, setAlbumId] = useState(albums[0]?.id ?? "");
  const [newAlbumTitle, setNewAlbumTitle] = useState("آرشیو آموزشگاه");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Set<string>>(new Set());

  useEffect(() => () => { urlsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  const stage = (files: FileList | File[]) => setStaged((current) => [...current, ...Array.from(files).map((file, index) => { const rejection = rejectionFor(file); const previewUrl = rejection ? "" : URL.createObjectURL(file); if (previewUrl) urlsRef.current.add(previewUrl); return { id: `${file.name}-${file.size}-${Date.now()}-${index}`, file, previewUrl, caption: file.name.replace(/\.[^.]+$/, ""), alt: "", status: "ready" as const, rejection }; })]);
  const patch = (id: string, change: Partial<StagedFile>) => setStaged((current) => current.map((row) => row.id === id ? { ...row, ...change } : row));
  const remove = (id: string) => setStaged((current) => { const target = current.find((row) => row.id === id); if (target?.previewUrl) { URL.revokeObjectURL(target.previewUrl); urlsRef.current.delete(target.previewUrl); } return current.filter((row) => row.id !== id); });
  const ready = staged.filter((row) => row.status !== "success" && !row.rejection && row.caption.trim().length > 1 && row.alt.trim().length > 1);

  const submit = async () => {
    if (!ready.length) return;
    setBusy(true);
    try {
      let targetAlbum = albumId;
      let createdAlbumId: string | undefined;
      if (!targetAlbum) {
        createdAlbumId = (await getGalleryRepository().createAlbum({ title: newAlbumTitle.trim() || "آرشیو آموزشگاه", description: "آلبوم تصویرهای آموزشگاه" })).id;
        targetAlbum = createdAlbumId;
      }
      let written = 0;
      let failed = 0;
      for (const row of ready) {
        setStaged((current) => current.map((item) => item.id === row.id ? { ...item, status: "uploading" as const, error: undefined } : item));
        let mediaId: string | undefined;
        try {
          const media = await getMediaRepository().create({ kind: "image", filename: row.file.name, mimeType: row.file.type, bytes: await row.file.arrayBuffer() });
          mediaId = media.id;
          await getGalleryRepository().addImage({ albumId: targetAlbum, mediaId, caption: row.caption.trim(), alt: row.alt.trim() });
          setStaged((current) => current.map((item) => item.id === row.id ? { ...item, status: "success" as const } : item));
          written += 1;
        } catch (cause) {
          if (mediaId) { try { await getMediaRepository().delete(mediaId); } catch { /* keep the original failure visible */ } }
          failed += 1;
          setStaged((current) => current.map((item) => item.id === row.id ? { ...item, status: "error" as const, error: apiErrorFromThrown(cause).message } : item));
        }
      }
      if (failed && written === 0 && createdAlbumId) {
        try { await getGalleryRepository().deleteAlbum(createdAlbumId); } catch { /* keep the upload failure visible */ }
      }
      if (written) notify({ tone: "success", title: `${faNum(written)} تصویر در گالری بایگانی شد` });
      if (failed) notify({ tone: "danger", title: `${faNum(failed)} تصویر ثبت نشد`, detail: "فایل‌های ناموفق را اصلاح کنید و دوباره تلاش کنید." });
      onUploaded(written);
      if (!failed) onClose();
    } catch (cause) { notify({ tone: "danger", title: "بارگذاری انجام نشد", detail: apiErrorFromThrown(cause).message }); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label="افزودن تصویر به گالری" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="surface w-full max-w-3xl p-5 sm:p-6"><header className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] tracking-[0.24em] text-gold-300/80">بایگانی</p><h2 className="mt-1.5 text-[16px] font-semibold text-ink-50">افزودن تصویر به گالری</h2><p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">آپلود چندتایی واقعی؛ برای هر تصویر عنوان و متن جایگزین لازم است.</p></div><Button size="sm" variant="ghost" onClick={onClose} disabled={busy} aria-label="بستن"><X className="size-4" /></Button></header><div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) stage(event.dataTransfer.files); }} className={cn("rounded-2xl border border-dashed px-5 py-8 text-center", dragging ? "border-gold-400/60 bg-gold-500/[0.07]" : "border-white/[0.12] bg-white/[0.02]")}><UploadCloud className="mx-auto size-7 text-gold-300/80" strokeWidth={1.5} /><p className="mt-3 text-[12.5px] text-ink-200">تصویرها را اینجا رها کنید</p><p className="mt-1 text-[11px] text-ink-500">چند تصویر با هم · حداکثر {faNum(Math.round(MAX_IMAGE_BYTES / 1024 / 1024))} مگابایت برای هر فایل</p><input ref={inputRef} type="file" multiple accept={ALLOWED_IMAGE_TYPES.join(",")} className="sr-only" onChange={(event) => { if (event.target.files) stage(event.target.files); event.target.value = ""; }} /><Button size="sm" variant="subtle" className="mt-4" onClick={() => inputRef.current?.click()}><ImagePlus className="size-3.5" /> انتخاب تصویر</Button></div>{albums.length ? <div className="mt-5 max-w-sm"><Field label="آلبوم"><select className={inputCls} value={albumId} onChange={(event) => setAlbumId(event.target.value)}>{albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}</select></Field></div> : <div className="mt-5 max-w-sm"><Field label="آلبوم تازه"><input className={inputCls} value={newAlbumTitle} onChange={(event) => setNewAlbumTitle(event.target.value)} /></Field></div>}{staged.length > 0 && <ul className="mt-6 space-y-3">{staged.map((row) => <li key={row.id} className={cn("rounded-2xl border p-3", row.rejection ? "border-danger-500/30 bg-danger-500/[0.06]" : "border-white/[0.07] bg-white/[0.02]")}><div className="flex gap-3"><span className="relative flex size-20 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-ink-900">{row.previewUrl ? <img src={row.previewUrl} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-[10px] text-ink-500">بدون پیش‌نمایش</span>}</span><div className="min-w-0 flex-1">{row.status === "uploading" && <p className="mb-1 text-[10.5px] text-gold-200">در حال بایگانی…</p>}{row.status === "success" && <p className="mb-1 text-[10.5px] text-ok-300">با موفقیت ثبت شد</p>}{row.status === "error" && <p className="mb-1 truncate text-[10.5px] text-danger-300" title={row.error}>ناموفق: {row.error}</p>}{row.rejection ? <p className="text-[11.5px] leading-relaxed text-danger-400"><span className="block truncate text-ink-200">{row.file.name}</span>{row.rejection}</p> : <div className="grid gap-2 sm:grid-cols-2"><input className={inputCls} value={row.caption} placeholder="عنوان تصویر" aria-label="عنوان تصویر" onChange={(event) => patch(row.id, { caption: event.target.value })} /><input className={inputCls} value={row.alt} placeholder="متن جایگزین" aria-label="متن جایگزین تصویر" onChange={(event) => patch(row.id, { alt: event.target.value })} /></div>}</div><Button size="sm" variant="ghost" onClick={() => remove(row.id)} disabled={row.status === "uploading"} aria-label="حذف از فهرست"><Trash2 className="size-3.5" /></Button></div></li>)}</ul>}<footer className="mt-6 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4"><p className="text-[11px] text-ink-400">{faNum(ready.length)} از {faNum(staged.length)} تصویر آماده یا نیازمند تلاش مجدد است</p><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>لغو</Button><Button size="sm" variant="primary" onClick={() => void submit()} disabled={busy || !ready.length}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} {staged.some((row) => row.status === "error") ? "تلاش مجدد تصویرهای ناموفق" : "بایگانی تصویرها"}</Button></div></footer></div></div>;
}
