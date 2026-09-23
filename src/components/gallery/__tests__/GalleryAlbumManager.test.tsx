// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { getGalleryRepository, resetRegistry } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { GalleryAlbumManager } from "../GalleryAlbumManager";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

describe("GalleryAlbumManager", () => {
  it("creates a real album through the gallery repository", async () => {
    const changed = vi.fn();
    const initial = await getGalleryRepository().listAlbums();

    render(
      <AppProvider>
        <GalleryAlbumManager
          albums={initial.data}
          counts={new Map()}
          onSelect={vi.fn()}
          onChanged={changed}
          onClose={vi.fn()}
        />
      </AppProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "ساخت آلبوم جدید" }));
    fireEvent.change(screen.getByLabelText("عنوان"), { target: { value: "آلبوم آزمون مدیر" } });
    fireEvent.click(screen.getByRole("button", { name: "ساخت آلبوم" }));

    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    const albums = await getGalleryRepository().listAlbums();
    expect(albums.data.some((album) => album.title === "آلبوم آزمون مدیر")).toBe(true);
  });
});
