<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Library\ResourcePolicy;
use App\Domain\Library\ResourceService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Library\ListResourcesRequest;
use App\Http\Requests\Library\StoreResourceRequest;
use App\Http\Requests\Library\UpdateResourceRequest;
use App\Http\Resources\ResourceResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Library resources — `GET|POST /resources` and
 * `GET|PATCH|DELETE /resources/{id}`, the contract written in
 * src/domains/library/apiRepository.ts.
 *
 * Authorization is asked FIRST in every action, so a caller without the
 * permission is refused before a body is read or a row is looked up: an
 * unauthorized caller gets 403, never a 404 that would reveal whether the id
 * exists, and never a 422 that would make validation an oracle.
 *
 * File endpoints (`POST /uploads`, `GET /resources/{id}/download`) are NOT
 * implemented here. The client contract keeps binaries out of the resource
 * repository, and the spec classifies storage, signed URLs and per-object auth
 * as back-end-later. `mediaId` is stored as an opaque reference.
 */
final class ResourceController extends Controller
{
    public function __construct(
        private readonly ResourcePolicy $policy,
        private readonly ResourceService $resources,
    ) {}

    public function index(ListResourcesRequest $request): JsonResponse
    {
        $pagination = Pagination::fromRequest($request);
        $validated = $request->validated();

        return ApiResponse::page(
            $this->resources->paginate(
                $validated,
                $pagination->page,
                $pagination->perPage,
                isset($validated['sort']) ? (string) $validated['sort'] : null,
            ),
            ResourceResource::toWire(...),
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(ResourceResource::toWire($this->resources->findOrFail($id)));
    }

    public function store(StoreResourceRequest $request): JsonResponse
    {
        $resource = $this->resources->create($request->validated());

        return ApiResponse::item(ResourceResource::toWire($resource), 201);
    }

    public function update(UpdateResourceRequest $request, string $id): JsonResponse
    {
        $resource = $this->resources->update($this->resources->findOrFail($id), $request->validated());

        return ApiResponse::item(ResourceResource::toWire($resource));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->resources->delete($this->resources->findOrFail($id));

        return ApiResponse::noContent();
    }
}
