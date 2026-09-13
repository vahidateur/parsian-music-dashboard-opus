/**
 * Library — repository-backed catalogue.
 *
 *   View → useLibraryList / useLibraryFile → LibraryRepository + MediaRepository
 *
 * This view used to render the static `resources` fixture, so every number on
 * the page was a constant and the "download" button was a toast apologising for
 * a file that did not exist. Rows now come from the catalogue the store
 * persists, counts are derived from those rows, and a download moves real bytes
 * out of the media abstraction.
 *
 * The view knows nothing about where anything is stored: no DemoStore, no
 * IndexedDB, no object URLs it did not ask a hook for. A record whose file is
 * missing is reported as missing (§37) rather than offered as a download.
 */
import { useMemo, useState } from "react";
import { Download, FileMusic, FileText, Music2, Plus, Video } from "lucide-react";
import type { InstrumentId } from "@/data/academy";
import { instrumentName, useInstrumentCatalog } from "@/domains/instruments/catalog";
// Presentation metadata only: the shelf labels. Catalogue ROWS are data and
// come from the repository — never from this fixture.
import { libraryShelves } from "@/data/records";
import { resourceKindLabel, type LibraryItem, type ResourceKind } from "@/domains/library/types";
import { useLibraryFile, useLibraryList } from "@/domains/library/useLibrary";
import { useMediaObjectUrl } from "@/domains/media/useMedia";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Chip, Drawer, FilterBar, PageHeader, Panel, SearchInput, Segmented, StatStrip } from "@/components/ds/patterns";
import { AudioMessagePlayer } from "@/domains/library/AudioMessagePlayer";
import { cn } from "@/utils/cn";

const kindIcon: Record<ResourceKind, typeof FileMusic> = { sheet: FileMusic, audio: Music2, video: Video, doc: FileText };
const kindTone: Record<ResourceKind, string> = {
  sheet: "border-gold-500/25 bg-gold-500/[0.08] text-gold-400",
  audio: "border-violet-500/25 bg-violet-500/[0.08] text-violet-300",
  video: "border-info-400/25 bg-info-400/[0.08] text-info-400",
  doc: "border-white/[0.08] bg-white/[0.03] text-ink-300",
};

/*
  Decorative waveform thumbnail on the resource card. It is a static visual
  signature only — actual playback lives in `AudioMessagePlayer`, which never
  animates unless audio is really playing.
*/
function Waveform({ peaks }: { peaks: number[] }) {
  return (
    <div className="flex h-8 items-center gap-[2px]" aria-hidden>
      {peaks.map((p, i) => (
        <span
          key={i}
          className="block w-[2px] rounded-full bg-violet-400/35"
          style={{ height: `${p * 100}%` }}
        />
      ))}
    </div>
  );
}

function ResourceCard({ r, onOpen }: { r: LibraryItem; onOpen: () => void }) {
  const Icon = kindIcon[r.kind];
  return (
    <button type="button" onClick={onOpen} className="surface group flex flex-col gap-3 p-4 text-right transition-all hover:border-white/[0.14] hover:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", kindTone[r.kind])}>
          <Icon className="size-[18px]" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-ink-50">{r.title}</div>
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
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3 text-[10.5px] text-ink-400">
        <span className="nums">{r.duration ?? r.size}</span>
        <span className="nums">{faNum(r.uses)} بار استفاده</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
export function LibraryView() {
  const { notify } = useApp();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ResourceKind | "all">("all");
  const [inst, setInst] = useState<InstrumentId | "all">("all");
  // Filter chips enumerate the live instrument catalogue, so an academy's own
  // instruments are filterable and a deactivated one stops offering itself.
  const instrumentFilters = useInstrumentCatalog().filter((i) => i.active);
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [open, setOpen] = useState<LibraryItem | null>(null);

  /*
    Repository-backed. `per_page` is explicit on purpose: the chips, the shelves
    and the stats all count the loaded catalogue, so a silent default page size
    would make every one of those numbers a lie about the library's size.
    BACKEND REQUIRED: server-side filtering plus per-kind counts replace this
    ceiling, exactly as for the other list views.
  */
  const { items, total, loading, error, reload } = useLibraryList({ per_page: 200 });

  /*
    The open record's file, resolved through the media abstraction — metadata and
    bytes together, so the download uses what is already in hand. Both hooks are
    called unconditionally (they accept `null`), because a hook cannot live
    inside `open && …`.
  */
  const file = useLibraryFile(open);
  const audioUrl = useMediaObjectUrl(open?.kind === "audio" ? open.mediaId : undefined);

  const list = useMemo(() => {
    const out = items.filter(
      (r) =>
        (kind === "all" || r.kind === kind) &&
        (inst === "all" || r.instrument === inst) &&
        (query === "" || r.title.includes(query) || r.composer.includes(query)),
    );
    return sort === "popular" ? [...out].sort((a, b) => b.uses - a.uses) : out;
  }, [items, kind, inst, query, sort]);

  // Every number on this page is derived from the loaded catalogue (§38). The
  // previous version rendered fixture constants — "۲۰۰ منبع", "۱۴ این ماه" —
  // which stayed the same no matter what the library actually held.
  const stats = useMemo(() => {
    const byKind = (k: ResourceKind) => items.filter((r) => r.kind === k).length;
    const mostUsed = items.reduce<LibraryItem | undefined>(
      (best, r) => (!best || r.uses > best.uses ? r : best),
      undefined,
    );
    return {
      sheets: byKind("sheet"),
      audio: byKind("audio"),
      withFile: items.filter((r) => Boolean(r.mediaId)).length,
      instruments: new Set(items.map((r) => r.instrument)).size,
      mostUsed,
    };
  }, [items]);

  if (loading) return <LoadingState className="py-32" label="در حال باز کردن کتابخانه…" />;
  if (error)
    return (
      <ErrorState
        className="py-32"
        title="بارگذاری کتابخانه ناموفق بود"
        description={error.message}
        onRetry={reload}
      />
    );

  const notReadyReason = file.status === "ready" ? undefined : (file.reason ?? "فایل این منبع در دسترس نیست.");

  return (
    <div>
      <PageHeader
        kicker="منابع"
        title="کتابخانه"
        description="نت‌ها، جزوه‌ها و نمونه‌های شنیداری آموزشگاه — قابل اشتراک با مدرسین و هنرجویان."
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              notify({
                tone: "info",
                title: "افزودن منبع از این نما فعال نیست",
                detail: "قرارداد کتابخانه ایجاد منبع را پشتیبانی می‌کند؛ فرم بارگذاری فایل در فاز بعدی به همین نما اضافه می‌شود.",
              })
            }
          >
            <Plus className="size-3.5" /> افزودن منبع
          </Button>
        }
      />

      <StatStrip
        stats={[
          {
            label: "کل منابع",
            value: faNum(total),
            hint: `${faNum(stats.sheets)} نت · ${faNum(stats.audio)} فایل صوتی`,
          },
          {
            label: "پراستفاده‌ترین",
            value: stats.mostUsed?.title ?? "—",
            hint: stats.mostUsed ? `${faNum(stats.mostUsed.uses)} بار استفاده` : "هنوز منبعی ثبت نشده",
          },
          {
            label: "دارای فایل",
            value: faNum(stats.withFile),
            tone: "violet",
            hint: "قابل دریافت از همین مرورگر",
          },
          { label: "سازهای پوشش‌داده‌شده", value: faNum(stats.instruments), unit: "ساز", hint: "بر اساس منابع موجود" },
        ]}
      />

      {/* Shelves — a library, not a file manager. Counts are real. */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {libraryShelves.map((sh, i) => {
          const Icon = kindIcon[sh.kind];
          const count = items.filter((r) => r.kind === sh.kind && r.instrument === sh.instrument).length;
          return (
            <button
              key={sh.id}
              type="button"
              onClick={() => setKind(sh.kind)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-4 text-right transition-all hover:brightness-125",
                kindTone[sh.kind],
              )}
              style={{ animation: `phrase-in 400ms var(--ease-phrase) ${i * 60}ms both` }}
            >
              <div className="flex items-center justify-between">
                <Icon className="size-5" strokeWidth={1.6} />
                <span className="nums text-[11px] opacity-70">{faNum(count)}</span>
              </div>
              <div className="mt-6 text-[13px] font-semibold text-ink-50">{sh.label}</div>
              {/* shelf lines */}
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
            ]}
          />
        }
        chips={
          <>
            <Chip label="همه" active={kind === "all"} count={items.length} onClick={() => setKind("all")} />
            {(Object.keys(resourceKindLabel) as ResourceKind[]).map((k) => (
              <Chip key={k} label={resourceKindLabel[k]} active={kind === k} count={items.filter((r) => r.kind === k).length} onClick={() => setKind(kind === k ? "all" : k)} />
            ))}
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            {instrumentFilters.map((i) => (
              <Chip key={i.id} tone="violet" label={i.name} active={inst === i.id} onClick={() => setInst(inst === i.id ? "all" : i.id)} />
            ))}
          </>
        }
      />

      <div className="mt-5">
        {items.length === 0 ? (
          /*
            A genuinely empty library is a valid state, not an error and not a
            reason to reach for the fixture: this is what a new academy sees
            before it uploads anything.
          */
          <EmptyState
            className="py-20"
            title="کتابخانه خالی است"
            description="هنوز منبعی در کتابخانهٔ آموزشگاه ثبت نشده است. نخستین نت، جزوه یا فایل صوتی را اضافه کنید تا اینجا پر شود."
            action="افزودن منبع"
            onAction={() => notify({ tone: "info", title: "افزودن منبع از این نما فعال نیست", detail: "فرم بارگذاری فایل در فاز بعدی اضافه می‌شود." })}
          />
        ) : list.length === 0 ? (
          <EmptyState
            title="منبعی پیدا نشد"
            description="با این فیلترها منبعی در کتابخانه وجود ندارد. می‌توانید منبع تازه‌ای اضافه کنید."
            action="پاک کردن فیلترها"
            onAction={() => {
              setKind("all");
              setInst("all");
              setQuery("");
            }}
          />
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
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "اشتراک‌گذاری نیازمند سرور است", detail: "پیوند اشتراک واقعی با سرور ساخته می‌شود؛ در دمو انجام نشد." })}>
              اشتراک با کلاس
            </Button>
            {/*
              A real download: the bytes come out of the media abstraction and
              reach the browser as a file. Disabled — with the reason shown in
              the body — whenever there is nothing genuine to hand over.
            */}
            <Button size="sm" variant="primary" onClick={file.download} disabled={file.status !== "ready" || file.downloading}>
              <Download className="size-3.5" /> {file.downloading ? "در حال دریافت…" : "دریافت"}
            </Button>
          </>
        }
      >
        {open && (
          <div className="space-y-4">
            {/* Honest file state: what is stored, or exactly why nothing is. */}
            <div
              className={cn(
                "rounded-xl border p-3.5 text-[11.5px] leading-relaxed",
                file.status === "ready"
                  ? "border-ok-500/25 bg-ok-500/[0.06] text-ok-300"
                  : "border-warn-500/25 bg-warn-500/[0.06] text-warn-400",
              )}
            >
              {file.status === "ready" && file.asset ? (
                <>
                  فایل این منبع ذخیره شده است: <span className="nums">{file.asset.filename}</span> ·{" "}
                  <span className="nums">{faNum(file.asset.sizeBytes)}</span> بایت
                </>
              ) : file.status === "loading" ? (
                "در حال بررسی فایل این منبع…"
              ) : (
                notReadyReason
              )}
              {file.error && <div className="mt-1.5 text-danger-400">{file.error}</div>}
            </div>

            {(open.kind === "audio" || open.peaks) && (
              /*
                A real player. It plays when the file's bytes are actually
                stored; otherwise it renders disabled and says why, instead of
                animating a waveform that plays nothing (§37).
              */
              <AudioMessagePlayer
                src={audioUrl}
                seed={open.id}
                title={open.title}
                peaks={open.peaks}
                durationSeconds={file.asset?.durationSeconds}
                unavailableReason={
                  audioUrl
                    ? undefined
                    : "فایل صوتی این منبع در این مرورگر ذخیره نشده است، بنابراین پخشی وجود ندارد. هر زمان فایل بارگذاری شود، همین کنترل آن را واقعاً پخش می‌کند."
                }
              />
            )}
            <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
              {[
                ["ساز", instrumentName(open.instrument)],
                ["سطح", open.level],
                ["آهنگساز / تهیه", open.composer],
                ["حجم", open.size],
                open.pages ? ["تعداد صفحه", faNum(open.pages)] : ["مدت", open.duration ?? "—"],
                ["افزوده‌شده", open.added],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <dt className="text-[10.5px] text-ink-400">{k}</dt>
                  <dd className="mt-1 truncate text-ink-50">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-[11.5px] leading-relaxed text-ink-300">
              این منبع <span className="nums text-ink-100">{faNum(open.uses)}</span> بار در کلاس‌ها استفاده شده است. اشتراک‌گذاری آن، منبع را در اپلیکیشن هنرجویان همان کلاس نمایش می‌دهد.
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
