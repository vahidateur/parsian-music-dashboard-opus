/** Triggers a client-side file download. Browser-only helper, no domain logic. */
export function downloadBlobFile(fileName: string, blob: Blob): void {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick: revoking synchronously can cancel the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Serializes text and downloads it as a file. */
export function downloadTextFile(fileName: string, text: string, mime = "application/json"): void {
  downloadBlobFile(fileName, new Blob([text], { type: `${mime};charset=utf-8` }));
}

/** Reads a user-selected file as text. */
export function readFileAsText(file: File): Promise<string> {
  return file.text();
}
