<?php

namespace App\Http\Requests\Chat;

use App\Domain\Chat\ChatPolicy;
use App\Http\Requests\ApiFormRequest;

final class UpdateConversationRequest extends ApiFormRequest
{
    protected string $errorCode = 'CONVERSATION_INVALID';

    protected string $errorMessage = 'اطلاعات گفتگو معتبر نیست.';

    /** Policy first: an unauthorized caller gets 403 before any 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(ChatPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'min:2', 'max:120'],
            'topic' => ['sometimes', 'string', 'max:500'],
            'pinned' => ['sometimes', 'boolean'],
            'archived' => ['sometimes', 'boolean'],
        ];
    }
}
