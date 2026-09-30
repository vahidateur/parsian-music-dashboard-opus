<?php

namespace App\Domain\Auth;

use App\Http\Resources\AuthUserResource;
use App\Models\Organization;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Authorization\PermissionMatrix;
use App\Support\Iso;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Login / logout / me. Issues Sanctum personal access tokens (Bearer) — the
 * only transport src/api/client.ts speaks.
 */
final class AuthService
{
    private static ?string $dummyHash = null;

    public function __construct(private readonly PermissionMatrix $matrix) {}

    /**
     * @return array{user: array<string, mixed>, permissions: list<string>, token: string, expires_at: string}
     */
    public function login(string $email, string $password): array
    {
        $user = User::query()->where('email', mb_strtolower(trim($email)))->first();

        // Always run one hash check so unknown emails cost the same as wrong passwords.
        $hash = $user?->password ?? self::dummyHash();
        $valid = Hash::check($password, $hash);

        if ($user === null || $user->password === null || ! $valid) {
            throw new ApiException(401, 'AUTH_INVALID_CREDENTIALS', 'ایمیل یا گذرواژه نادرست است.');
        }
        if ($user->status === 'disabled') {
            throw self::userDisabled();
        }

        $organization = Organization::query()->find($user->organization_id);
        if ($organization === null) {
            throw TenantContext::unresolved();
        }
        if ($organization->status !== 'active') {
            throw self::organizationSuspended();
        }

        $expiresAt = now()->addMinutes(self::expirationMinutes());
        $token = $user->createToken('api', ['*'], $expiresAt);

        return $this->session($user, $token->plainTextToken, $expiresAt);
    }

    public function logout(User $user): void
    {
        $token = $user->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }
    }

    /**
     * The current session. `token` is always "" — /auth/me never re-issues.
     *
     * @return array{user: array<string, mixed>, permissions: list<string>, token: string, expires_at: string}
     */
    public function me(User $user): array
    {
        $token = $user->currentAccessToken();
        $expiresAt = null;
        if ($token instanceof PersonalAccessToken) {
            $expiresAt = $token->expires_at
                ?? $token->created_at?->copy()->addMinutes(self::expirationMinutes());
        }

        return $this->session($user, '', $expiresAt ?? now()->addMinutes(self::expirationMinutes()));
    }

    /**
     * @return array{user: array<string, mixed>, permissions: list<string>, token: string, expires_at: string}
     */
    private function session(User $user, string $token, Carbon $expiresAt): array
    {
        return [
            'user' => AuthUserResource::toWire($user),
            'permissions' => $this->matrix->permissionsFor($user),
            'token' => $token,
            'expires_at' => (string) Iso::format($expiresAt),
        ];
    }

    public static function expirationMinutes(): int
    {
        return (int) (config('sanctum.expiration') ?? 720);
    }

    public static function userDisabled(): ApiException
    {
        return new ApiException(403, 'AUTH_USER_DISABLED', 'این حساب کاربری غیرفعال است.');
    }

    public static function organizationSuspended(): ApiException
    {
        return new ApiException(403, 'ORGANIZATION_SUSPENDED', 'دسترسی این سازمان معلق شده است.');
    }

    private static function dummyHash(): string
    {
        return self::$dummyHash ??= Hash::make('timing-flattening-dummy');
    }
}
