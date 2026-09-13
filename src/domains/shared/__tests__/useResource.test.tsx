// @vitest-environment jsdom
/**
 * The query-identity invariant of `useResourceList` (OPEN_ITEMS I13).
 *
 *   A list exposes either records belonging to its current params, or an
 *   explicit in-flight/empty state appropriate to those params. It never
 *   exposes records belonging to a different query.
 *
 * TEST DISCIPLINE — read this before adding a case.
 *
 * None of these tests may wait for `loading === false` and then look at the
 * data. That is the shape that let I11 pass vacuously, and it is the shape that
 * let I13 survive: `loading` is exactly the value under test, so a wait keyed
 * to it can be satisfied by the frame being asserted against.
 *
 * Instead every case records **each committed render** from inside the render
 * body and asserts over the whole history:
 *
 *   - no frame asked for one query while exposing another query's rows;
 *   - every frame that exposed no rows said it was in flight;
 *   - a same-key refetch never emptied the list (the anti-flicker half, without
 *     which "fix" I13 by blanking every list on every data-version bump).
 *
 * A render-phase log needs no timer to land inside a one-frame window, and
 * act() flushing effects cannot hide a frame that was already committed.
 */
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Page } from "@/api/types";
import { bumpDataVersion } from "../dataVersion";
import { useResourceList, type ListState } from "../useResource";

afterEach(cleanup);

interface Row {
  id: string;
  tag: string;
}

interface Params {
  q: string;
}

function pageOf(tag: string, count: number): Page<Row> {
  const data = Array.from({ length: count }, (_, index) => ({ id: `${tag}${index + 1}`, tag }));
  return { data, meta: { page: 1, per_page: 200, total: count } };
}

/** One committed render, as the consumer saw it. */
interface Frame {
  params: string;
  tags: string[];
  total: number;
  loading: boolean;
  errored: boolean;
}

/** A loader whose every resolution the test controls, per query. */
function controlledLoader() {
  const pending = new Map<string, { resolve: (page: Page<Row>) => void; reject: (cause: unknown) => void }>();
  const aborted: string[] = [];
  const loader = (params: Params, signal?: AbortSignal) =>
    new Promise<Page<Row>>((resolve, reject) => {
      pending.set(params.q, { resolve, reject });
      signal?.addEventListener("abort", () => aborted.push(params.q));
    });
  return {
    loader,
    /** How many times this query has been asked for. */
    asked: (q: string) => (pending.has(q) ? 1 : 0),
    aborted,
    settle: (q: string, page: Page<Row>) => pending.get(q)?.resolve(page),
    fail: (q: string, cause: unknown) => pending.get(q)?.reject(cause),
  };
}

function Probe({
  query,
  log,
  loader,
  expose,
}: {
  query: string;
  log: Frame[];
  loader: (params: Params, signal?: AbortSignal) => Promise<Page<Row>>;
  expose: { current: ListState<Row> | null };
}) {
  const state = useResourceList<Row, Params>(loader, { q: query });
  expose.current = state;
  // Render-phase recording: this is the point of the suite. See the header.
  log.push({
    params: query,
    tags: state.items.map((row) => row.tag),
    total: state.total,
    loading: state.loading,
    errored: state.error !== null,
  });
  return <span data-testid="count">{state.items.length}</span>;
}

function mount(query: string, loader: (params: Params, signal?: AbortSignal) => Promise<Page<Row>>) {
  const log: Frame[] = [];
  const expose: { current: ListState<Row> | null } = { current: null };
  const view = render(<Probe query={query} log={log} loader={loader} expose={expose} />);
  return {
    log,
    expose,
    last: () => log[log.length - 1],
    switchTo: (next: string) => view.rerender(<Probe query={next} log={log} loader={loader} expose={expose} />),
  };
}

describe("useResourceList — a list never exposes another query's records", () => {
  it("params change: no committed frame pairs one query with another query's rows", async () => {
    const { loader, settle } = controlledLoader();
    const probe = mount("A", loader);

    settle("A", pageOf("A", 2));
    await waitFor(() => expect(probe.last().tags).toEqual(["A", "A"]));
    const settledOnA = probe.log.length;
    expect(probe.last().loading).toBe(false);

    // Switch queries and leave the new one in flight.
    probe.switchTo("B");
    expect(probe.last().params).toBe("B");

    settle("B", pageOf("B", 3));
    await waitFor(() => expect(probe.last().tags).toEqual(["B", "B", "B"]));

    // THE INVARIANT. Under the previous implementation this is where two frames
    // appeared with params=B and A's rows — one of them with loading=false, so
    // no marker existed to wait for.
    const violations = probe.log.filter((frame) => frame.params === "B" && frame.tags.some((tag) => tag !== "B"));
    expect(violations).toEqual([]);

    // ...and the frames that exposed no rows must have said they were in
    // flight, so a consumer cannot read "no rows" as "this query is empty".
    const inFlight = probe.log.filter((frame) => frame.params === "B" && frame.tags.length === 0);
    expect(inFlight.length).toBeGreaterThan(0);
    expect(inFlight.every((frame) => frame.loading)).toBe(true);
    // The stale `total` is part of the same lie: it fed the heading counts.
    expect(inFlight.every((frame) => frame.total === 0)).toBe(true);

    // A's own frames were all A's, before and after the switch.
    expect(
      probe.log.slice(0, settledOnA).every((frame) => frame.params === "A" && frame.tags.every((tag) => tag === "A")),
    ).toBe(true);
  });

  it("same-key refetch: rows are kept, so a data-version bump cannot blank every list", async () => {
    const { loader, settle } = controlledLoader();
    const probe = mount("A", loader);

    settle("A", pageOf("A", 2));
    await waitFor(() => expect(probe.last().tags).toEqual(["A", "A"]));
    const settledOnA = probe.log.length;

    // Every persisted write anywhere in the app bumps the global data version,
    // which re-runs every list's effect with the SAME key. Emptying here would
    // flicker every list in the product after any mutation.
    act(() => {
      bumpDataVersion();
    });
    settle("A", pageOf("A", 3));
    await waitFor(() => expect(probe.last().tags).toEqual(["A", "A", "A"]));

    const emptied = probe.log.slice(settledOnA).filter((frame) => frame.tags.length === 0);
    expect(emptied).toEqual([]);
    // It did refetch, and it did report the refetch as in flight.
    expect(probe.log.slice(settledOnA).some((frame) => frame.loading)).toBe(true);
  });

  it("a previous query's error is never exposed as the current query's error", async () => {
    const { loader, fail, settle } = controlledLoader();
    const probe = mount("A", loader);

    fail("A", new Error("query A failed"));
    await waitFor(() => expect(probe.last().errored).toBe(true));
    expect(probe.last().params).toBe("A");

    probe.switchTo("B");
    settle("B", pageOf("B", 1));
    await waitFor(() => expect(probe.last().tags).toEqual(["B"]));

    // No frame that asked for B ever carried A's failure.
    expect(probe.log.filter((frame) => frame.params === "B" && frame.errored)).toEqual([]);
    expect(probe.last().errored).toBe(false);
  });

  it("a late response from a previous query is still discarded, and its request aborted", async () => {
    const { loader, settle, aborted } = controlledLoader();
    const probe = mount("A", loader);

    // Switch before A resolves, then let both land out of order.
    probe.switchTo("B");
    expect(aborted).toContain("A");

    settle("B", pageOf("B", 1));
    await waitFor(() => expect(probe.last().tags).toEqual(["B"]));

    settle("A", pageOf("A", 5));
    await act(async () => {
      await Promise.resolve();
    });

    expect(probe.last().tags).toEqual(["B"]);
    expect(probe.log.filter((frame) => frame.params === "B" && frame.tags.includes("A"))).toEqual([]);
  });

  it("reload() re-reads the same query without emptying it", async () => {
    const { loader, settle } = controlledLoader();
    const probe = mount("A", loader);

    settle("A", pageOf("A", 2));
    await waitFor(() => expect(probe.last().tags).toEqual(["A", "A"]));
    const settledOnA = probe.log.length;

    act(() => {
      probe.expose.current?.reload();
    });
    settle("A", pageOf("A", 2));
    await waitFor(() => expect(probe.log.length).toBeGreaterThan(settledOnA));

    expect(probe.log.slice(settledOnA).filter((frame) => frame.tags.length === 0)).toEqual([]);
    expect(probe.last().tags).toEqual(["A", "A"]);
  });
});
