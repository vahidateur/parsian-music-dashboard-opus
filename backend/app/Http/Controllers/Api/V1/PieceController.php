<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Progress\PieceService;
use App\Domain\Progress\ProgressPolicy;
use App\Http\Controllers\Controller;
use App\Http\Requests\Progress\ListPiecesRequest;
use App\Http\Requests\Progress\StorePieceRequest;
use App\Http\Requests\Progress\UpdatePieceRequest;
use App\Http\Resources\PieceResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Repertoire — `GET|POST /pieces` and `GET|PATCH|DELETE /pieces/{id}`, the
 * contract written in src/domains/progress/apiRepository.ts.
 *
 * Authorization is asked FIRST in every action, so a caller without the
 * permission is refused before a body is read or a row is looked up: an
 * unauthorized caller gets 403, never a 404 that would reveal whether the id
 * exists, and never a 422 that would make validation an oracle.
 */
final class PieceController extends Controller
{
    public function __construct(
        private readonly ProgressPolicy $policy,
        private readonly PieceService $pieces,
    ) {}

    public function index(ListPiecesRequest $request): JsonResponse
    {
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->pieces->paginate($request->validated(), $pagination->page, $pagination->perPage),
            PieceResource::toWire(...),
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(PieceResource::toWire($this->pieces->findOrFail($id)));
    }

    public function store(StorePieceRequest $request): JsonResponse
    {
        return ApiResponse::item(PieceResource::toWire($this->pieces->create($request->validated())), 201);
    }

    public function update(UpdatePieceRequest $request, string $id): JsonResponse
    {
        $piece = $this->pieces->update($this->pieces->findOrFail($id), $request->validated());

        return ApiResponse::item(PieceResource::toWire($piece));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->pieces->delete($this->pieces->findOrFail($id));

        return ApiResponse::noContent();
    }
}
