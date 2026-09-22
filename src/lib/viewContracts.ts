/* ------------------------------------------------------------------ */
/* Cross-cutting view/presentation contracts (M10)                      */
/*                                                                      */
/* These types are shared by the view layer, the navigation shell, the  */
/* command surfaces and the dashboard read models — no single domain    */
/* can own them. D5 (DECISIONS §19) fixes exactly ONE shared home for   */
/* them; this is it. They were relocated unchanged from the dissolved   */
/* fixture modules (`src/data/academy.ts`).                             */
/* ------------------------------------------------------------------ */

export type ViewId =
  | "dashboard"
  | "students"
  | "teachers"
  | "classes"
  | "schedule"
  | "attendance"
  | "compensation"
  | "finance"
  | "reports"
  | "messages"
  | "library"
  | "gallery"
  | "settings"
  | "design-system";

export type Severity = "critical" | "warning" | "info";

export interface Target {
  view: ViewId;
  filter?: string;
  /** Optional record id — opens the detail workspace of that section. */
  id?: string;
}

export interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  context: string;
  action: string;
  target: Target;
}

export interface Signal {
  id: string;
  label: string;
  /** Already formatted for display — the value the records support, or NO_DATA. */
  value: string;
  unit?: string;
  /**
   * Change against the previous period, or `null` when there is nothing to
   * compare: no history stored for this measure, or a zero previous period.
   * `null` renders NO_DATA rather than a fabricated «۰٪» (DECISIONS §14).
   */
  delta: number | null;
  deltaLabel?: string;
  context: string;
  tone: "ok" | "warn" | "neutral";
  /**
   * History for the sparkline, oldest first — or `null` when the stored records
   * carry no history for this measure, in which case no trend is drawn (M9/I9).
   */
  series: number[] | null;
  kind: "line" | "bars";
  target: Target;
}

export interface Insight {
  id: string;
  kind: "trend" | "risk" | "idea";
  text: string;
  detail?: string;
  action?: { label: string; target: Target };
}

export interface QuickActionDef {
  id: "student" | "class" | "payment" | "message";
  label: string;
  hint: string;
  /**
   * M-1: the fake form's field definitions are gone. The sheet no longer builds
   * a form from hardcoded option arrays (instrument names, teacher names, room
   * names). Each action now routes to a real dialog or view. `fields` is kept
   * optional only for backward compat with any stray reader — it is always empty
   * in the live definitions and carries no measurement.
   */
  fields?: { label: string; placeholder: string; type?: "text" | "select"; options?: string[] }[];
  /*
   * The fixture-era `success: string` field was dropped at M10: no consumer ever
   * rendered it, and its canned success sentences («پرداخت ثبت و رسید ارسال شد»)
   * claimed writes the sheet deliberately does not perform (the submit path shows
   * the honest "not connected" toast — M2). A dead field with a false claim is
   * category-C content, not a type to keep.
   */
}
