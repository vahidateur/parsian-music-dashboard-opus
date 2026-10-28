<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * The tenant. Its id is never accepted from, nor emitted on, the API wire.
 *
 * The settings columns added by
 * `2026_10_02_140000_add_settings_to_organizations_table` make this row the
 * single authoritative server source of `OrganizationSettings`
 * (src/domains/organization/types.ts): an academy has one set of rules and one
 * organization row, so the rules live on the tenant rather than beside it.
 *
 * @property string $id
 * @property string $slug
 * @property string $name
 * @property string $status
 * @property string $tagline
 * @property string $locale
 * @property string $direction
 * @property string $calendar
 * @property string $currency
 * @property int $first_weekday
 * @property int $default_session_minutes
 * @property int $session_gap_minutes
 * @property int $cancellation_grace_hours
 * @property int $max_makeups_per_term
 * @property string $working_day_start
 * @property string $working_day_end
 * @property list<int>|null $closed_weekdays
 */
class Organization extends Model
{
    /** @use HasFactory<\Database\Factories\OrganizationFactory> */
    use HasFactory;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'slug',
        'name',
        'status',
        'tagline',
        'locale',
        'direction',
        'calendar',
        'currency',
        'first_weekday',
        'default_session_minutes',
        'session_gap_minutes',
        'cancellation_grace_hours',
        'max_makeups_per_term',
        'working_day_start',
        'working_day_end',
        'closed_weekdays',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'first_weekday' => 'integer',
            'default_session_minutes' => 'integer',
            'session_gap_minutes' => 'integer',
            'cancellation_grace_hours' => 'integer',
            'max_makeups_per_term' => 'integer',
            // Friday (6) is the shipped default; a NULL column means "never
            // configured", which OrganizationRules reads as the default rather
            // than as "no closed day".
            'closed_weekdays' => 'array',
        ];
    }
}
