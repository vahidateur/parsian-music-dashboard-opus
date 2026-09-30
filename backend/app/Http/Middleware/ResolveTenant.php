<?php

namespace App\Http\Middleware;

use App\Domain\Auth\AuthService;
use App\Models\Organization;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Runs after `auth:sanctum`: binds the request to the principal's organization
 * and fails closed for disabled users and missing/suspended organizations.
 */
final class ResolveTenant
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->tenant->clear();

        $user = $request->user();
        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        if ($user->status === 'disabled') {
            throw AuthService::userDisabled();
        }

        $organization = $user->organization_id
            ? Organization::query()->find($user->organization_id)
            : null;
        if ($organization === null) {
            throw TenantContext::unresolved();
        }
        if ($organization->status !== 'active') {
            throw AuthService::organizationSuspended();
        }

        $this->tenant->set($organization->id);

        return $next($request);
    }
}
