<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Organization\OrganizationPolicy;
use App\Domain\Organization\OrganizationService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organization\UpdateOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The academy's own rules — `GET /organization` and `PATCH /organization`.
 *
 * The contract is the one written in
 * src/domains/organization/apiRepository.ts (marked BACKEND REQUIRED): one
 * record, two verbs. There is no list and no delete, because an academy has
 * exactly one set of rules and "removing" a rule means writing the default back,
 * which `update` already does.
 *
 * The policy is asked FIRST in both actions, so a caller without the permission
 * is refused before a body is ever read.
 */
final class OrganizationController extends Controller
{
    public function __construct(
        private readonly OrganizationPolicy $policy,
        private readonly OrganizationService $organization,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(OrganizationResource::toWire($this->organization->get()));
    }

    public function update(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(UpdateOrganizationRequest::class)->validated();

        return ApiResponse::item(OrganizationResource::toWire($this->organization->update($input)));
    }
}
