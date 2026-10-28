// @vitest-environment jsdom
/**
 * Client-side WebP preparation before upload.
 *
 * JPEG/PNG stills are re-encoded where the browser can do it (no data leaves
 * the device, unlike an external conversion API); anything else — GIFs
 * (possibly animated; a canvas round-trip would flatten them), an
 * unsupported encoder, an undecodable file — travels through untouched so an
 * upload never fails because the optimizer did.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareImageUpload, resetWebpSupportCacheForTests } from "@/domains/media/prepareImage";

function pngFile(name = "photo.png"): File {
  return new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, { type: "image/png" });
}

beforeEach(() => {
  resetWebpSupportCacheForTests();
  delete (globalThis as Record<string, unknown>).createImageBitmap;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).createImageBitmap;
});

describe("prepareImageUpload", () => {
  it("leaves GIFs untouched so animation is never flattened", async () => {
    const gif = new File([new Uint8Array([71, 73, 70, 56, 57, 97])], "anim.gif", { type: "image/gif" });
    const prepared = await prepareImageUpload(gif);
    expect(prepared.mimeType).toBe("image/gif");
    expect(prepared.filename).toBe("anim.gif");
    expect(new Uint8Array(prepared.bytes)).toEqual(new Uint8Array(await gif.arrayBuffer()));
  });

  it("falls back to the original bytes where the browser cannot convert", async () => {
    // jsdom has no canvas 2d context and no createImageBitmap: the optimizer
    // is unavailable, so the upload must proceed unconverted.
    const file = pngFile("Lib.jpg".replace("jpg", "png"));
    const prepared = await prepareImageUpload(file);
    expect(prepared.mimeType).toBe("image/png");
    expect(prepared.filename).toBe("Lib.png");
    expect(new Uint8Array(prepared.bytes)).toEqual(new Uint8Array(await file.arrayBuffer()));
  });

  it("re-encodes stills to WebP where the browser can", async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/webp;base64,AAA");
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback: BlobCallback) {
      callback(new Blob(["WEBPDATA"], { type: "image/webp" }));
    });
    (globalThis as Record<string, unknown>).createImageBitmap = async () => ({ width: 10, height: 20, close: vi.fn() });

    const prepared = await prepareImageUpload(pngFile("hall.png"));

    expect(prepared.mimeType).toBe("image/webp");
    expect(prepared.filename).toBe("hall.webp");
    expect(new Uint8Array(prepared.bytes)).toEqual(new Uint8Array([87, 69, 66, 80, 68, 65, 84, 65]));
    expect(drawImage).toHaveBeenCalledTimes(1);
  });
});
