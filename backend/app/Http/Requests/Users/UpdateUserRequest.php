<?php

namespace App\Http\Requests\Users;

use App\Domain\Users\UserPolicy;
use App\Http\Requests\ApiFormRequest;

final class UpdateUserRequest extends ApiFormRequest
{
    protected string $errorCode = 'USER_INVALID';

    protected string $errorMessage = 'اطلاعات کاربر معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(UserPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $fields = UserRules::fields();

        return [
            'name' => ['sometimes', 'required', ...$fields['name']],
            'email' => ['sometimes', 'required', ...$fields['email']],
            'role' => ['sometimes', 'required', ...$fields['role']],
            'phone' => ['sometimes', ...$fields['phone']],
            'status' => ['sometimes', 'required', ...$fields['status']],
            'teacherId' => ['sometimes', ...$fields['teacherId']],
        ];
    }
}
