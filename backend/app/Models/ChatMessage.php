<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One message in a thread.
 *
 * The sender is the authenticated user at write time — the wire has no
 * sender field to trust. `from` (`"me"`/`"them"`) is derived per viewer at
 * read time, never stored.
 *
 * Composite primary key `(organization_id, id)`.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $conversation_id
 * @property string $sender_user_id
 * @property string $body
 * @property string $provider
 * @property string $status
 * @property string|null $status_reason
 * @property string|null $media_id
 * @property string $sent_at
 */
class ChatMessage extends Model
{
    /** @use HasFactory<\Database\Factories\ChatMessageFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'chat_messages';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'conversation_id', 'sender_user_id', 'body', 'provider',
        'status', 'status_reason', 'media_id', 'sent_at',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
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
            ->where('id', $this->getOriginal('id') ?? $this->getAttribute('id'));
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
