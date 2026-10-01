<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Attendance\AttendanceService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\BulkAttendanceRequest;
use App\Http\Requests\Attendance\CorrectAttendanceRequest;
use App\Http\Requests\Attendance\ListAttendanceRequest;
use App\Http\Requests\Attendance\ListCorrectionsRequest;
use App\Http\Requests\Attendance\StoreAttendanceRequest;
use App\Http\Requests\Attendance\WithAttendanceRequest;
use App\Http\Resources\AttendanceResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AttendanceController extends Controller
{
    public function __construct(private readonly AttendanceService $attendance) {}

    public function index(ListAttendanceRequest $request): JsonResponse
    {
        $page = $this->attendance->list($request->user(), $request->validated(), Pagination::fromRequest($request));

        return ApiResponse::page($page, AttendanceResource::toWire(...));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(AttendanceResource::toWire($this->attendance->get($request->user(), $id)));
    }

    public function store(StoreAttendanceRequest $request): JsonResponse
    {
        return ApiResponse::item(AttendanceResource::toWire($this->attendance->record($request->user(), $request->validated())), 201);
    }

    /** All or nothing: one transaction, no partial register. */
    public function bulk(BulkAttendanceRequest $request): JsonResponse
    {
        $records = $this->attendance->bulk($request->user(), $request->validated());

        return ApiResponse::list(
            array_map(AttendanceResource::toWire(...), $records),
            1,
            max(1, count($records)),
            count($records),
        );
    }

    /** A verb: appends the correction and moves the record atomically. */
    public function correct(CorrectAttendanceRequest $request, string $id): JsonResponse
    {
        return ApiResponse::item(AttendanceResource::toWire($this->attendance->correct($request->user(), $id, $request->validated())));
    }

    /** The audit trail. Read-only by construction — there is no write route. */
    public function corrections(ListCorrectionsRequest $request): JsonResponse
    {
        $page = $this->attendance->corrections($request->user(), $request->validated(), Pagination::fromRequest($request));

        return ApiResponse::page($page, AttendanceResource::correctionToWire(...));
    }

    public function sessionAttendance(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item($this->attendance->sessionAttendance($request->user(), $id));
    }

    /** Ids only: enough to mark which days are done, without loading records. */
    public function withAttendance(WithAttendanceRequest $request): JsonResponse
    {
        $ids = $this->attendance->sessionIdsWithAttendance($request->user(), $request->validated());

        return ApiResponse::list($ids, 1, max(1, count($ids)), count($ids));
    }
}
