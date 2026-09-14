// @vitest-environment jsdom
/**
 * The Teachers relations come from the repositories — proven behaviourally.
 *
 * WHY THIS FILE EXISTS, NEXT TO `relationsNoFixtures.test.ts`
 *
 * The gate reads the SHAPE of `views/Teachers.tsx`: it proves the fixture
 * collections, the fixture resolvers, the fabricated figures and the unbounded
 * reads are gone. It cannot prove the replacements are wired, because a view
 * that renders nothing at all also passes a shape check. This file is the other
 * half — the workspace is rendered over real repositories, and every relation
 * claim is asserted against the rows those repositories return:
 *
 *   - the teacher's NAME follows a repository rename (a view resolving it from
 *     `@/data/records` would keep printing the fixture name);
 *   - the members of a teacher are ENROLLMENT rows: st11 is enrolled in t1's
 *     piano class while `Student.teacherId` says t8, so the fixture relation and
 *     the enrollment relation genuinely disagree, and the enrollment answer is
 *     the one asserted — including the count, which the teacher record's stored
 *     `students: 32` field cannot produce;
 *   - a teacher SWITCH cannot show the previous teacher's students or count,
 *     even while the new teacher's reads are still in flight — the call-site key
 *     guard CP3 added around the un-keyed `useStudentList`;
 *   - today's classes and the weekly grid are the session rows the scheduling
 *     repository returns inside a stated window, filtered to the selected
 *     teacher (a foreign teacher's row and a row outside the week are dropped);
 *   - the waitlist is enrollment rows with status `waitlist`, so a real write
 *     moves the number and a class's own projection cannot;
 *   - the day's load is a session count, and the trend delta and substitution
 *     claim that nothing measured are gone;
 *   - a class or a room outside the read prints «—», never a guess, and empty,
 *     unavailable and partial relations stay three different things.
 *
 * Everything runs against the REAL demo repositories (`resetToDemoEnvironment`)
 * unless a case is explicitly about what a repository returns — those install a
 * stub with `withStubs`, so every verb the case does not override stays real.
 * Nothing here writes to `@/data/*`: the demo dataset is data, and the point is
 * that the view reads it through the domain.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { students as fixtureStudents, teachers as fixtureTeachers } from "@/data/records";
import { addDays } from "@/domains/scheduling/dateBridge";
import type { Session } from "@/domains/scheduling/types";
import {
  getClassRepository,
  getEnrollmentRepository,
  getRoomRepository,
  getSchedulingRepository,
  getStudentRepository,
  getTeacherRepository,
  resetRegistry,
  setClassRepository,
  setEnrollmentRepository,
  setSchedulingRepository,
  setStudentRepository,
  setTeacherRepository,
} from "@/domains/registry";
import type { Student } from "@/domains/students";
import { academyIsoDate, academyWeekdayIndex } from "@/views/relations/academyDay";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import { faNum, faTime } from "@/lib/format";
import { TeachersView } from "@/views/Teachers";

/**
 * Tab names, unanchored on purpose: a tab with a `count` renders the number
 * inside the button, so its accessible name is «هنرجویان ۵», not «هنرجویان».
 * Each pattern still matches exactly one tab.
 */
const TABS = {
  week: /برنامهٔ هفته/,
  students: /هنرجویان/,
  load: /بار کاری/,
} as const;

function renderRoute(hash: string) {
  window.location.hash = hash;
  return render(
    <AppProvider>
      <TeachersView />
    </AppProvider>,
  );
}

/**
 * The design system's in-flight marker, queried by ROLE only (the signal
 * `emptyEnvironment.test.tsx` waits on). `useResourceList` starts `loading` in
 * its initial state, so the marker is on screen from the first render and its
 * disappearance means every read the screen made has settled.
 */
const inFlight = () => screen.queryAllByRole("status");

async function settled() {
  await waitFor(() => expect(inFlight()).toHaveLength(0));
}

/**
 * The students tab, whose COUNT is part of its accessible name — the design
 * system renders the number inside the button, so it reads «هنرجویان۵» with no
 * space between the label and the number.
 */
const studentsTab = (count: number) => new RegExp(`^هنرجویان\\s*${faNum(count)}$`);

/** Opens a detail tab and waits for whatever that panel reads. */
async function openTab(tab: RegExp) {
  fireEvent.click(await screen.findByRole("tab", { name: tab }));
  await settled();
}

/**
 * Persian text joins words with a zero-width non-joiner («رابطه‌ها»), and a
 * literal that differs by that one invisible character is a test that fails for
 * a reason nobody can see. Every text assertion goes through these helpers, which
 * read the half-space as the space it reads as.
 */
const flat = (text: string) => text.replace(/\u200c/g, " ");
const shown = () => flat(document.body.textContent ?? "");

function has(text: string) {
  expect(shown()).toContain(flat(text));
}

function hasNot(text: string) {
  expect(shown()).not.toContain(flat(text));
}

function session(over: Partial<Session> & Pick<Session, "id" | "classId" | "date" | "startTime" | "endTime">): Session {
  return {
    teacherId: "t1",
    roomId: "r1",
    status: "scheduled",
    origin: "generated",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

/** The demo's own answer to "who holds a seat with this teacher" — enrollments. */
async function membersOf(teacherId: string) {
  const classIds = new Set(
    (await getClassRepository().list({ teacherId, per_page: 200 })).data.map((row) => row.id),
  );
  const enrollments = (await getEnrollmentRepository().list({ per_page: 500 })).data;
  const ids = [
    ...new Set(
      enrollments
        .filter((row) => row.status === "active" && classIds.has(row.classId))
        .map((row) => row.studentId),
    ),
  ];
  const students = (await getStudentRepository().list({ per_page: 200 })).data;
  return ids
    .map((id) => students.find((row) => row.id === id))
    .filter((row): row is Student => row !== undefined);
}

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

/* ------------------------------------------------------------------ */
/* The teacher's own row                                               */
/* ------------------------------------------------------------------ */
describe("the teacher's own row", () => {
  it("follows a repository rename in the workspace and on the roster", async () => {
    const before = await getTeacherRepository().get("t1");
    const fixtureName = fixtureTeachers.find((t) => t.id === "t1")!.name;

    renderRoute("#/teachers/t1");
    await settled();
    has(before.name);

    // A real repository write. A view resolving the name from `@/data/records`
    // would keep printing the fixture name for the life of the build.
    const renamed = "بانو رهنما";
    await getTeacherRepository().update("t1", { name: renamed });
    expect((await getTeacherRepository().get("t1")).name).toBe(renamed);

    cleanup();
    renderRoute("#/teachers/t1");
    await settled();
    has(renamed);
    hasNot(fixtureName);

    // The same read serves the roster: the card names the same repository row.
    cleanup();
    renderRoute("#/teachers");
    await settled();
    has(renamed);
    hasNot(fixtureName);
  });
});

/* ------------------------------------------------------------------ */
/* The students-of-a-teacher relation — enrollment, not a projection   */
/* ------------------------------------------------------------------ */
describe("the teacher's students", () => {
  it("lists the students the enrollments own, with a count the record cannot fake", async () => {
    const expected = await membersOf("t1");
    expect(expected.length, "the demo dataset must give t1 enrolled students").toBeGreaterThan(0);

    /*
      The fixture answers the same question with a denormalized field and gets a
      different ANSWER: st11 is enrolled in t1's piano class while its `teacherId`
      says t8. Enrollment is the canonical Student↔Class link (§9), so the member
      the fixture relation cannot see is the one that proves which read ran.
    */
    const viaFixtureField = fixtureStudents.filter((s) => s.teacherId === "t1");
    const seenOnlyByEnrollment = expected.filter(
      (student) => !viaFixtureField.some((row) => row.id === student.id),
    );
    expect(seenOnlyByEnrollment.length, "the two relations must genuinely differ").toBeGreaterThan(0);

    renderRoute("#/teachers/t1");
    await settled();
    await openTab(TABS.students);

    for (const student of expected) has(student.name);

    // The class titles come from the class repository, not from `classById`.
    const classTitles = (await getClassRepository().list({ teacherId: "t1", per_page: 200 })).data.map((c) => c.title);
    for (const title of classTitles) has(title);

    // The count is the enrollment relation's; the denormalized field would give a
    // different number, and the record's stored `students` (32 — a figure nothing
    // in this build measured) is not on screen at all.
    expect(screen.getByRole("tab", { name: studentsTab(expected.length) })).toBeTruthy();
    expect(
      screen.queryByRole("tab", { name: studentsTab(viaFixtureField.length) }),
      "the denormalized field must give a different count, for contrast",
    ).toBeNull();
    const stored = fixtureTeachers.find((t) => t.id === "t1")!.students;
    expect(stored).not.toBe(expected.length);
    hasNot(`${faNum(stored)} نفر`);
  });

  it("cannot show the previous teacher's students or count while a switch is in flight", async () => {
    const t1Members = await membersOf("t1");
    const t6Members = await membersOf("t6");
    expect(t1Members.length).toBeGreaterThan(0);
    expect(t6Members.length).toBeGreaterThan(0);
    // The two rosters must not overlap, or this test could not tell them apart.
    expect(t6Members.some((row) => t1Members.some((own) => own.id === row.id))).toBe(false);

    /*
      The switch is held open at the read whose key changes with the selected
      teacher: a class list that answers for t6 only when the test releases it.
      Everything else the detail reads has already resolved, so the frame the
      assertions inspect is exactly the one the call-site guard exists for.
    */
    let gateOpen = false;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realClasses = getClassRepository();
    setClassRepository(
      withStubs(realClasses, {
        list: async (params, signal) => {
          if (gateOpen && params?.teacherId === "t6") await gate;
          return realClasses.list(params, signal);
        },
      }),
    );

    renderRoute("#/teachers/t1");
    await settled();
    await openTab(TABS.students);
    has(t1Members[0].name);
    expect(screen.getByRole("tab", { name: studentsTab(t1Members.length) })).toBeTruthy();

    // Walk the real route: back to the roster through the breadcrumb, then into
    // the other teacher's workspace.
    fireEvent.click(screen.getByRole("button", { name: /^مدرسین$/ }));
    await settled();
    gateOpen = true;
    fireEvent.click(screen.getByRole("button", { name: /کاوه کاظمی/ }));

    // t6's workspace is on screen — and it carries NONE of t1's rows or numbers:
    // no tab counts at all, because the page states it is still loading.
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    for (const student of t1Members) hasNot(student.name);
    hasNot(`هنرجویان${faNum(t1Members.length)}`);

    release();
    await settled();
    await openTab(TABS.students);
    for (const student of t6Members) has(student.name);
    for (const student of t1Members) hasNot(student.name);
    expect(screen.getByRole("tab", { name: studentsTab(t6Members.length) })).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* Today and the week — the scheduling relation                        */
/* ------------------------------------------------------------------ */
describe("the schedule", () => {
  it("draws today and the week from the session repository, inside a stated window", async () => {
    const today = academyIsoDate();
    const todayIndex = academyWeekdayIndex();
    const weekStart = addDays(today, -todayIndex)!;
    const weekEnd = addDays(weekStart, 6)!;
    const otherDay = addDays(weekStart, (todayIndex + 3) % 7)!;
    const mine = (await getClassRepository().list({ teacherId: "t1", per_page: 200 })).data[0];
    const alienClass = (await getClassRepository().list({ teacherId: "t2", per_page: 200 })).data[0];

    /*
      Times that exist in NO fixture template: 13:15 and 08:05 are not slots any
      class holds, 19:45 belongs to another teacher, and 21:05 is outside the week
      the panel draws. A grid built from `weekSessions` would render the
      template's own times instead, so none of these assertions could hold.
    */
    const probe = session({ id: "ses_probe_today", classId: mine.id, teacherId: "t1", roomId: mine.roomId, date: today, startTime: "13:15", endTime: "14:15" });
    const inWeek = session({ id: "ses_probe_week", classId: mine.id, teacherId: "t1", roomId: mine.roomId, date: otherDay, startTime: "08:05", endTime: "09:05" });
    const alien = session({ id: "ses_probe_alien", classId: alienClass.id, teacherId: alienClass.teacherId, roomId: alienClass.roomId, date: today, startTime: "19:45", endTime: "20:45" });
    const beyondTheWeek = session({ id: "ses_probe_far", classId: mine.id, teacherId: "t1", roomId: mine.roomId, date: addDays(today, 20)!, startTime: "21:05", endTime: "22:05" });

    const reads: (Record<string, unknown> | undefined)[] = [];
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async (params) => {
          reads.push(params as Record<string, unknown> | undefined);
          return { data: [probe, inWeek, alien, beyondTheWeek], meta: { page: 1, per_page: 200, total: 4 } };
        },
      }),
    );

    renderRoute("#/teachers/t1");
    await settled();

    // Today: the repository's own occurrence, with the time it carries, and the
    // class title and room name resolved from the class and room repositories —
    // `classById` and `s.roomId.replace("r", "اتاق ")` used to answer these.
    has(faTime(probe.startTime));
    has(mine.title);
    const room = (await getRoomRepository().list({ per_page: 200 })).data.find((row) => row.id === mine.roomId)!;
    has(room.name);

    // Scope: another teacher's occurrence is not this teacher's class.
    hasNot(faTime(alien.startTime));

    await openTab(TABS.week);
    has(faTime(inWeek.startTime));
    // The week is a WEEK: a row outside the window is not drawn in it, even
    // though the read returned it.
    hasNot(faTime(beyondTheWeek.startTime));

    // The read itself: a windowed, bounded, teacher-scoped session read.
    const read = reads[0] ?? {};
    expect(read.teacherId).toBe("t1");
    expect(read.from).toBe(weekStart);
    expect(read.to).toBe(weekEnd);
    expect(read.per_page).toBe(200);
  });

  it("keeps a row outside today out of today, and inside the week in the week", async () => {
    const today = academyIsoDate();
    const tomorrow = addDays(today, 1)!;
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async () => ({
          data: [
            session({ id: "ses_probe_here", classId: "cl1", teacherId: "t1", roomId: "r1", date: today, startTime: "13:15", endTime: "14:15" }),
            session({ id: "ses_probe_next", classId: "cl1", teacherId: "t1", roomId: "r1", date: tomorrow, startTime: "16:25", endTime: "17:25" }),
          ],
          meta: { page: 1, per_page: 200, total: 2 },
        }),
      }),
    );

    renderRoute("#/teachers/t1");
    await settled();
    has(faTime("13:15"));
    hasNot(faTime("16:25"));

    await openTab(TABS.week);
    has(faTime("16:25"));
    const total = faNum(2);
    has(`مجموع ${total} جلسه در هفتهٔ جاری`);
  });
});

/* ------------------------------------------------------------------ */
/* The waitlist — enrollment rows, not a class projection              */
/* ------------------------------------------------------------------ */
describe("the waitlist", () => {
  it("counts enrollment rows, so a real queue moves it and a projection cannot", async () => {
    const realClasses = getClassRepository();
    // A class row whose own `waitlist` projection lies about its queue. Nothing
    // in the view may read it.
    setClassRepository(
      withStubs(realClasses, {
        list: async (params, signal) => {
          const page = await realClasses.list(params, signal);
          return {
            ...page,
            data: page.data.map((row) => (row.id === "cl10" ? { ...row, waitlist: 9 } : row)),
          };
        },
      }),
    );

    renderRoute("#/teachers");
    await settled();
    has(`${faNum(0)} نفر در انتظار`);
    hasNot(`${faNum(9)} نفر در انتظار`);

    // A real write — st14 holds no seat anywhere — and the number moves with it.
    const created = await getEnrollmentRepository().enroll({ studentId: "st14", classId: "cl10", status: "waitlist" });
    expect(created.status).toBe("waitlist");

    cleanup();
    renderRoute("#/teachers");
    await settled();
    has(`${faNum(1)} نفر در انتظار`);
    hasNot(`${faNum(9)} نفر در انتظار`);

    // The teacher's own workspace makes the same claim from the same rows — and
    // a queued student is NOT a member: waiting for a seat is not holding one.
    cleanup();
    renderRoute("#/teachers/t6");
    await settled();
    await openTab(TABS.load);
    has(`${faNum(1)} نفر در لیست انتظار`);
    await openTab(TABS.students);
    hasNot("فرزاد بهرامی");

    // Released: the queue is empty again.
    await getEnrollmentRepository().withdraw(created.id);
    cleanup();
    renderRoute("#/teachers");
    await settled();
    hasNot(`${faNum(1)} نفر در انتظار`);
  });
});

/* ------------------------------------------------------------------ */
/* The day's load — repository counts, no invented figures             */
/* ------------------------------------------------------------------ */
describe("the day's load", () => {
  it("counts today's and tomorrow's session rows, and claims nothing it did not measure", async () => {
    const today = academyIsoDate();
    const tomorrow = addDays(today, 1)!;
    const absent = fixtureTeachers.find((t) => t.status === "absent-tomorrow")!;
    const reads: (Record<string, unknown> | undefined)[] = [];

    const rows = [
      session({ id: "ses_load_today", classId: "cl1", teacherId: "t1", roomId: "r1", date: today, startTime: "09:05", endTime: "10:05" }),
      session({ id: "ses_load_tomorrow", classId: "cl3", teacherId: absent.id, roomId: "r2", date: tomorrow, startTime: "08:00", endTime: "09:00" }),
    ];
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async (params) => {
          reads.push(params as Record<string, unknown> | undefined);
          return { data: rows, meta: { page: 1, per_page: 200, total: rows.length } };
        },
      }),
    );

    renderRoute("#/teachers");
    await settled();

    // One teacher teaches today; the fixture's stored `todayClasses` field claims
    // six, because it counts a field instead of the day's rows.
    has(`${faNum(1)} نفر امروز کلاس دارند`);
    hasNot(`${faNum(6)} نفر امروز کلاس دارند`);

    // One of tomorrow's occurrences has a teacher on record as absent, and the
    // claim says exactly that — the invented substitution workload is gone.
    has(`${faNum(1)} جلسهٔ فردا با مدرس غایب`);
    hasNot("نیازمند جایگزین");

    // No trend delta: `delta: 11` asserted a change in average utilisation that
    // nothing in this build measured.
    hasNot("+۱۱٪");

    // The roster's own read is bounded to the two days it speaks about.
    const read = reads[0] ?? {};
    expect(read.from).toBe(today);
    expect(read.to).toBe(tomorrow);
    expect(read.per_page).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/* Honest degradation: misses, empties, failures, partial pages        */
/* ------------------------------------------------------------------ */
describe("honest relations", () => {
  it("prints «—» for a class and a room outside the read, instead of inventing one", async () => {
    const today = academyIsoDate();
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async () => ({
          data: [
            session({
              id: "ses_probe_orphan",
              classId: "cl_unknown",
              teacherId: "t1",
              roomId: "r_unknown",
              date: today,
              startTime: "13:15",
              endTime: "14:15",
            }),
          ],
          meta: { page: 1, per_page: 200, total: 1 },
        }),
      }),
    );

    renderRoute("#/teachers/t1");
    await settled();

    has(faTime("13:15"));
    // Resolution misses are «—»: the fixture resolvers used to answer both of
    // these questions with a name of their own.
    has("— · ۰ هنرجو");
    hasNot("cl_unknown");
    hasNot("r_unknown");
    hasNot("اتاق _unknown");
  });

  it("keeps an empty relation, an unresolvable one and a partial page apart", async () => {
    // 1. A teacher with no classes at all: an honest ۰, not a withheld «—».
    renderRoute("#/teachers/t7");
    await settled();
    has("امروز کلاسی ندارد");
    await openTab(TABS.students);
    has("هنرجویی تخصیص نیافته");
    expect(screen.getByRole("tab", { name: studentsTab(0) })).toBeTruthy();

    // 2. Members the students read does not return: the panel says the roster
    //    could not be read instead of claiming the teacher has no students.
    cleanup();
    const members = await membersOf("t1");
    setStudentRepository(
      withStubs(getStudentRepository(), {
        list: async () => ({ data: [], meta: { page: 1, per_page: 200, total: 0 } }),
      }),
    );
    renderRoute("#/teachers/t1");
    await settled();
    await openTab(TABS.students);
    hasNot("هنرجویی تخصیص نیافته");
    has("فهرست هنرجویان این مدرس خوانده نشد");
    has(`${faNum(members.length)} هنرجو در خواندن هنرجویان یافت نشد`);

    // 3. A partial page: the panel states how much of the relation it is showing,
    //    and withholds the counts it cannot stand behind.
    cleanup();
    const realEnrollments = getEnrollmentRepository();
    const first = (await realEnrollments.list({ per_page: 200 })).data.find((row) => row.classId === "cl1")!;
    setEnrollmentRepository(
      withStubs(realEnrollments, {
        list: async () => ({ data: [first], meta: { page: 1, per_page: 200, total: 500 } }),
      }),
    );
    renderRoute("#/teachers/t1");
    await settled();
    has("خواندن کامل نبود");
    expect(screen.getByRole("tab", { name: /^هنرجویان$/ })).toBeTruthy();
    await openTab(TABS.students);
    has(`ثبت‌نام‌ها: ${faNum(1)} ردیف از ${faNum(500)}`);
  });

  it("fails a relation with a retry instead of rendering it as empty", async () => {
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async () => {
          throw new ApiError({ kind: "network", code: "SCHEDULE_UNAVAILABLE", message: "برنامهٔ آموزشگاه در دسترس نیست." });
        },
      }),
    );

    renderRoute("#/teachers/t1");
    await settled();
    has("خواندن رابطه‌های این مدرس ناموفق بود");
    has("برنامهٔ آموزشگاه در دسترس نیست.");
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeTruthy();
    // An unavailable relation is not an empty one.
    hasNot("امروز کلاسی ندارد");

    // The roster's own relation failure names the read that failed, too.
    cleanup();
    renderRoute("#/teachers");
    await settled();
    has("خواندن برنامه‌ها و رابطه‌های مدرسین ناموفق بود");
    hasNot("مدرسی پیدا نشد");
  });

  it("fails the roster when the teachers themselves cannot be read", async () => {
    setTeacherRepository(
      withStubs(getTeacherRepository(), {
        list: async () => {
          throw new ApiError({ kind: "server", code: "TEACHERS_UNAVAILABLE", message: "فهرست مدرسین خوانده نشد." });
        },
      }),
    );

    renderRoute("#/teachers");
    await settled();
    has("بارگذاری مدرسین ناموفق بود");
    has("فهرست مدرسین خوانده نشد.");
  });
});
