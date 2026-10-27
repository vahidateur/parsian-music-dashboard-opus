/**
 * Types for the dev-only data-source disclosure (`data-source-notice.mjs`).
 *
 * The implementation is plain ESM so the dev server can load it without a
 * build step; this declaration is what lets `tsc` (and the focused test
 * under `src/__tests__/`) see the same contract.
 */

export type NoticeLevel = "none" | "info" | "warn";

/** What the panel will actually read from, as classified by the shared vocabulary. */
export type SourceClass = "local" | "api" | "invalid";

export interface DataSourceNoticeInput {
  /** The composition this dev server builds. */
  appTarget: "demo" | "client";
  /** The classification of VITE_DATA_SOURCE for that composition. */
  sourceClass: SourceClass;
  /** True when something is listening on the API port. */
  apiPortBusy: boolean;
  /** The API origin the dev proxy would forward to. */
  apiHost: string;
  apiPort: number;
}

export interface DataSourceNotice {
  level: NoticeLevel;
  /** Terminal lines, in the order they should be printed. */
  lines: string[];
}

export function resolveDataSourceNotice(input: DataSourceNoticeInput): DataSourceNotice;
