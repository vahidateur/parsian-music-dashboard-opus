<?php

namespace App\Http\Resources;

use App\Domain\Chat\ChatService;
use App\Models\ChatConversation;

/** Wire shape = TS `ChatConversation` (camelCase). `unread` is per viewer. */
final class ChatConversationResource
{
    /** @return array<string, mixed> */
    public static function toWire(ChatConversation $conversation, int $unread): array
    {
        return ChatService::conversationToWire($conversation, $unread);
    }
}
