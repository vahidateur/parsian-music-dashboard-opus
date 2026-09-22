import { useState } from "react";
import { Building2, Check, FileSpreadsheet, Globe, Palette, Shield, SlidersHorizontal, Bell, History, LayoutGrid } from "lucide-react";
import {
  THEMES,
  accentHex,
  accentLabels,
  themeLabels,
  themeNotes,
  themeStage,
  type Accent,
  type Density,
} from "@/lib/theme";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge, Surface } from "@/components/ds/primitives";
import { Field, PageHeader, Panel, Segmented, Toggle, inputCls } from "@/components/ds/patterns";
import { RoomsPanel } from "@/domains/rooms/RoomsPanel";
import { BrandingPanel } from "@/domains/branding/BrandingPanel";
import { InstrumentsPanel } from "@/domains/instruments/InstrumentsPanel";
import { LearningPanel } from "@/domains/learning/LearningPanel";
import { GalleryPanel } from "@/domains/gallery/GalleryPanel";
import { RepertoirePanel } from "@/domains/progress/RepertoirePanel";
import { ImportExportCenter } from "@/domains/import/ImportExportCenter";
import { DemoDataPanel } from "@/components/settings/DemoDataPanel";
import { UsersPanel } from "@/components/settings/UsersPanel";
import { ManualColorsPanel } from "@/components/settings/ManualColorsPanel";
import { SessionRulesPanel } from "@/domains/organization/SessionRulesPanel";
import { WorkingHoursPanel } from "@/domains/organization/WorkingHoursPanel";
import { cn } from "@/utils/cn";



/* ------------------------------------------------------------------ */
/* Section navigation — presentation config owned by this view (M10).   */
/* Relocated from the dissolved fixture module; a nav hint may describe */
/* the section but never carry a written-in count (M7).                 */
/* ------------------------------------------------------------------ */
const sections = [
  { id: "profile", label: "پروفایل آموزشگاه", hint: "نام، نشانی، ساعات کاری" },
  { id: "users", label: "کاربران و دسترسی", hint: "کاربران، نقش‌ها و سطح دسترسی" },
  { id: "appearance", label: "ظاهر", hint: "تم، تراکم، حرکت" },
  { id: "notifications", label: "اعلان‌ها", hint: "کانال‌ها و رویدادها" },
  { id: "localization", label: "بومی‌سازی", hint: "زبان، تقویم، واحد پول" },
  { id: "operations", label: "عملیات آموزشگاه", hint: "اتاق‌ها، قواعد جلسه، دادهٔ دمو" },
  { id: "data", label: "ورود و خروج اطلاعات", hint: "CSV و Excel · هنرجویان، مدرسین، کلاس‌ها" },
] as const;

type SectionId = (typeof sections)[number]["id"];

const sectionIcon: Record<SectionId, typeof Building2> = {
  profile: Building2,
  users: Shield,
  appearance: Palette,
  notifications: Bell,
  localization: Globe,
  operations: SlidersHorizontal,
  data: FileSpreadsheet,
};

export function SettingsView() {
  const { notify, theme, setTheme, accent, setAccent, density, setDensity, motion, setMotion, colors, clearColors } =
    useApp();
  /** How many colours this viewer has typed by hand — the preview line says so. */
  const typedColorCount = Object.values(colors).filter(Boolean).length;
  const [section, setSection] = useState<SectionId>("profile");
  const [dirty, setDirty] = useState(false);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    overdue: true,
    atRisk: true,
    conflict: true,
    daily: false,
    sms: true,
    email: true,
    app: true,
  });

  const set = (k: string) => (v: boolean) => {
    setToggles((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  return (
    <div>
      <PageHeader
        kicker="سیستم"
        title="تنظیمات"
        description="پیکربندی آموزشگاه، دسترسی‌ها و رفتار سامانه — بخش‌بندی‌شده تا هیچ‌وقت با یک فرم غول‌پیکر روبه‌رو نشوید."
        actions={
          dirty ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setDirty(false)}>انصراف</Button>
              <Button size="sm" variant="primary" onClick={() => { setDirty(false); notify({ tone: "info", title: "ذخیرهٔ تنظیمات نیازمند سرور است", detail: "این تغییرات ماندگار نیستند. تنظیمات ظاهر جداگانه ذخیره می‌شود." }); }}>
                <Check className="size-3.5" /> ذخیرهٔ تغییرات
              </Button>
            </>
          ) : (
            <StatusBadge tone="ok" label="همه‌چیز ذخیره شده" />
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        {/* Section nav */}
        <nav aria-label="بخش‌های تنظیمات" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
          {sections.map((s) => {
            const Icon = sectionIcon[s.id];
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors duration-[var(--sixteenth)] lg:w-full",
                  active ? "bg-gold-500/[0.09] text-gold-300" : "text-ink-300 hover:bg-white/[0.04] hover:text-ink-50",
                )}
              >
                {active && <span className="absolute right-0 top-1/2 hidden h-5 w-[3px] -translate-y-1/2 rounded-l-full bg-gold-500 lg:block" />}
                <Icon className={cn("size-[17px] shrink-0", active ? "text-gold-400" : "text-ink-400")} strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-[13px]">{s.label}</span>
                  <span className="hidden truncate text-[10.5px] text-ink-500 lg:block">{s.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Section body */}
        <div key={section} className="animate-phrase-in space-y-4">
          {section === "profile" && (
            <>
              {/*
                Academy identity is real, persisted data (BrandingRepository).
                Working hours below remain presentational until the scheduling
                domain owns them — the notice says so rather than implying the
                inputs are saved.
              */}
              <BrandingPanel />
              <WorkingHoursPanel />
            </>
          )}

          {section === "users" && <UsersPanel />}

          {section === "appearance" && (
            <>
              <Panel
                title="تم"
                kicker="هر تم مجموعه‌ای از رنگ‌های صحنه است — کلیک روی هرکدام فوراً کل سامانه را بازآرایی می‌کند و برای این دستگاه ذخیره می‌شود"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {THEMES.map((option) => {
                    const active = theme === option;
                    const stage = themeStage[option];
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setTheme(option)}
                        aria-pressed={active}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border p-4 text-right transition-all duration-[var(--sixteenth)]",
                          active
                            ? "border-gold-500/45 bg-gold-500/[0.06]"
                            : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-ink-50">{themeLabels[option]}</span>
                          {active && <StatusBadge tone="gold" label="فعال" glyph={false} />}
                        </div>

                        {/*
                          A real miniature, not an illustration: this element carries
                          the preset's own `data-theme`, so the appearance layer in
                          index.css rebuilds the whole ramp inside it. What you see is
                          what the product becomes — and the viewer's typed colours are
                          cancelled here (`initial`) so each preset previews itself.
                        */}
                        <span
                          className="mt-3 block overflow-hidden rounded-xl border p-2"
                          data-theme={option}
                          style={
                            {
                              "--viewer-bg": "initial",
                              "--viewer-surface": "initial",
                              "--viewer-text": "initial",
                              "--viewer-mix": "initial",
                              background: stage.background,
                              borderColor: "color-mix(in srgb, var(--surface-border))",
                            } as React.CSSProperties
                          }
                          aria-hidden
                        >
                          <span className="surface flex items-center gap-2 p-2">
                            <span
                              className="size-6 shrink-0 rounded-lg"
                              style={{ background: "var(--accent-500)" }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block h-2 w-3/4 rounded-full bg-ink-100" />
                              <span className="mt-1.5 block h-2 w-1/2 rounded-full bg-ink-400" />
                            </span>
                          </span>
                          <span className="mt-2 flex gap-1.5">
                            {["bg-ink-900", "bg-ink-800", "bg-ink-700"].map((step) => (
                              <span key={step} className={cn("h-6 flex-1 rounded-md border", step)} />
                            ))}
                          </span>
                        </span>

                        <p className="mt-3 text-[11px] leading-relaxed text-ink-400">{themeNotes[option]}</p>
                      </button>
                    );
                  })}
                </div>
              </Panel>

              <ManualColorsPanel />

              <Panel title="لهجهٔ برند" kicker="فقط سه گزینهٔ کنترل‌شده — از توکن‌های معنایی، نه رنگ‌های پراکنده">
                <div className="grid gap-3 sm:grid-cols-3">
                  {(Object.keys(accentLabels) as Accent[]).map((a) => {
                    const g = accentHex[a];
                    const active = accent === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAccent(a)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-2xl border p-3.5 text-right transition-all duration-[var(--sixteenth)]",
                          active ? "border-gold-500/45 bg-gold-500/[0.06]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]",
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <span className="h-4 w-6 rounded-md" style={{ background: `linear-gradient(90deg, ${g[400]}, ${g[600]})` }} aria-hidden />
                          {active && <Check className="size-3.5 text-gold-400" />}
                        </span>
                        <span className="mt-2.5 block text-[12.5px] font-medium text-ink-50">{accentLabels[a]}</span>
                        <span className="mt-1 flex gap-1" aria-hidden>
                          {[g[300], g[500], g[700]].map((c) => (
                            <i key={c} className="size-2.5 rounded-full" style={{ background: c }} />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-400" aria-hidden>
                    <LayoutGrid className="size-4" strokeWidth={1.8} />
                  </span>
                  <p className="text-[11.5px] leading-relaxed text-ink-300">
                    لهجه روی برند، نمودارها، وضعیت‌ها و موج نبض اثر می‌گذارد؛ رنگ‌های معنایی (موفقیت، هشدار، خطر) ثابت می‌مانند.
                  </p>
                </div>
              </Panel>

              <Panel title="تراکم و حرکت" kicker="رفتار رابط کاربری روی این دستگاه">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div>
                      <div className="flex items-center gap-2 text-[13px] text-ink-50">
                        تراکم اطلاعات
                        <History className="size-3.5 text-ink-500" aria-hidden />
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-400">فاصلهٔ عناصر در جدول‌ها و فهرست‌ها</div>
                    </div>
                    <Segmented
                      value={density}
                      onChange={(v: Density) => setDensity(v)}
                      options={[{ value: "comfortable", label: "راحت" }, { value: "compact", label: "فشرده" }]}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div>
                      <div className="text-[13px] text-ink-50">حرکت و انیمیشن</div>
                      <div className="mt-0.5 text-[11px] text-ink-400">در صورت خاموش بودن، فقط تغییر حالت‌های ضروری نمایش داده می‌شود</div>
                    </div>
                    <Toggle checked={motion} onChange={setMotion} label="حرکت" />
                  </div>
                </div>
              </Panel>

              <div className="rounded-2xl border border-white/[0.06] p-5">
                <div className="mb-1.5 text-[11px] font-medium text-gold-400">پیش‌نمایش زنده</div>
                <Surface className="flex items-center gap-4 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-400" aria-hidden>
                    <LayoutGrid className="size-4" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink-50">نمونهٔ سطح در تم فعال</div>
                    <div className="mt-0.5 text-[11px] text-ink-400">لهجهٔ فعال: {accentLabels[accent]} · رنگ دستی: {typedColorCount > 0 ? faNum(typedColorCount) + " مورد" : "بدون"} · تراکم: {density === "compact" ? "فشرده" : "راحت"} · حرکت: {motion ? "فعال" : "خاموش"}</div>
                  </div>
                  <StatusBadge tone="gold" label={accentLabels[accent]} glyph={false} />
                </Surface>
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTheme("dark");
                      setAccent("gold");
                      setDensity("comfortable");
                      setMotion(true);
                      clearColors();
                      notify({
                        tone: "info",
                        title: "ظاهر به پیش‌فرض بازگشت",
                        detail: "تم تیره · لهجهٔ طلایی · تراکم راحت · حرکت فعال · رنگ‌های دستی پاک شد",
                      });
                    }}
                  >
                    بازنشانی به پیش‌فرض
                  </Button>
                </div>
              </div>
            </>
          )}

          {section === "notifications" && (
            <>
              <Panel title="رویدادهایی که به شما اطلاع داده می‌شود" kicker="فقط چیزهایی که نیاز به تصمیم دارند">
                <Surface className="mb-4 border-warn-500/20 bg-warn-500/[0.05] p-3.5 text-[11.5px] leading-relaxed text-ink-200">
                  اعلان‌ها نیازمند سرور است — دامنهٔ اعلان‌ها هنوز پیاده‌سازی نشده و این تنظیمات ذخیره نمی‌شود. ارسال واقعی پیامک، ایمیل و اعلان درون‌برنامه‌ای به سرور نیاز دارد و در دمو فعال نیست. این کلیدها صرفاً نمایشی هستند و پس از بارگذاری مجدد بازنشانی می‌شوند.
                </Surface>
                <ul className="space-y-2">
                  {[
                    { k: "overdue", label: "فاکتور سررسید گذشته", hint: "به‌محض گذشتن از موعد" },
                    { k: "atRisk", label: "هنرجوی در معرض ریزش", hint: "پس از دو غیبت متوالی" },
                    { k: "conflict", label: "تعارض اتاق یا مدرس", hint: "بلافاصله" },
                    { k: "daily", label: "خلاصهٔ روزانه", hint: "هر روز ساعت ۰۸:۰۰" },
                  ].map((n) => (
                    <li key={n.k} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                      <div className="min-w-0">
                        <div className="text-[13px] text-ink-50">{n.label}</div>
                        <div className="mt-0.5 text-[11px] text-ink-400">{n.hint}</div>
                      </div>
                      <Toggle checked={toggles[n.k]} onChange={set(n.k)} disabled label={`${n.label} — غیرفعال`} />
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="کانال‌ها" kicker="مسیر رسیدن اعلان‌ها به شما و مخاطبان آموزشگاه">
                <Surface className="mb-4 border-warn-500/20 bg-warn-500/[0.05] p-3.5 text-[11.5px] leading-relaxed text-ink-200">
                  کانال‌های اعلان نیازمند سرور است — دامنهٔ اعلان‌ها هنوز پیاده‌سازی نشده و این تنظیمات ذخیره نمی‌شود. اتصال به ارائه‌دهندهٔ پیامک/ایمیل به سرور نیاز دارد.
                </Surface>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { k: "sms", label: "پیامک" },
                    { k: "email", label: "ایمیل" },
                    { k: "app", label: "اعلان در اپلیکیشن" },
                  ].map((c) => (
                    <div key={c.k} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                      <span className="text-[13px] text-ink-50">{c.label}</span>
                      <Toggle checked={toggles[c.k]} onChange={set(c.k)} disabled label={`${c.label} — غیرفعال`} />
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}

          {section === "localization" && (
            <Panel title="زبان و تقویم" kicker="پیش‌فرض‌های نمایش برای همهٔ کاربران">
              <Surface className="mb-4 border-warn-500/20 bg-warn-500/[0.05] p-3.5 text-[11.5px] leading-relaxed text-ink-200">
                بومی‌سازی هنوز به دامنهٔ تنظیمات متصل نشده و ذخیره نمی‌شود؛ این بخش صرفاً نمایشی است و پس از بارگذاری مجدد بازنشانی می‌شود. تغییر زبان، تقویم و واحد پول به سرور و دامنهٔ تنظیمات نیاز دارد.
              </Surface>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="زبان">
                  <select className={inputCls} disabled defaultValue="fa">
                    <option value="fa">فارسی</option>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label="جهت نوشتار">
                  <select className={inputCls} disabled defaultValue="rtl">
                    <option value="rtl">راست‌به‌چپ (RTL)</option>
                    <option value="ltr">چپ‌به‌راست (LTR)</option>
                  </select>
                </Field>
                <Field label="تقویم">
                  <select className={inputCls} disabled defaultValue="jalali">
                    <option value="jalali">هجری شمسی</option>
                    <option value="gregorian">میلادی</option>
                  </select>
                </Field>
                <Field label="اولین روز هفته">
                  <select className={inputCls} disabled defaultValue="sat">
                    <option value="sat">شنبه</option>
                    <option value="sun">یکشنبه</option>
                  </select>
                </Field>
                <Field label="واحد پول" hint="فقط نمایشی — غیرفعال">
                  <select className={inputCls} disabled defaultValue="toman">
                    <option value="toman">تومان</option>
                    <option value="rial">ریال</option>
                  </select>
                </Field>
                <Field label="قالب اعداد">
                  <select className={inputCls} disabled defaultValue="fa">
                    <option value="fa">ارقام فارسی (۱۲۳)</option>
                    <option value="latin">ارقام لاتین (123)</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-[11.5px] leading-relaxed text-ink-300">
                پیش‌نمایش: <span className="nums text-ink-50">سه‌شنبه ۱۹ اسفند ۱۴۰۴ · ۱۲٬۵۴۳٬۰۰۰ تومان</span> — صرفاً نمایشی
              </div>
            </Panel>
          )}

          {section === "operations" && (
            <>
              <RoomsPanel />
              <InstrumentsPanel />
              <LearningPanel />
              <RepertoirePanel />
              <GalleryPanel />
              <SessionRulesPanel />
              <DemoDataPanel />
            </>
          )}

          {section === "data" && <ImportExportCenter />}
        </div>
      </div>
    </div>
  );
}
