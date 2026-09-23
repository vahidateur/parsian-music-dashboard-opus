/**
 * Canonical resource vocabulary shared by the catalogue, curriculum,
 * repertoire and future resource-sharing flows.
 *
 * A Resource is the logical academy object. A MediaAsset is a binary object.
 * They are deliberately different identities: one resource may have several
 * media files (score, reference recording, backing track), and one media file
 * may be referenced by more than one projection.
 *
 * The current frontend still stores LibraryItem and LearningContent in their
 * own collections because they have different owners and eligibility rules.
 * `resourceId` is the bridge that prevents those projections from silently
 * becoming unrelated objects. The API must make this field non-optional on
 * every persisted LearningContent row; the optional compatibility fallback is
 * only for legacy/demo rows and test fixtures that predate this contract.
 */

import type { RoleId } from "@/domains/auth/permissions";
import type { MediaAsset, MediaKind } from "@/domains/media/types";

/** Logical academy-resource identity; never use a MediaAsset id here. */
export type ResourceId = string;

/** Binary identity; kept as a named alias to prevent accidental domain mixing. */
export type MediaId = MediaAsset["id"];

export type ResourceStatus = "active" | "inactive" | "archived";
export type ResourceVisibility = "students" | "teachers";

/** Roles that can participate in a resource decision. */
export type ResourceActorRole = RoleId | "student" | "unauthenticated";

/**
 * A future shared resource projection. This is a contract, not a new persisted
 * collection: existing domains continue to own their rows until a backend can
 * expose the aggregate safely.
 */
export interface ResourceProjection {
  resourceId: ResourceId;
  title: string;
  description?: string;
  kind: string;
  status: ResourceStatus;
  ownerId?: string;
  uploaderId?: string;
  visibility?: ResourceVisibility;
  mediaIds: readonly MediaId[];
  createdAt: string;
  updatedAt?: string;
  audit?: ResourceAuditMetadata;
}

/** One binary attached to a logical resource, with an optional semantic role. */
export interface ResourceMediaReference {
  resourceId: ResourceId;
  mediaId: MediaId;
  role?: "primary" | "score" | "reference-recording" | "backing-track" | "exercise" | "teacher-note" | "gallery";
  version?: number;
}

/** The source projection that currently owns a canonical resource reference. */
export type ResourceProjectionKind =
  | "library"
  | "learning-content"
  | "gallery-image"
  | "gallery-event"
  | "repertoire"
  | "course"
  | "class"
  | "student"
  | "message";

export interface ResourceReference {
  resourceId: ResourceId;
  projection: ResourceProjectionKind;
  sourceId: string;
}

/** A future typed edge for ownership, assignment, eligibility, or attachment. */
export type ResourceAssociationRole =
  | "owner"
  | "uploader"
  | "attachment"
  | "assigned"
  | "eligible"
  | "visible"
  | "featured";

export interface ResourceAssociation {
  resourceId: ResourceId;
  target: ResourceReference;
  role: ResourceAssociationRole;
  createdAt: string;
  createdBy?: string;
}

/** Audit actors are explicit so server events do not masquerade as ownership. */
export interface ResourceAuditMetadata {
  createdBy?: string;
  updatedBy?: string;
  archivedBy?: string;
  archivedAt?: string;
}

export interface ResourceActor {
  role: ResourceActorRole;
  id?: string;
}

export interface ResourceAccessSubject {
  active?: boolean;
  status?: ResourceStatus;
  visibility?: ResourceVisibility;
  restrictedToStudentIds?: readonly string[];
  ownerId?: string;
}

/**
 * Context supplied by the caller that already knows the domain relationship.
 * Curriculum level resolution remains owned by Learning; its final result is
 * passed here so visibility, lifecycle and relationship decisions are not
 * reimplemented by Library, Progress or Repertoire.
 */
export interface ResourceAccessInput {
  actor: ResourceActor;
  /** Frontend permission result; the backend must repeat this decision. */
  hasReadPermission: boolean;
  subject: ResourceAccessSubject;
  curriculumEligible?: boolean;
  requireCurriculumEligibility?: boolean;
}

export type ResourceAccessReason =
  | "allowed"
  | "unauthenticated"
  | "permission-denied"
  | "inactive"
  | "student-identity-missing"
  | "teacher-only"
  | "student-restriction"
  | "curriculum-ineligible";

export interface ResourceAccessDecision {
  allowed: boolean;
  reason: ResourceAccessReason;
}

/**
 * The one frontend policy boundary for resource visibility.
 *
 * This is UX policy only. API endpoints, signed URLs and storage operations
 * must enforce the same rules server-side. The evaluator intentionally accepts
 * the already-derived curriculum result instead of reaching into Learning or
 * Student repositories, which keeps the domain boundary explicit.
 */
export function evaluateResourceAccess(input: ResourceAccessInput): ResourceAccessDecision {
  const { actor, subject } = input;

  if (actor.role === "unauthenticated") return { allowed: false, reason: "unauthenticated" };
  if (!input.hasReadPermission) return { allowed: false, reason: "permission-denied" };
  if (subject.active === false || subject.status === "inactive" || subject.status === "archived") {
    return { allowed: false, reason: "inactive" };
  }

  if (actor.role !== "student") return { allowed: true, reason: "allowed" };
  if (!actor.id) return { allowed: false, reason: "student-identity-missing" };
  if ((subject.visibility ?? "students") === "teachers") return { allowed: false, reason: "teacher-only" };

  const restricted = subject.restrictedToStudentIds;
  if (restricted && restricted.length > 0 && !restricted.includes(actor.id)) {
    return { allowed: false, reason: "student-restriction" };
  }

  if (input.requireCurriculumEligibility && input.curriculumEligible !== true) {
    return { allowed: false, reason: "curriculum-ineligible" };
  }

  return { allowed: true, reason: "allowed" };
}

/** Library ids are canonical resource ids in the current catalogue contract. */
export function resourceIdFromLibrary(row: { id: string }): ResourceId {
  return row.id;
}

/**
 * Learning content has its own curriculum-row id. New rows carry the canonical
 * resource id; the fallback keeps old/demo/test rows readable during migration.
 */
export function resourceIdFromLearningContent(row: { id: string; resourceId?: ResourceId }): ResourceId {
  return row.resourceId ?? row.id;
}

/** A deliberately typed helper for the legacy Piece.contentIds field. */
export function resourceIdsFromPiece(piece: { contentIds?: readonly string[] }): ResourceId[] {
  return [...(piece.contentIds ?? [])];
}

/**
 * Media kind remains owned by Media. This narrow reference keeps the contract
 * discoverable without creating a second media vocabulary in Resources.
 */
export type ResourceMediaKind = MediaKind;
