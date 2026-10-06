// @vitest-environment jsdom
/**
 * A record form must show what the record holds, even when the reference
 * cannot be named.
 *
 * In the client composition the instruments and learning domains have no server
 * (DOMAIN_UNAVAILABLE). An edit form whose stored instrument / course / level is
 * not among the options used to display the FIRST option (a controlled <select>
 * falls back to it), while the draft still held the stored id: the form said
 * "no course" and saved the course. These cases pin the honest behaviour: the
 * stored id stays selectable under a label that says what is known.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { ClassFormDialog } from "@/domains/classes/ClassFormDialog";
import type { AcademyClass } from "@/domains/classes/types";
import { SEEDED_INSTRUMENTS, instrumentChoices } from "@/domains/instruments/catalog";
import { getClassRepository, resetRegistry, setLearningRepository } from "@/domains/registry";
import type { LearningRepository } from "@/domains/learning/repository";
import { createUnavailableRepository } from "@/domains/shared/unavailableRepository";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

beforeEach(() => {
  localStorage.clear();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  resetToDemoEnvironment();
  resetRegistry();
});
afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("instrumentChoices", () => {
  it("offers an id the catalogue cannot name, under its own id, instead of dropping it", () => {
    const choices = instrumentChoices(SEEDED_INSTRUMENTS, "santur");
    const extra = choices.find((c) => c.id === "santur");
    expect(extra?.name).toBe("santur");
    expect(choices.filter((c) => c.id !== "santur")).toHaveLength(SEEDED_INSTRUMENTS.length);
  });

  it("adds nothing for a known, an absent or an inactive-but-known instrument", () => {
    expect(instrumentChoices(SEEDED_INSTRUMENTS, "piano")).toHaveLength(SEEDED_INSTRUMENTS.length);
    expect(instrumentChoices(SEEDED_INSTRUMENTS, undefined)).toHaveLength(SEEDED_INSTRUMENTS.length);
    const inactive = SEEDED_INSTRUMENTS.map((i) => (i.id === "piano" ? { ...i, active: false } : i));
    expect(instrumentChoices(inactive, "piano").map((i) => i.id)).toContain("piano");
    expect(instrumentChoices(inactive, "guitar").map((i) => i.id)).not.toContain("piano");
  });
});

describe("ClassFormDialog — references the client cannot name", () => {
  async function openOn(record: AcademyClass) {
    render(
      <AuthProvider>
        <AppProvider>
          <ClassFormDialog open academyClass={record} onClose={() => {}} onSaved={() => {}} />
        </AppProvider>
      </AuthProvider>,
    );
    await screen.findByRole("dialog");
  }
  const selectedText = (label: RegExp) =>
    Array.from((screen.getByLabelText(label, { selector: "select" }) as HTMLSelectElement).selectedOptions)
      .map((o) => o.textContent)
      .join("");

  it("shows the stored instrument, course and level as themselves when learning is unavailable", async () => {
    setLearningRepository(createUnavailableRepository<LearningRepository>("learning", "مسیرهای یادگیری"));
    const stored = (await getClassRepository().list({ per_page: 1 })).data[0];
    await openOn({ ...stored, instrument: "santur", programId: "program-x", levelId: "level-x" });

    expect(selectedText(/^ساز/)).toBe("santur");
    expect(selectedText(/^دوره/)).toContain("نام در دسترس نیست");
    expect(selectedText(/^سطح دوره/)).toContain("نام در دسترس نیست");
  });

  it("shows no stand-in option when the class has no course or level", async () => {
    setLearningRepository(createUnavailableRepository<LearningRepository>("learning", "مسیرهای یادگیری"));
    const stored = (await getClassRepository().list({ per_page: 1 })).data[0];
    await openOn({ ...stored, programId: undefined, levelId: undefined });

    expect(selectedText(/^دوره/)).toBe("— بدون دوره —");
    expect(selectedText(/^سطح دوره/)).toBe("— بدون سطح —");
  });
});