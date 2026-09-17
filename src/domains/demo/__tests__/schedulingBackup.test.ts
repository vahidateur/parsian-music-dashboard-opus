/**
 * Backup/restore integrity for dated sessions.
 *
 * Validation is what stops a corrupt or hand-edited backup file from being
 * restored into a state the app cannot render. Each rule is therefore tested
 * by feeding it data that violates exactly that rule — asserting only that a
 * clean dataset passes would prove nothing.
 */
import { describe, expect, it } from "vitest";
import { validateDataset } from "../backup";
import { createSeedDataset } from "../seed";
import type { DemoDataset } from "../types";
import type { Session } from "@/domains/scheduling/types";

/** A seeded dataset with one mutable copy of its sessions. */
function datasetWith(mutate: (sessions: Session[]) => void): DemoDataset {
  const dataset = createSeedDataset();
  const sessions = [...dataset.scheduledSessions];
  mutate(sessions);
  return { ...dataset, scheduledSessions: sessions };
}

const paths = (dataset: DemoDataset) => validateDataset(dataset).map((i) => i.path ?? "");

describe("a clean dataset", () => {
  it("validates without issues", () => {
    expect(validateDataset(createSeedDataset())).toEqual([]);
  });

  it("actually contains sessions, so the check is not vacuous", () => {
    expect(createSeedDataset().scheduledSessions.length).toBeGreaterThan(50);
  });
});

describe("referential integrity", () => {
  it("rejects a session pointing at a missing class", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], classId: "cl_gone" };
    });
    expect(paths(dataset).some((p) => p.includes("classId"))).toBe(true);
  });

  it("rejects a session pointing at a missing teacher", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], teacherId: "t_gone" };
    });
    expect(paths(dataset).some((p) => p.includes("teacherId"))).toBe(true);
  });

  it("rejects a session pointing at a missing room", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], roomId: "r_gone" };
    });
    expect(paths(dataset).some((p) => p.includes("roomId"))).toBe(true);
  });

  it("names the offending index so the error is actionable", () => {
    const dataset = datasetWith((s) => {
      s[3] = { ...s[3], roomId: "r_gone" };
    });
    expect(paths(dataset).some((p) => p.startsWith("scheduledSessions[3]"))).toBe(true);
  });
});

describe("time-range integrity", () => {
  it("rejects a malformed date", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], date: "2026-02-30" };
    });
    expect(paths(dataset).some((p) => p.includes("date"))).toBe(true);
  });

  it("rejects a malformed time", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], startTime: "9am" };
    });
    expect(paths(dataset).some((p) => p.includes("startTime"))).toBe(true);
  });

  it("rejects an end before the start", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], startTime: "18:00", endTime: "17:00" };
    });
    expect(paths(dataset).some((p) => p.includes("endTime"))).toBe(true);
  });

  it("rejects a zero-length session", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], startTime: "17:00", endTime: "17:00" };
    });
    expect(paths(dataset).some((p) => p.includes("endTime"))).toBe(true);
  });
});

describe("reschedule links", () => {
  it("accepts a valid linked pair", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], rescheduledToId: s[1].id };
      s[1] = { ...s[1], rescheduledFromId: s[0].id };
    });
    expect(validateDataset(dataset)).toEqual([]);
  });

  it("rejects a dangling forward link", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], rescheduledToId: "ses_gone" };
    });
    expect(paths(dataset).some((p) => p.includes("rescheduledToId"))).toBe(true);
  });

  it("rejects a dangling back link", () => {
    // Otherwise the audit trail says "moved from somewhere" and cannot show it.
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], rescheduledFromId: "ses_gone" };
    });
    expect(paths(dataset).some((p) => p.includes("rescheduledFromId"))).toBe(true);
  });
});

describe("collection-level rules", () => {
  it("rejects a duplicate session id", () => {
    const dataset = datasetWith((s) => {
      s[1] = { ...s[1], id: s[0].id };
    });
    expect(validateDataset(dataset).some((i) => i.code === "DUPLICATE_ID")).toBe(true);
  });

  it("rejects a session with no id", () => {
    const dataset = datasetWith((s) => {
      s[0] = { ...s[0], id: "" };
    });
    expect(validateDataset(dataset).some((i) => i.code === "MISSING_ID")).toBe(true);
  });

  it("rejects a missing collection", () => {
    const dataset = createSeedDataset();
    const broken = { ...dataset } as Partial<DemoDataset>;
    delete broken.scheduledSessions;
    expect(
      validateDataset(broken as DemoDataset).some((i) => i.code === "MISSING_COLLECTION"),
    ).toBe(true);
  });

  it("rejects a non-array collection", () => {
    const dataset = createSeedDataset();
    const broken = { ...dataset, scheduledSessions: "nope" } as unknown as DemoDataset;
    expect(validateDataset(broken).some((i) => i.code === "INVALID_COLLECTION")).toBe(true);
  });
});

describe("round-trip", () => {
  it("preserves every session through serialization", () => {
    const dataset = createSeedDataset();
    const restored = JSON.parse(JSON.stringify(dataset)) as DemoDataset;

    expect(restored.scheduledSessions).toHaveLength(dataset.scheduledSessions.length);
    expect(validateDataset(restored)).toEqual([]);
    expect(JSON.stringify(restored.scheduledSessions)).toBe(JSON.stringify(dataset.scheduledSessions));
  });

  it("preserves the planted cancelled and manual rows", () => {
    const restored = JSON.parse(JSON.stringify(createSeedDataset())) as DemoDataset;
    expect(restored.scheduledSessions.filter((s) => s.status === "cancelled")).toHaveLength(1);
    expect(restored.scheduledSessions.filter((s) => s.origin === "manual")).toHaveLength(1);
  });

  it("keeps the legacy weekly template separate and intact", () => {
    // Task H5 removes it; until then both collections must survive a restore.
    const restored = JSON.parse(JSON.stringify(createSeedDataset())) as DemoDataset;
    expect(restored.sessions.length).toBeGreaterThan(0);
    expect(restored.sessions[0]).toHaveProperty("day");
    expect(restored.scheduledSessions[0]).toHaveProperty("date");
  });
});
