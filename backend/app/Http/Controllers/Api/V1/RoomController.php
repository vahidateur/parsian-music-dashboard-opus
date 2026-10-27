<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Rooms\RoomPolicy;
use App\Domain\Rooms\RoomService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Rooms\StoreRoomRequest;
use App\Http\Requests\Rooms\UpdateRoomRequest;
use App\Http\Resources\RoomResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Every action asks RoomPolicy FIRST (reads need `rooms.read`, writes need
 * `rooms.write`). FormRequests are resolved only after that check, so an
 * invalid body never turns a 403 into a 422.
 */
final class RoomController extends Controller
{
    public function __construct(
        private readonly RoomPolicy $policy,
        private readonly RoomService $rooms,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        $filters = $request->only(['search', 'assignable', 'min_capacity']);

        return ApiResponse::page($this->rooms->list($filters, Pagination::fromRequest($request)), RoomResource::toWire(...));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(RoomResource::toWire($this->rooms->get($id)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(StoreRoomRequest::class)->validated();

        return ApiResponse::item(RoomResource::toWire($this->rooms->create($input)), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(UpdateRoomRequest::class)->validated();

        return ApiResponse::item(RoomResource::toWire($this->rooms->update($id, $input)));
    }

    public function deactivate(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());

        return ApiResponse::item(RoomResource::toWire($this->rooms->deactivate($id)));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->rooms->delete($id);

        return ApiResponse::noContent();
    }
}
