<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Instruments\InstrumentPolicy;
use App\Domain\Instruments\InstrumentService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Instruments\StoreInstrumentRequest;
use App\Http\Requests\Instruments\UpdateInstrumentRequest;
use App\Http\Resources\InstrumentResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class InstrumentController extends Controller
{
    public function __construct(
        private readonly InstrumentPolicy $policy,
        private readonly InstrumentService $instruments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'activeOnly' => ['nullable', 'boolean'],
        ]);

        $pagination = Pagination::fromRequest($request);
        return ApiResponse::page(
            $this->instruments->list($filters, $pagination->page, $pagination->perPage),
            InstrumentResource::toWire(...),
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(InstrumentResource::toWire($this->instruments->get($id)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(StoreInstrumentRequest::class)->validated();

        return ApiResponse::item(InstrumentResource::toWire($this->instruments->create($input)), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $instrument = $this->instruments->get($id);
        $input = app(UpdateInstrumentRequest::class)->validated();

        return ApiResponse::item(InstrumentResource::toWire($this->instruments->update($instrument, $input)));
    }

    public function setActive(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $instrument = $this->instruments->get($id);
        $active = filter_var($request->input('active', true), FILTER_VALIDATE_BOOLEAN);

        return ApiResponse::item(InstrumentResource::toWire($this->instruments->setActive($instrument, $active)));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->instruments->delete($this->instruments->get($id));

        return ApiResponse::noContent();
    }
}
