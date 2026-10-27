<?php

namespace App\Http\Resources;

use App\Domain\Chat\ChatService;
use App\Models\ChatMessage;
use App\Models\User;

/** Wire shape = TS `ChatMessage` (camelCase). `from` is derived per viewer. */
final class ChatMessageResource
{
    /** @return array<string, mixed> */
    public static function toWire(ChatMessage $message, User $viewer): array
    {
        $service = app(ChatService::class);

        return ChatService::messageToWire($message, $service->viewerFrom($viewer, $message));
    }
}
