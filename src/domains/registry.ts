import { ApiAuthRepository } from "./auth/apiAuthRepository";
import { LocalAuthRepository } from "./auth/localAuthRepository";
import { ApiUserRepository } from "./auth/userRepository";
import { LocalUserRepository } from "./auth/localUserRepository";
import { ApiRoleRepository } from "./auth/roleRepository";
import { LocalRoleRepository } from "./auth/localRoleRepository";
import type { RoleRepository } from "./auth/roleRepository";
import type { AuthRepository, UserRepository } from "./auth/repository";
import { ApiStudentRepository } from "./students/apiRepository";
import { LocalStudentRepository } from "./students/localRepository";
import type { StudentRepository } from "./students/repository";
import { ApiTeacherRepository } from "./teachers/apiRepository";
import { LocalTeacherRepository } from "./teachers/localRepository";
import type { TeacherRepository } from "./teachers/repository";
import { ApiRoomRepository } from "./rooms/apiRepository";
import { LocalRoomRepository } from "./rooms/localRepository";
import type { RoomRepository } from "./rooms/repository";
import { ApiClassRepository } from "./classes/apiRepository";
import { LocalClassRepository } from "./classes/localRepository";
import type { ClassRepository } from "./classes/repository";
import { ApiEnrollmentRepository } from "./enrollments/apiRepository";
import { LocalEnrollmentRepository } from "./enrollments/localRepository";
import type { EnrollmentRepository } from "./enrollments/repository";
import { LocalInstrumentRepository } from "./instruments/localRepository";
import type { InstrumentRepository } from "./instruments/repository";
import { LocalLearningRepository } from "./learning/localRepository";
import type { LearningRepository } from "./learning/repository";
import { LocalChatRepository } from "./chat/localRepository";
import type { ChatRepository } from "./chat/repository";
import { LocalMediaRepository } from "./media/localRepository";
import type { MediaRepository } from "./media/repository";
import { LocalLibraryRepository } from "./library/localRepository";
import type { LibraryRepository } from "./library/repository";
import { LocalBrandingRepository } from "./branding/localRepository";
import type { BrandingRepository } from "./branding/repository";
import { LocalOrganizationRepository } from "./organization/localRepository";
import type { OrganizationRepository } from "./organization/repository";
import { LocalGalleryRepository } from "./gallery/localRepository";
import type { GalleryRepository } from "./gallery/repository";
import type { ProgressRepository } from "@/domains/progress/repository";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import type { AttendanceRepository } from "@/domains/attendance/repository";
import { LocalProgressRepository } from "@/domains/progress/localRepository";
import { LocalSchedulingRepository } from "@/domains/scheduling/localRepository";
import { LocalAttendanceRepository } from "@/domains/attendance/localRepository";
import type { CompensationRepository } from "@/domains/compensation/repository";
import { LocalCompensationRepository } from "@/domains/compensation/localRepository";

/**
 * Composition root. The only place that decides whether a domain is served by
 * the DemoStore or by the HTTP API. Views depend on these getters, never on a
 * concrete class.
 */

/*
  Composition root — DEMO target.

  The shared half (ApiClient, auth token, override seams, reset) lives in
  `./registryCore` so the client composition (`./registry.client.ts`) can reuse
  it WITHOUT inheriting a single demo repository import. This file is the demo
  composition: selection below may resolve Demo repositories; the client
  composition never does (no demo fallback — see registry.client.ts).
*/
import { coreOverrides as overrides, coreIsApiMode as isApiMode, getApiClient, setAuthToken } from "./registryCore";

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

export function getStudentRepository(): StudentRepository {
  if (overrides.students) return overrides.students;
  return isApiMode() ? new ApiStudentRepository(getApiClient()) : new LocalStudentRepository();
}

export function getTeacherRepository(): TeacherRepository {
  if (overrides.teachers) return overrides.teachers;
  return isApiMode() ? new ApiTeacherRepository(getApiClient()) : new LocalTeacherRepository();
}

export function getRoomRepository(): RoomRepository {
  if (overrides.rooms) return overrides.rooms;
  return isApiMode() ? new ApiRoomRepository(getApiClient()) : new LocalRoomRepository();
}

export function getClassRepository(): ClassRepository {
  if (overrides.classes) return overrides.classes;
  return isApiMode() ? new ApiClassRepository(getApiClient()) : new LocalClassRepository();
}

export function getEnrollmentRepository(): EnrollmentRepository {
  if (overrides.enrollments) return overrides.enrollments;
  return isApiMode() ? new ApiEnrollmentRepository(getApiClient()) : new LocalEnrollmentRepository();
}

export function getAuthRepository(): AuthRepository {
  if (overrides.auth) return overrides.auth;
  return isApiMode()
    ? new ApiAuthRepository(getApiClient(), (session) => setAuthToken(session?.token ?? null))
    : new LocalAuthRepository();
}

export function getUserRepository(): UserRepository {
  if (overrides.users) return overrides.users;
  return isApiMode() ? new ApiUserRepository(getApiClient()) : new LocalUserRepository();
}

/**
 * Role administration — the access matrix an academy edits in Settings.
 *
 * Unlike the other configuration domains this one resolves to the API
 * implementation in API mode: the matrix IS authorization, so a deployment with
 * a backend must read it from that backend rather than from a local dataset.
 * Until `/roles` exists the read fails, and the policy cache keeps the shipped
 * defaults — a missing endpoint degrades to "nobody has edited the matrix",
 * never to "nobody may do anything".
 */
export function getRoleRepository(): RoleRepository {
  if (overrides.roles) return overrides.roles;
  return isApiMode() ? new ApiRoleRepository(getApiClient()) : new LocalRoleRepository();
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
  return overrides.instruments ?? new LocalInstrumentRepository();
}
export function getLearningRepository(): LearningRepository {
  return overrides.learning ?? new LocalLearningRepository();
}
export function getChatRepository(): ChatRepository {
  return overrides.chat ?? new LocalChatRepository();
}
export function getMediaRepository(): MediaRepository {
  return overrides.media ?? new LocalMediaRepository();
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
  return overrides.library ?? new LocalLibraryRepository();
}
export function getBrandingRepository(): BrandingRepository {
  return overrides.branding ?? new LocalBrandingRepository();
}

/**
 * The academy's rules — session length, turnaround, the free-cancellation window,
 * the make-up ceiling and the bookable hours.
 *
 * Demo-backed even in API mode, exactly like branding: `ApiOrganizationRepository`
 * states the contract, but there is no `/organization` endpoint to call yet, and a
 * panel that read the academy's own rules from a 404 would report the
 * configuration as broken. The consumers of these values (the conflict engine, the
 * make-up prefill, the class form) read them through the repository, so switching
 * the source later changes this line and nothing else.
 */
export function getOrganizationRepository(): OrganizationRepository {
  return overrides.organization ?? new LocalOrganizationRepository();
}
export function getGalleryRepository(): GalleryRepository {
  return overrides.gallery ?? new LocalGalleryRepository();
}
export function getProgressRepository(): ProgressRepository {
  return overrides.progress ?? new LocalProgressRepository();
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
  return overrides.scheduling ?? new LocalSchedulingRepository(undefined, attendancePresence);
}

/**
 * Attendance.
 *
 * Resolves to the demo implementation in BOTH modes, for the same reason as
 * the domains above: the REST contract exists and compiles, but no server
 * serves it.
 */
export function getAttendanceRepository(): AttendanceRepository {
  return overrides.attendance ?? new LocalAttendanceRepository();
}

/**
 * Compensation (make-up obligations for cancelled one-to-one sessions).
 *
 * Resolves to the demo implementation in BOTH modes, like scheduling and
 * attendance. There is deliberately NO `apiRepository` for this domain yet: the
 * verbs are pinned in `compensation/repository.ts` for a backend to satisfy, and
 * registering a REST implementation no server answers would turn every call into
 * a failing request presented as a feature (the D8 disclosure).
 *
 * COMPOSITION, NOT A SECOND COPY. The repository is constructed with the two
 * domains it composes: scheduling owns session creation and the derived roster,
 * attendance answers whether the cancelled original already carries a mark. It
 * receives them as their INTERFACES, so an override injected for either domain
 * (`setSchedulingRepository`, `setAttendanceRepository`) is honoured here too,
 * and this domain never imports another domain's implementation.
 */
export function getCompensationRepository(): CompensationRepository {
  return (
    overrides.compensation ??
    new LocalCompensationRepository(undefined, {
      scheduling: getSchedulingRepository(),
      attendance: getAttendanceRepository(),
    })
  );
}

/*
  D8 — the single enumeration.

  The domains above that resolve to the demo implementation in BOTH modes are
  listed ONCE, here at the composition root where the decision is actually
  made. The api-mode disclosure (`components/shell/DemoBackedNotice`) derives
  its wording from this array — it never keeps its own list, so a domain
  graduating to a served API (or a new domain landing) cannot leave a stale
  banner behind, and the gate test walks every getter on this list to assert
  the enumeration is still true. Labels are the Persian user-facing names.
*/
export interface DemoServedDomain {
  id: string;
  label: string;
}

export const DEMO_SERVED_DOMAINS: readonly DemoServedDomain[] = [
  { id: "instruments", label: "سازها" },
  { id: "learning", label: "مسیرهای یادگیری" },
  { id: "chat", label: "پیام‌ها" },
  { id: "media", label: "رسانه" },
  { id: "library", label: "کتابخانه" },
  { id: "branding", label: "هویت آموزشگاه" },
  { id: "gallery", label: "گالری" },
  { id: "progress", label: "پیشرفت هنرجویان" },
  { id: "scheduling", label: "برنامه‌ریزی" },
  { id: "attendance", label: "حضور و غیاب" },
  { id: "compensation", label: "جبرانی" },
] as const;

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
    const repository = overrides.attendance ?? new LocalAttendanceRepository();
    if (repository instanceof LocalAttendanceRepository) {
      return repository.sessionIdsWithAttendanceSync();
    }
    // A non-demo adapter cannot answer synchronously. Fail safe rather than
    // guessing that no attendance exists.
    return undefined;
  } catch {
    return undefined;
  }
}
