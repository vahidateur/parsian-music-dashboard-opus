// @vitest-environment jsdom
/**
 * X1 — THE GLOBAL MEDIA-PARENT REFERENCE CHECK, as a regression suite.
 *
 * The invariant under test, in one sentence: a stored asset is never freed while
 * ANY persisted record still references it — not merely the family of records its
 * owner happens to know about.
 *
 * Four shapes of the claim, and why each needs its own test:
 *
 *   1. ONE PARENT IS ENOUGH. Every persisted `MediaAsset.id` reference in the
 *      product keeps the bytes alive on its own: student photo, teacher photo,
 *      catalogue file, teaching material, chat attachment, gallery image, album
 *      cover, branding logo/favicon. Each is exercised through the real release
 *      funnel (`releaseUnreferencedMedia` + `mediaStillReferenced`), so a parent
 *      added to the store but missing from the predicate fails here.
 *   2. CROSS-DOMAIN SHARING. Two records in unrelated domains can hold the same
 *      id; releasing from one side must retain the bytes while the other points
 *      at them. This is the defect class X1 exists to close.
 *   3. LAST PARENT FREES. Once the final reference is gone the same asset is
 *      released — the check must be a gate, not a leak.
 *   4. HONEST EDGES. An empty/blank id is never a reference; the answer follows
 *      the live dataset; and `retained` stays silent while a genuine deletion
 *      failure is still reported.
 *
 * The store and the blob store are genuine, so "was it freed?" means metadata AND
 * bytes are gone, and the deletion probe runs at the moment of the call.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { DemoGalleryRepository } from "@/domains/gallery/demoRepository";
import { DemoStudentRepository } from "@/domains/students/demoRepository";
import { resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import { createMemoryBlobStore, setBlobStore } from "../blobStore";
import { DemoMediaRepository } from "../demoRepository";
import { mediaStillReferenced } from "../demoReferences";
import { releaseUnreferencedMedia, setMediaReleaseFailureReporter } from "../release";
import type { MediaAsset } from "../types";

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

afterEach(() => {
  setMediaReleaseFailureReporter(undefined);
});

/** A structurally valid PNG, as the other media suites build one. */
async function storeAsset(filename = "x1.png"): Promise<MediaAsset> {
  return new DemoMediaRepository().create({
    kind: "image",
    filename,
    mimeType: "image/png",
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
  });
}

/**
 * A media repository that records deletions AND runs a probe at the exact moment
 * of each one, delegating everything else to the real repository — so "retained"
 * can be asserted as "delete was never called", not merely "the row is still
 * there because nothing tried".
 */
function spyingMedia(onDelete?: (mediaId: string) => void) {
  const inner = new DemoMediaRepository();
  const deleted: string[] = [];
  const repo = withStubs(inner, {
    delete: async (id: string) => {
      deleted.push(id);
      onDelete?.(id);
      await inner.delete(id);
    },
  });
  return { repo, deleted };
}

/** The funnel exactly as the four owner repositories call it. */
function release(id: string, media = new DemoMediaRepository()) {
  return releaseUnreferencedMedia(id, (candidate) => mediaStillReferenced(demoStore, candidate), media);
}

function firstStudentId(): string {
  const row = demoStore.students.all()[0];
  expect(row).toBeDefined();
  return row.id;
}

function firstTeacherId(): string {
  const row = demoStore.teachers.all()[0];
  expect(row).toBeDefined();
  return row.id;
}

function firstAlbumId(): string {
  const row = demoStore.galleryAlbums.all()[0];
  expect(row).toBeDefined();
  return row.id;
}

/** Seeded content is used when it exists; otherwise one row is created. */
function ensureLearningContentId(): string {
  const existing = demoStore.learningContent.all()[0];
  if (existing) return existing.id;
  return demoStore.learningContent.create({
    title: "محتوای آزمایشی",
    description: "برای آزمون مرجع رسانه.",
    type: "document",
    visibility: "students",
    active: true,
    createdAt: new Date().toISOString(),
  }).id;
}

/** Same rule for messages: seeded threads are preferred, a synthetic one is valid. */
function ensureChatMessageId(): string {
  const existing = demoStore.chatMessages.all()[0];
  if (existing) return existing.id;
  return demoStore.chatMessages.create({
    conversationId: demoStore.chatConversations.all()[0]?.id ?? "cv_x1",
    from: "me",
    body: "پیام آزمایشی",
    sentAt: new Date().toISOString(),
    provider: "in_app",
    status: "sent",
  }).id;
}

interface ParentFixture {
  name: string;
  /**
   * Persist exactly ONE reference to `mediaId` and return the detach step.
   * Detaching writes an empty string rather than a missing key, so the store
   * always keeps the explicit "no reference" state these tests rely on.
   */
  attach: (mediaId: string) => Promise<() => void> | (() => void);
}

/**
 * Every persisted media parent in the product. Branding is a singleton with two
 * media fields, so it contributes two cases for one parent type.
 */
const PARENTS: ParentFixture[] = [
  {
    name: "student photo",
    attach: (mediaId) => {
      const id = firstStudentId();
      demoStore.students.update(id, { photoMediaId: mediaId });
      return () => demoStore.students.update(id, { photoMediaId: "" });
    },
  },
  {
    name: "teacher photo",
    attach: (mediaId) => {
      const id = firstTeacherId();
      demoStore.teachers.update(id, { photoMediaId: mediaId });
      return () => demoStore.teachers.update(id, { photoMediaId: "" });
    },
  },
  {
    name: "catalogue file",
    attach: (mediaId) => {
      const row = demoStore.resources.all()[0];
      expect(row).toBeDefined();
      demoStore.resources.update(row.id, { mediaId });
      return () => demoStore.resources.update(row.id, { mediaId: "" });
    },
  },
  {
    name: "teaching material",
    attach: (mediaId) => {
      const id = ensureLearningContentId();
      demoStore.learningContent.update(id, { mediaId });
      return () => demoStore.learningContent.update(id, { mediaId: "" });
    },
  },
  {
    name: "chat attachment",
    attach: (mediaId) => {
      const id = ensureChatMessageId();
      demoStore.chatMessages.update(id, { mediaId });
      return () => demoStore.chatMessages.update(id, { mediaId: "" });
    },
  },
  {
    name: "gallery image",
    attach: async (mediaId) => {
      const gallery = new DemoGalleryRepository(demoStore, new DemoMediaRepository());
      const image = await gallery.addImage({
        albumId: firstAlbumId(),
        mediaId,
        caption: "تصویر آزمایشی",
        alt: "تصویر آزمایشی",
      });
      return () => demoStore.galleryImages.remove(image.id);
    },
  },
  {
    name: "album cover",
    attach: (mediaId) => {
      const id = firstAlbumId();
      demoStore.galleryAlbums.update(id, { coverMediaId: mediaId });
      return () => demoStore.galleryAlbums.update(id, { coverMediaId: "" });
    },
  },
  {
    name: "branding logo",
    attach: (mediaId) => {
      demoStore.branding.update({ logoMediaId: mediaId });
      return () => demoStore.branding.update({ logoMediaId: "" });
    },
  },
  {
    name: "branding favicon",
    attach: (mediaId) => {
      demoStore.branding.update({ faviconMediaId: mediaId });
      return () => demoStore.branding.update({ faviconMediaId: "" });
    },
  },
];

describe("X1 — one parent is enough", () => {
  it.each(PARENTS)("retains an asset referenced only by $name", async (fixture) => {
    const asset = await storeAsset(`only-${fixture.name.replace(/\s+/g, "-")}.png`);
    const detach = await fixture.attach(asset.id);
    try {
      expect(mediaStillReferenced(demoStore, asset.id)).toBe(true);

      const { repo, deleted } = spyingMedia();
      expect(await release(asset.id, repo)).toEqual({ status: "retained" });

      // Retained means "delete was never attempted", not merely "still present".
      expect(deleted).toEqual([]);
      expect(demoStore.media.find(asset.id)).toBeDefined();
      expect(await new DemoMediaRepository().getBlob(asset.id)).toBeInstanceOf(Blob);
    } finally {
      detach();
    }

    // LAST PARENT FREES: with the reference gone the same asset goes, metadata
    // and bytes together.
    expect(mediaStillReferenced(demoStore, asset.id)).toBe(false);
    expect(await release(asset.id)).toEqual({ status: "released" });
    expect(demoStore.media.find(asset.id)).toBeUndefined();
    expect(await new DemoMediaRepository().getBlob(asset.id)).toBeUndefined();
  });
});

describe("X1 — cross-domain sharing", () => {
  it("keeps an asset a chat attachment still references after the student lets go", async () => {
    const asset = await storeAsset("shared-with-chat.png");
    const studentId = firstStudentId();
    const messageId = ensureChatMessageId();
    const { repo, deleted } = spyingMedia();
    const students = new DemoStudentRepository(demoStore, repo);

    demoStore.chatMessages.update(messageId, { mediaId: asset.id });
    await students.update(studentId, { photoMediaId: asset.id });
    expect(demoStore.students.find(studentId)?.photoMediaId).toBe(asset.id);

    // The student's write stops referencing the photo — the chat message does not.
    await students.update(studentId, { photoMediaId: "" });
    expect(deleted).toEqual([]);
    expect(demoStore.media.find(asset.id)).toBeDefined();
    expect(await new DemoMediaRepository().getBlob(asset.id)).toBeInstanceOf(Blob);

    // …and when the last parent goes, the asset does.
    demoStore.chatMessages.update(messageId, { mediaId: "" });
    expect(await release(asset.id)).toEqual({ status: "released" });
    expect(demoStore.media.find(asset.id)).toBeUndefined();
  });

  it("retains an id held by two different parent collections", async () => {
    const asset = await storeAsset("two-families.png");
    const studentId = firstStudentId();
    const row = demoStore.resources.all()[0];

    demoStore.students.update(studentId, { photoMediaId: asset.id });
    demoStore.resources.update(row.id, { mediaId: asset.id });

    expect(await release(asset.id)).toEqual({ status: "retained" });

    // One family letting go is not the last word…
    demoStore.students.update(studentId, { photoMediaId: "" });
    expect(mediaStillReferenced(demoStore, asset.id)).toBe(true);
    expect(await release(asset.id)).toEqual({ status: "retained" });

    // …the second one is.
    demoStore.resources.update(row.id, { mediaId: "" });
    expect(await release(asset.id)).toEqual({ status: "released" });
  });
});

describe("X1 — album cover", () => {
  it("keeps an asset used only as a cover alive when the last image using it is removed", async () => {
    const asset = await storeAsset("cover.png");
    const albumId = firstAlbumId();
    const gallery = new DemoGalleryRepository(demoStore, new DemoMediaRepository());

    const image = await gallery.addImage({ albumId, mediaId: asset.id, caption: "کاور", alt: "کاور" });
    await gallery.updateAlbum(albumId, { coverMediaId: asset.id });

    // The image row goes; the album cover still references the same bytes, so the
    // gallery's own cleanup must retain them (this was the blind spot: the old
    // scoped check only counted image rows).
    await gallery.removeImage(image.id);
    expect(demoStore.galleryImages.find(image.id)).toBeUndefined();
    expect(demoStore.media.find(asset.id)).toBeDefined();
    expect(await new DemoMediaRepository().getBlob(asset.id)).toBeInstanceOf(Blob);

    // Clearing the cover is what finally releases it.
    await gallery.updateAlbum(albumId, { coverMediaId: "" });
    expect(await release(asset.id)).toEqual({ status: "released" });
    expect(demoStore.media.find(asset.id)).toBeUndefined();
  });
});

describe("X1 — honest edges", () => {
  it("treats empty and blank ids as no reference at all", async () => {
    // A fresh asset: nothing in the seed points at it, so it isolates exactly the
    // "is an empty id a reference?" question.
    const asset = await storeAsset("empty-ids.png");

    expect(mediaStillReferenced(demoStore, "")).toBe(false);
    expect(mediaStillReferenced(demoStore, "   ")).toBe(false);
    // A stored empty field is a cleared field, never a reference to the empty id.
    demoStore.students.update(firstStudentId(), { photoMediaId: "" });
    demoStore.branding.update({ logoMediaId: "" });
    expect(mediaStillReferenced(demoStore, "")).toBe(false);
    expect(mediaStillReferenced(demoStore, asset.id)).toBe(false);
  });

  it("answers from the live store, not from a snapshot taken earlier", async () => {
    const asset = await storeAsset("live-state.png");
    const studentId = firstStudentId();

    demoStore.students.update(studentId, { photoMediaId: "" });
    expect(mediaStillReferenced(demoStore, asset.id)).toBe(false);

    demoStore.students.update(studentId, { photoMediaId: asset.id });
    expect(mediaStillReferenced(demoStore, asset.id)).toBe(true);

    demoStore.students.update(studentId, { photoMediaId: "" });
    expect(mediaStillReferenced(demoStore, asset.id)).toBe(false);
  });

  it("does not report a retained asset, and still reports a failed deletion", async () => {
    const asset = await storeAsset("reported.png");
    const reported: string[] = [];
    setMediaReleaseFailureReporter((failure) => reported.push(failure.error.code ?? ""));

    demoStore.students.update(firstStudentId(), { photoMediaId: asset.id });
    expect(await release(asset.id)).toEqual({ status: "retained" });
    expect(reported).toEqual([]);

    demoStore.students.update(firstStudentId(), { photoMediaId: "" });
    const failure = new ApiError({ kind: "server", code: "MEDIA_STORAGE_FAILED", message: "ذخیره‌سازی پاسخ نداد." });
    const failing = withStubs(new DemoMediaRepository(), {
      delete: async () => {
        throw failure;
      },
    });
    expect(await release(asset.id, failing)).toEqual({ status: "failed", error: failure });
    expect(reported).toEqual(["MEDIA_STORAGE_FAILED"]);
    expect(demoStore.media.find(asset.id)).toBeDefined();
  });
});
