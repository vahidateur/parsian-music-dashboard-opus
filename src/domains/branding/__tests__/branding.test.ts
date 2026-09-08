// @vitest-environment jsdom
/**
 * Branding persistence and validation.
 *
 * Branding is the one place where user input reaches the CSS layer, so the
 * validation tests matter as much as the persistence ones.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoBrandingRepository } from "../demoRepository";
import { applyBranding } from "../useBranding";
import { DEFAULT_BRANDING, isHexColor } from "../types";
import { ApiError } from "@/api/errors";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

let repo: DemoBrandingRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  repo = new DemoBrandingRepository();
});

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string[]> | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.fields : undefined;
  }
}

describe("persistence", () => {
  it("starts from the default identity", async () => {
    const branding = await repo.get();
    expect(branding.academyName).toBe(DEFAULT_BRANDING.academyName);
  });

  it("saves the academy name and reads it back", async () => {
    await repo.update({ academyName: "آموزشگاه موسیقی نوا" });
    expect((await repo.get()).academyName).toBe("آموزشگاه موسیقی نوا");

    // Persisted in the store, not just in the instance.
    expect(new DemoBrandingRepository()).toBeDefined();
    expect((await new DemoBrandingRepository().get()).academyName).toBe("آموزشگاه موسیقی نوا");
  });

  it("saves colours and the Persian font", async () => {
    const saved = await repo.update({
      primaryColor: "#123456",
      accentColor: "#abcdef",
      textColor: "#FFFFFF",
      persianFont: "Estedad",
    });
    expect(saved.primaryColor).toBe("#123456");
    expect(saved.persianFont).toBe("Estedad");
  });

  it("stamps updatedAt on every save", async () => {
    const before = await repo.get();
    const after = await repo.update({ tagline: "موسیقی برای همه" });
    expect(after.updatedAt).not.toBe(before.updatedAt);
  });

  it("trims whitespace from the name", async () => {
    const saved = await repo.update({ academyName: "   پارسیان   " });
    expect(saved.academyName).toBe("پارسیان");
  });

  it("survives a demo reset by returning to the default", async () => {
    await repo.update({ academyName: "موقت" });
    resetToDemoEnvironment();
    expect((await new DemoBrandingRepository().get()).academyName).toBe(DEFAULT_BRANDING.academyName);
  });
});

describe("validation", () => {
  it("rejects an empty academy name", async () => {
    expect(await fieldsOf(repo.update({ academyName: " " }))).toHaveProperty("academyName");
  });

  it("rejects a colour that is not #RRGGBB", async () => {
    for (const bad of ["red", "#fff", "#12345", "rgb(0,0,0)", "#GGGGGG", "url(x)"]) {
      const fields = await fieldsOf(repo.update({ primaryColor: bad }));
      expect(fields, `"${bad}" should be rejected`).toHaveProperty("primaryColor");
    }
  });

  it("rejects a font outside the supported list", async () => {
    expect(await fieldsOf(repo.update({ persianFont: "ComicSans" }))).toHaveProperty("persianFont");
  });

  it("rejects a logo reference that does not resolve", async () => {
    expect(await fieldsOf(repo.update({ logoMediaId: "md_missing" }))).toHaveProperty("logoMediaId");
  });

  it("leaves stored values untouched when validation fails", async () => {
    const before = await repo.get();
    await fieldsOf(repo.update({ primaryColor: "javascript:alert(1)" }));
    expect((await repo.get()).primaryColor).toBe(before.primaryColor);
  });
});

describe("applying branding to the DOM", () => {
  it("writes validated values into CSS custom properties", () => {
    const root = document.createElement("div");
    applyBranding({ ...DEFAULT_BRANDING, primaryColor: "#112233", persianFont: "Sahel" }, root);
    expect(root.style.getPropertyValue("--brand-primary")).toBe("#112233");
    expect(root.style.getPropertyValue("--brand-font-fa")).toBe("Sahel");
  });

  it("refuses to write an invalid colour even if one reaches it", () => {
    const root = document.createElement("div");
    // Simulates a restored backup predating a validation rule.
    applyBranding({ ...DEFAULT_BRANDING, primaryColor: "expression(evil)" }, root);
    expect(root.style.getPropertyValue("--brand-primary")).toBe("");
  });

  it("guards the hex test itself", () => {
    expect(isHexColor("#AABBCC")).toBe(true);
    expect(isHexColor("#aabbcc")).toBe(true);
    expect(isHexColor("#AABBC")).toBe(false);
    expect(isHexColor("AABBCC")).toBe(false);
  });
});
