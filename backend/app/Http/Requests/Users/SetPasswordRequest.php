<?php

namespace App\Http\Requests\Users;

use App\Domain\Users\UserPolicy;
use App\Http\Requests\ApiFormRequest;
use Closure;

/**
 * `{ password }` exactly as ApiUserRepository::setPassword sends it.
 * "" (or null) clears the password; otherwise the trimmed length must be ≥ 6.
 * No current-password field (contract preserved; see PrivilegedIdentityPolicy).
 */
final class SetPasswordRequest extends ApiFormRequest
{
    protected string $errorCode = 'USER_PASSWORD_WEAK';

    protected string $errorMessage = 'گذرواژه باید حداقل ۶ نویسه باشد.';

    protected function authorizeBeforeValidation(): void
    {
        app(UserPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'password' => [
                'present',
                'nullable',
                'string',
                'max:255',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (is_string($value) && $value !== '' && mb_strlen(trim($value)) < 6) {
                        $fail('گذرواژه باید حداقل ۶ نویسه باشد.');
                    }
                },
            ],
        ];
    }
}
