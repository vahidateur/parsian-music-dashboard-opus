// @vitest-environment jsdom
/**
 * Compensation hooks.
 *
 * The view that will use this hook is the one screen where a stale or optimistic
 * read causes a real mistake: an obligation shown as still owed after it was
 * discharged, or a booking reported as saved when the scheduling domain refused
 * it. These tests pin the consistency guarantees rather than the plumbing.
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import {
  getCompensationRepository,
  getSchedulingRepository,
  resetRegistry,
  setCompensationRepository,
} from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import type { CompensationRepository } from "../repository";
import { COMPENSATION_ERRORS, type SessionCompensation } from "../types";
import { useCompensations } from "../useCompensations";

const ACTOR = "usr_admin";
const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
const BOOKING_DATE = "2027-05-11";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/** A cancelled private session: the only thing compensation may ever start from. */
async function cancelledPrivateSession(): Promise<string> {
  const created = await getSchedulingRepository().create({
    classId: PRIVATE_CLASS,
    date: BOOKING_DATE,
    startTime: "14:00",
    endTime: "15:00",
    teacherId: "t1",
    roomId: "r1",
  });
  await getSchedulingRepository().cancelSession(created.id, "لغو");
  return created.id;
}

async function registerOne() {
  const originalSessionId = await cancelledPrivateSession();
  return getCompensationRepository().register({
    originalSessionId,
    studentId: PRIVATE_STUDENT,
    reason: "لغو جلسه",
    requiredByUserId: ACTOR,
  });
}

describe("useCompensations", () => {
  it("lists the obligations the registry repository serves", async () => {
    const created = await registerOne();
    const { result } = renderHook(() => useCompensations({ per_page: 25 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((c) => c.id)).toEqual([created.id]);
    expect(result.current.items[0].status).toBe("required");
  });

  it("surfaces a newly registered obligation through its own refresh", async () => {
    const { result } = renderHook(() => useCompensations({ per_page: 25 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(0);

    const originalSessionId = await cancelledPrivateSession();
    let registered!: SessionCompensation;
    await act(async () => {
      registered = await result.current.register({
        originalSessionId,
        studentId: PRIVATE_STUDENT,
        reason: "لغو جلسه",
        requiredByUserId: ACTOR,
      });
    });
    expect(registered.status).toBe("required");

    await waitFor(() => expect(result.current.items.map((c) => c.id)).toEqual([registered.id]));
  });

  it("propagates a refusal verbatim and never claims the write happened", async () => {
    const { result } = renderHook(() => useCompensations({ per_page: 25 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // A group class is not eligible, so this registration cannot succeed.
    const groupSession = (
      await getSchedulingRepository().list({ classId: "cl10", per_page: 100 })
    ).data.find((s) => s.status === "cancelled")!;

    let caught: unknown;
    await act(async () => {
      await result.current
        .register({
          originalSessionId: groupSession.id,
          studentId: PRIVATE_STUDENT,
          reason: "دلیل",
          requiredByUserId: ACTOR,
        })
        .catch((cause: unknown) => {
          caught = cause;
        });
    });

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe(COMPENSATION_ERRORS.CLASS_NOT_PRIVATE);
    expect(result.current.items).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it("books and discharges through the same hook, refreshing after each", async () => {
    const created = await registerOne();
    const { result } = renderHook(() => useCompensations({ per_page: 25 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.schedule(created.id, {
        date: BOOKING_DATE,
        startTime: "16:00",
        endTime: "17:00",
        scheduledByUserId: ACTOR,
      });
    });
    await waitFor(() => expect(result.current.items[0]?.status).toBe("scheduled"));

    const attemptSessionId = result.current.items[0].currentAttempt!.sessionId;
    // The make-up is a real session, readable through the scheduling repository.
    expect((await getSchedulingRepository().get(attemptSessionId)).origin).toBe("manual");

    await act(async () => {
      await result.current.complete(created.id, { completedByUserId: ACTOR });
    });
    await waitFor(() => expect(result.current.items[0]?.status).toBe("completed"));
  });

  it("asks the injected repository: the registry seam decides, not the hook", async () => {
    const stub: CompensationRepository = {
      list: vi.fn(async () => ({ data: [], meta: { page: 1, per_page: 25, total: 0 } })),
      get: vi.fn(),
      register: vi.fn(),
      schedule: vi.fn(),
      complete: vi.fn(),
    } as unknown as CompensationRepository;
    setCompensationRepository(stub);

    const { result } = renderHook(() => useCompensations({ per_page: 25 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(stub.list).toHaveBeenCalledTimes(1);
    expect(result.current.repository).toBe(stub);

    setCompensationRepository(undefined);
  });
});
