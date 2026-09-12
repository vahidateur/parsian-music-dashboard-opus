// @vitest-environment jsdom
/**
 * Instruments management through the UI.
 *
 * The product requirement is that an academy can define its own instruments at
 * runtime, so the key assertions are that a newly created instrument persists
 * and that the repository's in-use protection reaches the user.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { InstrumentsPanel } from "../InstrumentsPanel";
import { getInstrumentRepository, resetRegistry } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function renderPanel() {
  return render(
    <AppProvider>
      <InstrumentsPanel />
    </AppProvider>,
  );
}

async function waitForList() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری سازها…")).toBeNull());
}

describe("listing", () => {
  it("shows the seeded instruments", async () => {
    renderPanel();
    await waitForList();
    expect(await screen.findByText("پیانو")).toBeDefined();
    expect(screen.getByText("ویولن")).toBeDefined();
  });
});

describe("creating an instrument", () => {
  it("persists a new instrument and shows it in the list", async () => {
    renderPanel();
    await waitForList();

    fireEvent.click(screen.getByRole("button", { name: "افزودن ساز" }));
    fireEvent.change(await screen.findByLabelText(/نام ساز/), { target: { value: "سنتور" } });
    fireEvent.change(screen.getByLabelText(/شناسه/), { target: { value: "santoor" } });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "افزودن ساز" }));

    await screen.findByText("سنتور");
    const persisted = await getInstrumentRepository().list({ per_page: 200 });
    expect(persisted.data.some((i) => i.slug === "santoor")).toBe(true);
  });

  it("rejects a slug that is not a safe machine key", async () => {
    renderPanel();
    await waitForList();

    fireEvent.click(screen.getByRole("button", { name: "افزودن ساز" }));
    fireEvent.change(await screen.findByLabelText(/نام ساز/), { target: { value: "ساز تست" } });
    fireEvent.change(screen.getByLabelText(/شناسه/), { target: { value: "بد اسلاگ!" } });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "افزودن ساز" }));

    await screen.findByText(/شناسه فقط می‌تواند/);
    // Nothing was written.
    const after = await getInstrumentRepository().list({ per_page: 200 });
    expect(after.data.some((i) => i.name === "ساز تست")).toBe(false);
  });

  it("refuses a duplicate slug and keeps the dialog open", async () => {
    renderPanel();
    await waitForList();

    fireEvent.click(screen.getByRole("button", { name: "افزودن ساز" }));
    fireEvent.change(await screen.findByLabelText(/نام ساز/), { target: { value: "پیانوی دوم" } });
    fireEvent.change(screen.getByLabelText(/شناسه/), { target: { value: "piano" } });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "افزودن ساز" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    const after = await getInstrumentRepository().list({ per_page: 200 });
    expect(after.data.filter((i) => i.slug === "piano")).toHaveLength(1);
  });
});

describe("editing", () => {
  it("locks the slug because records reference it", async () => {
    renderPanel();
    await waitForList();

    const row = (await screen.findByText("پیانو")).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "ویرایش" }));

    const slug = (await screen.findByLabelText(/شناسه/)) as HTMLInputElement;
    expect(slug.readOnly).toBe(true);
  });

  it("saves a renamed instrument", async () => {
    renderPanel();
    await waitForList();

    // Read the record first: the point of this case is that an edit touching one
    // field leaves the others alone, which needs something to lose. The seeded
    // guitar really does have a description (catalogue.ts).
    const before = await getInstrumentRepository().get("guitar");
    expect(before.description.length, "the fixture needs a description to lose").toBeGreaterThan(0);

    const row = (await screen.findByText("گیتار")).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "ویرایش" }));

    // The form opens on the record, not on empty create defaults (H6). Asserted
    // here at panel level, through the real click path, because the dialog is
    // mounted closed and only the panel reproduces that sequence.
    const description = (await screen.findByLabelText(/توضیح کوتاه/)) as HTMLTextAreaElement;
    expect(description.value).toBe(before.description);
    expect(
      within(screen.getByRole("dialog")).getByRole("switch", { name: /وضعیت ساز/ }).getAttribute("aria-checked"),
    ).toBe(String(before.active));

    fireEvent.change(await screen.findByLabelText(/نام ساز/), { target: { value: "گیتار کلاسیک" } });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    await screen.findByText("گیتار کلاسیک");
    const persisted = await getInstrumentRepository().get("guitar");
    expect(persisted.name).toBe("گیتار کلاسیک");
    /*
      Before H6 was fixed this case passed while the save erased the record: the
      dialog opened on an empty draft, so the payload carried `description: ""`
      and `active: true` from the create defaults, and the only assertion here
      looked at the name. Every field the edit did not touch is now checked.
    */
    expect(persisted.description, "an edit to the name must not erase the description").toBe(
      before.description,
    );
    expect(persisted.active, "an edit must not re-activate a deactivated instrument").toBe(before.active);
    expect(persisted.slug, "the slug is immutable and is not sent on edit").toBe(before.slug);
  });
});

describe("deactivate and delete", () => {
  it("deactivates an instrument without deleting it", async () => {
    renderPanel();
    await waitForList();

    const row = (await screen.findByText("پیانو")).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "غیرفعال‌سازی" }));

    await waitFor(async () => {
      expect((await getInstrumentRepository().get("piano")).active).toBe(false);
    });
  });

  it("refuses to delete an instrument that students still use", async () => {
    renderPanel();
    await waitForList();

    // `piano` is referenced by seeded students.
    const row = (await screen.findByText("پیانو")).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "حذف" }));

    // Still present: the repository refused and the row survived.
    await waitFor(async () => {
      const after = await getInstrumentRepository().list({ per_page: 200 });
      expect(after.data.some((i) => i.id === "piano")).toBe(true);
    });
    expect(screen.getByText("پیانو")).toBeDefined();
  });

  it("deletes an unreferenced instrument", async () => {
    const created = await getInstrumentRepository().create({
      name: "ساز آزمایشی",
      slug: "temp_instrument",
      description: "",
      active: true,
    });

    renderPanel();
    await waitForList();

    const row = (await screen.findByText("ساز آزمایشی")).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "حذف" }));

    await waitFor(async () => {
      const after = await getInstrumentRepository().list({ per_page: 200 });
      expect(after.data.some((i) => i.id === created.id)).toBe(false);
    });
  });
});
