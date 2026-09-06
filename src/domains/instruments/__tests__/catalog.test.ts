/**
 * The instrument catalogue — the single synchronous source of truth.
 *
 * These tests exist because removing the `Instrument` union deleted the
 * compiler's ability to catch a bad instrument reference. The guarantees that
 * used to be types are now assertions:
 *
 *   1. the six seeded instruments still exist with their historical ids;
 *   2. the catalogue and the seeded dataset can never disagree;
 *   3. an unknown id degrades to something readable instead of "undefined".
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  SEEDED_INSTRUMENTS,
  SEEDED_INSTRUMENT_IDS,
  findInstrument,
  getInstrumentCatalog,
  instrumentName,
  isKnownInstrument,
  resetInstrumentCatalog,
  setInstrumentCatalog,
} from "../catalog";
import { deriveInstruments } from "@/domains/demo/learningSeed";
import { createSeedDataset } from "@/domains/demo/seed";

beforeEach(() => {
  resetInstrumentCatalog();
});

/**
 * The historical ids. These are load bearing: every existing student, class
 * and resource row, every saved backup and every previously exported CSV
 * stores these exact strings. This list must not change.
 */
const HISTORICAL_IDS = ["piano", "guitar", "voice", "violin", "drums", "theory"];

describe("the six seeded instruments are preserved", () => {
  it("keeps exactly the historical ids", () => {
    expect([...SEEDED_INSTRUMENT_IDS].sort()).toEqual([...HISTORICAL_IDS].sort());
  });

  it("keeps their Persian names", () => {
    expect(instrumentName("piano")).toBe("پیانو");
    expect(instrumentName("guitar")).toBe("گیتار");
    expect(instrumentName("voice")).toBe("آواز");
    expect(instrumentName("violin")).toBe("ویولن");
    expect(instrumentName("drums")).toBe("درامز");
    expect(instrumentName("theory")).toBe("تئوری");
  });

  it("uses the id as the slug, so old references resolve", () => {
    for (const instrument of SEEDED_INSTRUMENTS) {
      expect(instrument.slug).toBe(instrument.id);
    }
  });

  it("ships them all active and uniquely ordered", () => {
    expect(SEEDED_INSTRUMENTS.every((i) => i.active)).toBe(true);
    const orders = SEEDED_INSTRUMENTS.map((i) => i.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("gives every seeded instrument a description", () => {
    expect(SEEDED_INSTRUMENTS.every((i) => i.description.trim().length > 0)).toBe(true);
  });
});

describe("one source of truth", () => {
  it("seeds the dataset from the same definitions the catalogue exposes", () => {
    expect(deriveInstruments()).toEqual([...SEEDED_INSTRUMENTS]);
  });

  it("puts those same instruments in the seeded dataset", () => {
    const dataset = createSeedDataset();
    expect(dataset.instruments.map((i) => i.id).sort()).toEqual([...HISTORICAL_IDS].sort());
  });

  it("hands out copies, so seeding cannot mutate the canonical definitions", () => {
    const seeded = deriveInstruments();
    seeded[0].name = "تغییر داده شد";
    expect(instrumentName(seeded[0].id)).not.toBe("تغییر داده شد");
  });

  it("no longer duplicates the instrument list on organization settings", () => {
    // A second copy of the list was exactly the drift risk this refactor removes.
    const dataset = createSeedDataset();
    expect(dataset.organization).not.toHaveProperty("instruments");
  });
});

describe("resolving names", () => {
  it("falls back to the id for an unknown instrument", () => {
    // A record referencing a deleted instrument must stay readable rather than
    // rendering "undefined" in the middle of a table.
    expect(instrumentName("santoor")).toBe("santoor");
  });

  it("renders an em dash for a missing value", () => {
    expect(instrumentName(undefined)).toBe("—");
    expect(instrumentName("")).toBe("—");
  });

  it("reports whether an id is known", () => {
    expect(isKnownInstrument("violin")).toBe(true);
    expect(isKnownInstrument("santoor")).toBe(false);
  });

  it("returns the whole record when asked", () => {
    expect(findInstrument("violin")?.name).toBe("ویولن");
    expect(findInstrument("santoor")).toBeUndefined();
  });
});

describe("runtime instruments", () => {
  it("resolves an academy-defined instrument once the catalogue is refreshed", () => {
    setInstrumentCatalog([
      ...SEEDED_INSTRUMENTS,
      { id: "ins_1", slug: "santoor", name: "سنتور", description: "", active: true, sortOrder: 7 },
    ]);
    expect(instrumentName("ins_1")).toBe("سنتور");
    expect(isKnownInstrument("ins_1")).toBe(true);
  });

  it("reflects a rename", () => {
    setInstrumentCatalog(
      SEEDED_INSTRUMENTS.map((i) => (i.id === "guitar" ? { ...i, name: "گیتار کلاسیک" } : i)),
    );
    expect(instrumentName("guitar")).toBe("گیتار کلاسیک");
  });

  it("keeps the catalogue sorted by sortOrder", () => {
    setInstrumentCatalog([
      { id: "b", slug: "b", name: "ب", description: "", active: true, sortOrder: 2 },
      { id: "a", slug: "a", name: "الف", description: "", active: true, sortOrder: 1 },
    ]);
    expect(getInstrumentCatalog().map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("restores the seeded set on reset", () => {
    setInstrumentCatalog([{ id: "x", slug: "x", name: "ایکس", description: "", active: true, sortOrder: 1 }]);
    expect(instrumentName("piano")).toBe("piano");

    resetInstrumentCatalog();
    expect(instrumentName("piano")).toBe("پیانو");
  });

  it("starts populated, so the first synchronous render shows real names", () => {
    // No repository read has happened in this test; labels must still resolve.
    expect(getInstrumentCatalog().length).toBe(SEEDED_INSTRUMENTS.length);
  });
});
