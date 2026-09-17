// @vitest-environment jsdom
/**
 * `useDerivedRead` — the scheduling derived reads (OPEN_ITEMS I13, Checkpoint 3B).
 *
 *   A derived read exposes either the value belonging to the query it was asked
 *   about, or an explicit in-flight state for that query. It never exposes the
 *   previous query's roster, plan or conflict report.
 *
 * WHY THIS FILE EXISTS. `useSessionRoster`, `useGenerationPreview` and
 * `useConflictCheck` share one hand-rolled loader, `useDerivedRead`, which kept
 * `data`/`loading`/`error` in state with no record of which query they answered
 * and set `loading` inside an effect. When the selected session changed, the
 * render that followed committed the PREVIOUS session's roster with
 * `loading === false` — the shape `useResourceList` had before I13 Checkpoint 1
 * and learning's `useDerived` had before Checkpoint 3A, one boundary over. A
 * roster is a list of students, so that frame is not cosmetic: it shows one
 * session's students under another session's heading, and the generation
 * preview it sits beside describes a window the operator has already left.
 *
 * None of the three had a shipped consumer when this was written — M4's
 * scheduling view is the first — which is why the exposure was recorded rather
 * than reproduced, and why the pre-existing case in `useScheduling.test.tsx`
 * says outright that it "asserts the outcome rather than claiming to pin the
 * frame". This file pins the frame.
 *
 * TEST DISCIPLINE — read this before adding a case.
 *
 * None of these tests may wait for `loading === false` and then look at the
 * data. `loading` is one of the values under test, so a wait keyed to it can be
 * satisfied by the very frame being asserted against — that is how I11 passed
 * vacuously and how I13 survived. Every case instead records **each committed
 * render** from inside the render body and asserts over the whole history:
 *
 *   - no frame asked for one query while exposing another query's value;
 *   - every frame that exposed nothing said it was in flight;
 *   - a frame that had nothing to ask for said it was NOT in flight (the other
 *     half of honesty: an eternal spinner for a read nobody issued is a lie too);
 *   - a same-key refetch never emptied the read (the anti-flicker half — without
 *     it this could be "fixed" by blanking on every data-version bump);
 *   - a late response from the previous query still cannot land, and its request
 *     is still aborted (the pre-existing ticket/cancellation contract).
 *
 * A render-phase log needs no timer to land inside a one-frame window, and act()
 * flushing effects cannot hide a frame that was already committed.
 *
 * All three hooks are covered in the same cases on purpose: they share the
 * boundary, so a fix that reached only one of them would leave two thirds of the
 * exposure open.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import { getSchedulingRepository, resetRegistry, setSchedulingRepository } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import type { SchedulingRepository } from "../repository";
import type {
  ConflictReport,
  GenerateInput,
  GenerationPlan,
  RosterEntry,
  SessionCandidate,
} from "../types";
import { useConflictCheck, useGenerationPreview, useSessionRoster } from "../useScheduling";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/* ------------------------------------------------------------------ */
/* Fixtures — every value names the query it was minted for            */
/* ------------------------------------------------------------------ */

/** Which session a roster entry was minted for. */
function ownerOf(studentId: string): string {
  return studentId.slice("st_".length);
}

/** A roster whose students name the session the read was for. */
function rosterFor(sessionId: string): RosterEntry[] {
  return [1, 2].map((order) => ({
    studentId: `st_${sessionId}_${order}`,
    studentName: `هنرجوی ${sessionId} — ${order}`,
  }));
}

/** The window a plan answers, readable straight off the plan. */
function windowOf(plan: GenerationPlan): string {
  return `${plan.classId}|${plan.from}|${plan.to}`;
}

function planFor(input: GenerateInput): GenerationPlan {
  return {
    classId: input.classId,
    from: input.from,
    to: input.to,
    creates: [],
    updates: [],
    skips: [],
    orphans: [],
    conflicts: { hard: [], warnings: [], ok: true },
  };
}

function inputFor(from: string, to: string): GenerateInput {
  return { classId: "cl_1", from, to };
}

/** A candidate whose id makes the report it produces identifiable. */
function candidateFor(sessionId: string, date: string): SessionCandidate {
  return {
    id: sessionId,
    classId: "cl_1",
    date,
    startTime: "10:00",
    endTime: "11:00",
    teacherId: "t_1",
    roomId: "r_1",
  };
}

/**
 * A report that names the candidate it answers.
 *
 * `ConflictReport` carries no query identity of its own — it is a pure answer —
 * so the stub puts the candidate's id where a consumer would legitimately read
 * it (`conflictingSessionId`) and the frame log reads it back from there.
 */
function reportFor(candidate: SessionCandidate): ConflictReport {
  return {
    hard: [],
    warnings: [
      {
        kind: "SESSION_OFF_SCHEDULE",
        severity: "warning",
        message: `گزارش تعارض برای ${candidate.id ?? candidate.date}`,
        conflictingSessionId: candidate.id,
      },
    ],
    ok: true,
  };
}

/** The hook's own key for a candidate, so the stub is asked in the same terms. */
function candidateKey(candidate: SessionCandidate): string {
  return [
    candidate.id ?? "",
    candidate.classId,
    candidate.date,
    candidate.startTime,
    candidate.endTime,
    candidate.teacherId,
    candidate.roomId,
  ].join("|");
}

/** The hook's own key for a generation window. */
function planKey(input: GenerateInput): string {
  return `${input.classId}|${input.from}|${input.to}|${input.confirmUpdates ?? false}`;
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

/** Every ask per query key, in order, so a superseded one can be settled late. */
type Asks<T> = Map<string, Deferred<T>[]>;

function ask<T>(asks: Asks<T>, key: string): Deferred<T> {
  const pending = deferred<T>();
  const previous = asks.get(key) ?? [];
  asks.set(key, [...previous, pending]);
  return pending;
}

function latest<T>(asks: Asks<T>, key: string): Deferred<T> | undefined {
  const all = asks.get(key);
  return all?.[all.length - 1];
}

function controlledScheduling() {
  const rosters: Asks<RosterEntry[]> = new Map();
  const plans: Asks<GenerationPlan> = new Map();
  const reports: Asks<ConflictReport> = new Map();
  const aborted: string[] = [];

  const repository = withStubs(getSchedulingRepository(), {
    sessionRoster: (sessionId: string, signal?: AbortSignal) => {
      signal?.addEventListener("abort", () => aborted.push(`roster:${sessionId}`));
      return ask(rosters, sessionId).promise;
    },
    previewGeneration: (input: GenerateInput, signal?: AbortSignal) => {
      const key = planKey(input);
      signal?.addEventListener("abort", () => aborted.push(`plan:${key}`));
      return ask(plans, key).promise;
    },
    checkConflicts: (candidate: SessionCandidate, signal?: AbortSignal) => {
      const key = candidateKey(candidate);
      signal?.addEventListener("abort", () => aborted.push(`conflicts:${key}`));
      return ask(reports, key).promise;
    },
  } satisfies Stubs<SchedulingRepository>);

  setSchedulingRepository(repository);

  return {
    /** Lets the newest roster read for one session resolve. */
    settleRoster: (sessionId: string, value?: RosterEntry[]) =>
      latest(rosters, sessionId)?.resolve(value ?? rosterFor(sessionId)),
    /** Lets a SPECIFIC — possibly superseded — roster read resolve. */
    settleRosterAsk: (sessionId: string, index: number, value: RosterEntry[]) =>
      rosters.get(sessionId)?.[index]?.resolve(value),
    failRoster: (sessionId: string, cause: unknown) => latest(rosters, sessionId)?.reject(cause),
    settlePlan: (input: GenerateInput) => latest(plans, planKey(input))?.resolve(planFor(input)),
    settleReport: (candidate: SessionCandidate) =>
      latest(reports, candidateKey(candidate))?.resolve(reportFor(candidate)),
    /** Settles all three newest reads for one session/window/candidate trio. */
    settle: (props: ProbeProps) => {
      if (props.sessionId) latest(rosters, props.sessionId)?.resolve(rosterFor(props.sessionId));
      if (props.input && props.enabled !== false) {
        latest(plans, planKey(props.input))?.resolve(planFor(props.input));
      }
      if (props.candidate) {
        latest(reports, candidateKey(props.candidate))?.resolve(reportFor(props.candidate));
      }
    },
    aborted,
    rosterAsks: (sessionId: string) => rosters.get(sessionId)?.length ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Render-phase frame log                                              */
/* ------------------------------------------------------------------ */

interface ProbeProps {
  sessionId: string | undefined;
  input: GenerateInput | undefined;
  enabled?: boolean;
  candidate: SessionCandidate | undefined;
}

/** One committed render, exactly as a consumer would have seen it. */
interface Frame {
  /** The session the roster read was asked about ("" when asked about nobody). */
  askedSession: string;
  /** Whose students were on screen. */
  rosterOwners: string[];
  rosterLoading: boolean;
  rosterErrored: boolean;
  /** The window the preview was asked about ("" when nothing was asked for). */
  askedWindow: string;
  /** Which window the plan on screen answers. */
  planWindow: string | null;
  planLoading: boolean;
  /** The candidate the conflict read was asked about ("" when none). */
  askedCandidate: string;
  /** Which candidate the report on screen answers. */
  reportOwner: string | null;
  conflictLoading: boolean;
}

function Probe({ sessionId, input, enabled = true, candidate, log }: ProbeProps & { log: Frame[] }) {
  const roster = useSessionRoster(sessionId);
  const preview = useGenerationPreview(input, enabled);
  const conflicts = useConflictCheck(candidate);

  // Render-phase recording: this is the point of the suite. See the header.
  log.push({
    askedSession: sessionId ?? "",
    rosterOwners: (roster.data ?? []).map((row) => ownerOf(row.studentId)),
    rosterLoading: roster.loading,
    rosterErrored: roster.error !== null,
    askedWindow: input && enabled ? planKey(input) : "",
    planWindow: preview.data ? windowOf(preview.data) : null,
    planLoading: preview.loading,
    askedCandidate: candidate ? candidateKey(candidate) : "",
    reportOwner: conflicts.data?.warnings[0]?.conflictingSessionId ?? null,
    conflictLoading: conflicts.loading,
  });

  return (
    <div>
      <span data-testid="roster">{(roster.data ?? []).map((row) => row.studentId).join(",") || "none"}</span>
      <span data-testid="plan">{preview.data ? windowOf(preview.data) : "none"}</span>
      <span data-testid="report">{conflicts.data?.warnings[0]?.conflictingSessionId ?? "none"}</span>
      <button
        type="button"
        data-testid="reload"
        onClick={() => {
          roster.reload();
          preview.reload();
          conflicts.reload();
        }}
      >
        بازخوانی
      </button>
    </div>
  );
}

const SESSION_A = "ses_a";
const SESSION_B = "ses_b";
const WINDOW_1 = inputFor("2026-10-01", "2026-10-07");
const WINDOW_2 = inputFor("2026-10-08", "2026-10-14");
const CANDIDATE_A = candidateFor(SESSION_A, "2026-10-03");
const CANDIDATE_B = candidateFor(SESSION_B, "2026-10-10");

/** The trio a settled screen shows: one session, its window, its candidate. */
const PROPS_A: ProbeProps = { sessionId: SESSION_A, input: WINDOW_1, candidate: CANDIDATE_A };
const PROPS_B: ProbeProps = { sessionId: SESSION_B, input: WINDOW_2, candidate: CANDIDATE_B };

function mountProbe(props: ProbeProps) {
  const log: Frame[] = [];
  const view = render(<Probe {...props} log={log} />);
  return {
    log,
    last: () => log[log.length - 1],
    framesFor: (sessionId: string) => log.filter((frame) => frame.askedSession === sessionId),
    switchTo: (next: ProbeProps) => view.rerender(<Probe {...next} log={log} />),
  };
}

type ProbeView = ReturnType<typeof mountProbe>;

/** Waits until the reads for `props` are on screen — by DATA, never by `loading`. */
async function settledOn(probe: ProbeView, props: ProbeProps): Promise<void> {
  await waitFor(() => {
    const frame = probe.last();
    expect(frame.rosterOwners.length).toBeGreaterThan(0);
    expect(frame.rosterOwners.every((owner) => owner.startsWith(props.sessionId ?? ""))).toBe(true);
    expect(frame.planWindow).toBe(props.input ? `${props.input.classId}|${props.input.from}|${props.input.to}` : null);
    expect(frame.reportOwner).toBe(props.candidate?.id ?? null);
  });
}

describe("useDerivedRead — a scheduling derived read never exposes another query's data", () => {
  it("session A → session B: no committed frame pairs B with A's roster, plan or report", async () => {
    const repo = controlledScheduling();
    const probe = mountProbe(PROPS_A);

    act(() => repo.settle(PROPS_A));
    await settledOn(probe, PROPS_A);
    const framesBeforeSwitch = probe.log.length;

    probe.switchTo(PROPS_B);

    // The frame committed by the switch itself is the one under test, and it is
    // already in the log before any effect has run.
    expect(probe.log.length).toBeGreaterThan(framesBeforeSwitch);
    const askedForB = probe.framesFor(SESSION_B);
    expect(askedForB.length).toBeGreaterThan(0);

    for (const frame of askedForB) {
      expect(
        frame.rosterOwners.some((owner) => owner.startsWith(SESSION_A)),
        `a frame asked for ${SESSION_B} exposed ${SESSION_A}'s roster (loading=${frame.rosterLoading})`,
      ).toBe(false);
      expect(
        frame.planWindow !== null && frame.planWindow.includes(WINDOW_1.from),
        `a frame asked for ${WINDOW_2.from}..${WINDOW_2.to} exposed the previous window's plan`,
      ).toBe(false);
      expect(
        frame.reportOwner === SESSION_A,
        `a frame asked about ${SESSION_B} exposed ${SESSION_A}'s conflict report`,
      ).toBe(false);

      // And whatever it did expose, it must be B's own data or an honest
      // in-flight state — never "nothing" claimed as settled.
      if (frame.rosterOwners.length === 0) expect(frame.rosterLoading).toBe(true);
      if (frame.planWindow === null) expect(frame.planLoading).toBe(true);
      if (frame.reportOwner === null) expect(frame.conflictLoading).toBe(true);
    }

    act(() => repo.settle(PROPS_B));
    await settledOn(probe, PROPS_B);
    // The frames asserted above were committed before B resolved, so they prove
    // the window rather than the end state.
    expect(probe.framesFor(SESSION_B)[0].rosterOwners).toEqual([]);
  });

  it("all three reads of the shared boundary are covered, not just one of them", async () => {
    const repo = controlledScheduling();
    const probe = mountProbe(PROPS_A);
    act(() => repo.settle(PROPS_A));
    await settledOn(probe, PROPS_A);

    probe.switchTo(PROPS_B);
    const firstFrameForB = probe.framesFor(SESSION_B)[0];

    // Asserted separately so that a fix reaching only one of the three hooks
    // fails on its own line rather than hiding behind the other two.
    expect(firstFrameForB.rosterOwners, "useSessionRoster exposed the previous session").toEqual([]);
    expect(firstFrameForB.rosterLoading).toBe(true);
    expect(firstFrameForB.planWindow, "useGenerationPreview exposed the previous window").toBeNull();
    expect(firstFrameForB.planLoading).toBe(true);
    expect(firstFrameForB.reportOwner, "useConflictCheck exposed the previous candidate").toBeNull();
    expect(firstFrameForB.conflictLoading).toBe(true);
  });

  it("the previous session's failure is never exposed as this session's error", async () => {
    const repo = controlledScheduling();
    const probe = mountProbe(PROPS_A);

    act(() => {
      repo.failRoster(
        SESSION_A,
        new ApiError({ kind: "not_found", code: "SESSION_NOT_FOUND", message: "جلسه یافت نشد." }),
      );
    });
    await waitFor(() => expect(probe.last().rosterErrored).toBe(true));

    probe.switchTo(PROPS_B);

    const firstFrameForB = probe.framesFor(SESSION_B)[0];
    // B has not been asked about anything yet: an error on screen here is A's.
    expect(firstFrameForB.rosterErrored).toBe(false);
    expect(firstFrameForB.rosterLoading).toBe(true);
    for (const frame of probe.framesFor(SESSION_B)) {
      if (frame.rosterOwners.length === 0) expect(frame.rosterErrored, "A's error outlived the switch").toBe(false);
    }

    act(() => repo.settle(PROPS_B));
    await settledOn(probe, PROPS_B);
    expect(probe.last().rosterErrored).toBe(false);
  });

  it("selecting nothing drops the previous session's reads and is NOT reported as in flight", async () => {
    const repo = controlledScheduling();
    const probe = mountProbe(PROPS_A);
    act(() => repo.settle(PROPS_A));
    await settledOn(probe, PROPS_A);

    probe.switchTo({ sessionId: undefined, input: undefined, enabled: false, candidate: undefined });

    const nothingFrames = probe.log.filter(
      (frame) => frame.askedSession === "" && frame.askedWindow === "" && frame.askedCandidate === "",
    );
    expect(nothingFrames.length).toBeGreaterThan(0);
    for (const frame of nothingFrames) {
      expect(frame.rosterOwners, "nobody is selected, so nobody's roster may show").toEqual([]);
      expect(frame.planWindow).toBeNull();
      expect(frame.reportOwner).toBeNull();
      // The other half of honesty: nothing was asked for, so nothing is pending.
      // An eternal in-flight marker for a read that was never issued is a lie of
      // the same family as a false empty.
      expect(frame.rosterLoading).toBe(false);
      expect(frame.planLoading).toBe(false);
      expect(frame.conflictLoading).toBe(false);
    }
  });

  it("a mount with nothing selected starts settled and empty, not in flight", () => {
    controlledScheduling();
    const probe = mountProbe({ sessionId: undefined, input: undefined, candidate: undefined });

    expect(probe.log.length).toBeGreaterThan(0);
    for (const frame of probe.log) {
      expect(frame.rosterOwners).toEqual([]);
      expect(frame.rosterLoading).toBe(false);
      expect(frame.planLoading).toBe(false);
      expect(frame.conflictLoading).toBe(false);
    }
    expect(screen.getByTestId("roster").textContent).toBe("none");
  });

  it("a same-key refetch keeps the data it already has, so a data-version bump cannot blank the read", async () => {
    const repo = controlledScheduling();
    const probe = mountProbe(PROPS_A);
    act(() => repo.settle(PROPS_A));
    await settledOn(probe, PROPS_A);
    const framesBefore = probe.log.length;

    // A write anywhere in the app bumps the global data version, which re-reads
    // every mounted query. That is a refetch of the SAME session and window.
    act(() => bumpDataVersion());

    const refetchFrames = probe.log.slice(framesBefore);
    expect(refetchFrames.length).toBeGreaterThan(0);
    for (const frame of refetchFrames) {
      expect(frame.askedSession).toBe(SESSION_A);
      expect(frame.rosterOwners, "a refetch must not blank the roster").toEqual([
        `${SESSION_A}_1`,
        `${SESSION_A}_2`,
      ]);
      expect(frame.planWindow, "a refetch must not blank the preview").toBe(`cl_1|${WINDOW_1.from}|${WINDOW_1.to}`);
      expect(frame.reportOwner, "a refetch must not blank the conflict report").toBe(SESSION_A);
    }

    act(() => repo.settle(PROPS_A));
    await settledOn(probe, PROPS_A);
  });

  it("reload() re-reads the same session without emptying the read", async () => {
    const repo = controlledScheduling();
    const probe = mountProbe(PROPS_A);
    act(() => repo.settle(PROPS_A));
    await settledOn(probe, PROPS_A);
    const framesBefore = probe.log.length;

    fireEvent.click(screen.getByTestId("reload"));

    for (const frame of probe.log.slice(framesBefore)) {
      expect(frame.rosterOwners).toEqual([`${SESSION_A}_1`, `${SESSION_A}_2`]);
      expect(frame.reportOwner).toBe(SESSION_A);
    }
    act(() => repo.settle(PROPS_A));
    await settledOn(probe, PROPS_A);
  });

  it("a late response from the previous session cannot overwrite the current one, and its request was aborted", async () => {
    const repo = controlledScheduling();
    const probe = mountProbe(PROPS_A);
    expect(repo.rosterAsks(SESSION_A)).toBe(1);

    // Switch before A answers at all, then let B win the race.
    probe.switchTo(PROPS_B);
    act(() => repo.settle(PROPS_B));
    await settledOn(probe, PROPS_B);

    // A answers late. The ticket guard must discard it — this behaviour predates
    // the fix and is asserted here so the fix cannot regress it.
    act(() => repo.settle(PROPS_A));
    await act(async () => Promise.resolve());

    expect(probe.last().rosterOwners).toEqual([`${SESSION_B}_1`, `${SESSION_B}_2`]);
    expect(probe.last().reportOwner).toBe(SESSION_B);
    expect(repo.aborted, "the superseded roster request must be aborted").toContain(`roster:${SESSION_A}`);
    expect(probe.last().planWindow).toBe(`cl_1|${WINDOW_2.from}|${WINDOW_2.to}`);
    expect(repo.aborted, "the superseded preview request must be aborted").toContain(`plan:${planKey(WINDOW_1)}`);
    expect(repo.aborted, "the superseded conflict request must be aborted").toContain(
      `conflicts:${candidateKey(CANDIDATE_A)}`,
    );
  });

  it("a superseded same-key refetch answering late cannot overwrite the newer one", async () => {
    const repo = controlledScheduling();
    const probe = mountProbe(PROPS_A);
    act(() => repo.settle(PROPS_A));
    await settledOn(probe, PROPS_A);

    // A write anywhere bumps the data version, so the SAME session is read
    // again; the first ask is superseded and aborted.
    act(() => bumpDataVersion());
    expect(repo.rosterAsks(SESSION_A)).toBe(2);

    // The superseded ask answers late, with a value that would be visibly wrong
    // if it landed. The ticket guard must discard it — this behaviour predates
    // the fix and is pinned so the fix cannot regress it.
    act(() =>
      repo.settleRosterAsk(SESSION_A, 0, [
        { studentId: "st_LATE_1", studentName: "هنرجوی دیررس" },
      ]),
    );
    await act(async () => Promise.resolve());
    expect(probe.last().rosterOwners, "a superseded response landed").not.toContain("LATE_1");
    expect(probe.last().rosterOwners, "the refetch must not have blanked the roster").toEqual([
      `${SESSION_A}_1`,
      `${SESSION_A}_2`,
    ]);

    // The current ask answers and wins.
    act(() => repo.settleRoster(SESSION_A));
    await settledOn(probe, PROPS_A);
    expect(probe.last().rosterOwners).toEqual([`${SESSION_A}_1`, `${SESSION_A}_2`]);
    expect(repo.aborted).toContain(`roster:${SESSION_A}`);
  });
});
