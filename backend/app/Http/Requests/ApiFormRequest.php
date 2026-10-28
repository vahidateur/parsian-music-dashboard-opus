<?php

namespace App\Http\Requests;

use App\Support\Api\ApiException;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Base request: validation failures become 422 `{error:{code,message,fields}}`
 * with the domain's own code (e.g. USER_INVALID) instead of Laravel's default.
 *
 * Authorization is NOT decided here; it lives in the domain policies so there
 * is one boundary. A request may call its domain policy from
 * `authorizeBeforeValidation()` so a caller without permission gets 403 before
 * any 422 (validation must not be an oracle for unauthorized callers). The
 * application service still authorizes again — it is the authoritative check.
 */
abstract class ApiFormRequest extends FormRequest
{
    protected string $errorCode = 'VALIDATION_FAILED';

    protected string $errorMessage = 'اطلاعات ارسالی معتبر نیست.';

    public function authorize(): bool
    {
        $this->authorizeBeforeValidation();

        return true;
    }

    /** Throws (ApiException) when the domain policy denies the caller. */
    protected function authorizeBeforeValidation(): void {}

    protected function failedValidation(Validator $validator): void
    {
        throw ApiException::validation($this->errorCode, $this->errorMessage, $validator->errors()->toArray());
    }
}
