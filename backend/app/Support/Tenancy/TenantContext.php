<?php

namespace App\Support\Tenancy;

use App\Support\Api\ApiException;

/**
 * The organization of the current request, resolved ONLY from the
 * authenticated principal (see App\Http\Middleware\ResolveTenant).
 *
 * Never populate this from a request body, header or query string.
 * Registered as a scoped singleton in AppServiceProvider.
 */
final class TenantContext
{
    private ?string $organizationId = null;

    public function set(string $organizationId): void
    {
        $this->organizationId = $organizationId;
    }

    public function clear(): void
    {
        $this->organizationId = null;
    }

    public function current(): ?string
    {
        return $this->organizationId;
    }

    /** Fail-closed accessor: no resolved organization means no data. */
    public function organizationId(): string
    {
        if ($this->organizationId === null) {
            throw self::unresolved();
        }

        return $this->organizationId;
    }

    public static function unresolved(): ApiException
    {
        return new ApiException(403, 'ORGANIZATION_UNRESOLVED', 'سازمان کاربر مشخص نیست.');
    }
}
