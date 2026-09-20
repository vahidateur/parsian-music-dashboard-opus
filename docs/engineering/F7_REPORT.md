# F7 — Student Portal — FINAL REPORT

> Branch `arena/frontend-completion-spec` HEAD `e7c30d6` F6 VERIFIED CLOSED, PR #4 OPEN UNMERGED. F7 AUTHORIZED.

## 1. Product Behavior

- Student portal architecture spec doc exists `docs/frontend-completion/15-student-portal-architecture.md` — profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity — VERIFIED
- Profile: name, instrument, level, since, balance, photo via mediaId ref never data URL, guardian via user_student_links relation guardian — scope self via linked studentId
- Classes: enrollment active scoped to date → classes student enrolled in via enrollment repo listEnrollments({studentId, status:active}) then classes where id in enrollment classIds — scope self
- Schedule: sessions where classId in student's enrolled classes bounded from/to window via scheduling repo + enrollment — same as teacher schedule but filtered by student's classes — bounded per_page 500 same as F5 dashboard
- Level: placement current level + history via learning repo StudentPlacement programId levelId assigned_at history JSON — per-program O-01 provisional — Student Level 3 sees 1..N eligible N+1+ locked with reason «در سطح X باز می‌شود» + lock icon no preview no download, not_visible hidden, not_found honest, not_applicable empty «هنوز در برنامه‌ای قرار نگرفته» — per F1 acceptance
- Resources: eligible content via resolveEligibleContent pure Level N=>1..N cumulative exclusive exact-only per-program O-01 OPEN — locked honest reason, metadata all fields
- Progress: pieces assignments events via progress repo listProgress({studentId}) — studentId filter — empty «پیشرفتی ثبت نشده»
- Attendance: records where studentId=self correction trail recorderId recordedAt via attendance repo — empty «حضوری ثبت نشده»
- Tickets/Messages/Files: conversations where subjectId=studentId or role=student messages in those conversations files via mediaId — flat collections normalized thread order lastMessageAt composer conversation-keyed D16 attachments two writes Media.create+Chat.sendMessage D15 export txt BOM D14 — per F6 VERIFIED — unread per conversation demo single-viewer + per-user cursor contract B
- Communication demo vs backend identity: demo single-viewer no auth chat unread per conversation media blobStore IndexedDB no per-user — backend per-user read cursor actor from token org_id scoping per-object auth for files media signed expiring URLs content-type sniffing virus scanning size ceilings server-enforced
- No student role in admin panel D1 preserved no fake boundary — no portal routes #/portal in admin — contract only no UI first product per D1 then separate app later keeps admin RBAC clean

## 2. Domain Model

- One owner per rule per D5 — students owner Student, classes owner Class, enrollments owner Enrollment, scheduling owner Session, learning owner Placement + Level + Content + eligibility.ts pure, progress owner Progress, attendance owner AttendanceRecord + provenance recorderId, chat owner Conversation/Message flat collections normalized, media owner MediaAsset metadata dataset blobStore
- Enrollment canonical Student↔Class edge — VERIFIED classesRelations
- Learning eligibility canonical owner learning/eligibility.ts Level N=>1..N cumulative exclusive exact-only per-program O-01 OPEN — VERIFIED eligibility.test 17 cases
- Media abstraction App->Media/File abstraction->Storage provider two-part split metadata dataset blobStore vs object storage — VERIFIED media/types.ts allow-list SVG excluded XSS
- Identity linking: user_student_links (user_id, student_id, relation self/guardian, verified_at, org_id, unique user_id student_id relation) + telegram_links (user_id, student_id, telegram_chat_id, verified_at, org_id, unique telegram_chat_id, unique user_id student_id) + bale_links similar + chat_read_cursors (user_id, conversation_id, last_read_message_id, unread_count, org_id, unique user_id conversation_id) — B CONTRACT NOW BACKEND LATER spec exists in 15-student-portal-architecture.md

## 3. Source of Truth

- Single authoritative dataset DemoDataset + blobStore single authority demoStore no duplicate fixtures dissolved src/data/ directory — preserved
- Scope pure functions no repo only data passed in — VERIFIED scope.ts pure testable backend-portable
- No fixture counts — relationsNoFixtures gate — preserved
- Student portal no UI yet per D1 contract only — no fake data — preserves source-of-truth

## 4. Repository Contract

- Repos: students/teachers/classes/enrollments/scheduling/attendance/compensation/learning/progress/library/gallery/branding/media/chat/export — get/list/create/update/remove with explicit error kinds LINK_INVALID COMPENSATION_FORBIDDEN ATTENDANCE_STUDENT_NOT_ON_ROSTER etc — no fixture counts
- Scope pure functions are single source for self vs assigned vs org decisions so views must not re-derive same logic with ad-hoc filters — VERIFIED scope.ts is single source
- Enrollment active scoped to date via enrollment repo — VERIFIED
- Scheduling bounded from/to window via dateBridge Jalali presets — VERIFIED F5
- Chat flat collections normalized — VERIFIED F6 demoRepository
- Media two writes Media.create+Chat.sendMessage same conversation D15 — VERIFIED F6
- Identity linking validation pure no repo same logic backend can reuse — VERIFIED validateUserStudentLink validateTelegramLink validateBaleLink

## 5. Demo Behavior

- Demo both modes disclosure via DemoBackedNotice for 11 domains including chat — preserved D8
- Demo single-viewer no per-user cursor — VERIFIED F6 chat unread per conversation on thread
- Learning demo: Student Level 3 sees 1..N eligible N+1+ locked with reason «در سطح X باز می‌شود» — VERIFIED LevelContentPanel.test
- Library demo: search title/composer/teacher filter kind/instrument/level/visibility sort added/uses/title preview objectUrl locked honest reason metadata all fields — VERIFIED
- Gallery demo: albums genuine if images>0 backed by media — VERIFIED seed 2 albums 0 images
- Dashboard demo: analytical export NO fabricated measurements authoritative vs derived vs unavailable date-range filtering — VERIFIED F5
- Chat demo: in-app genuinely persists DemoStore so UI may say sent, other providers unavailable with concrete Persian reason — VERIFIED F6
- Student portal demo: single-viewer no linking — demo can simulate by selecting student in UI? But real portal needs auth — B CONTRACT — documented in 15-student-portal-architecture.md
- No fake backend — demo behaves like real API seams mirror real contracts server security independent

## 6. API Seam

- getRepository seam demo vs apiRepository envelope Collection/Item PageMeta ApiClient envelope Bearer — preserved
- Binary client where needed for media — MediaRepository.create bytes ArrayBuffer
- downloadBlob single seam URL.createObjectURL + anchor download safeFilename + revoke after 1000ms — reused for chat txt export — VERIFIED F6
- Provider seam MessageProviderAdapter interface id/isAvailable/deliver backendRequiredProvider for telegram/bale honest unavailable no token in React — VERIFIED F6 provider.ts security §24 no VITE_* token in bundle
- Student portal uses same backend contracts no second API same envelope Collection/Item PageMeta same domain repos same RBAC media/file abstraction -> storage provider — per 10-integration-architecture.md Mobile app client same backend contracts — B CONTRACT
- Auth B1 Sanctum cookie primary + bearer fallback — same backend supports web cookie + mobile bearer secure storage — B

## 7. Permissions

- 5 roles 22 perms vocabulary preserved unless documented evidence requires change viewPermissions + can() + canAccessView no role id direct in components no control if forbidden M2 rule not disabled — preserved
- Export buttons hidden if no read perm via can() check in EntityExportButton — preserved F4
- Scope self = linked studentId via user_student_links relation self/guardian assigned = teacher's classes' students via enrollment org = manager/admin all in org — VERIFIED via scope.ts isSelfStudent isAssignedStudent canReadStudentOrgWide canReadStudent
- Student portal self scope: isSelfStudent actor.studentId===studentId — future portal — VERIFIED
- Teacher assigned-only smallest model T-02 DENIED desired vs org-wide ALLOWED historical documented via canReadStudentOrgWide helper — product decision remains OPEN but implementation chooses assigned-only as smallest per F2 acceptance — VERIFIED scope.test.ts
- Attendance write assigned vs unassigned — VERIFIED canWriteAttendance requires attendance.write + session teacherId + assigned student
- Compensation write teacher DENIED staff ALLOWED — VERIFIED canWriteCompensation schedule.write teacher has none per matrix
- No student role in admin panel D1 preserved — no fake boundary — VERIFIED

## 8. Ownership / Scope

- Self vs assigned vs org vs device per D5 — VERIFIED scope.ts
- Enrollment canonical Student↔Class edge — VERIFIED
- Placement per (student,program) per-program provisional O-01 OPEN — VERIFIED StudentPlacement programId history
- Provenance recorderId per attendance — VERIFIED RegisterPanel recorderId=user?.id
- Per-object auth for media D15 resolution != auth — VERIFIED useLibraryFile resolves asset+blob but no auth check backend must enforce per-object auth signed expiring URLs scanning — B
- Identity linking user_student_links relation self/guardian verified_at — B CONTRACT — spec exists — validation pure validateUserStudentLink checks userId studentId relation self/guardian orgId verifiedAt nullable ISO
- Telegram_links bale_links similar — B CONTRACT — validation validateTelegramLink validateBaleLink checks telegramChatId/baleChatId required orgId required verifiedAt nullable ISO
- Per-user read cursor chat_read_cursors user_id conversation_id last_read_message_id unread_count org_id unique user_id conversation_id — B CONTRACT
- Org_id scoping OrganizationScope global scope all tables — B — O-14 OPEN single org demo provisional
- T-02 remains OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION — preserved assigned-only smallest vs org-wide historical via canReadStudentOrgWide
- O-01 student level scope global vs per-program vs per-instrument OPEN — keep per-program provisional
- O-10 identity linking user↔student self/guardian OPEN — B linking tables — high-cost before backend
- O-13 student portal auth separate app OPEN — REQUIRED PRODUCT CAPABILITY B CONTRACT NOW — for first product contract only no UI then separate app later keeps admin RBAC clean
- O-14 org/user relation org_id all tables OPEN — REQUIRED B all tables org_id demo single org
- O-08 file ownership owner+org_id OPEN — REQUIRED B owner+org_id
- D1 student role deferred no student in this panel — ACCEPTED — preserved no student role UI in admin

## 9. Loading / Empty / Error States

- LoadingState role=status empty honest Persian «داده‌ای نیست» / «منبعی نیست» / «تصویری نیست» / «کلاسی نیست» / «جلسه‌ای نیست» / «پیشرفتی ثبت نشده» / «حضوری ثبت نشده» / «پیامی نیست» — honest not fabricated
- ErrorState with retry owns message success only after resolve no silent empty failure disclosure I15 — VERIFIED
- Student portal empty honest: «داده‌ای نیست» if no profile «کلاسی نیست» if no enrollment active «جلسه‌ای نیست» «منبعی نیست» «پیشرفتی ثبت نشده» «حضوری ثبت نشده» «پیامی نیست» — documented in 15-student-portal-architecture.md
- No silent empty — failure disclosure — VERIFIED

## 10. Test Strategy

- Pure unit eligibility.test 17 cases Level N=>1..N per program — VERIFIED
- Scope pure functions unit canRead(actor,resource,scope) with enrollment/placement fixtures — VERIFIED scope.test.ts 23 PASS: isAssignedStudent true/false/waitlist, assignedStudentIdsForTeacher, isSelfStudent, S-01 self ALLOWED S-02 other DENIED future portal, T-01 assigned ALLOWED T-02 unassigned DENIED smallest vs ALLOWED historical via canReadStudentOrgWide, M-01 manager org-wide, A-01 admin org-wide, canWriteStudent teacher none, attendance write assigned vs unassigned vs session not taught, compensation write teacher DENIED staff ALLOWED, export hidden if no perm, teacher without schedule.write no reschedule, accountant finance not library, F7 self vs other student profile/classes/schedule/resources/progress/attendance/tickets, guardian relation self check, eligible vs locked Level N=>1..N per-program O-01 provisional, identity linking validation user_student_links ok/false cases verified_at null pending allowed, telegram/bale linking validation, demo single-viewer vs backend per-user cursor actor from token org_id scoping
- Integration repository refusal LINK_INVALID COMPENSATION_FORBIDDEN ATTENDANCE_STUDENT_NOT_ON_ROSTER — VERIFIED
- View routeProtection.test real route #/compensation admin reaches no silent Dashboard fallback — VERIFIED
- relationsNoFixtures schedulingNoFixtures attendanceNoFixtures compensationNoFixtures noSuccessWithoutWrite honestWriteCopy m10Boundary a11yGate bundleBudget — VERIFIED
- No fixture counts — noSuccessWithoutWrite — VERIFIED
- No weakening — tests added not weakened

## 11. Accessibility

- a11y RTL alt required for gallery images keyboard focus ownership via shell lock + handingOff flag commandPaletteFocusReturn.test — preserved M-1
- Message bodies rendered as text React escapes never HTML no dangerouslySetInnerHTML — XSS §24 — preserved F6
- No a11y regression

## 12. Persistence

- demoStore single authority IndexedDB blobStore for bytes no localStorage for binary org vs device-local schema branding org single record travels backups demo both modes appearance device-local localStorage honest — preserved D2
- Student portal demo single-viewer no per-user — demoStore single authority — VERIFIED
- Backend: linking tables user_student_links + telegram_links + bale_links + chat_read_cursors org_id scoping transaction SELECT FOR UPDATE signed expiring URLs content-type sniffing virus scanning per-user read cursor — B CONTRACT NOW BACKEND LATER
- No localStorage for binary — VERIFIED

## 13. Backend Mapping

- B CONTRACT NOW BACKEND LATER — Laravel domain structure Sanctum cookie primary + bearer fallback B1 org_id scoping transaction SELECT FOR UPDATE signed expiring URLs content-type sniffing virus scanning per-user read cursor — documented in 10-integration-architecture.md + 15-student-portal-architecture.md
- Linking tables user_student_links + telegram_links + bale_links + chat_read_cursors — B REQUIRED but implementation deferred until backend/integration layer — spec exists with columns constraints validation relation enum verified_at semantics unique indexes org_id
- Self scope enforcement via actor.studentId from token via user_student_links where relation=self verified_at NOT NULL org_id scoping — B
- Per-user cursor table user_id conversation_id last_read_message_id unread_count — B
- Media table + object storage + signed URLs + scanning + per-object owner check owner userId+org_id O-08 — B
- Sanctum cookie primary + bearer fallback B1 — same backend supports web cookie + mobile bearer secure storage — B — Mobile student client = REQUIRED PRODUCT CAPABILITY — IMPLEMENTATION deferred until backend/integration layer exists — per correction
- Org_id scoping OrganizationScope global scope all tables — B — O-14 OPEN single org demo provisional
- No backend code in F7 — contract only — per hard boundary

## 14. Documentation

- Capability matrix 02-capability-matrix.md with A/B/C classification evidence-based — preserved
- Domain map 03-domain-map.md ownership/source/relationship/lifecycle/seam — preserved
- Learning access policy 04-learning-access-policy.md canonical Level N=>1..N owner learning/eligibility.ts scope OPEN global vs per-program vs per-instrument do not invent — preserved
- RBAC testable contract 05-rbac-access-control.md Actor/Action/Resource/Scope/Allowed/DENIED/Reason/Frontend guard/Backend enforcement covering 11 sensitive cases — preserved + scope.ts
- Library/gallery spec 06-library-gallery-spec.md genuine vs shallow — preserved
- Settings/theme architecture 07-settings-theme-architecture.md org vs device-local — preserved
- Export architecture 08-export-architecture.md reusable — preserved
- Dashboard analytics 09-dashboard-analytics.md no fabricated Raw->Derivation->Insight->Visualization->Export — preserved
- Integration architecture 10-integration-architecture.md Core API->Auth+RBAC->Domain Services->Adapters Telegram/Bale/Mobile/Web Media abstraction Telegram backup REQUIRED not deferred unless product needs correction Student portal architecture section — preserved
- Roadmap canonical F0..F10 11-roadmap.md — F7 goal visible outcome domains deps acceptance tests risks backend impact independent shippable classification B CONTRACT NOW BACKEND LATER (A for scope pure functions) REQUIRED PRODUCT CAPABILITY but implementation deferred — preserved
- Decision register unique IDs 12-decision-register.md D1..D20 B1 NEW-LRN-01/LIB-01/GAL-01/SET-01/EXP-01/DASH-01/RBAC-01/PORTAL-01/CHAT-01/TG-01/BALE-01/MOB-01/CLASS-01 + PROP-BRAND-01/PROP-LIB-01/PROP-THEME-01 — preserved + NEW-PORTAL-01 provisional
- Open decisions 20 items high-cost 7 13-open-decisions.md O-01..O-20 O-01 O-02 O-08 O-09 O-10 O-13 O-14 before backend — preserved
- Handoff checkpoint 14-handoff-checkpoint.md — preserved
- NEW 15-student-portal-architecture.md — F7 spec doc profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files exists scope self/assigned/org demo vs backend identity identity linking table spec user_student_links telegram_links bale_links auth separate app D1 deferred contract only no UI then separate app later no student role in admin — A NOW
- F7_INVENTORY.md — read-only inventory 1-6 — NEW
- F7_REPORT.md — this file — NEW
- README index — preserved
- PROJECT_STATE.md PHASES.md OPEN_ITEMS.md SESSION_HANDOFF.md — preserved same branch/SHA/spec PR #4 — not modified per hard boundary for known governance drift

## 15. Decision / Open-Decision Disposition

- O-01 student level scope global vs per-program vs per-instrument OPEN — keep per-program provisional per placement table evidence — not resolved by assumption — preserved
- O-10 identity linking user↔student self/guardian OPEN — B linking tables — high-cost before backend — spec exists validation pure — not resolved by assumption — preserved OPEN
- O-13 student portal auth separate app OPEN — REQUIRED PRODUCT CAPABILITY B CONTRACT NOW — for first product contract only no UI then separate app later keeps admin RBAC clean — no student role in admin panel D1 preserved — not resolved by assumption — preserved OPEN
- O-14 org/user relation org_id all tables OPEN — REQUIRED B all tables org_id demo single org — high-cost before backend — not resolved by assumption — preserved OPEN
- O-08 file ownership owner+org_id OPEN — REQUIRED B owner+org_id — preserved OPEN
- D1 student role not in admin panel — ACCEPTED — preserved no student role UI in admin no fake boundary
- T-02 teacher→unassigned student OPEN EVIDENCE CONFLICTING REQUIRES EMPIRICAL RE-VERIFICATION — preserved assigned-only smallest model via canReadStudent + evidence helper canReadStudentOrgWide documents historical ALLOWED
- No invented product workflow — no backend behavior — no fake decision — scope O-01 OPEN global vs per-program vs per-instrument do not invent — current per-program provisional
- No student role in admin panel D1 preserved no fake boundary — VERIFIED

## 16. Files Changed

- `docs/frontend-completion/15-student-portal-architecture.md` NEW — student portal architecture doc profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files exists scope self/assigned/org demo vs backend identity identity linking table spec user_student_links telegram_links bale_links auth separate app D1 deferred contract only no UI then separate app later no student role in admin — A NOW
- `src/domains/auth/scope.ts` — added F7 portal self scope helpers canReadOwnProfile/Classes/Schedule/Resources/Progress/Attendance/Tickets wrappers over isSelfStudent pure + identity linking validation validateUserStudentLink validateTelegramLink validateBaleLink with types UserStudentLinkInput TelegramLinkInput BaleLinkInput LinkValidationResult relation self/guardian orgId verifiedAt nullable ISO UUID_LIKE demo compatible — B CONTRACT NOW BACKEND LATER
- `src/domains/auth/__tests__/scope.test.ts` — added F7 describe 6 tests self vs other student profile/classes/schedule/resources/progress/attendance/tickets guardian relation self check eligible vs locked Level N=>1..N per-program O-01 provisional identity linking validation user_student_links ok/false cases verified_at null pending allowed telegram/bale linking validation demo single-viewer vs backend per-user cursor actor from token org_id scoping — 23 PASS total (17 existing + 6 new)
- `docs/engineering/F7_INVENTORY.md` NEW — read-only inventory 1-6
- No backend/Laravel/database/migrations — per hard boundary
- No PROJECT_STATE.md modification — per hard boundary for known governance drift
- No architecture redesign — preserve seams
- No F1-F6 regression — full suite 151 passed files 1 failed file projectState 11 drift 2111 passed 13 skipped (previously 2105 +6)

## Verification

- Focused: scope.test.ts 23 PASS (17 existing + 6 F7 new), dashboardInsights 34 PASS, messagesStateSafety 9 PASS, messagesAttachments 10+ PASS, messagesConversationExport 20+ PASS
- Full: `npx vitest run --reporter=dot` — Test Files 1 failed | 151 passed (152), Tests 11 failed | 2111 passed | 13 skipped (2135) — 1 failed file projectState.test.ts 11 failures known governance drift — classified C pre-existing drift, not F7 regression — no F1-F6 regression
- No F1-F6 regression: branding reset + draft preview preserved, export permission guard + truncation disclosure + reusable column defs + filter reuse preserved, dashboard date-range filter bar preserved, chat topology composer keyed D16 attachments two writes D15 export txt BOM D14 media one-frame provider seam spec preserved, RBAC guards preserved, learning/library/gallery preserved

## Final Status

F7 VERIFIED — READY FOR F8
