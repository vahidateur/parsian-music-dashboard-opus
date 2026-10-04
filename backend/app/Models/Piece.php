<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A musical work in the academy's repertoire (TS `Piece`).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $title
 * @property string $composer
 * @property string $instrument_id
 * @property string|null $program_id
 * @property string|null $recommended_level_id
 * @property string $description
 * @property string $range_unit
 * @property int|null $total_range
 * @property list<string>|null $content_ids
 * @property bool $active
 */
class Piece extends Model
{
    /** @use HasFactory<\Database\Factories\PieceFactory> */
    use BelongsToOrganization, HasFactory;

    /**
     * How a piece is subdivided for progress tracking (TS `ProgressRangeUnit`).
     *
     * `freeform` is the honest escape hatch: it stores a label and disables
     * range arithmetic rather than pretending a number exists.
     */
    public const RANGE_UNITS = ['measure', 'section', 'page', 'timestamp', 'freeform'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'title',
        'composer',
        'instrument_id',
        'program_id',
        'recommended_level_id',
        'description',
        'range_unit',
        'total_range',
        'content_ids',
        'active',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'total_range' => 'integer',
            'content_ids' => 'array',
            'active' => 'boolean',
        ];
    }
}
