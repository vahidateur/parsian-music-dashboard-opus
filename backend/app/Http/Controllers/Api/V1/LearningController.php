<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Learning\LearningPolicy;
use App\Domain\Learning\LearningService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Learning\AssignPlacementRequest;
use App\Http\Requests\Learning\AttachContentRequest;
use App\Http\Requests\Learning\ReorderLevelRequest;
use App\Http\Requests\Learning\StoreContentRequest;
use App\Http\Requests\Learning\StoreLevelRequest;
use App\Http\Requests\Learning\StoreProgramRequest;
use App\Http\Requests\Learning\UpdateContentRequest;
use App\Http\Requests\Learning\UpdateLevelRequest;
use App\Http\Requests\Learning\UpdateProgramRequest;
use App\Support\Api\ApiException;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Every action asks LearningPolicy FIRST. FormRequests are resolved only
 * after that check, so an invalid body never turns the block into a 422.
 */
final class LearningController extends Controller
{
    public function __construct(
        private readonly LearningPolicy $policy,
        private readonly LearningService $learning,
    ) {}

    /* ------------------------------------------------------------ programs */

    public function indexPrograms(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'instrumentId' => ['nullable', 'string', 'max:64'],
            'activeOnly' => ['nullable', 'boolean'],
        ]);
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->learning->listPrograms($filters, $pagination->page, $pagination->perPage),
            LearningService::toProgramWire(...),
        );
    }

    public function showProgram(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(LearningService::toProgramWire($this->learning->getProgram($id)));
    }

    public function storeProgram(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(StoreProgramRequest::class)->validated();

        return ApiResponse::item(LearningService::toProgramWire($this->learning->createProgram($input)), 201);
    }

    public function updateProgram(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $program = $this->learning->getProgram($id);
        $input = app(UpdateProgramRequest::class)->validated();

        return ApiResponse::item(LearningService::toProgramWire($this->learning->updateProgram($program, $input)));
    }

    public function destroyProgram(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->learning->deleteProgram($this->learning->getProgram($id));

        return ApiResponse::noContent();
    }

    /* -------------------------------------------------------------- levels */

    public function indexLevels(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());
        $filters = $request->validate([
            'programId' => ['nullable', 'string', 'max:64'],
            'activeOnly' => ['nullable', 'boolean'],
        ]);
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->learning->listLevels($filters, $pagination->page, $pagination->perPage),
            LearningService::toLevelWire(...),
        );
    }

    public function showLevel(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(LearningService::toLevelWire($this->learning->getLevel($id)));
    }

    public function storeLevel(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(StoreLevelRequest::class)->validated();

        return ApiResponse::item(LearningService::toLevelWire($this->learning->createLevel($input)), 201);
    }

    public function updateLevel(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $level = $this->learning->getLevel($id);
        $input = app(UpdateLevelRequest::class)->validated();

        return ApiResponse::item(LearningService::toLevelWire($this->learning->updateLevel($level, $input)));
    }

    public function reorderLevel(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $level = $this->learning->getLevel($id);
        $input = app(ReorderLevelRequest::class)->validated();

        return ApiResponse::item(LearningService::toLevelWire($this->learning->reorderLevel($level, (int) $input['order'])));
    }

    public function destroyLevel(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->learning->deleteLevel($this->learning->getLevel($id));

        return ApiResponse::noContent();
    }

    /* ------------------------------------------------------------- content */

    public function indexContent(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());
        $filters = $request->validate([
            'type' => ['nullable', 'string'],
            'search' => ['nullable', 'string', 'max:120'],
            'activeOnly' => ['nullable', 'boolean'],
            'levelId' => ['nullable', 'string', 'max:64'],
        ]);
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->learning->listContent($filters, $pagination->page, $pagination->perPage),
            LearningService::toContentWire(...),
        );
    }

    public function showContent(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(LearningService::toContentWire($this->learning->getContent($id)));
    }

    public function storeContent(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(StoreContentRequest::class)->validated();

        return ApiResponse::item(LearningService::toContentWire($this->learning->createContent($input)), 201);
    }

    public function updateContent(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $content = $this->learning->getContent($id);
        $input = app(UpdateContentRequest::class)->validated();

        return ApiResponse::item(LearningService::toContentWire($this->learning->updateContent($content, $input)));
    }

    public function destroyContent(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->learning->deleteContent($this->learning->getContent($id));

        return ApiResponse::noContent();
    }

    /* --------------------------------------------------------------- links */

    public function indexLinks(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());
        $filters = $request->validate([
            'levelId' => ['nullable', 'string', 'max:64'],
        ]);

        $links = array_map(
            LearningService::toLinkWire(...),
            $this->learning->listLinks($filters['levelId'] ?? null),
        );

        return ApiResponse::list($links, 1, max(count($links), 1), count($links));
    }

    public function storeLink(Request $request, string $levelId): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(AttachContentRequest::class)->validated();

        $link = $this->learning->attachContent($levelId, (string) $input['contentId'], (string) $input['programId']);

        return ApiResponse::item(LearningService::toLinkWire($link), 201);
    }

    public function destroyLink(Request $request, string $levelId, string $contentId): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->learning->detachContent($levelId, $contentId);

        return ApiResponse::noContent();
    }

    /* ---------------------------------------------------------- placements */

    public function indexPlacements(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());
        $filters = $request->validate([
            'studentId' => ['nullable', 'string', 'max:64'],
            'programId' => ['nullable', 'string', 'max:64'],
            'levelId' => ['nullable', 'string', 'max:64'],
        ]);
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->learning->listPlacements($filters, $pagination->page, $pagination->perPage),
            LearningService::toPlacementWire(...),
        );
    }

    public function showPlacement(Request $request, string $studentId): JsonResponse
    {
        $this->policy->authorizeRead($request->user());
        $placement = $this->learning->getStudentPlacement($studentId);
        if ($placement === null) {
            throw ApiException::notFound('PLACEMENT_NOT_FOUND', 'سطح‌بندی هنرجو یافت نشد.');
        }

        return ApiResponse::item(LearningService::toPlacementWire($placement));
    }

    public function storePlacement(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(AssignPlacementRequest::class)->validated();

        return ApiResponse::item(LearningService::toPlacementWire($this->learning->assignPlacement($input)));
    }

    public function destroyPlacement(Request $request, string $studentId): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->learning->removePlacement($studentId);

        return ApiResponse::noContent();
    }

    /* ------------------------------------------------------------- derived */

    public function eligibleContent(Request $request, string $studentId): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        $rows = $this->learning->eligibleContent($studentId);

        return ApiResponse::list($rows, 1, max(count($rows), 1), count($rows));
    }

    public function lockedContent(Request $request, string $studentId): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        $rows = $this->learning->lockedContent($studentId);

        return ApiResponse::list($rows, 1, max(count($rows), 1), count($rows));
    }

    public function eligibleStudents(Request $request, string $contentId): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        $ids = $this->learning->eligibleStudentIds($contentId);

        return ApiResponse::list($ids, 1, max(count($ids), 1), count($ids));
    }
}
