<?php

namespace App\Domain\Users;

use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Pagination;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Managed users of the caller's organization.
 *
 * Order on every write: permission (UserPolicy) → locate target in the tenant
 * (404 otherwise, also for other organizations' ids) → PB-2
 * (PrivilegedIdentityPolicy) → domain conflicts → persist.
 */
final class UserService
{
    public function __construct(
        private readonly UserPolicy $policy,
        private readonly PrivilegedIdentityPolicy $privileged,
        private readonly TenantContext $tenant,
    ) {}

    /** @return LengthAwarePaginator<int, User> */
    public function list(User $actor, Pagination $pagination): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);

        return $this->query()
            ->orderBy('created_at')
            ->orderBy('id')
            ->paginate($pagination->perPage, ['*'], 'page', $pagination->page);
    }

    public function get(User $actor, string $id): User
    {
        $this->policy->authorizeRead($actor);

        return $this->find($id);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function create(User $actor, array $input): User
    {
        $this->policy->authorizeWrite($actor);
        $this->privileged->assertAllowed($actor, null, $input, 'create');

        $email = self::normalizeEmail((string) $input['email']);
        $this->assertEmailFree($email, null);

        $user = new User;
        $user->id = 'usr_'.strtolower((string) Str::ulid());
        $user->organization_id = $this->tenant->organizationId();
        $user->name = trim((string) $input['name']);
        $user->email = $email;
        $user->phone = self::nullableString($input['phone'] ?? null);
        $user->role = (string) $input['role'];
        $user->status = (string) ($input['status'] ?? 'active');
        $user->teacher_id = self::nullableString($input['teacherId'] ?? null);
        $user->password = null;

        return $this->save($user);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function update(User $actor, string $id, array $input): User
    {
        $this->policy->authorizeWrite($actor);
        $user = $this->find($id);
        $this->privileged->assertAllowed($actor, $user, $input, 'update');

        if (array_key_exists('name', $input)) {
            $user->name = trim((string) $input['name']);
        }
        if (array_key_exists('email', $input)) {
            $email = self::normalizeEmail((string) $input['email']);
            $this->assertEmailFree($email, $user->id);
            $user->email = $email;
        }
        if (array_key_exists('phone', $input)) {
            $user->phone = self::nullableString($input['phone']);
        }
        if (array_key_exists('role', $input)) {
            $user->role = (string) $input['role'];
        }
        if (array_key_exists('status', $input)) {
            $user->status = (string) $input['status'];
        }
        if (array_key_exists('teacherId', $input)) {
            $user->teacher_id = self::nullableString($input['teacherId']);
        }

        return $this->save($user);
    }

    public function delete(User $actor, string $id): void
    {
        $this->policy->authorizeWrite($actor);
        $user = $this->find($id);
        $this->privileged->assertAllowed($actor, $user, [], 'delete');

        DB::transaction(function () use ($user): void {
            $user->tokens()->delete();
            $user->delete();
        });
    }

    /**
     * Sets or clears (null / "") the target's password and revokes the
     * target's tokens. No current-password field: the target is never the
     * actor (PB-2 case a blocks that path).
     */
    public function setPassword(User $actor, string $id, ?string $password): void
    {
        $this->policy->authorizeWrite($actor);
        $user = $this->find($id);
        $this->privileged->assertAllowed($actor, $user, [], 'password');

        DB::transaction(function () use ($user, $password): void {
            $user->password = ($password === null || $password === '') ? null : $password;
            $user->save();
            $user->tokens()->delete();
        });
    }

    public function hasPassword(User $actor, string $id): bool
    {
        $this->policy->authorizeRead($actor);

        return $this->find($id)->password !== null;
    }

    /** @return Builder<User> */
    private function query(): Builder
    {
        return User::query()->where('organization_id', $this->tenant->organizationId());
    }

    private function find(string $id): User
    {
        $user = $this->query()->where('id', $id)->first();
        if ($user === null) {
            throw ApiException::notFound('USER_NOT_FOUND', "کاربر با شناسهٔ {$id} یافت نشد.");
        }

        return $user;
    }

    private function assertEmailFree(string $email, ?string $exceptId): void
    {
        // Global uniqueness (O-14): checked across all organizations.
        $taken = User::query()
            ->where('email', $email)
            ->when($exceptId !== null, fn (Builder $q) => $q->where('id', '!=', $exceptId))
            ->exists();
        if ($taken) {
            throw self::emailTaken();
        }
    }

    private function save(User $user): User
    {
        try {
            $user->save();
        } catch (UniqueConstraintViolationException) {
            throw self::emailTaken();
        }

        return $user->refresh();
    }

    private static function emailTaken(): ApiException
    {
        $message = 'این ایمیل قبلاً ثبت شده است.';

        return ApiException::conflict('USER_EMAIL_TAKEN', $message, ['email' => [$message]]);
    }

    private static function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    private static function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
