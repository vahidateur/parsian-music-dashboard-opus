import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { QuickActionDef, Target, ViewId } from "@/data/academy";
import { loadPref, savePref, type Accent, type Density, type ThemeMode } from "@/lib/theme";
import { formatHash, parseHash } from "@/lib/hashRoute";

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone: "success" | "info" | "warning";
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
  navigate: (target: Target) => void;
  notify: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  openPalette: () => void;
  closePalette: () => void;
  openSheet: (id: QuickActionDef["id"]) => void;
  closeSheet: () => void;
  setTheme: (t: ThemeMode) => void;
  setAccent: (a: Accent) => void;
  setDensity: (d: Density) => void;
  setMotion: (m: boolean) => void;
  toggleRail: () => void;
}

const Ctx = createContext<AppState | null>(null);

let toastSeq = 1;

const ACCENTS: readonly Accent[] = ["gold", "wood", "violet"];
const THEMES: readonly ThemeMode[] = ["dark", "glass"];
const DENSITIES: readonly Density[] = ["comfortable", "compact"];

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = typeof window !== "undefined" ? parseHash(window.location.hash) : null;
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
        const next = formatHash(target);
        if (window.location.hash !== next) window.location.hash = next;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [applyTarget],
  );

  /* Deep links + browser back/forward. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHashChange = () => {
      const target = parseHash(window.location.hash);
      applyTarget(target ?? { view: "dashboard" });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [applyTarget]);

  /* Keep the address bar in sync on first paint. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const desired = formatHash({ view, filter, id: detailId });
    if (window.location.hash !== desired) window.history.replaceState(null, "", desired);
  }, [view, filter, detailId]);

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
      navigate,
      notify,
      dismissToast,
      openPalette: () => setPaletteOpen(true),
      closePalette: () => setPaletteOpen(false),
      openSheet: (id) => setSheet(id),
      closeSheet: () => setSheet(null),
      setTheme,
      setAccent,
      setDensity,
      setMotion,
      toggleRail: () => setRailCollapsed((v) => !v),
    }),
    [view, filter, detailId, paletteOpen, sheet, toasts, theme, accent, density, motion, railCollapsed, navigate, notify, dismissToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
