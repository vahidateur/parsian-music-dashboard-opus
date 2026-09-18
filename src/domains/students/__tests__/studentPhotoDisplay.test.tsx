// @vitest-environment jsdom
/**
 * M-3 Student profile photo display — remaining gap.
 *
 * M-2 already wired shared Avatar + Students list/table.
 * Remaining gap was StudentDetail header (profile identity) not showing photo.
 *
 * Required:
 *  - readable photo displays where student profile identity shown
 *  - no photo → initials
 *  - missing/orphaned → initials
 *  - unreadable → initials
 *  - photo not confused with no photo
 *  - persistence unchanged
 */
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { Avatar } from "@/components/ds/patterns";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { getMediaRepository, getStudentRepository, resetRegistry } from "@/domains/registry";
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

describe("Student profile identity photo", () => {
  it("renders initials when no photoMediaId (no photo)", () => {
    wrap(<Avatar name="سارا محمدی" size="md" />);
    expect(screen.getByText("سم")).toBeDefined();
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders image when readable photo exists (Student.photoMediaId → MediaRepo → Avatar)", async () => {
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "student.png",
      mimeType: "image/png",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
    });

    wrap(<Avatar name="سارا محمدی" size="md" photoMediaId={asset.id} />);

    await waitFor(() => expect(createdUrls.length).toBeGreaterThan(0));
    const img = document.querySelector("img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain("blob:test-");
    // Alt contains person name for a11y, not confused with initials
    expect(img!.alt).toContain("سارا محمدی");
    expect(screen.queryByText("سم")).toBeNull();
  });

  it("falls back to initials when media metadata exists but bytes missing (orphaned)", async () => {
    const orphan = demoStore.media.create({
      kind: "image",
      filename: "gone.png",
      mimeType: "image/png",
      sizeBytes: 10,
      createdAt: new Date().toISOString(),
    });

    wrap(<Avatar name="سارا محمدی" size="md" photoMediaId={orphan.id} />);

    await waitFor(() => expect(screen.getByText("سم")).toBeDefined());
    expect(document.querySelector("img")).toBeNull();
  });

  it("falls back to initials on unreadable image (onError)", async () => {
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "broken.png",
      mimeType: "image/png",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
    });

    wrap(<Avatar name="سارا محمدی" size="md" photoMediaId={asset.id} />);

    await waitFor(() => expect(document.querySelector("img")).not.toBeNull());
    const img = document.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);

    await waitFor(() => expect(screen.getByText("سم")).toBeDefined());
  });

  it("distinguishes photo vs no photo (photo present does not show initials)", async () => {
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "a.png",
      mimeType: "image/png",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
    });

    const { unmount } = wrap(<Avatar name="علی رضایی" size="md" photoMediaId={asset.id} />);
    await waitFor(() => expect(document.querySelector("img")).not.toBeNull());
    expect(screen.queryByText("عر")).toBeNull();

    unmount();
    cleanup();

    wrap(<Avatar name="علی رضایی" size="md" photoMediaId={undefined} />);
    expect(screen.getByText("عر")).toBeDefined();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("StudentRepository photoMediaId persistence unchanged", () => {
  it("persists photoMediaId through existing repo path", async () => {
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "s.png",
      mimeType: "image/png",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
    });

    const repo = getStudentRepository();
    const before = await repo.list({ per_page: 200 });
    const student = before.data[0];

    const updated = await repo.update(student.id, { photoMediaId: asset.id });
    expect(updated.photoMediaId).toBe(asset.id);

    const fetched = await repo.get(student.id);
    expect(fetched.photoMediaId).toBe(asset.id);

    const cleared = await repo.update(student.id, { photoMediaId: undefined });
    expect(cleared.photoMediaId).toBeUndefined();
  });
});
