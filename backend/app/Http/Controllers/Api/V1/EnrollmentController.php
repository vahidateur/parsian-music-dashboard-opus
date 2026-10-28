<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Enrollments\EnrollmentService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Enrollments\ListEnrollmentsRequest;
use App\Http\Requests\Enrollments\StoreEnrollmentRequest;
use App\Http\Requests\Enrollments\UpdateEnrollmentRequest;
use App\Http\Resources\EnrollmentResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class EnrollmentController extends Controller
{
    public function __construct(private readonly EnrollmentService $enrollments) {}

    public function index(ListEnrollmentsRequest $request): JsonResponse
    {
        $page = $this->enrollments->list($request->user(), $request->validated(), Pagination::fromRequest($request));

        return ApiResponse::page($page, EnrollmentResource::toWire(...));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(EnrollmentResource::toWire($this->enrollments->get($request->user(), $id)));
    }

    public function store(StoreEnrollmentRequest $request): JsonResponse
    {
        $enrollment = $this->enrollments->enroll($request->user(), $request->validated());

        return ApiResponse::item(EnrollmentResource::toWire($enrollment), 201);
    }

    public function update(UpdateEnrollmentRequest $request, string $id): JsonResponse
    {
        return ApiResponse::item(EnrollmentResource::toWire($this->enrollments->update($request->user(), $id, $request->validated())));
    }

    public function withdraw(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(EnrollmentResource::toWire($this->enrollments->withdraw($request->user(), $id)));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->enrollments->delete($request->user(), $id);

        return ApiResponse::noContent();
    }
}
