<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Chat\ChatPolicy;
use App\Domain\Chat\ChatService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\StoreConversationRequest;
use App\Http\Requests\Chat\StoreMessageRequest;
use App\Http\Requests\Chat\UpdateConversationRequest;
use App\Http\Resources\ChatConversationResource;
use App\Http\Resources\ChatMessageResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Every action asks ChatPolicy FIRST (reads need `messages.read`, writes
 * need `messages.write`). Participation is checked inside the service, which
 * answers 404 to a non-participant — knowing an id never grants a read.
 * FormRequests are resolved only after the policy check, so an invalid body
 * never turns a 403 into a 422.
 */
final class ChatController extends Controller
{
    public function __construct(
        private readonly ChatPolicy $policy,
        private readonly ChatService $chat,
    ) {}

    /* ------------------------------------------------------------ threads */

    public function indexConversations(Request $request): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeRead($actor);
        // The wire is snake_case (as ApiChatRepository.toConversationQuery
        // sends it); the service reads the domain's camelCase param. Both
        // spellings are accepted so a caller using either is filtered, never
        // silently unfiltered.
        $raw = $request->only(['search', 'role', 'includeArchived', 'include_archived']);
        $filters = [
            'search' => $raw['search'] ?? null,
            'role' => $raw['role'] ?? null,
            'includeArchived' => $raw['includeArchived'] ?? $raw['include_archived'] ?? null,
        ];
        $pagination = Pagination::fromRequest($request);

        $page = $this->chat->listConversations($actor, $filters, $pagination->page, $pagination->perPage);
        $unread = $this->chat->unreadCounts($actor, array_map(fn ($row): string => $row->id, $page->items()));

        return ApiResponse::page(
            $page,
            fn ($conversation): array => ChatConversationResource::toWire($conversation, $unread[$conversation->id] ?? 0),
        );
    }

    public function showConversation(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeRead($actor);
        $conversation = $this->chat->getConversation($actor, $id);
        $unread = $this->chat->unreadCounts($actor, [$conversation->id])[$conversation->id] ?? 0;

        return ApiResponse::item(ChatConversationResource::toWire($conversation, $unread));
    }

    public function storeConversation(Request $request): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeWrite($actor);
        $input = app(StoreConversationRequest::class)->validated();

        $conversation = $this->chat->createConversation($actor, $input);

        return ApiResponse::item(ChatConversationResource::toWire($conversation, 0), 201);
    }

    public function updateConversation(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeWrite($actor);
        $conversation = $this->chat->getConversation($actor, $id);
        $input = app(UpdateConversationRequest::class)->validated();

        $updated = $this->chat->updateConversation($actor, $conversation->id, $input);
        $unread = $this->chat->unreadCounts($actor, [$updated->id])[$updated->id] ?? 0;

        return ApiResponse::item(ChatConversationResource::toWire($updated, $unread));
    }

    public function archiveConversation(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeWrite($actor);

        $archived = $this->chat->archiveConversation($actor, $id);
        $unread = $this->chat->unreadCounts($actor, [$archived->id])[$archived->id] ?? 0;

        return ApiResponse::item(ChatConversationResource::toWire($archived, $unread));
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeWrite($actor);

        $conversation = $this->chat->markRead($actor, $id);

        return ApiResponse::item(ChatConversationResource::toWire($conversation, 0));
    }

    /* ------------------------------------------------------------ messages */

    public function indexMessages(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeRead($actor);
        $pagination = Pagination::fromRequest($request);

        $page = $this->chat->listMessages($actor, $id, $pagination->page, $pagination->perPage);

        return ApiResponse::page(
            $page,
            fn ($message): array => ChatMessageResource::toWire($message, $actor),
        );
    }

    public function storeMessage(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeWrite($actor);
        $input = app(StoreMessageRequest::class)->validated();

        $message = $this->chat->sendMessage($actor, $id, $input);

        return ApiResponse::item(ChatMessageResource::toWire($message, $actor), 201);
    }
}
