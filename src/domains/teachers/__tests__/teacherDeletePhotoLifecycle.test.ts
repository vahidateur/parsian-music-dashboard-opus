// @vitest-environment jsdom
/**
 * Teacher delete — the record→photo ownership transition.
 *
 * A teacher record may carry a profile photo. Deleting the record used to leave
 * the photo's bytes and metadata behind forever, because the class guard was the
 * only thing the delete path considered. The rules now under test:
 *
 *   - the owner record is removed FIRST; only then is its photo a cleanup
 *     candidate, so a cleanup that fails can never resurrect the record;
 *   - the existing refusal (a teacher still assigned to classes) is untouched,
 *     and a refused delete frees nothing;
 *   - a photo another owner still references survives (`mediaOwnershipTransition`
 *     covers the cross-owner case; this file covers the owner-side ordering).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import type { MediaAsset } from "@/domains/media/types";
import { DemoTeacherRepository } from "../demoRepository";
import { getMediaRepository, resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

async function storeAvatar(filename: string): Promise<MediaAsset> {
  return new DemoMediaRepository().create({
    kind: "image",
    filename,
    mimeType: "image/png",
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
  });
}

/** Real media work, with the deletions recorded and probed as they happen. */
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

async function teacherWithPhoto(photoMediaId: string, phone = "09120000009") {
  return new DemoTeacherRepository(demoStore, new DemoMediaRepository()).create({
    name: "مدرس عکس‌دار",
    photoMediaId,
    instrument: "piano",
    title: "مدرس پیانو",
    phone,
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
}

describe("deleting a teacher with a photo", () => {
  it("removes the record first and frees the photo afterwards", async () => {
    const photo = await storeAvatar("teacher.png");
    const teacher = await teacherWithPhoto(photo.id);

    const probe: { rowAlreadyGone: boolean }[] = [];
    const { repo, deleted } = spyingMedia(() => {
      probe.push({ rowAlreadyGone: demoStore.teachers.find(teacher.id) === undefined });
    });
    const teachers = new DemoTeacherRepository(demoStore, repo);

    await teachers.delete(teacher.id);

    // The record went first — the cleanup cannot bring it back, and cannot run
    // against a record that is still there.
    expect(probe).toEqual([{ rowAlreadyGone: true }]);
    expect(demoStore.teachers.find(teacher.id)).toBeUndefined();
    expect(deleted).toEqual([photo.id]);
    // Metadata and bytes leave together.
    expect(demoStore.media.find(photo.id)).toBeUndefined();
    expect(await getMediaRepository().getBlob(photo.id)).toBeUndefined();
  });

  it("keeps the photo when the class guard refuses the delete", async () => {
    const assigned = demoStore.classes.all().find((row) => row.teacherId);
    if (!assigned) throw new Error("the demo seed must ship a class with a teacher");
    const photo = await storeAvatar("assigned.png");

    const { repo, deleted } = spyingMedia();
    const teachers = new DemoTeacherRepository(demoStore, repo);
    await teachers.update(assigned.teacherId, { photoMediaId: photo.id });

    await expect(teachers.delete(assigned.teacherId)).rejects.toMatchObject({ code: "TEACHER_HAS_CLASSES" });

    // Refusal is not a partial delete: the record, its classes and its photo all stand.
    expect(demoStore.teachers.find(assigned.teacherId)).toBeDefined();
    expect(demoStore.classes.all().some((row) => row.teacherId === assigned.teacherId)).toBe(true);
    expect(deleted).toEqual([]);
    expect(demoStore.media.find(photo.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(photo.id)).toBeInstanceOf(Blob);
  });

  it("fails the write, not the cleanup, when the photo cannot be freed", async () => {
    const photo = await storeAvatar("stuck.png");
    const teacher = await teacherWithPhoto(photo.id, "09120000010");
    const failing = withStubs(new DemoMediaRepository(), {
      delete: async () => {
        throw new ApiError({ kind: "server", code: "MEDIA_STORAGE_FAILED", message: "ذخیره‌سازی پاسخ نداد." });
      },
    });
    const teachers = new DemoTeacherRepository(demoStore, failing);

    // The delete SUCCEEDS: the record is gone and the cleanup failure is
    // returned as data rather than thrown back at a caller whose write already
    // committed — reporting it as a failed delete would be a lie, and the store
    // cannot roll the removal back.
    await expect(teachers.delete(teacher.id)).resolves.toBeUndefined();

    expect(demoStore.teachers.find(teacher.id)).toBeUndefined();
    // The asset is still there; nothing pretended it had been freed.
    expect(demoStore.media.find(photo.id)).toBeDefined();
  });
});

describe("editing a teacher's photo", () => {
  it("frees the replaced photo only after the record carries the new one", async () => {
    const first = await storeAvatar("first.png");
    const second = await storeAvatar("second.png");
    const teacher = await teacherWithPhoto(first.id, "09120000011");

    const probe: { mediaId: string; recordAlreadyCarriesNew: boolean }[] = [];
    const { repo, deleted } = spyingMedia((mediaId) => {
      probe.push({ mediaId, recordAlreadyCarriesNew: demoStore.teachers.find(teacher.id)?.photoMediaId === second.id });
    });
    const teachers = new DemoTeacherRepository(demoStore, repo);

    await teachers.update(teacher.id, { photoMediaId: second.id });

    expect(deleted).toEqual([first.id]);
    expect(probe).toEqual([{ mediaId: first.id, recordAlreadyCarriesNew: true }]);
    expect(await getMediaRepository().getBlob(first.id)).toBeUndefined();
    expect(await getMediaRepository().getBlob(second.id)).toBeInstanceOf(Blob);
  });
});
