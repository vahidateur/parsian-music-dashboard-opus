<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Users\UserService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Users\SetPasswordRequest;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class UserController extends Controller
{
    public function __construct(private readonly UserService $users) {}

    public function index(Request $request): JsonResponse
    {
        $page = $this->users->list($request->user(), Pagination::fromRequest($request));

        return ApiResponse::page($page, UserResource::toWire(...));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(UserResource::toWire($this->users->get($request->user(), $id)));
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->users->create($request->user(), $request->validated());

        return ApiResponse::item(UserResource::toWire($user), 201);
    }

    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        $user = $this->users->update($request->user(), $id, $request->validated());

        return ApiResponse::item(UserResource::toWire($user));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->users->delete($request->user(), $id);

        return ApiResponse::noContent();
    }

    public function showPassword(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(['has_password' => $this->users->hasPassword($request->user(), $id)]);
    }

    public function setPassword(SetPasswordRequest $request, string $id): Response
    {
        $this->users->setPassword($request->user(), $id, $request->validated()['password'] ?? null);

        return ApiResponse::noContent();
    }
}
