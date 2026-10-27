<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Branding\BrandingPolicy;
use App\Domain\Branding\BrandingService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Branding\UpdateBrandingRequest;
use App\Http\Resources\BrandingResource;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The academy's identity — `GET` and `PATCH /branding`, exactly the contract
 * in `src/domains/branding/repository.ts`.
 *
 * Reads need `branding.read`, writes need `branding.write` (DECISIONS.md
 * §38) — enforced here, never borrowed from `settings.*`. The policy is
 * asked FIRST in both actions, so a caller without the permission is refused
 * before a body is ever read.
 */
final class BrandingController extends Controller
{
    public function __construct(
        private readonly BrandingPolicy $policy,
        private readonly BrandingService $branding,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(BrandingResource::toWire($this->branding->get()));
    }

    public function update(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(UpdateBrandingRequest::class)->validated();

        return ApiResponse::item(BrandingResource::toWire($this->branding->update($input)));
    }
}
