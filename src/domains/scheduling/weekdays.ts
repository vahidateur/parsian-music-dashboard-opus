/* ------------------------------------------------------------------ */
/* Weekday names — the scheduling domain's calendar vocabulary (M10)    */
/*                                                                      */
/* Saturday-first, matching `weekdayIndex` in ./dateBridge. There is    */
/* exactly ONE source of these lists; relocated unchanged from the      */
/* dissolved fixture module (`src/data/records.ts`).                    */
/* ------------------------------------------------------------------ */

export const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] as const;
export const WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;
