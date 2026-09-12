/**
 * Deterministic dated session seed.
 *
 * Materializes real occurrences from the existing class recurrence
 * (`class.days` / `class.time` / `class.duration`) across a fixed window, so
 * the demo opens onto a schedule that already has history behind it and
 * planned lessons ahead of it.
 *
 * DETERMINISM
 *
 * Anchored to a FIXED date (`SEED_DATE`), never `academyNow()`. That helper
 * freezes the time of day but keeps the real calendar date, so seeding from it
 * would shift the whole dataset every day and make backups, exports and tests
 * irreproducible. Same input ⇒ byte-identical output, always.
 *
 * WHAT THE WINDOW CONTAINS
 *
 *   past    (before SEED_DATE)  → `completed`
 *   today   (SEED_DATE)         → `scheduled`
 *   future  (after SEED_DATE)   → `scheduled`
 *
 * plus three deliberately-planted situations, because a demo where everything
 * is tidy never exercises the UI that matters:
 *
 *   - a ROOM CONFLICT, so the conflict badge has something to show;
 *   - a CANCELLED session with a reason;
 *   - a MANUAL override, which bulk generation must never overwrite.
 *
 * The legacy `sessions` (GridSession) collection is untouched: it remains the
 * weekly template the current views read until task H5 rewires them.
 */
import { classes } from "@/data/records";
import { addDays, addMinutes, datesInRange, weekdayIndex } from "@/domains/scheduling/dateBridge";
import { deterministicSessionId } from "@/domains/scheduling/generation";
import type { Session } from "@/domains/scheduling/types";

/**
 * The demo's fixed "today". Matches `SEED_TIME` in the other seed modules so
 * every dataset describes one coherent instant.
 */
export const SEED_DATE = "2026-09-01";

/** Half-width of the seeded window, in days. */
export const SEED_WINDOW_DAYS = 28;

/** ISO timestamp used for `createdAt` / `updatedAt` on every seeded row. */
const SEED_STAMP = "2026-09-01T00:00:00.000Z";

export function seedWindow(): { from: string; to: string } {
  return {
    from: addDays(SEED_DATE, -SEED_WINDOW_DAYS)!,
    to: addDays(SEED_DATE, SEED_WINDOW_DAYS)!,
  };
}

/**
 * A session deliberately placed to collide with an existing booking.
 *
 * `cl7` (violin, teacher t3) and `cl2` (piano, teacher t1) both meet in room
 * `r1` at 14:00 on day 3, so the recurrence already produces a genuine room
 * clash — no artificial row is needed. This constant records which pair to
 * expect so the test can assert it rather than hoping.
 */
export const SEEDED_CONFLICT = { roomId: "r1", time: "14:00", classIds: ["cl2", "cl7"] } as const;

/** The session cancelled in the seed, and why. */
const CANCELLED_SLOT = { classId: "cl10", daysFromSeed: 7, reason: "تعطیلی رسمی" } as const;

/**
 * The manual override in the seed.
 *
 * A one-off room change on a future `cl3` session: `origin: "manual"` pins it
 * so regeneration leaves it alone. Exercises the protection rule end to end.
 */
const MANUAL_SLOT = { classId: "cl3", daysFromSeed: 14, roomId: "r3" } as const;

/**
 * Builds every dated session for the window.
 *
 * Pure and deterministic: no clock, no randomness, no store access.
 */
export function deriveScheduledSessions(): Session[] {
  const { from, to } = seedWindow();
  const dates = datesInRange(from, to);
  const out: Session[] = [];

  for (const klass of classes) {
    // Archived classes get no sessions; the repository refuses them too.
    if (klass.status === "archived") continue;

    const endTime = addMinutes(klass.time, klass.duration);
    if (endTime === null) continue;

    for (const date of dates) {
      const weekday = weekdayIndex(date);
      if (weekday === null || !klass.days.includes(weekday)) continue;

      const isPast = date < SEED_DATE;
      const overrides = plannedOverrideFor(klass.id, date);

      out.push({
        id: overrides?.id ?? deterministicSessionId(klass.id, date, klass.time),
        classId: klass.id,
        date,
        startTime: klass.time,
        endTime,
        teacherId: klass.teacherId,
        roomId: overrides?.roomId ?? klass.roomId,
        // Past sessions already happened; today and future are still planned.
        // Never inferred from a live clock — see the module header.
        status: overrides?.status ?? (isPast ? "completed" : "scheduled"),
        origin: overrides?.origin ?? "generated",
        ...(overrides?.cancelReason ? { cancelReason: overrides.cancelReason } : {}),
        createdAt: SEED_STAMP,
        updatedAt: SEED_STAMP,
      });
    }
  }

  // Stable ordering so the serialized dataset is byte-identical run to run.
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
}

interface PlannedOverride {
  id?: string;
  roomId?: string;
  status?: Session["status"];
  origin?: Session["origin"];
  cancelReason?: string;
}

/** The three planted situations, applied by class and date. */
function plannedOverrideFor(classId: string, date: string): PlannedOverride | undefined {
  if (classId === CANCELLED_SLOT.classId && date === addDays(SEED_DATE, CANCELLED_SLOT.daysFromSeed)) {
    return { status: "cancelled", cancelReason: CANCELLED_SLOT.reason };
  }

  if (classId === MANUAL_SLOT.classId && date === addDays(SEED_DATE, MANUAL_SLOT.daysFromSeed)) {
    // A hand-edited occurrence keeps the deterministic id — the id encodes the
    // slot, while `origin` records that a human touched it.
    return { roomId: MANUAL_SLOT.roomId, origin: "manual" };
  }

  return undefined;
}
