<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\ApiFormRequest;

final class LoginRequest extends ApiFormRequest
{
    protected string $errorCode = 'AUTH_MISSING_FIELDS';

    protected string $errorMessage = 'ایمیل و گذرواژه را وارد کنید.';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ];
    }
}
