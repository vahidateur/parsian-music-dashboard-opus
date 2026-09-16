/* ------------------------------------------------------------------ */
/* Pulse waveform demo envelope (M10)                                   */
/*                                                                      */
/* The hero's pulse is a kinetic VISUALIZATION, not a telemetry feed:   */
/* it breathes a smooth activity envelope shaped like a busy academy    */
/* day so the composer can evaluate tone, motion and legibility. These  */
/* thirteen demo slots are curated presentation content — explicitly    */
/* labelled demo, never presented as a live measurement, and allowed to */
/* stay as presentation/demo content per D5 §19 (same class as the      */
/* design-system gallery samples). Relocated here unchanged from the    */
/* retired `schedule` fixture; the Hero's live/conflict counts do NOT   */
/* come from this module — they are derived from the scheduling seam    */
/* (`src/domains/shared/useDayPulse.ts`).                               */
/* ------------------------------------------------------------------ */
import type { ClassSession } from "@/domains/scheduling/types";

/** Session-day axis anchors for the pulse visualization. */
export const DAY_START = 8 * 60;
export const DAY_END = 21 * 60;

/** The slots the envelope is shaped from (start/end/cancelled/conflict). */
export const pulseDemoSessions: Pick<ClassSession, "id" | "title" | "start" | "end" | "cancelled" | "conflict">[] = [
  { id: "c1", title: "کلاس پیانو", start: "09:00", end: "10:00" },
  { id: "c2", title: "گیتار مقدماتی", start: "09:30", end: "10:30" },
  { id: "c3", title: "کلاس گیتار", start: "10:30", end: "11:30" },
  { id: "c4", title: "تئوری موسیقی", start: "11:00", end: "12:00" },
  { id: "c5", title: "کلاس آواز", start: "12:00", end: "13:00" },
  { id: "c6", title: "پیانو کودکان", start: "13:00", end: "14:00" },
  { id: "c7", title: "کلاس ویولن", start: "14:00", end: "15:00", conflict: true },
  { id: "c8", title: "پیانو پیشرفته", start: "14:00", end: "15:00", conflict: true },
  { id: "c9", title: "کلاس درامز", start: "15:30", end: "16:30", cancelled: true },
  { id: "c10", title: "سلفژ", start: "16:00", end: "17:00" },
  { id: "c11", title: "پیانو گروهی", start: "17:00", end: "18:30" },
  { id: "c12", title: "کلاس گیتار", start: "18:00", end: "19:00" },
  { id: "c13", title: "کلاس آواز", start: "19:00", end: "20:00" },
];
