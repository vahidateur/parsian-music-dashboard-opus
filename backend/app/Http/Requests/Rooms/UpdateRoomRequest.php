<?php

namespace App\Http\Requests\Rooms;

use App\Domain\Rooms\RoomPolicy;
use App\Http\Requests\ApiFormRequest;

final class UpdateRoomRequest extends ApiFormRequest
{
    protected string $errorCode = 'ROOM_INVALID';

    protected string $errorMessage = 'اطلاعات اتاق معتبر نیست.';

    /** Policy first: an unauthorized caller gets 403 before any 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(RoomPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'min:1', 'max:60'],
            'kind' => ['sometimes', 'string', 'max:60'],
            'capacity' => ['sometimes', 'integer', 'min:1', 'max:500'],
            'occupancy' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
