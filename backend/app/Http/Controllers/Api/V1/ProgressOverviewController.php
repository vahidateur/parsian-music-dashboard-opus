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
 * `GET /students/{id}/progress-overview` (TS `StudentProgressOverview`).
 *
 * Authorization is asked FIRST, so an unauthorized caller gets 403 rather than a
 * 404 that would reveal whether the student id exists. A student in another
 * organization is invisible to the tenant-scoped query and 404s the same way an
 * unknown id does.
 *
 * The overview is read-only by construction: it recomputes insights and
 * recommendations from the log on every call and stores nothing.
 */
final class ProgressOverviewController extends Controller
{
    public function __construct(
        private readonly ProgressPolicy $policy,
        private readonly ProgressEventService $events,
    ) {}

    public function show(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(ProgressOverviewResource::toWire($this->events->overviewFor($id)));
    }
}
