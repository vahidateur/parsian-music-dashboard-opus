import { useCallback, useMemo, useState } from "react";
import { backupFileName, type DemoBackup, type ValidationIssue } from "./backup";
import { DemoDataManager, demoDataManager, type DemoOperation, type DemoOperationResult } from "./demoDataManager";
import type { DemoDatasetStats } from "./types";

/**
 * View-facing hook for the Demo Data lifecycle. Views never touch the store,
 * the manager's confirmation flags or localStorage directly.
 *
 * Confirmation is modelled explicitly: a destructive action must first be
 * *requested* (`request`), and only `confirm()` executes it.
 */

export interface DemoDataState {
  stats: DemoDatasetStats;
  seedVersion: string;
  schemaVersion: string;
  /** The destructive action awaiting confirmation, if any. */
  pending: PendingAction | null;
  lastResult: DemoOperationResult | null;
  issues: ValidationIssue[];
  busy: boolean;
  request: (action: DestructiveAction, payload?: string) => void;
  cancel: () => void;
  confirm: () => Promise<DemoOperationResult>;
  downloadBackup: () => DemoBackup;
}

export type DestructiveAction = Extract<DemoOperation, "reset" | "clear" | "import-seed" | "restore-backup">;

export interface PendingAction {
  action: DestructiveAction;
  /** Raw backup JSON, for `restore-backup`. */
  payload?: string;
  fileName?: string;
}

export const DESTRUCTIVE_LABELS: Record<DestructiveAction, { title: string; warning: string }> = {
  reset: { title: "بازنشانی دادهٔ دمو", warning: "همهٔ تغییرات فعلی دمو حذف و دیتاست اولیه جایگزین می‌شود." },
  clear: { title: "پاک‌کردن دادهٔ دمو", warning: "همهٔ رکوردهای دمو حذف می‌شوند و محیط خالی می‌ماند." },
  "import-seed": { title: "ورود دیتاست کانونیکال", warning: "دادهٔ فعلی دمو با دیتاست کانونیکال جایگزین می‌شود." },
  "restore-backup": { title: "بازگردانی پشتیبان", warning: "دادهٔ فعلی دمو با محتوای فایل پشتیبان جایگزین می‌شود." },
};

export function useDemoData(manager: DemoDataManager = demoDataManager): DemoDataState {
  const [stats, setStats] = useState<DemoDatasetStats>(() => manager.stats());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [lastResult, setLastResult] = useState<DemoOperationResult | null>(null);
  const [busy, setBusy] = useState(false);

  const request = useCallback((action: DestructiveAction, payload?: string) => {
    setLastResult(null);
    setPending({ action, payload });
  }, []);

  const cancel = useCallback(() => setPending(null), []);

  const confirm = useCallback(async (): Promise<DemoOperationResult> => {
    if (!pending) {
      return { ok: false, operation: "reset", issues: [], message: "عملیاتی برای تأیید وجود ندارد." };
    }
    setBusy(true);
    try {
      const confirmed = { confirm: true } as const;
      const result =
        pending.action === "reset"
          ? manager.resetToSeed(confirmed)
          : pending.action === "clear"
            ? manager.clear(confirmed)
            : pending.action === "import-seed"
              ? manager.importSeed(confirmed)
              : manager.restoreBackup(pending.payload ?? "", confirmed);
      setLastResult(result);
      setStats(manager.stats());
      if (result.ok) setPending(null);
      return result;
    } finally {
      setBusy(false);
    }
  }, [manager, pending]);

  const downloadBackup = useCallback(() => {
    const backup = manager.exportBackup();
    void backupFileName();
    return backup;
  }, [manager]);

  const issues = useMemo(() => (lastResult && !lastResult.ok ? lastResult.issues : []), [lastResult]);

  return {
    stats,
    seedVersion: manager.seedVersion,
    schemaVersion: manager.schemaVersion,
    pending,
    lastResult,
    issues,
    busy,
    request,
    cancel,
    confirm,
    downloadBackup,
  };
}
