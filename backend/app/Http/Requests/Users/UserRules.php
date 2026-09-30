<?php

namespace App\Http\Requests\Users;

use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

/** Field rules shared by StoreUserRequest and UpdateUserRequest. */
final class UserRules
{
    /** Same pattern as PHONE_RE in src/domains/auth/userRepository.ts. */
    public const PHONE_REGEX = '/^[0-9۰-۹+\-\s()]{6,20}$/u';

    /**
     * @return array<string, list<mixed>>
     */
    public static function fields(): array
    {
        return [
            'name' => ['string', 'min:2', 'max:120'],
            'email' => ['string', 'email', 'max:255'],
            'role' => ['string', Rule::in(config('permissions.roles'))],
            'phone' => ['nullable', 'string', 'regex:'.self::PHONE_REGEX],
            'status' => ['string', Rule::in(['active', 'disabled'])],
            'teacherId' => ['nullable', 'string', 'max:64', self::teacherExists()],
        ];
    }

    /**
     * The linked teacher must exist in the caller's organization. The teachers
     * table arrives with the teachers slice; until then the link is stored as
     * given (it carries no authorization meaning).
     */
    private static function teacherExists(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value === null || $value === '' || ! Schema::hasTable('teachers')) {
                return;
            }
            $exists = DB::table('teachers')
                ->where('organization_id', app(TenantContext::class)->organizationId())
                ->where('id', $value)
                ->exists();
            if (! $exists) {
                $fail('مدرس انتخاب‌شده وجود ندارد.');
            }
        };
    }
}
