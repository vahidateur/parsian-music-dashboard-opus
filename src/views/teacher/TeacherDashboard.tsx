/**
 * The teaching desk — the teacher's rendition of the `dashboard` view.
 *
 * WHY IT IS THE SAME VIEW
 *
 * A teacher's home in this product is not a second product: it is the same
 * `dashboard` route, rendered from the same shell, with an information
 * architecture built around the teaching day rather than the academy's KPIs.
 * The management body is untouched — `Dashboard` branches on the signed-in
 * role and only a teacher ever sees this component.
 *
 * THE ORDER IS THE WORKFLOW
 *
 *   next class → today → registers → attention → students → lesson & repertoire
 *   → resources → messages
 *
 * Everything on it is read from records through `useTeacherDesk`, and each
 * panel says which read it is waiting for when the answer is not in hand. No
 * figure is composed here: the tiles are counts of rows that were read, the
 * register sentences come from the day model, and a missing read is «—».
 */
import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/domains/auth/AuthContext";
import type { Actor } from "@/domains/auth/scope";
import { useAcademyNow, academyNow } from "@/domains/shared/clock";
import { useTeacherDesk, useTeacherLessonContent } from "@/domains/shared/useTeacherDesk";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { academyIsoDate } from "@/views/relations/academyDay";
import { Hero } from "@/components/hero/Hero";
import { AcademyClockBar } from "@/components/hero/AcademyClockBar";
import { StatStrip, type StatDef } from "@/components/ds/patterns";
import { Button, SectionHeader, Surface } from "@/components/ds/primitives";
import { DemoNote, EmptyState, ErrorState } from "@/components/ds/states";
import { NextClassPlate } from "@/components/teacher/NextClassPlate";
import { RegisterDuePanel, TeacherDayTimeline } from "@/components/teacher/TeacherDayPanels";
import { MyStudentsRoster, TeacherAttentionList } from "@/components/teacher/TeacherRosterPanels";
import { LessonFocusPanel, RepertoireBoard, ResourceShelf } from "@/components/teacher/TeacherLessonPanels";
import type { HeroStat } from "@/domains/shared/useAcademyMetrics";
import { faNum, faTime, NO_DATA } from "@/lib/format";

export function TeacherDashboard() {
  const { navigate } = useApp();
  const { user, permissions } = useAuth();
  const actor: Actor | null = user
    ? {
        userId: user.id,
        role: user.role,
        permissions,
        ...(user.teacherId ? { teacherId: user.teacherId } : {}),
      }
    : null;
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  /* Short viewports get the compact plate and the clock bar drops out, so the
     next class, today's rows and the register action all stay above the fold. */
  const shortViewport = useMediaQuery("(max-height: 700px)");

  const now = useAcademyNow();
  const todayIso = academyIsoDate();
  const nowIso = useMemo(() => academyNow().toISOString(), []);

  const desk = useTeacherDesk({
    teacherId: user?.teacherId ?? null,
    todayIso,
    nowMinutes: now,
    nowIso,
    actor,
  });

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const focusRow = useMemo(() => {
    const rows = desk.flow?.rows ?? [];
    return rows.find((row) => row.status === "live") ?? rows.find((row) => row.status === "next") ?? null;
  }, [desk.flow]);

  const focusClassId = focusRow ? (desk.sessionById.get(focusRow.session.id)?.classId ?? null) : null;
  const effectiveClassId = selectedClassId ?? focusClassId ?? desk.lessons[0]?.classId ?? null;
  const selectedLesson = desk.lessons.find((row) => row.classId === effectiveClassId) ?? null;

  const lessonContent = useTeacherLessonContent(effectiveClassId ? (selectedLesson?.levelId ?? null) : null);

  const hasSessionToday = useMemo(
    () => new Set((desk.day?.todaySessions ?? []).filter((row) => row.status !== "cancelled").map((row) => row.classId)),
    [desk.day],
  );

  const classTitle = (classId: string) => desk.classById.get(classId)?.title ?? NO_DATA;
  const describeSession = (sessionId: string) => {
    const session = desk.sessionById.get(sessionId);
    if (!session) return NO_DATA;
    const room = desk.roomNameById.get(session.roomId) ?? NO_DATA;
    return `${faTime(session.startTime)} تا ${faTime(session.endTime)} · ${room}`;
  };

  const registersKnown = desk.evidence.roster && desk.evidence.marks;
  const todayCount =
    desk.flow && !desk.loading ? desk.flow.summary.total - desk.flow.summary.cancelled : null;
  const tiles: HeroStat[] = [
    { label: "کلاس‌های امروز من", value: todayCount, target: { view: "schedule" } },
    { label: "هنرجویان امروز من", value: desk.day?.todayStudentCount ?? null, target: { view: "students" } },
    {
      label: "صورت‌جلسه‌های ثبت‌نشده",
      value: registersKnown ? (desk.day?.dueTotal ?? null) : null,
      target: { view: "attendance" },
    },
    { label: "پیام‌های خوانده‌نشده", value: desk.unreadTotal, target: { view: "messages" } },
  ];

  const mobileTiles: StatDef[] = tiles.map((tile) => ({
    label: tile.label,
    value: tile.value === null ? NO_DATA : faNum(tile.value),
    unit: tile.suffix,
    onClick: () => navigate(tile.target),
  }));

  const subline = desk.loading
    ? "در حال خواندن تقویم…"
    : desk.flow === null
      ? "تقویم شما خوانده نشد"
      : focusRow
        ? `${focusRow.session.title} · ${faTime(focusRow.session.start)} تا ${faTime(focusRow.session.end)} · ${focusRow.session.room}`
        : "کلاس بعدی‌ای در تقویم امروز نیست";

  if (!desk.resolved) {
    /* Fail closed: no linked teacher record ⇒ no roster, no day, no guesses. */
    return (
      <Surface ornate className="p-6">
        <SectionHeader title="کلاس بعدی شما" kicker={todayIso ? "امروز" : ""} />
        <EmptyState
          className="mt-2"
          title="حساب شما به پروندهٔ استاد متصل نیست"
          description="بدون اتصال حساب به پروندهٔ استاد، کلاس‌ها و هنرجویان شما قابل تشخیص نیستند؛ فهرست سراسری آموزشگاه هم اینجا نشان داده نمی‌شود. برای اتصال با مدیر آموزشگاه تماس بگیرید."
          action="برنامهٔ هفته"
          onAction={() => navigate({ view: "schedule" })}
        />
      </Surface>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:gap-5">
      {/* 1 · The plate: identity, date, the day's four teacher figures, the wave */}
      <div className="order-1 lg:order-none lg:col-span-12 flex flex-col gap-3">
        <Hero
          compact={!isDesktop || shortViewport}
          stats={tiles}
          pulse={desk.pulse}
          headline="کلاس بعدی شما"
          subline={subline}
        />
        {!isDesktop && <StatStrip stats={mobileTiles} />}
        {!shortViewport && <AcademyClockBar />}
      </div>

      {desk.error !== null && (
        <div className="order-2 lg:order-none lg:col-span-12">
          <ErrorState
            title="خواندن رکوردهای شما کامل نشد"
            description="هر بخش فقط وقتی عدد یا نام دارد که خواندنش موفق بوده باشد؛ بقیه «—» می‌ماند یا وضعیت خودش را می‌گوید. صفر، اندازه‌گیری نیست."
            onRetry={desk.reload}
          />
        </div>
      )}

      {/* 2 · The one focal point: the next (or current) class */}
      <div className="order-3 lg:order-none lg:col-span-12 xl:col-span-8">
        <NextClassPlate
          row={focusRow}
          classId={focusClassId}
          day={desk.day}
          nowMinutes={now}
          loading={desk.loading && desk.flow === null}
          unavailable={desk.flow === null && !desk.loading}
          onRetry={desk.reload}
          onOpenClass={(classId) => navigate({ view: "classes", id: classId })}
          onOpenSchedule={() => navigate({ view: "schedule" })}
          onOpenAttendance={(sessionId) => navigate({ view: "attendance", id: sessionId })}
        />
      </div>

      {/* 3 · Registers that are genuinely due — the day's one action */}
      <div className="order-5 lg:order-none lg:col-span-12 xl:col-span-4">
        <RegisterDuePanel
          day={desk.day}
          todayIso={todayIso}
          loading={desk.loading}
          marksEvidence={desk.evidence.marks}
          rosterEvidence={desk.evidence.roster}
          summary={desk.flow?.summary ?? null}
          writableSessionIds={desk.writableSessionIds}
          classTitle={classTitle}
          describeSession={describeSession}
          onOpenAttendance={(sessionId) => navigate({ view: "attendance", id: sessionId })}
          onOpenClass={(classId) => navigate({ view: "classes", id: classId })}
        />
      </div>

      {/* 4 · Today, in order */}
      <div className="order-4 lg:order-none lg:col-span-7">
        <TeacherDayTimeline
          flow={desk.flow}
          day={desk.day}
          now={now}
          loading={desk.loading && desk.flow === null}
          unavailable={desk.flow === null && !desk.loading}
          onRetry={desk.reload}
          onOpenSession={(sessionId) => navigate({ view: "schedule", id: sessionId })}
          onResolveConflict={() => navigate({ view: "schedule" })}
          onOpenSchedule={() => navigate({ view: "schedule" })}
          onOpenAttendance={(sessionId) => navigate({ view: "attendance", id: sessionId })}
          writableSessionIds={desk.writableSessionIds}
        />
      </div>

      {/* 5 · Teaching attention — educational evidence only */}
      <div className="order-6 lg:order-none lg:col-span-5">
        <TeacherAttentionList
          signals={desk.signals}
          loading={desk.loading}
          progressEvidence={desk.evidence.progress}
          onOpenStudent={(studentId) => navigate({ view: "students", id: studentId })}
        />
      </div>

      {/* 6 · My students */}
      <div className="order-7 lg:order-none lg:col-span-7">
        <MyStudentsRoster
          students={desk.students}
          loading={desk.studentsLoading}
          resolved={desk.resolved}
          onOpenStudent={(studentId) => navigate({ view: "students", id: studentId })}
          onOpenStudents={() => navigate({ view: "students" })}
        />
      </div>

      {/* 7 · What the next lesson is meant to teach */}
      <div className="order-8 lg:order-none lg:col-span-5">
        <LessonFocusPanel
          lessons={desk.lessons}
          selectedClassId={effectiveClassId}
          onSelectClass={setSelectedClassId}
          hasSessionToday={hasSessionToday}
        />
      </div>

      {/* 8 · The studio's working repertoire */}
      <div className="order-9 lg:order-none lg:col-span-7">
        <RepertoireBoard
          students={desk.students}
          onOpenStudent={(studentId) => navigate({ view: "students", id: studentId })}
        />
      </div>

      {/* 9 · Material for the focused rung — read-only */}
      <div className="order-10 lg:order-none lg:col-span-5">
        <ResourceShelf
          levelName={selectedLesson?.levelName ?? null}
          content={lessonContent.content}
          loading={lessonContent.loading}
          error={lessonContent.error !== null}
          complete={lessonContent.complete}
          libraryRows={desk.libraryRows}
          libraryTotal={desk.libraryTotal}
          onOpenLibrary={() => navigate({ view: "library" })}
        />
      </div>

      {/* 10 · Messages, and what this environment can honestly say about "since" */}
      <div className="order-11 lg:order-none lg:col-span-12">
        <Surface className="p-5">
          <SectionHeader
            title="پیام‌ها و تغییرها"
            kicker={
              desk.unreadTotal === null
                ? "شمار پیام‌های خوانده‌نشده در دسترس نیست"
                : desk.unreadTotal === 0
                  ? "پیام خوانده‌نشده‌ای نیست"
                  : `${faNum(desk.unreadTotal)} پیام خوانده‌نشده`
            }
            action="گشودن پیام‌ها"
            onAction={() => navigate({ view: "messages" })}
          />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs leading-relaxed text-ink-300">
                {desk.unreadTotal === null
                  ? "خواندن گفت‌وگوها کامل نشد، پس شمار دقیقی نمی‌گوییم."
                  : desk.unreadTotal === 0
                    ? "همهٔ گفت‌وگوهای شما خوانده شده‌اند."
                    : `${faNum(desk.unreadTotal)} پیام در گفت‌وگوهای شما خوانده نشده است.`}
              </p>
              <Button
                className="mt-3"
                variant="subtle"
                size="sm"
                onClick={() => navigate({ view: "messages" })}
              >
                گشودن پیام‌ها
              </Button>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs leading-relaxed text-ink-300">
                «از آخرین بازدید» هنوز ساخته نمی‌شود: این محیط رویدادهای آموزشگاه را در جایی ثبت نمی‌کند، پس فهرستی هم نمی‌توان
                از آن ساخت. وقتی سامانهٔ رویداد فعال شود، تغییرهای مؤثر روی کلاس‌ها و هنرجویان شما همین‌جا فهرست می‌شود.
              </p>
            </div>
          </div>
        </Surface>
      </div>

      <div className="order-12 lg:order-none lg:col-span-12">
        <DemoNote text="این میز کار فقط از رکوردهای همین محیط ساخته می‌شود: تقویم شما، ثبت‌نام‌های کلاس‌هایتان، مهرهای حضور و شواهد پیشرفت. جایی که خواندنی در دست نیست، به‌جای عدد، «—» یا وضعیت خودِ خواندن نشان داده می‌شود." />
      </div>
    </div>
  );
}
