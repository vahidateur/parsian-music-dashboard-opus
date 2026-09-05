/** Triggers a client-side file download. Browser-only helper, no domain logic. */
export function downloadTextFile(fileName: string, text: string, mime = "application/json"): void {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Reads a user-selected file as text. */
export function readFileAsText(file: File): Promise<string> {
  return file.text();
}
