/**
 * The dev-server data-source disclosure.
 *
 * DEV-ONLY, and deliberately outside `src/`: the client bundler only ever
 * resolves modules under `src/`, so this text can never reach a shipped
 * artifact — the same physical separation the project uses for the
 * demo/client target swap.
 *
 * WHY IT EXISTS
 * The two compositions answer different questions to the same command:
 *
 *   `npm run dev`      → demo composition, LOCAL data — the panel reads and
 *                         writes the browser's own storage and never calls the
 *                         backend;
 *   `npm run dev:full` → client composition, API data — the panel reads and
 *                         writes the real database.
 *
 * Running the backend and the frontend at the same time therefore does NOT
 * mean they are connected: with `npm run dev` the backend is simply not used,
 * every change lands in the browser's storage, and the database looks
 * untouched. That reads exactly like "they are not wired together".
 *
 * So the dev server says which one it is, BEFORE a browser opens — in the
 * same terminal line where Vite prints the URL. And when a backend IS running
 * while this server will not use it, it says that too, with the command that
 * connects them.
 *
 * WHAT IT MUST NEVER DO
 * State something the panel does not do. The classification comes from the
 * shared vocabulary (`src/api/dataSourceVocabulary.ts` — the same function the
 * runtime config uses), so the terminal and the running panel cannot disagree.
 *
 * The types live in the sibling `data-source-notice.d.mts`.
 */

/**
 * Builds the disclosure for one dev server.
 *
 * Both directions are disclosed, because both are confusing:
 *   - a backend running while this server will not use it (the trap above);
 *   - no backend running while this server needs one.
 *
 * @param {{
 *   appTarget: "demo" | "client",
 *   sourceClass: "local" | "api" | "invalid",
 *   apiPortBusy: boolean,
 *   apiHost: string,
 *   apiPort: number,
 * }} input
 * @returns {{ level: "none" | "info" | "warn", lines: string[] }}
 */
export function resolveDataSourceNotice(input) {
  const { appTarget, sourceClass, apiPortBusy, apiHost, apiPort } = input;
  const origin = `${apiHost}:${apiPort}`;

  if (sourceClass === "invalid") {
    return {
      level: "warn",
      lines: [
        `ترکیب: ${appTarget} — مقدار VITE_DATA_SOURCE نامعتبر است؛ پنل اجرا نمی‌شود. جزئیات خطا در مرورگر دیده می‌شود.`,
      ],
    };
  }

  if (appTarget === "client" || sourceClass === "api") {
    if (apiPortBusy) {
      // The client composition in its normal state is announced by
      // `scripts/dev-full.mjs` already, and by the panel's own unavailable-
      // domains notice. Two signages for one fact teach people to ignore
      // both — so this line stays silent and the notice speaks up only when
      // something is off.
      if (appTarget === "client") return { level: "none", lines: [] };
      return {
        level: "info",
        lines: [`ترکیب: ${appTarget} — منبع داده: api (بک‌اند روی ${origin} در حال اجراست).`],
      };
    }
    return {
      level: "warn",
      lines: [
        `ترکیب: ${appTarget} — منبع داده: api، ولی روی ${origin} چیزی گوش نمی‌دهد.`,
        "  درخواست‌های /api خطا می‌دهند. بک‌اند را بالا بیاورید: php artisan serve --host=127.0.0.1 --port=8080",
      ],
    };
  }

  // demo + local — the composition that never touches the backend.
  const lines = [
    "ترکیب: demo — منبع داده: محلی (فقط در همین مرورگر ذخیره می‌شود). هیچ درخواستی به بک‌اند نمی‌رود.",
  ];

  if (apiPortBusy) {
    lines.push(
      `هشدار: یک بک‌اند روی ${origin} در حال اجراست، ولی این سرور توسعه از آن استفاده نمی‌کند.`,
      "  برای اتصال واقعی: npm run dev:full  (ترکیب client + VITE_DATA_SOURCE=api)",
    );
    return { level: "warn", lines };
  }

  return { level: "info", lines };
}
