<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Scheduling\SessionGenerator;
use App\Domain\Scheduling\SessionService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Scheduling\CancelSessionRequest;
use App\Http\Requests\Scheduling\CheckConflictsRequest;
use App\Http\Requests\Scheduling\GenerateSessionsRequest;
use App\Http\Requests\Scheduling\ListSessionsRequest;
use App\Http\Requests\Scheduling\RescheduleSessionRequest;
use App\Http\Requests\Scheduling\StoreSessionRequest;
use App\Http\Requests\Scheduling\UpdateSessionRequest;
use App\Http\Resources\SessionResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class SessionController extends Controller
{
    public function __construct(
        private readonly SessionService $sessions,
        private readonly SessionGenerator $generator,
    ) {}

    public function index(ListSessionsRequest $request): JsonResponse
    {
        $page = $this->sessions->list($request->user(), $request->validated(), Pagination::fromRequest($request));

        return ApiResponse::page($page, SessionResource::toWire(...));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return ApiResponse::item(SessionResource::toWire($this->sessions->get($request->user(), $id)));
    }

    public function store(StoreSessionRequest $request): JsonResponse
    {
        $session = $this->sessions->create($request->user(), $request->validated());

        return ApiResponse::item(SessionResource::toWire($session), 201);
    }

    public function update(UpdateSessionRequest $request, string $id): JsonResponse
    {
        return ApiResponse::item(SessionResource::toWire($this->sessions->update($request->user(), $id, $request->validated())));
    }

    public function destroy(Request $request, string $id): Response
    {
        $this->sessions->delete($request->user(), $id);

        return ApiResponse::noContent();
    }

    /** A verb, not a status patch: the reason is recorded with the transition. */
    public function cancel(CancelSessionRequest $request, string $id): JsonResponse
    {
        $validated = $request->validated();

        return ApiResponse::item(SessionResource::toWire($this->sessions->cancel($request->user(), $id, (string) $validated['reason'])));
    }

    /** Returns the NEW session; the cancelled original links forward to it. */
    public function reschedule(RescheduleSessionRequest $request, string $id): JsonResponse
    {
        return ApiResponse::item(SessionResource::toWire($this->sessions->reschedule($request->user(), $id, $request->validated())));
    }

    /**
     * `?preview=1` is strictly read-only and takes no locks; without it the
     * plan is applied. One endpoint with a preview flag guarantees the preview
     * and the commit compute the same plan.
     */
    public function generate(GenerateSessionsRequest $request): JsonResponse
    {
        $input = $request->validated();
        $preview = filter_var($request->query('preview'), FILTER_VALIDATE_BOOLEAN);

        if ($preview) {
            return ApiResponse::item($this->generator->preview($request->user(), $input));
        }

        $result = $this->generator->apply($request->user(), $input);

        return ApiResponse::item([
            'plan' => $result['plan'],
            'created' => array_map(SessionResource::toWire(...), $result['created']),
            'updated' => array_map(SessionResource::toWire(...), $result['updated']),
            'noop' => $result['noop'],
        ]);
    }

    /** Conflicts are derived, never stored. */
    public function checkConflicts(CheckConflictsRequest $request): JsonResponse
    {
        return ApiResponse::item($this->sessions->checkConflicts($request->user(), $request->validated())->toWire());
    }

    /** Who is expected: derived from active enrollment, never stored. */
    public function roster(Request $request, string $id): JsonResponse
    {
        $entries = $this->sessions->roster($request->user(), $id);

        return ApiResponse::list($entries, 1, max(1, count($entries)), count($entries));
    }
}
