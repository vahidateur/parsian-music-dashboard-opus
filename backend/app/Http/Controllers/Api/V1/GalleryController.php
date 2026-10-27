<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Gallery\GalleryPolicy;
use App\Domain\Gallery\GalleryService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Gallery\ReorderImageRequest;
use App\Http\Requests\Gallery\StoreAlbumRequest;
use App\Http\Requests\Gallery\StoreImageRequest;
use App\Http\Requests\Gallery\UpdateAlbumRequest;
use App\Http\Requests\Gallery\UpdateImageRequest;
use App\Http\Resources\GalleryAlbumResource;
use App\Http\Resources\GalleryImageResource;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Every action asks GalleryPolicy FIRST (reads need `gallery.read`, writes
 * need `gallery.write`). FormRequests are resolved only after that check, so
 * an invalid body never turns a 403 into a 422.
 */
final class GalleryController extends Controller
{
    public function __construct(
        private readonly GalleryPolicy $policy,
        private readonly GalleryService $gallery,
    ) {}

    /* ------------------------------------------------------------ albums */

    public function indexAlbums(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());
        $filters = $request->only(['search']);
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->gallery->listAlbums($filters, $pagination->page, $pagination->perPage),
            GalleryAlbumResource::toWire(...),
        );
    }

    public function showAlbum(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(GalleryAlbumResource::toWire($this->gallery->getAlbum($id)));
    }

    public function storeAlbum(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(StoreAlbumRequest::class)->validated();

        return ApiResponse::item(GalleryAlbumResource::toWire($this->gallery->createAlbum($input)), 201);
    }

    public function updateAlbum(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $album = $this->gallery->getAlbum($id);
        $input = app(UpdateAlbumRequest::class)->validated();

        return ApiResponse::item(GalleryAlbumResource::toWire($this->gallery->updateAlbum($album, $input)));
    }

    public function destroyAlbum(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->gallery->deleteAlbum($this->gallery->getAlbum($id));

        return ApiResponse::noContent();
    }

    /* ------------------------------------------------------------ images */

    public function indexImages(Request $request): JsonResponse
    {
        $this->policy->authorizeRead($request->user());
        // The wire is snake_case (as ApiGalleryRepository.toImageQuery sends
        // it); the service reads the domain's camelCase param. Both spellings
        // are accepted so a caller using either is filtered, never silently
        // unfiltered.
        $raw = $request->only(['albumId', 'album_id']);
        $filters = ['albumId' => $raw['albumId'] ?? $raw['album_id'] ?? null];
        $pagination = Pagination::fromRequest($request);

        return ApiResponse::page(
            $this->gallery->listImages($filters, $pagination->page, $pagination->perPage),
            GalleryImageResource::toWire(...),
        );
    }

    public function showImage(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeRead($request->user());

        return ApiResponse::item(GalleryImageResource::toWire($this->gallery->getImage($id)));
    }

    public function storeImage(Request $request): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $input = app(StoreImageRequest::class)->validated();

        return ApiResponse::item(GalleryImageResource::toWire($this->gallery->addImage($input)), 201);
    }

    public function updateImage(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $image = $this->gallery->getImage($id);
        $input = app(UpdateImageRequest::class)->validated();

        return ApiResponse::item(GalleryImageResource::toWire($this->gallery->updateImage($image, $input)));
    }

    public function destroyImage(Request $request, string $id): Response
    {
        $this->policy->authorizeWrite($request->user());
        $this->gallery->removeImage($this->gallery->getImage($id));

        return ApiResponse::noContent();
    }

    public function reorderImage(Request $request, string $id): JsonResponse
    {
        $this->policy->authorizeWrite($request->user());
        $image = $this->gallery->getImage($id);
        $input = app(ReorderImageRequest::class)->validated();

        return ApiResponse::item(GalleryImageResource::toWire($this->gallery->reorderImage($image, (int) $input['order'])));
    }
}
