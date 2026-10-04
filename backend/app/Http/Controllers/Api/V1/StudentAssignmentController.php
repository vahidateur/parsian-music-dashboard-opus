<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Progress\ProgressEventService;
use App\Domain\Progress\ProgressPolicy;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProgressOverviewResource;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * `GET /students/{id}/assignments` (TS `AssignmentWithPiece[]`).
 *
 * The 14th Progress endpoint, authorized 2026-10-03 to close the gap the
 * post-closure audit found: `ProgressRepository` requires `studentAssignments()`
 * and `ApiProgressRepository` implements it, but no route existed, so the API
 * repository was not a complete implementation of its own interface.
 *
 * It is deliberately the thin read it appears to be. The join, the ordering and
 * the tenant scoping already live in `ProgressEventService::assignmentsFor()`,
 * shared with the overview, and the pair is serialized by the same
 * `ProgressOverviewResource::toWirePair()` the overview uses — so this endpoint
 * cannot disagree with the overview about a student's assignments.
 *
 * Authorization is asked FIRST, exactly as the overview does, so an
 * unauthorized caller gets 403 rather than a 404 that would reveal whether the
 * student id exists. A student in another organization is invisible to the
 * tenant-scoped query and 404s the same way an unknown id does.
 *
 * The result is a PLAIN ARRAY, not a page: the contract returns
 * `AssignmentWithPiece[]`, and inventing pagination here would change a shape
 * the client already compiles against.
 */
final class StudentAssignmentController extends Controller
{
    public function __construct(
        private readonly ProgressPolicy $policy,
        private readonly ProgressEventService $events,
    ) {}

    public function index(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(array_map(
            [ProgressOverviewResource::class, 'toWirePair'],
            $this->events->assignmentsFor($id),
        ));
    }
}
