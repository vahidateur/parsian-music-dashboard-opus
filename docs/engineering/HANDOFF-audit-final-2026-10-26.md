# HANDOFF — Final full-stack integration audit, 2026-10-26

> Follow-up of `HANDOFF-chat-2026-10-26.md` and `HANDOFF-audit-2026-10-24.md`.
> No commit/push/reset/staging. No DB resets or seeds; additive migrations only
> (gallery, chat) on the dev DB, verified empty afterwards. `PROJECT_STATE.md`
> untouched. ~178 uncommitted files preserved (all prior slices intact).

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     `git log -1 --format=%H` (this doc cannot carry its own SHA)
```

## 1. Method

Read all six handoffs; inventoried every domain from code (routes,
`registry.client.ts`, `UNAVAILABLE_DOMAINS`, bump coverage, permission
matrices); ran backend suite, full frontend suite, all three typechecks, fresh
client build with bundle scans; verified critical journeys in a real browser
against a live API+DB (mariadbd 3307, API 8080, vite 5173; all stopped, ports
clean, baselines restored). One demonstrated defect found → fixed with a
failing-first test before any other change.

## 2. Domain matrix (verified state)

| Domain | Backend (routes/policy) | Client repo | Permission(s) | Bump | Result |
|---|---|---|---|---|---|
| students | served, `StudentAccessPolicy` (T-02) | `ApiStudentRepository` | students.read/write | yes | ✅ |
| teachers | served, teacher policy | `ApiTeacherRepository` | teachers.read/write | yes | ✅ |
| classes | served, `ClassPolicy` | `ApiClassRepository` | classes.read/write | yes | ✅ |
| enrollments | served, delegates to `ClassPolicy` | `ApiEnrollmentRepository` | classes.read/write | yes | ✅ |
| scheduling | served (11 session endpoints) | `ApiSchedulingRepository` | schedule.read/write | yes | ✅ |
| attendance | served (8 endpoints, corrected contract) | `ApiAttendanceRepository` | attendance.read/write | yes | ✅ |
| library | served, metadata-only | `ApiLibraryRepository` | library.read/write | yes | ✅ |
| media | served, per-object auth, no `media.read` id | `ApiMediaRepository` | compound gate | yes | ✅ |
| instruments | served, `InstrumentPolicy` (§33) | `ApiInstrumentRepository` | instruments.read/write | yes | ✅ |
| learning | served, `LearningPolicy` (§34) | `ApiLearningRepository` | learning.read/write | yes | ✅ |
| rooms | served, `RoomPolicy` (§35) | `ApiRoomRepository` | rooms.read/write | yes | ✅ |
| gallery | served, `GalleryPolicy` (§36) | `ApiGalleryRepository` | gallery.read/write | yes | ✅ |
| chat | served, `ChatPolicy` + participation (§37) | `ApiChatRepository` | messages.read/write | yes | ✅ |
| progress | served, 14 endpoints (§29/§30) | `ApiProgressRepository` | progress.read/write | yes | ✅ |
| organization | served (`GET`+`PATCH`) | `ApiOrganizationRepository` | settings.read/write | yes | ✅ |
| auth/users/roles | served | `Api*` repositories | users.read/write, roles.write | yes (lists) | ✅ |
| branding | **UNAVAILABLE** — no contract | unavailable stub | — | n/a | explicit stub |
| compensation | **UNAVAILABLE** — no contract | unavailable stub | — | n/a | explicit stub |
| finance/reports | deferred UI, no repo (D6/I2, pre-existing) | n/a | finance.*, reports.read | n/a | honest deferral |

Served = real API repository in `registry.client.ts` (instance-pinned by test);
unavailable = exactly `{branding, compensation}` in `UNAVAILABLE_DOMAINS`.

## 3. Finding (one demonstrated defect, fixed)

**F1 — server ignored learning-content media references (severity: high,
verified).** Frontend X1 (`mediaReferences.ts`) lists `learningContent.mediaId`
as a parent and the learning handoff records a server branch — but
`MediaReferences`/`MediaPolicy` had no learning branch. Consequences, both
demonstrated by a failing-first `LearningMediaTest` (2/2 failed pre-fix):
(a) a referenced asset could be freed (`DELETE /media` 204, stranding material);
(b) `learning.read` holders got 403 on learning bytes.
Fix mirrors gallery/chat exactly (references + policy read/list branches;
no vocabulary change — `learning.read` already names it). Post-fix 2/2 green,
full backend suite green. Frontend needed no change (X1 already listed it).

**Verified clean, no action:** permission parity 33/33 + matrices
(`permissionParity`); policy-first ordering everywhere; tenant isolation;
chat participation incl. no-admin-bypass (decision, not gap); sender always
server-set; unread cursor per caller; non-in_app provider recorded
`unavailable`; archive reversible; media 409-while-referenced on all parents;
`previewGeneration`/`getBlob`/reads never bump; `setPassword` never bumps
(credential verb); error classification + blocking-failure reads; empty/
loading/retry states; export pinned to the selected thread.

## 4. Evidence

- **Backend: 402 tests, 2792 assertions — OK** (400 + 2 new `LearningMediaTest`).
- **Frontend full suite: 2849 passed, 4 skipped, 4 failed of 2857.**
  Triaged: 3 are load-induced timeouts (`deepLinkPagination` ×2,
  `settingsHonesty`, `emptyEnvironmentPanels`) — **all pass in isolation
  (36/36)**; 1 is `projectState.test.ts`, a git-state assertion failing
  because the local branch is 4 commits ahead of origin (push is forbidden —
  environmental, unrelated to code). One leaked-timer warning in
  `MessagesChat.test.tsx` (tests passed; pre-existing harness noise).
- **Typechecks:** default + client + demo — all exit 0 (post-change).
- **Client build:** success; 0 demo markers; login disclosure names exactly
  2 domains; no chat/gallery browser-only copy (remaining "…در این مرورگر
  موجود نیست" hits are all missing-bytes runtime states, true in both
  compositions — same precedent as gallery).
- **Browser (live):** session persists across reload; accountant → gallery
  renders an honest access gate (no data, no crash); classes resolve 14
  room-name + teacher references with no unavailable text; gallery album
  created → **reload → still there** (server persistence, not demo store);
  chat stranger sees 0 threads + 404; participant exchange shows correct
  per-viewer `me`/`them` with 0→1→0 unread; attachment uploads `201`,
  renders with download + client storage note for the participant;
  staff reads learning bytes `200`, accountant `403`, referenced delete
  `409`. **Baselines restored and verified:** chat/gallery/media/learning
  0, rooms 4, students 15, instruments 6.

## 5. Remaining unavailable functionality + risks

1. **Branding, compensation: unavailable by design** — no backend contract
   exists; both resolve to explicit `DOMAIN_UNAVAILABLE` stubs, disclosed in
   login copy, handled by honest fallback UI (org-identity fallback;
   unavailable states). Not gaps; they are the next slices.
2. **Finance/reports: deferred UI (D6/I2, pre-existing)** — no repository;
   honest deferral notes, export/payment controls withheld by seam.
3. **Open owner decisions (documented, not guessed):** no admin/manager read
   bypass for private chats (oversight tooling?); no add/remove-participant
   or thread/message delete verbs; no external provider delivery.
4. Chat cleanup has no API path (no delete verbs by design): audit probe
   threads were removed by id-scoped SQL + API media delete — test-data
   cleanup only, all baselines verified.
5. `PROJECT_STATE.md §6` links from §36/§37 intentionally not added (same
   standing rule as prior slices).
6. **Conclusion:** every *served* domain is integrated end-to-end with
   evidence above. The application is **not** declared fully integrated:
   branding, compensation (and deferred finance) remain explicitly
   unserved — by decision, not by omission.

## 6. Resume

```bash
git log -1 --format=%H; git status --short | wc -l
cd backend && vendor/bin/phpunit 2>&1 | tail -3
npm run typecheck   # + both tsconfig profiles; then npm run build:client
# full frontend suite only when needed (~7 min): npm test
# live recipe: mariadbd 3307 (skip-grant) + DB_PORT=3307 API :8080 + vite :5173
```
