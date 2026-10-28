<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Classes\ClassService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Classes\ListClassesRequest;
use App\Http\Requests\Classes\StoreClassRequest;
use App\Http\Requests\Classes\UpdateClassRequest;
use App\Http\Resources\ClassResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class ClassController extends Controller
{
    public function __construct(private readonly ClassService $classes) {}

    public function index(ListClassesRequest $request): JsonResponse
    {
        $page = $this->classes->list($request->user(), $request->validated(), Pagination::fromRequest($request));

        return ApiResponse::page($page, ClassResource::toWire(...));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(ClassResource::toWire($this->classes->get($request->user(), $id)));
    }

    public function store(StoreClassRequest $request): JsonResponse
    {
        $class = $this->classes->create($request->user(), $request->validated());

        return ApiResponse::item(ClassResource::toWire($class), 201);
    }

    public function update(UpdateClassRequest $request, string $id): JsonResponse
    {
        return ApiResponse::item(ClassResource::toWire($this->classes->update($request->user(), $id, $request->validated())));
    }

    public function archive(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(ClassResource::toWire($this->classes->archive($request->user(), $id)));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->classes->delete($request->user(), $id);

        return ApiResponse::noContent();
    }
}
