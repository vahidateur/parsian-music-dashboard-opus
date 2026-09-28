/**
 * Target seam — natural-language command showcase (DEMO composition target).
 *
 * The command palette's nl commands (n1/n2) answer with PRESENTATION
 * material — curated demo rows, category-D configuration (D5 §19), not
 * product state: the authoritative measures are derived by `useAcademyMetrics`
 * from stored records. Because that material only exists where demo content
 * exists, the answers live behind this seam: the demo composition ships the
 * showcase verbatim, and `commandShowcase.client.ts` answers honestly that
 * nothing is measured here (rows empty) instead of importing the demo fixture
 * into the client bundle.
 *
 * `nlCommands` itself (phrase, keywords, target, ownership) stays in
 * `components/overlays/commands.ts` — m10Boundary SINGLE_OWNERS pins it there.
 * Command N3's honest-empty answer also stays inline: its honesty note is
 * true in BOTH compositions by construction.
 */
import type { Severity } from "@/lib/viewContracts";

export interface NlShowcaseAnswer {
  resultTitle: string;
  summary: string;
  rows: { title: string; meta: string; tone?: Severity }[];
}

/**
 * Demo answer rows for the "at-risk students" nl command (n1), relocated
 * unchanged from the dissolved fixture. See the honesty note in `commands.ts`.
 */
export const atRiskDemoRows = [
  { name: "سارا محمدی", instrument: "پیانو", meta: "۱۵ روز غیبت · ۳ جلسه باقی‌مانده" },
  { name: "امیرحسین کریمی", instrument: "گیتار", meta: "۱۸ روز غیبت · ۱ جلسه باقی‌مانده" },
  { name: "نیلوفر رستمی", instrument: "آواز", meta: "۱۴ روز غیبت · ۵ جلسه باقی‌مانده" },
  { name: "پارسا نادری", instrument: "ویولن", meta: "۲۱ روز غیبت · شهریه پرداخت‌نشده" },
  { name: "مهسا قاسمی", instrument: "پیانو", meta: "۱۶ روز غیبت · ۲ جلسه باقی‌مانده" },
];

/** The showcase answers, keyed by command id (n1/n2 only — n3 is inline). */
export const nlAnswers: Record<"n1" | "n2", NlShowcaseAnswer> = {
  n1: {
    resultTitle: "۵ هنرجو با بیش از دو هفته غیبت",
    summary: "همهٔ این هنرجویان جلسات باقی‌مانده دارند؛ تماس امروز احتمال بازگشت را بالا می‌برد.",
    rows: atRiskDemoRows.map((s) => ({
      title: s.name,
      meta: `${s.instrument} · ${s.meta}`,
      tone: "warning" as Severity,
    })),
  },
  n2: {
    resultTitle: "۴ مورد نیازمند توجه",
    summary: "یک مورد مالی فوری و سه مورد عملیاتی برای امروز و فردا.",
    rows: [
      { title: "۳ فاکتور سررسید گذشته", meta: "مجموع ۲٬۴۵۰٬۰۰۰ تومان · قدیمی‌ترین ۱۲ روز", tone: "critical" },
      { title: "۵ هنرجو در معرض ریزش", meta: "بیش از دو هفته غیبت متوالی", tone: "warning" },
      { title: "تعارض اتاق در ساعت ۱۴:۰۰", meta: "اتاق ۱ · ویولن و پیانو پیشرفته هم‌زمان", tone: "warning" },
      { title: "غیبت ۲ مدرس در فردا", meta: "۵ کلاس بدون مدرس · نیاز به جایگزین", tone: "warning" },
    ],
  },
};
