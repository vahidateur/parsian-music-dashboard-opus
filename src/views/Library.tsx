import { useMemo, useState } from "react";
import { Download, FileMusic, FileText, Music2, Play, Plus, Video } from "lucide-react";
import { instrumentLabel, type Instrument } from "@/data/academy";
import { libraryShelves, resourceKindLabel, resources, type Resource, type ResourceKind } from "@/data/records";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge } from "@/components/ds/primitives";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { Chip, Drawer, FilterBar, PageHeader, Panel, SearchInput, Segmented, StatStrip, useAsyncView } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";

const kindIcon: Record<ResourceKind, typeof FileMusic> = { sheet: FileMusic, audio: Music2, video: Video, doc: FileText };
const kindTone: Record<ResourceKind, string> = {
  sheet: "border-gold-500/25 bg-gold-500/[0.08] text-gold-400",
  audio: "border-violet-500/25 bg-violet-500/[0.08] text-violet-300",
  video: "border-info-400/25 bg-info-400/[0.08] text-info-400",
  doc: "border-white/[0.08] bg-white/[0.03] text-ink-300",
};

/* Waveform preview — the library's musical signature */
function Waveform({ peaks, playing }: { peaks: number[]; playing?: boolean }) {
  return (
    <div className="flex h-8 items-center gap-[2px]" aria-hidden>
      {peaks.map((p, i) => (
        <span
          key={i}
          className={cn("block w-[2px] rounded-full", playing && i < peaks.length * 0.4 ? "bg-violet-300" : "bg-violet-400/35")}
          style={{
            height: `${p * 100}%`,
            animation: playing ? `breathe 2.4s var(--ease-legato) ${i * 40}ms infinite` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function ResourceCard({ r, onOpen }: { r: Resource; onOpen: () => void }) {
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
          {instrumentLabel[r.instrument]} · {r.level}
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
  const [inst, setInst] = useState<Instrument | "all">("all");
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [open, setOpen] = useState<Resource | null>(null);
  const [playing, setPlaying] = useState(false);
  const state = useAsyncView([]);

  const list = useMemo(() => {
    const out = resources.filter(
      (r) => (kind === "all" || r.kind === kind) && (inst === "all" || r.instrument === inst) && (query === "" || r.title.includes(query) || r.composer.includes(query)),
    );
    return sort === "popular" ? [...out].sort((a, b) => b.uses - a.uses) : out;
  }, [kind, inst, query, sort]);

  if (state === "loading") return <LoadingState className="py-32" label="در حال مرتب کردن قفسه‌ها…" />;

  return (
    <div>
      <PageHeader
        kicker="منابع"
        title="کتابخانه"
        description="نت‌ها، جزوه‌ها و نمونه‌های شنیداری آموزشگاه — قابل اشتراک با مدرسین و هنرجویان."
        actions={
          <Button size="sm" variant="primary" onClick={() => notify({ tone: "success", title: "منبع جدید", detail: "فایل را بکشید یا از رایانه انتخاب کنید." })}>
            <Plus className="size-3.5" /> افزودن منبع
          </Button>
        }
      />

      <StatStrip
        stats={[
          { label: "کل منابع", value: faNum(200), hint: `${faNum(resources.filter((r) => r.kind === "sheet").length * 12)} نت · ${faNum(52)} فایل صوتی` },
          { label: "پراستفاده‌ترین", value: "آکوردهای پایهٔ پاپ", hint: "۲۰۳ بار استفاده" },
          { label: "افزوده‌شده این ماه", value: faNum(14), tone: "violet", hint: "بیشتر برای پیانو" },
          { label: "اشتراک با هنرجویان", value: faNum(86), unit: "منبع", hint: "قابل مشاهده در اپلیکیشن" },
        ]}
      />

      {/* Shelves — a library, not a file manager */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {libraryShelves.map((sh, i) => {
          const Icon = kindIcon[sh.kind];
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
                <span className="nums text-[11px] opacity-70">{faNum(sh.count)}</span>
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
            <Chip label="همه" active={kind === "all"} count={resources.length} onClick={() => setKind("all")} />
            {(Object.keys(resourceKindLabel) as ResourceKind[]).map((k) => (
              <Chip key={k} label={resourceKindLabel[k]} active={kind === k} count={resources.filter((r) => r.kind === k).length} onClick={() => setKind(kind === k ? "all" : k)} />
            ))}
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            {(["piano", "guitar", "violin", "voice", "drums", "theory"] as Instrument[]).map((k) => (
              <Chip key={k} tone="violet" label={instrumentLabel[k]} active={inst === k} onClick={() => setInst(inst === k ? "all" : k)} />
            ))}
          </>
        }
      />

      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState
            title="منبعی پیدا نشد"
            description="با این فیلترها منبعی در کتابخانه وجود ندارد. می‌توانید منبع تازه‌ای اضافه کنید."
            action="افزودن منبع"
            onAction={() => notify({ tone: "success", title: "افزودن منبع" })}
          />
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => (
              <ResourceCard key={r.id} r={r} onOpen={() => { setOpen(r); setPlaying(false); }} />
            ))}
          </div>
        )}
      </div>

      <Panel className="mt-5" title="اخیراً افزوده‌شده" kicker="آخرین منابعی که مدرسین به کتابخانه اضافه کرده‌اند">
        <ul className="grid gap-2 sm:grid-cols-2">
          {resources.slice(0, 4).map((r) => {
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

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        kicker={open ? resourceKindLabel[open.kind] : ""}
        title={open?.title ?? ""}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>بستن</Button>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "success", title: "اشتراک‌گذاری شد", detail: "منبع برای هنرجویان کلاس مربوطه قابل مشاهده شد." })}>
              اشتراک با کلاس
            </Button>
            <Button size="sm" variant="primary" onClick={() => notify({ tone: "success", title: "دانلود آغاز شد" })}>
              <Download className="size-3.5" /> دریافت
            </Button>
          </>
        }
      >
        {open && (
          <div className="space-y-4">
            {open.peaks && (
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? "توقف" : "پخش"}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/15 text-violet-200 transition-transform active:scale-95"
                  >
                    {playing ? <span className="block h-3 w-2.5 border-x-[3px] border-violet-200" /> : <Play className="size-4 -scale-x-100" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <Waveform peaks={open.peaks} playing={playing} />
                  </div>
                  <span className="nums shrink-0 text-[11px] text-ink-300">{open.duration}</span>
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
              {[
                ["ساز", instrumentLabel[open.instrument]],
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
