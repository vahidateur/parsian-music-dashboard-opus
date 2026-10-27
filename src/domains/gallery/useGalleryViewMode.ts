import { useCallback, useState } from "react";

/**
 * The showcase layout the operator picked last — grid, compact, masonry or
 * list. Device-local like the other appearance choices: it is a viewing
 * preference, never product state, so it lives in localStorage rather than
 * in a repository. Corrupt or foreign values fall back to the dense grid.
 */
export type GalleryViewMode = "grid" | "compact" | "masonry" | "list";

const VIEW_MODE_KEY = "parsian.gallery.viewMode";

const VIEW_MODES: readonly GalleryViewMode[] = ["grid", "compact", "masonry", "list"];

function readStoredMode(): GalleryViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (VIEW_MODES.includes(raw as GalleryViewMode)) return raw as GalleryViewMode;
  } catch {
    // Private mode or disabled storage: the grid is the honest default.
  }
  return "grid";
}

export function useGalleryViewMode(): [GalleryViewMode, (mode: GalleryViewMode) => void] {
  const [mode, setModeState] = useState<GalleryViewMode>(readStoredMode);
  const setMode = useCallback((next: GalleryViewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(VIEW_MODE_KEY, next);
    } catch {
      // The preference is a nicety; losing it must never break the view.
    }
  }, []);
  return [mode, setMode];
}
