# HANDOFF — برش یادگیری (Learning)، ۲۰۲۶-۱۰-۲۴

> این سند نقطهٔ ادامهٔ کار است، نه گزارش اتمام برای مرج. هیچ commit/push/reset انجام نشده؛
> همه‌چیز در working tree است. اسناد تاریخی (`PROJECT_STATE.md` و غیره) دست‌نخورده مانده‌اند.
> دنبالهٔ مستقیم `HANDOFF-instruments-2026-10-23.md` است — آن را اول بخوان.

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     با `git log -1 --format=%H` بخوان (سند نمی‌تواند SHA خودش را حمل کند)
```

## ۱. وضعیت تحویل

دامنهٔ «یادگیری» سرتاسر پیاده‌سازی شد: ۵ جدول + ۵ مدل، `LearningService` (۲۲ متد قرارداد)،
`LearningPolicy`، `LearningEligibility` (پورت خط‌به‌خط الگوریتم)، ۹ FormRequest، کنترلر ۲۵
مسیره، مجوزها ۲۷→۲۹ شناسه، `ApiLearningRepository` + سیم‌کشی composition client، تست‌ها، و
تصمیم حاکمیتی **DECISIONS.md §34**.

## ۲. بک‌اند — فایل‌های جدید

| فایل | نقش |
|---|---|
| `database/migrations/2026_10_24_000000_create_learning_tables.php` | ۵ جدول با کلید مرکب `(organization_id, id)`؛ **بدون FK آبشاری** — حذفِ دارای‌ارجاع باید ۴۰۹ بدهد نه cascade، پس سرویس داخل تراکنش enforce می‌کند |
| `app/Models/{LearningProgram,LearningLevel,LearningContent,LevelContentLink,StudentPlacement}.php` | مدل + scope سازمان + کلید مرکب (الگوی `Role`) |
| `app/Domain/Learning/LearningService.php` | همهٔ اینوэریانت‌های `localRepository`: ترتیب ۱-based/contiguous/unique با renumber تراکنشی، history append-only، no-op برای تخصیص تکراری، eligibility محاسباتی |
| `app/Domain/Learning/LearningEligibility.php` | پورت دقیق سه تابع `eligibility.ts` (cumulative ≤، exclusive، teacher-only مخفی، dedup در پایین‌ترین سطح، مرتب‌سازی levelOrder/sortOrder/title) |
| `app/Domain/Learning/{LearningPolicy,ProgramRules,LevelRules,ContentRules,LinkPlacementRules}.php` | مجوز + قواعد فرم |
| `app/Http/{Controllers/Api/V1/LearningController.php, Requests/Learning/* (9 فایل)}` | ۲۵ مسیر `learning/*` (فهرست کامل در `routes/api.php`) |
| `database/factories/{LearningProgram,LearningLevel,LearningContent,LevelContentLink,StudentPlacement}Factory.php` | فکتوری‌ها (پیشوندهای id مثل demo store: `pg_/lv_/lc_/lnk_/plc_`) |
| `database/seeders/DemoDatasetSeeder.php` | **+ `seedInstruments()`** — شکاف واقعی: seed تازه اصلاً سازها را seed نمی‌کرد و ارجاع‌ها یتیم بودند. برای learning seed اضافه **نشد** (هیچ سطری ارجاعش نمی‌دهد؛ خالیِ صادقانه بهتر است) |
| `app/Domain/Media/{MediaPolicy,MediaReferences}.php` | شاخهٔ خواندن فایل محتوای آموزشی با `learning.read` + والد `contentMediaIds` |
| `config/permissions.php` | +`learning.read` (در `$readOnlyCore`)، +`learning.write` (ادمین/مدیر/مدرس)؛ accountant فاقد هر دو |
| `app/Http/Resources/...` | **ندارد** — عمداً: `toWire`های استاتیک در سرویس (الگوی `InstrumentService`) |
| `tests/Feature/LearningTest.php` | ۱۶ تست (فهرست در §۵) |

## ۳. فرانت + داک — فایل‌های جدید/تغییرکرده

- جدید: `src/domains/learning/apiRepository.ts` (۲۲ متد؛ `bumpDataVersion` بعد از write موفق؛
  `getStudentPlacement` ناموجود → `undefined`)، `__tests__/apiRepository.test.ts` (۱۸ تست)،
  `__tests__/starterProgram.test.tsx` (۳ تست پذیرش چک‌باکس دورهٔ مقدماتی)
- تغییر: `registry.client.ts` (Api واقعی)، `unavailableDomains.ts` (حذف learning ← حالا **۴تایی**)‏،
  `permissions.ts` (+۲ شناسه؛ read در core؛ write برای manager+teacher)، `useRoles.ts` (گروه
  «مسیر یادگیری» + ۲ لیبل)، `mediaReferences.ts` + تست X1 (والد `instruments.imageId` — از برش
  ساز بود ولی تستش اینجا سبز شد)، `registryClient.test.ts` (۴تایی + instance check)،
  `permissionParity.test.ts` (جدول §34 + regex تنگ‌شده)، `apiAuthPersistence.test.ts` (۲۷→۲۹)
- داک: `DECISIONS.md §34`، `.opencode/specs/auth-rbac.md` (۲۷→۲۹؛ PB-3 حالا فقط rooms)
- **عمداً تغییر نکرد**: `InstrumentFormDialog` (با learning سرو‌شده، چک‌باکس بدون تغییر کد کار
  می‌کند — همان seami که handoff ساز پیش‌بینی کرده بود)، پنل‌ها (گیت `useCan` ندارند مثل
  بقیه؛ Settings روت `settings.read` می‌خواهد و هر دو نقش بیننده write دارند)،
  `emptyEnvironmentPanels`-ها (learning خالیِ صادقانه نشان می‌دهد)

## ۴. تصمیم حاکمیتی §34 (خلاصه)

PB-3 برای learning برداشته شد چون قرارداد فرانت کامل بود (§26.3 وام‌گیری ممنوع → دو شناسهٔ
جدید؛ واژگان ۲۷→۲۹؛ learning/bقیه دست‌نخورده). ماتریس آینهٔ §29: read برای همه جز accountant؛
write ادمین+مدیر+مدرس (تخصیص کارِ مدرس است مثل assignment). learning و PB-5 سر جایشان.

## ۵. شواهد اندازه‌گیری‌شده

- **بک‌اند: ۳۷۰ تست، ۲۴۹۴ assertion — سبز** (sqlite). `LearningTest` (۱۶): احراز هویت، ماتریس
  read/write هر ۵ نقش (`permission` درست در ۴۰۳)، CRUD کامل هر ۵ موجودیت، ترتیب contiguous با
  insert/reorder/delete، رد slug؟—(ندارد؛ slug فقط سازهاست)، رد برنامه با ساز ناموجود ۴۲۲،
  PROGRAM_HAS_LEVELS/STUDENTS و LEVEL_HAS_CONTENT/STUDENTS، LINK_INVALID قبل‌از-duplicate،
  CONTENT_ALREADY_LINKED، LINK_NOT_FOUND، PLACEMENT_INVALID (ناموجود/ناهم‌خوان/غیرفعال)،
  no-op تخصیص تکراری، history با هر دو سر، چرخهٔ پیش‌نیاز ۴۲۲، mediaId ناموجود ۴۲۲،
  eligibility/locked/eligibleStudents با مقادیر دستی، ایزولاسیون tenant.
- **MySQL واقعی: `LearningTest` سبز (۱۶/۱۶)** — روی همین دیتاست، چون باگ `order` بدون‌علامت
  فقط آنجا ظاهر می‌شد (پایین را ببین).
- **فرانت: ۴۲۱+ تست فوکوس سبز** (learning/instruments/auth/registry/media/panels/honestWrite)؛
  typecheck هر سه پروفایل exit 0؛ باندل client تازه: بدون نشان دمو، `UNAVAILABLE` دقیقاً
  `[chat, branding, gallery, compensation]`، بدون «مسیرهای یادگیری».
- **زنده (مرورگر + API واقعی)**: اعلام ورود فقط ۴ دامنه؛ پنل هر ۲ برنامهٔ سرور را خواند؛ ساخت
  برنامه/جابه‌جایی سطح/لینک/تخصیص از curl؛ ماتریس زنده (read همه، write ادمین/مدیر/مدرس،
  staff/accountant ۴۰۳)؛ ساخت برنامه از UI؛ **جریان starter**: ساخت ساز «تار» با چک‌باکس →
  برنامهٔ «دورهٔ تار» با `instrumentId=tar` + سطح ۱ — در MySQL تأیید شد؛ تب «مسیر یادگیری»
  هنرجوی آزمایشی: اتود الف/ب مجاز، اتود ج قفل با دلیل. پاک‌سازی کامل → خط مبنا
  (`instruments=6, learning=0, students=15, media=0`).

## ۶. باگ واقعیِ گرفته‌شده در همین برش

`order` در MySQL **unsigned** است؛ renumber دومرحله‌ای با staging منفی روی sqlite سبز می‌شد و روی
MySQL با `1264 Out of range` می‌ترکید. اصلاح: staging مثبتِ دور (`+100000`) در `assignOrders`.
درس: هر منطقی که به علامت ستون تکیه می‌کند باید روی MySQL هم اجرا شود — سوئیت sqlite به‌تنهایی
آن را نمی‌گیرد. (تست رگرسیون اختصاصی اضافه نشد چون همان تست‌های ترتیب، روی MySQL اجرا و سبز
شدند؛ recipe اجرا در §۸.)

## ۷. خرابی محیطی (نه باگ محصول)

همان handoff ساز §۶: پورت ۳۳۰۶ دست mysqld سیستمی است و `.env` را رد می‌کند. این برش با همان
recipe تأیید شد: `mariadbd` محلی روی **۳۳۰۷** + API با `DB_PORT=3307` + vite client روی ۵۱۷۳.
بعد از اتمام، هر سه پروسه kill و هر سه پورت آزاد شدند (تأیید با `ss`). تا دسترسی ۳۳۰۶ درست
نشود `dev:full` کار نمی‌کند.

## ۸. ایرادها و پیشنهادهای ثبت‌شده برای ادامه

1. **ترتیب `title` در eligibility سرور byte-wise است، نه `fa` locale** (PHP بدون intl). فقط
   tie-break وقتی levelOrder و sortOrder هر دو مساوی‌اند اثر می‌گذارد؛ قطعی ولی متفاوت از
   کلاینت. در §34 مستند شد. اگر روزی مهم شد: یا intl نصب شود یا tie-break سوم حذف شود.
2. **پیش‌نیازهای dangling**: سرور id ناموجود را ۴۲۲ می‌کند ولی local اجازه می‌داد (فقط چرخه را
   هیچ‌کدام اجازه نمی‌دادند — local اصلاً چک نمی‌کرد، ادعای types.ts بود). سمت سخت‌گیرانه‌تر
   انتخاب شد؛ اگر parity demo/client جایی assert شد، اینجا را ببین.
3. **`teacherId`/`instrumentId` محتوا اعتبارسنجی نمی‌شوند** (آینهٔ local). عمدی و مستند؛ اگر
   روزی FK شدند، `TenantRules` گسترش یابد نه منطق پراکنده.
4. **تست round-trip در `registryClient.test.ts`** گاهی از بودجهٔ ۵ثانیه می‌گذرد (شناخته‌شده،
   با `--testTimeout=30000` سبز). با اضافه‌شدن learning یک round-trip دیگر به آن تست اضافه
   **نشد** عمداً — کامنت داخل تست توضیح می‌دهد.
5. **برش بعدی پیشنهادی: rooms** — حالا تنها دامنهٔ PB-3 است. `RoomPolicy` آمادهٔ جایگزینی است
   (`authorizeRead/Write` به‌جای `never`) و `RoomService` از قبل پیاده و تست‌شده ولی block است.
   gallery/chat/media-upload جدا هستند.
6. **مایگریشن learning روی دیتابیس توسعه اعمال شده** (جداول خالی). Seed ندارد — عمدی.
7. `PROJECT_STATE.md` دست‌نخورده ماند (مثل برش ساز؛ checkpoint تاریخ‌دار است).

## ۹. دستورهای ازسرگیری

```bash
git log -1 --format=%H; git status --short | wc -l
cd backend && vendor/bin/phpunit 2>&1 | tail -3
# MySQL-leg (نیازمند recipe پورت 3307 از §۷ + فایل کانفیگ موقت):
#   sed 's/3306/3307/' phpunit.mysql.xml > /tmp/p.xml && vendor/bin/phpunit -c /tmp/p.xml --filter LearningTest
npx vitest run src/domains/learning src/domains/auth src/domains/__tests__/registryClient.test.ts --testTimeout=30000
npm run typecheck
```

> قانون تکراری: هیچ‌کدام از موارد §۸ «انجام‌شده» نیست مگر با تست سبز و (جایی که رفتار کاربر
> است) تأیید مرورگر. «مرورگر QA تأیید نشد» تا وقتی واقعاً اجرا نشده.
