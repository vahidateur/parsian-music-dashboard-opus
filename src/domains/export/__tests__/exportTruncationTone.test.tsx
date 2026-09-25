// @vitest-environment jsdom
/**
 * S5-A — a truncated export is announced as a WARNING, not as a success.
 *
 * WHY THIS FILE EXISTS
 *
 * A truncated export was reported with `tone: "warn"`. The toast
 * contract does not have that tone — `Toast.tone` is
 * `"success" | "info" | "warning" | "danger"` (AppContext.tsx) — and `Toasts`
 * keys every branch on `"warning"`. So the one toast that must not look like a
 * success rendered with the *info* glyph and none of the warning styling: the
 * message said «خروجی با محدودیت» while the surface said "everything is fine".
 * The typechecker flagged both call sites (TS2322); nothing tested the runtime
 * consequence, which is why the two outliers survived.
 *
 * WHAT THESE CASES ASSERT
 *
 * The behaviour, not the literal: after a REAL click on the REAL control, the
 * toast region must carry the warning tone's own styling (`text-warn-400`) when
 * the service reports truncation, and the success tone's own styling
 * (`text-gold-300`) when it does not. The positive control matters as much as
 * the regression case — without it, a test that only looked for «هشدار» would
 * still pass if the discriminator were wired backwards.
 *
 * The session is a real seeded demo administrator (it holds every export
 * permission), the control is the shipped one, and the assertion is made on the
 * DOM the operator actually sees. Only the service call is stubbed, because
 * truncation needs a repository page of more than a thousand rows, which the
 * demo seed does not carry; the stub replaces the far side of the click, never
 * the surface under test.
 *
 * SCOPE NOTE — the same literal was corrected in `ImportExportCenter.tsx:154`,
 * but that surface cannot be exercised from here: its permission guard can never
 * answer true, so the export half of the panel renders for no role at all
 * (recorded as OPEN_ITEMS I22; to be fixed in its own slice). Until then this
 * file covers the surface a regression test can actually reach.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { Toasts } from "@/components/overlays/ActionSheet";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { resetRegistry, setAuthRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { EntityExportButton } from "@/domains/export/EntityExportButton";

/**
 * The far side of the click. Everything else in `exportService` — the labels,
 * the permissions, `downloadTable` — stays real, so the permission-filtered
 * options and the control itself behave exactly as shipped.
 */
const mocked = vi.hoisted(() => ({ exportEntity: vi.fn() }));
vi.mock("@/domains/export/exportService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domains/export/exportService")>()),
  exportEntity: mocked.exportEntity,
}));

const ADMIN = "admin@demo.local";
const TRUNCATED = { count: 1000, total: 1043, truncated: true };
const COMPLETE = { count: 12, total: 12, truncated: false };

/** The toast region the shell mounts (`Toasts` marks it `aria-live="polite"`). */
function toast(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

/** The toast region's markup, so the tone's own styling can be asserted. */
function toastHtml(): string {
  return document.querySelector('[aria-live="polite"]')?.innerHTML ?? "";
}

async function signInAs(email: string) {
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  await auth.login({ email, password: DEMO_PASSPHRASE });
}

/**
 * Clicks a control once it exists. `AuthProvider` restores the session in an
 * effect, so on the first frame the surfaces are still deciding whether the
 * control may render at all — the wait is part of the contract, not a sleep.
 */
async function clickControl(name: RegExp) {
  fireEvent.click(await screen.findByRole("button", { name }));
}

function renderWithToasts(node: React.ReactNode) {
  return render(
    <AuthProvider>
      <AppProvider>
        {node}
        {/* The shell mounts the toast region (`App.tsx`); a panel rendered on
            its own would announce nothing. */}
        <Toasts />
      </AppProvider>
    </AuthProvider>,
  );
}

describe("a truncated export is announced as a warning (S5-A)", () => {
  beforeEach(() => {
    resetToDemoEnvironment();
    resetRegistry();
    mocked.exportEntity.mockReset();
  });

  afterEach(() => {
    cleanup();
    resetRegistry();
  });

  it("EntityExportButton: a truncated file raises a warning-toned toast", async () => {
    mocked.exportEntity.mockResolvedValue(TRUNCATED);
    await signInAs(ADMIN);
    renderWithToasts(<EntityExportButton entity="students" />);

    await clickControl(/خروجی هنرجویان CSV/);

    await waitFor(() => expect(toast()).toContain("خروجی با محدودیت"));
    expect(toast()).toContain("سقف ۱۰۰۰ ردیف");
    expect(toastHtml()).toContain("text-warn-400");
  });

  it("EntityExportButton: a complete file stays a success", async () => {
    mocked.exportEntity.mockResolvedValue(COMPLETE);
    await signInAs(ADMIN);
    renderWithToasts(<EntityExportButton entity="students" />);

    await clickControl(/خروجی هنرجویان CSV/);

    await waitFor(() => expect(toast()).toContain("خروجی آماده شد"));
    expect(toastHtml()).toContain("text-gold-300");
    expect(toastHtml()).not.toContain("text-warn-400");
  });
});
