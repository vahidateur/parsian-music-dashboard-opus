import type { Instrument, Severity, Target } from "./academy";

/* ------------------------------------------------------------------ */
/* Shared vocabulary                                                    */
/* ------------------------------------------------------------------ */
export const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] as const;
export const WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;
export const TODAY_INDEX = 3; // سه‌شنبه

export const rooms = [
  { id: "r1", name: "اتاق ۱", kind: "پیانو · آکوستیک", capacity: 6, occupancy: 94 },
  { id: "r2", name: "اتاق ۲", kind: "سازهای زهی و مضرابی", capacity: 8, occupancy: 86 },
  { id: "r3", name: "اتاق ۳", kind: "آواز · تئوری", capacity: 12, occupancy: 78 },
  { id: "r4", name: "اتاق ۴", kind: "درامز · عایق صوتی", capacity: 5, occupancy: 58 },
];

export type PaymentStatus = "paid" | "due" | "overdue";
export const paymentLabel: Record<PaymentStatus, string> = { paid: "تسویه", due: "در انتظار", overdue: "سررسید گذشته" };

export type StudentStatus = "active" | "at-risk" | "paused" | "waitlist";
export const studentStatusLabel: Record<StudentStatus, string> = {
  active: "فعال",
  "at-risk": "در معرض ریزش",
  paused: "متوقف",
  waitlist: "لیست انتظار",
};

/* ------------------------------------------------------------------ */
/* Teachers                                                             */
/* ------------------------------------------------------------------ */
export interface TeacherNote {
  date: string;
  text: string;
}

export interface Teacher {
  id: string;
  name: string;
  instrument: Instrument;
  title: string;
  students: number;
  utilization: number; // % of contracted hours filled
  weeklyHours: number;
  contractHours: number;
  attendanceRate: number;
  retention: number;
  todayClasses: string[]; // session ids
  /** availability grid: 7 days × 4 blocks (صبح، ظهر، عصر، شب) — 0 free, 1 booked, 2 unavailable */
  availability: number[][];
  since: string;
  phone: string;
  status: "active" | "absent-tomorrow" | "light-load";
  bio: string;
}

const av = (rows: string[]) => rows.map((r) => r.split("").map(Number));

export const teachers: Teacher[] = [
  {
    id: "t1", name: "سارا احمدی", instrument: "piano", title: "مدرس ارشد پیانو", students: 32, utilization: 94, weeklyHours: 24, contractHours: 26,
    attendanceRate: 97, retention: 93, todayClasses: ["c1", "c6", "c8", "c11"],
    availability: av(["1102", "1112", "1102", "1111", "1102", "0112", "2222"]),
    since: "۱۳۹۸", phone: "۰۹۱۲ ··· ۴۵۱۲", status: "active",
    bio: "فارغ‌التحصیل نوازندگی پیانو · متد سوزوکی و روسی · تمرکز بر کودکان و سطح پیشرفته",
  },
  {
    id: "t2", name: "محمد رضایی", instrument: "guitar", title: "مدرس گیتار کلاسیک و پاپ", students: 28, utilization: 88, weeklyHours: 22, contractHours: 25,
    attendanceRate: 94, retention: 88, todayClasses: ["c2", "c3", "c12"],
    availability: av(["1102", "1102", "1112", "1102", "0102", "1112", "2222"]),
    since: "۱۳۹۹", phone: "۰۹۱۲ ··· ۷۸۳۰", status: "absent-tomorrow",
    bio: "گیتار کلاسیک، فلامنکو و همراهی پاپ · مربی گروه‌نوازی نوجوانان",
  },
  {
    id: "t3", name: "علی موسوی", instrument: "violin", title: "مدرس ویولن", students: 19, utilization: 74, weeklyHours: 17, contractHours: 23,
    attendanceRate: 96, retention: 90, todayClasses: ["c7"],
    availability: av(["0102", "1102", "0112", "1100", "0102", "0002", "2222"]),
    since: "۱۴۰۰", phone: "۰۹۱۲ ··· ۲۲۹۴", status: "active",
    bio: "ویولن کلاسیک و ردیف ایرانی · سرپرست ارکستر نوجوانان آموزشگاه",
  },
  {
    id: "t4", name: "نرگس حسینی", instrument: "voice", title: "مدرس آواز", students: 15, utilization: 68, weeklyHours: 14, contractHours: 20,
    attendanceRate: 92, retention: 86, todayClasses: ["c5", "c13"],
    availability: av(["0112", "0102", "1102", "0110", "0102", "0002", "2222"]),
    since: "۱۴۰۱", phone: "۰۹۱۲ ··· ۵۵۰۷", status: "absent-tomorrow",
    bio: "آواز کلاسیک و پاپ · تکنیک تنفس و صداسازی",
  },
  {
    id: "t5", name: "بهرام نیک‌نژاد", instrument: "theory", title: "مدرس تئوری و سلفژ", students: 24, utilization: 57, weeklyHours: 12, contractHours: 21,
    attendanceRate: 95, retention: 91, todayClasses: ["c4", "c10"],
    availability: av(["0102", "0012", "0102", "1101", "0002", "0002", "2222"]),
    since: "۱۳۹۷", phone: "۰۹۱۲ ··· ۱۱۸۳", status: "light-load",
    bio: "تئوری موسیقی، سلفژ و هارمونی · طراح مسیر آموزشی پایه آموزشگاه",
  },
  {
    id: "t6", name: "کاوه کاظمی", instrument: "drums", title: "مدرس درامز و پرکاشن", students: 16, utilization: 48, weeklyHours: 10, contractHours: 21,
    attendanceRate: 89, retention: 79, todayClasses: ["c9"],
    availability: av(["0002", "0102", "0002", "0100", "0002", "0012", "2222"]),
    since: "۱۴۰۲", phone: "۰۹۱۲ ··· ۹۹۴۱", status: "light-load",
    bio: "درامز، کاخن و پرکاشن · تمرکز بر ریتم‌خوانی و گروه‌نوازی",
  },
  {
    id: "t7", name: "رامین صادقی", instrument: "guitar", title: "مدرس گیتار", students: 12, utilization: 52, weeklyHours: 11, contractHours: 21,
    attendanceRate: 93, retention: 84, todayClasses: [],
    availability: av(["0002", "0002", "0102", "0000", "0002", "0002", "2222"]),
    since: "۱۴۰۲", phone: "۰۹۱۲ ··· ۳۳۷۶", status: "light-load",
    bio: "گیتار الکتریک و پاپ · جایگزین دوره‌ای کلاس‌های گیتار",
  },
  {
    id: "t8", name: "مینا فرهادی", instrument: "violin", title: "مدرس ویولن کودکان", students: 14, utilization: 59, weeklyHours: 12, contractHours: 20,
    attendanceRate: 94, retention: 87, todayClasses: [],
    availability: av(["0102", "0002", "0102", "0010", "0102", "0002", "2222"]),
    since: "۱۴۰۱", phone: "۰۹۱۲ ··· ۶۲۱۹", status: "active",
    bio: "آموزش ویولن به کودکان ۵ تا ۱۰ سال · روش گروهی و بازی‌محور",
  },
];

/* ------------------------------------------------------------------ */
/* Students                                                             */
/* ------------------------------------------------------------------ */
export interface StudentNote {
  by: string;
  date: string;
  text: string;
}
export interface ActivityEntry {
  date: string;
  kind: "session" | "payment" | "note" | "enroll" | "absence" | "message";
  text: string;
}

export interface Student {
  id: string;
  name: string;
  instrument: Instrument;
  teacherId: string;
  level: string;
  levelStep: number; // 1..6
  status: StudentStatus;
  payment: PaymentStatus;
  sessionsUsed: number;
  sessionsTotal: number;
  attendance: number;
  progress: number;
  since: string;
  age: number;
  phone: string;
  guardian?: string;
  nextClass?: { day: string; time: string; room: string };
  lastSeen: string;
  balance: number;
  notes: StudentNote[];
  activity: ActivityEntry[];
  skills: { label: string; value: number }[];
}

const skillSet = (a: number, b: number, c: number, d: number) => [
  { label: "تکنیک", value: a },
  { label: "ریتم", value: b },
  { label: "شنیداری", value: c },
  { label: "اجرا", value: d },
];

export const students: Student[] = [
  {
    id: "st1", name: "سارا محمدی", instrument: "piano", teacherId: "t1", level: "سطح ۳ · میانی", levelStep: 3, status: "at-risk", payment: "due",
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
    skills: skillSet(58, 64, 49, 45),
  },
  {
    id: "st2", name: "امیرحسین کریمی", instrument: "guitar", teacherId: "t2", level: "سطح ۲ · مقدماتی", levelStep: 2, status: "at-risk", payment: "overdue",
    sessionsUsed: 11, sessionsTotal: 12, attendance: 58, progress: 41, since: "آبان ۱۴۰۳", age: 15, phone: "۰۹۱۲ ··· ۸۸۱۴", guardian: "مریم کریمی",
    nextClass: { day: "چهارشنبه", time: "۱۸:۰۰", room: "اتاق ۲" }, lastSeen: "۱۸ روز پیش", balance: 850_000,
    notes: [{ by: "محمد رضایی", date: "۳ هفته پیش", text: "تمرین خانگی انجام نمی‌شود. تماس با خانواده لازم است." }],
    activity: [
      { date: "۱۸ روز پیش", kind: "absence", text: "دومین غیبت متوالی" },
      { date: "۲۵ روز پیش", kind: "session", text: "جلسهٔ ۱۱ از ۱۲ برگزار شد" },
      { date: "۱ ماه پیش", kind: "message", text: "یادآوری پرداخت برای ولی ارسال شد" },
    ],
    skills: skillSet(44, 52, 38, 36),
  },
  {
    id: "st3", name: "نیلوفر رستمی", instrument: "voice", teacherId: "t4", level: "سطح ۱ · پایه", levelStep: 1, status: "at-risk", payment: "paid",
    sessionsUsed: 7, sessionsTotal: 12, attendance: 66, progress: 38, since: "دی ۱۴۰۳", age: 22, phone: "۰۹۱۲ ··· ۵۵۹۰",
    nextClass: { day: "سه‌شنبه", time: "۱۹:۰۰", room: "اتاق ۳" }, lastSeen: "۱۴ روز پیش", balance: 0,
    notes: [{ by: "نرگس حسینی", date: "۱۰ روز پیش", text: "صدای خوبی دارد اما به تمرین تنفس منظم نیاز دارد." }],
    activity: [
      { date: "۱۴ روز پیش", kind: "absence", text: "غیبت با اطلاع قبلی — سفر کاری" },
      { date: "۲۰ روز پیش", kind: "session", text: "جلسهٔ ۷ از ۱۲ برگزار شد" },
    ],
    skills: skillSet(40, 45, 55, 34),
  },
  {
    id: "st4", name: "پارسا نادری", instrument: "violin", teacherId: "t3", level: "سطح ۴ · پیشرفته", levelStep: 4, status: "at-risk", payment: "overdue",
    sessionsUsed: 10, sessionsTotal: 16, attendance: 55, progress: 72, since: "شهریور ۱۴۰۲", age: 19, phone: "۰۹۱۲ ··· ۷۱۶۳",
    nextClass: { day: "شنبه", time: "۱۶:۰۰", room: "اتاق ۱" }, lastSeen: "۲۱ روز پیش", balance: 400_000,
    notes: [{ by: "علی موسوی", date: "۳ هفته پیش", text: "استعداد بالا؛ غیبت‌ها به دلیل تداخل با دانشگاه است. پیشنهاد: انتقال به بازهٔ عصر پنجشنبه." }],
    activity: [
      { date: "۲۱ روز پیش", kind: "absence", text: "سومین غیبت این ماه" },
      { date: "۱ ماه پیش", kind: "session", text: "جلسهٔ ۱۰ از ۱۶ برگزار شد" },
    ],
    skills: skillSet(78, 71, 74, 68),
  },
  {
    id: "st5", name: "مهسا قاسمی", instrument: "piano", teacherId: "t1", level: "سطح ۲ · مقدماتی", levelStep: 2, status: "at-risk", payment: "due",
    sessionsUsed: 10, sessionsTotal: 12, attendance: 64, progress: 47, since: "آذر ۱۴۰۳", age: 13, phone: "۰۹۱۲ ··· ۳۳۰۸", guardian: "حسین قاسمی",
    nextClass: { day: "دوشنبه", time: "۱۳:۰۰", room: "اتاق ۱" }, lastSeen: "۱۶ روز پیش", balance: 600_000,
    notes: [], activity: [{ date: "۱۶ روز پیش", kind: "absence", text: "غیبت بدون اطلاع" }],
    skills: skillSet(50, 56, 44, 42),
  },
  {
    id: "st6", name: "کیان عباسی", instrument: "guitar", teacherId: "t2", level: "سطح ۳ · میانی", levelStep: 3, status: "active", payment: "overdue",
    sessionsUsed: 6, sessionsTotal: 12, attendance: 91, progress: 66, since: "مرداد ۱۴۰۳", age: 24, phone: "۰۹۱۲ ··· ۴۴۲۱",
    nextClass: { day: "سه‌شنبه", time: "۱۸:۰۰", room: "اتاق ۲" }, lastSeen: "دیروز", balance: 400_000,
    notes: [{ by: "محمد رضایی", date: "۱ هفته پیش", text: "آمادهٔ اجرای گروهی در کنسرت فصل است." }],
    activity: [
      { date: "دیروز", kind: "session", text: "جلسهٔ ۶ از ۱۲ برگزار شد" },
      { date: "۳ روز پیش", kind: "note", text: "پیشنهاد شرکت در کنسرت فصل" },
    ],
    skills: skillSet(70, 74, 62, 69),
  },
  {
    id: "st7", name: "آیدا شریفی", instrument: "piano", teacherId: "t1", level: "سطح ۵ · پیشرفته", levelStep: 5, status: "active", payment: "paid",
    sessionsUsed: 4, sessionsTotal: 16, attendance: 98, progress: 88, since: "بهمن ۱۴۰۱", age: 20, phone: "۰۹۱۲ ··· ۱۰۵۵",
    nextClass: { day: "سه‌شنبه", time: "۱۴:۰۰", room: "اتاق ۱" }, lastSeen: "امروز", balance: 0,
    notes: [{ by: "سارا احمدی", date: "۴ روز پیش", text: "آمادهٔ اجرای رسیتال انفرادی؛ رپرتوار شوپن انتخاب شد." }],
    activity: [
      { date: "امروز", kind: "session", text: "جلسهٔ ۴ از ۱۶ برگزار شد" },
      { date: "۱ هفته پیش", kind: "payment", text: "پرداخت شهریه — ۴٬۸۰۰٬۰۰۰ تومان" },
    ],
    skills: skillSet(90, 86, 84, 92),
  },
  {
    id: "st8", name: "رضا شریفی", instrument: "guitar", teacherId: "t7", level: "سطح ۲ · مقدماتی", levelStep: 2, status: "active", payment: "overdue",
    sessionsUsed: 8, sessionsTotal: 12, attendance: 84, progress: 52, since: "مهر ۱۴۰۳", age: 29, phone: "۰۹۱۲ ··· ۹۰۳۴",
    nextClass: { day: "چهارشنبه", time: "۱۹:۰۰", room: "اتاق ۲" }, lastSeen: "۴ روز پیش", balance: 1_200_000,
    notes: [], activity: [{ date: "۴ روز پیش", kind: "session", text: "جلسهٔ ۸ از ۱۲ برگزار شد" }],
    skills: skillSet(55, 60, 48, 50),
  },
  {
    id: "st9", name: "مریم توکلی", instrument: "voice", teacherId: "t4", level: "سطح ۳ · میانی", levelStep: 3, status: "active", payment: "overdue",
    sessionsUsed: 5, sessionsTotal: 12, attendance: 89, progress: 61, since: "آبان ۱۴۰۲", age: 26, phone: "۰۹۱۲ ··· ۶۶۱۲",
    nextClass: { day: "سه‌شنبه", time: "۱۲:۰۰", room: "اتاق ۳" }, lastSeen: "امروز", balance: 850_000,
    notes: [], activity: [{ date: "امروز", kind: "session", text: "جلسهٔ ۵ از ۱۲ برگزار شد" }],
    skills: skillSet(64, 58, 72, 66),
  },
  {
    id: "st10", name: "سهیل مرادی", instrument: "drums", teacherId: "t6", level: "سطح ۱ · پایه", levelStep: 1, status: "active", payment: "paid",
    sessionsUsed: 3, sessionsTotal: 12, attendance: 95, progress: 29, since: "اسفند ۱۴۰۴", age: 12, phone: "۰۹۱۲ ··· ۲۷۴۸", guardian: "لیلا مرادی",
    nextClass: { day: "پنجشنبه", time: "۱۵:۳۰", room: "اتاق ۴" }, lastSeen: "۲ روز پیش", balance: 0,
    notes: [], activity: [{ date: "۲ روز پیش", kind: "enroll", text: "ثبت‌نام در دورهٔ درامز مقدماتی" }],
    skills: skillSet(30, 46, 28, 25),
  },
  {
    id: "st11", name: "زهرا اکبری", instrument: "violin", teacherId: "t8", level: "سطح ۲ · مقدماتی", levelStep: 2, status: "active", payment: "paid",
    sessionsUsed: 7, sessionsTotal: 12, attendance: 93, progress: 58, since: "دی ۱۴۰۳", age: 9, phone: "۰۹۱۲ ··· ۵۱۹۹", guardian: "نازنین اکبری",
    nextClass: { day: "یکشنبه", time: "۱۶:۰۰", room: "اتاق ۱" }, lastSeen: "۳ روز پیش", balance: 0,
    notes: [{ by: "مینا فرهادی", date: "۵ روز پیش", text: "پیشرفت خوب در کوک‌کردن گوشی؛ والدین همراهی خوبی دارند." }],
    activity: [{ date: "۳ روز پیش", kind: "session", text: "جلسهٔ ۷ از ۱۲ برگزار شد" }],
    skills: skillSet(56, 62, 66, 52),
  },
  {
    id: "st12", name: "بهنام یوسفی", instrument: "theory", teacherId: "t5", level: "سطح ۲ · مقدماتی", levelStep: 2, status: "active", payment: "due",
    sessionsUsed: 6, sessionsTotal: 10, attendance: 87, progress: 63, since: "آذر ۱۴۰۳", age: 31, phone: "۰۹۱۲ ··· ۸۳۲۰",
    nextClass: { day: "سه‌شنبه", time: "۱۱:۰۰", room: "اتاق ۳" }, lastSeen: "امروز", balance: 450_000,
    notes: [], activity: [{ date: "امروز", kind: "session", text: "جلسهٔ ۶ از ۱۰ برگزار شد" }],
    skills: skillSet(60, 70, 68, 44),
  },
  {
    id: "st13", name: "الناز کریمی", instrument: "piano", teacherId: "t1", level: "سطح ۱ · پایه", levelStep: 1, status: "paused", payment: "paid",
    sessionsUsed: 5, sessionsTotal: 12, attendance: 80, progress: 33, since: "بهمن ۱۴۰۳", age: 11, phone: "۰۹۱۲ ··· ۴۷۷۱", guardian: "سعید کریمی",
    lastSeen: "۱ ماه پیش", balance: 0,
    notes: [{ by: "پذیرش", date: "۱ ماه پیش", text: "توقف موقت به دلیل امتحانات مدرسه؛ بازگشت در اردیبهشت." }],
    activity: [{ date: "۱ ماه پیش", kind: "note", text: "درخواست توقف موقت ثبت شد" }],
    skills: skillSet(38, 42, 40, 30),
  },
  {
    id: "st14", name: "فرزاد بهرامی", instrument: "guitar", teacherId: "t7", level: "—", levelStep: 0, status: "waitlist", payment: "due",
    sessionsUsed: 0, sessionsTotal: 0, attendance: 0, progress: 0, since: "این هفته", age: 27, phone: "۰۹۱۲ ··· ۳۹۰۵",
    lastSeen: "—", balance: 0,
    notes: [{ by: "پذیرش", date: "۲ روز پیش", text: "در انتظار بازهٔ عصر سه‌شنبه؛ تماس گرفته شود." }],
    activity: [{ date: "۲ روز پیش", kind: "enroll", text: "افزوده شدن به لیست انتظار گیتار" }],
    skills: skillSet(0, 0, 0, 0),
  },
  {
    id: "st15", name: "شیوا نعمتی", instrument: "voice", teacherId: "t4", level: "—", levelStep: 0, status: "waitlist", payment: "due",
    sessionsUsed: 0, sessionsTotal: 0, attendance: 0, progress: 0, since: "این هفته", age: 23, phone: "۰۹۱۲ ··· ۱۴۶۰",
    lastSeen: "—", balance: 0, notes: [], activity: [{ date: "۴ روز پیش", kind: "enroll", text: "افزوده شدن به لیست انتظار آواز" }],
    skills: skillSet(0, 0, 0, 0),
  },
];

export const studentById = (id: string) => students.find((s) => s.id === id);
export const teacherById = (id: string) => teachers.find((t) => t.id === id);

export const studentStats = {
  total: 1248,
  active: 1186,
  atRisk: students.filter((s) => s.status === "at-risk").length,
  waitlist: students.filter((s) => s.status === "waitlist").length,
  newThisMonth: 48,
};

/* ------------------------------------------------------------------ */
/* Classes                                                              */
/* ------------------------------------------------------------------ */
export interface AcademyClass {
  id: string;
  title: string;
  instrument: Instrument;
  teacherId: string;
  roomId: string;
  kind: "private" | "group";
  level: string;
  days: number[];
  time: string;
  duration: number;
  enrolled: number;
  capacity: number;
  attendanceAvg: number;
  waitlist: number;
  tuition: number;
  termProgress: number;
  studentIds: string[];
}

export const classes: AcademyClass[] = [
  { id: "cl1", title: "پیانو گروهی · میانی", instrument: "piano", teacherId: "t1", roomId: "r1", kind: "group", level: "سطح ۳", days: [3, 5], time: "17:00", duration: 90, enrolled: 5, capacity: 6, attendanceAvg: 94, waitlist: 4, tuition: 3_600_000, termProgress: 68, studentIds: ["st1", "st5", "st7", "st13", "st11"] },
  { id: "cl2", title: "پیانو انفرادی · پیشرفته", instrument: "piano", teacherId: "t1", roomId: "r1", kind: "private", level: "سطح ۵", days: [3], time: "14:00", duration: 60, enrolled: 1, capacity: 1, attendanceAvg: 98, waitlist: 0, tuition: 4_800_000, termProgress: 44, studentIds: ["st7"] },
  { id: "cl3", title: "گیتار مقدماتی", instrument: "guitar", teacherId: "t2", roomId: "r2", kind: "group", level: "سطح ۱–۲", days: [0, 3], time: "09:30", duration: 60, enrolled: 4, capacity: 5, attendanceAvg: 88, waitlist: 2, tuition: 2_800_000, termProgress: 72, studentIds: ["st2", "st8", "st6"] },
  { id: "cl4", title: "گیتار · نوجوانان", instrument: "guitar", teacherId: "t2", roomId: "r2", kind: "group", level: "سطح ۳", days: [3, 6], time: "18:00", duration: 60, enrolled: 4, capacity: 6, attendanceAvg: 91, waitlist: 0, tuition: 3_200_000, termProgress: 60, studentIds: ["st6", "st8"] },
  { id: "cl5", title: "آواز · تکنیک صدا", instrument: "voice", teacherId: "t4", roomId: "r3", kind: "group", level: "سطح ۲–۳", days: [3], time: "12:00", duration: 60, enrolled: 3, capacity: 4, attendanceAvg: 90, waitlist: 3, tuition: 3_400_000, termProgress: 55, studentIds: ["st3", "st9"] },
  { id: "cl6", title: "ویولن · کودکان", instrument: "violin", teacherId: "t8", roomId: "r1", kind: "group", level: "سطح ۱", days: [1, 4], time: "16:00", duration: 45, enrolled: 6, capacity: 8, attendanceAvg: 93, waitlist: 0, tuition: 2_600_000, termProgress: 50, studentIds: ["st11"] },
  { id: "cl7", title: "ویولن انفرادی", instrument: "violin", teacherId: "t3", roomId: "r1", kind: "private", level: "سطح ۴", days: [3], time: "14:00", duration: 60, enrolled: 1, capacity: 1, attendanceAvg: 86, waitlist: 0, tuition: 4_200_000, termProgress: 62, studentIds: ["st4"] },
  { id: "cl8", title: "تئوری موسیقی · پایه", instrument: "theory", teacherId: "t5", roomId: "r3", kind: "group", level: "سطح ۱–۲", days: [3], time: "11:00", duration: 60, enrolled: 8, capacity: 10, attendanceAvg: 92, waitlist: 0, tuition: 1_800_000, termProgress: 65, studentIds: ["st12"] },
  { id: "cl9", title: "سلفژ و تربیت شنوایی", instrument: "theory", teacherId: "t5", roomId: "r3", kind: "group", level: "سطح ۲", days: [3, 6], time: "16:00", duration: 60, enrolled: 6, capacity: 10, attendanceAvg: 89, waitlist: 0, tuition: 1_800_000, termProgress: 58, studentIds: ["st12"] },
  { id: "cl10", title: "درامز مقدماتی", instrument: "drums", teacherId: "t6", roomId: "r4", kind: "group", level: "سطح ۱", days: [3, 5], time: "15:30", duration: 60, enrolled: 2, capacity: 3, attendanceAvg: 84, waitlist: 0, tuition: 3_000_000, termProgress: 40, studentIds: ["st10"] },
];

export const classById = (id: string) => classes.find((c) => c.id === id);

/* ------------------------------------------------------------------ */
/* Weekly schedule grid                                                 */
/* ------------------------------------------------------------------ */
export interface GridSession {
  id: string;
  classId: string;
  day: number;
  start: string;
  end: string;
  roomId: string;
  teacherId: string;
  conflictWith?: string;
  cancelled?: boolean;
}

export const weekSessions: GridSession[] = [
  { id: "g1", classId: "cl3", day: 0, start: "09:30", end: "10:30", roomId: "r2", teacherId: "t2" },
  { id: "g2", classId: "cl7", day: 0, start: "16:00", end: "17:00", roomId: "r1", teacherId: "t3" },
  { id: "g3", classId: "cl6", day: 1, start: "16:00", end: "16:45", roomId: "r1", teacherId: "t8" },
  { id: "g4", classId: "cl4", day: 1, start: "18:00", end: "19:00", roomId: "r2", teacherId: "t2" },
  { id: "g5", classId: "cl1", day: 2, start: "13:00", end: "14:00", roomId: "r1", teacherId: "t1" },
  { id: "g6", classId: "cl9", day: 2, start: "16:00", end: "17:00", roomId: "r3", teacherId: "t5" },
  // Tuesday — today
  { id: "g7", classId: "cl2", day: 3, start: "09:00", end: "10:00", roomId: "r1", teacherId: "t1" },
  { id: "g8", classId: "cl3", day: 3, start: "09:30", end: "10:30", roomId: "r2", teacherId: "t2" },
  { id: "g9", classId: "cl8", day: 3, start: "11:00", end: "12:00", roomId: "r3", teacherId: "t5" },
  { id: "g10", classId: "cl5", day: 3, start: "12:00", end: "13:00", roomId: "r3", teacherId: "t4" },
  { id: "g11", classId: "cl7", day: 3, start: "14:00", end: "15:00", roomId: "r1", teacherId: "t3", conflictWith: "g12" },
  { id: "g12", classId: "cl2", day: 3, start: "14:00", end: "15:00", roomId: "r1", teacherId: "t1", conflictWith: "g11" },
  { id: "g13", classId: "cl10", day: 3, start: "15:30", end: "16:30", roomId: "r4", teacherId: "t6", cancelled: true },
  { id: "g14", classId: "cl9", day: 3, start: "16:00", end: "17:00", roomId: "r3", teacherId: "t5" },
  { id: "g15", classId: "cl1", day: 3, start: "17:00", end: "18:30", roomId: "r1", teacherId: "t1" },
  { id: "g16", classId: "cl4", day: 3, start: "18:00", end: "19:00", roomId: "r2", teacherId: "t2" },
  { id: "g17", classId: "cl5", day: 3, start: "19:00", end: "20:00", roomId: "r3", teacherId: "t4" },
  // Wednesday
  { id: "g18", classId: "cl6", day: 4, start: "16:00", end: "16:45", roomId: "r1", teacherId: "t8" },
  { id: "g19", classId: "cl4", day: 4, start: "18:00", end: "19:00", roomId: "r2", teacherId: "t2" },
  { id: "g20", classId: "cl3", day: 4, start: "19:00", end: "20:00", roomId: "r2", teacherId: "t7" },
  // Thursday
  { id: "g21", classId: "cl10", day: 5, start: "15:30", end: "16:30", roomId: "r4", teacherId: "t6" },
  { id: "g22", classId: "cl1", day: 5, start: "17:00", end: "18:30", roomId: "r1", teacherId: "t1" },
  { id: "g23", classId: "cl8", day: 5, start: "11:00", end: "12:00", roomId: "r3", teacherId: "t5" },
  // Friday
  { id: "g24", classId: "cl9", day: 6, start: "10:00", end: "11:00", roomId: "r3", teacherId: "t5" },
  { id: "g25", classId: "cl4", day: 6, start: "11:00", end: "12:00", roomId: "r2", teacherId: "t2" },
];

/* ------------------------------------------------------------------ */
/* Attendance                                                           */
/* ------------------------------------------------------------------ */
export type AttendanceMark = "present" | "absent" | "late" | "excused" | null;
export const attendanceLabel: Record<Exclude<AttendanceMark, null>, string> = {
  present: "حاضر",
  absent: "غایب",
  late: "تأخیر",
  excused: "موجه",
};

export interface AttendanceRoster {
  sessionId: string;
  classId: string;
  time: string;
  state: "recorded" | "pending" | "in-progress" | "cancelled";
  recordedBy?: string;
  entries: { studentId: string; mark: AttendanceMark }[];
}

export const todayAttendance: AttendanceRoster[] = [
  { sessionId: "g7", classId: "cl2", time: "09:00", state: "recorded", recordedBy: "سارا احمدی", entries: [{ studentId: "st7", mark: "present" }] },
  { sessionId: "g8", classId: "cl3", time: "09:30", state: "recorded", recordedBy: "محمد رضایی", entries: [{ studentId: "st2", mark: "absent" }, { studentId: "st8", mark: "present" }, { studentId: "st6", mark: "late" }] },
  { sessionId: "g9", classId: "cl8", time: "11:00", state: "recorded", recordedBy: "بهرام نیک‌نژاد", entries: [{ studentId: "st12", mark: "present" }] },
  { sessionId: "g10", classId: "cl5", time: "12:00", state: "in-progress", entries: [{ studentId: "st3", mark: null }, { studentId: "st9", mark: "present" }] },
  { sessionId: "g11", classId: "cl7", time: "14:00", state: "pending", entries: [{ studentId: "st4", mark: null }] },
  { sessionId: "g14", classId: "cl9", time: "16:00", state: "pending", entries: [{ studentId: "st12", mark: null }] },
  { sessionId: "g15", classId: "cl1", time: "17:00", state: "pending", entries: [{ studentId: "st1", mark: null }, { studentId: "st5", mark: null }, { studentId: "st7", mark: null }, { studentId: "st11", mark: null }, { studentId: "st13", mark: null }] },
  { sessionId: "g13", classId: "cl10", time: "15:30", state: "cancelled", entries: [] },
];

export const attendanceTrend = [
  { label: "۴ هفته پیش", value: 88 },
  { label: "۳ هفته پیش", value: 90 },
  { label: "۲ هفته پیش", value: 91 },
  { label: "هفتهٔ گذشته", value: 93 },
  { label: "این هفته", value: 92 },
];

export const attendanceByDay = [
  { day: "شنبه", present: 42, absent: 4, late: 2 },
  { day: "یکشنبه", present: 48, absent: 3, late: 3 },
  { day: "دوشنبه", present: 45, absent: 5, late: 1 },
  { day: "سه‌شنبه", present: 51, absent: 4, late: 2 },
  { day: "چهارشنبه", present: 47, absent: 6, late: 2 },
  { day: "پنجشنبه", present: 39, absent: 3, late: 1 },
];

/* ------------------------------------------------------------------ */
/* Finance                                                              */
/* ------------------------------------------------------------------ */
export interface Invoice {
  id: string;
  studentId: string;
  amount: number;
  issued: string;
  due: string;
  status: PaymentStatus;
  overdueDays?: number;
  term: string;
  method?: string;
}

export const invoices: Invoice[] = [
  { id: "INV-1042", studentId: "st8", amount: 1_200_000, issued: "۱۴۰۴/۱۲/۰۲", due: "۱۴۰۴/۱۲/۰۷", status: "overdue", overdueDays: 12, term: "دورهٔ زمستان" },
  { id: "INV-1038", studentId: "st9", amount: 850_000, issued: "۱۴۰۴/۱۲/۰۴", due: "۱۴۰۴/۱۲/۱۰", status: "overdue", overdueDays: 9, term: "دورهٔ زمستان" },
  { id: "INV-1051", studentId: "st6", amount: 400_000, issued: "۱۴۰۴/۱۲/۱۰", due: "۱۴۰۴/۱۲/۱۶", status: "overdue", overdueDays: 3, term: "جلسات جبرانی" },
  { id: "INV-1064", studentId: "st1", amount: 1_200_000, issued: "۱۴۰۴/۱۲/۱۵", due: "۱۴۰۴/۱۲/۲۵", status: "due", term: "دورهٔ زمستان" },
  { id: "INV-1065", studentId: "st5", amount: 600_000, issued: "۱۴۰۴/۱۲/۱۵", due: "۱۴۰۴/۱۲/۲۵", status: "due", term: "نیم‌دوره" },
  { id: "INV-1066", studentId: "st12", amount: 450_000, issued: "۱۴۰۴/۱۲/۱۶", due: "۱۴۰۴/۱۲/۲۶", status: "due", term: "تئوری · پایه" },
  { id: "INV-1058", studentId: "st7", amount: 4_800_000, issued: "۱۴۰۴/۱۲/۰۸", due: "۱۴۰۴/۱۲/۱۵", status: "paid", term: "دورهٔ زمستان", method: "درگاه آنلاین" },
  { id: "INV-1059", studentId: "st11", amount: 2_600_000, issued: "۱۴۰۴/۱۲/۰۸", due: "۱۴۰۴/۱۲/۱۵", status: "paid", term: "ویولن کودکان", method: "کارت‌خوان" },
  { id: "INV-1060", studentId: "st10", amount: 3_000_000, issued: "۱۴۰۴/۱۲/۰۹", due: "۱۴۰۴/۱۲/۱۶", status: "paid", term: "درامز مقدماتی", method: "انتقال بانکی" },
  { id: "INV-1061", studentId: "st3", amount: 3_400_000, issued: "۱۴۰۴/۱۲/۱۱", due: "۱۴۰۴/۱۲/۱۸", status: "paid", term: "آواز · تکنیک", method: "درگاه آنلاین" },
];

export const payments = [
  { id: "p1", studentId: "st7", amount: 4_800_000, when: "امروز · ۰۹:۴۲", method: "درگاه آنلاین" },
  { id: "p2", studentId: "st10", amount: 3_000_000, when: "امروز · ۰۸:۱۵", method: "انتقال بانکی" },
  { id: "p3", studentId: "st11", amount: 2_600_000, when: "دیروز · ۱۸:۳۰", method: "کارت‌خوان" },
  { id: "p4", studentId: "st3", amount: 3_400_000, when: "دیروز · ۱۲:۰۵", method: "درگاه آنلاین" },
  { id: "p5", studentId: "st12", amount: 900_000, when: "۲ روز پیش", method: "کارت‌خوان" },
];

export const financeKpis = {
  monthRevenue: 125_430_000,
  monthTarget: 142_000_000,
  collected: 88,
  outstanding: 3_450_000,
  overdue: 2_450_000,
  avgTuition: 3_180_000,
  activeSubscriptions: 412,
};

export const revenueByStream = [
  { label: "شهریهٔ دوره‌ای", value: 78, amount: 97_800_000 },
  { label: "کلاس‌های خصوصی", value: 14, amount: 17_560_000 },
  { label: "جلسات جبرانی", value: 5, amount: 6_270_000 },
  { label: "اجارهٔ اتاق تمرین", value: 3, amount: 3_800_000 },
];

/* ------------------------------------------------------------------ */
/* Messages                                                             */
/* ------------------------------------------------------------------ */
export interface Conversation {
  id: string;
  name: string;
  role: "student" | "teacher" | "guardian" | "group";
  topic: string;
  unread: number;
  last: string;
  when: string;
  pinned?: boolean;
  messages: { from: "me" | "them"; text: string; when: string }[];
}

export const conversations: Conversation[] = [
  {
    id: "m1", name: "محمد رضایی", role: "teacher", topic: "غیبت فردا", unread: 2, last: "فردا نمی‌توانم کلاس‌ها را برگزار کنم…", when: "۱۰:۳۲", pinned: true,
    messages: [
      { from: "them", text: "سلام. متأسفانه فردا به دلیل مشکل خانوادگی نمی‌توانم کلاس‌ها را برگزار کنم.", when: "۱۰:۲۸" },
      { from: "them", text: "سه کلاس گیتار دارم؛ اگر امکان جایگزینی هست لطفاً هماهنگ کنید.", when: "۱۰:۳۲" },
    ],
  },
  {
    id: "m2", name: "هنرجویان در معرض ریزش", role: "group", topic: "کمپین بازگشت · ۵ نفر", unread: 0, last: "پیام یادآوری ارسال شد", when: "دیروز",
    messages: [
      { from: "me", text: "سلام. جای شما در کلاس خالی است 🎵 اگر برنامه‌تان تغییر کرده، می‌توانیم بازهٔ جدیدی برایتان در نظر بگیریم.", when: "دیروز · ۱۶:۱۰" },
    ],
  },
  {
    id: "m3", name: "مریم کریمی", role: "guardian", topic: "ولی امیرحسین کریمی", unread: 1, last: "درباره‌ی شهریه صحبت کنیم؟", when: "دیروز",
    messages: [
      { from: "them", text: "سلام. امکان تقسیط شهریه‌ی این دوره وجود دارد؟", when: "دیروز · ۱۹:۴۴" },
    ],
  },
  {
    id: "m4", name: "آیدا شریفی", role: "student", topic: "رسیتال فصل", unread: 0, last: "ممنون! رپرتوار را آماده می‌کنم.", when: "۲ روز پیش",
    messages: [
      { from: "me", text: "اجرای شما برای رسیتال فصل تأیید شد. تاریخ: ۲۸ اسفند، سالن اصلی.", when: "۲ روز پیش · ۱۱:۰۰" },
      { from: "them", text: "ممنون! رپرتوار را آماده می‌کنم.", when: "۲ روز پیش · ۱۱:۱۴" },
    ],
  },
  {
    id: "m5", name: "سارا احمدی", role: "teacher", topic: "ظرفیت پیانو سه‌شنبه", unread: 0, last: "لیست انتظار ۴ نفر شده است.", when: "۳ روز پیش",
    messages: [{ from: "them", text: "لیست انتظار پیانو سه‌شنبه به ۴ نفر رسیده. اگر اتاق ۴ آزاد است می‌توانم یک بازهٔ دیگر بردارم.", when: "۳ روز پیش" }],
  },
];

export const messageTemplates = [
  { id: "tpl1", label: "یادآوری پرداخت", text: "سلام. یادآوری می‌کنیم شهریهٔ دورهٔ جاری تا تاریخ … قابل پرداخت است." },
  { id: "tpl2", label: "کلاس جبرانی", text: "سلام. جلسهٔ جبرانی شما در تاریخ … ساعت … در … برگزار می‌شود." },
  { id: "tpl3", label: "لغو کلاس", text: "با عرض پوزش، کلاس امروز به دلیل … لغو شد. جلسهٔ جبرانی هماهنگ خواهد شد." },
  { id: "tpl4", label: "خوش‌آمدگویی", text: "به آکادمی موسیقی آوا خوش آمدید 🎵 اولین جلسهٔ شما …" },
];

/* ------------------------------------------------------------------ */
/* Library                                                              */
/* ------------------------------------------------------------------ */
export type ResourceKind = "sheet" | "audio" | "video" | "doc";
export const resourceKindLabel: Record<ResourceKind, string> = { sheet: "نت", audio: "صوت", video: "ویدیو", doc: "جزوه" };

export interface Resource {
  id: string;
  title: string;
  composer: string;
  kind: ResourceKind;
  instrument: Instrument;
  level: string;
  size: string;
  duration?: string;
  pages?: number;
  added: string;
  uses: number;
  /** normalized waveform peaks, only for audio */
  peaks?: number[];
}

const peaks = (seed: number) => Array.from({ length: 40 }, (_, i) => 0.25 + Math.abs(Math.sin(i * seed)) * 0.75);

export const resources: Resource[] = [
  { id: "res1", title: "نوکتورن اپوس ۹ شمارهٔ ۲", composer: "شوپن", kind: "sheet", instrument: "piano", level: "پیشرفته", size: "۱٫۲ مگابایت", pages: 6, added: "۳ روز پیش", uses: 42 },
  { id: "res2", title: "متد پیانو کودکان · دفتر اول", composer: "آموزشگاه آوا", kind: "sheet", instrument: "piano", level: "پایه", size: "۴٫۸ مگابایت", pages: 48, added: "۱ هفته پیش", uses: 128 },
  { id: "res3", title: "تمرین‌های آرپژ گیتار", composer: "کارکاسی", kind: "sheet", instrument: "guitar", level: "میانی", size: "۹۰۰ کیلوبایت", pages: 12, added: "۲ هفته پیش", uses: 76 },
  { id: "res4", title: "الگوهای ریتمیک ۶/۸", composer: "کاوه کاظمی", kind: "audio", instrument: "drums", level: "پایه", size: "۸٫۴ مگابایت", duration: "۴:۱۲", added: "۴ روز پیش", uses: 31, peaks: peaks(0.7) },
  { id: "res5", title: "تمرین صداسازی · گرم‌کردن", composer: "نرگس حسینی", kind: "audio", instrument: "voice", level: "پایه", size: "۱۲٫۱ مگابایت", duration: "۶:۳۰", added: "۵ روز پیش", uses: 58, peaks: peaks(0.42) },
  { id: "res6", title: "درس ۳ · کوک و وضعیت دست", composer: "مینا فرهادی", kind: "video", instrument: "violin", level: "پایه", size: "۱۴۸ مگابایت", duration: "۱۱:۰۵", added: "۱ هفته پیش", uses: 64 },
  { id: "res7", title: "ردیف میرزا عبدالله · درآمد", composer: "روایت نورعلی برومند", kind: "audio", instrument: "violin", level: "پیشرفته", size: "۱۸٫۶ مگابایت", duration: "۹:۴۴", added: "۲ هفته پیش", uses: 23, peaks: peaks(0.9) },
  { id: "res8", title: "جزوهٔ تئوری · فواصل و گام‌ها", composer: "بهرام نیک‌نژاد", kind: "doc", instrument: "theory", level: "پایه", size: "۲٫۳ مگابایت", pages: 24, added: "۳ هفته پیش", uses: 156 },
  { id: "res9", title: "دیکتهٔ ملودیک · مجموعهٔ ۱", composer: "بهرام نیک‌نژاد", kind: "audio", instrument: "theory", level: "میانی", size: "۲۲٫۰ مگابایت", duration: "۱۵:۲۰", added: "۱ ماه پیش", uses: 89, peaks: peaks(0.55) },
  { id: "res10", title: "پرلود شمارهٔ ۱ · باخ", composer: "ی. س. باخ", kind: "sheet", instrument: "piano", level: "میانی", size: "۷۴۰ کیلوبایت", pages: 4, added: "۱ ماه پیش", uses: 97 },
  { id: "res11", title: "آکوردهای پایهٔ پاپ", composer: "محمد رضایی", kind: "doc", instrument: "guitar", level: "پایه", size: "۱٫۱ مگابایت", pages: 9, added: "۱ ماه پیش", uses: 203 },
  { id: "res12", title: "اجرای نمونه · کنسرت پاییز", composer: "ارکستر نوجوانان آوا", kind: "video", instrument: "violin", level: "همه", size: "۳۲۰ مگابایت", duration: "۲۴:۵۰", added: "۲ ماه پیش", uses: 45 },
];

export const libraryShelves = [
  { id: "sh1", label: "نت‌های پیانو", kind: "sheet" as ResourceKind, instrument: "piano" as Instrument, count: 86 },
  { id: "sh2", label: "متدهای پایه", kind: "doc" as ResourceKind, instrument: "theory" as Instrument, count: 34 },
  { id: "sh3", label: "نمونه‌های شنیداری", kind: "audio" as ResourceKind, instrument: "voice" as Instrument, count: 52 },
  { id: "sh4", label: "ویدیوهای آموزشی", kind: "video" as ResourceKind, instrument: "violin" as Instrument, count: 28 },
];

/* ------------------------------------------------------------------ */
/* Reports — narrative analytics                                        */
/* ------------------------------------------------------------------ */
export interface ReportDef {
  id: string;
  title: string;
  question: string;
  period: string;
  headline: string;
  delta: number;
  finding: string;
  evidence: { label: string; value: string }[];
}

export const reportCatalog: ReportDef[] = [
  {
    id: "rp1", title: "روند ثبت‌نام", question: "چرا رشد هنرجویان شتاب گرفته است؟", period: "۶ ماه گذشته",
    headline: "۱٬۲۴۸ هنرجوی فعال", delta: 18.6,
    finding: "۶۴٪ ثبت‌نام‌های جدید از معرفی هنرجویان فعلی آمده‌اند — بیشترین سهم از کلاس‌های گروهی پیانو.",
    evidence: [
      { label: "معرفی هنرجویان", value: "۶۴٪" },
      { label: "شبکه‌های اجتماعی", value: "۲۱٪" },
      { label: "مراجعهٔ حضوری", value: "۱۵٪" },
    ],
  },
  {
    id: "rp2", title: "ماندگاری هنرجویان", question: "چه کسانی می‌مانند و چرا؟", period: "۱۲ ماه گذشته",
    headline: "۹۱٫۴٪ نرخ ماندگاری", delta: 4.2,
    finding: "هنرجویان کلاس‌های گروهی ۲٫۳ برابر بیشتر از کلاس‌های خصوصی تمدید می‌کنند.",
    evidence: [
      { label: "ماندگاری کلاس گروهی", value: "۹۴٪" },
      { label: "ماندگاری کلاس خصوصی", value: "۸۶٪" },
      { label: "ریزش در ۳ ماه اول", value: "۷٪" },
    ],
  },
  {
    id: "rp3", title: "بار کاری مدرسین", question: "ظرفیت کجا هدر می‌رود؟", period: "این ماه",
    headline: "۷۹٪ بهره‌وری میانگین", delta: 11,
    finding: "۴ مدرس زیر ۶۰٪ ظرفیت هستند؛ هم‌زمان ۹ نفر در لیست انتظار پیانو و گیتار قرار دارند.",
    evidence: [
      { label: "ظرفیت بلااستفاده", value: "۲۶ ساعت/هفته" },
      { label: "لیست انتظار", value: "۹ نفر" },
      { label: "درآمد بالقوه", value: "۹٫۶ میلیون/ماه" },
    ],
  },
  {
    id: "rp4", title: "اشغال کلاس و اتاق", question: "کدام بازه‌ها گلوگاه هستند؟", period: "این هفته",
    headline: "۸۲٪ اشغال میانگین", delta: 3.4,
    finding: "سه‌شنبه عصر به ۹۱٪ رسیده در حالی که اتاق ۴ در همان بازه ۵۸٪ خالی است.",
    evidence: [
      { label: "اوج · سه‌شنبه ۱۶–۱۹", value: "۹۱٪" },
      { label: "کف · جمعه", value: "۴۲٪" },
      { label: "اتاق کم‌استفاده", value: "اتاق ۴" },
    ],
  },
  {
    id: "rp5", title: "روند درآمد", question: "رشد درآمد از کجا می‌آید؟", period: "۶ ماه گذشته",
    headline: "۱۲۵٫۴ میلیون تومان", delta: 6.2,
    finding: "۷۸٪ درآمد از شهریهٔ دوره‌ای است؛ رشد اصلی از افزایش نرخ تمدید آمده نه از افزایش قیمت.",
    evidence: [
      { label: "شهریهٔ دوره‌ای", value: "۷۸٪" },
      { label: "نرخ تمدید", value: "۸۹٪" },
      { label: "وصول تا امروز", value: "۸۸٪" },
    ],
  },
  {
    id: "rp6", title: "محبوبیت سازها", question: "تقاضا به کدام سمت می‌رود؟", period: "فصل جاری",
    headline: "پیانو ۴۲٪ سهم", delta: 3,
    finding: "آواز سریع‌ترین رشد فصل را دارد (+۲ واحد سهم) و ظرفیت فعلی پاسخگوی لیست انتظار نیست.",
    evidence: [
      { label: "پیانو", value: "۵۲۴ نفر" },
      { label: "گیتار", value: "۳۱۲ نفر" },
      { label: "رشد آواز", value: "+۲ واحد" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Intelligence — Signal → Evidence → Insight → Action                  */
/* ------------------------------------------------------------------ */
export interface IntelligenceCard {
  id: string;
  kind: "trend" | "risk" | "idea";
  signal: string;
  evidence: { label: string; value: string }[];
  insight: string;
  action: { label: string; target: Target };
  confidence: "بالا" | "متوسط";
  source: string;
}

export const intelligenceCards: IntelligenceCard[] = [
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

/* ------------------------------------------------------------------ */
/* Extended attention queue                                             */
/* ------------------------------------------------------------------ */
export interface AttentionRecord {
  id: string;
  severity: Severity;
  category: "مالی" | "هنرجو" | "برنامه" | "مدرس" | "عملیات";
  what: string;
  why: string;
  action: string;
  target: Target;
  age: string;
}

export const attentionQueue: AttentionRecord[] = [
  { id: "aq1", severity: "critical", category: "مالی", what: "۳ فاکتور سررسید گذشته", why: "۲٬۴۵۰٬۰۰۰ تومان معوق · قدیمی‌ترین ۱۲ روز", action: "پیگیری پرداخت", target: { view: "finance", filter: "overdue" }, age: "۱۲ روز" },
  { id: "aq2", severity: "warning", category: "هنرجو", what: "۵ هنرجو در معرض ریزش", why: "بیش از دو هفته غیبت متوالی · همگی جلسهٔ باقی‌مانده دارند", action: "مشاهده و تماس", target: { view: "students", filter: "at-risk" }, age: "۲ هفته" },
  { id: "aq3", severity: "warning", category: "برنامه", what: "تعارض اتاق در ساعت ۱۴:۰۰", why: "ویولن و پیانو پیشرفته هم‌زمان در اتاق ۱ ثبت شده‌اند", action: "حل تعارض", target: { view: "schedule", filter: "conflict" }, age: "امروز" },
  { id: "aq4", severity: "warning", category: "مدرس", what: "غیبت ۲ مدرس در فردا", why: "۵ کلاس بدون مدرس · ۱ کلاس هنوز جایگزین ندارد", action: "تعیین جایگزین", target: { view: "teachers", filter: "absent-tomorrow" }, age: "فردا" },
  { id: "aq5", severity: "info", category: "عملیات", what: "۳ کلاس امروز حضور و غیاب ثبت‌نشده", why: "ثبت دیرهنگام دقت گزارش حضور را کاهش می‌دهد", action: "ثبت حضور", target: { view: "attendance", filter: "pending" }, age: "امروز" },
  { id: "aq6", severity: "info", category: "هنرجو", what: "۲ نفر در لیست انتظار بدون تماس", why: "بیش از ۴۸ ساعت از ثبت درخواست گذشته است", action: "تماس با لیست انتظار", target: { view: "students", filter: "waitlist" }, age: "۲ روز" },
];

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */
export const settingsSections = [
  { id: "profile", label: "پروفایل آموزشگاه", hint: "نام، نشانی، ساعات کاری" },
  { id: "users", label: "کاربران و دسترسی", hint: "۱۲ کاربر · ۴ نقش" },
  { id: "appearance", label: "ظاهر", hint: "تم، تراکم، حرکت" },
  { id: "notifications", label: "اعلان‌ها", hint: "کانال‌ها و رویدادها" },
  { id: "localization", label: "بومی‌سازی", hint: "زبان، تقویم، واحد پول" },
  { id: "operations", label: "عملیات آموزشگاه", hint: "اتاق‌ها، دوره‌ها، قواعد جلسه" },
] as const;

export const accessRoles = [
  { id: "role1", label: "مدیر ارشد", members: 2, scope: "دسترسی کامل به همهٔ بخش‌ها" },
  { id: "role2", label: "پذیرش", members: 4, scope: "هنرجویان، برنامه‌ریزی، پیام‌ها" },
  { id: "role3", label: "مدرس", members: 5, scope: "کلاس‌های خود، حضور و غیاب، کتابخانه" },
  { id: "role4", label: "مالی", members: 1, scope: "فاکتورها، پرداخت‌ها، گزارش مالی" },
];
