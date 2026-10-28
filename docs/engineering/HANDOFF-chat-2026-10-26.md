# HANDOFF — Chat slice (end-to-end), 2026-10-26

> Follow-up of `HANDOFF-gallery-2026-10-24.md`. No commit/push/reset/staging.
> No DB resets or seeds; one additive migration applied to the dev DB (tables
> only, verified empty afterwards). `PROJECT_STATE.md` untouched.
> Working tree holds this slice plus all prior uncommitted work (~177 files).

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     `git log -1 --format=%H` (this doc cannot carry its own SHA)
```

## 1. What existed, what was blocked

- **Existed (demo):** `ChatRepository` interface (threads + messages, archive,
  markRead, provider honesty), `LocalChatRepository`, `MessagesView` +
  composer/manager/attachment/export seams, demo seed, honest empty/error
  states. Gates already used `messages.write` (X-04).
- **Blocked:** no server tables, policy, routes; client resolved chat to the
  `DOMAIN_UNAVAILABLE` stub (`UNAVAILABLE_DOMAINS` = 3 after gallery).
- **Decision (§37, new):** chat authorized for v1 under the **existing**
  `messages.read` / `messages.write` ids — vocabulary stays at **33**; no
  matrix change. §26.3 only forbids borrowing an id for a *different* domain.

## 2. Changes

**Backend (new):** migration `2026_10_26…_create_chat_tables`
(composite PKs; `chat_participants` PK is `(org, conversation, user)`);
`ChatConversation`/`ChatParticipant`/`ChatMessage` models (+ factories
`co_`/`cm_`); `ChatPolicy`; `ChatService` (participant-scoped everything,
server-set sender, per-viewer `from`, cursor unread, provider parity,
atomic send+preview); 3 FormRequests (policy-first);
`ChatConversationResource`/`ChatMessageResource`;
`ChatController` + **8 routes**
(`GET|POST /chat/conversations[/{id}…]`, `POST …/archive|read`,
`GET|POST /chat/conversations/{id}/messages`); `ChatTest` (15).

**Backend (edited):** `routes/api.php` (+ chat block);
`MediaReferences` (+ chat message parents, docblock);
`MediaPolicy` (+ per-thread bytes branch, visible-ids branch,
`messages.write` in upload gate); `TenantRules` untouched (participant
validation is service-level against org-scoped users; media via existing
`mediaAssetExists`).

**Frontend (new):** `ApiChatRepository` (bump after every accepted write,
never after refusal/reads) + `apiRepository.test.ts` (13, incl. the
no-sender-on-the-wire assertion). `CreateConversationInput.participantIds?`
documented as the whole v1 membership surface.

**Frontend (edited):** `registry.client.ts` (real `ApiChatRepository`);
`unavailableDomains.ts` (chat removed → **2 left**);
`registryClient.test.ts`, `cacheInvalidationAudit.test.ts` (+ send bump);
`Messages.tsx` send toast → `fileStoredDetail()` seam;
`MessageAttachment` storage sentence → new `attachmentStorageNote` slot
(**both** `targetCopy` variants); `AttachmentField` limits paragraph →
same slot (virus-scan disclosure kept); `conversationExport` server
sentence → both-compositions truth; `targetCopy.client.ts`
`unavailableActions` drops `"message"` (view now served) +
`clientAvailability.test.ts` updated to pin message offered / payment
still dropped.

**Docs:** `DECISIONS.md §37`, `.opencode/specs/auth-rbac.md` (chat
participation rule).

**Deliberately unchanged:** demo composition (local repo, seed, browser
copy); provider adapters (demo only); no add/remove-participant verbs, no
message/thread delete verbs, no admin read bypass (all documented §5);
missing-bytes sentence kept (precedent: gallery — operative claim true in
both); `errors.ts` PB copy; chat view `messages.read` requirement.

## 3. Authorization rules (enforced, not described)

- Reads `messages.read`, writes `messages.write` (policy-first, so 403
  precedes any 422/lookup).
- **Participation is the boundary for every role incl. administrator:**
  non-participant → 404 `CONVERSATION_NOT_FOUND` (existence undisclosed).
- **Sender = authenticated user;** wire has no sender/`from` field;
  `from` derived per viewer.
- Unread = others' messages after the participant's `last_read_at`;
  `markRead` moves only the caller.
- Attachments: `mediaId` must resolve in-org (422); bytes readable iff
  `messages.read` + participant of the carrying thread; still-referenced
  asset → 409, never freed underneath.

## 4. Evidence (measured, not assumed)

- **Backend: 400 tests, 2783 assertions — OK** (385 + 15 new `ChatTest`:
  unauth 401, read matrix (accountant reads-own/403-writes), write matrix,
  forbidden-before-validation+lookup, unknown→404, cross-user 404-not-leak
  (list/get/messages/send), participant sharing with per-viewer `from`,
  unknown/cross-org participant 422, thread CRUD incl. archive hide/reveal/
  restore, body/provider/media 422s, non-in-app `unavailable`, per-caller
  markRead, bytes per participation (incl. linked-teacher 200 / stranger
  403), tenant 404, vocabulary contains `messages.*`, service round trip).
- **Frontend focused: 302 + 163 + earlier suites — all green** (chat api +
  registry, audit, targetCopy (slot parity), auth, messages attachments/
  export/no-fixtures, clientAvailability, gallery, media, DemoBackedNotice,
  settingsHonesty, architecture).
- **Typechecks:** default + client + demo — all exit 0. **Client build:**
  success; 0 demo markers; chat browser-only copy absent; login disclosure
  names exactly 2 domains.
- **Live (mariadbd 3307 + API 8080 + vite 5173, all stopped, ports clean):**
  login disclosure lists هویت آموزشگاه، جبرانی; empty thread list honest;
  UI thread create + send appear without reload (bump); accountant read own
  403-write / teacher stranger list 0 + read 404; two-user exchange shows
  correct per-viewer `me`/`them`; unread 0→1→0 across the cursor;
  attachment upload → `201` + bytes on disk, renders in participant's
  browser with download + client storage note; still-referenced asset
  survives message delete (verified in DB). **Baselines restored and
  verified:** chat 0/0, media 0, rooms 4, students 15, instruments 6
  (probe rows removed by id; orphaned probe media freed via API 204).

## 5. Assumptions vs verified / remaining risks

- **Verified:** everything in §4. Assumed nothing about auth — every matrix
  cell asserted server-side plus live cross-user checks.
- **Open owner decisions (documented, not guessed):** no admin/manager read
  bypass (oversight tooling needs a wider read?); no add/remove-participant
  or thread/message delete verbs (UI creates solo threads; API can name
  members at creation); no external provider delivery.
- **Pre-existing gap noticed, out of scope:** server `MediaReferences`
  still does not scan learning-content `media_id` (since §34).
- `PROJECT_STATE.md §6` link from §37 intentionally **not** added (same
  standing rule as prior slices).
- Full `npm test` (~8 min) not run; focused suites answer the slice.
- Next slice candidates: **branding** or **compensation** (last two
  unavailable), both media-adjacent.

## 6. Resume

```bash
git log -1 --format=%H; git status --short | wc -l
cd backend && vendor/bin/phpunit 2>&1 | tail -3
npx vitest run src/domains/chat src/views/__tests__/messagesAttachments.test.tsx src/domains/__tests__/registryClient.test.ts src/domains/auth --testTimeout=30000
npm run typecheck   # + both tsconfig profiles; then npm run build:client
# live (recipe §4): vite client → admin creates thread, staff (participant) replies; stranger sees nothing
```
