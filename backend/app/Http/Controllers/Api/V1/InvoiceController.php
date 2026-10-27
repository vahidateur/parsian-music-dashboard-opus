<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Finance\InvoicePolicy;
use App\Domain\Finance\InvoiceService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\PayInvoiceRequest;
use App\Http\Requests\Finance\StoreInvoiceRequest;
use App\Http\Requests\Finance\UpdateInvoiceRequest;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Every action asks InvoicePolicy FIRST (reads need `finance.read`, writes
 * need `finance.write`). FormRequests are resolved only after those checks,
 * so an invalid body never turns a 403 into a 422. The service authorizes
 * again — it is the authoritative check.
 */
final class InvoiceController extends Controller
{
    public function __construct(
        private readonly InvoicePolicy $policy,
        private readonly InvoiceService $invoices,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeRead($actor);
        // The wire is snake_case (as every Api repository's toQuery sends
        // it); the service reads the domain's camelCase params. Both spellings
        // are accepted so a camelCase caller is not silently unfiltered.
        $raw = $request->only([
            'studentId', 'student_id',
            'status',
        ]);
        $filters = [
            'studentId' => $raw['studentId'] ?? $raw['student_id'] ?? null,
            'status' => $raw['status'] ?? null,
        ];
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->invoices->list($actor, $filters, $pagination->page, $pagination->perPage),
            static fn (array $row): array => $row,
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeRead($actor);

        return ApiResponse::item($this->invoices->get($actor, $id));
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();
        $input = app(StoreInvoiceRequest::class)->validated();

        return ApiResponse::item($this->invoices->issue($actor, $input), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $input = app(UpdateInvoiceRequest::class)->validated();

        return ApiResponse::item($this->invoices->update($actor, $id, $input));
    }

    public function pay(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $input = app(PayInvoiceRequest::class)->validated();

        return ApiResponse::item($this->invoices->pay($actor, $id, $input));
    }
}
