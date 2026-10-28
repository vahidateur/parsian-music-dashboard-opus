<?php

namespace App\Http\Requests\Chat;

use App\Domain\Chat\ChatPolicy;
use App\Domain\Chat\ChatService;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\TenantRules;

final class StoreMessageRequest extends ApiFormRequest
{
    protected string $errorCode = 'MESSAGE_INVALID';

    protected string $errorMessage = 'متن پیام معتبر نیست.';

    /** Policy first: an unauthorized caller gets 403 before any 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(ChatPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:'.ChatService::MAX_BODY_LENGTH],
            'provider' => ['sometimes', 'string', 'in:'.implode(',', ChatService::PROVIDERS)],
            'mediaId' => ['nullable', 'string', 'max:64', TenantRules::mediaAssetExists()],
        ];
    }
}
