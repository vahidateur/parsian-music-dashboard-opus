/**
 * Library — repository-backed catalogue — F1 genuine functional.
 *
 *   View → useLibraryList / useLibraryFile → LibraryRepository + MediaRepository
 *
 * F1 scope:
 * - search title/composer/teacher (composer as teacher proxy, level also searched via repo)
 * - filters kind/instrument/level/visibility (visibility per publication status disposition active/visibility)
 * - sort added/uses/title (title fa locale)
 * - real preview via useLibraryFile + useMediaObjectUrl real bytes no fabricated URL
 * - locked honest reason
 * - complete metadata
 * - loading/empty/error + retry
 * - demo persistence single source DemoDataset + binary storage + dataset manager
 * - API seam preserved
 * - upload/write via media seam two writes Media.create + Library.create
 * - download real bytes genuine
 * - honest pagination/truncation disclosure N ردیف از M when total > shown
 * - detail same surface per F1 disposition — Drawer, no new route
 *
 * No fabricated data, no new route, no new workflow — publication status uses existing active/visibility semantics.
 */
import { useMemo, useRef, useState } from "react";
import { Download, FileMusic, FileText, Music2, Pencil, Plus, Video, Lock, Upload, X } from "lucide-react";
import { EntityExportButton } from "@/domains/export/EntityExportButton";
import type { InstrumentId } from "@/domains/instruments/types";
import { instrumentName, useInstrumentCatalog } from "@/domains/instruments/catalog";
import { resourceKindLabel, type LibraryItem, type ResourceKind, type LibraryVisibility } from "@/domains/library/types";
import { useLibraryFile, useLibraryList } from "@/domains/library/useLibrary";
import { getLibraryRepository, getMediaRepository } from "@/domains/registry";
import { releaseStagedMedia } from "@/domains/media/release";
import { apiErrorFromThrown } from "@/api/errors";
import { useCan } from "@/domains/auth/AuthContext";
import { useStudentList } from "@/domains/students/useStudents";

/* ------------------------------------------------------------------ */
/* Shelf layout — presentation config owned by this view (M10).       */
/* ------------------------------------------------------------------ */
const shelves: { id: string; label: string; kind: ResourceKind; instrument: InstrumentId }[] = [
  { id: "sh1", label: "نت‌های پیانو", kind: "sheet", instrument: "piano" },
  { id: "sh2", label: "متدهای پایه", kind: "doc", instrument: "theory" },
  { id: "sh3", label: "نمونه‌های شنیداری", kind: "audio", instrument: "voice" },
  { id: "sh4", label: "ویدیوهای آموزشی", kind: "video", instrument: "violin" },
];
import { useMediaObjectUrl } from "@/domains/media/useMedia";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Chip, Drawer, FilterBar, PageHeader, Panel, SearchInput, Segmented, StatStrip, Field, inputCls } from "@/components/ds/patterns";
import { AudioMessagePlayer } from "@/domains/library/AudioMessagePlayer";
import { cn } from "@/utils/cn";
import { ALLOWED_AUDIO_TYPES, ALLOWED_DOCUMENT_TYPES, ALLOWED_IMAGE_TYPES } from "@/domains/media/types";

const kindIcon: Record<ResourceKind, typeof FileMusic> = { sheet: FileMusic, audio: Music2, video: Video, doc: FileText };
const kindTone: Record<ResourceKind, string> = {
  sheet: "border-gold-500/25 bg-gold-500/[0.08] text-gold-400",
  audio: "border-violet-500/25 bg-violet-500/[0.08] text-violet-300",
  video: "border-info-400/25 bg-info-400/[0.08] text-info-400",
  doc: "border-white/[0.08] bg-white/[0.03] text-ink-300",
};

function Waveform({ peaks }: { peaks: number[] }) {
  return (
    <div className="flex h-8 items-center gap-[2px]" aria-hidden>
      {peaks.map((p, i) => (
        <span key={i} className="block w-[2px] rounded-full bg-violet-400/35" style={{ height: `${p * 100}%` }} />
      ))}
    </div>
  );
}

function ResourceCard({ r, onOpen }: { r: LibraryItem; onOpen: () => void }) {
  const Icon = kindIcon[r.kind];
  const locked = !r.mediaId;
  return (
    <button type="button" onClick={onOpen} className="surface group flex flex-col gap-3 p-4 text-right transition-all hover:border-white/[0.14] hover:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", kindTone[r.kind])}>
          <Icon className="size-[18px]" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-ink-50 flex items-center gap-1.5">
            {locked && <Lock className="size-3 text-warn-400 shrink-0" aria-label="قفل" />}
            {r.title}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-ink-400">{r.composer}</div>
        </div>
        <StatusBadge tone="neutral" label={resourceKindLabel[r.kind]} glyph={false} className="shrink-0" />
      </div>

      {r.peaks ? (
        <Waveform peaks={r.peaks} />
      ) : (
        <div className="flex h-8 items-center gap-2 text-[11px] text-ink-400">
          <InstrumentGlyph kind={r.instrument} className="size-4 text-gold-400" />
          {instrumentName(r.instrument)} · {r.level}
          {r.pages && <span className="nums">· {faNum(r.pages)} صفحه</span>}
          {r.visibility && r.visibility === "teachers" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06]">مدرسین</span>}
      {(r.restrictedToStudentIds?.length ?? 0) > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-500/15 text-gold-200">دسترسی محدود</span>
      )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3 text-[10.5px] text-ink-400">
        <span className="nums">{r.duration ?? r.size}</span>
        <span className="nums">{faNum(r.uses)} بار استفاده</span>
      </div>
    </button>
  );
}

function partialNote(name: string, shown: number, total: number): string | null {
  return total > shown ? `${name}: ${faNum(shown)} ردیف از ${faNum(total)}` : null;
}

/* ------------------------------------------------------------------ */
/* Item dialog — create AND edit, upload via the media seam             */
/*                                                                      */
/* One form for both directions, because an academy that can register a */
/* resource but never correct it owns half a catalogue: the access      */
/* level, the active flag, the metadata and even the file itself stay   */
/* editable afterwards. The parent mounts it with a `key` per subject,  */
/* so opening it for another row never inherits the previous draft.     */
/* ------------------------------------------------------------------ */
function LibraryItemDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing?: LibraryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useApp();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [composer, setComposer] = useState(editing?.composer ?? "");
  const [kind, setKind] = useState<ResourceKind>(editing?.kind ?? "sheet");
  const [instrument, setInstrument] = useState<InstrumentId>(editing?.instrument ?? "piano");
  const [level, setLevel] = useState(editing?.level ?? "");
  const [visibility, setVisibility] = useState<LibraryVisibility>(editing?.visibility ?? "students");
  const [restricted, setRestricted] = useState((editing?.restrictedToStudentIds?.length ?? 0) > 0);
  const [studentIds, setStudentIds] = useState<string[]>(editing?.restrictedToStudentIds ?? []);
  const [active, setActive] = useState(editing ? editing.active !== false : true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const instruments = useInstrumentCatalog().filter((i) => i.active);
  // The picker's read owns its failure: a broken read must not be rendered as
  // "no students exist" (I15 — an empty picker and an unreadable one are
  // different facts, and only the read itself can tell them apart).
  const { students, error: studentsError, reload: reloadStudents } = useStudentList({ per_page: 200 });

  const submit = async () => {
    if (title.trim().length < 2) {
      notify({ tone: "danger", title: "عنوان الزامی است" });
      return;
    }
    /*
      "Limited to these students" with no student chosen is not a restriction,
      it is a contradiction — the empty list means "everybody" in the access
      rule, so saving it would quietly do the opposite of what the operator
      picked. Refuse and say what the alternative is.
    */
    if (visibility === "students" && restricted && studentIds.length === 0) {
      notify({
        tone: "danger",
        title: "دسترسی محدود بدون هنرجو معنا ندارد",
        detail: "یا دست‌کم یک هنرجو را انتخاب کنید، یا دسترسی را «مدرسین» بگذارید.",
      });
      return;
    }
    setBusy(true);
    /*
      The upload this attempt created, remembered so a FAILED catalogue write can
      release it. Two awaited writes: the asset is stored first (the catalogue row
      must be able to reference it), then the row is written. If that second write
      fails, the asset would be a file nothing can reach and the retry would store
      a second copy — so it is released through the media domain's staged path,
      which frees metadata and bytes together and reports a cleanup failure rather
      than swallowing it. A successful write keeps it, and the catalogue's own
      replacement release (inside the repository) handles the PREVIOUS file.
    */
    let stagedMediaId: string | undefined;
    try {
      let mediaId: string | undefined;
      if (file) {
        const bytes = await file.arrayBuffer();
        // Map ResourceKind to MediaKind
        const mediaKind = kind === "audio" ? "audio" : "document";
        const asset = await getMediaRepository().create({
          kind: mediaKind as any,
          filename: file.name,
          mimeType: file.type || (mediaKind === "audio" ? "audio/mpeg" : "application/pdf"),
          bytes,
        });
        mediaId = asset.id;
        stagedMediaId = asset.id;
      }
      const access =
        visibility === "students" && restricted ? [...studentIds] : [];
      if (editing) {
        await getLibraryRepository().update(editing.id, {
          title: title.trim(),
          composer: composer.trim() || undefined,
          kind,
          instrument,
          level: level.trim() || undefined,
          visibility,
          active,
          restrictedToStudentIds: access,
          ...(mediaId ? { mediaId } : {}),
        });
        notify({
          tone: "success",
          title: `«${title.trim()}» به‌روزرسانی شد`,
          detail: file ? "فایل جدید جایگزین شد؛ فایل پیشین اگر مرجع دیگری ندارد آزاد می‌شود." : undefined,
        });
      } else {
        await getLibraryRepository().create({
          title: title.trim(),
          composer: composer.trim() || undefined,
          kind,
          instrument,
          level: level.trim() || undefined,
          mediaId,
          visibility,
          active: true,
          restrictedToStudentIds: access,
        });
        notify({
          tone: "success",
          title: `«${title.trim()}» به کتابخانه افزوده شد`,
          detail: file ? "فایل فقط در همین مرورگر ذخیره شد." : "بدون فایل — تنها فراداده ثبت شد.",
        });
      }
      onSaved();
      onClose();
    } catch (cause) {
      // The catalogue write did not happen, so the staged upload must not linger.
      await releaseStagedMedia(stagedMediaId, getMediaRepository());
      notify({ tone: "danger", title: editing ? "ذخیرهٔ تغییرات انجام نشد" : "افزودن منبع انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.08] bg-zinc-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-ink-50">{editing ? `ویرایش ${editing.title}` : "افزودن منبع جدید"}</h3>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}><X className="size-4" /></Button>
        </div>

        <div className="grid gap-3">
          <Field label="عنوان">
            {(c) => <input {...c} className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً اتود شماره ۱" />}
          </Field>
          <Field label="آهنگساز / تهیه‌کننده">
            {(c) => <input {...c} className={inputCls} value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="نام آهنگساز یا مدرس" />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="نوع">
              {(c) => (
                <select {...c} className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)}>
                  <option value="sheet">نت</option>
                  <option value="audio">صوت</option>
                  <option value="video">ویدیو</option>
                  <option value="doc">جزوه</option>
                </select>
              )}
            </Field>
            <Field label="ساز">
              {(c) => (
                <select {...c} className={inputCls} value={instrument} onChange={(e) => setInstrument(e.target.value as InstrumentId)}>
                  {instruments.map((ins) => <option key={ins.id} value={ins.id}>{ins.name}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="سطح">
              {(c) => <input {...c} className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)} placeholder="مثلاً متوسطه" />}
            </Field>
            <Field label="دسترسی">
              {(c) => (
                <select {...c} className={inputCls} value={visibility} onChange={(e) => setVisibility(e.target.value as LibraryVisibility)}>
                  <option value="students">هنرجویان</option>
                  <option value="teachers">مدرسین</option>
                </select>
              )}
            </Field>
          </div>

          {visibility === "students" && (
            <Field label="سطح دسترسی هنرجویان" hint="قاعدهٔ دسترسی: فهرست خالی یعنی همهٔ هنرجویان.">
              {(c) => (
                <select
                  {...c}
                  className={inputCls}
                  value={restricted ? "some" : "all"}
                  onChange={(e) => setRestricted(e.target.value === "some")}
                >
                  <option value="all">همهٔ هنرجویان</option>
                  <option value="some">فقط هنرجویان انتخاب‌شده</option>
                </select>
              )}
            </Field>
          )}
          {visibility === "students" && restricted && (
            <fieldset className="rounded-xl border border-white/[0.07] p-3">
              <legend className="px-1 text-[10.5px] text-ink-400">هنرجویان دارای دسترسی</legend>
              <div className="max-h-40 space-y-1 overflow-y-auto pl-1">
                {studentsError ? (
                  <p className="text-[11px] text-danger-400">
                    خواندن فهرست هنرجویان ناموفق بود — {studentsError.message}{" "}
                    <button type="button" className="underline" onClick={reloadStudents}>
                      تلاش دوباره
                    </button>
                  </p>
                ) : (
                  <>
                    {students.length === 0 && <p className="text-[11px] text-ink-500">هنرجویی ثبت نشده است.</p>}
                    {students.map((student) => (
                  <label key={student.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-ink-200 hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      className="accent-gold-500"
                      checked={studentIds.includes(student.id)}
                      onChange={(e) =>
                        setStudentIds((prev) => (e.target.checked ? [...prev, student.id] : prev.filter((id) => id !== student.id)))
                      }
                    />
                    <span>{student.name}</span>
                  </label>
                    ))}
                  </>
                )}
              </div>
            </fieldset>
          )}

          {editing && (
            <Field label="وضعیت انتشار">
              {(c) => (
                <select {...c} className={inputCls} value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}>
                  <option value="active">فعال</option>
                  <option value="inactive">غیرفعال</option>
                </select>
              )}
            </Field>
          )}

          <Field label={editing ? "فایل جدید (اختیاری — جایگزین فایل فعلی)" : "فایل (اختیاری) — از طریق media seam"}>
            {() => (
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" className="sr-only" accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_AUDIO_TYPES, ...ALLOWED_DOCUMENT_TYPES].join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Button size="sm" variant="subtle" onClick={() => fileRef.current?.click()}><Upload className="size-3.5" /> انتخاب فایل</Button>
                <span className="text-[11px] text-ink-400 truncate">{file ? file.name : editing ? "بدون تغییر فایل" : "بدون فایل — تنها فراداده"}</span>
                {file && <Button size="sm" variant="ghost" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}><X className="size-3" /></Button>}
              </div>
            )}
          </Field>
          <p className="text-[10.5px] leading-relaxed text-ink-400">فایل از طریق media seam ذخیره می‌شود: ابتدا Media.create سپس Library.create با mediaId — bytes در حافظهٔ باینری، metadata در DemoDataset — بدون URL ساختگی.</p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>لغو</Button>
          <Button size="sm" variant="primary" onClick={() => void submit()} disabled={busy || title.trim().length < 2}>
            {busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ تغییرات" : "افزودن"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function LibraryView() {
  const { notify } = useApp();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ResourceKind | "all">("all");
  const [inst, setInst] = useState<InstrumentId | "all">("all");
  const [levelFilter, setLevelFilter] = useState<string | "all">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<LibraryVisibility | "all">("all");
  const instrumentFilters = useInstrumentCatalog().filter((i) => i.active);
  const [sort, setSort] = useState<"recent" | "popular" | "title">("recent");
  const [open, setOpen] = useState<LibraryItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LibraryItem | null>(null);
  const canWrite = useCan("library.write");
  // Same read, same ownership: the drawer resolves restricted-student names
  // through it, so a failed read must not be presented as a normal resolution.
  const { students, error: studentsError, reload: reloadStudents } = useStudentList({ per_page: 200 });

  const { items, total, loading, error, reload } = useLibraryList({ per_page: 200 });

  const file = useLibraryFile(open);
  const audioUrl = useMediaObjectUrl(open?.kind === "audio" ? open.mediaId : undefined);

  // Distinct levels for filter chips — from live data, no fixture
  const distinctLevels = useMemo(() => {
    const set = new Set<string>();
    for (const r of items) if (r.level) set.add(r.level);
    return [...set].sort((a, b) => a.localeCompare(b, "fa"));
  }, [items]);

  const list = useMemo(() => {
    const out = items.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (inst !== "all" && r.instrument !== inst) return false;
      if (levelFilter !== "all" && r.level !== levelFilter) return false;
      if (visibilityFilter !== "all") {
        const vis = r.visibility ?? "students";
        if (vis !== visibilityFilter) return false;
      }
      if (query) {
        // Search title/composer/teacher — teacher as composer proxy per current model
        const q = query;
        if (!r.title.includes(q) && !r.composer.includes(q) && !r.level.includes(q) && !instrumentName(r.instrument).includes(q)) return false;
      }
      return true;
    });
    if (sort === "popular") return [...out].sort((a, b) => b.uses - a.uses);
    if (sort === "title") return [...out].sort((a, b) => a.title.localeCompare(b.title, "fa"));
    // recent — by createdAt descending if available, else by insertion order reversed
    return [...out].sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (aTime && bTime) return bTime - aTime;
      return 0;
    });
  }, [items, kind, inst, levelFilter, visibilityFilter, query, sort]);

  const stats = useMemo(() => {
    const byKind = (k: ResourceKind) => items.filter((r) => r.kind === k).length;
    const mostUsed = items.reduce<LibraryItem | undefined>((best, r) => (!best || r.uses > best.uses ? r : best), undefined);
    return {
      sheets: byKind("sheet"),
      audio: byKind("audio"),
      withFile: items.filter((r) => Boolean(r.mediaId)).length,
      instruments: new Set(items.map((r) => r.instrument)).size,
      mostUsed,
    };
  }, [items]);

  const truncationNote = partialNote("کتابخانه", items.length, total);

  if (loading) return <LoadingState className="py-32" label="در حال باز کردن کتابخانه…" />;
  if (error)
    return (
      <ErrorState className="py-32" title="بارگذاری کتابخانه ناموفق بود" description={error.message} onRetry={reload} />
    );

  const notReadyReason = file.status === "ready" ? undefined : (file.reason ?? "فایل این منبع در دسترس نیست.");

  return (
    <div>
      <PageHeader
        kicker="منابع"
        title="کتابخانه"
        description="نت‌ها، جزوه‌ها و نمونه‌های شنیداری آموزشگاه — قابل اشتراک با مدرسین و هنرجویان."
        actions={
          <>
            <EntityExportButton
              entity="library"
              filters={{
                ...(query ? { search: query } : {}),
                ...(kind !== "all" ? { kind } : {}),
                ...(inst !== "all" ? { instrument: inst } : {}),
                ...(levelFilter !== "all" ? { level: levelFilter } : {}),
              }}
            />
            <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> افزودن منبع
            </Button>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: "کل منابع", value: faNum(total), hint: `${faNum(stats.sheets)} نت · ${faNum(stats.audio)} فایل صوتی` },
          { label: "پراستفاده‌ترین", value: stats.mostUsed?.title ?? "—", hint: stats.mostUsed ? `${faNum(stats.mostUsed.uses)} بار استفاده` : "هنوز منبعی ثبت نشده" },
          { label: "دارای فایل", value: faNum(stats.withFile), tone: "violet", hint: "قابل دریافت از همین مرورگر" },
          { label: "سازهای پوشش‌داده‌شده", value: faNum(stats.instruments), unit: "ساز", hint: "بر اساس منابع موجود" },
        ]}
      />
      {truncationNote && <p className="mt-2 text-[11px] text-ink-400">{truncationNote} — برای بارگذاری کامل نیاز به سرور است.</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shelves.map((sh, i) => {
          const Icon = kindIcon[sh.kind];
          const count = items.filter((r) => r.kind === sh.kind && r.instrument === sh.instrument).length;
          return (
            <button
              key={sh.id}
              type="button"
              onClick={() => setKind(sh.kind)}
              className={cn("group relative overflow-hidden rounded-2xl border p-4 text-right transition-all hover:brightness-125", kindTone[sh.kind])}
              style={{ animation: `phrase-in 400ms var(--ease-phrase) ${i * 60}ms both` }}
            >
              <div className="flex items-center justify-between">
                <Icon className="size-5" strokeWidth={1.6} />
                <span className="nums text-[11px] opacity-70">{faNum(count)}</span>
              </div>
              <div className="mt-6 text-[13px] font-semibold text-ink-50">{sh.label}</div>
              <div className="mt-2 flex gap-0.5" aria-hidden>
                {Array.from({ length: 14 }).map((_, j) => (
                  <span key={j} className="block h-3 flex-1 rounded-sm bg-current opacity-25" style={{ opacity: 0.1 + ((j * 7) % 5) * 0.06 }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <FilterBar
        className="mt-5"
        search={<SearchInput value={query} onChange={setQuery} placeholder="جستجوی عنوان، آهنگساز یا مدرس…" />}
        trailing={
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { value: "recent", label: "جدیدترین" },
              { value: "popular", label: "پراستفاده" },
              { value: "title", label: "عنوان" },
            ]}
          />
        }
        chips={
          <>
            <Chip label="همه" active={kind === "all" && inst === "all" && levelFilter === "all" && visibilityFilter === "all"} count={items.length} onClick={() => { setKind("all"); setInst("all"); setLevelFilter("all"); setVisibilityFilter("all"); }} />
            {(Object.keys(resourceKindLabel) as ResourceKind[]).map((k) => (
              <Chip key={k} label={resourceKindLabel[k]} active={kind === k} count={items.filter((r) => r.kind === k).length} onClick={() => setKind(kind === k ? "all" : k)} />
            ))}
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            {instrumentFilters.map((i) => (
              <Chip key={i.id} tone="violet" label={i.name} active={inst === i.id} onClick={() => setInst(inst === i.id ? "all" : i.id)} />
            ))}
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            {distinctLevels.slice(0, 8).map((lv) => (
              <Chip key={lv} tone="gold" label={lv} active={levelFilter === lv} onClick={() => setLevelFilter(levelFilter === lv ? "all" : lv)} />
            ))}
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            <Chip label="هنرجویان" active={visibilityFilter === "students"} onClick={() => setVisibilityFilter(visibilityFilter === "students" ? "all" : "students")} />
            <Chip label="مدرسین" active={visibilityFilter === "teachers"} onClick={() => setVisibilityFilter(visibilityFilter === "teachers" ? "all" : "teachers")} />
          </>
        }
      />

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState className="py-20" title="کتابخانه خالی است" description="هنوز منبعی در کتابخانهٔ آموزشگاه ثبت نشده است. نخستین نت، جزوه یا فایل صوتی را اضافه کنید تا اینجا پر شود." action="افزودن منبع" onAction={() => setCreateOpen(true)} />
        ) : list.length === 0 ? (
          <EmptyState title="منبعی پیدا نشد" description="با این فیلترها منبعی در کتابخانه وجود ندارد. می‌توانید منبع تازه‌ای اضافه کنید." action="پاک کردن فیلترها" onAction={() => { setKind("all"); setInst("all"); setLevelFilter("all"); setVisibilityFilter("all"); setQuery(""); }} />
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => (
              <ResourceCard key={r.id} r={r} onOpen={() => setOpen(r)} />
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <Panel className="mt-5" title="اخیراً افزوده‌شده" kicker="آخرین منابعی که مدرسین به کتابخانه اضافه کرده‌اند">
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.slice(0, 4).map((r) => {
              const Icon = kindIcon[r.kind];
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-right hover:border-white/[0.12]">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", kindTone[r.kind])}>
                      <Icon className="size-4" strokeWidth={1.7} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-ink-50">{r.title}</span>
                      <span className="block truncate text-[10.5px] text-ink-400">{r.added} · {r.composer}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {truncationNote && <p className="mt-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">{truncationNote}</p>}
        </Panel>
      )}

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        kicker={open ? resourceKindLabel[open.kind] : ""}
        title={open?.title ?? ""}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>بستن</Button>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "اشتراک‌گذاری نیازمند سرور است", detail: "پیوند اشتراک واقعی با سرور ساخته می‌شود؛ در دمو انجام نشد." })}>اشتراک با کلاس</Button>
            <Button size="sm" variant="primary" onClick={file.download} disabled={file.status !== "ready" || file.downloading}>
              <Download className="size-3.5" /> {file.downloading ? "در حال دریافت…" : "دریافت"}
            </Button>
            {canWrite && open && (
              <Button size="sm" variant="subtle" onClick={() => setEditTarget(open)}>
                <Pencil className="size-3.5" /> ویرایش
              </Button>
            )}
          </>
        }
      >
        {open && (
          <div className="space-y-4">
            <div className={cn("rounded-xl border p-3.5 text-[11.5px] leading-relaxed", file.status === "ready" ? "border-ok-500/25 bg-ok-500/[0.06] text-ok-300" : "border-warn-500/25 bg-warn-500/[0.06] text-warn-400")}>
              {file.status === "ready" && file.asset ? (
                <>فایل این منبع ذخیره شده است: <span className="nums">{file.asset.filename}</span> · <span className="nums">{faNum(file.asset.sizeBytes)}</span> بایت</>
              ) : file.status === "loading" ? (
                "در حال بررسی فایل این منبع…"
              ) : (
                <span className="flex items-center gap-1.5"><Lock className="size-3.5" /> {notReadyReason}</span>
              )}
              {file.error && <div className="mt-1.5 text-danger-400">{file.error}</div>}
            </div>

            {(open.kind === "audio" || open.peaks) && (
              <AudioMessagePlayer
                src={audioUrl}
                seed={open.id}
                title={open.title}
                peaks={open.peaks}
                durationSeconds={file.asset?.durationSeconds}
                unavailableReason={audioUrl ? undefined : "فایل صوتی این منبع در این مرورگر ذخیره نشده است، بنابراین پخشی وجود ندارد. هر زمان فایل بارگذاری شود، همین کنترل آن را واقعاً پخش می‌کند."}
              />
            )}
            <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
              {[
                ["ساز", instrumentName(open.instrument)],
                ["سطح", open.level || "—"],
                ["آهنگساز / تهیه", open.composer || "—"],
                ["حجم", open.size],
                open.pages ? ["تعداد صفحه", faNum(open.pages)] : ["مدت", open.duration ?? "—"],
                ["افزوده‌شده", open.added],
                [
                  "دسترسی",
                  open.visibility === "teachers"
                    ? "مدرسین"
                    : (open.restrictedToStudentIds?.length ?? 0) > 0
                      ? `هنرجویان منتخب (${faNum(open.restrictedToStudentIds!.length)})`
                      : "همهٔ هنرجویان",
                ],
                ["وضعیت", open.active === false ? "غیرفعال" : "فعال"],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <dt className="text-[10.5px] text-ink-400">{k}</dt>
                  <dd className="mt-1 truncate text-ink-50">{v}</dd>
                </div>
              ))}
            </dl>
            {(open.restrictedToStudentIds?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-gold-500/25 bg-gold-500/[0.06] p-3.5 text-[11.5px] leading-relaxed text-gold-100">
                دسترسی این منبع محدود است به:{" "}
                {studentsError ? (
                  <span className="text-danger-400">
                    نام هنرجویان خوانده نشد — خواندن فهرست هنرجویان ناموفق بود ({studentsError.message}).{" "}
                    <button type="button" className="underline" onClick={reloadStudents}>
                      تلاش دوباره
                    </button>
                  </span>
                ) : (
                  open.restrictedToStudentIds!.map((id) => students.find((s) => s.id === id)?.name ?? id).join("، ")
                )}
                <span className="mt-1 block text-[10.5px] text-ink-400">
                  قاعدهٔ دسترسی یک تابع خالص است (studentCanAccess) تا هر خوانندهٔ این فهرست — از جمله پرتال آیندهٔ
                  هنرجویان — دقیقاً همین قاعده را اجرا کند.
                </span>
              </div>
            )}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-[11.5px] leading-relaxed text-ink-300">
              این منبع <span className="nums text-ink-100">{faNum(open.uses)}</span> بار در کلاس‌ها استفاده شده است. اشتراک‌گذاری آن، منبع را در اپلیکیشن هنرجویان همان کلاس نمایش می‌دهد.
            </div>
          </div>
        )}
      </Drawer>

      {createOpen && <LibraryItemDialog key="create" onClose={() => setCreateOpen(false)} onSaved={reload} />}
      {editTarget && (
        <LibraryItemDialog
          key={editTarget.id}
          editing={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            setOpen(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
