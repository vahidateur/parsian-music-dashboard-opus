<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One message thread of an organization.
 *
 * Composite primary key `(organization_id, id)`, like the other domains.
 * Visibility is participation: only rows in `chat_participants` may read.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $name
 * @property string $role
 * @property string $topic
 * @property string|null $subject_id
 * @property bool $pinned
 * @property bool $archived
 * @property string|null $last_message_at
 * @property string $last_message_preview
 */
class ChatConversation extends Model
{
    /** @use HasFactory<\Database\Factories\ChatConversationFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'chat_conversations';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'name', 'role', 'topic', 'subject_id', 'pinned', 'archived',
        'last_message_at', 'last_message_preview',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'pinned' => 'boolean',
            'archived' => 'boolean',
            'last_message_at' => 'datetime',
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
