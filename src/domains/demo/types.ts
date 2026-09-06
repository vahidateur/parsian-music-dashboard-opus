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
  Resource,
  Student,
  Teacher,
} from "@/data/records";
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
  sessions: GridSession[];
  attendance: AttendanceRoster[];
  invoices: Invoice[];
  payments: DemoPayment[];
  conversations: Conversation[];
  resources: Resource[];
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
] as const;

export type DemoCollectionName = (typeof DEMO_COLLECTIONS)[number];

export interface DemoDatasetStats {
  seedVersion: string;
  counts: Record<DemoCollectionName, number>;
  total: number;
}
