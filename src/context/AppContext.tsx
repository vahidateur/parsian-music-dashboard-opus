import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { QuickActionDef, Target, ViewId } from "@/lib/viewContracts";
import {
  THEMES,
  applyPalette,
  loadPalette,
  loadPref,
  savePalette,
  savePref,
  type Accent,
  type Density,
  type ThemeMode,
  type ViewerPalette,
} from "@/lib/theme";
import { formatPath, hasLegacyHash, readTarget } from "@/lib/route";
import { accessBasePath } from "@/security/accessPath";
import { setMediaReleaseFailureReporter } from "@/domains/media/release";

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  /** `danger` is reserved for operations that genuinely failed (§37). */
  tone: "success" | "info" | "warning" | "danger";
}

interface AppState {
  view: ViewId;
  filter?: string;
  detailId?: string;
  paletteOpen: boolean;
  sheet: QuickActionDef["id"] | null;
  toasts: Toast[];
  /** Appearance — shared theme system, derived from the dashboard language */
  theme: ThemeMode;
  accent: Accent;
  density: Density;
  motion: boolean;
  railCollapsed: boolean;
  /**
   * Colours this viewer typed in Settings — inline overrides above the preset.
   * Named `colors`, not `palette`: `paletteOpen` is the command palette, and two
   * meanings of one word in the same context object is how a reader wires the
   * wrong one.
   */
  colors: ViewerPalette;
  navigate: (target: Target) => void;
  notify: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  openPalette: () => void;
  closePalette: () => void;
  openSheet: (id: QuickActionDef["id"]) => void;
  closeSheet: () => void;
  setTheme: (t: ThemeMode) => void;
  /** Sets or clears one typed colour; an empty value removes the override. */
  setColor: (slot: keyof ViewerPalette, value: string | null) => void;
  clearColors: () => void;
  setAccent: (a: Accent) => void;
  setDensity: (d: Density) => void;
  setMotion: (m: boolean) => void;
  toggleRail: () => void;
}

const Ctx = createContext<AppState | null>(null);

let toastSeq = 1;

/**
 * The deployment prefix every route is written under: the secret access slug
 * when one is configured, empty otherwise. Read once — it is build configuration
 * and cannot change while the app runs.
 */
const ROUTE_BASE = typeof window !== "undefined" ? accessBasePath() : "";

const ACCENTS: readonly Accent[] = ["gold", "wood", "violet"];
const DENSITIES: readonly Density[] = ["comfortable", "compact"];

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = typeof window !== "undefined" ? readTarget(window.location, ROUTE_BASE) : null;
  const [view, setView] = useState<ViewId>(initial?.view ?? "dashboard");
  const [filter, setFilter] = useState<string | undefined>(initial?.filter);
  const [detailId, setDetailId] = useState<string | undefined>(initial?.id);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheet, setSheet] = useState<QuickActionDef["id"] | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setTheme] = useState<ThemeMode>(() => loadPref("ava:theme", "dark", THEMES));
  const [accent, setAccent] = useState<Accent>(() => loadPref("ava:accent", "gold", ACCENTS));
  const [density, setDensity] = useState<Density>(() => loadPref("ava:density", "comfortable", DENSITIES));
  const [motion, setMotion] = useState<boolean>(() => loadPref("ava:motion", "on", ["on", "off"] as const) === "on");
  const [railCollapsed, setRailCollapsed] = useState<boolean>(() => loadPref("ava:rail", "expanded", ["expanded", "collapsed"] as const) === "collapsed");
  const [palette, setPalette] = useState<ViewerPalette>(() => loadPalette());

  /* Apply theme to the document — one source of truth for appearance */
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = accent;
    root.dataset.density = density;
    root.dataset.motion = motion ? "on" : "off";
    savePref("ava:theme", theme);
    savePref("ava:accent", accent);
    savePref("ava:density", density);
    savePref("ava:motion", motion ? "on" : "off");
  }, [theme, accent, density, motion]);

  /*
    The typed palette is applied next to the preset, never instead of it: the
    preset owns the stage, the palette overrides individual colours on top. Only
    the colours that were actually typed are written — everything else is left to
    the preset, so choosing a different theme still changes the whole panel.
  */
  useEffect(() => {
    applyPalette(palette);
    savePalette(palette);
  }, [palette]);

  useEffect(() => {
    savePref("ava:rail", railCollapsed ? "collapsed" : "expanded");
  }, [railCollapsed]);

  const applyTarget = useCallback((target: Target) => {
    setView(target.view);
    setFilter(target.filter);
    setDetailId(target.id);
    setPaletteOpen(false);
  }, []);

  const navigate = useCallback(
    (target: Target) => {
      applyTarget(target);
      if (typeof window !== "undefined") {
        const next = formatPath(target, ROUTE_BASE);
        const current = window.location.pathname + window.location.search;
        // `pushState`, not `location.hash`: the route lives in the path, and the
        // browser history entry is what the back button walks.
        if (current !== next || window.location.hash !== "") window.history.pushState(null, "", next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [applyTarget],
  );

  /**
   * Deep links and browser back/forward.
   *
   * `popstate` is the path router's event; `hashchange` stays subscribed because
   * a fragment route is still a route someone may hand the app — an old
   * bookmark, or a link copied before the `#` was retired.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onNavigate = () => {
      applyTarget(readTarget(window.location, ROUTE_BASE) ?? { view: "dashboard" });
    };
    window.addEventListener("popstate", onNavigate);
    window.addEventListener("hashchange", onNavigate);
    return () => {
      window.removeEventListener("popstate", onNavigate);
      window.removeEventListener("hashchange", onNavigate);
    };
  }, [applyTarget]);

  /*
   * Retire a legacy fragment on first paint.

   * An address bar reading `…/#/dashboard` is migrated to `…/dashboard` so the
   * form the app writes and the form an old link arrives in converge on the
   * first render. A path URL is left exactly as it is: rewriting it here would
   * fight the browser's own history on every mount.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLegacyHash(window.location)) return;
    window.history.replaceState(null, "", formatPath({ view, filter, id: detailId }, ROUTE_BASE));
    // Deliberately runs once: after this the URL is a path and later changes are
    // written by `navigate`, which owns the history entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = toastSeq++;
      setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast],
  );

  /*
    MEDIA CLEANUP FAILURES ARE REPORTED, NOT SWALLOWED.

    Freeing an asset that a write has stopped referencing happens AFTER that
    write committed, so it has no throw path: failing the operation would report
    a write that happened as one that did not, and the store cannot roll it back.
    The media domain therefore returns the failure instead of hiding it, and this
    is where it becomes something the operator can read — the one place that owns
    operator-facing messages. The warning says exactly what is true: the record
    was saved, an unused file is still sitting in this browser.
  */
  useEffect(() => {
    setMediaReleaseFailureReporter((failure) => {
      notify({
        tone: "warning",
        title: "فایل بی‌استفاده آزاد نشد",
        detail: `${failure.error.message} رکورد ذخیره شد، اما فایل بی‌استفاده در همین مرورگر باقی ماند.`,
      });
    });
    return () => setMediaReleaseFailureReporter(undefined);
  }, [notify]);

  /* ------------------------------------------------------------------ */
  /* Overlay ownership — one place owns body scroll lock and focus transfer */
  /* ------------------------------------------------------------------ */
  // When a palette or a quick-action sheet is open, the page behind must not
  // scroll. The palette used to own this alone (setting overflow hidden on open
  // and clearing on close). That broke the palette → sheet handoff: palette
  // cleared overflow, then sheet opened without re-locking, causing a scroll
  // flash and a moment with no focus owner. Now the shell owns the lock:
  // any open overlay (palette or sheet) keeps overflow hidden, and only when
  // both are closed does it clear. Individual overlays (Drawer, Dialog) may
  // still set it for their own lifetime — setting the same value twice is
  // harmless, and the shell's effect re-applies after they unmount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (paletteOpen || sheet !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      if (typeof document !== "undefined") document.body.style.overflow = "";
    };
  }, [paletteOpen, sheet]);

  const value = useMemo<AppState>(
    () => ({
      view,
      filter,
      detailId,
      paletteOpen,
      sheet,
      toasts,
      theme,
      accent,
      density,
      motion,
      railCollapsed,
      colors: palette,
      navigate,
      notify,
      dismissToast,
      openPalette: () => setPaletteOpen(true),
      closePalette: () => setPaletteOpen(false),
      // M-1: opening a sheet always closes the palette in the same render, so
      // the palette does not restore focus to the page behind and then let the
      // sheet steal it back. One state update owns both, and the body's scroll
      // lock stays held by the shell effect above.
      openSheet: (id) => {
        setPaletteOpen(false);
        setSheet(id);
      },
      closeSheet: () => setSheet(null),
      setTheme,
      setColor: (slot, value) =>
        setPalette((prev) => {
          const next = { ...prev };
          if (value) next[slot] = value;
          else delete next[slot];
          return next;
        }),
      clearColors: () => setPalette({}),
      setAccent,
      setDensity,
      setMotion,
      toggleRail: () => setRailCollapsed((v) => !v),
    }),
    [view, filter, detailId, paletteOpen, sheet, toasts, theme, accent, density, motion, railCollapsed, palette, navigate, notify, dismissToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
