<?php

namespace App\Domain\Chat;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\ChatParticipant;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Chat persistence and domain rules of the caller's organization.
 *
 * PARTICIPATION IS THE BOUNDARY. Every read and every write goes through
 * `conversationFor`, which answers 404 unless the actor participates. There
 * is deliberately no administrator/manager bypass: knowing an id never
 * grants a read, and whether oversight tooling needs a wider read is an
 * owner decision recorded in DECISIONS.md §37 — not something this service
 * invents.
 *
 * THE SENDER IS THE ACTOR. The wire carries no sender (and no `from`): a
 * message records the authenticated user, and `from` is derived per viewer
 * at read time. A client-supplied sender would be an unverified claim, so
 * there is no field for one to arrive in.
 *
 * UNREAD IS A CURSOR, not a counter: unread is the messages after the
 * participant's `last_read_at` (from anyone else), and `markRead` only moves
 * the caller's own cursor.
 *
 * `provider` is accepted and stored, but only `in_app` genuinely delivers —
 * persistence IS delivery for an in-app thread. Any other provider is
 * recorded with `unavailable` and a reason naming it (demo parity): nothing
 * here fakes an external send.
 *
 * This service carries NO permission decision beyond participation: the
 * `messages.read` / `messages.write` checks live in ChatPolicy, which the
 * controller calls before reaching this service.
 */
final class ChatService
{
    public const ROLES = ['student', 'teacher', 'guardian', 'group', 'staff'];

    public const PROVIDERS = ['in_app', 'telegram', 'bale', 'sms', 'email'];

    public const MAX_BODY_LENGTH = 4000;

    public function __construct(private readonly TenantContext $tenant) {}

    /* ------------------------------------------------------------ threads */

    /**
     * The caller's threads: participation first, then the demo's filters.
     * Pinned first, then most recent — like the demo repository.
     *
     * @param  array<string, mixed>  $filters  search, role, includeArchived
     */
    public function listConversations(User $actor, array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $query = $this->participating(ChatConversation::query(), $actor);
        if (filled($filters['search'] ?? null)) {
            $like = '%'.trim((string) $filters['search']).'%';
            $query->where(fn (Builder $q) => $q->where('name', 'like', $like)->orWhere('topic', 'like', $like)->orWhere('last_message_preview', 'like', $like));
        }
        if (filled($filters['role'] ?? null)) {
            $query->where('role', trim((string) $filters['role']));
        }
        if (! filter_var($filters['includeArchived'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('archived', false);
        }

        return $query->orderByDesc('pinned')->orderByDesc('last_message_at')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function getConversation(User $actor, string $id): ChatConversation
    {
        return $this->conversationFor($actor, $id);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function createConversation(User $actor, array $input): ChatConversation
    {
        $participantIds = $this->validatedParticipantIds($input['participantIds'] ?? null);

        $conversation = DB::transaction(function () use ($actor, $input, $participantIds): ChatConversation {
            $conversation = new ChatConversation;
            $conversation->id = 'co_'.strtolower((string) Str::ulid());
            $conversation->organization_id = $this->tenant->organizationId();
            $conversation->name = trim((string) $input['name']);
            $conversation->role = trim((string) $input['role']);
            $conversation->topic = (string) ($input['topic'] ?? '');
            $conversation->subject_id = $this->normalizedSubjectId($input['subjectId'] ?? null);
            $conversation->pinned = false;
            $conversation->archived = false;
            $conversation->last_message_at = Carbon::now();
            $conversation->last_message_preview = '';
            $conversation->save();

            $ids = array_values(array_unique([...$participantIds, $actor->id]));
            foreach ($ids as $userId) {
                $this->addParticipantRow($conversation->id, $userId);
            }

            return $conversation;
        });

        return $conversation->refresh();
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function updateConversation(User $actor, string $id, array $input): ChatConversation
    {
        $conversation = $this->conversationFor($actor, $id);
        if (array_key_exists('name', $input)) {
            $conversation->name = trim((string) $input['name']);
        }
        if (array_key_exists('topic', $input)) {
            $conversation->topic = (string) $input['topic'];
        }
        if (array_key_exists('pinned', $input)) {
            $conversation->pinned = (bool) $input['pinned'];
        }
        if (array_key_exists('archived', $input)) {
            $conversation->archived = (bool) $input['archived'];
        }

        $conversation->save();

        return $conversation->refresh();
    }

    public function archiveConversation(User $actor, string $id): ChatConversation
    {
        // One write path: archive delegates to the same update the restore
        // uses, so no second code path can disagree with it.
        return $this->updateConversation($actor, $id, ['archived' => true]);
    }

    public function markRead(User $actor, string $id): ChatConversation
    {
        $conversation = $this->conversationFor($actor, $id);

        ChatParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $actor->id)
            ->update(['last_read_at' => Carbon::now()]);

        return $conversation->refresh();
    }

    /* ------------------------------------------------------------ messages */

    /**
     * A thread's messages, oldest first — the demo order. `sent_at` alone
     * could tie within a second, so the time-ordered id breaks ties.
     */
    public function listMessages(User $actor, string $conversationId, int $page, int $perPage): LengthAwarePaginator
    {
        $conversation = $this->conversationFor($actor, $conversationId);

        return ChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->orderBy('sent_at')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function sendMessage(User $actor, string $conversationId, array $input): ChatMessage
    {
        $conversation = $this->conversationFor($actor, $conversationId);
        $body = trim((string) ($input['body'] ?? ''));

        $provider = (string) ($input['provider'] ?? 'in_app');
        $mediaId = $this->normalizedMediaId($input['mediaId'] ?? null);

        $now = Carbon::now();
        $delivers = $provider === 'in_app';

        $message = DB::transaction(function () use ($actor, $conversation, $body, $provider, $mediaId, $now, $delivers): ChatMessage {
            $message = new ChatMessage;
            $message->id = 'cm_'.strtolower((string) Str::ulid());
            $message->organization_id = $this->tenant->organizationId();
            $message->conversation_id = $conversation->id;
            $message->sender_user_id = $actor->id;
            $message->body = $body;
            $message->provider = $provider;
            $message->status = $delivers ? 'sent' : 'unavailable';
            $message->status_reason = $delivers ? null : $this->unavailableReason($provider);
            $message->media_id = $mediaId;
            $message->sent_at = $now;
            $message->save();

            $conversation->last_message_at = $now;
            $conversation->last_message_preview = mb_substr($body, 0, 120);
            $conversation->save();

            return $message;
        });

        return $message->refresh();
    }

    /* ------------------------------------------------------------ viewing */

    /**
     * Unread counts for the viewer's threads, in one query: messages after
     * the participant's cursor, from anyone else.
     *
     * @param  list<string>  $conversationIds
     * @return array<string, int>
     */
    public function unreadCounts(User $actor, array $conversationIds): array
    {
        if ($conversationIds === []) {
            return [];
        }
        $cursors = ChatParticipant::query()
            ->whereIn('conversation_id', $conversationIds)
            ->where('user_id', $actor->id)
            ->pluck('last_read_at', 'conversation_id');

        $counts = [];
        foreach ($conversationIds as $conversationId) {
            $cursor = $cursors[$conversationId] ?? null;
            $query = ChatMessage::query()
                ->where('conversation_id', $conversationId)
                ->where('sender_user_id', '!=', $actor->id);
            if ($cursor !== null) {
                $query->where('sent_at', '>', $cursor);
            }
            $counts[$conversationId] = $query->count();
        }

        return $counts;
    }

    public function viewerFrom(User $actor, ChatMessage $message): string
    {
        return $message->sender_user_id === $actor->id ? 'me' : 'them';
    }

    /* ------------------------------------------------------------ wiring */

    /** @return array<string, mixed> */
    public static function conversationToWire(ChatConversation $conversation, int $unread): array
    {
        $wire = [
            'id' => $conversation->id,
            'name' => $conversation->name,
            'role' => $conversation->role,
            'topic' => $conversation->topic,
            'lastMessageAt' => $conversation->last_message_at?->toJSON(),
            'lastMessagePreview' => $conversation->last_message_preview,
            'unread' => $unread,
        ];
        if ($conversation->subject_id !== null && $conversation->subject_id !== '') {
            $wire['subjectId'] = $conversation->subject_id;
        }
        if ($conversation->pinned) {
            $wire['pinned'] = true;
        }
        if ($conversation->archived) {
            $wire['archived'] = true;
        }

        return $wire;
    }

    /** @return array<string, mixed> */
    public static function messageToWire(ChatMessage $message, string $from): array
    {
        $wire = [
            'id' => $message->id,
            'conversationId' => $message->conversation_id,
            'from' => $from,
            'body' => $message->body,
            'sentAt' => $message->sent_at?->toJSON(),
            'provider' => $message->provider,
            'status' => $message->status,
        ];
        if ($message->status_reason !== null && $message->status_reason !== '') {
            $wire['statusReason'] = $message->status_reason;
        }
        if ($message->media_id !== null && $message->media_id !== '') {
            $wire['mediaId'] = $message->media_id;
        }

        return $wire;
    }

    /* ------------------------------------------------------------ private */

    /**
     * The thread, or 404. A non-participant learns nothing — not even that
     * the id exists — which is the whole of the message-access rule.
     */
    private function conversationFor(User $actor, string $id): ChatConversation
    {
        $conversation = ChatConversation::query()->whereKey(trim($id))->first();
        if ($conversation === null || ! $this->isParticipant($actor->id, $conversation->id)) {
            throw ApiException::notFound('CONVERSATION_NOT_FOUND', 'گفتگو یافت نشد.');
        }

        return $conversation;
    }

    private function isParticipant(string $userId, string $conversationId): bool
    {
        return ChatParticipant::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $userId)
            ->exists();
    }

    /** @return Builder<ChatConversation> */
    private function participating(Builder $query, User $actor): Builder
    {
        $ids = ChatParticipant::query()->where('user_id', $actor->id)->pluck('conversation_id');

        return $query->whereIn('id', $ids);
    }

    private function addParticipantRow(string $conversationId, string $userId): void
    {
        $row = new ChatParticipant;
        $row->organization_id = $this->tenant->organizationId();
        $row->conversation_id = $conversationId;
        $row->user_id = $userId;
        $row->last_read_at = null;
        $row->save();
    }

    /**
     * Validates the invited participants: existing users of this
     * organization, deduplicated. The creator is always added by the caller.
     *
     * @return list<string>
     */
    private function validatedParticipantIds(mixed $value): array
    {
        if ($value === null) {
            return [];
        }
        if (! is_array($value)) {
            throw ApiException::validation('CONVERSATION_INVALID', 'اطلاعات گفتگو معتبر نیست.', [
                'participantIds' => ['فهرست اعضا معتبر نیست.'],
            ]);
        }
        $ids = array_values(array_unique(array_filter(array_map(
            fn (mixed $id): string => is_string($id) ? trim($id) : '',
            $value,
        ))));
        foreach ($ids as $userId) {
            // Explicit organization filter: `users` carries no tenant scope,
            // so a global `whereKey` would accept another organization's user.
            $exists = \App\Models\User::query()
                ->where('organization_id', $this->tenant->organizationId())
                ->whereKey($userId)
                ->exists();
            if (! $exists) {
                throw ApiException::validation('CONVERSATION_INVALID', 'اطلاعات گفتگو معتبر نیست.', [
                    'participantIds' => ["کاربر «{$userId}» در این آموزشگاه یافت نشد."],
                ]);
            }
        }

        return $ids;
    }

    private function normalizedSubjectId(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $id = trim((string) $value);

        return $id === '' ? null : $id;
    }

    private function normalizedMediaId(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $id = trim((string) $value);

        return $id === '' ? null : $id;
    }

    private function unavailableReason(string $provider): string
    {
        $label = match ($provider) {
            'telegram' => 'تلگرام',
            'bale' => 'بله',
            'sms' => 'پیامک',
            'email' => 'ایمیل',
            default => $provider,
        };

        return "ارسال از طریق {$label} نیازمند سامانهٔ سرور است و در این نسخه انجام نمی‌شود؛ پیام با همین وضعیت ثبت شد.";
    }
}
