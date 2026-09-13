/**
 * Chat domain.
 *
 * ARCHITECTURE DECISION — messages are a flat collection, not nested arrays.
 *
 * The legacy `Conversation` fixture in `@/data/records` embeds its messages
 * (`messages: {...}[]`). That shape cannot express paging, per-message delivery
 * state, or appending without rewriting the whole thread, and it forces every
 * read of the conversation list to carry every message ever sent.
 *
 * So chat uses two normalized collections joined by `conversationId`:
 * threads stay small and listable, messages page independently, and a message
 * can carry its own delivery state. The legacy fixture is used only to seed.
 *
 * DELIVERY HONESTY (§37)
 *
 * `in_app` messages genuinely persist to the DemoStore, so the UI may say they
 * were sent. Every other provider (Telegram, Bale, SMS, email) requires a
 * server that this repository does not have: those messages are recorded with
 * status `"unavailable"` and the UI must say so rather than claim delivery.
 * No code path fakes an external send.
 */
import type { ListParams } from "@/api/types";

/**
 * Where a message is delivered. `in_app` is the only provider implementable
 * purely in the browser; the rest are contracts awaiting a backend.
 */
export type MessageProvider = "in_app" | "telegram" | "bale" | "sms" | "email";

/**
 * Lifecycle of one message.
 *
 * - `sent`        — genuinely persisted to the demo store (in-app only)
 * - `queued`      — accepted, awaiting a backend that will actually transmit
 * - `unavailable` — the provider needs infrastructure that does not exist here
 * - `failed`      — an attempted operation genuinely failed
 */
export type MessageStatus = "sent" | "queued" | "unavailable" | "failed";

export type ChatParticipantRole = "student" | "teacher" | "guardian" | "group" | "staff";

export interface ChatConversation {
  id: string;
  /** Display name of the counterpart or group. */
  name: string;
  role: ChatParticipantRole;
  /** Short subject line shown in the thread list. */
  topic: string;
  /** Domain id of the linked student/teacher when applicable. */
  subjectId?: string;
  pinned?: boolean;
  /** ISO-8601 of the most recent message; drives list ordering. */
  lastMessageAt: string;
  /** Denormalized preview of the last message body, for the list row. */
  lastMessagePreview: string;
  /**
   * Unread count for the current viewer. A single-viewer demo can store this
   * on the thread; production needs a per-user read cursor instead.
   */
  unread: number;
  archived?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  /** `"me"` is the signed-in operator; `"them"` is the counterpart. */
  from: "me" | "them";
  /** Plain text. Rendered as text, never as HTML — see the XSS note below. */
  body: string;
  /** ISO-8601 creation time. */
  sentAt: string;
  provider: MessageProvider;
  status: MessageStatus;
  /** Why a message is `unavailable`/`failed`, shown verbatim to the operator. */
  statusReason?: string;
  /** Optional attachment reference into the media domain. */
  mediaId?: string;
}

export interface ConversationListParams extends ListParams {
  search?: string;
  role?: ChatParticipantRole;
  includeArchived?: boolean;
}

export interface MessageListParams extends ListParams {
  conversationId: string;
}

export interface CreateConversationInput {
  name: string;
  role: ChatParticipantRole;
  topic: string;
  subjectId?: string;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  /** Defaults to `in_app`, the only provider that can genuinely deliver here. */
  provider?: MessageProvider;
}

/** Longest accepted message body; guards the store against unbounded growth. */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Providers that can genuinely deliver from the browser.
 * Everything else is contract-only until a backend exists.
 */
export const LOCALLY_DELIVERABLE: readonly MessageProvider[] = ["in_app"];

export const providerLabel: Record<MessageProvider, string> = {
  in_app: "پیام داخلی",
  telegram: "تلگرام",
  bale: "بله",
  sms: "پیامک",
  email: "ایمیل",
};
