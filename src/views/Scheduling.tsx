import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { ACADEMY_NOW, instrumentLabel } from "@/data/academy";
import { TODAY_INDEX, WEEKDAYS, classById, rooms, teacherById, teachers, weekSessions, type GridSession } from "@/data/records";
import { faNum, faPercent, faTime, minutesToFaTime, parseTime, toFa } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { Chip, Drawer, FilterBar, ListRow, Meter, PageHeader, Panel, Segmented, StatStrip, useAsyncView } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";

const DAY_START = 8 * 60;
const DAY_END = 21 * 60;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => 8 + i);
const PX_PER_MIN = 1.05;

const roomTone: Record<string, string> = {
  r1: "border-gold-500/35 bg-gold-500/[0.10] text-gold-200",
  r2: "border-violet-500/35 bg-violet-500/[0.10] text-violet-200",
  r3: "border-info-400/30 bg-info-400/[0.09] text-info-400",
  r4: "border-ok-500/30 bg-ok-500/[0.09] text-ok-400",
};

/* ------------------------------------------------------------------ */
function SessionBlock({
  s,
  onOpen,
  dense,
}: {
  s: GridSession;
  onOpen: () => void;
  dense?: boolean;
}) {
  const cl = classById(s.classId);
  const start = parseTime(s.start);
  const end = parseTime(s.end);
  const top = (start - DAY_START) * PX_PER_MIN;
  const height = (end - start) * PX_PER_MIN;
  const live = s.day === TODAY_INDEX && start <= ACADEMY_NOW && ACADEMY_NOW < end && !s.cancelled;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ top, height: Math.max(height, 26), animation: `phrase-in 400ms var(--ease-phrase) ${(start - DAY_START) / 12}ms both` }}
      className={cn(
        "absolute inset-x-0.5 flex flex-col justify-start overflow-hidden rounded-lg border px-1.5 py-1 text-right transition-all duration-[var(--sixteenth)] hover:z-10 hover:brightness-125",
        roomTone[s.roomId],
        s.cancelled && "border-dashed opacity-55",
        s.conflictWith && "border-warn-500/60 bg-warn-500/[0.12] text-warn-400 ring-1 ring-warn-500/25",
      )}
      title={`${cl?.title} · ${faTime(s.start)}–${faTime(s.end)} · ${rooms.find((r) => r.id === s.roomId)?.name}`}
    >
      <span className="flex items-center gap-1">
        {s.conflictWith && <AlertTriangle className="size-3 shrink-0" strokeWidth={2.2} />}
        {live && <span className="ring-live block size-1.5 shrink-0 rounded-full bg-ok-400" />}
        <span className={cn("truncate text-[10.5px] font-medium leading-tight", s.cancelled && "line-through")}>{cl?.title}</span>
      </span>
      {!dense && height > 44 && (
        <>
          <span className="nums mt-0.5 truncate text-[9.5px] opacity-80">{faTime(s.start)}–{faTime(s.end)}</span>
          <span className="truncate text-[9.5px] opacity-70">{teacherById(s.teacherId)?.name}</span>
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
export function SchedulingView() {
  const { filter, navigate, notify, openSheet } = useApp();
  const [mode, setMode] = useState<"week" | "day">("week");
  const [dayIndex, setDayIndex] = useState(TODAY_INDEX);
  const [roomFilter, setRoomFilter] = useState<string | "all">("all");
  const [teacherFilter, setTeacherFilter] = useState<string | "all">(filter?.startsWith("teacher:") ? filter.slice(8) : "all");
  const [selected, setSelected] = useState<GridSession | null>(null);
  const [resolved, setResolved] = useState(false);
  const state = useAsyncView([filter]);

  const visible = useMemo(
    () => weekSessions.filter((s) => (roomFilter === "all" || s.roomId === roomFilter) && (teacherFilter === "all" || s.teacherId === teacherFilter)),
    [roomFilter, teacherFilter],
  );

  const conflicts = weekSessions.filter((s) => s.conflictWith && !resolved);
  const nowTop = (ACADEMY_NOW - DAY_START) * PX_PER_MIN;
  const gridHeight = (DAY_END - DAY_START) * PX_PER_MIN;

  if (state === "loading") return <LoadingState className="py-32" label="در حال هماهنگ کردن تقویم…" />;

  const days = mode === "week" ? WEEKDAYS.map((_, i) => i) : [dayIndex];

  return (
    <div>
      <PageHeader
        kicker="عملیات"
        title="برنامه‌ریزی"
        description="تقویم عملیاتی آموزشگاه — اتاق‌ها، مدرسین و بازه‌های خالی در یک ریتم هفتگی."
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "attendance" })}>
              <CalendarDays className="size-3.5" /> حضور امروز
            </Button>
            <Button size="sm" variant="primary" onClick={() => openSheet("class")}>
              <Plus className="size-3.5" /> بازهٔ جدید
            </Button>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: "جلسات این هفته", value: faNum(weekSessions.length), hint: `${faNum(weekSessions.filter((s) => s.day === TODAY_INDEX).length)} جلسه امروز` },
          { label: "تعارض‌ها", value: faNum(conflicts.length / 2), tone: conflicts.length ? "warn" : "ok", hint: conflicts.length ? "اتاق ۱ · ۱۴:۰۰" : "بدون تعارض" },
          { label: "اشغال اتاق‌ها", value: faPercent(82), delta: 3.4 },
          { label: "بازه‌های خالی", value: faNum(11), tone: "violet", hint: "بیشترین در اتاق ۴" },
        ]}
      />

      {conflicts.length > 0 && (
        <Surface className="mt-5 flex flex-col gap-3 border-warn-500/25 bg-warn-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-warn-500/30 bg-warn-500/10 text-warn-400">
              <AlertTriangle className="size-4" strokeWidth={2} />
            </span>
            <div>
              <div className="text-[13.5px] font-medium text-ink-50">تعارض اتاق ۱ در سه‌شنبه ساعت ۱۴:۰۰</div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-300">
                «ویولن انفرادی» و «پیانو انفرادی · پیشرفته» هم‌زمان در یک اتاق ثبت شده‌اند — یکی از دو کلاس بدون اتاق می‌ماند.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="subtle" onClick={() => { setMode("day"); setDayIndex(TODAY_INDEX); }}>
              مشاهده در تقویم
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setResolved(true);
                notify({ tone: "success", title: "تعارض برطرف شد", detail: "پیانو پیشرفته به اتاق ۴ منتقل شد · مدرس و هنرجو مطلع شدند." });
              }}
            >
              <Sparkles className="size-3.5" /> انتقال به اتاق ۴
            </Button>
          </div>
        </Surface>
      )}

      <FilterBar
        className="mt-5"
        search={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Segmented value={mode} onChange={setMode} options={[{ value: "week", label: "هفته" }, { value: "day", label: "روز" }]} />
            {mode === "day" && (
              <div className="flex items-center gap-1">
                <button type="button" aria-label="روز بعد" onClick={() => setDayIndex((d) => Math.min(6, d + 1))} className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] text-ink-300 hover:bg-white/[0.05]">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="min-w-20 text-center text-[13px] font-medium text-ink-50">{WEEKDAYS[dayIndex]}</span>
                <button type="button" aria-label="روز قبل" onClick={() => setDayIndex((d) => Math.max(0, d - 1))} className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] text-ink-300 hover:bg-white/[0.05]">
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        }
        chips={
          <>
            <Chip label="همهٔ اتاق‌ها" active={roomFilter === "all"} onClick={() => setRoomFilter("all")} />
            {rooms.map((r) => (
              <Chip key={r.id} label={r.name} active={roomFilter === r.id} count={weekSessions.filter((s) => s.roomId === r.id).length} onClick={() => setRoomFilter(roomFilter === r.id ? "all" : r.id)} />
            ))}
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            <Chip label="همهٔ مدرسین" tone="violet" active={teacherFilter === "all"} onClick={() => setTeacherFilter("all")} />
            {teachers.slice(0, 5).map((t) => (
              <Chip key={t.id} tone="violet" label={t.name.split(" ")[0]} active={teacherFilter === t.id} onClick={() => setTeacherFilter(teacherFilter === t.id ? "all" : t.id)} />
            ))}
          </>
        }
      />

      {/* Calendar */}
      <Surface className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <div className={cn("min-w-[680px]", mode === "day" && "min-w-0")}>
            {/* header */}
            <div className="flex border-b border-white/[0.07]" style={{ paddingRight: 44 }}>
              {days.map((d) => (
                <div key={d} className={cn("flex-1 border-s border-white/[0.05] px-2 py-2.5 text-center first:border-s-0", d === TODAY_INDEX && "bg-gold-500/[0.05]")}>
                  <div className={cn("text-[12px] font-medium", d === TODAY_INDEX ? "text-gold-300" : "text-ink-200")}>{mode === "week" ? WEEKDAYS[d] : WEEKDAYS[d]}</div>
                  <div className="nums mt-0.5 text-[10px] text-ink-500">{faNum(weekSessions.filter((s) => s.day === d).length)} جلسه</div>
                </div>
              ))}
            </div>
            {/* body */}
            <div className="relative flex" style={{ height: gridHeight }}>
              {/* hour rail */}
              <div className="relative w-11 shrink-0">
                {HOURS.map((h) => (
                  <span key={h} className="nums absolute right-1 -translate-y-1/2 text-[10px] text-ink-500" style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }}>
                    {toFa(h)}
                  </span>
                ))}
              </div>
              {/* grid lines */}
              <div className="relative flex flex-1">
                {HOURS.map((h) => (
                  <span key={h} className="pointer-events-none absolute inset-x-0 h-px bg-white/[0.045]" style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }} />
                ))}
                {days.map((d) => (
                  <div key={d} className={cn("relative flex-1 border-s border-white/[0.05] first:border-s-0", d === TODAY_INDEX && "bg-gold-500/[0.025]")}>
                    {visible
                      .filter((s) => s.day === d)
                      .map((s) => (
                        <SessionBlock key={s.id} s={s} dense={mode === "week"} onOpen={() => setSelected(s)} />
                      ))}
                    {d === TODAY_INDEX && (
                      <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                        <div className="relative h-px bg-gold-400/70">
                          <span className="absolute -top-[3px] right-0 size-[7px] rounded-full bg-gold-400" />
                          <span className="nums absolute -top-2 left-1 rounded bg-ink-950/80 px-1 text-[9px] text-gold-300">{minutesToFaTime(ACADEMY_NOW)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] px-4 py-3 text-[11px] text-ink-400">
          {rooms.map((r) => (
            <span key={r.id} className="flex items-center gap-1.5">
              <i className={cn("size-2 rounded-sm border", roomTone[r.id])} /> {r.name}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm border border-warn-500/60 bg-warn-500/20" /> تعارض</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm border border-dashed border-white/25" /> لغو شده</span>
        </div>
      </Surface>

      {/* Free capacity */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title="بازه‌های خالی سه‌شنبه" kicker="ظرفیتی که همین امروز قابل فروش است">
          <ul className="space-y-2">
            {[
              { room: "اتاق ۴", time: "۱۰:۰۰ – ۱۲:۰۰", note: "مناسب پیانو کودکان" },
              { room: "اتاق ۴", time: "۱۵:۰۰ – ۱۷:۰۰", note: "پیشنهاد هوش آموزشگاه" },
              { room: "اتاق ۳", time: "۱۴:۰۰ – ۱۵:۰۰", note: "مناسب تئوری" },
              { room: "اتاق ۲", time: "۱۹:۰۰ – ۲۰:۰۰", note: "مناسب گیتار بزرگسال" },
            ].map((f) => (
              <ListRow
                key={`${f.room}-${f.time}`}
                title={f.room}
                meta={`${f.time} · ${f.note}`}
                end={<Button size="sm" variant="subtle" onClick={() => openSheet("class")}>رزرو</Button>}
              />
            ))}
          </ul>
        </Panel>
        <Panel title="فشار اتاق‌ها در هفته" kicker="کدام فضا گلوگاه است">
          <ul className="space-y-3">
            {rooms.map((r, i) => (
              <li key={r.id}>
                <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                  <span className="text-ink-200">{r.name}</span>
                  <span className="nums text-ink-400">{faPercent(r.occupancy)}</span>
                </div>
                <Meter value={r.occupancy} tone={r.occupancy >= 90 ? "warn" : r.occupancy < 65 ? "violet" : "gold"} delay={i * 70} />
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-white/[0.05] pt-3 text-[11.5px] leading-relaxed text-ink-300">
            اتاق ۱ به مرز اشباع رسیده در حالی که اتاق ۴ نزدیک نیمی از هفته خالی است.
          </p>
        </Panel>
      </div>

      {/* Session drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        kicker="جلسه"
        title={selected ? classById(selected.classId)?.title ?? "جلسه" : ""}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>بستن</Button>
            <Button size="sm" variant="primary" onClick={() => { if (selected) navigate({ view: "classes", id: selected.classId }); setSelected(null); }}>
              پروندهٔ کلاس
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {selected.cancelled ? <StatusBadge tone="neutral" label="لغو شده" cancelled /> : selected.conflictWith ? <StatusBadge tone="warn" label="تعارض اتاق" /> : <StatusBadge tone="ok" label="برنامه‌ریزی‌شده" />}
              <StatusBadge tone="neutral" label={rooms.find((r) => r.id === selected.roomId)?.name ?? ""} glyph={false} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
              {[
                ["روز", WEEKDAYS[selected.day]],
                ["ساعت", `${faTime(selected.start)} – ${faTime(selected.end)}`],
                ["مدرس", teacherById(selected.teacherId)?.name ?? "—"],
                ["ساز", instrumentLabel[classById(selected.classId)?.instrument ?? "piano"]],
                ["هنرجویان", `${faNum(classById(selected.classId)?.enrolled ?? 0)} از ${faNum(classById(selected.classId)?.capacity ?? 0)}`],
                ["اتاق", rooms.find((r) => r.id === selected.roomId)?.kind ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <dt className="text-[10.5px] text-ink-400">{k}</dt>
                  <dd className="mt-1 text-ink-50">{v}</dd>
                </div>
              ))}
            </dl>
            {selected.conflictWith && (
              <div className="rounded-xl border border-warn-500/25 bg-warn-500/[0.06] p-3.5">
                <div className="flex items-center gap-2 text-[12px] font-medium text-warn-400">
                  <AlertTriangle className="size-3.5" /> این جلسه با جلسهٔ دیگری در همین اتاق هم‌پوشانی دارد
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-300">
                  اتاق ۴ در همین بازه آزاد است و پیانو دارد؛ انتقال یکی از دو کلاس مشکل را حل می‌کند.
                </p>
                <Button size="sm" variant="primary" className="mt-3" onClick={() => { setResolved(true); setSelected(null); notify({ tone: "success", title: "تعارض برطرف شد", detail: "کلاس به اتاق ۴ منتقل شد." }); }}>
                  انتقال به اتاق ۴
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11.5px] text-ink-300">
              <InstrumentGlyph kind={classById(selected.classId)?.instrument ?? "piano"} className="size-4 text-gold-400" />
              {classById(selected.classId)?.level} · {classById(selected.classId)?.kind === "group" ? "گروهی" : "خصوصی"}
            </div>
          </div>
        )}
      </Drawer>

      {visible.length === 0 && (
        <EmptyState className="mt-5" title="جلسه‌ای با این فیلترها نیست" description="فیلتر اتاق یا مدرس را تغییر دهید." action="بازنشانی" onAction={() => { setRoomFilter("all"); setTeacherFilter("all"); }} />
      )}
    </div>
  );
}
