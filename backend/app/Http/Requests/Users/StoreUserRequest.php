<?php

namespace App\Http\Requests\Users;

use App\Domain\Users\UserPolicy;
use App\Http\Requests\ApiFormRequest;

final class StoreUserRequest extends ApiFormRequest
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
            'name' => ['required', ...$fields['name']],
            'email' => ['required', ...$fields['email']],
            'role' => ['required', ...$fields['role']],
            'phone' => $fields['phone'],
            'status' => ['nullable', ...$fields['status']],
            'teacherId' => $fields['teacherId'],
        ];
    }
}
