import { useMemo, useState } from "react";
import { CheckCheck, Clock3, Undo2 } from "lucide-react";
import { attendanceByDay, attendanceLabel, attendanceTrend, classById, students, teacherById, todayAttendance, type AttendanceMark, type AttendanceRoster } from "@/data/records";
import { faNum, faPercent, faTime } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState } from "@/components/ds/states";
import { Avatar, ListRow, Meter, PageHeader, Panel, ProgressRing, Segmented, StatStrip, Tabs } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";

const MARKS: Exclude<AttendanceMark, null>[] = ["present", "late", "absent", "excused"];
const markTone: Record<Exclude<AttendanceMark, null>, string> = {
  present: "border-ok-500/45 bg-ok-500/15 text-ok-400",
  late: "border-warn-500/45 bg-warn-500/15 text-warn-400",
  absent: "border-danger-500/45 bg-danger-500/15 text-danger-400",
  excused: "border-info-400/40 bg-info-400/12 text-info-400",
};
const markGlyph: Record<Exclude<AttendanceMark, null>, string> = { present: "✓", late: "◷", absent: "✕", excused: "◇" };

const stateMeta: Record<AttendanceRoster["state"], { label: string; tone: "ok" | "warn" | "neutral" | "danger" }> = {
  recorded: { label: "ثبت شده", tone: "ok" },
  "in-progress": { label: "در حال برگزاری", tone: "ok" },
  pending: { label: "ثبت‌نشده", tone: "warn" },
  cancelled: { label: "لغو شده", tone: "neutral" },
};

/* ------------------------------------------------------------------ */
export function AttendanceView() {
  const { filter, navigate, notify } = useApp();
  const [tab, setTab] = useState<"today" | "history" | "absentees">(filter === "pending" ? "today" : "today");
  const [rosters, setRosters] = useState(todayAttendance);
  const [activeId, setActiveId] = useState<string>(todayAttendance.find((r) => r.state === "pending")?.sessionId ?? todayAttendance[0].sessionId);
  const [scope, setScope] = useState<"all" | "pending">(filter === "pending" ? "pending" : "all");

  const active = rosters.find((r) => r.sessionId === activeId);
  const pendingCount = rosters.filter((r) => r.state === "pending").length;

  const setMark = (sessionId: string, studentId: string, mark: AttendanceMark) => {
    setRosters((prev) =>
      prev.map((r) => (r.sessionId === sessionId ? { ...r, entries: r.entries.map((e) => (e.studentId === studentId ? { ...e, mark } : e)) } : r)),
    );
  };

  const markAllPresent = (sessionId: string) => {
    setRosters((prev) => prev.map((r) => (r.sessionId === sessionId ? { ...r, entries: r.entries.map((e) => ({ ...e, mark: "present" as AttendanceMark })) } : r)));
    notify({ tone: "success", title: "همه حاضر ثبت شدند", detail: "می‌توانید موارد استثنا را جداگانه تغییر دهید." });
  };

  const submit = (sessionId: string) => {
    setRosters((prev) => prev.map((r) => (r.sessionId === sessionId ? { ...r, state: "recorded", recordedBy: "آرمان احمدی" } : r)));
    notify({ tone: "info", title: "حضور و غیاب در دمو ثبت شد", detail: "ثبت دائمی و اطلاع‌رسانی به مدرس به سرور نیاز دارد." });
  };

  const visibleRosters = useMemo(() => (scope === "pending" ? rosters.filter((r) => r.state === "pending") : rosters), [rosters, scope]);
  const todaySummary = useMemo(() => {
    const all = rosters.flatMap((r) => r.entries);
    return {
      present: all.filter((e) => e.mark === "present").length,
      late: all.filter((e) => e.mark === "late").length,
      absent: all.filter((e) => e.mark === "absent").length,
      pending: all.filter((e) => e.mark === null).length,
    };
  }, [rosters]);

  return (
    <div>
      <PageHeader
        kicker="عملیات"
        title="حضور و غیاب"
        description="ثبت سریع حضور امروز، پیگیری غیبت‌ها و تصویر بلندمدت انضباط آموزشگاه."
        actions={
          pendingCount > 0 ? (
            <Button size="sm" variant="primary" onClick={() => { setScope("pending"); setTab("today"); }}>
              <Clock3 className="size-3.5" /> {faNum(pendingCount)} کلاس ثبت‌نشده
            </Button>
          ) : (
            <StatusBadge tone="ok" label="همهٔ کلاس‌ها ثبت شده" />
          )
        }
      />

      <StatStrip
        stats={[
          { label: "نرخ حضور امروز", value: faPercent(92), delta: 2.1, hint: "بالاتر از میانگین ماه" },
          { label: "حاضر", value: faNum(todaySummary.present), tone: "ok", hint: `${faNum(todaySummary.late)} تأخیر` },
          { label: "غایب", value: faNum(todaySummary.absent), tone: "warn", hint: "نیازمند پیگیری" },
          { label: "کلاس ثبت‌نشده", value: faNum(pendingCount), tone: pendingCount ? "warn" : "ok", hint: "تا پایان روز", onClick: () => setScope("pending") },
        ]}
      />

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: "today", label: "امروز", count: rosters.length },
          { value: "absentees", label: "غایبان و پیگیری" },
          { value: "history", label: "تاریخچه" },
        ]}
      />

      <div key={tab} className="mt-5 animate-phrase-in">
        {tab === "today" && (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* session list */}
            <div className="space-y-3">
              <Segmented
                className="w-full"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "all", label: `همه (${faNum(rosters.length)})` },
                  { value: "pending", label: `ثبت‌نشده (${faNum(pendingCount)})` },
                ]}
              />
              {visibleRosters.length === 0 ? (
                <EmptyState title="همه‌چیز ثبت شده" description="حضور و غیاب همهٔ کلاس‌های امروز کامل است." icon={<CheckCheck className="size-5" />} />
              ) : (
                <ul className="stagger space-y-2">
                  {visibleRosters.map((r) => {
                    const cl = classById(r.classId);
                    const meta = stateMeta[r.state];
                    return (
                      <ListRow
                        key={r.sessionId}
                        active={r.sessionId === activeId}
                        onClick={() => setActiveId(r.sessionId)}
                        lead={<span className="nums w-10 shrink-0 text-[12.5px] font-medium text-ink-100">{faTime(r.time)}</span>}
                        title={cl?.title ?? "کلاس"}
                        meta={`${faNum(r.entries.length)} هنرجو · ${teacherById(cl?.teacherId ?? "")?.name ?? "—"}`}
                        end={<StatusBadge tone={meta.tone} label={meta.label} live={r.state === "in-progress"} cancelled={r.state === "cancelled"} />}
                      />
                    );
                  })}
                </ul>
              )}
            </div>

            {/* roster */}
            {active ? (
              <Panel
                title={classById(active.classId)?.title ?? "کلاس"}
                kicker={`${faTime(active.time)} · ${teacherById(classById(active.classId)?.teacherId ?? "")?.name} · ${faNum(active.entries.length)} هنرجو`}
                aside={<StatusBadge tone={stateMeta[active.state].tone} label={stateMeta[active.state].label} />}
              >
                {active.state === "cancelled" ? (
                  <EmptyState title="این کلاس لغو شده است" description="برای جلسهٔ لغو‌شده حضور و غیاب ثبت نمی‌شود. می‌توانید جلسهٔ جبرانی تعریف کنید." action="تعریف جلسهٔ جبرانی" onAction={() => notify({ tone: "info", title: "جلسهٔ جبرانی نیازمند سرور است", detail: "زمان‌بندی جبرانی باید در سرور ثبت شود." })} />
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
                      <Button size="sm" variant="subtle" onClick={() => markAllPresent(active.sessionId)}>
                        <CheckCheck className="size-3.5" /> همه حاضر
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setRosters((p) => p.map((r) => (r.sessionId === active.sessionId ? { ...r, entries: r.entries.map((e) => ({ ...e, mark: null })) } : r)))}>
                          <Undo2 className="size-3.5" /> پاک کردن
                        </Button>
                        <Button size="sm" variant="primary" disabled={active.state === "recorded"} onClick={() => submit(active.sessionId)}>
                          {active.state === "recorded" ? "ثبت شده" : "ثبت نهایی"}
                        </Button>
                      </div>
                    </div>
                    <ul className="stagger space-y-2">
                      {active.entries.map((e) => {
                        const st = students.find((s) => s.id === e.studentId);
                        return (
                          <li key={e.studentId} className="flex flex-col gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <Avatar name={st?.name ?? "—"} size="sm" />
                              <div className="min-w-0">
                                <button type="button" onClick={() => st && navigate({ view: "students", id: st.id })} className="block truncate text-[13.5px] font-medium text-ink-50 hover:text-gold-300">
                                  {st?.name}
                                </button>
                                <div className="truncate text-[11px] text-ink-400">
                                  {st?.level} · حضور کلی {faPercent(st?.attendance ?? 0)}
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                              {MARKS.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setMark(active.sessionId, e.studentId, e.mark === m ? null : m)}
                                  aria-pressed={e.mark === m}
                                  className={cn(
                                    "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-all duration-[var(--sixteenth)] active:scale-95",
                                    e.mark === m ? markTone[m] : "border-white/[0.07] bg-white/[0.02] text-ink-400 hover:border-white/[0.16] hover:text-ink-100",
                                  )}
                                >
                                  <span aria-hidden>{markGlyph[m]}</span>
                                  {attendanceLabel[m]}
                                </button>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </Panel>
            ) : (
              <EmptyState title="کلاسی انتخاب نشده" description="از فهرست کنار، یک کلاس را برای ثبت حضور انتخاب کنید." />
            )}
          </div>
        )}

        {tab === "absentees" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="غایبان امروز" className="lg:col-span-2" kicker="پیگیری سریع پیش از آنکه به الگو تبدیل شود">
              <ul className="space-y-2">
                {rosters
                  .flatMap((r) => r.entries.filter((e) => e.mark === "absent").map((e) => ({ ...e, roster: r })))
                  .map((e) => {
                    const st = students.find((s) => s.id === e.studentId);
                    return (
                      <ListRow
                        key={e.studentId + e.roster.sessionId}
                        lead={<Avatar name={st?.name ?? ""} size="sm" ring="warn" />}
                        title={st?.name ?? ""}
                        meta={`${classById(e.roster.classId)?.title} · ${faTime(e.roster.time)} · حضور کلی ${faPercent(st?.attendance ?? 0)}`}
                        end={
                          <Button size="sm" variant="subtle" onClick={() => notify({ tone: "success", title: "پیام پیگیری ارسال شد", detail: `${st?.name} و ولی ایشان مطلع شدند.` })}>
                            پیگیری
                          </Button>
                        }
                        onClick={() => st && navigate({ view: "students", id: st.id })}
                      />
                    );
                  })}
                {rosters.flatMap((r) => r.entries.filter((e) => e.mark === "absent")).length === 0 && (
                  <EmptyState title="امروز غیبتی ثبت نشده" description="همهٔ هنرجویانی که کلاس داشته‌اند حاضر بوده‌اند." />
                )}
              </ul>
            </Panel>
            <Panel title="الگوی غیبت" kicker="هنرجویان با بیش از دو هفته غیبت">
              <ul className="space-y-2">
                {students.filter((s) => s.status === "at-risk").slice(0, 5).map((s) => (
                  <li key={s.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => navigate({ view: "students", id: s.id })} className="truncate text-[13px] font-medium text-ink-50 hover:text-gold-300">
                        {s.name}
                      </button>
                      <span className="nums text-[11px] text-warn-400">{faPercent(s.attendance)}</span>
                    </div>
                    <Meter value={s.attendance} tone="warn" size="sm" className="mt-2" />
                    <div className="mt-1.5 text-[10.5px] text-ink-400">آخرین حضور: {s.lastSeen}</div>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="subtle" className="mt-3 w-full" onClick={() => navigate({ view: "students", filter: "at-risk" })}>
                همهٔ هنرجویان در خطر
              </Button>
            </Panel>
          </div>
        )}

        {tab === "history" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="روند حضور" className="lg:col-span-2" kicker="۵ هفتهٔ گذشته — از راست به چپ">
              <div className="flex items-end gap-3">
                {attendanceTrend.map((t, i) => (
                  <div key={t.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="nums text-[11px] text-ink-100">{faPercent(t.value)}</span>
                    <div
                      className={cn("w-full rounded-t-lg", i === attendanceTrend.length - 1 ? "bg-gradient-to-t from-gold-600 to-gold-400" : "bg-ink-600")}
                      style={{ height: (t.value - 80) * 6, animation: `grow-y 500ms var(--ease-phrase) ${i * 70}ms both`, transformOrigin: "bottom" }}
                    />
                    <span className="text-center text-[10px] text-ink-400">{t.label}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="حضور بر حسب روز" kicker="این هفته">
              <ul className="space-y-2.5">
                {attendanceByDay.map((d, i) => {
                  const total = d.present + d.absent + d.late;
                  return (
                    <li key={d.day}>
                      <div className="mb-1 flex items-center justify-between text-[11.5px]">
                        <span className="text-ink-200">{d.day}</span>
                        <span className="nums text-ink-400">{faPercent(Math.round((d.present / total) * 100))}</span>
                      </div>
                      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                        <span className="bg-ok-500/70" style={{ width: `${(d.present / total) * 100}%`, animation: `grow-x 600ms var(--ease-phrase) ${i * 60}ms both` }} />
                        <span className="bg-warn-500/70" style={{ width: `${(d.late / total) * 100}%` }} />
                        <span className="bg-danger-500/60" style={{ width: `${(d.absent / total) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.05] pt-3 text-[10.5px] text-ink-400">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-ok-500/70" /> حاضر</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-warn-500/70" /> تأخیر</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-danger-500/60" /> غایب</span>
              </div>
            </Panel>
          </div>
        )}
      </div>

      {/* today's discipline pulse */}
      <Surface className="mt-5 flex flex-col items-center gap-5 p-5 sm:flex-row">
        <ProgressRing value={92} size={72} tone="ok">
          <span className="nums text-sm font-semibold text-ink-50">{faPercent(92)}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1 text-center sm:text-right">
          <h3 className="text-[14px] font-semibold text-ink-50">نبض انضباط آموزشگاه</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
            حضور امروز {faPercent(92)} است — بالاتر از میانگین ماه ({faPercent(89)}). بیشترین غیبت در کلاس‌های صبح گیتار رخ داده است.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {[
            { label: "پیانو", value: 96 },
            { label: "ویولن", value: 93 },
            { label: "گیتار", value: 84 },
          ].map((x) => (
            <div key={x.label} className="text-center">
              <InstrumentGlyph kind={x.label === "پیانو" ? "piano" : x.label === "ویولن" ? "violin" : "guitar"} className="mx-auto size-4 text-gold-400" />
              <div className="nums mt-1.5 text-[13px] font-semibold text-ink-50">{faPercent(x.value)}</div>
              <div className="text-[10px] text-ink-400">{x.label}</div>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}
