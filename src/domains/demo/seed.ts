/**
 * Canonical demo seed.
 *
 * The shipped demo dataset is *derived* from the existing hand-authored Persian
 * academy data in `src/data/*` — it is not a second copy of the domain model.
 * Anything that is not literal source data (enrollments, users) is generated
 * deterministically from that data, so `createSeedDataset()` always yields the
 * same logical dataset for a given `SEED_VERSION`.
 */
import { academy, instrumentLabel, type Instrument } from "@/data/academy";
import {
  accessRoles,
  classes,
  conversations,
  invoices,
  payments,
  resources,
  rooms,
  students,
  teachers,
  todayAttendance,
  weekSessions,
} from "@/data/records";
import type { Enrollment } from "@/domains/enrollments/types";
import type { DemoDataset, DemoPayment, DemoRole, DemoUser } from "./types";

/** Bump when the *shape* or content of the canonical dataset changes. */
export const SEED_VERSION = "2026.09.1";

function clone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Enrollments are the normalized Student ↔ Class edge. They are derived from
 * `AcademyClass.studentIds` (the denormalized display field) in a stable order
 * so ids never shift between runs.
 */
export function deriveEnrollments(source: typeof classes = classes): Enrollment[] {
  const out: Enrollment[] = [];
  for (const cls of source) {
    cls.studentIds.forEach((studentId, index) => {
      out.push({
        id: `enr_${cls.id}_${studentId}`,
        studentId,
        classId: cls.id,
        status: index < cls.capacity ? "active" : "waitlist",
        startDate: "۱۴۰۴/۰۷/۰۱",
        pricingPlan: { label: cls.level, amount: cls.tuition },
      });
    });
  }
  return out;
}

/** Demo users: one per teacher plus the academy manager. No credentials. */
export function deriveUsers(): DemoUser[] {
  const staff: DemoUser[] = teachers.map((t, i) => ({
    id: `usr_t${i + 1}`,
    name: t.name,
    roleId: "role3",
    email: `teacher${i + 1}@demo.local`,
  }));
  return [
    { id: "usr_admin", name: "آرمان احمدی", roleId: "role1", email: "admin@demo.local" },
    { id: "usr_desk", name: "پذیرش آموزشگاه", roleId: "role2", email: "desk@demo.local" },
    { id: "usr_finance", name: "واحد مالی", roleId: "role4", email: "finance@demo.local" },
    ...staff,
  ];
}

const INSTRUMENTS = Object.keys(instrumentLabel) as Instrument[];

/** Builds the canonical dataset. Pure and deterministic. */
export function createSeedDataset(): DemoDataset {
  return clone<DemoDataset>({
    organization: {
      name: academy.name,
      tagline: academy.tagline,
      locale: "fa-IR",
      direction: "rtl",
      calendar: "jalali",
      currency: "toman",
      firstWeekday: 0,
      defaultSessionMinutes: 60,
      instruments: INSTRUMENTS,
    },
    rooms,
    teachers,
    students,
    classes,
    enrollments: deriveEnrollments(),
    sessions: weekSessions,
    attendance: todayAttendance,
    invoices,
    payments: payments as DemoPayment[],
    conversations,
    resources,
    users: deriveUsers(),
    roles: accessRoles as DemoRole[],
  });
}

/** An empty-but-valid dataset: the "Clear Demo" target state. */
export function createEmptyDataset(): DemoDataset {
  const seed = createSeedDataset();
  return {
    organization: seed.organization,
    rooms: [],
    teachers: [],
    students: [],
    classes: [],
    enrollments: [],
    sessions: [],
    attendance: [],
    invoices: [],
    payments: [],
    conversations: [],
    resources: [],
    users: [],
    roles: [],
  };
}
