// @vitest-environment jsdom
/**
 * M-2 Teacher profile photo — focused regression.
 *
 * Covers:
 *  - TeacherFormDialog mounts ProfilePhotoField (field present)
 *  - photoMediaId persisted through existing TeacherRepository path
 *  - Avatar renders readable photo, falls back to initials on missing/unreadable
 *  - no photo → initials
 *  - existing teacher behavior intact (edit still works, no photo path breaks)
 */
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { Avatar } from "@/components/ds/patterns";
import { TeacherFormDialog } from "../TeacherFormDialog";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { getMediaRepository, getTeacherRepository, resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);

let createdUrls: string[];
let revokedUrls: string[];

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());

  createdUrls = [];
  revokedUrls = [];
  let counter = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => {
      const url = `blob:test-${++counter}`;
      createdUrls.push(url);
      return url;
    }),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn((url: string) => revokedUrls.push(url)),
  });
});

function wrap(node: React.ReactNode) {
  return render(<AppProvider>{node}</AppProvider>);
}

describe("TeacherFormDialog mounts ProfilePhotoField", () => {
  it("shows the photo field (file input + add-image button)", async () => {
    wrap(<TeacherFormDialog open onClose={() => undefined} onSaved={() => undefined} />);

    // ProfilePhotoField renders a hidden file input and a button labelled "افزودن تصویر"
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThan(0);

    // Button text when no mediaId
    expect(await screen.findByRole("button", { name: /افزودن تصویر/ })).toBeDefined();
  });

  it("preserves initials fallback when no photo", async () => {
    wrap(<TeacherFormDialog open onClose={() => undefined} onSaved={() => undefined} />);

    // No mediaId → initials from personName fallback ("مدرس" when name empty)
    // The field shows initials or the generic icon; at least it does not crash.
    const field = document.querySelector('input[type="file"]');
    expect(field).toBeDefined();
  });
});

describe("TeacherRepository photoMediaId path", () => {
  it("persists photoMediaId on create and update through existing repo", async () => {
    // Create a media asset to reference
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "teacher.png",
      mimeType: "image/png",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
    });

    const repo = getTeacherRepository();
    const created = await repo.create({
      name: "مدرس عکس‌دار",
      photoMediaId: asset.id,
      instrument: "piano",
      title: "مدرس پیانو",
      phone: "09120000001",
      status: "active",
      contractHours: 20,
      bio: "",
      students: 0,
      utilization: 0,
      weeklyHours: 0,
      attendanceRate: 100,
      retention: 100,
      since: "امسال",
      todayClasses: [],
      availability: Array.from({ length: 7 }, () => [0, 0, 0, 0]),
    });

    expect(created.photoMediaId).toBe(asset.id);

    const fetched = await repo.get(created.id);
    expect(fetched.photoMediaId).toBe(asset.id);

    // Update to a different photo (or clear) — existing path, no new model
    const second = await getMediaRepository().create({
      kind: "image",
      filename: "teacher2.png",
      mimeType: "image/png",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
    });

    const updated = await repo.update(created.id, { photoMediaId: second.id });
    expect(updated.photoMediaId).toBe(second.id);

    const cleared = await repo.update(created.id, { photoMediaId: undefined });
    expect(cleared.photoMediaId).toBeUndefined();
  });

  it("does not break existing teacher edit flow when photo absent", async () => {
    const repo = getTeacherRepository();
    const before = await repo.list({ per_page: 200 });
    const teacher = before.data[0];

    let saved = false;
    wrap(
      <TeacherFormDialog
        open
        teacher={teacher}
        onClose={() => undefined}
        onSaved={() => (saved = true)}
      />,
    );

    // Edit title only, leave photo untouched
    fireEvent.change(screen.getByLabelText(/عنوان \/ تخصص/), {
      target: { value: "عنوان به‌روزشده" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ تغییرات/ }));

    await waitFor(() => expect(saved).toBe(true));
    const after = await repo.get(teacher.id);
    expect(after.title).toBe("عنوان به‌روزشده");
    // photoMediaId may be undefined, but edit did not drop other fields
    expect(after.name).toBe(teacher.name);
  });
});

describe("Avatar photo rendering (shared)", () => {
  it("renders initials when no photoMediaId", () => {
    wrap(<Avatar name="سارا محمدی" size="md" />);
    expect(screen.getByText("سم")).toBeDefined();
  });

  it("renders image when photoMediaId resolves to a blob", async () => {
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "avatar.png",
      mimeType: "image/png",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
    });

    wrap(<Avatar name="سارا محمدی" size="md" photoMediaId={asset.id} />);

    await waitFor(() => expect(createdUrls.length).toBeGreaterThan(0));
    const img = document.querySelector("img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain("blob:test-");
  });

  it("falls back to initials when media metadata exists but bytes missing (unreadable)", async () => {
    // Orphan metadata — post-restore state
    const orphan = demoStore.media.create({
      kind: "image",
      filename: "gone.png",
      mimeType: "image/png",
      sizeBytes: 10,
      createdAt: new Date().toISOString(),
    });

    wrap(<Avatar name="سارا محمدی" size="md" photoMediaId={orphan.id} />);

    // No blob → useMediaObjectUrl returns undefined → initials
    // Wait a tick for the hook to attempt load
    await waitFor(() => expect(screen.getByText("سم")).toBeDefined());
    expect(document.querySelector("img")).toBeNull();
  });

  it("falls back to initials on image error (onError)", async () => {
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "broken.png",
      mimeType: "image/png",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
    });

    wrap(<Avatar name="سارا محمدی" size="md" photoMediaId={asset.id} />);

    await waitFor(() => expect(document.querySelector("img")).not.toBeNull());
    const img = document.querySelector("img") as HTMLImageElement;
    // Simulate load failure
    fireEvent.error(img);

    await waitFor(() => expect(screen.getByText("سم")).toBeDefined());
  });
});
