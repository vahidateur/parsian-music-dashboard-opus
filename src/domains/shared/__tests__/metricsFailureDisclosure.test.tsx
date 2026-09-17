// @vitest-environment jsdom
/**
 * A failed dashboard read is disclosed, never reported as zero.
 *
 * `useAcademyMetrics` reads six repositories as one set and `useHeroStats`
 * prints four of its figures. Before this file, a rejection anywhere in that set
 * was answered with the zero-filled initial snapshot, so the dashboard stated
 * «۰ هنرجوی فعال» and «۰٪ اشغال ظرفیت» — measurements — about an academy whose
 * records could not be read at all. That was reachable in the shipped
 * configuration, not only in theory: five of the six sources resolve to the API
 * repositories in api mode (`src/domains/registry.ts`), and the client throws
 * `ApiError` for an unreadable server response (`src/api/client.ts`).
 *
 * The rule pinned here is the product's own, applied one surface further:
 *
 *   - `null` renders NO_DATA («—»), never a digit — as `attendanceRatePct`
 *     already does in `attendanceMetric.test.tsx` ("reports null, never 0") and
 *     as the panels already do in `panelsEmpty.test.tsx` ("never a zero it did
 *     not measure");
 *   - a failed read is a failure, never an empty one — D12.
 *
 * Every case drives a real rejection through the registry's existing test seam
 * (`setXRepository` + `withStubs`, the pair `staleQueryGates.test.tsx` uses), so
 * no case mocks a hook, and the reads that are not stubbed are the real demo
 * reads against the real store.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { demoStore, memoryStorage } from "@/services/demoStore";
import {
  getAttendanceRepository,
  getClassRepository,
  getEnrollmentRepository,
  getRoomRepository,
  getStudentRepository,
  getTeacherRepository,
  resetRegistry,
  setAttendanceRepository,
  setAuthRepository,
  setClassRepository,
  setEnrollmentRepository,
  setRoomRepository,
  setStudentRepository,
  setTeacherRepository,
  setUserRepository,
} from "@/domains/registry";
import { ApiError } from "@/api/errors";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { Dashboard } from "@/views/Dashboard";
import { academyIsoDate } from "@/views/relations/academyDay";
import { useAcademyMetrics, useHeroStats } from "../useAcademyMetrics";
import { useDashboardInsights } from "../useDashboardInsights";

const HERO_LABELS = ["هنرجوی فعال", "کلاس فعال", "ثبت‌نام فعال", "اشغال ظرفیت"];

/** The failure every case installs: a transport-level one, the client's kind. */
function networkFailure(): ApiError {
  return new ApiError({ kind: "network", message: "دسترسی به سرویس ممکن نشد." });
}

/** One repository's `list`, made to reject; every other verb still delegates. */
function rejectingList<R extends { list: unknown }>(repository: R): R {
  const reject = async (): Promise<never> => {
    throw networkFailure();
  };
  return withStubs(repository, { list: reject } as Stubs<R>);
}

/** The same seam with a caller-supplied `list`, for the abort case. */
function stubbingList<R extends { list: unknown }>(repository: R, list: () => Promise<never>): R {
  return withStubs(repository, { list } as Stubs<R>);
}

/**
 * A `list` that fails while `failing` is set and delegates to the real
 * repository afterwards.
 *
 * A switch inside the stub rather than a second `setXRepository` call, because
 * the hook resolves its repositories once per mount (`useMemo(…, [])`): a
 * mounted instance keeps the object it was given, which is exactly what a retry
 * then re-reads through.
 */
function switchableRejection<R extends { list: (...args: never[]) => Promise<unknown> }>(repository: R) {
  let failing = true;
  const stub = withStubs(repository, {
    list: ((...args: never[]) => {
      if (failing) return Promise.reject(networkFailure());
      return repository.list(...args);
    }) as R["list"],
  } as Stubs<R>);
  return { stub, setFailing: (value: boolean) => void ((failing = value)) };
}

function renderHooks() {
  return renderHook(() => ({
    metrics: useAcademyMetrics(),
    hero: useHeroStats(),
    insights: useDashboardInsights({ todayIso: academyIsoDate(), nowMinutes: 12 * 60 }),
  }));
}

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});

describe("the aggregate read knows when it has not read", () => {
  it("a successful read reports figures and no error, exactly as before", async () => {
    const { result } = renderHooks();
    await waitFor(() => expect(result.current.metrics.loading).toBe(false));

    expect(result.current.metrics.error).toBeNull();
    expect(result.current.metrics.available).toBe(true);
    expect(result.current.insights.error).toBeNull();
    expect(result.current.hero.stats.map((s) => s.label)).toEqual(HERO_LABELS);
    expect(result.current.hero.stats.every((s) => typeof s.value === "number")).toBe(true);
  });

  it("a rejected students read is reported as an error, not absorbed", async () => {
    setStudentRepository(rejectingList(getStudentRepository()));

    const { result } = renderHooks();
    await waitFor(() => expect(result.current.metrics.loading).toBe(false));

    expect(result.current.metrics.error).not.toBeNull();
    expect(result.current.metrics.error?.kind).toBe("network");
    expect(result.current.metrics.available).toBe(false);
    // The same failure reaches the insight read set through one channel, so the
    // view has something to show rather than a page of silent dashes.
    expect(result.current.insights.error).not.toBeNull();
    expect(result.current.insights.error?.kind).toBe("network");
  });

  it("no hero tile turns a failed read into a factual zero", async () => {
    setStudentRepository(rejectingList(getStudentRepository()));

    const { result } = renderHooks();
    await waitFor(() => expect(result.current.hero.loading).toBe(false));

    // `null` for all four, so each formatter says NO_DATA. The labels and their
    // targets stay: navigation does not depend on having read anything, and
    // removing the tiles would hide the failure behind an absent widget.
    expect(result.current.hero.stats.map((s) => s.value)).toEqual([null, null, null, null]);
    expect(result.current.hero.stats.map((s) => s.label)).toEqual(HERO_LABELS);
    expect(result.current.hero.error).not.toBeNull();
  });

  it("a partial failure: the rate's source fails, the row-derived counts survive", async () => {
    // Attendance feeds the aggregate read and nothing in the insights' own five
    // reads, so this is the case where unavailability must NOT spread: the counts
    // the rows support are still supported.
    setAttendanceRepository(rejectingList(getAttendanceRepository()));

    const { result } = renderHooks();
    await waitFor(() => expect(result.current.metrics.loading).toBe(false));

    expect(result.current.metrics.error).not.toBeNull();
    expect(result.current.metrics.available).toBe(false);
    expect(result.current.insights.error).not.toBeNull();
    expect(result.current.insights.counts.students).toBeGreaterThan(0);
    expect(result.current.insights.counts.records).toBeGreaterThan(0);
    expect(result.current.insights.hasRecords).toBe(true);
    expect(result.current.insights.loading).toBe(false);
  });

  it("a complete failure leaves the set unavailable rather than measured as empty", async () => {
    setStudentRepository(rejectingList(getStudentRepository()));
    setTeacherRepository(rejectingList(getTeacherRepository()));
    setClassRepository(rejectingList(getClassRepository()));
    setRoomRepository(rejectingList(getRoomRepository()));
    setEnrollmentRepository(rejectingList(getEnrollmentRepository()));
    setAttendanceRepository(rejectingList(getAttendanceRepository()));

    const { result } = renderHooks();
    await waitFor(() => expect(result.current.metrics.loading).toBe(false));

    expect(result.current.metrics.available).toBe(false);
    expect(result.current.metrics.error?.kind).toBe("network");
    expect(result.current.hero.stats.every((s) => s.value === null)).toBe(true);
    expect(result.current.insights.error).not.toBeNull();
  });

  it("an aborted read is not reported as a failure", async () => {
    // `apiErrorFromThrown` normalizes an abort to kind "cancelled": a superseded
    // read or an unmounting tree must not leave the dashboard apologising.
    setStudentRepository(
      stubbingList(getStudentRepository(), async () => {
        throw new DOMException("The user aborted a request.", "AbortError");
      }),
    );

    const { result } = renderHooks();
    await waitFor(() => expect(result.current.metrics.loading).toBe(false));

    expect(result.current.metrics.error).toBeNull();
    expect(result.current.hero.error).toBeNull();
    expect(result.current.insights.error).toBeNull();
  });

  it("one retry on the surface that showed the dashes clears them", async () => {
    // One hook instance, not three: `useHeroStats` calls `useAcademyMetrics`
    // itself, so a component that used both hooks would hold two independent
    // reads of the same six repositories. `Dashboard` avoids that by reading once
    // and handing the tiles down to both surfaces — which is what lets its retry
    // clear the whole card instead of half of it.
    const { stub, setFailing } = switchableRejection(getStudentRepository());
    setStudentRepository(stub);

    const { result } = renderHook(() => useHeroStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.stats.every((s) => s.value === null)).toBe(true);

    setFailing(false);
    // `act`, because a retry is an imperative call rather than a user event: its
    // state lands across several updates, and asserting on a frame between them is
    // the race I11 is about, not a property of the hook.
    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.stats.every((s) => typeof s.value === "number")).toBe(true);
    });
    // The four labels survive the whole round trip, failure included — the guard
    // `attendanceMetric.test.tsx` holds over this surface still reads the same.
    expect(result.current.stats.map((s) => s.label)).toEqual(HERO_LABELS);
  });
});

describe("the dashboard shows the disclosure the read set already computed", () => {
  /**
   * The real shell, because the defect was a rendered zero and not an unused
   * field. The auth wiring is the one `dashboardInsightsLive.test.tsx` uses — the
   * Hero greets the signed-in operator — and it deliberately does NOT reset the
   * registry, so the rejection a case installed stays installed.
   */
  async function renderDashboard() {
    const auth = new DemoAuthRepository(demoStore, memoryStorage());
    setAuthRepository(auth);
    setUserRepository(new DemoUserRepository(demoStore));
    await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
    return render(
      <AuthProvider repository={auth}>
        <AppProvider>
          <Dashboard />
        </AppProvider>
      </AuthProvider>,
    );
  }

  function tileFor(label: string): HTMLElement {
    const tile = screen.getByText(label).closest("button");
    expect(tile, `tile «${label}»`).not.toBeNull();
    return tile as HTMLElement;
  }

  it("shows an alert with a retry, and a dash rather than a zero on every affected tile", async () => {
    setStudentRepository(rejectingList(getStudentRepository()));
    await renderDashboard();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("خواندن رکوردها کامل نشد");
    // The shared ErrorState default says the previous information is still
    // valid; here it is not being shown at all, so the wording is overridden.
    expect(alert.textContent).not.toContain("اطلاعات قبلی همچنان معتبرند");
    expect(within(alert).getByRole("button", { name: "تلاش دوباره" })).not.toBeNull();

    for (const label of HERO_LABELS) {
      const text = tileFor(label).textContent ?? "";
      expect(text, `tile «${label}» must not claim a measured figure`).toContain("—");
      expect(text, `tile «${label}» must not print a zero`).not.toContain("۰");
      // A dash must not carry a unit either: «—٪» would print a percent
      // sign on top of a figure nobody measured.
      expect(text).not.toContain("٪");
    }
  });

  it("says nothing about failure when every read answered, and prints the real figures", async () => {
    await renderDashboard();
    await waitFor(() => expect(screen.getByText(HERO_LABELS[0])).toBeTruthy());

    expect(screen.queryByRole("alert")).toBeNull();
    const occupied = tileFor(HERO_LABELS[3]).textContent ?? "";
    expect(occupied).not.toContain("—");
    expect(occupied).toMatch(/[۰-۹]/);
  });

  it("the alert's retry re-reads the set and the disclosure goes away", async () => {
    // Proves the disclosure is wired to a real recovery rather than being a
    // dead-end banner: retry runs the whole read set again, the aggregate
    // included, and a successful pass clears both the alert and the dashes.
    const { stub, setFailing } = switchableRejection(getStudentRepository());
    setStudentRepository(stub);
    await renderDashboard();
    await screen.findByRole("alert");

    setFailing(false);
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(tileFor(HERO_LABELS[1]).textContent).toMatch(/[۰-۹]/);
    expect(tileFor(HERO_LABELS[1]).textContent).not.toContain("—");
  });
});
