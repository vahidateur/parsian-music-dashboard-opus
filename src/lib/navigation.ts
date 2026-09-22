/* ------------------------------------------------------------------ */
/* Navigation / chrome identity (M10)                                   */
/*                                                                      */
/* Which sections exist, what they are called, and how they group.      */
/* Static product identity — presentation/application configuration     */
/* (D5 §19 category D), relocated unchanged from `src/data/academy.ts`. */
/* `src/lib/hashRoute.ts` consumes `viewTitles` by design (both live in */
/* the application shell layer, so the dependency direction is valid).  */
/* ------------------------------------------------------------------ */
import type { ViewId } from "@/lib/viewContracts";

export interface NavDef {
  id: ViewId;
  label: string;
  /**
   * A LIVE count is not part of this data. `navGroups` is static product
   * identity — which sections exist, what they are called — and a number that
   * claims to be current state does not belong in it (M7). The sidebar reads the
   * counts it can stand behind from the repositories and passes them to
   * `NavItem` at render time; see `src/components/layout/Sidebar.tsx`.
   */
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
      { id: "attendance", label: "حضور و غیاب", hint: "ثبت حضور جلسات" },
      { id: "compensation", label: "جبرانی", hint: "تعهدهای جلسه‌های لغوشدهٔ خصوصی" },
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
    items: [{ id: "messages", label: "پیام‌ها", hint: "مدرسین، هنرجویان و اولیا" }],
  },
  {
    id: "resources",
    label: "منابع",
    items: [
      { id: "library", label: "کتابخانه", hint: "نت، صدا و ویدیو" },
      { id: "gallery", label: "گالری", hint: "روایت تصویری آموزشگاه" },
    ],
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
  compensation: "جبرانی",
  finance: "مالی",
  reports: "گزارش‌ها",
  messages: "پیام‌ها",
  library: "کتابخانه",
  gallery: "گالری",
  settings: "تنظیمات",
  "design-system": "سیستم طراحی",
};
