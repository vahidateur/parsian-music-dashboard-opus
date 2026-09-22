/**
 * ORGANIZATION RULES — the academy's own settings, as data.
 *
 * What is pinned here is the difference between a settings panel and a rule:
 *   • the record validates, and a partial patch is validated against the STORED
 *     other half (so "start 22:00" cannot be written against a stored 21:00 end);
 *   • a dataset written before rules existed resolves to the shipped defaults
 *     rather than to "no rule at all";
 *   • the derived answers are pure and answer `null` when a rule is unreadable —
 *     an unevaluated rule must never masquerade as a permitted one.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { DemoOrganizationRepository } from "@/domains/organization/demoRepository";
import { ApiOrganizationRepository } from "@/domains/organization/apiRepository";
import { cancellationWindow, isClosedWeekday, isInsideWorkingHours, schedulingRules, workingWindow } from "@/domains/organization/rules";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  isTimeOfDay,
  timeToMinutes,
  validateOrganizationInput,
  withRuleDefaults,
} from "@/domains/organization/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { ApiClient } from "@/api/client";
import { asFetch, createFetchMock, jsonResponse, requestOf } from "@/test/fetchMock";

let store: DemoStore;
let repo: DemoOrganizationRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  store = demoStore;
  repo = new DemoOrganizationRepository(store);
});

describe("the record", () => {
  it("reads back what the academy shipped with", async () => {
    const settings = await repo.get();
    expect(settings.defaultSessionMinutes).toBe(DEFAULT_ORGANIZATION_SETTINGS.defaultSessionMinutes);
    expect(settings.closedWeekdays).toEqual([6]); // Friday
    expect(settings.workingDayStart).toBe("08:00");
    expect(settings.workingDayEnd).toBe("21:00");
  });

  it("persists an edit and stamps when it happened", async () => {
    const before = await repo.get();
    const saved = await repo.update({ defaultSessionMinutes: 90, sessionGapMinutes: 15 });
    expect(saved.defaultSessionMinutes).toBe(90);
    expect(saved.sessionGapMinutes).toBe(15);
    expect(Date.parse(saved.updatedAt)).not.toBeNaN();
    expect(saved.updatedAt).not.toBe(before.updatedAt);
    // Untouched fields are untouched — a patch is not a rebuild.
    expect(saved.maxMakeupsPerTerm).toBe(before.maxMakeupsPerTerm);
    expect((await repo.get()).defaultSessionMinutes).toBe(90);
  });

  it("writes through the store, so every consumer re-reads the same record", async () => {
    await repo.update({ cancellationGraceHours: 6 });
    expect(store.organization.get().cancellationGraceHours).toBe(6);
  });
});

describe("validation", () => {
  it("refuses a rule outside the bounds that keep it usable", async () => {
    const error = (await repo.update({ defaultSessionMinutes: 5 }).catch((cause) => cause)) as ApiError;
    expect(error.code).toBe("ORGANIZATION_INVALID");
    expect(error.fields?.defaultSessionMinutes?.[0]).toContain("باید بین");
    // Nothing was written.
    expect((await repo.get()).defaultSessionMinutes).toBe(DEFAULT_ORGANIZATION_SETTINGS.defaultSessionMinutes);
  });

  it("refuses a clock that is not a time of day", async () => {
    const error = (await repo.update({ workingDayStart: "۸ صبح" }).catch((cause) => cause)) as ApiError;
    expect(error.fields?.workingDayStart).toBeDefined();
  });

  it("validates a one-sided patch against the stored other half", async () => {
    await repo.update({ workingDayEnd: "21:00" });
    // 22:00 on its own is a perfectly good time of day — against a stored 21:00
    // close it is a window that shuts before it opens.
    const error = (await repo.update({ workingDayStart: "22:00" }).catch((cause) => cause)) as ApiError;
    expect(error.fields?.workingDayEnd?.[0]).toContain("پس از شروع");
    expect((await repo.get()).workingDayStart).toBe("08:00");
  });

  it("refuses to close every day of the week", async () => {
    const error = (await repo.update({ closedWeekdays: [0, 1, 2, 3, 4, 5, 6] }).catch((cause) => cause)) as ApiError;
    expect(error.fields?.closedWeekdays).toBeDefined();
  });

  it("reports every problem in one answer, not one per save", () => {
    const errors = validateOrganizationInput({
      defaultSessionMinutes: 1,
      sessionGapMinutes: 900,
      workingDayStart: "late",
      closedWeekdays: [9 as never],
    });
    expect(Object.keys(errors).sort()).toEqual([
      "closedWeekdays",
      "defaultSessionMinutes",
      "sessionGapMinutes",
      "workingDayStart",
    ]);
  });

  it("accepts the values an academy actually runs on", () => {
    expect(
      validateOrganizationInput({
        defaultSessionMinutes: 90,
        sessionGapMinutes: 0,
        cancellationGraceHours: 0,
        maxMakeupsPerTerm: 0,
        workingDayStart: "07:30",
        workingDayEnd: "22:15",
        closedWeekdays: [5, 6],
      }),
    ).toEqual({});
  });
});

describe("a dataset written before rules existed", () => {
  it("resolves to the shipped defaults instead of to no rule at all", async () => {
    // Simulate the old record: an organization object with none of the rule keys.
    (store.organization as unknown as { get: () => unknown }).get = () => ({
      name: "آموزشگاه قدیم",
      tagline: "",
      locale: "fa-IR",
      direction: "rtl",
      calendar: "jalali",
      currency: "toman",
      firstWeekday: 0,
      defaultSessionMinutes: 45,
    });

    const settings = await repo.get();
    expect(settings.name, "what the academy wrote is kept").toBe("آموزشگاه قدیم");
    expect(settings.defaultSessionMinutes, "a stored rule is not overwritten").toBe(45);
    expect(settings.sessionGapMinutes).toBe(DEFAULT_ORGANIZATION_SETTINGS.sessionGapMinutes);
    expect(settings.workingDayStart).toBe(DEFAULT_ORGANIZATION_SETTINGS.workingDayStart);
    expect(settings.closedWeekdays).toEqual([6]);
  });

  it("drops a weekday index that is not a day", () => {
    const settings = withRuleDefaults({ closedWeekdays: [6, 9, -1, 3] as never });
    expect(settings.closedWeekdays).toEqual([6, 3]);
  });

  it("survives a missing record entirely", () => {
    expect(withRuleDefaults(null).defaultSessionMinutes).toBe(DEFAULT_ORGANIZATION_SETTINGS.defaultSessionMinutes);
    expect(withRuleDefaults(undefined).closedWeekdays).toEqual([6]);
  });
});

describe("time of day", () => {
  it("reads HH:mm and refuses everything else", () => {
    expect(isTimeOfDay("08:00")).toBe(true);
    expect(isTimeOfDay("23:59")).toBe(true);
    expect(isTimeOfDay("24:00")).toBe(false);
    expect(isTimeOfDay("8:00")).toBe(false);
    expect(isTimeOfDay("صبح")).toBe(false);
    expect(timeToMinutes("08:30")).toBe(510);
    expect(timeToMinutes("nope")).toBeNull();
  });
});

describe("the derived answers", () => {
  const settings = DEFAULT_ORGANIZATION_SETTINGS;

  it("reads the bookable window", () => {
    expect(workingWindow(settings)).toEqual({ start: 480, end: 1260 });
    // A window that closes before it opens is unreadable, not permissive.
    expect(workingWindow({ ...settings, workingDayStart: "22:00", workingDayEnd: "21:00" })).toBeNull();
    expect(workingWindow({ ...settings, workingDayStart: "late" })).toBeNull();
  });

  it("answers whether a session sits inside it — and says when it cannot tell", () => {
    expect(isInsideWorkingHours(settings, "09:00", "10:30")).toBe(true);
    expect(isInsideWorkingHours(settings, "07:00", "08:00")).toBe(false);
    expect(isInsideWorkingHours(settings, "20:00", "21:30")).toBe(false);
    /*
      A zero-length session is inside the window as far as THIS question goes —
      whether it is a session at all is the conflict engine's business, not the
      window's. What the window must refuse to answer is an unreadable time.
    */
    expect(isInsideWorkingHours(settings, "21:00", "21:00")).toBe(true);
    expect(isInsideWorkingHours(settings, "late", "10:00")).toBeNull();
    expect(isInsideWorkingHours({ ...settings, workingDayStart: "bad" }, "09:00", "10:00")).toBeNull();
  });

  it("knows which days the academy is closed", () => {
    expect(isClosedWeekday(settings, 6)).toBe(true);
    expect(isClosedWeekday(settings, 0)).toBe(false);
    expect(isClosedWeekday({ ...settings, closedWeekdays: [] }, 6)).toBe(false);
  });

  it("hands the scheduling engine numbers, not a record", () => {
    expect(schedulingRules(settings)).toEqual({
      closedWeekdays: [6],
      gapMinutes: 10,
      workingHours: { start: 480, end: 1260 },
    });
  });

  it("answers the free-cancellation window against a supplied clock", () => {
    const at = (iso: string) => new Date(iso);
    // The session starts at 17:00 local on the 15th; the window is 24 hours, so
    // the deadline is 17:00 on the 14th. 10:00 on the 14th is still inside it.
    const inside = cancellationWindow(settings, "2026-09-15", "17:00", at("2026-09-14T10:00:00"));
    expect(inside?.inside).toBe(true);
    expect(inside?.graceMinutes).toBe(1440);
    expect(inside?.deadlineTime).toBe("17:00");
    expect(inside?.deadlineDate).toBe("2026-09-14");
    expect(inside?.minutesUntilStart).toBe(31 * 60);

    // One hour past that deadline, and the same cancellation is late.
    expect(cancellationWindow(settings, "2026-09-15", "17:00", at("2026-09-14T18:00:00"))?.inside).toBe(false);

    const outside = cancellationWindow(settings, "2026-09-15", "17:00", at("2026-09-15T15:00:00"));
    expect(outside?.inside).toBe(false);
    expect(outside?.minutesUntilStart).toBe(120);

    // A session that has already begun is still answerable, and is not "inside".
    const begun = cancellationWindow(settings, "2026-09-15", "17:00", at("2026-09-15T18:30:00"));
    expect(begun?.inside).toBe(false);
    expect(begun?.minutesUntilStart).toBe(-90);

    // An academy that defines no window has no opinion — never a free pass.
    expect(cancellationWindow({ ...settings, cancellationGraceHours: 0 }, "2026-09-15", "17:00", at("2026-09-01T00:00:00"))?.inside).toBe(false);

    // An unreadable date is `null`, not a guess.
    expect(cancellationWindow(settings, "not-a-date", "17:00", at("2026-09-15T15:00:00"))).toBeNull();
  });
});

describe("ApiOrganizationRepository", () => {
  const client = (mock: ReturnType<typeof createFetchMock>) =>
    new ApiClient({ baseUrl: "https://x.test/api/v1", fetchImpl: asFetch(mock) });

  it("reads and patches the single organization record", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: DEFAULT_ORGANIZATION_SETTINGS }));
    const api = new ApiOrganizationRepository(client(mock));

    const settings = await api.get();
    expect(settings.defaultSessionMinutes).toBe(60);
    expect(requestOf(mock, 0).url).toBe("https://x.test/api/v1/organization");

    await api.update({ sessionGapMinutes: 20 });
    expect(requestOf(mock, 1).init.method).toBe("PATCH");
  });

  it("completes a server record that predates the rules", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: { name: "old", defaultSessionMinutes: 45 } }));
    const settings = await new ApiOrganizationRepository(client(mock)).get();
    expect(settings.defaultSessionMinutes).toBe(45);
    expect(settings.sessionGapMinutes).toBe(DEFAULT_ORGANIZATION_SETTINGS.sessionGapMinutes);
  });

  it("validates before spending a request", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: DEFAULT_ORGANIZATION_SETTINGS }));
    const api = new ApiOrganizationRepository(client(mock));
    await expect(api.update({ defaultSessionMinutes: 1 })).rejects.toBeInstanceOf(ApiError);
    expect(mock).not.toHaveBeenCalled();
  });
});
