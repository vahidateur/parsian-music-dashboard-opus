/**
 * The demo dataset — a snapshot of the whole demo environment expressed in
 * *domain entities*, never in localStorage details.
 *
 * A future backend can serve exactly this shape from `GET /demo/export` and
 * accept it at `POST /demo/import`; nothing here mentions storage keys.
 */
import type { Instrument } from "@/data/academy";
import type {
  AcademyClass,
  AttendanceRoster,
  Conversation,
  GridSession,
  Invoice,
  Resource,
  Student,
  Teacher,
} from "@/data/records";
import type { Enrollment } from "@/domains/enrollments/types";
import type { RoleId } from "@/domains/auth/permissions";
import type { AuthUser } from "@/domains/auth/types";

export interface DemoRoom {
  id: string;
  name: string;
  kind: string;
  capacity: number;
  occupancy: number;
}

export interface DemoPayment {
  id: string;
  studentId: string;
  amount: number;
  when: string;
  method: string;
}

/**
 * Demo user record = the authentication domain's `AuthUser`.
 * There is deliberately ONE user model: demo and API must never diverge.
 * Contains no credential material by construction (no password/hash/salt).
 */
export type DemoUser = AuthUser;

export interface DemoRole {
  id: RoleId;
  label: string;
  /** Human description of the role's scope, shown in Settings. */
  scope: string;
}

export interface DemoOrganizationSettings {
  name: string;
  tagline: string;
  locale: string;
  direction: "rtl" | "ltr";
  calendar: "jalali" | "gregorian";
  currency: "toman" | "rial";
  firstWeekday: number;
  defaultSessionMinutes: number;
  instruments: Instrument[];
}

/** Every collection that makes up the demo environment. */
export interface DemoDataset {
  organization: DemoOrganizationSettings;
  rooms: DemoRoom[];
  teachers: Teacher[];
  students: Student[];
  classes: AcademyClass[];
  enrollments: Enrollment[];
  sessions: GridSession[];
  attendance: AttendanceRoster[];
  invoices: Invoice[];
  payments: DemoPayment[];
  conversations: Conversation[];
  resources: Resource[];
  users: DemoUser[];
  roles: DemoRole[];
}

/** Names of the array-shaped collections — used by validation and clearing. */
export const DEMO_COLLECTIONS = [
  "rooms",
  "teachers",
  "students",
  "classes",
  "enrollments",
  "sessions",
  "attendance",
  "invoices",
  "payments",
  "conversations",
  "resources",
  "users",
  "roles",
] as const;

export type DemoCollectionName = (typeof DEMO_COLLECTIONS)[number];

export interface DemoDatasetStats {
  seedVersion: string;
  counts: Record<DemoCollectionName, number>;
  total: number;
}
