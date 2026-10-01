<?php

namespace App\Http\Requests\Rooms;

use App\Domain\Rooms\RoomPolicy;
use App\Http\Requests\ApiFormRequest;

final class StoreRoomRequest extends ApiFormRequest
{
    protected string $errorCode = 'ROOM_INVALID';

    protected string $errorMessage = 'اطلاعات اتاق معتبر نیست.';

    /** PB-3: blocked for every actor; never reaches validation. */
    protected function authorizeBeforeValidation(): void
    {
        app(RoomPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:1', 'max:60'],
            'kind' => ['required', 'string', 'max:60'],
            'capacity' => ['required', 'integer', 'min:1', 'max:500'],
            'occupancy' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
