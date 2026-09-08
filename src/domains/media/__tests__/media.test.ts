// @vitest-environment jsdom
/**
 * Media validation and the metadata/bytes split.
 *
 * The security-relevant claims here are the type allow-list, the magic-byte
 * cross-check, the size ceiling and filename sanitization.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoMediaRepository, sanitizeFilename } from "../demoRepository";
import { createMemoryBlobStore, setBlobStore } from "../blobStore";
import { MAX_IMAGE_BYTES } from "../types";
import { demoStore } from "@/services/demoStore";
import { ApiError } from "@/api/errors";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

let repo: DemoMediaRepository;

/** A minimal but structurally valid PNG header. */
function pngBytes(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes.buffer;
}

function jpegBytes(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return bytes.buffer;
}

beforeEach(() => {
  resetToDemoEnvironment();
  setBlobStore(createMemoryBlobStore());
  repo = new DemoMediaRepository();
});

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string[]> | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.fields : undefined;
  }
}

describe("upload validation", () => {
  it("accepts a valid PNG and records only metadata in the dataset", async () => {
    const asset = await repo.create({
      kind: "image",
      filename: "portrait.png",
      mimeType: "image/png",
      bytes: pngBytes(),
    });
    expect(asset.id).toBeTruthy();
    expect(asset.sizeBytes).toBe(64);

    // The dataset row carries no binary payload.
    const stored = demoStore.media.find(asset.id);
    expect(stored).toBeDefined();
    expect(JSON.stringify(stored)).not.toContain("data:");
    expect(Object.keys(stored ?? {})).not.toContain("bytes");

    // The bytes are retrievable from the blob store.
    expect(await repo.getBlob(asset.id)).toBeInstanceOf(Blob);
  });

  it("rejects a disallowed type, including SVG", async () => {
    expect(
      await fieldsOf(
        repo.create({ kind: "image", filename: "x.svg", mimeType: "image/svg+xml", bytes: pngBytes() }),
      ),
    ).toHaveProperty("mimeType");
  });

  it("rejects a file whose bytes contradict its declared type", async () => {
    // Claims PNG, actually starts with a JPEG signature.
    const fields = await fieldsOf(
      repo.create({ kind: "image", filename: "fake.png", mimeType: "image/png", bytes: jpegBytes() }),
    );
    expect(fields).toHaveProperty("bytes");
  });

  it("rejects an empty file", async () => {
    expect(
      await fieldsOf(
        repo.create({ kind: "image", filename: "empty.png", mimeType: "image/png", bytes: new ArrayBuffer(0) }),
      ),
    ).toHaveProperty("bytes");
  });

  it("rejects a file over the size ceiling", async () => {
    const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
    huge.set([0x89, 0x50, 0x4e, 0x47], 0);
    expect(
      await fieldsOf(repo.create({ kind: "image", filename: "big.png", mimeType: "image/png", bytes: huge.buffer })),
    ).toHaveProperty("bytes");
  });

  it("stores nothing when validation fails", async () => {
    // Measured against the seeded baseline rather than an absolute zero: the
    // demo library ships one document asset (see demo/librarySeed.ts), and the
    // claim under test is that a REJECTED upload adds no row of its own.
    const before = demoStore.media.all().length;
    await fieldsOf(repo.create({ kind: "image", filename: "x.svg", mimeType: "image/svg+xml", bytes: pngBytes() }));
    expect(demoStore.media.all()).toHaveLength(before);
  });
});

describe("filename sanitization", () => {
  it("strips path separators and control characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFilename("a\\b\\c.png")).not.toContain("\\");
    expect(sanitizeFilename("bad\u0000name.png")).not.toContain("\u0000");
  });

  it("refuses leading dots so nothing becomes a hidden file", () => {
    expect(sanitizeFilename("...hidden")).not.toMatch(/^\./);
  });

  it("never returns an empty name", () => {
    expect(sanitizeFilename("   ").length).toBeGreaterThan(0);
    expect(sanitizeFilename("").length).toBeGreaterThan(0);
  });

  it("caps the length", () => {
    expect(sanitizeFilename("x".repeat(500)).length).toBeLessThanOrEqual(120);
  });

  it("applies sanitization on the stored record", async () => {
    const asset = await repo.create({
      kind: "image",
      filename: "../../../evil.png",
      mimeType: "image/png",
      bytes: pngBytes(),
    });
    expect(asset.filename).not.toContain("/");
  });
});

describe("lifecycle", () => {
  it("deletes metadata and bytes together", async () => {
    const asset = await repo.create({
      kind: "image",
      filename: "a.png",
      mimeType: "image/png",
      bytes: pngBytes(),
    });
    await repo.delete(asset.id);
    expect(demoStore.media.find(asset.id)).toBeUndefined();
    expect(await repo.getBlob(asset.id)).toBeUndefined();
  });

  it("reports a missing asset rather than returning undefined", async () => {
    try {
      await repo.get("md_missing");
      throw new Error("should have thrown");
    } catch (cause) {
      expect(cause instanceof ApiError && cause.code).toBe("MEDIA_NOT_FOUND");
    }
  });

  it("keeps audio peaks with the asset so the player never decodes", async () => {
    const asset = await repo.create({
      kind: "audio",
      filename: "take.mp3",
      mimeType: "audio/mpeg",
      bytes: new Uint8Array([1, 2, 3, 4]).buffer,
      peaks: [0.2, 0.6, 0.9],
      durationSeconds: 12,
    });
    expect(asset.peaks).toEqual([0.2, 0.6, 0.9]);
    expect(asset.durationSeconds).toBe(12);
  });
});
