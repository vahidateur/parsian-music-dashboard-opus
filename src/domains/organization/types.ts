/**
 * Organization settings — the academy's own rules, as data.
 *
 * WHY THIS DOMAIN EXISTS
 *
 * The product had a "session rules" panel in Settings with four disabled inputs
 * and a notice saying they were not connected to anything. That is the most
 * expensive kind of UI: it looks like a setting, so an operator types a value,
 * sees it refused, and learns that the panel lies. Either a rule is real — stored,
 * read back, and something in the product behaves differently because of it — or
 * it is not offered.
 *
 * These are real. Every field below has a named consumer:
 *
 *   defaultSessionMinutes   the duration a new class is pre-filled with, and the
 *                           length a make-up session is proposed at.
 *   sessionGapMinutes       the turnaround the conflict rules expect between two
 *                           sessions of one teacher or one room.
 *   cancellationGraceHours  how long before a session a cancellation is still
 *                           inside the academy's free-cancel window.
 *   maxMakeupsPerTerm       the make-up ceiling per student per term.
 *   workingDayStart / End   the bookable window; a session outside it is warned
 *                           about, never silently accepted.
 *   closedWeekdays          days the academy does not open (Friday by default).
 *
 * Like branding, this is ORGANIZATION data — one record, in the dataset, in every
 * backup, reachable through a repository — not a scattering of browser keys. What
 * stays a viewer preference is how the panel looks; how the academy runs is not
 * anybody's personal taste.
 *
 * MULTI-TENANCY (§21): in production this record is per-organization and every
 * session, class and make-up carries `organization_id`.
 */

/** Weekday index in the product's own convention: 0 = شنبه … 6 = جمعه. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface OrganizationSettings {
  /** Academy name as the organisation record states it. */
  name: string;
  tagline: string;
  locale: string;
  direction: "rtl" | "ltr";
  calendar: "jalali" | "gregorian";
  currency: "toman" | "rial";
  /** First day of the week, in the same 0=شنبه convention. */
  firstWeekday: WeekdayIndex;

  /* ---- session rules ---- */

  /** Length of a lesson when nobody says otherwise. */
  defaultSessionMinutes: number;
  /** Expected turnaround between two sessions of one teacher or room. */
  sessionGapMinutes: number;
  /** Free-cancellation window before a session, in hours. `0` disables it. */
  cancellationGraceHours: number;
  /** Make-up ceiling per student per term. `0` means no make-ups are offered. */
  maxMakeupsPerTerm: number;

  /* ---- working hours ---- */

  /** `HH:mm`, 24-hour. The bookable window opens here. */
  workingDayStart: string;
  /** `HH:mm`, 24-hour. The bookable window closes here. */
  workingDayEnd: string;
  /** Days the academy is closed. Friday (`6`) by default. */
  closedWeekdays: WeekdayIndex[];

  /** ISO-8601 of the last change, so the panel can say when rules were saved. */
  updatedAt: string;
}

export type UpdateOrganizationInput = Partial<Omit<OrganizationSettings, "updatedAt">>;

/**
 * The rules an academy starts with. These are the values the disabled panel used
 * to *display* — now they are the values it writes.
 */
export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  name: "آموزشگاه موسیقی پارسیان",
  tagline: "تالار هنر، جادو و موسیقی",
  locale: "fa-IR",
  direction: "rtl",
  calendar: "jalali",
  currency: "toman",
  firstWeekday: 0,
  defaultSessionMinutes: 60,
  sessionGapMinutes: 10,
  cancellationGraceHours: 24,
  maxMakeupsPerTerm: 2,
  workingDayStart: "08:00",
  workingDayEnd: "21:00",
  closedWeekdays: [6],
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/** Bounds that keep a rule usable instead of merely typed. */
export const RULE_BOUNDS = {
  defaultSessionMinutes: { min: 15, max: 480 },
  sessionGapMinutes: { min: 0, max: 120 },
  cancellationGraceHours: { min: 0, max: 168 },
  maxMakeupsPerTerm: { min: 0, max: 24 },
} as const;

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTimeOfDay(value: string): boolean {
  return TIME_OF_DAY.test(value.trim());
}

/** Minutes since midnight, or `null` when the string is not a time of day. */
export function timeToMinutes(value: string): number | null {
  if (!isTimeOfDay(value)) return null;
  const [hours, minutes] = value.trim().split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

export function isWeekdayIndex(value: number): value is WeekdayIndex {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

export type OrganizationFieldErrors = Partial<Record<keyof OrganizationSettings, string[]>>;

/**
 * Validates a patch. Returns field errors rather than throwing, so a panel can
 * render them beside the inputs that caused them — the same shape the API returns
 * (`ApiError.fields`), which is why a rule enforced only by a future server will
 * land in the same place on screen.
 */
export function validateOrganizationInput(input: UpdateOrganizationInput): OrganizationFieldErrors {
  const errors: OrganizationFieldErrors = {};

  const bounded = (
    key: "defaultSessionMinutes" | "sessionGapMinutes" | "cancellationGraceHours" | "maxMakeupsPerTerm",
    label: string,
  ) => {
    const value = input[key];
    if (value === undefined) return;
    const bounds = RULE_BOUNDS[key];
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      errors[key] = [`${label} باید عددی صحیح باشد.`];
      return;
    }
    if (value < bounds.min || value > bounds.max) {
      errors[key] = [`${label} باید بین ${bounds.min} تا ${bounds.max} باشد.`];
    }
  };

  bounded("defaultSessionMinutes", "مدت جلسه");
  bounded("sessionGapMinutes", "فاصلهٔ بین جلسات");
  bounded("cancellationGraceHours", "مهلت لغو");
  bounded("maxMakeupsPerTerm", "سقف جلسات جبرانی");

  for (const key of ["workingDayStart", "workingDayEnd"] as const) {
    const value = input[key];
    if (value !== undefined && !isTimeOfDay(value)) {
      errors[key] = ["ساعت باید به شکل HH:mm و در بازهٔ ۰۰:۰۰ تا ۲۳:۵۹ باشد."];
    }
  }

  const start = input.workingDayStart;
  const end = input.workingDayEnd;
  if (start !== undefined && end !== undefined && isTimeOfDay(start) && isTimeOfDay(end)) {
    if (timeToMinutes(end)! <= timeToMinutes(start)!) {
      errors.workingDayEnd = ["پایان روز کاری باید پس از شروع آن باشد."];
    }
  }

  if (input.closedWeekdays !== undefined) {
    const invalid = input.closedWeekdays.filter((day) => !isWeekdayIndex(day));
    if (invalid.length > 0) errors.closedWeekdays = ["روز تعطیل نامعتبر است."];
    if (input.closedWeekdays.length > 6) {
      errors.closedWeekdays = ["حداقل یک روز هفته باید روز کاری باشد."];
    }
  }

  if (input.firstWeekday !== undefined && !isWeekdayIndex(input.firstWeekday)) {
    errors.firstWeekday = ["روز نخست هفته نامعتبر است."];
  }

  return errors;
}

/**
 * Fills the rule fields a stored record may be missing.
 *
 * A dataset written before session rules existed has an `organization` object
 * with no `sessionGapMinutes` in it. Absent means "the shipped default", never
 * "no rule" — a missing value that silently disabled a check would be worse than
 * the field not existing at all.
 */
export function withRuleDefaults(settings: Partial<OrganizationSettings> | null | undefined): OrganizationSettings {
  const base = DEFAULT_ORGANIZATION_SETTINGS;
  const source = settings ?? {};
  return {
    ...base,
    ...source,
    closedWeekdays: Array.isArray(source.closedWeekdays)
      ? source.closedWeekdays.filter(isWeekdayIndex)
      : base.closedWeekdays,
    firstWeekday: isWeekdayIndex(source.firstWeekday as number) ? (source.firstWeekday as WeekdayIndex) : base.firstWeekday,
    updatedAt: source.updatedAt ?? base.updatedAt,
  };
}
