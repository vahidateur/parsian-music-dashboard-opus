<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Progress\ProgressEventService;
use App\Domain\Progress\ProgressPolicy;
use App\Http\Controllers\Controller;
use App\Http\Requests\Progress\ListProgressEventsRequest;
use App\Http\Requests\Progress\StoreProgressEventRequest;
use App\Http\Resources\ProgressEventResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * The progress log — `GET|POST /progress-events`.
 *
 * APPEND-ONLY, and that is a routing fact rather than a convention: there is
 * no PUT, PATCH or DELETE action here and no route to one. Correcting a mistake
 * appends a new event rather than rewriting the past, which is what keeps a
 * chart from silently changing shape.
 */
final class ProgressEventController extends Controller
{
    public function __construct(
        private readonly ProgressPolicy $policy,
        private readonly ProgressEventService $events,
    ) {}

    public function index(ListProgressEventsRequest $request): JsonResponse
    {
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->events->paginate($request->validated(), $pagination->page, $pagination->perPage),
            ProgressEventResource::toWire(...),
        );
    }

    public function store(StoreProgressEventRequest $request): JsonResponse
    {
        return ApiResponse::item(
            ProgressEventResource::toWire($this->events->record($request->validated())),
            201,
        );
    }
}
