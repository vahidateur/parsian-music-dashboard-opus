// @vitest-environment jsdom
/**
 * The Classes relations come from the repositories — proven behaviourally.
 *
 * WHY THIS FILE EXISTS, NEXT TO `relationsNoFixtures.test.ts`
 *
 * The gate reads the SHAPE of `views/Classes.tsx`: it proves the fixture
 * collections, the resolvers, the fabricated deltas and the unbounded reads are
 * gone. It cannot prove the replacements are wired, because a view that renders
 * nothing at all also passes a shape check. This file is the other half — the
 * roster and the workspace are rendered over real repositories, and every
 * relation claim is asserted against the rows those repositories return:
 *
 *   - the instructor and the studio follow a repository rename, in the list card
 *     and in the workspace header (a view resolving them from `@/data/records`
 *     would keep printing the fixture names for the life of the build);
 *   - the ROSTER is Enrollment — the canonical Student↔Class link — and the seat
 *     count, the capacity meter and the waitlist are the same relation's answer,
 *     so a real `enroll` / `withdraw` moves them and a class row's denormalized
 *     `studentIds` / `enrolled` / `waitlist` projection cannot;
 *   - a WAITLISTED student is not a seat holder: queued is not seated;
 *   - the weekly panel is the session rows the scheduling repository returns
 *     inside a stated window for this class (another class's row and a row
 *     outside the week are dropped);
 *   - the rooms panel is the room repository, not the fixture array;
 *   - the trend deltas that nothing measured are gone, and a class or a room
 *     outside the read prints «—» rather than a guess;
 *   - empty, unavailable and partial relations stay three different things.
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
import { addDays, weekdayIndex } from "@/domains/scheduling/dateBridge";
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
  setRoomRepository,
  setSchedulingRepository,
  setStudentRepository,
  setTeacherRepository,
} from "@/domains/registry";
import type { Student } from "@/domains/students";
import { academyIsoDate, academyWeekdayIndex } from "@/views/relations/academyDay";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import { faNum, faTime, NO_DATA } from "@/lib/format";
import { ClassesView } from "@/views/Classes";

function renderRoute(hash: string) {
  window.location.hash = hash;
  return render(
    <AppProvider>
      <ClassesView />
    </AppProvider>,
  );
}

/** The design system's in-flight marker, queried by ROLE only. */
const inFlight = () => screen.queryAllByRole("status");

async function settled() {
  await waitFor(() => expect(inFlight()).toHaveLength(0));
}

/**
 * Persian text joins words with a zero-width non-joiner, and a literal that
 * differs by that one invisible character is a test that fails for a reason
 * nobody can see. Assertions go through these helpers.
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

/** The demo's own answer to "who holds a seat in this class" — enrollments. */
async function membersOf(classId: string) {
  const enrollments = (await getEnrollmentRepository().list({ classId, per_page: 200 })).data;
  const ids = enrollments.filter((row) => row.status === "active").map((row) => row.studentId);
  const students = (await getStudentRepository().list({ per_page: 200 })).data;
  return ids
    .map((id) => students.find((row) => row.id === id))
    .filter((row): row is Student => row !== undefined);
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
/* Instructor and studio — repository rows, followed across a rename   */
/* ------------------------------------------------------------------ */
describe("the class's own relations", () => {
  it("follows a repository rename of the instructor and the studio", async () => {
    const beforeTeacher = (await getTeacherRepository().get("t1")).name;
    const beforeRoom = (await getRoomRepository().get("r1")).name;

    renderRoute("#/classes/cl1");
    await settled();
    has(`مدرس: ${beforeTeacher}`);
    has(beforeRoom);

    const teacherName = "بانو رهنما";
    const roomName = "استودیو آ";
    await getTeacherRepository().update("t1", { name: teacherName });
    await getRoomRepository().update("r1", { name: roomName });

    cleanup();
    renderRoute("#/classes/cl1");
    await settled();
    has(`مدرس: ${teacherName}`);
    has(roomName);
    hasNot(`مدرس: ${beforeTeacher}`);
    hasNot(beforeRoom);

    // The same two reads serve the list: the card names the same rows, and the
    // rooms panel is the same room repository rather than the fixture array.
    cleanup();
    renderRoute("#/classes");
    await settled();
    has(teacherName);
    has(roomName);
    hasNot(beforeTeacher);
    hasNot(beforeRoom);
  });

  it("prints «—» for an instructor or a room outside the read", async () => {
    setTeacherRepository(
      withStubs(getTeacherRepository(), { list: async () => ({ data: [], meta: { page: 1, per_page: 200, total: 0 } }) }),
    );
    setRoomRepository(
      withStubs(getRoomRepository(), { list: async () => ({ data: [], meta: { page: 1, per_page: 200, total: 0 } }) }),
    );

    renderRoute("#/classes/cl1");
    await settled();
    has(`مدرس: ${NO_DATA}`);
    // The studio line is the unresolved glyph, not an empty header slot.
    has(NO_DATA);
    hasNot("r1");
  });
});

/* ------------------------------------------------------------------ */
/* The roster and the seat counts — the enrollment relation            */
/* ------------------------------------------------------------------ */
describe("the roster", () => {
  it("is the enrollment relation: a real enroll adds the seat, a withdraw releases it", async () => {
    const classId = "cl1";
    const expected = await membersOf(classId);
    expect(expected.length, "the demo dataset must give cl1 active enrollments").toBeGreaterThan(0);

    renderRoute(`#/classes/${classId}`);
    await settled();
    for (const student of expected) has(student.name);
    has(`${faNum(expected.length)} نفر`);

    // A real write: a student with no seat anywhere takes one.
    const student = await unenrolledStudent();
    const enrollment = await getEnrollmentRepository().enroll({ studentId: student.id, classId });
    expect(enrollment.status).toBe("active");

    cleanup();
    renderRoute(`#/classes/${classId}`);
    await settled();
    has(student.name);
    has(`${faNum(expected.length + 1)} نفر`);
    has(`${faNum(expected.length + 1)} از ${faNum(6)} صندلی`);

    // Released: the seat is gone from the roster AND from the count.
    await getEnrollmentRepository().withdraw(enrollment.id);
    expect((await getEnrollmentRepository().get(enrollment.id)).status).toBe("cancelled");

    cleanup();
    renderRoute(`#/classes/${classId}`);
    await settled();
    hasNot(student.name);
    has(`${faNum(expected.length)} نفر`);
    has(`${faNum(expected.length)} از ${faNum(6)} صندلی`);
  });

  it("does not treat a waitlisted student as a seat holder", async () => {
    const classId = "cl1";
    const seated = (await membersOf(classId)).length;
    const waiting = await unenrolledStudent();

    const enrollment = await getEnrollmentRepository().enroll({ studentId: waiting.id, classId, status: "waitlist" });
    expect(enrollment.status).toBe("waitlist");

    renderRoute(`#/classes/${classId}`);
    await settled();

    // The queue is named as a queue, and the seat count did not move.
    has(`${faNum(1)} نفر در لیست انتظار`);
    has(`${faNum(seated)} از ${faNum(6)} صندلی`);
    // Queued is not seated: the student is not on the roster.
    hasNot(waiting.name);
    has(`${faNum(seated)} نفر`);

    // The list view makes the same claim from the same rows.
    cleanup();
    renderRoute("#/classes");
    await settled();
    has(`${faNum(1)} در انتظار`);
  });

  it("counts what the enrollments say, not the class row's projection", async () => {
    const real = getClassRepository();
    // A class row whose denormalized projection lies about its seats and queue.
    setClassRepository(
      withStubs(real, {
        list: async (params, signal) => {
          const page = await real.list(params, signal);
          return { ...page, data: page.data.map((row) => (row.id === "cl1" ? { ...row, enrolled: 99, waitlist: 77, studentIds: ["st14"] } : row)) };
        },
      }),
    );
    const seated = (await membersOf("cl1")).length;

    renderRoute("#/classes");
    await settled();
    has(`${faNum(seated)} از ${faNum(6)}`);
    hasNot(`${faNum(99)} از ${faNum(6)}`);
    hasNot(`${faNum(77)} در انتظار`);

    // And the projection cannot invent a roster either.
    cleanup();
    renderRoute("#/classes/cl1");
    await settled();
    has(`${faNum(seated)} نفر`);
    hasNot("فرزاد بهرامی");
  });
});

/* ------------------------------------------------------------------ */
/* The weekly panel — the scheduling relation                          */
/* ------------------------------------------------------------------ */
describe("the weekly panel", () => {
  it("renders the class's own sessions from a windowed read, and drops the others", async () => {
    const today = academyIsoDate();
    const todayIndex = academyWeekdayIndex();
    const weekStart = addDays(today, -todayIndex)!;
    const weekEnd = addDays(weekStart, 6)!;
    const otherDay = addDays(weekStart, (todayIndex + 2) % 7)!;

    /*
      Times that exist in NO fixture template: 13:15, 08:05 and 21:05 are not
      slots any class holds. A panel built from `weekSessions` would render the
      template's own times for this class instead, so none of these assertions
      could hold against it.
    */
    const mine = session({ id: "ses_probe_mine", classId: "cl1", teacherId: "t1", roomId: "r1", date: otherDay, startTime: "13:15", endTime: "14:15" });
    const alien = session({ id: "ses_probe_alien", classId: "cl3", teacherId: "t2", roomId: "r2", date: today, startTime: "19:45", endTime: "20:45" });
    const beyondTheWeek = session({ id: "ses_probe_far", classId: "cl1", teacherId: "t1", roomId: "r1", date: addDays(weekStart, 20)!, startTime: "21:05", endTime: "22:05" });

    const reads: Record<string, unknown>[] = [];
    const all = [mine, alien, beyondTheWeek];
    /*
      The stub ENFORCES the date window it is handed — like a real repository —
      and deliberately does NOT filter by class, so two different things are
      proven: the window is the view's own (a wrong window would hide `mine` or
      show the row beyond it), and the CLASS scope is the view's own filter
      (`alien` is in the window, and only the view can keep it out).
    */
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async (params) => {
          reads.push(params as Record<string, unknown>);
          const kept = all.filter((row) => row.date >= (params?.from ?? row.date) && row.date <= (params?.to ?? row.date));
          return { data: kept, meta: { page: 1, per_page: 200, total: kept.length } };
        },
      }),
    );

    renderRoute("#/classes/cl1");
    await settled();

    // The class's own occurrence, on the weekday its date really is.
    has(faTime(mine.startTime));
    has(faTime(mine.endTime));
    has(["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"][weekdayIndex(mine.date)!]);

    // Scope and window: another class's session, and one outside the week, are
    // not drawn — even though the read returned them.
    hasNot(faTime(alien.startTime));
    hasNot(faTime(beyondTheWeek.startTime));

    // The read itself: a bounded, class-scoped, windowed session read.
    const read = reads[0];
    expect(read.classId).toBe("cl1");
    expect(read.from).toBe(weekStart);
    expect(read.to).toBe(weekEnd);
    expect(read.per_page).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/* The rooms panel                                                     */
/* ------------------------------------------------------------------ */
describe("the rooms panel", () => {
  it("is the room repository, not the fixture array", async () => {
    setRoomRepository(
      withStubs(getRoomRepository(), {
        list: async () => ({
          data: [{ id: "r1", name: "استودیو آ", kind: "آکوستیک", capacity: 9, occupancy: 12, active: true }],
          meta: { page: 1, per_page: 200, total: 1 },
        }),
      }),
    );

    renderRoute("#/classes");
    await settled();

    has("استودیو آ");
    has("آکوستیک");
    has(`${faNum(9)} نفر`);
    has(faPercentOf(12));
    // The rows the repository did not return are not on screen.
    hasNot("اتاق ۲");
    hasNot("سازهای زهی و مضرابی");
    hasNot(`${faNum(94)}٪`);
  });

  it("says a room is not recorded rather than drawing the fixture rooms", async () => {
    setRoomRepository(
      withStubs(getRoomRepository(), { list: async () => ({ data: [], meta: { page: 1, per_page: 200, total: 0 } }) }),
    );

    renderRoute("#/classes");
    await settled();
    has("اتاقی ثبت نشده");
    hasNot("اتاق ۱");
  });
});

/* ------------------------------------------------------------------ */
/* Honest degradation: unwritten numbers, partial pages, failures      */
/* ------------------------------------------------------------------ */
describe("honest relations", () => {
  it("renders no trend delta beside the occupancy or the attendance average", async () => {
    renderRoute("#/classes");
    await settled();

    // The two figures nothing measured: `delta: 3.4` and `delta: 2.1`. The
    // delta component renders them as «+۳٫۴٪» / «+۲٫۱٪».
    hasNot("+۳٫۴٪");
    hasNot("+۲٫۱٪");
    // The strip itself is still there, with real numbers.
    has("اشغال صندلی");
    has("میانگین حضور");
  });

  it("keeps an empty, an unresolvable and a partial relation apart", async () => {
    const seated = await membersOf("cl1");
    expect(seated.length).toBeGreaterThan(0);

    // 1. No members at all: an honest empty state, an honest ۰.
    const realEnrollments = getEnrollmentRepository();
    setEnrollmentRepository(
      withStubs(realEnrollments, {
        list: async (params) => {
          if (params?.classId === "cl1") return { data: [], meta: { page: 1, per_page: 200, total: 0 } };
          return realEnrollments.list(params);
        },
      }),
    );

    renderRoute("#/classes/cl1");
    await settled();
    has("هنوز هنرجویی ثبت‌نام نکرده");
    has(`${faNum(0)} از ${faNum(6)} صندلی`);

    // 2. Members exist but the students read does not return them: the panel
    //    says the roster could not be read instead of claiming the class is empty.
    cleanup();
    setEnrollmentRepository(undefined);
    setStudentRepository(
      withStubs(getStudentRepository(), { list: async () => ({ data: [], meta: { page: 1, per_page: 200, total: 0 } }) }),
    );

    renderRoute("#/classes/cl1");
    await settled();
    hasNot("هنوز هنرجویی ثبت‌نام نکرده");
    has("فهرست هنرجویان این کلاس خوانده نشد");
    has(`${faNum(seated.length)} هنرجو در خواندن هنرجویان یافت نشد`);

    // 3. A partial page: the panel states how much of the relation it is showing
    //    and withholds the counts it cannot stand behind.
    cleanup();
    const first = (await getEnrollmentRepository().list({ per_page: 200 })).data[0];
    setEnrollmentRepository(
      withStubs(getEnrollmentRepository(), {
        list: async () => ({ data: [first], meta: { page: 1, per_page: 200, total: 500 } }),
      }),
    );

    renderRoute("#/classes/cl1");
    await settled();
    has(`ثبت‌نام‌ها: ${faNum(1)} ردیف از ${faNum(500)}`);
    has(`${NO_DATA} از ${faNum(6)} صندلی`);
  });

  it("fails a relation with a retry instead of rendering it as empty", async () => {
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async () => {
          throw new ApiError({ kind: "network", code: "SCHEDULE_UNAVAILABLE", message: "برنامهٔ آموزشگاه در دسترس نیست." });
        },
      }),
    );

    renderRoute("#/classes/cl1");
    await settled();
    has("خواندن اطلاعات این کلاس ناموفق بود");
    has("برنامهٔ آموزشگاه در دسترس نیست.");
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeTruthy();
    // An unavailable relation is not an empty one.
    hasNot("جلسه‌ای در این هفته نیست");

    // The roster panel's own read failing is reported the same way.
    cleanup();
    setSchedulingRepository(undefined);
    setEnrollmentRepository(
      withStubs(getEnrollmentRepository(), {
        list: async () => {
          throw new ApiError({ kind: "server", code: "ENROLLMENTS_UNAVAILABLE", message: "فهرست ثبت‌نام‌ها خوانده نشد." });
        },
      }),
    );
    renderRoute("#/classes/cl1");
    await settled();
    has("خواندن اطلاعات این کلاس ناموفق بود");
    has("فهرست ثبت‌نام‌ها خوانده نشد.");

    // And the list view's relation failure names its own reads.
    cleanup();
    setEnrollmentRepository(
      withStubs(getEnrollmentRepository(), {
        list: async () => {
          throw new ApiError({ kind: "server", code: "ENROLLMENTS_UNAVAILABLE", message: "فهرست ثبت‌نام‌ها خوانده نشد." });
        },
      }),
    );
    renderRoute("#/classes");
    await settled();
    has("خواندن ثبت‌نام‌ها و اتاق‌های آموزشگاه ناموفق بود");
    hasNot("کلاسی پیدا نشد");
  });

  it("fails the list when the classes themselves cannot be read", async () => {
    setClassRepository(
      withStubs(getClassRepository(), {
        list: async () => {
          throw new ApiError({ kind: "server", code: "CLASSES_UNAVAILABLE", message: "فهرست کلاس‌ها خوانده نشد." });
        },
      }),
    );

    renderRoute("#/classes");
    await settled();
    has("بارگذاری کلاس‌ها ناموفق بود");
    has("فهرست کلاس‌ها خوانده نشد.");
  });
});

/* ------------------------------------------------------------------ */
/* Switching class — the consumer-local guard                          */
/* ------------------------------------------------------------------ */
describe("switching class", () => {
  it("cannot show the previous class's roster while the switch is in flight", async () => {
    const cl1Members = await membersOf("cl1");
    const cl3Members = await membersOf("cl3");
    expect(cl1Members.length).toBeGreaterThan(0);
    expect(cl3Members.length).toBeGreaterThan(0);
    expect(cl3Members.some((row) => cl1Members.some((own) => own.id === row.id))).toBe(false);

    /*
      The switch is held open at the read whose key changes with the selected
      class: an enrollment list that answers for cl3 only when the test releases
      it. Everything else the detail reads has already resolved, so the frames
      the assertions inspect are exactly the ones the call-site guard exists for.
    */
    let gateOpen = false;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realEnrollments = getEnrollmentRepository();
    setEnrollmentRepository(
      withStubs(realEnrollments, {
        list: async (params, signal) => {
          if (gateOpen && params?.classId === "cl3") await gate;
          return realEnrollments.list(params, signal);
        },
      }),
    );

    renderRoute("#/classes/cl1");
    await settled();
    has(cl1Members[0].name);
    has(`${faNum(cl1Members.length)} نفر`);

    // Walk the real route: back to the roster through the breadcrumb, then into
    // the other class.
    fireEvent.click(screen.getByRole("button", { name: /^کلاس‌ها$/ }));
    await settled();
    gateOpen = true;
    fireEvent.click(screen.getByRole("button", { name: /گیتار مقدماتی/ }));

    // cl3's workspace is on screen, and it carries NONE of cl1's rows or counts:
    // the page says it is still reading instead.
    expect(inFlight().length).toBeGreaterThan(0);
    for (const student of cl1Members) hasNot(student.name);
    hasNot(`${faNum(cl1Members.length)} نفر`);

    release();
    await settled();
    for (const student of cl3Members) has(student.name);
    for (const student of cl1Members) hasNot(student.name);
    has(`${faNum(cl3Members.length)} نفر`);
  });
});

/** The room row's own occupancy figure, as the panel prints it. */
function faPercentOf(value: number): string {
  return `${faNum(value)}٪`;
}
