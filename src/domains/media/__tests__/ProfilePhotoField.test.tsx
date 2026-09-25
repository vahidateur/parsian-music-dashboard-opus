// @vitest-environment jsdom
/**
 * Profile photo upload, replace and remove.
 *
 * The important properties: the record stores only a media id (never bytes),
 * the field HANDS OVER the asset it stops pointing at instead of deleting it,
 * and object URLs are revoked so a long admin session does not accumulate them.
 *
 * WHY "hands over" AND NOT "frees": the record being edited still references the
 * previous photo until the owning form saves, and another record may reference
 * it too. Freeing at the field is what let a cancelled replacement leave a saved
 * record pointing at deleted bytes. The owner-side transition — freed after the
 * write, kept while anything still references the asset, staged uploads freed on
 * cancel — is pinned in `../__tests__/mediaOwnershipTransition.test.tsx`.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { ProfilePhotoField } from "../ProfilePhotoField";
import { createMemoryBlobStore, setBlobStore } from "../blobStore";
import { getMediaRepository, resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);

let created: string[];
let revoked: string[];
/** Assets the canonical seed ships on its own (the library's demo file). */
let seededMediaCount: number;

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  seededMediaCount = demoStore.media.all().length;

  created = [];
  revoked = [];
  let counter = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => {
      const url = `blob:test-${++counter}`;
      created.push(url);
      return url;
    }),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn((url: string) => revoked.push(url)),
  });
});

/** A structurally valid PNG. */
function pngFile(name = "avatar.png"): File {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const file = new File([bytes], name, { type: "image/png" });
  if (!file.arrayBuffer) {
    Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  }
  return file;
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

describe("uploading", () => {
  it("stores the image and reports only a media id upward", async () => {
    const onChange = vi.fn();
    render(
      <AppProvider>
        <ProfilePhotoField mediaId={undefined} personName="سارا محمدی" onChange={onChange} />
      </AppProvider>,
    );

    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const id = onChange.mock.calls[0][0] as string;
    expect(typeof id).toBe("string");
    // A media id, never an inline data URL on the record.
    expect(id.startsWith("data:")).toBe(false);
    expect(await getMediaRepository().getBlob(id)).toBeInstanceOf(Blob);
  });

  it("rejects a disallowed type and writes nothing", async () => {
    const onChange = vi.fn();
    render(
      <AppProvider>
        <ProfilePhotoField mediaId={undefined} personName="سارا" onChange={onChange} />
      </AppProvider>,
    );

    const svg = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });
    Object.defineProperty(svg, "arrayBuffer", { value: async () => new TextEncoder().encode("<svg/>").buffer });
    fireEvent.change(fileInput(), { target: { files: [svg] } });

    await screen.findByRole("alert");
    expect(onChange).not.toHaveBeenCalled();
    // Baseline-relative: the rejected upload must add no asset of its own.
    expect(demoStore.media.all()).toHaveLength(seededMediaCount);
  });

  it("shows initials before any photo exists", () => {
    render(
      <AppProvider>
        <ProfilePhotoField mediaId={undefined} personName="سارا محمدی" onChange={vi.fn()} />
      </AppProvider>,
    );
    expect(screen.getByText("سم")).toBeDefined();
  });
});

describe("replacing", () => {
  it("reports the previous photo upward and does not free it", async () => {
    const first = await getMediaRepository().create({
      kind: "image",
      filename: "old.png",
      mimeType: "image/png",
      bytes: (() => {
        const b = new Uint8Array(32);
        b.set([0x89, 0x50, 0x4e, 0x47], 0);
        return b.buffer;
      })(),
    });

    const onChange = vi.fn();
    render(
      <AppProvider>
        <ProfilePhotoField mediaId={first.id} personName="سارا" onChange={onChange} />
      </AppProvider>,
    );

    fireEvent.change(fileInput(), { target: { files: [pngFile("new.png")] } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [next, released] = onChange.mock.calls[0] as [string, string];
    expect(next).not.toBe(first.id);
    // The replaced asset travels upward with the write the form has not done yet.
    expect(released).toBe(first.id);
    // Still stored: only the owner may free it, and only after its own write.
    expect(demoStore.media.find(first.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(first.id)).toBeInstanceOf(Blob);
  });
});

describe("removing", () => {
  it("clears the field and reports the removed photo without freeing it", async () => {
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "a.png",
      mimeType: "image/png",
      bytes: (() => {
        const b = new Uint8Array(32);
        b.set([0x89, 0x50, 0x4e, 0x47], 0);
        return b.buffer;
      })(),
    });

    const onChange = vi.fn();
    render(
      <AppProvider>
        <ProfilePhotoField mediaId={asset.id} personName="سارا" onChange={onChange} />
      </AppProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /حذف/ }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined, asset.id));
    // The asset outlives the click: the record still references it until the
    // form saves, and the owner frees it then (see the file header).
    expect(demoStore.media.find(asset.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(asset.id)).toBeInstanceOf(Blob);
  });
});

describe("missing bytes", () => {
  it("explains a dangling reference instead of showing a broken image", async () => {
    // Metadata without bytes is exactly the post-backup-restore state.
    const orphan = demoStore.media.create({
      kind: "image",
      filename: "gone.png",
      mimeType: "image/png",
      sizeBytes: 10,
      createdAt: new Date().toISOString(),
    });

    render(
      <AppProvider>
        <ProfilePhotoField mediaId={orphan.id} personName="سارا" onChange={vi.fn()} />
      </AppProvider>,
    );

    expect(await screen.findByText(/در این مرورگر موجود نیست/)).toBeDefined();
  });
});

describe("object URL hygiene", () => {
  it("revokes the object URL on unmount", async () => {
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "a.png",
      mimeType: "image/png",
      bytes: (() => {
        const b = new Uint8Array(32);
        b.set([0x89, 0x50, 0x4e, 0x47], 0);
        return b.buffer;
      })(),
    });

    const view = render(
      <AppProvider>
        <ProfilePhotoField mediaId={asset.id} personName="سارا" onChange={vi.fn()} />
      </AppProvider>,
    );

    await waitFor(() => expect(created.length).toBeGreaterThan(0));
    view.unmount();
    await waitFor(() => expect(revoked).toContain(created[created.length - 1]));
  });
});
