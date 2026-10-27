// @vitest-environment jsdom
/**
 * Cross-domain integration audit — shared-invalidation contract.
 *
 * Every list hook re-reads when the global data version bumps
 * (`useResourceList` via `useDataVersion`, and the bespoke hooks the same
 * way). In the demo composition the bump comes from the store subscription;
 * in the client composition there is no store, so each Api repository must
 * bump after a write the server accepted — and only then.
 *
 * Instruments (§33), learning (§34) and rooms (§35) established this rule
 * with per-repo tests. This audit pins the same rule for every other served
 * Api repository: a successful write bumps, a refused write does not.
 *
 * Each case below FAILS until its repository bumps — that failure is the
 * demonstrated staleness defect (a panel keeping the pre-write list in the
 * client build), not an assumption.
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { getDataVersion } from "@/domains/shared/dataVersion";
import { asFetch, createFetchMock, jsonResponse, type FetchHandler } from "@/test/fetchMock";

import { ApiStudentRepository } from "@/domains/students/apiRepository";
import { ApiTeacherRepository } from "@/domains/teachers/apiRepository";
import { ApiClassRepository } from "@/domains/classes/apiRepository";
import { ApiEnrollmentRepository } from "@/domains/enrollments/apiRepository";
import { ApiSchedulingRepository } from "@/domains/scheduling/apiRepository";
import { ApiAttendanceRepository } from "@/domains/attendance/apiRepository";
import { ApiLibraryRepository } from "@/domains/library/apiRepository";
import { ApiMediaRepository } from "@/domains/media/apiRepository";
import { ApiOrganizationRepository } from "@/domains/organization/apiRepository";
import { ApiProgressRepository } from "@/domains/progress/apiRepository";
import { ApiGalleryRepository } from "@/domains/gallery/apiRepository";
import { ApiBrandingRepository } from "@/domains/branding/apiRepository";
import { ApiCompensationRepository } from "@/domains/compensation/apiRepository";
import { ApiChatRepository } from "@/domains/chat/apiRepository";
import { ApiUserRepository } from "@/domains/auth/userRepository";
import { ApiRoleRepository } from "@/domains/auth/roleRepository";

function clientFor(handler: FetchHandler): ApiClient {
  const mock = createFetchMock(handler);
  return new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
}

const okData = () => jsonResponse({ data: { id: "x_1" } });
const refused = () => jsonResponse({ error: { code: "TAKEN", message: "تکراری است." } }, 409);

describe("audit: served Api repositories bump the shared version after an accepted write", () => {
  it("students create bumps", async () => {
    const repo = new ApiStudentRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.create({ name: "علی" } as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("teachers create bumps", async () => {
    const repo = new ApiTeacherRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.create({ name: "مدرس" } as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("classes create bumps", async () => {
    const repo = new ApiClassRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.create({ title: "کلاس" } as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("enrollments enroll bumps", async () => {
    const repo = new ApiEnrollmentRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.enroll({} as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("scheduling create bumps", async () => {
    const repo = new ApiSchedulingRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.create({} as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("scheduling generateSessions bumps (it creates sessions)", async () => {
    const repo = new ApiSchedulingRepository(
      clientFor(() => jsonResponse({ data: { planned: 1 } })),
    );
    const before = getDataVersion();
    await repo.generateSessions({} as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("attendance record bumps", async () => {
    const repo = new ApiAttendanceRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.record({} as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("library create bumps", async () => {
    const repo = new ApiLibraryRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.create({ title: "نت", kind: "sheet", instrument: "piano" } as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("media create bumps", async () => {
    const repo = new ApiMediaRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.create({
      kind: "image",
      filename: "a.png",
      mimeType: "image/png",
      bytes: new ArrayBuffer(4),
    });
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("gallery createAlbum bumps", async () => {
    const repo = new ApiGalleryRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.createAlbum({ title: "آلبوم", description: "" } as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("gallery reorderImage bumps (positions are persisted writes)", async () => {
    const repo = new ApiGalleryRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.reorderImage("gi_1", 1);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("chat sendMessage bumps (the open thread and the list refresh)", async () => {
    const repo = new ApiChatRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.sendMessage({ conversationId: "co_1", body: "سلام" });
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("branding update bumps (shell, hero and panel read through one hook)", async () => {
    const repo = new ApiBrandingRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.update({ academyName: "آکادمی نو" });
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("compensation register bumps (the ledger re-reads after an accepted write)", async () => {
    const repo = new ApiCompensationRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.register({ originalSessionId: "se_1", studentId: "st_1", reason: "x", actor: { userId: "u_1", permissions: [] } });
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("organization update bumps (cross-reader: branding falls back to org)", async () => {
    const repo = new ApiOrganizationRepository(
      clientFor(() => jsonResponse({ data: { defaultSessionMinutes: 60 } })),
    );
    const before = getDataVersion();
    await repo.update({ defaultSessionMinutes: 60 });
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("progress recordProgress bumps (overview is a derived read on the version)", async () => {
    const repo = new ApiProgressRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.recordProgress({} as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("users create bumps (teacher rename vs account name cross-view)", async () => {
    const repo = new ApiUserRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.create({ name: "کاربر تست", email: "audit-user@test.local", role: "staff" } as unknown as never);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("roles update bumps (policy sync reads on the version)", async () => {
    const repo = new ApiRoleRepository(clientFor(okData));
    const before = getDataVersion();
    await repo.update("staff", { permissions: ["students.read"] });
    expect(getDataVersion()).toBeGreaterThan(before);
  });
});

describe("audit: a refused write bumps nothing", () => {
  it("students create refused leaves the version", async () => {
    const repo = new ApiStudentRepository(clientFor(refused));
    const before = getDataVersion();
    await expect(repo.create({ name: "تکراری" } as unknown as never)).rejects.toBeTruthy();
    expect(getDataVersion()).toBe(before);
  });

  it("compensation schedule refused leaves the version", async () => {
    const repo = new ApiCompensationRepository(clientFor(refused));
    const before = getDataVersion();
    await expect(
      repo.schedule("cp_1", { date: "2026-02-01", startTime: "14:00", endTime: "15:00", actor: { userId: "u_1", permissions: [] } }),
    ).rejects.toBeTruthy();
    expect(getDataVersion()).toBe(before);
  });

  it("scheduling previewGeneration is read-only and never bumps", async () => {
    const repo = new ApiSchedulingRepository(
      clientFor(() => jsonResponse({ data: { plan: [] } })),
    );
    const before = getDataVersion();
    await repo.previewGeneration({} as unknown as never);
    expect(getDataVersion()).toBe(before);
  });

  it("organization update refused by local validation bumps nothing and sends nothing", async () => {
    const repo = new ApiOrganizationRepository(clientFor(okData));
    const before = getDataVersion();
    await expect(repo.update({ defaultSessionMinutes: 99999 })).rejects.toBeTruthy();
    expect(getDataVersion()).toBe(before);
  });

  it("users create refused by local validation bumps nothing", async () => {
    const repo = new ApiUserRepository(clientFor(okData));
    const before = getDataVersion();
    await expect(
      repo.create({ name: "x", email: "not-an-email", role: "staff" } as unknown as never),
    ).rejects.toBeTruthy();
    expect(getDataVersion()).toBe(before);
  });
});
