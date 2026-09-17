import type { Page } from "@/api/types";
import type {
  ChatConversation,
  ChatMessage,
  ConversationListParams,
  CreateConversationInput,
  MessageListParams,
  SendMessageInput,
} from "./types";

export interface ChatRepository {
  listConversations(params?: ConversationListParams, signal?: AbortSignal): Promise<Page<ChatConversation>>;
  getConversation(id: string, signal?: AbortSignal): Promise<ChatConversation>;
  createConversation(input: CreateConversationInput): Promise<ChatConversation>;
  /** Renaming a thread's display name/topic, pinning it, or archiving/restoring it. */
  updateConversation(
    id: string,
    patch: { name?: string; topic?: string; pinned?: boolean; archived?: boolean },
  ): Promise<ChatConversation>;
  /**
   * Archives a thread — a convenience for `updateConversation(id, { archived: true })`.
   *
   * ARCHIVE IS REVERSIBLE. `updateConversation` accepts `archived: false` and is
   * the restore path, so no separate unarchive verb exists or is needed. An
   * archived thread is hidden from `listConversations` unless
   * `ConversationListParams.includeArchived` is set.
   */
  archiveConversation(id: string): Promise<ChatConversation>;

  listMessages(params: MessageListParams, signal?: AbortSignal): Promise<Page<ChatMessage>>;
  /**
   * Persists an outbound message and asks its provider to deliver.
   * The returned message carries the provider's HONEST status — a provider
   * that cannot deliver yields `unavailable`, never `sent`.
   */
  sendMessage(input: SendMessageInput): Promise<ChatMessage>;
  /** Clears the unread counter for a thread. */
  markRead(conversationId: string): Promise<ChatConversation>;
}
