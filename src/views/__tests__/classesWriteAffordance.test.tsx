// @vitest-environment jsdom
/**
 * A1 — the class detail's write controls follow `classes.write`.
 *
 * WHY THIS FILE EXISTS
 *
 * `ClassDetail` rendered «ویرایش», «بایگانی» and «ثبت‌نام هنرجو» for every
 * session. A teacher and an accountant both hold `classes.read` **without**
 * `classes.write` (matrix: `docs/frontend-completion/05-rbac-access-control.md`),
 * so the detail panel offered controls the register says must not be rendered at
 * all — "if false, no write control rendered (not disabled)". The roster's own
 * add control was already gated; the detail panel was the outlier, while its
 * sibling `TeacherDetail` gates its own write control (`mayWrite`).
 *
 * These cases assert the BEHAVIOUR, not the gate's shape:
 *
 *   - without `classes.write` the three write controls are absent, and the
 *     attendance NAVIGATION beside them is untouched;
 *   - with `classes.write` all three render exactly as before;
 *   - the roster's pre-existing gating is unchanged.
 *
 * The session is real (`DemoAuthRepository`, the seeded demo users), the classes
 * are real repository rows, and every assertion is made on what the operator can
 * actually reach in the DOM.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { getClassRepository, resetRegistry, setAuthRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { ClassesView } from "@/views/Classes";

/** The three controls the detail may offer only with `classes.write`. */
const EDIT = /ویرایش/;
/** Matches both «بایگانی» and «بایگانی‌شده», so the archived state stays covered. */
const ARCHIVE = /بایگانی/;
/** ZWNJ is optional in the pattern so the name matches however it is written. */
const ENROLL = /ثبت\u200c?نام هنرجو/;
const WRITE_CONTROLS = [EDIT, ARCHIVE, ENROLL] as const;
const ATTENDANCE = /حضور و غیاب/;
const ROSTER_ADD = /کلاس جدید/;

/** Seeded demo users, one per role the matrix distinguishes here. */
const TEACHER = "teacher1@demo.local";
const ACCOUNTANT = "finance@demo.local";
const MANAGER = "manager@demo.local";
const ADMINISTRATOR = "admin@demo.local";

function hasButton(name: RegExp): boolean {
  return screen.queryAllByRole("button", { name }).length > 0;
}

/** Signs in as a real seeded user; the views read the session, not a stub. */
async function signInAs(email: string) {
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  await auth.login({ email, password: DEMO_PASSPHRASE });
}

function renderClasses(hash: string) {
  window.location.hash = hash;
  return render(
    <AuthProvider>
      <AppProvider>
        <ClassesView />
      </AppProvider>
    </AuthProvider>,
  );
}

/** Waits for the view's bounded reads to answer before asserting on the DOM. */
async function settled() {
  await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0), { timeout: 8000 });
}

async function firstClassId(): Promise<string> {
  const row = (await getClassRepository().list({ per_page: 1 })).data[0];
  expect(row, "the demo seed must ship at least one class").toBeDefined();
  return row.id;
}

describe("the class detail's write controls follow classes.write", () => {
  beforeEach(() => {
    resetToDemoEnvironment();
    resetRegistry();
  });

  afterEach(() => {
    cleanup();
    resetRegistry();
    window.location.hash = "";
  });

  it("hides ویرایش/بایگانی/ثبت‌نام هنرجو from a teacher, who holds classes.read only", async () => {
    await signInAs(TEACHER);
    renderClasses(`#/classes/${await firstClassId()}`);
    await settled();

    // Positive control: the detail really rendered and its navigation is intact…
    expect(hasButton(ATTENDANCE), "the attendance navigation must render").toBe(true);
    // …while none of the three write controls is offered.
    for (const control of WRITE_CONTROLS) {
      expect(hasButton(control), `a teacher must not be offered ${control}`).toBe(false);
    }
  });

  it("hides them from an accountant, who also holds classes.read only", async () => {
    await signInAs(ACCOUNTANT);
    renderClasses(`#/classes/${await firstClassId()}`);
    await settled();

    expect(hasButton(ATTENDANCE), "the attendance navigation must render").toBe(true);
    for (const control of WRITE_CONTROLS) {
      expect(hasButton(control), `an accountant must not be offered ${control}`).toBe(false);
    }
  });

  it("renders all three for an administrator, exactly as before", async () => {
    await signInAs(ADMINISTRATOR);
    renderClasses(`#/classes/${await firstClassId()}`);
    await settled();

    expect(hasButton(ATTENDANCE), "the attendance navigation must render").toBe(true);
    for (const control of WRITE_CONTROLS) {
      expect(hasButton(control), `an administrator must be offered ${control}`).toBe(true);
    }
  });

  it("renders all three for a manager, exactly as before", async () => {
    await signInAs(MANAGER);
    renderClasses(`#/classes/${await firstClassId()}`);
    await settled();

    expect(hasButton(ATTENDANCE), "the attendance navigation must render").toBe(true);
    for (const control of WRITE_CONTROLS) {
      expect(hasButton(control), `a manager must be offered ${control}`).toBe(true);
    }
  });

  it("keeps the attendance navigation independent of the write permission", async () => {
    // The same teacher session, on the roster first, then the detail: the
    // navigation control is present in both places and in neither case is it a
    // consequence of a write permission.
    await signInAs(TEACHER);
    renderClasses("#/classes");
    await settled();
    expect(hasButton(ROSTER_ADD), "this case needs a non-writing session").toBe(false);

    cleanup();
    renderClasses(`#/classes/${await firstClassId()}`);
    await settled();
    expect(hasButton(ATTENDANCE)).toBe(true);
    expect(hasButton(EDIT)).toBe(false);
  });

  it("leaves the roster's own gating unchanged: no add control for a non-writing role", async () => {
    await signInAs(TEACHER);
    renderClasses("#/classes");
    await settled();

    expect(hasButton(ROSTER_ADD), "a teacher must not be offered the roster add control").toBe(false);
  });

  it("leaves the roster's own gating unchanged: the add control stays for a writing role", async () => {
    await signInAs(MANAGER);
    renderClasses("#/classes");
    await settled();

    expect(hasButton(ROSTER_ADD), "a manager must be offered the roster add control").toBe(true);
  });
});
