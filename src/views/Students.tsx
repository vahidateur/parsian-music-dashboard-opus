import { useMemo, useState } from "react";
import { CalendarPlus, Download, LayoutGrid, MessageSquare, Phone, Plus, Rows3, Wallet } from "lucide-react";
import { instrumentLabel, type Instrument } from "@/data/academy";
import { paymentLabel, studentStatusLabel, students, studentStats, teacherById, type PaymentStatus, type Student, type StudentStatus } from "@/data/records";
import { faNum, faPercent, faToman } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { Avatar, Chip, DataTable, FilterBar, ListRow, Meter, PageHeader, Panel, ProgressRing, SearchInput, Segmented, StatStrip, Tabs, useAsyncView, type Column } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";

const statusTone: Record<StudentStatus, Tone> = { active: "ok", "at-risk": "warn", paused: "neutral", waitlist: "violet" };
const paymentTone: Record<PaymentStatus, Tone> = { paid: "ok", due: "warn", overdue: "danger" };

export function paymentBadge(p: PaymentStatus) {
  return <StatusBadge tone={paymentTone[p]} label={paymentLabel[p]} />;
}

/* ------------------------------------------------------------------ */
/* Student card                                                        */
/* ------------------------------------------------------------------ */
function StudentCard({ s, onOpen }: { s: Student; onOpen: () => void }) {
  const teacher = teacherById(s.teacherId);
  const remaining = s.sessionsTotal - s.sessionsUsed;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface group flex flex-col gap-4 p-4 text-right transition-all duration-[var(--sixteenth)] hover:border-white/[0.14] hover:bg-white/[0.02]"
    >
      <div className="flex items-start gap-3">
        <Avatar name={s.name} size="md" ring={statusTone[s.status]} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink-50">{s.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-300">
            <InstrumentGlyph kind={s.instrument} className="size-3.5 text-gold-400" />
            {instrumentLabel[s.instrument]}
            <span className="text-ink-600">·</span>
            <span className="truncate">{s.level}</span>
          </div>
        </div>
        <StatusBadge tone={statusTone[s.status]} label={studentStatusLabel[s.status]} className="shrink-0" />
      </div>

      {s.status === "waitlist" ? (
        <p className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-[11.5px] text-violet-200">
          در انتظار بازهٔ خالی · ثبت {s.since}
        </p>
      ) : (
        <div className="grid grid-cols-3 items-end gap-3">
          <div>
            <div className="text-[10.5px] text-ink-400">جلسات</div>
            <div className="nums mt-1 text-sm font-semibold text-ink-50">
              {faNum(remaining)}
              <span className="text-[11px] font-normal text-ink-400"> از {faNum(s.sessionsTotal)}</span>
            </div>
            <Meter value={s.sessionsUsed} max={s.sessionsTotal} tone="neutral" size="sm" className="mt-1.5" />
          </div>
          <div>
            <div className="text-[10.5px] text-ink-400">حضور</div>
            <div className={cn("nums mt-1 text-sm font-semibold", s.attendance < 70 ? "text-warn-400" : "text-ink-50")}>{faPercent(s.attendance)}</div>
            <Meter value={s.attendance} tone={s.attendance < 70 ? "warn" : "ok"} size="sm" className="mt-1.5" />
          </div>
          <div>
            <div className="text-[10.5px] text-ink-400">پیشرفت</div>
            <div className="nums mt-1 text-sm font-semibold text-ink-50">{faPercent(s.progress)}</div>
            <Meter value={s.progress} tone="gold" size="sm" className="mt-1.5" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
        <span className="truncate text-[11px] text-ink-400">مدرس: {teacher?.name ?? "—"}</span>
        {paymentBadge(s.payment)}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Student detail workspace                                            */
/* ------------------------------------------------------------------ */
type DetailTab = "overview" | "attendance" | "finance" | "progress" | "notes";

function StudentDetail({ student }: { student: Student }) {
  const { navigate, notify, openSheet } = useApp();
  const [tab, setTab] = useState<DetailTab>("overview");
  const teacher = teacherById(student.teacherId);
  const remaining = student.sessionsTotal - student.sessionsUsed;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: "هنرجویان", onClick: () => navigate({ view: "students" }) }, { label: student.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {student.name}
            <StatusBadge tone={statusTone[student.status]} label={studentStatusLabel[student.status]} />
          </span>
        }
        description={`${instrumentLabel[student.instrument]} · ${student.level} · مدرس: ${teacher?.name ?? "—"}`}
        meta={
          <>
            <span className="nums">{faNum(student.age)} ساله</span>
            <span className="nums" dir="ltr">{student.phone}</span>
            {student.guardian && <span>ولی: {student.guardian}</span>}
            <span>عضو از {student.since}</span>
            <span>آخرین حضور: {student.lastSeen}</span>
          </>
        }
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: `تماس با ${student.name}`, detail: "یادداشت تماس در پرونده ثبت می‌شود." })}>
              <Phone className="size-3.5" /> تماس
            </Button>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "messages" })}>
              <MessageSquare className="size-3.5" /> پیام
            </Button>
            <Button size="sm" variant="primary" onClick={() => openSheet("payment")}>
              <Wallet className="size-3.5" /> ثبت پرداخت
            </Button>
          </>
        }
      />

      {/* Summary rail — the answer before the detail */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Surface className="flex items-center gap-4 p-4">
          <ProgressRing value={(student.sessionsUsed / Math.max(student.sessionsTotal, 1)) * 100} size={56} tone={remaining <= 2 ? "warn" : "gold"}>
            <span className="nums text-sm font-semibold text-ink-50">{faNum(remaining)}</span>
          </ProgressRing>
          <div className="min-w-0">
            <div className="text-[11.5px] text-ink-300">جلسات باقی‌مانده</div>
            <div className="nums mt-0.5 text-[13px] text-ink-100">از {faNum(student.sessionsTotal)} جلسه</div>
            {remaining <= 3 && remaining > 0 && <div className="mt-1 text-[11px] text-warn-400">نزدیک به پایان دوره</div>}
          </div>
        </Surface>
        <Surface className="flex items-center gap-4 p-4">
          <ProgressRing value={student.attendance} size={56} tone={student.attendance < 70 ? "warn" : "ok"}>
            <span className="nums text-[11px] font-semibold text-ink-50">{faPercent(student.attendance)}</span>
          </ProgressRing>
          <div className="min-w-0">
            <div className="text-[11.5px] text-ink-300">نرخ حضور</div>
            <div className="mt-0.5 text-[13px] text-ink-100">{student.attendance < 70 ? "کمتر از حد انتظار" : "وضعیت مطلوب"}</div>
          </div>
        </Surface>
        <Surface className="flex flex-col justify-center gap-2 p-4">
          <div className="text-[11.5px] text-ink-300">وضعیت مالی</div>
          <div className="flex items-center gap-2">{paymentBadge(student.payment)}</div>
          <div className="nums text-[12.5px] text-ink-100">{student.balance > 0 ? `${faToman(student.balance)} مانده` : "بدون بدهی"}</div>
        </Surface>
        <Surface className="flex flex-col justify-center gap-2 p-4">
          <div className="text-[11.5px] text-ink-300">پیشرفت دوره</div>
          <div className="nums text-lg font-semibold leading-none text-ink-50">{faPercent(student.progress)}</div>
          <Meter value={student.progress} tone="gold" />
        </Surface>
      </div>

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "نمای کلی" },
          { value: "attendance", label: "حضور و غیاب" },
          { value: "finance", label: "مالی" },
          { value: "progress", label: "پیشرفت" },
          { value: "notes", label: "یادداشت‌ها", count: student.notes.length },
        ]}
      />

      <div key={tab} className="mt-5 animate-phrase-in">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="کلاس بعدی" className="lg:col-span-1">
              {student.nextClass ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-ink-50">
                    <InstrumentGlyph kind={student.instrument} className="size-4 text-gold-400" />
                    {instrumentLabel[student.instrument]}
                  </div>
                  <div className="nums mt-2 text-[13px] text-ink-200">
                    {student.nextClass.day} · {student.nextClass.time}
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-400">
                    {student.nextClass.room} · {teacher?.name}
                  </div>
                  <Button size="sm" variant="subtle" className="mt-3 w-full" onClick={() => navigate({ view: "schedule" })}>
                    <CalendarPlus className="size-3.5" /> مشاهده در تقویم
                  </Button>
                </div>
              ) : (
                <EmptyState title="کلاسی برنامه‌ریزی نشده" description="این هنرجو در حال حاضر بازهٔ فعالی ندارد." action="برنامه‌ریزی کلاس" onAction={() => openSheet("class")} />
              )}
            </Panel>

            <Panel title="مهارت‌ها" kicker="ارزیابی مدرس در پایان هر ۴ جلسه" className="lg:col-span-1">
              <ul className="space-y-3">
                {student.skills.map((sk, i) => (
                  <li key={sk.label}>
                    <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                      <span className="text-ink-200">{sk.label}</span>
                      <span className="nums text-ink-400">{faPercent(sk.value)}</span>
                    </div>
                    <Meter value={sk.value} tone={sk.value >= 70 ? "ok" : sk.value >= 45 ? "gold" : "neutral"} delay={i * 80} />
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="تاریخچهٔ فعالیت" className="lg:col-span-1">
              <ol className="space-y-3">
                {student.activity.map((a, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="relative flex w-2 flex-col items-center pt-1.5">
                      <span className={cn("size-1.5 shrink-0 rounded-full", a.kind === "absence" ? "bg-warn-500" : a.kind === "payment" ? "bg-ok-500" : "bg-ink-500")} />
                      {i < student.activity.length - 1 && <span className="mt-1 w-px flex-1 bg-white/[0.07]" />}
                    </span>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="text-[12.5px] leading-relaxed text-ink-100">{a.text}</div>
                      <div className="mt-0.5 text-[10.5px] text-ink-500">{a.date}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        )}

        {tab === "attendance" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="۱۲ جلسهٔ اخیر" className="lg:col-span-2" kicker="هر ستون یک جلسه — از راست به چپ، قدیمی به جدید">
              <div className="flex items-end gap-1.5">
                {Array.from({ length: 12 }).map((_, i) => {
                  const seed = (i * 7 + student.attendance) % 10;
                  const state = seed < 1 ? "absent" : seed < 2 ? "late" : "present";
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5" title={`جلسهٔ ${i + 1}`}>
                      <div
                        className={cn("w-full rounded-md", state === "present" ? "bg-ok-500/60" : state === "late" ? "bg-warn-500/60" : "bg-danger-500/50")}
                        style={{ height: state === "present" ? 44 : state === "late" ? 28 : 16, animation: `grow-y 400ms var(--ease-phrase) ${i * 40}ms both`, transformOrigin: "bottom" }}
                      />
                      <span className="nums text-[9px] text-ink-500">{faNum(i + 1)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-ok-500/60" /> حاضر</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-warn-500/60" /> تأخیر</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-danger-500/50" /> غایب</span>
              </div>
            </Panel>
            <Panel title="خلاصه">
              <ul className="space-y-2.5 text-[12.5px]">
                <li className="flex justify-between"><span className="text-ink-300">نرخ حضور</span><span className="nums text-ink-50">{faPercent(student.attendance)}</span></li>
                <li className="flex justify-between"><span className="text-ink-300">جلسات برگزارشده</span><span className="nums text-ink-50">{faNum(student.sessionsUsed)}</span></li>
                <li className="flex justify-between"><span className="text-ink-300">جلسات باقی‌مانده</span><span className="nums text-ink-50">{faNum(remaining)}</span></li>
                <li className="flex justify-between"><span className="text-ink-300">آخرین حضور</span><span className="text-ink-50">{student.lastSeen}</span></li>
              </ul>
              {student.attendance < 70 && (
                <div className="mt-4 rounded-xl border border-warn-500/25 bg-warn-500/[0.06] p-3 text-[11.5px] leading-relaxed text-warn-400">
                  الگوی غیبت پیوسته است. تماس پیگیری یا تغییر بازهٔ کلاس پیشنهاد می‌شود.
                </div>
              )}
            </Panel>
          </div>
        )}

        {tab === "finance" && (
          <Panel title="سوابق مالی" action="مشاهده در بخش مالی" onAction={() => navigate({ view: "finance" })}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[11px] text-ink-400">وضعیت جاری</div>
                <div className="mt-2">{paymentBadge(student.payment)}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[11px] text-ink-400">مانده حساب</div>
                <div className="nums mt-2 text-sm font-semibold text-ink-50">{student.balance > 0 ? faToman(student.balance) : "۰ تومان"}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[11px] text-ink-400">شهریهٔ دوره</div>
                <div className="nums mt-2 text-sm font-semibold text-ink-50">{faToman(3_600_000)}</div>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {student.activity.filter((a) => a.kind === "payment").map((a, i) => (
                <ListRow key={i} title={a.text} meta={a.date} end={<StatusBadge tone="ok" label="ثبت‌شده" />} />
              ))}
              {student.activity.filter((a) => a.kind === "payment").length === 0 && (
                <EmptyState title="پرداختی ثبت نشده" description="اولین پرداخت این هنرجو هنوز ثبت نشده است." action="ثبت پرداخت" onAction={() => openSheet("payment")} />
              )}
            </ul>
          </Panel>
        )}

        {tab === "progress" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="مسیر سطح" kicker="پیشرفت در مسیر آموزشی آموزشگاه">
              <ol className="relative space-y-3">
                {["پایه", "مقدماتی", "میانی", "پیشرفته", "حرفه‌ای", "اجرای صحنه"].map((lvl, i) => {
                  const done = i + 1 < student.levelStep;
                  const current = i + 1 === student.levelStep;
                  return (
                    <li key={lvl} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold",
                          done ? "border-ok-500/40 bg-ok-500/15 text-ok-400" : current ? "border-gold-500/50 bg-gold-500/15 text-gold-300" : "border-white/[0.08] text-ink-500",
                        )}
                      >
                        {faNum(i + 1)}
                      </span>
                      <span className={cn("flex-1 text-[13px]", current ? "font-medium text-ink-50" : done ? "text-ink-200" : "text-ink-500")}>{lvl}</span>
                      {current && <StatusBadge tone="gold" label="سطح فعلی" glyph={false} />}
                    </li>
                  );
                })}
              </ol>
            </Panel>
            <Panel title="روند پیشرفت" kicker="بر پایهٔ ارزیابی‌های مدرس">
              <div className="space-y-3">
                {student.skills.map((sk, i) => (
                  <div key={sk.label}>
                    <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                      <span className="text-ink-200">{sk.label}</span>
                      <span className="nums text-ink-400">{faPercent(sk.value)}</span>
                    </div>
                    <Meter value={sk.value} tone="violet" delay={i * 80} />
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-white/[0.05] pt-3 text-[11.5px] leading-relaxed text-ink-300">
                میانگین کل: <span className="nums text-ink-100">{faPercent(Math.round(student.skills.reduce((a, b) => a + b.value, 0) / student.skills.length))}</span>
              </p>
            </Panel>
          </div>
        )}

        {tab === "notes" && (
          <Panel title="یادداشت‌های مدرس و پذیرش" action="افزودن یادداشت" onAction={() => notify({ tone: "success", title: "یادداشت ثبت شد", detail: "برای مدرس این هنرجو نیز قابل مشاهده است." })}>
            {student.notes.length === 0 ? (
              <EmptyState title="یادداشتی ثبت نشده" description="یادداشت‌های مدرس دربارهٔ پیشرفت و نیازهای هنرجو اینجا جمع می‌شود." action="افزودن یادداشت" onAction={() => notify({ tone: "success", title: "یادداشت ثبت شد" })} />
            ) : (
              <ul className="space-y-3">
                {student.notes.map((n, i) => (
                  <li key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium text-gold-400">{n.by}</span>
                      <span className="text-ink-500">{n.date}</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-100">{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Students view                                                       */
/* ------------------------------------------------------------------ */
export function StudentsView() {
  const { filter, detailId, navigate, openSheet, notify } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StudentStatus | "all">((filter as StudentStatus) ?? "all");
  const [instrument, setInstrument] = useState<Instrument | "all">("all");
  const [layout, setLayout] = useState<"cards" | "table">("cards");
  const state = useAsyncView([filter, detailId]);

  const list = useMemo(
    () =>
      students.filter(
        (s) =>
          (status === "all" || s.status === status) &&
          (instrument === "all" || s.instrument === instrument) &&
          (query === "" || s.name.includes(query) || instrumentLabel[s.instrument].includes(query)),
      ),
    [status, instrument, query],
  );

  const detail = detailId ? students.find((s) => s.id === detailId) : undefined;

  if (state === "loading") return <LoadingState className="py-32" label="در حال باز کردن پروندهٔ هنرجویان…" />;
  if (detail) return <StudentDetail student={detail} />;

  const columns: Column<Student>[] = [
    {
      key: "name",
      header: "هنرجو",
      cell: (s) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={s.name} size="sm" ring={statusTone[s.status]} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink-50">{s.name}</div>
            <div className="truncate text-[11px] text-ink-400">{s.level}</div>
          </div>
        </div>
      ),
    },
    { key: "instrument", header: "ساز", cell: (s) => <span className="text-ink-200">{instrumentLabel[s.instrument]}</span>, hideBelow: "sm" },
    { key: "teacher", header: "مدرس", cell: (s) => <span className="text-ink-300">{teacherById(s.teacherId)?.name}</span>, hideBelow: "md" },
    {
      key: "sessions",
      header: "جلسات",
      cell: (s) => <span className="nums text-ink-200">{s.sessionsTotal ? `${faNum(s.sessionsTotal - s.sessionsUsed)} / ${faNum(s.sessionsTotal)}` : "—"}</span>,
      hideBelow: "md",
    },
    {
      key: "attendance",
      header: "حضور",
      cell: (s) => (s.sessionsTotal ? <Meter value={s.attendance} tone={s.attendance < 70 ? "warn" : "ok"} size="sm" label={faPercent(s.attendance)} className="w-24" /> : <span className="text-ink-500">—</span>),
      hideBelow: "lg",
    },
    { key: "payment", header: "مالی", cell: (s) => paymentBadge(s.payment) },
    { key: "status", header: "وضعیت", cell: (s) => <StatusBadge tone={statusTone[s.status]} label={studentStatusLabel[s.status]} />, align: "end" },
  ];

  return (
    <div>
      <PageHeader
        kicker="افراد"
        title="هنرجویان"
        description="پروندهٔ کامل هنرجویان، وضعیت حضور، پیشرفت و مالی — همه در یک نما."
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "خروجی در حال آماده‌سازی", detail: "فایل CSV برای شما ارسال می‌شود." })}>
              <Download className="size-3.5" /> خروجی
            </Button>
            <Button size="sm" variant="primary" onClick={() => openSheet("student")}>
              <Plus className="size-3.5" /> افزودن هنرجو
            </Button>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: "هنرجوی فعال", value: faNum(studentStats.active), delta: 8.4, hint: "روند صعودی", onClick: () => setStatus("active") },
          { label: "در معرض ریزش", value: faNum(studentStats.atRisk), tone: "warn", hint: "بیش از ۲ هفته غیبت", onClick: () => setStatus("at-risk") },
          { label: "لیست انتظار", value: faNum(studentStats.waitlist), tone: "violet", hint: "نیازمند تماس", onClick: () => setStatus("waitlist") },
          { label: "ثبت‌نام این ماه", value: faNum(studentStats.newThisMonth), delta: 12, hint: "بالاتر از میانگین" },
        ]}
      />

      <FilterBar
        className="mt-5"
        search={<SearchInput value={query} onChange={setQuery} placeholder="جستجوی نام هنرجو یا ساز…" />}
        trailing={
          <Segmented
            value={layout}
            onChange={setLayout}
            options={[
              { value: "cards", label: <LayoutGrid className="size-3.5" />, hint: "نمای کارت" },
              { value: "table", label: <Rows3 className="size-3.5" />, hint: "نمای جدول" },
            ]}
          />
        }
        chips={
          <>
            <Chip label="همه" active={status === "all"} count={students.length} onClick={() => setStatus("all")} />
            {(Object.keys(studentStatusLabel) as StudentStatus[]).map((k) => (
              <Chip key={k} label={studentStatusLabel[k]} active={status === k} count={students.filter((s) => s.status === k).length} onClick={() => setStatus(k)} />
            ))}
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            <Chip label="همهٔ سازها" tone="violet" active={instrument === "all"} onClick={() => setInstrument("all")} />
            {(Object.keys(instrumentLabel) as Instrument[]).map((k) => (
              <Chip key={k} tone="violet" label={instrumentLabel[k]} active={instrument === k} count={students.filter((s) => s.instrument === k).length} onClick={() => setInstrument(k)} />
            ))}
          </>
        }
      />

      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState
            title="هنرجویی با این فیلترها پیدا نشد"
            description="می‌توانید فیلترها را بازنشانی کنید یا هنرجوی جدیدی ثبت کنید."
            action="بازنشانی فیلترها"
            onAction={() => {
              setQuery("");
              setStatus("all");
              setInstrument("all");
            }}
          />
        ) : layout === "cards" ? (
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => (
              <StudentCard key={s.id} s={s} onOpen={() => navigate({ view: "students", id: s.id })} />
            ))}
          </div>
        ) : (
          <Surface className="p-2 sm:p-4">
            <DataTable rows={list} columns={columns} caption="فهرست هنرجویان" onRowClick={(s) => navigate({ view: "students", id: s.id })} />
          </Surface>
        )}
      </div>
    </div>
  );
}
