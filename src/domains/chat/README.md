# Chat domain — contract, consumers and boundaries

The messaging domain behind `#/messages`. Two normalized collections joined by
`conversationId` — `chatConversations` (threads, listable) and `chatMessages`
(one row per message, paged) — read and written through `ChatRepository` and
nothing else. This file records what the contract is, which parts the shipped UI
now consumes, and what the domain does **not** claim.

`docs/engineering/PROJECT_STATE.md` §6 lists the suites that pin this contract;
`docs/engineering/DECISIONS.md` **D14–D16** record the M6 decisions it rests on.

## 1. The contract

`repository.ts` — the interface; `types.ts` — the data; `demoRepository.ts` — the
only registered implementation; `provider.ts` — delivery adapters; `useChat.ts` —
the two read hooks.

| Verb | Behaviour |
|---|---|
| `listConversations(params)` | Filters by `search` (name/topic) and `role`; **hides `archived` threads unless `includeArchived: true`**; sorts pinned-first, then `lastMessageAt` desc |
| `getConversation(id)` | One thread by id. Throws `CONVERSATION_NOT_FOUND` when it does not exist |
| `createConversation(input)` | New thread, `unread: 0`, empty preview |
| `updateConversation(id, patch)` | `name`, `topic`, `pinned`, `archived`. Trims and validates the name (≥ 2 chars); unknown ids refuse (`CONVERSATION_NOT_FOUND`); the refusal is a `validation`/`not_found` `ApiError` with `fields` |
| `archiveConversation(id)` | Convenience for `updateConversation(id, { archived: true })` — **one write path, no second code path to disagree with** |
| `listMessages({ conversationId, page, per_page })` | A thread's messages, oldest first, with `meta.total` from the repository |
| `sendMessage(input)` | Validates the body (non-empty, `MAX_MESSAGE_LENGTH = 4000`), resolves `mediaId` when present, asks the provider to deliver, then writes the message and updates the thread preview. Returns the message **with the provider's real status** |
| `markRead(id)` | Clears `unread`, refuses an unknown id |

**Archive is reversible by contract.** `updateConversation` accepts
`archived: false` and that *is* the restore path; no unarchive verb exists or is
needed. `archiveConversation` was kept because it was already published, and it
delegates rather than duplicating the write.

**Delivery honesty (§37)** — the rule is also stated in
`docs/architecture/data-layer.md` → "Chat delivery honesty". `MessageStatus` is
`sent | queued | unavailable |
failed`, and only `in_app` can genuinely reach `sent` — persistence *is* delivery
for an in-app thread, because the recipient reads the same store. Every other
provider (Telegram, Bale, SMS, email) has no server behind it in this repository:
`deliver` returns `unavailable` with a reason, the message is still recorded with
that status, and the UI repeats the reason instead of claiming a send. `queued`
and `failed` exist for a backend that can produce them. **No code path fakes an
external send:** `provider.ts` has exactly two behaviours —
`inAppProvider`, which reports `sent` because persistence *is* delivery for an
in-app thread, and `backendRequiredProvider`, which performs no network call and
returns `unavailable` with a concrete reason. A `setTimeout` resolving to "sent"
is the fake success this domain exists to refuse, and it does not exist here.

**Errors** are `ApiError`s from `shared/demoCollection`: `CONVERSATION_NOT_FOUND`,
`CONVERSATION_INVALID`, `MESSAGE_INVALID` (with `fields.body` or `fields.mediaId`).

### Verbs with no shipped caller

| Verb | Why | Owner |
|---|---|---|
| `archiveConversation` | The manager dialog archives and restores through `updateConversation`, because the same control does both directions and one write path is what makes restore provable | M6 (deliberate) |

`getConversation` was in this position before M6 and is now consumed — by the
export read (§4) and, internally, by `markRead` and `listMessages`.

## 2. What the UI consumes (M6)

`src/views/Messages.tsx` and `src/views/messages/*`:

- **Reads** — `useConversations` (search, role, archived filter) and
  `useMessages` for the selected thread. Both expose `loading` and `error`, and
  the view reads all three states: an in-flight read is not an empty thread, and
  a failed read is a failure with the repository's own sentence plus a retry —
  never «هنوز پیامی رد و بدل نشده» (this was **I15** at this site).
- **Conversation management** — `ConversationManagerDialog` calls
  `updateConversation` for rename, topic, pin **and** archive/restore. Archived
  threads leave the default list, are discoverable through the explicit archived
  filter, are badged as archived, and come back to the default list after a
  restore. A selection the current query hides is reported as hidden, with the
  way back, and never silently re-pointed at another thread.
- **Messages** — `sendMessage` writes through the composer; `markRead` clears the
  badge when a thread is opened.
- **Composer state** is conversation-keyed (`useComposer`): the draft, the pending
  file and the last validation refusal all belong to the conversation that
  produced them, and a send that resolves after a switch cannot clear the draft
  typed in the new conversation.

## 3. Attachments — `mediaId`, and what it does *not* mean

A message may carry one attachment, expressed as `SendMessageInput.mediaId` /
`ChatMessage.mediaId` — **a reference into the media domain and nothing else**.
The chat domain stores no attachment metadata, no filename and no bytes: the
transcript of a message is `mediaId`, and everything else is read back from
`MediaRepository`.

```text
MediaRepository.create(...)   → bytes stored, metadata recorded          (media domain)
ChatRepository.sendMessage({ …, mediaId }) → message written, referencing it (this domain)
```

- The order is not a preference. `sendMessage` **refuses a `mediaId` that does not
  resolve** (`MESSAGE_INVALID`, `fields.mediaId`) *before* provider delivery and
  before any write, so a dangling reference cannot be persisted — which is why the
  message can only be sent after its asset exists.
- **Resolution, not authorization.** That check answers "does this reference
  exist". Per-object ownership and access control are server-side concerns
  (`src/domains/media/types.ts` says so in its header), and neither the chat
  domain nor the view claims otherwise. There is no frontend ownership guarantee
  to bypass because none is asserted.
- **A message body is mandatory.** `sendMessage` refuses an empty one, so an
  attachment alone is not sendable; the composer says so rather than dropping the
  file silently.
- Rendering reads the reference off the **stored** message and resolves metadata
  (and, in the attachment card, bytes) through the media repository. Missing bytes
  are reported as unavailable — no fabricated object URL, no download affordance
  that could not work.

## 4. Export read path

There is **no export verb**, deliberately. A single-conversation transcript is
expressible with two existing reads:

```text
getConversation(id)                                   → the thread (name, topic, id, archived)
listMessages({ conversationId, page, per_page })      → its messages + meta.total
```

`src/views/messages/conversationExport.ts` composes those two reads at call time,
builds a plain-text transcript, and hands it to the browser through the export
domain's existing `downloadBlob` seam. Consequences worth knowing:

- The export reads by **id**, never by list position, so a list that changes
  underneath it cannot retarget it.
- `per_page` is an explicit ceiling (`EXPORT_MESSAGE_CEILING = 1000`) and
  `meta.total` is compared against what arrived: a truncated read is **disclosed
  in the file and in the confirmation**, not silently reported as complete (I16's
  rule).
- Attachment **metadata** is included; attachment **bytes** are not, and the file
  says so. Exporting binaries would need object storage the repository does not
  have.
- Adding a chat-specific export or download verb would duplicate reads this
  contract already serves; it was not added.

## 5. Persistence and environment boundary

| Fact | Consequence |
|---|---|
| Both collections live in the DemoStore (`chatConversations`, `chatMessages`) | Messages, thread renames, pins and archive state persist in the browser — `localStorage` behind `demoStore`, and the dataset is what backup/restore carries. **No message body is ever written to `localStorage` by the view**: the view only reaches the store through the repository |
| Attachment bytes live in the **media** blob store (IndexedDB, or an in-memory store where IndexedDB is absent) | A thread's attachment survives a reload only in the browser that uploaded it. A backup carries metadata and **not** binaries, so a restored attachment legitimately reports its bytes as unavailable |
| `registry.ts` resolves chat to `DemoChatRepository` in **both** modes | There is no chat API repository in this repository and no server endpoint behind one. A backend is required before a real academy shares a thread between two people |
| The demo seed carries threads and messages | Those rows are seed data, not fixtures read by the view: the view reads the repositories, and every M6 suite asserts repository-backed behaviour (see `src/views/__tests__/messagesNoFixtures.test.ts`, which forbids the surface from touching `@/data/records`, `localStorage`, `demoStore` or a hardcoded transcript) |

## 6. What this domain does not claim

- **No server persistence.** Nothing here stores a message, an attachment or a
  thread anywhere but this browser's demo environment.
- **No delivery beyond `in_app`.** Telegram, Bale, SMS and email are contracts
  awaiting a backend; they report `unavailable`.
- **No attachment ownership or authorization enforcement.** The reference is
  checked for existence only; production needs server-enforced per-object
  authorization, signed and expiring URLs, content-type sniffing by the server and
  virus scanning (`src/domains/media/types.ts`, `docs/production-handoff.md`).
- **No attachment binary export**, no bulk/multi-conversation export, and no
  PDF/ZIP/CSV pipeline for chat.
- **No provider integration, no notifications domain, no group moderation** — M6's
  declared out-of-scope items, unchanged.
- **No browser QA.** Every claim in this file is pinned by jsdom tests plus `tsc`;
  no human has opened `#/messages` in a browser, and the real file-picker and
  file-download paths are among the things jsdom cannot exercise
  (`docs/engineering/PROJECT_STATE.md` §5).
