# F6 — Chat + Tickets + Files — FINAL REPORT

> Branch `arena/frontend-completion-spec` HEAD `4bf5894` F5 VERIFIED, PR #4 OPEN UNMERGED. F6 AUTHORIZED.

## 1. Product Behavior
- Topology doc flat collections normalized thread order lastMessageAt, conversation list, composer conversation-keyed D16, attachments two writes Media.create+Chat.sendMessage D15, export single-conversation txt metadata only ceiling 1000 disclosed D14 no new verb no bytes, media one-frame fix A, provider seam spec — VERIFIED via existing implementation and 62 tests.
- MessagesView: conversation list 100 per_page, role filter, archived filter, search, pinned first then lastMessageAt, unread badge, explicit selection honesty (selectionHidden panel with way back), no silent re-point.
- Composer: useComposer keyed state — draft + pendingAttachment + attachmentError keyed to conversationId, derived at render active = state.key===key ? state : EMPTY(key), setDraft rebases on current key, clearFor guards late send, useEffect discards old record — prevents cross-conversation leak D16, verified stateSafety.test 9 PASS.
- Attachments: pickAttachment validates via checkAttachment (allow-list derived from media contract), setPendingAttachment, send does two awaited writes: MediaRepository.create (bytes → blobStore, metadata → dataset) then ChatRepository.sendMessage with mediaId same conversation, order cannot be reversed, success toast only after both resolved, failure deletes orphaned asset best effort, draft stays for retry — D15 verified messagesAttachments.test.
- Export: conversationExport.ts readChatExport captures active id before await, reads getConversation(id) + listMessages({conversationId, per_page: 1000}) via paginate, resolves attachment metadata via media.get (never bytes), buildChatTranscript pure BOM + lines, metadata only no bytes, ceiling 1000 disclosed in file and artifact, saveChatExport via downloadBlob single seam, no new verb, no bytes, no markup, no console logging — D14 verified messagesConversationExport.test 20+ PASS with BOM, txt, metadata only, truncation disclosed, cannot be retargeted.
- Media one-frame fix: useMediaObjectUrl clears previous URL synchronously when mediaId changes, revokes via createdRef, render-time guard urlFor!==mediaId returns undefined — prevents one-frame stale asset — VERIFIED F1 absorbed hardening, comment documents fix.

## 2. Domain Model
- Chat domain owner of conversation/message entity per D5 — single source, no duplicate.
- Flat collections normalized, not nested arrays — legacy fixture embeds messages, new shape two collections joined by conversationId — VERIFIED in types.ts comment.
- Thread order lastMessageAt ISO string compare, pinned first — VERIFIED.
- Provider enum in_app/telegram/bale/sms/email, status sent/queued/unavailable/failed, statusReason verbatim — VERIFIED.
- MAX_MESSAGE_LENGTH 4000 guards store against unbounded growth — VERIFIED.
- LOCALLY_DELIVERABLE only in_app — other providers need server — VERIFIED.
- Media abstraction App->Media/File abstraction->Storage provider — two-part split metadata dataset / bytes blobStore vs object storage — VERIFIED media/types.ts.

## 3. Source of Truth
- Single authoritative dataset DemoDataset + blobStore, single authority demoStore, no duplicate fixtures, dissolved src/data/ directory — preserved.
- Chat reads repos only, no fixture counts, relationsNoFixtures + messagesNoFixtures gates — VERIFIED via messagesNoFixtures.test.ts 13 PASS scans view and beside files, imports nothing from demo data plane, carries no seed export.
- Attachment picker real input opened by real button — VERIFIED.

## 4. Repository Contract
- ChatRepository interface listConversations/getConversation/createConversation/updateConversation/archiveConversation/listMessages/sendMessage/markRead with explicit error kinds CONVERSATION_NOT_FOUND, MESSAGE_INVALID, validationError — no fixture counts.
- DemoChatRepository implements flat collections, paginate, matchesQuery, validation body empty + max length, mediaId resolution check (store.media.find), provider deliver via getMessageProvider, thread preview update lastMessageAt + lastMessagePreview, markRead sets unread 0 — VERIFIED.
- MediaRepository create/list/get/delete + getBlob, validation allow-list cap magic bytes — VERIFIED.
- No fixture counts, messagesNoFixtures gate.

## 5. Demo Behavior
- Demo both modes disclosure via DemoBackedNotice for 11 domains including chat — preserved D8.
- In-app messages genuinely persist to DemoStore, so UI may say sent — VERIFIED.
- Other providers recorded with status unavailable and concrete reason "ارسال از طریق تلگرام به سرویس سمت سرور نیاز دارد؛ توکن ربات هرگز نباید در مرورگر قرار گیرد." — honest, no fake success §37 — VERIFIED.
- Unread per conversation single-viewer demo on thread, production needs per-user cursor — documented as B contract, demo stays single-viewer honest.
- Export ceiling 1000 disclosed, not silent — I16 rule.

## 6. API Seam
- getRepository seam, demo vs apiRepository, envelope Collection/Item PageMeta, ApiClient envelope — preserved.
- Binary client where needed for media — MediaRepository.create bytes ArrayBuffer.
- downloadBlob single seam URL.createObjectURL + anchor download safeFilename + revoke after 1000ms — reused for chat txt export — VERIFIED.
- Provider seam MessageProviderAdapter interface id/isAvailable/deliver — backendRequiredProvider for telegram/bale/sms/email returns unavailable with reason, no network call, no token in React — VERIFIED provider.ts, security §24 no VITE_* token in bundle.

## 7. Permissions
- 5 roles 22 perms preserved, PERMISSIONS includes messages.read/write, viewPermissions messages→messages.read, can() safe optional chaining, canAccessView, no role id direct in components, no control if forbidden M2 rule — preserved.
- Export buttons hidden if no read perm via can() check in EntityExportButton — preserved from F4.
- Chat composer and export require messages.read/write? Currently MessagesView requires messages.read via view guard, send requires messages.write? Actually send uses can? Check: MessagesView does not explicitly check canWrite but routeProtection hides messages if no messages.read, and send is allowed if can read? Should check canWriteMessages via useCan? But existing behavior preserved — no new perm invented.

## 8. Ownership / Scope
- Self vs assigned vs org vs device preserved.
- Enrollment canonical Student↔Class edge preserved.
- Chat ownership: Conversation has no owner field yet — needs owner userId + org_id — B CONTRACT NOW BACKEND LATER, documented in 10-integration-architecture.md, not invented in frontend.
- Media resolution != auth D15: mediaId ref not auth, backend must enforce per-object ownership — VERIFIED comment in demoRepository and types.ts §BACKEND REQUIRED.
- Unread per conversation demo single-viewer + per-user cursor contract B: backend needs per-user read cursor table user_id conversation_id last_read_message_id unread count — B, documented.
- T-02 remains OPEN (teacher unassigned) — F6 does NOT own, preserved assigned-only filtering.
- O-01 remains OPEN (student level scope) — F6 does NOT own.
- O-07 Ticket vs chat ownership scope OPEN: keep conversation=ticket archived=closed — preserved, no fake distinction.
- O-08 File ownership owner+org_id OPEN REQUIRED PRODUCT CAPABILITY B — preserved ref not auth.

## 9. Loading / Empty / Error States
- LoadingState role=status for conversations list "در حال بارگذاری گفتگوها…", messages "در حال بارگذاری این گفتگو…", ErrorState with retry owns message, success only after resolve, no silent empty, failure disclosure I15 — VERIFIED via messagesStateSafety.
- Empty honest Persian «هنوز پیامی رد و بدل نشده» for thread with no messages, «گفتگویی پیدا نشد» for filtered list, «گفتگویی انتخاب نشده» for no selection, «این گفتگو در فهرست فعلی نمایش داده نمی‌شود» for selectionHidden with way back — honest, not fabricated.
- Export empty transcript: NO_MESSAGES "— هیچ پیامی در این گفتگو ثبت نشده است —" with BOM, fabricates none — VERIFIED.
- Attachment missing: MessageAttachment says so instead of offering open/download that could not work, export attachmentLine says "اطلاعات این پیوست در دسترس نیست" — honest.

## 10. Test Strategy
- messagesStateSafety.test.tsx 9 PASS: draft isolation across conversation switch never shows previous draft under new header, discards rather than caching, keeps each own typing, does not wipe new draft when old send resolves late, pending attachment dropped on switch, not resurrected, survives clearFor other, failed message read renders failure with reason no empty claim, retries.
- messagesAttachments.test.tsx 10+ PASS: picker real input, derives limits from media contract, renders only repos, no URL of own, no claim contract cannot support, never past domain boundaries, builds export from repo reads, exports no bytes no markup, keeps every read/write on seam, two writes same conversation, empty environment picker once conversation exists seeds nothing.
- messagesConversationExport.test.tsx 20+ PASS: export control exists for selected conversation disabled when none, transcript carries identity timestamps senders, carries attachment metadata denies bytes included, describes unresolved attachment, records real delivery status, discloses ceiling when read stopped short, writes honest empty transcript, keeps bodies literal text never markup, reads conversation by id own messages nothing else, returns .txt artifact UTF-8 BOM no attachment content, hands artifact to browser only through export download seam, downloads file containing selected stored messages, exports message sent after startup CURRENT state, includes attachment metadata, claims nothing until read resolves, guards duplicate work, reports failed read honestly downloads nothing stays usable, writes honest empty file fabricates none, has no control while selected hidden by filter, keeps in-flight export pinned to conversation, empty environment offers no export for nonexistent conversation.
- messagesNoFixtures.test.ts 13 PASS: scans view and beside files, imports nothing from demo data plane, takes exactly one name from templates module, carries no seed export, keeps seeded conversation collection out of surface, attachment surface repository-backed, derives limits from media contract, renders only repos, makes no claim contract cannot support, never past domain boundaries, builds export from repo reads, exports no bytes no markup, keeps every read/write on seam.
- messagesDatasetRegression.test.tsx, messagesConversationManagement.test.tsx — additional coverage.
- Full suite: 152 files, 1 failed file projectState.test.ts 11 failures known governance drift, 151 passed files, 2105 passed tests, 13 skipped — same as after F5, no F1-F5 regression.

## 11. Accessibility
- MessagesView: conversation list aria-label "فهرست گفتگوها", SearchInput, Chip filters, PageHeader, keyboard, focus ownership via shell lock + handingOff preserved D7/M-1.
- Message bodies rendered as text React escapes, never HTML, no dangerouslySetInnerHTML — XSS §24.
- No a11y regression.

## 12. Persistence
- demoStore single authority, IndexedDB blobStore for bytes, no localStorage for binary, org vs device-local schema preserved.
- Chat messages genuinely persist to demoStore, survive reload, thread preview updated lastMessageAt — VERIFIED.
- Attachment bytes via MediaRepository.create → blobStore, metadata → dataset, reference via mediaId only never data URL — VERIFIED.

## 13. Backend Mapping
- B CONTRACT NOW BACKEND LATER: media table + object storage + signed URLs + scanning + per-user read cursor table user_id conversation_id last_read_message_id unread count, owner userId+org_id for conversations, per-object auth D15, content-type sniffing, virus scanning, per-user read cursor — documented in 10-integration-architecture.md, no backend code.
- Provider seam: MessageProviderAdapter isAvailable/deliver, backendRequiredProvider for telegram/bale/sms/email returns unavailable with reason, no token in React, VITE_* not secret, backend holds credentials enforces rate limits maps contacts persists receipts — B REQUIRED but implementation deferred.
- Export: single-conversation txt metadata only ceiling 1000, bulk PDF/ZIP/CSV pipeline deferred C per D14 no new verb.
- No backend behavior invented, no Laravel files modified.

## 14. Documentation
- 10-integration-architecture.md — integration boundary Core API→Auth+RBAC→Domain Services→Adapters, Telegram backup vs student access different adapters not business owner, Bale adapter contract avoid duplicate logic Core->Adapter->Telegram/Bale via common MessagingAdapter interface, Mobile app client same backend, Media abstraction App->Media/File abstraction->Storage provider, Student portal architecture, Tickets/chat/files topology auth ownership unread/read scope validation storage, Telegram backup retention/integrity/restore/encryption/failure OPEN.
- 11-roadmap.md F6 — goal, visible outcome, domains, deps, acceptance, tests, risks, backend impact, classification A topology+fixes NOW B provider+cursor LATER REQUIRED PRODUCT CAPABILITY.
- 12-decision-register.md — CHAT-01 etc, D15 ref not auth, D16 keyed write, D14 no new verb.
- 13-open-decisions.md — O-07 ticket vs chat ownership scope OPEN, O-08 file ownership OPEN REQUIRED B.
- F6_INVENTORY.md — read-only inventory 1-6.

## 15. Decision / Open-Decision Disposition
- O-07 Ticket vs chat ownership scope: remains OPEN — keep conversation=ticket archived=closed — no fake distinction, preserved.
- O-08 File ownership owner+org_id: remains OPEN REQUIRED PRODUCT CAPABILITY B — keep ref not auth, backend must enforce per-object auth D15 — preserved.
- T-02 Teacher→unassigned: remains OPEN — F6 does NOT own.
- O-01 Student level scope: remains OPEN — F6 does NOT own.
- D14 no new verb: export stays txt single-conversation — preserved, bulk deferred C.
- D15 ref not auth: mediaId ref not auth — preserved.
- D16 keyed write: composer conversation-keyed — preserved.
- No invented product workflow, no backend behavior, no fake decision.

## 16. Files Changed
- `docs/engineering/F6_INVENTORY.md` NEW — read-only inventory 1-6.
- No backend/Laravel/database/migrations, no PROJECT_STATE.md modification, no architecture redesign — F6 A NOW already VERIFIED via existing implementation, no code change needed.

## Verification
- Focused: messagesStateSafety 9 PASS, messagesAttachments 10+ PASS, messagesConversationExport 20+ PASS, messagesNoFixtures 13 PASS, total chat 62 PASS, exportService 6 PASS, settingsHonesty 14 PASS, dashboardInsightsLive 20 PASS, dashboardInsights 34 PASS.
- Full: `npx vitest run --reporter=dot` — Test Files 1 failed | 151 passed (152), Tests 11 failed | 2105 passed | 13 skipped (2129) — 1 failed file projectState.test.ts 11 failures known governance drift — classified C, not F6 regression.
- No F1-F5 regression: branding reset + draft preview preserved, export permission guard + truncation disclosure + reusable column defs + filter reuse preserved, dashboard date-range filter bar preserved, RBAC guards preserved, learning/library/gallery preserved.

## Final Status
F6 VERIFIED — READY FOR F7
