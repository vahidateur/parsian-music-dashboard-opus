<?php

namespace App\Domain\Organization;

use App\Models\Organization;
use App\Support\Api\ApiException;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/**
 * Organization settings persistence and defaults.
 *
 * TENANT ISOLATION — the row is found by `whereKey(TenantContext::organizationId())`,
 * never by a request-supplied id and never by an unscoped `first()`. The
 * `BelongsToOrganization` trait cannot apply here because `organizations` has no
 * `organization_id` column: this model IS the tenant. Scoping by primary key is
 * therefore strictly stronger than the global scope — another organization's
 * settings are not merely filtered out, they are never queried.
 *
 * This service carries no actor and makes no authorization decision; that lives
 * in `OrganizationPolicy`, which the controller calls first.
 */
final class OrganizationService
{
    /** camelCase wire key → snake_case column. */
    private const COLUMN_MAP = [
        'name' => 'name',
        'tagline' => 'tagline',
        'locale' => 'locale',
        'direction' => 'direction',
        'calendar' => 'calendar',
        'currency' => 'currency',
        'firstWeekday' => 'first_weekday',
        'defaultSessionMinutes' => 'default_session_minutes',
        'sessionGapMinutes' => 'session_gap_minutes',
        'cancellationGraceHours' => 'cancellation_grace_hours',
        'maxMakeupsPerTerm' => 'max_makeups_per_term',
        'workingDayStart' => 'working_day_start',
        'workingDayEnd' => 'working_day_end',
        'closedWeekdays' => 'closed_weekdays',
    ];

    public function __construct(private readonly TenantContext $tenant) {}

    /** The caller's own organization. Fail-closed: an unresolved tenant throws. */
    public function get(): Organization
    {
        $settings = Organization::query()
            ->whereKey($this->tenant->organizationId())
            ->first();

        if ($settings === null) {
            throw ApiException::notFound('ORGANIZATION_NOT_FOUND', 'سازمان یافت نشد.');
        }

        return $settings;
    }

    /**
     * Applies a validated partial patch.
     *
     * Only the keys present in `$input` are written — a patch is not a rebuild,
     * and untouched fields keep their stored values.
     *
     * @param  array<string, mixed>  $input  validated camelCase wire input
     */
    public function update(array $input): Organization
    {
        $settings = $this->get();

        $attributes = [];
        foreach (self::COLUMN_MAP as $wireKey => $column) {
            if (array_key_exists($wireKey, $input)) {
                $attributes[$column] = $input[$wireKey];
            }
        }

        if ($attributes === []) {
            return $settings;
        }

        return DB::transaction(function () use ($settings, $attributes): Organization {
            // Re-read inside the transaction so two operators cannot each write
            // a half of a rule and leave the pair inconsistent.
            $fresh = Organization::query()->whereKey($settings->id)->lockForUpdate()->first() ?? $settings;
            $fresh->fill($attributes)->save();

            return $fresh->refresh();
        });
    }
}
