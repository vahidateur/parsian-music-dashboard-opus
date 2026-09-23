// @vitest-environment jsdom
/**
 * `useDerived` — the student-scoped derived reads (OPEN_ITEMS I13, Checkpoint 3A).
 *
 *   A derived read exposes either the value belonging to the student it was
 *   asked for, or an explicit in-flight state for that student. It never exposes
 *   the previous student's placement or eligible content.
 *
 * WHY THIS FILE EXISTS. `useStudentPlacement` and `useEligibleContent` share one
 * hand-rolled loader, `useDerived`, which kept `data`/`loading`/`error` in state
 * with no record of which student they answered and set `loading` inside an
 * effect. When `studentId` changed, the render that followed committed the
 * PREVIOUS student's placement and eligible content with `loading === false` —
 * the same shape `useResourceList` had before I13 Checkpoint 1, one boundary
 * over. Eligibility is derived from links and placements, so that frame is not
 * cosmetic: it shows one student's unlocked material under another's name.
 *
 * TEST DISCIPLINE — read this before adding a case.
 *
 * None of these tests may wait for `loading === false` and then look at the
 * data. `loading` is one of the values under test, so a wait keyed to it can be
 * satisfied by the very frame being asserted against — that is how I11 passed
 * vacuously and how I13 survived. Every case instead records **each committed
 * render** from inside the render body and asserts over the whole history:
 *
 *   - no frame asked for one student while exposing another student's data;
 *   - every frame that exposed nothing said it was in flight;
 *   - a same-key refetch never emptied the read (the anti-flicker half — without
 *     it this could be "fixed" by blanking on every data-version bump);
 *   - a late response from the previous student still cannot land, and its
 *     request is still aborted (the pre-existing ticket/cancellation contract).
 *
 * A render-phase log needs no timer to land inside a one-frame window, and act()
 * flushing effects cannot hide a frame that was already committed.
 *
 * Both hooks are covered in the same cases on purpose: they share the boundary,
 * so a fix that reached only one of them would leave half the exposure open.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import { getLearningRepository, resetRegistry, setLearningRepository } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import type { LearningRepository } from "../repository";
import type { EligibleContent, LearningContent, StudentPlacement } from "../types";
import { useEligibleContent, useStudentPlacement } from "../useLearning";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const AT = "2026-01-01T00:00:00.000Z";

/** A placement whose owner is readable straight off the row. */
function placementFor(studentId: string): StudentPlacement {
  return {
    id: `pl-${studentId}`,
    studentId,
    programId: `pg-${studentId}`,
    levelId: `lv-${studentId}-1`,
    assignedAt: AT,
    history: [],
  };
}

function contentRow(id: string): LearningContent {
  return {
    id,
    resourceId: id,
    title: `محتوای ${id}`,
    description: "",
    type: "pdf",
    visibility: "students",
    createdAt: AT,
    active: true,
  };
}

/** Eligible content whose ids name the student the read was for. */
function eligibleFor(studentId: string): EligibleContent[] {
  return [1, 2].map((order) => ({
    content: contentRow(`lc-${studentId}-${order}`),
    levelId: `lv-${studentId}-${order}`,
    levelOrder: order,
    levelName: `سطح ${order}`,
    sortOrder: order - 1,
  }));
}

/** Which student a content id was minted for. */
function ownerOf(contentId: string): string {
  return contentId.slice("lc-".length, contentId.lastIndexOf("-"));
}

/* ------------------------------------------------------------------ */
/* A repository whose derived reads the test settles by hand           */
/* ------------------------------------------------------------------ */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Stubs<R> = { [K in keyof R]?: R[K] };

/**
 * Overrides two verbs and delegates the rest. A spread would not work: the demo
 * repositories keep their methods on the prototype.
 */
function withStubs<R extends object>(repository: R, stubs: Stubs<R>): R {
  return new Proxy(repository, {
    get(target, prop, receiver) {
      if (prop in stubs) return stubs[prop as keyof R];
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as R;
}

/** Every ask per student, in order, so a superseded one can be settled late. */
type Asks<T> = Map<string, Deferred<T>[]>;

function ask<T>(asks: Asks<T>, id: string): Deferred<T> {
  const pending = deferred<T>();
  const previous = asks.get(id) ?? [];
  asks.set(id, [...previous, pending]);
  return pending;
}

function latest<T>(asks: Asks<T>, id: string): Deferred<T> | undefined {
  const all = asks.get(id);
  return all?.[all.length - 1];
}

function controlledLearning() {
  const placements: Asks<StudentPlacement | undefined> = new Map();
  const eligibles: Asks<EligibleContent[]> = new Map();
  const aborted: string[] = [];

  const repository = withStubs(getLearningRepository(), {
    getStudentPlacement: (studentId: string, signal?: AbortSignal) => {
      signal?.addEventListener("abort", () => aborted.push(`placement:${studentId}`));
      return ask(placements, studentId).promise;
    },
    eligibleContent: (studentId: string, signal?: AbortSignal) => {
      signal?.addEventListener("abort", () => aborted.push(`eligible:${studentId}`));
      return ask(eligibles, studentId).promise;
    },
  } satisfies Stubs<LearningRepository>);

  setLearningRepository(repository);

  return {
    /** Lets student `id`'s newest placement read resolve. */
    settlePlacement: (id: string, value?: StudentPlacement) =>
      latest(placements, id)?.resolve(value ?? placementFor(id)),
    /** Lets a SPECIFIC — possibly superseded — placement read resolve. */
    settlePlacementAsk: (id: string, index: number, value: StudentPlacement | undefined) =>
      placements.get(id)?.[index]?.resolve(value),
    failPlacement: (id: string, cause: unknown) => latest(placements, id)?.reject(cause),
    settleEligible: (id: string, value?: EligibleContent[]) =>
      latest(eligibles, id)?.resolve(value ?? eligibleFor(id)),
    failEligible: (id: string, cause: unknown) => latest(eligibles, id)?.reject(cause),
    /** Settles both newest reads for one student, which is the normal case. */
    settle: (id: string) => {
      latest(placements, id)?.resolve(placementFor(id));
      latest(eligibles, id)?.resolve(eligibleFor(id));
    },
    aborted,
    asked: (id: string) => placements.has(id) && eligibles.has(id),
    placementAsks: (id: string) => placements.get(id)?.length ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Render-phase frame log                                              */
/* ------------------------------------------------------------------ */

/** One committed render, exactly as a consumer would have seen it. */
interface Frame {
  /** The student the hooks were asked about ("" when asked about nobody). */
  asked: string;
  /** Whose placement was on screen, or null when there was none. */
  placementFor: string | null;
  /** Which program that placement named, so a late value is distinguishable. */
  placementProgram: string | null;
  placementLoading: boolean;
  placementErrored: boolean;
  /** Whose eligible content was on screen. */
  eligibleOwners: string[];
  eligibleLoading: boolean;
}

function Probe({ studentId, log }: { studentId: string | undefined; log: Frame[] }) {
  const placement = useStudentPlacement(studentId);
  const eligible = useEligibleContent(studentId);

  // Render-phase recording: this is the point of the suite. See the header.
  log.push({
    asked: studentId ?? "",
    placementFor: placement.data?.studentId ?? null,
    placementProgram: placement.data?.programId ?? null,
    placementLoading: placement.loading,
    placementErrored: placement.error !== null,
    eligibleOwners: eligible.data.map((row) => ownerOf(row.content.id)),
    eligibleLoading: eligible.loading,
  });

  return (
    <div>
      <span data-testid="placement">{placement.data?.studentId ?? "none"}</span>
      <span data-testid="eligible">{eligible.data.length}</span>
      <button
        type="button"
        data-testid="reload"
        onClick={() => {
          placement.reload();
          eligible.reload();
        }}
      >
        بازخوانی
      </button>
    </div>
  );
}

function mountProbe(studentId: string | undefined) {
  const log: Frame[] = [];
  const view = render(<Probe studentId={studentId} log={log} />);
  return {
    log,
    last: () => log[log.length - 1],
    framesFor: (asked: string) => log.filter((frame) => frame.asked === asked),
    switchTo: (next: string | undefined) => view.rerender(<Probe studentId={next} log={log} />),
  };
}

/** Waits until the reads for `id` are on screen — by DATA, never by `loading`. */
async function settledOn(probe: ReturnType<typeof mountProbe>, id: string): Promise<void> {
  await waitFor(() => {
    const frame = probe.last();
    expect(frame.placementFor).toBe(id);
    expect(frame.eligibleOwners).toEqual([id, id]);
  });
}

describe("useDerived — a student-scoped read never exposes another student's data", () => {
  it("student A → student B: no committed frame pairs B with A's placement or A's eligible content", async () => {
    const repo = controlledLearning();
    const probe = mountProbe("st_a");

    act(() => repo.settle("st_a"));
    await settledOn(probe, "st_a");
    const framesBeforeSwitch = probe.log.length;

    probe.switchTo("st_b");

    // The frame committed by the switch itself is the one under test, and it is
    // already in the log before any effect has run.
    const switchFrames = probe.log.slice(framesBeforeSwitch);
    expect(switchFrames.length).toBeGreaterThan(0);
    const askedForB = probe.framesFor("st_b");
    expect(askedForB.length).toBeGreaterThan(0);

    for (const frame of askedForB) {
      expect(
        frame.placementFor === "st_a",
        `a frame asked for st_b exposed st_a's placement (loading=${frame.placementLoading})`,
      ).toBe(false);
      expect(
        frame.eligibleOwners.some((owner) => owner === "st_a"),
        `a frame asked for st_b exposed st_a's eligible content (loading=${frame.eligibleLoading})`,
      ).toBe(false);
      // And whatever it did expose, it must be B's own data or an honest
      // in-flight state — never "nothing" claimed as settled.
      if (frame.placementFor === null) expect(frame.placementLoading).toBe(true);
      if (frame.eligibleOwners.length === 0) expect(frame.eligibleLoading).toBe(true);
    }

    act(() => repo.settle("st_b"));
    await settledOn(probe, "st_b");
    // The frames asserted above were committed before B resolved, so they prove
    // the window rather than the end state.
    expect(probe.framesFor("st_b")[0].placementFor).not.toBe("st_a");
  });

  it("both reads of the shared boundary are covered, not just one of them", async () => {
    const repo = controlledLearning();
    const probe = mountProbe("st_a");
    act(() => repo.settle("st_a"));
    await settledOn(probe, "st_a");

    probe.switchTo("st_b");
    const firstFrameForB = probe.framesFor("st_b")[0];

    // Asserted separately so that a fix reaching only one of the two hooks
    // fails on its own line rather than hiding behind the other.
    expect(firstFrameForB.placementFor, "useStudentPlacement exposed the previous student").toBeNull();
    expect(firstFrameForB.placementLoading).toBe(true);
    expect(firstFrameForB.eligibleOwners, "useEligibleContent exposed the previous student").toEqual([]);
    expect(firstFrameForB.eligibleLoading).toBe(true);
  });

  it("the previous student's error is never exposed as this student's error", async () => {
    const repo = controlledLearning();
    const probe = mountProbe("st_a");

    act(() => {
      repo.failPlacement("st_a", new ApiError({ kind: "not_found", code: "PLACEMENT_NOT_FOUND", message: "یافت نشد." }));
      repo.failEligible("st_a", new ApiError({ kind: "server", code: "SERVER", message: "خطا." }));
    });
    await waitFor(() => expect(probe.last().placementErrored).toBe(true));

    probe.switchTo("st_b");

    for (const frame of probe.framesFor("st_b")) {
      // B has not been asked about anything yet: an error on screen here is A's.
      if (frame.placementFor === null) expect(frame.placementErrored).toBe(false);
    }
    expect(probe.framesFor("st_b")[0].placementErrored).toBe(false);
    expect(probe.framesFor("st_b")[0].placementLoading).toBe(true);

    act(() => repo.settle("st_b"));
    await settledOn(probe, "st_b");
    expect(probe.last().placementErrored).toBe(false);
  });

  it("switching to no student at all drops the previous student's derived read", async () => {
    const repo = controlledLearning();
    const probe = mountProbe("st_a");
    act(() => repo.settle("st_a"));
    await settledOn(probe, "st_a");

    probe.switchTo(undefined);

    for (const frame of probe.framesFor("")) {
      expect(frame.placementFor, "nobody is selected, so nobody's placement may show").toBeNull();
      expect(frame.eligibleOwners).toEqual([]);
      expect(frame.placementLoading).toBe(true);
      expect(frame.eligibleLoading).toBe(true);
    }
    // `undefined` resolves immediately without touching the repository, so the
    // honest end state is "settled, with nothing" — which is not the same frame
    // as "in flight", and must not be reached by showing st_a on the way.
    await waitFor(() => expect(probe.last().placementLoading).toBe(false));
    expect(probe.last().placementFor).toBeNull();
  });

  it("a same-key refetch keeps the data it already has, so a data-version bump cannot blank the read", async () => {
    const repo = controlledLearning();
    const probe = mountProbe("st_a");
    act(() => repo.settle("st_a"));
    await settledOn(probe, "st_a");
    const framesBefore = probe.log.length;

    // A write anywhere in the app bumps the global data version, which re-reads
    // every mounted query. That is a refetch of the SAME student.
    act(() => bumpDataVersion());

    for (const frame of probe.log.slice(framesBefore)) {
      expect(frame.asked).toBe("st_a");
      expect(frame.placementFor, "a refetch must not blank the placement").toBe("st_a");
      expect(frame.eligibleOwners, "a refetch must not blank the eligible content").toEqual(["st_a", "st_a"]);
    }

    act(() => repo.settle("st_a"));
    await settledOn(probe, "st_a");
  });

  it("reload() re-reads the same student without emptying the read", async () => {
    const repo = controlledLearning();
    const probe = mountProbe("st_a");
    act(() => repo.settle("st_a"));
    await settledOn(probe, "st_a");
    const framesBefore = probe.log.length;

    fireEvent.click(screen.getByTestId("reload"));

    for (const frame of probe.log.slice(framesBefore)) {
      expect(frame.placementFor).toBe("st_a");
      expect(frame.eligibleOwners).toEqual(["st_a", "st_a"]);
    }
    act(() => repo.settle("st_a"));
    await settledOn(probe, "st_a");
  });

  it("a late response from the previous student cannot overwrite the current one, and its request was aborted", async () => {
    const repo = controlledLearning();
    const probe = mountProbe("st_a");
    expect(repo.asked("st_a")).toBe(true);

    // Switch before A answers at all, then let B win the race.
    probe.switchTo("st_b");
    act(() => repo.settle("st_b"));
    await settledOn(probe, "st_b");

    // A answers late. The ticket guard must discard it — this behaviour predates
    // the fix and is asserted here so the fix cannot regress it.
    act(() => repo.settle("st_a"));
    await act(async () => Promise.resolve());

    expect(probe.last().placementFor).toBe("st_b");
    expect(probe.last().eligibleOwners).toEqual(["st_b", "st_b"]);
    expect(repo.aborted, "the superseded placement request must be aborted").toContain("placement:st_a");
    expect(repo.aborted, "the superseded eligibility request must be aborted").toContain("eligible:st_a");
  });

  it("a superseded same-key refetch answering late cannot overwrite the newer one", async () => {
    const repo = controlledLearning();
    const probe = mountProbe("st_a");
    act(() => repo.settle("st_a"));
    await settledOn(probe, "st_a");

    // A write anywhere bumps the data version, so the SAME student is read
    // again; the first ask is superseded and aborted.
    act(() => bumpDataVersion());
    expect(repo.placementAsks("st_a")).toBe(2);

    // The superseded ask answers late, with a value that would be visibly wrong
    // if it landed. The ticket guard must discard it — this behaviour predates
    // the fix and is pinned so the fix cannot regress it.
    act(() =>
      repo.settlePlacementAsk("st_a", 0, { ...placementFor("st_a"), programId: "pg_LATE" }),
    );
    await act(async () => Promise.resolve());
    expect(probe.last().placementProgram, "a superseded response landed").not.toBe("pg_LATE");
    expect(probe.last().placementFor, "the refetch must not have blanked the read").toBe("st_a");

    // The current ask answers and wins.
    act(() => repo.settle("st_a"));
    await settledOn(probe, "st_a");
    expect(probe.last().placementProgram).toBe("pg-st_a");
    expect(repo.aborted).toContain("placement:st_a");
  });
});
