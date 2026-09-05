// @vitest-environment jsdom
/**
 * Teacher / room / class / enrollment CRUD driven through the real dialogs
 * against the real demo repositories.
 *
 * These mirror `StudentCrud.test.tsx`: nothing is stubbed, so a broken wire
 * between a form and its repository fails here rather than in a demo. They
 * assert both directions of §7 — a write reaches the store, and the record it
 * creates is immediately visible to the *other* domain that depends on it.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { TeacherFormDialog } from "@/domains/teachers/TeacherFormDialog";
import { RoomFormDialog } from "@/domains/rooms/RoomFormDialog";
import { ClassFormDialog } from "@/domains/classes/ClassFormDialog";
import { EnrollmentDialog } from "@/domains/enrollments/EnrollmentDialog";
import {
  getClassRepository,
  getEnrollmentRepository,
  getRoomRepository,
  getTeacherRepository,
  resetRegistry,
} from "@/domains/registry";
import { demoStore } from "@/services/demoStore";

afterEach(cleanup);
beforeEach(() => {
  demoStore.reset();
  resetRegistry();
});

function wrap(node: React.ReactNode) {
  return render(<AppProvider>{node}</AppProvider>);
}

/** Waits for an async-populated <select> to have real options, then picks one. */
async function pickOption(label: RegExp, match: (text: string) => boolean) {
  // `selector` disambiguates from the required-marker text and the dialog title.
  const select = await screen.findByLabelText(label, { selector: "select" });
  await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
  const option = (within(select).getAllByRole("option") as HTMLOptionElement[])
    // Skip the "— انتخاب کنید —" placeholder: it carries no value.
    .find((o) => o.value !== "" && match(o.textContent ?? ""));
  expect(option, `no option matched under ${String(label)}`).toBeDefined();
  fireEvent.change(select, { target: { value: option!.value } });
  return option!;
}

/* -------------------------------------------------------------- teachers */
describe("teacher dialog", () => {
  it("creates a teacher that is immediately assignable to a class", async () => {
    let created = false;
    wrap(<TeacherFormDialog open onClose={() => undefined} onSaved={() => (created = true)} />);

    fireEvent.change(screen.getByLabelText(/نام و نام خانوادگی/), { target: { value: "مدرس تازه" } });
    fireEvent.change(screen.getByLabelText(/عنوان \/ تخصص/), { target: { value: "مدرس پیانو" } });
    fireEvent.change(screen.getByLabelText(/شمارهٔ تماس/), { target: { value: "09121110000" } });
    fireEvent.change(screen.getByLabelText(/ساعت قرارداد/), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "افزودن مدرس" }));

    await waitFor(() => expect(created).toBe(true));

    // Persisted…
    const page = await getTeacherRepository().list({ per_page: 200 });
    const teacher = page.data.find((t) => t.name === "مدرس تازه");
    expect(teacher).toBeDefined();

    // …and available to the class form's assignable filter without a reload.
    cleanup();
    wrap(<ClassFormDialog open onClose={() => undefined} onSaved={() => undefined} />);
    await pickOption(/مدرس/, (text) => text === "مدرس تازه");
  });

  it("keeps the dialog open and reports a duplicate phone instead of claiming success", async () => {
    const existing = (await getTeacherRepository().list({ per_page: 200 })).data[0];
    let saved = false;
    wrap(<TeacherFormDialog open onClose={() => undefined} onSaved={() => (saved = true)} />);

    fireEvent.change(screen.getByLabelText(/نام و نام خانوادگی/), { target: { value: "مدرس تکراری" } });
    fireEvent.change(screen.getByLabelText(/عنوان \/ تخصص/), { target: { value: "مدرس" } });
    fireEvent.change(screen.getByLabelText(/شمارهٔ تماس/), { target: { value: existing.phone } });
    fireEvent.change(screen.getByLabelText(/ساعت قرارداد/), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "افزودن مدرس" }));

    await screen.findByRole("alert");
    expect(saved).toBe(false);
    const page = await getTeacherRepository().list({ per_page: 200 });
    expect(page.data.filter((t) => t.name === "مدرس تکراری")).toHaveLength(0);
  });

  it("edits an existing teacher in place rather than creating a second record", async () => {
    const before = await getTeacherRepository().list({ per_page: 200 });
    const teacher = before.data[0];
    wrap(<TeacherFormDialog open teacher={teacher} onClose={() => undefined} onSaved={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/عنوان \/ تخصص/), { target: { value: "سرپرست گروه سازهای زهی" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    await waitFor(async () => {
      const updated = await getTeacherRepository().get(teacher.id);
      expect(updated.title).toBe("سرپرست گروه سازهای زهی");
    });
    const after = await getTeacherRepository().list({ per_page: 200 });
    expect(after.data).toHaveLength(before.data.length);
  });
});

/* ----------------------------------------------------------------- rooms */
describe("room dialog", () => {
  it("creates a room and offers it for class assignment", async () => {
    let created = false;
    wrap(<RoomFormDialog open onClose={() => undefined} onSaved={() => (created = true)} />);

    fireEvent.change(screen.getByLabelText(/نام اتاق/), { target: { value: "اتاق تمرین ۹" } });
    fireEvent.change(screen.getByLabelText(/ظرفیت/), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "افزودن اتاق" }));

    await waitFor(() => expect(created).toBe(true));
    const page = await getRoomRepository().list({ per_page: 200 });
    expect(page.data.find((r) => r.name === "اتاق تمرین ۹")?.capacity).toBe(8);

    cleanup();
    wrap(<ClassFormDialog open onClose={() => undefined} onSaved={() => undefined} />);
    await pickOption(/اتاق/, (text) => text.startsWith("اتاق تمرین ۹"));
  });

  it("rejects a non-positive capacity in the form, before any repository call", async () => {
    const before = (await getRoomRepository().list({ per_page: 200 })).data.length;
    let saved = false;
    wrap(<RoomFormDialog open onClose={() => undefined} onSaved={() => (saved = true)} />);

    fireEvent.change(screen.getByLabelText(/نام اتاق/), { target: { value: "اتاق صفر" } });
    fireEvent.change(screen.getByLabelText(/ظرفیت/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "افزودن اتاق" }));

    await screen.findByRole("alert");
    expect(saved).toBe(false);
    expect((await getRoomRepository().list({ per_page: 200 })).data).toHaveLength(before);
  });

  it("surfaces a duplicate room name reported by the repository", async () => {
    const existing = (await getRoomRepository().list({ per_page: 200 })).data[0];
    let saved = false;
    wrap(<RoomFormDialog open onClose={() => undefined} onSaved={() => (saved = true)} />);

    fireEvent.change(screen.getByLabelText(/نام اتاق/), { target: { value: existing.name } });
    fireEvent.change(screen.getByLabelText(/ظرفیت/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "افزودن اتاق" }));

    await screen.findByRole("alert");
    expect(saved).toBe(false);
  });
});

/* --------------------------------------------------------------- classes */
describe("class dialog", () => {
  /** Fills the class form with a valid draft, choosing the first real teacher/room. */
  async function fillValidClass(title: string) {
    fireEvent.change(screen.getByLabelText(/عنوان کلاس/), { target: { value: title } });
    await pickOption(/مدرس/, () => true);
    await pickOption(/اتاق/, () => true);
    fireEvent.click(screen.getByRole("button", { name: "شنبه" }));
    fireEvent.change(screen.getByLabelText(/ظرفیت/, { selector: "input" }), { target: { value: "4" } });
  }

  it("creates a class bound to an existing teacher and room", async () => {
    let created = false;
    wrap(<ClassFormDialog open onClose={() => undefined} onSaved={() => (created = true)} />);

    await fillValidClass("کلاس تستی");
    fireEvent.click(screen.getByRole("button", { name: "افزودن کلاس" }));

    await waitFor(() => {
      const alerts = screen.queryAllByRole("alert").map((a) => a.textContent);
      expect(created, `not saved; alerts: ${alerts.join(" | ")}`).toBe(true);
    });
    const page = await getClassRepository().list({ per_page: 200 });
    const cls = page.data.find((c) => c.title === "کلاس تستی");
    expect(cls).toBeDefined();
    expect(cls!.teacherId).toBeTruthy();
    expect(cls!.roomId).toBeTruthy();
    // Enrollment, not a duplicated array, is the canonical relationship.
    expect(cls!.enrolled).toBe(0);
  });

  it("only offers assignable teachers, so a deactivated one cannot be chosen", async () => {
    const teachers = await getTeacherRepository().list({ per_page: 200 });
    // t5 is the freely deactivatable seed teacher (owns no classes).
    const victim = teachers.data.find((t) => t.id === "t5")!;
    await getTeacherRepository().update(victim.id, { status: "inactive" });

    wrap(<ClassFormDialog open onClose={() => undefined} onSaved={() => undefined} />);
    const select = await screen.findByLabelText(/مدرس/);
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
    const names = within(select)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(names).not.toContain(victim.name);
  });

  it("blocks submission when no weekday is selected", async () => {
    let saved = false;
    wrap(<ClassFormDialog open onClose={() => undefined} onSaved={() => (saved = true)} />);

    fireEvent.change(screen.getByLabelText(/عنوان کلاس/), { target: { value: "کلاس بی‌روز" } });
    await pickOption(/مدرس/, () => true);
    await pickOption(/اتاق/, () => true);
    fireEvent.click(screen.getByRole("button", { name: "افزودن کلاس" }));

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(saved).toBe(false);
  });
});

/* ----------------------------------------------------------- enrollments */
describe("enrollment dialog", () => {
  it("enrolls a student and keeps the class seat count in sync", async () => {
    const before = await getClassRepository().get("cl1");
    let enrolled = false;
    wrap(<EnrollmentDialog open classId="cl1" onClose={() => undefined} onEnrolled={() => (enrolled = true)} />);

    // Pick any student not already enrolled in cl1.
    const select = await screen.findByLabelText(/هنرجو/, { selector: "select" });
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
    const openEnrollments = await getEnrollmentRepository().list({ per_page: 500 });
    const takenIds = new Set(
      openEnrollments.data.filter((e) => e.classId === "cl1").map((e) => e.studentId),
    );
    const free = within(select)
      .getAllByRole("option")
      .map((o) => o as HTMLOptionElement)
      .find((o) => o.value && !takenIds.has(o.value))!;
    fireEvent.change(select, { target: { value: free.value } });

    fireEvent.click(screen.getByRole("button", { name: "ثبت‌نام" }));
    await waitFor(() => expect(enrolled).toBe(true));

    const after = await getClassRepository().get("cl1");
    expect(after.enrolled).toBe(before.enrolled + 1);
    expect(after.studentIds).toContain(free.value);
  });

  it("refuses a duplicate active enrollment and shows the reason", async () => {
    const existing = (await getEnrollmentRepository().list({ per_page: 500 })).data.find(
      (e) => e.classId === "cl1" && e.status === "active",
    )!;
    let enrolled = false;
    wrap(
      <EnrollmentDialog
        open
        classId="cl1"
        studentId={existing.studentId}
        onClose={() => undefined}
        onEnrolled={() => (enrolled = true)}
      />,
    );

    await waitFor(() =>
      expect((screen.getByLabelText(/هنرجو/, { selector: "select" }) as HTMLSelectElement).value).toBe(existing.studentId),
    );
    fireEvent.click(screen.getByRole("button", { name: "ثبت‌نام" }));

    await screen.findByRole("alert");
    expect(enrolled).toBe(false);
    const count = (await getEnrollmentRepository().list({ per_page: 500 })).data.filter(
      (e) => e.classId === "cl1" && e.studentId === existing.studentId && e.status === "active",
    ).length;
    expect(count).toBe(1);
  });

  it("disables the seat button for a full class but still allows the waitlist", async () => {
    // cl2 is a private class with capacity 1, already taken by st7.
    wrap(<EnrollmentDialog open classId="cl2" onClose={() => undefined} onEnrolled={() => undefined} />);

    const select = await screen.findByLabelText(/هنرجو/, { selector: "select" });
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
    const free = within(select)
      .getAllByRole("option")
      .map((o) => o as HTMLOptionElement)
      .find((o) => o.value && o.value !== "st7")!;
    fireEvent.change(select, { target: { value: free.value } });

    await waitFor(() => expect((screen.getByRole("button", { name: "ثبت‌نام" }) as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByRole("button", { name: "افزودن به لیست انتظار" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "افزودن به لیست انتظار" }));
    await waitFor(async () => {
      const rows = (await getEnrollmentRepository().list({ per_page: 500 })).data;
      expect(rows.some((e) => e.classId === "cl2" && e.studentId === free.value && e.status === "waitlist")).toBe(true);
    });
    // A waitlist entry must not consume a seat.
    expect((await getClassRepository().get("cl2")).enrolled).toBe(1);
  });
});
