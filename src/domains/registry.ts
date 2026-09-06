import { ApiClient } from "@/api/client";
import { getRuntimeConfig } from "@/api/config";
import { ApiAuthRepository } from "./auth/apiAuthRepository";
import { DemoAuthRepository } from "./auth/demoAuthRepository";
import { ApiUserRepository, DemoUserRepository } from "./auth/userRepository";
import type { AuthRepository, UserRepository } from "./auth/repository";
import { ApiStudentRepository } from "./students/apiRepository";
import { DemoStudentRepository } from "./students/demoRepository";
import type { StudentRepository } from "./students/repository";
import { ApiTeacherRepository } from "./teachers/apiRepository";
import { DemoTeacherRepository } from "./teachers/demoRepository";
import type { TeacherRepository } from "./teachers/repository";
import { ApiRoomRepository } from "./rooms/apiRepository";
import { DemoRoomRepository } from "./rooms/demoRepository";
import type { RoomRepository } from "./rooms/repository";
import { ApiClassRepository } from "./classes/apiRepository";
import { DemoClassRepository } from "./classes/demoRepository";
import type { ClassRepository } from "./classes/repository";
import { ApiEnrollmentRepository } from "./enrollments/apiRepository";
import { DemoEnrollmentRepository } from "./enrollments/demoRepository";
import type { EnrollmentRepository } from "./enrollments/repository";
import { DemoInstrumentRepository } from "./instruments/demoRepository";
import type { InstrumentRepository } from "./instruments/repository";
import { DemoLearningRepository } from "./learning/demoRepository";
import type { LearningRepository } from "./learning/repository";
import { DemoChatRepository } from "./chat/demoRepository";
import type { ChatRepository } from "./chat/repository";
import { DemoMediaRepository } from "./media/demoRepository";
import type { MediaRepository } from "./media/repository";
import { DemoBrandingRepository } from "./branding/demoRepository";
import type { BrandingRepository } from "./branding/repository";
import { DemoGalleryRepository } from "./gallery/demoRepository";
import type { GalleryRepository } from "./gallery/repository";
import type { ProgressRepository } from "@/domains/progress/repository";
import { DemoProgressRepository } from "@/domains/progress/demoRepository";

/**
 * Composition root. The only place that decides whether a domain is served by
 * the DemoStore or by the HTTP API. Views depend on these getters, never on a
 * concrete class.
 */

let client: ApiClient | null = null;
let authToken: string | null = null;

interface Overrides {
  students?: StudentRepository;
  teachers?: TeacherRepository;
  rooms?: RoomRepository;
  classes?: ClassRepository;
  enrollments?: EnrollmentRepository;
  auth?: AuthRepository;
  users?: UserRepository;
  instruments?: InstrumentRepository;
  learning?: LearningRepository;
  chat?: ChatRepository;
  media?: MediaRepository;
  branding?: BrandingRepository;
  gallery?: GalleryRepository;
  progress?: ProgressRepository;
}
const overrides: Overrides = {};

const isApiMode = (): boolean => getRuntimeConfig().mode === "api";

export function getApiClient(): ApiClient {
  if (!client) {
    client = new ApiClient({
      baseUrl: getRuntimeConfig().apiBaseUrl,
      getToken: () => authToken,
      onUnauthenticated: () => {
        authToken = null;
      },
    });
  }
  return client;
}

/** Auth integration point — called by the auth domain after login/refresh. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getStudentRepository(): StudentRepository {
  if (overrides.students) return overrides.students;
  return isApiMode() ? new ApiStudentRepository(getApiClient()) : new DemoStudentRepository();
}

export function getTeacherRepository(): TeacherRepository {
  if (overrides.teachers) return overrides.teachers;
  return isApiMode() ? new ApiTeacherRepository(getApiClient()) : new DemoTeacherRepository();
}

export function getRoomRepository(): RoomRepository {
  if (overrides.rooms) return overrides.rooms;
  return isApiMode() ? new ApiRoomRepository(getApiClient()) : new DemoRoomRepository();
}

export function getClassRepository(): ClassRepository {
  if (overrides.classes) return overrides.classes;
  return isApiMode() ? new ApiClassRepository(getApiClient()) : new DemoClassRepository();
}

export function getEnrollmentRepository(): EnrollmentRepository {
  if (overrides.enrollments) return overrides.enrollments;
  return isApiMode() ? new ApiEnrollmentRepository(getApiClient()) : new DemoEnrollmentRepository();
}

export function getAuthRepository(): AuthRepository {
  if (overrides.auth) return overrides.auth;
  return isApiMode()
    ? new ApiAuthRepository(getApiClient(), (session) => setAuthToken(session?.token ?? null))
    : new DemoAuthRepository();
}

export function getUserRepository(): UserRepository {
  if (overrides.users) return overrides.users;
  return isApiMode() ? new ApiUserRepository(getApiClient()) : new DemoUserRepository();
}

/**
 * Domains added in the profiles/learning/media phase.
 *
 * These currently resolve to the demo implementation in BOTH modes: their REST
 * contracts are declared (see `docs/architecture/data-layer.md`) but no server
 * implements them, and silently returning demo data while claiming to be in API
 * mode would be exactly the dishonest fallback §37 forbids. The API repository
 * is the next step for each; the interface boundary already exists so nothing
 * above these getters changes when it lands.
 */
export function getInstrumentRepository(): InstrumentRepository {
  return overrides.instruments ?? new DemoInstrumentRepository();
}
export function getLearningRepository(): LearningRepository {
  return overrides.learning ?? new DemoLearningRepository();
}
export function getChatRepository(): ChatRepository {
  return overrides.chat ?? new DemoChatRepository();
}
export function getMediaRepository(): MediaRepository {
  return overrides.media ?? new DemoMediaRepository();
}
export function getBrandingRepository(): BrandingRepository {
  return overrides.branding ?? new DemoBrandingRepository();
}
export function getGalleryRepository(): GalleryRepository {
  return overrides.gallery ?? new DemoGalleryRepository();
}
export function getProgressRepository(): ProgressRepository {
  return overrides.progress ?? new DemoProgressRepository();
}

/* Test seams: inject fakes. Pass `undefined` to restore the real selection. */
export function setProgressRepository(repository: ProgressRepository | undefined): void {
  overrides.progress = repository;
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
export function setBrandingRepository(repository: BrandingRepository | undefined): void {
  overrides.branding = repository;
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

/** Drops memoized instances (used after `setRuntimeConfig`). */
export function resetRegistry(): void {
  client = null;
  authToken = null;
  overrides.students = undefined;
  overrides.teachers = undefined;
  overrides.rooms = undefined;
  overrides.classes = undefined;
  overrides.enrollments = undefined;
  overrides.auth = undefined;
  overrides.users = undefined;
  overrides.instruments = undefined;
  overrides.progress = undefined;
  overrides.learning = undefined;
  overrides.chat = undefined;
  overrides.media = undefined;
  overrides.branding = undefined;
  overrides.gallery = undefined;
}
