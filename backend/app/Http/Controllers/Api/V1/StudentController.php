<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Students\StudentService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Students\ListStudentsRequest;
use App\Http\Requests\Students\StoreStudentRequest;
use App\Http\Requests\Students\UpdateStudentRequest;
use App\Http\Resources\StudentResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class StudentController extends Controller
{
    public function __construct(private readonly StudentService $students) {}

    public function index(ListStudentsRequest $request): JsonResponse
    {
        $page = $this->students->list($request->user(), $request->validated(), Pagination::fromRequest($request));

        return ApiResponse::page($page, StudentResource::toWire(...));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(StudentResource::toWire($this->students->get($request->user(), $id)));
    }

    public function store(StoreStudentRequest $request): JsonResponse
    {
        $student = $this->students->create($request->user(), $request->validated());

        return ApiResponse::item(StudentResource::toWire($student), 201);
    }

    public function update(UpdateStudentRequest $request, string $id): JsonResponse
    {
        return ApiResponse::item(StudentResource::toWire($this->students->update($request->user(), $id, $request->validated())));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->students->delete($request->user(), $id);

        return ApiResponse::noContent();
    }
}
