/**
 * Composition root — CLIENT target.
 *
 * The client build is API-oriented and contains no demo capability:
 *
 *   - domains with a real, served REST implementation resolve to their Api*
 *     repository (the same classes the demo composition selects in `api` mode);
 *   - every other domain resolves to an explicit DOMAIN_UNAVAILABLE repository
 *     — never to demo data, never to a speculative endpoint. The shell
 *     discloses the list through `UNAVAILABLE_DOMAINS`, the single enumeration
 *     for this composition (the mirror of the demo composition's
 *     `DEMO_SERVED_DOMAINS`).
 *
 * This file must never import a `demoRepository` or a `localRepository`, the
 * demo/local store, the seed, or demo credentials — asserted by
 * `src/domains/__tests__/registryClient.test.ts`
 * and by the bundle boundary test that scans the real client build output.
 *
 * Shared plumbing (ApiClient, token, override seams, reset) comes from
 * `./registryCore` — identical behaviour, different selection.
 */
import { coreOverrides as overrides, getApiClient, setAuthToken } from "./registryCore";
import { ApiAuthRepository } from "./auth/apiAuthRepository";
import { ApiUserRepository } from "./auth/userRepository";
import { ApiRoleRepository } from "./auth/roleRepository";
import type { AuthRepository, UserRepository } from "./auth/repository";
import type { RoleRepository } from "./auth/roleRepository";
import { ApiStudentRepository } from "./students/apiRepository";
import type { StudentRepository } from "./students/repository";
import { ApiTeacherRepository } from "./teachers/apiRepository";
import type { TeacherRepository } from "./teachers/repository";
import { ApiRoomRepository } from "./rooms/apiRepository";
import type { RoomRepository } from "./rooms/repository";
import { ApiClassRepository } from "./classes/apiRepository";
import type { ClassRepository } from "./classes/repository";
import { ApiEnrollmentRepository } from "./enrollments/apiRepository";
import type { EnrollmentRepository } from "./enrollments/repository";
import type { InstrumentRepository } from "./instruments/repository";
import type { LearningRepository } from "./learning/repository";
import type { ChatRepository } from "./chat/repository";
import type { MediaRepository } from "./media/repository";
import { ApiOrganizationRepository } from "./organization/apiRepository";
import { ApiSchedulingRepository } from "./scheduling/apiRepository";
import { ApiAttendanceRepository } from "./attendance/apiRepository";
import { ApiLibraryRepository } from "./library/apiRepository";
import type { LibraryRepository } from "./library/repository";
import type { BrandingRepository } from "./branding/repository";
import type { OrganizationRepository } from "./organization/repository";
import type { GalleryRepository } from "./gallery/repository";
import type { ProgressRepository } from "@/domains/progress/repository";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import type { AttendanceRepository } from "@/domains/attendance/repository";
import type { CompensationRepository } from "@/domains/compensation/repository";
import { ApiProgressRepository } from "@/domains/progress/apiRepository";
import { createUnavailableRepository } from "@/domains/shared/unavailableRepository";
import { UNAVAILABLE_DOMAINS, type UnavailableDomain } from "@/domains/shared/unavailableDomains";

export {
  getApiClient,
  setAuthToken,
  setProgressRepository,
  setSchedulingRepository,
  setAttendanceRepository,
  setCompensationRepository,
  setInstrumentRepository,
  setLearningRepository,
  setChatRepository,
  setMediaRepository,
  setLibraryRepository,
  setBrandingRepository,
  setOrganizationRepository,
  setGalleryRepository,
  setStudentRepository,
  setTeacherRepository,
  setRoomRepository,
  setClassRepository,
  setEnrollmentRepository,
  setAuthRepository,
  setUserRepository,
  setRoleRepository,
  resetRegistry,
} from "./registryCore";

export { UNAVAILABLE_DOMAINS };
export type { UnavailableDomain };

/**
 * Export-compatible stub of the demo composition's D8 enumeration: in THIS
 * composition no domain is served by demo data, so the honest value is an
 * empty list — `DemoBackedNotice` renders nothing from it (and the shell
 * never mounts that notice in the client target anyway).
 */
export interface DemoServedDomain {
  id: string;
  label: string;
}
export const DEMO_SERVED_DOMAINS: readonly DemoServedDomain[] = [];

const unavailable = <T extends object>(id: string): T => {
  const label = UNAVAILABLE_DOMAINS.find((d) => d.id === id)?.label ?? id;
  return createUnavailableRepository<T>(id, label);
};

/* ------------------------------------------------------------------ */
/* Served domains — the real REST implementations                      */
/* ------------------------------------------------------------------ */

export function getAuthRepository(): AuthRepository {
  if (overrides.auth) return overrides.auth;
  return new ApiAuthRepository(getApiClient(), (session) => setAuthToken(session?.token ?? null));
}

export function getUserRepository(): UserRepository {
  if (overrides.users) return overrides.users;
  return new ApiUserRepository(getApiClient());
}

/**
 * Role administration — the access matrix is authorization, so this
 * composition reads it from the backend, exactly like the demo composition
 * does in `api` mode. Until `/roles` exists the read fails and the shipped
 * defaults stand — a missing endpoint degrades to "nobody has edited the
 * matrix", never to "nobody may do anything".
 */
export function getRoleRepository(): RoleRepository {
  if (overrides.roles) return overrides.roles;
  return new ApiRoleRepository(getApiClient());
}

export function getStudentRepository(): StudentRepository {
  if (overrides.students) return overrides.students;
  return new ApiStudentRepository(getApiClient());
}

export function getTeacherRepository(): TeacherRepository {
  if (overrides.teachers) return overrides.teachers;
  return new ApiTeacherRepository(getApiClient());
}

export function getRoomRepository(): RoomRepository {
  if (overrides.rooms) return overrides.rooms;
  return new ApiRoomRepository(getApiClient());
}

export function getClassRepository(): ClassRepository {
  if (overrides.classes) return overrides.classes;
  return new ApiClassRepository(getApiClient());
}

export function getEnrollmentRepository(): EnrollmentRepository {
  if (overrides.enrollments) return overrides.enrollments;
  return new ApiEnrollmentRepository(getApiClient());
}

/*
 * Progress — served since 2026-10-03 (DECISIONS.md §29 and §30).
 *
 * The backend exposes 14 authorized endpoints under `progress.read` /
 * `progress.write`, and the wire shapes match the TS types field-for-field
 * (`Piece`, `PieceAssignment`, `ProgressEvent` and the nested
 * `ProgressSnapshot`, plus `AssignmentWithPiece`). Contract verification
 * preceded wiring; the endpoint list is asserted against `routes/api.php`.
 */
export function getProgressRepository(): ProgressRepository {
  if (overrides.progress) return overrides.progress;
  return new ApiProgressRepository(getApiClient());
}

/*
 * Organization — served: `GET` and `PATCH /api/v1/organization`.
 *
 * `OrganizationResource` emits exactly the 16 fields of the TS
 * `OrganizationSettings` interface, with no gaps either way.
 */
export function getOrganizationRepository(): OrganizationRepository {
  if (overrides.organization) return overrides.organization;
  return new ApiOrganizationRepository(getApiClient());
}

/*
 * Scheduling — served: 11 endpoints under `sessions`.
 *
 * Every wire shape was compared field-by-field against the backend Resources
 * and DTOs and matches exactly: `Session` (the four conditional keys are
 * emitted only when non-empty, which is precisely the TS optionality),
 * `ConflictReport`, `ConflictItem` (all ten `ConflictKind` values, with the
 * hard/warning split identical), `RosterEntry`, `GenerationPlan` and its four
 * nested item shapes, and `GenerationResult`. `?preview=1` returns the plan as
 * the item, which is what `previewGeneration()` unwraps.
 */
export function getSchedulingRepository(): SchedulingRepository {
  if (overrides.scheduling) return overrides.scheduling;
  return new ApiSchedulingRepository(getApiClient());
}

/*
 * Attendance — served: 8 endpoints, contract-corrected 2026-10-04.
 *
 * Wired only after a contract-authority audit resolved which side defines the
 * wire (see `AttendanceResource`): the TS types are authoritative, and the
 * server now emits `recordedByUserId` / `changedByUserId` / `note` /
 * `attendanceRecordId`, and returns the pre-joined `SessionAttendance` view
 * with its derived `recorded` / `expected` / `locked` fields.
 */
export function getAttendanceRepository(): AttendanceRepository {
  if (overrides.attendance) return overrides.attendance;
  return new ApiAttendanceRepository(getApiClient());
}

/*
 * Library — served: `GET|POST /resources`, `GET|PATCH|DELETE /resources/{id}`.
 *
 * `ResourceResource` emits exactly the eighteen fields of the TS
 * `LibraryItem` — `Resource` plus the five `LibraryItem` additions — with no
 * gaps either way. Optional values arrive as `null` rather than being omitted,
 * and `studentCanAccess` treats `null` as "no restriction" through `!restricted`,
 * so the null/absent distinction the server documents is preserved.
 *
 * The bytes still are not served: this slice is metadata-only, so `mediaId`
 * names a file the server does not hold and downloads remain unavailable.
 */
export function getLibraryRepository(): LibraryRepository {
  if (overrides.library) return overrides.library;
  return new ApiLibraryRepository(getApiClient());
}

/* ------------------------------------------------------------------ */
/* Unavailable domains — explicit DOMAIN_UNAVAILABLE, never demo       */
/* ------------------------------------------------------------------ */

export function getInstrumentRepository(): InstrumentRepository {
  return overrides.instruments ?? unavailable<InstrumentRepository>("instruments");
}
export function getLearningRepository(): LearningRepository {
  return overrides.learning ?? unavailable<LearningRepository>("learning");
}
export function getChatRepository(): ChatRepository {
  return overrides.chat ?? unavailable<ChatRepository>("chat");
}
export function getMediaRepository(): MediaRepository {
  return overrides.media ?? unavailable<MediaRepository>("media");
}
export function getBrandingRepository(): BrandingRepository {
  return overrides.branding ?? unavailable<BrandingRepository>("branding");
}
export function getGalleryRepository(): GalleryRepository {
  return overrides.gallery ?? unavailable<GalleryRepository>("gallery");
}
export function getCompensationRepository(): CompensationRepository {
  return overrides.compensation ?? unavailable<CompensationRepository>("compensation");
}
