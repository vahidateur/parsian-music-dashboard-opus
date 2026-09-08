/**
 * The demo dataset — a snapshot of the whole demo environment expressed in
 * *domain entities*, never in localStorage details.
 *
 * A future backend can serve exactly this shape from `GET /demo/export` and
 * accept it at `POST /demo/import`; nothing here mentions storage keys.
 */
import type {
  AcademyClass,
  AttendanceRoster,
  Conversation,
  GridSession,
  Invoice,
  Student,
  Teacher,
} from "@/data/records";
import type { LibraryItem } from "@/domains/library/types";
import type { Enrollment } from "@/domains/enrollments/types";
import type { InstrumentRecord } from "@/domains/instruments/types";
import type { MediaAsset } from "@/domains/media/types";
import type {
  LearningContent,
  LearningLevel,
  LearningProgram,
  LevelContentLink,
  StudentPlacement,
} from "@/domains/learning/types";
import type { ChatConversation, ChatMessage } from "@/domains/chat/types";
import type { GalleryAlbum, GalleryImage } from "@/domains/gallery/types";
import type { Piece, PieceAssignment, ProgressEvent } from "@/domains/progress/types";
import type { Session } from "@/domains/scheduling/types";
import type { AttendanceCorrection, AttendanceRecord } from "@/domains/attendance/types";
import type { BrandingSettings } from "@/domains/branding/types";
import type { RoleId } from "@/domains/auth/permissions";
import type { AuthUser } from "@/domains/auth/types";

export interface DemoRoom {
  id: string;
  name: string;
  kind: string;
  capacity: number;
  occupancy: number;
  /** Absent means active. `false` excludes the room from new assignments. */
  active?: boolean;
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
}

/** Every collection that makes up the demo environment. */
export interface DemoDataset {
  organization: DemoOrganizationSettings;
  /** Academy branding (name, logo, colours, fonts). Singleton, not a list. */
  branding: BrandingSettings;
  rooms: DemoRoom[];
  teachers: Teacher[];
  students: Student[];
  classes: AcademyClass[];
  enrollments: Enrollment[];
  /**
   * LEGACY weekly template (`day: 0-6`, no date). Superseded by
   * `scheduledSessions` and removed once the views are rewired (task H5).
   * Retained for now so the existing seed, backup validation and views keep
   * working while the scheduling domain is built alongside them.
   */
  sessions: GridSession[];
  /** LEGACY roster fixture. Superseded by the attendance domain (Group D). */
  attendance: AttendanceRoster[];

  /**
   * Real dated occurrences owned by the scheduling domain.
   *
   * A separate field from `sessions` on purpose: the legacy array is a weekly
   * TEMPLATE keyed by weekday, while these are materialized dated sessions.
   * Migrating in place would have forced the seed and backup rewrite (C3/C4)
   * into this step.
   */
  scheduledSessions: Session[];

  /**
   * Attendance marks, keyed by (session, student). Owned by the attendance
   * domain; distinct from the legacy `attendance` roster fixture above, which
   * is removed in task H5.
   */
  attendanceRecords: AttendanceRecord[];
  /** Append-only audit trail for attendance changes. Never edited. */
  attendanceCorrections: AttendanceCorrection[];
  invoices: Invoice[];
  payments: DemoPayment[];
  conversations: Conversation[];
  /**
   * Library catalogue. Owned by the library domain; `LibraryItem` extends the
   * catalogue entity with the media reference, so a row can point at a real
   * stored file.
   */
  resources: LibraryItem[];
  users: DemoUser[];
  roles: DemoRole[];

  /* ---- domains added in the profiles/learning/media phase ---- */
  /** Binary metadata only; the bytes live in the blob store. */
  media: MediaAsset[];
  instruments: InstrumentRecord[];
  programs: LearningProgram[];
  levels: LearningLevel[];
  learningContent: LearningContent[];
  /** Many-to-many Level ↔ Content edge. Content is never duplicated. */
  levelContent: LevelContentLink[];
  /** Where each student sits in a program. */
  placements: StudentPlacement[];
  /** Chat threads. Messages are a separate collection, not nested. */
  chatConversations: ChatConversation[];
  chatMessages: ChatMessage[];
  galleryAlbums: GalleryAlbum[];
  galleryImages: GalleryImage[];

  /* Repertoire and student progress. `progressEvents` is append-only. */
  pieces: Piece[];
  pieceAssignments: PieceAssignment[];
  progressEvents: ProgressEvent[];
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
  "media",
  "instruments",
  "programs",
  "levels",
  "learningContent",
  "levelContent",
  "placements",
  "chatConversations",
  "chatMessages",
  "galleryAlbums",
  "galleryImages",
  "pieces",
  "pieceAssignments",
  "progressEvents",
  "scheduledSessions",
  "attendanceRecords",
  "attendanceCorrections",
] as const;

export type DemoCollectionName = (typeof DEMO_COLLECTIONS)[number];

export interface DemoDatasetStats {
  seedVersion: string;
  counts: Record<DemoCollectionName, number>;
  total: number;
}

/* ------------------------------------------------------------------ */
/* Data lifecycle                                                      */
/* ------------------------------------------------------------------ */

/**
 * The two initialized kinds of environment.
 *
 * `empty` — a real/customer environment: a valid dataset with zero academy
 * records, ready for the customer's own data.
 * `demo`  — the explicit showcase/QA dataset (`createSeedDataset()`).
 *
 * The mode is a persisted FACT about the environment, never a guess from how
 * many rows it happens to hold: an EMPTY academy with zero students is still
 * EMPTY, and a DEMO dataset emptied during testing is still DEMO.
 */
export const LIFECYCLE_MODES = ["empty", "demo"] as const;

export type DataLifecycleMode = (typeof LIFECYCLE_MODES)[number];

/**
 * `uninitialized` — no lifecycle choice has been made yet, so nothing has been
 * written and no data of either kind exists. Distinct from EMPTY on purpose:
 * EMPTY is a deliberate, supported environment, while UNINITIALIZED means the
 * first-run decision is still outstanding.
 */
export type DataLifecycleState = "uninitialized" | DataLifecycleMode;
