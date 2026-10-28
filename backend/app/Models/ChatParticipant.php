<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One participant's membership in a thread — and their read cursor.
 *
 * `last_read_at` is the per-user read cursor the demo's single `unread`
 * counter could never be: unread is derived (messages after the cursor, from
 * anyone else), and `markRead` only moves the caller's own cursor.
 *
 * Composite primary key `(organization_id, conversation_id, user_id)`: one
 * row per user per thread, enforced by the key itself.
 *
 * @property string $organization_id
 * @property string $conversation_id
 * @property string $user_id
 * @property string|null $last_read_at
 */
class ChatParticipant extends Model
{
    /** @use HasFactory<\Database\Factories\ChatParticipantFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'chat_participants';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'conversation_id', 'user_id', 'last_read_at',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'last_read_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSaveQuery($query)
    {
        return $query
            ->where('organization_id', $this->getOriginal('organization_id') ?? $this->getAttribute('organization_id'))
            ->where('conversation_id', $this->getOriginal('conversation_id') ?? $this->getAttribute('conversation_id'))
            ->where('user_id', $this->getOriginal('user_id') ?? $this->getAttribute('user_id'));
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSelectQuery($query)
    {
        return $this->setKeysForSaveQuery($query);
    }
}
