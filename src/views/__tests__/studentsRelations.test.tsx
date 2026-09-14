// @vitest-environment jsdom
/**
 * The Students relations come from the repositories — proven behaviourally.
 *
 * WHY THIS FILE EXISTS, NEXT TO `relationsNoFixtures.test.ts`
 *
 * The gate reads the SHAPE of `views/Students.tsx`: it proves the fixture
 * collections, the fixture resolvers and the fabricated figures are gone. It
 * cannot prove the replacements are wired, because a view that renders nothing
 * at all also passes a shape check. This file is the other half — the profile is
 * rendered over real repositories, and every relation claim is asserted against
 * the rows those repositories return:
 *
 *   - the teacher's NAME follows a repository rename (a view resolving it from
 *     `@/data/records` would keep printing the fixture name), and an id that
 *     resolves to nothing prints «—» rather than a guess;
 *   - class membership follows Enrollment — including the writes that change it
 *     (`enroll` / `withdraw`) and the status it carries (a WAITLISTED student is
 *     not a member, which the class's denormalized projection cannot express);
 *   - the timetable is built from the session rows the scheduling repository
 *     returns, inside a stated window, scoped to the student's own classes;
 *   - the attendance panel draws the marks the register holds, and says so when
 *     it holds none, instead of drawing a series nothing measured;
 *   - the tuition is the enrollment's own pricing plan, never a literal.
 *
 * Everything runs against the REAL demo repositories (`resetToDemoEnvironment`)
 * unless a case is explicitly about what a repository returns — those install a
 * stub with `withStubs`, so every verb the case does not override stays real.
 * Nothing here writes to `@/data/*`: the demo dataset is data, and the point is
 * that the view reads it through the domain.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { addDays } from "@/domains/scheduling/dateBridge";
import { teacherById } from "@/data/records";
import type { Session } from "@/domains/scheduling/types";
import type { AttendanceRecord } from "@/domains/attendance/types";
import {
  getAttendanceRepository,
  getClassRepository,
  getEnrollmentRepository,
  getSchedulingRepository,
  getStudentRepository,
  getTeacherRepository,
  resetRegistry,
  setAttendanceRepository,
  setSchedulingRepository,
  setTeacherRepository,
} from "@/domains/registry";
import { academyIsoDate } from "@/views/relations/academyDay";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import { faTime, faToman } from "@/lib/format";
import { StudentsView } from "@/views/Students";

/**
 * Tab names, unanchored on purpose: a tab with a `count` renders the number
 * inside the button, so its accessible name is «برنامه ۳», not «برنامه». Each
 * pattern still matches exactly one tab.
 */
const TABS = {
  schedule: /برنامه/,
  attendance: /حضور/,
  finance: /مالی/,
} as const;

function renderRoute(hash: string) {
  window.location.hash = hash;
  return render(
    <AppProvider>
      <StudentsView />
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

/** Opens a detail tab and waits for whatever that panel reads. */
async function openTab(tab: RegExp) {
  fireEvent.click(await screen.findByRole("tab", { name: tab }));
  await settled();
}

/** A student the demo dataset leaves out of every class. */
async function unenrolledStudent() {
  const students = (await getStudentRepository().list({ per_page: 200 })).data;
  const enrolled = new Set(
    (await getEnrollmentRepository().list({ per_page: 500 })).data.map((row) => row.studentId),
  );
  const free = students.find((row) => !enrolled.has(row.id));
  expect(free, "the demo dataset must hold a student with no enrollment, for the empty state").toBeDefined();
  return free!;
}

/** A class with a free seat, so enrolling really seats the student. */
async function classWithRoom() {
  const klass = (await getClassRepository().list({ per_page: 200 })).data.find(
    (row) => row.enrolled < row.capacity,
  );
  expect(klass, "the demo dataset must hold a class with a free seat").toBeDefined();
  return klass!;
}

/** A full body of text, for assertions that span several elements. */
const bodyText = () => document.body.textContent ?? "";

function session(
  over: Partial<Session> & Pick<Session, "id" | "classId" | "date" | "startTime" | "endTime">,
): Session {
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

/** The attendance panel's bars: the only elements titled with a status. */
function markBars(): Element[] {
  return Array.from(document.querySelectorAll("[title]")).filter((element) =>
    /^(حاضر|غایب|تأخیر|موجه) — /.test(element.getAttribute("title") ?? ""),
  );
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
/* The teacher relation                                                */
/* ------------------------------------------------------------------ */
describe("the teacher relation", () => {
  it("follows a repository rename on the profile and in the roster", async () => {
    const student = (await getStudentRepository().list({ per_page: 200 })).data.find((row) => row.teacherId);
    expect(student?.teacherId, "the demo dataset must hold a student with a teacher").toBeTruthy();
    const teacherId = student!.teacherId!;
    const before = await getTeacherRepository().get(teacherId);

    renderRoute(`#/students/${student!.id}`);
    await settled();
    expect(bodyText()).toContain(`مدرس: ${before.name}`);

    // A real repository write. A view resolving the name from `@/data/records`
    // would keep printing the fixture name for the life of the build.
    const renamed = "بانو رهنما";
    await getTeacherRepository().update(teacherId, { name: renamed });
    expect((await getTeacherRepository().get(teacherId)).name).toBe(renamed);

    cleanup();
    renderRoute(`#/students/${student!.id}`);
    await settled();
    expect(bodyText()).toContain(`مدرس: ${renamed}`);
    expect(bodyText()).not.toContain(before.name);

    // The same read serves the roster: the cards name the same repository row.
    cleanup();
    renderRoute("#/students");
    await settled();
    expect(bodyText()).toContain(`مدرس: ${renamed}`);
    expect(bodyText()).not.toContain(before.name);
  });

  it("prints the repository's name, never the fixture resolver's — and «—» when nothing resolves", async () => {
    const student = (await getStudentRepository().list({ per_page: 200 })).data.find((row) => row.teacherId);
    const teacherId = student!.teacherId!;
    const real = await getTeacherRepository().get(teacherId);
    /*
      The fixture resolver's answer for the same id, imported HERE on purpose:
      this file is not a relation surface, and naming the fixture value is what
      makes the assertion sharp. The demo dataset seeds the repository from the
      same fixtures, so a rename alone would not distinguish the two sources —
      a name the fixture module has never contained does.
    */
    const fixtureName = teacherById(teacherId)?.name;
    expect(fixtureName, "the fixture must have a name for this teacher, for contrast").toBeTruthy();

    setTeacherRepository(
      withStubs(getTeacherRepository(), {
        list: async () => ({ data: [{ ...real, name: "بانو رهنما" }], meta: { page: 1, per_page: 200, total: 1 } }),
      }),
    );
    renderRoute(`#/students/${student!.id}`);
    await settled();
    expect(bodyText()).toContain("مدرس: بانو رهنما");
    expect(bodyText()).not.toContain(fixtureName!);

    // A read that resolves nothing prints the "no value" glyph, not a guess.
    cleanup();
    setTeacherRepository(
      withStubs(getTeacherRepository(), {
        list: async () => ({ data: [], meta: { page: 1, per_page: 200, total: 0 } }),
      }),
    );
    renderRoute(`#/students/${student!.id}`);
    await settled();
    expect(bodyText()).toContain("مدرس: —");
    expect(bodyText()).not.toContain(fixtureName!);
  });
});

/* ------------------------------------------------------------------ */
/* Class membership — the enrollment relation                          */
/* ------------------------------------------------------------------ */
describe("class membership", () => {
  it("adds the class on enroll, prices it from the enrollment, and drops it on withdraw", async () => {
    const student = await unenrolledStudent();
    const klass = await classWithRoom();

    // 1. No enrollment → no class claim anywhere, and no invented tuition.
    renderRoute(`#/students/${student.id}`);
    await settled();
    expect(bodyText()).toContain("کلاسی برنامه‌ریزی نشده");
    await openTab(TABS.schedule);
    expect(bodyText()).toContain("ثبت‌نام فعالی ثبت نشده");
    await openTab(TABS.finance);
    expect(bodyText()).toContain("ثبت‌نامی برای محاسبهٔ شهریه وجود ندارد");

    // 2. A real enroll write seats the student, and the profile follows it.
    const enrollment = await getEnrollmentRepository().enroll({ studentId: student.id, classId: klass.id });
    expect(enrollment.status).toBe("active");

    cleanup();
    renderRoute(`#/students/${student.id}`);
    await settled();
    await openTab(TABS.schedule);
    expect(bodyText()).toContain(klass.title);
    expect(bodyText()).not.toContain("ثبت‌نام فعالی ثبت نشده");

    // The tuition card is the enrollment's own plan: the same amount the
    // repository wrote, in place of the literal that used to be charged to
    // every profile regardless of what it was enrolled in.
    await openTab(TABS.finance);
    expect(bodyText()).toContain(faToman(enrollment.pricingPlan.amount, true));
    expect(bodyText()).not.toContain("ثبت‌نامی برای محاسبهٔ شهریه وجود ندارد");

    // 3. Withdrawing releases the seat, and the profile stops claiming the class.
    await getEnrollmentRepository().withdraw(enrollment.id);
    expect((await getEnrollmentRepository().get(enrollment.id)).status).toBe("cancelled");

    cleanup();
    renderRoute(`#/students/${student.id}`);
    await settled();
    await openTab(TABS.schedule);
    expect(bodyText()).toContain("ثبت‌نام فعالی ثبت نشده");
    expect(bodyText()).not.toContain(klass.title);
    await openTab(TABS.finance);
    expect(bodyText()).toContain("ثبت‌نامی برای محاسبهٔ شهریه وجود ندارد");
  });

  it("reads the enrollment's own status: a waitlisted student is not a member", async () => {
    const student = await unenrolledStudent();
    const full = (await getClassRepository().list({ per_page: 200 })).data.find(
      (row) => row.enrolled >= row.capacity,
    );
    expect(full, "the demo dataset must hold a full class").toBeDefined();

    const enrollment = await getEnrollmentRepository().enroll({
      studentId: student.id,
      classId: full!.id,
      status: "waitlist",
    });
    expect(enrollment.status).toBe("waitlist");

    renderRoute(`#/students/${student.id}`);
    await settled();
    // Waiting for a seat is not holding one: no class is claimed, and the
    // relation the student does have is named for what it is.
    expect(bodyText()).toContain("کلاسی برنامه‌ریزی نشده");
    await openTab(TABS.schedule);
    expect(bodyText()).toContain(full!.title);
    expect(bodyText()).toContain("لیست انتظار");
    expect(bodyText()).toContain("جا نگرفته است");
    expect(bodyText()).not.toContain("ثبت‌نام فعالی ثبت نشده");
  });
});

/* ------------------------------------------------------------------ */
/* The timetable — the scheduling relation                             */
/* ------------------------------------------------------------------ */
describe("the timetable", () => {
  it("renders the repository's sessions, in a stated window, scoped to the student's classes", async () => {
    const student = await unenrolledStudent();
    const classes = (await getClassRepository().list({ per_page: 200 })).data;
    const mine = await classWithRoom();
    const other = classes.find((row) => row.id !== mine.id)!;
    await getEnrollmentRepository().enroll({ studentId: student.id, classId: mine.id });

    const today = academyIsoDate();
    const tomorrow = addDays(today, 1) ?? today;
    /*
      Times that exist in NO fixture template: 13:15 is not a slot any class
      holds, 19:45 belongs to a class this student is not enrolled in, and 21:05
      is outside the week the panel draws. A panel built from `weekSessions`
      would render the template's own times for the template's own week instead,
      so none of these three assertions could hold against it.
    */
    const probe = session({ id: "ses_probe_mine", classId: mine.id, date: tomorrow, startTime: "13:15", endTime: "14:15", teacherId: mine.teacherId, roomId: mine.roomId });
    const alien = session({ id: "ses_probe_alien", classId: other.id, date: tomorrow, startTime: "19:45", endTime: "20:45", teacherId: other.teacherId, roomId: other.roomId });
    const beyondTheWeek = session({ id: "ses_probe_far", classId: mine.id, date: addDays(today, 20) ?? today, startTime: "21:05", endTime: "22:05", teacherId: mine.teacherId, roomId: mine.roomId });

    const reads: (Record<string, unknown> | undefined)[] = [];
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async (params) => {
          reads.push(params as Record<string, unknown> | undefined);
          return { data: [probe, alien, beyondTheWeek], meta: { page: 1, per_page: 200, total: 3 } };
        },
      }),
    );

    renderRoute(`#/students/${student.id}`);
    await settled();
    await openTab(TABS.schedule);

    // The repository's own session is on screen — with the class it belongs to,
    // and the per-occurrence start and end times the row carries.
    expect(bodyText()).toContain(mine.title);
    expect(bodyText()).toContain(faTime(probe.startTime));
    expect(bodyText()).toContain(faTime(probe.endTime));

    // The enrollment scope is real: another class's session is not this student's.
    expect(bodyText()).not.toContain(faTime(alien.startTime));

    // The weekly panel is a WEEK; the window the read was given is 28 days, so a
    // session outside the week is not drawn in it even though it was returned.
    expect(bodyText()).not.toContain(faTime(beyondTheWeek.startTime));

    // The read itself: windowed and bounded, per `SessionListParams`.
    const window = reads[0] ?? {};
    expect(window.from).toBe(today);
    expect(window.to).toBe(addDays(today, 27));
    expect(window.per_page).toBe(200);
  });

  it("shows an empty week as an empty week, not as a template", async () => {
    const student = (await getStudentRepository().list({ per_page: 200 })).data[0];
    const reads: (Record<string, unknown> | undefined)[] = [];
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async (params) => {
          reads.push(params as Record<string, unknown> | undefined);
          return { data: [], meta: { page: 1, per_page: 200, total: 0 } };
        },
      }),
    );

    renderRoute(`#/students/${student.id}`);
    await settled();
    await openTab(TABS.schedule);

    expect(bodyText()).toContain("جلسه‌ای در این هفته ثبت نشده");

    const today = academyIsoDate();
    const window = reads[0] ?? {};
    expect(window.from).toBe(today);
    expect(window.to).toBe(addDays(today, 27));
    expect(window.per_page).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/* The attendance trail                                                */
/* ------------------------------------------------------------------ */
describe("the attendance trail", () => {
  it("draws the marks the register holds, and says so when it holds none", async () => {
    const student = (await getStudentRepository().list({ per_page: 200 })).data[0];

    // Demo: the register has written nothing yet — it writes on a mark.
    renderRoute(`#/students/${student.id}`);
    await settled();
    await openTab(TABS.attendance);
    expect(bodyText()).toContain("رکورد حضوری ثبت نشده");
    // The fabricated twelve-column series and its caption are gone.
    expect(bodyText()).not.toContain("۱۲ جلسهٔ اخیر");
    expect(markBars()).toHaveLength(0);

    /*
      A repository with marks: every column is one of its rows, and the panel
      says how much of the trail it is showing rather than passing a page off as
      the whole trail. `total: 7` is what makes that claim checkable.
    */
    const marks: AttendanceRecord[] = [
      { id: "att_1", sessionId: "ses_a", studentId: student.id, status: "present", recordedAt: "2026-09-10T09:00:00.000Z", recordedByUserId: "usr_admin", updatedAt: "2026-09-10T09:00:00.000Z" },
      { id: "att_2", sessionId: "ses_b", studentId: student.id, status: "absent", recordedAt: "2026-09-08T09:00:00.000Z", recordedByUserId: "usr_admin", updatedAt: "2026-09-08T09:00:00.000Z" },
    ];
    setAttendanceRepository(
      withStubs(getAttendanceRepository(), {
        list: async () => ({ data: marks, meta: { page: 1, per_page: 12, total: 7 } }),
      }),
    );

    cleanup();
    renderRoute(`#/students/${student.id}`);
    await settled();
    await openTab(TABS.attendance);

    expect(markBars()).toHaveLength(marks.length);
    expect(bodyText()).toContain("۲ رکورد از ۷");
    // The legend names only the statuses on screen: no mark here is late.
    expect(bodyText()).toContain("حاضر");
    expect(bodyText()).toContain("غایب");
    expect(bodyText()).not.toContain("تأخیر");
    expect(bodyText()).not.toContain("۱۲ جلسهٔ اخیر");
  });
});
