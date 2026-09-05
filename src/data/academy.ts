import { parseTime } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
export type ViewId =
  | "dashboard"
  | "students"
  | "teachers"
  | "classes"
  | "schedule"
  | "attendance"
  | "finance"
  | "reports"
  | "messages"
  | "library"
  | "settings"
  | "design-system";

export type Instrument = "piano" | "guitar" | "voice" | "violin" | "drums" | "theory";

export type ClassStatus = "done" | "live" | "next" | "scheduled" | "cancelled" | "attention";

export interface ClassSession {
  id: string;
  title: string;
  instrument: Instrument;
  room: string;
  teacher: string;
  start: string; // HH:MM
  end: string; // HH:MM
  cancelled?: boolean;
  conflict?: boolean;
  students?: number;
  capacity?: number;
}

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
  value: string;
  unit?: string;
  delta: number;
  deltaLabel: string;
  context: string;
  tone: "ok" | "warn" | "neutral";
  series: number[];
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
  fields: { label: string; placeholder: string; type?: "text" | "select"; options?: string[] }[];
  success: string;
}

export interface NLCommand {
  id: string;
  phrase: string;
  keywords: string[];
  resultTitle: string;
  summary: string;
  rows: { title: string; meta: string; tone?: Severity }[];
  target: Target;
}

/* ------------------------------------------------------------------ */
/* Demo clock — 10:47, a Tuesday morning                               */
/* ------------------------------------------------------------------ */
/**
 * @deprecated Read "now" from `@/domains/shared/clock` (`useAcademyNow` in
 * components, `academyNowMinutes()` elsewhere). This constant is only the
 * *demo* instant; using it directly freezes production time too. It remains
 * exported as the default argument of the pure helpers below, which must stay
 * free of environment lookups so they are testable.
 */
export const ACADEMY_NOW = 10 * 60 + 47;
export const DAY_START = 8 * 60;
export const DAY_END = 21 * 60;

export const manager = {
  name: "آرمان احمدی",
  firstName: "آرمان",
  role: "مدیر ارشد",
  initials: "آ",
};

export const academy = {
  name: "آکادمی موسیقی آوا",
  tagline: "سامانهٔ یکپارچهٔ آموزشگاه",
  status: "خوب" as const,
  statusLine: "آموزشگاه امروز در وضعیت خوبی قرار دارد.",
};

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */
export interface NavDef {
  id: ViewId;
  label: string;
  badge?: number;
  hint?: string;
}

/** Grouped navigation — one coherent product, not a list of links. */
export interface NavGroup {
  id: string;
  label?: string;
  items: NavDef[];
}

export const navGroups: NavGroup[] = [
  { id: "overview", label: "نمای کلی", items: [{ id: "dashboard", label: "داشبورد", hint: "امروز چه چیزی نیاز به توجه دارد" }] },
  {
    id: "people",
    label: "افراد",
    items: [
      { id: "students", label: "هنرجویان", hint: "پرونده و پیشرفت" },
      { id: "teachers", label: "مدرسین", hint: "بار کاری و در دسترس بودن" },
    ],
  },
  {
    id: "operations",
    label: "عملیات",
    items: [
      { id: "classes", label: "کلاس‌ها", hint: "ظرفیت و ثبت‌نام" },
      { id: "schedule", label: "برنامه‌ریزی", hint: "تقویم هفتگی و تعارض‌ها" },
      { id: "attendance", label: "حضور و غیاب", badge: 3, hint: "۳ کلاس ثبت‌نشده" },
    ],
  },
  {
    id: "business",
    label: "کسب‌وکار",
    items: [
      { id: "finance", label: "مالی", hint: "درآمد و فاکتورها" },
      { id: "reports", label: "گزارش‌ها", hint: "چرا این اتفاق می‌افتد" },
    ],
  },
  {
    id: "communication",
    label: "ارتباط",
    items: [{ id: "messages", label: "پیام‌ها", badge: 5, hint: "مدرسین، هنرجویان و اولیا" }],
  },
  {
    id: "resources",
    label: "منابع",
    items: [{ id: "library", label: "کتابخانه", hint: "نت، صدا و ویدیو" }],
  },
  {
    id: "system",
    label: "سیستم",
    items: [
      { id: "settings", label: "تنظیمات" },
      { id: "design-system", label: "سیستم طراحی" },
    ],
  },
];

export const navItems: NavDef[] = navGroups.flatMap((g) => g.items);

export const viewTitles: Record<ViewId, string> = {
  dashboard: "داشبورد",
  students: "هنرجویان",
  teachers: "مدرسین",
  classes: "کلاس‌ها",
  schedule: "برنامه‌ریزی",
  attendance: "حضور و غیاب",
  finance: "مالی",
  reports: "گزارش‌ها",
  messages: "پیام‌ها",
  library: "کتابخانه",
  settings: "تنظیمات",
  "design-system": "سیستم طراحی",
};

/* ------------------------------------------------------------------ */
/* Instruments                                                         */
/* ------------------------------------------------------------------ */
export const instrumentLabel: Record<Instrument, string> = {
  piano: "پیانو",
  guitar: "گیتار",
  voice: "آواز",
  violin: "ویولن",
  drums: "درامز",
  theory: "تئوری",
};

/* ------------------------------------------------------------------ */
/* Today's schedule (13 sessions, 1 cancelled → 12 classes today)      */
/* ------------------------------------------------------------------ */
export const schedule: ClassSession[] = [
  { id: "c1", title: "کلاس پیانو", instrument: "piano", room: "اتاق ۱", teacher: "سارا احمدی", start: "09:00", end: "10:00", students: 1, capacity: 1 },
  { id: "c2", title: "گیتار مقدماتی", instrument: "guitar", room: "اتاق ۲", teacher: "محمد رضایی", start: "09:30", end: "10:30", students: 4, capacity: 5 },
  { id: "c3", title: "کلاس گیتار", instrument: "guitar", room: "اتاق ۲", teacher: "محمد رضایی", start: "10:30", end: "11:30", students: 5, capacity: 6 },
  { id: "c4", title: "تئوری موسیقی", instrument: "theory", room: "اتاق ۳", teacher: "بهرام نیک‌نژاد", start: "11:00", end: "12:00", students: 8, capacity: 10 },
  { id: "c5", title: "کلاس آواز", instrument: "voice", room: "اتاق ۳", teacher: "نرگس حسینی", start: "12:00", end: "13:00", students: 3, capacity: 4 },
  { id: "c6", title: "پیانو کودکان", instrument: "piano", room: "اتاق ۱", teacher: "سارا احمدی", start: "13:00", end: "14:00", students: 4, capacity: 4 },
  { id: "c7", title: "کلاس ویولن", instrument: "violin", room: "اتاق ۱", teacher: "علی موسوی", start: "14:00", end: "15:00", conflict: true, students: 1, capacity: 1 },
  { id: "c8", title: "پیانو پیشرفته", instrument: "piano", room: "اتاق ۱", teacher: "سارا احمدی", start: "14:00", end: "15:00", conflict: true, students: 1, capacity: 1 },
  { id: "c9", title: "کلاس درامز", instrument: "drums", room: "اتاق ۴", teacher: "کاوه کاظمی", start: "15:30", end: "16:30", cancelled: true, students: 2, capacity: 3 },
  { id: "c10", title: "سلفژ", instrument: "theory", room: "اتاق ۳", teacher: "بهرام نیک‌نژاد", start: "16:00", end: "17:00", students: 6, capacity: 10 },
  { id: "c11", title: "پیانو گروهی", instrument: "piano", room: "اتاق ۱", teacher: "سارا احمدی", start: "17:00", end: "18:30", students: 5, capacity: 6 },
  { id: "c12", title: "کلاس گیتار", instrument: "guitar", room: "اتاق ۲", teacher: "محمد رضایی", start: "18:00", end: "19:00", students: 4, capacity: 6 },
  { id: "c13", title: "کلاس آواز", instrument: "voice", room: "اتاق ۳", teacher: "نرگس حسینی", start: "19:00", end: "20:00", students: 3, capacity: 4 },
];

export const statusOf = (s: ClassSession, now = ACADEMY_NOW): ClassStatus => {
  if (s.cancelled) return "cancelled";
  if (s.conflict) return "attention";
  const start = parseTime(s.start);
  const end = parseTime(s.end);
  if (end <= now) return "done";
  if (start <= now && now < end) return "live";
  return "scheduled";
};

/** A curated subset for the "Today's flow" panel — the dashboard summarises, it doesn't duplicate. */
export const todayFlowIds = ["c1", "c3", "c5", "c7", "c9", "c11"];


/* ------------------------------------------------------------------ */
/* Primary signals (30-day)                                            */
/* ------------------------------------------------------------------ */
export const signals: Signal[] = [
  {
    id: "students",
    label: "هنرجویان فعال",
    value: "۱٬۲۴۸",
    delta: 8.4,
    deltaLabel: "نسبت به ۳۰ روز گذشته",
    context: "شتاب رشد در حال افزایش است",
    tone: "ok",
    series: [1052, 1061, 1075, 1088, 1097, 1110, 1121, 1133, 1149, 1168, 1195, 1220, 1248],
    kind: "line",
    target: { view: "students" },
  },
  {
    id: "revenue",
    label: "درآمد این ماه",
    value: "۱۲۵٬۴۳۰٬۰۰۰",
    unit: "تومان",
    delta: 6.2,
    deltaLabel: "نسبت به ماه گذشته",
    context: "۸۸٪ از هدف ماهانه محقق شده",
    tone: "ok",
    series: [72, 64, 88, 91, 78, 96, 84, 102, 95, 110, 98, 118, 125],
    kind: "bars",
    target: { view: "finance" },
  },
  {
    id: "attendance",
    label: "حضور",
    value: "۹۲",
    unit: "٪",
    delta: 2.1,
    deltaLabel: "نسبت به ماه گذشته",
    context: "وضعیت مطلوب · بالاتر از میانگین ۸۹٪",
    tone: "ok",
    series: [88, 89, 87, 90, 89, 91, 90, 90, 92, 91, 92, 93, 92],
    kind: "line",
    target: { view: "attendance" },
  },
  {
    id: "utilization",
    label: "بهره‌وری مدرسین",
    value: "۷۹",
    unit: "٪",
    delta: 11,
    deltaLabel: "نسبت به ماه گذشته",
    context: "۴ مدرس زیر ۶۰٪ ظرفیت هستند",
    tone: "warn",
    series: [64, 66, 65, 69, 70, 68, 72, 74, 73, 76, 77, 78, 79],
    kind: "line",
    target: { view: "teachers", filter: "low-utilization" },
  },
];

/* ------------------------------------------------------------------ */
/* Needs attention                                                     */
/* ------------------------------------------------------------------ */
export const attentionItems: AttentionItem[] = [
  {
    id: "a1",
    severity: "critical",
    title: "۳ فاکتور سررسید گذشته",
    context: "مجموع ۲٬۴۵۰٬۰۰۰ تومان · قدیمی‌ترین ۱۲ روز",
    action: "پیگیری پرداخت",
    target: { view: "finance", filter: "overdue" },
  },
  {
    id: "a2",
    severity: "warning",
    title: "۵ هنرجو در معرض ریزش",
    context: "بیش از دو هفته غیبت متوالی",
    action: "مشاهده و تماس",
    target: { view: "students", filter: "at-risk" },
  },
  {
    id: "a3",
    severity: "warning",
    title: "تعارض اتاق در ساعت ۱۴:۰۰",
    context: "اتاق ۱ · ویولن و پیانو پیشرفته هم‌زمان",
    action: "حل تعارض",
    target: { view: "schedule", filter: "conflict" },
  },
  {
    id: "a4",
    severity: "warning",
    title: "غیبت ۲ مدرس در فردا",
    context: "۵ کلاس بدون مدرس · نیاز به جایگزین",
    action: "تعیین جایگزین",
    target: { view: "teachers", filter: "absent-tomorrow" },
  },
];

/* ------------------------------------------------------------------ */
/* Intelligence                                                        */
/* ------------------------------------------------------------------ */
export const insights: Insight[] = [
  {
    id: "i1",
    kind: "trend",
    text: "نرخ ماندگاری هنرجویان ۴٫۲٪ افزایش یافته است.",
    detail: "بیشترین اثر از کلاس‌های گروهی پیانو و گیتار آمده است. این روند را حفظ کنید.",
    action: { label: "گزارش ماندگاری", target: { view: "reports", filter: "retention" } },
  },
  {
    id: "i2",
    kind: "risk",
    text: "۸ هنرجو جلسات استفاده‌نشده دارند که ممکن است تا پایان دوره منقضی شوند.",
    detail: "ارزش تقریبی جلسات: ۶٬۴۰۰٬۰۰۰ تومان. یادآوری خودکار پیشنهاد می‌شود.",
    action: { label: "ارسال یادآوری", target: { view: "messages", filter: "unused-sessions" } },
  },
  {
    id: "i3",
    kind: "idea",
    text: "ظرفیت کلاس‌های پیانو در سه‌شنبه‌ها به ۹۱٪ رسیده است.",
    detail: "پیشنهاد: یک بازهٔ زمانی جدید در اتاق ۴ (۵۸٪ اشغال) ایجاد کنید.",
    action: { label: "ایجاد بازهٔ زمانی", target: { view: "schedule", filter: "new-slot" } },
  },
];

/* ------------------------------------------------------------------ */
/* Business intelligence                                               */
/* ------------------------------------------------------------------ */
export const revenueSeries = [
  { label: "مهر", value: 98 },
  { label: "آبان", value: 104 },
  { label: "آذر", value: 112 },
  { label: "دی", value: 109 },
  { label: "بهمن", value: 118 },
  { label: "اسفند", value: 125.4 },
];
export const revenueTarget = 142;

export const growthSeries = [
  { label: "مهر", value: 1052 },
  { label: "آبان", value: 1088 },
  { label: "آذر", value: 1121 },
  { label: "دی", value: 1149 },
  { label: "بهمن", value: 1195 },
  { label: "اسفند", value: 1248 },
];

export const occupancy = {
  overall: 82,
  rooms: [
    { label: "اتاق ۱", value: 94 },
    { label: "اتاق ۲", value: 86 },
    { label: "اتاق ۳", value: 78 },
    { label: "اتاق ۴", value: 58 },
  ],
  week: [
    { label: "ش", full: "شنبه", value: 78 },
    { label: "ی", full: "یکشنبه", value: 84 },
    { label: "د", full: "دوشنبه", value: 80 },
    { label: "س", full: "سه‌شنبه", value: 91 },
    { label: "چ", full: "چهارشنبه", value: 86 },
    { label: "پ", full: "پنجشنبه", value: 88 },
    { label: "ج", full: "جمعه", value: 42 },
  ],
};

export const instruments: { key: Instrument; label: string; share: number; count: number; delta: number }[] = [
  { key: "piano", label: "پیانو", share: 42, count: 524, delta: 3 },
  { key: "guitar", label: "گیتار", share: 25, count: 312, delta: 1 },
  { key: "violin", label: "ویولن", share: 15, count: 187, delta: -1 },
  { key: "voice", label: "آواز", share: 10, count: 125, delta: 2 },
  { key: "drums", label: "درامز", share: 8, count: 100, delta: 0 },
];

/* ------------------------------------------------------------------ */
/* Quick actions                                                       */
/* ------------------------------------------------------------------ */
export const quickActions: QuickActionDef[] = [
  {
    id: "student",
    label: "افزودن هنرجو",
    hint: "ثبت‌نام جدید",
    fields: [
      { label: "نام و نام خانوادگی", placeholder: "مثلاً: نیلوفر رستمی" },
      { label: "شمارهٔ تماس", placeholder: "۰۹۱۲ ··· ····" },
      { label: "ساز", placeholder: "انتخاب ساز", type: "select", options: ["پیانو", "گیتار", "ویولن", "آواز", "درامز"] },
      { label: "مدرس پیشنهادی", placeholder: "انتخاب مدرس", type: "select", options: ["سارا احمدی", "محمد رضایی", "علی موسوی", "نرگس حسینی"] },
    ],
    success: "هنرجوی جدید ثبت شد",
  },
  {
    id: "class",
    label: "برنامه‌ریزی کلاس",
    hint: "بازهٔ زمانی جدید",
    fields: [
      { label: "عنوان کلاس", placeholder: "مثلاً: پیانو گروهی" },
      { label: "اتاق", placeholder: "انتخاب اتاق", type: "select", options: ["اتاق ۱", "اتاق ۲", "اتاق ۳", "اتاق ۴ (۵۸٪ آزاد)"] },
      { label: "روز و ساعت", placeholder: "سه‌شنبه · ۱۶:۰۰" },
      { label: "مدرس", placeholder: "انتخاب مدرس", type: "select", options: ["سارا احمدی", "محمد رضایی", "علی موسوی", "نرگس حسینی"] },
    ],
    success: "کلاس در تقویم ثبت شد",
  },
  {
    id: "payment",
    label: "ثبت پرداخت",
    hint: "شهریه یا جلسه",
    fields: [
      { label: "هنرجو", placeholder: "جستجوی نام هنرجو" },
      { label: "مبلغ (تومان)", placeholder: "۱٬۲۰۰٬۰۰۰" },
      { label: "روش پرداخت", placeholder: "انتخاب روش", type: "select", options: ["کارت‌خوان", "انتقال بانکی", "نقدی", "درگاه آنلاین"] },
    ],
    success: "پرداخت ثبت و رسید ارسال شد",
  },
  {
    id: "message",
    label: "ارسال پیام",
    hint: "به هنرجو یا مدرس",
    fields: [
      { label: "گیرندگان", placeholder: "انتخاب گروه", type: "select", options: ["هنرجویان در معرض ریزش (۵)", "مدرسین", "همهٔ هنرجویان پیانو", "والدین کلاس کودکان"] },
      { label: "متن پیام", placeholder: "سلام، یادآوری می‌کنیم که…" },
    ],
    success: "پیام در صف ارسال قرار گرفت",
  },
];

/* ------------------------------------------------------------------ */
/* Operational lists (used by section screens & command results)       */
/* ------------------------------------------------------------------ */
export const atRiskStudents = [
  { name: "سارا محمدی", instrument: "پیانو", meta: "۱۵ روز غیبت · ۳ جلسه باقی‌مانده" },
  { name: "امیرحسین کریمی", instrument: "گیتار", meta: "۱۸ روز غیبت · ۱ جلسه باقی‌مانده" },
  { name: "نیلوفر رستمی", instrument: "آواز", meta: "۱۴ روز غیبت · ۵ جلسه باقی‌مانده" },
  { name: "پارسا نادری", instrument: "ویولن", meta: "۲۱ روز غیبت · شهریه پرداخت‌نشده" },
  { name: "مهسا قاسمی", instrument: "پیانو", meta: "۱۶ روز غیبت · ۲ جلسه باقی‌مانده" },
];

export const overdueInvoices = [
  { id: "INV-1042", name: "رضا شریفی", amount: 1_200_000, days: 12 },
  { id: "INV-1038", name: "مریم توکلی", amount: 850_000, days: 9 },
  { id: "INV-1051", name: "کیان عباسی", amount: 400_000, days: 3 },
];

export const teacherAbsences = [
  { name: "محمد رضایی", instrument: "گیتار", classes: 3, substitute: "رامین صادقی" },
  { name: "نرگس حسینی", instrument: "آواز", classes: 2, substitute: "—" },
];

export const freeSlotsTuesday = [
  { room: "اتاق ۴", time: "۱۰:۰۰ – ۱۲:۰۰" },
  { room: "اتاق ۴", time: "۱۵:۰۰ – ۱۷:۰۰" },
  { room: "اتاق ۳", time: "۱۴:۰۰ – ۱۵:۰۰" },
  { room: "اتاق ۲", time: "۱۹:۰۰ – ۲۰:۰۰" },
];

/* ------------------------------------------------------------------ */
/* Command palette                                                     */
/* ------------------------------------------------------------------ */

/** Verb-first commands — "چه کاری می‌خواهید انجام دهید؟" */
export const commandVerbs: { id: string; label: string; hint: string; target: Target }[] = [
  { id: "cv1", label: "مشاهدهٔ کلاس‌های امروز", hint: "برنامه‌ریزی · امروز", target: { view: "schedule" } },
  { id: "cv2", label: "فاکتورهای سررسید گذشته", hint: "مالی · ۳ مورد", target: { view: "finance", filter: "overdue" } },
  { id: "cv3", label: "برنامهٔ مدرس فردا", hint: "مدرسین · غیبت فردا", target: { view: "teachers", filter: "absent-tomorrow" } },
  { id: "cv4", label: "گزارش درآمد", hint: "گزارش‌ها · ۶ ماه", target: { view: "reports", id: "rp5" } },
  { id: "cv5", label: "ثبت حضور و غیاب امروز", hint: "حضور · ۳ کلاس ثبت‌نشده", target: { view: "attendance", filter: "pending" } },
  { id: "cv6", label: "هنرجویان در معرض ریزش", hint: "هنرجویان · ۵ نفر", target: { view: "students", filter: "at-risk" } },
];

export const nlCommands: NLCommand[] = [
  {
    id: "n1",
    phrase: "هنرجوهایی که دو هفته غیبت داشته‌اند را نشان بده",
    keywords: ["غیبت", "دو هفته", "ریزش", "غایب"],
    resultTitle: "۵ هنرجو با بیش از دو هفته غیبت",
    summary: "همهٔ این هنرجویان جلسات باقی‌مانده دارند؛ تماس امروز احتمال بازگشت را بالا می‌برد.",
    rows: atRiskStudents.map((s) => ({ title: s.name, meta: `${s.instrument} · ${s.meta}`, tone: "warning" as Severity })),
    target: { view: "students", filter: "at-risk" },
  },
  {
    id: "n2",
    phrase: "چه چیزهایی امروز نیاز به توجه دارند؟",
    keywords: ["توجه", "امروز", "مشکل", "هشدار"],
    resultTitle: "۴ مورد نیازمند توجه",
    summary: "یک مورد مالی فوری و سه مورد عملیاتی برای امروز و فردا.",
    rows: attentionItems.map((a) => ({ title: a.title, meta: a.context, tone: a.severity })),
    target: { view: "dashboard" },
  },
  {
    id: "n3",
    phrase: "کلاس‌های خالی سه‌شنبه را پیدا کن",
    keywords: ["خالی", "سه‌شنبه", "سه شنبه", "ظرفیت", "آزاد"],
    resultTitle: "۴ بازهٔ خالی در سه‌شنبه‌ها",
    summary: "اتاق ۴ بیشترین ظرفیت آزاد را دارد — مناسب برای بازهٔ جدید پیانو.",
    rows: freeSlotsTuesday.map((f) => ({ title: f.room, meta: f.time, tone: "info" as Severity })),
    target: { view: "schedule", filter: "new-slot" },
  },
];
