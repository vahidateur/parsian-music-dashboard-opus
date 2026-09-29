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
import type { LibraryRepository } from "./library/repository";
import type { BrandingRepository } from "./branding/repository";
import type { OrganizationRepository } from "./organization/repository";
import type { GalleryRepository } from "./gallery/repository";
import type { ProgressRepository } from "@/domains/progress/repository";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import type { AttendanceRepository } from "@/domains/attendance/repository";
import type { CompensationRepository } from "@/domains/compensation/repository";
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
export function getLibraryRepository(): LibraryRepository {
  return overrides.library ?? unavailable<LibraryRepository>("library");
}
export function getBrandingRepository(): BrandingRepository {
  return overrides.branding ?? unavailable<BrandingRepository>("branding");
}
export function getOrganizationRepository(): OrganizationRepository {
  return overrides.organization ?? unavailable<OrganizationRepository>("organization");
}
export function getGalleryRepository(): GalleryRepository {
  return overrides.gallery ?? unavailable<GalleryRepository>("gallery");
}
export function getProgressRepository(): ProgressRepository {
  return overrides.progress ?? unavailable<ProgressRepository>("progress");
}
export function getSchedulingRepository(): SchedulingRepository {
  return overrides.scheduling ?? unavailable<SchedulingRepository>("scheduling");
}
export function getAttendanceRepository(): AttendanceRepository {
  return overrides.attendance ?? unavailable<AttendanceRepository>("attendance");
}
export function getCompensationRepository(): CompensationRepository {
  return overrides.compensation ?? unavailable<CompensationRepository>("compensation");
}
