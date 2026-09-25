// @vitest-environment jsdom
/**
 * I15 at the two places this view reads the student list.
 *
 * `useStudentList` exposes `error` beside `students`. Both reads here used to
 * destructure only `.students`, so a FAILED read was rendered as the legitimate
 * empty result:
 *
 *   · the access picker in the item dialog showed «هنرجویی ثبت نشده است.» —
 *     telling the operator the academy has no students when the truth is that
 *     the list could not be read; and
 *   · the detail drawer's "restricted to" line fell back to raw student ids,
 *     which reads exactly like a successful lookup of a student whose name is
 *     unavailable.
 *
 * An empty collection and an unreadable one are different facts. Each case here
 * pins both halves of the distinction: the failure is disclosed, and the honest
 * empty result still reads as empty when the read really succeeds.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { LibraryView } from "@/views/Library";
import { ApiError } from "@/api/errors";
import { getLibraryRepository, getStudentRepository, resetRegistry, setStudentRepository } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import type { Page } from "@/api/types";
import type { Student } from "@/domains/students/types";

const NETWORK_MESSAGE = "اتصال به سرور برقرار نشد";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/** A student list read that fails, delegating every other verb to the real repo. */
function failStudentRead() {
  setStudentRepository(
    withStubs(getStudentRepository(), {
      list: () => Promise.reject<Page<Student>>(new ApiError({ kind: "network", message: NETWORK_MESSAGE })),
    }),
  );
}

/** A student list read that succeeds and legitimately finds nobody. */
function emptyStudentList() {
  setStudentRepository(
    withStubs(getStudentRepository(), {
      list: () => Promise.resolve({ data: [], meta: { page: 1, per_page: 200, total: 0 } } as Page<Student>),
    }),
  );
}

async function renderLibrary() {
  render(
    <AppProvider>
      <LibraryView />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.queryByText("در حال باز کردن کتابخانه…")).toBeNull());
}

/** Opens the item dialog and reveals the student picker. */
async function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: /افزودن منبع/ }));
  fireEvent.change(await screen.findByLabelText(/سطح دسترسی هنرجویان/), { target: { value: "some" } });
}

async function openDrawerFor(title: string) {
  const card = screen
    .getAllByRole("button")
    .find((button) => (button.textContent ?? "").includes(title));
  expect(card, `a resource card for ${title} must be on screen`).toBeDefined();
  fireEvent.click(card!);
  await screen.findByRole("dialog");
}

describe("the item dialog's student picker owns its read's failure", () => {
  it("discloses a failed read instead of claiming no students exist", async () => {
    failStudentRead();
    await renderLibrary();
    await openPicker();

    expect(await screen.findByText(/خواندن فهرست هنرجویان ناموفق بود/)).toBeDefined();
    expect(screen.getByText(new RegExp(NETWORK_MESSAGE))).toBeDefined();
    // The false empty copy must NOT be how a failure is reported.
    expect(screen.queryByText("هنرجویی ثبت نشده است.")).toBeNull();
  });

  it("still reports a successful read that finds nobody as the empty list", async () => {
    emptyStudentList();
    await renderLibrary();
    await openPicker();

    expect(await screen.findByText("هنرجویی ثبت نشده است.")).toBeDefined();
    expect(screen.queryByText(/خواندن فهرست هنرجویان ناموفق بود/)).toBeNull();
  });
});

describe("the detail drawer's restricted-student line owns the same failure", () => {
  async function restrictedItem() {
    const student = (await getStudentRepository().list({ per_page: 1 })).data[0];
    expect(student, "the demo seed must ship at least one student").toBeDefined();
    const item = (await getLibraryRepository().list({ per_page: 1 })).data[0];
    expect(item, "the demo seed must ship at least one library resource").toBeDefined();
    await getLibraryRepository().update(item.id, { restrictedToStudentIds: [student.id] });
    return { student, item };
  }

  it("discloses a failed read instead of printing raw student ids", async () => {
    const { student, item } = await restrictedItem();
    failStudentRead();
    await renderLibrary();
    await openDrawerFor(item.title);

    expect(await screen.findByText(/نام هنرجویان خوانده نشد/)).toBeDefined();
    // The old behaviour printed the id here, which reads as a resolved name.
    expect(document.body.textContent, "a raw student id must not stand in for a name").not.toContain(student.id);
  });

  it("still resolves the student's name when the read succeeds", async () => {
    const { student, item } = await restrictedItem();
    await renderLibrary();
    await openDrawerFor(item.title);

    expect(await screen.findByText(new RegExp(student.name))).toBeDefined();
    expect(document.body.textContent).not.toContain(student.id);
  });
});
