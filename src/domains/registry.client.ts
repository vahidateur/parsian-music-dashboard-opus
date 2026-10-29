/**
 * Composition root — CLIENT target.
 *
 * The client build is API-oriented and contains no demo capability: every
 * domain resolves to its real, served REST implementation (the same classes
 * the demo composition selects in `api` mode) — never to demo data, never to
 * a speculative endpoint. Domains with no server implementation left resolve
 * to an explicit DOMAIN_UNAVAILABLE repository; with the last one served,
 * `UNAVAILABLE_DOMAINS` is empty and the shell discloses nothing. The list
 * stays the single enumeration for this composition (the mirror of the demo
 * composition's `DEMO_SERVED_DOMAINS`), so a future regression re-appears
 * in exactly one place.
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
import { ApiInstrumentRepository } from "./instruments/apiRepository";
import type { LearningRepository } from "./learning/repository";
import { ApiLearningRepository } from "./learning/apiRepository";
import type { ChatRepository } from "./chat/repository";
import { ApiChatRepository } from "./chat/apiRepository";
import type { MediaRepository } from "./media/repository";
import { ApiMediaRepository } from "./media/apiRepository";
import { ApiOrganizationRepository } from "./organization/apiRepository";
import { ApiSchedulingRepository } from "./scheduling/apiRepository";
import { ApiAttendanceRepository } from "./attendance/apiRepository";
import { ApiLibraryRepository } from "./library/apiRepository";
import type { LibraryRepository } from "./library/repository";
import type { BrandingRepository } from "./branding/repository";
import { ApiBrandingRepository } from "./branding/apiRepository";
import type { OrganizationRepository } from "./organization/repository";
import type { GalleryRepository } from "./gallery/repository";
import { ApiGalleryRepository } from "./gallery/apiRepository";
import type { ProgressRepository } from "@/domains/progress/repository";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import type { AttendanceRepository } from "@/domains/attendance/repository";
import type { CompensationRepository } from "@/domains/compensation/repository";
import { ApiCompensationRepository } from "@/domains/compensation/apiRepository";
import type { FinanceRepository } from "@/domains/finance/repository";
import { ApiFinanceRepository } from "@/domains/finance/apiRepository";
import { ApiProgressRepository } from "@/domains/progress/apiRepository";
import { UNAVAILABLE_DOMAINS, type UnavailableDomain } from "@/domains/shared/unavailableDomains";

export {
  getApiClient,
  setAuthToken,
  setProgressRepository,
  setSchedulingRepository,
  setAttendanceRepository,
  setCompensationRepository,
  setFinanceRepository,
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
 * This slice is metadata-only. The file bytes live in the media domain:
 * `mediaId` references an asset that `getMediaRepository()` uploaded
 * (`POST /media`) and that `GET /media/{id}/bytes` serves, authorized against
 * this resource. The contract's own `POST /uploads` and
 * `GET /resources/{id}/download` are not routed and not used.
 */
export function getLibraryRepository(): LibraryRepository {
  if (overrides.library) return overrides.library;
  return new ApiLibraryRepository(getApiClient());
}

/* ------------------------------------------------------------------ */
/* Formerly unavailable, now served — UNAVAILABLE_DOMAINS is empty    */
/* ------------------------------------------------------------------ */

export function getInstrumentRepository(): InstrumentRepository {
  if (overrides.instruments) return overrides.instruments;
  return new ApiInstrumentRepository(getApiClient());
}
export function getLearningRepository(): LearningRepository {
  if (overrides.learning) return overrides.learning;
  return new ApiLearningRepository(getApiClient());
}
export function getChatRepository(): ChatRepository {
  if (overrides.chat) return overrides.chat;
  return new ApiChatRepository(getApiClient());
}

/**
 * Media — the binary store, served by the API.
 *
 * The server holds the metadata in `media_assets` and the bytes on its
 * private disk; the only way to read them is the authenticated
 * `GET /media/{id}/bytes`, which authorizes the READER against the record
 * that shows the file. So a member's photo is reachable for the people who
 * may see that member, and for nobody else.
 */
export function getMediaRepository(): MediaRepository {
  if (overrides.media) return overrides.media;
  return new ApiMediaRepository(getApiClient());
}
export function getBrandingRepository(): BrandingRepository {
  if (overrides.branding) return overrides.branding;
  return new ApiBrandingRepository(getApiClient());
}
/**
 * Gallery — the academy's showcase, served by the API.
 *
 * Two aggregates behind one repository: albums own their images. Uploads
 * still stage bytes through `MediaRepository` first (multipart), then write
 * the image row that references the asset; a row write that fails releases
 * the staged upload. Reads resolve bytes through `useMediaObjectUrl`, the
 * same seam profile photos and library files use.
 */
export function getGalleryRepository(): GalleryRepository {
  if (overrides.gallery) return overrides.gallery;
  return new ApiGalleryRepository(getApiClient());
}

/*
 * Compensation — private make-up obligations, served by the API.
 *
 * The domain composes scheduling (the make-up session) and attendance (the
 * mark on the cancelled original) read-only; it never re-implements their
 * rules. Registration, booking and discharge are its own three writes, all
 * under the scheduling domain's `schedule.write` (there is no
 * compensation-specific permission id, by the domain's own contract).
 */
export function getCompensationRepository(): CompensationRepository {
  if (overrides.compensation) return overrides.compensation;
  return new ApiCompensationRepository(getApiClient());
}

/*
 * Invoices — served by the API under the existing `finance.read` /
 * `finance.write` ids (administrator, manager-read, accountant-write; see
 * DECISIONS §40). No new permission is invented. v1 issues due invoices
 * and discharges each with one accepted payment: no partial payments, no
 * balance sync.
 */
export function getFinanceRepository(): FinanceRepository {
  if (overrides.finance) return overrides.finance;
  return new ApiFinanceRepository(getApiClient());
}
