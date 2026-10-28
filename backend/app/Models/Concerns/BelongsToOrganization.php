<?php

namespace App\Models\Concerns;

use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * The tenant seam for org-owned models.
 *
 * - Every query is constrained to the current TenantContext organization.
 *   With no resolved organization the scope matches NOTHING (fail closed).
 * - New rows take `organization_id` from the context when not set explicitly
 *   (the demo seeder sets it explicitly; request input never does).
 *
 * @mixin Model
 */
trait BelongsToOrganization
{
    public static function bootBelongsToOrganization(): void
    {
        static::addGlobalScope('organization', function (Builder $query): void {
            $organizationId = app(TenantContext::class)->current();
            if ($organizationId === null) {
                $query->whereRaw('1 = 0');

                return;
            }
            $query->where($query->getModel()->qualifyColumn('organization_id'), $organizationId);
        });

        static::creating(function (Model $model): void {
            if (empty($model->getAttribute('organization_id'))) {
                $model->setAttribute('organization_id', app(TenantContext::class)->organizationId());
            }
        });
    }
}
