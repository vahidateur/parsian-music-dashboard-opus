import { useCallback } from "react";
import { getChatRepository } from "@/domains/registry";
import { useResourceList, type ListState } from "@/domains/shared/useResource";
import type { ChatConversation, ChatMessage, ConversationListParams, MessageListParams } from "./types";

export function useConversations(params: ConversationListParams = {}): ListState<ChatConversation> {
  const loader = useCallback(
    (p: ConversationListParams, signal?: AbortSignal) => getChatRepository().listConversations(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

/**
 * Messages of one thread.
 *
 * Passing an empty `conversationId` yields an empty page rather than throwing,
 * so the view can render before a thread is selected.
 */
export function useMessages(conversationId: string | undefined, perPage = 200): ListState<ChatMessage> {
  const loader = useCallback((p: MessageListParams, signal?: AbortSignal) => {
    if (!p.conversationId) {
      return Promise.resolve({ data: [], meta: { page: 1, per_page: p.per_page ?? 0, total: 0 } });
    }
    return getChatRepository().listMessages(p, signal);
  }, []);
  return useResourceList(loader, { conversationId: conversationId ?? "", per_page: perPage });
}
