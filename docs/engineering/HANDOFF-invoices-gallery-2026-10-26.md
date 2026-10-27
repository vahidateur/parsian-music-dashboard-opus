# HANDOFF — Sprint: Invoices v1 + Gallery upgrades + toolchain update (2026-10-26)

> Read this first if you are continuing in a fresh session. Everything below
> was verified against the tree on 2026-10-26 ~19:00 UTC. No commits were made;
> all work is uncommitted in the working tree (deliberate — owner never asked
> for a commit).

## 0. Repo state (ground truth, not memory)

- Branch: `arena/01a10b63-parsian-music-dashboard-opus`
- HEAD: `d354f001e730d05563ce5601a0485c99d9eb027a` (unchanged all session)
- Working tree: **269 entries — 123 modified (tracked) + 146 untracked**, 0 staged.
- 1 stash entry exists — **pre-existing, DO NOT touch** (not created this session).
- Protected docs untouched: `PROJECT_STATE.md`, `OPEN_ITEMS.md`, `PHASES.md`.
- CRLF noise across ~20 view files is **pre-existing** (older sessions). Do not
  "fix" it — `git diff -w` is clean for all session changes except those files.

## 1. Environment (running — do NOT stop without owner approval)

| Service | Where | Status at handoff |
|---|---|---|
| MariaDB 11.4 | podman container `parsian-mariadb`, host port **3307**, user datadir `~/.local/opt/mariadb-data` | UP (~23h). Dev DB `parsian_music_mysql_test`; CI/test DB `parsian_ci` |
| Laravel API | `127.0.0.1:8080` (user's `dev:full`) | UP (user's trial stack) |
| Vite | `localhost:5173` (user's `dev:full`) | UP |
| System mysqld on :3306 | OS package, rejects repo creds (1698) | deliberately UNTOUCHED |

- `backend/.env` (gitignored, local-only): `DB_PORT=3307`. This is the correct
  setting while the container is the database. If 3306 ever gets proper creds,
  change it back — nothing else depends on the port number.
- Runtimes pinned for this tree: **PHP 8.5.4** (`/usr/bin/php8.5`), **Node v22.23.4**
  via nvm (`.nvmrc` = `22.23.4`). System `php` is still 8.4 — always invoke the
  backend explicitly with `/usr/bin/php8.5 ...`.
- `lerd` was fully removed this session (binary, tray, container, image, volume,
  network, systemd units, PATH entry, caches). Remaining lerd traces need root
  and were deliberately left: `/etc/sudoers.d/lerd`, `/etc/sysctl.d/99-lerd-ports.conf`,
  `/etc/NetworkManager/{conf.d/lerd-dns-link.conf,dispatcher.d/99-lerd-dns}`,
  `/etc/ssl/certs/lerd-mkcert-rootCA.pem`, dead `lerd0` net device (vanishes on reboot).
  `dev:full` works with plain `npm run dev:full` again (no PATH workaround needed).

## 2. Backend — what was built

**Invoices domain v1 (new):** `POST|GET /invoices`, `GET|PATCH /invoices/:id`,
`POST /invoices/:id/pay`. One invoice = one full payment (no partials, no
balance sync — explicit v1 scope). Pay carries `method: pos|transfer` +
optional `reference` (tracking code).
- New files: `app/Models/Invoice.php`, `app/Domain/Finance/{InvoiceService,InvoicePolicy,InvoiceRules}.php`,
  `app/Http/Requests/Finance/{Store,Update,Pay}InvoiceRequest.php`,
  `app/Http/Controllers/Api/V1/InvoiceController.php`, routes block in `api.php`,
  `database/factories/InvoiceFactory.php`, `tests/Feature/InvoiceTest.php` (11 tests).
- Migrations (applied to dev DB): `2026_10_29_000000_create_invoices_table.php`,
  `2026_10_30_000000_add_payment_details_to_invoices_table.php`.

**Permission vocabulary 35 → 37** (`backend/config/permissions.php`):
- `finance.pay` (§41): pay only; holders = administrator + accountant + manager + staff
  (teachers: none). `finance.write` stays issue/update, administrator + accountant only.
- `gallery.details` (§42): **display-only** display gate for the lightbox readout panel.
  No backend enforcement change — bytes stay authorized by `gallery.read`. Do NOT
  "harden" the API for this id; that would contradict the decision.

**Bug fixes found live this session (both backend, both with regression tests):**
- `TeachersTest`: `DB::table()->whereKey()` generates a bogus `key` column that
  SQLite tolerates and MySQL rejects — fixed to `where('id', …)`.
- `CompensationTest`: 3 schedule tests were date-dependent (Sat+10d vs Sun+10d weekday
  index vs factory `days=[1,3]`) — fixed with `acknowledgeWarnings: true` per the
  file's own precedent.

**Verification:** `DB_PORT=3307 php8.5 vendor/bin/phpunit -c phpunit.local3307.xml`
→ **OK (452 tests, 3148 assertions)** (config file was temp, deleted afterwards).
Live smoke (real API): accountant issued + transfer-paid an invoice; staff pay → 200;
manager issue → 403 `finance.write`; teacher pay → 403 `finance.pay`. Probe rows
deleted afterwards — dev DB holds **0 invoices** (verified).

## 3. Frontend — what was built

**Invoices domain (new, `src/domains/finance/`):** `types.ts` (+`PayMethod`,
`paidMethod/paidReference`, `InvoiceStatus`), `repository.ts`, `apiRepository.ts`
(snake_case query, camelCase body, bump-on-accepted-write), `useInvoices.ts`,
`__tests__/apiRepository.test.ts`. Registry wired in **both** compositions:
client → `ApiFinanceRepository`; demo → `createUnavailableRepository` stub
(demo keeps the honest deferral — enforced by existing `noSuccessWithoutWrite` tests).

**`src/views/Finance.tsx` rewritten** (was deferral-only): filter by status
(server-side), create dialog (student select + title + amount with Persian-digit
parsing via existing `parseTypedNumber` + optional due date), per-row **Pay flow**
gated on `finance.pay` (method select pos/card-transfer + tracking-code input +
confirm; terminal, single-shot), paid receipt line (date + method + reference),
overdue badge derived client-side from `dueAt` (`سررسید گذشته`, display-only —
no new status id, no enforcement). Failed writes surface the server message;
no fake toasts (graduated in `writeFeedbackHonesty.test.ts` next to Scheduling/Attendance).

**Gallery upgrades (all in `src/views/Gallery.tsx` + panel/uploader/lightbox):**
- Lightbox scroll escape: backdrop got `overflow-y-auto`, panel centers with
  `my-auto` and lost the viewport cap (`max-h-full` removed) — tall photos on
  short viewports are reachable again. Labeled «بستن» close button added.
  Regression test: `galleryLightboxScroll.test.tsx` (fails on old classes).
- View-mode persistence: `useGalleryViewMode()` (`src/domains/gallery/`,
  localStorage-backed — allowed: domains may touch localStorage, views may not).
- Masonry mode (4th mode): round-robin `distributeIntoColumns` into flex lanes
  (percentage widths, responsive 2/3/4) instead of CSS-newspaper columns —
  no more staircase. Pure function + DOM test.
- Batch ops: multi-select checkboxes (all modes; in selection mode tapping a
  tile toggles instead of opening), batch bar with target-album select,
  batch move (= addImage + removeImage per item through existing verbs) and
  two-step batch delete, per-item failure counting in toasts.
- Uploader: `alt` prefilled from filename (submit button was dead-locked before);
  submit renamed «افزودن تصویر».
- Gallery rail: footer note cleaned (the English "categories … need backend"
  sentence removed; counts kept + asserted).
- Toolbar tightened (`p-3`, `size="sm"` Segmented).
- WebP: `src/domains/media/prepareImage.ts` converts JPEG/PNG→WebP client-side
  (quality 0.85, GIFs skipped to protect animation, graceful fallback to
  original when canvas/encoder missing). Wired into the 3 image upload paths
  (gallery uploader, gallery panel, profile photo). Server already allow-lists
  `image/webp` — no backend change. Tested both paths (incl. jsdom fallback).
- `gallery.details` gating: lightbox aside renders only with the id; teachers
  get the bare photo + close + nav. Backed by parity test + teacher/manager
  view test. **Display-only by design.**

**Auth matrix (frontend mirrors backend exactly — parity-tested):**
`finance.pay` on manager/staff/accountant (+admin via full vocab);
`gallery.details` on admin/manager/staff. `finance.write` label is now
«صدور فاکتور»; new label «ثبت پرداخت», «مشاهدهٔ شناسنامهٔ تصویر».

**Verification:** `npm run typecheck` + client + demo configs exit 0;
`npm test` → **2931 passed, 4 skipped, 1 failed** — the single failure is the
known environmental `projectState` branch-drift case (branch 4 commits ahead
of origin, push forbidden; untouched by rule). `npm run build:client` OK.
Key suites re-run green after every change: finance (incl. new
`financeInvoices.test.tsx`, 5 tests), gallery (incl. new
`galleryBatchModes`, `galleryNoReloadFlash`, `galleryUploaderStaging`,
`galleryLightboxScroll` tests), noSuccess, writeFeedbackHonesty,
permissionParity (new §41 + §42 blocks), registryClient, apiAuthPersistence
(count bumped 35→37), settingsHonesty, messagesAttachments.

## 4. Test users (dev DB only — created this session, safe to keep)

| Role | Email | Password |
|---|---|---|
| administrator | admin@test.local | admin123 |
| manager | manager@test.local | manager123 |
| staff (reception) | desk@test.local | staff123 |
| teacher (linked to t1) | teacher@test.local | teacher123 |
| accountant | finance@test.local | finance123 |

Seed demo accounts untouched. Test login tokens were deleted after verification.
What each can do is the §40/§41/§42 matrix (verified live): e.g. staff CAN pay
but CANNOT issue; manager can pay but not issue; teacher reads gallery but sees
bare photos. NOTE: `teacher@test.local` is linked to teacher `t1` (T-02 scoping
needs a link; fail-closed otherwise).

## 5. Governance (all in-tree)

- **DECISIONS §40** — invoices v1 under existing `finance.read/write`, no new id
  (at the time), no partials, no balance sync, demo stays deferred.
- **DECISIONS §41** — new `finance.pay` (staff+manager+accountant+admin); pay carries
  method/reference; future app + Telegram bot use the same `POST …/pay` contract.
- **DECISIONS §42** — new `gallery.details` (admin/manager/staff), display-only.
- `.opencode/specs/auth-rbac.md` — vocabulary 35→37, both decisions recorded.

## 6. Deliberately NOT done (do not treat as done)

1. **Featured-album flag** — planned, NOT implemented (no migration, no `featured`
   column, no rail section change). Suggested shape: `featured` boolean on albums
   + manager toggle in AlbumManager + a real «منتخب» rail section replacing the
   locked one.
2. **Lightbox slideshow auto-play + in-lightbox download button** — proposed as
   ideas, NOT implemented.
3. **Grid drag-and-drop reorder** — NOT implemented (reorder API exists and is
   used from list mode; DnD was only proposed).
4. **Hiding the remaining locked gallery rail sections** — kept visible+disabled
   as honest placeholders (relations/trash have no backend contract). Hide only
   on explicit owner say-so.
5. **Teacher/student grid captions** — teachers still see titles in the grid;
   only the lightbox readout is gated (explicit scope decision, see §42 note).
6. **Finance exports (PDF/Excel), refunds, partial payments, balance sync,
   Telegram bot, future app** — out of v1 scope by decision.
7. **`projectState` test failure** — environmental, must NOT be "fixed" by
   weakening it.
8. **Pre-existing CRLF noise** in ~20 view files — left byte-identical.

## 7. Known risks / follow-ups

- The dev API the trial uses must be restarted to pick up `permissions.php`
  changes (PHP opcache/process lifetime); if roles look stale after this
  handoff, restart `dev:full` — not a code issue.
- New dev-DB data since this session's baseline is the OWNER'S own trial data
  (1 paid invoice «مهر», 6 gallery photos incl. Lib.jpg). Verified present and
  referenced — do not clean without asking.
- `teacher@test.local` → linked to `t1` (shared with `teacher1@demo.local`);
  harmless for trials, re-link if a dedicated teacher row is wanted.
- Root-owned lerd leftovers (need sudo, deliberately left): see §1.

## 8. Resume commands (fresh session)

```bash
cd "/home/vahidateur/Documents/Default Project/parsian-music-dashboard-opus-git"
git status --short | wc -l            # expect ~269, 0 staged
podman ps                             # parsian-mariadb must be Up; 127.0.0.1:3307
# backend (needs DB container):
cd backend && sed 's/"3306"/"3307"/' phpunit.mysql.xml > /tmp/p.xml \
  && DB_PORT=3307 /usr/bin/php8.5 vendor/bin/phpunit -c /tmp/p.xml  # expect OK 452
# frontend (needs nvm 22.23.4):
npm run typecheck && npx tsc -p tsconfig.client.json --noEmit && npx tsc -p tsconfig.demo.json --noEmit
npx vitest run src/domains/finance src/views/__tests__/financeInvoices.test.tsx \
  src/views/__tests__/galleryBatchModes.test.tsx src/components/gallery \
  src/domains/gallery src/domains/auth/__tests__/permissionParity.test.ts
npm run build:client
```

Suggested next slice (owner-approved direction, not started): **featured-album
flag** (migration + `featured` on album wire + AlbumManager toggle + «منتخب»
rail section replacing the locked one + tests), then **lightbox slideshow +
download**, then **grid DnD reorder**.
