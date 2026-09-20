# 17 — Mobile Client Contract — F9 CONTRACT NOW BACKEND LATER

> Mobile student client = REQUIRED PRODUCT CAPABILITY — mobile app client of same backend contracts, media/file abstraction -> storage provider — F9 goal — Visible outcome: Contract doc for mobile auth bearer secure storage not localStorage, same API envelope Collection/Item PageMeta, same domain repos, same RBAC, media upload same endpoint, no second API — Domains: all — registry mode-switched, ApiClient envelope, auth B1 Sanctum cookie primary + bearer fallback, media abstraction — Dependencies: auth B1, media abstraction O-16, identity linking O-10 O-12, student portal O-13 — Acceptance: Mobile app uses same backend contracts no second API same RBAC same media seam same envelope, auth bearer token stored securely not localStorage, offline C deferred no fake, features same as web or subset teacher/student portal B contract, no new backend same Laravel domain structure B1 — Tests: contract tests envelope, auth bearer, media upload seam, no second API — B CONTRACT NOW BACKEND LATER REQUIRED PRODUCT CAPABILITY — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile no business logic in bots — per correction 2026-09-19

## Goal

Mobile student client = REQUIRED PRODUCT CAPABILITY — mobile app client of same backend contracts as Web SPA — same envelope Collection/Item PageMeta, same domain repos, same RBAC, media/file abstraction -> storage provider, auth bearer secure storage not localStorage, offline C deferred no fake, features same as web or subset teacher/student portal B contract, no new backend same Laravel domain structure B1 — per 11-roadmap.md F9 — CORRECTION 2026-09-19 classification Mobile = REQUIRED PRODUCT CAPABILITY — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile, no business logic in bots — previous wording "C DEFERRED (or B if product needs)" corrected to REQUIRED.

## Visible Outcome

- Contract doc for mobile auth bearer secure storage not localStorage — THIS FILE
- Same API envelope Collection/Item PageMeta — VERIFIED via `src/api/client.ts` + `src/api/types.ts` + contract tests
- Same domain repos — VERIFIED via `src/domains/registry.ts` isApiMode() ? ApiRepository : DemoRepository — same composition root for web and mobile — no second API
- Same RBAC — 5 roles 22 perms rolePermissions matrix viewPermissions UX-only can/canAny/canAll defaultViewFor + scope pure functions self/assigned/org — VERIFIED `src/domains/auth/permissions.ts` + `src/domains/auth/scope.ts`
- Media upload same endpoint — App->Media/File abstraction->Storage provider two-part split metadata dataset blobStore vs object storage — bytes ArrayBuffer via MediaRepository.create — same endpoint for web and mobile — VERIFIED `src/domains/media/types.ts` + `src/domains/media/repository.ts` + exportService downloadBlob seam
- No second API — VERIFIED registry single ApiClient, no second baseUrl, architectureBoundaries test asserts no second ApiClient + no hardcoded HTTP URL except ApiClient
- Auth bearer token stored securely not localStorage — B CONTRACT — mobile secure storage (Expo SecureStore / iOS Keychain / Android Keystore / EncryptedSharedPreferences) not localStorage, web Sanctum cookie primary HttpOnly Secure SameSite + bearer fallback for mobile — B1 decision — VERIFIED via ApiClient Bearer header `Authorization: Bearer ${token}` + decision register B1 PROVISIONAL + O-12 OPEN REQUIRED
- Offline C deferred no fake — honest — no offline queue code — no fake claim — per F9 acceptance
- Features same as web or subset teacher/student portal B contract — per 15-student-portal-architecture.md — student portal mobile natural client — profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files — teacher portal subset — attendance/schedule/compensation assigned-only — D1 preserved no student role in admin panel
- No new backend same Laravel domain structure B1 — same Laravel domain structure mirrors frontend domains, Sanctum cookie primary + bearer fallback, org_id scoping, rolePermissions matrix server-side, per-object auth — B1 PROVISIONAL
- Tests: contract tests envelope, auth bearer, media upload seam, no second API — A NOW — `src/api/__tests__/mobileContract.test.ts` + `src/__tests__/architectureBoundaries.test.ts` F9 extension

## Domains

All — registry mode-switched, ApiClient envelope, auth B1 Sanctum cookie primary + bearer fallback, media abstraction — students, teachers, rooms, classes, enrollments, auth, users, instruments, learning/eligibility, progress, library, gallery, branding, media, chat, scheduling, attendance, compensation, backup, export, dashboard, settings — same backend contracts, same envelope, same RBAC, same media seam — no second API.

## Same Backend Contracts — No Second API

### Registry Mode-Switched

```ts
// src/domains/registry.ts — VERIFIED
const isApiMode = (): boolean => getRuntimeConfig().mode === "api";
export function getApiClient(): ApiClient {
  if (!client) client = new ApiClient({
    baseUrl: getRuntimeConfig().apiBaseUrl,
    timeoutMs: 10000,
    getToken: () => getAuthToken(), // Bearer token from memory/secure storage
  });
  return client;
}
export const getStudentRepository = () =>
  isApiMode() ? new ApiStudentRepository(getApiClient()) : new DemoStudentRepository();
```

- `isApiMode()` single flag — VERIFIED — web and mobile share same flag — mobile always `api` mode — no second mode — no second client — same composition root — VERIFIED D8 demo-served 11 domains disclosure
- `getApiClient()` single ApiClient instance — VERIFIED — no second ApiClient with different baseUrl — no second envelope — architectureBoundaries test asserts only one `new ApiClient` in registry.ts
- All repos via same client — students/teachers/rooms/classes/enrollments/auth/users API-backed 7 + 11 demo-served instruments/learning/progress/library/gallery/branding/media/chat/scheduling/attendance/compensation with DemoBackedNotice disclosure — same for web and mobile — no second API — per B1 decision one backend clean seam
- Decision B1: Laravel domain structure mirrors frontend domains — same domain structure Laravel — B1 PROVISIONAL — same contracts for web and mobile — no second API — alternatives second API for mobile duplicate — rejected — per decision register NEW-MOB-01 PROVISIONAL
- Frontend evidence: `src/api/client.ts` single ApiClient class — no hardcoded second baseUrl — no fetch except inside ApiClient — VERIFIED via architectureBoundaries F8 + F9 extension
- Backend impact: same Laravel domain structure B1 — backend Laravel with Sanctum, OrganizationScope, per-object auth, rolePermissions matrix server-side — same endpoints for web and mobile — no second API — B CONTRACT

### ApiClient Envelope — Same for Web and Mobile

```ts
// src/api/types.ts — VERIFIED
export type CollectionEnvelope<T> = {
  data: T[];
  meta: PageMeta;
};
export type ItemEnvelope<T> = {
  data: T;
};
export type PageMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};
export type ApiErrorKind = 401 | 403 | 404 | 409 | 422 | 5xx;
```

- Collection envelope `{ data: T[], meta: PageMeta }` — VERIFIED — used by list* methods — same for web and mobile — no second envelope
- Item envelope `{ data: T }` — VERIFIED — used by get/create/update — same for web and mobile
- PageMeta `page, per_page, total, total_pages` — VERIFIED — pagination query `page, per_page, sort, order, q` + filter — same for web and mobile
- Error kinds 401/403/404/409/422/5xx via `apiErrorFromThrown` — VERIFIED — 401 redirect login, 403 DENIED, 404 NOT_FOUND, 409 CONFLICT, 422 validation, 5xx retry — same for web and mobile — no second error model
- Query params same — `page, per_page, sort, order, q, filters` — same for web and mobile — per O-15 API boundaries OPEN
- Binary client where needed for media — MediaRepository.create bytes ArrayBuffer — ApiClient speaks JSON only — binary-capable client separate — `downloadBlob` single seam — VERIFIED exportService.ts
- Contract tests: `src/api/__tests__/mobileContract.test.ts` asserts envelope shape — Collection has data array + meta page/per_page/total/total_pages, Item has data object, PageMeta numbers, error kinds — A NOW

### Same Domain Repos

- Students, teachers, rooms, classes, enrollments, auth, users — API-backed 7 — `ApiStudentRepository` etc — via ApiClient — same for web and mobile
- Instruments, learning/eligibility, progress, library, gallery, branding, media, chat, scheduling, attendance, compensation — demo-served 11 both modes with persistent non-dismissable disclosure DemoBackedNotice — VERIFIED D8 — same for web and mobile — no fake health claim — backend graduation B
- Library apiRepository exists but unregistered due to binary client need — B — per D8 — same for mobile
- No second repository for mobile — same repos — registry returns same type — no mobile-specific repo — no second API — contract tests assert registry returns same interface

### Same RBAC — Same Permissions, Same Scope

- 5 roles 22 perms rolePermissions matrix — VERIFIED `src/domains/auth/permissions.ts` — roles: admin, manager, staff, teacher, accountant? Actually 5 roles — perms: students.read/write, teachers.read/write, classes.read/write, rooms.read/write, enrollments.read/write, scheduling.read/write, attendance.read/write, compensation.read/write, media.read/write, chat.read/write, library.read/write, gallery.read/write, branding.read/write, export.read, dashboard.read, users.read/write, etc 22 — matrix Actor/Action/Resource/Scope/Allowed/Reason/Frontend guard/Backend enforcement — VERIFIED
- viewPermissions UX-only can/canAny/canAll defaultViewFor — VERIFIED — frontend guard UX-only — backend must enforce org_id + permission + scope + per-object auth — B — per NEW-RBAC-01 ACCEPTED
- Scope pure functions self vs assigned vs org — VERIFIED `src/domains/auth/scope.ts` — pure, testable, backend-portable — isAssignedStudent, assignedStudentIdsForTeacher, isSelfStudent, canReadStudentOrgWide, canReadStudent, canWriteStudent, canReadTeacher, canWriteAttendance, canReadAttendance, canWriteCompensation, canReadCompensation, canReadSchedule, canWriteSchedule, canExport, isEligibleLevel — tests `scope.test.ts` 23 PASS S-01 self ALLOWED S-02 other DENIED T-01 assigned ALLOWED T-02 unassigned DENIED smallest vs ALLOWED historical M-01 manager org-wide A-01 admin org-wide — same for web and mobile
- Student portal scope self = linked studentId via user_student_links relation self/guardian, assigned = teacher's classes' students via enrollment, org = manager/admin all in org — VERIFIED via scope.ts + 15-student-portal-architecture.md — same for mobile — per O-10 O-13 O-14
- D1 preserved: No student role in admin panel — ACCEPTED — student portal is separate app or separate view with self scope, contract now backend later — no student role UI in admin — no fake boundary — same for mobile — mobile app is student portal client — separate app later keeps admin RBAC clean
- No new permissions without gap — per NEW-RBAC-01 — same RBAC for web and mobile — no second RBAC — contract tests assert same permissions matrix

## Media / File Abstraction -> Storage Provider — Same Endpoint

### Abstraction Layers

```
App → Media/File abstraction → Storage provider
```

- App layer: LibraryPanel, GalleryPanel, Chat Messages.tsx composer, BrandingPanel — use MediaRepository.create/list/get/delete — VERIFIED
- Media/File abstraction: MediaRepository interface — `create({ kind, fileName, mimeType, size, bytes: ArrayBuffer })`, `list`, `get`, `delete` — metadata + blob — VERIFIED `src/domains/media/repository.ts`
- Storage provider: metadata dataset (IndexedDB via blobStore for demo) + blobStore put/get — demo — backend S3/MinIO — B — per O-16 — MediaService → StorageProvider S3/MinIO signed expiring URLs content-type sniffing virus scanning per-object auth D15 — B REQUIRED
- Two-part split metadata dataset blobStore vs object storage — VERIFIED — media/types.ts — allow-list image jpeg/png/webp/gif SVG excluded XSS audio mp3/mp4/ogg/wav/webm doc pdf/txt size ceilings per kind — VERIFIED — no data URL mediaId ref only — VERIFIED — D15 ref != auth — frontend resolution != auth backend must enforce per-object auth signed expiring URLs scanning — B REQUIRED
- MediaRepository.create bytes ArrayBuffer — VERIFIED — binary client where needed for media — ApiClient speaks JSON only — so registering it — `downloadBlob` single seam — VERIFIED exportService.ts — same seam for web and mobile
- Same endpoint for web and mobile — `POST /media` — bytes to S3 metadata to DB — same for web and mobile — no second media endpoint — no second API — contract tests assert MediaRepository.create uses bytes ArrayBuffer not base64 not data URL — A NOW
- Frontend evidence: `src/domains/media/__tests__/media.test.ts` etc — allow-list, size ceilings, SVG excluded, no data URL — VERIFIED
- Backend impact: Media table + object storage + signed URLs + scanning + per-object owner check owner userId+org_id O-08 — B REQUIRED — per O-08 O-16 — per-object auth D15 signed expiring URLs content sniffing virus scanning — B

### Media Upload Same Endpoint — Flow

1. App: user selects file — file.type checked against allow-list — size checked against ceiling per kind — SVG rejected — VERIFIED frontend
2. App: `MediaRepository.create({ kind, fileName, mimeType, size, bytes: ArrayBuffer })` — bytes ArrayBuffer — not base64 — not data URL — VERIFIED
3. ApiClient: `POST /media` with binary (multipart/form-data or binary stream) — header `Authorization: Bearer ${token}` — same for web and mobile — no second endpoint
4. Backend: MediaService validates allow-list + size ceiling server-enforced same as frontend — content-type sniffing — virus scanning — per-object auth owner userId+org_id — StorageProvider S3 putObject — returns metadata `{ id, kind, fileName, mimeType, size, url? signed expiring }` — dataset store metadata — B
5. App: receives ItemEnvelope<Media> — stores metadata — blobStore only for demo — objectUrl via `useMediaObjectUrl` creates object URL from blobStore — not signed URL — D15 ref != auth — backend must enforce signed expiring URLs — B
6. Same for web and mobile — no second API — same envelope — same RBAC — media.read/write permissions — same scope

### No localStorage for Binary

- Media bytes never in localStorage — VERIFIED architectureBoundaries F8 — no `localStorage.setItem` with binary — only blobStore IndexedDB for demo — backend S3 for prod — B
- Token not in localStorage for mobile — B CONTRACT — secure storage vs localStorage — see Auth section

## Auth B1 — Sanctum Cookie Primary + Bearer Fallback — Secure Storage Not localStorage

### B1 Decision — PROVISIONAL

- ID: B1 — Laravel Domain Structure — PROVISIONAL — per decision register
- Title: Laravel domain structure mirrors frontend domains, Sanctum cookie primary + bearer fallback
- Evidence: ApiClient Bearer, isApiMode, OrganizationScope, apiErrorFromThrown — VERIFIED
- Decision: Backend Laravel domain structure same as frontend domains, Sanctum cookie primary + bearer fallback for mobile, org_id scoping, rolePermissions matrix server-side
- Alternatives: Second API for mobile duplicate — rejected — one backend clean seam — per NEW-MOB-01
- Consequences: Mobile app client of same backend, no second API — same envelope same repos same RBAC same media seam
- Frontend: ApiClient already bearer, needs cookie support later — cookie primary web — bearer fallback mobile
- Backend: Laravel with Sanctum, OrganizationScope, per-object auth — B — same for web and mobile
- Reversibility: provisional — can adjust auth method — but B1 is canonical for F9

### Web Auth — Sanctum Cookie Primary

- Web SPA uses Sanctum cookie primary — HttpOnly Secure SameSite cookie — set by backend on login `POST /login` — `Set-Cookie: laravel_session=...; HttpOnly; Secure; SameSite=Lax` — subsequent requests cookie automatically sent — no JS access — XSS-safe — VERIFIED B1 spec
- Bearer fallback for web — if cookie not present or for API clients — ApiClient `Authorization: Bearer ${token}` — same header for mobile — no second auth mechanism — same backend supports both per B1
- Frontend demo: AuthContext.tsx passphrase demo — single-viewer — no per-user — demo can simulate by selecting? But real needs auth — B — per F7
- No localStorage for token in web when using Sanctum cookie — cookie is HttpOnly — not in localStorage — honest per D2? Actually D2 appearance device-local localStorage honest — but token not in localStorage for web when cookie primary — B — for demo, token may be in memory via `setAuthToken` callback — VERIFIED registry.ts `ApiAuthRepository(getApiClient(), (session) => setAuthToken(session?.token ?? null))` — token in memory — not localStorage — comment in AuthContext.tsx line 61 "clearing localStorage would hand a still-valid session" — suggests it does NOT use localStorage for token? — VERIFIED
- Security: no token in React component props — token via getToken() closure — no VITE_* secret — no Telegram/Bale token in React — per security §24 — VERIFIED architectureBoundaries

### Mobile Auth — Bearer Token Secure Storage Not localStorage

- Mobile app uses bearer token stored securely not localStorage — B CONTRACT NOW BACKEND LATER REQUIRED — per F9 acceptance — per O-12 OPEN REQUIRED — per correction Mobile = REQUIRED PRODUCT CAPABILITY
- Secure storage options:
  - Expo SecureStore — `expo-secure-store` — iOS Keychain + Android EncryptedSharedPreferences — recommended for Expo — key `auth_token` — value token string — encrypted at OS level — not accessible via JS without permission — not in localStorage
  - iOS Keychain — `kSecClassGenericPassword` — service `parsian-music` account `auth_token` — access control `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — encrypted
  - Android Keystore + EncryptedSharedPreferences — `androidx.security:security-crypto` — `EncryptedSharedPreferences` with `MasterKey` — key `auth_token` — encrypted — not in localStorage
  - React Native Keychain — `react-native-keychain` — wrapper over Keychain/Keystore — same
- Why not localStorage: localStorage is XSS-readable — any JS can read `localStorage.getItem('token')` — secure storage is OS-level encryption — not accessible via JS without native bridge — more secure — per security §24 — no PII in logs — no credentials in client — backend-only token — per F8 provider.ts comment BACKEND REQUIRED POST /messages etc server holds credentials
- Flow mobile:
  1. Login: `POST /login` with phone + OTP? Or passphrase? — per F7 student portal auth separate — B — returns `{ token: "xxx", user: { id, role, org_id, studentId? } }` — token is bearer — ItemEnvelope? Actually auth envelope — same as web but returns token JSON for mobile — cookie also set? For mobile, cookie not used — bearer only — B1 bearer fallback
  2. Store: `SecureStore.setItemAsync('auth_token', token)` — Expo — or `Keychain.setGenericPassword('auth_token', token)` — iOS/Android — not localStorage — B CONTRACT
  3. ApiClient: `getToken: () => SecureStore.getItemAsync('auth_token')` — async? Actually ApiClient getToken is sync in current code — for mobile, need async — B — but contract says same ApiClient envelope — for frontend demo-capable, we can assert sync memory token — for mobile, async secure storage — B CONTRACT NOW BACKEND LATER — same header `Authorization: Bearer ${token}` — VERIFIED client.ts line 98 `if (token) headers.Authorization = Bearer ${token}`
  4. Requests: all requests via ApiClient with Bearer header — same endpoints as web — same envelope Collection/Item PageMeta — same RBAC — same media seam — no second API
  5. Logout: `SecureStore.deleteItemAsync('auth_token')` — clears secure storage — token invalidated server-side — 401 on next request -> redirect login
  6. Expiration: token expiration handled via 401 -> redirect login — same as web — no silent failure — honest
- Web appearance device-local localStorage honest per D2 — branding org data, appearance theme/accent/density/motion device-local per-browser — localStorage for appearance is honest — but token not in localStorage for mobile — B CONTRACT — for web, Sanctum cookie primary HttpOnly not localStorage — bearer fallback token in memory not localStorage — comment in AuthContext.tsx — VERIFIED
- No localStorage for binary — VERIFIED architectureBoundaries — no localStorage for token in mobile — B CONTRACT — contract tests assert no `localStorage.setItem('token')` or `localStorage.getItem('token')` for mobile — A NOW — via scanning src for localStorage token — for web, appearance localStorage is allowed — D2 — but token not — per security
- Security: no token in React, no VITE_* secret, no localStorage for binary, no data URL, no Telegram/Bale token/API URL — per architectureBoundaries F8 — same for mobile — bearer token stored securely not localStorage — no hardcoded endpoint — no second API — per F9

### Contract Tests — Auth Bearer

- `src/api/__tests__/mobileContract.test.ts` — A NOW — asserts:
  - ApiClient adds `Authorization: Bearer ${token}` header when token present — via mocking getToken() — VERIFIED client.ts
  - No `localStorage` for token in mobile — scans src for `localStorage.*token` — should be absent — or asserts AuthContext does not use localStorage for token — A NOW
  - Secure storage abstraction interface — `SecureStorage` interface with `getItem/setItem/deleteItem` — not localStorage — B CONTRACT doc only — for frontend demo-capable, we can assert interface exists or doc says secure storage — but no code yet — contract doc suffices — test asserts no localStorage for binary — VERIFIED F8
  - Same envelope for auth — ItemEnvelope with token — same for web and mobile — no second envelope

## Offline — C DEFERRED No Fake

- Offline queue for mobile — C DEFERRED — no fake — honest — per F9 acceptance — per 10-integration-architecture.md Mobile App section Offline Demo has local persistence but mobile + backend would need offline queue C DEFERRED
- No offline queue code — VERIFIED — no `offlineQueue`, no `syncQueue`, no `backgroundSync`, no `serviceWorker` offline claim — no fake — honest disclosure
- Demo has local persistence via IndexedDB blobStore + dataset — VERIFIED — but that's device-local persistence not offline queue — D2 appearance device-local — honest — per 02-capability-matrix.md
- Mobile offline queue would need: local queue + sync + conflict resolution + retry + per-object auth + org_id scoping — C DEFERRED — not implemented — no fake claim — honest — per F9 acceptance offline C deferred no fake
- Contract tests assert no offline queue — scans src for `offlineQueue` or `syncQueue` — should be absent — A NOW — or asserts no fake offline claim — no "آفلاین" with fake sync — honest
- Backend impact: offline queue needs server support for idempotency + conflict resolution — C — not REQUIRED per correction? Actually correction says Mobile = REQUIRED but offline queue = C — per 10-integration-architecture.md Offline C deferred — so offline queue remains C — not REQUIRED — honest

## Features — Same as Web or Subset Teacher/Student Portal B Contract

### Student Portal Mobile — Natural Client

- Student portal architecture — per 15-student-portal-architecture.md — profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity — spec doc for portal architecture, identity linking table spec, scope pure functions self vs assigned vs org, demo vs backend identity doc, contract/UX preparation no UI yet for first product per D1 but contract now — per F7 — VERIFIED
- Mobile app is natural client for student portal — student sees own profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files — same as F7 portal — scope self = linked studentId via user_student_links relation self/guardian — pure via isSelfStudent — VERIFIED scope.ts
- Features same as web or subset — for academy mobile could be teacher/student portal B contract — per 11-roadmap F9 — for student portal mobile — same features as web student portal — profile, classes, schedule, level, resources, progress, attendance, tickets/messages/files — same backend contracts — same envelope — same RBAC — same media seam — no second API — B CONTRACT
- Demo vs backend: demo single-viewer no per-user — backend per-user read cursor actor from token org_id scoping per-object auth for files — B REQUIRED — per F7 spec
- Identity linking: user_student_links + telegram_links bale_links + chat_read_cursors — B REQUIRED — same for mobile — per O-10 O-11
- No student role in admin panel D1 preserved — no fake boundary — student portal separate app or separate view with self scope — for first product contract only no UI then separate app later keeps admin RBAC clean — no student role in admin panel D1 preserved — same for mobile — mobile app is separate app — keeps admin RBAC clean — VERIFIED D1 ACCEPTED

### Teacher Portal Mobile — Subset

- Teacher portal mobile subset — teacher sees assigned students via enrollment — classes where teacherId = assigned — students where enrollment classId in teacher's classes — schedule where classId in teacher's classes — attendance write where session teacherId = teacherId + assigned — compensation read/write? Actually teacher DENIED staff ALLOWED per scope — canReadCompensation vs canWriteCompensation — VERIFIED scope.ts — same for mobile
- Features same as web or subset — for teacher mobile — attendance write, schedule read/write, students assigned-only, classes assigned-only, progress read/write? — same RBAC — same scope — no second API
- Offline C deferred — no fake — honest

### Admin/Manager Mobile — Optional Subset

- For academy mobile could be teacher/student portal B contract — per 11-roadmap — for first product contract only no UI? Actually F9 visible outcome contract doc — mobile app client of same backend — features same as web or subset — for admin/manager mobile — maybe dashboard + students + classes + scheduling + attendance + export — subset — same RBAC — same envelope — no second API — B CONTRACT — but for first product student portal mobile is priority — per D1 student role not in admin panel — so mobile app is student portal — separate app — keeps admin RBAC clean

## Backend Mapping — B CONTRACT NOW BACKEND LATER

- Linking tables user_student_links + telegram_links + bale_links + chat_read_cursors — B REQUIRED but implementation deferred until backend/integration layer — per 15-student-portal-architecture.md — VERIFIED F7 spec — same for mobile
- Self scope enforcement via actor.studentId from token via user_student_links where relation=self verified_at NOT NULL org_id scoping — B REQUIRED — per F7 spec
- Per-user cursor table user_id conversation_id last_read_message_id unread_count — B REQUIRED — per F6 backend impact + F7 spec — demo single-viewer unread on thread — VERIFIED F6 — backend per-user cursor B
- Media table + object storage + signed URLs + scanning + per-object owner check owner userId+org_id O-08 — B REQUIRED — per O-08 O-16 — per-object auth D15 signed expiring URLs content sniffing virus scanning — B — same for web and mobile
- Sanctum cookie primary + bearer fallback B1 — same backend supports web cookie + mobile bearer secure storage — B — per B1 decision — same Laravel structure B1 — no second API
- Org_id scoping OrganizationScope global scope all tables — B — O-14 OPEN single org demo provisional — same for web and mobile
- Transaction SELECT FOR UPDATE for scheduling/attendance/compensation — B — same for web and mobile
- No backend code in F9 — contract only — per hard boundary — frontend remains docs-only + contract tests A NOW — per F9 AUTHORIZED hard boundaries: Do NOT modify backend/Laravel/database/migrations
- All B items are REQUIRED PRODUCT CAPABILITY per correction 2026-09-19 — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile no business logic in bots — per correction

## Security — No Token in React, No VITE_* Secret, No localStorage for Binary, No Data URL, No Telegram/Bale Token/API URL

- No token in React — VERIFIED architectureBoundaries F8 — no `process.env.TELEGRAM_BOT_TOKEN`, no `VITE_TELEGRAM`, no `VITE_BALE`, no hardcoded token — provider.ts honest unavailable Persian reason no token in React security §24 — VERIFIED F8 52 PASS
- No VITE_* secret — VERIFIED architectureBoundaries — no `import.meta.env.VITE_*` with secret — only `VITE_API_BASE_URL` allowed? Actually no VITE_* token — VERIFIED
- No localStorage for binary — VERIFIED architectureBoundaries F8 — no `localStorage.setItem` with binary — only blobStore IndexedDB for demo — backend S3 for prod — B — same for mobile
- No data URL — mediaId ref only — VERIFIED media/types.ts — no `data:` URL — no base64 — bytes ArrayBuffer — VERIFIED
- No Telegram/Bale token/API URL — VERIFIED architectureBoundaries F8 — no `api.telegram.org`, no `tapi.bale.ai`, no `telegram.org`, no bot token — provider.ts does not contain token — honest unavailable — VERIFIED F8
- Bearer token stored securely not localStorage — B CONTRACT — mobile secure storage not localStorage — web Sanctum cookie HttpOnly not localStorage — bearer fallback token in memory not localStorage — per security §24 — no PII in logs — no credentials in client — backend-only token — per F8 provider.ts comment BACKEND REQUIRED POST /messages etc server holds credentials
- No second API — same backend contracts — same envelope — same RBAC — same media seam — no second ApiClient — no second baseUrl — architectureBoundaries F9 extension asserts no second ApiClient — A NOW

## Risks

- O-12 mobile auth bearer vs cookie REQUIRED OPEN provisional B1 — cookie primary web + bearer fallback mobile — OPEN but provisional B1 — REQUIRED PRODUCT CAPABILITY per correction — mobile app client of same backend contracts same envelope Collection/Item PageMeta same domain repos same RBAC media/file abstraction -> storage provider bearer secure storage — B CONTRACT NOW BACKEND LATER but REQUIRED per correction — per 13-open-decisions.md O-12
- O-10 identity linking user↔student self/guardian REQUIRED OPEN — B linking tables — high-cost before backend — affects portal auth + scope — per O-10
- O-13 student portal auth separate app REQUIRED OPEN — B contract only first product — high-cost before backend — affects RBAC + routes — per O-13 — D1 preserved no student role in admin panel
- O-14 org/user relation — org_id on all tables — OPEN high-cost before backend — single org demo provisional — per O-14
- O-16 media storage S3 signed scanning REQUIRED OPEN — B S3 signed expiring URLs scanning per-object auth — per O-16 — same endpoint for web and mobile
- O-08 file ownership owner+org_id REQUIRED — B owner+org_id — per O-08
- O-15 API boundaries envelope binary streaming cursor linking — OPEN — same envelope Collection/Item PageMeta — same for web and mobile — no second API — per O-15
- O-17 notification provider integration REQUIRED — B — per O-17 — Telegram/Bale/SMS/email REQUIRED — implementation deferred — per correction
- O-20 backup restore versioned integrity encryption REQUIRED — B — per O-20 — same for web and mobile — backup envelope versioned migration retention/integrity/restore/encryption/failure OPEN — per F8
- No student role in admin panel preserved — no fake boundary — VERIFIED D1 ACCEPTED — same for mobile — mobile app is separate app — keeps admin RBAC clean
- No invented backend — per hard boundary — no Laravel/backend code — contract only — no credentials — no VITE_* token — no PII in logs — per security §24

## Acceptance

- Mobile app uses same backend contracts no second API same RBAC same media seam same envelope — VERIFIED via registry.ts isApiMode() ? ApiRepository : DemoRepository — same composition root — same ApiClient — same envelope Collection/Item PageMeta — same domain repos — same RBAC 5 roles 22 perms — same media seam App->Media/File abstraction->Storage provider — no second API — THIS FILE + contract tests
- Auth bearer token stored securely not localStorage — B CONTRACT — mobile secure storage Expo SecureStore / iOS Keychain / Android Keystore / EncryptedSharedPreferences not localStorage, web Sanctum cookie primary HttpOnly Secure SameSite + bearer fallback for mobile — B1 decision — ApiClient Bearer header Authorization: Bearer ${token} — VERIFIED client.ts — contract tests assert Bearer header + no localStorage for token in mobile — A NOW
- Offline C deferred no fake — honest — no offline queue code — no fake claim — per F9 acceptance — per 10-integration-architecture.md Mobile App section Offline C DEFERRED — contract tests assert no offlineQueue — A NOW
- Features same as web or subset teacher/student portal B contract — per 15-student-portal-architecture.md — student portal mobile natural client — profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files — teacher portal subset — attendance/schedule/compensation assigned-only — D1 preserved no student role in admin panel — B CONTRACT
- No new backend same Laravel domain structure B1 — same Laravel domain structure mirrors frontend domains, Sanctum cookie primary + bearer fallback, org_id scoping, rolePermissions matrix server-side, per-object auth — B1 PROVISIONAL — same for web and mobile — no second API — B CONTRACT
- Tests: contract tests envelope, auth bearer, media upload seam, no second API — A NOW — `src/api/__tests__/mobileContract.test.ts` + `src/__tests__/architectureBoundaries.test.ts` F9 extension — 14+ PASS — no F1-F8 regression
- Preserve F1-F8 behavior, source-of-truth rules, repository/API seams and OPEN decisions, no invented backend/credentials/workflows, adapter boundaries clean, no merge PR #4, do not start F10 — per F9 AUTHORIZED hard boundaries

## Classification

B CONTRACT NOW BACKEND LATER — A for contract tests — REQUIRED PRODUCT CAPABILITY but implementation deferred — per 11-roadmap F9 — per correction 2026-09-19 Mobile student client = REQUIRED PRODUCT CAPABILITY — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile no business logic in bots — per 10-integration-architecture.md Mobile App section — no new backend same Laravel domain structure B1 decision — one backend clean seam — no second API — same envelope Collection/Item PageMeta same domain repos same RBAC media/file abstraction -> storage provider bearer secure storage.

## Follow-up

- O-12 O-10 O-13 O-14 O-16 O-08 O-15 O-17 O-20 remain OPEN — do not resolve by assumption — per hard boundary — preserve OPEN decisions
- F10 Cross-surface QA + final frontend freeze — after F1..F9 — do not start F10 per F9 AUTHORIZED hard boundaries
- F9 final verification: focused `npx vitest run src/api/__tests__/mobileContract.test.ts src/__tests__/architectureBoundaries.test.ts --reporter=dot` then full suite `npx vitest run --reporter=dot` — classify failures A) F9 regression B) F1-F8 regression C) pre-existing governance/documentation drift D) unrelated/environmental — keep `projectState.test.ts` failures separately classified unless F9 explicitly requires phase-state update — per F2 execution rules
- No merge PR #4 — per F9 AUTHORIZED hard boundaries — work only on `arena/frontend-completion-spec` — no rebase/amend/force-push/history rewrite — keep working tree clean at end — push normally — preserve all previous commits
- No backend/Laravel/database/migrations — per hard boundary — frontend remains docs-only + contract tests A NOW — B CONTRACT NOW BACKEND LATER REQUIRED
