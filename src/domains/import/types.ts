/**
 * Import pipeline types.
 *
 * The flow is: parse → map columns → validate every row → (only if the user
 * confirms) commit. Validation always runs over the *whole* file before any
 * write happens, so a bad row cannot leave the store half-updated (§13).
 */

export type ImportEntity = "students" | "teachers" | "classes";

/** One column the target entity accepts. */
export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  /** Header names recognised during auto-mapping, normalized to lowercase. */
  aliases: string[];
  hint?: string;
}

/** Maps a target field key to the index of the source column, or null. */
export type ColumnMapping = Record<string, number | null>;

export type IssueLevel = "error" | "warning";

export interface RowIssue {
  /** 1-based row number as the user sees it in their spreadsheet. */
  row: number;
  field: string;
  level: IssueLevel;
  message: string;
}

export interface ValidatedRow<T> {
  /** 1-based row number in the source file (header excluded). */
  row: number;
  /** Present only when the row is free of errors. */
  value?: T;
  issues: RowIssue[];
}

export interface ValidationReport<T> {
  rows: ValidatedRow<T>[];
  valid: ValidatedRow<T>[];
  failed: ValidatedRow<T>[];
  warnings: RowIssue[];
  errors: RowIssue[];
  /** Rows rejected because they duplicate an existing or earlier record. */
  duplicates: number;
  total: number;
}

export interface ImportResult {
  imported: number;
  failed: number;
  skipped: number;
  errors: RowIssue[];
  warnings: RowIssue[];
  /** True when nothing was written because the commit was aborted. */
  aborted: boolean;
  message: string;
}
