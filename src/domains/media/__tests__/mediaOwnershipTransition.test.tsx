// @vitest-environment jsdom
/**
 * MEDIA OWNERSHIP TRANSITION — the record→photo handoff, as a regression suite.
 *
 * The invariant under test, in one sentence: an asset is freed only after the
 * write that stopped referencing it succeeded, and only while no remaining
 * record references it.
 *
 * The four claims, and why each is worth a test of its own:
 *
 *   1. replace then CANCEL — the persisted photo must still exist. Freeing at
 *      the field is what produced the real defect: a saved record ended up
 *      pointing at deleted bytes.
 *   2. a superseded STAGED upload — created in this dialog and never persisted —
 *      is freed at once rather than stranded, and a cancelled create does not
 *      leave one behind.
 *   3. replace then SAVE — the new photo is the record's, the replaced one is
 *      gone, and a FAILED write frees neither.
 *   4. a SHARED photo survives while another owner still references it, and is
 *      freed when the last owner lets go.
 *
 * The deletion probe is a real `DemoMediaRepository` behind `withStubs`, so
 * "was it freed?" still means metadata AND bytes are gone, and "when" can be
 * observed at the moment of the call.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { AppProvider } from "@/context/AppContext";
import { ApiError } from "@/api/errors";
import { DemoMediaRepository } from "../demoRepository";
import { createMemoryBlobStore, setBlobStore } from "../blobStore";
import { releaseUnreferencedMedia, setMediaReleaseFailureReporter } from "../release";
import { profilePhotoStillReferenced } from "../demoReferences";
import { StudentFormDialog } from "@/domains/students/StudentFormDialog";
import { DemoStudentRepository } from "@/domains/students/demoRepository";
import { DemoTeacherRepository } from "@/domains/teachers/demoRepository";
import type { Student } from "@/domains/students/types";
import type { MediaAsset } from "../types";
import {
  getMediaRepository,
  getStudentRepository,
  resetRegistry,
  setMediaRepository,
  setStudentRepository,
} from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";

afterEach(cleanup);

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

/** A structurally valid PNG, as the other media suites build one. */
function pngFile(name = "photo.png"): File {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const file = new File([bytes], name, { type: "image/png" });
  if (!file.arrayBuffer) {
    Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  }
  return file;
}

async function storeAvatar(filename: string): Promise<MediaAsset> {
  return new DemoMediaRepository().create({
    kind: "image",
    filename,
    mimeType: "image/png",
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
  });
}

/**
 * A media repository that records deletions and runs a probe at the exact
 * moment of each one, delegating everything else to the real repository — the
 * store and the blob store are genuine, so the assertions still mean something.
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

/** The dialog's parent in the app: closing is what settles staged uploads. */
function StudentDialogHarness({ student }: { student?: Student }) {
  const [open, setOpen] = useState(true);
  return (
    <StudentFormDialog
      open={open}
      student={student}
      onClose={() => setOpen(false)}
      onSaved={() => undefined}
    />
  );
}

function uploadFile(name: string): void {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  fireEvent.change(input, { target: { files: [pngFile(name)] } });
}

/** Waits for an upload to land in the dataset and returns its id. */
async function uploadedId(excluding: string[]): Promise<string> {
  return waitFor(() => {
    const added = demoStore.media.all().map((row) => row.id).filter((id) => !excluding.includes(id));
    expect(added).toHaveLength(1);
    return added[0];
  });
}

function mediaIds(): string[] {
  return demoStore.media.all().map((row) => row.id);
}

describe("the transition helper itself", () => {
  it("frees an unreferenced asset through the media repository", async () => {
    const asset = await storeAvatar("only.png");
    const { repo, deleted } = spyingMedia();

    const outcome = await releaseUnreferencedMedia(asset.id, () => false, repo);

    expect(outcome).toEqual({ status: "released" });
    expect(deleted).toEqual([asset.id]);
    expect(demoStore.media.find(asset.id)).toBeUndefined();
    expect(await getMediaRepository().getBlob(asset.id)).toBeUndefined();
  });

  it("keeps an asset a remaining record still references, without calling delete", async () => {
    const asset = await storeAvatar("shared.png");
    const student = demoStore.students.all()[0];
    demoStore.students.update(student.id, { photoMediaId: asset.id });
    const { repo, deleted } = spyingMedia();

    const outcome = await releaseUnreferencedMedia(asset.id, (id) => profilePhotoStillReferenced(demoStore, id), repo);

    expect(outcome).toEqual({ status: "retained" });
    expect(deleted).toEqual([]);
    expect(await getMediaRepository().getBlob(asset.id)).toBeInstanceOf(Blob);
  });

  it("treats an empty id as nothing to free", async () => {
    const { repo, deleted } = spyingMedia();

    expect(await releaseUnreferencedMedia("", () => false, repo)).toEqual({ status: "skipped" });
    expect(await releaseUnreferencedMedia(undefined, () => false, repo)).toEqual({ status: "skipped" });
    expect(deleted).toEqual([]);
  });

  it("reports a failed cleanup instead of swallowing it, after the owner write stands", async () => {
    const asset = await storeAvatar("stuck.png");
    const failure = new ApiError({ kind: "server", code: "MEDIA_STORAGE_FAILED", message: "ذخیره‌سازی پاسخ نداد." });
    const repo = withStubs(new DemoMediaRepository(), {
      delete: async () => {
        throw failure;
      },
    });

    const reported: string[] = [];
    setMediaReleaseFailureReporter((f) => reported.push(f.error.code ?? ""));
    try {
      const outcome = await releaseUnreferencedMedia(asset.id, () => false, repo);

      // Returned as data...
      expect(outcome).toEqual({ status: "failed", error: failure });
      // ...and handed to the reporter: not silent, and not thrown at a caller
      // whose write has already committed (a rollback this store cannot do).
      expect(reported).toEqual(["MEDIA_STORAGE_FAILED"]);
      expect(demoStore.media.find(asset.id)).toBeDefined();
    } finally {
      setMediaReleaseFailureReporter(undefined);
    }
  });
});

describe("replace then cancel", () => {
  it("keeps the persisted photo intact and frees only the abandoned upload", async () => {
    const persisted = await storeAvatar("old.png");
    const student = demoStore.students.all()[0];
    const withPhoto = await getStudentRepository().update(student.id, { photoMediaId: persisted.id });
    const before = mediaIds();
    const { repo, deleted } = spyingMedia();
    setMediaRepository(repo);

    render(
      <AppProvider>
        <StudentDialogHarness student={withPhoto} />
      </AppProvider>,
    );

    uploadFile("replacement.png");
    const stagedId = await uploadedId(before);
    expect(deleted).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));

    // The upload never reached a record: it is freed at once...
    await waitFor(() => expect(deleted).toEqual([stagedId]));
    expect(demoStore.media.find(stagedId)).toBeUndefined();
    expect(await getMediaRepository().getBlob(stagedId)).toBeUndefined();
    // ...and the photo the record still points at is untouched, metadata AND bytes.
    expect(demoStore.media.find(persisted.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(persisted.id)).toBeInstanceOf(Blob);
    expect((await getStudentRepository().get(student.id)).photoMediaId).toBe(persisted.id);
  });

  it("frees an upload abandoned in a cancelled CREATE dialog and leaves no record behind", async () => {
    const before = mediaIds();
    const studentsBefore = demoStore.students.all().length;
    const { repo, deleted } = spyingMedia();
    setMediaRepository(repo);

    render(
      <AppProvider>
        <StudentDialogHarness />
      </AppProvider>,
    );

    uploadFile("never-saved.png");
    const stagedId = await uploadedId(before);
    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));

    await waitFor(() => expect(deleted).toEqual([stagedId]));
    expect(await getMediaRepository().getBlob(stagedId)).toBeUndefined();
    expect(demoStore.students.all()).toHaveLength(studentsBefore);
  });

  it("frees an upload that a second upload replaced before saving", async () => {
    const persisted = await storeAvatar("old.png");
    const student = demoStore.students.all()[0];
    const withPhoto = await getStudentRepository().update(student.id, { photoMediaId: persisted.id });
    const before = mediaIds();
    const { repo, deleted } = spyingMedia();
    setMediaRepository(repo);

    render(
      <AppProvider>
        <StudentDialogHarness student={withPhoto} />
      </AppProvider>,
    );

    uploadFile("first-try.png");
    const abandoned = await uploadedId(before);
    uploadFile("second-try.png");
    const kept = await uploadedId([...before, abandoned]);

    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));

    // Both staged uploads go — neither was ever referenced — while the persisted
    // photo keeps its bytes.
    await waitFor(() => expect(deleted.sort()).toEqual([abandoned, kept].sort()));
    expect(demoStore.media.find(persisted.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(persisted.id)).toBeInstanceOf(Blob);
  });
});

describe("replace then save", () => {
  it("points the record at the new photo and frees the replaced one", async () => {
    const persisted = await storeAvatar("old.png");
    const student = demoStore.students.all()[0];
    const withPhoto = await getStudentRepository().update(student.id, { photoMediaId: persisted.id });
    const before = mediaIds();
    const observed: { mediaId: string; recordHadNewPhoto: boolean }[] = [];
    const { repo, deleted } = spyingMedia((mediaId) => {
      observed.push({
        mediaId,
        recordHadNewPhoto: demoStore.students.find(student.id)?.photoMediaId !== persisted.id,
      });
    });
    // Both transitions meet the same probe: the dialog frees a staged upload
    // through the registry, the owner write releases the superseded photo
    // through the repository's injected media dependency.
    setMediaRepository(repo);
    setStudentRepository(new DemoStudentRepository(demoStore, repo));

    render(
      <AppProvider>
        <StudentDialogHarness student={withPhoto} />
      </AppProvider>,
    );

    uploadFile("replacement.png");
    const stagedId = await uploadedId(before);

    fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ تغییرات/ }));

    await waitFor(async () => expect((await getStudentRepository().get(student.id)).photoMediaId).toBe(stagedId));
    // The old photo is freed — and at that moment the record already carried the
    // new one (persist first, then clean up).
    await waitFor(() => expect(deleted).toEqual([persisted.id]));
    expect(observed).toEqual([{ mediaId: persisted.id, recordHadNewPhoto: true }]);
    expect(demoStore.media.find(persisted.id)).toBeUndefined();
    // The saved photo is NOT freed with the dialog's closing cleanup.
    expect(demoStore.media.find(stagedId)).toBeDefined();
    expect(await getMediaRepository().getBlob(stagedId)).toBeInstanceOf(Blob);
  });

  it("frees nothing when the owner write fails, and the record keeps its photo", async () => {
    const persisted = await storeAvatar("old.png");
    const student = demoStore.students.all()[0];
    const withPhoto = await getStudentRepository().update(student.id, { photoMediaId: persisted.id });
    setStudentRepository(
      withStubs(new DemoStudentRepository(), {
        update: async () => {
          throw new ApiError({ kind: "server", message: "ذخیرهٔ هنرجو انجام نشد." });
        },
      }),
    );
    const { repo, deleted } = spyingMedia();
    setMediaRepository(repo);
    const before = mediaIds();

    render(
      <AppProvider>
        <StudentDialogHarness student={withPhoto} />
      </AppProvider>,
    );

    uploadFile("doomed.png");
    const stagedId = await uploadedId(before);
    fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ تغییرات/ }));

    // The failure is shown, not reported as success.
    await screen.findByText(/ذخیرهٔ هنرجو انجام نشد/);
    // Nothing was freed: the record still references the old photo, and the
    // staged upload is still only staged (the dialog is still open).
    expect(deleted).toEqual([]);
    expect(demoStore.media.find(persisted.id)).toBeDefined();
    expect(demoStore.media.find(stagedId)).toBeDefined();
    expect((await getStudentRepository().get(student.id)).photoMediaId).toBe(persisted.id);
  });
});

describe("shared media", () => {
  it("survives the first owner that lets go and is freed when the last one does", async () => {
    const shared = await storeAvatar("shared.png");
    const studentRepo = new DemoStudentRepository();
    const student = demoStore.students.all()[0];
    await studentRepo.update(student.id, { photoMediaId: shared.id });

    const teacherRepo = new DemoTeacherRepository();
    const teacher = await teacherRepo.create({
      name: "مدرس عکس‌دار",
      photoMediaId: shared.id,
      instrument: "piano",
      title: "مدرس پیانو",
      phone: "09120000009",
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

    await teacherRepo.delete(teacher.id);

    // The student still shows the same photo: bytes and metadata both survive.
    expect(demoStore.media.find(shared.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(shared.id)).toBeInstanceOf(Blob);

    // The last owner lets go — now, and only now, the asset goes.
    await studentRepo.delete(student.id);
    expect(demoStore.media.find(shared.id)).toBeUndefined();
    expect(await getMediaRepository().getBlob(shared.id)).toBeUndefined();
  });

  it("does not free a photo the record still references when a different field changes", async () => {
    const photo = await storeAvatar("kept.png");
    const repo = new DemoStudentRepository();
    const student = demoStore.students.all()[0];
    await repo.update(student.id, { photoMediaId: photo.id });

    // A patch that does not name the photo cannot release it.
    await repo.update(student.id, { name: "نام تازه" });

    expect(demoStore.media.find(photo.id)).toBeDefined();
    expect((await repo.get(student.id)).photoMediaId).toBe(photo.id);
  });
});
