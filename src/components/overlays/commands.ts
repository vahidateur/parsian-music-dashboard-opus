/* ------------------------------------------------------------------ */
/* Command-surface configuration (M10)                                  */
/*                                                                      */
/* The command palette's verb-first commands, natural-language demo     */
/* commands and their result rows. Static presentation/application      */
/* configuration owned by the command surface (D5 §19 category D),      */
/* relocated from the dissolved fixture module `src/data/academy.ts`.   */
/*                                                                      */
/* HONESTY NOTES (D2 / F2 / §9):                                        */
/*  - The fixture's free-slot command («کلاس‌های خالی سه‌شنبه را پیدا     */
/*    کن») is GONE: its answer (`freeSlotsTuesday`) asserted room        */
/*    availability no system measures, and M10 does not build a          */
/*    free-slot search system. No fabricated Tuesday free-slot claim     */
/*    remains product-facing.                                            */
/*  - The finance/reports verbs name the section only. The fixture       */
/*    promised «فاکتورهای سررسید گذشته» and «گزارش درآمد» — readings    */
/*    that are deferred (D6 / I2, see `src/lib/financeReportsDeferral`), */
/*    so a command may not promise them.                                 */
/*  - `atRiskDemoRows` are the nl-command DEMO answer rows: category-D   */
/*    presentation/demo content for the palette's command showcase.      */
/*    They are not product state: the authoritative at-risk measure is   */
/*    derived by `useAcademyMetrics` from stored attendance records.     */
/* ------------------------------------------------------------------ */
import type { Target } from "@/lib/viewContracts";
import { nlAnswers, type NlShowcaseAnswer } from "@/targets/commandShowcase";

export interface NLCommand {
  id: string;
  phrase: string;
  keywords: string[];
  resultTitle: string;
  summary: string;
  rows: { title: string; meta: string; tone?: NlShowcaseAnswer["rows"][number]["tone"] }[];
  target: Target;
}

/** Verb-first commands — "چه کاری می‌خواهید انجام دهید؟" (verbatim from the dissolved fixture). */
export const commandVerbs: { id: string; label: string; hint: string; target: Target }[] = [
  { id: "cv1", label: "مشاهدهٔ کلاس‌های امروز", hint: "برنامه‌ریزی · امروز", target: { view: "schedule" } },
  { id: "cv2", label: "فاکتورهای سررسید گذشته", hint: "مالی · سررسید گذشته", target: { view: "finance", filter: "overdue" } },
  { id: "cv3", label: "برنامهٔ مدرس فردا", hint: "مدرسین · غیبت فردا", target: { view: "teachers", filter: "absent-tomorrow" } },
  { id: "cv4", label: "گزارش درآمد", hint: "گزارش‌ها · بازهٔ شش‌ماهه", target: { view: "reports", id: "rp5" } },
  { id: "cv5", label: "ثبت حضور و غیاب امروز", hint: "حضور · کلاس‌های ثبت‌نشده", target: { view: "attendance", filter: "pending" } },
  { id: "cv6", label: "هنرجویان در معرض ریزش", hint: "هنرجویان · در معرض ریزش", target: { view: "students", filter: "at-risk" } },
];

/*
  The nl commands' ANSWERS (resultTitle/summary/rows for n1/n2) are the
  target's showcase material — demo content in the demo composition, honest
  unavailables in the client composition — and arrive through the
  `targets/commandShowcase` seam. Phrases, keywords and targets stay here:
  the QUESTION is product surface; only the demo ANSWER is target-specific.
  `atRiskDemoRows` now lives in the seam too (it was n1's demo rows).
*/
export const nlCommands: NLCommand[] = [
  {
    id: "n1",
    phrase: "هنرجوهایی که دو هفته غیبت داشته‌اند را نشان بده",
    keywords: ["غیبت", "دو هفته", "ریزش", "غایب"],
    ...nlAnswers.n1,
    target: { view: "students", filter: "at-risk" },
  },
  {
    id: "n2",
    phrase: "چه چیزهایی امروز نیاز به توجه دارند؟",
    keywords: ["توجه", "امروز", "مشکل", "هشدار"],
    ...nlAnswers.n2,
    target: { view: "dashboard" },
  },
  {
    id: "n3",
    phrase: "کلاس‌های خالی سه‌شنبه را پیدا کن",
    keywords: ["خالی", "سه‌شنبه", "سه شنبه", "ظرفیت", "آزاد"],
    /*
      D2 (M10): the fixture answered this with a hand-written «۴ بازهٔ خالی»
      list (`freeSlotsTuesday`) — a free-slot *engineering* of the academy the
      records never supported. No free-slot read exists anywhere in this build,
      so the honest answer is that there is no answer: the phrase stays
      recognisable (removing it would make a known question look unknown), and
      the result states the truth — nothing is measured here.
    */
    resultTitle: "داده‌ای نیست",
    summary: "بازهٔ آزاد اتاق‌ها از دادهٔ این محیط استخراج نمی‌شود؛ پاسخی که بتوان نشانش داد وجود ندارد.",
    rows: [],
    target: { view: "schedule" },
  },
];
