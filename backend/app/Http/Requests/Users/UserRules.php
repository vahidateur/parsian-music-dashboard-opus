<?php

namespace App\Http\Requests\Users;

use App\Http\Requests\TenantRules;
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
            'teacherId' => ['nullable', 'string', 'max:64', TenantRules::teacherExists()],
        ];
    }
}
