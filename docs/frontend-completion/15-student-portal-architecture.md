# 15 — Student Portal Architecture — F7 CONTRACT NOW BACKEND LATER

> Student portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity — F7 goal — D1 student role not in admin panel preserved — scope self via user_student_links assigned via enrollment org via org_id — B CONTRACT NOW BACKEND LATER REQUIRED PRODUCT CAPABILITY

## Goal

Student portal architecture profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files communication demo vs backend identity — spec doc for portal architecture, identity linking table spec, scope pure functions self vs assigned vs org, demo vs backend identity doc, contract/UX preparation no UI yet for first product per D1 but contract now — per 11-roadmap F7.

## Visible Outcome

- Spec doc for portal architecture exists (this file)
- Identity linking table spec exists
- Scope pure functions self vs assigned vs org exists (auth/scope.ts)
- Demo vs backend identity doc exists (section below)
- Contract/UX preparation no UI yet for first product per D1 but contract now — then separate app later keeps admin RBAC clean
- No student role in admin panel D1 preserved — no fake boundary

## Domains

students, classes, enrollments, scheduling, learning/eligibility, progress, attendance, chat, media, auth, export — all via same backend contracts, same envelope Collection/Item PageMeta, same domain repos, same RBAC, media/file abstraction -> storage provider.

## Profile

- Student's own profile: name, instrument, level, since, balance, photo via mediaId, guardian? — needs Student type fields (src/domains/students/types.ts)
- Scope self: student sees own record where studentId = linked studentId — needs identity linking table user_student_links
- Demo vs backend: demo single-viewer no per-user — demo can simulate by selecting student in UI? But real portal needs auth — B CONTRACT
- Fields authoritative: id, name, instrument (vocabulary D), level via placement current per program, since ISO, balance number, photo mediaId ref never data URL, guardian relation via user_student_links relation guardian
- Empty honest: «داده‌ای نیست» if no profile — not fabricated

## Classes

- Classes: enrollment active scoped to date → classes student enrolled in — via enrollment repo listEnrollments({studentId, status:active}) then classes where id in enrollment classIds
- Scope self: student sees classes where enrollment studentId=self and status=active — pure via isAssignedStudent inverse
- Demo vs backend: demo single-viewer, no per-user — backend actor from token org_id scoping
- Empty honest: «کلاسی نیست» if no enrollment active

## Schedule

- Schedule: sessions where classId in student's enrolled classes, bounded from/to window — via scheduling repo + enrollment — same as teacher schedule but filtered by student's classes
- Scope self: sessions where classId in enrolled classIds, bounded window from/to same as scheduling dateBridge Jalali presets
- Demo vs backend: demo bounded per_page 500, backend server aggregation for large range
- Empty honest: «جلسه‌ای نیست»

## Level

- Level: placement current level + history — via learning repo StudentPlacement programId levelId assigned_at history JSON
- Scope self: placement where studentId=self per program — O-01 per-program provisional
- Demo vs backend: demo per-program, backend same table student_placements (student_id, program_id, level_id, assigned_at, history JSON)
- Visible outcome: Student Level 3 sees levels 1..N eligible N+1+ locked with reason «در سطح X باز می‌شود» + lock icon no preview no download, not_visible hidden from students, not_found honest, not_applicable empty «هنوز در برنامه‌ای قرار نگرفته» — per F1 acceptance

## Resources

- Resources: eligible content via resolveEligibleContent with placement — VERIFIED pure learning/eligibility.ts Level N=>1..N cumulative exclusive exact-only per-program O-01 OPEN
- Scope self: eligible via placement self per program, locked honest reason, not_visible hidden, not_found honest, not_applicable empty
- Demo vs backend: demo pure function, backend must enforce same rule server-side
- Empty honest: «منبعی نیست» if no eligible content

## Progress

- Progress: pieces assignments events — via progress repo listProgress({studentId}) — needs studentId filter
- Scope self: progress where studentId=self
- Demo vs backend: demo single-viewer, backend actor from token
- Empty honest: «پیشرفتی ثبت نشده»

## Attendance

- Attendance: records where studentId=self, correction trail recorderId recordedAt — via attendance repo
- Scope self: attendance where studentId=self
- Demo vs backend: demo single-viewer, backend per-user actor from token, org_id scoping, provenance recorderId, correction trail
- Empty honest: «حضوری ثبت نشده»

## Tickets / Messages / Files

- Tickets/Messages/Files: conversations where subjectId=studentId or role=student, messages in those conversations, files via mediaId — via chat + media
- Topology: flat collections normalized thread order lastMessageAt, conversation list, composer conversation-keyed D16, attachments two writes Media.create+Chat.sendMessage D15, export single-conversation txt metadata only ceiling 1000 disclosed D14 no new verb no bytes, media one-frame fix A — per F6 VERIFIED
- Scope self: conversations where subjectId=self, messages where conversationId in those conversations, files via mediaId ref resolution != auth D15 backend must enforce per-object auth
- Unread per conversation demo single-viewer + per-user cursor contract B — backend needs per-user read cursor table user_id conversation_id last_read_message_id unread count
- Demo vs backend: demo single-viewer no per-user, backend per-user cursor actor from token, org_id scoping, per-object auth for files, signed expiring URLs content sniffing virus scanning
- Empty honest: «پیامی نیست»

## Communication Demo vs Backend Identity

- Demo: single-viewer, no auth, chat unread per conversation on thread, media blobStore IndexedDB, no per-user — VERIFIED F6
- Backend: per-user read cursor, actor from token, org_id scoping, per-object auth for files, media signed expiring URLs, content-type sniffing, virus scanning, size ceilings server-enforced same as frontend
- Identity: student ↔ user linking + telegram linking + mobile auth — same linking table user_student_links + telegram_links bale_links
- Auth: student portal auth separate from admin panel? D1 deferred decision: student role in this panel or separate app — currently deferred — so student portal could be separate app sharing same backend contracts — B CONTRACT NOW BACKEND LATER — for first product contract only no UI, then separate app later keeps admin RBAC clean — no student role in admin panel D1 preserved no fake boundary
- Nav badge sums unread where read complete — VERIFIED M7 — but per-user needed backend

## Identity Linking Table Spec

### user_student_links

Purpose: link user (auth) ↔ student (academy) for self/guardian relation — enables self scope.

```sql
CREATE TABLE user_student_links (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation ENUM('self','guardian') NOT NULL, -- self = student themselves, guardian = parent/guardian
  verified_at TIMESTAMP NULL, -- NULL = pending verification, NOT NULL = verified
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  UNIQUE(user_id, student_id, relation),
  INDEX(org_id, student_id),
  INDEX(org_id, user_id)
);
```

- Validation: user_id required, student_id required, relation in ['self','guardian'], verified_at nullable, org_id required scoping
- Semantics: self = student can read own profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files where studentId=linked studentId; guardian = guardian can read linked student's same but with guardian scope — future
- Demo: single-viewer no linking — demo can simulate by selecting student in UI? But real portal needs auth — B
- Backend enforcement: actor.studentId from token via user_student_links where relation=self and verified_at NOT NULL and org_id=actor.org_id — B REQUIRED

### telegram_links

```sql
CREATE TABLE telegram_links (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  telegram_chat_id VARCHAR(255) NOT NULL, -- Telegram chat id as string (can be big)
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  UNIQUE(telegram_chat_id),
  UNIQUE(user_id, student_id),
  INDEX(org_id, student_id)
);
```

- Flow: student links Telegram account via student portal auth → bot verifies via code → student can query via bot commands /schedule /level /resources /progress /attendance /tickets each calls domain service with actor scope self linked studentId, no business logic in adapter
- Security: no PII in Telegram logs, no credentials in client, rate limiting, backend-only token

### bale_links

Same as telegram_links but bale_chat_id — avoid duplicate logic via common MessagingAdapter interface — Core->Adapter->Telegram/Bale no business logic in bots — B REQUIRED

```sql
CREATE TABLE bale_links (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  bale_chat_id VARCHAR(255) NOT NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  UNIQUE(bale_chat_id),
  UNIQUE(user_id, student_id),
  INDEX(org_id, student_id)
);
```

### per-user read cursor

```sql
CREATE TABLE chat_read_cursors (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  last_read_message_id UUID NULL REFERENCES chat_messages(id),
  unread_count INT NOT NULL DEFAULT 0,
  org_id UUID NOT NULL REFERENCES organizations(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, conversation_id),
  INDEX(org_id, conversation_id)
);
```

- Demo single-viewer unread on thread — VERIFIED — backend per-user cursor B REQUIRED

## Scope Pure Functions Self vs Assigned vs Org

- Implemented in src/domains/auth/scope.ts — pure, testable, backend-portable, no repo, only data passed in — VERIFIED
- Actor: userId, role, permissions, teacherId (linked teacher), studentId (future student portal linked student)
- isAssignedStudent(teacherId, studentId, classes, enrollments): true if active enrollment in teacher's class — pure
- assignedStudentIdsForTeacher: set of assigned
- isSelfStudent(actor, studentId): actor.studentId === studentId — self scope for future portal
- canReadStudentOrgWide(actor): permissions.includes students.read — historical ALLOWED behavior T-02 evidence preserved
- canReadStudent(actor, student, {classes,enrollments}): teacher assigned-only smallest model T-02 DENIED desired, manager/admin/staff/accountant org-wide ALLOWED, student self ALLOWED other DENIED, teacher without teacherId fallback org-wide honest
- canWriteStudent, canReadTeacher, canWriteAttendance (attendance.write + session teacherId + assigned), canReadAttendance, canWriteCompensation (schedule.write teacher DENIED staff ALLOWED), canReadCompensation, canReadSchedule, canWriteSchedule, canExport, isEligibleLevel (contentLevelOrder <= currentOrder)
- Tests: src/domains/auth/__tests__/scope.test.ts 15+ cases S-01 self ALLOWED S-02 other DENIED T-01 assigned ALLOWED T-02 unassigned DENIED smallest vs ALLOWED historical M-01 manager org-wide A-01 admin org-wide attendance assigned vs unassigned compensation teacher DENIED staff ALLOWED export hidden if no perm — VERIFIED
- Additional for portal: canReadOwnProfile, canReadOwnClasses, canReadOwnSchedule, canReadOwnResources, canReadOwnProgress, canReadOwnAttendance, canReadOwnTickets — can be wrappers over isSelfStudent + enrollment filter — A NOW small addition if needed, or document that existing isSelfStudent + canReadStudent covers self scope
- O-01 student level scope per-program vs global — remains OPEN — scope functions operate per-program where placement exists not global — provisional per-program

## Auth Student Portal Separate App vs Same Panel

- D1: Student role not in admin panel — ACCEPTED — student portal is separate app or separate view with self scope, contract now backend later — no student role UI in admin, portal contract doc B
- For first product: contract only no UI — per 11-roadmap F7 acceptance — then separate app later keeps admin RBAC clean
- Auth: student credentials (phone + OTP?) separate from admin passphrase — B — Sanctum cookie primary + bearer fallback B1 — same backend supports both per B1
- Mobile: same backend contracts, bearer token stored securely not localStorage — B REQUIRED per correction Mobile student client = REQUIRED PRODUCT CAPABILITY — IMPLEMENTATION deferred until backend/integration layer exists
- No fake boundary: no student role in admin panel preserved, no student sees admin routes

## Media / Files

- App->Media/File abstraction->Storage provider — VERIFIED two-part split metadata dataset blobStore vs object storage — media/types.ts
- Allowed types: image jpeg/png/webp/gif SVG excluded XSS, audio mp3/mp4/ogg/wav/webm, doc pdf/txt, size ceilings per kind — VERIFIED
- No data URL — mediaId ref only — VERIFIED
- Resolution != auth D15 — frontend resolution != auth backend must enforce per-object auth signed expiring URLs content sniffing virus scanning — B REQUIRED
- Student portal files: conversations where subjectId=self, mediaId ref, backend per-object auth via owner org_id + signed URLs

## Export

- Students/Teachers/Classes/Enrollments already via buildExportTable explicit columns no leak + serializeTable csv/xlsx + downloadBlob seam EXPORT_LABELS Persian safeFilename + sensitive-field policy no credentials + formats csv/xlsx + txt for chat already — per F4 VERIFIED
- Dashboard tabular summary reuse canonical calc no duplicate engine — per F5 VERIFIED
- Chat export single-conversation txt metadata only ceiling 1000 disclosed D14 no new verb no bytes — per F6 VERIFIED
- Student portal export: same pattern, requires read permission for entity, frontend no control if no perm M2 rule backend 403, large-dataset client capped truncation disclosed «N ردیف از M» not silent — B contract

## Backend Mapping — B CONTRACT NOW BACKEND LATER

- Linking tables user_student_links + telegram_links + bale_links + chat_read_cursors — B REQUIRED but implementation deferred until backend/integration layer
- Self scope enforcement via actor.studentId from token via user_student_links where relation=self verified_at NOT NULL org_id scoping — B
- Per-user cursor table user_id conversation_id last_read_message_id unread_count — B
- Media table + object storage + signed URLs + scanning + per-object owner check owner userId+org_id O-08 — B
- Sanctum cookie primary + bearer fallback B1 — same backend supports web cookie + mobile bearer secure storage — B
- Org_id scoping OrganizationScope global scope all tables — B — O-14 OPEN single org demo provisional
- Transaction SELECT FOR UPDATE for scheduling/attendance/compensation — B
- No backend code in F7 — contract only

## Risks

- D1 student role in admin panel vs separate app — decision needed before schema O-13 — O-13 OPEN REQUIRED PRODUCT CAPABILITY B CONTRACT NOW — for first product contract only no UI then separate app later keeps admin RBAC clean — no fake boundary
- Org/user relation O-14 — org_id on all tables — OPEN high-cost before backend — single org demo provisional
- Identity linking O-10 — user↔student relation self/guardian — OPEN high-cost before backend — B linking tables
- Student level scope O-01 — per-program vs global — OPEN — keep per-program provisional per placement table evidence
- File ownership O-08 — owner+org_id — OPEN REQUIRED B owner+org_id
- No student role in admin panel preserved — no fake boundary — VERIFIED

## Acceptance

- Student portal architecture doc profile/classes/schedule/level/resources/progress/attendance/tickets/messages/files exists — THIS FILE
- Scope self = linked studentId via user_student_links relation self/guardian, assigned = teacher's classes' students via enrollment, org = manager/admin all in org — VERIFIED via scope.ts
- Demo single-viewer no per-user vs backend per-user read cursor actor from token org_id scoping per-object auth for files — documented
- Identity linking table user_student_links (user_id, student_id, relation self/guardian, verified_at) + telegram_links bale_links — spec exists
- Auth student portal separate app or separate view with self scope per D1 deferred — for first product contract only no UI, then separate app later keeps admin RBAC clean; no student role in admin panel D1 preserved no fake boundary — documented
- Tests: scope pure functions unit canRead(actor,resource,scope) with enrollment/placement fixtures, identity linking validation, self vs other student, eligible vs locked — VERIFIED scope.test.ts + eligibility.test

## Classification

B CONTRACT NOW BACKEND LATER (A for scope pure functions) — REQUIRED PRODUCT CAPABILITY but implementation deferred — per 11-roadmap F7.

## Follow-up

- O-01 O-10 O-13 O-14 remain OPEN — do not resolve by assumption
- F8 Telegram + Bale + Backup integration contracts — next
- F9 Mobile client contract — after F8
- F10 Cross-surface QA + final frontend freeze — after F1..F9
