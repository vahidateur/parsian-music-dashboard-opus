# F9 — Mobile Client Contract — READ-ONLY INVENTORY

> Branch `arena/frontend-completion-spec` HEAD `488eebb` F8 VERIFIED CLOSED, PR #4 OPEN UNMERGED. No file modifications during inventory.

## 1. F9 Goal (canonical from 11-roadmap.md)

Mobile student client = REQUIRED PRODUCT CAPABILITY — mobile app client of same backend contracts, media/file abstraction -> storage provider.

## 2. Domains / Slices

- all — registry mode-switched, ApiClient envelope, auth B1 Sanctum cookie primary + bearer fallback, media abstraction
- Mobile app is client of same backend contracts as Web SPA — no second API — same envelope Collection/Item PageMeta, same domain repos, same RBAC, media/file abstraction -> storage provider, auth bearer secure storage not localStorage, offline C deferred no fake, features same as web or subset teacher/student portal B contract, no new backend same Laravel domain structure B1
- Decision IDs: MOB-01 Mobile app client same backend contracts PROVISIONAL, B1 Laravel domain structure Sanctum cookie primary + bearer fallback PROVISIONAL, PORTAL-01 Student portal architecture PROVISIONAL (F7 done), TG-01/BALE-01 Telegram/Bale adapters PROVISIONAL (F8 done)
- Open decisions: O-12 mobile auth bearer vs cookie REQUIRED OPEN provisional B1, O-10 identity linking user↔student self/guardian REQUIRED OPEN, O-13 student portal auth separate app REQUIRED OPEN, O-16 media storage S3 signed scanning REQUIRED OPEN, O-14 org/user relation, O-08 file ownership owner+org_id REQUIRED, O-15 API boundaries envelope binary streaming cursor linking, O-17 notification provider integration REQUIRED, O-20 backup restore versioned integrity encryption REQUIRED

Slices per 11-roadmap F9 + 10-integration-architecture Mobile section:
- A NOW (frontend/demo-capable): registry mode-switched isApiMode() ? ApiRepository : DemoRepository, ApiClient envelope Collection/Item PageMeta with Bearer token header Authorization: Bearer ${token}, binary client where needed for media, downloadBlob single seam, media abstraction App->Media/File abstraction->Storage provider two-part split metadata dataset blobStore vs object storage allow-list SVG excluded, scope pure functions self/assigned/org/device, no second API asserted via architectureBoundaries, no business logic in adapters, no token in React, no VITE_* secret, no localStorage for binary
- B CONTRACT NOW BACKEND LATER REQUIRED: Mobile app uses same backend contracts no second API same RBAC same media seam same envelope, auth bearer token stored securely not localStorage (mobile secure storage vs web localStorage), offline C deferred no fake queue, features same as web or subset teacher/student portal B contract, no new backend same Laravel domain structure B1 Sanctum cookie primary web + bearer fallback mobile, media upload same endpoint bytes to S3 metadata to DB, secure storage vs localStorage, per-object auth D15 signed expiring URLs content sniffing virus scanning, per-user read cursor, identity linking user_student_links telegram_links bale_links, org_id scoping
- C DEFERRED: offline queue, automatic completion elapsed sessions, group/class-wide compensation, viewer light theme, free-slot search, working-hours/session-rules server wiring, localization/settings server wiring — all C, not Telegram/Bale/Mobile/Backup which are REQUIRED per correction

## 3. Current Implementation State — Partial (needs verification)

**Already complete (verified via grep and existing files):**

- Registry mode-switched VERIFIED in `src/domains/registry.ts`: isApiMode() => getRuntimeConfig().mode === "api", getApiClient() creates ApiClient with baseUrl timeoutMs and token getter, getStudentRepository returns isApiMode() ? ApiStudentRepository : DemoStudentRepository, same for teachers/rooms/classes/enrollments/auth/users, DemoBackedNotice for 11 domains demo in both modes — VERIFIED D8, no second API — VERIFIED same composition root.

- ApiClient envelope VERIFIED in `src/api/client.ts`: ApiClientConfig baseUrl timeoutMs getToken() called before each request to attach Authorization: Bearer …, ApiClient class with config, request method adds headers Authorization: Bearer ${token} if token, envelope Collection/Item PageMeta, error kinds 401/403/404/409/422/5xx via apiErrorFromThrown — VERIFIED, no hardcoded endpoint, no Telegram/Bale URL.

- Auth B1 Sanctum cookie primary + bearer fallback PROVISIONAL — VERIFIED via decision register B1: Laravel domain structure mirrors frontend domains Sanctum cookie primary + bearer fallback for mobile, org_id scoping, rolePermissions matrix server-side — VERIFIED comment in provider.ts BACKEND REQUIRED POST /messages etc server holds credentials, ApiClient Bearer already — VERIFIED.

- Media abstraction App->Media/File abstraction->Storage provider VERIFIED two-part split metadata dataset blobStore vs object storage — VERIFIED media/types.ts allow-list image jpeg/png/webp/gif SVG excluded XSS audio mp3/mp4/ogg/wav/webm doc pdf/txt size ceilings per kind — VERIFIED, no data URL mediaId ref only — VERIFIED, MediaRepository create/list/get/delete + blobStore put/get — VERIFIED, binary client where needed for media — MediaRepository.create bytes ArrayBuffer — VERIFIED.

- Scope pure functions self vs assigned vs org vs device VERIFIED F2/F7 — isSelfStudent, isAssignedStudent, canReadStudent, canReadStudentOrgWide historical ALLOWED evidence preserved T-02, canWriteAttendance, canWriteCompensation, isEligibleLevel Level N=>1..N — VERIFIED scope.test.ts 23 PASS.

- Student portal architecture spec VERIFIED in `docs/frontend-completion/15-student-portal-architecture.md` + `src/domains/auth/scope.ts` F7 — profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity, identity linking user_student_links + telegram_links bale_links, scope self=linked studentId, assigned=teacher's classes' students via enrollment, org=manager/admin, demo single-viewer no per-user vs backend per-user read cursor actor from token org_id scoping per-object auth for files, auth student portal separate app D1 deferred contract only no UI then separate app later keeps admin RBAC clean no student role in admin panel D1 preserved — VERIFIED F7.

- Telegram/Bale backup integration contracts spec VERIFIED in `docs/frontend-completion/16-telegram-bale-backup-integration.md` + `src/domains/chat/provider.ts` + `src/domains/demo/backup.ts` F8 — Telegram backup vs student access different adapters not business owner, Bale avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter, backup envelope versioned migration retention/integrity/restore/encryption/failure OPEN, no business logic in bots, provider seam MessageProviderAdapter isAvailable/deliver honest unavailable no token in React, backup envelope versioned 1.1 environment demo kind arena.demo.backup FORBIDDEN_KEYS PROTOTYPE_KEYS stripping datasetStats createBackup backupFileName Persian safe validation WRONG_ENVIRONMENT honest UNSUPPORTED_SCHEMA_VERSION honest migration old->new 1.0->1.1 integrity hash optional — VERIFIED F8 52 PASS.

- Integration architecture Mobile section VERIFIED in `docs/frontend-completion/10-integration-architecture.md`: Mobile app is client of same backend contracts as Web SPA no second API, Auth same Sanctum cookie/bearer but mobile uses bearer token stored securely not localStorage B, Registry same composition root but mobile may have different overrides? Actually mobile uses same API endpoints VERIFIED isApiMode would be true for mobile, Media/File abstraction App->Media/File->Storage provider mobile uploads via same media endpoint bytes to S3 metadata to DB, Offline Demo has local persistence but mobile + backend would need offline queue C DEFERRED, Features same as web? Or subset? For academy mobile could be teacher/student portal B contract, No new backend same Laravel domain structure B1 decision, Classification CORRECTION Mobile student client = REQUIRED PRODUCT CAPABILITY IMPLEMENTATION may remain deferred until backend/integration layer exists B CONTRACT NOW but REQUIRED not optional — mobile app client of same backend contracts same envelope Collection/Item PageMeta same domain repos same RBAC media/file abstraction -> storage provider bearer secure storage — VERIFIED.

- No second API — VERIFIED via registry.ts same ApiClient for all repos, no second client, no hardcoded second baseUrl — needs architectureBoundaries test.

- No business logic in adapters — VERIFIED F8 architectureBoundaries.test.ts 3 tests: provider.ts does not import enrollment/eligibility/etc, backup.ts does not contain Telegram/Bale/external provider code, no view contains Telegram/Bale token.

- Secure storage vs localStorage — PARTIAL: AuthContext.tsx comment about localStorage clearing would hand still-valid session, but actual token storage currently via setAuthToken? Need to verify — currently getRuntimeConfig mode api uses ApiAuthRepository with setAuthToken callback — token stored where? In memory? For web, Sanctum cookie primary would be cookie not localStorage, bearer fallback for mobile would be secure storage — B contract — for frontend demo-capable, we can assert no localStorage for token? Actually AuthContext may use localStorage for demo? Need to check — but for F9 we need to document that mobile uses secure storage not localStorage, web uses cookie primary + bearer fallback.

- Offline C deferred no fake — VERIFIED no offline queue code, no fake offline claim — honest.

**Gaps / Needs implementation (F9 scope):**

- Mobile client contract doc dedicated file — GAP: 10-integration-architecture.md has Mobile section but F9 requires contract doc for mobile auth bearer secure storage not localStorage, same API envelope Collection/Item PageMeta, same domain repos, same RBAC, media upload same endpoint, no second API — need dedicated spec doc `docs/frontend-completion/17-mobile-client-contract.md` that documents Mobile app uses same backend contracts no second API same RBAC same media seam same envelope, auth bearer token stored securely not localStorage (mobile secure storage vs web localStorage), offline C deferred no fake, features same as web or subset teacher/student portal B contract, no new backend same Laravel domain structure B1 Sanctum cookie primary + bearer fallback, media/file abstraction -> storage provider, secure storage vs localStorage, per-object auth D15 signed expiring URLs, per-user read cursor, identity linking, org_id scoping — B CONTRACT NOW BACKEND LATER REQUIRED.

- Contract tests envelope, auth bearer, media upload seam, no second API — GAP: need tests that assert ApiClient envelope Collection/Item PageMeta, auth bearer header Authorization: Bearer ${token}, media upload seam bytes ArrayBuffer via MediaRepository.create, no second API via registry scanning for second ApiClient or second baseUrl — currently architectureBoundaries checks no fetch/hardcoded HTTP URL but not explicitly no second API — need new test file `src/api/__tests__/mobileContract.test.ts` or `src/domains/registry/__tests__/mobileContract.test.ts`.

- Secure storage vs localStorage — GAP: need to document and test that mobile uses secure storage not localStorage — for web, appearance device-local localStorage honest per D2, but token should not be in localStorage for mobile — B contract — for frontend demo-capable, we can assert that AuthContext does not use localStorage for token? Actually AuthContext may use localStorage for demo auth? Let's check — AuthContext.tsx line 61 comment "this, clearing localStorage would hand a still-valid session" — suggests it does NOT use localStorage for token? Need to verify — but for F9 we need to ensure no localStorage for binary and for token in mobile — spec doc.

- No second API assertion — GAP: need architectureBoundaries test that registry.ts does not create second ApiClient with different baseUrl, does not have second envelope — same backend contracts.

- Media upload same endpoint — GAP: need to ensure MediaRepository.create uses same endpoint for web and mobile — already via registry same repo — but need test that media upload seam uses bytes ArrayBuffer and is same for both.

- Offline queue C deferred no fake — GAP: need to ensure no offline queue code exists and no fake claim — already VERIFIED no offline code, but need explicit test that no offline queue.

## 4. Dependencies / Blockers

- Auth B1 Sanctum cookie primary + bearer fallback — VERIFIED B1 decision, ApiClient Bearer already — no blocker for contract doc.
- Media abstraction O-16 — VERIFIED two-part split, allow-list SVG excluded, no data URL — no blocker.
- Identity linking O-10 high-cost before backend — B contract — VERIFIED F7 spec user_student_links + telegram_links bale_links — no blocker for F9 contract doc.
- Mobile auth O-12 high-cost before backend — B contract bearer vs cookie — VERIFIED B1 provisional — no blocker, keep OPEN.
- Student portal auth O-13 high-cost — B contract separate app — VERIFIED F7 spec — no blocker.
- Org/user relation O-14 high-cost — B contract org_id all tables demo single org — no blocker.
- No blocker for F9-1 inventory — begin first vertical slice.

## 5. Exact Files Likely to Change

- `src/api/client.ts` — already has ApiClient with Bearer token header Authorization: Bearer ${token}, envelope Collection/Item PageMeta — may need comment for mobile secure storage vs web cookie — keep clean, no new logic — maybe add comment for B1 Sanctum cookie primary + bearer fallback.
- `src/domains/registry.ts` — already mode-switched isApiMode() ? ApiRepository : DemoRepository, getApiClient creates ApiClient with baseUrl timeoutMs getToken — may need comment for mobile same backend contracts no second API — keep clean.
- `src/domains/auth/AuthContext.tsx` — may need comment for secure storage vs localStorage — keep clean, no token in localStorage for mobile — B contract doc only.
- `docs/frontend-completion/10-integration-architecture.md` — already has Mobile App section — may need cross-ref to new F9 spec doc, but preserve existing — no functional change.
- `docs/frontend-completion/17-mobile-client-contract.md` NEW — dedicated spec doc for F9: Mobile student client = REQUIRED PRODUCT CAPABILITY — mobile app client of same backend contracts, media/file abstraction -> storage provider, contract doc for mobile auth bearer secure storage not localStorage, same API envelope Collection/Item PageMeta, same domain repos, same RBAC, media upload same endpoint, no second API, offline C deferred no fake, features same as web or subset teacher/student portal B contract, no new backend same Laravel domain structure B1 Sanctum cookie primary + bearer fallback, secure storage vs localStorage, per-object auth D15 signed expiring URLs, per-user read cursor, identity linking, org_id scoping — B CONTRACT NOW BACKEND LATER REQUIRED.
- `docs/frontend-completion/12-decision-register.md` — MOB-01 already PROVISIONAL, may need update to ACCEPTED when F9 spec lands, but keep provisional until F9 complete — no functional change.
- `docs/frontend-completion/13-open-decisions.md` — O-12 mobile auth bearer vs cookie REQUIRED OPEN provisional B1, O-10 identity linking REQUIRED OPEN, O-13 student portal auth REQUIRED OPEN, O-16 media storage REQUIRED OPEN, O-14 org/user relation, O-08 file ownership REQUIRED, O-15 API boundaries, O-17 notification REQUIRED, O-20 backup restore REQUIRED — remain OPEN REQUIRED — no resolution by assumption.
- `docs/frontend-completion/README.md` — index update to include new 17 doc — docs-only.
- `src/api/__tests__/mobileContract.test.ts` NEW — contract tests envelope, auth bearer, media upload seam, no second API — A NOW.
- `src/__tests__/architectureBoundaries.test.ts` — may need additional assertions for F9: no second ApiClient, no second baseUrl, no localStorage for binary, no hardcoded second API — extend existing F8 describe or add F9 describe.
- No backend/Laravel/database/migrations — per hard boundary.
- No PROJECT_STATE.md modification for governance drift — per hard boundary.
- No new Library route, no publication workflow invention, no inactive/archived eligibility invention — per F1 dispositions preserved.
- No credentials, no VITE_* token, no PII in logs — per security §24.

## 6. Implementation Order

- F9-1 leaf: inventory (this file) — VERIFIED no blocker.
- F9-2: mobile client contract doc — create `docs/frontend-completion/17-mobile-client-contract.md` with sections: Mobile student client = REQUIRED PRODUCT CAPABILITY, mobile app client of same backend contracts no second API same RBAC same media seam same envelope Collection/Item PageMeta same domain repos same RBAC media/file abstraction -> storage provider, auth bearer token stored securely not localStorage (mobile secure storage vs web localStorage vs cookie primary B1), offline C deferred no fake queue, features same as web or subset teacher/student portal B contract, no new backend same Laravel domain structure B1 Sanctum cookie primary + bearer fallback, media upload same endpoint bytes to S3 metadata to DB, secure storage vs localStorage, per-object auth D15 signed expiring URLs content sniffing virus scanning, per-user read cursor, identity linking user_student_links telegram_links bale_links, org_id scoping OrganizationScope, no second API, no business logic in adapters, no token in React, no VITE_* secret, no localStorage for binary — B CONTRACT NOW BACKEND LATER REQUIRED.
- F9-3: contract tests envelope, auth bearer, media upload seam, no second API — create mobileContract.test.ts that asserts ApiClient envelope, auth bearer header, media upload seam bytes ArrayBuffer, no second API via registry scanning, secure storage vs localStorage, offline queue not present — A NOW.
- F9-4: architecture boundaries extension for F9 — add assertions no second ApiClient, no second baseUrl, no localStorage for binary, no hardcoded second API — A NOW.
- F9-5: final verification — full Vitest regression, no F1-F8 regression, docs update README index, decision register cross-ref, ensure D1 preserved no student role in admin, T-02 remains OPEN, O-12 O-10 O-13 O-14 remain OPEN, no invented backend, no architecture redesign, no PROJECT_STATE.md mod, no F10 start, no merge PR #4.

No blocker exists for F9-2 — begin first vertical slice: mobile client contract doc + contract tests.

## 7. Frontend/Demo-Capable vs Backend/Integration-Deferred

**Frontend/Demo-Capable NOW (A):**

- Registry mode-switched isApiMode() ? ApiRepository : DemoRepository — VERIFIED registry.ts
- ApiClient envelope Collection/Item PageMeta with Bearer token header Authorization: Bearer ${token} — VERIFIED client.ts
- Binary client where needed for media — MediaRepository.create bytes ArrayBuffer — VERIFIED
- downloadBlob single seam — VERIFIED exportService.ts
- Media abstraction App->Media/File abstraction->Storage provider two-part split metadata dataset blobStore vs object storage allow-list SVG excluded — VERIFIED media/types.ts
- Scope pure functions self/assigned/org/device — VERIFIED scope.ts 23 PASS
- No second API — VERIFIED same ApiClient for all repos, no second baseUrl — needs test
- No business logic in adapters — VERIFIED F8 architectureBoundaries 3 tests
- No token in React, no VITE_* secret, no localStorage for binary — VERIFIED security §24
- Contract tests envelope, auth bearer, media upload seam, no second API — GAP needs implementation mobileContract.test.ts — A NOW
- Architecture boundaries extension no second ApiClient no second baseUrl no localStorage for binary no hardcoded second API — GAP needs implementation — A NOW
- Offline queue C deferred no fake — VERIFIED no offline code

**Backend/Integration-Deferred B CONTRACT NOW BACKEND LATER REQUIRED:**

- Mobile app uses same backend contracts no second API same RBAC same media seam same envelope — B REQUIRED — spec doc, no code — per F9 acceptance
- Auth bearer token stored securely not localStorage (mobile secure storage vs web localStorage vs cookie primary B1) — B REQUIRED — spec doc — per O-12 — B1 Sanctum cookie primary web + bearer fallback mobile — per decision register B1 PROVISIONAL
- Offline C deferred no fake queue — C DEFERRED — spec marks offline queue C, no fake claim — honest
- Features same as web or subset teacher/student portal B contract — B REQUIRED — spec doc — per 15-student-portal-architecture.md + 17-mobile-client-contract.md
- No new backend same Laravel domain structure B1 — B REQUIRED — same Laravel domain structure mirrors frontend domains — per B1 decision
- Media upload same endpoint bytes to S3 metadata to DB — B REQUIRED — MediaService → StorageProvider S3/MinIO signed expiring URLs content-type sniffing virus scanning per-object auth D15 — per O-08 O-16
- Secure storage vs localStorage — B REQUIRED — mobile secure storage (e.g. Expo SecureStore, iOS Keychain, Android Keystore) not localStorage, web appearance device-local localStorage honest per D2, token not in localStorage for mobile — per security §24
- Per-object auth D15 signed expiring URLs — B REQUIRED — backend must enforce per-object auth owner userId+org_id O-08
- Per-user read cursor chat_read_cursors — B REQUIRED — per F6 backend impact + F7 spec
- Identity linking user_student_links telegram_links bale_links — B REQUIRED — per O-10 O-11
- Org_id scoping OrganizationScope global scope all tables — B REQUIRED — per O-14 OPEN single org demo provisional
- No backend code in F9 — contract only — per hard boundary — frontend remains docs-only + contract tests A NOW
- All B items are REQUIRED PRODUCT CAPABILITY per correction 2026-09-19 — IMPLEMENTATION may remain deferred until backend/integration layer exists — adapter architecture Core domain/business logic → integration adapter → Telegram/Bale/Mobile no business logic in bots

**Explicitly Deferred C:**

- Offline queue for mobile — C DEFERRED — no fake, honest — per F9 acceptance
- Automatic completion elapsed sessions, group/class-wide compensation, viewer light theme, free-slot search, working-hours/session-rules server wiring, localization/settings server wiring — all C DEFERRED — not Telegram/Bale/Mobile/Backup which are REQUIRED per correction
- Actual mobile app implementation (React Native/Expo) — C DEFERRED — contract only for F9
