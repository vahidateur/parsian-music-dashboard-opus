/**
 * Client-side image preparation for upload.
 *
 * Photographs arrive as JPEG/PNG straight from cameras and phones; storing
 * them verbatim wastes the private object store. Where the browser can do it,
 * each image is re-encoded to WebP (quality 0.85, alpha preserved) before the
 * repository ever sees the bytes — no data leaves the device for this, unlike
 * an external conversion API, and the server already allow-lists `image/webp`
 * with its magic-byte check, so nothing changes wire-side except smaller
 * bodies and a `.webp` filename.
 *
 * Only still JPEG/PNG frames are converted: GIFs may be animated, and a
 * canvas round-trip would silently flatten them to the first frame. Anything
 * the browser cannot convert (no canvas, no WebP encoder, undecodable file)
 * falls back to the original bytes verbatim — an upload must never fail
 * because the optimizer did.
 */
export interface PreparedImage {
  bytes: ArrayBuffer;
  filename: string;
  mimeType: string;
}

const WEBP_QUALITY = 0.85;

let webpSupport: boolean | undefined;

function browserSupportsWebp(): boolean {
  if (webpSupport !== undefined) return webpSupport;
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("2d");
    if (!context) {
      webpSupport = false;
      return webpSupport;
    }
    webpSupport = probe.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    return webpSupport;
  } catch {
    webpSupport = false;
    return webpSupport;
  }
}

function withWebpName(filename: string): string {
  const base = filename.includes(".") ? filename.replace(/\.[^.]*$/, "") : filename;
  return `${base || "image"}.webp`;
}

export function resetWebpSupportCacheForTests(): void {
  webpSupport = undefined;
}

export async function prepareImageUpload(file: File): Promise<PreparedImage> {
  const fallback: PreparedImage = {
    bytes: await file.arrayBuffer(),
    filename: file.name,
    mimeType: file.type,
  };
  // Still frames only: never flatten a possibly-animated GIF.
  if (file.type !== "image/jpeg" && file.type !== "image/png") return fallback;
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return fallback;
  if (!browserSupportsWebp()) return fallback;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) return fallback;
      context.drawImage(bitmap, 0, 0);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
      if (!blob) return fallback;
      return { bytes: await blob.arrayBuffer(), filename: withWebpName(file.name), mimeType: "image/webp" };
    } finally {
      bitmap.close();
    }
  } catch {
    return fallback;
  }
}
