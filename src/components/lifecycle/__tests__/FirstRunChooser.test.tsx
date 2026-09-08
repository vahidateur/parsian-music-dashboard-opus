// @vitest-environment jsdom
/**
 * First-run choice — the copy contract, and what each option actually does.
 *
 * `FirstRunChooser.tsx` documents these two labels as the product's wording for
 * the choice, so they are asserted verbatim: a restyle must not silently rename
 * the one decision that determines whether a customer gets their own environment
 * or the showcase dataset.
 *
 * The behavioural assertions matter more than the visual ones. The screen tells
 * the visitor that nothing is written before they choose and that choosing never
 * destroys existing data; both claims are checked against storage rather than
 * trusted.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { DEMO_LIBRARY_RESOURCE_ID } from "@/domains/demo/librarySeed";
import { resetRegistry } from "@/domains/registry";
import { DEMO_STORAGE_KEY, LIFECYCLE_STORAGE_KEY, demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment, resetToUninitialized } from "@/test/demoEnvironment";
import { FirstRunChooser } from "../FirstRunChooser";

const EMPTY_LABEL = "شروع با دادهٔ خالی";
const DEMO_LABEL = "بارگذاری دادهٔ نمونه";

beforeEach(() => {
  localStorage.clear();
  resetToUninitialized();
  resetRegistry();
  setRuntimeConfig({ mode: "demo", error: null });
});

afterEach(() => {
  resetRuntimeConfig();
  cleanup();
});

describe("copy contract", () => {
  it("offers both options as real buttons, in the product's exact wording", () => {
    render(<FirstRunChooser />);

    expect(screen.getByRole("button", { name: EMPTY_LABEL })).toBeDefined();
    expect(screen.getByRole("button", { name: DEMO_LABEL })).toBeDefined();
  });

  it("promises no write before the choice, and no destruction of existing data", () => {
    render(<FirstRunChooser />);

    expect(screen.getByText(/هیچ داده‌ای تا پیش از انتخاب شما نوشته نمی‌شود/)).toBeDefined();
    expect(screen.getByText(/جایگزین یا پاک‌کردن دادهٔ موجود نیست/)).toBeDefined();
  });

  it("labels the showcase option as development material, not production data", () => {
    render(<FirstRunChooser />);

    expect(screen.getByText(/مخصوص توسعه، QA و نمایش محصول/)).toBeDefined();
    expect(screen.getByText(/برای دادهٔ عملیاتی نیست/)).toBeDefined();
  });

  it("is RTL", () => {
    render(<FirstRunChooser />);

    expect(document.querySelector("main")?.getAttribute("dir")).toBe("rtl");
  });

  it("writes nothing at all until a choice is made", () => {
    render(<FirstRunChooser />);

    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBeNull();
    expect(demoStore.isInitialized()).toBe(false);
  });
});

describe("choosing", () => {
  it("«شروع با دادهٔ خالی» creates an EMPTY environment that can be signed into", () => {
    render(<FirstRunChooser />);

    fireEvent.click(screen.getByRole("button", { name: EMPTY_LABEL }));

    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
    expect(demoStore.isInitialized()).toBe(true);

    const snapshot = demoStore.snapshot();
    // Zero academy content...
    expect(snapshot.students).toHaveLength(0);
    expect(snapshot.teachers).toHaveLength(0);
    expect(snapshot.resources).toHaveLength(0);
    expect(snapshot.media).toHaveLength(0);
    // ...plus the one account that makes the environment usable.
    expect(snapshot.users).toHaveLength(1);
    expect(snapshot.users[0].role).toBe("administrator");
  });

  it("«بارگذاری دادهٔ نمونه» creates the DEMO showcase environment", () => {
    render(<FirstRunChooser />);

    fireEvent.click(screen.getByRole("button", { name: DEMO_LABEL }));

    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("demo");

    const snapshot = demoStore.snapshot();
    expect(snapshot.students.length).toBeGreaterThan(0);
    expect(snapshot.resources.some((row) => row.id === DEMO_LIBRARY_RESOURCE_ID)).toBe(true);
  });

  it("refuses over an existing environment, and reports that in an alert", () => {
    // The gate would never show the chooser in this state; rendering it directly
    // is what proves the guarantee behind the copy above.
    resetToDemoEnvironment();
    const before = localStorage.getItem(DEMO_STORAGE_KEY);

    render(<FirstRunChooser />);
    fireEvent.click(screen.getByRole("button", { name: EMPTY_LABEL }));

    expect(screen.getByRole("alert").textContent).toContain("از قبل ساخته شده");
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(before);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("demo");
    expect(demoStore.snapshot().students.length).toBeGreaterThan(0);
  });

  it("keeps a second, refused choice from overwriting the first", () => {
    // Symmetry: neither direction of the choice may destroy an environment.
    render(<FirstRunChooser />);
    fireEvent.click(screen.getByRole("button", { name: EMPTY_LABEL }));
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");

    fireEvent.click(screen.getByRole("button", { name: DEMO_LABEL }));

    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
    expect(demoStore.snapshot().students).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toContain("از قبل ساخته شده");
  });
});
