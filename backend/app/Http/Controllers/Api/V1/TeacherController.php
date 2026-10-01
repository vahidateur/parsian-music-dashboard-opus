<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Teachers\TeacherService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Teachers\ListTeachersRequest;
use App\Http\Requests\Teachers\StoreTeacherRequest;
use App\Http\Requests\Teachers\UpdateTeacherRequest;
use App\Http\Resources\TeacherResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class TeacherController extends Controller
{
    public function __construct(private readonly TeacherService $teachers) {}

    public function index(ListTeachersRequest $request): JsonResponse
    {
        $page = $this->teachers->list($request->user(), $request->validated(), Pagination::fromRequest($request));

        return ApiResponse::page($page, TeacherResource::toWire(...));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(TeacherResource::toWire($this->teachers->get($request->user(), $id)));
    }

    public function store(StoreTeacherRequest $request): JsonResponse
    {
        $teacher = $this->teachers->create($request->user(), $request->validated());

        return ApiResponse::item(TeacherResource::toWire($teacher), 201);
    }

    public function update(UpdateTeacherRequest $request, string $id): JsonResponse
    {
        return ApiResponse::item(TeacherResource::toWire($this->teachers->update($request->user(), $id, $request->validated())));
    }

    public function deactivate(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(TeacherResource::toWire($this->teachers->deactivate($request->user(), $id)));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->teachers->delete($request->user(), $id);

        return ApiResponse::noContent();
    }
}
