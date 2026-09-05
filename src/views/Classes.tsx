import { useMemo, useState } from "react";
import { Archive, CalendarDays, Pencil, Plus, UserPlus, Users } from "lucide-react";
import { instrumentLabel, type Instrument } from "@/data/academy";
import { WEEKDAYS, WEEKDAYS_SHORT, rooms, students, teacherById, weekSessions, type AcademyClass } from "@/data/records";
import { faNum, faPercent, faTime, faToman } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { Avatar, Chip, FilterBar, ListRow, Meter, PageHeader, Panel, ProgressRing, SearchInput, Segmented, StatStrip } from "@/components/ds/patterns";
import { ErrorState } from "@/components/ds/states";
import { useClasses } from "@/domains/classes/useClasses";
import { ClassFormDialog } from "@/domains/classes/ClassFormDialog";
import { EnrollmentDialog } from "@/domains/enrollments/EnrollmentDialog";
import { getClassRepository } from "@/domains/registry";
import { apiErrorFromThrown } from "@/api/errors";
import { paymentBadge } from "./Students";
import { cn } from "@/utils/cn";

const fullness = (c: AcademyClass) => Math.round((c.enrolled / c.capacity) * 100);

function CapacityDots({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  return (
    <span className="flex items-center gap-1" title={`${enrolled} از ${capacity}`}>
      {Array.from({ length: capacity }).map((_, i) => (
        <span
          key={i}
          className={cn("block size-1.5 rounded-full", i < enrolled ? "bg-gold-500" : "bg-white/[0.12]")}
          style={{ animation: `fade-in 300ms var(--ease-legato) ${i * 45}ms both` }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
function ClassCard({ c, onOpen }: { c: AcademyClass; onOpen: () => void }) {
  const teacher = teacherById(c.teacherId);
  const room = rooms.find((r) => r.id === c.roomId);
  const pct = fullness(c);
  return (
    <button type="button" onClick={onOpen} className="surface group flex flex-col gap-4 p-4 text-right transition-all hover:border-white/[0.14] hover:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold-500/20 bg-gold-500/[0.07] text-gold-400">
          <InstrumentGlyph kind={c.instrument} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink-50">{c.title}</div>
          <div className="mt-1 truncate text-[11.5px] text-ink-300">
            {c.level} · {c.kind === "group" ? "گروهی" : "خصوصی"}
          </div>
        </div>
        {c.waitlist > 0 && <StatusBadge tone="violet" label={`${faNum(c.waitlist)} در انتظار`} glyph={false} />}
      </div>

      {/* schedule rhythm */}
      <div className="flex items-center gap-1.5">
        {WEEKDAYS_SHORT.map((d, i) => (
          <span
            key={d}
            className={cn(
              "flex h-6 flex-1 items-center justify-center rounded-md text-[10px]",
              c.days.includes(i) ? "bg-gold-500/15 font-medium text-gold-300" : "bg-white/[0.03] text-ink-600",
            )}
          >
            {d}
          </span>
        ))}
        <span className="nums mr-1 shrink-0 text-[11.5px] text-ink-200">{faTime(c.time)}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-ink-400">ظرفیت</span>
            <span className="nums text-ink-100">{faNum(c.enrolled)} از {faNum(c.capacity)}</span>
          </div>
          <Meter value={pct} tone={pct >= 90 ? "warn" : pct >= 60 ? "gold" : "violet"} />
        </div>
        <CapacityDots enrolled={c.enrolled} capacity={c.capacity} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3 text-[11px]">
        <span className="flex min-w-0 items-center gap-1.5 text-ink-400">
          <Avatar name={teacher?.name ?? "—"} size="xs" />
          <span className="truncate">{teacher?.name}</span>
        </span>
        <span className="shrink-0 text-ink-400">{room?.name}</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
function ClassDetail({
  c,
  onEdit,
  onEnroll,
  onArchived,
}: {
  c: AcademyClass;
  onEdit: () => void;
  onEnroll: () => void;
  onArchived: () => void;
}) {
  const { navigate, notify } = useApp();
  const [archiveBusy, setArchiveBusy] = useState(false);
  const teacher = teacherById(c.teacherId);
  const room = rooms.find((r) => r.id === c.roomId);
  const roster = students.filter((s) => c.studentIds.includes(s.id));

  /** Archive is non-destructive: history and enrollments are preserved. */
  const archive = async () => {
    setArchiveBusy(true);
    try {
      await getClassRepository().archive(c.id);
      notify({ tone: "success", title: `${c.title} بایگانی شد`, detail: "کلاس از فهرست فعال حذف شد اما سوابق آن باقی می‌ماند." });
      onArchived();
    } catch (cause) {
      notify({ tone: "danger", title: "بایگانی انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setArchiveBusy(false);
    }
  };
  const sessions = weekSessions.filter((w) => w.classId === c.id);
  const pct = fullness(c);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: "کلاس‌ها", onClick: () => navigate({ view: "classes" }) }, { label: c.title }]}
        kicker={instrumentLabel[c.instrument]}
        title={c.title}
        description={`${c.kind === "group" ? "کلاس گروهی" : "کلاس خصوصی"} · ${c.level} · ${faNum(c.duration)} دقیقه در هر جلسه`}
        meta={
          <>
            <span>{c.days.map((d) => WEEKDAYS[d]).join(" و ")} · {faTime(c.time)}</span>
            <span>{room?.name} — {room?.kind}</span>
            <span>مدرس: {teacher?.name}</span>
          </>
        }
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "attendance" })}>
              <Users className="size-3.5" /> حضور و غیاب
            </Button>
            <Button size="sm" variant="subtle" onClick={onEdit}>
              <Pencil className="size-3.5" /> ویرایش
            </Button>
            <Button size="sm" variant="subtle" onClick={() => void archive()} disabled={archiveBusy || c.status === "archived"}>
              <Archive className="size-3.5" /> {c.status === "archived" ? "بایگانی‌شده" : "بایگانی"}
            </Button>
            <Button size="sm" variant="primary" onClick={onEnroll}>
              <UserPlus className="size-3.5" /> ثبت‌نام هنرجو
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Surface className="flex items-center gap-4 p-5">
          <ProgressRing value={pct} size={64} tone={pct >= 90 ? "warn" : "gold"}>
            <span className="nums text-[13px] font-semibold text-ink-50">{faPercent(pct)}</span>
          </ProgressRing>
          <div>
            <div className="text-[11.5px] text-ink-300">اشغال ظرفیت</div>
            <div className="nums mt-1 text-[13px] text-ink-100">{faNum(c.enrolled)} از {faNum(c.capacity)} صندلی</div>
            {c.waitlist > 0 && <div className="mt-1 text-[11px] text-violet-300">{faNum(c.waitlist)} نفر در لیست انتظار</div>}
          </div>
        </Surface>
        <Surface className="flex flex-col justify-center gap-2 p-5">
          <div className="text-[11.5px] text-ink-300">میانگین حضور</div>
          <div className="nums text-xl font-semibold leading-none text-ink-50">{faPercent(c.attendanceAvg)}</div>
          <Meter value={c.attendanceAvg} tone={c.attendanceAvg >= 90 ? "ok" : "warn"} />
        </Surface>
        <Surface className="flex flex-col justify-center gap-2 p-5">
          <div className="text-[11.5px] text-ink-300">پیشرفت دوره</div>
          <div className="nums text-xl font-semibold leading-none text-ink-50">{faPercent(c.termProgress)}</div>
          <Meter value={c.termProgress} tone="gold" />
          <div className="nums text-[11px] text-ink-400">شهریه: {faToman(c.tuition)}</div>
        </Surface>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Panel title="هنرجویان کلاس" className="lg:col-span-2" aside={<span className="nums text-[11px] text-ink-400">{faNum(roster.length)} نفر</span>}>
          {roster.length === 0 ? (
            <EmptyState title="هنوز هنرجویی ثبت‌نام نکرده" description="ظرفیت این کلاس کامل خالی است." action="افزودن هنرجو" onAction={onEnroll} />
          ) : (
            <ul className="space-y-2">
              {roster.map((s) => (
                <ListRow
                  key={s.id}
                  lead={<Avatar name={s.name} size="sm" />}
                  title={s.name}
                  meta={`${s.level} · حضور ${faPercent(s.attendance)}`}
                  end={paymentBadge(s.payment)}
                  onClick={() => navigate({ view: "students", id: s.id })}
                />
              ))}
              {Array.from({ length: Math.max(0, c.capacity - roster.length) }).map((_, i) => (
                <li key={`empty-${i}`} className="flex items-center gap-3 rounded-xl border border-dashed border-white/[0.07] px-3.5 py-3 text-[12px] text-ink-500">
                  <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-white/[0.1]">
                    <Plus className="size-3.5" />
                  </span>
                  صندلی خالی
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="جلسات هفته">
            {sessions.length === 0 ? (
              <EmptyState title="جلسه‌ای در این هفته نیست" />
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12px]">
                    <span className="text-ink-100">{WEEKDAYS[s.day]}</span>
                    <span className="nums text-ink-300">{faTime(s.start)}–{faTime(s.end)}</span>
                    {s.cancelled ? <StatusBadge tone="neutral" label="لغو" cancelled /> : s.conflictWith ? <StatusBadge tone="warn" label="تعارض" /> : null}
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" variant="subtle" className="mt-3 w-full" onClick={() => navigate({ view: "schedule" })}>
              <CalendarDays className="size-3.5" /> مشاهده در تقویم
            </Button>
          </Panel>
          {c.waitlist > 0 && (
            <Panel title="لیست انتظار" kicker={`${faNum(c.waitlist)} نفر منتظر بازهٔ خالی`}>
              <Button size="sm" variant="subtle" className="w-full" onClick={() => notify({ tone: "success", title: "پیشنهاد بازهٔ جدید ثبت شد", detail: "برای بررسی به برنامه‌ریزی ارسال شد." })}>
                ایجاد بازهٔ جدید
              </Button>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function ClassesView() {
  const { detailId, navigate, notify } = useApp();
  const [query, setQuery] = useState("");
  const [inst, setInst] = useState<Instrument | "all">("all");
  const [kind, setKind] = useState<"all" | "group" | "private">("all");
  const [sort, setSort] = useState<"fullness" | "waitlist">("fullness");
  // Repository-backed. Archived classes are excluded by the repository unless
  // explicitly requested.
  const { items: classes, loading, error, reload } = useClasses({ per_page: 200 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AcademyClass | undefined>(undefined);
  const [enrollFor, setEnrollFor] = useState<string | undefined>(undefined);

  const list = useMemo(() => {
    const out = classes.filter(
      (c) => (inst === "all" || c.instrument === inst) && (kind === "all" || c.kind === kind) && (query === "" || c.title.includes(query) || (teacherById(c.teacherId)?.name.includes(query) ?? false)),
    );
    return out.sort((a, b) => (sort === "fullness" ? fullness(b) - fullness(a) : b.waitlist - a.waitlist));
  }, [classes, inst, kind, query, sort]);

  const detail = detailId ? classes.find((c) => c.id === detailId) : undefined;

  const dialogs = (
    <>
      <ClassFormDialog
        open={formOpen}
        academyClass={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, mode) =>
          notify({
            tone: "success",
            title: mode === "create" ? `${saved.title} ساخته شد` : `${saved.title} به‌روزرسانی شد`,
            detail: "تغییرات در دادهٔ دمو ذخیره شد.",
          })
        }
      />
      <EnrollmentDialog
        open={enrollFor !== undefined}
        classId={enrollFor}
        onClose={() => setEnrollFor(undefined)}
        onEnrolled={(enrollment) =>
          notify({
            tone: "success",
            title: enrollment.status === "waitlist" ? "به لیست انتظار افزوده شد" : "ثبت‌نام انجام شد",
            detail: "ظرفیت کلاس به‌روزرسانی شد.",
          })
        }
      />
    </>
  );

  if (loading) return <LoadingState className="py-32" label="در حال چیدن کلاس‌ها…" />;
  if (error)
    return <ErrorState className="py-32" title="بارگذاری کلاس‌ها ناموفق بود" description={error.message} onRetry={reload} />;
  if (detail)
    return (
      <>
        <ClassDetail
          c={detail}
          onEdit={() => {
            setEditing(detail);
            setFormOpen(true);
          }}
          onEnroll={() => setEnrollFor(detail.id)}
          onArchived={() => navigate({ view: "classes" })}
        />
        {dialogs}
      </>
    );

  const totalSeats = classes.reduce((a, b) => a + b.capacity, 0);
  const taken = classes.reduce((a, b) => a + b.enrolled, 0);
  const waitlist = classes.reduce((a, b) => a + b.waitlist, 0);

  return (
    <div>
      <PageHeader
        kicker="عملیات"
        title="کلاس‌ها"
        description="هر کلاس یک واحد زندهٔ آموزشگاه است — ظرفیت، ریتم هفتگی و کیفیت حضور آن را اینجا ببینید."
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="size-3.5" /> کلاس جدید
          </Button>
        }
      />

      <StatStrip
        stats={[
          { label: "کلاس فعال", value: faNum(classes.length), hint: `${faNum(classes.filter((c) => c.kind === "group").length)} گروهی · ${faNum(classes.filter((c) => c.kind === "private").length)} خصوصی` },
          { label: "اشغال صندلی", value: faPercent(Math.round((taken / totalSeats) * 100)), delta: 3.4, hint: `${faNum(taken)} از ${faNum(totalSeats)}` },
          { label: "لیست انتظار", value: faNum(waitlist), tone: "violet", hint: "بیشترین: پیانو" },
          { label: "میانگین حضور", value: faPercent(Math.round(classes.reduce((a, b) => a + b.attendanceAvg, 0) / classes.length)), delta: 2.1 },
        ]}
      />

      <FilterBar
        className="mt-5"
        search={<SearchInput value={query} onChange={setQuery} placeholder="جستجوی کلاس یا مدرس…" />}
        trailing={
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { value: "fullness", label: "پرترین" },
              { value: "waitlist", label: "لیست انتظار" },
            ]}
          />
        }
        chips={
          <>
            <Chip label="همه" active={kind === "all" && inst === "all"} onClick={() => { setKind("all"); setInst("all"); }} />
            <Chip label="گروهی" active={kind === "group"} count={classes.filter((c) => c.kind === "group").length} onClick={() => setKind(kind === "group" ? "all" : "group")} />
            <Chip label="خصوصی" active={kind === "private"} count={classes.filter((c) => c.kind === "private").length} onClick={() => setKind(kind === "private" ? "all" : "private")} />
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            {(["piano", "guitar", "violin", "voice", "drums", "theory"] as Instrument[]).map((k) => (
              <Chip key={k} tone="violet" label={instrumentLabel[k]} active={inst === k} count={classes.filter((c) => c.instrument === k).length} onClick={() => setInst(inst === k ? "all" : k)} />
            ))}
          </>
        }
      />

      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState title="کلاسی پیدا نشد" description="با این فیلترها کلاسی وجود ندارد." action="بازنشانی" onAction={() => { setInst("all"); setKind("all"); setQuery(""); }} />
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <ClassCard key={c.id} c={c} onOpen={() => navigate({ view: "classes", id: c.id })} />
            ))}
          </div>
        )}
      </div>

      <Panel className="mt-5" title="اتاق‌ها" kicker="ظرفیت فیزیکی آموزشگاه و میزان استفاده از آن">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rooms.map((r, i) => (
            <div key={r.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-50">{r.name}</span>
                <span className="nums text-[11px] text-ink-400">{faNum(r.capacity)} نفر</span>
              </div>
              <div className="mt-1 text-[11px] text-ink-400">{r.kind}</div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-ink-400">اشغال</span>
                <span className="nums text-ink-100">{faPercent(r.occupancy)}</span>
              </div>
              <Meter value={r.occupancy} tone={r.occupancy < 65 ? "violet" : "gold"} className="mt-1.5" delay={i * 70} />
            </div>
          ))}
        </div>
      </Panel>

      {dialogs}
    </div>
  );
}
