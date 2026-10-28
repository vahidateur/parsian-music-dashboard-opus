<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Progress\AssignmentService;
use App\Domain\Progress\ProgressPolicy;
use App\Http\Controllers\Controller;
use App\Http\Requests\Progress\ListAssignmentsRequest;
use App\Http\Requests\Progress\StoreAssignmentRequest;
use App\Http\Requests\Progress\UpdateAssignmentRequest;
use App\Http\Resources\PieceAssignmentResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Piece assignments — `GET|POST /piece-assignments` and
 * `GET|PATCH|DELETE /piece-assignments/{id}`.
 *
 * Authorization is asked FIRST in every action, so an unauthorized caller gets
 * 403 rather than a 404 that would reveal whether the id exists.
 *
 * `studentId` and `pieceId` are accepted on create only. The update contract
 * excludes them, so an assignment can never be re-pointed at another student or
 * piece by patching.
 */
final class PieceAssignmentController extends Controller
{
    public function __construct(
        private readonly ProgressPolicy $policy,
        private readonly AssignmentService $assignments,
    ) {}

    public function index(ListAssignmentsRequest $request): JsonResponse
    {
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->assignments->paginate($request->validated(), $pagination->page, $pagination->perPage),
            PieceAssignmentResource::toWire(...),
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(PieceAssignmentResource::toWire($this->assignments->findOrFail($id)));
    }

    public function store(StoreAssignmentRequest $request): JsonResponse
    {
        return ApiResponse::item(
            PieceAssignmentResource::toWire($this->assignments->create($request->validated())),
            201,
        );
    }

    public function update(UpdateAssignmentRequest $request, string $id): JsonResponse
    {
        $assignment = $this->assignments->update($this->assignments->findOrFail($id), $request->validated());

        return ApiResponse::item(PieceAssignmentResource::toWire($assignment));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->assignments->delete($this->assignments->findOrFail($id));

        return ApiResponse::noContent();
    }
}
