<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Roles\RoleService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Roles\UpdateRoleRequest;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RoleController extends Controller
{
    public function __construct(private readonly RoleService $roles) {}

    public function index(Request $request): JsonResponse
    {
        $records = $this->roles->list($request->user());

        return ApiResponse::list($records, 1, max(count($records), 1), count($records));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item($this->roles->get($request->user(), $id));
    }

    public function update(UpdateRoleRequest $request, string $id): JsonResponse
    {
        return ApiResponse::item($this->roles->update($request->user(), $id, $request->validated()));
    }

    public function reset(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item($this->roles->reset($request->user(), $id));
    }
}
