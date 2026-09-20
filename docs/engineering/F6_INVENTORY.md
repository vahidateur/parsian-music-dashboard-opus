# F6 — Chat + Tickets + Files — READ-ONLY INVENTORY

> Branch `arena/frontend-completion-spec` HEAD `2d05ba3` F5 VERIFIED, PR #4 OPEN UNMERGED. No file modifications during inventory.

## 1. F6 Goal (canonical from 11-roadmap.md)

Tickets/chat/files topology auth ownership unread/read scope validation storage, media abstraction App->Media/File abstraction->Storage provider.

## 2. Domains / Slices

- chat/types + demoRepository + useChat + Messages view + messages/composerTemplates, media/types + useMedia + useMediaObjectUrl, export/downloadBlob
- chat/types.ts: MessageProvider in_app/telegram/bale/sms/email, MessageStatus sent/queued/unavailable/failed, ChatConversation id/name/role/topic/subjectId/pinned/lastMessageAt/lastMessagePreview/unread/archived, ChatMessage id/conversationId/from/body/sentAt/provider/status/statusReason/mediaId, ConversationListParams, MessageListParams, CreateConversationInput, SendMessageInput with mediaId ref, MAX_MESSAGE_LENGTH 4000, LOCALLY_DELIVERABLE [in_app], providerLabel Persian.
- chat/demoRepository.ts: flat collections normalized, thread order lastMessageAt, conversation list, composer keyed? need verify, attachments two writes? need verify, export single-conversation txt metadata only ceiling 1000 disclosed D14, media one-frame fix A, provider seam spec.
- useChat.ts: useConversations, useMessages hooks.
- Messages.tsx: conversation list, composer conversation-keyed D16, attachments two writes Media.create+Chat.sendMessage D15, export single-conversation txt metadata only ceiling 1000 disclosed D14 no new verb no bytes, media one-frame fix.
- messages/conversationExport.ts: readChatExport, saveChatExport, buildChatTranscript, txt with BOM, metadata only no bytes, ceiling 1000 disclosed.
- media/types.ts + useMedia + useMediaObjectUrl: metadata dataset + blobStore, allow-list size ceilings image jpeg/png/webp/gif SVG excluded XSS audio mp3/mp4/ogg/wav/webm doc pdf/txt, two writes pattern.
- export/downloadBlob: reuse from F4.

Slices per 10-integration-architecture.md + 11-roadmap F6:
- A NOW: topology doc flat collections normalized thread order lastMessageAt, conversation list, composer conversation-keyed D16, attachments two writes Media.create+Chat.sendMessage D15, export single-conversation txt metadata only ceiling 1000 disclosed D14 no new verb no bytes, media one-frame fix A, provider seam spec
- B CONTRACT NOW BACKEND LATER: auth ownership userId+org_id, per-user read cursor, validation, storage S3/MinIO signed URLs content sniffing virus scanning, per-object auth D15, provider unavailable/failed honest
- C DEFERRED: bulk chat PDF/ZIP/CSV pipeline (stays txt single-conversation per D14)

## 3. Current Implementation State — Partial (needs verification)

**Already complete (verified via grep and existing tests):**
- Topology doc flat collections normalized — VERIFIED in chat/types.ts comment: messages are flat collection not nested arrays, two normalized collections joined by conversationId, threads small listable, messages page independently — VERIFIED.
- Thread order lastMessageAt — VERIFIED: ChatConversation lastMessageAt drives list ordering, conversationExport uses it.
- Conversation list — VERIFIED: useConversations reads repo listConversations, MessagesView shows list.
- Provider enum includes bale — VERIFIED chat/types.ts providerLabel includes bale, telegram, sms, email, in_app.
- Status unavailable when no backend — VERIFIED: MessageStatus unavailable, statusReason shown verbatim, LOCALLY_DELIVERABLE only in_app, other providers recorded with status unavailable and UI must say so rather than claim delivery — VERIFIED comment DELIVERY HONESTY §37.
- MAX_MESSAGE_LENGTH 4000 — VERIFIED.
- Validation body max 4000 mediaId resolves — VERIFIED? Need check demoRepository validates mediaId resolves, body length capped — likely VERIFIED via messagesAttachments.test.
- Storage metadata dataset blobStore demo + S3/MinIO backend B signed expiring URLs content sniffing virus scanning — A NOW demo part VERIFIED via media types allow-list, blobStore IndexedDB.
- Export single-conversation txt metadata only ceiling 1000 disclosed D14 no new verb no bytes — VERIFIED: conversationExport.ts readChatExport + saveChatExport, txt with BOM, metadata only, ceiling 1000 disclosed, no new verb, no bytes.
- Media allow-list size ceilings image jpeg/png/webp/gif SVG excluded XSS audio mp3/mp4/ogg/wav/webm doc pdf/txt — VERIFIED via media/types.ts ALLOWED_* constants.
- Sensitive-field policy: mediaId ref never data URL — VERIFIED.

**Gaps / Needs re-verification (F6 scope):**
- Composer conversation-keyed D16 — GAP? Need verify Messages.tsx composer state keyed by conversationId prevents cross-conversation leak — check if composer uses useState keyed by conversationId or useEffect resets when conversation changes. Grep shows conversationId used but need to verify keyed write implementation.
- Attachments two writes Media.create+Chat.sendMessage D15 — GAP? Need verify MessagesView does Media.create then Chat.sendMessage with mediaId in same conversation — grep shows mediaId and conversationId but need to verify two writes same conversation, not cross-conversation.
- Export txt BOM metadata only — VERIFIED but need to ensure BOM present via UTF8_BOM, and ceiling 1000 disclosed in UI and in artifact.
- Media one-frame fix A — GAP? Need verify useMediaObjectUrl does not show previous asset/blob/object URL for one frame — check if it revokes previous URL synchronously? Existing fix in F1/F2 maybe but need re-verification for chat attachments.
- Provider seam spec — GAP? Need spec doc for MessagingAdapter interface common for Telegram/Bale, avoid duplicate logic Core->Adapter->Telegram/Bale, no business logic in bots — currently only enum, not interface — needs spec file or doc.
- Auth messages.read/write — VERIFIED permissions.ts has messages.read/write, viewPermissions messages→messages.read, but per-conversation auth scope (teacher sees assigned only) — OPEN decision O-07 ticket vs chat ownership scope.
- Ownership userId+org_id future B — GAP: Conversation has no owner field, needs owner userId + org_id — B contract.
- Unread per conversation demo single-viewer + per-user cursor contract B — GAP: currently unread on thread single-viewer, backend needs per-user cursor table user_id conversation_id last_read_message_id unread count — B.
- D14 no new verb — VERIFIED export stays txt single-conversation, no bulk.
- D15 ref not auth — VERIFIED mediaId ref not auth, backend must enforce per-object ownership.
- D16 keyed write — needs verification.

## 4. Dependencies / Blockers

- Media abstraction: App->Media/File abstraction->Storage provider — VERIFIED two-part split metadata dataset / bytes blobStore vs object storage — no blocker.
- Media allow-list: ALLOWED_IMAGE_TYPES, ALLOWED_AUDIO_TYPES, ALLOWED_DOCUMENT_TYPES — exists — no blocker.
- Size ceilings per kind — exists — no blocker.
- No data URL — mediaId ref only — VERIFIED — no blocker.
- DemoStore single authority — exists — no blocker.
- RBAC: messages.read/write permission — exists — no blocker for frontend guard.
- Export: downloadBlob seam, toCsv BOM already via F4 — no blocker.
- Composer keyed state: needs conversationId as key for useState — frontend-only — no blocker.
- Attachments two writes: needs MediaRepository.create then ChatRepository.sendMessage — both exist, demo both modes — no blocker.
- Provider seam: needs MessagingAdapter interface spec — can be doc-only — no blocker for frontend.
- O-07 Ticket vs chat ownership scope OPEN: keep conversation=ticket archived=closed — no blocker, keep current.
- O-08 File ownership owner+org_id OPEN REQUIRED PRODUCT CAPABILITY B — no blocker for frontend, keep ref not auth.
- No blocker for F6-1 topology doc — leaf.

## 5. Exact Files Likely to Change

- `src/domains/chat/types.ts` — already has provider enum, status, conversation/message shapes, MAX_MESSAGE_LENGTH, LOCALLY_DELIVERABLE, providerLabel — may add owner field comment for B contract but no functional change A NOW.
- `src/domains/chat/demoRepository.ts` — verify flat collections, lastMessageAt ordering, validation body max 4000 mediaId resolves, unread single-viewer, attachment two writes same conversation, composer keyed D16, media one-frame fix.
- `src/domains/chat/useChat.ts` — useConversations, useMessages hooks with bounded per_page, ensure no fixture.
- `src/views/Messages.tsx` — ensure composer state keyed by conversationId (useState with conversationId key or useEffect reset), ensure attachments two writes Media.create+Chat.sendMessage in same conversation, ensure export txt BOM metadata only ceiling 1000 disclosed D14, ensure media one-frame fix via useMediaObjectUrl, ensure no new verb.
- `src/views/messages/conversationExport.ts` — readChatExport, saveChatExport, buildChatTranscript, txt with BOM, metadata only, ceiling 1000 disclosed, no bytes.
- `src/domains/media/types.ts` — allow-list ALLOWED_IMAGE_TYPES etc, size ceilings, SVG excluded XSS, two writes pattern, mediaId ref never data URL.
- `src/domains/media/useMedia.ts`, `useMediaObjectUrl.ts` — ensure one-frame fix: revoke previous URL before setting new, no sync revoke exposure.
- `src/domains/export/exportService.ts` — chat export stays separate from tabular exports per D14 no new verb, keep downloadBlob seam.
- `src/domains/chat/__tests__/` — composer keyed stateSafety.test, attachment two writes messagesAttachments.test, export txt BOM messagesConversationExport.test, media one-frame, no fixture, relationsNoFixtures, messagesNoFixtures gate.
- Docs: `docs/frontend-completion/10-integration-architecture.md` — update chat tickets topology section, `docs/frontend-completion/11-roadmap.md` F6 already, `docs/frontend-completion/12-decision-register.md` — CHAT-01 etc, `docs/frontend-completion/13-open-decisions.md` O-07 O-08.
- No backend/Laravel/database/migrations — per hard boundary.

## 6. Implementation Order

- F6-1 leaf: topology doc flat collections normalized thread order lastMessageAt — verify existing, no code change if already VERIFIED, doc update if needed.
- F6-2: composer conversation-keyed D16 — ensure composer state keyed by conversationId prevents cross-conversation leak — add key prop or useEffect that resets body/media when conversationId changes, test stateSafety.test.
- F6-3: attachments two writes Media.create+Chat.sendMessage D15 — ensure MessagesView does Media.create then Chat.sendMessage with mediaId in same conversation, validates mediaId resolves, same conversation, test messagesAttachments.test.
- F6-4: export single-conversation txt metadata only ceiling 1000 disclosed D14 no new verb no bytes — ensure conversationExport has BOM UTF8_BOM, metadata only, ceiling 1000 disclosed in artifact and UI, test messagesConversationExport.test.
- F6-5: media one-frame fix A — ensure useMediaObjectUrl revokes previous URL before setting new, no frame showing previous asset, test media one-frame.
- F6-6: provider seam spec — add MessagingAdapter interface doc or type, avoid duplicate logic Core->Adapter->Telegram/Bale, no business logic in bots, provider enum already includes bale — doc-only + type.
- Final: full Vitest regression, no F1-F5 regression, docs update.

No blocker exists for F6-1 — begin first vertical slice: verify topology + composer keyed + attachments two writes + export txt BOM + media one-frame fix + provider seam spec.
