// @vitest-environment jsdom
/**
 * Gallery uploader staging: a picked file must be immediately submittable.
 *
 * The submit button stays disabled until every staged row has a caption AND
 * an alt text (the server requires alt ≥ 2 chars). An empty alt default left
 * the operator at a dead button with no visible reason — the staged file
 * could never be confirmed and no album was ever created from it. The
 * caption default (filename without extension) now seeds the alt field too,
 * exactly like the settings panel's single-shot uploader, and both stay
 * editable before submit.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { GalleryUploader } from "@/components/gallery/GalleryUploader";
import { resetRegistry, setGalleryRepository, setMediaRepository } from "@/domains/registry";
import type { GalleryRepository } from "@/domains/gallery/repository";
import type { MediaRepository } from "@/domains/media/repository";

afterEach(() => {
  cleanup();
  resetRegistry();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function pngFile(name: string, size = 64): File {
  return new File([new Uint8Array(size).fill(7)], name, { type: "image/png" });
}

function pickFile(name: string): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [pngFile(name)] } });
}

function renderUploader(): void {
  render(
    <AppProvider>
      <GalleryUploader albums={[]} onUploaded={vi.fn()} onClose={vi.fn()} />
    </AppProvider>,
  );
}

describe("GalleryUploader staging", () => {
  it("prefills alt from the caption so a picked file is submittable", async () => {
    renderUploader();
    pickFile("Lib.jpg");

    const caption = (await screen.findByPlaceholderText("عنوان تصویر")) as HTMLInputElement;
    const alt = (await screen.findByPlaceholderText("متن جایگزین")) as HTMLInputElement;
    expect(caption.value).toBe("Lib");
    expect(alt.value).toBe("Lib");

    const submit = screen.getByRole("button", { name: "افزودن تصویر" });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps the alt text editable before submit", async () => {
    renderUploader();
    pickFile("Lib.jpg");

    const alt = (await screen.findByPlaceholderText("متن جایگزین")) as HTMLInputElement;
    fireEvent.change(alt, { target: { value: "جلد آلبوم بهار" } });
    expect(alt.value).toBe("جلد آلبوم بهار");
    expect((screen.getByRole("button", { name: "افزودن تصویر" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("stages every selection, not just the first, when the browser's live FileList is emptied by the input reset", async () => {
    // A real <input type=file> exposes a LIVE list, and setting `value = ""`
    // (which the uploader does after each pick) empties that same list. Plain
    // arrays hide this; this input reproduces the browser.
    renderUploader();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const live: File[] = [];
    Object.defineProperty(input, "files", { configurable: true, get: () => live });
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => "",
      set: (next: string) => {
        if (next === "") live.length = 0;
      },
    });
    const pick = (name: string) => {
      live.push(pngFile(name));
      fireEvent.change(input);
    };
    pick("one.png");
    await waitFor(() => expect(screen.getAllByPlaceholderText("عنوان تصویر")).toHaveLength(1));
    pick("two.png");
    await waitFor(() => expect(screen.getAllByPlaceholderText("عنوان تصویر")).toHaveLength(2));
  });

  it("counts each file on the progress bar as it is archived", async () => {
    const firstUpload = deferred<{ id: string }>();
    const secondUpload = deferred<{ id: string }>();
    const firstRow = deferred<unknown>();
    const secondRow = deferred<unknown>();
    const uploads = [firstUpload, secondUpload];
    const rows = [firstRow, secondRow];
    setMediaRepository({
      create: () => uploads.shift()!.promise as Promise<never>,
    } as unknown as MediaRepository);
    setGalleryRepository({
      addImage: () => rows.shift()!.promise as Promise<never>,
    } as unknown as GalleryRepository);
    const onUploaded = vi.fn();
    render(
      <AppProvider>
        <GalleryUploader
          albums={[{ id: "al1", title: "آرشیو", description: "", coverMediaId: undefined, sortOrder: 0, createdAt: "" }]}
          onUploaded={onUploaded}
          onClose={vi.fn()}
        />
      </AppProvider>,
    );
    pickFile("one.jpg");
    pickFile("two.jpg");

    // Both files staged: nothing processed yet.
    const bar = await screen.findByRole("progressbar", { name: "پیشرفت افزودن تصویرها" });
    expect(bar.getAttribute("aria-valuemax")).toBe("2");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: "افزودن تصویر" }));

    // First file fully archived (bytes, then row) → the bar counts one.
    firstUpload.resolve({ id: "md_1" });
    await waitFor(() => expect(bar.getAttribute("aria-valuenow")).toBe("0"));
    firstRow.resolve({ id: "gi_1" });
    await waitFor(() => expect(bar.getAttribute("aria-valuenow")).toBe("1"));

    // Second file → bar complete, both rows reported, single completion call.
    secondUpload.resolve({ id: "md_2" });
    secondRow.resolve({ id: "gi_2" });
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(2));
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(await screen.findAllByText("با موفقیت ثبت شد")).toHaveLength(2);
  });
});
