import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { QuickActionDef, Target, ViewId } from "@/data/academy";

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
  navigate: (target: Target) => void;
  notify: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  openPalette: () => void;
  closePalette: () => void;
  openSheet: (id: QuickActionDef["id"]) => void;
  closeSheet: () => void;
}

const Ctx = createContext<AppState | null>(null);

let toastSeq = 1;

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>("dashboard");
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheet, setSheet] = useState<QuickActionDef["id"] | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const navigate = useCallback((target: Target) => {
    setView(target.view);
    setFilter(target.filter);
    setDetailId(target.id);
    setPaletteOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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

  const value = useMemo<AppState>(
    () => ({
      view,
      filter,
      detailId,
      paletteOpen,
      sheet,
      toasts,
      navigate,
      notify,
      dismissToast,
      openPalette: () => setPaletteOpen(true),
      closePalette: () => setPaletteOpen(false),
      openSheet: (id) => setSheet(id),
      closeSheet: () => setSheet(null),
    }),
    [view, filter, detailId, paletteOpen, sheet, toasts, navigate, notify, dismissToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
