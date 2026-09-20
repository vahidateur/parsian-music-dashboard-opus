// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEntityForm } from "@/domains/shared/useEntityForm";

/**
 * AUDIT-001 regression: double-submit race must be prevented by synchronous ref guard.
 * React state submitting updates async, so two rapid calls before render would both see false and both invoke submitFn.
 * Fix uses submittingRef synchronous.
 */
describe("AUDIT-001 useEntityForm double-submit guard", () => {
  it("rapid click/Enter cannot invoke submitFn twice", async () => {
    const submitFn = vi.fn(async () => {
      // Simulate network latency
      await new Promise((r) => setTimeout(r, 50));
      return { ok: true };
    });

    const { result } = renderHook(() =>
      useEntityForm({
        initial: { name: "test" },
        open: true,
        submit: submitFn,
      }),
    );

    // Fire two submits without awaiting first render cycle
    let p1: Promise<any> | undefined;
    let p2: Promise<any> | undefined;
    await act(async () => {
      p1 = result.current.submit();
      p2 = result.current.submit();
    });

    await act(async () => {
      await Promise.all([p1, p2]);
    });

    expect(submitFn).toHaveBeenCalledTimes(1);
  });

  it("submitting state is true during in-flight and false after", async () => {
    const submitFn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return { ok: true };
    });

    const { result } = renderHook(() =>
      useEntityForm({
        initial: { name: "test" },
        open: true,
        submit: submitFn,
      }),
    );

    expect(result.current.submitting).toBe(false);

    let promise: Promise<any> | undefined;
    await act(async () => {
      promise = result.current.submit();
    });

    // During in-flight, submitting should be true
    expect(result.current.submitting).toBe(true);

    await act(async () => {
      await promise;
    });

    expect(result.current.submitting).toBe(false);
  });

  it("second submit after first completes is allowed", async () => {
    const submitFn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { ok: true };
    });

    const { result } = renderHook(() =>
      useEntityForm({
        initial: { name: "test" },
        open: true,
        submit: submitFn,
      }),
    );

    await act(async () => {
      await result.current.submit();
    });
    expect(submitFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.submit();
    });
    expect(submitFn).toHaveBeenCalledTimes(2);
  });
});
