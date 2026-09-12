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
 *    configuration, and no lifecycle key or recovery controller is written;
 *  - a dataset that predates the marker mounts the app instead of asking again,
 *    and the adoption is recorded once;
 *  - a cleared local environment can be uninitialized outside the signed-in shell,
 *    then returns to the chooser and either local environment.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { createSeedDataset } from "@/domains/demo/seed";
import { resetRegistry } from "@/domains/registry";
import { useLifecycleRecovery } from "../LifecycleRecoveryContext";
import { DEMO_STORAGE_KEY, LIFECYCLE_STORAGE_KEY, demoStore } from "@/services/demoStore";
import {
  resetToDemoEnvironment,
  resetToEmptyEnvironment,
  resetToUninitialized,
} from "@/test/demoEnvironment";
import { LoginView } from "@/views/Login";
import { DataLifecycleGate } from "../DataLifecycleGate";

const APP = "app-behind-the-gate";
const EMPTY_LABEL = "شروع با دادهٔ خالی";
const DEMO_LABEL = "بارگذاری دادهٔ نمونه";
const RECOVERY_START = "شروع دوباره و انتخاب محیط";
const RECOVERY_TITLE = "شروع دوباره و حذف کامل محیط";
const RECOVERY_CONFIRM = "تأیید و حذف محیط";
const RECOVERY_CANCEL = "انصراف";

function RecoveryContextProbe() {
  const recovery = useLifecycleRecovery();
  return <div data-testid="recovery-context">{recovery ? "present" : "absent"}</div>;
}

function renderGate() {
  return render(
    <DataLifecycleGate>
      <div data-testid={APP}>{APP}</div>
      <RecoveryContextProbe />
    </DataLifecycleGate>,
  );
}

function AuthBranch() {
  const { status } = useAuth();
  if (status === "restoring") return <div role="status">در حال بررسی نشست…</div>;
  if (status === "unauthenticated") return <LoginView />;
  return <div data-testid={APP}>{APP}</div>;
}

function renderBoot() {
  return render(
    <DataLifecycleGate>
      <AuthProvider>
        <AuthBranch />
      </AuthProvider>
    </DataLifecycleGate>,
  );
}

function lockOutLocalEnvironment(kind: "empty" | "demo") {
  if (kind === "empty") resetToEmptyEnvironment();
  else resetToDemoEnvironment();

  const result = new DemoDataManager().clear({ confirm: true });
  expect(result).toMatchObject({ ok: true });
  expect(demoStore.snapshot().users).toHaveLength(0);
}

async function waitForRecoveryButton() {
  await waitFor(() => expect(screen.getByRole("button", { name: RECOVERY_START })).not.toBeNull());
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
    expect(screen.getByTestId("recovery-context").textContent).toBe("present");
    expect(demoStore.snapshot().students).toHaveLength(0);
  });

  it("mounts the app for a DEMO environment", () => {
    resetToDemoEnvironment();

    renderGate();

    expect(appMounted()).toBe(true);
    expect(choiceOffered()).toBe(false);
    expect(demoStore.snapshot().students.length).toBeGreaterThan(0);
  });

  it("is transparent in api mode and exposes no local recovery controller", () => {
    setRuntimeConfig({ mode: "api", error: null });

    renderGate();

    expect(appMounted()).toBe(true);
    expect(choiceOffered()).toBe(false);
    expect(screen.getByTestId("recovery-context").textContent).toBe("absent");
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
    expect(appMounted()).toBe(false);

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

describe("lockout recovery outside the signed-in shell", () => {
  it("keeps a cleared environment unchanged when recovery confirmation is cancelled", async () => {
    lockOutLocalEnvironment("empty");
    renderBoot();
    await waitForRecoveryButton();

    fireEvent.click(screen.getByRole("button", { name: RECOVERY_START }));

    expect(screen.getByRole("heading", { name: RECOVERY_TITLE })).toBeTruthy();
    expect(screen.getByText("مجموع رکوردها").parentElement?.textContent).toContain("۰");
    expect(screen.getByText("حساب‌های دسترسی").parentElement?.textContent).toContain("۰");

    fireEvent.click(screen.getByRole("button", { name: RECOVERY_CANCEL }));

    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
    expect(demoStore.isInitialized()).toBe(true);
    expect(screen.queryByRole("heading", { name: RECOVERY_TITLE })).toBeNull();
    expect(screen.getByRole("button", { name: RECOVERY_START })).toBeTruthy();
  });

  it.each([
    ["EMPTY", "empty", EMPTY_LABEL],
    ["DEMO", "demo", DEMO_LABEL],
  ] as const)("returns from lockout to the %s chooser path", async (_label, expectedState, choiceLabel) => {
    lockOutLocalEnvironment("empty");
    renderBoot();
    await waitForRecoveryButton();

    fireEvent.click(screen.getByRole("button", { name: RECOVERY_START }));
    fireEvent.click(screen.getByRole("button", { name: RECOVERY_CONFIRM }));

    await waitFor(() => expect(screen.getByRole("button", { name: EMPTY_LABEL })).not.toBeNull());
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("محیط حذف شد");

    fireEvent.click(screen.getByRole("button", { name: choiceLabel }));

    await waitFor(() => expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe(expectedState));
    expect(demoStore.isInitialized()).toBe(true);
    expect(screen.queryByRole("button", { name: choiceLabel })).toBeNull();

    if (expectedState === "empty") {
      expect(demoStore.snapshot().users).toHaveLength(1);
      expect(demoStore.snapshot().students).toHaveLength(0);
    } else {
      expect(demoStore.snapshot().students.length).toBeGreaterThan(0);
    }
  });
});
