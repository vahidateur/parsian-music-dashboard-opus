/**
 * The form-facing Jalali boundary, and the field copy that goes with it.
 *
 * WHY THIS MODULE EXISTS
 *
 * Three scheduling-shaped dialogs — the reschedule form, the session-generation
 * form and the compensation booking form — each carried a private copy of the SAME
 * two things:
 *
 *   1. the ISO→Jalali display used to seed a date input, so that an untouched date
 *      round-trips through `jalaliToIso` unchanged;
 *   2. the sentences a form shows when a field's value cannot be read as the field
 *      it claims to be.
 *
 * Two copies of a message is a coincidence; three is a place for them to drift, and
 * a form that tells an operator one thing while the write answers another is the
 * defect the write-feedback rules were written about. So the vocabulary lives here,
 * once.
 *
 * WHAT IS NOT HERE, AND WHY
 *
 * The conversion itself — what a Jalali day IS, how it maps to an ISO `YYYY-MM-DD`,
 * which weekday convention the product uses — belongs to the scheduling domain
 * (`jalaliToIso` / `isoToJalaliDisplay` / `toMinutes` in
 * `domains/scheduling/dateBridge`) and is not restated here. This module is only the
 * view layer's boundary around it: the display options a date input uses, the value
 * a date input starts with, and the words a form uses when it cannot read what was
 * typed. No date arithmetic, no parsing rule, no eligibility rule.
 */
import { isoToJalaliDisplay } from "@/domains/scheduling/dateBridge";

/** The display options every Jalali date input in the product is typed against. */
export const DATE_INPUT_OPTIONS = { year: "numeric", month: "2-digit", day: "2-digit" } as const;

/**
 * A session's day as the form's own date input shows it.
 *
 * `isoToJalaliDisplay` answers with an empty string for input it cannot render, and
 * an empty string is exactly what an empty date input should show — so callers get
 * "the day, or nothing", never a placeholder that would read as a real date.
 */
export function jalaliInputValue(iso: string): string {
  return isoToJalaliDisplay(iso, DATE_INPUT_OPTIONS);
}

/**
 * What a form says when a field cannot be read as the field it claims to be.
 *
 * Presence and format only. Whether a moment is inside the academy's hours, whether
 * a duration is legal, and whether a slot is free are the domain's answers, reported
 * by the write — a form that guessed them would disagree with the repository.
 */
export const FIELD_MESSAGES = {
  date: "تاریخ را به شکل ۱۴۰۴/۰۷/۰۱ وارد کنید.",
  startTime: "ساعت را به شکل ۱۴:۰۰ وارد کنید.",
  endTime: "ساعت را به شکل ۱۵:۳۰ وارد کنید.",
} as const;
