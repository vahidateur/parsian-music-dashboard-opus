import { describe, expect, it } from "vitest";
import { rolePermissions, type Permission } from "@/domains/auth/permissions";
import { resources } from "@/domains/demo/academySeed";
import { deriveLearningContent } from "@/domains/demo/learningSeed";
import { withDemoLibraryFile } from "@/domains/demo/librarySeed";
import { evaluateResourceAccess, resourceIdFromLearningContent, resourceIdFromLibrary } from "../types";

const subject = {
  active: true,
  visibility: "students" as const,
  restrictedToStudentIds: [] as string[],
};

function readPermission(role: keyof typeof rolePermissions): boolean {
  return rolePermissions[role].includes("library.read" as Permission);
}

describe("canonical resource access", () => {
  it("uses the role matrix for every current operator role", () => {
    expect(evaluateResourceAccess({ actor: { role: "administrator" }, hasReadPermission: readPermission("administrator"), subject }).allowed).toBe(true);
    expect(evaluateResourceAccess({ actor: { role: "manager" }, hasReadPermission: readPermission("manager"), subject }).allowed).toBe(true);
    expect(evaluateResourceAccess({ actor: { role: "teacher" }, hasReadPermission: readPermission("teacher"), subject }).allowed).toBe(true);
    expect(evaluateResourceAccess({ actor: { role: "staff" }, hasReadPermission: readPermission("staff"), subject }).allowed).toBe(true);
    expect(evaluateResourceAccess({ actor: { role: "accountant" }, hasReadPermission: readPermission("accountant"), subject }).reason).toBe("permission-denied");
  });

  it("handles the student identity and audience boundary", () => {
    expect(evaluateResourceAccess({ actor: { role: "student", id: "st1" }, hasReadPermission: true, subject }).allowed).toBe(true);
    expect(evaluateResourceAccess({ actor: { role: "student" }, hasReadPermission: true, subject }).reason).toBe("student-identity-missing");
    expect(evaluateResourceAccess({ actor: { role: "student", id: "st1" }, hasReadPermission: true, subject: { ...subject, visibility: "teachers" } }).reason).toBe("teacher-only");
  });

  it("enforces active state, selected-student restrictions, and curriculum eligibility", () => {
    expect(evaluateResourceAccess({ actor: { role: "student", id: "st1" }, hasReadPermission: true, subject: { ...subject, active: false } }).reason).toBe("inactive");
    expect(evaluateResourceAccess({ actor: { role: "student", id: "st2" }, hasReadPermission: true, subject: { ...subject, restrictedToStudentIds: ["st1"] } }).reason).toBe("student-restriction");
    expect(evaluateResourceAccess({ actor: { role: "student", id: "st1" }, hasReadPermission: true, subject, requireCurriculumEligibility: true, curriculumEligible: false }).reason).toBe("curriculum-ineligible");
    expect(evaluateResourceAccess({ actor: { role: "student", id: "st1" }, hasReadPermission: true, subject, requireCurriculumEligibility: true, curriculumEligible: true }).allowed).toBe(true);
  });

  it("denies unauthenticated and permissionless access", () => {
    expect(evaluateResourceAccess({ actor: { role: "unauthenticated" }, hasReadPermission: true, subject }).reason).toBe("unauthenticated");
    expect(evaluateResourceAccess({ actor: { role: "teacher" }, hasReadPermission: false, subject }).reason).toBe("permission-denied");
  });
});

describe("canonical identity adapters", () => {
  it("keeps the seeded Library and Learning projections on one logical resource", () => {
    const libraryRows = withDemoLibraryFile(resources);
    const learningRows = deriveLearningContent(libraryRows);
    const library = libraryRows.find((row) => row.id === "res1")!;
    const learning = learningRows.find((row) => row.id === "lc_res1")!;

    expect(learning.resourceId).toBe(library.id);
    expect(learning.mediaId).toBe(library.mediaId);
  });

  it("keeps Library identity separate from Media identity", () => {
    expect(resourceIdFromLibrary({ id: "res1" })).toBe("res1");
    expect(resourceIdFromLearningContent({ id: "lc_res1", resourceId: "res1" })).toBe("res1");
    expect(resourceIdFromLearningContent({ id: "legacy-content" })).toBe("legacy-content");
    expect(resourceIdFromLibrary({ id: "res1" })).not.toBe("md_demo_res1");
  });
});
