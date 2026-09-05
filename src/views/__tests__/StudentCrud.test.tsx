// @vitest-environment jsdom
/**
 * Student CRUD through the real UI.
 *
 * These tests drive the actual dialog against the real demo repository, so
 * they prove the whole path: form → repository → DemoStore → list refresh.
 * A test that stubbed the repository would not catch broken wiring, which is
 * the failure mode this phase is meant to eliminate.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { StudentsView } from "@/views/Students";
import { StudentFormDialog } from "@/domains/students/StudentFormDialog";
import { resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { getStudentRepository } from "@/domains/registry";

afterEach(cleanup);
beforeEach(() => {
  demoStore.reset();
  resetRegistry();
});

function renderForm(onSaved = () => undefined) {
  return render(
    <AppProvider>
      <StudentFormDialog open onClose={() => undefined} onSaved={onSaved} />
    </AppProvider>,
  );
}

/** Fills every required control of the create form with a valid value. */
async function fillValidStudent(nationalId: string, name = "هنرجوی تستی") {
  fireEvent.change(screen.getByLabelText(/نام و نام خانوادگی/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/کد ملی/), { target: { value: nationalId } });
  fireEvent.change(screen.getByLabelText(/سن/), { target: { value: "20" } });
  fireEvent.change(screen.getByLabelText(/شمارهٔ تماس/), { target: { value: "09120000000" } });

  // The teacher list loads from the repository, so wait for its options.
  const teacherSelect = await screen.findByLabelText(/مدرس/);
  await waitFor(() => expect(within(teacherSelect).getAllByRole("option").length).toBeGreaterThan(1));
  const option = within(teacherSelect).getAllByRole("option")[1] as HTMLOptionElement;
  fireEvent.change(teacherSelect, { target: { value: option.value } });
}

describe("student create dialog", () => {
  it("persists a valid student through the repository", async () => {
    let saved = false;
    renderForm(() => {
      saved = true;
    });

    await fillValidStudent("2000535658", "هنرجوی تازه");
    fireEvent.click(screen.getByRole("button", { name: "افزودن هنرجو" }));

    await waitFor(() => expect(saved).toBe(true));

    const page = await getStudentRepository().list({ per_page: 200 });
    const created = page.data.find((s) => s.name === "هنرجوی تازه");
    expect(created).toBeDefined();
    expect(created?.nationalId).toBe("2000535658");
  });

  it("blocks an invalid national ID before touching the repository", async () => {
    renderForm();
    const before = (await getStudentRepository().list({ per_page: 200 })).meta.total;

    await fillValidStudent("1234567890", "کد ملی نامعتبر");
    fireEvent.click(screen.getByRole("button", { name: "افزودن هنرجو" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByLabelText(/کد ملی/)).toHaveProperty("ariaInvalid", "true");

    const after = (await getStudentRepository().list({ per_page: 200 })).meta.total;
    expect(after).toBe(before);
  });

  it("surfaces a duplicate national ID reported by the repository", async () => {
    const existing = (await getStudentRepository().list({ per_page: 1 })).data[0];
    let saved = false;
    renderForm(() => {
      saved = true;
    });

    // Checksum-valid, so local validation passes and the conflict can only
    // come back from the repository.
    await fillValidStudent(existing.nationalId, "کد ملی تکراری");
    fireEvent.click(screen.getByRole("button", { name: "افزودن هنرجو" }));

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(saved).toBe(false);
  });

  it("requires a name and a teacher", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "افزودن هنرجو" }));

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(screen.getByText("نام هنرجو الزامی است.")).toBeTruthy();
  });
});

describe("students list reflects repository writes", () => {
  it("shows a newly created student without a manual reload", async () => {
    render(
      <AppProvider>
        <StudentsView />
      </AppProvider>,
    );

    await screen.findByText("هنرجویان");
    await waitFor(() => expect(screen.queryByText("سارا محمدی")).toBeTruthy());

    // Write directly through the repository: the list must refresh because the
    // store notified the data-version bus, not because the view was told.
    await getStudentRepository().create({
      nationalId: "2000535658",
      name: "هنرجوی واکنشی",
      instrument: "guitar",
      teacherId: "t2",
      level: "سطح ۱",
      levelStep: 1,
      status: "active",
      payment: "paid",
      sessionsUsed: 0,
      sessionsTotal: 12,
      attendance: 100,
      progress: 0,
      since: "امروز",
      age: 22,
      phone: "۰۹۱۲۰۰۰۱۱۱۱",
      lastSeen: "امروز",
      balance: 0,
    });

    await waitFor(() => expect(screen.getByText("هنرجوی واکنشی")).toBeTruthy());
  });
});
