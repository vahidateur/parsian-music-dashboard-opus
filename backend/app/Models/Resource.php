<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A library resource: catalogue metadata only.
 *
 * The bytes behind a row live in the media domain; `media_id` is an opaque
 * reference to them and `size` / `duration` are derived display labels, so
 * neither is a column here.
 *
 * @property string $id
 * @property string $organization_id
 * @property string|null $teacher_id
 * @property string $title
 * @property string $composer
 * @property string $kind
 * @property string $instrument
 * @property string $level
 * @property string|null $media_id
 * @property int|null $pages
 * @property int|null $duration_seconds
 * @property list<int>|null $peaks
 * @property int $uses
 * @property string $visibility
 * @property list<string>|null $restricted_student_ids
 * @property bool $active
 */
class Resource extends Model
{
    /** @use HasFactory<\Database\Factories\ResourceFactory> */
    use BelongsToOrganization, HasFactory;

    public const KINDS = ['sheet', 'audio', 'video', 'doc'];

    public const VISIBILITIES = ['students', 'teachers'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'teacher_id',
        'title',
        'composer',
        'kind',
        'instrument',
        'level',
        'media_id',
        'pages',
        'duration_seconds',
        'peaks',
        'uses',
        'visibility',
        'restricted_student_ids',
        'active',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'pages' => 'integer',
            'duration_seconds' => 'integer',
            'peaks' => 'array',
            'uses' => 'integer',
            'restricted_student_ids' => 'array',
            'active' => 'boolean',
        ];
    }

    /** Provenance only — `teacher_id` never authorizes anything. */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }
}
