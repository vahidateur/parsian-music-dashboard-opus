# HANDOFF — برش سازها (Instruments)، ۲۰۲۶-۱۰-۲۳

> این سند نقطهٔ ادامهٔ کار است، نه گزارش اتمام برای مرج. هیچ commit/push/reset انجام نشده؛
> همه‌چیز در working tree است. اسناد تاریخی (`PROJECT_STATE.md` و غیره) دست‌نخورده مانده‌اند.

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     با `git log -1 --format=%H` بخوان (سند نمی‌تواند SHA خودش را حمل کند)
```

## ۱. وضعیت تحویل

دامنهٔ «سازها» سرتاسر پیاده‌سازی شد: بک‌اند (migration/model/service/policy/controller/requests/
resource/routes)، فرانت (`ApiInstrumentRepository` + سیم‌کشی composition client)، مجوزها
(۲۵→۲۷ شناسه)، تست‌ها، و تصمیم حاکمیتی **DECISIONS.md §33**.

**دو دسته تغییر در working tree هست — قاطی نکن:**
- **مال این برش** (فهرست کامل در §۲ و §۳).
- **از قبل موجود و دست‌نخورده**: تغییر `InstrumentsPanel.tsx` (`description={error.message}` ←
  `error={error}`، مربوط به مهاجرت prop در `ErrorState` از سشن قبل)، نویز CRLF در ~۴۰ ویو،
  تغییرات `dev-full.mjs`/`vite.config.ts`/`README` از برش‌های قبلی (media، disclosure).
  به هیچ‌کدام دست نزدم و ربطی به این برش ندارند.

**وضعیت دیتابیس توسعه** (`parsian_music_mysql_test`): جدول `instruments` با ۶ سطر seed،
بقیه دست‌نخورده (`users=12`، `roles=4`، `media_assets=0`). دادهٔ آزمایشی زنده (سنتور/probe1)
ساخته و کامل پاک شد.

## ۲. بک‌اند — فایل‌های جدید

| فایل | نقش |
|---|---|
| `database/migrations/2026_10_23_000000_create_instruments_table.php` | جدول با کلید مرکب `(organization_id, id)` + backfill غیرمخرب ۶ ساز seed وقتی `org_demo` هست و جدول خالی است |
| `app/Models/Instrument.php` | مدل با scope سازمان + کلید مرکب (الگوی `Role`) |
| `app/Domain/Instruments/InstrumentService.php` | CRUD + `setActive` + حذف با `INSTRUMENT_IN_USE` (اسکن teachers/students/classes/resources/pieces و learning در صورت وجود جدول)؛ slug=id و immutable |
| `app/Domain/Instruments/InstrumentPolicy.php` | `instruments.read` (همه) / `instruments.write` (ادمین+مدیر) |
| `app/Domain/Instruments/InstrumentRules.php` | الفبای slug، نام، و `TenantRules::mediaAssetExists()` برای `imageId` |
| `app/Http/{Controllers/Api/V1/InstrumentController.php, Requests/Instruments/*, Resources/InstrumentResource.php}` | شش endpoint (روت‌ها در `routes/api.php`) |
| `database/factories/InstrumentFactory.php` | فکتوری |
| `database/seeders/DemoDatasetSeeder.php` | **+ `seedInstruments()`** — شکاف واقعی: seed تازه اصلاً ساز نداشت و همهٔ ارجاع‌های seed یتیم بودند |
| `app/Domain/Media/{MediaPolicy.php,MediaReferences.php}` | شاخهٔ خواندن تصویر ساز با `instruments.read` + والد `instrumentMediaIds` در هر دو چک سراسری؛ `instruments.write` به دروازهٔ آپلود مرکب اضافه شد |
| `config/permissions.php` | دو شناسهٔ جدید + ماتریس §33 |
| `tests/Feature/InstrumentsTest.php` | ۱۳ تست (فهرست کامل در §۵) |

## ۳. فرانت + داک — فایل‌های جدید/تغییرکردهٔ این برش

- جدید: `src/domains/instruments/apiRepository.ts` (با `bumpDataVersion` بعد از write موفق)،
  `src/domains/instruments/__tests__/apiRepository.test.ts` (۱۰ تست)
- تغییر: `registry.client.ts` (Api واقعی)، `unavailableDomains.ts` (حذف instruments ← حالا ۵تایی)،
  `permissions.ts` (+۲ شناسه، `instruments.read` در READ_ONLY_CORE، `instruments.write` برای
  manager، `instruments.read` برای accountant)، `useRoles.ts` (گروه «سازها» + ۲ لیبل)،
  `mediaReferences.ts` + تست X1 (والد `instruments.imageId`)، `registryClient.test.ts` (۵تایی +
  instance check)، `permissionParity.test.ts` (جدول §33 + regex به‌روز)،
  `apiAuthPersistence.test.ts` (۲۵→۲۷)
- داک: `DECISIONS.md §33`، `.opencode/specs/auth-rbac.md` (۲۵→۲۷، PB-3: فقط learning+rooms)

**عمداً تغییر نکرد**: `InstrumentFormDialog` (چک‌باکس «دورهٔ مقدماتی» در client با خطای صادقانهٔ
`DOMAIN_UNAVAILABLE` مواجه می‌شود — learning هنوز PB-3 است؛ وقتی learning بیاید بدون تغییر
دیالوگ کار می‌کند)، `InstrumentsPanel` (گیت `useCan` ندارد، مثل `RoomsPanel`؛ روت Settings خودش
`settings.read` می‌خواهد و هر دو نقش بیننده write دارند).

## ۴. تصمیم حاکمیتی §33 (خلاصه — متن کامل در DECISIONS.md)

PB-3 برای سازها برداشته شد چون قرارداد فرانت کامل بود و هیچ endpoint/field/error جدیدی اختراع
نشد (§26.3 وام‌گرفتن `settings.*`/`library.*` را ممنوع کرده بود، پس دو شناسه ساخته شد).
`instruments.read` برای همه (نام ساز دادهٔ شخصی نیست)؛ `instruments.write` فقط ادمین+مدیر
(آینهٔ `library.write`). واژگان ۲۵→۲۷. learning و rooms همچنان Option A.

## ۵. شواهد اندازه‌گیری‌شده

- **بک‌اند: ۳۵۴ تست، ۲۲۸۷ assertion — سبز.** `InstrumentsTest`: احراز هویت، read هر ۵ نقش،
  write فقط ادمین/مدیر (۴۰۳ با `error.permission` درست)، CRUD کامل، slug بدفرم ۴۲۲، تکراری
  ۴۰۹ (slug و name جدا)، slug immutable، IN_USE برای piano، ایزولاسیون tenant،
  imageId ناموجود/کراس-tenant ۴۲۲. `MediaTest` +۱: accountant با فقط `instruments.read` عکس
  ساز را ۲۰۰ می‌گیرد و عکس مدرس/فایل کتابخانه را ۴۰۳.
- **فرانت فوکوس: همه سبز** — instruments (شامل apiRepository جدید)، auth کامل، registryClient،
  canonicalRepositories، DemoBackedNotice، honestWriteCopy، settingsHonesty، mediaReferenceIndex.
- **typecheck هر سه پروفایل exit 0.** باندل client تازه: بدون نشان دمو؛ `UNAVAILABLE_DOMAINS`
  دقیقاً ۵تاییِ بدون سازها.
- **زنده (مرورگر واقعی + API واقعی)**: اعلام ورود بدون «سازها»؛ پنل هر ۶ ساز را از API خواند؛
  ساخت «سنتور» از UI → `201/sortOrder=7` در MySQL؛ حذف از UI با toast صادقانه → شمارش به ۶
  برگشت؛ ماتریس زنده (۵ نقش read=200، فقط ادمین/مدیر write موفق).
- **یک فلیکی شناخته‌شده**: تست round-trip در `registryClient.test.ts` گاهی از بودجهٔ ۵ثانیه
  می‌گذرد — با `--testTimeout=30000` سبز است (قبلاً هم مستند بود، ربطی به این برش ندارد).

## ۶. خرابی محیطی (environment failure — نه باگ محصول)

بعد از ری‌استارت سرور، پورت ۳۳۰۶ را یک `mysqld` سیستمی گرفته که اعتبار `.env`
(`root` + `ci-throwaway-not-a-credential`) را رد می‌کند (`1698`) و datadir آن هم قابل
بازدید نیست. راستی‌آزمایی زنده را این‌طور انجام دادم و بعد همه را خاموش کردم:
`mariadbd` محلی روی پورت **۳۳۰۷** با `--skip-grant-tables` روی همان datadir کاربر
(دست‌نخورده از ۰۱:۵۰، بدون تعارض) + API با `DB_PORT=3307` + vite client روی ۵۱۷۳.
**الان هر سه پورت آزادند و هیچ سرور موقتی بالا نیست.**
تا دسترسی ۳۳۰۶ درست نشود `dev-full`/API محلی کار نمی‌کند — بیرون از اسکوپ این برش است.

## ۷. ایرادها و پیشنهادهای ثبت‌شده برای ادامه

1. **`sort_order` از کلاینت می‌آید** (اعتبارسنجی فرم، نه ترتیب مجدد تراکنشی مثل learning).
   برای lookup table پذیرفتنی است؛ اگر academyای صدها ساز ساخت، این تصمیم را بازبینی کن.
2. **چک‌باکس «دورهٔ مقدماتی» در client همیشه با خطای صادقانه شکست می‌خورد** تا learning
   authorize شود. وقتی learning آمد، بدون تغییر دیالوگ درست می‌شود — ولی UX موقت است؛
   موقع برش learning این را به‌عنوان acceptance چک کن.
3. **`media.write` مستقل هنوز ساخته نشده** (دروازهٔ مرکب `students|teachers|library|instruments.write`).
   اگر روزی خواستی آپلود از نوشتن رکورد جدا شود، تصمیم مالک می‌خواهد + تغییر واژگان در دو طرف + parity.
4. **`peaks`/`width`/`height` از کلاینت می‌آیند** و سرور فقط فرمشان را چک می‌کند (میراث برش media).
   برای عکس بی‌خطر؛ اگر صوت/ابعاد مهم شد، محاسبه سمت سرور لازم است.
5. **جمله‌های دموی مسیرهای مرده در باندل client**: `MessageAttachment` و `GalleryPanel`
   (دامنه‌های غیرفعال) هنوز لفظ دمو در success-toastهایشان دارند — در client اجراناپذیرند
   (پروکسی همه را رد می‌کند) پس کاربر هرگز نمی‌بیندشان، ولی از نظر بهداشت باندل (`CLIENT_MUST_ABSENT`
   فعلاً آن عبارت‌ها را چک نمی‌کند) بدهی‌اند. پیشنهاد: موقع برش gallery/chat از seam ردشان کن،
   نه زودتر.
6. **برش بعدی پیشنهادی: learning** — تنها مصرف‌کنندهٔ `instrumentId` که هنوز PB-3 است، و
   تنها وابستهٔ `programs` که `findReference` با guard ناقص پوشش می‌دهد. rooms مستقل است و
   می‌تواند بعد بیاید.
7. **لینک PROJECT_STATE §6**: دستورالعمل DECISIONS می‌گوید تصمیم تست‌دار را آنجا لینک کن، ولی
   آن فایل checkpoint تاریخ‌دار است و `projectState.test.ts` رویش حساس است — عمداً دست نزدم.
   اگر مالک خواست، با احتیاط جداگانه انجام شود.
8. **مایگریشن روی دیتابیس توسعه اعمال شده** (جدول + ۶ سطر backfill). روی دیتابیس تازه، seed
   همان ۶ سطر را می‌سازد (تست `EnvelopeTest` با `instruments=6` پین شده). دو مسیره بودن
   backfill/seed عمدی است: backfill فقط وقتی کار می‌کند که جدول خالی و `org_demo` موجود باشد.

## ۸. دستورهای ازسرگیری

```bash
# وضعیت
git status --short | head -30
git log -1 --format=%H

# بک‌اند (sqlite، بدون نیاز به MySQL)
cd backend && vendor/bin/phpunit 2>&1 | tail -3

# فرانت فوکوس
npx vitest run src/domains/instruments src/domains/auth src/domains/__tests__/registryClient.test.ts --testTimeout=30000 2>&1 | tail -5
npm run typecheck

# زنده (بعد از درست شدن دسترسی 3306؛ در غیر این صورت همان recipe پورت 3307 در §۶)
npm run dev:full
# سپس: ورود admin@demo.local → Settings → «عملیات آموزشگاه» → پنل «سازها و رشته‌ها»
```

> قانون تکراری ولی لازم: هیچ‌کدام از موارد §۷ «انجام‌شده» نیستند مگر با تست سبز و (جایی که
> رفتار کاربر است) تأیید مرورگر. «مرورگر QA تأیید نشد» تا وقتی واقعاً اجرا نشده.
