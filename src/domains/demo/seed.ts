/**
 * Canonical demo seed.
 *
 * The shipped demo dataset is *derived* from the existing hand-authored Persian
 * academy data in `src/data/*` — it is not a second copy of the domain model.
 * Anything that is not literal source data (enrollments, users) is generated
 * deterministically from that data, so `createSeedDataset()` always yields the
 * same logical dataset for a given `SEED_VERSION`.
 */
import { academy } from "@/data/academy";
import {
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
  type AcademyClass,
} from "@/data/records";
import type { Enrollment } from "@/domains/enrollments/types";
import { ROLES, roleLabels, type RoleId } from "@/domains/auth/permissions";
import type { DemoDataset, DemoPayment, DemoRole, DemoUser } from "./types";
import {
  deriveBranding,
  deriveChat,
  deriveGalleryAlbums,
  deriveGalleryImages,
  deriveInstruments,
  deriveLearningContent,
  deriveLevelContent,
  deriveLevels,
  derivePlacements,
  derivePrograms,
} from "./learningSeed";
import { DEMO_LIBRARY_ASSET, withDemoLibraryFile } from "./librarySeed";
import { derivePieces, deriveProgress } from "./progressSeed";
import { deriveScheduledSessions } from "./schedulingSeed";

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
/**
 * Seeds `classes` and `enrollments` together so they cannot disagree.
 *
 * `enrolled`, `waitlist` and `studentIds` are a *projection* of the enrollment
 * rows (see the enrollments repository). The literal fixture values were
 * hand-written and did not match the derived rows, so the first enrollment
 * write would visibly "correct" a class's seat count. Deriving both from one
 * source removes that class of drift at the seed level.
 */
function withDerivedEnrollments(): { classes: AcademyClass[]; enrollments: Enrollment[] } {
  const enrollments = deriveEnrollments();
  const projected = classes.map((cls) => {
    const rows = enrollments.filter((e) => e.classId === cls.id);
    const active = rows.filter((e) => e.status === "active");
    return {
      ...cls,
      enrolled: active.length,
      waitlist: rows.filter((e) => e.status === "waitlist").length,
      studentIds: active.map((e) => e.studentId),
    };
  });
  return { classes: projected, enrollments };
}

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

/**
 * Demo users: three staff accounts plus one per teacher.
 * Deterministic ids/timestamps — no credentials are stored (see auth/demo).
 */
const SEED_TIMESTAMP = "2026-09-01T00:00:00.000Z";

export function deriveUsers(): DemoUser[] {
  const base = (id: string, name: string, role: RoleId, email: string, teacherId?: string): DemoUser => ({
    id,
    name,
    email,
    role,
    status: "active",
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    ...(teacherId ? { teacherId } : {}),
  });
  return [
    base("usr_admin", "آرمان احمدی", "administrator", "admin@demo.local"),
    base("usr_manager", "مدیر آموزشگاه", "manager", "manager@demo.local"),
    base("usr_desk", "پذیرش آموزشگاه", "staff", "desk@demo.local"),
    base("usr_finance", "واحد مالی", "accountant", "finance@demo.local"),
    ...teachers.map((t, i) => base(`usr_t${i + 1}`, t.name, "teacher", `teacher${i + 1}@demo.local`, t.id)),
  ];
}

/** Roles are derived from the central RBAC matrix, not hand-authored. */
const ROLE_SCOPES: Record<RoleId, string> = {
  administrator: "دسترسی کامل به همهٔ بخش‌ها",
  manager: "مدیریت آموزشی، برنامه‌ریزی و گزارش‌ها",
  teacher: "کلاس‌های خود، حضور و غیاب، کتابخانه",
  staff: "هنرجویان، برنامه‌ریزی، پیام‌ها",
  accountant: "فاکتورها، پرداخت‌ها، گزارش مالی",
};

export function deriveRoles(): DemoRole[] {
  return ROLES.map((id) => ({ id, label: roleLabels[id], scope: ROLE_SCOPES[id] }));
}

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
    },
    rooms,
    teachers,
    students,
    ...withDerivedEnrollments(),
    sessions: weekSessions,
    attendance: todayAttendance,
    invoices,
    payments: payments as DemoPayment[],
    conversations,
    resources: withDemoLibraryFile(resources),
    users: deriveUsers(),
    roles: deriveRoles(),

    branding: deriveBranding(),
    /*
      Metadata for the ONE file the demo library ships (see `librarySeed.ts`).

      The bytes are not here and cannot be: `createSeedDataset()` is pure and
      synchronous while binaries live in the blob store. They are written by
      `ensureDemoLibraryFile()` at bootstrap. A row whose bytes have not landed
      yet is a documented, honest state — the same one a backup restore produces,
      since backups carry metadata only — and the Library UI reports it as
      unavailable instead of offering a download that yields nothing.
    */
    media: [{ ...DEMO_LIBRARY_ASSET }],
    instruments: deriveInstruments(),
    programs: derivePrograms(),
    levels: deriveLevels(),
    learningContent: deriveLearningContent(),
    levelContent: deriveLevelContent(),
    placements: derivePlacements(),
    ...(() => {
      const chat = deriveChat();
      return { chatConversations: chat.conversations, chatMessages: chat.messages };
    })(),
    galleryAlbums: deriveGalleryAlbums(),
    galleryImages: deriveGalleryImages(),

    scheduledSessions: deriveScheduledSessions(),
    // Attendance is recorded through the repository, not seeded: the demo
    // opens with registers waiting to be taken, which is what exercises the UI.
    attendanceRecords: [],
    attendanceCorrections: [],
    pieces: derivePieces(),
    ...(() => {
      const progress = deriveProgress();
      return { pieceAssignments: progress.assignments, progressEvents: progress.events };
    })(),
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
    // Branding is configuration, not a record set: clearing the demo resets it
    // to the default identity rather than leaving the app unnamed.
    branding: deriveBranding(),
    media: [],
    instruments: [],
    programs: [],
    levels: [],
    learningContent: [],
    levelContent: [],
    placements: [],
    chatConversations: [],
    chatMessages: [],
    galleryAlbums: [],
    galleryImages: [],
    pieces: [],
    pieceAssignments: [],
    progressEvents: [],
    scheduledSessions: [],
    attendanceRecords: [],
    attendanceCorrections: [],
  };
}
