// @vitest-environment jsdom
/**
 * `DataLifecycleGate` — the boundary that decides whether the app may mount.
 *
 * Placement is the whole point of the gate, so these tests assert the placement
 * rather than the pixels:
 *
 *  - while the state is UNINITIALIZED nothing behind the gate is rendered at all,
 *    because mounting a view would let a read happen before the choice;
 *  - an EMPTY environment is a first-class, fully usable environment and mounts
 *    the app exactly like DEMO does;
 *  - in `api` mode the gate is transparent: the data source is already decided by
 *    configuration, and no lifecycle key is written;
 *  - a dataset that predates the marker mounts the app instead of asking again,
 *    and the adoption is recorded once.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { createSeedDataset } from "@/domains/demo/seed";
import { resetRegistry } from "@/domains/registry";
import { DEMO_STORAGE_KEY, LIFECYCLE_STORAGE_KEY, demoStore } from "@/services/demoStore";
import {
  resetToDemoEnvironment,
  resetToEmptyEnvironment,
  resetToUninitialized,
} from "@/test/demoEnvironment";
import { DataLifecycleGate } from "../DataLifecycleGate";

const APP = "app-behind-the-gate";
const EMPTY_LABEL = "شروع با دادهٔ خالی";
const DEMO_LABEL = "بارگذاری دادهٔ نمونه";

function renderGate() {
  return render(
    <DataLifecycleGate>
      <div data-testid={APP}>{APP}</div>
    </DataLifecycleGate>,
  );
}

const appMounted = () => screen.queryByTestId(APP) !== null;
const choiceOffered = () => screen.queryByRole("button", { name: EMPTY_LABEL }) !== null;

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

describe("what may mount", () => {
  it("renders the choice — and nothing behind it — while UNINITIALIZED", () => {
    renderGate();

    expect(choiceOffered()).toBe(true);
    expect(screen.queryByRole("button", { name: DEMO_LABEL })).not.toBeNull();
    expect(appMounted()).toBe(false);
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBeNull();
  });

  it("mounts the app for an EMPTY environment", () => {
    resetToEmptyEnvironment();

    renderGate();

    expect(appMounted()).toBe(true);
    expect(choiceOffered()).toBe(false);
    expect(demoStore.snapshot().students).toHaveLength(0);
  });

  it("mounts the app for a DEMO environment", () => {
    resetToDemoEnvironment();

    renderGate();

    expect(appMounted()).toBe(true);
    expect(choiceOffered()).toBe(false);
    expect(demoStore.snapshot().students.length).toBeGreaterThan(0);
  });

  it("is transparent in api mode, and writes no lifecycle key", () => {
    setRuntimeConfig({ mode: "api", error: null });

    renderGate();

    expect(appMounted()).toBe(true);
    expect(choiceOffered()).toBe(false);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });
});

describe("the choice, taken through the gate", () => {
  it("mounts the app immediately after EMPTY is chosen — no reload", () => {
    renderGate();
    expect(appMounted()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: EMPTY_LABEL }));

    expect(appMounted()).toBe(true);
    expect(choiceOffered()).toBe(false);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
  });

  it("mounts the app immediately after DEMO is chosen — no reload", () => {
    renderGate();

    fireEvent.click(screen.getByRole("button", { name: DEMO_LABEL }));

    expect(appMounted()).toBe(true);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("demo");
    expect(demoStore.snapshot().students.length).toBeGreaterThan(0);
  });
});

describe("a dataset that predates the lifecycle marker", () => {
  it("mounts the app instead of asking again, and records the adoption once", () => {
    const seeded = createSeedDataset();
    seeded.students = [{ ...seeded.students[0], name: "هنرجوی موجود کاربر" }];
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seeded));
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBeNull();

    renderGate();

    // The visitor is never offered EMPTY/DEMO over data they already have — both
    // options would replace or erase it.
    expect(appMounted()).toBe(true);
    expect(choiceOffered()).toBe(false);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("demo");
    expect(demoStore.snapshot().students[0].name).toBe("هنرجوی موجود کاربر");
    expect(demoStore.snapshot().students).toHaveLength(seeded.students.length);
  });
});
