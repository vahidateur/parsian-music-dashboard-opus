/**
 * Registry core — the composition root's SHARED half.
 *
 * Both composition targets (`./registry.ts` for demo, `./registry.client.ts`
 * for client) build on this module: the ApiClient instance, the auth token, the
 * override seams and `resetRegistry`. What they deliberately do NOT share is
 * repository SELECTION — that is the target-specific decision, and keeping it
 * out of here is what lets the client composition exist without importing a
 * single demo repository class.
 *
 * No demo implementation may ever be imported by this file.
 */
import { ApiClient } from "@/api/client";
import type { ApiError } from "@/api/errors";
import { getRuntimeConfig } from "@/api/config";
import { defaultTokenStore } from "./auth/tokenStore";
import type { AuthRepository, UserRepository } from "./auth/repository";
import type { RoleRepository } from "./auth/roleRepository";
import type { StudentRepository } from "./students/repository";
import type { TeacherRepository } from "./teachers/repository";
import type { RoomRepository } from "./rooms/repository";
import type { ClassRepository } from "./classes/repository";
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
import type { FinanceRepository } from "@/domains/finance/repository";

let client: ApiClient | null = null;
let authToken: string | null = null;

/**
 * Notified whenever the server answers 401 — including the new
 * AUTH_SESSION_IDLE_EXPIRED / AUTH_SESSION_ABSOLUTE_EXPIRED codes, which
 * the ApiClient already classifies as `authentication`. The AuthProvider
 * subscribes and flips to unauthenticated; without a subscriber the client
 * still clears the dead token, so nothing can replay it.
 */
let sessionExpiredHandler: ((error?: ApiError) => void) | null = null;

export function setSessionExpiredHandler(handler: ((error?: ApiError) => void) | null): void {
  sessionExpiredHandler = handler;
}

/** Test seam: drive the 401 path without a network round trip. */
export function notifySessionExpired(error?: ApiError): void {
  sessionExpiredHandler?.(error);
}

interface Overrides {
  students?: StudentRepository;
  teachers?: TeacherRepository;
  rooms?: RoomRepository;
  classes?: ClassRepository;
  enrollments?: EnrollmentRepository;
  auth?: AuthRepository;
  users?: UserRepository;
  roles?: RoleRepository;
  instruments?: InstrumentRepository;
  learning?: LearningRepository;
  chat?: ChatRepository;
  media?: MediaRepository;
  library?: LibraryRepository;
  branding?: BrandingRepository;
  organization?: OrganizationRepository;
  gallery?: GalleryRepository;
  progress?: ProgressRepository;
  scheduling?: SchedulingRepository;
  attendance?: AttendanceRepository;
  compensation?: CompensationRepository;
  finance?: FinanceRepository;
}
const overrides: Overrides = {};

const isApiMode = (): boolean => getRuntimeConfig().mode === "api";

export function getApiClient(): ApiClient {
  if (!client) {
    client = new ApiClient({
      baseUrl: getRuntimeConfig().apiBaseUrl,
      getToken: () => authToken,
      onUnauthenticated: (error) => {
        authToken = null;
        // A rejected token must not be replayed on the next reload.
        defaultTokenStore.clear();
        sessionExpiredHandler?.(error);
      },
    });
  }
  return client;
}

/** Auth integration point — called by the auth domain after login/refresh. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/* Test seams: inject fakes. Pass `undefined` to restore the real selection. */
export function setProgressRepository(repository: ProgressRepository | undefined): void {
  overrides.progress = repository;
}
export function setSchedulingRepository(repository: SchedulingRepository | undefined): void {
  overrides.scheduling = repository;
}
export function setAttendanceRepository(repository: AttendanceRepository | undefined): void {
  overrides.attendance = repository;
}
export function setCompensationRepository(repository: CompensationRepository | undefined): void {
  overrides.compensation = repository;
}
export function setFinanceRepository(repository: FinanceRepository | undefined): void {
  overrides.finance = repository;
}
export function setInstrumentRepository(repository: InstrumentRepository | undefined): void {
  overrides.instruments = repository;
}
export function setLearningRepository(repository: LearningRepository | undefined): void {
  overrides.learning = repository;
}
export function setChatRepository(repository: ChatRepository | undefined): void {
  overrides.chat = repository;
}
export function setMediaRepository(repository: MediaRepository | undefined): void {
  overrides.media = repository;
}
export function setLibraryRepository(repository: LibraryRepository | undefined): void {
  overrides.library = repository;
}
export function setBrandingRepository(repository: BrandingRepository | undefined): void {
  overrides.branding = repository;
}
export function setOrganizationRepository(repository: OrganizationRepository | undefined): void {
  overrides.organization = repository;
}
export function setGalleryRepository(repository: GalleryRepository | undefined): void {
  overrides.gallery = repository;
}
export function setStudentRepository(repository: StudentRepository | undefined): void {
  overrides.students = repository;
}
export function setTeacherRepository(repository: TeacherRepository | undefined): void {
  overrides.teachers = repository;
}
export function setRoomRepository(repository: RoomRepository | undefined): void {
  overrides.rooms = repository;
}
export function setClassRepository(repository: ClassRepository | undefined): void {
  overrides.classes = repository;
}
export function setEnrollmentRepository(repository: EnrollmentRepository | undefined): void {
  overrides.enrollments = repository;
}
export function setAuthRepository(repository: AuthRepository | undefined): void {
  overrides.auth = repository;
}
export function setUserRepository(repository: UserRepository | undefined): void {
  overrides.users = repository;
}
export function setRoleRepository(repository: RoleRepository | undefined): void {
  overrides.roles = repository;
}

/** Drops memoized instances (used after `setRuntimeConfig`). */
export function resetRegistry(): void {
  client = null;
  authToken = null;
  sessionExpiredHandler = null;
  overrides.students = undefined;
  overrides.teachers = undefined;
  overrides.rooms = undefined;
  overrides.classes = undefined;
  overrides.enrollments = undefined;
  overrides.auth = undefined;
  overrides.users = undefined;
  overrides.roles = undefined;
  overrides.instruments = undefined;
  overrides.progress = undefined;
  overrides.learning = undefined;
  overrides.chat = undefined;
  overrides.media = undefined;
  overrides.library = undefined;
  overrides.branding = undefined;
  overrides.organization = undefined;
  overrides.gallery = undefined;
  overrides.scheduling = undefined;
  overrides.attendance = undefined;
  overrides.compensation = undefined;
  overrides.finance = undefined;
}

/* Internal selection accessors — used by the target composition roots only. */
export const coreOverrides = overrides;
export const coreIsApiMode = isApiMode;
