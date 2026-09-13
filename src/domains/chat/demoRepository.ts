/**
 * Demo chat repository.
 *
 * Messages genuinely persist to the DemoStore, so an in-app send is a real
 * state change and the UI may say so. Anything requiring a server records a
 * truthful `unavailable` status instead of a fake success (§37).
 *
 * XSS (§24): message bodies are stored as plain text and rendered as text by
 * React, which escapes by default. Nothing here produces HTML, and no consumer
 * may pass a body to `dangerouslySetInnerHTML`.
 */
import type { Page } from "@/api/types";
import { matchesQuery, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { getMessageProvider } from "./provider";
import type { ChatRepository } from "./repository";
import {
  MAX_MESSAGE_LENGTH,
  type ChatConversation,
  type ChatMessage,
  type ConversationListParams,
  type CreateConversationInput,
  type MessageListParams,
  type SendMessageInput,
} from "./types";

export class DemoChatRepository implements ChatRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async listConversations(params: ConversationListParams = {}): Promise<Page<ChatConversation>> {
    const rows = this.store.chatConversations
      .all()
      .filter((row) => {
        if (!params.includeArchived && row.archived) return false;
        if (params.role && row.role !== params.role) return false;
        return matchesQuery([row.name, row.topic, row.lastMessagePreview], params.search);
      })
      // Pinned first, then most recent. Sorting on the ISO timestamp is a
      // plain string compare, which is why `lastMessageAt` is stored as ISO.
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });
    return paginate(rows, params);
  }

  async getConversation(id: string): Promise<ChatConversation> {
    const found = this.store.chatConversations.find(id);
    if (!found) throw notFound("CONVERSATION_NOT_FOUND", `گفتگو با شناسهٔ ${id} یافت نشد.`);
    return found;
  }

  async createConversation(input: CreateConversationInput): Promise<ChatConversation> {
    if (input.name.trim().length < 2) {
      throw validationError("CONVERSATION_INVALID", "اطلاعات گفتگو معتبر نیست.", { name: ["نام الزامی است."] });
    }
    return this.store.chatConversations.create({
      name: input.name.trim(),
      role: input.role,
      topic: input.topic.trim(),
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      unread: 0,
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: "",
    });
  }

  async updateConversation(
    id: string,
    patch: { name?: string; topic?: string; pinned?: boolean },
  ): Promise<ChatConversation> {
    await this.getConversation(id);
    if (patch.name !== undefined && patch.name.trim().length < 2) {
      throw validationError("CONVERSATION_INVALID", "نام گفتگو معتبر نیست.", { name: ["نام الزامی است."] });
    }
    const updated = this.store.chatConversations.update(id, {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.topic !== undefined ? { topic: patch.topic.trim() } : {}),
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
    });
    if (!updated) throw notFound("CONVERSATION_NOT_FOUND", `گفتگو با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  async archiveConversation(id: string): Promise<ChatConversation> {
    await this.getConversation(id);
    const updated = this.store.chatConversations.update(id, { archived: true });
    if (!updated) throw notFound("CONVERSATION_NOT_FOUND", `گفتگو با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  async listMessages(params: MessageListParams): Promise<Page<ChatMessage>> {
    await this.getConversation(params.conversationId);
    const rows = this.store.chatMessages
      .all()
      .filter((row) => row.conversationId === params.conversationId)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    return paginate(rows, params);
  }

  async sendMessage(input: SendMessageInput): Promise<ChatMessage> {
    await this.getConversation(input.conversationId);

    const body = input.body.trim();
    if (body.length === 0) {
      throw validationError("MESSAGE_INVALID", "متن پیام خالی است.", { body: ["متن پیام الزامی است."] });
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      throw validationError("MESSAGE_INVALID", "متن پیام بیش از حد طولانی است.", {
        body: [`حداکثر ${MAX_MESSAGE_LENGTH} نویسه مجاز است.`],
      });
    }

    const providerId = input.provider ?? "in_app";
    const provider = getMessageProvider(providerId);
    const result = await provider.deliver({ conversationId: input.conversationId, body });

    const now = new Date().toISOString();
    const message = this.store.chatMessages.create({
      conversationId: input.conversationId,
      from: "me",
      body,
      sentAt: now,
      provider: providerId,
      status: result.status,
      ...(result.reason ? { statusReason: result.reason } : {}),
    });

    // The thread preview reflects what was actually recorded. A message that
    // could not be delivered still appears in the thread — with its real
    // status — rather than vanishing or pretending to have been sent.
    this.store.chatConversations.update(input.conversationId, {
      lastMessageAt: now,
      lastMessagePreview: body.slice(0, 120),
    });

    return message;
  }

  async markRead(conversationId: string): Promise<ChatConversation> {
    await this.getConversation(conversationId);
    const updated = this.store.chatConversations.update(conversationId, { unread: 0 });
    if (!updated) throw notFound("CONVERSATION_NOT_FOUND", `گفتگو با شناسهٔ ${conversationId} یافت نشد.`);
    return updated;
  }
}
