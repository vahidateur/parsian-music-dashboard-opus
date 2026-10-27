<?php

namespace App\Http\Requests\Chat;

use App\Domain\Chat\ChatPolicy;
use App\Http\Requests\ApiFormRequest;

final class StoreConversationRequest extends ApiFormRequest
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
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'role' => ['required', 'string', 'in:student,teacher,guardian,group,staff'],
            'topic' => ['present', 'string', 'max:500'],
            'subjectId' => ['nullable', 'string', 'max:64'],
            'participantIds' => ['sometimes', 'array', 'max:50'],
            'participantIds.*' => ['string', 'max:64'],
        ];
    }
}
