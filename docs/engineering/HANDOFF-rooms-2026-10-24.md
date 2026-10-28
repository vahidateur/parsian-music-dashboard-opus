# HANDOFF — برش اتاق‌ها (Rooms)، ۲۰۲۶-۱۰-۲۴

> این سند نقطهٔ ادامهٔ کار است، نه گزارش اتمام برای مرج. هیچ commit/push/reset انجام نشده؛
> همه‌چیز در working tree است. اسناد تاریخی (`PROJECT_STATE.md` و غیره) دست‌نخورده مانده‌اند.
> دنبالهٔ `HANDOFF-learning-2026-10-24.md` است.

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     با `git log -1 --format=%H` بخوان (سند نمی‌تواند SHA خودش را حمل کند)
```

## ۱. وضعیت تحویل

بلوکر دقیقاً یک کلاس بود — `App\Domain\Rooms\RoomPolicy` که برای هر actor (حتی administrator)
`OwnerDecisionRequired('PB-3')` می‌انداخت. **بقیهٔ برش از قبل آماده و تست‌شده بود**: سرویس،
ولیدیشن، کنترلر، هر ۶ روت، جدول + seed، فکتوری، `ApiRoomRepository`، سیم‌کشی composition
client. پس این برش فقط مرز مجوز را باز کرد (الگوی §33/§34): واژگان ۲۹→۳۱، دو شناسهٔ
`rooms.read`/`rooms.write`، و بازنویسی policy + تست‌ها. هیچ endpoint/field/table/ماژول
کلاینتی اختراع نشد.

**تصمیم حاکمیتی: DECISIONS.md §35.** با §35 هیچ دامنهٔ مسدودی نمانده، ولی خودِ PB-3 به‌عنوان
قاعدهٔ ایستا سر جایش است (بلاک بدون شناسه) — فقط scope آن خالی است.

## ۲. تغییرها

**بک‌اند:**
| فایل | نقش |
|---|---|
| `config/permissions.php` | +۲ شناسه؛ `rooms.read` در `$readOnlyCore`؛ `rooms.write` برای ادمین+مدیر؛ accountant صریحاً `rooms.read` دارد (آینهٔ instruments: نام اتاق دادهٔ شخصی نیست) |
| `app/Domain/Rooms/RoomPolicy.php` | بازنویسی کامل: `PermissionGate` به‌جای `OwnerDecisionRequired` (الگوی InstrumentPolicy) |
| `app/Http/Controllers/Api/V1/RoomController.php` + `routes/api.php` + `Requests/Rooms/*` + `TenantRules::assignableRoom` | فقط کامنت (رفتار عوض نشد — policy-first از قبل درست بود و همان می‌ماند) |
| `tests/Feature/RoomsTest.php` | ۳ تست PB-3 حذف و با سوئیت مجاز جایگزین شد (ماتریس هر ۵ نقش، forbidden-قبل‌از-validation، 404 ناشناس، CRUD round trip با deactivate، name-taken 409)؛ تست‌های سطح سرویس دست‌نخورده |
| `tests/Feature/{ProgressTest,ProgressEventTest}.php` | شمار واژگان ۲۹→۳۱ (+ ادعای دو شناسه)؛ کامنت stale دربارهٔ PB-3 اصلاح شد |
| `database/seeders/DemoDatasetSeeder.php` | بدون تغییر لازم بود — seed اتاق‌ها از قبل وجود داشت |

**فرانت (فقط مجوز + سیم‌کشی ازپیش‌موجود را پین کردن):**
- `permissions.ts` (+۲ شناسه، read در core، write برای manager، read صریح برای accountant)،
  `useRoles.ts` (گروه «اتاق‌ها» + ۲ لیبل)، `parity.test.ts` (جدول §35 + regex بدون `rooms|`),
  `apiAuthPersistence.test.ts` (۲۹→۳۱)، `registryClient.test.ts` (instance check
  `ApiRoomRepository` — رجیستری از قبل سیم بود، فقط assert نداشت)
- `src/domains/rooms/apiRepository.ts` — **تنها تغییر واقعی فرانت**: `bumpDataVersion` بعد از
  write موفق + اصلاح docstring کهنه («no server yet»). تست جدید `__tests__/apiRepository.test.ts`
  (۱۰ تست: URL/متد/body همهٔ متدها + bump بعد از write موفق + عدم bump بعد از رد)
- `src/domains/shared/unavailableDomains.ts` — **بدون تغییر** (اتاق‌ها هیچ‌وقت در فهرست نبودند)
- عمداً تغییر نکرد: `RoomsPanel` (گیت `useCan` ندارد مثل بقیه؛ روت Settings `settings.read`
  می‌خواهد و هر دو بیننده write دارند)، `errorAvailability/*` و `heroMetricsRoomsUnavailable`
  (stub می‌سازند، مستقل از رفتار واقعی سرور — سبز ماندند و همان را ثابت می‌کنند)

**داک:** `DECISIONS.md §35`، `.opencode/specs/auth-rbac.md` (۲۹→۳۱؛ PB-3: «هیچ دامنهٔ مسدودی نمانده»).

## ۳. باگ واقعیِ پیدا‌شده در همین برش

`ApiRoomRepository` بعد از write موفق نسخهٔ داده را bump نمی‌کرد (یادگار دوره‌ای که سرور
وجود نداشت). در composition دمو لیست‌ها via اشتراک store تازه می‌شدند و nobody متوجه نبود؛
در client با سرور واقعی، پنل بعد از ساخت/غیرفعال‌سازی لیست کهنه نشان می‌داد — **زنده بازتولید
شد** (اتاق ساخته شد در DB ولی در لیست نیامد) و با همان الگوی §33/§34 درست شد. instruments و
learning این bump را داشتند، rooms و media نداشتند — **ناهماهنگی باقی‌مانده**: `ApiMediaRepository`
و `ApiStudent/Teacher/Class/...Repository`ها bump ندارند. برای rooms عمداً همان الگوی جدید
اعمال شد چون پنلش روی bump حساب می‌کند (هیچ‌جا `reload()` صدا نمی‌زند)؛ یکدست‌سازی بقیه یا
documented decision می‌خواهد (پیشنهاد §۶-۳).

## ۴. شواهد اندازه‌گیری‌شده

- **بک‌اند: ۳۷۳ تست، ۲۴۸۸ assertion — سبز** (sqlite). `RoomsTest` جدید: ماتریس هر ۵ نقش،
  forbidden-قبل‌از-validation برای teacher/staff/accountant، 404 ناشناس، CRUD+deactivate،
  name-taken 409، و تست‌های سطح سرویس (round trip، IN_USE، ایزولاسیون tenant).
- **MySQL واقعی: `LearningTest` سبز (۱۶/۱۶)** — در همین برش اجرا شد چون باگ unsigned ستون
  `order` فقط آنجا ظاهر می‌شد (جزئیات در handoff یادگیری §۶). برای rooms تغییر اسکیما نبود؛
  سوئیت کامل روی MySQL این‌بار اجرا نشد چون دیتابیس موقت ۳۳۰۷ بعد از E2E جمع شد (پایین را ببین).
- **فرانت فوکوس: ۴۲۲ سبز** (auth، rooms جدید، learning، instruments، registry، media،
  DemoBackedNotice، clientAvailability، errorAvailability، heroMetrics، UsersPanel)؛
  typecheck هر سه پروفایل exit 0؛ باندل client تازه: بدون نشان دمو، `UNAVAILABLE_DOMAINS`
  دست‌نخوردهٔ ۴تایی.
- **زنده (مرورگر + API واقعی روی دیتابیس توسعه)**: اعلام ورود همان ۴ دامنه (اتاق‌ها هیچ‌وقت
  آنجا نبود)؛ پنل هر ۴ اتاق seed را خواند؛ ساخت «اتاق پروب مرورگر» از UI → `201` در MySQL؛
  **غیرفعال‌سازی از UI درجا در لیست اعمال شد** (اثبات bump)؛ حذف از API (`204`، چون پنل
  عمداً دکمهٔ حذف ندارد — تصمیم محصول، دست‌نخورده)؛ ماتریس زنده (read هر ۴ نقش ۲۰۰، write
  ادمین ۲۰۱، teacher/staff/accountant 403). پاک‌سازی کامل → خط مبنا (`rooms=4`).

## ۵. خرابی محیطی (نه باگ محصول)

همان handoff یادگیری §۷: پورت ۳۳۰۶ دست mysqld سیستمی است و `.env` را رد می‌کند. راستی‌آزمایی
با `mariadbd` محلی روی **۳۳۰۷** + API با `DB_PORT=3307` + vite client روی ۵۱۷۳ انجام و بعد هر سه
پروسه kill و هر سه پورت آزاد شدند (تأیید با `ss`). تا دسترسی ۳۳۰۶ درست نشود `dev:full` کار نمی‌کند.

## ۶. ایرادها و پیشنهادهای ثبت‌شده برای ادامه

1. **ناهماهنگی bump نسخه**: فقط instruments/learning/rooms آن را دارند. اگر پنل دیگری در
   client کهنه نشان داد، اول همین را چک کن؛ یکدست‌سازی همهٔ ApiRepositoryها تصمیم جداگانه
   می‌خواهد (تست `ApiRoomRepository shared invalidation` الگوست).
2. **پنل اتاق‌ها دکمهٔ حذف ندارد** (فقط ویرایش + فعال/غیرفعال). تصمیم محصولِ موجود است —
   اگر مالک حذف از UI خواست، endpoint و تستش آماده است (`204` زنده تأیید شد).
3. **`errors.ts` هنوز متن `OWNER_DECISION_REQUIRED_PB3` را دارد.** عمداً نگه داشته شد: copy
   مشترک خانوادهٔ `OWNER_DECISION_REQUIRED_PB*` است و فقط وقتی رندر می‌شود که سرور واقعاً آن
   کد را بدهد (الان هیچ مسیری نمی‌دهد). حذفش اختیاری و بی‌اثر است.
4. **اعتبارسنجی نام تکراری case-sensitive است** (`where('name', trim)` + unique index روی
   MySQL utf8mb4 → عملاً case-insensitive در collation پیش‌فرض ولی case-sensitive در sqlite).
   واگرایی خفیف بین محیط تست و محصول؛ مثل بقیهٔ دامنه‌هاست (instruments هم همین‌طور) — اگر
   روزی مهم شد، یک‌جا برای همه حل شود نه فقط اتاق‌ها.
5. **برش بعدی پیشنهادی**: gallery یا chat (هر دو UNAVAILABLE مانده‌اند و هر دو به media گره
   خورده‌اند که حالا سرو شده). branding/media-upload هم کاندیداست. rooms دیگر کاری ندارد.
6. مایگریشن جدید لازم **نبود** (جدول از قبل بود)؛ seed هم لازم نبود (۴ سطر seed موجود).
   تنها اثر ماندگار روی دیتابیس توسعه: هیچ — جدول‌های learning از برش قبل خالی‌اند و rooms
   دقیقاً ۴ سطر seed دارد (تأیید شد).

## ۷. دستورهای ازسرگیری

```bash
git log -1 --format=%H; git status --short | wc -l
cd backend && vendor/bin/phpunit 2>&1 | tail -3
npx vitest run src/domains/rooms src/domains/auth src/domains/__tests__/registryClient.test.tsx --testTimeout=30000
npm run typecheck
# زنده (بعد از درست شدن دسترسی 3306؛ در غیر این صورت recipe پورت 3307 در §۵):
# npm run dev:full → ورود admin → Settings → «عملیات آموزشگاه» → پنل «اتاق‌ها و فضاها»
```

> قانون تکراری: هیچ‌کدام از موارد §۶ «انجام‌شده» نیست مگر با تست سبز و (جایی که رفتار کاربر
> است) تأیید مرورگر. «مرورگر QA تأیید نشد» تا وقتی واقعاً اجرا نشده.
