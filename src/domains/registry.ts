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
import { DemoLibraryRepository } from "./library/demoRepository";
import type { LibraryRepository } from "./library/repository";
import { DemoBrandingRepository } from "./branding/demoRepository";
import type { BrandingRepository } from "./branding/repository";
import { DemoGalleryRepository } from "./gallery/demoRepository";
import type { GalleryRepository } from "./gallery/repository";
import type { ProgressRepository } from "@/domains/progress/repository";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import type { AttendanceRepository } from "@/domains/attendance/repository";
import { DemoProgressRepository } from "@/domains/progress/demoRepository";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";

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
  library?: LibraryRepository;
  branding?: BrandingRepository;
  gallery?: GalleryRepository;
  progress?: ProgressRepository;
  scheduling?: SchedulingRepository;
  attendance?: AttendanceRepository;
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

/**
 * Library.
 *
 * Resolves to the demo implementation in BOTH modes, for the documented reason
 * above: `ApiLibraryRepository` declares the REST contract (`/resources`) and is
 * covered by a test, but no server serves it. Its files would additionally need
 * a binary-capable client — `ApiClient` speaks JSON only — so registering it
 * would advertise a download path that cannot work (§37).
 */
export function getLibraryRepository(): LibraryRepository {
  return overrides.library ?? new DemoLibraryRepository();
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

/**
 * Scheduling.
 *
 * Resolves to the demo implementation in BOTH modes for the same reason as the
 * domains above: `ApiSchedulingRepository` exists and compiles, but no server
 * serves those endpoints, and registering it would turn every call into a
 * failing request presented as a feature (§37).
 *
 * ATTENDANCE PROTECTION. The repository is constructed with a presence
 * provider backed by real attendance data, so a session that already has marks
 * against it is protected from deletion, editing and rescheduling.
 *
 * The provider is a NARROW boundary — a function returning session ids. It is
 * built here rather than inside the scheduling domain so that scheduling never
 * imports the attendance implementation, and the dependency stays
 * one-directional: attendance may read scheduling for session context, while
 * scheduling consumes only this set of ids.
 *
 * It is still fail-safe. When the provider cannot answer (an unexpected error
 * from the attendance adapter), it returns `undefined`, which the scheduling
 * repository treats as "attendance may exist" and refuses the operation.
 */
export function getSchedulingRepository(): SchedulingRepository {
  return overrides.scheduling ?? new DemoSchedulingRepository(undefined, attendancePresence);
}

/**
 * Attendance.
 *
 * Resolves to the demo implementation in BOTH modes, for the same reason as
 * the domains above: the REST contract exists and compiles, but no server
 * serves it.
 */
export function getAttendanceRepository(): AttendanceRepository {
  return overrides.attendance ?? new DemoAttendanceRepository();
}

/**
 * The scheduling ↔ attendance boundary.
 *
 * Returns the ids of sessions that have at least one attendance record, or
 * `undefined` when that cannot be determined — which scheduling treats as
 * "assume attendance exists" and refuses to destroy anything.
 *
 * An injected attendance override is honoured only when it can answer
 * synchronously; the interface method is async by design (a real backend needs
 * it), while the demo adapter also exposes a sync form for the planner.
 */
function attendancePresence(): ReadonlySet<string> | undefined {
  try {
    const repository = overrides.attendance ?? new DemoAttendanceRepository();
    if (repository instanceof DemoAttendanceRepository) {
      return repository.sessionIdsWithAttendanceSync();
    }
    // A non-demo adapter cannot answer synchronously. Fail safe rather than
    // guessing that no attendance exists.
    return undefined;
  } catch {
    return undefined;
  }
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
  overrides.library = undefined;
  overrides.branding = undefined;
  overrides.gallery = undefined;
  overrides.scheduling = undefined;
  overrides.attendance = undefined;
}
