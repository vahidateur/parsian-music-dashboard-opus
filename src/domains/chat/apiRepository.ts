import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import type { ChatRepository } from "./repository";
import type {
  ChatConversation,
  ChatMessage,
  ConversationListParams,
  CreateConversationInput,
  MessageListParams,
  SendMessageInput,
} from "./types";

const CONVERSATIONS = "chat/conversations";

/**
 * REST implementation of the chat domain.
 *
 * Endpoints served by the server (DECISIONS.md §37):
 *   threads  GET|POST /chat/conversations, GET|PATCH /chat/conversations/{id},
 *            POST /chat/conversations/{id}/archive, POST .../read
 *   messages GET|POST /chat/conversations/{id}/messages
 *
 * Reads require `messages.read`, writes require `messages.write`. Participation
 * is the read boundary inside every endpoint: the wire never carries a sender
 * (or a `from`) — the server records the authenticated user and derives the
 * side per viewer.
 *
 * Successful writes bump the shared data version, the same invalidation every
 * other list hook listens to, so the thread list and the open thread refresh
 * without knowing who wrote. A write the server refused changes nothing, so
 * the version is bumped only after the write has actually happened. Reads —
 * including `markRead`'s own follow-up read — bump nothing.
 */
export class ApiChatRepository implements ChatRepository {
  constructor(private readonly client: ApiClient) {}

  /* ------------------------------------------------------------ threads */

  listConversations(params: ConversationListParams = {}, signal?: AbortSignal): Promise<Page<ChatConversation>> {
    return this.client.getPage<ChatConversation>(CONVERSATIONS, { query: toConversationQuery(params), signal });
  }

  getConversation(id: string, signal?: AbortSignal): Promise<ChatConversation> {
    return this.client.get<ChatConversation>(`${CONVERSATIONS}/${encodeURIComponent(id)}`, { signal });
  }

  async createConversation(input: CreateConversationInput): Promise<ChatConversation> {
    const created = await this.client.post<ChatConversation>(CONVERSATIONS, input);
    bumpDataVersion();
    return created;
  }

  async updateConversation(
    id: string,
    patch: { name?: string; topic?: string; pinned?: boolean; archived?: boolean },
  ): Promise<ChatConversation> {
    const updated = await this.client.patch<ChatConversation>(`${CONVERSATIONS}/${encodeURIComponent(id)}`, patch);
    bumpDataVersion();
    return updated;
  }

  async archiveConversation(id: string): Promise<ChatConversation> {
    const archived = await this.client.post<ChatConversation>(`${CONVERSATIONS}/${encodeURIComponent(id)}/archive`, {});
    bumpDataVersion();
    return archived;
  }

  /* ------------------------------------------------------------ messages */

  listMessages(params: MessageListParams, signal?: AbortSignal): Promise<Page<ChatMessage>> {
    return this.client.getPage<ChatMessage>(`${CONVERSATIONS}/${encodeURIComponent(params.conversationId)}/messages`, {
      query: toMessageQuery(params),
      signal,
    });
  }

  async sendMessage(input: SendMessageInput): Promise<ChatMessage> {
    const created = await this.client.post<ChatMessage>(`${CONVERSATIONS}/${encodeURIComponent(input.conversationId)}/messages`, {
      body: input.body,
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.mediaId !== undefined ? { mediaId: input.mediaId } : {}),
    });
    bumpDataVersion();
    return created;
  }

  async markRead(conversationId: string): Promise<ChatConversation> {
    const updated = await this.client.post<ChatConversation>(`${CONVERSATIONS}/${encodeURIComponent(conversationId)}/read`, {});
    bumpDataVersion();
    return updated;
  }
}

/** Domain params → wire query params (snake_case, per the API contract). */
export function toConversationQuery(params: ConversationListParams): QueryParams {
  return {
    search: params.search,
    role: params.role,
    include_archived: params.includeArchived ? 1 : undefined,
    page: params.page,
    per_page: params.per_page,
  };
}

export function toMessageQuery(params: MessageListParams): QueryParams {
  return {
    page: params.page,
    per_page: params.per_page,
  };
}
