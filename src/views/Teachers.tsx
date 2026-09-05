import { useMemo, useState } from "react";
import { CalendarDays, MessageSquare, Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { instrumentLabel, type Instrument } from "@/data/academy";
import { WEEKDAYS, WEEKDAYS_SHORT, TODAY_INDEX, classById, classes, students, weekSessions, type Teacher } from "@/data/records";
import { faNum, faPercent, faTime } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { Avatar, Chip, FilterBar, ListRow, Meter, PageHeader, Panel, ProgressRing, SearchInput, StatStrip, Tabs } from "@/components/ds/patterns";
import { ErrorState } from "@/components/ds/states";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { TeacherFormDialog } from "@/domains/teachers/TeacherFormDialog";
import { getTeacherRepository } from "@/domains/registry";
import { apiErrorFromThrown } from "@/api/errors";
import { cn } from "@/utils/cn";

const BLOCKS = ["صبح", "ظهر", "عصر", "شب"];

const statusMeta: Record<Teacher["status"], { label: string; tone: "ok" | "warn" | "violet" | "neutral" }> = {
  active: { label: "فعال", tone: "ok" },
  "absent-tomorrow": { label: "غیبت فردا", tone: "warn" },
  "light-load": { label: "ظرفیت آزاد", tone: "violet" },
  inactive: { label: "غیرفعال", tone: "neutral" },
};

/* ------------------------------------------------------------------ */
/* Availability grid — rhythm of a week                                */
/* ------------------------------------------------------------------ */
function AvailabilityGrid({ data, compact }: { data: number[][]; compact?: boolean }) {
  return (
    <div className="flex gap-1.5" dir="rtl">
      <div className="flex flex-col justify-around pl-1 text-[9px] text-ink-500">
        {BLOCKS.map((b) => (
          <span key={b} className={cn(compact && "leading-[14px]")}>{b}</span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {data.map((day, di) => (
          <div key={di} className="flex flex-col gap-1">
            {day.map((v, bi) => (
              <span
                key={bi}
                title={`${WEEKDAYS[di]} · ${BLOCKS[bi]} · ${v === 1 ? "پر" : v === 2 ? "خارج از دسترس" : "آزاد"}`}
                className={cn(
                  "block rounded-[3px]",
                  compact ? "h-3.5" : "h-4",
                  v === 1 ? "bg-gold-500/70" : v === 2 ? "bg-white/[0.03]" : "bg-ok-500/25",
                  di === TODAY_INDEX && "ring-1 ring-inset ring-white/15",
                )}
                style={{ animation: `fade-in 300ms var(--ease-legato) ${(di * 4 + bi) * 12}ms both` }}
              />
            ))}
            <span className={cn("mt-0.5 text-center text-[9px]", di === TODAY_INDEX ? "text-gold-400" : "text-ink-500")}>{WEEKDAYS_SHORT[di]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Teacher card                                                        */
/* ------------------------------------------------------------------ */
function TeacherCard({ t, onOpen }: { t: Teacher; onOpen: () => void }) {
  const meta = statusMeta[t.status];
  return (
    <button type="button" onClick={onOpen} className="surface group flex flex-col gap-4 p-4 text-right transition-all hover:border-white/[0.14] hover:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <Avatar name={t.name} size="md" ring={meta.tone} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink-50">{t.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-300">
            <InstrumentGlyph kind={t.instrument} className="size-3.5 text-gold-400" />
            <span className="truncate">{t.title}</span>
          </div>
        </div>
        <StatusBadge tone={meta.tone} label={meta.label} className="shrink-0" />
      </div>

      <div className="flex items-center gap-4">
        <ProgressRing value={t.utilization} size={52} tone={t.utilization < 60 ? "violet" : t.utilization > 90 ? "warn" : "gold"}>
          <span className="nums text-[11px] font-semibold text-ink-50">{faPercent(t.utilization)}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex justify-between text-[11.5px]">
            <span className="text-ink-400">بار کاری</span>
            <span className="nums text-ink-100">{faNum(t.weeklyHours)} از {faNum(t.contractHours)} ساعت</span>
          </div>
          <Meter value={t.weeklyHours} max={t.contractHours} tone={t.utilization < 60 ? "violet" : "gold"} />
          <div className="flex justify-between text-[11.5px]">
            <span className="text-ink-400">هنرجو</span>
            <span className="nums text-ink-100">{faNum(t.students)} نفر</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.05] pt-3">
        <AvailabilityGrid data={t.availability} compact />
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Teacher workspace                                                   */
/* ------------------------------------------------------------------ */
function TeacherDetail({ teacher, onEdit }: { teacher: Teacher; onEdit: () => void }) {
  const { navigate, notify } = useApp();
  const [tab, setTab] = useState<"today" | "week" | "students" | "load">("today");
  const [statusBusy, setStatusBusy] = useState(false);

  /**
   * Deactivation is reversible and non-destructive: the teacher keeps their
   * history but is excluded from new class assignment.
   */
  const toggleActive = async () => {
    const inactive = teacher.status === "inactive";
    setStatusBusy(true);
    try {
      const repository = getTeacherRepository();
      if (inactive) await repository.update(teacher.id, { status: "active" });
      else await repository.deactivate(teacher.id);
      notify({
        tone: "success",
        title: inactive ? `${teacher.name} فعال شد` : `${teacher.name} غیرفعال شد`,
        detail: inactive ? "برای تخصیص کلاس در دسترس است." : "از تخصیص کلاس‌های جدید کنار گذاشته شد؛ کلاس‌های قبلی دست‌نخورده‌اند.",
      });
    } catch (cause) {
      notify({ tone: "danger", title: "تغییر وضعیت انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setStatusBusy(false);
    }
  };
  const meta = statusMeta[teacher.status];
  const myStudents = students.filter((s) => s.teacherId === teacher.id);
  const todaySessions = weekSessions.filter((w) => w.day === TODAY_INDEX && w.teacherId === teacher.id);
  const weekByDay = WEEKDAYS.map((_, d) => weekSessions.filter((w) => w.day === d && w.teacherId === teacher.id));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: "مدرسین", onClick: () => navigate({ view: "teachers" }) }, { label: teacher.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {teacher.name}
            <StatusBadge tone={meta.tone} label={meta.label} />
          </span>
        }
        description={teacher.bio}
        meta={
          <>
            <span>{teacher.title}</span>
            <span className="nums" dir="ltr">{teacher.phone}</span>
            <span>همکاری از {teacher.since}</span>
          </>
        }
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "messages" })}>
              <MessageSquare className="size-3.5" /> پیام
            </Button>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "schedule", filter: `teacher:${teacher.id}` })}>
              <CalendarDays className="size-3.5" /> برنامهٔ کامل
            </Button>
            <Button size="sm" variant="subtle" onClick={onEdit}>
              <Pencil className="size-3.5" /> ویرایش
            </Button>
            <Button size="sm" variant="subtle" onClick={() => void toggleActive()} disabled={statusBusy}>
              <UserX className="size-3.5" />
              {teacher.status === "inactive" ? "فعال‌سازی" : "غیرفعال‌سازی"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Surface className="flex items-center gap-4 p-4">
          <ProgressRing value={teacher.utilization} size={56} tone={teacher.utilization < 60 ? "violet" : "gold"}>
            <span className="nums text-[11px] font-semibold text-ink-50">{faPercent(teacher.utilization)}</span>
          </ProgressRing>
          <div>
            <div className="text-[11.5px] text-ink-300">بهره‌وری</div>
            <div className="nums mt-0.5 text-[12.5px] text-ink-100">{faNum(teacher.weeklyHours)}/{faNum(teacher.contractHours)} ساعت</div>
          </div>
        </Surface>
        {[
          { label: "هنرجویان", value: faNum(teacher.students), hint: "فعال" },
          { label: "حضور کلاس‌ها", value: faPercent(teacher.attendanceRate), hint: "میانگین دوره" },
          { label: "ماندگاری هنرجو", value: faPercent(teacher.retention), hint: "۱۲ ماه گذشته" },
        ].map((s) => (
          <Surface key={s.label} className="flex flex-col justify-center gap-1.5 p-4">
            <div className="text-[11.5px] text-ink-300">{s.label}</div>
            <div className="nums text-xl font-semibold leading-none text-ink-50">{s.value}</div>
            <div className="text-[11px] text-ink-400">{s.hint}</div>
          </Surface>
        ))}
      </div>

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: "today", label: "امروز", count: todaySessions.length },
          { value: "week", label: "برنامهٔ هفته" },
          { value: "students", label: "هنرجویان", count: myStudents.length },
          { value: "load", label: "بار کاری و دسترسی" },
        ]}
      />

      <div key={tab} className="mt-5 animate-phrase-in">
        {tab === "today" && (
          <Panel title={`کلاس‌های امروز · ${WEEKDAYS[TODAY_INDEX]}`} kicker="ترتیب اجرا از صبح تا شب">
            {todaySessions.length === 0 ? (
              <EmptyState title="امروز کلاسی ندارد" description="این مدرس امروز در برنامهٔ آموزشگاه کلاسی ثبت نکرده است." />
            ) : (
              <ul className="space-y-2">
                {todaySessions.map((s) => {
                  const cl = classById(s.classId);
                  return (
                    <ListRow
                      key={s.id}
                      lead={<span className="nums w-11 shrink-0 text-[13px] font-medium text-ink-100">{faTime(s.start)}</span>}
                      title={cl?.title ?? "کلاس"}
                      meta={`${s.roomId.replace("r", "اتاق ")} · ${faNum(cl?.enrolled ?? 0)} هنرجو`}
                      end={s.cancelled ? <StatusBadge tone="neutral" label="لغو شده" cancelled /> : s.conflictWith ? <StatusBadge tone="warn" label="تعارض" /> : <StatusBadge tone="neutral" label="برنامه‌ریزی‌شده" />}
                      onClick={() => navigate({ view: "classes", id: s.classId })}
                    />
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        {tab === "week" && (
          <Panel title="برنامهٔ هفتگی" kicker="ستون‌ها از راست: شنبه تا جمعه">
            <div className="grid grid-cols-7 gap-2">
              {weekByDay.map((day, di) => (
                <div key={di} className={cn("rounded-xl border p-2", di === TODAY_INDEX ? "border-gold-500/30 bg-gold-500/[0.04]" : "border-white/[0.06] bg-white/[0.02]")}>
                  <div className={cn("mb-2 text-center text-[10.5px]", di === TODAY_INDEX ? "font-medium text-gold-300" : "text-ink-400")}>{WEEKDAYS_SHORT[di]}</div>
                  <div className="space-y-1">
                    {day.length === 0 && <div className="py-2 text-center text-[9px] text-ink-600">—</div>}
                    {day.map((s) => (
                      <div key={s.id} className="rounded-md border border-white/[0.07] bg-ink-800/70 px-1 py-1 text-center" title={classById(s.classId)?.title}>
                        <div className="nums text-[9.5px] text-ink-100">{faTime(s.start)}</div>
                        <div className="truncate text-[8.5px] text-ink-400">{s.roomId.replace("r", "ا")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-white/[0.05] pt-3 text-[11.5px] text-ink-300">
              مجموع <span className="nums text-ink-100">{faNum(weekSessions.filter((w) => w.teacherId === teacher.id).length)}</span> جلسه در هفته ·{" "}
              <span className="nums text-ink-100">{faNum(teacher.weeklyHours)}</span> ساعت آموزش
            </p>
          </Panel>
        )}

        {tab === "students" && (
          <Panel title="هنرجویان این مدرس" action="همهٔ هنرجویان" onAction={() => navigate({ view: "students" })}>
            {myStudents.length === 0 ? (
              <EmptyState title="هنرجویی تخصیص نیافته" description="هنوز هنرجویی به این مدرس اختصاص داده نشده است." />
            ) : (
              <ul className="space-y-2">
                {myStudents.map((s) => (
                  <ListRow
                    key={s.id}
                    lead={<Avatar name={s.name} size="sm" />}
                    title={s.name}
                    meta={`${instrumentLabel[s.instrument]} · ${s.level}`}
                    end={
                      <>
                        <Meter value={s.attendance} tone={s.attendance < 70 ? "warn" : "ok"} size="sm" label={faPercent(s.attendance)} className="hidden w-24 sm:flex" />
                        <StatusBadge tone={s.status === "at-risk" ? "warn" : "ok"} label={s.status === "at-risk" ? "در خطر" : "فعال"} />
                      </>
                    }
                    onClick={() => navigate({ view: "students", id: s.id })}
                  />
                ))}
              </ul>
            )}
          </Panel>
        )}

        {tab === "load" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="در دسترس بودن" kicker="سبز: آزاد · طلایی: پر · خاکستری: خارج از دسترس">
              <AvailabilityGrid data={teacher.availability} />
              <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-ok-500/25" /> آزاد</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-gold-500/70" /> پر</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-white/[0.06]" /> خارج از دسترس</span>
              </div>
            </Panel>
            <Panel title="تحلیل بار کاری">
              <ul className="space-y-3">
                {[
                  { label: "ساعات هفتگی", value: teacher.weeklyHours, max: teacher.contractHours, tone: "gold" as const, text: `${faNum(teacher.weeklyHours)} از ${faNum(teacher.contractHours)}` },
                  { label: "بهره‌وری", value: teacher.utilization, max: 100, tone: teacher.utilization < 60 ? ("violet" as const) : ("ok" as const), text: faPercent(teacher.utilization) },
                  { label: "نرخ حضور کلاس‌ها", value: teacher.attendanceRate, max: 100, tone: "ok" as const, text: faPercent(teacher.attendanceRate) },
                ].map((r, i) => (
                  <li key={r.label}>
                    <div className="mb-1.5 flex justify-between text-[11.5px]">
                      <span className="text-ink-200">{r.label}</span>
                      <span className="nums text-ink-400">{r.text}</span>
                    </div>
                    <Meter value={r.value} max={r.max} tone={r.tone} delay={i * 80} />
                  </li>
                ))}
              </ul>
              {teacher.utilization < 60 && (
                <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3">
                  <div className="text-[10.5px] font-medium text-violet-300">فرصت</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-100">
                    {faNum(teacher.contractHours - teacher.weeklyHours)} ساعت ظرفیت آزاد در هفته. لیست انتظار {instrumentLabel[teacher.instrument]} می‌تواند به این بازه منتقل شود.
                  </p>
                  <Button size="sm" variant="subtle" className="mt-3" onClick={() => notify({ tone: "info", title: "پیشنهاد فقط در دمو نمایش داده شد", detail: "ارسال به برنامه‌ریزی به سرور نیاز دارد." })}>
                    پیشنهاد بازهٔ جدید
                  </Button>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function TeachersView() {
  const { filter, detailId, navigate, notify } = useApp();
  const [query, setQuery] = useState("");
  const [inst, setInst] = useState<Instrument | "all">("all");
  const [only, setOnly] = useState<"all" | "absent-tomorrow" | "low-utilization">(
    filter === "absent-tomorrow" ? "absent-tomorrow" : filter === "low-utilization" ? "low-utilization" : "all",
  );
  // Repository-backed: loading reflects a real read, not a timer.
  const { items: teachers, loading, error, reload } = useTeachers({ per_page: 200 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | undefined>(undefined);

  const list = useMemo(
    () =>
      teachers.filter(
        (t) =>
          (inst === "all" || t.instrument === inst) &&
          (only === "all" || (only === "absent-tomorrow" ? t.status === "absent-tomorrow" : t.utilization < 60)) &&
          (query === "" || t.name.includes(query) || t.title.includes(query)),
      ),
    [teachers, inst, only, query],
  );

  const detail = detailId ? teachers.find((t) => t.id === detailId) : undefined;

  const savedToast = (saved: Teacher, mode: "create" | "edit") =>
    notify({
      tone: "success",
      title: mode === "create" ? `${saved.name} افزوده شد` : `${saved.name} به‌روزرسانی شد`,
      detail: "تغییرات در دادهٔ دمو ذخیره شد.",
    });

  const dialog = (
    <TeacherFormDialog open={formOpen} teacher={editing} onClose={() => setFormOpen(false)} onSaved={savedToast} />
  );

  if (loading) return <LoadingState className="py-32" label="در حال آماده‌سازی میز کار مدرسین…" />;
  if (error)
    return (
      <ErrorState className="py-32" title="بارگذاری مدرسین ناموفق بود" description={error.message} onRetry={reload} />
    );
  if (detail)
    return (
      <>
        <TeacherDetail
          teacher={detail}
          onEdit={() => {
            setEditing(detail);
            setFormOpen(true);
          }}
        />
        {dialog}
      </>
    );

  const avgUtil = Math.round(teachers.reduce((a, b) => a + b.utilization, 0) / teachers.length);
  const freeHours = teachers.reduce((a, b) => a + Math.max(0, b.contractHours - b.weeklyHours), 0);

  return (
    <div>
      <PageHeader
        kicker="افراد"
        title="مدرسین"
        description="بار کاری، در دسترس بودن و کیفیت عملیاتی هر مدرس در یک نگاه."
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "درخواست در دسترس بودن", detail: "ارسال فرم به مدرسین به سرور پیام‌رسان نیاز دارد." })}>
              <UserCheck className="size-3.5" /> درخواست ساعات آزاد
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="size-3.5" /> افزودن مدرس
            </Button>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: "مدرس فعال", value: faNum(teachers.length), hint: `${faNum(teachers.filter((t) => t.todayClasses.length > 0).length)} نفر امروز کلاس دارند` },
          { label: "بهره‌وری میانگین", value: faPercent(avgUtil), delta: 11, tone: "gold" },
          { label: "ظرفیت آزاد هفتگی", value: `${faNum(freeHours)} ساعت`, tone: "violet", hint: "قابل تخصیص به لیست انتظار", onClick: () => setOnly("low-utilization") },
          { label: "غیبت فردا", value: faNum(teachers.filter((t) => t.status === "absent-tomorrow").length), tone: "warn", hint: "۵ کلاس نیازمند جایگزین", onClick: () => setOnly("absent-tomorrow") },
        ]}
      />

      <FilterBar
        className="mt-5"
        search={<SearchInput value={query} onChange={setQuery} placeholder="جستجوی نام یا تخصص مدرس…" />}
        chips={
          <>
            <Chip label="همه" active={only === "all" && inst === "all"} onClick={() => { setOnly("all"); setInst("all"); }} />
            <Chip label="ظرفیت آزاد" active={only === "low-utilization"} onClick={() => setOnly("low-utilization")} />
            <Chip label="غیبت فردا" active={only === "absent-tomorrow"} onClick={() => setOnly("absent-tomorrow")} />
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            {(["piano", "guitar", "violin", "voice", "drums", "theory"] as Instrument[]).map((k) => (
              <Chip key={k} tone="violet" label={instrumentLabel[k]} active={inst === k} count={teachers.filter((t) => t.instrument === k).length} onClick={() => setInst(inst === k ? "all" : k)} />
            ))}
          </>
        }
      />

      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState title="مدرسی پیدا نشد" description="فیلترها را تغییر دهید تا نتایج بیشتری ببینید." action="بازنشانی" onAction={() => { setOnly("all"); setInst("all"); setQuery(""); }} />
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => (
              <TeacherCard key={t.id} t={t} onOpen={() => navigate({ view: "teachers", id: t.id })} />
            ))}
          </div>
        )}
      </div>

      <Panel className="mt-5" title="تخصیص ظرفیت" kicker="مدرسین با ظرفیت آزاد در برابر لیست انتظار سازها">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teachers
            .filter((t) => t.utilization < 60)
            .map((t) => (
              <div key={t.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={t.name} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink-50">{t.name}</div>
                    <div className="text-[11px] text-ink-400">{instrumentLabel[t.instrument]}</div>
                  </div>
                </div>
                <div className="nums mt-3 text-[11.5px] text-ink-300">
                  {faNum(t.contractHours - t.weeklyHours)} ساعت آزاد · {faNum(classes.filter((c) => c.teacherId === t.id).reduce((a, b) => a + b.waitlist, 0))} نفر در انتظار
                </div>
                <Meter value={t.weeklyHours} max={t.contractHours} tone="violet" className="mt-2" />
              </div>
            ))}
        </div>
      </Panel>

      {dialog}
    </div>
  );
}
