// @vitest-environment jsdom
/**
 * EMPTY-environment audit, part 2 — the panels that live inside Settings rather
 * than on a route of their own.
 *
 * Each case waits for the panel's OWN settled state (its empty-state title) and
 * only then asserts. Waiting for "not loading" would pass on a panel that hangs,
 * and waiting for nothing at all would assert against skeleton markup, so the
 * settled text is part of each case's contract: a panel that never reaches its
 * honest empty state fails here.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { BrandingPanel } from "@/domains/branding/BrandingPanel";
import { GalleryPanel } from "@/domains/gallery/GalleryPanel";
import { InstrumentsPanel } from "@/domains/instruments/InstrumentsPanel";
import { LearningPanel } from "@/domains/learning/LearningPanel";
import { RepertoirePanel } from "@/domains/progress/RepertoirePanel";
import { RoomsPanel } from "@/domains/rooms/RoomsPanel";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToEmptyEnvironment } from "@/test/demoEnvironment";

/** Text that can only reach the DOM through an arithmetic or lookup mistake. */
const ARTEFACTS = ["NaN", "Infinity", "undefined", "[object Object]"] as const;

const PANELS = [
  { name: "سازها", Component: InstrumentsPanel, settlesOn: "هنوز سازی تعریف نشده" },
  { name: "دوره‌ها و سطوح", Component: LearningPanel, settlesOn: "هنوز دوره‌ای تعریف نشده" },
  { name: "گالری", Component: GalleryPanel, settlesOn: "آلبومی وجود ندارد" },
  { name: "اتاق‌ها", Component: RoomsPanel, settlesOn: "هنوز اتاقی ثبت نشده" },
  { name: "رپرتوار", Component: RepertoirePanel, settlesOn: "قطعه‌ای ثبت نشده" },
  // Branding is a singleton, not a collection: it always has a value to show.
  { name: "هویت آموزشگاه", Component: BrandingPanel, settlesOn: "هویت آموزشگاه" },
] as const;

function renderPanel(Component: ComponentType) {
  return render(
    <AuthProvider>
      <AppProvider>
        <Component />
      </AppProvider>
    </AuthProvider>,
  );
}

function expectNoArtefacts(container: HTMLElement, surface: string): void {
  const text = container.textContent ?? "";
  for (const artefact of ARTEFACTS) {
    expect(text, `${surface} rendered "${artefact}"`).not.toContain(artefact);
  }
}

beforeEach(() => {
  localStorage.clear();
  resetToEmptyEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("settings panels over an EMPTY environment", () => {
  it.each(PANELS)("$name reaches its honest empty state", async ({ name, Component, settlesOn }) => {
    const { container } = renderPanel(Component);

    await waitFor(() => expect(screen.getByText(settlesOn)).toBeTruthy());
    expectNoArtefacts(container, name);
  });

  it("the environment really is empty while these panels render", () => {
    const snapshot = demoStore.snapshot();
    for (const name of ["instruments", "programs", "levels", "galleryAlbums", "rooms", "pieces"] as const) {
      expect(snapshot[name], `${name} must be empty`).toHaveLength(0);
    }
  });

  it("instruments lists nothing from a hardcoded fallback", async () => {
    const { container } = renderPanel(InstrumentsPanel);
    await waitFor(() => expect(screen.getByText("هنوز سازی تعریف نشده")).toBeTruthy());

    // The canonical seed's instrument names must not leak into a customer
    // environment that has defined none of them.
    for (const instrument of ["پیانو", "ویولن", "تار", "سنتور"]) {
      expect(container.textContent, `${instrument} appeared without a record`).not.toContain(instrument);
    }
  });

  it("branding shows the academy's own settings, not an empty form", async () => {
    const { container } = renderPanel(BrandingPanel);
    await waitFor(() => expect(screen.getByText("هویت آموزشگاه")).toBeTruthy());

    // An input's value is not part of `textContent`, so read the field itself.
    // A required field's accessible name carries the asterisk, so match loosely.
    const name = screen.getByLabelText(/نام آموزشگاه/) as HTMLInputElement;
    expect(name.value).toBe(demoStore.snapshot().branding.academyName);
    expect(name.value.length).toBeGreaterThan(0);
    expectNoArtefacts(container, "branding");
  });
});
