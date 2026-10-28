// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { getRoomRepository, resetRegistry, setRoomRepository } from "@/domains/registry";
import { useAcademyMetrics, useHeroStats } from "@/domains/shared/useAcademyMetrics";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";

beforeEach(() => {
  resetRegistry();
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});
afterEach(() => resetRegistry());

function roomsReadFails(error: ApiError) {
  setRoomRepository(
    withStubs(getRoomRepository(), {
      list: async () => {
        throw error;
      },
    }),
  );
}

describe("the hero aggregate when the rooms read is not available", () => {
  it("a policy-blocked rooms read leaves only the room count unknown; the tiles keep their figures", async () => {
    roomsReadFails(new ApiError({ kind: "authorization", status: 403, code: "OWNER_DECISION_REQUIRED_PB3", message: "x" }));
    const { result } = renderHook(() => ({ metrics: useAcademyMetrics(), hero: useHeroStats() }));
    await waitFor(() => expect(result.current.metrics.loading).toBe(false));
    expect(result.current.metrics.error).toBeNull();
    expect(result.current.metrics.available).toBe(true);
    expect(result.current.metrics.metrics.rooms).toBeNull();
    expect(result.current.hero.stats.every((s) => s.value !== null)).toBe(true);
  });

  it("a real rooms failure still blanks the tiles and reports the failure", async () => {
    roomsReadFails(new ApiError({ kind: "server", status: 500, message: "down" }));
    const { result } = renderHook(() => ({ metrics: useAcademyMetrics(), hero: useHeroStats() }));
    await waitFor(() => expect(result.current.metrics.loading).toBe(false));
    expect(result.current.metrics.available).toBe(false);
    expect(result.current.metrics.error?.kind).toBe("server");
    expect(result.current.hero.stats.every((s) => s.value === null)).toBe(true);
  });
});