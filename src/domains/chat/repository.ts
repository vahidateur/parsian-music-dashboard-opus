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
  /** Renaming a thread's display name/topic. */
  updateConversation(id: string, patch: { name?: string; topic?: string; pinned?: boolean }): Promise<ChatConversation>;
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
