<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Compensation\CompensationPolicy;
use App\Domain\Compensation\CompensationService;
use App\Domain\Scheduling\SessionPolicy;
use App\Http\Controllers\Controller;
use App\Http\Requests\Compensation\CompleteCompensationRequest;
use App\Http\Requests\Compensation\ScheduleCompensationRequest;
use App\Http\Requests\Compensation\StoreCompensationRequest;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Every action asks CompensationPolicy FIRST (reads need `schedule.read`,
 * writes need `schedule.write`), after the PB-1 teacher-link check where one
 * applies. FormRequests are resolved only after those checks, so an invalid
 * body never turns a 403 into a 422. Teacher scoping (own classes only) is
 * enforced inside the service on every read and write.
 */
final class CompensationController extends Controller
{
    public function __construct(
        private readonly CompensationPolicy $policy,
        private readonly SessionPolicy $sessions,
        private readonly CompensationService $compensations,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $this->sessions->assertTeacherLinked($actor);
        $this->policy->authorizeRead($actor);
        // The wire is snake_case (as every Api repository's toQuery sends
        // it); the service reads the domain's camelCase params. Both spellings
        // are accepted so a camelCase caller is not silently unfiltered.
        $raw = $request->only([
            'originalSessionId', 'original_session_id',
            'studentId', 'student_id',
            'classId', 'class_id',
            'status',
            'openOnly', 'open_only',
            'compensationSessionId', 'compensation_session_id',
            'needsAttention', 'needs_attention',
        ]);
        $filters = [
            'originalSessionId' => $raw['originalSessionId'] ?? $raw['original_session_id'] ?? null,
            'studentId' => $raw['studentId'] ?? $raw['student_id'] ?? null,
            'classId' => $raw['classId'] ?? $raw['class_id'] ?? null,
            'status' => $raw['status'] ?? null,
            'openOnly' => $raw['openOnly'] ?? $raw['open_only'] ?? null,
            'compensationSessionId' => $raw['compensationSessionId'] ?? $raw['compensation_session_id'] ?? null,
            'needsAttention' => $raw['needsAttention'] ?? $raw['needs_attention'] ?? null,
        ];
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->compensations->list($actor, $filters, $pagination->page, $pagination->perPage),
            static fn (array $row): array => $row,
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $this->sessions->assertTeacherLinked($actor);
        $this->policy->authorizeRead($actor);

        return ApiResponse::item($this->compensations->get($actor, $id));
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();
        $input = app(StoreCompensationRequest::class)->validated();

        return ApiResponse::item($this->compensations->register($actor, $input), 201);
    }

    public function schedule(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $input = app(ScheduleCompensationRequest::class)->validated();

        return ApiResponse::item($this->compensations->schedule($actor, $id, $input));
    }

    public function complete(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        $input = app(CompleteCompensationRequest::class)->validated();

        return ApiResponse::item($this->compensations->complete($actor, $id, $input));
    }
}
