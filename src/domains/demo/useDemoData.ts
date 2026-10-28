import { useCallback, useMemo, useState } from "react";
import type { PermissionHolder } from "@/domains/auth/permissions";
import { backupFileName, type DemoBackup, type ValidationIssue } from "./backup";
import {
  DemoDataManager,
  demoDataManager,
  type DemoOperation,
  type DemoOperationResult,
} from "./demoDataManager";
import type { UninitializeResult } from "./lifecycle";
import type { DataLifecycleState, DemoDatasetStats } from "./types";

/**
 * View-facing hook for the Demo Data lifecycle. Views never touch the store,
 * the manager's confirmation flags or localStorage directly.
 *
 * Confirmation is modelled explicitly: a destructive action must first be
 * *requested* (`request`), and only `confirm()` executes it.
 */

export type DemoUninitializeActionResult =
  | {
      ok: true;
      operation: "uninitialize";
      state: DataLifecycleState;
      changed: boolean;
      stats: DemoDatasetStats;
      issues: [];
      message: string;
    }
  | {
      ok: false;
      operation: "uninitialize";
      state: DataLifecycleState;
      changed: boolean;
      stats: DemoDatasetStats;
      issues: ValidationIssue[];
      message: string;
    };

export type DemoActionResult = DemoOperationResult | DemoUninitializeActionResult;

export interface DemoDataState {
  stats: DemoDatasetStats;
  seedVersion: string;
  schemaVersion: string;
  /** The destructive action awaiting confirmation, if any. */
  pending: PendingAction | null;
  lastResult: DemoActionResult | null;
  issues: ValidationIssue[];
  busy: boolean;
  request: (action: DestructiveAction, payload?: string) => void;
  cancel: () => void;
  confirm: () => Promise<DemoActionResult>;
  downloadBackup: () => DemoBackup;
}

export type DestructiveAction = Extract<
  DemoOperation,
  "reset" | "import-sample" | "reset-clean" | "clear" | "import-seed" | "restore-backup" | "uninitialize"
>;

export interface PendingAction {
  action: DestructiveAction;
  /** Raw backup JSON, for `restore-backup`. */
  payload?: string;
  fileName?: string;
}

/**
 * Confirmation copy for the destructive operations.
 *
 * `reset` and `import-seed` install the showcase dataset, so they keep demo
 * wording and are only offered in a DEMO environment (see `DemoDataPanel`).
 *
 * `clear` and `restore-backup` act on whatever this environment actually holds
 * — in an EMPTY environment that is a customer's real records — so their copy
 * must not call that data "demo". A confirmation dialog that mislabels what
 * it is about to destroy is how real data gets deleted by accident.
 */
export const DESTRUCTIVE_LABELS: Record<DestructiveAction, { title: string; warning: string }> = {
  reset: { title: "بازنشانی دادهٔ دمو", warning: "همهٔ تغییرات فعلی دمو حذف و دیتاست اولیه جایگزین می‌شود." },
  clear: {
    title: "پاک‌کردن کامل داده‌ها",
    warning:
      "همهٔ رکوردهای این محیط، از جمله حساب‌های کاربری، حذف می‌شوند و ورود ممکن نخواهد بود؛ خود محیط و حالت آن باقی می‌ماند و برای بازگشت باید از مسیر «شروع دوباره» استفاده کنید.",
  },
  "import-sample": {
    title: "ورود دادهٔ نمونه",
    warning: "دادهٔ نمونه از سازندهٔ seed جایگزین می‌شود. محیط مشتری یا اثبات‌نشده نوشته نمی‌شود.",
  },
  "reset-clean": {
    title: "بازنشانی به محیط خالی",
    warning: "فقط محیط نمونهٔ اثبات‌شده به محیط خالی تبدیل می‌شود. محیط مشتری، اثبات‌نشده، خالی یا مقداردهی‌نشده نوشته نمی‌شود.",
  },
  "import-seed": { title: "ورود دیتاست کانونیکال", warning: "دادهٔ فعلی دمو با دیتاست کانونیکال جایگزین می‌شود." },
  "restore-backup": {
    title: "بازگردانی پشتیبان",
    warning: "دادهٔ فعلی این محیط با محتوای فایل پشتیبان جایگزین می‌شود.",
  },
  uninitialize: {
    title: "شروع دوباره و حذف کامل محیط",
    warning:
      "همهٔ رکوردهای این محیط، حساب‌های دسترسی و نشانگر محیط حذف می‌شوند و تا انتخاب دوبارهٔ محیط امکان ورود وجود ندارد. فایل‌های باینری ذخیره‌شده نیز پاک می‌شوند. این عملیات برگشت‌ناپذیر است؛ اگر به داده‌ها نیاز دارید پیش از ادامه پشتیبان بگیرید.",
  },
};

function normalizeUninitializeResult(
  result: UninitializeResult,
  stats: DemoDatasetStats,
): DemoUninitializeActionResult {
  if (result.ok) {
    return {
      ok: true,
      operation: "uninitialize",
      state: result.state,
      changed: result.changed,
      stats,
      issues: [],
      message: result.message,
    };
  }
  return {
    ok: false,
    operation: "uninitialize",
    state: result.state,
    changed: result.changed,
    stats,
    issues: [{ code: "NOT_AN_OBJECT", message: result.message }],
    message: result.message,
  };
}

export function useDemoData(
  manager: DemoDataManager = demoDataManager,
  actor: PermissionHolder | null = null,
): DemoDataState {
  const [stats, setStats] = useState<DemoDatasetStats>(() => manager.stats());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [lastResult, setLastResult] = useState<DemoActionResult | null>(null);
  const [busy, setBusy] = useState(false);

  const request = useCallback((action: DestructiveAction, payload?: string) => {
    setLastResult(null);
    setPending({ action, payload });
  }, []);

  const cancel = useCallback(() => setPending(null), []);

  const confirm = useCallback(async (): Promise<DemoActionResult> => {
    if (!pending) {
      return { ok: false, operation: "reset", issues: [], message: "عملیاتی برای تأیید وجود ندارد." };
    }
    setBusy(true);
    try {
      const confirmed = { confirm: true } as const;
      let result: DemoActionResult;
      if (pending.action === "uninitialize") {
        const uninitializeResult = await manager.uninitialize(confirmed);
        result = normalizeUninitializeResult(uninitializeResult, manager.stats());
      } else {
        result =
          pending.action === "reset"
            ? manager.resetToSeed(confirmed)
            : pending.action === "clear"
              ? manager.clear(confirmed)
              : pending.action === "import-sample"
                ? manager.importSample(confirmed, actor)
                : pending.action === "reset-clean"
                  ? await manager.resetToClean(confirmed, actor)
                  : pending.action === "import-seed"
                    ? manager.importSeed(confirmed)
                    : manager.restoreBackup(pending.payload ?? "", confirmed);
      }
      setLastResult(result);
      setStats(manager.stats());
      if (result.ok) setPending(null);
      return result;
    } finally {
      setBusy(false);
    }
  }, [actor, manager, pending]);

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
