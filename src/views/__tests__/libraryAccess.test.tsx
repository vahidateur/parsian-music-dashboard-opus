// @vitest-environment jsdom
/**
 * Setting a resource's access level AFTER it was created — item 14, at the
 * surface the operator touches.
 *
 * The catalogue row already existed; the academy changes its mind about who may
 * open it. This test walks the real path: open the resource, edit it, narrow the
 * access to one named student, save — and then reads the decision back from the
 * repository and from the detail surface, which must quote the student's name
 * rather than merely claim a restriction exists.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { LibraryView } from "@/views/Library";
import { resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

async function renderView() {
  render(
    <AppProvider>
      <LibraryView />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.queryByText("در حال باز کردن کتابخانه…")).toBeNull());
}

describe("the access level of an existing resource", () => {
  it("is editable later, by name, and the detail quotes the decision", async () => {
    const target = demoStore.resources.all()[0];
    const student = demoStore.students.all()[0];
    expect(target.restrictedToStudentIds ?? []).toEqual([]);

    await renderView();

    fireEvent.click(screen.getAllByText(target.title)[0]);
    fireEvent.click(await screen.findByRole("button", { name: /ویرایش/ }));

    // The detail Drawer is a dialog too; the edit dialog mounts after it.
    const dialogs = await screen.findAllByRole("dialog");
    const dialog = dialogs[dialogs.length - 1];
    fireEvent.change(within(dialog).getByLabelText(/سطح دسترسی هنرجویان/), { target: { value: "some" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: student.name }));
    fireEvent.click(within(dialog).getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    await waitFor(() => {
      expect(demoStore.resources.find(target.id)?.restrictedToStudentIds).toEqual([student.id]);
    });

    // The detail surface quotes WHO may access it, not just that it is limited.
    fireEvent.click(screen.getAllByText(target.title)[0]);
    expect(await screen.findByText(/دسترسی این منبع محدود است به/)).toBeDefined();
    expect(screen.getByText(new RegExp(student.name))).toBeDefined();
  });

  it("refuses a restriction that names nobody, because empty means everybody", async () => {
    const target = demoStore.resources.all()[0];
    await renderView();

    fireEvent.click(screen.getAllByText(target.title)[0]);
    fireEvent.click(await screen.findByRole("button", { name: /ویرایش/ }));

    // The detail Drawer is a dialog too; the edit dialog mounts after it.
    const dialogs = await screen.findAllByRole("dialog");
    const dialog = dialogs[dialogs.length - 1];
    fireEvent.change(within(dialog).getByLabelText(/سطح دسترسی هنرجویان/), { target: { value: "some" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    /*
      The refusal is a toast in the running app; what a test can stand behind is
      the two things the toast reports: the dialog stayed open (nothing was
      swallowed) and the repository row is untouched.
    */
    expect(within(dialog).getByRole("button", { name: "ذخیرهٔ تغییرات" })).toBeDefined();
    expect(demoStore.resources.find(target.id)?.restrictedToStudentIds ?? []).toEqual([]);
  });
});
