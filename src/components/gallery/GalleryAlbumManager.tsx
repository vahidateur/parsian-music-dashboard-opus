/**
 * Album management for Gallery.
 *
 * Albums are a real repository concept, so this is deliberately more than a
 * disabled placeholder: create, rename and destructive delete all use the
 * existing GalleryRepository. Delete is explicit because DemoGalleryRepository
 * removes the album's images and releases their media bytes as a cascade.
 */
import { useState } from "react";
import { FolderPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ds/primitives";
import { Field, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getGalleryRepository } from "@/domains/registry";
import type { GalleryAlbum } from "@/domains/gallery/types";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { cn } from "@/utils/cn";

export function GalleryAlbumManager({
  albums,
  counts,
  selectedAlbumId,
  onSelect,
  onChanged,
  onClose,
}: {
  albums: GalleryAlbum[];
  counts: Map<string, number>;
  selectedAlbumId?: string;
  onSelect: (albumId: string) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { notify } = useApp();
  const [editing, setEditing] = useState<GalleryAlbum | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GalleryAlbum | null>(null);
  const [busy, setBusy] = useState(false);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setTitle("");
    setDescription("");
  };
  const openEdit = (album: GalleryAlbum) => {
    setCreating(false);
    setEditing(album);
    setTitle(album.title);
    setDescription(album.description);
  };
  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setTitle("");
    setDescription("");
  };
  const save = async () => {
    if (title.trim().length < 2) {
      notify({ tone: "danger", title: "عنوان آلبوم الزامی است" });
      return;
    }
    setBusy(true);
    try {
      if (editing) await getGalleryRepository().updateAlbum(editing.id, { title: title.trim(), description: description.trim() });
      else await getGalleryRepository().createAlbum({ title: title.trim(), description: description.trim() });
      notify({ tone: "success", title: editing ? "آلبوم ویرایش شد" : "آلبوم ساخته شد" });
      closeForm();
      onChanged();
    } catch (cause) {
      notify({ tone: "danger", title: "ذخیرهٔ آلبوم انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await getGalleryRepository().deleteAlbum(deleteTarget.id);
      notify({ tone: "success", title: `آلبوم «${deleteTarget.title}» حذف شد`, detail: "تصویرهای داخل آلبوم و فایل‌های بی‌مرجع آن نیز حذف شدند." });
      setDeleteTarget(null);
      onChanged();
    } catch (cause) {
      notify({ tone: "danger", title: "حذف آلبوم انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="مدیریت آلبوم‌های گالری" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="surface max-h-[88vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] tracking-[0.22em] text-gold-300/80">ساختار آرشیو</p><h2 className="mt-1.5 text-[17px] font-semibold text-ink-50">مدیریت آلبوم‌ها</h2><p className="mt-1 text-[11px] text-ink-500">آلبوم تنها گروه‌بندی پایدار فعلی GalleryRepository است.</p></div>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy} aria-label="بستن"><X className="size-4" /></Button>
        </header>

        <div className="mt-5 grid gap-2">
          {albums.map((album) => {
            const selected = selectedAlbumId === album.id;
            const count = counts.get(album.id) ?? 0;
            return <div key={album.id} className={cn("flex items-center gap-3 rounded-2xl border p-3 transition-colors", selected ? "border-gold-400/40 bg-gold-500/[0.08]" : "border-white/[0.07] bg-white/[0.02]")}>
              <button type="button" onClick={() => { onSelect(album.id); onClose(); }} className="min-w-0 flex-1 text-right focus-visible:outline-2 focus-visible:outline-gold-400">
                <span className="block truncate text-[12.5px] font-medium text-ink-50">{album.title}</span>
                <span className="mt-1 block truncate text-[10.5px] text-ink-500">{faNum(count)} تصویر{album.description ? ` · ${album.description}` : ""}</span>
              </button>
              <Button size="sm" variant="ghost" onClick={() => openEdit(album)} aria-label={`ویرایش آلبوم ${album.title}`}><Pencil className="size-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(album)} aria-label={`حذف آلبوم ${album.title}`}><Trash2 className="size-3.5" /></Button>
            </div>;
          })}
          {albums.length === 0 && <p className="rounded-xl border border-dashed border-white/[0.1] p-5 text-center text-[11px] text-ink-500">هنوز آلبومی وجود ندارد.</p>}
        </div>

        {!creating && !editing && <Button size="sm" variant="subtle" className="mt-4" onClick={openCreate}><FolderPlus className="size-3.5" /> ساخت آلبوم جدید</Button>}
        {(creating || editing) && <div className="mt-5 rounded-2xl border border-gold-400/20 bg-gold-500/[0.04] p-4"><div className="flex items-center justify-between"><p className="text-[12px] font-medium text-ink-100">{editing ? "ویرایش آلبوم" : "آلبوم جدید"}</p><button type="button" onClick={closeForm} className="text-ink-500 hover:text-ink-100" aria-label="لغو ویرایش"><X className="size-4" /></button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="عنوان"><input className={inputCls} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></Field><Field label="توضیح"><input className={inputCls} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="مثلاً اجراهای زمستان ۱۴۰۴" /></Field></div><div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={closeForm} disabled={busy}>انصراف</Button><Button size="sm" variant="primary" onClick={() => void save()} disabled={busy}><Plus className="size-3.5" /> {editing ? "ذخیرهٔ آلبوم" : "ساخت آلبوم"}</Button></div></div>}

        {deleteTarget && <div className="mt-5 rounded-2xl border border-danger-500/30 bg-danger-500/[0.07] p-4"><p className="text-[12px] font-medium text-danger-200">حذف آلبوم «{deleteTarget.title}»؟</p><p className="mt-1 text-[11px] leading-relaxed text-danger-300">{faNum(counts.get(deleteTarget.id) ?? 0)} تصویر داخل آن نیز از آرشیو حذف می‌شود. این عملیات قابل بازگردانی نیست.</p><div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>انصراف</Button><Button size="sm" variant="subtle" className="border-danger-500/40 bg-danger-500/10 text-danger-200" onClick={() => void remove()} disabled={busy}><Trash2 className="size-3.5" /> حذف آلبوم</Button></div></div>}
      </div>
    </div>
  );
}
