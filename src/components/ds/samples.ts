/* ------------------------------------------------------------------ */
/* Design-system gallery samples (M10)                                  */
/*                                                                      */
/* Explicitly-labelled component DEMONSTRATION content: rows a gallery  */
/* renders so a designer can evaluate a component in every state. This  */
/* file is the presentation/demo owner for those samples (D5 §19        */
/* category D + M10 §11) — the gallery's data is not product state,     */
/* reads no repository, and renders identically in every environment.   */
/* The four insight panels of the product itself are derived from live  */
/* records (M9) and never read from here; the retired `signals`,        */
/* `attentionItems`, `insights`, `intelligenceCards`, `schedule` and    */
/* `students` fixture payloads kept their values here so the gallery    */
/* keeps the same demonstrations.                                       */
/* ------------------------------------------------------------------ */
import type { AttentionItem, Insight, Signal } from "@/lib/viewContracts";
import type { ClassSession } from "@/domains/scheduling/types";
import type { Student } from "@/domains/students/types";
import type { IntelligenceCard } from "@/domains/shared/dashboardInsights";

/* Signals — KPI cards in ok/warn/neutral tones, with sparkline history. */
export const sampleSignals: Signal[] = [
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

/* Attention items — critical + warning rows for AlertItem. */
export const sampleAttentionItems: AttentionItem[] = [
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
];

/* Insights — trend/risk/idea rows for InsightItem. */
export const sampleInsights: Insight[] = [
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

/* Session rows — the timeline demos (six statuses, in order). */
export const sampleClassSessions: ClassSession[] = [
  { id: "c2", title: "گیتار مقدماتی", instrument: "guitar", room: "اتاق ۲", teacher: "محمد رضایی", start: "09:30", end: "10:30", students: 4, capacity: 5 },
  { id: "c3", title: "کلاس گیتار", instrument: "guitar", room: "اتاق ۲", teacher: "محمد رضایی", start: "10:30", end: "11:30", students: 5, capacity: 6 },
  { id: "c4", title: "تئوری موسیقی", instrument: "theory", room: "اتاق ۳", teacher: "بهرام نیک‌نژاد", start: "11:00", end: "12:00", students: 8, capacity: 10 },
  { id: "c5", title: "کلاس آواز", instrument: "voice", room: "اتاق ۳", teacher: "نرگس حسینی", start: "12:00", end: "13:00", students: 3, capacity: 4 },
  { id: "c6", title: "پیانو کودکان", instrument: "piano", room: "اتاق ۱", teacher: "سارا احمدی", start: "13:00", end: "14:00", students: 4, capacity: 4 },
  { id: "c7", title: "کلاس ویولن", instrument: "violin", room: "اتاق ۱", teacher: "علی موسوی", start: "14:00", end: "15:00", conflict: true, students: 1, capacity: 1 },
];

/* Intelligence cards — Signal → Evidence → Insight → Action. */
export const sampleIntelligenceCards: IntelligenceCard[] = [
  {
    id: "ic1", kind: "trend", signal: "نرخ ماندگاری هنرجویان ۴٫۲٪ افزایش یافته است.",
    evidence: [
      { label: "کلاس گروهی", value: "۹۴٪" },
      { label: "کلاس خصوصی", value: "۸۶٪" },
      { label: "بازهٔ بررسی", value: "۱۲ ماه" },
    ],
    insight: "بیشترین اثر از کلاس‌های گروهی پیانو و گیتار آمده است؛ ترکیب فعلی دوره‌ها را حفظ کنید.",
    action: { label: "گزارش ماندگاری", target: { view: "reports", id: "rp2" } },
    confidence: "بالا", source: "۱۲ ماه داده ثبت‌نام و تمدید",
  },
  {
    id: "ic2", kind: "risk", signal: "۸ هنرجو جلسات استفاده‌نشده دارند که تا پایان دوره منقضی می‌شوند.",
    evidence: [
      { label: "جلسات باقی", value: "۲۹ جلسه" },
      { label: "ارزش تقریبی", value: "۶٫۴ میلیون" },
      { label: "مهلت", value: "۱۰ روز" },
    ],
    insight: "اگر تا پایان هفته یادآوری ارسال شود، بر پایهٔ دوره‌های قبل حدود دوسوم جلسات استفاده می‌شوند.",
    action: { label: "ارسال یادآوری", target: { view: "messages", filter: "unused-sessions" } },
    confidence: "متوسط", source: "پروندهٔ جلسات دورهٔ زمستان",
  },
  {
    id: "ic3", kind: "idea", signal: "ظرفیت کلاس‌های پیانو در سه‌شنبه‌ها به ۹۱٪ رسیده است.",
    evidence: [
      { label: "لیست انتظار", value: "۴ نفر" },
      { label: "اتاق ۴", value: "۵۸٪ آزاد" },
      { label: "درآمد بالقوه", value: "۹٫۶ میلیون/ماه" },
    ],
    insight: "یک بازهٔ ۱۶:۰۰ سه‌شنبه در اتاق ۴ می‌تواند لیست انتظار را پوشش دهد بدون افزایش بار مدرس ارشد.",
    action: { label: "ایجاد بازهٔ زمانی", target: { view: "schedule", filter: "new-slot" } },
    confidence: "بالا", source: "تقویم ۸ هفتهٔ گذشته",
  },
];

/* Students — three full rows for the DataTable demonstration. */
const skillSample = (a: number, b: number, c: number, d: number) => [
  { label: "تکنیک", value: a },
  { label: "ریتم", value: b },
  { label: "شنیداری", value: c },
  { label: "اجرا", value: d },
];

export const sampleStudents: Student[] = [
  {
    id: "st1", nationalId: "2000000002", name: "سارا محمدی", instrument: "piano", teacherId: "t1", level: "سطح ۳ · میانی", levelStep: 3, status: "at-risk", payment: "due",
    sessionsUsed: 9, sessionsTotal: 12, attendance: 62, progress: 54, since: "مهر ۱۴۰۳", age: 17, phone: "۰۹۱۲ ··· ۴۰۲۲",
    nextClass: { day: "پنجشنبه", time: "۱۷:۰۰", room: "اتاق ۱" }, lastSeen: "۱۵ روز پیش", balance: 1_200_000,
    notes: [
      { by: "سارا احمدی", date: "۲ هفته پیش", text: "قطعه‌ی بتهوون را نیمه‌کاره رها کرد؛ انگیزه پایین آمده. پیشنهاد می‌کنم رپرتوار سبک‌تری انتخاب کنیم." },
      { by: "پذیرش", date: "۱ ماه پیش", text: "درخواست جابه‌جایی ساعت کلاس به بعدازظهر داشت." },
    ],
    activity: [
      { date: "۱۵ روز پیش", kind: "absence", text: "غیبت در کلاس پیانو — بدون اطلاع قبلی" },
      { date: "۱۸ روز پیش", kind: "session", text: "جلسهٔ ۹ از ۱۲ برگزار شد" },
      { date: "۲۲ روز پیش", kind: "note", text: "یادداشت مدرس ثبت شد" },
      { date: "۱ ماه پیش", kind: "payment", text: "پرداخت شهریهٔ دورهٔ پاییز — ۳٬۶۰۰٬۰۰۰ تومان" },
    ],
    skills: skillSample(58, 64, 49, 45),
  },
  {
    id: "st2", nationalId: "2000035711", name: "امیرحسین کریمی", instrument: "guitar", teacherId: "t2", level: "سطح ۲ · مقدماتی", levelStep: 2, status: "at-risk", payment: "overdue",
    sessionsUsed: 11, sessionsTotal: 12, attendance: 58, progress: 41, since: "آبان ۱۴۰۳", age: 15, phone: "۰۹۱۲ ··· ۸۸۱۴", guardian: "مریم کریمی",
    nextClass: { day: "چهارشنبه", time: "۱۸:۰۰", room: "اتاق ۲" }, lastSeen: "۱۸ روز پیش", balance: 850_000,
    notes: [{ by: "محمد رضایی", date: "۳ هفته پیش", text: "تمرین خانگی انجام نمی‌شود. تماس با خانواده لازم است." }],
    activity: [
      { date: "۱۸ روز پیش", kind: "absence", text: "دومین غیبت متوالی" },
      { date: "۲۵ روز پیش", kind: "session", text: "جلسهٔ ۱۱ از ۱۲ برگزار شد" },
      { date: "۱ ماه پیش", kind: "message", text: "یادآوری پرداخت برای ولی ارسال شد" },
    ],
    skills: skillSample(44, 52, 38, 36),
  },
  {
    id: "st3", nationalId: "2000071422", name: "نیلوفر رستمی", instrument: "voice", teacherId: "t4", level: "سطح ۱ · پایه", levelStep: 1, status: "at-risk", payment: "paid",
    sessionsUsed: 7, sessionsTotal: 12, attendance: 66, progress: 38, since: "دی ۱۴۰۳", age: 22, phone: "۰۹۱۲ ··· ۵۵۹۰",
    nextClass: { day: "سه‌شنبه", time: "۱۹:۰۰", room: "اتاق ۳" }, lastSeen: "۱۴ روز پیش", balance: 0,
    notes: [{ by: "نرگس حسینی", date: "۱۰ روز پیش", text: "صدای خوبی دارد اما به تمرین تنفس منظم نیاز دارد." }],
    activity: [
      { date: "۱۴ روز پیش", kind: "absence", text: "غیبت با اطلاع قبلی — سفر کاری" },
      { date: "۲۰ روز پیش", kind: "session", text: "جلسهٔ ۷ از ۱۲ برگزار شد" },
    ],
    skills: skillSample(40, 45, 55, 34),
  },
];
