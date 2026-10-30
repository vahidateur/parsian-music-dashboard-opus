// @vitest-environment jsdom
/**
 * A failed attendance read is disclosed in the summary strip, never printed as 0.
 *
 * Found in the real browser: with the attendance feed answering 5xx (or, before
 * the date-format fix, 422) the strip still stated «غیبت‌های این بازه ۰» and
 * «سابقهٔ اصلاحات ۰» — a measurement about records that could not be read. The
 * tab bodies already showed an ErrorState with a retry; the figures above them
 * did not agree with it.
 *
 * The rule is the product's own (`metricsFailureDisclosure.test.tsx`, D12):
 *
 *   - a failed read renders NO_DATA («—»), never a digit;
 *   - a read that answered with nothing is a real zero and stays «۰» — the fix
 *     must not blank honest empties;
 *   - the rule is per read, so one failure does not hide a sibling's figure.
 *
 * Each failure is a real rejection through the registry's test seam
 * (`setXRepository` + `withStubs`); no hook is mocked.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { emptyPage } from "@/api/types";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import {
  getAttendanceRepository,
  getSchedulingRepository,
  resetRegistry,
  setAttendanceRepository,
  setAuthRepository,
  setSchedulingRepository,
  setUserRepository,
} from "@/domains/registry";
import { NO_DATA } from "@/lib/format";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import { AttendanceView } from "@/views/Attendance";

const flat = (text: string) => text.replace(/\u200c/g, " ").replace(/\s+/g, " ").trim();

const serverFailure = () =>
  new ApiError({ kind: "server", status: 500, code: "SERVER_ERROR", message: "خطای داخلی سرور." });

type Read = "sessions" | "absent" | "corrections";

/** Empty, successful answers everywhere except the reads the case breaks. */
function installReads(failing: readonly Read[]) {
  const attendance = getAttendanceRepository();
  setSchedulingRepository(
    withStubs(getSchedulingRepository(), {
      list: async () => {
        if (failing.includes("sessions")) throw serverFailure();
        return emptyPage();
      },
    }),
  );
  setAttendanceRepository(
    withStubs(attendance, {
      list: async (params) => {
        if (params?.status === "absent" && failing.includes("absent")) throw serverFailure();
        return emptyPage();
      },
      listCorrections: async () => {
        if (failing.includes("corrections")) throw serverFailure();
        return emptyPage();
      },
    }),
  );
}

async function renderView() {
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
  window.location.hash = "#/attendance";
  render(
    <AuthProvider>
      <AppProvider>
        <AttendanceView />
      </AppProvider>
    </AuthProvider>,
  );
}

/** The strip card whose label is `label` (ZWNJ-insensitive), as its visible text. */
function cardText(label: string): string {
  const el = screen
    .getAllByText((_, node) => node?.tagName === "SPAN" && flat(node.textContent ?? "") === label)
    .find((node) => node.closest("div") !== null);
  expect(el, `no strip card labelled «${label}»`).toBeDefined();
  return flat(el!.closest("div")!.textContent ?? "");
}

/** The count badge on a tab, or null when the tab shows none. */
function tabText(label: string): string {
  const tab = screen.getAllByRole("tab").find((node) => flat(node.textContent ?? "").startsWith(label));
  expect(tab, `no tab «${label}»`).toBeDefined();
  return flat(tab!.textContent ?? "");
}

const settledWith = (assertion: () => void) => waitFor(assertion, { timeout: 8000 });

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

describe("attendance summary strip — a failed read is not a zero", () => {
  it("the absences read failing shows «—» and says so, with no «۰» on that card or its tab", async () => {
    installReads(["absent"]);
    await renderView();

    await settledWith(() => expect(cardText("غیبت های این بازه")).toContain("خواندن غیبت"));
    const card = cardText("غیبت های این بازه");
    expect(card).toContain(NO_DATA);
    expect(card).not.toMatch(/[0۰]/);
    expect(tabText("غایبان")).not.toMatch(/[0۰]/);
  });

  it("the corrections read failing shows «—» and says so", async () => {
    installReads(["corrections"]);
    await renderView();

    await settledWith(() => expect(cardText("سابقهٔ اصلاحات")).toContain("خواندن اصلاحات ناموفق بود"));
    const card = cardText("سابقهٔ اصلاحات");
    expect(card).toContain(NO_DATA);
    expect(card).not.toMatch(/[0۰]/);
    expect(tabText("تاریخچه")).not.toMatch(/[0۰]/);
  });

  it("the sessions read failing shows «—» and says so", async () => {
    installReads(["sessions"]);
    await renderView();

    await settledWith(() => expect(cardText("جلسات این بازه")).toContain("ناموفق بود"));
    const card = cardText("جلسات این بازه");
    expect(card).toContain(NO_DATA);
    expect(card).not.toMatch(/[0۰]/);
    expect(tabText("فهرست حاضران")).not.toMatch(/[0۰]/);
  });

  it("reads that answered with nothing stay an honest «۰», and one failure does not blank its siblings", async () => {
    installReads(["absent"]);
    await renderView();
    await settledWith(() => expect(cardText("غیبت های این بازه")).toContain("ناموفق بود"));

    // The sibling reads succeeded with empty pages: those ARE zeros, measured.
    expect(cardText("جلسات این بازه")).toContain("۰");
    expect(cardText("سابقهٔ اصلاحات")).toContain("۰");
    expect(cardText("سابقهٔ اصلاحات")).not.toContain("ناموفق");
  });

  it("with every read answering empty, no card claims a failure", async () => {
    installReads([]);
    await renderView();

    await settledWith(() => expect(cardText("غیبت های این بازه")).toContain("۰"));
    for (const label of ["جلسات این بازه", "غیبت های این بازه", "سابقهٔ اصلاحات"]) {
      expect(cardText(label), label).not.toContain("ناموفق");
      expect(cardText(label), label).not.toContain(NO_DATA);
    }
  });
});
